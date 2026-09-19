// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AbortTaskRunError, tasks } from "@trigger.dev/sdk";

import { IngestionPaginationIncompleteError } from "@/db/full-ingestion-run";
import {
  IngestionQualityBlockedError,
  runDailyFranceTravailIngestion,
} from "@/application/ingestion/run-daily-ingestion";
import { ingestFranceTravailDailyTask } from "../../../trigger/ingest-france-travail-daily";
import { recoverFranceTravailCollectionTask } from "../../../trigger/recover-france-travail-collection";

vi.mock("@trigger.dev/sdk", () => ({
  AbortTaskRunError: class extends Error {},
  schedules: { task: (definition: unknown) => definition },
  schemaTask: (definition: unknown) => definition,
  queue: (definition: unknown) => definition,
  idempotencyKeys: { create: vi.fn(async (key: string) => key) },
  tasks: { trigger: vi.fn(async () => ({ id: "fixture-recovery" })) },
  logger: { warn: vi.fn(), info: vi.fn() },
}));
vi.mock("@/application/ingestion/run-daily-ingestion", () => ({
  IngestionQualityBlockedError: class extends Error {},
  runDailyFranceTravailIngestion: vi.fn(),
}));

const timestamp = new Date("2026-09-19T01:30:00Z");
// Only fields read by these thin task handlers are supplied in isolated tests.
const context = {
  ctx: { run: { id: "fixture-parent" } },
  signal: new AbortController().signal,
};

// SDK registration is mocked as identity above so we can exercise its callbacks.
type RegisteredTestTask = {
  run(payload: unknown, taskContext: typeof context): Promise<unknown>;
};
const daily = ingestFranceTravailDailyTask as unknown as RegisteredTestTask;
const recovery =
  recoverFranceTravailCollectionTask as unknown as RegisteredTestTask;

describe("collection task recovery wiring (isolated fixtures)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the scheduled run failed after dispatching its fresh attempt", async () => {
    vi.mocked(runDailyFranceTravailIngestion).mockRejectedValue(
      new IngestionPaginationIncompleteError("source_total_changed"),
    );
    await expect(daily.run({ timestamp }, context)).rejects.toBeInstanceOf(
      AbortTaskRunError,
    );
    expect(runDailyFranceTravailIngestion).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledAt: timestamp,
        triggerRunId: "fixture-parent",
      }),
    );
    expect(tasks.trigger).toHaveBeenCalledWith(
      "recover-france-travail-collection",
      expect.objectContaining({
        timestamp: timestamp.toISOString(),
        attempt: 2,
      }),
      expect.any(Object),
    );
  });

  it.each([2, 3])(
    "wires recovery attempt %i without an unbounded chain",
    async (attempt) => {
      vi.mocked(runDailyFranceTravailIngestion).mockRejectedValue(
        new IngestionPaginationIncompleteError("source_total_changed"),
      );
      await expect(
        recovery.run(
          {
            timestamp: timestamp.toISOString(),
            attempt,
            confirmation: "RECOLLECT_WITHOUT_DELETING_PREVIOUS_ATTEMPT",
          },
          context,
        ),
      ).rejects.toBeInstanceOf(AbortTaskRunError);
      expect(runDailyFranceTravailIngestion).toHaveBeenCalledWith(
        expect.objectContaining({ scheduledAt: timestamp, attempt }),
      );
      expect(tasks.trigger).toHaveBeenCalledTimes(attempt === 2 ? 1 : 0);
    },
  );

  it("does not retry a failed quality gate", async () => {
    vi.mocked(runDailyFranceTravailIngestion).mockRejectedValue(
      new IngestionQualityBlockedError("fixture-quality"),
    );
    await expect(daily.run({ timestamp }, context)).rejects.toBeInstanceOf(
      AbortTaskRunError,
    );
    expect(tasks.trigger).not.toHaveBeenCalled();
  });

  it("does not dispatch on success", async () => {
    const summary = { status: "succeeded", datasetId: "fixture-dataset" };
    vi.mocked(runDailyFranceTravailIngestion).mockResolvedValue(
      summary as never,
    );
    await expect(daily.run({ timestamp }, context)).resolves.toEqual(summary);
    expect(tasks.trigger).not.toHaveBeenCalled();
  });
});
