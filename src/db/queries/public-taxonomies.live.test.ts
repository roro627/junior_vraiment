import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

import { readDatabaseEnvironment, readToolEnvironment } from "@/lib/env";

import { getPublicTaxonomies } from "./public-taxonomies";

const live = readToolEnvironment().RUN_LIVE_DATABASE === "1";
const describeLive = live ? describe : describe.skip;

describeLive("public taxonomies read model (live)", () => {
  it("returns versioned options counted against the frozen dataset", async () => {
    const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();
    const response = await getPublicTaxonomies({
      sql: neon(DATABASE_DIRECT_URL),
      generatedAt: new Date("2026-09-04T00:00:00.000Z"),
    });

    expect(response.data.versions).toMatchObject({
      jobs: "jobs-1.0.0",
      technologies: "technologies-1.2.0",
      contracts: "contracts-1.0.0",
      geography: "geography-2026.1",
    });
    expect(response.data.jobs).toHaveLength(10);
    expect(response.data.technologies.length).toBeGreaterThan(40);
    expect(
      response.data.jobs.some(({ availableCount }) => availableCount > 0),
    ).toBe(true);
    expect(
      response.data.technologies.some(
        ({ availableCount }) => availableCount > 0,
      ),
    ).toBe(true);
    expect(response.data.contracts).toHaveLength(9);
    expect(response.data.remoteModes).toHaveLength(4);
  });
});
