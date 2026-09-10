import type { NeonQueryFunction } from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";
import { publishDataset } from "./publish-dataset";

describe("publishDataset", () => {
  it("never clears the target before marking it current in the same statement", async () => {
    const datasetId = "fixture-dataset";
    const query = vi.fn(
      async (parts: TemplateStringsArray, ...values: unknown[]) => {
        const sql = parts.join("?");
        expect(sql).toMatch(/where is_current = true\s+and id <> \?/u);
        expect(sql).toContain("length(dataset_version) between 1 and 100");
        expect(values.filter((value) => value === datasetId)).toHaveLength(2);
        return [{ id: datasetId }];
      },
    );
    await publishDataset({
      sql: query as unknown as NeonQueryFunction<false, false>,
      datasetId,
      publishedAt: new Date("2026-09-06T08:00:00Z"),
    });
  });
  it("rejects a target that did not pass the publication constraints", async () => {
    const sql = vi.fn(async () => []) as unknown as NeonQueryFunction<
      false,
      false
    >;
    await expect(
      publishDataset({ sql, datasetId: "fixture", publishedAt: new Date() }),
    ).rejects.toThrow("Le dataset doit être validé");
  });
});
