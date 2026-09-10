import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";

const holdout = process.argv.includes("--holdout-4");
const directory = holdout
  ? ".local/observation-v2-holdout-4"
  : ".local/observation-v2";
const deltaSchema = z.array(
  z.object({ reviewId: z.string(), batch: z.number().int().min(1).max(7) }),
);
const deltas = deltaSchema.parse(
  JSON.parse(
    await readFile(
      `${directory}/deltas${holdout ? "-holdout-4" : ""}.json`,
      "utf8",
    ),
  ),
);
for (let batch = 1; batch <= (holdout ? 5 : 7); batch++) {
  const inputs = z
    .array(z.object({ reviewId: z.string() }).passthrough())
    .parse(
      JSON.parse(await readFile(`${directory}/input-${batch}.json`, "utf8")),
    );
  const selected = inputs.filter(({ reviewId }) =>
    deltas.some(
      (delta) => delta.batch === batch && delta.reviewId === reviewId,
    ),
  );
  await writeFile(
    `${directory}/review-input-${batch}.json`,
    JSON.stringify(selected, null, 2),
    { flag: "wx" },
  );
  process.stdout.write(
    `Review batch ${batch}: ${selected.length} entries, no predictions.\n`,
  );
}
