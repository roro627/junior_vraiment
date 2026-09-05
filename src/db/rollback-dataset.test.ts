import type { NeonQueryFunction } from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";

import { rollbackDataset } from "./rollback-dataset";

function sqlWithRows(
  rows: ReadonlyArray<Record<string, unknown>>,
): NeonQueryFunction<false, false> {
  return vi.fn().mockResolvedValue(rows) as unknown as NeonQueryFunction<
    false,
    false
  >;
}

describe("rollbackDataset", () => {
  it("maps a confirmed atomic rollback", async () => {
    const sql = sqlWithRows([
      {
        changed: true,
        withdrawnDatasetId: "bad-id",
        withdrawnDatasetVersion: "dataset-bad",
        currentDatasetId: "healthy-id",
        currentDatasetVersion: "dataset-healthy",
        auditEventCount: 1,
      },
    ]);

    await expect(
      rollbackDataset({
        sql,
        targetDatasetVersion: "dataset-healthy",
        reasonCode: "GAME_DAY_ROLLBACK",
        rolledBackAt: new Date("2026-09-04T20:00:00Z"),
      }),
    ).resolves.toEqual({
      changed: true,
      withdrawnDatasetId: "bad-id",
      withdrawnDatasetVersion: "dataset-bad",
      currentDatasetId: "healthy-id",
      currentDatasetVersion: "dataset-healthy",
    });
  });

  it("rejects an unstructured reason before touching the database", async () => {
    const sql = sqlWithRows([]);

    await expect(
      rollbackDataset({
        sql,
        targetDatasetVersion: "dataset-healthy",
        reasonCode: "because the number looked wrong",
        rolledBackAt: new Date(),
      }),
    ).rejects.toThrow("code de motif");
    expect(sql).not.toHaveBeenCalled();
  });

  it("accepts an idempotent replay only when no duplicate audit was written", async () => {
    await expect(
      rollbackDataset({
        sql: sqlWithRows([
          {
            changed: false,
            withdrawnDatasetId: "healthy-id",
            withdrawnDatasetVersion: "dataset-healthy",
            currentDatasetId: "healthy-id",
            currentDatasetVersion: "dataset-healthy",
            auditEventCount: 0,
          },
        ]),
        targetDatasetVersion: "dataset-healthy",
        reasonCode: "GAME_DAY_ROLLBACK",
        rolledBackAt: new Date(),
      }),
    ).resolves.toMatchObject({ changed: false });
  });
});
