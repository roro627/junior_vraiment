import type { NormalizedOffer } from "@/domain/offers/normalized-offer";

import {
  normalizeTextForMatching,
  sourceRangeForNormalizedMatch,
  type NormalizedText,
} from "./normalize-text";
import {
  CLASSIFIER_VERSION,
  type ClassificationResult,
  type ClassificationWarning,
  type Evidence,
  type EvidenceField,
  type EvidenceKind,
} from "./types";
import {
  classifyRemoteMode,
  classifySalaryTransparency,
  detectTechnologies,
} from "./enrichers";

type TextField = {
  field: EvidenceField;
  source: string;
  normalized: NormalizedText;
};

type TextMatch = {
  0: string;
  index: number;
};

const writtenNumbers: Readonly<Record<string, number>> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
};

const amountPattern =
  "(\\d{1,2}|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)";

function toAmount(value: string): number {
  return /^\d+$/u.test(value) ? Number(value) : (writtenNumbers[value] ?? 0);
}

function addEvidence(
  collection: Evidence[],
  text: TextField,
  match: TextMatch,
  kind: EvidenceKind,
  ruleId: string,
  normalizedValue?: string,
): void {
  const normalizedStart = match.index;
  const normalizedEnd = match.index + match[0].length;
  const range = sourceRangeForNormalizedMatch(
    text.normalized,
    normalizedStart,
    normalizedEnd,
  );

  collection.push({
    kind,
    ruleId,
    field: text.field,
    excerpt: text.source.slice(range.start, range.end),
    start: range.start,
    end: range.end,
    ...(normalizedValue ? { normalizedValue } : {}),
  });
}

function firstMatch(value: string, pattern: RegExp): RegExpExecArray | null {
  pattern.lastIndex = 0;
  return pattern.exec(value);
}

function sourceClause(text: TextField, match: TextMatch): string {
  const range = sourceRangeForNormalizedMatch(
    text.normalized,
    match.index,
    match.index + match[0].length,
  );
  const boundaryPattern = /[.!?;\n\r•]/u;
  let start = range.start;
  while (start > 0 && !boundaryPattern.test(text.source[start - 1] ?? "")) {
    start -= 1;
  }
  let end = range.end;
  while (
    end < text.source.length &&
    !boundaryPattern.test(text.source[end] ?? "")
  ) {
    end += 1;
  }

  return normalizeTextForMatching(text.source.slice(start, end)).value;
}

function experienceCandidates(text: TextField): Evidence[] {
  const evidence: Evidence[] = [];
  const rangeSpans: Array<{ start: number; end: number }> = [];
  const patterns = [
    {
      ruleId: "EXP_RANGE_YEARS",
      regex: new RegExp(
        `${amountPattern}\\s*(?:a|à|–|-)\\s*${amountPattern}\\s*(?:ans?|annees?|années?)`,
        "gu",
      ),
      unit: "years",
      amountGroup: 1,
    },
    {
      ruleId: "EXP_SINGLE_DURATION",
      regex: new RegExp(
        `${amountPattern}\\s*(?:\\+\\s*)?(ans?|annees?|années?|mois)`,
        "gu",
      ),
      unit: "captured",
      amountGroup: 1,
    },
  ] as const;

  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    let match = pattern.regex.exec(text.normalized.value);
    while (match) {
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;
      const overlapsRange = rangeSpans.some(
        (span) => matchStart < span.end && matchEnd > span.start,
      );
      if (pattern.ruleId !== "EXP_RANGE_YEARS" && overlapsRange) {
        match = pattern.regex.exec(text.normalized.value);
        continue;
      }

      const contextStart = Math.max(0, match.index - 70);
      const contextEnd = Math.min(
        text.normalized.value.length,
        match.index + match[0].length + 70,
      );
      const context = text.normalized.value.slice(contextStart, contextEnd);
      const clause = sourceClause(text, match);
      const excluded =
        /(?:bac\s*\+|formation|cursus|contrat|mission|projet)\s+(?:de\s+)?$/u.test(
          text.normalized.value.slice(contextStart, match.index),
        ) ||
        /equipe de \d+ (?:personnes|collaborateurs)/u.test(context) ||
        /\bforts? de\s+(?:\d{1,2}|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*(?:ans?|annees?|années?)\s+d['’](?:experience|expérience)\b/u.test(
          clause,
        );
      const desiredSignal =
        /idealement|idéalement|souhaite|souhaité|souhaitee|souhaitée|apprecie|apprécié|appreciee|appréciée|serait un plus|de preference|de préférence|bonus/u.test(
          clause,
        );
      const strongRequiredSignal =
        text.field === "experienceLabel" ||
        /minimum|au moins|plus de|exige|exigé|exigee|exigée|requis|requise|obligatoire|justifiez|disposez/u.test(
          clause,
        );
      const genericRequiredSignal =
        /experience (?:professionnelle )?(?:de )?|expérience (?:professionnelle )?(?:de )?|ans? d['’](?:experience|expérience|xp)/u.test(
          clause,
        );
      const desired = desiredSignal && !strongRequiredSignal;
      const required =
        strongRequiredSignal || (!desiredSignal && genericRequiredSignal);

      if (!excluded && (desired || required)) {
        const amount = toAmount(match[pattern.amountGroup] ?? "0");
        const unit =
          pattern.unit === "years"
            ? "years"
            : /mois/u.test(match[2] ?? "")
              ? "months"
              : "years";
        const months = unit === "years" ? amount * 12 : amount;
        addEvidence(
          evidence,
          text,
          match,
          desired ? "desired_experience" : "required_experience",
          desired ? "EXP_DESIRED_ONLY" : pattern.ruleId,
          String(months),
        );
        if (pattern.ruleId === "EXP_RANGE_YEARS") {
          rangeSpans.push({ start: matchStart, end: matchEnd });
        }
      }

      match = pattern.regex.exec(text.normalized.value);
    }
  }

  return evidence;
}

