import type { NeonQueryFunction } from "@neondatabase/serverless";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  purgeExpiredAuxiliaryData,
  readExpiredAuxiliaryData,
} from "@/db/retention";
import { runRetention } from "./run-retention";

vi.mock("@/db/retention", () => ({
  purgeExpiredAuxiliaryData: vi.fn(),
  readExpiredAuxiliaryData: vi.fn(),
}));
const sql = vi.fn() as unknown as NeonQueryFunction<false, false>;
const empty = { rawPayloads: 0, validationErrors: 0 };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readExpiredAuxiliaryData).mockResolvedValue(empty);
});
describe("retention orchestration", () => {
  it("stops on an empty batch and verifies remaining expiry", async () => {
    vi.mocked(purgeExpiredAuxiliaryData)
      .mockResolvedValueOnce({ rawPayloads: 5, validationErrors: 2 })
      .mockResolvedValue(empty);
    expect(await runRetention({ sql, now: new Date() })).toEqual({
      rawPayloads: 5,
      validationErrors: 2,
      batches: 2,
    });
  });
  it("fails if eligible rows remain", async () => {
    vi.mocked(purgeExpiredAuxiliaryData).mockResolvedValue(empty);
    vi.mocked(readExpiredAuxiliaryData).mockResolvedValue({
      ...empty,
      rawPayloads: 1,
    });
    await expect(runRetention({ sql, now: new Date() })).rejects.toThrow(
      "RETENTION_INCOMPLETE",
    );
  });
  it("bounds even a continuously full queue", async () => {
    vi.mocked(purgeExpiredAuxiliaryData).mockResolvedValue({
      rawPayloads: 500,
      validationErrors: 0,
    });
    vi.mocked(readExpiredAuxiliaryData).mockResolvedValue({
      ...empty,
      rawPayloads: 1,
    });
    await expect(runRetention({ sql, now: new Date() })).rejects.toThrow();
    expect(purgeExpiredAuxiliaryData).toHaveBeenCalledTimes(100);
  });
  it("honors cancellation before writing", async () => {
    await expect(
      runRetention({ sql, now: new Date(), signal: AbortSignal.abort() }),
    ).rejects.toThrow();
    expect(purgeExpiredAuxiliaryData).not.toHaveBeenCalled();
  });
});
