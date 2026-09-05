import { ArrowRight, ShieldCheck } from "lucide-react";

import type { OverviewResponse } from "@/application/queries/contracts";
import { formatInteger, formatRate } from "@/lib/format";

import { Button } from "./ui/button";

type KpiHeroProps = {
  metric: OverviewResponse["data"]["headline"];
  period: OverviewResponse["data"]["scope"]["period"];
  explorerHref?: string;
};

const periodLabels = {
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
  "90d": "90 derniers jours",
  current: "dataset actuel",
} as const;

export function KpiHero({
  metric,
  period,
  explorerHref = "/explorer?classification=contradictory",
}: KpiHeroProps) {
  const value = formatRate(metric.value);
  const insufficient = value === null;

  return (
    <section className="kpi-hero" aria-labelledby="kpi-title">
      <div className="kpi-hero__main">
        <p className="section-label">Aujourd’hui en France</p>
        {insufficient ? (
          <h2 id="kpi-title" className="kpi-hero__unavailable">
            Pas assez de données
          </h2>
        ) : (
          <h2 id="kpi-title" className="kpi-hero__value">
            {value}
          </h2>
        )}
        <p className="kpi-hero__statement">
          {insufficient
            ? "Élargissez le territoire ou retirez une technologie pour calculer un taux fiable."
            : "des offres se présentant comme « junior » demandent au moins 2 ans d’expérience."}
        </p>
        <p className="kpi-hero__fraction">
          {formatInteger(metric.numerator)} offre
          {metric.numerator > 1 ? "s" : ""} sur{" "}
          {formatInteger(metric.denominator)} classable
          {metric.denominator > 1 ? "s" : ""}.
        </p>
        <div className="kpi-hero__actions">
          <Button asChild>
            <a href={explorerHref}>
              Voir les offres <ArrowRight data-icon="inline-end" />
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/methodologie#kpi-principal">
              <ShieldCheck data-icon="inline-start" /> Comprendre le calcul
            </a>
          </Button>
        </div>
      </div>
      <dl className="kpi-hero__context">
        <div>
          <dt>Période</dt>
          <dd>{periodLabels[period]}</dd>
        </div>
        <div>
          <dt>Couverture de classification</dt>
          <dd>{formatRate(metric.coverage) ?? "Non calculable"}</dd>
        </div>
        <div>
          <dt>Méthode</dt>
          <dd>{metric.metricVersion}</dd>
        </div>
      </dl>
    </section>
  );
}
