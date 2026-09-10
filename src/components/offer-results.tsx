import { ExternalLink } from "lucide-react";

import type {
  OffersQuery,
  OffersResponse,
  PublicOffer,
} from "@/application/queries/contracts";
import type { AnalyticsContext } from "@/lib/analytics/client";
import { analyticsClassificationLabel } from "@/lib/analytics/offer-events";
import { formatInteger, formatLongDate } from "@/lib/format";

import { TrackedSourceOfferLink } from "./analytics/tracked-source-offer-link";
import { EvidencePanel } from "./evidence-panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

type OfferResultsProps = {
  response: OffersResponse;
  query: OffersQuery;
  analyticsContext: AnalyticsContext;
};

function classificationPresentation(offer: PublicOffer): {
  label: string;
  tone: string;
} {
  if (offer.classification.juniorObservation?.contradictory === true)
    return { label: "Junior et ≥ 2 ans exigés", tone: "negative" };
  if (offer.classification.status === "ambiguous")
    return { label: "Ambigu", tone: "warning" };
  if (offer.classification.status === "unclassified")
    return { label: "Non classé", tone: "neutral" };
  if (offer.classification.contradictoryJunior === true)
    return { label: "Junior contradictoire", tone: "negative" };
  if (offer.classification.beginnerFriendly === true)
    return { label: "Débutant accepté", tone: "positive" };
  if (offer.classification.claimsJunior === true)
    return { label: "Junior, seuil inconnu", tone: "info" };
  return { label: "Pas explicitement junior", tone: "neutral" };
}

function extractedExperience(months: number | null): string {
  if (months === null) return "Non résolue";
  if (months === 0) return "Aucune exigence";
  if (months % 12 === 0) {
    const years = months / 12;
    return `${years} an${years > 1 ? "s" : ""} minimum`;
  }
  return `${months} mois minimum`;
}

function salaryLabel(offer: PublicOffer): string {
  if (!offer.salary?.published) return "Non publié";
  if (offer.salary.label) return offer.salary.label;
  return "Salaire publié";
}

