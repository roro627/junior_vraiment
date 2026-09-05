import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { z } from "zod";

import { parseQuerySet } from "./collect-query-set-validation";

const reportSchema = z.object({
  reportVersion: z.literal("query-set-validation-report-2.0.0"),
  gateStatus: z.literal("passed"),
  querySetVersion: z.string().min(1),
  reference: z.object({
    activationPolicyVersion: z.literal("query-relevance-gate-1.0.0"),
    rowCount: z.number().int().min(240),
  }),
  collection: z.object({
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  }),
  metrics: z.object({
    resolvedCoverage: z.object({ status: z.literal("passed") }),
    overallRelevancePrecision: z.object({ status: z.literal("passed") }),
    annotationEvidenceCoverage: z.object({ status: z.literal("passed") }),
  }),
  groups: z.array(
    z.object({
      groupId: z.string().min(1),
      sampleSizeGate: z.object({ status: z.literal("passed") }),
      coverage: z.object({ status: z.literal("passed") }),
      precision: z.object({ status: z.literal("passed") }),
    }),
  ),
});

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

const candidatePath = "docs/reference/query-set.observed-v2-draft.json";
const reportPath = "docs/reference/query-set-v2-validation-report.json";
const activePath = "docs/reference/query-set.active.json";
const [candidateContent, reportContent] = await Promise.all([
  readFile(candidatePath, "utf8"),
  readFile(reportPath, "utf8"),
]);
const candidateRecord = z
  .record(z.string(), z.unknown())
  .parse(JSON.parse(candidateContent) as unknown);
const candidate = parseQuerySet(candidateRecord);
const report = reportSchema.parse(JSON.parse(reportContent) as unknown);

if (
  report.querySetVersion !== candidate.querySetVersion ||
  report.collection.sourceSha256 !== sha256(candidateContent)
) {
  throw new Error("Le rapport ne valide pas le candidat courant.");
}
if (report.groups.length !== candidate.groups.length) {
  throw new Error("Chaque groupe candidat doit posséder un gate validé.");
}

const candidateWithoutGate = Object.fromEntries(
  Object.entries(candidateRecord).filter(([key]) => key !== "activationGate"),
);
const activeQuerySet = {
  ...candidateWithoutGate,
  documentVersion: "2.0.0",
  status: "active",
  querySetVersion: "queries-2.0.0",
  groups: candidate.groups.map((group) => ({ ...group, enabled: true })),
  activation: {
    activatedAt: "2026-09-04",
    activationPolicyVersion: "query-relevance-gate-1.0.0",
    candidateQuerySetVersion: candidate.querySetVersion,
    candidateSha256: sha256(candidateContent),
    validationReport: "query-set-v2-validation-report.json",
    validationReportSha256: sha256(reportContent),
    allowedPromotionChanges: [
      "status",
      "querySetVersion",
      "groups[].enabled",
      "activation",
    ],
  },
};

await writeFile(
  activePath,
  `${JSON.stringify(activeQuerySet, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`Registre actif généré : ${activePath}.\n`);
