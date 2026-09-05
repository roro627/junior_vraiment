import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { z } from "zod";

import { classifyOffer } from "../src/domain/classification/classifier";
import { CLASSIFIER_VERSION } from "../src/domain/classification/types";
import type { NormalizedOffer } from "../src/domain/offers/normalized-offer";
import {
  assertReferenceAnnotationSemantics,
  summarizeClassificationEvidence,
} from "./reference-annotation-validation";

const classificationStatusSchema = z.enum([
  "classified",
  "ambiguous",
  "unclassified",
]);

const annotationSchema = z.strictObject({
  reviewId: z.string().min(1),
  humanStatus: classificationStatusSchema,
  humanClaimsJunior: z.boolean().nullable(),
  humanMinimumExperienceMonths: z.number().int().min(0).max(120).nullable(),
  humanBeginnerFriendly: z.boolean().nullable(),
  humanContradictoryJunior: z.boolean().nullable(),
  rationale: z.string().min(1),
  evidenceExcerpts: z.array(z.string().min(1)).min(1),
});

const sourceRowSchema = z.object({
  reviewId: z.string().min(1),
  queryGroup: z.string().min(1),
  queryKeyword: z.string().min(1),
  title: z.string(),
  description: z.string(),
  structuredExperienceRequired: z.boolean().nullable(),
  structuredExperienceLabel: z.string().nullable(),
  predictedStatus: classificationStatusSchema,
  predictedClaimsJunior: z.boolean().nullable(),
  predictedMinimumExperienceMonths: z.number().int().nonnegative().nullable(),
  predictedBeginnerFriendly: z.boolean().nullable(),
  predictedContradictoryJunior: z.boolean().nullable(),
  predictedRuleIds: z.string(),
});

const sourceSchema = z.object({
  source: z.string().min(1),
  collectedAt: z.string().datetime(),
  classifierVersion: z.string().min(1),
  rows: z.array(sourceRowSchema).length(200),
});

const reviewDirectory = ".local/agent-reviews";
const initialPassAFiles = ["pass-a-01-10.json", "pass-a-11-20.json"] as const;
const remainingPassAFiles = [
  "single-021-040.json",
  "single-041-060.json",
  "single-061-080.json",
  "single-081-100.json",
  "single-101-120.json",
  "single-121-140.json",
  "single-141-160.json",
  "single-161-180.json",
  "single-181-200.json",
] as const;

const comparedFields = [
  ["status", "status", "humanStatus"],
  ["claimsJunior", "claimsJunior", "humanClaimsJunior"],
  [
    "minimumExperienceMonths",
    "minimumExperienceMonths",
    "humanMinimumExperienceMonths",
  ],
  ["beginnerFriendly", "beginnerFriendly", "humanBeginnerFriendly"],
  ["contradictoryJunior", "contradictoryJunior", "humanContradictoryJunior"],
] as const;

function classifierOffer(
  row: z.infer<typeof sourceRowSchema>,
): NormalizedOffer {
  return {
    source: "france-travail",
    externalId: row.reviewId,
    title: row.title,
    descriptionText: row.description,
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
      required: row.structuredExperienceRequired,
      label: row.structuredExperienceLabel,
    },
    salary: null,
    applicationUrl: null,
    sourceUrl: null,
    rawPayload: null,
  };
}

