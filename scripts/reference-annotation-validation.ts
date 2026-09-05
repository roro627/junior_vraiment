import type { ClassificationResult } from "../src/domain/classification/types";

type ReferenceAnnotationValues = {
  status: "classified" | "ambiguous" | "unclassified";
  claimsJunior: boolean | null;
  minimumExperienceMonths: number | null;
  beginnerFriendly: boolean | null;
  contradictoryJunior: boolean | null;
};

export type ClassificationEvidenceSummary = {
  total: number;
  juniorClaim: number;
  requiredExperience: number;
  beginnerAcceptance: number;
  requiredExperienceMonths: number[];
};

export function summarizeClassificationEvidence(
  classification: ClassificationResult,
): ClassificationEvidenceSummary {
  return {
    total: classification.evidence.length,
    juniorClaim: classification.evidence.filter(
      ({ kind }) => kind === "junior_claim",
    ).length,
    requiredExperience: classification.evidence.filter(
      ({ kind }) => kind === "required_experience",
    ).length,
    beginnerAcceptance: classification.evidence.filter(({ ruleId }) =>
      ["BEGINNER_ACCEPTED_BODY", "BEGINNER_ACCEPTED_STRUCTURED"].includes(
        ruleId,
      ),
    ).length,
    requiredExperienceMonths: [
      ...new Set(
        classification.evidence
          .filter(({ kind }) => kind === "required_experience")
          .map(({ normalizedValue }) => Number(normalizedValue))
          .filter(Number.isFinite),
      ),
    ].toSorted((left, right) => left - right),
  };
}

export function assertReferenceAnnotationSemantics(
  reviewId: string,
  annotation: ReferenceAnnotationValues,
): void {
  const problems: string[] = [];

  if (annotation.status === "unclassified") {
    if (
      annotation.claimsJunior !== null ||
      annotation.minimumExperienceMonths !== null ||
      annotation.beginnerFriendly !== null ||
      annotation.contradictoryJunior !== null
    ) {
      problems.push("unclassified exige quatre valeurs métier nulles");
    }
  } else if (annotation.status === "ambiguous") {
    if (annotation.beginnerFriendly !== null) {
      problems.push("ambiguous exige beginnerFriendly=null");
    }
    if (annotation.contradictoryJunior !== null) {
      problems.push("ambiguous exige contradictoryJunior=null");
    }
  } else {
    const expectedBeginnerFriendly =
      annotation.minimumExperienceMonths === null
        ? null
        : annotation.minimumExperienceMonths <= 12;
    const expectedContradictoryJunior =
      annotation.claimsJunior === null
        ? null
        : annotation.claimsJunior === false
          ? false
          : annotation.minimumExperienceMonths === null
            ? null
            : annotation.minimumExperienceMonths >= 24;

    if (annotation.beginnerFriendly !== expectedBeginnerFriendly) {
      problems.push(
        `beginnerFriendly=${String(annotation.beginnerFriendly)} au lieu de ${String(expectedBeginnerFriendly)}`,
      );
    }
    if (annotation.contradictoryJunior !== expectedContradictoryJunior) {
      problems.push(
        `contradictoryJunior=${String(annotation.contradictoryJunior)} au lieu de ${String(expectedContradictoryJunior)}`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Annotation LLM A incohérente pour ${reviewId} : ${problems.join("; ")}.`,
    );
  }
}
