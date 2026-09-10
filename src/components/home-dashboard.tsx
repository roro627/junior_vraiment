import {
  getCachedPublicOverview,
  getCachedPublicTaxonomies,
  getCachedPublicTrends,
} from "@/application/queries/cached-public-data";
import type {
  OverviewQuery,
  TrendsQuery,
} from "@/application/queries/contracts";
import { buildAnalyticsContext } from "@/lib/analytics/context";
import { FileText, MapPin } from "lucide-react";
import { PageViewAnalytics } from "./analytics/page-view-analytics";
import { FilterBar } from "./filter-bar";
import { HomeDataFreshness } from "./home-data-freshness";
import {
  PilotDistribution,
  PilotHeadline,
  PilotIntroduction,
  PilotLink,
  PilotSectionHeading,
} from "./home-pilot/pilot-primitives";
import { PilotTrend } from "./home-pilot/pilot-trend";
import { PilotMetrics } from "./home-pilot/pilot-metrics";
import { PilotPeriod } from "./home-pilot/pilot-period";
import { scopeParameters } from "./home-pilot/pilot-scope";

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
const periodLabels = {
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
  "90d": "90 derniers jours",
  current: "Jeu actuel",
} as const;

function offersHref(query: OverviewQuery, contradictory = false): string {
  const params = scopeParameters(query);
  if (contradictory) params.set("classification", "contradictory");
  return `/explorer${params.size ? `?${params}` : ""}`;
}