function normalizeEvidence(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("fr")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

async function readAnnotations(fileName: string, expectedLength: number) {
  const content = await readFile(`${reviewDirectory}/${fileName}`, "utf8");
  const rows = z
    .array(annotationSchema)
    .length(expectedLength)
    .parse(JSON.parse(content) as unknown);
  return {
    fileName,
    rowCount: rows.length,
    sha256: createHash("sha256").update(content).digest("hex"),
    rows,
  };
}

const sourceContent = await readFile(
  ".local/classifier-review-sample.json",
  "utf8",
);
const source = sourceSchema.parse(JSON.parse(sourceContent) as unknown);
const initialPassAChunks = await Promise.all(
  initialPassAFiles.map((fileName) => readAnnotations(fileName, 10)),
);
const remainingPassAChunks = await Promise.all(
  remainingPassAFiles.map((fileName) => readAnnotations(fileName, 20)),
);
const annotations = [
  ...initialPassAChunks.flatMap(({ rows }) => rows),
  ...remainingPassAChunks.flatMap(({ rows }) => rows),
];
const annotationChunks = [...initialPassAChunks, ...remainingPassAChunks].map(
  ({ fileName, rowCount, sha256 }) => ({ fileName, rowCount, sha256 }),
);
const annotationsById = new Map(
  annotations.map((annotation) => [annotation.reviewId, annotation]),
);
const rowsByQueryGroup = Map.groupBy(
  source.rows,
  ({ queryGroup }) => queryGroup,
);
const validationIds = new Set(
  [...rowsByQueryGroup.values()].flatMap((groupRows) =>
    groupRows
      .toSorted((left, right) => {
        const leftHash = createHash("sha256")
          .update(left.reviewId)
          .digest("hex");
        const rightHash = createHash("sha256")
          .update(right.reviewId)
          .digest("hex");
        return leftHash.localeCompare(rightHash);
      })
      .slice(-Math.max(1, Math.round(groupRows.length * 0.3)))
      .map(({ reviewId }) => reviewId),
  ),
);

if (annotationsById.size !== source.rows.length) {
  throw new Error(
    `Il faut 200 reviewId uniques ; ${annotationsById.size} ont été trouvés.`,
  );
}

const fieldMatchCounts = Object.fromEntries(
  comparedFields.map(([name]) => [name, 0]),
) as Record<(typeof comparedFields)[number][0], number>;
const evidenceErrors: string[] = [];

const rows = source.rows.map((sourceRow) => {
  const annotation = annotationsById.get(sourceRow.reviewId);
  if (!annotation) {
    throw new Error(`Annotation manquante pour ${sourceRow.reviewId}.`);
  }
  assertReferenceAnnotationSemantics(sourceRow.reviewId, {
    status: annotation.humanStatus,
    claimsJunior: annotation.humanClaimsJunior,
    minimumExperienceMonths: annotation.humanMinimumExperienceMonths,
    beginnerFriendly: annotation.humanBeginnerFriendly,
    contradictoryJunior: annotation.humanContradictoryJunior,
  });

  const evidenceSource = normalizeEvidence(
    [
      sourceRow.title,
      sourceRow.description,
      sourceRow.structuredExperienceLabel ?? "",
    ].join(" "),
  );
  const invalidEvidence = annotation.evidenceExcerpts.filter(
    (excerpt) => !evidenceSource.includes(normalizeEvidence(excerpt)),
  );
  if (invalidEvidence.length > 0) {
    evidenceErrors.push(
      `${sourceRow.reviewId}: ${invalidEvidence.join(" | ")}`,
    );
  }

  const classification = classifyOffer(classifierOffer(sourceRow));
  const evidenceSummary = summarizeClassificationEvidence(classification);
  const mismatchedFields = comparedFields
    .filter(([name, predictedField, annotatedField]) => {
      const matches =
        classification[predictedField] === annotation[annotatedField];
      if (matches) {
        fieldMatchCounts[name] += 1;
      }
      return !matches;
    })
    .map(([name]) => name);

  return {
    reviewId: sourceRow.reviewId,
    queryGroup: sourceRow.queryGroup,
    queryKeyword: sourceRow.queryKeyword,
    title: sourceRow.title,
    description: sourceRow.description,
    structuredExperienceRequired: sourceRow.structuredExperienceRequired,
    structuredExperienceLabel: sourceRow.structuredExperienceLabel,
    classifierPrediction: {
      status: classification.status,
      claimsJunior: classification.claimsJunior,
      minimumExperienceMonths: classification.minimumExperienceMonths,
      beginnerFriendly: classification.beginnerFriendly,
      contradictoryJunior: classification.contradictoryJunior,
      ruleIds: classification.ruleIds,
      evidenceCount: classification.evidence.length,
      evidenceSummary,
    },
    baselinePrediction: {
      status: sourceRow.predictedStatus,
      claimsJunior: sourceRow.predictedClaimsJunior,
      minimumExperienceMonths: sourceRow.predictedMinimumExperienceMonths,
      beginnerFriendly: sourceRow.predictedBeginnerFriendly,
      contradictoryJunior: sourceRow.predictedContradictoryJunior,
      ruleIds: sourceRow.predictedRuleIds
        .split(",")
        .map((ruleId) => ruleId.trim())
        .filter(Boolean),
    },
    llmAnnotation: {
      status: annotation.humanStatus,
      claimsJunior: annotation.humanClaimsJunior,
      minimumExperienceMonths: annotation.humanMinimumExperienceMonths,
      beginnerFriendly: annotation.humanBeginnerFriendly,
      contradictoryJunior: annotation.humanContradictoryJunior,
      rationale: annotation.rationale,
      evidenceExcerpts: annotation.evidenceExcerpts,
    },
    reviewMethod: "llm-pass-a",
    split: validationIds.has(sourceRow.reviewId) ? "validation" : "dev",
    exactClassifierMatch: mismatchedFields.length === 0,
    classifierMismatchedFields: mismatchedFields,
  };
});

if (evidenceErrors.length > 0) {
  throw new Error(
    `Preuves absentes du texte source (${evidenceErrors.length}):\n${evidenceErrors.join("\n")}`,
  );
}

const exactClassifierMatchCount = rows.filter(
  ({ exactClassifierMatch }) => exactClassifierMatch,
).length;
const statusCounts = classificationStatusSchema.options.map((status) => ({
  status,
  count: rows.filter((row) => row.llmAnnotation.status === status).length,
}));

await writeFile(
  `${reviewDirectory}/annotations-200.json`,
  JSON.stringify(
    {
      referenceSetVersion: "llm-gold-a-1.0.0",
      annotationProtocolVersion: "llm-review-a-1.0.0",
      methodology: "single-blind-llm-pass-a-reference-set",
      model: "gpt-5.6-terra",
      reasoningEffort: "medium",
      source: source.source,
      collectedAt: source.collectedAt,
      classifierVersion: CLASSIFIER_VERSION,
      baselineClassifierVersion: source.classifierVersion,
      sourceSha256: createHash("sha256").update(sourceContent).digest("hex"),
      annotationChunks,
      splitDefinition: {
        method: "sha256-review-id-within-query-group",
        validationFraction: 0.3,
        selection: "highest-hashes",
      },
      summary: {
        total: rows.length,
        llmPassA: rows.length,
        dev: rows.filter(({ split }) => split === "dev").length,
        validation: rows.filter(({ split }) => split === "validation").length,
        exactClassifierMatchCount,
        fieldMatchCounts,
        statusCounts,
      },
      rows,
    },
    null,
    2,
  ),
  "utf8",
);

process.stdout.write(
  `Annotations validées structurellement : ${rows.length}/200. Correspondances exactes avec le classificateur : ${exactClassifierMatchCount}/200.\n`,
);
