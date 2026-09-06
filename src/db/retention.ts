import type { NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";

const countsSchema = z.object({
  rawPayloads: z.number().int().nonnegative(),
  validationErrors: z.number().int().nonnegative(),
});

/** Purges auxiliary data only; published snapshots, evidence and counts survive. */
export async function purgeExpiredAuxiliaryData(input: {
  sql: NeonQueryFunction<false, false>;
  now: Date;
  batchSize?: number;
}) {
  const batchSize = z
    .number()
    .int()
    .min(1)
    .max(1000)
    .parse(input.batchSize ?? 500);
  const now = z.date().parse(input.now);
  const rows = await input.sql`
    with expired_snapshots as materialized (
      select id from offer_snapshots
      where raw_payload is not null and raw_payload_expires_at <= ${now}
      order by raw_payload_expires_at, id
      limit ${batchSize} for update skip locked
    ), cleared as (
      update offer_snapshots snapshot
      set raw_payload = null, raw_payload_expires_at = null
      from expired_snapshots expired where snapshot.id = expired.id
      returning snapshot.id
    ), expired_errors as materialized (
      select entry.ingestion_run_query_id, entry.range_start, entry.item_ordinal
      from ingestion_quarantine_entries entry
      join ingestion_run_queries query on query.id = entry.ingestion_run_query_id
      join ingestion_runs run on run.id = query.ingestion_run_id
      where entry.created_at < ${now}::timestamptz - interval '30 days'
        and run.status in ('succeeded', 'partial', 'failed', 'cancelled')
      order by entry.created_at, entry.ingestion_run_query_id, entry.range_start, entry.item_ordinal
      limit ${batchSize} for update of entry skip locked
    ), removed as (
      delete from ingestion_quarantine_entries entry using expired_errors expired
      where entry.ingestion_run_query_id = expired.ingestion_run_query_id
        and entry.range_start = expired.range_start and entry.item_ordinal = expired.item_ordinal
      returning entry.ingestion_run_query_id
    ), totals as (
      select (select count(*)::integer from cleared) as raw,
        (select count(*)::integer from removed) as errors
    ), audit as (
      insert into data_quality_events (severity, event_code, scope, message, details, is_public, created_at, resolved_at)
      select 'info', 'RETENTION_PURGED', 'maintenance',
        'Charges brutes expirées et diagnostics de validation purgés.',
        jsonb_build_object('rawPayloads', raw, 'validationErrors', errors), false, ${now}, ${now}
      from totals where raw + errors > 0
      returning id
    )
    select raw as "rawPayloads", errors as "validationErrors" from totals
  `;
  return countsSchema.parse(rows[0]);
}

export async function readExpiredAuxiliaryData(
  sql: NeonQueryFunction<false, false>,
  now: Date,
) {
  z.date().parse(now);
  const rows = await sql`
    select
      (select count(*)::integer from offer_snapshots
        where raw_payload is not null and raw_payload_expires_at <= ${now}) as "rawPayloads",
      (select count(*)::integer from ingestion_quarantine_entries entry
        join ingestion_run_queries query on query.id = entry.ingestion_run_query_id
        join ingestion_runs run on run.id = query.ingestion_run_id
        where entry.created_at < ${now}::timestamptz - interval '30 days'
          and run.status in ('succeeded', 'partial', 'failed', 'cancelled')) as "validationErrors"
  `;
  return countsSchema.parse(rows[0]);
}
