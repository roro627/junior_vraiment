import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { z } from "zod";

import { classifyOffer } from "../src/domain/classification/classifier";
import type { NormalizedOffer } from "../src/domain/offers/normalized-offer";

const statusSchema = z.enum(["classified", "ambiguous", "unclassified"]);
const nullableBoolean = z.boolean().nullable();
const nullableMonths = z.number().int().nonnegative().nullable();
const classificationSchema = z.object({
  status: statusSchema,
  claimsJunior: nullableBoolean,
  minimumExperienceMonths: nullableMonths,
  beginnerFriendly: nullableBoolean,
  contradictoryJunior: nullableBoolean,
});
const annotatedClassificationSchema = classificationSchema.extend({
  rationale: z.string().min(1),
  evidenceExcerpts: z.array(z.string().min(1)).min(1),
});
const evidenceSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  juniorClaim: z.number().int().nonnegative(),
  requiredExperience: z.number().int().nonnegative(),
  beginnerAcceptance: z.number().int().nonnegative(),
  requiredExperienceMonths: z.array(z.number().int().nonnegative()),
});
const classifierPredictionSchema = classificationSchema.extend({
  ruleIds: z.array(z.string().min(1)),
  evidenceCount: z.number().int().nonnegative(),
  evidenceSummary: evidenceSummarySchema,
});
const baselinePredictionSchema = classificationSchema.extend({
  ruleIds: z.array(z.string().min(1)),
});
const evaluatedRowSchema = z.object({
  reviewId: z.string().min(1),
  classifierPrediction: classifierPredictionSchema,
  llmAnnotation: annotatedClassificationSchema,
  reviewMethod: z.literal("llm-pass-a"),
  split: z.enum(["dev", "validation"]),
});
const annotationChunkSchema = z.object({
  fileName: z.string().min(1),
  rowCount: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
});
const splitDefinitionSchema = z.object({
  method: z.string().min(1),
  validationFraction: z.number().min(0).max(1),
  selection: z.string().min(1),
});

const representativeReferenceSchema = z.object({
  referenceSetVersion: z.string().min(1),
  annotationProtocolVersion: z.string().min(1),
  methodology: z.literal("single-blind-llm-pass-a-reference-set"),
  model: z.string().min(1),
  reasoningEffort: z.string().min(1),
  source: z.string().min(1),
  collectedAt: z.string().datetime(),
  classifierVersion: z.string().min(1),
  baselineClassifierVersion: z.string().min(1),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  annotationChunks: z.array(annotationChunkSchema).min(1),
  splitDefinition: splitDefinitionSchema,
  rows: z
    .array(
      evaluatedRowSchema.extend({
        baselinePrediction: baselinePredictionSchema,
      }),
    )
    .length(200),
});

const targetedReferenceSchema = z.object({
  referenceSetVersion: z.string().min(1),
  annotationProtocolVersion: z.string().min(1),
  methodology: z.literal("single-blind-llm-pass-a-targeted-challenge-set"),
  model: z.string().min(1),
  reasoningEffort: z.string().min(1),
  source: z.string().min(1),
  collectedAt: z.string().datetime(),
  classifierVersion: z.string().min(1),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  annotationChunks: z.array(annotationChunkSchema).min(1),
  splitDefinition: splitDefinitionSchema,
  selection: z.object({ marketPrevalenceEligible: z.literal(false) }),
  rows: z.array(evaluatedRowSchema).min(1),
});

const noExperienceFixtureSchema = z.object({
  fixtureId: z.string().min(1),
  title: z.string(),
  description: z.string(),
  experienceRequired: z.boolean().nullable(),
  experienceLabel: z.string().nullable(),
});

type Classification = z.infer<typeof classificationSchema>;
type ClassifierPrediction = z.infer<typeof classifierPredictionSchema>;
type GateStatus = "passed" | "failed" | "not_evaluable";

const comparedFields = [
  "status",
  "claimsJunior",
  "minimumExperienceMonths",
  "beginnerFriendly",
  "contradictoryJunior",
] as const;

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

