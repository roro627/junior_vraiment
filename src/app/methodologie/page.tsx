import type { Metadata } from "next";
import { Suspense } from "react";

import {
  getCachedDataStatus,
  getCachedPublicOffers,
  getCachedPublicTaxonomies,
} from "@/application/queries/cached-public-data";
import { offersSearchParamsSchema } from "@/application/queries/contracts";
import { PageViewAnalytics } from "@/components/analytics/page-view-analytics";
import { TrustPage } from "@/components/trust-page";
import { buildAnalyticsContext } from "@/lib/analytics/context";
import { formatInteger, formatLongDate } from "@/lib/format";
import { buildStaticPageMetadata } from "@/lib/seo/static-metadata";
import { JUNIOR_OBSERVATION_METRIC_VERSION } from "@/domain/metrics/junior-observation";

export const metadata: Metadata = buildStaticPageMetadata({
  canonical: "/methodologie",
  title: "Méthodologie — Junior, vraiment ?",
  description:
    "Source, collecte, classification déterministe et calcul des indicateurs de Junior, vraiment ?",
});

// The examples and current versions are real database reads. They must never
// be fabricated merely to let a source-only CI build prerender this route.
export const instant = false;

const navigation = [
  { href: "#source", label: "Source et périmètre" },
  { href: "#collecte", label: "Collecte et déduplication" },
  { href: "#classification", label: "Classification" },
  { href: "#calcul", label: "Calcul du KPI" },
  { href: "#exemple", label: "Exemple vérifiable" },
  { href: "#qualite", label: "Qualité et versions" },
  { href: "#corrections", label: "Corrections" },
] as const;

export default function MethodologyPage() {
  return (
    <TrustPage
      eyebrow="Méthode ouverte"
      title="Notre méthodologie, en toute transparence"
      lead="Chaque chiffre part d’offres officielles, passe par des règles déterministes et reste relié aux preuves qui l’ont produit."
      navigation={navigation}
    >
      <Suspense
        fallback={
          <p role="status">Chargement des versions et exemples observés…</p>
        }
      >
        <MethodologyContent />
      </Suspense>
    </TrustPage>
  );
}

