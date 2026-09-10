import { neon } from "@neondatabase/serverless";
import { AbortTaskRunError, schemaTask, tasks } from "@trigger.dev/sdk";
import { z } from "zod";
import { runDailyFranceTravailIngestion } from "@/application/ingestion/run-daily-ingestion";
import { readCurrentDataset } from "@/db/queries/current-dataset";
import { readDatabaseEnvironment } from "@/lib/env";
import { loadActiveFranceTravailQuerySet } from "@/lib/france-travail/active-query-set";
import { datasetPublicationQueue } from "./queues";

/** Replays only a completed current source run. No fresh source request or fake freshness. */
export const republishCurrentMethodologyTask = schemaTask({
  id: "republish-current-methodology",
  schema: z.strictObject({
    expectedIngestionRunId: z.uuid(),
    confirmation: z.literal("RECLASSIFY_AND_PUBLISH_NEW_IMMUTABLE_DATASET"),
  }),
  queue: datasetPublicationQueue,
  maxDuration: 3600,
  retry: { maxAttempts: 2 },
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
    const sql = neon(readDatabaseEnvironment().DATABASE_URL);
    const dataset = await readCurrentDataset(sql);
    if (
      dataset.ingestionRunId !== payload.expectedIngestionRunId ||
      dataset.querySetVersion !==
        loadActiveFranceTravailQuerySet().querySetVersion
    )
      throw new AbortTaskRunError(
        "Le dataset ou le périmètre courant a changé ; vérifier la nouvelle provenance.",
      );
    const rows =
      await sql`select started_at as "startedAt", attempt, status from ingestion_runs where id=${payload.expectedIngestionRunId} and mode='full' and finished_at is not null`;
    const run = z
      .object({
        startedAt: z.coerce.date(),
        attempt: z.number().int().min(1).max(3),
        status: z.enum(["succeeded", "partial"]),
      })
      .parse(rows[0]);
    // Replaying a completed run skips all source queries in the application runner.
    return runDailyFranceTravailIngestion({
      scheduledAt: run.startedAt,
      attempt: run.attempt,
      triggerRunId: ctx.run.id,
      signal,
    });
  },
});
