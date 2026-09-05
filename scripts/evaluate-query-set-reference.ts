import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { z } from "zod";

const groupSchema = z.enum([
  "frontend",
  "backend",
  "fullstack",
  "mobile",
  "data",
  "devops-cloud",
  "cybersecurity",
  "qa-test",
]);
const querySchema = z.object({
  queryId: z.string().min(1),
  kind: z.enum(["occupation-only", "keyword-only", "overlap"]),
  groupIds: z.array(groupSchema).min(1),
  total: z.number().int().nonnegative(),
  status: z.enum(["complete", "over_cap", "incomplete", "probe"]),
  pages: z.number().int().positive(),
  rowsReceived: z.number().int().nonnegative(),
  codeROME: z.string().nullable(),
  motsCles: z.string().nullable(),
  warnings: z.array(z.string()),
  quarantined: z.number().int().nonnegative(),
});
const overlapSchema = z.object({
  leftQueryId: z.string().min(1),
  rightQueryId: z.string().min(1),
  intersection: z.number().int().nonnegative(),
  union: z.number().int().nonnegative(),
  jaccard: z.number().min(0).max(1).nullable(),
});
const collectionReportSchema = z.object({
  collectedAt: z.string().datetime(),
  mode: z.literal("full"),
  querySetVersion: z.string().min(1),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  queryCount: z.number().int().positive(),
  completeQueries: z.number().int().nonnegative(),
  overCapQueries: z.number().int().nonnegative(),
  incompleteQueries: z.number().int().nonnegative(),
  totalReported: z.number().int().nonnegative(),
  uniqueOffers: z.number().int().nonnegative(),
  quarantined: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
  queries: z.array(querySchema).min(1),
  overlaps: z.array(overlapSchema),
});
const collectionSchema = z.object({
  collectedAt: z.string().datetime(),
  querySetVersion: z.string().min(1),
  offers: z.array(
    z.object({
      externalIdHash: z.string().regex(/^[a-f0-9]{64}$/u),
      groups: z.array(
        z.object({
          groupId: groupSchema,
          reviewId: z.string().min(1),
          channels: z.array(
            z.enum(["occupation-only", "keyword-only", "overlap"]),
          ),
          queryIds: z.array(z.string().min(1)).min(1),
        }),
      ),
    }),
  ),
});
const referenceSchema = z.object({
  referenceSetVersion: z.string().min(1),
  annotationProtocolVersion: z.literal("query-relevance-llm-a-1.0.0"),
  activationPolicyVersion: z.literal("query-relevance-gate-1.0.0"),
  methodology: z.literal("single-blind-llm-pass-a-query-relevance"),
  model: z.string().min(1),
  reasoningEffort: z.string().min(1),
  querySetVersion: z.string().min(1),
  collectedAt: z.string().datetime(),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  collectionReportSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  collectionSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  querySetSourceSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  annotationChunks: z.array(
    z.object({
      fileName: z.string().min(1),
      rowCount: z.number().int().positive(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    }),
  ),
  rows: z
    .array(
      z.object({
        reviewId: z.string().min(1),
        groupId: groupSchema,
        discoveryChannels: z.array(
          z.enum(["occupation-only", "keyword-only", "overlap"]),
        ),
        queryIds: z.array(z.string().min(1)).min(1),
        llmAnnotation: z.object({
          status: z.enum(["classified", "ambiguous"]),
          relevantToGroup: z.boolean().nullable(),
          primaryFamily: z.string().min(1),
          falsePositiveReason: z.string().nullable(),
          evidenceExcerpts: z.array(z.string().min(1)).min(1),
        }),
      }),
    )
    .min(1),
});

type GateStatus = "passed" | "failed" | "not_evaluable";

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function ratioMetric(input: {
  numerator: number;
  denominator: number;
  threshold: number;
  unavailableReason: string;
}) {
  if (input.denominator === 0) {
    return {
      status: "not_evaluable" satisfies GateStatus,
      numerator: input.numerator,
      denominator: input.denominator,
      value: null,
      threshold: input.threshold,
      reason: input.unavailableReason,
    };
  }
  const value = input.numerator / input.denominator;
  return {
    status: (value >= input.threshold
      ? "passed"
      : "failed") satisfies GateStatus,
    numerator: input.numerator,
    denominator: input.denominator,
    value,
    threshold: input.threshold,
    reason: null,
  };
}

function booleanGate(actual: boolean, reason: string) {
  return {
    status: actual ? ("passed" as const) : ("failed" as const),
    value: actual,
    expected: true,
    reason: actual ? null : reason,
  };
}

const readArgument = (name: string, fallback: string): string =>
  process.argv
    .find((argument) => argument.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? fallback;
const directory = readArgument("--directory", ".local/query-set-validation");
const querySetPath = readArgument(
  "--query-set",
  "docs/reference/query-set.observed-draft.json",
);
const outputPath = readArgument(
  "--output",
  "docs/reference/query-set-validation-report.json",
);
const [
  referenceContent,
  collectionReportContent,
  collectionContent,
  sourceContent,
  querySetContent,
] = await Promise.all([
  readFile(`${directory}/reference.json`, "utf8"),
  readFile(`${directory}/report.json`, "utf8"),
  readFile(`${directory}/collection.redacted.json`, "utf8"),
  readFile(`${directory}/blind-sample.json`, "utf8"),
  readFile(querySetPath, "utf8"),
]);
const reference = referenceSchema.parse(
  JSON.parse(referenceContent) as unknown,
);
const collectionReport = collectionReportSchema.parse(
  JSON.parse(collectionReportContent) as unknown,
);
const collection = collectionSchema.parse(
  JSON.parse(collectionContent) as unknown,
);
if (
  reference.querySetVersion !== collectionReport.querySetVersion ||
  reference.querySetVersion !== collection.querySetVersion ||
  reference.collectedAt !== collectionReport.collectedAt ||
  reference.collectedAt !== collection.collectedAt ||
  reference.collectionReportSha256 !== sha256(collectionReportContent) ||
  reference.collectionSha256 !== sha256(collectionContent) ||
  reference.sourceSha256 !== sha256(sourceContent) ||
  reference.querySetSourceSha256 !== sha256(querySetContent) ||
  collectionReport.sourceSha256 !== sha256(querySetContent)
) {
  throw new Error(
    "Les artefacts de validation du query set ne correspondent pas.",
  );
}

const groupResults = groupSchema.options.map((groupId) => {
  const rows = reference.rows.filter((row) => row.groupId === groupId);
  const resolved = rows.filter(
    ({ llmAnnotation }) =>
      llmAnnotation.status === "classified" &&
      llmAnnotation.relevantToGroup !== null,
  );
  const relevant = resolved.filter(
    ({ llmAnnotation }) => llmAnnotation.relevantToGroup === true,
  );
  const coverage = ratioMetric({
    numerator: resolved.length,
    denominator: rows.length,
    threshold: 0.9,
    unavailableReason: "no_group_sample",
  });
  const precision = ratioMetric({
    numerator: relevant.length,
    denominator: resolved.length,
    threshold: 0.7,
    unavailableReason: "no_resolved_group_annotation",
  });
  return {
    groupId,
    sampleCount: rows.length,
    resolvedCount: resolved.length,
    relevantCount: relevant.length,
    coverage,
    precision,
    sampleSizeGate: booleanGate(rows.length >= 30, "group_sample_below_30"),
  };
});
const resolvedRows = reference.rows.filter(
  ({ llmAnnotation }) =>
    llmAnnotation.status === "classified" &&
    llmAnnotation.relevantToGroup !== null,
);
const relevantRows = resolvedRows.filter(
  ({ llmAnnotation }) => llmAnnotation.relevantToGroup === true,
);
const metrics = {
  resolvedCoverage: ratioMetric({
    numerator: resolvedRows.length,
    denominator: reference.rows.length,
    threshold: 0.9,
    unavailableReason: "no_reference_row",
  }),
  overallRelevancePrecision: ratioMetric({
    numerator: relevantRows.length,
    denominator: resolvedRows.length,
    threshold: 0.8,
    unavailableReason: "no_resolved_annotation",
  }),
  annotationEvidenceCoverage: ratioMetric({
    numerator: reference.rows.filter(
      ({ llmAnnotation }) => llmAnnotation.evidenceExcerpts.length > 0,
    ).length,
    denominator: reference.rows.length,
    threshold: 1,
    unavailableReason: "no_reference_row",
  }),
};
const collectionGates = {
  paginationComplete: booleanGate(
    collectionReport.completeQueries === collectionReport.queryCount &&
      collectionReport.overCapQueries === 0 &&
      collectionReport.incompleteQueries === 0,
    "pagination_not_complete",
  ),
  quarantineEmpty: booleanGate(
    collectionReport.quarantined === 0,
    "quarantined_offers_present",
  ),
  contractWarningsEmpty: booleanGate(
    collectionReport.warnings.length === 0,
    "contract_warnings_present",
  ),
};
const groupGatesPassed = groupResults.every(
  ({ coverage, precision, sampleSizeGate }) =>
    coverage.status === "passed" &&
    precision.status === "passed" &&
    sampleSizeGate.status === "passed",
);
const gateStatus =
  Object.values(metrics).every(({ status }) => status === "passed") &&
  Object.values(collectionGates).every(({ status }) => status === "passed") &&
  groupGatesPassed
    ? "passed"
    : "blocked";

const queriesById = new Map(
  collectionReport.queries.map((query) => [query.queryId, query]),
);
const occupationKeywordOverlaps = collectionReport.overlaps.filter(
  (overlap) => {
    const left = queriesById.get(overlap.leftQueryId);
    const right = queriesById.get(overlap.rightQueryId);
    if (!left || !right) return false;
    const oppositeChannels =
      (left.kind === "occupation-only" && right.kind === "keyword-only") ||
      (left.kind === "keyword-only" && right.kind === "occupation-only");
    return (
      oppositeChannels &&
      left.groupIds.some((groupId) => right.groupIds.includes(groupId))
    );
  },
);
const groupUniqueVolumes = Object.fromEntries(
  groupSchema.options.map((groupId) => [
    groupId,
    collection.offers.filter(({ groups }) =>
      groups.some((group) => group.groupId === groupId),
    ).length,
  ]),
);
const channelDiagnostics = [
  "occupation-only",
  "keyword-only",
  "overlap",
] as const;
const relevanceByExclusiveDiscoveryStratum = Object.fromEntries(
  channelDiagnostics.map((channel) => {
    const channelRows = resolvedRows.filter(({ discoveryChannels }) => {
      const stratum = discoveryChannels.includes("overlap")
        ? "overlap"
        : discoveryChannels.includes("keyword-only") &&
            !discoveryChannels.includes("occupation-only")
          ? "keyword-only"
          : "occupation-only";
      return stratum === channel;
    });
    return [
      channel,
      {
        resolvedCount: channelRows.length,
        relevantCount: channelRows.filter(
          ({ llmAnnotation }) => llmAnnotation.relevantToGroup === true,
        ).length,
        relevanceRate:
          channelRows.length === 0
            ? null
            : channelRows.filter(
                ({ llmAnnotation }) => llmAnnotation.relevantToGroup === true,
              ).length / channelRows.length,
      },
    ];
  }),
);
const atomicQueryDiagnostics = collectionReport.queries.map((query) => {
  const rows = reference.rows.filter((row) =>
    row.queryIds.includes(query.queryId),
  );
  const resolved = rows.filter(
    ({ llmAnnotation }) => llmAnnotation.status === "classified",
  );
  const relevant = resolved.filter(
    ({ llmAnnotation }) => llmAnnotation.relevantToGroup === true,
  );
  return {
    queryId: query.queryId,
    kind: query.kind,
    groupIds: query.groupIds,
    sampleCount: rows.length,
    resolvedCount: resolved.length,
    relevantCount: relevant.length,
    relevanceRate:
      resolved.length === 0 ? null : relevant.length / resolved.length,
  };
});
const provenancePaths = [
  "scripts/collect-query-set-validation.ts",
  "scripts/merge-query-set-reference.ts",
  "scripts/evaluate-query-set-reference.ts",
  querySetPath,
  "docs/reference/query-set-annotation-protocol.md",
  "pnpm-lock.yaml",
] as const;
const provenanceContents = await Promise.all(
  provenancePaths.map(async (path) => ({
    path,
    content: await readFile(path, "utf8"),
  })),
);

const report = {
  reportVersion: reference.querySetVersion.startsWith("queries-2.")
    ? "query-set-validation-report-2.0.0"
    : "query-set-validation-report-1.0.0",
  evaluatedAt: new Date().toISOString(),
  gateStatus,
  querySetVersion: reference.querySetVersion,
  reference: {
    referenceSetVersion: reference.referenceSetVersion,
    annotationProtocolVersion: reference.annotationProtocolVersion,
    activationPolicyVersion: reference.activationPolicyVersion,
    methodology: reference.methodology,
    model: reference.model,
    reasoningEffort: reference.reasoningEffort,
    collectedAt: reference.collectedAt,
    rowCount: reference.rows.length,
    sourceSha256: reference.sourceSha256,
    annotationChunks: reference.annotationChunks,
    sha256: sha256(referenceContent),
  },
  collection: {
    collectedAt: collectionReport.collectedAt,
    queryCount: collectionReport.queryCount,
    completeQueries: collectionReport.completeQueries,
    overCapQueries: collectionReport.overCapQueries,
    incompleteQueries: collectionReport.incompleteQueries,
    totalReported: collectionReport.totalReported,
    uniqueOffers: collectionReport.uniqueOffers,
    quarantined: collectionReport.quarantined,
    warnings: collectionReport.warnings,
    sourceSha256: collectionReport.sourceSha256,
    sha256: sha256(collectionReportContent),
  },
  metrics,
  collectionGates,
  groups: groupResults,
  diagnostics: {
    groupUniqueVolumes,
    relevanceByExclusiveDiscoveryStratum,
    atomicQueryDiagnostics,
    falsePositiveReasons: Object.fromEntries(
      [
        ...new Set(
          reference.rows
            .map(({ llmAnnotation }) => llmAnnotation.falsePositiveReason)
            .filter((reason): reason is string => reason !== null),
        ),
      ]
        .sort()
        .map((reason) => [
          reason,
          reference.rows.filter(
            ({ llmAnnotation }) => llmAnnotation.falsePositiveReason === reason,
          ).length,
        ]),
    ),
    occupationKeywordOverlapPairCount: occupationKeywordOverlaps.length,
    occupationKeywordNonZeroOverlapPairCount: occupationKeywordOverlaps.filter(
      ({ intersection }) => intersection > 0,
    ).length,
    occupationKeywordMeanJaccard:
      occupationKeywordOverlaps.length === 0
        ? null
        : occupationKeywordOverlaps.reduce(
            (sum, { jaccard }) => sum + (jaccard ?? 0),
            0,
          ) / occupationKeywordOverlaps.length,
  },
  observedRequests: collectionReport.queries.map((query) => ({
    queryId: query.queryId,
    kind: query.kind,
    groupIds: query.groupIds,
    codeROME: query.codeROME,
    motsCles: query.motsCles,
    observedTotal: query.total,
    pages: query.pages,
    status: query.status,
  })),
  provenance: {
    nodeVersion: process.version,
    files: Object.fromEntries(
      provenanceContents.map(({ path, content }) => [path, sha256(content)]),
    ),
  },
  notes: [
    "Les textes et annotations détaillées restent locaux.",
    "La précision de pertinence est la part pertinente parmi les paires récupérées et résolues.",
    "L'échantillon de pertinence et les requêtes croisées ne mesurent pas la prévalence du marché.",
    "Une métrique non évaluable bloque l'activation.",
  ],
};

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

process.stdout.write(
  `Rapport query set : ${gateStatus}; ${reference.rows.length} annotations LLM A.\n`,
);
