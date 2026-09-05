import type { ClassificationStatus } from "@/domain/classification/types";

import { rateFromCounts, type RateSampleQuality } from "./rate";

export type { RateSampleQuality } from "./rate";

export const JUNIOR_CONTRADICTION_METRIC_VERSION = "junior-contradiction-1.0.0";

export type JuniorContradictionMetric = {
  metric: "junior_contradiction_rate";
  metricVersion: typeof JUNIOR_CONTRADICTION_METRIC_VERSION;
  value: number | null;
  numerator: number;
  denominator: number;
  populationCount: number;
  unknownCount: number;
  ambiguousCount: number;
  coverage: number | null;
  sampleQuality: RateSampleQuality;
};

type JuniorContradictionInput = {
  status: ClassificationStatus;
  claimsJunior: boolean | null;
  minimumExperienceMonths: number | null;
};

export function computeJuniorContradictionMetric(
  classifications: readonly JuniorContradictionInput[],
): JuniorContradictionMetric {
  const juniorClassifications = classifications.filter(
    ({ claimsJunior }) => claimsJunior === true,
  );
  const resolvable = juniorClassifications.filter(
    ({ status, minimumExperienceMonths }) =>
      status === "classified" && minimumExperienceMonths !== null,
  );
  const numerator = resolvable.filter(
    ({ minimumExperienceMonths }) =>
      minimumExperienceMonths !== null && minimumExperienceMonths >= 24,
  ).length;
  const denominator = resolvable.length;
  const unknownCount = juniorClassifications.filter(
    ({ status, minimumExperienceMonths }) =>
      status === "classified" && minimumExperienceMonths === null,
  ).length;
  const ambiguousCount = juniorClassifications.filter(
    ({ status }) => status === "ambiguous",
  ).length;
  return rateFromCounts({
    metric: "junior_contradiction_rate",
    metricVersion: JUNIOR_CONTRADICTION_METRIC_VERSION,
    numerator,
    denominator,
    unknownCount,
    ambiguousCount,
  });
}
