export const INGESTION_QUALITY_VERSION = "ingestion-quality-1.0.0";

export type IngestionQualityDecision = "publish" | "publish_partial" | "block";

export type IngestionQualityReason =
  | "pagination_incomplete"
  | "source_cap_reached"
  | "positive_classification_missing_evidence"
  | "volume_anomaly_detected"
  | "validation_rate_unavailable"
  | "validation_rate_below_minimum"
  | "validation_rate_below_publish_threshold";

export type CompleteIngestionQualityInput = Readonly<{
  paginationComplete: boolean;
  sourceCapReached: boolean;
  offersReceived: number;
  offersValid: number;
  offersQuarantined: number;
  positiveClassifications: number;
  positiveClassificationsWithEvidence: number;
  volumeAnomalyDetected: boolean;
}>;

export type CompleteIngestionQuality = Readonly<{
  qualityVersion: typeof INGESTION_QUALITY_VERSION;
  decision: IngestionQualityDecision;
  paginationComplete: boolean;
  validationRate: number | null;
  evidenceCoverage: number | null;
  closureEligible: boolean;
  reasons: readonly IngestionQualityReason[];
}>;

const PUBLISH_VALIDATION_RATE = 0.98;
const PARTIAL_VALIDATION_RATE = 0.95;

function assertCount(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} doit être un entier positif ou nul.`);
  }
}

function assertInput(input: CompleteIngestionQualityInput): void {
  assertCount("offersReceived", input.offersReceived);
  assertCount("offersValid", input.offersValid);
  assertCount("offersQuarantined", input.offersQuarantined);
  assertCount("positiveClassifications", input.positiveClassifications);
  assertCount(
    "positiveClassificationsWithEvidence",
    input.positiveClassificationsWithEvidence,
  );

  if (input.offersValid + input.offersQuarantined !== input.offersReceived) {
    throw new RangeError(
      "offersValid et offersQuarantined doivent totaliser offersReceived.",
    );
  }
  if (
    input.positiveClassificationsWithEvidence > input.positiveClassifications
  ) {
    throw new RangeError(
      "positiveClassificationsWithEvidence ne peut pas dépasser positiveClassifications.",
    );
  }
}

/**
 * Décide si un run complet peut former un dataset. Les signaux reçus sont déjà
 * agrégés par l'infrastructure : ce module ne lit ni base, ni source externe.
 */
export function evaluateCompleteIngestionQuality(
  input: CompleteIngestionQualityInput,
): CompleteIngestionQuality {
  assertInput(input);

  const validationRate =
    input.offersReceived === 0
      ? null
      : input.offersValid / input.offersReceived;
  const evidenceCoverage =
    input.positiveClassifications === 0
      ? null
      : input.positiveClassificationsWithEvidence /
        input.positiveClassifications;
  const reasons: IngestionQualityReason[] = [];

  if (!input.paginationComplete) {
    reasons.push("pagination_incomplete");
  }
  if (input.sourceCapReached) {
    reasons.push("source_cap_reached");
  }
  if (
    input.positiveClassificationsWithEvidence < input.positiveClassifications
  ) {
    reasons.push("positive_classification_missing_evidence");
  }
  if (input.volumeAnomalyDetected) {
    reasons.push("volume_anomaly_detected");
  }
  if (validationRate === null) {
    reasons.push("validation_rate_unavailable");
  } else if (validationRate < PARTIAL_VALIDATION_RATE) {
    reasons.push("validation_rate_below_minimum");
  } else if (validationRate < PUBLISH_VALIDATION_RATE) {
    reasons.push("validation_rate_below_publish_threshold");
  }

  const hasIntegrityBlocker = reasons.some(
    (reason) =>
      reason === "pagination_incomplete" ||
      reason === "source_cap_reached" ||
      reason === "positive_classification_missing_evidence" ||
      reason === "volume_anomaly_detected" ||
      reason === "validation_rate_unavailable" ||
      reason === "validation_rate_below_minimum",
  );
  const decision: IngestionQualityDecision = hasIntegrityBlocker
    ? "block"
    : validationRate !== null && validationRate >= PUBLISH_VALIDATION_RATE
      ? "publish"
      : "publish_partial";

  return {
    qualityVersion: INGESTION_QUALITY_VERSION,
    decision,
    paginationComplete: input.paginationComplete,
    validationRate,
    evidenceCoverage,
    closureEligible: decision === "publish",
    reasons,
  };
}
