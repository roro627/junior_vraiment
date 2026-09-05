export type RateSampleQuality = "normal" | "caution" | "insufficient";

export const METHODOLOGY_VERSION = "methodology-1.0.0";

export function rateSampleQuality(denominator: number): RateSampleQuality {
  return denominator < 20
    ? "insufficient"
    : denominator < 50
      ? "caution"
      : "normal";
}

export function publishableRate(
  numerator: number,
  denominator: number,
  sampleQuality: RateSampleQuality,
): number | null {
  return sampleQuality === "insufficient" ? null : numerator / denominator;
}

export function rateFromCounts<
  TMetric extends string,
  TMetricVersion extends string,
  TUnknownCount extends number,
  TAmbiguousCount extends number,
>(input: {
  metric: TMetric;
  metricVersion: TMetricVersion;
  numerator: number;
  denominator: number;
  unknownCount: TUnknownCount;
  ambiguousCount: TAmbiguousCount;
}) {
  if (input.numerator > input.denominator) {
    throw new Error("A metric numerator cannot exceed its denominator");
  }
  const populationCount =
    input.denominator + input.unknownCount + input.ambiguousCount;
  const sampleQuality = rateSampleQuality(input.denominator);

  return {
    ...input,
    value: publishableRate(input.numerator, input.denominator, sampleQuality),
    populationCount,
    coverage:
      populationCount === 0 ? null : input.denominator / populationCount,
    sampleQuality,
  };
}
