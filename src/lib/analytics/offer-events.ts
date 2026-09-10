import type { PublicOffer } from "@/application/queries/contracts";

import type { AnalyticsClassificationLabel, AnalyticsEvent } from "./client";

type EvidenceKind = Extract<
  AnalyticsEvent,
  { name: "evidence_expanded" }
>["properties"]["evidence_kind"];

export function analyticsClassificationLabel(
  offer: PublicOffer,
): AnalyticsClassificationLabel {
  const classification = offer.classification;
  if (classification.juniorObservation?.contradictory === true)
    return "contradictory";
  if (classification.status === "ambiguous") return "ambiguous";
  if (classification.status === "unclassified") return "unknown";
  if (classification.contradictoryJunior === true) return "contradictory";
  if (classification.beginnerFriendly === true) return "beginner_friendly";
  if (
    classification.claimsJunior === true &&
    (classification.beginnerFriendly === null ||
      classification.contradictoryJunior === null)
  ) {
    return "junior_unresolved";
  }
  return classification.claimsJunior ? "other_junior" : "not_explicitly_junior";
}

export function analyticsRankBucket(
  rank: number,
): Extract<
  AnalyticsEvent,
  { name: "offer_opened" }
>["properties"]["rank_bucket"] {
  if (rank <= 5) return "1-5";
  if (rank <= 10) return "6-10";
  if (rank <= 25) return "11-25";
  return "26+";
}

export function primaryAnalyticsEvidenceKind(
  offer: PublicOffer,
): EvidenceKind | null {
  for (const evidence of offer.evidence) {
    if (
      evidence.kind === "junior_claim" ||
      evidence.kind === "required_experience" ||
      evidence.kind === "desired_experience" ||
      evidence.kind === "exclusion" ||
      evidence.kind === "ambiguity"
    ) {
      return evidence.kind;
    }
    if (evidence.kind === "conflict") return "ambiguity";
  }
  return null;
}
