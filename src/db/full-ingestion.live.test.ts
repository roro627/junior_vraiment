// @vitest-environment node

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

import { classifyOffer } from "@/domain/classification/classifier";
import { reclassifyCurrentDataset } from "@/application/ingestion/reclassify-current-dataset";
import { CLASSIFIER_VERSION } from "@/domain/classification/types";
import type { NormalizedOffer } from "@/domain/offers/normalized-offer";
import { readDatabaseEnvironment, readToolEnvironment } from "@/lib/env";

import {
  beginFullIngestionRun,
  commitFullQueryPage,
  completeFullQuery,
  completeFullRun,
  failFullQuery,
  failFullRun,
  IngestionPaginationIncompleteError,
  IngestionRecoveryNotAllowedError,
  readFullIngestionQualityFacts,
  storeFullRunQualitySummary,
  transitionFullRun,
  type FullIngestionRun,
} from "./full-ingestion-run";
import { storeOfferQueryMatch } from "./ingestion-run";
import { applyOfferAbsences } from "./offer-absence";
import {
  computeAndStoreJuniorContradictionMetric,
  createOrResumeDraftDataset,
  freezeDatasetMembership,
  validateDraftDataset,
} from "./published-dataset-lifecycle";
import { storeClassification } from "./store-classification";
import { storeNormalizedOffer } from "./store-normalized-offer";

if (existsSync(".env.local")) loadEnvFile(".env.local");

const liveTestsEnabled = readToolEnvironment().RUN_LIVE_DATABASE === "1";

function fixtureOffer(
  externalId: string,
  descriptionText: string,
): NormalizedOffer {
  return {
    source: "france-travail",
    externalId,
    title: "Développeur junior",
    descriptionText,
    companyName: "Entreprise de test",
    publishedAt: new Date("2098-01-01T08:00:00Z"),
    updatedAt: new Date("2098-01-01T08:00:00Z"),
    location: {
      label: "Paris",
      communeCode: "75056",
      departmentCode: "75",
      regionCode: "11",
      latitude: 48.8566,
      longitude: 2.3522,
    },
    contract: { sourceCode: "CDI", normalized: "cdi", label: "CDI" },
    structuredExperience: { required: false, label: "Débutant accepté" },
    salary: null,
    applicationUrl: "https://example.invalid/apply",
    sourceUrl: "https://example.invalid/offer",
    rawPayload: { fixture: true },
  };
}

