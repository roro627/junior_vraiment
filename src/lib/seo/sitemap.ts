import type { MetadataRoute } from "next";

import type { PublicInsight } from "@/db/queries/public-insights";

type SitemapInput = Readonly<{
  insights: Array<Pick<PublicInsight, "slug" | "correctedAt" | "updatedAt">>;
  publicIndexingEnabled: boolean;
  siteUrl: string;
}>;

const staticEntries = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/insights", changeFrequency: "weekly", priority: 0.9 },
  { path: "/methodologie", changeFrequency: "monthly", priority: 0.8 },
  { path: "/statut-donnees", changeFrequency: "daily", priority: 0.7 },
  { path: "/a-propos", changeFrequency: "yearly", priority: 0.6 },
  { path: "/limites", changeFrequency: "monthly", priority: 0.6 },
  { path: "/changelog", changeFrequency: "monthly", priority: 0.5 },
] as const;

export function buildPublicSitemap({
  insights,
  publicIndexingEnabled,
  siteUrl,
}: SitemapInput): MetadataRoute.Sitemap {
  if (!publicIndexingEnabled) return [];

  const latestInsightUpdate = insights
    .map(({ correctedAt, updatedAt }) => correctedAt ?? updatedAt)
    .sort()
    .at(-1);

  return [
    ...staticEntries.map(({ path, changeFrequency, priority }) => ({
      url: new URL(path, siteUrl).toString(),
      changeFrequency,
      priority,
      ...(path === "/insights" && latestInsightUpdate
        ? { lastModified: latestInsightUpdate }
        : undefined),
    })),
    ...insights.map((insight) => ({
      url: new URL(`/insights/${insight.slug}`, siteUrl).toString(),
      lastModified: insight.correctedAt ?? insight.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
      images: [
        new URL(
          `/insights/${insight.slug}/opengraph-image`,
          siteUrl,
        ).toString(),
      ],
    })),
  ];
}
