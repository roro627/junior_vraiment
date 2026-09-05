import type { ReactNode } from "react";

import { formatInteger, formatRate } from "@/lib/format";

type MetricCardProps = {
  title: string;
  value: number | null;
  numerator: number;
  denominator: number;
  detail: string;
  action?: ReactNode;
};

export function MetricCard({
  title,
  value,
  numerator,
  denominator,
  detail,
  action,
}: MetricCardProps) {
  return (
    <article className="metric-card">
      <p className="metric-card__title">{title}</p>
      <p className="metric-card__value">
        {formatRate(value) ?? "Pas assez de données"}
      </p>
      <p className="metric-card__detail">
        {formatInteger(numerator)} sur {formatInteger(denominator)} {detail}
      </p>
      {action ? <div className="metric-card__action">{action}</div> : null}
    </article>
  );
}
