import { Filter, RotateCcw, Search } from "lucide-react";

import type {
  OffersQuery,
  TaxonomiesResponse,
} from "@/application/queries/contracts";
import type { AnalyticsContext } from "@/lib/analytics/client";

import { TrackedFilterForm } from "./analytics/tracked-filter-form";
import { Button } from "./ui/button";

type ExplorerFiltersProps = {
  query: OffersQuery;
  taxonomies: TaxonomiesResponse["data"];
  analyticsContext: AnalyticsContext;
};

function initialFilterValues(query: OffersQuery): Record<string, string> {
  return {
    job: query.scope.job ?? "",
    tech: query.scope.technologies[0] ?? "",
    area: query.scope.area,
    contract: query.scope.contracts[0] ?? "",
    classification: query.classification ?? "",
    remote: query.scope.remote ?? "",
    period: query.scope.period,
  };
}

const classificationOptions = [
  ["contradictory", "Junior contradictoire"],
  ["beginner_friendly", "Débutant accepté"],
  ["junior_unresolved", "Junior, seuil inconnu"],
  ["other_junior", "Autre offre junior"],
  ["not_explicitly_junior", "Pas explicitement junior"],
  ["ambiguous", "Ambigu"],
  ["unknown", "Non classé"],
] as const;

const experienceOptions = [
  ["none", "Aucune expérience"],
  ["1_12", "1 à 12 mois"],
  ["13_23", "13 à 23 mois"],
  ["24_35", "2 ans"],
  ["36_59", "3 à 4 ans"],
  ["60_plus", "5 ans ou plus"],
  ["unknown", "Non précisé"],
  ["ambiguous", "Ambigu"],
] as const;

function activeFilterCount(query: OffersQuery): number {
  return (
    Number(query.scope.job !== null) +
    query.scope.technologies.length +
    Number(query.scope.area !== "france") +
    query.scope.contracts.length +
    Number(query.scope.remote !== null) +
    Number(query.scope.period !== "30d") +
    Number(query.classification !== null) +
    Number(query.salaryPublished !== null) +
    query.experience.length
  );
}

function FilterFields({ query, taxonomies }: ExplorerFiltersProps) {
  return (
    <div className="explorer-filter-fields">
      <label>
        <span>Métier</span>
        <select name="job" defaultValue={query.scope.job ?? ""}>
          <option value="">Tous les métiers</option>
          {taxonomies.jobs.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} ({item.availableCount})
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Technologie</span>
        <select name="tech" defaultValue={query.scope.technologies[0] ?? ""}>
          <option value="">Toutes les technologies</option>
          {taxonomies.technologies.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} ({item.availableCount})
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Territoire</span>
        <select name="area" defaultValue={query.scope.area}>
          <option value="france">France entière</option>
          {taxonomies.popularAreas.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} ({item.availableCount})
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Contrat</span>
        <select name="contract" defaultValue={query.scope.contracts[0] ?? ""}>
          <option value="">Tous les contrats</option>
          {taxonomies.contracts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} ({item.availableCount})
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Classification</span>
        <select name="classification" defaultValue={query.classification ?? ""}>
          <option value="">Toutes les classifications</option>
          {classificationOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Expérience extraite</span>
        <select name="experience" defaultValue={query.experience[0] ?? ""}>
          <option value="">Tous les niveaux</option>
          {experienceOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Télétravail</span>
        <select name="remote" defaultValue={query.scope.remote ?? ""}>
          <option value="">Toutes les modalités</option>
          {taxonomies.remoteModes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} ({item.availableCount})
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Salaire publié</span>
        <select
          name="salaryPublished"
          defaultValue={
            query.salaryPublished === null ? "" : String(query.salaryPublished)
          }
        >
          <option value="">Indifférent</option>
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
      </label>
      <label>
        <span>Période</span>
        <select name="period" defaultValue={query.scope.period}>
          <option value="7d">7 derniers jours</option>
          <option value="30d">30 derniers jours</option>
          <option value="90d">90 derniers jours</option>
          <option value="current">Dataset actuel</option>
        </select>
      </label>
      <label>
        <span>Trier par</span>
        <select name="sort" defaultValue={query.sort}>
          <option value="published_desc">Publication récente</option>
          <option value="published_asc">Publication ancienne</option>
          <option value="experience_asc">Expérience croissante</option>
          <option value="experience_desc">Expérience décroissante</option>
        </select>
      </label>
    </div>
  );
}

function FilterForm(props: ExplorerFiltersProps) {
  return (
    <TrackedFilterForm
      action="/explorer"
      method="get"
      className="explorer-filter-form"
      analyticsContext={props.analyticsContext}
      initialValues={initialFilterValues(props.query)}
    >
      <FilterFields {...props} />
      <div className="filter-actions">
        <Button asChild variant="ghost">
          <a href="/explorer">
            <RotateCcw data-icon="inline-start" /> Réinitialiser
          </a>
        </Button>
        <Button type="submit">
          <Search data-icon="inline-start" /> Afficher les résultats
        </Button>
      </div>
    </TrackedFilterForm>
  );
}

export function ExplorerFilters(props: ExplorerFiltersProps) {
  const count = activeFilterCount(props.query);

  return (
    <section
      className="explorer-filters"
      aria-labelledby="explorer-filter-title"
    >
      <div className="explorer-filters__heading">
        <div>
          <p className="section-label">Périmètre observable</p>
          <h2 id="explorer-filter-title">Filtres</h2>
        </div>
        <span className="filter-count">
          {count} actif{count > 1 ? "s" : ""}
        </span>
      </div>
      <div className="explorer-filters__desktop">
        <FilterForm {...props} />
      </div>
      <details className="explorer-filters__mobile">
        <summary>
          <Filter aria-hidden="true" /> Filtres · {count}
        </summary>
        <FilterForm {...props} />
      </details>
    </section>
  );
}
