import "server-only";

import { neon } from "@neondatabase/serverless";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";

import { getDataStatus } from "@/db/queries/get-data-status";
import {
  getPublicInsight,
  listPublicInsights,
  publicInsightSlugSchema,
} from "@/db/queries/public-insights";
import { getPublicOverview } from "@/db/queries/public-overview";
import { getPublicOffers } from "@/db/queries/public-offers";
import { getPublicTaxonomies } from "@/db/queries/public-taxonomies";
import { getPublicTrends } from "@/db/queries/public-trends";
import {
  readBaseServerEnvironment,
  readCursorEnvironment,
  readDatabaseEnvironment,
  isExternalDataBuildSkipped,
} from "@/lib/env";

import type {
  OffersQuery,
  OffersResponse,
  OverviewQuery,
  TrendsQuery,
} from "./contracts";
import { InvalidCursorError } from "./public-id";

export type CachedPublicOffersResult =
  | { outcome: "success"; response: OffersResponse }
  | { outcome: "invalid_cursor" };

export async function getCachedDataStatus() {
  await waitForExternalDataRuntime();
  return getCachedDataStatusValue();
}

async function getCachedDataStatusValue() {
  "use cache";

  cacheLife({ stale: 60, revalidate: 60, expire: 600 });
  cacheTag("data-status");

  const database = readDatabaseEnvironment();
  const environment = readBaseServerEnvironment();

  return getDataStatus({
    sql: neon(database.DATABASE_URL),
    now: new Date(),
    staleAfterHours: environment.DATASET_STALE_AFTER_HOURS,
    criticalAfterHours: environment.DATASET_CRITICAL_AFTER_HOURS,
  });
}

export async function getCachedPublicOffers(
  query: OffersQuery,
): Promise<CachedPublicOffersResult> {
  await waitForExternalDataRuntime();
  return getCachedPublicOffersValue(query);
}

async function getCachedPublicOffersValue(
  query: OffersQuery,
): Promise<CachedPublicOffersResult> {
  "use cache";

  cacheLife({ stale: 60, revalidate: 60, expire: 600 });
  cacheTag("offers");

  const database = readDatabaseEnvironment();
  const { API_CURSOR_SECRET } = readCursorEnvironment();
  let response: OffersResponse;
  try {
    response = await getPublicOffers({
      sql: neon(database.DATABASE_URL),
      query,
      cursorSecret: API_CURSOR_SECRET,
      generatedAt: new Date(),
    });
  } catch (error) {
    // `use cache` can only return serializable values. Convert this expected
    // domain error before it crosses the cache boundary and loses its prototype.
    if (error instanceof InvalidCursorError) {
      return { outcome: "invalid_cursor" };
    }
    throw error;
  }

  cacheTag(`dataset:${response.meta.datasetVersion}`);
  return { outcome: "success", response };
}

export async function getCachedPublicOverview(query: OverviewQuery) {
  await waitForExternalDataRuntime();
  return getCachedPublicOverviewValue(query);
}

async function getCachedPublicOverviewValue(query: OverviewQuery) {
  "use cache";

  cacheLife({ stale: 300, revalidate: 300, expire: 3_600 });
  cacheTag("overview");

  const database = readDatabaseEnvironment();
  const response = await getPublicOverview({
    sql: neon(database.DATABASE_URL),
    query,
    generatedAt: new Date(),
  });

  cacheTag(`dataset:${response.meta.datasetVersion}`);
  return response;
}

export async function getCachedPublicTaxonomies() {
  await waitForExternalDataRuntime();
  return getCachedPublicTaxonomiesValue();
}

async function getCachedPublicTaxonomiesValue() {
  "use cache";

  cacheLife({ stale: 86_400, revalidate: 86_400, expire: 604_800 });
  cacheTag("taxonomies");

  const database = readDatabaseEnvironment();
  const response = await getPublicTaxonomies({
    sql: neon(database.DATABASE_URL),
    generatedAt: new Date(),
  });

  cacheTag(`dataset:${response.meta.datasetVersion}`);
  return response;
}

export async function getCachedPublicTrends(query: TrendsQuery) {
  await waitForExternalDataRuntime();
  return getCachedPublicTrendsValue(query);
}

async function getCachedPublicTrendsValue(query: TrendsQuery) {
  "use cache";

  cacheLife({ stale: 900, revalidate: 900, expire: 21_600 });
  cacheTag("trends");

  const database = readDatabaseEnvironment();
  const response = await getPublicTrends({
    sql: neon(database.DATABASE_URL),
    query,
    generatedAt: new Date(),
  });

  cacheTag(`dataset:${response.meta.datasetVersion}`);
  return response;
}

export async function getCachedPublicInsight(slug: string) {
  await waitForExternalDataRuntime();
  return getCachedPublicInsightValue(slug);
}

async function getCachedPublicInsightValue(slug: string) {
  "use cache";

  const parsedSlug = publicInsightSlugSchema.safeParse(slug);
  if (!parsedSlug.success) return null;

  cacheLife({ stale: 3_600, revalidate: 3_600, expire: 86_400 });
  cacheTag("insights", `insight:${parsedSlug.data}`);

  const database = readDatabaseEnvironment();
  const insight = await getPublicInsight(
    neon(database.DATABASE_URL),
    parsedSlug.data,
  );

  if (insight) cacheTag(`dataset:${insight.datasetVersion}`);
  return insight;
}

export async function getCachedPublicInsights() {
  await waitForExternalDataRuntime();
  return getCachedPublicInsightsValue();
}

async function getCachedPublicInsightsValue() {
  "use cache";

  cacheLife({ stale: 3_600, revalidate: 3_600, expire: 86_400 });
  cacheTag("insights");

  const database = readDatabaseEnvironment();
  return listPublicInsights(neon(database.DATABASE_URL), 50);
}

async function waitForExternalDataRuntime(): Promise<void> {
  if (isExternalDataBuildSkipped()) await connection();
}
