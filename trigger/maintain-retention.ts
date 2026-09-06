import { neon } from "@neondatabase/serverless";
import { logger, schedules } from "@trigger.dev/sdk";
import { runRetention } from "@/application/maintenance/run-retention";
import { readDatabaseEnvironment } from "@/lib/env";

export const maintainRetentionTask = schedules.task({
  id: "maintain-data-retention",
  cron: {
    pattern: "30 4 * * 0",
    timezone: "Europe/Paris",
    environments: ["PRODUCTION"],
  },
  queue: { name: "data-maintenance", concurrencyLimit: 1 },
  maxDuration: 300,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 10000,
    factor: 2,
  },
  run: async (_payload, { signal }) => {
    try {
      const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();
      const summary = await runRetention({
        sql: neon(DATABASE_DIRECT_URL),
        now: new Date(),
        signal,
      });
      logger.info("Retention verified", summary);
      return summary;
    } catch {
      // Provider errors can include connection parameters; never log them raw.
      throw new Error("RETENTION_FAILED: vérifier le runbook de maintenance.");
    }
  },
});
