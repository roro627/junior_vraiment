import type { NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";
import {
  assessPartitionVolumes,
  type PartitionVolume,
} from "@/domain/ingestion/volume-policy";

export class IngestionPaginationIncompleteError extends Error {
  override name = "IngestionPaginationIncompleteError";

  constructor() {
    super("La pagination complète de la requête n'est pas prouvée.");
  }
}

export class IngestionRecoveryNotAllowedError extends Error {
  override name = "IngestionRecoveryNotAllowedError";
  constructor() {
    super(
      "La tentative précédente doit être en échec ou annulée avant une recollecte.",
    );
  }
}

const checkpointSchema = z
  .strictObject({
    nextRangeStart: z.number().int().min(0).nullable(),
    sourceTotal: z.number().int().nonnegative().nullable(),
    offersValid: z.number().int().nonnegative(),
    offersQuarantined: z.number().int().nonnegative(),
    offersInPerimeter: z.number().int().nonnegative(),
    sourceWarnings: z.number().int().nonnegative(),
  })
  .nullable();

export type FullQueryRegistration = {
  queryKey: string;
  label: string;
  definition: Readonly<Record<string, unknown>>;
  jobFamilies: string[];
  territoryScope: string;
};

export type FullIngestionQueryState = {
  sourceQueryId: string;
  ingestionRunQueryId: string;
  queryKey: string;
  status: string;
  pagesReceived: number;
  offersReceived: number;
  requestCount: number;
  checkpoint: z.infer<typeof checkpointSchema>;
};

export type FullIngestionRun = {
  sourceId: string;
  ingestionRunId: string;
  status: string;
  startedAt: Date;
  queries: FullIngestionQueryState[];
};

type BeginFullIngestionRunInput = {
  sql: NeonQueryFunction<false, false>;
  businessDate: string;
  querySetVersion: string;
  triggerRunId: string;
  attempt: number;
  startedAt: Date;
  queries: FullQueryRegistration[];
};

function requiredString(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== "string") {
    throw new Error(`Le champ base ${field} est absent.`);
  }
  return value;
}

function requiredInteger(row: Record<string, unknown>, field: string): number {
  const value = row[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`Le compteur base ${field} est invalide.`);
  }
  return value;
}

function requiredDate(row: Record<string, unknown>, field: string): Date {
  const value = row[field];
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`La date base ${field} est invalide.`);
  }
  return parsed;
}

