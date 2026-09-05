import { syncEnvVars } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk";

import { readWorkerRuntimeEnvironment } from "./src/lib/env";

const WORKER_ENVIRONMENT_NAMES = [
  "APP_ENV",
  "DATABASE_URL",
  "DATABASE_DIRECT_URL",
  "FRANCE_TRAVAIL_CLIENT_ID",
  "FRANCE_TRAVAIL_CLIENT_SECRET",
  "FRANCE_TRAVAIL_TOKEN_URL",
  "FRANCE_TRAVAIL_API_BASE_URL",
  "INGESTION_REQUESTS_PER_SECOND",
  "REVALIDATION_URL",
  "REVALIDATION_SECRET",
] as const;

const SECRET_ENVIRONMENT_NAMES = new Set<
  (typeof WORKER_ENVIRONMENT_NAMES)[number]
>([
  "DATABASE_URL",
  "DATABASE_DIRECT_URL",
  "FRANCE_TRAVAIL_CLIENT_ID",
  "FRANCE_TRAVAIL_CLIENT_SECRET",
  "REVALIDATION_SECRET",
]);

export default defineConfig({
  project: "proj_psqbbfjgsudzjyknrsir",
  dirs: ["./trigger"],
  runtime: "node-22",
  legacyDevProcessCwdBehaviour: false,
  maxDuration: 3_600,
  build: {
    extensions: [
      syncEnvVars(() => {
        const environment = readWorkerRuntimeEnvironment();

        return WORKER_ENVIRONMENT_NAMES.flatMap((name) => {
          const value = environment[name];

          return value
            ? [{ name, value, isSecret: SECRET_ENVIRONMENT_NAMES.has(name) }]
            : [];
        });
      }),
    ],
  },
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 10_000,
      factor: 2,
      randomize: true,
    },
  },
});