function assertUniqueIds(label: string, rows: readonly { reviewId: string }[]) {
  const uniqueIds = new Set(rows.map(({ reviewId }) => reviewId));
  if (uniqueIds.size !== rows.length) {
    throw new Error(`${label} contient des reviewId dupliqués.`);
  }
  return uniqueIds;
}

function semanticEvidenceProblems(prediction: ClassifierPrediction): string[] {
  const problems: string[] = [];
  const evidence = prediction.evidenceSummary;

  if (prediction.evidenceCount !== evidence.total) {
    problems.push("evidence_count_mismatch");
  }
  if (prediction.claimsJunior === true && evidence.juniorClaim === 0) {
    problems.push("junior_claim_without_evidence");
  }
  if (
    prediction.minimumExperienceMonths !== null &&
    !evidence.requiredExperienceMonths.includes(
      prediction.minimumExperienceMonths,
    ) &&
    !(
      prediction.minimumExperienceMonths === 0 &&
      evidence.beginnerAcceptance > 0
    )
  ) {
    problems.push("resolved_experience_without_matching_evidence");
  }

  if (prediction.status === "unclassified") {
    if (
      prediction.claimsJunior !== null ||
      prediction.minimumExperienceMonths !== null ||
      prediction.beginnerFriendly !== null ||
      prediction.contradictoryJunior !== null
    ) {
      problems.push("unclassified_values_not_null");
    }
  } else if (prediction.status === "ambiguous") {
    if (
      prediction.beginnerFriendly !== null ||
      prediction.contradictoryJunior !== null
    ) {
      problems.push("ambiguous_derived_value_not_null");
    }
  } else {
    const expectedBeginnerFriendly =
      prediction.minimumExperienceMonths === null
        ? null
        : prediction.minimumExperienceMonths <= 12;
    const expectedContradictoryJunior =
      prediction.claimsJunior === null
        ? null
        : prediction.claimsJunior === false
          ? false
          : prediction.minimumExperienceMonths === null
            ? null
            : prediction.minimumExperienceMonths >= 24;
    if (prediction.beginnerFriendly !== expectedBeginnerFriendly) {
      problems.push("beginner_friendly_formula_mismatch");
    }
    if (prediction.contradictoryJunior !== expectedContradictoryJunior) {
      problems.push("contradiction_formula_mismatch");
    }
  }

  if (
    prediction.contradictoryJunior === true &&
    (evidence.juniorClaim === 0 || evidence.requiredExperience === 0)
  ) {
    problems.push("contradiction_without_both_evidence_types");
  }

  return problems;
}

function fixtureOffer(
  fixture: z.infer<typeof noExperienceFixtureSchema>,
): NormalizedOffer {
  return {
    source: "france-travail",
    externalId: fixture.fixtureId,
    title: fixture.title,
    descriptionText: fixture.description,
    companyName: null,
    publishedAt: null,
    updatedAt: null,
    location: {
      label: null,
      communeCode: null,
      departmentCode: null,
      regionCode: null,
      latitude: null,
      longitude: null,
    },
    contract: { sourceCode: null, normalized: "unknown", label: null },
    structuredExperience: {
      required: fixture.experienceRequired,
      label: fixture.experienceLabel,
    },
    salary: null,
    applicationUrl: null,
    sourceUrl: null,
    rawPayload: null,
  };
}

function statusConfusionMatrix(
  rows: readonly {
    classifierPrediction: Classification;
    llmAnnotation: Classification;
  }[],
) {
  return Object.fromEntries(
    statusSchema.options.map((referenceStatus) => [
      referenceStatus,
      Object.fromEntries(
        statusSchema.options.map((predictedStatus) => [
          predictedStatus,
          rows.filter(
            ({ classifierPrediction, llmAnnotation }) =>
              llmAnnotation.status === referenceStatus &&
              classifierPrediction.status === predictedStatus,
          ).length,
        ]),
      ),
    ]),
  );
}

