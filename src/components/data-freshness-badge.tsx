import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";

import { formatLongDate } from "@/lib/format";

type DataFreshnessBadgeProps = {
  freshness: "fresh" | "delayed" | "stale" | "partial" | "incident";
  dataAsOf: string | null;
};

const labels = {
  fresh: "Données à jour",
  delayed: "Mise à jour retardée",
  stale: "Données anciennes",
  partial: "Données partielles",
  incident: "Incident en cours",
} as const;

export function DataFreshnessBadge({
  freshness,
  dataAsOf,
}: DataFreshnessBadgeProps) {
  const Icon =
    freshness === "fresh"
      ? CheckCircle2
      : freshness === "delayed" || freshness === "stale"
        ? Clock3
        : AlertTriangle;
  const detail = dataAsOf ? ` · ${formatLongDate(dataAsOf)}` : "";

  return (
    <span className="freshness-badge" data-freshness={freshness}>
      <Icon aria-hidden="true" />
      <span>
        {labels[freshness]}
        <span className="freshness-badge__date">{detail}</span>
      </span>
    </span>
  );
}
