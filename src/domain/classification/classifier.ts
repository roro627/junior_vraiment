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

function sourceClause(
  text: TextField,
  match: TextMatch,
): { value: string; before: string; after: string } {
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

  return {
    value: normalizeTextForMatching(text.source.slice(start, end)).value,
    before: normalizeTextForMatching(text.source.slice(start, range.start))
      .value,
    after: normalizeTextForMatching(text.source.slice(range.end, end)).value,
  };
}

function experienceCandidates(text: TextField): Evidence[] {
  const evidence: Evidence[] = [];
  const rangeSpans: Array<{ start: number; end: number }> = [];
  const patterns = [
    {
      ruleId: "EXP_RANGE_YEARS",
      regex: new RegExp(
        `(?<![\\p{L}\\p{N}])${amountPattern}\\s*(?:a|à|–|-|et)\\s*${amountPattern}\\s*(?:années?|annees?|ans?)(?![\\p{L}\\p{N}])`,
        "gu",
      ),
      unit: "years",
      amountGroup: 1,
    },
    {
      ruleId: "EXP_SINGLE_DURATION",
      regex: new RegExp(
        `(?<![\\p{L}\\p{N}])${amountPattern}\\s*(?:\\+\\s*)?(années?|annees?|ans?|mois)(?![\\p{L}\\p{N}])`,
        "gu",
      ),
      unit: "captured",
      amountGroup: 1,
    },
    {
      // Observed source formatting can concatenate a heading and a requirement.
      // Scope this exception to a qualifications heading, not any word+number.
      ruleId: "EXP_PROFILE_STACK",
      regex: new RegExp(
        `qualifications${amountPattern}\\s*(années?|annees?|ans?)\\s+minimum\\s+sur\\s+(?:la\\s+)?stack\\b`,
        "gu",
      ),
      unit: "captured",
      amountGroup: 1,
    },
  ] as const;

  const durations = [
    ...text.normalized.value.matchAll(
      new RegExp(patterns[1].regex.source, "gu"),
    ),
  ];

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
      const clauseParts = sourceClause(text, match);
      const clause = clauseParts.value;
      // A requirement attached to another duration cannot qualify this one.
      const previousEnd = durations
        .filter((item) => item.index + item[0].length <= matchStart)
        .at(-1);
      const nextStart = durations.find((item) => item.index >= matchEnd);
      const before = text.normalized.value.slice(
        Math.max(
          contextStart,
          matchStart - clauseParts.before.length,
          previousEnd ? previousEnd.index + previousEnd[0].length : 0,
        ),
        matchStart,
      );
      const after = text.normalized.value.slice(
        matchEnd,
        Math.min(
          contextEnd,
          matchEnd + clauseParts.after.length,
          nextStart?.index ?? contextEnd,
        ),
      );
      const localContext = `${before}${match[0]}${after}`;
      // A long domain name can separate a duration from its trailing modality.
      // Stop at the next duration and clause boundary, never borrow a later requirement.
      const modalityAfter = text.normalized.value.slice(
        matchEnd,
        Math.min(
          matchEnd + clauseParts.after.length,
          nextStart?.index ?? text.normalized.value.length,
        ),
      );
      const trailingPreference =
        /^\s+(?:dans|en|sur)\b[^,;.!?]{0,200}\best\s+(?:souhait[ée]e?|appr[ée]ci[ée]e?)(?!\p{L})/u.test(
          modalityAfter,
        );
      const applicantSubject = /\b(?:vous|tu|votre|candidat|candidate)\b/u.test(
        before,
      );
      const employerDuration =
        (!applicantSubject &&
          /pourquoi (?:nous )?rejoindre[^]{0,350}$/u.test(
            text.normalized.value.slice(
              Math.max(0, matchStart - 400),
              matchStart,
            ),
          ) &&
          /^\s+d['’]exp[ée]rience\s+dans (?:des|nos) projets\b/u.test(after)) ||
        (!applicantSubject &&
          /positionn[ée][^.!?;]{0,90}(?:entreprises|soci[ée]t[ée]s)/u.test(
            clauseParts.after,
          )) ||
        /(?:fond[ée]|cr[ée][ée])[^.!?;]{0,35}$/u.test(before) ||
        (!applicantSubject &&
          /(?:entreprise|soci[ée]t[ée]|groupe|notre client)[^.!?;]{0,70}$/u.test(
            before,
          )) ||
        (/elle a\s*$/u.test(before) &&
          /entreprise|soci[ée]t[ée]|notre client/u.test(
            text.normalized.value.slice(
              Math.max(0, matchStart - 250),
              matchStart,
            ),
          )) ||
        (!applicantSubject &&
          /(?:est un acteur|acteur majeur)[^.!?;]*$/u.test(clauseParts.before));
      const negatedDuration =
        /(?:pas besoin d['’]avoir|sans exiger|ne (?:demandons|requiert|demandent) pas)[^.!?;]{0,35}$/u.test(
          before,
        );
      const experienceSubject =
        pattern.ruleId === "EXP_PROFILE_STACK" ||
        /^\s+minimum\s+sur\s+(?:la\s+)?stack\b/u.test(after) ||
        (/(?:qualifications|comp[ée]tences(?: techniques)?|profil(?: recherch[ée])?)\s*$/u.test(
          before,
        ) &&
          /^\s+minimum\s+sur\s+(?:la\s+)?stack\b/u.test(after)) ||
        text.field === "experienceLabel" ||
        /exp[ée]rience/u.test(localContext) ||
        /(?:vous|tu)[^.!?;]{0,60}(?:au moins|minimum|justifiez|disposez)/u.test(
          before,
        );
      const beginnerAlternative = /\bou vous [êe]tes d[ée]butant/u.test(
        clauseParts.after,
      );
      const excluded =
        employerDuration ||
        negatedDuration ||
        beginnerAlternative ||
        !experienceSubject ||
        /(?:bac\s*\+|formation|cursus|contrat|mission|projet)\s+(?:de\s+)?$/u.test(
          text.normalized.value.slice(contextStart, match.index),
        ) ||
        /equipe de \d+ (?:personnes|collaborateurs)/u.test(context) ||
        /\bforts? de\s+(?:\d{1,2}|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*(?:ans?|annees?|années?)\s+d['’](?:experience|expérience)\b/u.test(
          clause,
        );
      const desiredSignal =
        /idealement|idéalement|souhaite|souhaité|souhaitee|souhaitée|apprecie|apprécié|appreciee|appréciée|serait un plus|de preference|de préférence|bonus/u.test(
          localContext,
        );
      const strongRequiredSignal =
        text.field === "experienceLabel" ||
        /minimum|au moins|plus de|exige|exigé|exigee|exigée|requis|requise|obligatoire|justifiez|disposez/u.test(
          localContext,
        );
      const genericRequiredSignal =
        /experience (?:professionnelle )?(?:de )?|expérience (?:professionnelle )?(?:de )?|ans? d['’](?:experience|expérience|xp)/u.test(
          localContext,
        );
      const preferenceBeforeDuration =
        /id[ée]alement|souhait[ée]|appr[ée]ci[ée]|de pr[ée]f[ée]rence/u.test(
          before,
        );
      const desired =
        preferenceBeforeDuration ||
        trailingPreference ||
        (desiredSignal && !strongRequiredSignal);
      const required =
        !desired &&
        (strongRequiredSignal || (!desiredSignal && genericRequiredSignal));

      if (employerDuration || negatedDuration) {
        addEvidence(
          evidence,
          text,
          match,
          "exclusion",
          negatedDuration ? "EXP_NEGATED_DURATION" : "EXP_EMPLOYER_HISTORY",
        );
      }
      if (beginnerAlternative) {
        addEvidence(
          evidence,
          text,
          match,
          "exclusion",
          "EXP_BEGINNER_ALTERNATIVE",
        );
      }

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
    /\b(?:junior|debutant|débutant|debutante|débutante|graduate|jeune diplome|jeune diplômé|jeune diplomee|jeune diplômée|premier emploi)(?!\p{L})/gu,
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
    /\b(?:profil junior|stage et alternance inclus pour les profils juniors|junior ou exp[ée]riment[ée]e?|experience level\s*:\s*entry level|debutants? acceptes?|débutants? acceptés?|debutantes? acceptees?|débutantes? acceptées?|jeunes? diplomees?|jeunes? diplômées?|aucune experience (?:n['’]est )?requise|aucune expérience (?:n['’]est )?requise|sans experience requise|sans expérience requise)(?!\p{L})/gu;
  for (const field of fields.slice(1)) {
    const match =
      firstMatch(field.normalized.value, bodyJuniorPattern) ??
      firstMatch(
        field.normalized.value,
        /\bposte\s+ouvert\s+aux\s+profils?\s+juniors?(?!\p{L})/gu,
      );
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

  const titleSeniorMatch = firstMatch(
    title.normalized.value,
    /\b(?:s[ée]nior|confirm[ée]e?|exp[ée]riment[ée]e?|lead)(?!\p{L})/gu,
  );
  const titleOffersJuniorAlternative =
    titleSeniorMatch !== null &&
    (/^\s*\(?\s*ou\s+(?:junior|d[ée]butant)/u.test(
      title.normalized.value.slice(
        titleSeniorMatch.index + titleSeniorMatch[0].length,
      ),
    ) ||
      /(?:junior|d[ée]butant)\s+ou\s*$/u.test(
        title.normalized.value.slice(0, titleSeniorMatch.index),
      ));
  const titleHasSenior =
    titleSeniorMatch !== null && !titleOffersJuniorAlternative;
  if (titleSeniorMatch && titleHasSenior) {
    addEvidence(
      evidence,
      title,
      titleSeniorMatch,
      positiveJunior ? "conflict" : "exclusion",
      positiveJunior ? "SENIOR_TITLE_JUNIOR_CONFLICT" : "EXPLICIT_SENIOR_TITLE",
    );
    if (!positiveJunior) claimsJunior = false;
  }
  if (
    (titleHasSenior && positiveJunior) ||
    (positiveJunior && negativeMatches.length)
  ) {
    warnings.push({
      code: "CONFLICTING_JUNIOR_SIGNALS",
      severity: "blocking",
      message: "Les signaux explicites de niveau se contredisent.",
    });
  }
  const seniorRole = firstMatch(
    description.normalized.value,
    /(?:(?:en tant que(?: profil)?|recherche un[\p{L}\s’'-]{0,12}|profil(?:\s+m[ée]dior\+?\s*\/)?)\s+(?:s[ée]nior|lead)(?!\p{L})|nous (?:recrutons|recherchons)\s+un(?:e|\(e\))?\s+(?:d[ée]veloppeur(?:se|\(se\))?|ing[ée]nieur(?:e|\(e\))?)(?:\s+(?:informatique|devops|cloud|logiciel)){0,2}\s+(?:exp[ée]riment[ée]e?|confirm[ée]e?|s[ée]nior)(?!\p{L}))/gu,
  );
  const namedSeniorRole = firstMatch(
    description.normalized.value,
    /en tant qu['’]ing[ée]nieur(?:e|\(e\))?(?:\s+(?:os|temps|r[ée]el|cybers[ée]curit[ée]|&|cloud|devops|logiciel|informatique)){0,6}\s+(?:exp[ée]riment[ée]e?|confirm[ée]e?|s[ée]nior)(?!\p{L})/gu,
  );
  const experiencedProfile = firstMatch(
    description.normalized.value,
    /\bprofil\s+(?:exp[ée]riment[ée]e?|confirm[ée]e?)(?!\p{L})/gu,
  );
  const recruitingSenior = firstMatch(
    description.normalized.value,
    /\bnous (?:recherchons|recrutons)\s+un(?:e|\(e\)?)?\s+(?:s[ée]nior|lead)(?!\p{L})/gu,
  );
  const conflictingRole =
    seniorRole ?? namedSeniorRole ?? experiencedProfile ?? recruitingSenior;
  if (positiveJunior && conflictingRole && !titleHasSenior) {
    addEvidence(
      evidence,
      description,
      conflictingRole,
      "conflict",
      "SENIOR_ROLE_JUNIOR_CONFLICT",
    );
    warnings.push({
      code: "CONFLICTING_JUNIOR_SIGNALS",
      severity: "blocking",
      message: "Le rôle senior annoncé contredit le signal junior.",
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
