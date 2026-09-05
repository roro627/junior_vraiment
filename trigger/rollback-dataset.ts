import { neon } from "@neondatabase/serverless";
import { logger, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";

import { requestRevalidation } from "@/application/use-cases/request-revalidation";
import { rollbackDataset } from "@/db/rollback-dataset";
import {
  readDatabaseEnvironment,
  readWorkerRuntimeEnvironment,
} from "@/lib/env";

import { datasetPublicationQueue } from "./queues";

const rollbackPayloadSchema = z.strictObject({
  targetDatasetVersion: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:+-]*$/),
  reasonCode: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
});

export const rollbackDatasetTask = schemaTask({
  id: "rollback-dataset",
  schema: rollbackPayloadSchema,
  queue: datasetPublicationQueue,
  maxDuration: 120,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 10_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload) => {
    const { DATABASE_URL } = readDatabaseEnvironment();
    const workerEnvironment = readWorkerRuntimeEnvironment();
    if (
      !workerEnvironment.REVALIDATION_URL ||
      !workerEnvironment.REVALIDATION_SECRET
    ) {
      throw new Error(
        "Les variables REVALIDATION_URL et REVALIDATION_SECRET sont requises.",
      );
    }

    const result = await rollbackDataset({
      sql: neon(DATABASE_URL),
      targetDatasetVersion: payload.targetDatasetVersion,
      reasonCode: payload.reasonCode,
      rolledBackAt: new Date(),
    });
    const revalidation = await requestRevalidation({
      url: workerEnvironment.REVALIDATION_URL,
      secret: workerEnvironment.REVALIDATION_SECRET,
      datasetVersion: result.currentDatasetVersion,
      tags: ["overview", "trends", "offers", "data-status"],
    });

    logger.warn("Dataset rollback completed", {
      changed: result.changed,
      withdrawnDatasetId: result.withdrawnDatasetId,
      withdrawnDatasetVersion: result.withdrawnDatasetVersion,
      currentDatasetId: result.currentDatasetId,
      currentDatasetVersion: result.currentDatasetVersion,
      revalidatedTagCount: revalidation.tagCount,
    });

    return {
      ...result,
      revalidatedTagCount: revalidation.tagCount,
    };
  },
});
