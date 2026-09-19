import { idempotencyKeys, logger, tasks } from "@trigger.dev/sdk";

import { IngestionPaginationIncompleteError } from "@/db/full-ingestion-run";

export async function schedulePaginationRecovery(input: {
  error: unknown;
  scheduledAt: Date;
  attempt: number;
}): Promise<void> {
  if (
    !(input.error instanceof IngestionPaginationIncompleteError) ||
    input.error.reason !== "source_total_changed" ||
    !Number.isInteger(input.attempt) ||
    input.attempt < 1 ||
    input.attempt >= 3
  ) {
    return;
  }

  const timestamp = input.scheduledAt.toISOString();
  const attempt = input.attempt + 1;
  let recovery: { id: string };
  try {
    const idempotencyKey = await idempotencyKeys.create(
      `recovery-${timestamp}-${attempt}`,
      { scope: "global" },
    );
    // Do not wait for a child in the same single-concurrency publication queue.
    // The failed parent remains failed; only a complete fresh run can publish.
    recovery = await tasks.trigger(
      "recover-france-travail-collection",
      {
        timestamp,
        attempt,
        confirmation: "RECOLLECT_WITHOUT_DELETING_PREVIOUS_ATTEMPT",
      },
      { idempotencyKey, idempotencyKeyTTL: "7d", delay: "5m" },
    );
  } catch {
    // Keep transport details out of worker logs; allow the parent's bounded retry.
    throw new Error("INGESTION_RECOVERY_DISPATCH_FAILED");
  }
  logger.warn("Fresh collection scheduled after moving source totals", {
    recoveryRunId: recovery.id,
    timestamp,
    attempt,
  });
}
