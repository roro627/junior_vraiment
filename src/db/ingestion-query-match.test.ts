import type { NeonQueryFunction } from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";
import { storeOfferQueryMatch } from "./ingestion-run";

describe("query membership persistence", () => {
  it("stores only explicitly matched families rather than all query families", async () => {
    const query = vi.fn().mockResolvedValue([]);
    await storeOfferQueryMatch({
      sql: query as unknown as NeonQueryFunction<false, false>,
      offerId: "fixture",
      sourceQueryId: "fixture-query",
      observedAt: new Date("2026-09-06"),
      matchedJobFamilies: ["software"],
    });
    expect(
      (query.mock.calls[0]![0] as TemplateStringsArray).join("?"),
    ).toContain("matched_job_families");
    expect(query.mock.calls[0]).toContainEqual(["software"]);
  });
  it("rejects an empty admitted perimeter before any write", async () => {
    const query = vi.fn();
    await expect(
      storeOfferQueryMatch({
        sql: query as unknown as NeonQueryFunction<false, false>,
        offerId: "fixture",
        sourceQueryId: "fixture-query",
        observedAt: new Date(),
        matchedJobFamilies: [],
      }),
    ).rejects.toThrow(/famille admise/);
    expect(query).not.toHaveBeenCalled();
  });
});
