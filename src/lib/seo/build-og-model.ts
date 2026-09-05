import type { PublicInsight } from "@/db/queries/public-insights";
import { formatInteger, formatLongDate, formatRate } from "@/lib/format";

export const INSIGHT_OG_SIZE = { width: 1200, height: 630 } as const;

export type InsightOgModel = {
  title: string;
  value: string;
  fraction: string;
  sample: string;
  period: string;
  territory: string;
  source: string;
  domain: string;
  method: string;
};

export function buildInsightOgModel(
  insight: PublicInsight,
  siteUrl: string,
): InsightOgModel {
  return {
    title: insight.title,
    value: formatRate(insight.metric.value) ?? "Pas assez de données",
    fraction: `${formatInteger(insight.metric.numerator)} sur ${formatInteger(insight.metric.denominator)}`,
    sample: `${formatInteger(insight.metric.populationCount)} offres observées`,
    period: formatLongDate(`${insight.periodEnd}T12:00:00.000Z`),
    territory: "France",
    source: `Données ${insight.sourceLabel}`,
    domain: new URL(siteUrl).hostname,
    method: insight.metric.metricVersion,
  };
}
