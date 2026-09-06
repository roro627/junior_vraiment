import { pathToFileURL } from "node:url";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function assessProductionHealth(
  payload: unknown,
  now = Date.now(),
): string[] {
  const root = record(payload);
  const data = record(root["data"]);
  const meta = record(root["meta"]);
  const run = record(data["latestRun"]);
  const reasons: string[] = [];
  if (data["status"] !== "operational") reasons.push("STATUS_NOT_OPERATIONAL");
  if (data["freshness"] !== "fresh") reasons.push("DATA_NOT_FRESH");
  if (run["status"] !== "succeeded") reasons.push("LAST_RUN_NOT_SUCCEEDED");
  for (const [value, maxAgeMs, reason] of [
    [data["dataAsOf"], 30 * 3_600_000, "DATA_OLDER_THAN_30H"],
    [data["lastSuccessfulRunAt"], 30 * 3_600_000, "NO_SUCCESS_WITHIN_30H"],
    [meta["generatedAt"], 10 * 60_000, "STATUS_RESPONSE_STALE"],
  ] as const) {
    const timestamp =
      typeof value === "string" ? Date.parse(value) : Number.NaN;
    if (
      !Number.isFinite(timestamp) ||
      timestamp > now + 60_000 ||
      now - timestamp > maxAgeMs
    )
      reasons.push(reason);
  }
  if (run["partialQueries"] !== 0) reasons.push("INCOMPLETE_QUERIES");
  const received = run["received"];
  const valid = run["valid"];
  if (
    typeof received !== "number" ||
    typeof valid !== "number" ||
    !Number.isSafeInteger(received) ||
    !Number.isSafeInteger(valid) ||
    received <= 0 ||
    valid < 0 ||
    valid > received ||
    valid / received < 0.98
  ) {
    reasons.push("VALIDATION_BELOW_98_PERCENT");
  }
  return reasons;
}

async function main() {
  try {
    const origin = new URL(process.argv[2] ?? "");
    if (origin.protocol !== "https:" || origin.username || origin.password)
      throw new Error();
    const response = await fetch(new URL("/api/v1/data-status", origin), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error();
    const payload: unknown = await response.json();
    const reasons = assessProductionHealth(payload);
    if (reasons.length) {
      process.stderr.write(`Production health failed: ${reasons.join(", ")}\n`);
      process.exitCode = 1;
    } else
      process.stdout.write(
        "Production health verified: successful, complete, fresh collection.\n",
      );
  } catch {
    process.stderr.write(
      "Production health failed: status unavailable or invalid.\n",
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
