import { describe, expect, it } from "vitest";

import {
  INGESTION_QUALITY_VERSION,
  evaluateCompleteIngestionQuality,
  type CompleteIngestionQualityInput,
} from "./quality";

function qualityInput(
  overrides: Partial<CompleteIngestionQualityInput> = {},
): CompleteIngestionQualityInput {
  return {
    paginationComplete: true,
    sourceCapReached: false,
    offersReceived: 100,
    offersValid: 100,
    offersQuarantined: 0,
    positiveClassifications: 10,
    positiveClassificationsWithEvidence: 10,
    volumeAnomalyDetected: false,
    ...overrides,
  };
}

describe("evaluateCompleteIngestionQuality", () => {
  it("publishes a complete run at the 98% validation threshold", () => {
    const result = evaluateCompleteIngestionQuality(
      qualityInput({ offersValid: 98, offersQuarantined: 2 }),
    );

    expect(result).toEqual({
      qualityVersion: INGESTION_QUALITY_VERSION,
      decision: "publish",
      paginationComplete: true,
      validationRate: 0.98,
      evidenceCoverage: 1,
      closureEligible: true,
      reasons: [],
    });
  });

  it("publishes a partial dataset from 95% inclusive to 98% exclusive", () => {
    const result = evaluateCompleteIngestionQuality(
      qualityInput({ offersValid: 95, offersQuarantined: 5 }),
    );

    expect(result).toMatchObject({
      decision: "publish_partial",
      validationRate: 0.95,
      closureEligible: false,
      reasons: ["validation_rate_below_publish_threshold"],
    });
  });

  it("blocks below the minimum validation threshold", () => {
    const result = evaluateCompleteIngestionQuality(
      qualityInput({ offersValid: 94, offersQuarantined: 6 }),
    );

    expect(result).toMatchObject({
      decision: "block",
      closureEligible: false,
      reasons: ["validation_rate_below_minimum"],
    });
  });

  it.each([
    [
      "incomplete pagination",
      { paginationComplete: false },
      "pagination_incomplete",
    ],
    ["source cap", { sourceCapReached: true }, "source_cap_reached"],
    [
      "missing classification evidence",
      { positiveClassificationsWithEvidence: 9 },
      "positive_classification_missing_evidence",
    ],
    [
      "volume anomaly",
      { volumeAnomalyDetected: true },
      "volume_anomaly_detected",
    ],
  ] as const)(
    "blocks for %s despite a publishable validation rate",
    (_, overrides, reason) => {
      const result = evaluateCompleteIngestionQuality(qualityInput(overrides));

      expect(result.decision).toBe("block");
      expect(result.closureEligible).toBe(false);
      expect(result.reasons).toContain(reason);
    },
  );

  it("keeps deterministic reason ordering when multiple controls fail", () => {
    const result = evaluateCompleteIngestionQuality(
      qualityInput({
        paginationComplete: false,
        sourceCapReached: true,
        positiveClassificationsWithEvidence: 0,
        volumeAnomalyDetected: true,
        offersValid: 94,
        offersQuarantined: 6,
      }),
    );

    expect(result.reasons).toEqual([
      "pagination_incomplete",
      "source_cap_reached",
      "positive_classification_missing_evidence",
      "volume_anomaly_detected",
      "validation_rate_below_minimum",
    ]);
  });

  it("blocks an empty run because its validation rate cannot be established", () => {
    const result = evaluateCompleteIngestionQuality(
      qualityInput({
        offersReceived: 0,
        offersValid: 0,
        offersQuarantined: 0,
        positiveClassifications: 0,
        positiveClassificationsWithEvidence: 0,
      }),
    );

    expect(result).toMatchObject({
      decision: "block",
      validationRate: null,
      evidenceCoverage: null,
      closureEligible: false,
      reasons: ["validation_rate_unavailable"],
    });
  });

  it("does not invent evidence coverage when no positive classification exists", () => {
    const result = evaluateCompleteIngestionQuality(
      qualityInput({
        positiveClassifications: 0,
        positiveClassificationsWithEvidence: 0,
      }),
    );

    expect(result.evidenceCoverage).toBeNull();
    expect(result.decision).toBe("publish");
  });

  it.each([
    qualityInput({ offersReceived: -1, offersValid: -1 }),
    qualityInput({ offersReceived: 10, offersValid: 9, offersQuarantined: 0 }),
    qualityInput({ positiveClassificationsWithEvidence: 11 }),
  ])("rejects inconsistent counters", (input) => {
    expect(() => evaluateCompleteIngestionQuality(input)).toThrow(RangeError);
  });
});