export async function beginFullIngestionRun({
  sql,
  businessDate,
  querySetVersion,
  triggerRunId,
  attempt,
  startedAt,
  queries,
}: BeginFullIngestionRunInput): Promise<FullIngestionRun> {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new RangeError("attempt doit être un entier supérieur ou égal à 1.");
  }
  if (queries.length === 0) {
    throw new Error("Le registre actif ne contient aucune requête.");
  }

  if (attempt > 1) {
    const previous = await sql`
      select run.id from ingestion_runs run
      join sources source on source.id = run.source_id
      where source.key = 'france-travail'
        and run.business_date = ${businessDate}
        and run.query_set_version = ${querySetVersion}
        and run.mode = 'full' and run.attempt = ${attempt - 1}
        and run.status in ('failed', 'cancelled')
    `;
    if (previous.length !== 1) throw new IngestionRecoveryNotAllowedError();
  }

  const runRows = await sql`
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
    ), upserted_run as (
      insert into ingestion_runs (
        source_id,
        business_date,
        query_set_version,
        mode,
        attempt,
        status,
        trigger_run_id,
        started_at
      )
      select
        id,
        ${businessDate},
        ${querySetVersion},
        'full',
        ${attempt},
        'running',
        ${triggerRunId},
        ${startedAt}
      from upserted_source
      on conflict (source_id, business_date, query_set_version, mode, attempt)
      do update set
        trigger_run_id = case
          when ingestion_runs.status in ('succeeded', 'partial')
            then ingestion_runs.trigger_run_id
          else excluded.trigger_run_id
        end,
        status = case
          when ingestion_runs.status in ('succeeded', 'partial')
            then ingestion_runs.status
          else 'running'
        end,
        started_at = coalesce(ingestion_runs.started_at, excluded.started_at),
        finished_at = case
          when ingestion_runs.status in ('succeeded', 'partial')
            then ingestion_runs.finished_at
          else null
        end,
        error_summary = case
          when ingestion_runs.status in ('succeeded', 'partial')
            then ingestion_runs.error_summary
          else '{}'::jsonb
        end
      returning id, source_id, status, started_at
    )
    select
      id as "ingestionRunId",
      source_id as "sourceId",
      status,
      started_at as "startedAt"
    from upserted_run
  `;
  const runRow = runRows.at(0);
  if (!runRow) throw new Error("Le run complet n'a pas pu être créé.");
  const ingestionRunId = requiredString(runRow, "ingestionRunId");
  const sourceId = requiredString(runRow, "sourceId");
  const status = requiredString(runRow, "status");
  const persistedStartedAt = requiredDate(runRow, "startedAt");

  const registrations = JSON.stringify(queries);
  await sql`
    with input as (
      select value as item
      from jsonb_array_elements(${registrations}::jsonb)
    )
    insert into source_queries (
      source_id,
      query_key,
      query_set_version,
      label,
      definition,
      job_families,
      territory_scope,
      enabled
    )
    select
      ${sourceId},
      item->>'queryKey',
      ${querySetVersion},
      item->>'label',
      item->'definition',
      array(select jsonb_array_elements_text(item->'jobFamilies')),
      item->>'territoryScope',
      true
    from input
    on conflict (source_id, query_key, query_set_version) do update set
      label = excluded.label,
      definition = excluded.definition,
      job_families = excluded.job_families,
      territory_scope = excluded.territory_scope,
      enabled = true,
      valid_to = null
  `;
  const queryRows = await sql`
    with upserted_run_queries as (
      insert into ingestion_run_queries (
        ingestion_run_id, source_query_id, status
      )
      select ${ingestionRunId}, source_query.id, 'queued'
      from source_queries source_query
      where source_query.source_id = ${sourceId}
        and source_query.query_set_version = ${querySetVersion}
        and source_query.query_key in (
          select item->>'queryKey'
          from jsonb_array_elements(${registrations}::jsonb) item
        )
      on conflict (ingestion_run_id, source_query_id) do update set
        status = case
          when ingestion_run_queries.status = 'succeeded'
            then ingestion_run_queries.status
          else 'queued'
        end,
        error_summary = case
          when ingestion_run_queries.status = 'succeeded'
            then ingestion_run_queries.error_summary
          else '{}'::jsonb
        end,
        finished_at = case
          when ingestion_run_queries.status = 'succeeded'
            then ingestion_run_queries.finished_at
          else null
        end
      returning id, source_query_id, status, pages_received,
        offers_received, request_count, checkpoint
    )
    select
      source_query.id as "sourceQueryId",
      run_query.id as "ingestionRunQueryId",
      source_query.query_key as "queryKey",
      run_query.status,
      run_query.pages_received as "pagesReceived",
      run_query.offers_received as "offersReceived",
      run_query.request_count as "requestCount",
      case
        when run_query.checkpoint = '{}'::jsonb then null
        else run_query.checkpoint
      end as checkpoint
    from upserted_run_queries run_query
    join source_queries source_query on source_query.id = run_query.source_query_id
    order by source_query.query_key
  `;
  if (queryRows.length !== queries.length) {
    throw new Error(
      `Le run contient ${queryRows.length} requêtes sur ${queries.length} attendues.`,
    );
  }

  return {
    sourceId,
    ingestionRunId,
    status,
    startedAt: persistedStartedAt,
    queries: queryRows.map((row) => ({
      sourceQueryId: requiredString(row, "sourceQueryId"),
      ingestionRunQueryId: requiredString(row, "ingestionRunQueryId"),
      queryKey: requiredString(row, "queryKey"),
      status: requiredString(row, "status"),
      pagesReceived: requiredInteger(row, "pagesReceived"),
      offersReceived: requiredInteger(row, "offersReceived"),
      requestCount: requiredInteger(row, "requestCount"),
      checkpoint: checkpointSchema.parse(row["checkpoint"]),
    })),
  };
}

