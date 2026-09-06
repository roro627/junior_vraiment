import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

import { classifyOffer } from "@/domain/classification/classifier";
import { CLASSIFIER_VERSION } from "@/domain/classification/types";
import { evaluateCompleteIngestionQuality } from "@/domain/ingestion/quality";
import { BEGINNER_FRIENDLY_METRIC_VERSION } from "@/domain/metrics/beginner-friendly";
import { JUNIOR_CONTRADICTION_METRIC_VERSION } from "@/domain/metrics/junior-contradiction";
import { SALARY_TRANSPARENCY_METRIC_VERSION } from "@/domain/metrics/salary-transparency";
import { TAXONOMY_VERSIONS } from "@/domain/taxonomies/versions";
import {
  beginFullIngestionRun,
  commitFullQueryPage,
  completeFullQuery,
  completeFullRun,
  failFullQuery,
  failFullRun,
  markFullQueryRunning,
  readFullIngestionQualityFacts,
  storeFullRunQualitySummary,
  transitionFullRun,
  type FullIngestionQueryState,
  type FullQueryRegistration,
} from "@/db/full-ingestion-run";
import { storeOfferQueryMatch } from "@/db/ingestion-run";
import { applyOfferAbsences } from "@/db/offer-absence";
import { publishDataset } from "@/db/publish-dataset";
import {
  computeAndStorePublishedMetrics,
  createOrResumeDraftDataset,
  freezeDatasetMembership,
  validateDraftDataset,
} from "@/db/published-dataset-lifecycle";
import { storeClassification } from "@/db/store-classification";
import { storeNormalizedOffer } from "@/db/store-normalized-offer";
import { syncTechnologyTaxonomy } from "@/db/sync-taxonomies";
import {
  readBaseServerEnvironment,
  readDatabaseEnvironment,
  readFranceTravailEnvironment,
  readWorkerRuntimeEnvironment,
} from "@/lib/env";
import {
  buildFranceTravailAtomicQueries,
  filterQueryMembershipsByTitle,
  loadActiveFranceTravailQuerySet,
  type FranceTravailAtomicQuery,
} from "@/lib/france-travail/active-query-set";
import {
  FranceTravailClient,
  type FranceTravailSourcePage,
} from "@/lib/france-travail/client";
import { FranceTravailError } from "@/lib/france-travail/errors";
import { normalizeFranceTravailOffer } from "@/lib/france-travail/normalize";

import { requestRevalidation } from "../use-cases/request-revalidation";
import { franceBusinessDate } from "./run-limited-ingestion";

const FULL_PAGE_SIZE = 150;
const OFFER_STORAGE_CONCURRENCY = 8;
export class IngestionQualityBlockedError extends Error {
  override name = "IngestionQualityBlockedError";
}

export type DailyFranceTravailIngestionSummary = {
  ingestionRunId: string;
  businessDate: string;
  status: "succeeded" | "partial";
  datasetId: string | null;
  requestsCount: number;
  offersReceived: number;
  offersValid: number;
  offersQuarantined: number;
  offersNew: number;
  offersUpdated: number;
  offersMarkedMissing: number;
  offersClosed: number | null;
};

type DailyIngestionDependencies = {
  sql: NeonQueryFunction<false, false>;
  client: FranceTravailClient;
  scheduledAt: Date;
  triggerRunId: string;
  rawPayloadRetentionDays: number;
  requestsPerSecond: number;
  revalidationUrl: string;
  revalidationSecret: string;
  signal?: AbortSignal;
  now?: () => Date;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
};

function defaultSleep(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }

    const handleAbort = () => {
      clearTimeout(timeout);
      reject(signal?.reason);
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, milliseconds);

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

function nextRangeStart(page: FranceTravailSourcePage): number | null {
  if (!page.nextRange) return null;
  const parsed = Number(page.nextRange.split("-", 1)[0]);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 3000) {
    throw new FranceTravailError(
      "La page suivante France Travail est incohérente.",
      "pagination_invalid",
      false,
    );
  }
  return parsed;
}

function errorCode(error: unknown): string {
  if (error instanceof FranceTravailError) {
    return `france_travail_${error.code}`;
  }
  if (error instanceof IngestionQualityBlockedError) {
    return "quality_gate_failed";
  }
  return "unexpected_error";
}

