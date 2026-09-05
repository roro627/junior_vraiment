import { describe, expect, it } from "vitest";

import type { PublicInsight } from "@/db/queries/public-insights";

import { buildInsightOgModel } from "./build-og-model";

const insight: PublicInsight = {
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
  metric: {
    metric: "junior_contradiction_rate",
    metricVersion: "junior-contradiction-1.0.0",
    value: 1 / 408,
    numerator: 1,
    denominator: 408,
    populationCount: 518,
    unknownCount: 0,
    ambiguousCount: 110,
    coverage: 408 / 518,
    sampleQuality: "normal",
  },
  periodStart: "2026-09-04",
  periodEnd: "2026-09-04",
  publishedAt: "2026-09-04T16:00:00.000Z",
  correctedAt: null,
  correctionNote: null,
  updatedAt: "2026-09-04T16:00:00.000Z",
  ogAlt: "Carte accessible.",
  datasetVersion: "dataset-v1",
  classifierVersion: "classifier-1.2.0",
  querySetVersion: "queries-2.0.0",
  sourceLabel: "France Travail",
  sourceAttributionUrl: "https://www.francetravail.fr/",
};

describe("buildInsightOgModel", () => {
  it("uses only the immutable stored snapshot", () => {
    expect(
      buildInsightOgModel(insight, "https://junior-vraiment.example"),
    ).toEqual({
      title: insight.title,
      value: "0,2\u00a0%",
      fraction: "1 sur 408",
      sample: "518 offres observées",
      period: "4 septembre 2026",
      territory: "France",
      source: "Données France Travail",
      domain: "junior-vraiment.example",
      method: "junior-contradiction-1.0.0",
    });
  });
});