export type FullQueryProgress = {
  pagesReceived: number;
  offersReceived: number;
  requestCount: number;
  nextRangeStart: number | null;
  sourceTotal: number | null;
  offersValid: number;
  offersQuarantined: number;
  offersInPerimeter: number;
  sourceWarnings: number;
};

export type FullQueryPageCommit = {
  rangeStart: number;
  nextRangeStart: number | null;
  isTerminal: boolean;
  sourceTotal: number;
  validCount: number;
  quarantined: ReadonlyArray<{
    itemOrdinal: number;
    issues: ReadonlyArray<{
      path: string;
      code: string;
      message: string;
    }>;
  }>;
  inPerimeterCount: number;
  warningCount: number;
  committedAt: Date;
};

export type FullIngestionQualityFacts = {
  paginationComplete: boolean;
  sourceCapReached: boolean;
  offersReceived: number;
  requestsCount: number;
  offersValid: number;
  offersQuarantined: number;
  offersInPerimeter: number;
  uniqueOffers: number;
  offersNew: number;
  offersUpdated: number;
  offersMarkedMissing: number;
  offersClosed: number | null;
  positiveClassifications: number;
  positiveClassificationsWithEvidence: number;
  volumeAnomalyDetected: boolean;
  volumeWarnings: PartitionVolume[];
};

export async function markFullQueryRunning(input: {
  sql: NeonQueryFunction<false, false>;
  ingestionRunQueryId: string;
  startedAt: Date;
}): Promise<boolean> {
  const rows = await input.sql`
    update ingestion_run_queries
    set status = 'running', started_at = coalesce(started_at, ${input.startedAt})
    where id = ${input.ingestionRunQueryId}
      and status <> 'succeeded'
    returning id
  `;
  return rows.length === 1;
}

export async function checkpointFullQuery(input: {
  sql: NeonQueryFunction<false, false>;
  ingestionRunId: string;
  ingestionRunQueryId: string;
  progress: FullQueryProgress;
}): Promise<void> {
  const checkpoint = JSON.stringify({
    nextRangeStart: input.progress.nextRangeStart,
    sourceTotal: input.progress.sourceTotal,
    offersValid: input.progress.offersValid,
    offersQuarantined: input.progress.offersQuarantined,
    offersInPerimeter: input.progress.offersInPerimeter,
    sourceWarnings: input.progress.sourceWarnings,
  });
  await input.sql.transaction([
    input.sql`
      update ingestion_run_queries
      set
        pages_received = ${input.progress.pagesReceived},
        offers_received = ${input.progress.offersReceived},
        request_count = ${input.progress.requestCount},
        checkpoint = ${checkpoint}::jsonb
      where id = ${input.ingestionRunQueryId}
    `,
    input.sql`
      update ingestion_runs run
      set
        requests_count = totals.requests_count,
        offers_received = totals.offers_received,
        offers_valid = totals.offers_valid,
        offers_quarantined = totals.offers_quarantined
      from (
        select
          coalesce(sum(request_count), 0)::integer as requests_count,
          coalesce(sum(offers_received), 0)::integer as offers_received,
          coalesce(sum((checkpoint->>'offersValid')::integer), 0)::integer as offers_valid,
          coalesce(sum((checkpoint->>'offersQuarantined')::integer), 0)::integer as offers_quarantined
        from ingestion_run_queries
        where ingestion_run_id = ${input.ingestionRunId}
      ) totals
      where run.id = ${input.ingestionRunId}
    `,
  ]);
}