function queryRegistrations(
  queries: readonly FranceTravailAtomicQuery[],
): FullQueryRegistration[] {
  return queries.map((query) => ({
    queryKey: query.queryKey,
    label: query.queryKey,
    definition: {
      kind: query.kind,
      occupationReference: query.occupationReference,
      keyword: query.keyword,
      memberships: query.memberships,
      rangeSize: FULL_PAGE_SIZE,
      postFilter: "normalized-title-role-phrase",
    },
    jobFamilies: [
      ...new Set(query.memberships.flatMap(({ jobFamilies }) => jobFamilies)),
    ].sort((left, right) => left.localeCompare(right, "fr")),
    territoryScope: "france",
  }));
}

function sourceSearchParameters(
  query: FranceTravailAtomicQuery,
  rangeStart: number,
) {
  return {
    ...(query.occupationReference
      ? { occupationReference: query.occupationReference }
      : {}),
    ...(query.keyword ? { keyword: query.keyword } : {}),
    rangeStart,
    rangeSize: FULL_PAGE_SIZE,
  };
}

async function storeAcceptedPageOffers(input: {
  sql: NeonQueryFunction<false, false>;
  clientPage: FranceTravailSourcePage;
  query: FranceTravailAtomicQuery;
  state: FullIngestionQueryState;
  sourceId: string;
  ingestionRunId: string;
  observedAt: Date;
  rawPayloadRetentionDays: number;
}): Promise<number> {
  const acceptedOffers = input.clientPage.items.filter(
    (sourceOffer) =>
      filterQueryMembershipsByTitle(input.query, sourceOffer.intitule).length >
      0,
  );

  for (
    let offset = 0;
    offset < acceptedOffers.length;
    offset += OFFER_STORAGE_CONCURRENCY
  ) {
    await Promise.all(
      acceptedOffers
        .slice(offset, offset + OFFER_STORAGE_CONCURRENCY)
        .map(async (sourceOffer) => {
          const offer = normalizeFranceTravailOffer(sourceOffer);
          const stored = await storeNormalizedOffer({
            sql: input.sql,
            sourceId: input.sourceId,
            offer,
            observedAt: input.observedAt,
            ingestionRunId: input.ingestionRunId,
            ingestionRunQueryId: input.state.ingestionRunQueryId,
            rawPayloadRetentionDays: input.rawPayloadRetentionDays,
          });
          await storeOfferQueryMatch({
            sql: input.sql,
            offerId: stored.offerId,
            sourceQueryId: input.state.sourceQueryId,
            observedAt: input.observedAt,
          });
          await storeClassification({
            sql: input.sql,
            snapshotId: stored.snapshotId,
            classification: classifyOffer(offer),
            classifiedAt: input.observedAt,
          });
        }),
    );
  }

  return acceptedOffers.length;
}

async function collectQuery(input: {
  sql: NeonQueryFunction<false, false>;
  client: FranceTravailClient;
  query: FranceTravailAtomicQuery;
  state: FullIngestionQueryState;
  sourceId: string;
  ingestionRunId: string;
  rawPayloadRetentionDays: number;
  requestDelayMs: number;
  signal?: AbortSignal;
  now: () => Date;
  sleep: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}): Promise<void> {
  if (input.state.status === "succeeded") return;

  input.signal?.throwIfAborted();
  await markFullQueryRunning({
    sql: input.sql,
    ingestionRunQueryId: input.state.ingestionRunQueryId,
    startedAt: input.now(),
  });

  if (
    input.state.pagesReceived > 0 &&
    input.state.checkpoint?.nextRangeStart === null
  ) {
    await completeFullQuery({
      sql: input.sql,
      ingestionRunQueryId: input.state.ingestionRunQueryId,
      finishedAt: input.now(),
    });
    return;
  }

  let rangeStart = input.state.checkpoint?.nextRangeStart ?? 0;
  try {
    for (;;) {
      input.signal?.throwIfAborted();
      const page = await input.client.search(
        sourceSearchParameters(input.query, rangeStart),
        input.signal ? { signal: input.signal } : {},
      );
      const observedAt = input.now();
      const inPerimeterCount = await storeAcceptedPageOffers({
        sql: input.sql,
        clientPage: page,
        query: input.query,
        state: input.state,
        sourceId: input.sourceId,
        ingestionRunId: input.ingestionRunId,
        observedAt,
        rawPayloadRetentionDays: input.rawPayloadRetentionDays,
      });
      const nextStart = nextRangeStart(page);
      await commitFullQueryPage({
        sql: input.sql,
        ingestionRunId: input.ingestionRunId,
        ingestionRunQueryId: input.state.ingestionRunQueryId,
        page: {
          rangeStart,
          nextRangeStart: nextStart,
          isTerminal: nextStart === null,
          sourceTotal: page.total,
          validCount: page.items.length,
          quarantined: page.quarantined.map((entry) => ({
            itemOrdinal: entry.index,
            issues: entry.issues,
          })),
          inPerimeterCount,
          warningCount: page.warnings.length,
          committedAt: observedAt,
        },
      });

      if (nextStart === null) break;
      rangeStart = nextStart;
      await input.sleep(input.requestDelayMs, input.signal);
    }

    await completeFullQuery({
      sql: input.sql,
      ingestionRunQueryId: input.state.ingestionRunQueryId,
      finishedAt: input.now(),
    });
  } catch (error) {
    await failFullQuery({
      sql: input.sql,
      ingestionRunQueryId: input.state.ingestionRunQueryId,
      finishedAt: input.now(),
      errorCode: errorCode(error),
    });
    throw error;
  }
}

