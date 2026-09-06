import { pathToFileURL } from "node:url";
import { assessProductionHealth } from "../src/domain/ingestion/production-health.ts";
export { assessProductionHealth };

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
