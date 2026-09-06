import type { NeonQueryFunction } from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";
import { purgeExpiredAuxiliaryData } from "./retention";

describe("bounded auxiliary retention", () => {
  it("clears both raw fields atomically and audits without deleting evidence", async () => {
    const query = vi
      .fn()
      .mockResolvedValue([{ rawPayloads: 2, validationErrors: 1 }]);
    const result = await purgeExpiredAuxiliaryData({
      sql: query as unknown as NeonQueryFunction<false, false>,
      now: new Date(),
      batchSize: 10,
    });
    expect(result).toEqual({ rawPayloads: 2, validationErrors: 1 });
    const statement = (query.mock.calls[0]![0] as TemplateStringsArray).join(
      "?",
    );
    expect(statement).toContain(
      "raw_payload = null, raw_payload_expires_at = null",
    );
    expect(statement).toContain("skip locked");
    expect(statement).toContain("interval '30 days'");
    expect(statement).toContain("RETENTION_PURGED");
    expect(statement).not.toMatch(
      /delete from (?:offer_snapshots|classifications|classification_evidence|daily_metrics)/u,
    );
  });
  it.each([0, -1, 1001, 1.5, Number.NaN])(
    "rejects unsafe batch size %s before SQL",
    async (batchSize) => {
      const query = vi.fn();
      await expect(
        purgeExpiredAuxiliaryData({
          sql: query as unknown as NeonQueryFunction<false, false>,
          now: new Date(),
          batchSize,
        }),
      ).rejects.toThrow();
      expect(query).not.toHaveBeenCalled();
    },
  );
});
