import { Filter, RotateCcw, Search } from "lucide-react";
import Link from "next/link";

import type {
  OverviewQuery,
  TaxonomiesResponse,
} from "@/application/queries/contracts";

import { Button } from "./ui/button";

type FilterBarProps = {
  scope: OverviewQuery;
  taxonomies: TaxonomiesResponse["data"];
};

function activeFilterCount(scope: OverviewQuery): number {
  return (
    Number(scope.job !== null) +
    scope.technologies.length +
    Number(scope.area !== "france") +
    scope.contracts.length +
    Number(scope.remote !== null) +
    Number(scope.period !== "30d")
  );
}

function FilterFields({ scope, taxonomies }: FilterBarProps) {
  return (
    <div className="filter-fields">
      <label>
        <span>Métier</span>
        <select name="job" defaultValue={scope.job ?? ""}>
          <option value="">Tous les métiers</option>
          {taxonomies.jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.label} ({job.availableCount})
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Technologie</span>
        <select name="tech" defaultValue={scope.technologies[0] ?? ""}>
          <option value="">Toutes les technologies</option>
          {taxonomies.technologies.map((technology) => (
            <option key={technology.id} value={technology.id}>
              {technology.label} ({technology.availableCount})
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Territoire</span>
        <select name="area" defaultValue={scope.area}>
          <option value="france">France entière</option>
          {taxonomies.popularAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.label} ({area.availableCount})
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Contrat</span>
        <select name="contract" defaultValue={scope.contracts[0] ?? ""}>
          <option value="">Tous les contrats</option>
          {taxonomies.contracts.map((contract) => (
            <option key={contract.id} value={contract.id}>
              {contract.label} ({contract.availableCount})
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Télétravail</span>
        <select name="remote" defaultValue={scope.remote ?? ""}>
          <option value="">Toutes les modalités</option>
          {taxonomies.remoteModes.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label} ({mode.availableCount})
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Période</span>
        <select name="period" defaultValue={scope.period}>
          <option value="7d">7 derniers jours</option>
          <option value="30d">30 derniers jours</option>
          <option value="90d">90 derniers jours</option>
          <option value="current">Dataset actuel</option>
        </select>
      </label>
    </div>
  );
}

function FilterActions() {
  return (
    <div className="filter-actions">
      <Button asChild variant="ghost">
        <Link href="/">
          <RotateCcw data-icon="inline-start" /> Réinitialiser
        </Link>
      </Button>
      <Button type="submit">
        <Search data-icon="inline-start" /> Appliquer
      </Button>
    </div>
  );
}

export function FilterBar({ scope, taxonomies }: FilterBarProps) {
  const count = activeFilterCount(scope);

  return (
    <section className="filter-bar" aria-labelledby="filter-title">
      <div className="filter-bar__heading">
        <div>
          <p className="section-label">Affiner l’observation</p>
          <h2 id="filter-title">Filtres</h2>
        </div>
        <span className="filter-count">
          {count} actif{count > 1 ? "s" : ""}
        </span>
      </div>
      <form
        action="/"
        method="get"
        className="filter-form filter-form--desktop"
      >
        <FilterFields scope={scope} taxonomies={taxonomies} />
        <FilterActions />
      </form>
      <details className="filter-form--mobile">
        <summary>
          <Filter aria-hidden="true" /> Filtres · {count}
        </summary>
        <form action="/" method="get" className="filter-form">
          <FilterFields scope={scope} taxonomies={taxonomies} />
          <FilterActions />
        </form>
      </details>
    </section>
  );
}
