import type { JuniorObservation } from "@/domain/classification/junior-observation";
import { rateFromCounts } from "./rate";

export const JUNIOR_OBSERVATION_METRIC_VERSION = "junior-contradiction-2.0.0";

export function computeJuniorObservationMetric(
  observations: readonly Pick<
    JuniorObservation,
    "claimsJunior" | "status" | "contradictory"
  >[],
) {
  const population = observations.filter(
    ({ claimsJunior }) => claimsJunior === true,
  );
  const resolved = population.filter(
    ({ status, contradictory }) =>
      status === "resolved" && contradictory !== null,
  );
  const ambiguousCount = population.filter(
    ({ status }) => status === "ambiguous",
  ).length;
  return rateFromCounts({
    metric: "junior_contradiction_rate",
    metricVersion: JUNIOR_OBSERVATION_METRIC_VERSION,
    numerator: resolved.filter(({ contradictory }) => contradictory === true)
      .length,
    denominator: resolved.length,
    ambiguousCount,
    unknownCount: population.length - resolved.length - ambiguousCount,
  });
}
