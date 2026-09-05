import { rateFromCounts, type RateSampleQuality } from "./rate";

export const SALARY_TRANSPARENCY_METRIC_VERSION = "salary-transparency-1.0.0";

export type SalaryTransparencyMetric = {
  metric: "salary_transparency_rate";
  metricVersion: typeof SALARY_TRANSPARENCY_METRIC_VERSION;
  value: number | null;
  numerator: number;
  denominator: number;
  populationCount: number;
  unknownCount: 0;
  ambiguousCount: 0;
  coverage: number | null;
  sampleQuality: RateSampleQuality;
};

type SalaryTransparencyInput = {
  salaryTransparent: boolean;
};

export function computeSalaryTransparencyMetric(
  classifications: readonly SalaryTransparencyInput[],
): SalaryTransparencyMetric {
  const denominator = classifications.length;
  const numerator = classifications.filter(
    ({ salaryTransparent }) => salaryTransparent,
  ).length;
  return rateFromCounts({
    metric: "salary_transparency_rate",
    metricVersion: SALARY_TRANSPARENCY_METRIC_VERSION,
    numerator,
    denominator,
    unknownCount: 0,
    ambiguousCount: 0,
  });
}
