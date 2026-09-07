import { describe, expect, it } from "vitest";
import { assessPartitionVolumes } from "./volume-policy";

describe("partition volume guard", () => {
  it.each([
    [1, 2],
    [1, 5],
    [2, 4],
    [1, 0],
    [4, 0],
    [5, 1],
  ])("records small changes %s → %s without blocking", (previous, current) => {
    const partition = { queryId: "fixture", previous, current };
    expect(assessPartitionVolumes([partition])).toEqual({
      blocking: false,
      warnings: [partition],
    });
  });
  it.each([
    [1, 6],
    [5, 10],
    [100, 161],
    [5, 0],
    [6, 1],
    [10, 3],
  ])("blocks material growth or losses %s → %s", (previous, current) => {
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
      { queryId: "growth", previous: 5, current: 10 },
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
