import { logger, task } from "@trigger.dev/sdk";

import { requestRevalidation } from "../src/application/use-cases/request-revalidation";
import { readWorkerRuntimeEnvironment } from "../src/lib/env";

export const verifyRevalidationTask = task({
  id: "verify-revalidation",
  maxDuration: 60,
  queue: {
    concurrencyLimit: 1,
  },
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 5_000,
    factor: 2,
    randomize: true,
  },
  // L'invalidation est idempotente : une annulation après l'appel peut être rejouée sans incohérence.
  run: async () => {
    const environment = readWorkerRuntimeEnvironment();

    if (!environment.REVALIDATION_URL || !environment.REVALIDATION_SECRET) {
      throw new Error(
        "Les variables REVALIDATION_URL et REVALIDATION_SECRET sont requises.",
      );
    }

    const result = await requestRevalidation({
      url: environment.REVALIDATION_URL,
      secret: environment.REVALIDATION_SECRET,
      datasetVersion: `runtime-check-${new Date().toISOString().slice(0, 10)}`,
      tags: ["data-status"],
    });

    logger.info("Vercel revalidation boundary verified", {
      tagCount: result.tagCount,
      revalidated: result.revalidated,
    });

    return {
      healthy: true,
      tagCount: result.tagCount,
    };
  },
});
