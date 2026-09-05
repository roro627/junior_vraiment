import {
  getCachedPublicOverview,
  getCachedPublicTaxonomies,
  getCachedPublicTrends,
} from "@/application/queries/cached-public-data";
import type {
  OverviewQuery,
  TrendsQuery,
} from "@/application/queries/contracts";
import { formatInteger } from "@/lib/format";

import { DistributionCard } from "./distribution-card";
import { FilterBar } from "./filter-bar";
import { KpiHero } from "./kpi-hero";
import { MetricCard } from "./metric-card";
import { TrendCard } from "./trend-card";

type HomeDashboardProps = {
  query: OverviewQuery;
};

const experienceLabels = {
  none: "Débutant accepté",
  "1_12": "1 à 12 mois",
  "13_23": "13 à 23 mois",
  "24_35": "2 ans",
  "36_59": "3 à 4 ans",
  "60_plus": "5 ans ou plus",
  unknown: "Non précisé",
  ambiguous: "Ambigu",
} as const;

function contradictoryOffersHref(query: OverviewQuery): string {
  const params = new URLSearchParams({ classification: "contradictory" });
  if (query.job) params.set("job", query.job);
  if (query.technologies.length > 0)
    params.set("tech", query.technologies.join(","));
  if (query.area !== "france") params.set("area", query.area);
  if (query.contracts.length > 0)
    params.set("contract", query.contracts.join(","));
  if (query.remote) params.set("remote", query.remote);
  if (query.period !== "30d") params.set("period", query.period);
  return `/explorer?${params.toString()}`;
}

export async function HomeDashboard({ query }: HomeDashboardProps) {
  const trendsQuery: TrendsQuery = {
    scope: query,
    metric: "junior_contradiction_rate",
    from: null,
    to: null,
  };
  const [overview, trends, taxonomies] = await Promise.all([
    getCachedPublicOverview(query),
    getCachedPublicTrends(trendsQuery),
    getCachedPublicTaxonomies(),
  ]);
  const sampleSize = overview.meta.sampleSize;
  const experience = overview.data.experienceBuckets.map((bucket) => ({
    key: bucket.key,
    label: experienceLabels[bucket.key],
    count: bucket.count,
    share: sampleSize === 0 ? null : bucket.count / sampleSize,
  }));

  return (
    <>
      {overview.meta.quality === "partial" ? (
        <aside className="data-warning" role="status">
          Une partie de la collecte est incomplète. Les résultats concernés sont
          signalés et doivent être interprétés avec prudence.
        </aside>
      ) : null}

      <FilterBar scope={overview.data.scope} taxonomies={taxonomies.data} />
      <KpiHero
        metric={overview.data.headline}
        period={overview.data.scope.period}
        explorerHref={contradictoryOffersHref(overview.data.scope)}
      />

      <div className="dashboard-grid dashboard-grid--primary">
        <TrendCard points={trends.data.points} />
        <DistributionCard
          id="experience"
          title="Expérience demandée"
          description="Toutes les offres du périmètre, y compris les niveaux inconnus et ambigus."
          items={experience}
        />
      </div>

      <section className="metric-grid" aria-label="Indicateurs complémentaires">
        <MetricCard
          title="Débutants explicitement acceptés"
          value={overview.data.beginnerFriendly.value}
          numerator={overview.data.beginnerFriendly.numerator}
          denominator={overview.data.beginnerFriendly.denominator}
          detail="offres classables"
          action={
            <a href="/methodologie#accessible">Comprendre l’indicateur</a>
          }
        />
        <MetricCard
          title="Transparence salariale"
          value={overview.data.salaryTransparency.value}
          numerator={overview.data.salaryTransparency.numerator}
          denominator={overview.data.salaryTransparency.denominator}
          detail="offres affichent une rémunération"
          action={<a href="/methodologie#salaire">Comprendre l’indicateur</a>}
        />
        <article className="metric-card metric-card--sample">
          <p className="metric-card__title">Offres analysées</p>
          <p className="metric-card__value">{formatInteger(sampleSize)}</p>
          <p className="metric-card__detail">
            Méthode {overview.meta.classifierVersion}
          </p>
          <div className="metric-card__action">
            <a href="/statut-donnees">Vérifier la collecte</a>
          </div>
        </article>
      </section>

      <div className="dashboard-grid dashboard-grid--secondary">
        <DistributionCard
          id="technologies"
          title="Technologies les plus citées"
          description="Une offre peut citer plusieurs technologies."
          items={overview.data.topTechnologies.slice(0, 6).map((item) => ({
            key: item.key,
            label: item.label ?? item.key,
            count: item.count,
            share: item.share ?? null,
          }))}
        />
        <DistributionCard
          id="contrats"
          title="Types de contrat"
          description="Répartition fournie par la source et normalisée."
          items={overview.data.contracts.slice(0, 6).map((item) => ({
            key: item.key,
            label: item.label ?? item.key,
            count: item.count,
            share: item.share ?? null,
          }))}
        />
      </div>

      <section className="methodology-callout" id="methode">
        <div>
          <p className="section-label">Des preuves, pas un score opaque</p>
          <h2>Chaque classement reste explicable.</h2>
          <p>
            Les règles sont déterministes, versionnées et testées. Les cas
            ambigus restent visibles et ne sont jamais forcés dans un
            pourcentage.
          </p>
        </div>
        <a className="text-link" href="/methodologie">
          Lire la méthodologie
        </a>
      </section>
    </>
  );
}
