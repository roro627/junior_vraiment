import { logger, task } from "@trigger.dev/sdk";

import {
  assertHealthyRuntime,
  requiredWorkerEnvironmentNames,
} from "../src/application/ingestion/verify-runtime";
import { readWorkerRuntimeEnvironment } from "../src/lib/env";

export const verifyRuntimeTask = task({
  id: "verify-runtime",
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
  // Cette tâche ne réalise aucune écriture : une annulation ne laisse aucun état partiel.
  run: async () => {
    const verification = assertHealthyRuntime({
      environment: readWorkerRuntimeEnvironment(),
      nodeVersion: process.versions.node,
    });

    logger.info("Trigger.dev runtime verified", {
      appEnvironment: verification.appEnvironment,
      nodeVersion: verification.nodeVersion,
      checkedEnvironmentVariableCount:
        verification.checkedEnvironmentVariableCount,
      requiredEnvironmentNames: requiredWorkerEnvironmentNames,
    });

    return verification;
  },
});
