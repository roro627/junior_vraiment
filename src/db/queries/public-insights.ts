import type { NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";

import {
  metricIdSchema,
  metricValueSchema,
  scopeSchema,
} from "@/application/queries/contracts";

export const publicInsightSlugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

export const publicInsightSchema = z
  .object({
    slug: publicInsightSlugSchema,
    title: z.string().min(1).max(180),
    summary: z.string().min(1).max(600),
    status: z.enum(["published", "corrected"]),
    filters: scopeSchema,
    metric: metricValueSchema,
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    publishedAt: z.iso.datetime({ offset: true }),
    correctedAt: z.iso.datetime({ offset: true }).nullable(),
    correctionNote: z.string().min(1).max(1_000).nullable(),
    updatedAt: z.iso.datetime({ offset: true }),
    ogAlt: z.string().min(1).max(500),
    datasetVersion: z.string().min(1).max(100),
    classifierVersion: z.string().min(1).max(100),
    querySetVersion: z.string().min(1).max(100),
    sourceLabel: z.string().min(1).max(120),
    sourceAttributionUrl: z.url(),
  })
  .strict();

export type PublicInsight = z.infer<typeof publicInsightSchema>;

const rawInsightRowSchema = z
  .object({
    slug: publicInsightSlugSchema,
    title: z.string(),
    summary: z.string(),
    status: z.enum(["published", "corrected"]),
    filters: scopeSchema,
    metricKey: metricIdSchema,
    metricVersion: z.string(),
    value: z.coerce.number().min(0).max(1).nullable(),
    numerator: z.coerce.number().int().nonnegative(),
    denominator: z.coerce.number().int().nonnegative(),
    populationCount: z.coerce.number().int().nonnegative(),
    unknownCount: z.coerce.number().int().nonnegative(),
    ambiguousCount: z.coerce.number().int().nonnegative(),
    coverage: z.coerce.number().min(0).max(1).nullable(),
    sampleQuality: z.enum(["normal", "caution", "insufficient"]),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    publishedAt: z.coerce.date(),
    correctedAt: z.coerce.date().nullable(),
    correctionNote: z.string().nullable(),
    updatedAt: z.coerce.date(),
    ogAlt: z.string(),
    datasetVersion: z.string(),
    classifierVersion: z.string(),
    querySetVersion: z.string(),
    sourceLabel: z.string(),
    sourceAttributionUrl: z.url(),
  })
  .strict();

function mapInsightRow(
  row: z.infer<typeof rawInsightRowSchema>,
): PublicInsight {
  return publicInsightSchema.parse({
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    status: row.status,
    filters: row.filters,
    metric: {
      metric: row.metricKey,
      metricVersion: row.metricVersion,
      value: row.value,
      numerator: row.numerator,
      denominator: row.denominator,
      populationCount: row.populationCount,
      unknownCount: row.unknownCount,
      ambiguousCount: row.ambiguousCount,
      coverage: row.coverage,
      sampleQuality: row.sampleQuality,
    },
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    publishedAt: row.publishedAt.toISOString(),
    correctedAt: row.correctedAt?.toISOString() ?? null,
    correctionNote: row.correctionNote,
    updatedAt: row.updatedAt.toISOString(),
    ogAlt: row.ogAlt,
    datasetVersion: row.datasetVersion,
    classifierVersion: row.classifierVersion,
    querySetVersion: row.querySetVersion,
    sourceLabel: row.sourceLabel,
    sourceAttributionUrl: row.sourceAttributionUrl,
  });
}

async function readPublishedInsights(
  sql: NeonQueryFunction<false, false>,
  slug: string | null,
  limit: number,
): Promise<PublicInsight[]> {
  const rows = await sql`
    select
      insight.slug,
      insight.title,
      insight.summary,
      insight.status,
      insight.filters,
      insight.metric_key as "metricKey",
      insight.metric_version as "metricVersion",
      insight.value_numeric as value,
      insight.numerator,
      insight.denominator,
      insight.population_count as "populationCount",
      insight.unknown_count as "unknownCount",
      insight.ambiguous_count as "ambiguousCount",
      insight.coverage_numeric as coverage,
      insight.sample_quality as "sampleQuality",
      insight.period_start::text as "periodStart",
      insight.period_end::text as "periodEnd",
      insight.published_at as "publishedAt",
      insight.corrected_at as "correctedAt",
      insight.correction_note as "correctionNote",
      insight.updated_at as "updatedAt",
      insight.og_alt as "ogAlt",
      dataset.dataset_version as "datasetVersion",
      dataset.classifier_version as "classifierVersion",
      dataset.query_set_version as "querySetVersion",
      source.label as "sourceLabel",
      source.attribution_url as "sourceAttributionUrl"
    from insights insight
    join published_datasets dataset on dataset.id = insight.dataset_id
    join sources source on source.id = dataset.source_id
    where insight.status in ('published', 'corrected')
      and insight.published_at is not null
      and (${slug}::text is null or insight.slug = ${slug})
    order by insight.published_at desc, insight.slug
    limit ${limit}
  `;

  return z.array(rawInsightRowSchema).parse(rows).map(mapInsightRow);
}

export async function getPublicInsight(
  sql: NeonQueryFunction<false, false>,
  slugInput: string,
): Promise<PublicInsight | null> {
  const parsed = publicInsightSlugSchema.safeParse(slugInput);
  if (!parsed.success) return null;

  const insights = await readPublishedInsights(sql, parsed.data, 1);
  return insights[0] ?? null;
}

export async function listPublicInsights(
  sql: NeonQueryFunction<false, false>,
  limitInput = 12,
): Promise<PublicInsight[]> {
  const limit = z.number().int().min(1).max(50).parse(limitInput);
  return readPublishedInsights(sql, null, limit);
}
