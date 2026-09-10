import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { classifyOffer } from "../src/domain/classification/classifier";
import { resolveJuniorObservation } from "../src/domain/classification/junior-observation";
import { CLASSIFIER_VERSION } from "../src/domain/classification/types";

const inputSchema = z.strictObject({
  reviewId: z.string(),
  title: z.string(),
  description: z.string(),
  structuredExperienceRequired: z.boolean().nullable(),
  structuredExperienceLabel: z.string().nullable(),
});
const proofSchema = z.strictObject({
  field: z.enum(["title", "description", "structuredExperienceLabel"]),
  excerpt: z.string().min(1),
});
const labelSchema = z.strictObject({
  reviewId: z.string(),
  claimsJunior: z.boolean().nullable(),
  observationStatus: z.enum(["resolved", "unknown", "ambiguous"]),
  contradictory: z.boolean().nullable(),
  beginnerFriendly: z.boolean().nullable(),
  rationale: z.string().min(1),
  juniorEvidence: z.array(proofSchema),
  experienceEvidence: z.array(proofSchema),
});
async function evaluate() {
  const holdout = process.argv.includes("--holdout");
  const round = z.coerce
    .number()
    .int()
    .min(1)
    .max(7)
    .parse(
      process.argv.find((arg) => arg.startsWith("--round="))?.split("=")[1] ??
        1,
    );
  const campaignSuffix = holdout
    ? `-holdout${round === 1 ? "" : `-${round}`}`
    : "";
  const directory = `.local/observation-v2${campaignSuffix}`;
  const reviewed = process.argv.includes("--reviewed");
  if (holdout && reviewed && round !== 4)
    throw new Error("Targeted holdout review is only prepared for round 4");
  if (holdout) {
    const manifest = z
      .object({
        implementation: z.array(
          z.object({ file: z.string(), sha256: z.string() }),
        ),
      })
      .parse(JSON.parse(await readFile(`${directory}/manifest.json`, "utf8")));
    for (const frozen of manifest.implementation)
      if (
        createHash("sha256")
          .update(await readFile(frozen.file))
          .digest("hex") !== frozen.sha256
      )
        throw new Error("The engine changed after the holdout was frozen");
  }
  const amendments: unknown[] = [];
  const deltas: unknown[] = [];
  const denominator = { tp: 0, fp: 0, fn: 0, tn: 0 };
  const cohorts = {
    reference: { tp: 0, fp: 0, fn: 0, tn: 0, count: 0, exact: 0 },
    challenge: { tp: 0, fp: 0, fn: 0, tn: 0, count: 0, exact: 0 },
  };
  const files: { file: string; sha256: string }[] = [];
  const seen = new Set<string>();
  const referenceContents = new Set<string>();
  let challengeExactOverlaps = 0;
  for (let batch = 1; batch <= (holdout ? 5 : 7); batch++) {
    const inputText = await readFile(
      `${directory}/input-${batch}.json`,
      "utf8",
    );
    const labelText = await readFile(
      `${directory}/labels-${batch}.json`,
      "utf8",
    );
    for (const [file, content] of [
      [`input-${batch}.json`, inputText],
      [`labels-${batch}.json`, labelText],
    ] as const)
      files.push({
        file,
        sha256: createHash("sha256").update(content).digest("hex"),
      });
    const inputs = z.array(inputSchema).length(40).parse(JSON.parse(inputText));
    let labels = z.array(labelSchema).length(40).parse(JSON.parse(labelText));
    if (reviewed) {
      const reviewFile = `review-${batch}.json`;
      const reviewText = await readFile(`${directory}/${reviewFile}`, "utf8");
      files.push({
        file: reviewFile,
        sha256: createHash("sha256").update(reviewText).digest("hex"),
      });
      const review = z
        .array(labelSchema.extend({ reviewNote: z.string().min(1) }))
        .parse(JSON.parse(reviewText));
      const selected = z
        .array(inputSchema)
        .parse(
          JSON.parse(
            await readFile(`${directory}/review-input-${batch}.json`, "utf8"),
          ),
        );
      if (
        review.length !== selected.length ||
        new Set(review.map(({ reviewId }) => reviewId)).size !==
          review.length ||
        review.some(
          ({ reviewId }) =>
            !selected.some((input) => input.reviewId === reviewId),
        )
      )
        throw new Error(`Invalid targeted review identities in batch ${batch}`);
      labels = labels.map((original) => {
        const revision = review.find(
          ({ reviewId }) => reviewId === original.reviewId,
        );
        if (!revision) return original;
        const { reviewNote, ...label } = revision;
        amendments.push({
          reviewId: original.reviewId,
          batch,
          original,
          reviewed: label,
          reviewNote,
        });
        return label;
      });
    }
    const stats = batch <= 5 ? cohorts.reference : cohorts.challenge;
    for (const input of inputs) {
      const content = {
        title: input.title,
        description: input.description,
        structuredExperienceRequired: input.structuredExperienceRequired,
        structuredExperienceLabel: input.structuredExperienceLabel,
      };
      const contentHash = createHash("sha256")
        .update(JSON.stringify(content))
        .digest("hex");
      if (batch <= 5) referenceContents.add(contentHash);
      else if (referenceContents.has(contentHash)) challengeExactOverlaps++;
      const label = labels.find((row) => row.reviewId === input.reviewId);
      if (
        !label ||
        seen.has(input.reviewId) ||
        labels.filter((row) => row.reviewId === input.reviewId).length !== 1
      )
        throw new Error(`Invalid identity in batch ${batch}`);
      seen.add(input.reviewId);
      for (const proof of [
        ...label.juniorEvidence,
        ...label.experienceEvidence,
      ])
        if (!(input[proof.field] ?? "").includes(proof.excerpt))
          throw new Error(
            `Non-source proof: batch ${batch}, ${input.reviewId}`,
          );
      if (
        (label.observationStatus === "resolved") !==
        (label.contradictory !== null)
      )
        throw new Error(`Invalid resolution: ${input.reviewId}`);
      if (
        label.observationStatus === "resolved" &&
        (label.claimsJunior !== true || label.juniorEvidence.length === 0)
      )
        throw new Error(`Missing junior proof: ${input.reviewId}`);
      if (label.contradictory === true && label.experienceEvidence.length === 0)
        throw new Error(`Missing duration proof: ${input.reviewId}`);
      const classified = classifyOffer({
        source: "france-travail",
        externalId: input.reviewId,
        title: input.title,
        descriptionText: input.description,
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
          required: input.structuredExperienceRequired,
          label: input.structuredExperienceLabel,
        },
        salary: null,
        applicationUrl: null,
        sourceUrl: null,
        rawPayload: null,
      });
      const prediction = resolveJuniorObservation(classified);
      const positive = prediction.contradictory === true;
      const expected = label.contradictory === true;
      const included =
        prediction.claimsJunior === true && prediction.status === "resolved";
      const expectedIncluded =
        label.claimsJunior === true && label.observationStatus === "resolved";
      denominator[
        included
          ? expectedIncluded
            ? "tp"
            : "fp"
          : expectedIncluded
            ? "fn"
            : "tn"
      ]++;
      stats[positive ? (expected ? "tp" : "fp") : expected ? "fn" : "tn"] += 1;
      stats.count++;
      const exact =
        prediction.claimsJunior === label.claimsJunior &&
        prediction.status === label.observationStatus &&
        prediction.contradictory === label.contradictory;
      if (exact) stats.exact++;
      else
        deltas.push({
          reviewId: input.reviewId,
          batch,
          expected: {
            claimsJunior: label.claimsJunior,
            status: label.observationStatus,
            contradictory: label.contradictory,
          },
          predicted: {
            claimsJunior: prediction.claimsJunior,
            status: prediction.status,
            contradictory: prediction.contradictory,
          },
          warnings: classified.warnings.map(({ code }) => code),
          requiredEvidence: classified.evidence.filter(
            ({ kind }) => kind === "required_experience",
          ),
        });
    }
  }
  const summary = Object.fromEntries(
    Object.entries(cohorts).map(([name, s]) => [
      name,
      {
        ...s,
        precision: s.tp + s.fp ? s.tp / (s.tp + s.fp) : null,
        recall: s.tp + s.fn ? s.tp / (s.tp + s.fn) : null,
      },
    ]),
  );
  const tp = cohorts.reference.tp + cohorts.challenge.tp,
    fp = cohorts.reference.fp + cohorts.challenge.fp,
    fn = cohorts.reference.fn + cohorts.challenge.fn;
  const precision = tp + fp ? tp / (tp + fp) : null,
    recall = tp + fn ? tp / (tp + fn) : null;
  const report = {
    classifierVersion: CLASSIFIER_VERSION,
    implementation: await Promise.all(
      [
        "src/domain/classification/classifier.ts",
        "src/domain/classification/normalize-text.ts",
        "src/domain/classification/junior-observation.ts",
      ].map(async (file) => ({
        file,
        sha256: createHash("sha256")
          .update(await readFile(file))
          .digest("hex"),
      })),
    ),
    protocol: "llm-observation-a-2.0.0",
    clarifications:
      holdout && round >= 3
        ? "docs/reference/observation-v2-holdout-clarifications.md"
        : null,
    model: "gpt-5.6-terra",
    effort: "medium",
    passes: 1,
    targetedReview: reviewed
      ? {
          authorizedAt: "2026-09-09",
          protocol: "docs/reference/observation-v2-targeted-review.md",
          entries: amendments.length,
          predictionsShown: false,
        }
      : null,
    evaluatedAt: new Date().toISOString(),
    summary,
    challengeExactOverlaps,
    precision,
    recall,
    denominator: {
      ...denominator,
      precision:
        denominator.tp + denominator.fp
          ? denominator.tp / (denominator.tp + denominator.fp)
          : null,
      recall:
        denominator.tp + denominator.fn
          ? denominator.tp / (denominator.tp + denominator.fn)
          : null,
    },
    gateStatus: Object.values(summary)
      .filter((cohort) => cohort.count > 0)
      .every(
        (cohort) =>
          cohort.precision !== null &&
          cohort.recall !== null &&
          cohort.precision >= 0.92 &&
          cohort.recall >= 0.85,
      )
      ? "passed"
      : "failed",
    files,
    limitations: holdout
      ? [
          "Blind single-pass LLM holdout, not human-certified truth.",
          "200 distinct current-dataset texts excluded from the development reference; not a nationally representative sample.",
          "Engine frozen before annotation; no prediction shown to annotators.",
          ...(reviewed
            ? [
                "Targeted adjudication of disagreements: original blind results retained separately; this is not an untouched single-pass holdout.",
              ]
            : []),
          "Passing a finite sample does not certify every offer or every axis.",
        ]
      : [
          "Single-pass LLM reference, not human-certified truth.",
          "Challenge sample is not prevalence-eligible.",
          "Reference sample inherited from the initial collection, not a nationally representative sample.",
          "Aggregate gates do not certify every axis or production readiness.",
          "Each cohort must meet its own thresholds; an aggregate cannot conceal a failing cohort.",
          "Labels include unresolved policy disagreements on senior positioning and absence versus negative evidence; do not treat them as certified truth.",
          "Candidate rules have been inspected against these labels: this is now a development reference, not an untouched holdout.",
        ],
  };
  const suffix = campaignSuffix + (reviewed ? "-reviewed" : "");
  await writeFile(
    `${directory}/deltas${suffix}.json`,
    JSON.stringify(deltas, null, 2),
  );
  if (reviewed)
    await writeFile(
      `${directory}/amendments.json`,
      JSON.stringify(amendments, null, 2),
    );
  await writeFile(
    `docs/reference/observation-v2${suffix}-validation-report.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  process.stdout.write(
    JSON.stringify({ ...report, files: undefined }, null, 2),
  );
  if (report.gateStatus !== "passed") process.exitCode = 1;
}
evaluate().catch((error) => {
  process.stderr.write(
    error instanceof Error ? `${error.message}\n` : "Evaluation failed\n",
  );
  process.exitCode = 1;
});
