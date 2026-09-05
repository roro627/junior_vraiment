import type { NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";

import {
  createInitialInsightDraft,
  INITIAL_INSIGHT_METRIC_KEYS,
  type InitialInsightDraft,
} from "@/domain/insights/editorial";

const storedMetricSchema = z
  .object({
    datasetId: z.string().uuid(),
    metricKey: z.enum(INITIAL_INSIGHT_METRIC_KEYS),
    metricVersion: z.string().min(1),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    numerator: z.coerce.number().int().nonnegative(),
    denominator: z.coerce.number().int().nonnegative(),
    populationCount: z.coerce.number().int().nonnegative(),
    unknownCount: z.coerce.number().int().nonnegative(),
    ambiguousCount: z.coerce.number().int().nonnegative(),
    value: z.coerce.number().min(0).max(1).nullable(),
    coverage: z.coerce.number().min(0).max(1).nullable(),
    sampleQuality: z.enum(["normal", "caution", "insufficient"]),
  })
  .strict();

const existingInsightSchema = z
  .object({
    slug: z.string(),
    datasetId: z.string().uuid(),
    metricKey: z.enum(INITIAL_INSIGHT_METRIC_KEYS),
    metricVersion: z.string(),
    numerator: z.coerce.number().int(),
    denominator: z.coerce.number().int(),
    status: z.enum(["published", "corrected"]),
  })
  .strict();

function isSameSnapshot(
  draft: InitialInsightDraft,
  existing: z.infer<typeof existingInsightSchema>,
): boolean {
  return (
    draft.slug === existing.slug &&
    draft.datasetId === existing.datasetId &&
    draft.metricKey === existing.metricKey &&
    draft.metricVersion === existing.metricVersion &&
    draft.numerator === existing.numerator &&
    draft.denominator === existing.denominator
  );
}

export async function publishInitialInsights(
  sql: NeonQueryFunction<false, false>,
  publishedAt: Date,
): Promise<{ slugs: string[]; insertedCount: number }> {
  const metricRows = await sql`
    select
      dataset.id::text as "datasetId",
      metric.metric_key as "metricKey",
      metric.metric_version as "metricVersion",
      metric.period_start::text as "periodStart",
      metric.period_end::text as "periodEnd",
      metric.numerator,
      metric.denominator,
      metric.population_count as "populationCount",
      metric.unknown_count as "unknownCount",
      metric.ambiguous_count as "ambiguousCount",
      metric.value_numeric as value,
      metric.coverage_numeric as coverage,
      metric.sample_quality as "sampleQuality"
    from published_datasets dataset
    join daily_metrics metric on metric.dataset_id = dataset.id
    where dataset.is_current = true
      and dataset.status = 'published'
      and metric.metric_key = any(${[...INITIAL_INSIGHT_METRIC_KEYS]})
      and metric.job_family is null
      and metric.technology_slug is null
      and metric.region_code is null
      and metric.department_code is null
      and metric.commune_code is null
      and metric.contract_kind is null
      and metric.remote_mode is null
      and metric.dimensions = '{}'::jsonb
    order by metric.metric_key
  `;
  const metrics = z.array(storedMetricSchema).parse(metricRows);
  const byMetric = new Map(metrics.map((metric) => [metric.metricKey, metric]));

  if (
    metrics.length !== INITIAL_INSIGHT_METRIC_KEYS.length ||
    INITIAL_INSIGHT_METRIC_KEYS.some((metricKey) => !byMetric.has(metricKey))
  ) {
    throw new Error(
      "Le dataset courant ne contient pas exactement les trois métriques globales requises.",
    );
  }

  const drafts = INITIAL_INSIGHT_METRIC_KEYS.map((metricKey) =>
    createInitialInsightDraft(byMetric.get(metricKey)!),
  );
  const slugs = drafts.map(({ slug }) => slug);
  const existingRows = await sql`
    select
      slug,
      dataset_id::text as "datasetId",
      metric_key as "metricKey",
      metric_version as "metricVersion",
      numerator,
      denominator,
      status
    from insights
    where slug = any(${slugs})
      and status in ('published', 'corrected')
    order by slug
  `;
  const existing = z.array(existingInsightSchema).parse(existingRows);

  if (existing.length > 0) {
    if (
      existing.length !== drafts.length ||
      drafts.some((draft) => {
        const stored = existing.find(({ slug }) => slug === draft.slug);
        return stored === undefined || !isSameSnapshot(draft, stored);
      })
    ) {
      throw new Error(
        "Un slug éditorial existe déjà avec un snapshot différent ; aucune donnée n'a été écrasée.",
      );
    }

    return { slugs, insertedCount: 0 };
  }

  await sql.transaction(
    drafts.map(
      (draft) => sql`
      insert into insights (
        slug,
        title,
        summary,
        status,
        dataset_id,
        metric_key,
        metric_version,
        filters,
        value_numeric,
        numerator,
        denominator,
        population_count,
        unknown_count,
        ambiguous_count,
        coverage_numeric,
        sample_quality,
        period_start,
        period_end,
        og_alt,
        published_at,
        created_at,
        updated_at
      ) values (
        ${draft.slug},
        ${draft.title},
        ${draft.summary},
        'published',
        ${draft.datasetId},
        ${draft.metricKey},
        ${draft.metricVersion},
        ${JSON.stringify(draft.filters)}::jsonb,
        ${draft.value},
        ${draft.numerator},
        ${draft.denominator},
        ${draft.populationCount},
        ${draft.unknownCount},
        ${draft.ambiguousCount},
        ${draft.coverage},
        ${draft.sampleQuality},
        ${draft.periodStart},
        ${draft.periodEnd},
        ${draft.ogAlt},
        ${publishedAt},
        ${publishedAt},
        ${publishedAt}
      )
    `,
    ),
  );

  return { slugs, insertedCount: drafts.length };
}
