import type { Metadata } from "next";
import { Suspense } from "react";

import { overviewSearchParamsSchema } from "@/application/queries/contracts";
import {
  PilotFooter,
  PilotHeader,
} from "@/components/home-pilot/pilot-primitives";
import { HomeDashboard } from "@/components/home-dashboard";
import { HomeSkeleton } from "@/components/home-skeleton";
import "@/styles/home-pilot.css";
import { isExternalDataBuildSkipped } from "@/lib/env";
import { buildStaticPageMetadata } from "@/lib/seo/static-metadata";
import { resolveSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = buildStaticPageMetadata({
  canonical: "/",
  title: "Junior, vraiment ?",
  description: "L’observatoire public du marché tech junior français.",
  socialDescription:
    "Des chiffres vérifiables sur l’accès réel aux offres tech junior en France.",
});

type RawSearchParams = Record<string, string | string[] | undefined>;

const filterKeys = [
  "job",
  "tech",
  "area",
  "contract",
  "remote",
  "period",
] as const;

function parseHomeQuery(raw: RawSearchParams) {
  const input: Record<string, string> = {};
  for (const key of filterKeys) {
    const rawValue = raw[key];
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (value) input[key] = value;
  }
  const parsed = overviewSearchParamsSchema.safeParse(input);
  return parsed.success ? parsed.data : overviewSearchParamsSchema.parse({});
}

async function FilteredDashboard({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseHomeQuery(await searchParams);
  return <HomeDashboard query={query} />;
}

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const siteUrl = resolveSiteUrl();
  const skipExternalData = isExternalDataBuildSkipped();
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Junior, vraiment ?",
    url: siteUrl,
    description: "L’observatoire public du marché tech junior français.",
    publisher: {
      "@type": "Organization",
      name: "Junior, vraiment ?",
      url: siteUrl,
    },
    inLanguage: "fr-FR",
  }).replace(/</gu, "\\u003c");

  return (
    <div className="home-pilot">
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <PilotHeader />
      <main id="contenu">
        {skipExternalData ? (
          <HomeSkeleton />
        ) : (
          <Suspense fallback={<HomeSkeleton />}>
            <FilteredDashboard searchParams={searchParams} />
          </Suspense>
        )}
      </main>
      <PilotFooter />
      <script type="application/ld+json">{structuredData}</script>
    </div>
  );
}
