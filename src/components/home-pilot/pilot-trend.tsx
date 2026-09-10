import type { TrendsResponse } from "@/application/queries/contracts";
import { formatInteger, formatLongDate, formatRate } from "@/lib/format";

type TrendPoint = TrendsResponse["data"]["points"][number];
type PilotTrendProps = { points: readonly TrendPoint[]; dataHref: string };

const dayInMilliseconds = 86_400_000;
const plot = { left: 8, right: 552, top: 8, bottom: 144 };
const qualityLabels: Record<TrendPoint["quality"], string> = {
  normal: "normale",
  limited: "limitée",
  partial: "partielle",
  stale: "ancienne",
  insufficient: "insuffisante",
  unavailable: "indisponible",
};
const shortDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});
function dateValue(date: string): number {
  return Date.parse(`${date}T12:00:00.000Z`);
}

// Fixed 0–100% scale and calendar spacing: a short history must not exaggerate movement.
function plotPoints(points: readonly TrendPoint[]) {
  const firstDate = points[0] ? dateValue(points[0].date) : 0;
  const last = points.at(-1);
  const lastDate = last ? dateValue(last.date) : firstDate;
  const timeRange = Math.max(dayInMilliseconds, lastDate - firstDate);
  return points.flatMap((point, index) => {
    if (point.value === null) return [];
    const previous = points[index - 1];
    return [
      {
        key: point.datasetVersion,
        x:
          plot.left +
          ((dateValue(point.date) - firstDate) / timeRange) *
            (plot.right - plot.left),
        y: plot.bottom - point.value * (plot.bottom - plot.top),
        breakBefore:
          !previous ||
          previous.value === null ||
          point.annotation !== null ||
          previous.annotation?.kind === "partial_day" ||
          dateValue(point.date) - dateValue(previous.date) > dayInMilliseconds,
      },
    ];
  });
}

export function PilotTrend({ points, dataHref }: PilotTrendProps) {
  const positions = plotPoints(points);
  const first = points[0];
  const last = points.at(-1);
  const path = positions
    .map(({ x, y, breakBefore }) => `${breakBefore ? "M" : "L"}${x},${y}`)
    .join(" ");
  return (
    <section className="pilot-trend" aria-labelledby="pilot-trend-title">
      <header>
        <h3 id="pilot-trend-title">Évolution du décalage junior</h3>
        <a href={dataHref}>Données ouvertes ↗</a>
      </header>
      {points
        .filter(({ annotation }) => annotation !== null)
        .map((point) => (
          <p className="pilot-trend__annotation" key={point.datasetVersion}>
            <time dateTime={point.date}>
              {formatLongDate(`${point.date}T12:00:00.000Z`)}
            </time>{" "}
            : {point.annotation?.label}
          </p>
        ))}
      {positions.length < 2 ? (
        <div className="pilot-trend__empty">
          <strong>Historique en constitution</strong>
          <p>
            Deux journées publiables sont nécessaires pour tracer une évolution.
            Aucun point n’est inventé entre les collectes.
          </p>
        </div>
      ) : (
        <div className="pilot-trend__plot">
          <div className="pilot-trend__scale" aria-hidden="true">
            <span>100 %</span>
            <span>50 %</span>
            <span>0 %</span>
          </div>
          <svg
            className="pilot-trend__chart"
            viewBox="0 0 560 160"
            role="img"
            aria-labelledby="pilot-trend-chart-title pilot-trend-chart-description"
          >
            <title id="pilot-trend-chart-title">
              Taux de contradiction au fil des collectes
            </title>
            <desc id="pilot-trend-chart-description">
              {positions.length} observations sur une échelle de 0 à 100 %. Les
              ruptures ne sont pas reliées. Les valeurs sont disponibles dans le
              tableau suivant.
            </desc>
            {[plot.top, (plot.top + plot.bottom) / 2, plot.bottom].map((y) => (
              <line key={y} x1={plot.left} y1={y} x2={plot.right} y2={y} />
            ))}
            <path d={path} />
            {positions.map(({ key, x, y }) => (
              <circle key={key} cx={x} cy={y} r="3.5" />
            ))}
          </svg>
          <div className="pilot-trend__dates">
            {first ? (
              <time dateTime={first.date}>
                {shortDate.format(dateValue(first.date))}
              </time>
            ) : null}
            {last ? (
              <time dateTime={last.date}>
                {shortDate.format(dateValue(last.date))}
              </time>
            ) : null}
          </div>
        </div>
      )}
      {points.length > 0 ? (
        <details
          className="pilot-trend__values"
          open={points.length <= 7}
          suppressHydrationWarning
        >
          <summary>
            Lire{" "}
            {points.length === 1
              ? "l’observation"
              : `les ${points.length} observations`}
          </summary>
          <div
            className="pilot-trend__table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Valeurs quotidiennes du taux de contradiction"
          >
            <table>
              <caption className="sr-only">
                Taux, numérateurs et dénominateurs des journées publiées
              </caption>
              <thead>
                <tr>
                  <th scope="col">Collecte</th>
                  <th scope="col">Taux</th>
                  <th scope="col">Offres</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.datasetVersion}>
                    <th scope="row">
                      <time dateTime={point.date}>
                        {shortDate.format(dateValue(point.date))}
                      </time>
                      {point.sampleQuality === "caution" ? (
                        <small>Échantillon faible</small>
                      ) : null}
                      {point.quality !== "normal" ? (
                        <small>Qualité : {qualityLabels[point.quality]}</small>
                      ) : null}
                    </th>
                    <td>{formatRate(point.value) ?? "Non publiable"}</td>
                    <td>
                      {formatInteger(point.numerator)} /{" "}
                      {formatInteger(point.denominator)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </section>
  );
}
