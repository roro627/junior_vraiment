import { describe, expect, it } from "vitest";
import { assessProductionHealth } from "../../scripts/check-production-health";

const now = Date.parse("2026-09-06T12:00:00Z");
function healthy() {
  return {
    data: {
      status: "operational",
      freshness: "fresh",
      dataAsOf: "2026-09-06T03:00:00Z",
      lastSuccessfulRunAt: "2026-09-06T03:00:00Z",
      latestRun: {
        status: "succeeded",
        partialQueries: 0,
        received: 100,
        valid: 98,
      },
    },
    meta: { generatedAt: "2026-09-06T11:59:00Z" },
  };
}
describe("production health check", () => {
  it("accepts verified fresh data", () =>
    expect(assessProductionHealth(healthy(), now)).toEqual([]));
  it("detects failed runs even behind HTTP 200 and a green status", () => {
    const payload = healthy();
    payload.data.latestRun.status = "failed";
    expect(assessProductionHealth(payload, now)).toContain(
      "LAST_RUN_NOT_SUCCEEDED",
    );
  });
  it("independently detects stale data despite an incorrect fresh label", () => {
    const payload = healthy();
    payload.data.dataAsOf = "2026-09-04T03:00:00Z";
    expect(assessProductionHealth(payload, now)).toContain(
      "DATA_OLDER_THAN_30H",
    );
  });
  it("rejects future or stale telemetry and bad validation", () => {
    const payload = healthy();
    payload.meta.generatedAt = "2026-09-07T03:00:00Z";
    payload.data.latestRun.valid = 97;
    expect(assessProductionHealth(payload, now)).toEqual([
      "STATUS_RESPONSE_STALE",
      "VALIDATION_BELOW_98_PERCENT",
    ]);
  });
  it.each([null, {}, { data: null }])(
    "fails closed on malformed status",
    (payload) => {
      expect(assessProductionHealth(payload, now).length).toBeGreaterThan(0);
    },
  );
});
