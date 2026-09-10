import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { readDatabaseEnvironment } from "../src/lib/env";
import { readCurrentDataset } from "../src/db/queries/current-dataset";

const inputSchema = z.object({
  reviewId: z.string(),
  title: z.string(),
  description: z.string(),
  structuredExperienceRequired: z.boolean().nullable(),
  structuredExperienceLabel: z.string().nullable(),
});
const redact = (value: string) =>
  value
    .replace(/https?:\/\/\S+/giu, "[URL]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu, "[EMAIL]")
    .replace(/(?:\+33|0)[\d .()-]{8,}/gu, "[TÉLÉPHONE]");
async function prepare() {
  const source = z
    .object({ rows: z.array(inputSchema).length(200) })
    .parse(
      JSON.parse(
        await readFile(".local/classifier-review-sample.json", "utf8"),
      ),
    );
  const sql = neon(readDatabaseEnvironment().DATABASE_URL);
  const dataset = await readCurrentDataset(sql);
  const challenge = z.array(inputSchema).parse(
    await sql`
    select m.offer_id::text as "reviewId", s.title, s.description_text as description,
      s.structured_experience_required as "structuredExperienceRequired",
      s.structured_experience_label as "structuredExperienceLabel"
    from published_dataset_offers m join offer_snapshots s on s.id=m.snapshot_id
    join classifications c on c.id=m.classification_id
    where m.dataset_id=${dataset.datasetId} and c.claims_junior=true and c.status='ambiguous'
      and s.source_published_at >= ${dataset.sourceCutoffAt}::timestamptz - interval '30 days'
    order by m.offer_id limit 100
  `,
  );
  const rows = [
    ...source.rows.map((row) => ({ ...row, cohort: "reference" })),
    ...challenge.map((row) => ({
      ...row,
      reviewId: createHash("sha256")
        .update(row.reviewId)
        .digest("hex")
        .slice(0, 16),
      cohort: "challenge",
    })),
  ].map((row) => ({
    ...row,
    title: redact(row.title),
    description: redact(row.description),
    structuredExperienceLabel:
      row.structuredExperienceLabel === null
        ? null
        : redact(row.structuredExperienceLabel),
  }));
  const directory = ".local/observation-v2";
  await mkdir(directory, { recursive: true });
  // Refuse to overwrite a frozen reference campaign.
  await writeFile(
    `${directory}/manifest.json`,
    JSON.stringify(
      {
        datasetVersion: dataset.datasetVersion,
        createdAt: new Date().toISOString(),
        rows: rows.map(({ reviewId, cohort }) => ({ reviewId, cohort })),
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  for (let start = 0; start < rows.length; start += 40) {
    const batch = rows
      .slice(start, start + 40)
      .map(
        ({
          reviewId,
          title,
          description,
          structuredExperienceRequired,
          structuredExperienceLabel,
        }) => ({
          reviewId,
          title,
          description,
          structuredExperienceRequired,
          structuredExperienceLabel,
        }),
      );
    await writeFile(
      `${directory}/input-${start / 40 + 1}.json`,
      JSON.stringify(batch, null, 2),
      { flag: "wx" },
    );
  }
  process.stdout.write(
    `Prepared ${rows.length} blinded rows in ${Math.ceil(rows.length / 40)} batches.\n`,
  );
}
prepare().catch(() => {
  process.stderr.write(
    "Reference preparation failed; source details withheld.\n",
  );
  process.exitCode = 1;
});
