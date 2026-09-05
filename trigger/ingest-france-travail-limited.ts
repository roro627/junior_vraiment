import { neon } from "@neondatabase/serverless";
import { AbortTaskRunError, logger, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

import { runLimitedFranceTravailIngestion } from "../src/application/ingestion/run-limited-ingestion";
import {
  readBaseServerEnvironment,
  readDatabaseEnvironment,
  readFranceTravailEnvironment,
} from "../src/lib/env";
import { FranceTravailClient } from "../src/lib/france-travail/client";
import { FranceTravailError } from "../src/lib/france-travail/errors";

const limitedIngestionPayloadSchema = z.strictObject({
  maxOffers: z.number().int().min(1).max(300).default(200),
  pageSize: z.number().int().min(1).max(150).default(100),
});

export const ingestFranceTravailLimitedTask = schemaTask({
  id: "ingest-france-travail-limited",
  schema: limitedIngestionPayloadSchema,
  maxDuration: 600,
  queue: {
    concurrencyLimit: 1,
  },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  // Ce probe écrit des snapshots idempotents, mais ne publie jamais de dataset.
  run: async (payload, { ctx }) => {
    const databaseEnvironment = readDatabaseEnvironment();
    const franceTravailEnvironment = readFranceTravailEnvironment();
    const baseEnvironment = readBaseServerEnvironment();
    const sql = neon(databaseEnvironment.DATABASE_URL);
    const client = new FranceTravailClient(franceTravailEnvironment);

    try {
      const summary = await runLimitedFranceTravailIngestion({
        sql,
        client,
        triggerRunId: ctx.run.id,
        rawPayloadRetentionDays: baseEnvironment.RAW_PAYLOAD_RETENTION_DAYS,
        requestsPerSecond:
          franceTravailEnvironment.INGESTION_REQUESTS_PER_SECOND,
        maxOffers: payload.maxOffers,
        pageSize: payload.pageSize,
      });

      logger.info("Limited France Travail ingestion completed", {
        ingestionRunId: summary.ingestionRunId,
        pagesReceived: summary.pagesReceived,
        offersReceived: summary.offersReceived,
        offersValid: summary.offersValid,
        offersQuarantined: summary.offersQuarantined,
        classificationsCreated: summary.classificationsCreated,
        publicationEligible: summary.publicationEligible,
      });

      return summary;
    } catch (error) {
      if (error instanceof FranceTravailError && !error.retryable) {
        throw new AbortTaskRunError(
          `Erreur France Travail non rejouable : ${error.code}.`,
        );
      }

      throw error;
    }
  },
});