function createDatasetVersion(input: {
  startedAt: Date;
  querySetVersion: string;
}): string {
  return `${input.startedAt.toISOString()}__${CLASSIFIER_VERSION}__${input.querySetVersion}`;
}

export async function runFullFranceTravailIngestion({
  sql,
  client,
  scheduledAt,
  triggerRunId,
  rawPayloadRetentionDays,
  requestsPerSecond,
  revalidationUrl,
  revalidationSecret,
  signal,
  now = () => new Date(),
  sleep = defaultSleep,
}: DailyIngestionDependencies): Promise<DailyFranceTravailIngestionSummary> {
  if (requestsPerSecond <= 0 || requestsPerSecond > 5) {
    throw new RangeError(
      "Le débit France Travail doit être compris entre 0 et 5 req/s.",
    );
  }

  await syncTechnologyTaxonomy(sql);
  const querySet = loadActiveFranceTravailQuerySet();
  const queries = buildFranceTravailAtomicQueries(querySet);
  const businessDate = franceBusinessDate(scheduledAt);
  const startedAt = now();
  const run = await beginFullIngestionRun({
    sql,
    businessDate,
    querySetVersion: querySet.querySetVersion,
    triggerRunId,
    attempt: 1,
    startedAt,
    queries: queryRegistrations(queries),
  });
  const stateByQueryKey = new Map(
    run.queries.map((state) => [state.queryKey, state]),
  );

  try {
    if (run.status !== "succeeded" && run.status !== "partial") {
      for (const query of queries) {
        const state = stateByQueryKey.get(query.queryKey);
        if (!state) {
          throw new Error(
            `La requête active ${query.queryKey} n'est pas enregistrée.`,
          );
        }
        await collectQuery({
          sql,
          client,
          query,
          state,
          sourceId: run.sourceId,
          ingestionRunId: run.ingestionRunId,
          rawPayloadRetentionDays,
          requestDelayMs: Math.ceil(1_000 / requestsPerSecond),
          ...(signal ? { signal } : {}),
          now,
          sleep,
        });
      }
      await transitionFullRun({
        sql,
        ingestionRunId: run.ingestionRunId,
        status: "validating",
      });
    }

    const facts = await readFullIngestionQualityFacts({
      sql,
      ingestionRunId: run.ingestionRunId,
      classifierVersion: CLASSIFIER_VERSION,
    });
    const quality = evaluateCompleteIngestionQuality({
      paginationComplete: facts.paginationComplete,
      sourceCapReached: facts.sourceCapReached,
      offersReceived: facts.offersReceived,
      offersValid: facts.offersValid,
      offersQuarantined: facts.offersQuarantined,
      positiveClassifications: facts.positiveClassifications,
      positiveClassificationsWithEvidence:
        facts.positiveClassificationsWithEvidence,
      volumeAnomalyDetected: facts.volumeAnomalyDetected,
      volumeWarnings: facts.volumeWarnings,
    });

    if (run.status !== "succeeded" && run.status !== "partial") {
      await storeFullRunQualitySummary({
        sql,
        ingestionRunId: run.ingestionRunId,
        qualitySummary: quality,
      });
      if (quality.decision === "block") {
        throw new IngestionQualityBlockedError(
          `Publication bloquée par ${quality.reasons.join(",")}.`,
        );
      }

      await transitionFullRun({
        sql,
        ingestionRunId: run.ingestionRunId,
        status: "aggregating",
      });
      const absence = quality.closureEligible
        ? await applyOfferAbsences({
            sql,
            ingestionRunId: run.ingestionRunId,
            appliedAt: now(),
          })
        : { offersMarkedMissing: 0, offersClosed: 0 };
      await completeFullRun({
        sql,
        ingestionRunId: run.ingestionRunId,
        finishedAt: now(),
        partial: quality.decision === "publish_partial",
        offersNew: facts.offersNew,
        offersUpdated: facts.offersUpdated,
        offersMarkedMissing: absence.offersMarkedMissing,
        offersClosed: absence.offersClosed,
        qualitySummary: quality,
      });
      facts.offersMarkedMissing = absence.offersMarkedMissing;
      facts.offersClosed = absence.offersClosed;
    } else if (quality.decision === "block") {
      throw new IngestionQualityBlockedError(
        "Un run terminal ne satisfait plus sa politique qualité.",
      );
    }

    const dataset = await createOrResumeDraftDataset({
      sql,
      datasetVersion: createDatasetVersion({
        startedAt: run.startedAt,
        querySetVersion: querySet.querySetVersion,
      }),
      ingestionRunId: run.ingestionRunId,
      classifierVersion: CLASSIFIER_VERSION,
      metricVersions: {
        junior_contradiction_rate: JUNIOR_CONTRADICTION_METRIC_VERSION,
        beginner_friendly_rate: BEGINNER_FRIENDLY_METRIC_VERSION,
        salary_transparency_rate: SALARY_TRANSPARENCY_METRIC_VERSION,
      },
      taxonomyVersions: TAXONOMY_VERSIONS,
      qualitySummary: quality,
      computedAt: now(),
    });
    const membership = await freezeDatasetMembership({
      sql,
      datasetId: dataset.datasetId,
    });
    if (
      membership.memberCount === 0 ||
      membership.missingClassificationCount > 0
    ) {
      throw new IngestionQualityBlockedError(
        "Le périmètre du dataset est vide ou incomplètement classifié.",
      );
    }
    await computeAndStorePublishedMetrics({
      sql,
      datasetId: dataset.datasetId,
      computedAt: now(),
    });
    const validation = await validateDraftDataset({
      sql,
      datasetId: dataset.datasetId,
      qualityDecision: quality.decision,
    });
    if (!validation.validated) {
      throw new IngestionQualityBlockedError(
        "Les invariants du dataset empêchent sa validation.",
      );
    }
    await publishDataset({
      sql,
      datasetId: dataset.datasetId,
      publishedAt: now(),
    });
    await requestRevalidation({
      url: revalidationUrl,
      secret: revalidationSecret,
      datasetVersion: dataset.datasetVersion,
      tags: ["overview", "trends", "offers", "taxonomies", "data-status"],
      now: now(),
    });

    return {
      ingestionRunId: run.ingestionRunId,
      businessDate,
      status: quality.decision === "publish_partial" ? "partial" : "succeeded",
      datasetId: dataset.datasetId,
      requestsCount: facts.requestsCount,
      offersReceived: facts.offersReceived,
      offersValid: facts.offersValid,
      offersQuarantined: facts.offersQuarantined,
      offersNew: facts.offersNew,
      offersUpdated: facts.offersUpdated,
      offersMarkedMissing: facts.offersMarkedMissing,
      offersClosed: facts.offersClosed,
    };
  } catch (error) {
    if (run.status !== "succeeded" && run.status !== "partial") {
      await failFullRun({
        sql,
        ingestionRunId: run.ingestionRunId,
        finishedAt: now(),
        errorCode: errorCode(error),
      });
    }
    throw error;
  }
}

export async function runDailyFranceTravailIngestion(input: {
  scheduledAt: Date;
  triggerRunId: string;
  signal?: AbortSignal;
}): Promise<DailyFranceTravailIngestionSummary> {
  const database = readDatabaseEnvironment();
  const source = readFranceTravailEnvironment();
  const base = readBaseServerEnvironment();
  const worker = readWorkerRuntimeEnvironment();
  if (!worker.REVALIDATION_URL || !worker.REVALIDATION_SECRET) {
    throw new Error(
      "La revalidation interne n'est pas configurée dans le worker.",
    );
  }

  return runFullFranceTravailIngestion({
    sql: neon(database.DATABASE_URL),
    client: new FranceTravailClient(source),
    scheduledAt: input.scheduledAt,
    triggerRunId: input.triggerRunId,
    rawPayloadRetentionDays: base.RAW_PAYLOAD_RETENTION_DAYS,
    requestsPerSecond: source.INGESTION_REQUESTS_PER_SECOND,
    revalidationUrl: worker.REVALIDATION_URL,
    revalidationSecret: worker.REVALIDATION_SECRET,
    ...(input.signal ? { signal: input.signal } : {}),
  });
}
