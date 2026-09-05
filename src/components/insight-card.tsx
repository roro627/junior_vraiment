import type { PublicInsight } from "@/db/queries/public-insights";
import { formatInteger, formatLongDate, formatRate } from "@/lib/format";

export function InsightCard({ insight }: { insight: PublicInsight }) {
  return (
    <article className="insight-card">
      <p className="section-label">Insight · France</p>
      <p className="insight-card__value">
        {formatRate(insight.metric.value) ?? "Pas assez de données"}
      </p>
      <h2>
        <a href={`/insights/${insight.slug}`}>{insight.title}</a>
      </h2>
      <p>{insight.summary}</p>
      <footer>
        <span>
          {formatInteger(insight.metric.numerator)} sur{" "}
          {formatInteger(insight.metric.denominator)}
        </span>
        <span>{formatLongDate(`${insight.periodEnd}T12:00:00.000Z`)}</span>
      </footer>
    </article>
  );
}
