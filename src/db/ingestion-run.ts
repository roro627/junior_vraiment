import type { NeonQueryFunction } from "@neondatabase/serverless";

export const LIMITED_QUERY_SET_VERSION = "queries-m18-technical-probe-1.0.0";

export type LimitedIngestionRun = {
  sourceId: string;
  sourceQueryId: string;
  ingestionRunId: string;
  ingestionRunQueryId: string;
};

type BeginLimitedIngestionRunInput = {
  sql: NeonQueryFunction<false, false>;
  businessDate: string;
  triggerRunId: string;
  startedAt: Date;
  rangeSize: number;
};

export async function beginLimitedIngestionRun({
  sql,
  businessDate,
  triggerRunId,
  startedAt,
  rangeSize,
}: BeginLimitedIngestionRunInput): Promise<LimitedIngestionRun> {
  const definition = JSON.stringify({
    grandDomainReference: "M18",
    rangeSize,
    publicationEligible: false,
  });
  const rows = await sql`
    with upserted_source as (
      insert into sources (key, label, attribution_url, terms_url)
      values (
        'france-travail',
        'France Travail — API Offres d’emploi',
        'https://francetravail.io/produits-partages/catalogue/offres-emploi',
        'https://francetravail.io/produits-partages/documentation/conditions-dutilisation-api/licence-offres-emploi'
      )
      on conflict (key) do update set
        label = excluded.label,
        attribution_url = excluded.attribution_url,
        terms_url = excluded.terms_url,
        updated_at = ${startedAt}
      returning id
    ), upserted_query as (
      insert into source_queries (
        source_id,
        query_key,
        query_set_version,
        label,
        definition,
        territory_scope,
        enabled
      )
      select
        id,
        'm18-technical-probe',
        ${LIMITED_QUERY_SET_VERSION},
        'Grand domaine M18 — validation technique limitée',
        ${definition}::jsonb,
        'france',
        false
      from upserted_source
      on conflict (source_id, query_key, query_set_version) do update set
        definition = excluded.definition,
        label = excluded.label,
        territory_scope = excluded.territory_scope,
        enabled = false
      returning id
    ), inserted_run as (
      insert into ingestion_runs (
        source_id,
        business_date,
        query_set_version,
        mode,
        status,
        trigger_run_id,
        started_at
      )
      select
        source.id,
        ${businessDate},
        ${LIMITED_QUERY_SET_VERSION},
        'limited',
        'running',
        ${triggerRunId},
        ${startedAt}
      from upserted_source source
      on conflict (trigger_run_id) where trigger_run_id is not null do update set
        status = 'running',
        finished_at = null,
        requests_count = 0,
        offers_received = 0,
        offers_valid = 0,
        offers_quarantined = 0,
        offers_new = 0,
        offers_updated = 0,
        offers_marked_missing = 0,
        quality_summary = '{}'::jsonb,
        error_summary = '{}'::jsonb
      returning id, source_id
    ), inserted_run_query as (
      insert into ingestion_run_queries (
        ingestion_run_id,
        source_query_id,
        status,
        started_at
      )
      select run.id, query.id, 'running', ${startedAt}
      from inserted_run run
      cross join upserted_query query
      on conflict (ingestion_run_id, source_query_id) do update set
        status = 'running',
        pages_received = 0,
        offers_received = 0,
        request_count = 0,
        checkpoint = '{}'::jsonb,
        error_summary = '{}'::jsonb,
        finished_at = null
      returning id, ingestion_run_id, source_query_id
    )
    select
      inserted_run.source_id as "sourceId",
      inserted_run_query.source_query_id as "sourceQueryId",
      inserted_run.id as "ingestionRunId",
      inserted_run_query.id as "ingestionRunQueryId"
    from inserted_run
    join inserted_run_query
      on inserted_run_query.ingestion_run_id = inserted_run.id
  `;
  const row = rows.at(0);

  if (
    !row ||
    typeof row["sourceId"] !== "string" ||
    typeof row["sourceQueryId"] !== "string" ||
    typeof row["ingestionRunId"] !== "string" ||
    typeof row["ingestionRunQueryId"] !== "string"
  ) {
    throw new Error("Le run d’ingestion limitée n’a pas pu être créé.");
  }

  return {
    sourceId: row["sourceId"],
    sourceQueryId: row["sourceQueryId"],
    ingestionRunId: row["ingestionRunId"],
    ingestionRunQueryId: row["ingestionRunQueryId"],
  };
}

