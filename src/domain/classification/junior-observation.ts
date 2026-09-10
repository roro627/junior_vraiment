import type { ClassificationResult, Evidence } from "./types";

export const JUNIOR_OBSERVATION_VERSION = "junior-observation-2.0.0";

export type JuniorObservation = {
  version: typeof JUNIOR_OBSERVATION_VERSION;
  claimsJunior: boolean | null;
  status: "resolved" | "unknown" | "ambiguous";
  contradictory: boolean | null;
  evidence: Evidence[];
};

const coherenceConflicts = new Set([
  "BEGINNER_EXPERIENCE_CONFLICT",
  "STRUCTURED_EXPERIENCE_CONFLICT",
  "STRUCTURED_DURATION_CONFLICT",
]);

// Candidate axis: deliberately not wired into ingestion until v2 validation.
export function resolveJuniorObservation(
  classification: Pick<
    ClassificationResult,
    | "claimsJunior"
    | "status"
    | "minimumExperienceMonths"
    | "evidence"
    | "warnings"
  >,
): JuniorObservation {
  const junior = classification.evidence.filter(
    ({ kind }) => kind === "junior_claim",
  );
  const required = classification.evidence.filter(
    ({ kind }) => kind === "required_experience",
  );
  const result = (
    status: JuniorObservation["status"],
    contradictory: boolean | null,
  ): JuniorObservation => ({
    version: JUNIOR_OBSERVATION_VERSION,
    claimsJunior: classification.claimsJunior,
    status,
    contradictory,
    evidence: classification.evidence.filter(({ kind }) =>
      [
        "junior_claim",
        "required_experience",
        "conflict",
        "ambiguity",
        "exclusion",
      ].includes(kind),
    ),
  });
  const blocking = classification.warnings.filter(
    ({ severity }) => severity === "blocking",
  );
  if (
    blocking.some(({ code }) => !coherenceConflicts.has(code)) ||
    (classification.status === "ambiguous" && blocking.length === 0)
  ) {
    return result("ambiguous", null);
  }
  if (classification.claimsJunior !== true || junior.length === 0) {
    return result("unknown", null);
  }
  const durations = required.map(({ normalizedValue }) =>
    normalizedValue !== undefined && /^\d+$/u.test(normalizedValue)
      ? Number(normalizedValue)
      : NaN,
  );
  if (durations.some((months) => !Number.isSafeInteger(months))) {
    return result("ambiguous", null);
  }
  if (
    blocking.some(({ code }) => code === "STRUCTURED_DURATION_CONFLICT") &&
    durations.some((months) => months < 24) &&
    durations.some((months) => months >= 24)
  ) {
    return result("ambiguous", null);
  }
  if (durations.length > 0) {
    return result(
      "resolved",
      durations.some((months) => months >= 24),
    );
  }
  const acceptsBeginners = junior.some(
    ({ ruleId }) =>
      ruleId === "BEGINNER_ACCEPTED_BODY" ||
      ruleId === "BEGINNER_ACCEPTED_STRUCTURED",
  );
  if (blocking.length === 0 && acceptsBeginners) {
    return result("resolved", false);
  }
  return result(blocking.length > 0 ? "ambiguous" : "unknown", null);
}
