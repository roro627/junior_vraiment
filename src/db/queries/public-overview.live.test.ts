import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

import { overviewSearchParamsSchema } from "@/application/queries/contracts";
import { readDatabaseEnvironment, readToolEnvironment } from "@/lib/env";

import { getPublicOverview } from "./public-overview";

const live = readToolEnvironment().RUN_LIVE_DATABASE === "1";
const describeLive = live ? describe : describe.skip;

describeLive("public overview read model (live)", () => {
  it("computes all cards from the frozen current membership", async () => {
    const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();
    const response = await getPublicOverview({
      sql: neon(DATABASE_DIRECT_URL),
      query: overviewSearchParamsSchema.parse({ period: "current" }),
      generatedAt: new Date("2026-09-04T00:00:00.000Z"),
    });

    expect(response.meta.sampleSize).toBeGreaterThan(0);
    expect(response.data.experienceBuckets).toHaveLength(8);
    expect(
      response.data.experienceBuckets.reduce(
        (total, bucket) => total + bucket.count,
        0,
      ),
    ).toBe(response.meta.sampleSize);
    expect(response.data.headline.populationCount).toBe(
      response.data.headline.denominator +
        response.data.headline.unknownCount +
        response.data.headline.ambiguousCount,
    );
    expect(response.data.salaryTransparency.populationCount).toBe(
      response.meta.sampleSize,
    );
  });

  it("returns null rates instead of false zeroes for an empty scope", async () => {
    const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();
    const response = await getPublicOverview({
      sql: neon(DATABASE_DIRECT_URL),
      query: overviewSearchParamsSchema.parse({
        period: "current",
        area: "commune:99999",
      }),
      generatedAt: new Date("2026-09-04T00:00:00.000Z"),
    });

    expect(response.meta.sampleSize).toBe(0);
    expect(response.data.headline).toMatchObject({
      value: null,
      numerator: 0,
      denominator: 0,
      coverage: null,
      sampleQuality: "insufficient",
    });
    expect(response.data.beginnerFriendly.value).toBeNull();
    expect(response.data.salaryTransparency.value).toBeNull();
  });
});
