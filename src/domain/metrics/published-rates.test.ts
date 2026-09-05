import { describe, expect, it } from "vitest";

import {
  CLASSIFIER_VERSION,
  type ClassificationResult,
} from "@/domain/classification/types";

import { computeBeginnerFriendlyMetric } from "./beginner-friendly";
import { computeSalaryTransparencyMetric } from "./salary-transparency";

function classification(
  values: Partial<ClassificationResult>,
): ClassificationResult {
  return {
    classifierVersion: CLASSIFIER_VERSION,
    status: "classified",
    claimsJunior: null,
    minimumExperienceMonths: null,
    beginnerFriendly: null,
    contradictoryJunior: null,
    salaryTransparent: false,
    remoteMode: "unknown",
    technologySlugs: [],
    evidence: [],
    ruleIds: [],
    warnings: [],
    ...values,
  };
}

describe("published rates", () => {
  it("keeps unresolved and ambiguous accessibility outside the denominator", () => {
    const rows = [
      ...Array.from({ length: 20 }, () =>
        classification({ beginnerFriendly: true }),
      ),
      ...Array.from({ length: 10 }, () =>
        classification({ beginnerFriendly: false }),
      ),
      classification({ status: "unclassified" }),
      classification({ status: "ambiguous" }),
    ];

    expect(computeBeginnerFriendlyMetric(rows)).toEqual({
      metric: "beginner_friendly_rate",
      metricVersion: "beginner-friendly-1.0.0",
      value: 2 / 3,
      numerator: 20,
      denominator: 30,
      populationCount: 32,
      unknownCount: 1,
      ambiguousCount: 1,
      coverage: 30 / 32,
      sampleQuality: "caution",
    });
  });

  it("treats a complete processed offer without salary as a resolved false", () => {
    const rows = Array.from({ length: 50 }, (_, index) =>
      classification({ salaryTransparent: index < 10 }),
    );

    expect(computeSalaryTransparencyMetric(rows)).toEqual({
      metric: "salary_transparency_rate",
      metricVersion: "salary-transparency-1.0.0",
      value: 0.2,
      numerator: 10,
      denominator: 50,
      populationCount: 50,
      unknownCount: 0,
      ambiguousCount: 0,
      coverage: 1,
      sampleQuality: "normal",
    });
  });

  it("publishes null instead of a false zero below the sample threshold", () => {
    const rows = Array.from({ length: 19 }, () =>
      classification({ salaryTransparent: false }),
    );

    expect(computeSalaryTransparencyMetric(rows)).toMatchObject({
      value: null,
      denominator: 19,
      sampleQuality: "insufficient",
    });
  });
});
