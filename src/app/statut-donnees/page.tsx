import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

import { getCachedDataStatus } from "@/application/queries/cached-public-data";
import { DataFreshnessBadge } from "@/components/data-freshness-badge";
import { TrustPage } from "@/components/trust-page";
import { formatInteger, formatRate } from "@/lib/format";
import { buildStaticPageMetadata } from "@/lib/seo/static-metadata";

export const metadata: Metadata = buildStaticPageMetadata({
  canonical: "/statut-donnees",
  title: "État des données — Junior, vraiment ?",
  description:
    "Fraîcheur, dernière collecte, couverture, incidents et versions des données publiées.",
});

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

function formatDateTime(value: string | null): string {
  return value ? dateTimeFormatter.format(new Date(value)) : "Non disponible";
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1_000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes} min ${remainingSeconds.toString().padStart(2, "0")} s`;
}

export default async function DataStatusPage() {
  const status = await getCachedDataStatus();
  const run = status.data.latestRun;
  const operational = status.data.status === "operational";
  const freshness =
    !operational || status.data.freshness === "unavailable"
      ? ("incident" as const)
      : status.data.freshness;
  const validationRate =
    run && run.received > 0 ? run.valid / run.received : null;

  return (
    <TrustPage
      eyebrow="Transparence opérationnelle"
      title="État des données"
      lead="Cette page expose la fraîcheur, la dernière collecte publiée et les incidents utiles sans révéler d’information d’infrastructure."
      navigation={[
        { href: "#synthese", label: "Synthèse" },
        { href: "#collecte", label: "Dernière collecte" },
        { href: "#versions", label: "Versions" },
        { href: "#incidents", label: "Incidents" },
      ]}
    >
      <section id="synthese">
        <div className="status-banner" data-status={status.data.status}>
          {operational ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <AlertTriangle aria-hidden="true" />
          )}
          <div>
            <h2>
              {operational
                ? "Toutes les données sont à jour"
                : "La publication demande de la prudence"}
            </h2>
            <p>
              Dernière réussite&nbsp;:{" "}
              {formatDateTime(status.data.lastSuccessfulRunAt)}
            </p>
          </div>
          <DataFreshnessBadge
            freshness={freshness}
            dataAsOf={status.data.dataAsOf}
          />
        </div>
      </section>

      <section id="collecte">
        <p className="section-label">Dernière exécution terminale</p>
        <h2>Collecte et validation</h2>
        {run ? (
          <dl className="status-metric-grid">
            <div>
              <dt>Durée</dt>
              <dd>{formatDuration(run.durationMs)}</dd>
            </div>
            <div>
              <dt>Requêtes du périmètre</dt>
              <dd>{formatInteger(run.queries)}</dd>
            </div>
            <div>
              <dt>Appels paginés</dt>
              <dd>{formatInteger(run.requests)}</dd>
            </div>
            <div>
              <dt>Requêtes partielles</dt>
              <dd>{formatInteger(run.partialQueries)}</dd>
            </div>
            <div>
              <dt>Offres reçues</dt>
              <dd>{formatInteger(run.received)}</dd>
            </div>
            <div>
              <dt>Offres nouvelles</dt>
              <dd>{formatInteger(run.new)}</dd>
            </div>
            <div>
              <dt>Offres modifiées</dt>
              <dd>{formatInteger(run.updated)}</dd>
            </div>
            <div>
              <dt>Offres non revues</dt>
              <dd>{formatInteger(run.markedMissing)}</dd>
            </div>
            <div>
              <dt>Offres fermées</dt>
              <dd>
                {run.closed === null
                  ? "Non historisé sur cette exécution"
                  : formatInteger(run.closed)}
              </dd>
            </div>
            <div>
              <dt>Quarantaines</dt>
              <dd>{formatInteger(run.quarantined)}</dd>
            </div>
            <div>
              <dt>Taux de validation</dt>
              <dd>{formatRate(validationRate) ?? "Non calculable"}</dd>
            </div>
            <div>
              <dt>Taux d’ambiguïté</dt>
              <dd>{formatRate(run.ambiguousRate) ?? "Non calculable"}</dd>
            </div>
          </dl>
        ) : (
          <p className="data-warning" role="status">
            Aucune exécution terminale ne peut actuellement être publiée.
          </p>
        )}
      </section>

      <section id="versions">
        <p className="section-label">Reproductibilité</p>
        <h2>Versions du dataset publié</h2>
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
          {Object.entries(status.meta.metricVersions).map(
            ([metric, version]) => (
              <div key={metric}>
                <dt>{metric}</dt>
                <dd>{version}</dd>
              </div>
            ),
          )}
        </dl>
      </section>

      <section id="incidents">
        <p className="section-label">30 derniers jours</p>
        <h2>Incidents publics</h2>
        {status.data.incidents.length === 0 ? (
          <p className="incident-empty">
            <CheckCircle2 aria-hidden="true" /> Aucun incident public affectant
            l’intégrité des indicateurs.
          </p>
        ) : (
          <ol className="incident-list">
            {status.data.incidents.map((incident) => (
              <li key={incident.id}>
                <strong>{incident.summary}</strong>
                <span>
                  {formatDateTime(incident.startedAt)} · {incident.status}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </TrustPage>
  );
}
