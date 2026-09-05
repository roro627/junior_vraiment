import type { NeonQueryFunction } from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";

import { getPublicInsight, listPublicInsights } from "./public-insights";

const row = {
  slug: "junior-et-deux-ans-france-2026-09-04",
  title: "0,2 % des offres junior classables demandent au moins deux ans",
  summary: "1 sur 408 offres classables.",
  status: "published",
  filters: {
    job: null,
    technologies: [],
    area: "france",
    contracts: [],
    remote: null,
    period: "current",
  },
  metricKey: "junior_contradiction_rate",
  metricVersion: "junior-contradiction-1.0.0",
  value: "0.00245098",
  numerator: "1",
  denominator: "408",
  populationCount: "518",
  unknownCount: "0",
  ambiguousCount: "110",
  coverage: "0.78764479",
  sampleQuality: "normal",
  periodStart: "2026-09-04",
  periodEnd: "2026-09-04",
  publishedAt: "2026-09-04T16:00:00.000Z",
  correctedAt: null,
  correctionNote: null,
  updatedAt: "2026-09-04T16:00:00.000Z",
  ogAlt: "Carte accessible de l’insight.",
  datasetVersion: "dataset-v1",
  classifierVersion: "classifier-1.2.0",
  querySetVersion: "queries-2.0.0",
  sourceLabel: "France Travail",
  sourceAttributionUrl: "https://www.francetravail.fr/",
};

function sqlWithRows(
  rows: ReadonlyArray<Record<string, unknown>>,
): NeonQueryFunction<false, false> {
  return vi.fn().mockResolvedValue(rows) as unknown as NeonQueryFunction<
    false,
    false
  >;
}

describe("public insights", () => {
  it("maps a stored snapshot without exposing internal identifiers", async () => {
    const insight = await getPublicInsight(
      sqlWithRows([row]),
      "junior-et-deux-ans-france-2026-09-04",
    );

    expect(insight?.metric).toMatchObject({
      numerator: 1,
      denominator: 408,
      populationCount: 518,
    });
    expect(JSON.stringify(insight)).not.toContain("113803eb");
  });

  it("rejects malformed slugs without querying", async () => {
    const sql = sqlWithRows([]);
    await expect(getPublicInsight(sql, "../secret")).resolves.toBeNull();
    expect(sql).not.toHaveBeenCalled();
  });

  it("returns only validated public snapshots", async () => {
    await expect(
      listPublicInsights(sqlWithRows([row]), 3),
    ).resolves.toHaveLength(1);
  });
});