export async function commitFullQueryPage(input: {
  sql: NeonQueryFunction<false, false>;
  ingestionRunId: string;
  ingestionRunQueryId: string;
  page: FullQueryPageCommit;
}): Promise<void> {
  const receivedCount = input.page.validCount + input.page.quarantined.length;
  const quarantineEntries = JSON.stringify(input.page.quarantined);
  await input.sql.transaction([
    input.sql`
      insert into ingestion_query_pages (
        ingestion_run_query_id,
        range_start,
        next_range_start,
        is_terminal,
        source_total,
        received_count,
        valid_count,
        quarantined_count,
        in_perimeter_count,
        warning_count,
        committed_at
      ) values (
        ${input.ingestionRunQueryId},
        ${input.page.rangeStart},
        ${input.page.nextRangeStart},
        ${input.page.isTerminal},
        ${input.page.sourceTotal},
        ${receivedCount},
        ${input.page.validCount},
        ${input.page.quarantined.length},
        ${input.page.inPerimeterCount},
        ${input.page.warningCount},
        ${input.page.committedAt}
      )
      on conflict (ingestion_run_query_id, range_start) do nothing
    `,
    input.sql`
      insert into ingestion_quarantine_entries (
        ingestion_run_query_id, range_start, item_ordinal, issues
      )
      select
        ${input.ingestionRunQueryId},
        ${input.page.rangeStart},
        (entry->>'itemOrdinal')::integer,
        entry->'issues'
      from jsonb_array_elements(${quarantineEntries}::jsonb) entry
      on conflict (ingestion_run_query_id, range_start, item_ordinal)
      do nothing
    `,
    input.sql`
      update ingestion_run_queries run_query
      set
        pages_received = totals.pages_received,
        offers_received = totals.offers_received,
        request_count = totals.pages_received,
        checkpoint = jsonb_build_object(
          'nextRangeStart', totals.next_range_start,
          'sourceTotal', totals.source_total,
          'offersValid', totals.offers_valid,
          'offersQuarantined', totals.offers_quarantined,
          'offersInPerimeter', totals.offers_in_perimeter,
          'sourceWarnings', totals.source_warnings
        )
      from (
        select
          count(*)::integer as pages_received,
          coalesce(sum(received_count), 0)::integer as offers_received,
          coalesce(sum(valid_count), 0)::integer as offers_valid,
          coalesce(sum(quarantined_count), 0)::integer as offers_quarantined,
          coalesce(sum(in_perimeter_count), 0)::integer as offers_in_perimeter,
          coalesce(sum(warning_count), 0)::integer as source_warnings,
          (array_agg(next_range_start order by range_start desc))[1]
            as next_range_start,
          max(source_total)::integer as source_total
        from ingestion_query_pages
        where ingestion_run_query_id = ${input.ingestionRunQueryId}
      ) totals
      where run_query.id = ${input.ingestionRunQueryId}
    `,
    input.sql`
      update ingestion_runs run
      set
        requests_count = totals.requests_count,
        offers_received = totals.offers_received,
        offers_valid = totals.offers_valid,
        offers_quarantined = totals.offers_quarantined
      from (
        select
          coalesce(sum(query.request_count), 0)::integer as requests_count,
          coalesce(sum(query.offers_received), 0)::integer as offers_received,
          coalesce(sum((query.checkpoint->>'offersValid')::integer), 0)::integer
            as offers_valid,
          coalesce(sum((query.checkpoint->>'offersQuarantined')::integer), 0)::integer
            as offers_quarantined
        from ingestion_run_queries query
        where query.ingestion_run_id = ${input.ingestionRunId}
      ) totals
      where run.id = ${input.ingestionRunId}
    `,
  ]);
}

