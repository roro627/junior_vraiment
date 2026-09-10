import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { readDatabaseEnvironment } from "../src/lib/env";
import { readCurrentDataset } from "../src/db/queries/current-dataset";
import { classifyOffer } from "../src/domain/classification/classifier";
import { CLASSIFIER_VERSION } from "../src/domain/classification/types";
import { resolveJuniorObservation } from "../src/domain/classification/junior-observation";
import { computeJuniorObservationMetric } from "../src/domain/metrics/junior-observation";
import { computeJuniorContradictionMetric } from "../src/domain/metrics/junior-contradiction";

const rowSchema = z.object({
  offerId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  required: z.boolean().nullable(),
  label: z.string().nullable(),
  status: z.enum(["classified", "ambiguous", "unclassified"]),
  claimsJunior: z.boolean().nullable(),
  minimumExperienceMonths: z.number().int().nonnegative().nullable(),
});

// This command only SELECTs frozen membership. Candidate results are never published.
async function audit() {
  const sql = neon(readDatabaseEnvironment().DATABASE_URL);
  const dataset = await readCurrentDataset(sql);
  const rows = z.array(rowSchema).parse(
    await sql`
    select m.offer_id as "offerId", s.title, s.description_text as description,
      s.structured_experience_required as required, s.structured_experience_label as label,
      c.status, c.claims_junior as "claimsJunior", c.minimum_experience_months as "minimumExperienceMonths"
    from published_dataset_offers m
    join offer_snapshots s on s.id = m.snapshot_id
    join classifications c on c.id = m.classification_id
    where m.dataset_id = ${dataset.datasetId}
      and s.source_published_at >= ${dataset.sourceCutoffAt}::timestamptz - interval '30 days'
    order by m.offer_id limit 50001
  `,
  );
  if (rows.length > 50000)
    throw new Error("Audit population exceeds the safe bound");
  const deltas: Array<Record<string, unknown>> = [];
  const candidate = rows.map((row) => {
    const result = classifyOffer({
      source: "france-travail",
      externalId: row.offerId,
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
      structuredExperience: { required: row.required, label: row.label },
      salary: null,
      applicationUrl: null,
      sourceUrl: null,
      rawPayload: null,
    });
    if (
      row.status !== result.status ||
      row.minimumExperienceMonths !== result.minimumExperienceMonths ||
      row.claimsJunior !== result.claimsJunior
    ) {
      deltas.push({
        reviewId: createHash("sha256")
          .update(row.offerId)
          .digest("hex")
          .slice(0, 16),
        before: {
          status: row.status,
          claimsJunior: row.claimsJunior,
          minimumExperienceMonths: row.minimumExperienceMonths,
        },
        after: {
          status: result.status,
          claimsJunior: result.claimsJunior,
          minimumExperienceMonths: result.minimumExperienceMonths,
        },
      });
    }
    return result;
  });
  const report = {
    kind: "read-only-candidate-audit",
    auditedAt: new Date().toISOString(),
    datasetVersion: dataset.datasetVersion,
    sourceCutoffAt: dataset.sourceCutoffAt.toISOString(),
    period: "30d",
    sourceClassifierVersion: dataset.classifierVersion,
    candidateClassifierVersion: CLASSIFIER_VERSION,
    populationCount: rows.length,
    before: computeJuniorContradictionMetric(rows),
    candidate: computeJuniorContradictionMetric(candidate),
    observationV2Candidate: computeJuniorObservationMetric(
      candidate.map(resolveJuniorObservation),
    ),
    changedCount: deltas.length,
    deltas,
    limitations: [
      "Not published; no database write.",
      "Experience/junior axes only; no salary or remote audit.",
      "No inference about market representativeness or classifier accuracy from these deltas.",
    ],
  };
  await mkdir(".local", { recursive: true });
  await writeFile(
    ".local/classifier-exclusion-audit.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  process.stdout.write(
    JSON.stringify({ ...report, deltas: undefined }, null, 2),
  );
}
audit().catch(() => {
  process.stderr.write(
    "Read-only classifier audit failed; connection and source details withheld.\n",
  );
  process.exitCode = 1;
});
