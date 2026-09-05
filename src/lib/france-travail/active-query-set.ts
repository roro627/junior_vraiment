import { z } from "zod";

import activeQuerySetDocument from "../../../docs/reference/query-set.active.json";

const nonEmptyString = z.string().trim().min(1);
const shortSourceValue = z.string().trim().min(2).max(120);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);

const queryGroupSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  enabled: z.boolean(),
  jobFamilies: z.array(nonEmptyString).min(1),
  occupationReferences: z.array(z.string().regex(/^[A-Z]\d{4}$/u)).min(1),
  keywordsAny: z.array(shortSourceValue).min(1),
  titleIncludesAny: z.array(shortSourceValue).min(1),
});

const activeQuerySetSchema = z
  .strictObject({
    $schema: z.literal("https://json-schema.org/draft/2020-12/schema"),
    documentVersion: z.string().regex(/^\d+\.\d+\.\d+$/u),
    status: z.literal("active"),
    querySetVersion: z.string().regex(/^queries-\d+\.\d+\.\d+$/u),
    source: z.literal("france-travail"),
    sourceContractObservedAt: z.iso.date(),
    sourceApiVersion: nonEmptyString,
    territoryScope: z.literal("france"),
    changeBasis: z.array(nonEmptyString).min(1),
    sourceParameterMapping: z.strictObject({
      occupationReferences: z.literal("codeROME"),
      keywords: z.literal("motsCles"),
      territory: z.tuple([
        z.literal("region"),
        z.literal("departement"),
        z.literal("commune"),
        z.literal("distance"),
      ]),
      pagination: z.literal("range"),
      sort: z.literal("sort"),
    }),
    postFilter: z.strictObject({
      field: z.literal("normalized title"),
      operator: z.literal("unicode whole phrase contains any"),
      purpose: nonEmptyString,
    }),
    requestRules: z.strictObject({
      maxRequestsPerSecondInitial: z.number().positive().max(5),
      maxResultsPerRange: z.literal(150),
      maxStartIndex: z.literal(3000),
      maxEndIndex: z.literal(3149),
      keywordListOperator: z.literal("and"),
      keywordsAnyExpansion: z.literal("one-source-request-per-keyword"),
    }),
    groups: z.array(queryGroupSchema).min(1),
    activation: z.strictObject({
      activatedAt: z.iso.date(),
      activationPolicyVersion: nonEmptyString,
      candidateQuerySetVersion: nonEmptyString,
      candidateSha256: sha256,
      validationReport: z.string().regex(/^[a-z0-9][a-z0-9.-]*\.json$/u),
      validationReportSha256: sha256,
      allowedPromotionChanges: z.array(nonEmptyString).min(1),
    }),
  })
  .superRefine((querySet, context) => {
    const groupIds = new Set<string>();
    let enabledGroups = 0;

    for (const [groupIndex, group] of querySet.groups.entries()) {
      if (groupIds.has(group.id)) {
        context.addIssue({
          code: "custom",
          message: `Le groupe ${group.id} est déclaré plusieurs fois.`,
          path: ["groups", groupIndex, "id"],
        });
      }
      groupIds.add(group.id);
      if (group.enabled) enabledGroups += 1;

      for (const [field, values] of [
        ["jobFamilies", group.jobFamilies],
        ["occupationReferences", group.occupationReferences],
        ["keywordsAny", group.keywordsAny],
        ["titleIncludesAny", group.titleIncludesAny],
      ] as const) {
        const uniqueValues = new Set(values);
        if (uniqueValues.size !== values.length) {
          context.addIssue({
            code: "custom",
            message: `Le groupe ${group.id} contient une valeur dupliquée dans ${field}.`,
            path: ["groups", groupIndex, field],
          });
        }
      }
    }

    if (enabledGroups === 0) {
      context.addIssue({
        code: "custom",
        message: "Un registre actif doit contenir au moins un groupe activé.",
        path: ["groups"],
      });
    }
  });

export type ActiveFranceTravailQuerySet = z.infer<typeof activeQuerySetSchema>;

export type FranceTravailAtomicQueryKind =
  "occupation-only" | "keyword-only" | "overlap";

export type FranceTravailQueryMembership = {
  groupId: string;
  jobFamilies: string[];
  titleIncludesAny: string[];
};