export async function completeFullQuery(input: {
  sql: NeonQueryFunction<false, false>;
  ingestionRunQueryId: string;
  finishedAt: Date;
}): Promise<void> {
  const rows = await input.sql`
    with page_state as (
      select
        count(*)::integer as page_count,
        count(*) filter (where is_terminal)::integer as terminal_count,
        min(range_start)::integer as first_range_start,
        min(source_total)::integer as minimum_source_total,
        max(source_total)::integer as maximum_source_total,
        coalesce(sum(received_count), 0)::integer as received_count
      from ingestion_query_pages page
      where ingestion_run_query_id = ${input.ingestionRunQueryId}
    )
    update ingestion_run_queries run_query
    set status = 'succeeded', finished_at = ${input.finishedAt}
    from page_state
    where run_query.id = ${input.ingestionRunQueryId}
      and page_state.page_count >= 1
      and page_state.terminal_count = 1
      and page_state.first_range_start = 0
      and page_state.minimum_source_total = page_state.maximum_source_total
      and page_state.received_count = page_state.maximum_source_total
      and not exists (
        select 1
        from ingestion_query_pages page
        where page.ingestion_run_query_id = ${input.ingestionRunQueryId}
          and page.is_terminal = false
          and not exists (
            select 1
            from ingestion_query_pages next_page
            where next_page.ingestion_run_query_id = page.ingestion_run_query_id
              and next_page.range_start = page.next_range_start
          )
      )
    returning run_query.id
  `;
  if (rows.length !== 1) {
    throw new IngestionPaginationIncompleteError();
  }
}

export async function failFullQuery(input: {
  sql: NeonQueryFunction<false, false>;
  ingestionRunQueryId: string;
  finishedAt: Date;
  errorCode: string;
}): Promise<void> {
  const errorSummary = JSON.stringify({ code: input.errorCode });
  await input.sql`
    update ingestion_run_queries
    set
      status = 'failed',
      finished_at = ${input.finishedAt},
      error_summary = ${errorSummary}::jsonb
    where id = ${input.ingestionRunQueryId}
  `;
}

export async function transitionFullRun(input: {
  sql: NeonQueryFunction<false, false>;
  ingestionRunId: string;
  status: "validating" | "aggregating" | "publishing";
}): Promise<void> {
  await input.sql`
    update ingestion_runs
    set status = ${input.status}
    where id = ${input.ingestionRunId}
      and status not in ('succeeded', 'cancelled')
  `;
}

