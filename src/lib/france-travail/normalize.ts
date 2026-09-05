import type {
  ContractKind,
  NormalizedOffer,
  NormalizedSalary,
} from "@/domain/offers/normalized-offer";

import type { FranceTravailOffer } from "./schemas";

function trimmedOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function decodeEntity(entity: string): string {
  const namedEntities: Readonly<Record<string, string>> = {
    "&amp;": "&",
    "&apos;": "'",
    "&gt;": ">",
    "&lt;": "<",
    "&nbsp;": " ",
    "&quot;": '"',
  };

  const named = namedEntities[entity];
  if (named !== undefined) {
    return named;
  }

  const numericValue = entity.startsWith("&#x")
    ? Number.parseInt(entity.slice(3, -1), 16)
    : Number.parseInt(entity.slice(2, -1), 10);

  return Number.isFinite(numericValue)
    ? String.fromCodePoint(numericValue)
    : entity;
}

export function externalContentToPlainText(value: string): string {
  return value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/giu, "")
    .replace(/<(br|\/p|\/li|\/div|\/h[1-6])\s*\/?>/giu, "\n")
    .replace(/<[^>]*>/gu, "")
    .replace(/&(amp|apos|gt|lt|nbsp|quot|#\d+|#x[\da-f]+);/giu, decodeEntity)
    .replace(/\r\n?/gu, "\n")
    .replace(/[\t ]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function normalizeContract(offer: FranceTravailOffer): ContractKind {
  if (offer.alternance === true) {
    return "alternance";
  }

  switch (offer.typeContrat) {
    case "CDI":
      return "cdi";
    case "CDD":
      return "cdd";
    case "MIS":
      return "interim";
    case "SAI":
      return "other";
    default:
      return "unknown";
  }
}

function normalizeStructuredExperience(
  code: string | undefined,
): boolean | null {
  switch (code) {
    case "E":
      return true;
    case "D":
    case "S":
      return false;
    default:
      return null;
  }
}

function normalizeSalary(offer: FranceTravailOffer): NormalizedSalary | null {
  if (!offer.salaire) {
    return null;
  }

  const originalLabel = [
    offer.salaire.libelle,
    offer.salaire.commentaire,
    offer.salaire.complement1,
    offer.salaire.complement2,
  ]
    .map(trimmedOrNull)
    .filter((value): value is string => value !== null)
    .join(" · ");

  if (!originalLabel) {
    return null;
  }

  return {
    originalLabel,
    minimumOriginal: null,
    maximumOriginal: null,
    period: null,
    currency: null,
    grossOrNet: "unknown",
    normalizedAnnualMinimum: null,
    normalizedAnnualMaximum: null,
    normalizationWarning: "salary_not_yet_parsed",
  };
}

function validatedExternalUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function normalizeFranceTravailOffer(
  offer: FranceTravailOffer,
): NormalizedOffer {
  return {
    source: "france-travail",
    externalId: offer.id,
    title: externalContentToPlainText(offer.intitule),
    descriptionText: externalContentToPlainText(offer.description),
    companyName: trimmedOrNull(offer.entreprise?.nom),
    publishedAt: parseDate(offer.dateCreation),
    updatedAt: parseDate(offer.dateActualisation),
    location: {
      label: trimmedOrNull(offer.lieuTravail?.libelle),
      communeCode: trimmedOrNull(offer.lieuTravail?.commune),
      departmentCode: null,
      regionCode: null,
      latitude: offer.lieuTravail?.latitude ?? null,
      longitude: offer.lieuTravail?.longitude ?? null,
    },
    contract: {
      sourceCode: trimmedOrNull(offer.typeContrat),
      normalized: normalizeContract(offer),
      label: trimmedOrNull(offer.typeContratLibelle),
    },
    structuredExperience: {
      required: normalizeStructuredExperience(offer.experienceExige),
      label: trimmedOrNull(offer.experienceLibelle),
    },
    salary: normalizeSalary(offer),
    applicationUrl: null,
    sourceUrl: validatedExternalUrl(offer.origineOffre?.urlOrigine),
    rawPayload: offer,
  };
}
