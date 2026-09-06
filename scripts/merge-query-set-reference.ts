import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

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
  "software",
  "ai-ml",
]);
const primaryFamilySchema = z.enum([
  ...groupSchema.options,
  "other-tech",
  "non-tech",
  "unclear",
]);
const falsePositiveReasonSchema = z.enum([
  "adjacent-role",
  "technology-mention-only",
  "training-only",
  "sales-or-recruitment",
  "management-only",
  "other-domain",
  "insufficient-context",
]);
const sourceRowSchema = z.strictObject({
  reviewId: z.string().min(1),
  groupId: groupSchema,
  jobFamilies: z.array(groupSchema).min(1),
  title: z.string(),
  description: z.string(),
  structuredExperienceRequired: z.boolean().nullable(),
  structuredExperienceLabel: z.string().nullable(),
  discoveryChannels: z
    .array(z.enum(["occupation-only", "keyword-only", "overlap"]))
    .min(1),
});
const sourceSchema = z.object({
  collectedAt: z.string().datetime(),
  querySetVersion: z.string().min(1),
  rows: z.array(sourceRowSchema).min(1),
});
const collectionReportSchema = z.object({
  collectedAt: z.string().datetime(),
  mode: z.literal("full"),
  querySetVersion: z.string().min(1),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  queryCount: z.number().int().positive(),
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
const annotationSchema = z.strictObject({
  reviewId: z.string().min(1),
  status: z.enum(["classified", "ambiguous"]),
  relevantToGroup: z.boolean().nullable(),
  primaryFamily: primaryFamilySchema,
  falsePositiveReason: falsePositiveReasonSchema.nullable(),
  rationale: z.string().min(1),
  evidenceExcerpts: z.array(z.string().min(1)).min(1),
});

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function normalizeEvidence(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("fr")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function assertAnnotationSemantics(
  annotation: z.infer<typeof annotationSchema>,
): void {
  const validClassified =
    annotation.status === "classified" &&
    annotation.relevantToGroup !== null &&
    annotation.primaryFamily !== "unclear" &&
    (annotation.relevantToGroup
      ? annotation.falsePositiveReason === null
      : annotation.falsePositiveReason !== null);
  const validAmbiguous =
    annotation.status === "ambiguous" &&
    annotation.relevantToGroup === null &&
    annotation.primaryFamily === "unclear" &&
    annotation.falsePositiveReason === "insufficient-context";

  if (!validClassified && !validAmbiguous) {
    throw new Error(
      `Annotation de pertinence incohérente : ${annotation.reviewId}.`,
    );
  }
}

const readArgument = (name: string, fallback: string): string =>
  process.argv
    .find((argument) => argument.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? fallback;
const directory = resolve(
  readArgument("--directory", ".local/query-set-validation"),
);
const querySetPath = resolve(
  readArgument("--query-set", "docs/reference/query-set.observed-draft.json"),
);
const [
  sourceContent,
  collectionReportContent,
  collectionContent,
  querySetContent,
] = await Promise.all([
  readFile(`${directory}/blind-sample.json`, "utf8"),
  readFile(`${directory}/report.json`, "utf8"),
  readFile(`${directory}/collection.redacted.json`, "utf8"),
  readFile(querySetPath, "utf8"),
]);
const source = sourceSchema.parse(JSON.parse(sourceContent) as unknown);
const collectionReport = collectionReportSchema.parse(
  JSON.parse(collectionReportContent) as unknown,
);
const collection = collectionSchema.parse(
  JSON.parse(collectionContent) as unknown,
);
if (
  source.collectedAt !== collectionReport.collectedAt ||
  source.collectedAt !== collection.collectedAt ||
  source.querySetVersion !== collectionReport.querySetVersion ||
  source.querySetVersion !== collection.querySetVersion ||
  collectionReport.sourceSha256 !== sha256(querySetContent)
) {
  throw new Error("Les artefacts source de pertinence ne correspondent pas.");
}

const annotationFiles = (await readdir(directory))
  .filter((fileName) => /^pass-a-\d{3}-\d{3}\.json$/u.test(fileName))
  .sort();
if (annotationFiles.length === 0) {
  throw new Error("Aucun fragment d'annotation LLM A n'est disponible.");
}

const chunks = await Promise.all(
  annotationFiles.map(async (fileName) => {
    const content = await readFile(`${directory}/${fileName}`, "utf8");
    const rows = z
      .array(annotationSchema)
      .min(1)
      .parse(JSON.parse(content) as unknown);
    return {
      fileName,
      rowCount: rows.length,
      sha256: sha256(content),
      rows,
    };
  }),
);
const annotations = chunks.flatMap(({ rows }) => rows);
const expectedIds = source.rows.map(({ reviewId }) => reviewId);
const actualIds = annotations.map(({ reviewId }) => reviewId);
if (JSON.stringify(expectedIds) !== JSON.stringify(actualIds)) {
  throw new Error(
    "Les identifiants ou l'ordre des annotations sont invalides.",
  );
}
const annotationIds = new Set(annotations.map(({ reviewId }) => reviewId));
if (annotationIds.size !== source.rows.length) {
  throw new Error("Les annotations de pertinence ne sont pas uniques.");
}
const annotationsById = new Map(
  annotations.map((annotation) => [annotation.reviewId, annotation]),
);
const queryIdsByReviewId = new Map<string, string[]>();
for (const offer of collection.offers) {
  for (const group of offer.groups) {
    if (queryIdsByReviewId.has(group.reviewId)) {
      throw new Error(`Association de requêtes dupliquée : ${group.reviewId}.`);
    }
    queryIdsByReviewId.set(group.reviewId, group.queryIds);
  }
}

const rows = source.rows.map((sourceRow) => {
  const annotation = annotationsById.get(sourceRow.reviewId);
  if (!annotation) {
    throw new Error(
      `Annotation de pertinence manquante : ${sourceRow.reviewId}.`,
    );
  }
  const queryIds = queryIdsByReviewId.get(sourceRow.reviewId);
  if (!queryIds) {
    throw new Error(
      `Association de requête manquante : ${sourceRow.reviewId}.`,
    );
  }
  assertAnnotationSemantics(annotation);
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
      `Une preuve de pertinence ne provient pas de la source : ${sourceRow.reviewId}.`,
    );
  }

  return {
    ...sourceRow,
    queryIds,
    llmAnnotation: annotation,
    reviewMethod: "llm-pass-a",
  };
});

await writeFile(
  `${directory}/reference.json`,
  `${JSON.stringify(
    {
      referenceSetVersion: source.querySetVersion.startsWith("queries-3.")
        ? "query-relevance-llm-a-reference-3.0.0"
        : source.querySetVersion.startsWith("queries-2.")
          ? "query-relevance-llm-a-reference-2.0.0"
          : "query-relevance-llm-a-reference-1.0.0",
      annotationProtocolVersion: source.querySetVersion.startsWith("queries-3.")
        ? "query-relevance-llm-a-2.0.0"
        : "query-relevance-llm-a-1.0.0",
      activationPolicyVersion: "query-relevance-gate-1.0.0",
      methodology: "single-blind-llm-pass-a-query-relevance",
      model: "gpt-5.6-terra",
      reasoningEffort: "medium",
      querySetVersion: collectionReport.querySetVersion,
      collectedAt: source.collectedAt,
      sourceSha256: sha256(sourceContent),
      collectionReportSha256: sha256(collectionReportContent),
      collectionSha256: sha256(collectionContent),
      querySetSourceSha256: collectionReport.sourceSha256,
      annotationChunks: chunks.map(
        ({ fileName, rowCount, sha256: chunkSha256 }) => ({
          fileName,
          rowCount,
          sha256: chunkSha256,
        }),
      ),
      rows,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

process.stdout.write(
  `Référence de pertinence validée : ${rows.length} annotations LLM A.\n`,
);
