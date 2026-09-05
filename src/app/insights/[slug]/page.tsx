import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getCachedPublicInsight,
  getCachedPublicInsights,
} from "@/application/queries/cached-public-data";
import { AppHeader } from "@/components/app-header";
import { InsightPageAnalytics } from "@/components/insight-page-analytics";
import { InsightShare } from "@/components/insight-share";
import { SiteFooter } from "@/components/site-footer";
import type { PublicInsight } from "@/db/queries/public-insights";
import { insightExplorerHref } from "@/domain/insights/editorial";
import { METHODOLOGY_VERSION } from "@/domain/metrics/rate";
import { isPublicIndexingEnabled } from "@/lib/env";
import { formatInteger, formatLongDate, formatRate } from "@/lib/format";
import { resolveSiteUrl } from "@/lib/site-url";

type InsightPageProps = {
  params: Promise<{ slug: string }>;
};

const APP_VERSION = "0.1.0";

// Published slugs are prerendered below. Unknown and newly published slugs may
// resolve at request time so that `notFound()` can still return a real 404.
// Next.js 16 Cache Components rejects `dynamicParams = false`; opting this
// segment out of static-shell validation preserves both behaviors.
export const instant = false;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const insights = await getCachedPublicInsights();
  return insights.map(({ slug }) => ({ slug }));
}

function periodLabel(insight: PublicInsight): string {
  const end = formatLongDate(`${insight.periodEnd}T12:00:00.000Z`);
  if (insight.periodStart === insight.periodEnd) return end;
  return `du ${formatLongDate(`${insight.periodStart}T12:00:00.000Z`)} au ${end}`;
}

function metadataDescription(insight: PublicInsight): string {
  return `${insight.summary} France, ${periodLabel(insight)}, ${formatInteger(insight.metric.populationCount)} offres observées. Source : ${insight.sourceLabel}.`;
}

export async function generateMetadata({
  params,
}: InsightPageProps): Promise<Metadata> {
  const { slug } = await params;
  const insight = await getCachedPublicInsight(slug);

  if (!insight) {
    return {
      title: "Insight introuvable — Junior, vraiment ?",
      robots: { index: false, follow: false },
    };
  }

  const description = metadataDescription(insight);
  const canonical = `/insights/${insight.slug}`;

  return {
    title: `${insight.title} | Junior, vraiment ?`,
    description,
    alternates: { canonical },
    robots: {
      index: isPublicIndexingEnabled(),
      follow: isPublicIndexingEnabled(),
    },
    openGraph: {
      type: "article",
      locale: "fr_FR",
      siteName: "Junior, vraiment ?",
      title: insight.title,
      description,
      url: canonical,
      publishedTime: insight.publishedAt,
      modifiedTime: insight.correctedAt ?? insight.updatedAt,
    },
    twitter: {
      card: "summary_large_image",
      title: insight.title,
      description,
    },
  };
}

