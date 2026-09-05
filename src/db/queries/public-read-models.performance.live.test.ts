import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

import {
  offersSearchParamsSchema,
  overviewSearchParamsSchema,
  trendsSearchParamsSchema,
} from "@/application/queries/contracts";
import { readDatabaseEnvironment, readToolEnvironment } from "@/lib/env";

import { getPublicOffers } from "./public-offers";
import { getPublicOverview } from "./public-overview";
import { getPublicTaxonomies } from "./public-taxonomies";
import { getPublicTrends } from "./public-trends";

const live = readToolEnvironment().RUN_LIVE_DATABASE === "1";
const describeLive = live ? describe : describe.skip;
const iterations = 20;

async function percentile95(
  operation: () => Promise<unknown>,
): Promise<number> {
  await operation();
  const durations: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    await operation();
    durations.push(performance.now() - startedAt);
  }
  durations.sort((left, right) => left - right);
  return (
    durations[Math.ceil(iterations * 0.95) - 1] ?? Number.POSITIVE_INFINITY
  );
}

describeLive("public read-model performance (live)", () => {
  it("keeps KPI database reads under 100 ms at p95", async () => {
    const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();
    const sql = neon(DATABASE_DIRECT_URL);
    const p95 = await percentile95(() =>
      getPublicOverview({
        sql,
        query: overviewSearchParamsSchema.parse({ period: "current" }),
        generatedAt: new Date(),
      }),
    );

    expect(p95).toBeLessThan(100);
  });

  it("keeps explorer database reads under 250 ms at p95", async () => {
    const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();
    const sql = neon(DATABASE_DIRECT_URL);
    const p95 = await percentile95(() =>
      getPublicOffers({
        sql,
        query: offersSearchParamsSchema.parse({
          period: "current",
          limit: "25",
        }),
        cursorSecret: "fixture-cursor-secret-for-performance-tests-only",
        generatedAt: new Date(),
      }),
    );

    expect(p95).toBeLessThan(250);
  });

  it("keeps aggregate reads under the 500 ms API budget", async () => {
    const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();
    const sql = neon(DATABASE_DIRECT_URL);
    const trendsP95 = await percentile95(() =>
      getPublicTrends({
        sql,
        query: trendsSearchParamsSchema.parse({
          metric: "junior_contradiction_rate",
          period: "current",
        }),
        generatedAt: new Date(),
      }),
    );
    const taxonomiesP95 = await percentile95(() =>
      getPublicTaxonomies({ sql, generatedAt: new Date() }),
    );

    expect(trendsP95).toBeLessThanOrEqual(500);
    expect(taxonomiesP95).toBeLessThanOrEqual(500);
  });
});