function offerQueryString(query: OffersQuery, cursor: string | null): string {
  const params = new URLSearchParams();
  if (query.scope.job) params.set("job", query.scope.job);
  if (query.scope.technologies.length > 0)
    params.set("tech", query.scope.technologies.join(","));
  if (query.scope.area !== "france") params.set("area", query.scope.area);
  if (query.scope.contracts.length > 0)
    params.set("contract", query.scope.contracts.join(","));
  if (query.scope.remote) params.set("remote", query.scope.remote);
  if (query.scope.period !== "30d") params.set("period", query.scope.period);
  if (query.classification) params.set("classification", query.classification);
  if (query.salaryPublished !== null)
    params.set("salaryPublished", String(query.salaryPublished));
  if (query.experience.length > 0)
    params.set("experience", query.experience.join(","));
  if (query.sort !== "published_desc") params.set("sort", query.sort);
  if (query.limit !== 25) params.set("limit", String(query.limit));
  if (cursor) params.set("cursor", cursor);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function OfferActions({
  offer,
  rank,
  analyticsContext,
}: {
  offer: PublicOffer;
  rank: number;
  analyticsContext: AnalyticsContext;
}) {
  const classification = analyticsClassificationLabel(offer);

  return (
    <div className="offer-actions">
      <EvidencePanel
        offer={offer}
        rank={rank}
        analyticsContext={analyticsContext}
      />
      {offer.source.offerUrl ? (
        <Button asChild variant="ghost" size="sm">
          <TrackedSourceOfferLink
            href={offer.source.offerUrl}
            target="_blank"
            rel="noopener noreferrer"
            analyticsContext={analyticsContext}
            classification={classification}
          >
            Offre
            <span className="sr-only"> originale (nouvel onglet)</span>
            <ExternalLink data-icon="inline-end" />
          </TrackedSourceOfferLink>
        </Button>
      ) : null}
    </div>
  );
}

function Availability({ offer }: { offer: PublicOffer }) {
  if (offer.availability === "active") return null;
  return (
    <span className="offer-availability" role="status">
      {offer.availability === "not_seen"
        ? "Non revue lors de la dernière collecte"
        : "Offre fermée"}
    </span>
  );
}

export function OfferResults({
  response,
  query,
  analyticsContext,
}: OfferResultsProps) {
  const items = response.data.items;

  if (items.length === 0) {
    return (
      <section className="empty-results" aria-live="polite">
        <p className="section-label">Aucun résultat</p>
        <h2>Pas d’offre pour cette combinaison.</h2>
        <p>Élargissez le territoire ou retirez un filtre.</p>
        <Button asChild variant="outline">
          <a href="/explorer">Réinitialiser les filtres</a>
        </Button>
      </section>
    );
  }

  return (
    <section className="offer-results" aria-labelledby="offer-results-title">
      <h2 id="offer-results-title" className="sr-only">
        {formatInteger(response.meta.sampleSize)} offres trouvées
      </h2>
      <div className="offer-table-shell">
        <table className="offer-table">
          <caption className="sr-only">
            Offres correspondant aux filtres, avec expérience, classification,
            technologies, salaire et preuves.
          </caption>
          <thead>
            <tr>
              <th scope="col">Offre</th>
              <th scope="col">Lieu et contrat</th>
              <th scope="col">Expérience</th>
              <th scope="col">Classification</th>
              <th scope="col">Technologies</th>
              <th scope="col">Salaire</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((offer, index) => {
              const classification = classificationPresentation(offer);
              return (
                <tr key={offer.id}>
                  <td>
                    <strong>{offer.title}</strong>
                    <span>
                      {offer.companyName ?? "Entreprise non renseignée"}
                    </span>
                    <span>
                      Publiée le{" "}
                      {offer.publishedAt
                        ? formatLongDate(offer.publishedAt)
                        : "date inconnue"}
                    </span>
                    <Availability offer={offer} />
                  </td>
                  <td>
                    <span>{offer.locationLabel ?? "Lieu non renseigné"}</span>
                    <span>
                      {offer.contractLabel ?? "Contrat non renseigné"}
                    </span>
                  </td>
                  <td>
                    <span>
                      {offer.experienceLabel ?? "Source non renseignée"}
                    </span>
                    <strong>
                      {extractedExperience(offer.minimumExperienceMonths)}
                    </strong>
                  </td>
                  <td>
                    <Badge
                      className="classification-badge"
                      data-tone={classification.tone}
                    >
                      {classification.label}
                    </Badge>
                  </td>
                  <td>
                    <div className="technology-list">
                      {offer.technologies.length > 0
                        ? offer.technologies.map((technology) => (
                            <span key={technology}>{technology}</span>
                          ))
                        : "Non détectées"}
                    </div>
                  </td>
                  <td>{salaryLabel(offer)}</td>
                  <td>
                    <OfferActions
                      offer={offer}
                      rank={index + 1}
                      analyticsContext={analyticsContext}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="offer-card-list">
        {items.map((offer, index) => {
          const classification = classificationPresentation(offer);
          return (
            <article className="offer-card" key={offer.id}>
              <header>
                <div>
                  <h3>{offer.title}</h3>
                  <p>{offer.companyName ?? "Entreprise non renseignée"}</p>
                </div>
                <Badge
                  className="classification-badge"
                  data-tone={classification.tone}
                >
                  {classification.label}
                </Badge>
              </header>
              <p className="offer-card__context">
                {offer.locationLabel ?? "Lieu non renseigné"} ·{" "}
                {offer.contractLabel ?? "Contrat non renseigné"}
              </p>
              <dl>
                <div>
                  <dt>Expérience source</dt>
                  <dd>{offer.experienceLabel ?? "Non renseignée"}</dd>
                </div>
                <div>
                  <dt>Expérience extraite</dt>
                  <dd>{extractedExperience(offer.minimumExperienceMonths)}</dd>
                </div>
                <div>
                  <dt>Salaire</dt>
                  <dd>{salaryLabel(offer)}</dd>
                </div>
              </dl>
              <div className="technology-list">
                {offer.technologies.map((technology) => (
                  <span key={technology}>{technology}</span>
                ))}
              </div>
              <Availability offer={offer} />
              <OfferActions
                offer={offer}
                rank={index + 1}
                analyticsContext={analyticsContext}
              />
            </article>
          );
        })}
      </div>

      <nav className="cursor-pagination" aria-label="Pagination des offres">
        <span>
          {formatInteger(response.meta.sampleSize)} résultats au total
        </span>
        {response.data.page.hasNext && response.data.page.nextCursor ? (
          <Button asChild variant="outline">
            <a
              href={`/explorer${offerQueryString(query, response.data.page.nextCursor)}`}
            >
              Page suivante
            </a>
          </Button>
        ) : (
          <span>Fin des résultats</span>
        )}
      </nav>
    </section>
  );
}
