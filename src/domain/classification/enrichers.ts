import type { NormalizedOffer } from "@/domain/offers/normalized-offer";

import {
  normalizeTextForMatching,
  sourceRangeForNormalizedMatch,
} from "./normalize-text";
import {
  TECHNOLOGY_CONTEXT_WINDOW,
  TECHNOLOGY_RULES,
} from "./technology-registry";
import type { Evidence, EvidenceField, RemoteMode } from "./types";

type TextField = {
  field: Exclude<EvidenceField, "salaryLabel">;
  source: string;
};

type TechnologyCandidate = {
  slug: string;
  alias: string;
  field: TextField["field"];
  excerpt: string;
  start: number;
  end: number;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function firstEvidence(
  field: TextField,
  pattern: RegExp,
  kind: Evidence["kind"],
  ruleId: string,
  normalizedValue: string,
): Evidence | null {
  const match = pattern.exec(field.source);
  if (!match || match.index === undefined) return null;

  return {
    kind,
    ruleId,
    field: field.field,
    excerpt: match[0],
    start: match.index,
    end: match.index + match[0].length,
    normalizedValue,
  };
}

export function classifySalaryTransparency(offer: NormalizedOffer): {
  salaryTransparent: boolean;
  evidence: Evidence[];
} {
  const label = offer.salary?.originalLabel.trim();
  if (!label) return { salaryTransparent: false, evidence: [] };

  const normalized = normalizeTextForMatching(label).value;
  const hasAmount =
    /(?:^|[^\p{L}\p{N}])\d{2,6}(?:[.,]\d{1,2})?(?:[^\p{L}\p{N}]|$)/u.test(
      normalized,
    );
  const hasPeriod =
    /\b(?:horaire|heure|mensuel|mois|annuel|annuelle|an|année)\b|\/(?:h|mois|an)\b/u.test(
      normalized,
    );
  const hasCurrency = /€|\beuros?\b|\beur\b/u.test(normalized);
  const vagueOnly =
    /\b(?:selon profil|a negocier|à négocier|attractif|competitive?|compétitif|non renseigne|non renseigné)\b/u.test(
      normalized,
    ) && !hasAmount;
  const salaryTransparent = hasAmount && hasPeriod && hasCurrency && !vagueOnly;

  return {
    salaryTransparent,
    evidence: salaryTransparent
      ? [
          {
            kind: "salary",
            ruleId: "SALARY_EXPLICIT_STRUCTURED",
            field: "salaryLabel",
            excerpt: label,
            start: 0,
            end: label.length,
            normalizedValue: "true",
          },
        ]
      : [],
  };
}

export function classifyRemoteMode(offer: NormalizedOffer): {
  remoteMode: RemoteMode;
  evidence: Evidence[];
  warningCode: string | null;
} {
  const fields: TextField[] = [
    { field: "title", source: offer.title },
    { field: "description", source: offer.descriptionText },
  ];
  const remotePattern =
    /\b(?:full[ -]?remote|100\s*%\s*(?:remote|teletravail|télétravail)|entierement a distance|entièrement à distance|teletravail integral|télétravail intégral)\b/iu;
  const hybridPattern =
    /\b(?:hybride|teletravail partiel|télétravail partiel|[1-4]\s*jours?\s+(?:de\s+)?teletravail|[1-4]\s*jours?\s+(?:de\s+)?télétravail|teletravail possible|télétravail possible|teletravail autorise|télétravail autorisé)\b/iu;
  const onsitePattern =
    /\b(?:presence (?:sur site|obligatoire)|présence (?:sur site|obligatoire)|travail exclusivement sur site|poste exclusivement en presentiel|poste exclusivement en présentiel|aucun teletravail|aucun télétravail|teletravail non autorise|télétravail non autorisé)\b/iu;
  const matches = fields.flatMap((field) => {
    const candidates = [
      firstEvidence(
        field,
        remotePattern,
        "remote",
        "REMOTE_FULL_EXPLICIT",
        "remote",
      ),
      firstEvidence(
        field,
        hybridPattern,
        "remote",
        "REMOTE_HYBRID_EXPLICIT",
        "hybrid",
      ),
      firstEvidence(
        field,
        onsitePattern,
        "remote",
        "REMOTE_ONSITE_EXPLICIT",
        "onsite",
      ),
    ];
    return candidates.filter(
      (candidate): candidate is Evidence => candidate !== null,
    );
  });
  const modes = new Set(matches.map(({ normalizedValue }) => normalizedValue));

  if (modes.size !== 1) {
    return {
      remoteMode: "unknown",
      evidence: matches,
      warningCode: modes.size > 1 ? "REMOTE_SIGNALS_CONFLICT" : null,
    };
  }

  const [mode] = modes;
  const frequencyUnknown = matches.some(({ excerpt }) =>
    /teletravail (?:possible|autorise)|télétravail (?:possible|autorisé)/iu.test(
      excerpt,
    ),
  );

  return {
    remoteMode:
      mode === "remote" || mode === "hybrid" || mode === "onsite"
        ? mode
        : "unknown",
    evidence: matches,
    warningCode: frequencyUnknown ? "REMOTE_FREQUENCY_UNKNOWN" : null,
  };
}

function technologyCandidates(field: TextField): TechnologyCandidate[] {
  const normalized = normalizeTextForMatching(field.source);
  const candidates: TechnologyCandidate[] = [];

  for (const technology of TECHNOLOGY_RULES) {
    const aliases = [
      ...technology.aliases.map((alias) => ({ alias, contextRequired: false })),
      ...(technology.contextRequiredAliases ?? []).map((alias) => ({
        alias,
        contextRequired: true,
      })),
    ].sort((left, right) => right.alias.length - left.alias.length);

    for (const { alias, contextRequired } of aliases) {
      const normalizedAlias = normalizeTextForMatching(alias).value;
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}])${escapeRegExp(normalizedAlias)}(?![\\p{L}\\p{N}])`,
        "gu",
      );
      let match = pattern.exec(normalized.value);

      while (match) {
        const contextStart = Math.max(
          0,
          match.index - TECHNOLOGY_CONTEXT_WINDOW,
        );
        const contextEnd = Math.min(
          normalized.value.length,
          match.index + match[0].length + TECHNOLOGY_CONTEXT_WINDOW,
        );
        const context = normalized.value.slice(contextStart, contextEnd);
        const hasContext = (technology.contextSignals ?? []).some((signal) =>
          context.includes(normalizeTextForMatching(signal).value),
        );
        const excluded = (technology.exclusions ?? []).some((exclusion) =>
          context.includes(normalizeTextForMatching(exclusion).value),
        );

        if ((!contextRequired || hasContext) && !excluded) {
          const range = sourceRangeForNormalizedMatch(
            normalized,
            match.index,
            match.index + match[0].length,
          );
          candidates.push({
            slug: technology.id,
            alias,
            field: field.field,
            excerpt: field.source.slice(range.start, range.end),
            start: range.start,
            end: range.end,
          });
        }
        match = pattern.exec(normalized.value);
      }
    }

    for (const alias of technology.caseSensitiveAliases ?? []) {
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}])${escapeRegExp(alias)}(?![\\p{L}\\p{N}])`,
        "gu",
      );
      const match = pattern.exec(field.source);
      if (match?.index !== undefined) {
        candidates.push({
          slug: technology.id,
          alias,
          field: field.field,
          excerpt: match[0],
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
  }

  return candidates;
}

export function detectTechnologies(offer: NormalizedOffer): {
  technologySlugs: string[];
  evidence: Evidence[];
} {
  const fields: TextField[] = [
    { field: "title", source: offer.title },
    { field: "description", source: offer.descriptionText },
    {
      field: "experienceLabel",
      source: offer.structuredExperience.label ?? "",
    },
  ];
  const candidates = fields
    .flatMap(technologyCandidates)
    .sort(
      (left, right) =>
        right.alias.length - left.alias.length ||
        left.start - right.start ||
        left.slug.localeCompare(right.slug),
    );
  const selected: TechnologyCandidate[] = [];

  for (const candidate of candidates) {
    if (selected.some(({ slug }) => slug === candidate.slug)) continue;
    const overlapsLongerMatch = selected.some(
      (existing) =>
        existing.field === candidate.field &&
        candidate.start < existing.end &&
        candidate.end > existing.start,
    );
    if (!overlapsLongerMatch) selected.push(candidate);
  }

  selected.sort(
    (left, right) =>
      fields.findIndex(({ field }) => field === left.field) -
        fields.findIndex(({ field }) => field === right.field) ||
      left.start - right.start ||
      left.slug.localeCompare(right.slug),
  );

  return {
    technologySlugs: selected.map(({ slug }) => slug).sort(),
    evidence: selected.map((candidate) => ({
      kind: "technology",
      ruleId: "TECHNOLOGY_ALIAS_MENTION",
      field: candidate.field,
      excerpt: candidate.excerpt,
      start: candidate.start,
      end: candidate.end,
      normalizedValue: candidate.slug,
    })),
  };
}