describe.runIf(liveTestsEnabled)("durable full ingestion on Neon", () => {
  it("preserves moving-total pages while starting an independent recovery attempt", async () => {
    const sql = neon(readDatabaseEnvironment().DATABASE_DIRECT_URL);
    const suffix = randomUUID();
    const querySetVersion = `queries-recovery-test-${suffix}`;
    const startedAt = new Date("2098-02-01T03:30:00Z");
    const begin = (attempt: number) =>
      beginFullIngestionRun({
        sql,
        businessDate: "2098-02-01",
        querySetVersion,
        triggerRunId: `recovery-test-${suffix}-${attempt}`,
        attempt,
        startedAt,
        queries: [
          {
            queryKey: "synthetic-moving-total",
            label: "Fixture recovery",
            definition: { fixture: true },
            jobFamilies: ["backend"],
            territoryScope: "france",
          },
        ],
      });
    try {
      const first = await begin(1);
      await expect(begin(2)).rejects.toBeInstanceOf(
        IngestionRecoveryNotAllowedError,
      );
      const query = first.queries[0];
      if (!query) throw new Error("Fixture query missing");
      for (const page of [
        {
          rangeStart: 0,
          nextRangeStart: 150,
          isTerminal: false,
          sourceTotal: 184,
          validCount: 150,
        },
        {
          rangeStart: 150,
          nextRangeStart: null,
          isTerminal: true,
          sourceTotal: 185,
          validCount: 35,
        },
      ])
        await commitFullQueryPage({
          sql,
          ingestionRunId: first.ingestionRunId,
          ingestionRunQueryId: query.ingestionRunQueryId,
          page: {
            ...page,
            quarantined: [],
            inPerimeterCount: 0,
            warningCount: 0,
            committedAt: startedAt,
          },
        });
      await expect(
        completeFullQuery({
          sql,
          ingestionRunQueryId: query.ingestionRunQueryId,
          finishedAt: startedAt,
        }),
      ).rejects.toBeInstanceOf(IngestionPaginationIncompleteError);
      await failFullQuery({
        sql,
        ingestionRunQueryId: query.ingestionRunQueryId,
        finishedAt: startedAt,
        errorCode: "pagination_incomplete",
      });
      await failFullRun({
        sql,
        ingestionRunId: first.ingestionRunId,
        finishedAt: startedAt,
        errorCode: "pagination_incomplete",
      });
      const second = await begin(2);
      expect(second.ingestionRunId).not.toBe(first.ingestionRunId);
      expect(second.queries[0]?.pagesReceived).toBe(0);
      expect(second.queries[0]?.checkpoint).toBeNull();
      const replay = await begin(2);
      expect(replay.ingestionRunId).toBe(second.ingestionRunId);
      const pages =
        await sql`select source_total from ingestion_query_pages where ingestion_run_query_id=${query.ingestionRunQueryId} order by range_start`;
      expect(pages.map((page) => page["source_total"])).toEqual([184, 185]);
      const [old] =
        await sql`select status from ingestion_runs where id=${first.ingestionRunId}`;
      expect(old?.["status"]).toBe("failed");
    } finally {
      await sql`delete from ingestion_runs where query_set_version=${querySetVersion}`;
      await sql`delete from source_queries where query_set_version=${querySetVersion}`;
    }
  });

  it("replays a page safely, freezes membership and requires two absences", async () => {
    const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();
    const sql = neon(DATABASE_DIRECT_URL);
    const suffix = randomUUID();
    const querySetVersion = `queries-integration-${suffix}`;
    const queryKey = `integration-${suffix}`;
    const offerExternalId = `offer-${suffix}`;
    const baseTime = new Date("2098-01-01T03:30:00Z");
    let datasetId: string | null = null;
    let observationDatasetId: string | null = null;
    let offerId: string | null = null;

    const begin = async (day: number): Promise<FullIngestionRun> => {
      const startedAt = new Date(baseTime);
      startedAt.setUTCDate(day);
      const run = await beginFullIngestionRun({
        sql,
        businessDate: `2098-01-0${day}`,
        querySetVersion,
        triggerRunId: `trigger-${day}-${suffix}`,
        attempt: 1,
        startedAt,
        queries: [
          {
            queryKey,
            label: "Integration query",
            definition: { occupationReference: "M1805" },
            jobFamilies: ["backend"],
            territoryScope: "france",
          },
        ],
      });
      return run;
    };

    const finishEmptyRun = async (run: FullIngestionRun, day: number) => {
      const query = run.queries[0];
      if (!query) throw new Error("Run query absente.");
      const finishedAt = new Date(`2098-01-0${day}T04:00:00Z`);
      await commitFullQueryPage({
        sql,
        ingestionRunId: run.ingestionRunId,
        ingestionRunQueryId: query.ingestionRunQueryId,
        page: {
          rangeStart: 0,
          nextRangeStart: null,
          isTerminal: true,
          sourceTotal: 0,
          validCount: 0,
          quarantined: [],
          inPerimeterCount: 0,
          warningCount: 0,
          committedAt: finishedAt,
        },
      });
      await completeFullQuery({
        sql,
        ingestionRunQueryId: query.ingestionRunQueryId,
        finishedAt,
      });
      await transitionFullRun({
        sql,
        ingestionRunId: run.ingestionRunId,
        status: "validating",
      });
      const quality = {
        qualityVersion: "ingestion-quality-1.0.0",
        decision: "publish",
        paginationComplete: true,
        validationRate: 1,
        evidenceCoverage: 1,
        closureEligible: true,
        reasons: [],
      };
      await storeFullRunQualitySummary({
        sql,
        ingestionRunId: run.ingestionRunId,
        qualitySummary: quality,
      });
      const absence = await applyOfferAbsences({
        sql,
        ingestionRunId: run.ingestionRunId,
        appliedAt: finishedAt,
      });
      await completeFullRun({
        sql,
        ingestionRunId: run.ingestionRunId,
        finishedAt,
        partial: false,
        offersNew: 0,
        offersUpdated: 0,
        offersMarkedMissing: absence.offersMarkedMissing,
        offersClosed: absence.offersClosed,
        qualitySummary: quality,
      });
      return absence;
    };

    try {
      const first = await begin(1);
      const firstQuery = first.queries[0];
      if (!firstQuery) throw new Error("Run query absente.");
      const offer = fixtureOffer(offerExternalId, "Débutant accepté.");
      const stored = await storeNormalizedOffer({
        sql,
        sourceId: first.sourceId,
        offer,
        observedAt: baseTime,
        ingestionRunId: first.ingestionRunId,
        ingestionRunQueryId: firstQuery.ingestionRunQueryId,
        rawPayloadRetentionDays: 30,
      });
      offerId = stored.offerId;
      await storeOfferQueryMatch({
        sql,
        offerId: stored.offerId,
        sourceQueryId: firstQuery.sourceQueryId,
        observedAt: baseTime,
      });
      await storeClassification({
        sql,
        snapshotId: stored.snapshotId,
        classification: classifyOffer(offer),
        classifiedAt: baseTime,
      });
      const page = {
        rangeStart: 0,
        nextRangeStart: null,
        isTerminal: true,
        sourceTotal: 1,
        validCount: 1,
        quarantined: [],
        inPerimeterCount: 1,
        warningCount: 0,
        committedAt: baseTime,
      } as const;
      await commitFullQueryPage({
        sql,
        ingestionRunId: first.ingestionRunId,
        ingestionRunQueryId: firstQuery.ingestionRunQueryId,
        page,
      });
      await commitFullQueryPage({
        sql,
        ingestionRunId: first.ingestionRunId,
        ingestionRunQueryId: firstQuery.ingestionRunQueryId,
        page,
      });
      await completeFullQuery({
        sql,
        ingestionRunQueryId: firstQuery.ingestionRunQueryId,
        finishedAt: new Date("2098-01-01T04:00:00Z"),
      });

      const facts = await readFullIngestionQualityFacts({
        sql,
        ingestionRunId: first.ingestionRunId,
        classifierVersion: CLASSIFIER_VERSION,
      });
      expect(facts).toMatchObject({
        paginationComplete: true,
        requestsCount: 1,
        offersReceived: 1,
        offersValid: 1,
        offersInPerimeter: 1,
        uniqueOffers: 1,
        offersNew: 1,
        positiveClassifications: 1,
        positiveClassificationsWithEvidence: 1,
      });

      const quality = {
        qualityVersion: "ingestion-quality-1.0.0",
        decision: "publish",
        paginationComplete: true,
        validationRate: 1,
        evidenceCoverage: 1,
        closureEligible: true,
        reasons: [],
      };
      await transitionFullRun({
        sql,
        ingestionRunId: first.ingestionRunId,
        status: "validating",
      });
      await storeFullRunQualitySummary({
        sql,
        ingestionRunId: first.ingestionRunId,
        qualitySummary: quality,
      });
      expect(
        await applyOfferAbsences({
          sql,
          ingestionRunId: first.ingestionRunId,
          appliedAt: new Date("2098-01-01T04:00:00Z"),
        }),
      ).toEqual({ offersMarkedMissing: 0, offersClosed: 0 });
      await completeFullRun({
        sql,
        ingestionRunId: first.ingestionRunId,
        finishedAt: new Date("2098-01-01T04:00:00Z"),
        partial: false,
        offersNew: 1,
        offersUpdated: 0,
        offersMarkedMissing: 0,
        offersClosed: 0,
        qualitySummary: quality,
      });

      const dataset = await createOrResumeDraftDataset({
        sql,
        datasetVersion: `dataset-integration-${suffix}`,
        ingestionRunId: first.ingestionRunId,
        classifierVersion: CLASSIFIER_VERSION,
        metricVersions: {
          junior_contradiction_rate: "junior-contradiction-1.0.0",
          beginner_friendly_rate: "beginner-friendly-1.0.0",
          salary_transparency_rate: "salary-transparency-1.0.0",
        },
        taxonomyVersions: { jobs: "jobs-1.0.0" },
        qualitySummary: quality,
        computedAt: new Date("2098-01-01T04:00:00Z"),
      });
      datasetId = dataset.datasetId;
      const [sourceClock] = await sql`
        select source_cutoff_at as "sourceCutoffAt" from published_datasets
        where id = ${datasetId}
      `;
      expect(new Date(String(sourceClock?.["sourceCutoffAt"]))).toEqual(
        baseTime,
      );
      expect(await freezeDatasetMembership({ sql, datasetId })).toMatchObject({
        memberCount: 1,
        missingClassificationCount: 0,
      });
      await computeAndStoreJuniorContradictionMetric({
        sql,
        datasetId,
        computedAt: new Date("2098-01-01T04:00:00Z"),
      });
      expect(
        await validateDraftDataset({
          sql,
          datasetId,
          qualityDecision: "publish",
        }),
      ).toMatchObject({ validated: true });

      const changed = fixtureOffer(
        offerExternalId,
        "Deux ans d'expérience exigés.",
      );
      await storeNormalizedOffer({
        sql,
        sourceId: first.sourceId,
        offer: changed,
        observedAt: new Date("2098-01-01T05:00:00Z"),
        rawPayloadRetentionDays: 30,
      });
      const [frozen] = await sql`
        select snapshot_id as "snapshotId" from published_dataset_offers
        where dataset_id = ${datasetId}
      `;
      expect(frozen?.["snapshotId"]).toBe(stored.snapshotId);

      const second = await begin(2);
      expect(await finishEmptyRun(second, 2)).toEqual({
        offersMarkedMissing: 1,
        offersClosed: 0,
      });
      // No response today: its retained, changed snapshot still needs the current engine.
      expect(
        await reclassifyCurrentDataset({
          sql,
          classifiedAt: baseTime,
          ingestionRunId: second.ingestionRunId,
        }),
      ).toMatchObject({
        snapshotCount: 1,
        classificationsCreated: 1,
        classificationCount: 1,
      });
      expect(
        await reclassifyCurrentDataset({
          sql,
          classifiedAt: baseTime,
          ingestionRunId: second.ingestionRunId,
        }),
      ).toMatchObject({
        snapshotCount: 1,
        classificationsCreated: 0,
        classificationCount: 1,
      });
      const [unchangedMembership] =
        await sql`select snapshot_id from published_dataset_offers where dataset_id=${datasetId}`;
      expect(unchangedMembership?.["snapshot_id"]).toBe(stored.snapshotId);
      const observationDataset = await createOrResumeDraftDataset({
        sql,
        datasetVersion: `dataset-observation-integration-${suffix}`,
        ingestionRunId: second.ingestionRunId,
        classifierVersion: CLASSIFIER_VERSION,
        metricVersions: {
          junior_contradiction_rate: "junior-contradiction-2.0.0",
          beginner_friendly_rate: "beginner-friendly-1.0.0",
          salary_transparency_rate: "salary-transparency-1.0.0",
        },
        taxonomyVersions: { jobs: "jobs-1.0.0" },
        qualitySummary: quality,
        computedAt: baseTime,
      });
      observationDatasetId = observationDataset.datasetId;
      expect(
        await freezeDatasetMembership({ sql, datasetId: observationDatasetId }),
      ).toMatchObject({ memberCount: 1, missingClassificationCount: 0 });
      const observationMetric = await computeAndStoreJuniorContradictionMetric({
        sql,
        datasetId: observationDatasetId,
        computedAt: baseTime,
      });
      expect(observationMetric.metric).toMatchObject({
        metricVersion: "junior-contradiction-2.0.0",
        numerator: 1,
        denominator: 1,
        value: null,
        sampleQuality: "insufficient",
      });
      expect(
        await validateDraftDataset({
          sql,
          datasetId: observationDatasetId,
          qualityDecision: "publish",
        }),
      ).toMatchObject({ validated: true });
      const [axis] =
        await sql`select c.status,c.beginner_friendly,c.contradictory_junior,c.junior_observation_contradictory from classifications c join published_dataset_offers m on m.classification_id=c.id where m.dataset_id=${observationDatasetId}`;
      expect(axis).toMatchObject({
        status: "ambiguous",
        beginner_friendly: null,
        contradictory_junior: null,
        junior_observation_contradictory: true,
      });
      const third = await begin(3);
      expect(await finishEmptyRun(third, 3)).toEqual({
        offersMarkedMissing: 1,
        offersClosed: 1,
      });
      const [lifecycle] = await sql`
        select missing_since as "missingSince", closed_at as "closedAt"
        from offers where id = ${stored.offerId}
      `;
      expect(lifecycle?.["missingSince"]).not.toBeNull();
      expect(lifecycle?.["closedAt"]).not.toBeNull();
    } finally {
      if (observationDatasetId)
        await sql`delete from published_datasets where id=${observationDatasetId}`;
      if (datasetId) {
        await sql`delete from published_datasets where id = ${datasetId}`;
      }
      if (offerId) await sql`delete from offers where id = ${offerId}`;
      await sql`
        delete from ingestion_runs where query_set_version = ${querySetVersion}
      `;
      await sql`
        delete from source_queries where query_set_version = ${querySetVersion}
      `;
    }
  });
});
