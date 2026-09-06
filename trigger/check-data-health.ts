import { neon } from "@neondatabase/serverless";
import { logger, schedules } from "@trigger.dev/sdk";
import { checkDataHealth } from "@/application/maintenance/check-data-health";
import { readDatabaseEnvironment } from "@/lib/env";

export const checkDataHealthTask = schedules.task({
  id: "check-data-health",
  cron: {
    pattern: "30 12 * * *",
    timezone: "Europe/Paris",
    environments: ["PRODUCTION"],
  },
  queue: { name: "data-health", concurrencyLimit: 1 },
  maxDuration: 120,
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 10000,
    factor: 2,
  },
  run: async () => {
    let summary;
    try {
      const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();
      summary = await checkDataHealth(neon(DATABASE_DIRECT_URL), new Date());
    } catch {
      throw new Error(
        "DATA_HEALTH_UNAVAILABLE: consulter le runbook de disponibilité.",
      );
    }
    logger.info("Data health assessed", summary);
    if (!summary.healthy)
      throw new Error(`DATA_HEALTH_FAILED: ${summary.reasons.join(",")}`);
    return summary;
  },
});
