import type { Metadata } from "next";
import { Suspense } from "react";

import { offersSearchParamsSchema } from "@/application/queries/contracts";
import { AppHeader } from "@/components/app-header";
import { ExplorerDashboard } from "@/components/explorer-dashboard";
import { ExplorerSkeleton } from "@/components/explorer-skeleton";
import { SiteFooter } from "@/components/site-footer";
import { buildStaticPageMetadata } from "@/lib/seo/static-metadata";

export const metadata: Metadata = buildStaticPageMetadata({
  canonical: "/explorer",
  title: "Explorer les offres — Junior, vraiment ?",
  description:
    "Explorez les offres tech junior observées et les preuves de leur classification.",
  index: false,
});

type RawSearchParams = Record<string, string | string[] | undefined>;

function toUrlSearchParams(raw: RawSearchParams): URLSearchParams {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== "") result.append(key, item);
      }
    } else if (value !== undefined && value !== "") {
      result.set(key, value);
    }
  }
  return result;
}

async function ExplorerContent({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const parsed = offersSearchParamsSchema.safeParse(
    Object.fromEntries(toUrlSearchParams(raw)),
  );
  const query = parsed.success
    ? parsed.data
    : offersSearchParamsSchema.parse({});

  return (
    <ExplorerDashboard query={query} filtersWereCorrected={!parsed.success} />
  );
}

export default function ExplorerPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <AppHeader />
      <Suspense fallback={<ExplorerSkeleton />}>
        <ExplorerContent searchParams={searchParams} />
      </Suspense>
      <SiteFooter />
    </div>
  );
}
