import type { NeonQueryFunction } from "@neondatabase/serverless";

export type OfferAbsenceResult = {
  offersMarkedMissing: number;
  offersClosed: number;
};

/** The run is not a sound basis for changing offer lifecycle state. */
export class OfferAbsenceEligibilityError extends Error {
  override name = "OfferAbsenceEligibilityError";
}

type RunEligibilityRow = Record<string, unknown>;

function isClosureEligible(row: RunEligibilityRow): boolean {
  return row["closureEligible"] === true;
}

function isComplete(row: RunEligibilityRow): boolean {
  return row["queryCount"] !== 0 && row["allQueriesSucceeded"] === true;
}

function requiredId(row: RunEligibilityRow, field: string): string {
  const value = row[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new OfferAbsenceEligibilityError(
      `Le run de clôture ne fournit pas ${field}.`,
    );
  }
  return value;
}

function requiredCount(row: Record<string, unknown>, field: string): number {
  const value = row[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`Le compteur ${field} retourné par la base est invalide.`);
  }
  return value;
}

/**
 * Marks offers missing only after a complete, closure-eligible full run. An
 * offer is closed only when it was absent from both this run and its immediate
 * preceding full run for the same source and query-set version.
 */
export async function applyOfferAbsences({
  sql,
  ingestionRunId,
  appliedAt,
}: {
  sql: NeonQueryFunction<false, false>;
  ingestionRunId: string;
  appliedAt: Date;
}): Promise<OfferAbsenceResult> {
  const currentRows = await sql`
    select
      run.id as "runId",
      run.source_id as "sourceId",
      run.query_set_version as "querySetVersion",
      run.status,
      coalesce((run.quality_summary->>'closureEligible')::boolean, false)
        as "closureEligible",
      count(run_query.id)::integer as "queryCount",
      coalesce(bool_and(run_query.status = 'succeeded'), false)
        as "allQueriesSucceeded"
    from ingestion_runs run
    left join ingestion_run_queries run_query
      on run_query.ingestion_run_id = run.id
    where run.id = ${ingestionRunId}
      and run.mode = 'full'
      and run.status in ('succeeded', 'validating', 'aggregating', 'publishing')
    group by run.id
  `;
  const current = currentRows.at(0) as RunEligibilityRow | undefined;
  if (!current || !isClosureEligible(current) || !isComplete(current)) {
    throw new OfferAbsenceEligibilityError(
      "Le run courant est incomplet, partiel ou non éligible à la clôture.",
    );
  }

  const sourceId = requiredId(current, "sourceId");
  const querySetVersion = requiredId(current, "querySetVersion");
  const currentRunId = requiredId(current, "runId");

  const previousRows = await sql`
    with previous_run as (
      select prior.id, prior.status, prior.quality_summary
      from ingestion_runs prior
      join ingestion_runs current on current.id = ${currentRunId}
      where prior.source_id = ${sourceId}
        and prior.query_set_version = ${querySetVersion}
        and prior.mode = 'full'
        and prior.created_at < current.created_at
      order by prior.created_at desc, prior.id desc
      limit 1
    )
    select
      previous_run.id as "runId",
      previous_run.status,
      coalesce((previous_run.quality_summary->>'closureEligible')::boolean, false)
        as "closureEligible",
      count(run_query.id)::integer as "queryCount",
      coalesce(bool_and(run_query.status = 'succeeded'), false)
        as "allQueriesSucceeded"
    from previous_run
    left join ingestion_run_queries run_query
      on run_query.ingestion_run_id = previous_run.id
    group by previous_run.id, previous_run.status, previous_run.quality_summary
  `;
  const previous = previousRows.at(0) as RunEligibilityRow | undefined;
  if (
    !previous ||
    previous["status"] !== "succeeded" ||
    !isClosureEligible(previous) ||
    !isComplete(previous)
  ) {
    // Le premier run établit la base. Un run partiel ou échoué casse la chaîne
    // de deux absences au lieu de faire vieillir artificiellement les offres.
    return { offersMarkedMissing: 0, offersClosed: 0 };
  }
  const previousRunId = requiredId(previous, "runId");

  const resultRows = await sql`
    with scoped_offers as (
      select distinct offer.id
      from offers offer
      join offer_query_matches match on match.offer_id = offer.id
      join source_queries query on query.id = match.source_query_id
      where offer.source_id = ${sourceId}
        and offer.closed_at is null
        and query.query_set_version = ${querySetVersion}
        and query.enabled = true
        and query.valid_to is null
    ), current_absences as (
      select scoped_offer.id
      from scoped_offers scoped_offer
      where not exists (
        select 1
        from ingestion_run_offer_sightings sighting
        join ingestion_run_queries run_query
          on run_query.id = sighting.ingestion_run_query_id
        where run_query.ingestion_run_id = ${currentRunId}
          and sighting.offer_id = scoped_offer.id
      )
    ), double_absences as (
      select current_absence.id
      from current_absences current_absence
      where not exists (
        select 1
        from ingestion_run_offer_sightings sighting
        join ingestion_run_queries run_query
          on run_query.id = sighting.ingestion_run_query_id
        where run_query.ingestion_run_id = ${previousRunId}
          and sighting.offer_id = current_absence.id
      )
    ), updated_offers as (
      update offers offer
      set
        missing_since = coalesce(offer.missing_since, ${appliedAt}),
        closed_at = case
          when exists (
            select 1 from double_absences double_absence
            where double_absence.id = offer.id
          ) then ${appliedAt}
          else offer.closed_at
        end,
        updated_at = ${appliedAt}
      where offer.id in (select id from current_absences)
        and offer.closed_at is null
      returning offer.id, offer.closed_at is not null as closed
    )
    select
      count(*)::integer as "offersMarkedMissing",
      count(*) filter (where closed)::integer as "offersClosed"
    from updated_offers
  `;
  const result = resultRows.at(0);
  if (!result) {
    throw new Error("La clôture des offres n'a retourné aucun résultat.");
  }

  return {
    offersMarkedMissing: requiredCount(result, "offersMarkedMissing"),
    offersClosed: requiredCount(result, "offersClosed"),
  };
}