export type FranceTravailAtomicQuery = {
  queryKey: string;
  kind: FranceTravailAtomicQueryKind;
  occupationReference: string | null;
  keyword: string | null;
  memberships: FranceTravailQueryMembership[];
};

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right, "fr"),
  );
}

function normalizedSearchText(value: string): string {
  return ` ${value
    .normalize("NFKD")
    .toLocaleLowerCase("fr-FR")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ")} `;
}

function sourcePairKey(
  occupationReference: string | null,
  keyword: string | null,
): string {
  return `${occupationReference ?? ""}\u0000${keyword ?? ""}`;
}

function publicQueryKey(
  occupationReference: string | null,
  keyword: string | null,
): string {
  return [
    `rome=${encodeURIComponent(occupationReference ?? "-")}`,
    `keyword=${encodeURIComponent(keyword ?? "-")}`,
  ].join("&");
}

function queryKind(
  occupationReference: string | null,
  keyword: string | null,
): FranceTravailAtomicQueryKind {
  if (occupationReference && keyword) return "overlap";
  return occupationReference ? "occupation-only" : "keyword-only";
}

function compareAtomicQueries(
  left: FranceTravailAtomicQuery,
  right: FranceTravailAtomicQuery,
): number {
  return left.queryKey.localeCompare(right.queryKey, "en");
}

/** Validates an in-memory document before any source request is constructed. */
export function parseActiveFranceTravailQuerySet(
  source: unknown,
): ActiveFranceTravailQuerySet {
  return activeQuerySetSchema.parse(source);
}

/**
 * Loads the versioned registry bundled with the application. The static import
 * keeps the operation deterministic and independent from the process cwd.
 */
export function loadActiveFranceTravailQuerySet(): ActiveFranceTravailQuerySet {
  return parseActiveFranceTravailQuerySet(activeQuerySetDocument);
}

/**
 * Expands each enabled group to the source requests validated for the active
 * registry. Equal source parameter pairs are shared across group memberships.
 */
export function buildFranceTravailAtomicQueries(
  querySet: ActiveFranceTravailQuerySet,
): FranceTravailAtomicQuery[] {
  const queries = new Map<string, FranceTravailAtomicQuery>();

  const addQuery = (
    group: ActiveFranceTravailQuerySet["groups"][number],
    occupationReference: string | null,
    keyword: string | null,
  ): void => {
    const pairKey = sourcePairKey(occupationReference, keyword);
    const existing = queries.get(pairKey);
    const membership: FranceTravailQueryMembership = {
      groupId: group.id,
      jobFamilies: uniqueSorted(group.jobFamilies),
      titleIncludesAny: [...group.titleIncludesAny],
    };

    if (existing) {
      existing.memberships.push(membership);
      existing.memberships.sort((left, right) =>
        left.groupId.localeCompare(right.groupId, "en"),
      );
      return;
    }

    queries.set(pairKey, {
      queryKey: publicQueryKey(occupationReference, keyword),
      kind: queryKind(occupationReference, keyword),
      occupationReference,
      keyword,
      memberships: [membership],
    });
  };

  for (const group of querySet.groups) {
    if (!group.enabled) continue;

    for (const occupationReference of group.occupationReferences) {
      addQuery(group, occupationReference, null);
    }
    for (const keyword of group.keywordsAny) {
      addQuery(group, null, keyword);
    }
    for (const occupationReference of group.occupationReferences) {
      for (const keyword of group.keywordsAny) {
        addQuery(group, occupationReference, keyword);
      }
    }
  }

  return [...queries.values()].sort(compareAtomicQueries);
}

/** Matches a complete role phrase, never a substring inside another word. */
export function titleMatchesAnyRolePhrase(
  title: string,
  titleIncludesAny: readonly string[],
): boolean {
  if (titleIncludesAny.length === 0) return false;
  const normalizedTitle = normalizedSearchText(title);
  return titleIncludesAny.some((phrase) =>
    normalizedTitle.includes(normalizedSearchText(phrase)),
  );
}

/** Returns only the query memberships admitted by their title post-filter. */
export function filterQueryMembershipsByTitle(
  query: FranceTravailAtomicQuery,
  title: string,
): FranceTravailQueryMembership[] {
  return query.memberships.filter((membership) =>
    titleMatchesAnyRolePhrase(title, membership.titleIncludesAny),
  );
}
