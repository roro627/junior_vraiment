import type { NeonQueryFunction } from "@neondatabase/serverless";
import {
  purgeExpiredAuxiliaryData,
  readExpiredAuxiliaryData,
} from "@/db/retention";

export async function runRetention(input: {
  sql: NeonQueryFunction<false, false>;
  now: Date;
  signal?: AbortSignal;
}) {
  const summary = { rawPayloads: 0, validationErrors: 0, batches: 0 };
  // A bounded invocation can be resumed without re-deleting or duplicating audits.
  for (let batch = 0; batch < 100; batch += 1) {
    input.signal?.throwIfAborted();
    const result = await purgeExpiredAuxiliaryData(input);
    summary.rawPayloads += result.rawPayloads;
    summary.validationErrors += result.validationErrors;
    summary.batches += 1;
    if (result.rawPayloads === 0 && result.validationErrors === 0) break;
  }
  const remaining = await readExpiredAuxiliaryData(input.sql, input.now);
  if (remaining.rawPayloads + remaining.validationErrors > 0) {
    throw new Error("RETENTION_INCOMPLETE: relancer la maintenance bornée.");
  }
  return summary;
}
