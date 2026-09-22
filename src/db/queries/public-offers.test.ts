import type { NeonQueryFunction } from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";
import { offersSearchParamsSchema } from "@/application/queries/contracts";
import { getPublicOffers } from "./public-offers";

vi.mock("./current-dataset", () => ({
  readCurrentDataset: vi.fn(async () => ({
    datasetId: "00000000-0000-4000-8000-000000000001",
    datasetVersion: "fixture-restored-dataset",
    classifierVersion: "classifier-1.3.7",
    querySetVersion: "queries-3.0.0",
    metricVersions: { junior_contradiction_rate: "junior-contradiction-1.0.0" },
    qualitySummary: { decision: "publish" },
    sourceCutoffAt: new Date("2026-09-01T00:00:00Z"),
  })),
}));

const row = {
  offerId: "00000000-0000-4000-8000-000000000002",
  title: "Développeur junior",
  companyName: "Entreprise de test",
  locationLabel: "Lieu précis",
  contractLabel: "CDI",
  sourcePublishedAt: new Date("2026-09-01T00:00:00Z"),
  lastSeenAt: new Date("2026-09-01T00:00:00Z"),
  missingSince: null,
  closedAt: null,
  structuredExperienceLabel: "2 ans",
  minimumExperienceMonths: 24,
  classificationStatus: "classified",
  claimsJunior: true,
  beginnerFriendly: false,
  contradictoryJunior: true,
  classifierVersion: "classifier-1.3.7",
  warnings: [],
  salaryTransparent: false,
  remoteMode: "unknown",
  salaryData: null,
  applicationUrl: "https://example.invalid/apply",
  sourceUrl: "https://example.invalid/source",
  sourceLabel: "France Travail",
  attributionUrl: "https://example.invalid/licence",
  evidence: [
    {
      kind: "required_experience",
      ruleId: "EXP_SINGLE_DURATION",
      sourceField: "description",
      excerpt: "2 ans",
      normalizedValue: "24",
      ordinal: 0,
    },
  ],
  technologies: [],
  totalCount: 1,
};

describe("closed offers in historical publications", () => {
  it.each([row.applicationUrl, null, "javascript:alert(1)"])(
    "masks closed identifying fields regardless of URL fallback: %s",
    async (applicationUrl) => {
      const sql = vi.fn().mockResolvedValue([
        {
          ...row,
          applicationUrl,
          closedAt: new Date("2026-09-03T00:00:00Z"),
        },
      ]);
      const result = await getPublicOffers({
        sql: sql as unknown as NeonQueryFunction<false, false>,
        query: offersSearchParamsSchema.parse({ period: "current" }),
        cursorSecret: "synthetic-cursor-secret",
        generatedAt: new Date("2026-09-04T00:00:00Z"),
      });
      expect(result.data.items[0]).toMatchObject({
        availability: "closed",
        companyName: null,
        locationLabel: null,
        source: {
          offerUrl: null,
          label: "France Travail",
          attributionUrl: row.attributionUrl,
        },
        classification: { contradictoryJunior: true },
        evidence: [expect.objectContaining({ excerpt: "2 ans" })],
      });
      expect(result.meta.sampleSize).toBe(1);
      expect(result.meta.datasetVersion).toBe("fixture-restored-dataset");
    },
  );

  it.each([null, new Date("2026-09-02T00:00:00Z")])(
    "keeps active/first-absence offers unchanged: %s",
    async (missingSince) => {
      const sql = vi.fn().mockResolvedValue([{ ...row, missingSince }]);
      const result = await getPublicOffers({
        sql: sql as unknown as NeonQueryFunction<false, false>,
        query: offersSearchParamsSchema.parse({ period: "current" }),
        cursorSecret: "synthetic-cursor-secret",
        generatedAt: new Date("2026-09-04T00:00:00Z"),
      });
      expect(result.data.items[0]).toMatchObject({
        availability: missingSince ? "not_seen" : "active",
        companyName: row.companyName,
        locationLabel: row.locationLabel,
        source: { offerUrl: row.applicationUrl },
      });
    },
  );
});
