import { AbortTaskRunError, schemaTask, tasks } from "@trigger.dev/sdk";
import { z } from "zod";

import {
  IngestionQualityBlockedError,
  runDailyFranceTravailIngestion,
} from "@/application/ingestion/run-daily-ingestion";
import {
  IngestionPaginationIncompleteError,
  IngestionRecoveryNotAllowedError,
} from "@/db/full-ingestion-run";
import { FranceTravailError } from "@/lib/france-travail/errors";

import { datasetPublicationQueue } from "./queues";

// Manual only: diagnose the failed attempt before paying for a fresh collection.
// A distinct Trigger run and attempt preserve the original pages and sightings.
export const recoverFranceTravailCollectionTask = schemaTask({
  id: "recover-france-travail-collection",
  schema: z.strictObject({
    timestamp: z.iso.datetime(),
    attempt: z.number().int().min(2).max(3),
    confirmation: z.literal("RECOLLECT_WITHOUT_DELETING_PREVIOUS_ATTEMPT"),
  }),
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
      return await runDailyFranceTravailIngestion({
        scheduledAt: new Date(payload.timestamp),
        triggerRunId: ctx.run.id,
        attempt: payload.attempt,
        signal,
      });
    } catch (error) {
      if (
        error instanceof IngestionRecoveryNotAllowedError ||
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
