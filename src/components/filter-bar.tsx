import {
  BriefcaseBusiness,
  FileText,
  Filter,
  MapPin,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import Link from "next/link";

import type {
  OverviewQuery,
  TaxonomiesResponse,
} from "@/application/queries/contracts";
import type { AnalyticsContext } from "@/lib/analytics/client";
import { cn } from "@/lib/utils";

import { TrackedFilterForm } from "./analytics/tracked-filter-form";
import { Button } from "./ui/button";

type FilterBarProps = {
  scope: OverviewQuery;
  taxonomies: TaxonomiesResponse["data"];
  analyticsContext: AnalyticsContext;
  presentation?: "default" | "pilot";
};

function initialFilterValues(scope: OverviewQuery): Record<string, string> {
  return {
    job: scope.job ?? "",
    tech: scope.technologies[0] ?? "",
    area: scope.area,
    contract: scope.contracts[0] ?? "",
    remote: scope.remote ?? "",
    period: scope.period,
  };
}

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

function FilterFields({
  scope,
  taxonomies,
  group = "all",
}: Pick<FilterBarProps, "scope" | "taxonomies"> & {
  group?: "all" | "primary" | "secondary";
}) {
  return (
    <div
      className={cn(
        "filter-fields",
        group === "primary" && "pilot-filter-primary",
      )}
    >
      {group !== "secondary" ? (
        <label>
          {group === "primary" ? (
            <BriefcaseBusiness aria-hidden="true" />
          ) : null}
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
      ) : null}
      {group !== "primary" ? (
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
      ) : null}
      {group !== "secondary" ? (
        <label>
          {group === "primary" ? <MapPin aria-hidden="true" /> : null}
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
      ) : null}
      {group !== "secondary" ? (
        <label>
          {group === "primary" ? <FileText aria-hidden="true" /> : null}
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
      ) : null}
      {group !== "primary" ? (
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
      ) : null}
      {group !== "primary" ? (
        <label>
          <span>Période</span>
          <select name="period" defaultValue={scope.period}>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
            <option value="current">Dataset actuel</option>
          </select>
        </label>
      ) : null}
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

export function FilterBar({
  scope,
  taxonomies,
  analyticsContext,
  presentation = "default",
}: FilterBarProps) {
  const count = activeFilterCount(scope);
  const initialValues = initialFilterValues(scope);

  return (
    <section className="filter-bar" aria-labelledby="filter-title">
      <div
        className={cn(
          "filter-bar__heading",
          presentation === "pilot" && "sr-only",
        )}
      >
        <div>
          <p className="section-label">Affiner l’observation</p>
          <h2 id="filter-title">Filtres</h2>
        </div>
        <span className="filter-count">
          {count} actif{count > 1 ? "s" : ""}
        </span>
      </div>
      <TrackedFilterForm
        action="/"
        method="get"
        className="filter-form filter-form--desktop"
        analyticsContext={analyticsContext}
        initialValues={initialValues}
      >
        {presentation === "pilot" ? (
          <>
            <FilterFields
              scope={scope}
              taxonomies={taxonomies}
              group="primary"
            />
            <details className="pilot-filter-more" suppressHydrationWarning>
              <summary>
                <Plus aria-hidden="true" /> Plus de filtres{" "}
                <span>
                  · {count} actif{count > 1 ? "s" : ""}
                </span>
              </summary>
              <FilterFields
                scope={scope}
                taxonomies={taxonomies}
                group="secondary"
              />
            </details>
          </>
        ) : (
          <FilterFields scope={scope} taxonomies={taxonomies} />
        )}
        <FilterActions />
      </TrackedFilterForm>
      <details className="filter-form--mobile">
        <summary>
          <Filter aria-hidden="true" /> Filtres · {count}
        </summary>
        <TrackedFilterForm
          action="/"
          method="get"
          className="filter-form"
          analyticsContext={analyticsContext}
          initialValues={initialValues}
        >
          <FilterFields scope={scope} taxonomies={taxonomies} />
          <FilterActions />
        </TrackedFilterForm>
      </details>
    </section>
  );
}
