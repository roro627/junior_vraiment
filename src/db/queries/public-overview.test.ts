// @vitest-environment node
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";

import { overviewSearchParamsSchema } from "@/application/queries/contracts";
import { NoPublishedDatasetError } from "./current-dataset";
import { getPublicOverview } from "./public-overview";

// Explicitly synthetic transaction results, not external integration evidence.
const dataset = {
  datasetId: "00000000-0000-4000-8000-000000000001",
  datasetVersion: "fixture-publication",
  sourceId: "00000000-0000-4000-8000-000000000002",
  ingestionRunId: null,
  classifierVersion: "classifier-1.3.7",
  metricVersions: {
    junior_contradiction_rate: "junior-contradiction-2.0.0",
    beginner_friendly_rate: "beginner-friendly-1.0.0",
    salary_transparency_rate: "salary-transparency-1.0.0",
  },
  querySetVersion: "fixture-queries",
  taxonomyVersions: {},
  qualitySummary: {},
  sourceCutoffAt: "2026-09-19T01:45:00Z",
  computedAt: "2026-09-19T01:46:00Z",
  publishedAt: "2026-09-19T01:47:00Z",
  memberCount: 0,
  sourceLabel: "Fixture source",
  sourceAttributionUrl: "https://example.invalid/source",
};
const empty = {
  sampleSize: 0,
  contradictionNumerator: 0,
  contradictionDenominator: 0,
  contradictionUnknown: 0,
  contradictionAmbiguous: 0,
  beginnerNumerator: 0,
  beginnerDenominator: 0,
  beginnerUnknown: 0,
  beginnerAmbiguous: 0,
  salaryNumerator: 0,
  experienceBuckets: [],
  technologies: [],
  contracts: [],
  remoteModes: [],
};

function fixtureSql(results: unknown) {
  const transaction = vi.fn().mockResolvedValue(results);
  const query = vi.fn((parts: TemplateStringsArray) => ({
    statement: parts.join("?"),
  }));
  const sql = Object.assign(query, {
    transaction,
  }) as unknown as NeonQueryFunction<false, false>;
  return { sql, query, transaction };
}

describe("overview snapshot transaction", () => {
  it("uses one read-only repeatable-read transaction for metadata and cards", async () => {
    const { sql, query, transaction } = fixtureSql([[dataset], [empty]]);
    const response = await getPublicOverview({
      sql,
      query: overviewSearchParamsSchema.parse({ period: "current" }),
      generatedAt: new Date(),
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          statement: expect.stringContaining("current_dataset as materialized"),
        }),
      ]),
      { isolationLevel: "RepeatableRead", readOnly: true },
    );
    expect(query).toHaveBeenCalledTimes(2);
    expect(response.meta.datasetVersion).toBe(dataset.datasetVersion);
    expect(response.meta.dataAsOf).toBe("2026-09-19T01:45:00.000Z");
    expect(response.data.headline.value).toBeNull();
  });

  it.each([{ rows: [] }, { rows: [dataset, dataset] }])(
    "rejects a missing or nonunique public dataset",
    async ({ rows }) => {
      const { sql } = fixtureSql([rows, [empty]]);
      await expect(
        getPublicOverview({
          sql,
          query: overviewSearchParamsSchema.parse({}),
          generatedAt: new Date(),
        }),
      ).rejects.toBeInstanceOf(NoPublishedDatasetError);
    },
  );

  it("rejects an incomplete transaction response", async () => {
    const { sql } = fixtureSql([[dataset]]);
    await expect(
      getPublicOverview({
        sql,
        query: overviewSearchParamsSchema.parse({}),
        generatedAt: new Date(),
      }),
    ).rejects.toThrow("Incomplete overview transaction");
  });
});
