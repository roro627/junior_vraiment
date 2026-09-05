import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { z } from "zod";

import { parseQuerySet } from "./collect-query-set-validation";

const passedMetricSchema = z.object({ status: z.literal("passed") });
const reportSchema = z.object({
  reportVersion: z.literal("query-set-validation-report-2.0.0"),
  gateStatus: z.literal("passed"),
  querySetVersion: z.literal("queries-2.0.0-observed-title-filtered-draft"),
  reference: z.object({
    activationPolicyVersion: z.literal("query-relevance-gate-1.0.0"),
    rowCount: z.number().int().min(240),
  }),
  metrics: z.object({
    resolvedCoverage: passedMetricSchema,
    overallRelevancePrecision: passedMetricSchema,
    annotationEvidenceCoverage: passedMetricSchema,
  }),
  collection: z.object({
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  }),
  groups: z
    .array(
      z.object({
        groupId: z.string().min(1),
        sampleCount: z.number().int().min(30),
        coverage: passedMetricSchema,
        precision: passedMetricSchema,
        sampleSizeGate: passedMetricSchema,
      }),
    )
    .length(8),
  collectionGates: z.object({
    paginationComplete: passedMetricSchema,
    quarantineEmpty: passedMetricSchema,
    contractWarningsEmpty: passedMetricSchema,
  }),
  provenance: z.object({
    files: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/u)),
  }),
});
const activeSchema = z.object({
  status: z.literal("active"),
  querySetVersion: z.literal("queries-2.0.0"),
  activation: z.object({
    activationPolicyVersion: z.literal("query-relevance-gate-1.0.0"),
    candidateQuerySetVersion: z.literal(
      "queries-2.0.0-observed-title-filtered-draft",
    ),
    candidateSha256: z.string().regex(/^[a-f0-9]{64}$/u),
    validationReport: z.literal("query-set-v2-validation-report.json"),
    validationReportSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  }),
});

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function semanticDefinition(querySet: ReturnType<typeof parseQuerySet>) {
  return {
    source: querySet.source,
    requestRules: querySet.requestRules,
    groups: querySet.groups.map((group) =>
      Object.fromEntries(
        Object.entries(group).filter(([key]) => key !== "enabled"),
      ),
    ),
  };
}

const candidatePath = "docs/reference/query-set.observed-v2-draft.json";
const reportPath = "docs/reference/query-set-v2-validation-report.json";
const activePath = "docs/reference/query-set.active.json";
const [candidateContent, reportContent, activeContent] = await Promise.all([
  readFile(candidatePath, "utf8"),
  readFile(reportPath, "utf8"),
  readFile(activePath, "utf8"),
]);
const candidate = parseQuerySet(JSON.parse(candidateContent) as unknown);
const report = reportSchema.parse(JSON.parse(reportContent) as unknown);
const activeRaw = JSON.parse(activeContent) as unknown;
const active = parseQuerySet(activeRaw);
const activeMetadata = activeSchema.parse(activeRaw);

if (
  report.collection.sourceSha256 !== sha256(candidateContent) ||
  activeMetadata.activation.candidateSha256 !== sha256(candidateContent) ||
  activeMetadata.activation.validationReportSha256 !== sha256(reportContent)
) {
  throw new Error("Les empreintes de promotion du query set sont invalides.");
}
if (
  JSON.stringify(semanticDefinition(candidate)) !==
  JSON.stringify(semanticDefinition(active))
) {
  throw new Error(
    "Le registre actif diffère sémantiquement du candidat validé.",
  );
}
if (active.groups.some(({ enabled }) => !enabled)) {
  throw new Error("Tous les groupes du registre actif doivent être activés.");
}
for (const [path, expectedHash] of Object.entries(report.provenance.files)) {
  const actualHash = sha256(await readFile(path, "utf8"));
  if (actualHash !== expectedHash) {
    throw new Error(
      `Le rapport query set est périmé pour ${path}. Régénérez la validation locale.`,
    );
  }
}

process.stdout.write(
  `Rapport query set vérifié pour ${activeMetadata.querySetVersion}.\n`,
);