export async function readFullIngestionQualityFacts(input: {
  sql: NeonQueryFunction<false, false>;
  ingestionRunId: string;
  classifierVersion: string;
}): Promise<FullIngestionQualityFacts> {
  const rows = await input.sql`
    with current_run as (
      select id, source_id, query_set_version, created_at,
        requests_count, offers_received, offers_valid, offers_quarantined,
        offers_marked_missing, offers_closed
      from ingestion_runs
      where id = ${input.ingestionRunId}
        and mode = 'full'
    ), current_queries as (
      select query.id, query.source_query_id, query.status,
        coalesce((query.checkpoint->>'offersInPerimeter')::integer, 0)
          as offers_in_perimeter
      from ingestion_run_queries query
      join current_run run on run.id = query.ingestion_run_id
    ), current_sighting_flags as (
      select
        sighting.offer_id,
        bool_or(sighting.offer_created) as offer_created,
        bool_or(sighting.snapshot_created) as snapshot_created
      from ingestion_run_offer_sightings sighting
      join current_queries query on query.id = sighting.ingestion_run_query_id
      group by sighting.offer_id
    ), current_classifications as (
      select classification.id, classification.status,
        classification.claims_junior,
        classification.minimum_experience_months,
        classification.beginner_friendly,
        classification.contradictory_junior
      from current_sighting_flags sighting
      join offer_snapshots snapshot
        on snapshot.offer_id = sighting.offer_id and snapshot.valid_to is null
      join classifications classification
        on classification.snapshot_id = snapshot.id
        and classification.classifier_version = ${input.classifierVersion}
    ), positive_classifications as (
      select classification.id
      from current_classifications classification
      where classification.claims_junior = true
        or classification.minimum_experience_months is not null
        or classification.beginner_friendly is not null
        or classification.contradictory_junior is not null
        or classification.status = 'ambiguous'
    ), previous_run as (
      select prior.id
      from ingestion_runs prior
      join current_run current on true
      where prior.source_id = current.source_id
        and prior.query_set_version = current.query_set_version
        and prior.mode = 'full'
        and prior.status in ('succeeded', 'partial')
        and prior.created_at < current.created_at
      order by prior.created_at desc, prior.id desc
      limit 1
    ), previous_query_counts as (
      select query.source_query_id, count(distinct sighting.offer_id)::integer as count
      from previous_run run
      join ingestion_run_queries query on query.ingestion_run_id = run.id
      left join ingestion_run_offer_sightings sighting
        on sighting.ingestion_run_query_id = query.id
      group by query.source_query_id
    ), current_query_counts as (
      select query.source_query_id, count(distinct sighting.offer_id)::integer as count
      from current_queries query
      left join ingestion_run_offer_sightings sighting
        on sighting.ingestion_run_query_id = query.id
      group by query.source_query_id
    ), volume_state as (
      select
        (select count(distinct sighting.offer_id)::integer
          from previous_run run
          join ingestion_run_queries query on query.ingestion_run_id = run.id
          join ingestion_run_offer_sightings sighting
            on sighting.ingestion_run_query_id = query.id) as previous_count,
        (select count(*)::integer from current_sighting_flags) as current_count,
        (select coalesce(jsonb_agg(jsonb_build_object(
          'queryId', current_count.source_query_id,
          'previous', previous_count.count, 'current', current_count.count
        ) order by current_count.source_query_id), '[]'::jsonb)
          from current_query_counts current_count
          join previous_query_counts previous_count
            on previous_count.source_query_id = current_count.source_query_id
        ) as partition_volumes
    )
    select
      count(current_query.id) > 0
        and coalesce(bool_and(current_query.status = 'succeeded'), false)
        as "paginationComplete",
      exists (
        select 1
        from ingestion_query_pages page
        join current_queries query on query.id = page.ingestion_run_query_id
        where page.source_total > 3150
      ) as "sourceCapReached",
      current_run.offers_received as "offersReceived",
      current_run.requests_count as "requestsCount",
      current_run.offers_valid as "offersValid",
      current_run.offers_quarantined as "offersQuarantined",
      current_run.offers_marked_missing as "offersMarkedMissing",
      current_run.offers_closed as "offersClosed",
      coalesce(sum(current_query.offers_in_perimeter), 0)::integer
        as "offersInPerimeter",
      (select count(*)::integer from current_sighting_flags) as "uniqueOffers",
      (select count(*) filter (where offer_created)::integer
        from current_sighting_flags) as "offersNew",
      (select count(*) filter (where not offer_created and snapshot_created)::integer
        from current_sighting_flags) as "offersUpdated",
      (select count(*)::integer from positive_classifications)
        as "positiveClassifications",
      (select count(*)::integer
        from positive_classifications positive
        where exists (
          select 1 from classification_evidence evidence
          where evidence.classification_id = positive.id
        )) as "positiveClassificationsWithEvidence",
      coalesce(
        volume_state.previous_count > 0
          and abs(volume_state.current_count - volume_state.previous_count)::numeric
            / volume_state.previous_count > 0.40,
        false
      ) as "volumeAnomalyDetected",
      volume_state.partition_volumes as "partitionVolumes"
    from current_run
    cross join volume_state
    left join current_queries current_query on true
    group by current_run.requests_count, current_run.offers_received,
      current_run.offers_valid,
      current_run.offers_quarantined, current_run.offers_marked_missing,
      current_run.offers_closed,
      volume_state.previous_count,
      volume_state.current_count, volume_state.partition_volumes
  `;
  const row = rows.at(0);
  if (!row) {
    throw new Error("Le run complet à évaluer est absent.");
  }

  const booleanField = (field: string): boolean => {
    const value = row[field];
    if (typeof value !== "boolean") {
      throw new Error(`Le signal qualité ${field} est invalide.`);
    }
    return value;
  };

  const partitions = z
    .array(
      z.object({
        queryId: z.string(),
        previous: z.number().int().nonnegative(),
        current: z.number().int().nonnegative(),
      }),
    )
    .parse(row["partitionVolumes"]);
  const volumeAssessment = assessPartitionVolumes(partitions);
  return {
    paginationComplete: booleanField("paginationComplete"),
    sourceCapReached: booleanField("sourceCapReached"),
    offersReceived: requiredInteger(row, "offersReceived"),
    requestsCount: requiredInteger(row, "requestsCount"),
    offersValid: requiredInteger(row, "offersValid"),
    offersQuarantined: requiredInteger(row, "offersQuarantined"),
    offersInPerimeter: requiredInteger(row, "offersInPerimeter"),
    uniqueOffers: requiredInteger(row, "uniqueOffers"),
    offersNew: requiredInteger(row, "offersNew"),
    offersUpdated: requiredInteger(row, "offersUpdated"),
    offersMarkedMissing: requiredInteger(row, "offersMarkedMissing"),
    offersClosed:
      row["offersClosed"] === null
        ? null
        : requiredInteger(row, "offersClosed"),
    positiveClassifications: requiredInteger(row, "positiveClassifications"),
    positiveClassificationsWithEvidence: requiredInteger(
      row,
      "positiveClassificationsWithEvidence",
    ),
    volumeAnomalyDetected:
      booleanField("volumeAnomalyDetected") || volumeAssessment.blocking,
    volumeWarnings: volumeAssessment.warnings,
  };
}

