import type { ClassificationStatus } from "@/domain/classification/types";

import { rateFromCounts, type RateSampleQuality } from "./rate";

export const BEGINNER_FRIENDLY_METRIC_VERSION = "beginner-friendly-1.0.0";

export type BeginnerFriendlyMetric = {
  metric: "beginner_friendly_rate";
  metricVersion: typeof BEGINNER_FRIENDLY_METRIC_VERSION;
  value: number | null;
  numerator: number;
  denominator: number;
  populationCount: number;
  unknownCount: number;
  ambiguousCount: number;
  coverage: number | null;
  sampleQuality: RateSampleQuality;
};

type BeginnerFriendlyInput = {
  status: ClassificationStatus;
  beginnerFriendly: boolean | null;
};

export function computeBeginnerFriendlyMetric(
  classifications: readonly BeginnerFriendlyInput[],
): BeginnerFriendlyMetric {
  const resolvable = classifications.filter(
    ({ status, beginnerFriendly }) =>
      status === "classified" && beginnerFriendly !== null,
  );
  const numerator = resolvable.filter(
    ({ beginnerFriendly }) => beginnerFriendly === true,
  ).length;
  const denominator = resolvable.length;
  const ambiguousCount = classifications.filter(
    ({ status }) => status === "ambiguous",
  ).length;
  const unknownCount = classifications.filter(
    ({ status, beginnerFriendly }) =>
      status !== "ambiguous" && beginnerFriendly === null,
  ).length;
  return rateFromCounts({
    metric: "beginner_friendly_rate",
    metricVersion: BEGINNER_FRIENDLY_METRIC_VERSION,
    numerator,
    denominator,
    unknownCount,
    ambiguousCount,
  });
}
