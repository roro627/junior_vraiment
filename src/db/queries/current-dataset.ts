import type { NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";

const stringRecordSchema = z.record(z.string(), z.string());

const currentDatasetRowSchema = z
  .object({
    datasetId: z.string().uuid(),
    datasetVersion: z.string().min(1),
    sourceId: z.string().uuid(),
    ingestionRunId: z.string().uuid().nullable(),
    classifierVersion: z.string().min(1),
    metricVersions: stringRecordSchema,
    querySetVersion: z.string().min(1),
    taxonomyVersions: stringRecordSchema,
    qualitySummary: z.record(z.string(), z.unknown()),
    sourceCutoffAt: z.coerce.date(),
    computedAt: z.coerce.date(),
    publishedAt: z.coerce.date(),
    memberCount: z.number().int().nonnegative(),
    sourceLabel: z.string().min(1),
    sourceAttributionUrl: z.url(),
  })
  .strict();

export type CurrentDataset = z.infer<typeof currentDatasetRowSchema>;

export class NoPublishedDatasetError extends Error {
  override name = "NoPublishedDatasetError";
}

export async function readCurrentDataset(
  sql: NeonQueryFunction<false, false>,
): Promise<CurrentDataset> {
  const rows = await sql`
    select
      dataset.id as "datasetId",
      dataset.dataset_version as "datasetVersion",
      dataset.source_id as "sourceId",
      dataset.ingestion_run_id as "ingestionRunId",
      dataset.classifier_version as "classifierVersion",
      dataset.metric_versions as "metricVersions",
      dataset.query_set_version as "querySetVersion",
      dataset.taxonomy_versions as "taxonomyVersions",
      dataset.quality_summary as "qualitySummary",
      dataset.source_cutoff_at as "sourceCutoffAt",
      dataset.computed_at as "computedAt",
      dataset.published_at as "publishedAt",
      count(membership.offer_id)::integer as "memberCount",
      source.label as "sourceLabel",
      source.attribution_url as "sourceAttributionUrl"
    from published_datasets dataset
    join sources source on source.id = dataset.source_id
    left join published_dataset_offers membership
      on membership.dataset_id = dataset.id
    where dataset.is_current = true
      and dataset.status = 'published'
      and dataset.published_at is not null
    group by dataset.id, source.id
    limit 2
  `;

  if (rows.length !== 1) {
    throw new NoPublishedDatasetError(
      "Aucun dataset public unique n'est disponible.",
    );
  }

  return currentDatasetRowSchema.parse(rows[0]);
}
