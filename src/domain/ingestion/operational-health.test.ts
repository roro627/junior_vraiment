import { describe, expect, it } from "vitest";
import { assessOperationalChanges } from "./operational-health";

const normal = { members: 100, ambiguous: 10, durationMs: 1000 };
describe("operational changes at comparable perimeter", () => {
  it("ignores the database identity attached to a sample", () => {
    const sample = { ...normal, id: "fixture-dataset" };
    expect(assessOperationalChanges(sample, [])).toEqual([]);
  });
  it("does not invent a baseline", () =>
    expect(assessOperationalChanges(normal, [])).toEqual([]));
  it("detects a strictly greater than 40% drop", () => {
    expect(
      assessOperationalChanges({ ...normal, members: 60 }, [normal]),
    ).toEqual([]);
    expect(
      assessOperationalChanges({ ...normal, members: 59 }, [normal]),
    ).toEqual(["VOLUME_DROP_OVER_40_PERCENT"]);
  });
  it("compares ambiguity rates, not absolute counts", () => {
    expect(
      assessOperationalChanges({ ...normal, members: 200, ambiguous: 40 }, [
        normal,
      ]),
    ).toEqual([]);
    expect(
      assessOperationalChanges({ ...normal, ambiguous: 21 }, [normal]),
    ).toContain("AMBIGUITY_MORE_THAN_DOUBLED");
  });
  it("requires seven days before applying the median duration threshold", () => {
    expect(
      assessOperationalChanges(
        { ...normal, durationMs: 3000 },
        Array.from({ length: 6 }, () => normal),
      ),
    ).toEqual([]);
    expect(
      assessOperationalChanges(
        { ...normal, durationMs: 3000 },
        Array.from({ length: 7 }, () => normal),
      ),
    ).toEqual(["DURATION_OVER_TWICE_SEVEN_DAY_MEDIAN"]);
  });
  it("does not divide by zero or claim infinite ambiguity growth", () =>
    expect(
      assessOperationalChanges(normal, [
        { members: 0, ambiguous: 0, durationMs: 0 },
      ]),
    ).toEqual([]));
  it("rejects impossible aggregates", () =>
    expect(() =>
      assessOperationalChanges({ ...normal, ambiguous: 101 }, []),
    ).toThrow());
});