type CheckpointInput = {
  sql: NeonQueryFunction<false, false>;
  run: LimitedIngestionRun;
  pagesReceived: number;
  offersReceived: number;
  offersValid: number;
  offersQuarantined: number;
  requestsCount: number;
  offersNew: number;
  offersUpdated: number;
  nextRangeStart: number | null;
};

export async function checkpointLimitedIngestion({
  sql,
  run,
  pagesReceived,
  offersReceived,
  offersValid,
  offersQuarantined,
  requestsCount,
  offersNew,
  offersUpdated,
  nextRangeStart,
}: CheckpointInput): Promise<void> {
  const checkpoint = JSON.stringify({ nextRangeStart });

  await sql.transaction([
    sql`
      update ingestion_run_queries
      set
        pages_received = ${pagesReceived},
        offers_received = ${offersReceived},
        request_count = ${requestsCount},
        checkpoint = ${checkpoint}::jsonb
      where id = ${run.ingestionRunQueryId}
    `,
    sql`
      update ingestion_runs
      set
        requests_count = ${requestsCount},
        offers_received = ${offersReceived},
        offers_valid = ${offersValid},
        offers_quarantined = ${offersQuarantined},
        offers_new = ${offersNew},
        offers_updated = ${offersUpdated}
      where id = ${run.ingestionRunId}
    `,
  ]);
}

export async function storeOfferQueryMatch(input: {
  sql: NeonQueryFunction<false, false>;
  offerId: string;
  sourceQueryId: string;
  observedAt: Date;
  matchedJobFamilies?: string[];
}): Promise<void> {
  if (input.matchedJobFamilies?.length === 0)
    throw new Error("Une correspondance doit contenir une famille admise.");
  await input.sql`
    insert into offer_query_matches (
      offer_id, source_query_id, first_matched_at, last_matched_at, matched_job_families
    ) values (
      ${input.offerId}, ${input.sourceQueryId}, ${input.observedAt}, ${input.observedAt}, ${input.matchedJobFamilies ?? null}::text[]
    )
    on conflict (offer_id, source_query_id) do update set
      last_matched_at = excluded.last_matched_at,
      matched_job_families = excluded.matched_job_families
  `;
}

export async function completeLimitedIngestion(input: {
  sql: NeonQueryFunction<false, false>;
  run: LimitedIngestionRun;
  finishedAt: Date;
  partial: boolean;
  qualitySummary: Readonly<Record<string, unknown>>;
}): Promise<void> {
  const status = input.partial ? "partial" : "succeeded";
  const qualitySummary = JSON.stringify(input.qualitySummary);

  await input.sql.transaction([
    input.sql`
      update ingestion_run_queries
      set status = ${status}, finished_at = ${input.finishedAt}
      where id = ${input.run.ingestionRunQueryId}
    `,
    input.sql`
      update ingestion_runs
      set
        status = ${status},
        finished_at = ${input.finishedAt},
        quality_summary = ${qualitySummary}::jsonb
      where id = ${input.run.ingestionRunId}
    `,
  ]);
}

export async function failLimitedIngestion(input: {
  sql: NeonQueryFunction<false, false>;
  run: LimitedIngestionRun;
  finishedAt: Date;
  errorCode: string;
}): Promise<void> {
  const errorSummary = JSON.stringify({ code: input.errorCode });

  await input.sql.transaction([
    input.sql`
      update ingestion_run_queries
      set
        status = 'failed',
        finished_at = ${input.finishedAt},
        error_summary = ${errorSummary}::jsonb
      where id = ${input.run.ingestionRunQueryId}
    `,
    input.sql`
      update ingestion_runs
      set
        status = 'failed',
        finished_at = ${input.finishedAt},
        error_summary = ${errorSummary}::jsonb
      where id = ${input.run.ingestionRunId}
    `,
  ]);
}
