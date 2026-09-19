// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";

import { IngestionPaginationIncompleteError } from "@/db/full-ingestion-run";
import { schedulePaginationRecovery } from "./schedule-pagination-recovery";

vi.mock("@trigger.dev/sdk", () => ({
  idempotencyKeys: { create: vi.fn(async (key: string) => key) },
  tasks: { trigger: vi.fn(async () => ({ id: "fixture-recovery-run" })) },
  logger: { warn: vi.fn() },
}));

const scheduledAt = new Date("2026-09-19T01:30:00.000Z");
const movingTotal = () =>
  new IngestionPaginationIncompleteError("source_total_changed");

describe("bounded automatic pagination recovery (isolated fixtures)", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([1, 2])(
    "schedules attempt %i + 1 with the original date and a global stable identity",
    async (attempt) => {
      const input = { error: movingTotal(), scheduledAt, attempt };
      await schedulePaginationRecovery(input);
      await schedulePaginationRecovery(input);
      expect(idempotencyKeys.create).toHaveBeenCalledWith(
        `recovery-${scheduledAt.toISOString()}-${attempt + 1}`,
        { scope: "global" },
      );
      expect(tasks.trigger).toHaveBeenCalledWith(
        "recover-france-travail-collection",
        {
          timestamp: scheduledAt.toISOString(),
          attempt: attempt + 1,
          confirmation: "RECOLLECT_WITHOUT_DELETING_PREVIOUS_ATTEMPT",
        },
        {
          idempotencyKey: `recovery-${scheduledAt.toISOString()}-${attempt + 1}`,
          idempotencyKeyTTL: "7d",
          delay: "5m",
        },
      );
      expect(vi.mocked(tasks.trigger).mock.calls[0]).toEqual(
        vi.mocked(tasks.trigger).mock.calls[1],
      );
    },
  );

  it.each([3, 4, 0, -1, 1.5, Number.NaN])(
    "never schedules beyond the bounded attempt %s",
    async (attempt) => {
      await schedulePaginationRecovery({
        error: movingTotal(),
        scheduledAt,
        attempt,
      });
      expect(tasks.trigger).not.toHaveBeenCalled();
      expect(idempotencyKeys.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    new IngestionPaginationIncompleteError(),
    new Error("quality_gate_failed"),
    new Error("source_cap"),
    {
      name: "IngestionPaginationIncompleteError",
      reason: "source_total_changed",
    },
  ])("does not recover unproven movement or another failure", async (error) => {
    await schedulePaginationRecovery({ error, scheduledAt, attempt: 1 });
    expect(tasks.trigger).not.toHaveBeenCalled();
  });

  it("propagates a dispatch failure so the parent can retry the same idempotent dispatch", async () => {
    vi.mocked(tasks.trigger).mockRejectedValueOnce(
      new Error("fixture-dispatch-failure"),
    );
    await expect(
      schedulePaginationRecovery({
        error: movingTotal(),
        scheduledAt,
        attempt: 1,
      }),
    ).rejects.toThrow();
  });
});
