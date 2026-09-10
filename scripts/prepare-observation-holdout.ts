import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { readDatabaseEnvironment } from "../src/lib/env";
import { readCurrentDataset } from "../src/db/queries/current-dataset";

const schema = z.strictObject({
  reviewId: z.string(),
  title: z.string(),
  description: z.string(),
  structuredExperienceRequired: z.boolean().nullable(),
  structuredExperienceLabel: z.string().nullable(),
});
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const redact = (text: string) =>
  text
    .replace(/https?:\/\/\S+/giu, "[URL]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu, "[EMAIL]")
    .replace(/(?:\+33|0)[\d .()-]{8,}/gu, "[TÉLÉPHONE]");
// Exclude the text itself, even if source IDs or structured fields changed.
const contentHash = (row: z.infer<typeof schema>) =>
  hash(
    `${row.title}\n${row.description}`
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/gu, " "),
  );

async function main() {
  const round = z.coerce
    .number()
    .int()
    .min(1)
    .max(7)
    .parse(
      process.argv.find((arg) => arg.startsWith("--round="))?.split("=")[1] ??
        1,
    );
  const excluded = new Set<string>();
  for (let batch = 1; batch <= 7; batch++) {
    const rows = z
      .array(schema)
      .parse(
        JSON.parse(
          await readFile(`.local/observation-v2/input-${batch}.json`, "utf8"),
        ),
      );
    for (const row of rows) excluded.add(contentHash(row));
  }
  for (let previous = 1; previous < round; previous++)
    for (let batch = 1; batch <= 5; batch++) {
      const rows = z
        .array(schema)
        .parse(
          JSON.parse(
            await readFile(
              `.local/observation-v2-holdout${previous === 1 ? "" : `-${previous}`}/input-${batch}.json`,
              "utf8",
            ),
          ),
        );
      for (const row of rows) excluded.add(contentHash(row));
    }
  const sql = neon(readDatabaseEnvironment().DATABASE_URL);
  const dataset = await readCurrentDataset(sql);
  const rows = z.array(schema).parse(
    await sql`
    select m.offer_id::text as "reviewId", s.title, s.description_text as description,
      s.structured_experience_required as "structuredExperienceRequired",
      s.structured_experience_label as "structuredExperienceLabel"
    from published_dataset_offers m join offer_snapshots s on s.id=m.snapshot_id
    where m.dataset_id=${dataset.datasetId} order by m.offer_id limit 20000`,
  );
  const selected: z.infer<typeof schema>[] = [];
  const seed = `observation-holdout-2026-09-10${round === 1 ? "" : `-round-${round}`}`;
  for (const original of rows.sort((a, b) =>
    hash(seed + a.reviewId).localeCompare(hash(seed + b.reviewId)),
  )) {
    const row = {
      ...original,
      reviewId: hash(original.reviewId).slice(0, 16),
      title: redact(original.title),
      description: redact(original.description),
      structuredExperienceLabel:
        original.structuredExperienceLabel === null
          ? null
          : redact(original.structuredExperienceLabel),
    };
    const fingerprint = contentHash(row);
    if (excluded.has(fingerprint)) continue;
    excluded.add(fingerprint);
    selected.push(row);
    if (selected.length === 200) break;
  }
  if (selected.length !== 200)
    throw new Error("Insufficient distinct holdout entries");
  const directory = `.local/observation-v2-holdout${round === 1 ? "" : `-${round}`}`;
  await mkdir(directory, { recursive: true });
  const implementation = await Promise.all(
    [
      "src/domain/classification/classifier.ts",
      "src/domain/classification/normalize-text.ts",
      "src/domain/classification/junior-observation.ts",
    ].map(async (file) => ({
      file,
      sha256: hash(await readFile(file, "utf8")),
    })),
  );
  await writeFile(
    `${directory}/manifest.json`,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        datasetVersion: dataset.datasetVersion,
        seed,
        implementation,
        count: 200,
        selection:
          "Hash-ranked current dataset; no predictions used; excludes development title/description hashes",
        model: "gpt-5.6-terra",
        effort: "medium",
        passes: 1,
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  for (let batch = 1; batch <= 5; batch++)
    await writeFile(
      `${directory}/input-${batch}.json`,
      JSON.stringify(selected.slice((batch - 1) * 40, batch * 40), null, 2),
      { flag: "wx" },
    );
  process.stdout.write(
    "Frozen 200 distinct holdout entries, 5 blinded batches.\n",
  );
}
main().catch(() => {
  process.stderr.write("Holdout preparation failed; details withheld.\n");
  process.exitCode = 1;
});
