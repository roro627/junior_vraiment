import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { z } from "zod";

import { CLASSIFIER_VERSION } from "../src/domain/classification/types";

const metricSchema = z.object({
  status: z.literal("passed"),
  value: z.number(),
  threshold: z.number(),
});
const reportSchema = z.object({
  reportVersion: z.literal("classifier-validation-report-1.2.0"),
  gateStatus: z.literal("passed"),
  representativeReference: z.object({
    classifierVersion: z.literal(CLASSIFIER_VERSION),
    rowCount: z.number().int().min(200),
    devRowCount: z.number().int().positive(),
    validationRowCount: z.number().int().positive(),
  }),
  targetedChallengeReference: z.object({
    classifierVersion: z.literal(CLASSIFIER_VERSION),
    rowCount: z.number().int().positive(),
    marketPrevalenceEligible: z.literal(false),
  }),
  metrics: z.object({
    contradictoryJuniorPrecision: metricSchema,
    contradictoryJuniorRecall: metricSchema,
    resolvedRequiredExperienceExactPrecision: metricSchema,
    positivePredictionEvidenceCoverage: metricSchema,
    semanticEvidenceIntegrity: metricSchema,
    noExperienceFalsePositiveProtection: metricSchema,
  }),
  diagnostics: z.object({
    semanticViolationCount: z.literal(0),
    noExperienceFixtureCount: z.number().int().positive(),
    noExperienceFailureIds: z.array(z.string()).length(0),
  }),
  delta: z.object({
    toClassifierVersion: z.literal(CLASSIFIER_VERSION),
    changedRowCount: z.number().int().nonnegative(),
    fieldDeltas: z.record(z.string(), z.object({ changed: z.number() })),
  }),
  provenance: z.object({
    files: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/u)),
  }),
});

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

const report = reportSchema.parse(
  JSON.parse(
    await readFile("docs/reference/classifier-validation-report.json", "utf8"),
  ) as unknown,
);

if (CLASSIFIER_VERSION.includes("draft")) {
  throw new Error(
    "Le rapport de lancement ne peut pas viser une version draft.",
  );
}

for (const [path, expectedHash] of Object.entries(report.provenance.files)) {
  const actualHash = sha256(await readFile(path, "utf8"));
  if (actualHash !== expectedHash) {
    throw new Error(
      `Le rapport classificateur est périmé pour ${path}. Régénérez-le avec pnpm classifier:validate:local.`,
    );
  }
}

process.stdout.write(
  `Rapport classificateur vérifié pour ${CLASSIFIER_VERSION}.\n`,
);