export function classifyOffer(offer: NormalizedOffer): ClassificationResult {
  const fields: TextField[] = [
    {
      field: "title",
      source: offer.title,
      normalized: normalizeTextForMatching(offer.title),
    },
    {
      field: "description",
      source: offer.descriptionText,
      normalized: normalizeTextForMatching(offer.descriptionText),
    },
    {
      field: "experienceLabel",
      source: offer.structuredExperience.label ?? "",
      normalized: normalizeTextForMatching(
        offer.structuredExperience.label ?? "",
      ),
    },
  ];
  const evidence: Evidence[] = [];
  const warnings: ClassificationWarning[] = [];
  const salary = classifySalaryTransparency(offer);
  const remote = classifyRemoteMode(offer);
  const technologies = detectTechnologies(offer);
  evidence.push(
    ...salary.evidence,
    ...remote.evidence,
    ...technologies.evidence,
  );
  if (remote.warningCode) {
    warnings.push({
      code: remote.warningCode,
      severity: "warning",
      message:
        remote.warningCode === "REMOTE_SIGNALS_CONFLICT"
          ? "Les informations de télétravail se contredisent."
          : "La fréquence du télétravail n'est pas précisée.",
    });
  }
  const title = fields[0];
  const description = fields[1];
  if (!title || !description) {
    throw new Error("Les champs textuels normalisés sont incomplets.");
  }

  const negativePattern =
    /\b(?:pas (?:un |une )?(?:poste |profil )?junior|profil non junior|junior s['’]abstenir)\b/gu;
  const negativeMatches = fields
    .slice(0, 2)
    .map((field) => ({
      field,
      match: firstMatch(field.normalized.value, negativePattern),
    }))
    .filter(
      (candidate): candidate is { field: TextField; match: RegExpExecArray } =>
        candidate.match !== null,
    );
  for (const { field, match } of negativeMatches) {
    addEvidence(evidence, field, match, "exclusion", "NEGATED_JUNIOR");
  }

  const titleJuniorMatch = firstMatch(
    title.normalized.value,
    /\b(?:junior|debutant|débutant|debutante|débutante|graduate|jeune diplome|jeune diplômé|jeune diplomee|jeune diplômée|premier emploi)\b/gu,
  );
  if (titleJuniorMatch && negativeMatches.length === 0) {
    addEvidence(
      evidence,
      title,
      titleJuniorMatch,
      "junior_claim",
      "JUNIOR_EXPLICIT_TITLE",
      "true",
    );
  }

  const bodyJuniorPattern =
    /\b(?:profil junior|debutants? acceptes?|débutants? acceptés?|debutantes? acceptees?|débutantes? acceptées?|jeunes? diplomees?|jeunes? diplômées?|aucune experience (?:n['’]est )?requise|aucune expérience (?:n['’]est )?requise|sans experience requise|sans expérience requise)\b/gu;
  for (const field of fields.slice(1)) {
    const match = firstMatch(field.normalized.value, bodyJuniorPattern);
    if (match && negativeMatches.length === 0) {
      const explicitlyAcceptsBeginners =
        /(?:debutants? acceptes?|débutants? acceptés?|debutantes? acceptees?|débutantes? acceptées?|aucune experience (?:n['’]est )?requise|aucune expérience (?:n['’]est )?requise|sans experience requise|sans expérience requise)/u.test(
          match[0],
        );
      addEvidence(
        evidence,
        field,
        match,
        "junior_claim",
        explicitlyAcceptsBeginners
          ? "BEGINNER_ACCEPTED_BODY"
          : "JUNIOR_EXPLICIT_BODY",
        "true",
      );
    }
  }

  if (offer.structuredExperience.required === false) {
    const structuredField = fields[2];
    if (structuredField) {
      const structuredMatch: TextMatch = {
        0: structuredField.normalized.value,
        index: 0,
      };
      addEvidence(
        evidence,
        structuredField,
        structuredMatch,
        "junior_claim",
        "BEGINNER_ACCEPTED_STRUCTURED",
        "true",
      );
    }
  }

  evidence.push(...fields.flatMap(experienceCandidates));
  const requiredMonths = evidence
    .filter(({ kind }) => kind === "required_experience")
    .map(({ normalizedValue }) => Number(normalizedValue))
    .filter(Number.isFinite);
  const structuredRequiredMonths = evidence
    .filter(
      ({ kind, field }) =>
        kind === "required_experience" && field === "experienceLabel",
    )
    .map(({ normalizedValue }) => Number(normalizedValue))
    .filter(Number.isFinite);
  const textualRequiredMonths = evidence
    .filter(
      ({ kind, field }) =>
        kind === "required_experience" && field !== "experienceLabel",
    )
    .map(({ normalizedValue }) => Number(normalizedValue))
    .filter(Number.isFinite);
  const explicitBeginnerAccepted =
    offer.structuredExperience.required === false ||
    evidence.some(
      ({ ruleId }) =>
        ruleId === "BEGINNER_ACCEPTED_BODY" ||
        ruleId === "BEGINNER_ACCEPTED_STRUCTURED",
    );
  if (explicitBeginnerAccepted) {
    requiredMonths.push(0);
  }
  const minimumExperienceMonths = requiredMonths.length
    ? Math.max(...requiredMonths)
    : null;
  const positiveJunior = evidence.some(({ kind }) => kind === "junior_claim");
  let claimsJunior: boolean | null = positiveJunior
    ? true
    : negativeMatches.length
      ? false
      : null;

  const titleHasSenior = /\b(?:senior|senior|confirmé|confirme)\b/u.test(
    title.normalized.value,
  );
  if (
    (titleHasSenior && titleJuniorMatch) ||
    (positiveJunior && negativeMatches.length)
  ) {
    warnings.push({
      code: "CONFLICTING_JUNIOR_SIGNALS",
      severity: "blocking",
      message: "Les signaux explicites de niveau se contredisent.",
    });
  }
  if (explicitBeginnerAccepted && (minimumExperienceMonths ?? 0) > 0) {
    warnings.push({
      code: "BEGINNER_EXPERIENCE_CONFLICT",
      severity: "blocking",
      message: "L’acceptation des débutants contredit une durée obligatoire.",
    });
  }
  if (
    offer.structuredExperience.required === false &&
    requiredMonths.some((value) => value > 0)
  ) {
    warnings.push({
      code: "STRUCTURED_EXPERIENCE_CONFLICT",
      severity: "blocking",
      message: "La donnée structurée contredit l’exigence textuelle.",
    });
  }
  if (
    structuredRequiredMonths.length > 0 &&
    textualRequiredMonths.length > 0 &&
    !structuredRequiredMonths.some((structured) =>
      textualRequiredMonths.includes(structured),
    )
  ) {
    warnings.push({
      code: "STRUCTURED_DURATION_CONFLICT",
      severity: "blocking",
      message: "Les durées structurée et textuelle se contredisent.",
    });
  }

  const blocking = warnings.some(({ severity }) => severity === "blocking");
  const status = blocking
    ? "ambiguous"
    : claimsJunior !== null || minimumExperienceMonths !== null
      ? "classified"
      : "unclassified";
  if (blocking) {
    claimsJunior = positiveJunior ? true : claimsJunior;
  }
  const beginnerFriendly =
    status !== "classified"
      ? null
      : explicitBeginnerAccepted
        ? true
        : minimumExperienceMonths === null
          ? null
          : minimumExperienceMonths <= 12;
  const contradictoryJunior =
    status !== "classified" || claimsJunior === null
      ? null
      : claimsJunior === false
        ? false
        : minimumExperienceMonths === null
          ? null
          : minimumExperienceMonths >= 24;

  return {
    classifierVersion: CLASSIFIER_VERSION,
    status,
    claimsJunior,
    minimumExperienceMonths,
    beginnerFriendly,
    contradictoryJunior,
    salaryTransparent: salary.salaryTransparent,
    remoteMode: remote.remoteMode,
    technologySlugs: technologies.technologySlugs,
    evidence,
    ruleIds: [...new Set(evidence.map(({ ruleId }) => ruleId))],
    warnings,
  };
}
