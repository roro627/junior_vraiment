import type { NeonQueryFunction } from "@neondatabase/serverless";

import { classifyOffer } from "@/domain/classification/classifier";
import {
  beginLimitedIngestionRun,
  checkpointLimitedIngestion,
  completeLimitedIngestion,
  failLimitedIngestion,
  storeOfferQueryMatch,
  type LimitedIngestionRun,
} from "@/db/ingestion-run";
import { storeClassification } from "@/db/store-classification";
import { storeNormalizedOffer } from "@/db/store-normalized-offer";
import { syncTechnologyTaxonomy } from "@/db/sync-taxonomies";
import {
  FranceTravailClient,
  type FranceTravailSourcePage,
} from "@/lib/france-travail/client";
import { FranceTravailError } from "@/lib/france-travail/errors";
import { normalizeFranceTravailOffer } from "@/lib/france-travail/normalize";

type LimitedIngestionInput = {
  sql: NeonQueryFunction<false, false>;
  client: FranceTravailClient;
  triggerRunId: string;
  rawPayloadRetentionDays: number;
  requestsPerSecond: number;
  maxOffers?: number;
  pageSize?: number;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
};

export type LimitedIngestionSummary = {
  ingestionRunId: string;
  pagesReceived: number;
  requestsCount: number;
  offersReceived: number;
  offersValid: number;
  offersQuarantined: number;
  offersNew: number;
  offersUpdated: number;
  classificationsCreated: number;
  sourceWarnings: number;
  sourceTotal: number;
  capped: boolean;
  publicationEligible: false;
};

type MutableCounters = Omit<
  LimitedIngestionSummary,
  "ingestionRunId" | "sourceTotal" | "capped" | "publicationEligible"
>;

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function franceBusinessDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function nextRangeStart(page: FranceTravailSourcePage): number | null {
  if (!page.nextRange) {
    return null;
  }

  const parsed = Number(page.nextRange.split("-", 1)[0]);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function sanitizedErrorCode(error: unknown): string {
  return error instanceof FranceTravailError
    ? `france_travail_${error.code}`
    : "unexpected_error";
}

async function storePage(input: {
  sql: NeonQueryFunction<false, false>;
  run: LimitedIngestionRun;
  page: FranceTravailSourcePage;
  observedAt: Date;
  rawPayloadRetentionDays: number;
  counters: MutableCounters;
}): Promise<void> {
  input.counters.offersReceived +=
    input.page.items.length + input.page.quarantined.length;
  input.counters.offersValid += input.page.items.length;
  input.counters.offersQuarantined += input.page.quarantined.length;
  input.counters.sourceWarnings += input.page.warnings.length;

  for (const sourceOffer of input.page.items) {
    const offer = normalizeFranceTravailOffer(sourceOffer);
    const stored = await storeNormalizedOffer({
      sql: input.sql,
      sourceId: input.run.sourceId,
      offer,
      observedAt: input.observedAt,
      ingestionRunId: input.run.ingestionRunId,
      rawPayloadRetentionDays: input.rawPayloadRetentionDays,
    });

    if (stored.offerCreated) {
      input.counters.offersNew += 1;
    } else if (stored.snapshotCreated) {
      input.counters.offersUpdated += 1;
    }

    await storeOfferQueryMatch({
      sql: input.sql,
      offerId: stored.offerId,
      sourceQueryId: input.run.sourceQueryId,
      observedAt: input.observedAt,
    });

    const classificationCreated = await storeClassification({
      sql: input.sql,
      snapshotId: stored.snapshotId,
      classification: classifyOffer(offer),
      classifiedAt: input.observedAt,
    });
    if (classificationCreated) {
      input.counters.classificationsCreated += 1;
    }
  }
}

export async function runLimitedFranceTravailIngestion({
  sql,
  client,
  triggerRunId,
  rawPayloadRetentionDays,
  requestsPerSecond,
  maxOffers = 200,
  pageSize = 100,
  now = () => new Date(),
  sleep = defaultSleep,
}: LimitedIngestionInput): Promise<LimitedIngestionSummary> {
  if (!Number.isInteger(maxOffers) || maxOffers < 1 || maxOffers > 300) {
    throw new RangeError("maxOffers doit être compris entre 1 et 300.");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 150) {
    throw new RangeError("pageSize doit être compris entre 1 et 150.");
  }
  if (requestsPerSecond <= 0 || requestsPerSecond > 5) {
    throw new RangeError(
      "Le débit initial doit être compris entre 0 et 5 req/s.",
    );
  }

  await syncTechnologyTaxonomy(sql);
  const startedAt = now();
  const run = await beginLimitedIngestionRun({
    sql,
    businessDate: franceBusinessDate(startedAt),
    triggerRunId,
    startedAt,
    rangeSize: pageSize,
  });
  const counters: MutableCounters = {
    pagesReceived: 0,
    requestsCount: 0,
    offersReceived: 0,
    offersValid: 0,
    offersQuarantined: 0,
    offersNew: 0,
    offersUpdated: 0,
    classificationsCreated: 0,
    sourceWarnings: 0,
  };
  let rangeStart = 0;
  let sourceTotal = 0;

  try {
    while (counters.offersReceived < maxOffers) {
      const remaining = maxOffers - counters.offersReceived;
      const requestedPageSize = Math.min(pageSize, remaining);
      const page = await client.search({
        grandDomainReference: "M18",
        rangeStart,
        rangeSize: requestedPageSize,
      });
      counters.requestsCount += 1;
      counters.pagesReceived += 1;
      sourceTotal = page.total;

      await storePage({
        sql,
        run,
        page,
        observedAt: now(),
        rawPayloadRetentionDays,
        counters,
      });

      const nextStart = nextRangeStart(page);
      await checkpointLimitedIngestion({
        sql,
        run,
        ...counters,
        nextRangeStart: nextStart,
      });

      if (nextStart === null || counters.offersReceived >= maxOffers) {
        break;
      }

      rangeStart = nextStart;
      await sleep(Math.ceil(1_000 / requestsPerSecond));
    }

    const summary: LimitedIngestionSummary = {
      ingestionRunId: run.ingestionRunId,
      ...counters,
      sourceTotal,
      capped: counters.offersReceived < sourceTotal,
      publicationEligible: false,
    };
    await completeLimitedIngestion({
      sql,
      run,
      finishedAt: now(),
      partial: counters.offersQuarantined > 0,
      qualitySummary: {
        publicationEligible: false,
        reason: "technical_probe_query_set",
        sourceWarnings: counters.sourceWarnings,
        sourceTotal,
        capped: summary.capped,
      },
    });

    return summary;
  } catch (error) {
    await failLimitedIngestion({
      sql,
      run,
      finishedAt: now(),
      errorCode: sanitizedErrorCode(error),
    });
    throw error;
  }
}