const representativePath = ".local/agent-reviews/annotations-200.json";
const targetedPath = ".local/agent-reviews/targeted-junior-reference.json";
const noExperiencePath = "src/tests/fixtures/classifier/no-experience.json";
const provenancePaths = [
  "scripts/evaluate-classifier-reference.ts",
  "scripts/merge-agent-review-200.ts",
  "scripts/merge-targeted-reference.ts",
  "scripts/reference-annotation-validation.ts",
  "src/domain/classification/classifier.ts",
  "src/domain/classification/types.ts",
  "src/tests/fixtures/classifier/gold-v1.draft.json",
  noExperiencePath,
  "pnpm-lock.yaml",
] as const;
const [representativeContent, targetedContent, noExperienceContent] =
  await Promise.all([
    readFile(representativePath, "utf8"),
    readFile(targetedPath, "utf8"),
    readFile(noExperiencePath, "utf8"),
  ]);
const representative = representativeReferenceSchema.parse(
  JSON.parse(representativeContent) as unknown,
);
const targeted = targetedReferenceSchema.parse(
  JSON.parse(targetedContent) as unknown,
);
const noExperienceFixtures = z
  .array(noExperienceFixtureSchema)
  .min(1)
  .parse(JSON.parse(noExperienceContent) as unknown);

if (representative.classifierVersion !== targeted.classifierVersion) {
  throw new Error(
    `Versions classificateur incompatibles : ${representative.classifierVersion} et ${targeted.classifierVersion}.`,
  );
}

const representativeIds = assertUniqueIds(
  "Le corpus représentatif",
  representative.rows,
);
const targetedIds = assertUniqueIds("Le corpus ciblé", targeted.rows);
if ([...targetedIds].some((reviewId) => representativeIds.has(reviewId))) {
  throw new Error("Les corpus représentatif et ciblé se chevauchent.");
}

const representativeValidationRows = representative.rows.filter(
  ({ split }) => split === "validation",
);
const representativeDevRows = representative.rows.filter(
  ({ split }) => split === "dev",
);
const targetedValidationRows = targeted.rows.filter(
  ({ split }) => split === "validation",
);
if (
  representativeValidationRows.length === 0 ||
  representativeDevRows.length === 0 ||
  targetedValidationRows.length !== targeted.rows.length
) {
  throw new Error("Les partitions de référence sont invalides.");
}

let contradictionTruePositive = 0;
let contradictionFalsePositive = 0;
let contradictionFalseNegative = 0;
let contradictionTrueNegative = 0;
let experienceExact = 0;
let experiencePredicted = 0;
const allEvaluatedRows = [
  ...representativeValidationRows,
  ...targetedValidationRows,
];

for (const row of targetedValidationRows) {
  const predicted = row.classifierPrediction.contradictoryJunior === true;
  const reference = row.llmAnnotation.contradictoryJunior;
  if (reference === null) continue;
  if (predicted && reference) contradictionTruePositive += 1;
  else if (predicted) contradictionFalsePositive += 1;
  else if (reference) contradictionFalseNegative += 1;
  else contradictionTrueNegative += 1;
}

for (const row of representativeValidationRows) {
  const predictedExperience = row.classifierPrediction.minimumExperienceMonths;
  if (
    row.classifierPrediction.status === "classified" &&
    predictedExperience !== null
  ) {
    experiencePredicted += 1;
    if (predictedExperience === row.llmAnnotation.minimumExperienceMonths) {
      experienceExact += 1;
    }
  }
}

const semanticViolations = allEvaluatedRows.flatMap((row) =>
  semanticEvidenceProblems(row.classifierPrediction).map((code) => ({
    reviewId: row.reviewId,
    code,
  })),
);
const positivePredictionRows = allEvaluatedRows.filter(
  ({ classifierPrediction: prediction }) =>
    prediction.claimsJunior === true ||
    prediction.minimumExperienceMonths !== null ||
    prediction.beginnerFriendly !== null ||
    prediction.contradictoryJunior !== null,
);
const positivePredictionsWithEvidence = positivePredictionRows.filter(
  ({ classifierPrediction: prediction }) =>
    prediction.ruleIds.length > 0 && prediction.evidenceCount > 0,
).length;