export default async function InsightPage({ params }: InsightPageProps) {
  const { slug } = await params;
  const insight = await getCachedPublicInsight(slug);
  if (!insight) notFound();

  const siteUrl = resolveSiteUrl();
  const canonicalUrl = new URL(`/insights/${insight.slug}`, siteUrl).toString();
  const analyticsContext = {
    appVersion: APP_VERSION,
    datasetId: insight.datasetVersion,
    classifierVersion: insight.classifierVersion,
    methodologyVersion: METHODOLOGY_VERSION,
  };
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: insight.title,
    description: insight.summary,
    datePublished: insight.publishedAt,
    dateModified: insight.correctedAt ?? insight.updatedAt,
    author: {
      "@type": "Organization",
      name: "Junior, vraiment ?",
      url: siteUrl,
    },
    mainEntityOfPage: canonicalUrl,
    image: new URL(
      `/insights/${insight.slug}/opengraph-image`,
      siteUrl,
    ).toString(),
    citation: insight.sourceAttributionUrl,
    spatialCoverage: "France",
  }).replace(/</gu, "\\u003c");
  const value = formatRate(insight.metric.value) ?? "Pas assez de données";

  return (
    <div className="site-shell">
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <AppHeader />
      <main className="insight-page" id="contenu">
        {insight.status === "corrected" ? (
          <aside className="insight-correction" role="status">
            <strong>Insight corrigé</strong>
            <span>
              {insight.correctionNote ??
                "La valeur ou son interprétation a été corrigée après publication."}
            </span>
            <a href="/changelog">Consulter le changelog</a>
          </aside>
        ) : null}

        <header className="insight-hero">
          <div>
            <p className="eyebrow">Insight · France</p>
            <h1>{insight.title}</h1>
            <p className="lead">{insight.summary}</p>
          </div>
          <div
            className="insight-hero__metric"
            aria-label={`Résultat : ${value}`}
          >
            <strong>{value}</strong>
            <span>
              {formatInteger(insight.metric.numerator)} sur{" "}
              {formatInteger(insight.metric.denominator)} offres classables
            </span>
          </div>
        </header>

        <div className="insight-layout">
          <article className="insight-story">
            <section>
              <p className="section-label">Ce que mesure ce chiffre</p>
              <h2>Une observation bornée, pas une généralisation</h2>
              <p>
                Ce résultat décrit les offres collectées dans le périmètre
                France et le dataset figé ci-dessous. Il ne mesure ni les
                recrutements réalisés ni les intentions des entreprises.
              </p>
              <a
                className="text-link"
                href={insightExplorerHref(insight.metric.metric)}
              >
                Voir les offres actuelles correspondant au critère
              </a>
            </section>

            <section>
              <p className="section-label">Échantillon et couverture</p>
              <h2>Les inconnues restent visibles</h2>
              <dl className="insight-facts">
                <div>
                  <dt>Population observée</dt>
                  <dd>{formatInteger(insight.metric.populationCount)}</dd>
                </div>
                <div>
                  <dt>Dénominateur résolu</dt>
                  <dd>{formatInteger(insight.metric.denominator)}</dd>
                </div>
                <div>
                  <dt>Couverture</dt>
                  <dd>
                    {formatRate(insight.metric.coverage) ?? "Non calculable"}
                  </dd>
                </div>
                <div>
                  <dt>Cas ambigus</dt>
                  <dd>{formatInteger(insight.metric.ambiguousCount)}</dd>
                </div>
                <div>
                  <dt>Cas inconnus</dt>
                  <dd>{formatInteger(insight.metric.unknownCount)}</dd>
                </div>
                <div>
                  <dt>Qualité d’échantillon</dt>
                  <dd>
                    {insight.metric.sampleQuality === "normal"
                      ? "Standard"
                      : "Prudence"}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <p className="section-label">Méthode et traçabilité</p>
              <h2>Un snapshot reproductible</h2>
              <p>
                La carte reprend directement la métrique stockée avec le dataset
                publié. Elle ne recalcule pas le chiffre à partir des offres
                lors de l’affichage.
              </p>
              <dl className="version-list">
                <div>
                  <dt>Période</dt>
                  <dd>{periodLabel(insight)}</dd>
                </div>
                <div>
                  <dt>Publié le</dt>
                  <dd>{formatLongDate(insight.publishedAt)}</dd>
                </div>
                <div>
                  <dt>Métrique</dt>
                  <dd>{insight.metric.metricVersion}</dd>
                </div>
                <div>
                  <dt>Classificateur</dt>
                  <dd>{insight.classifierVersion}</dd>
                </div>
                <div>
                  <dt>Jeu de requêtes</dt>
                  <dd>{insight.querySetVersion}</dd>
                </div>
                <div>
                  <dt>Dataset</dt>
                  <dd>{insight.datasetVersion}</dd>
                </div>
              </dl>
              <div className="trust-actions">
                <a className="text-link" href="/methodologie">
                  Lire la méthodologie complète
                </a>
                <a
                  className="text-link"
                  href={insight.sourceAttributionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Consulter la source {insight.sourceLabel}
                  <span className="sr-only"> (nouvel onglet)</span>
                </a>
              </div>
            </section>
          </article>

          <InsightShare
            slug={insight.slug}
            title={insight.title}
            summary={insight.summary}
            canonicalUrl={canonicalUrl}
            analyticsContext={analyticsContext}
          />
        </div>
      </main>
      <SiteFooter />
      <InsightPageAnalytics slug={insight.slug} context={analyticsContext} />
      <script type="application/ld+json">{structuredData}</script>
    </div>
  );
}
