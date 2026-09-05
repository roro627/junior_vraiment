import { describe, expect, it } from "vitest";

import {
  CLASSIFIER_VERSION,
  type ClassificationResult,
} from "@/domain/classification/types";

import { computeJuniorContradictionMetric } from "./junior-contradiction";

function classification(
  values: Partial<ClassificationResult>,
): ClassificationResult {
  return {
    classifierVersion: CLASSIFIER_VERSION,
    status: "classified",
    claimsJunior: true,
    minimumExperienceMonths: 0,
    beginnerFriendly: true,
    contradictoryJunior: false,
    salaryTransparent: false,
    remoteMode: "unknown",
    technologySlugs: [],
    evidence: [],
    ruleIds: [],
    warnings: [],
    ...values,
  };
}

describe("computeJuniorContradictionMetric", () => {
  it("keeps unresolved and ambiguous junior offers outside the denominator", () => {
    const metric = computeJuniorContradictionMetric([
      classification({
        minimumExperienceMonths: 24,
        contradictoryJunior: true,
      }),
      classification({ minimumExperienceMonths: 12 }),
      classification({
        minimumExperienceMonths: null,
        beginnerFriendly: null,
        contradictoryJunior: null,
      }),
      classification({
        status: "ambiguous",
        minimumExperienceMonths: 36,
        beginnerFriendly: null,
        contradictoryJunior: null,
      }),
      classification({ claimsJunior: false }),
    ]);

    expect(metric).toMatchObject({
      value: null,
      numerator: 1,
      denominator: 2,
      populationCount: 4,
      unknownCount: 1,
      ambiguousCount: 1,
      coverage: 0.5,
      sampleQuality: "insufficient",
    });
  });

  it("publishes a caution value from 20 resolved offers", () => {
    const metric = computeJuniorContradictionMetric([
      ...Array.from({ length: 8 }, () =>
        classification({
          minimumExperienceMonths: 24,
          contradictoryJunior: true,
        }),
      ),
      ...Array.from({ length: 12 }, () => classification({})),
    ]);

    expect(metric.value).toBe(0.4);
    expect(metric.sampleQuality).toBe("caution");
  });

  it("returns no fake zero for an empty population", () => {
    expect(computeJuniorContradictionMetric([])).toMatchObject({
      value: null,
      denominator: 0,
      populationCount: 0,
      coverage: null,
      sampleQuality: "insufficient",
    });
  });
});