const noExperienceFailures = noExperienceFixtures.filter((fixture) => {
  const result = classifyOffer(fixtureOffer(fixture));
  return !(
    result.status === "classified" &&
    result.minimumExperienceMonths === 0 &&
    result.beginnerFriendly === true &&
    result.contradictoryJunior === false &&
    result.evidence.length > 0
  );
});

const contradictionPredictedPositive =
  contradictionTruePositive + contradictionFalsePositive;
const contradictionReferencePositive =
  contradictionTruePositive + contradictionFalseNegative;
const metrics = {
  contradictoryJuniorPrecision: ratioMetric({
    numerator: contradictionTruePositive,
    denominator: contradictionPredictedPositive,
    threshold: 0.92,
    unavailableReason: "no_predicted_positive_in_targeted_challenge_set",
  }),
  contradictoryJuniorRecall: ratioMetric({
    numerator: contradictionTruePositive,
    denominator: contradictionReferencePositive,
    threshold: 0.85,
    unavailableReason: "no_reference_positive_in_targeted_challenge_set",
  }),
  resolvedRequiredExperienceExactPrecision: ratioMetric({
    numerator: experienceExact,
    denominator: experiencePredicted,
    threshold: 0.9,
    unavailableReason: "no_predicted_required_experience",
  }),
  positivePredictionEvidenceCoverage: ratioMetric({
    numerator: positivePredictionsWithEvidence,
    denominator: positivePredictionRows.length,
    threshold: 1,
    unavailableReason: "no_positive_prediction",
  }),
  semanticEvidenceIntegrity: ratioMetric({
    numerator:
      allEvaluatedRows.length -
      new Set(semanticViolations.map(({ reviewId }) => reviewId)).size,
    denominator: allEvaluatedRows.length,
    threshold: 1,
    unavailableReason: "no_evaluated_row",
  }),
  noExperienceFalsePositiveProtection: ratioMetric({
    numerator: noExperienceFixtures.length - noExperienceFailures.length,
    denominator: noExperienceFixtures.length,
    threshold: 1,
    unavailableReason: "no_no_experience_fixture",
  }),
};
const gateStatus = Object.values(metrics).every(
  ({ status }) => status === "passed",
)
  ? "passed"
  : "blocked";

const baselineChangedRows = representative.rows.filter((row) =>
  comparedFields.some(
    (field) =>
      row.baselinePrediction[field] !== row.classifierPrediction[field],
  ),
);
const fieldDeltas = Object.fromEntries(
  comparedFields.map((field) => [
    field,
    {
      changed: representative.rows.filter(
        (row) =>
          row.baselinePrediction[field] !== row.classifierPrediction[field],
      ).length,
      baselineValidationMatches: representativeValidationRows.filter(
        (row) => row.baselinePrediction[field] === row.llmAnnotation[field],
      ).length,
      currentValidationMatches: representativeValidationRows.filter(
        (row) => row.classifierPrediction[field] === row.llmAnnotation[field],
      ).length,
      validationRows: representativeValidationRows.length,
    },
  ]),
);
const precision = metrics.contradictoryJuniorPrecision.value;
const recall = metrics.contradictoryJuniorRecall.value;
const f1 =
  precision === null || recall === null || precision + recall === 0
    ? null
    : (2 * precision * recall) / (precision + recall);
const provenanceContents = await Promise.all(
  provenancePaths.map(async (path) => ({
    path,
    content: await readFile(path, "utf8"),
  })),
);
const packageMetadata = z
  .object({ packageManager: z.string().min(1) })
  .parse(JSON.parse(await readFile("package.json", "utf8")) as unknown);

