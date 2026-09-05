import type { Metadata } from "next";

import { getCachedPublicInsights } from "@/application/queries/cached-public-data";
import { AppHeader } from "@/components/app-header";
import { InsightCard } from "@/components/insight-card";
import { SiteFooter } from "@/components/site-footer";
import { buildStaticPageMetadata } from "@/lib/seo/static-metadata";

export const metadata: Metadata = buildStaticPageMetadata({
  title: "Insights — Junior, vraiment ?",
  description:
    "Constats éditorialisés, sourcés et reproductibles sur le marché tech junior français.",
  canonical: "/insights",
  socialDescription:
    "Des chiffres figés avec leur période, leur échantillon et leur méthode.",
});

// Published insights come from Neon. Rendering waits for a real request so a
// source-less CI build validates the application without inventing data.
export const instant = false;

export default async function InsightsPage() {
  const insights = await getCachedPublicInsights();

  return (
    <div className="site-shell">
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <AppHeader />
      <main className="insights-index" id="contenu">
        <header>
          <p className="eyebrow">Snapshots éditoriaux</p>
          <h1>Des constats faits pour être vérifiés et partagés.</h1>
          <p className="lead">
            Chaque carte fige sa valeur, sa période, son échantillon et les
            versions de méthode utilisées.
          </p>
        </header>
        {insights.length > 0 ? (
          <section className="insight-grid" aria-label="Insights publiés">
            {insights.map((insight) => (
              <InsightCard key={insight.slug} insight={insight} />
            ))}
          </section>
        ) : (
          <p className="data-warning" role="status">
            Aucun insight n’est encore publié. Les indicateurs restent
            consultables sur l’accueil.
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
