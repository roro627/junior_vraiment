import type { MetadataRoute } from "next";

import { getCachedPublicInsights } from "@/application/queries/cached-public-data";
import { isPublicIndexingEnabled } from "@/lib/env";
import { buildPublicSitemap } from "@/lib/seo/sitemap";
import { resolveSiteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publicIndexingEnabled = isPublicIndexingEnabled();
  const insights = publicIndexingEnabled ? await getCachedPublicInsights() : [];

  return buildPublicSitemap({
    insights,
    publicIndexingEnabled,
    siteUrl: resolveSiteUrl(),
  });
}
