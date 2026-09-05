import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

import { offersSearchParamsSchema } from "@/application/queries/contracts";
import { readDatabaseEnvironment, readToolEnvironment } from "@/lib/env";

import { getPublicOffers } from "./public-offers";

const live = readToolEnvironment().RUN_LIVE_DATABASE === "1";
const describeLive = live ? describe : describe.skip;
const fixtureCursorSecret = "fixture-cursor-secret-for-live-query-tests-only";

describeLive("public offers read model (live)", () => {
  it("reads the frozen dataset and paginates without overlap", async () => {
    const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();
    const sql = neon(DATABASE_DIRECT_URL);
    const firstQuery = offersSearchParamsSchema.parse({
      period: "current",
      limit: "2",
    });
    const firstPage = await getPublicOffers({
      sql,
      query: firstQuery,
      cursorSecret: fixtureCursorSecret,
      generatedAt: new Date("2026-09-04T00:00:00.000Z"),
    });

    expect(firstPage.data.items).toHaveLength(2);
    expect(firstPage.data.page.hasNext).toBe(true);
    expect(firstPage.data.page.nextCursor).not.toBeNull();
    expect(firstPage.meta.sampleSize).toBeGreaterThan(2);

    const secondQuery = offersSearchParamsSchema.parse({
      period: "current",
      limit: "2",
      cursor: firstPage.data.page.nextCursor ?? undefined,
    });
    const secondPage = await getPublicOffers({
      sql,
      query: secondQuery,
      cursorSecret: fixtureCursorSecret,
      generatedAt: new Date("2026-09-04T00:00:00.000Z"),
    });

    expect(secondPage.data.items).toHaveLength(2);
    expect(secondPage.data.items.map(({ id }) => id)).not.toEqual(
      firstPage.data.items.map(({ id }) => id),
    );
    expect(secondPage.meta.datasetVersion).toBe(firstPage.meta.datasetVersion);
  });

  it.each([
    "published_desc",
    "published_asc",
    "experience_desc",
    "experience_asc",
  ] as const)("supports the %s keyset order", async (sort) => {
    const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();
    const response = await getPublicOffers({
      sql: neon(DATABASE_DIRECT_URL),
      query: offersSearchParamsSchema.parse({
        period: "current",
        sort,
        limit: "3",
      }),
      cursorSecret: fixtureCursorSecret,
      generatedAt: new Date("2026-09-04T00:00:00.000Z"),
    });

    expect(response.data.items).toHaveLength(3);
    expect(response.meta.sampleSize).toBeGreaterThanOrEqual(3);
  });
});
