import type { NeonQueryFunction } from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";
import { trendsSearchParamsSchema } from "@/application/queries/contracts";
import { getPublicTrends } from "./public-trends";

vi.mock("./current-dataset", () => ({
  readCurrentDataset: vi.fn(async () => ({
    datasetVersion: "fixture-current",
    classifierVersion: "classifier-1.2.0",
    querySetVersion: "queries-3.0.0",
    metricVersions: { junior_contradiction_rate: "junior-contradiction-1.0.0" },
    qualitySummary: { decision: "publish" },
    sourceCutoffAt: new Date("2026-09-06T10:00:00Z"),
  })),
}));

const row = {
  date: "2026-09-06",
  datasetVersion: "fixture-new",
  classifierVersion: "classifier-1.2.0",
  querySetVersion: "queries-3.0.0",
  metricVersions: { junior_contradiction_rate: "junior-contradiction-1.0.0" },
  qualitySummary: { decision: "publish" },
  sampleSize: 100,
  contradictionNumerator: 20,
  contradictionDenominator: 60,
  contradictionUnknown: 10,
  contradictionAmbiguous: 5,
  beginnerNumerator: 20,
  beginnerDenominator: 70,
  beginnerUnknown: 20,
  beginnerAmbiguous: 10,
  salaryNumerator: 30,
};
describe("trend perimeter boundaries", () => {
  it.each([true, false])(
    "annotates only changed query versions: %s",
    async (changed) => {
      const query = vi.fn().mockResolvedValue([
        row,
        {
          ...row,
          date: "2026-09-04",
          datasetVersion: "fixture-old",
          querySetVersion: changed ? "queries-2.0.0" : "queries-3.0.0",
        },
      ]);
      const response = await getPublicTrends({
        sql: query as unknown as NeonQueryFunction<false, false>,
        query: trendsSearchParamsSchema.parse({
          metric: "junior_contradiction_rate",
          period: "current",
        }),
        generatedAt: new Date("2026-09-06T10:01:00Z"),
      });
      expect(response.data.points[1]?.annotation?.kind ?? null).toBe(
        changed ? "source_change" : null,
      );
      expect(response.data.points[1]?.numerator).toBe(20);
      expect(response.data.points[1]?.denominator).toBe(60);
      const sqlText = (query.mock.calls[0]![0] as TemplateStringsArray).join(
        "?",
      );
      expect(sqlText).toContain('query_set_version as "querySetVersion"');
      expect(sqlText).toContain("membership.job_families");
    },
  );
});
