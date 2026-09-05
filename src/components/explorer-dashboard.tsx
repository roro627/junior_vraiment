import {
  getCachedPublicOffers,
  getCachedPublicTaxonomies,
} from "@/application/queries/cached-public-data";
import type { OffersQuery } from "@/application/queries/contracts";
import { buildAnalyticsContext } from "@/lib/analytics/context";
import { formatInteger } from "@/lib/format";

import { PageViewAnalytics } from "./analytics/page-view-analytics";
import { ExplorerFilters } from "./explorer-filters";
import { OfferResults } from "./offer-results";

type ExplorerDashboardProps = {
  query: OffersQuery;
  filtersWereCorrected: boolean;
};

export async function ExplorerDashboard({
  query,
  filtersWereCorrected,
}: ExplorerDashboardProps) {
  const [initialOffers, taxonomies] = await Promise.all([
    getCachedPublicOffers(query),
    getCachedPublicTaxonomies(),
  ]);
  const cursorWasCorrected = initialOffers.outcome === "invalid_cursor";
  const safeQuery = cursorWasCorrected ? { ...query, cursor: null } : query;
  const offers = cursorWasCorrected
    ? await getCachedPublicOffers(safeQuery)
    : initialOffers;

  if (offers.outcome !== "success") {
    throw new Error("Le curseur de repli de l’explorateur est invalide.");
  }

  const corrected = filtersWereCorrected || cursorWasCorrected;
  const analyticsContext = buildAnalyticsContext(offers.response.meta);

  return (
    <main className="explorer" id="contenu">
      <PageViewAnalytics route_name="explorer" context={analyticsContext} />
      <header className="explorer__introduction">
        <div>
          <p className="eyebrow">Observations vérifiables</p>
          <h1>Explorer les offres</h1>
          <p className="lead">
            Retrouvez les annonces derrière les indicateurs et ouvrez chaque
            preuve de classification.
          </p>
        </div>
        <p className="explorer__count" aria-live="polite">
          <strong>{formatInteger(offers.response.meta.sampleSize)}</strong>
          <span>offres correspondent à vos critères</span>
        </p>
      </header>

      {corrected ? (
        <p className="data-warning" role="status">
          Un filtre ou un curseur n’était plus valide. Les résultats sûrs par
          défaut ont été restaurés.
        </p>
      ) : null}

      <ExplorerFilters
        query={safeQuery}
        taxonomies={taxonomies.data}
        analyticsContext={analyticsContext}
      />
      <OfferResults
        response={offers.response}
        query={safeQuery}
        analyticsContext={analyticsContext}
      />
    </main>
  );
}