export async function HomeDashboard({ query }: { query: OverviewQuery }) {
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
  const { data, meta } = overview;
  const trendParams = scopeParameters(query);
  trendParams.set("metric", trendsQuery.metric);
  const jobLabel = taxonomies.data.jobs.find(
    ({ id }) => id === query.job,
  )?.label;
  const analyticsContext = buildAnalyticsContext(meta);
  const areaLabel =
    query.area === "france"
      ? "France"
      : (taxonomies.data.popularAreas.find(({ id }) => id === query.area)
          ?.label ?? query.area);
  return (
    <>
      <PageViewAnalytics route_name="home" context={analyticsContext} />
      <section
        className="pilot-container pilot-hero"
        id="observer"
        aria-label="L’observation principale"
      >
        <PilotIntroduction explorerHref={offersHref(query)} />
        <PilotHeadline
          metric={data.headline}
          scopeLabel={`${jobLabel ? `${jobLabel} · ` : ""}${areaLabel} · ${periodLabels[query.period]}`}
          explorerHref={offersHref(query, true)}
        />
        <div className="pilot-hero__meta">
          <p className="pilot-scope">
            <MapPin aria-hidden="true" />
            {jobLabel ? `${jobLabel} · ` : ""}
            {areaLabel} · {periodLabels[query.period]}
          </p>
          <a href="https://francetravail.io/produits-partages/catalogue/offres-emploi">
            <FileText aria-hidden="true" /> Source : France Travail
          </a>
          <a href="/statut-donnees" className="pilot-freshness-link">
            <HomeDataFreshness query={query} />
          </a>
        </div>
      </section>
      <section
        className="pilot-observation"
        id="observation"
        aria-label="Le marché dans votre périmètre"
      >
        <div className="pilot-container">
          <div className="pilot-observation__heading">
            <div>
              <h2>Votre lecture du marché.</h2>
              <p className="pilot-observation__description">
                Un même périmètre pour tous les chiffres. À vous de l’affiner.
              </p>
            </div>
            <PilotPeriod scope={query} />
          </div>
          {meta.quality === "partial" ? (
            <aside className="data-warning" role="status">
              Une partie de la collecte est incomplète. Les résultats concernés
              sont signalés et doivent être interprétés avec prudence.
            </aside>
          ) : null}
          <FilterBar
            key={scopeParameters(query).toString()}
            presentation="pilot"
            scope={data.scope}
            taxonomies={taxonomies.data}
            analyticsContext={analyticsContext}
          />
        </div>
      </section>
      <PilotMetrics
        sampleSize={meta.sampleSize}
        beginnerFriendly={data.beginnerFriendly}
        salaryTransparency={data.salaryTransparency}
      />
      <section
        className="pilot-container pilot-market"
        aria-label="Expérience et technologies"
      >
        <PilotSectionHeading
          number="01"
          title="Les exigences, en détail."
          detail="Les exigences de toutes les offres du périmètre, pas uniquement celles qui se présentent comme junior."
        />
        <div className="pilot-market__grid">
          <section className="pilot-chart" aria-labelledby="pilot-experience">
            <div className="pilot-chart__heading">
              <h3 id="pilot-experience">L’expérience demandée</h3>
              <span>Offres · part du périmètre</span>
            </div>
            <PilotDistribution
              items={data.experienceBuckets.map((bucket) => ({
                key: bucket.key,
                label: experienceLabels[bucket.key],
                count: bucket.count,
                share:
                  meta.sampleSize === 0 ? null : bucket.count / meta.sampleSize,
              }))}
            />
            <p className="pilot-chart__note">
              Les niveaux inconnus et ambigus restent visibles.
            </p>
          </section>
          <section className="pilot-chart" aria-labelledby="pilot-technologies">
            <div className="pilot-chart__heading">
              <h3 id="pilot-technologies">Les technologies citées</h3>
              <span>Les six premières</span>
            </div>
            <PilotDistribution
              variant="ranked"
              items={data.topTechnologies.slice(0, 6).map((item) => ({
                key: item.key,
                label: item.label ?? item.key,
                count: item.count,
                share: item.share ?? null,
              }))}
            />
            <p className="pilot-chart__note">
              Une offre peut citer plusieurs technologies. Les parts ne
              s’additionnent pas.
            </p>
          </section>
        </div>
      </section>
      <section className="pilot-history" aria-label="Contrats et historique">
        <div className="pilot-container pilot-history__grid">
          <div>
            <p className="pilot-kicker">Prendre du recul</p>
            <h2>
              Un instantané.
              <br />
              Une histoire qui s’écrit.
            </h2>
            <p>
              Le marché bouge. Chaque collecte conserve ses observations, sa
              méthode et ses limites.
            </p>
            <PilotLink href="/statut-donnees">Suivre la collecte</PilotLink>
          </div>
          <div className="pilot-history__data">
            <PilotTrend
              points={trends.data.points}
              dataHref={`/api/v1/trends?${trendParams}`}
            />
            {/* Native toggles can change open before hydration; retain the user's DOM state. */}
            <details className="pilot-contracts" suppressHydrationWarning>
              <summary>
                Et les types de contrat ? <span aria-hidden="true">+</span>
              </summary>
              <PilotDistribution
                items={data.contracts.map((item) => ({
                  key: item.key,
                  label: item.label ?? item.key,
                  count: item.count,
                  share: item.share ?? null,
                }))}
              />
            </details>
          </div>
        </div>
      </section>
      <section className="pilot-container pilot-method" id="methode">
        <PilotSectionHeading
          number="02"
          title="Vous n’avez pas à nous croire."
          detail="Vous pouvez vérifier."
        />
        <div className="pilot-method__grid">
          <p>Un chiffre n’est utile que si l’on sait ce qu’il raconte.</p>
          <div>
            <p>
              Chaque classement repose sur des règles déterministes et des
              preuves consultables. Une formulation ambiguë reste ambiguë : elle
              ne devient pas une certitude pour remplir un graphique.
            </p>
            <PilotLink href="/methodologie">Ouvrir la méthodologie</PilotLink>
            <p className="pilot-method__version">
              Classification : {meta.classifierVersion}
              <br />
              Indicateur : {data.headline.metricVersion}
            </p>
          </div>
        </div>
        <div className="pilot-method__limits">
          <span>Un observatoire, pas tout le marché.</span>
          <p>
            Une source officielle, un périmètre tech défini, des limites
            explicites. Ces chiffres décrivent les offres observées, pas toutes
            les opportunités en France.
          </p>
          <PilotLink href="/limites">Connaître les limites</PilotLink>
        </div>
      </section>
    </>
  );
}
