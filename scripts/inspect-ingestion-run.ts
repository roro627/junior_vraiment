import { neon } from "@neondatabase/serverless";
import { z } from "zod";

import { readDatabaseEnvironment } from "../src/lib/env";

const triggerRunId = z.string().trim().min(1).parse(process.argv[2]);
const sql = neon(readDatabaseEnvironment().DATABASE_URL);
const [run] = await sql`
  select
    run.id as "ingestionRunId",
    run.business_date::text as "businessDate",
    run.query_set_version as "querySetVersion",
    run.mode,
    run.status,
    run.requests_count as "requestsCount",
    run.offers_received as "offersReceived",
    run.offers_valid as "offersValid",
    run.offers_quarantined as "offersQuarantined",
    run.offers_new as "offersNew",
    run.offers_updated as "offersUpdated",
    run.offers_marked_missing as "offersMarkedMissing",
    run.quality_summary as "qualitySummary",
    run.error_summary as "errorSummary",
    count(query.id)::integer as "queryCount",
    count(*) filter (where query.status = 'succeeded')::integer
      as "queriesSucceeded",
    count(*) filter (where query.status = 'running')::integer
      as "queriesRunning",
    count(*) filter (where query.status = 'failed')::integer
      as "queriesFailed",
    coalesce(sum(query.pages_received), 0)::integer as "pagesReceived",
    (select count(distinct sighting.offer_id)::integer
      from ingestion_run_queries sighting_query
      join ingestion_run_offer_sightings sighting
        on sighting.ingestion_run_query_id = sighting_query.id
      where sighting_query.ingestion_run_id = run.id) as "uniqueOffersSeen",
    (select jsonb_build_object(
      'datasetId', dataset.id,
      'datasetVersion', dataset.dataset_version,
      'status', dataset.status,
      'isCurrent', dataset.is_current,
      'publishedAt', dataset.published_at,
      'membershipCount', (
        select count(*)::integer
        from published_dataset_offers membership
        where membership.dataset_id = dataset.id
      ),
      'classificationCount', (
        select count(distinct membership.classification_id)::integer
        from published_dataset_offers membership
        where membership.dataset_id = dataset.id
      ),
      'metricCount', (
        select count(*)::integer
        from daily_metrics metric
        where metric.dataset_id = dataset.id
      ),
      'mainMetric', (
        select jsonb_build_object(
          'metricKey', metric.metric_key,
          'metricVersion', metric.metric_version,
          'numerator', metric.numerator,
          'denominator', metric.denominator,
          'populationCount', metric.population_count,
          'unknownCount', metric.unknown_count,
          'ambiguousCount', metric.ambiguous_count,
          'value', metric.value_numeric,
          'coverage', metric.coverage_numeric,
          'sampleQuality', metric.sample_quality
        )
        from daily_metrics metric
        where metric.dataset_id = dataset.id
          and metric.metric_key = 'junior_contradiction_rate'
        order by metric.computed_at desc
        limit 1
      ),
      'currentPublicCount', case
        when dataset.is_current then (
          select count(*)::integer
          from current_public_offer_classifications
        )
        else null
      end
    )
      from published_datasets dataset
      where dataset.ingestion_run_id = run.id
      order by dataset.created_at desc
      limit 1) as "publishedDataset"
  from ingestion_runs run
  left join ingestion_run_queries query on query.ingestion_run_id = run.id
  where run.trigger_run_id = ${triggerRunId}
  group by run.id
`;

process.stdout.write(`${JSON.stringify(run ?? null, null, 2)}\n`);
