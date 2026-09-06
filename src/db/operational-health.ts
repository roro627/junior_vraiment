import type { NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";
import { OPERATIONAL_MESSAGES } from "@/domain/ingestion/operational-health";

const sampleSchema = z.object({
  members: z.number().int().nonnegative(),
  ambiguous: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});

export async function readComparableOperationalSamples(
  sql: NeonQueryFunction<false, false>,
  datasetId: string,
) {
  const rows = await sql`
    with current_dataset as (
      select dataset.*, run.business_date from published_datasets dataset
      join ingestion_runs run on run.id = dataset.ingestion_run_id
      where dataset.id = ${datasetId} and run.mode = 'full'
    ), candidates as (
      select distinct on (run.business_date) dataset.id, run.business_date,
        round(extract(epoch from (run.finished_at - run.started_at)) * 1000)::bigint::text as duration
      from published_datasets dataset
      join ingestion_runs run on run.id = dataset.ingestion_run_id
      join current_dataset current on dataset.source_id = current.source_id
        and dataset.query_set_version = current.query_set_version
        and dataset.classifier_version = current.classifier_version
      where dataset.status = 'published' and run.status = 'succeeded'
        and run.mode = 'full' and run.started_at is not null and run.finished_at is not null
        and run.business_date <= current.business_date
        and run.business_date >= current.business_date - 7
        and (run.business_date < current.business_date or dataset.id = current.id)
      order by run.business_date desc, dataset.published_at desc
      limit 8
    )
    select candidate.id, count(membership.offer_id)::integer as members,
      count(membership.offer_id) filter (where classification.status = 'ambiguous')::integer as ambiguous,
      candidate.duration as "durationMs"
    from candidates candidate
    left join published_dataset_offers membership on membership.dataset_id = candidate.id
    left join classifications classification on classification.id = membership.classification_id
    group by candidate.id, candidate.duration, candidate.business_date
    order by candidate.business_date desc
  `;
  const parsed = rows.map((row) => ({
    id: z.string().uuid().parse(row["id"]),
    ...sampleSchema.parse({ ...row, durationMs: Number(row["durationMs"]) }),
  }));
  return {
    current: parsed.find((row) => row.id === datasetId) ?? null,
    previous: parsed.filter((row) => row.id !== datasetId),
  };
}

export async function reconcileOperationalIncidents(input: {
  sql: NeonQueryFunction<false, false>;
  sourceId: string;
  reasons: readonly string[];
  now: Date;
}) {
  const reasons = [...new Set(input.reasons)];
  if (reasons.some((code) => !Object.hasOwn(OPERATIONAL_MESSAGES, code)))
    throw new Error("Unknown monitoring reason");
  const events = reasons.map((code) => ({
    code: `MONITOR_${code}`,
    message: OPERATIONAL_MESSAGES[code],
  }));
  // Serial task queue + atomic reconciliation: resolved incidents are kept, never overwritten.
  await input.sql`
    with desired as (select * from jsonb_to_recordset(${JSON.stringify(events)}::jsonb) as event(code text, message text)),
    resolved as (
      update data_quality_events set resolved_at = ${input.now}
      where scope = ${`monitor:${input.sourceId}`} and event_code like 'MONITOR_%'
        and resolved_at is null and event_code not in (select code from desired)
      returning id
    )
    insert into data_quality_events (severity, event_code, scope, message, is_public, created_at)
    select 'warning', desired.code, ${`monitor:${input.sourceId}`}, desired.message,
      desired.code <> 'MONITOR_DURATION_OVER_TWICE_SEVEN_DAY_MEDIAN', ${input.now}
    from desired where not exists (
      select 1 from data_quality_events existing
      where existing.scope = ${`monitor:${input.sourceId}`} and existing.event_code = desired.code and existing.resolved_at is null
    )
  `;
}