async function MethodologyContent() {
  const exampleQuery = offersSearchParamsSchema.parse({
    classification: "contradictory",
    period: "current",
    limit: "1",
  });
  const [status, taxonomies, exampleResult] = await Promise.all([
    getCachedDataStatus(),
    getCachedPublicTaxonomies(),
    getCachedPublicOffers(exampleQuery),
  ]);
  const example =
    exampleResult.outcome === "success"
      ? (exampleResult.response.data.items[0] ?? null)
      : null;
  const activeFamilies = taxonomies.data.jobs.filter(
    ({ availableCount }) => availableCount > 0,
  );
  const analyticsContext = buildAnalyticsContext(status.meta);
  const observationMetric =
    status.meta.metricVersions["junior_contradiction_rate"] ===
    JUNIOR_OBSERVATION_METRIC_VERSION;

  return (
    <>
      <PageViewAnalytics route_name="methodology" context={analyticsContext} />
      <section id="source">
        <p className="section-label">01 · Source et périmètre</p>
        <h2>Une source officielle, un périmètre versionné</h2>
        <p>
          Le MVP utilise exclusivement l’API Offres d’emploi de France Travail.
          L’attribution de la source reste visible et aucune deuxième source
          n’est mélangée aux résultats.
        </p>
        <p>
          Le jeu de requêtes <strong>{status.meta.querySetVersion}</strong>
          couvre actuellement {formatInteger(activeFamilies.length)} familles
          actives&nbsp;: {activeFamilies.map(({ label }) => label).join(", ")}.
          Les requêtes sont conservées et versionnées avec chaque dataset.
        </p>
        <p>
          Un changement de périmètre peut augmenter le nombre d’offres sans
          traduire une hausse des recrutements. Il est signalé dans la tendance
          ; les points concernés ne sont pas reliés comme une évolution
          comparable. Le stock du jour reste distinct du cumul des offres
          observées au fil des jours.
        </p>
        <a
          className="text-link"
          href="https://www.data.gouv.fr/dataservices/api-offres-demploi"
          target="_blank"
          rel="noopener noreferrer"
        >
          Consulter la fiche officielle de la source
          <span className="sr-only"> (nouvel onglet)</span>
        </a>
      </section>

      <section id="collecte">
        <p className="section-label">02 · Collecte et déduplication</p>
        <h2>Une photographie quotidienne, jamais un mélange de versions</h2>
        <ol>
          <li>Les requêtes actives sont parcourues avec pagination bornée.</li>
          <li>Chaque réponse externe est validée avant normalisation.</li>
          <li>
            Les doublons d’une même offre sont regroupés par identité source.
          </li>
          <li>
            Un nouveau snapshot immuable est créé seulement si le contenu
            change.
          </li>
          <li>
            Le dataset publié fige ensemble offre, snapshot et classification.
          </li>
        </ol>
        <p>
          Une offre n’est fermée qu’après deux absences consécutives dans des
          collectes complètes éligibles. Une collecte partielle ne provoque
          jamais de fermeture.
        </p>
      </section>

      <section id="classification">
        <p className="section-label">03 · Classification</p>
        <h2>Des règles pures, déterministes et explicables</h2>
        <p>
          Le moteur de production ne fait aucun appel à un LLM. À entrée et
          version identiques, il produit toujours le même résultat et conserve
          les extraits associés à chaque règle déclenchée.
        </p>
        <dl className="definition-grid">
          <div>
            <dt>classified</dt>
            <dd>Les preuves permettent de publier une décision déterminée.</dd>
          </div>
          <div>
            <dt>ambiguous</dt>
            <dd>
              Des preuves se contredisent ou un conflit bloque la décision.
            </dd>
          </div>
          <div>
            <dt>unclassified</dt>
            <dd>Les informations disponibles ne permettent pas de conclure.</dd>
          </div>
        </dl>
        <p>
          Une absence de preuve reste <code>null</code>&nbsp;: elle ne devient
          jamais automatiquement «&nbsp;non&nbsp;». L’annotation LLM à passe A
          sert uniquement à évaluer hors ligne le moteur déterministe. Une
          relecture ciblée peut corriger le jeu de développement ; un nouveau
          lot aveugle est réservé à la validation, sans montrer les prédictions.
        </p>
      </section>

      <section id="calcul">
        <p className="section-label">04 · Calcul du KPI principal</p>
        <h2>Le dénominateur contient seulement les seuils résolus</h2>
        <div
          className="formula-card"
          aria-label="Formule du taux de contradiction junior"
        >
          <span>offres junior demandant au moins 24 mois</span>
          <span aria-hidden="true">÷</span>
          <span>
            {observationMetric
              ? "offres junior dont le seuil de 24 mois est résolu"
              : "offres junior classées avec minimum obligatoire résolu"}
          </span>
        </div>
        <p>
          Les offres junior sans durée obligatoire exploitable sont publiées
          comme inconnues. Les cas ambigus sont comptés séparément. Aucun de ces
          deux groupes ne réduit artificiellement le taux.
        </p>
        {observationMetric ? (
          <p>
            Méthode 2 : « débutant accepté » et « au moins deux ans exigés »
            peuvent coexister dans une annonce. Cette observation entre dans le
            KPI lorsque les deux preuves sont explicites, même si son
            accessibilité reste indéterminée et son statut global ambigu. Un
            conflit sur le niveau du poste (junior contre senior), ou des durées
            de part et d’autre du seuil, reste exclu. Les séries calculées avec
            l’ancienne méthode ne sont pas reliées à la nouvelle comme une
            évolution du marché.
          </p>
        ) : null}
        <p>
          Moins de 20 offres résolues&nbsp;: «&nbsp;Pas assez de données&nbsp;».
          De 20 à 49&nbsp;: faible échantillon. À partir de 50&nbsp;: affichage
          standard. La couverture est toujours affichée avec le taux.
        </p>
      </section>

      <section id="exemple">
        <p className="section-label">05 · Exemple complet</p>
        <h2>De l’annonce observée à l’indicateur</h2>
        {example ? (
          <div className="method-example">
            <div>
              <span>1 · Offre observée</span>
              <strong>{example.title}</strong>
              <small>
                {example.companyName ?? "Entreprise non renseignée"}
              </small>
            </div>
            <div>
              <span>2 · Extraits conservés</span>
              {example.evidence.slice(0, 3).map((evidence) => (
                <mark key={`${evidence.ruleId}-${evidence.excerpt}`}>
                  {evidence.excerpt}
                </mark>
              ))}
            </div>
            <div>
              <span>3 · Règles appliquées</span>
              <strong>
                {[
                  ...new Set(example.evidence.map(({ ruleId }) => ruleId)),
                ].join(", ")}
              </strong>
            </div>
            <div>
              <span>4 · Classification</span>
              <strong>Junior&nbsp;: oui</strong>
              <strong>
                Minimum&nbsp;: {example.minimumExperienceMonths ?? "non résolu"}
                {example.minimumExperienceMonths === null ? "" : " mois"}
              </strong>
              <strong>Contradictoire&nbsp;: oui</strong>
            </div>
            <div>
              <span>5 · Inclusion KPI</span>
              <strong>Ajoute 1 au numérateur et 1 au dénominateur</strong>
            </div>
          </div>
        ) : (
          <p className="data-warning" role="status">
            Aucun cas contradictoire n’est actuellement publié. L’exemple réel
            réapparaîtra automatiquement lorsqu’un cas vérifié sera disponible.
          </p>
        )}
      </section>

      <section id="qualite">
        <p className="section-label">06 · Qualité, incidents et versions</p>
        <h2>Les ruptures de méthode restent visibles</h2>
        <dl className="version-list">
          <div>
            <dt>Dataset</dt>
            <dd>{status.meta.datasetVersion}</dd>
          </div>
          <div>
            <dt>Classificateur</dt>
            <dd>{status.meta.classifierVersion}</dd>
          </div>
          <div>
            <dt>Jeu de requêtes</dt>
            <dd>{status.meta.querySetVersion}</dd>
          </div>
          <div>
            <dt>Données arrêtées au</dt>
            <dd>{formatLongDate(status.meta.dataAsOf)}</dd>
          </div>
        </dl>
        <p>
          Pagination incomplète, trop de payloads invalides, volume anormal ou
          preuve manquante peuvent bloquer une publication. Les incidents
          publics sont visibles dans l’état des données.
        </p>
        <a className="text-link" href="/statut-donnees">
          Vérifier l’état des données
        </a>
      </section>

      <section id="corrections">
        <p className="section-label">07 · Limites et corrections</p>
        <h2>Une correction devient une règle, pas une exception cachée</h2>
        <p>
          Chaque signalement est reproduit dans une fixture, corrigé dans le
          moteur, mesuré sur le jeu de référence puis publié avec une nouvelle
          version lorsque nécessaire. Une ancienne classification n’est jamais
          réécrite silencieusement.
        </p>
        <div className="trust-actions">
          <a className="text-link" href="/limites">
            Lire toutes les limites
          </a>
          <a className="text-link" href="/signaler">
            Signaler une erreur
          </a>
          <a className="text-link" href="/changelog">
            Consulter le changelog
          </a>
        </div>
      </section>
    </>
  );
}
