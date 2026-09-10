import { AbortTaskRunError, logger, schedules, tasks } from "@trigger.dev/sdk";

import {
  IngestionQualityBlockedError,
  runDailyFranceTravailIngestion,
} from "@/application/ingestion/run-daily-ingestion";
import { FranceTravailError } from "@/lib/france-travail/errors";
import { IngestionPaginationIncompleteError } from "@/db/full-ingestion-run";

import { datasetPublicationQueue } from "./queues";

function scheduledDate(payload: unknown): Date {
  const value =
    typeof payload === "object" && payload !== null && "timestamp" in payload
      ? payload.timestamp
      : null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new AbortTaskRunError("Le timestamp planifié est invalide.");
  }
  return date;
}

export const ingestFranceTravailDailyTask = schedules.task({
  id: "ingest-france-travail-daily",
  cron: {
    pattern: "30 3 * * *",
    timezone: "Europe/Paris",
    environments: ["PRODUCTION"],
  },
  queue: datasetPublicationQueue,
  maxDuration: 3_600,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  onSuccess: async () => {
    await tasks.trigger("check-data-health", {
      timestamp: new Date().toISOString(),
    });
  },
  onFailure: async () => {
    await tasks.trigger("check-data-health", {
      timestamp: new Date().toISOString(),
    });
  },
  run: async (payload, { ctx, signal }) => {
    try {
      const summary = await runDailyFranceTravailIngestion({
        scheduledAt: scheduledDate(payload),
        triggerRunId: ctx.run.id,
        signal,
      });

      logger.info("France Travail daily ingestion completed", {
        ingestionRunId: summary.ingestionRunId,
        businessDate: summary.businessDate,
        status: summary.status,
        datasetId: summary.datasetId,
        requestsCount: summary.requestsCount,
        offersReceived: summary.offersReceived,
        offersValid: summary.offersValid,
        offersQuarantined: summary.offersQuarantined,
        offersNew: summary.offersNew,
        offersUpdated: summary.offersUpdated,
        offersMarkedMissing: summary.offersMarkedMissing,
      });

      return summary;
    } catch (error) {
      if (
        error instanceof IngestionPaginationIncompleteError ||
        error instanceof IngestionQualityBlockedError ||
        (error instanceof FranceTravailError && !error.retryable)
      ) {
        throw new AbortTaskRunError(error.message);
      }
      throw new Error(
        "INGESTION_FAILED: consulter le résumé expurgé du run et le runbook.",
      );
    }
  },
});
