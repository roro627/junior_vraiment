import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

import { trendsSearchParamsSchema } from "@/application/queries/contracts";
import { readDatabaseEnvironment, readToolEnvironment } from "@/lib/env";

import { getPublicTrends } from "./public-trends";

const live = readToolEnvironment().RUN_LIVE_DATABASE === "1";
const describeLive = live ? describe : describe.skip;

describeLive("public trends read model (live)", () => {
  it.each([
    "junior_contradiction_rate",
    "beginner_friendly_rate",
    "salary_transparency_rate",
  ] as const)("returns a valid daily %s series", async (metric) => {
    const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();
    const response = await getPublicTrends({
      sql: neon(DATABASE_DIRECT_URL),
      query: trendsSearchParamsSchema.parse({
        metric,
        period: "current",
      }),
      generatedAt: new Date("2026-09-04T00:00:00.000Z"),
    });

    expect(response.data.metric).toBe(metric);
    expect(response.data.points.length).toBeGreaterThan(0);
    expect(response.data.points.length).toBeLessThanOrEqual(366);
    expect(response.data.points.map(({ date }) => date)).toEqual(
      [...response.data.points.map(({ date }) => date)].sort(),
    );
    for (const point of response.data.points) {
      expect(point.populationCount).toBe(
        point.denominator + point.unknownCount + point.ambiguousCount,
      );
    }
  });
});
