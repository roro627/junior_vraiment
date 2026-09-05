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

const statusSchema = z.enum(["classified", "ambiguous", "unclassified"]);
const sourceRowSchema = z.strictObject({
  reviewId: z.string().min(1),
  title: z.string(),
  description: z.string(),
  structuredExperienceRequired: z.boolean().nullable(),
  structuredExperienceLabel: z.string().nullable(),
});
const sourceSchema = z.object({
  source: z.string().min(1),
  collectedAt: z.string().datetime(),
  annotationProtocolVersion: z.string().min(1),
  selection: z.object({
    purpose: z.string().min(1),
    grandDomainReference: z.string().min(1),
    keyword: z.string().min(1),
    marketPrevalenceEligible: z.literal(false),
  }),
  rows: z.array(sourceRowSchema).min(1),
});
const annotationSchema = z.strictObject({
  reviewId: z.string().min(1),
  status: statusSchema,
  claimsJunior: z.boolean().nullable(),
  minimumExperienceMonths: z.number().int().nonnegative().nullable(),
  beginnerFriendly: z.boolean().nullable(),
  contradictoryJunior: z.boolean().nullable(),
  rationale: z.string().min(1),
  evidenceExcerpts: z.array(z.string().min(1)).min(1),
});
const annotationFiles = [
  ["targeted-pass-a-001-010.json", 10],
  ["targeted-pass-a-011-020.json", 10],
  ["targeted-pass-a-021-030.json", 10],
  ["targeted-pass-a-031-040.json", 10],
  ["targeted-pass-a-041-046.json", 6],
] as const;

function normalizeEvidence(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("fr")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

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

const directory = ".local/agent-reviews";
const sourceContent = await readFile(
  `${directory}/targeted-junior-source.json`,
  "utf8",
);
const source = sourceSchema.parse(JSON.parse(sourceContent) as unknown);
const annotationChunks = await Promise.all(
  annotationFiles.map(async ([fileName, expectedLength]) => {
    const content = await readFile(`${directory}/${fileName}`, "utf8");
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
  }),
);
const annotations = annotationChunks.flatMap(({ rows }) => rows);
const annotationsById = new Map(
  annotations.map((annotation) => [annotation.reviewId, annotation]),
);

if (
  annotations.length !== source.rows.length ||
  annotationsById.size !== source.rows.length
) {
  throw new Error(
    `Le complément exige ${source.rows.length} annotations A uniques ; ${annotationsById.size} ont été trouvées.`,
  );
}

const rows = source.rows.map((sourceRow) => {
  const annotation = annotationsById.get(sourceRow.reviewId);
  if (!annotation) {
    throw new Error(`Annotation ciblée manquante : ${sourceRow.reviewId}.`);
  }
  assertReferenceAnnotationSemantics(sourceRow.reviewId, annotation);
  const evidenceSource = normalizeEvidence(
    [
      sourceRow.title,
      sourceRow.description,
      sourceRow.structuredExperienceLabel ?? "",
    ].join(" "),
  );
  if (
    annotation.evidenceExcerpts.some(
      (excerpt) => !evidenceSource.includes(normalizeEvidence(excerpt)),
    )
  ) {
    throw new Error(
      `Une preuve ciblée ne provient pas de la source : ${sourceRow.reviewId}.`,
    );
  }

  const classification = classifyOffer(classifierOffer(sourceRow));
  return {
    ...sourceRow,
    classifierPrediction: {
      status: classification.status,
      claimsJunior: classification.claimsJunior,
      minimumExperienceMonths: classification.minimumExperienceMonths,
      beginnerFriendly: classification.beginnerFriendly,
      contradictoryJunior: classification.contradictoryJunior,
      ruleIds: classification.ruleIds,
      evidenceCount: classification.evidence.length,
      evidenceSummary: summarizeClassificationEvidence(classification),
    },
    llmAnnotation: annotation,
    reviewMethod: "llm-pass-a",
    split: "validation",
  };
});

await writeFile(
  `${directory}/targeted-junior-reference.json`,
  `${JSON.stringify(
    {
      referenceSetVersion: "llm-gold-a-targeted-junior-1.0.0",
      annotationProtocolVersion: source.annotationProtocolVersion,
      methodology: "single-blind-llm-pass-a-targeted-challenge-set",
      model: "gpt-5.6-terra",
      reasoningEffort: "medium",
      source: source.source,
      collectedAt: source.collectedAt,
      classifierVersion: CLASSIFIER_VERSION,
      selection: source.selection,
      sourceSha256: createHash("sha256").update(sourceContent).digest("hex"),
      annotationChunks: annotationChunks.map(
        ({ fileName, rowCount, sha256 }) => ({
          fileName,
          rowCount,
          sha256,
        }),
      ),
      splitDefinition: {
        method: "dedicated-targeted-challenge-set",
        validationFraction: 1,
        selection: "all-rows",
      },
      rows,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

process.stdout.write(
  `Complément ciblé validé : ${rows.length} annotations LLM A uniques.\n`,
);
