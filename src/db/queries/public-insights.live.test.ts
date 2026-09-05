// @vitest-environment node

import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

import { readDatabaseEnvironment, readToolEnvironment } from "@/lib/env";

import { listPublicInsights } from "./public-insights";

const live = readToolEnvironment().RUN_LIVE_DATABASE === "1";
const describeLive = live ? describe : describe.skip;

describeLive("public insights read model (live)", () => {
  it("reads the three real immutable launch snapshots", async () => {
    const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();
    const insights = await listPublicInsights(neon(DATABASE_DIRECT_URL), 3);

    expect(insights).toHaveLength(3);
    expect(new Set(insights.map(({ metric }) => metric.metric))).toEqual(
      new Set([
        "junior_contradiction_rate",
        "beginner_friendly_rate",
        "salary_transparency_rate",
      ]),
    );
    for (const insight of insights) {
      expect(insight.metric.value).not.toBeNull();
      expect(insight.metric.denominator).toBeGreaterThanOrEqual(50);
      expect(insight.sourceLabel).toContain("France Travail");
    }
  });
});
