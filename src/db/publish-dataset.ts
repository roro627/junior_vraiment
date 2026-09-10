import type { NeonQueryFunction } from "@neondatabase/serverless";

type PublishDatasetInput = {
  sql: NeonQueryFunction<false, false>;
  datasetId: string;
  publishedAt: Date;
};

export async function publishDataset({
  sql,
  datasetId,
  publishedAt,
}: PublishDatasetInput): Promise<void> {
  const rows = await sql`
    with target as materialized (
      select id, ingestion_run_id,
        quality_summary->>'decision' as quality_decision
      from published_datasets
      where id = ${datasetId}
        and length(dataset_version) between 1 and 100
        and status in ('validated', 'published')
        and ingestion_run_id is not null
        and quality_summary->>'decision' in ('publish', 'publish_partial')
        and exists (
          select 1 from published_dataset_offers membership
          where membership.dataset_id = published_datasets.id
        )
        and exists (
          select 1 from daily_metrics metric
          where metric.dataset_id = published_datasets.id
            and metric.metric_key = 'junior_contradiction_rate'
        )
      for update
    ), unset_current as (
      update published_datasets
      set is_current = false
      where is_current = true
        and id <> ${datasetId}
        and exists (select 1 from target)
      returning id
    ), published as (
      update published_datasets
      set
        status = 'published',
        is_current = true,
        published_at = coalesce(published_at, ${publishedAt})
      where id = (select id from target)
        and (select count(*) from unset_current) >= 0
      returning id
    ), finalized_run as (
      update ingestion_runs run
      set
        status = case
          when target.quality_decision = 'publish_partial' then 'partial'
          else 'succeeded'
        end,
        finished_at = coalesce(run.finished_at, ${publishedAt})
      from target
      where run.id = target.ingestion_run_id
        and exists (select 1 from published)
      returning run.id
    )
    select published.id
    from published
    where (select count(*) from finalized_run) = 1
  `;

  if (rows.length !== 1) {
    throw new Error(
      "Le dataset doit être validé, complet et mesuré avant publication.",
    );
  }
}