const report = {
  reportVersion: "classifier-validation-report-1.2.0",
  evaluatedAt: new Date().toISOString(),
  gateStatus,
  representativeReference: {
    referenceSetVersion: representative.referenceSetVersion,
    annotationProtocolVersion: representative.annotationProtocolVersion,
    methodology: representative.methodology,
    model: representative.model,
    reasoningEffort: representative.reasoningEffort,
    classifierVersion: representative.classifierVersion,
    baselineClassifierVersion: representative.baselineClassifierVersion,
    collectedAt: representative.collectedAt,
    rowCount: representative.rows.length,
    devRowCount: representativeDevRows.length,
    validationRowCount: representativeValidationRows.length,
    sourceSha256: representative.sourceSha256,
    annotationChunks: representative.annotationChunks,
    splitDefinition: representative.splitDefinition,
    sha256: sha256(representativeContent),
  },
  targetedChallengeReference: {
    referenceSetVersion: targeted.referenceSetVersion,
    annotationProtocolVersion: targeted.annotationProtocolVersion,
    methodology: targeted.methodology,
    model: targeted.model,
    reasoningEffort: targeted.reasoningEffort,
    classifierVersion: targeted.classifierVersion,
    collectedAt: targeted.collectedAt,
    rowCount: targeted.rows.length,
    validationRowCount: targetedValidationRows.length,
    marketPrevalenceEligible: targeted.selection.marketPrevalenceEligible,
    sourceSha256: targeted.sourceSha256,
    annotationChunks: targeted.annotationChunks,
    splitDefinition: targeted.splitDefinition,
    sha256: sha256(targetedContent),
  },
  coverage: {
    contradictionPredictedPositive,
    contradictionReferencePositive,
    experiencePredicted,
    positivePredictions: positivePredictionRows.length,
    positivePredictionsWithEvidence,
    representativeLlmEvidenceRows: representativeValidationRows.filter(
      ({ llmAnnotation }) => llmAnnotation.evidenceExcerpts.length > 0,
    ).length,
    targetedLlmEvidenceRows: targetedValidationRows.filter(
      ({ llmAnnotation }) => llmAnnotation.evidenceExcerpts.length > 0,
    ).length,
  },
  metrics,
  diagnostics: {
    contradictoryJuniorF1: f1,
    contradictoryJuniorConfusionMatrix: {
      truePositive: contradictionTruePositive,
      falsePositive: contradictionFalsePositive,
      falseNegative: contradictionFalseNegative,
      trueNegative: contradictionTrueNegative,
      nullReferenceExcluded:
        targetedValidationRows.length -
        contradictionTruePositive -
        contradictionFalsePositive -
        contradictionFalseNegative -
        contradictionTrueNegative,
    },
    statusConfusionMatrix: statusConfusionMatrix(allEvaluatedRows),
    semanticViolationCount: semanticViolations.length,
    semanticViolations,
    noExperienceFixtureCount: noExperienceFixtures.length,
    noExperienceFailureIds: noExperienceFailures.map(
      ({ fixtureId }) => fixtureId,
    ),
  },
  delta: {
    fromClassifierVersion: representative.baselineClassifierVersion,
    toClassifierVersion: representative.classifierVersion,
    changedRowCount: baselineChangedRows.length,
    changedReviewIds: baselineChangedRows.map(({ reviewId }) => reviewId),
    newAmbiguousReviewIds: representative.rows
      .filter(
        (row) =>
          row.baselinePrediction.status !== "ambiguous" &&
          row.classifierPrediction.status === "ambiguous",
      )
      .map(({ reviewId }) => reviewId),
    fieldDeltas,
  },
  provenance: {
    nodeVersion: process.version,
    packageManager: packageMetadata.packageManager,
    files: Object.fromEntries(
      provenanceContents.map(({ path, content }) => [path, sha256(content)]),
    ),
  },
  notes: [
    "Les corpus réels restent locaux et ne sont pas inclus dans ce rapport agrégé.",
    "Les reviewId publiés dans les deltas sont des identifiants opaques dérivés par hash.",
    "Un statut not_evaluable ne vaut ni zéro ni réussite.",
    "La précision d'expérience est mesurée uniquement sur le split représentatif de validation et les prédictions classées avec une durée résolue.",
    "Le complément junior ciblé sert uniquement à mesurer la contradiction et ne mesure jamais la prévalence du marché.",
  ],
};

await writeFile(
  "docs/reference/classifier-validation-report.json",
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

process.stdout.write(
  `Rapport classificateur : ${gateStatus}; ${representative.rows.length} offres représentatives et ${targeted.rows.length} offres ciblées annotées par un passage LLM A.\n`,
);
