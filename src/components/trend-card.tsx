import type { TrendsResponse } from "@/application/queries/contracts";
import { formatLongDate, formatRate } from "@/lib/format";

type TrendCardProps = {
  points: TrendsResponse["data"]["points"];
};

function pointPositions(points: TrendCardProps["points"]) {
  const values = points
    .map(({ value }) => value)
    .filter((value): value is number => value !== null);
  if (values.length < 2) return [];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;

  return points.flatMap(({ value }, index) =>
    value === null
      ? []
      : [
          {
            x: (index / Math.max(1, points.length - 1)) * 100,
            y: 92 - ((value - minimum) / range) * 76,
          },
        ],
  );
}

export function TrendCard({ points }: TrendCardProps) {
  const positions = pointPositions(points);
  const path = positions
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x},${y}`)
    .join(" ");

  return (
    <section className="trend-card" aria-labelledby="trend-title">
      <header>
        <div>
          <p className="section-label">Tendance</p>
          <h2 id="trend-title">Évolution du taux</h2>
        </div>
        <a href="/api/v1/trends?metric=junior_contradiction_rate&period=current">
          Voir les données
        </a>
      </header>
      {positions.length < 2 ? (
        <div className="trend-card__empty">
          <strong>Historique en constitution</strong>
          <span>
            Deux journées publiées sont nécessaires pour tracer une évolution.
          </span>
        </div>
      ) : (
        <>
          <svg
            className="trend-chart"
            viewBox="0 0 100 100"
            role="img"
            aria-labelledby="trend-chart-title trend-chart-description"
            preserveAspectRatio="none"
          >
            <title id="trend-chart-title">
              Évolution du taux de contradiction
            </title>
            <desc id="trend-chart-description">
              Série de {positions.length} valeurs. Le détail textuel suit le
              graphique.
            </desc>
            <path d={path} pathLength="1" />
            {positions.map(({ x, y }, index) => (
              <circle
                key={`${x}-${y}`}
                cx={x}
                cy={y}
                r="1.6"
                data-index={index}
              />
            ))}
          </svg>
          <details className="trend-card__values">
            <summary>Lire les valeurs</summary>
            <ol>
              {points.map((point) => (
                <li key={point.datasetVersion}>
                  <time dateTime={point.date}>
                    {formatLongDate(`${point.date}T12:00:00.000Z`)}
                  </time>
                  <span>{formatRate(point.value) ?? "Non publiable"}</span>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </section>
  );
}
