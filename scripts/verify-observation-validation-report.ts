import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { CLASSIFIER_VERSION } from "../src/domain/classification/types";

async function verify() {
  const report = z
    .object({
      classifierVersion: z.literal(CLASSIFIER_VERSION),
      gateStatus: z.literal("passed"),
      precision: z.number().min(0.92),
      recall: z.number().min(0.85),
      summary: z.object({
        reference: z.object({ count: z.number().min(200) }),
      }),
      denominator: z.object({
        precision: z.number().min(0.92),
        recall: z.number().min(0.85),
      }),
      implementation: z
        .array(z.object({ file: z.string(), sha256: z.string() }))
        .length(3),
    })
    .parse(
      JSON.parse(
        await readFile(
          "docs/reference/observation-v2-holdout-7-validation-report.json",
          "utf8",
        ),
      ),
    );
  for (const file of report.implementation)
    if (
      createHash("sha256")
        .update(await readFile(file.file))
        .digest("hex") !== file.sha256
    )
      throw new Error("Stale observation validation");
  process.stdout.write(
    `Observation and denominator validation verified for ${CLASSIFIER_VERSION}.\n`,
  );
}
verify().catch(() => {
  process.stderr.write(
    "Observation validation missing, stale, or below thresholds; do not activate v2.\n",
  );
  process.exitCode = 1;
});
