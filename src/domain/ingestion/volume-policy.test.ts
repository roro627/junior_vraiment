import { describe, expect, it } from "vitest";
import { assessPartitionVolumes } from "./volume-policy";

describe("partition volume guard", () => {
  it("keeps the observed 8 to 3 decline as a warning when only four offers are missing from the whole run", () => {
    const partition = {
      queryId: "fixture-overlap",
      previous: 8,
      current: 3,
      missingFromRun: 4,
    };
    expect(assessPartitionVolumes([partition])).toEqual({
      blocking: false,
      warnings: [partition],
    });
  });
  it.each([5, 6, 8])(
    "still blocks 8 to 3 when %i previous offers are missing from the complete run",
    (missingFromRun) => {
      expect(
        assessPartitionVolumes([
          { queryId: "fixture", previous: 8, current: 3, missingFromRun },
        ]).blocking,
      ).toBe(true);
    },
  );
  it("does not let recovered overlap hide a different material loss", () => {
    expect(
      assessPartitionVolumes([
        { queryId: "recovered", previous: 8, current: 3, missingFromRun: 4 },
        { queryId: "missing", previous: 10, current: 0, missingFromRun: 5 },
      ]).blocking,
    ).toBe(true);
  });
  it.each([-1, 1.5, Number.NaN, 9])(
    "rejects invalid missing coverage %s",
    (missingFromRun) => {
      expect(() =>
        assessPartitionVolumes([
          { queryId: "fixture", previous: 8, current: 3, missingFromRun },
        ]),
      ).toThrow(RangeError);
    },
  );
  it.each([
    [1, 2],
    [1, 5],
    [2, 4],
    [1, 0],
    [4, 0],
    [5, 1],
    [1, 6],
    [5, 10],
    [100, 161],
    [24, 44],
    [138, 233],
  ])(
    "records growth or small losses %s → %s without blocking",
    (previous, current) => {
      const partition = { queryId: "fixture", previous, current };
      expect(assessPartitionVolumes([partition])).toEqual({
        blocking: false,
        warnings: [partition],
      });
    },
  );
  it.each([
    [5, 0],
    [6, 1],
    [10, 3],
  ])("blocks material losses %s → %s", (previous, current) => {
    expect(
      assessPartitionVolumes([{ queryId: "fixture", previous, current }])
        .blocking,
    ).toBe(true);
  });
  it.each([
    [5, 8],
    [100, 160],
    [100, 40],
    [0, 10],
  ])(
    "preserves inclusive boundary or absent baseline %s → %s",
    (previous, current) => {
      expect(
        assessPartitionVolumes([{ queryId: "fixture", previous, current }]),
      ).toEqual({ blocking: false, warnings: [] });
    },
  );
  it("does not let a small increase suppress another partition's loss", () => {
    const result = assessPartitionVolumes([
      { queryId: "a", previous: 1, current: 2 },
      { queryId: "b", previous: 10, current: 0 },
    ]);
    expect(result.blocking).toBe(true);
    expect(result.warnings).toHaveLength(1);
  });
  it("does not let a small loss suppress another partition's anomaly", () => {
    const smallLoss = { queryId: "small-loss", previous: 1, current: 0 };
    for (const material of [
      { queryId: "loss", previous: 5, current: 0 },
      { queryId: "larger-loss", previous: 100, current: 30 },
    ]) {
      expect(assessPartitionVolumes([smallLoss, material])).toEqual({
        blocking: true,
        warnings: [smallLoss],
      });
    }
  });
  it.each([-1, 1.5, Number.NaN])("rejects invalid count %s", (previous) => {
    expect(() =>
      assessPartitionVolumes([{ queryId: "fixture", previous, current: 2 }]),
    ).toThrow(RangeError);
  });
});