export async function storeFullRunQualitySummary(input: {
  sql: NeonQueryFunction<false, false>;
  ingestionRunId: string;
  qualitySummary: Readonly<Record<string, unknown>>;
}): Promise<void> {
  const qualitySummary = JSON.stringify(input.qualitySummary);
  const rows = await input.sql`
    update ingestion_runs
    set quality_summary = ${qualitySummary}::jsonb
    where id = ${input.ingestionRunId}
      and mode = 'full'
      and status in ('validating', 'aggregating', 'publishing')
    returning id
  `;
  if (rows.length !== 1) {
    throw new Error("Le résumé qualité ne peut pas être rattaché au run.");
  }
}

export async function completeFullRun(input: {
  sql: NeonQueryFunction<false, false>;
  ingestionRunId: string;
  finishedAt: Date;
  partial: boolean;
  offersNew: number;
  offersUpdated: number;
  offersMarkedMissing: number;
  offersClosed: number;
  qualitySummary: Readonly<Record<string, unknown>>;
}): Promise<void> {
  const status = input.partial ? "partial" : "succeeded";
  const qualitySummary = JSON.stringify(input.qualitySummary);
  await input.sql`
    update ingestion_runs
    set
      status = ${status},
      finished_at = ${input.finishedAt},
      offers_new = ${input.offersNew},
      offers_updated = ${input.offersUpdated},
      offers_marked_missing = ${input.offersMarkedMissing},
      offers_closed = ${input.offersClosed},
      quality_summary = ${qualitySummary}::jsonb
    where id = ${input.ingestionRunId}
  `;
}

export async function failFullRun(input: {
  sql: NeonQueryFunction<false, false>;
  ingestionRunId: string;
  finishedAt: Date;
  errorCode: string;
}): Promise<void> {
  const errorSummary = JSON.stringify({ code: input.errorCode });
  await input.sql`
    update ingestion_runs
    set
      status = 'failed',
      finished_at = ${input.finishedAt},
      error_summary = ${errorSummary}::jsonb
    where id = ${input.ingestionRunId}
      and status <> 'succeeded'
  `;
}
