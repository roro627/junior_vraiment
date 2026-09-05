import type { NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";

import {
  trendsResponseSchema,
  type ResponseMeta,
  type TrendsQuery,
  type TrendsResponse,
} from "@/application/queries/contracts";
import { publishableRate, rateSampleQuality } from "@/domain/metrics/rate";

import { readCurrentDataset, type CurrentDataset } from "./current-dataset";

const stringRecordSchema = z.record(z.string(), z.string());
const trendRowSchema = z
  .object({
    date: z.iso.date(),
    datasetVersion: z.string(),
    classifierVersion: z.string(),
    metricVersions: stringRecordSchema,
    qualitySummary: z.record(z.string(), z.unknown()),
    sampleSize: z.number().int().nonnegative(),
    contradictionNumerator: z.number().int().nonnegative(),
    contradictionDenominator: z.number().int().nonnegative(),
    contradictionUnknown: z.number().int().nonnegative(),
    contradictionAmbiguous: z.number().int().nonnegative(),
    beginnerNumerator: z.number().int().nonnegative(),
    beginnerDenominator: z.number().int().nonnegative(),
    beginnerUnknown: z.number().int().nonnegative(),
    beginnerAmbiguous: z.number().int().nonnegative(),
    salaryNumerator: z.number().int().nonnegative(),
  })
  .strict();

type PublicTrendsInput = {
  sql: NeonQueryFunction<false, false>;
  query: TrendsQuery;
  generatedAt: Date;
};

function parseArea(area: string): { kind: string | null; code: string | null } {
  if (area === "france") return { kind: null, code: null };
  const separator = area.indexOf(":");
  return {
    kind: area.slice(0, separator),
    code: area.slice(separator + 1),
  };
}

function responseMeta(
  dataset: CurrentDataset,
  generatedAt: Date,
  sampleSize: number,
): ResponseMeta {
  const partial = dataset.qualitySummary["decision"] === "publish_partial";
  return {
    generatedAt: generatedAt.toISOString(),
    dataAsOf: dataset.sourceCutoffAt.toISOString(),
    datasetVersion: dataset.datasetVersion,
    classifierVersion: dataset.classifierVersion,
    metricVersions: dataset.metricVersions,
    querySetVersion: dataset.querySetVersion,
    sampleSize,
    quality: partial ? "partial" : "normal",
    warnings: partial
      ? [
          {
            code: "PARTIAL_COLLECTION",
            severity: "warning",
            message: "Le dataset publié provient d'une collecte partielle.",
          },
        ]
      : [],
  };
}

function countersFor(
  row: z.infer<typeof trendRowSchema>,
  metric: TrendsQuery["metric"],
) {
  if (metric === "junior_contradiction_rate") {
    return {
      numerator: row.contradictionNumerator,
      denominator: row.contradictionDenominator,
      unknownCount: row.contradictionUnknown,
      ambiguousCount: row.contradictionAmbiguous,
    };
  }
  if (metric === "beginner_friendly_rate") {
    return {
      numerator: row.beginnerNumerator,
      denominator: row.beginnerDenominator,
      unknownCount: row.beginnerUnknown,
      ambiguousCount: row.beginnerAmbiguous,
    };
  }
  return {
    numerator: row.salaryNumerator,
    denominator: row.sampleSize,
    unknownCount: 0,
    ambiguousCount: 0,
  };
}

export async function getPublicTrends({
  sql,
  query,
  generatedAt,
}: PublicTrendsInput): Promise<TrendsResponse> {
  const currentDataset = await readCurrentDataset(sql);
  const area = parseArea(query.scope.area);
  const technologyJson = JSON.stringify(query.scope.technologies);
  const contractJson = JSON.stringify(query.scope.contracts);
  const periodDays =
    query.scope.period === "7d"
      ? 7
      : query.scope.period === "30d"
        ? 30
        : query.scope.period === "90d"
          ? 90
          : null;
  const rawRows = await sql`
    with scoped as (
      select
        dataset.id as dataset_id,
        dataset.dataset_version,
        dataset.classifier_version,
        dataset.metric_versions,
        dataset.quality_summary,
        dataset.source_cutoff_at,
        dataset.published_at,
        membership.offer_id,
        classification.status,
        classification.claims_junior,
        classification.minimum_experience_months,
        classification.beginner_friendly,
        classification.salary_transparent
      from published_datasets dataset
      join published_dataset_offers membership
        on membership.dataset_id = dataset.id
      join offer_snapshots snapshot on snapshot.id = membership.snapshot_id
      join classifications classification
        on classification.id = membership.classification_id
      where dataset.status = 'published'
        and dataset.published_at is not null
        and (
          ${query.from}::date is null
          or (dataset.source_cutoff_at at time zone 'Europe/Paris')::date >= ${query.from}::date
        )
        and (
          ${query.to}::date is null
          or (dataset.source_cutoff_at at time zone 'Europe/Paris')::date <= ${query.to}::date
        )
        and (
          ${query.scope.job}::text is null
          or exists (
            select 1
            from offer_query_matches matched
            join source_queries source_query on source_query.id = matched.source_query_id
            where matched.offer_id = membership.offer_id
              and source_query.query_set_version = dataset.query_set_version
              and ${query.scope.job}::text = any(source_query.job_families)
          )
        )
        and (
          jsonb_array_length(${technologyJson}::jsonb) = 0
          or not exists (
            select 1
            from jsonb_array_elements_text(${technologyJson}::jsonb) requested(slug)
            where not exists (
              select 1
              from offer_snapshot_technologies mention
              join technologies technology on technology.id = mention.technology_id
              where mention.classification_id = membership.classification_id
                and technology.slug = requested.slug
                and technology.taxonomy_version =
                  classification.taxonomy_technologies_version
            )
          )
        )
        and (
          ${area.kind}::text is null
          or (${area.kind}::text = 'region' and snapshot.region_code = ${area.code})
          or (${area.kind}::text = 'department' and snapshot.department_code = ${area.code})
          or (${area.kind}::text = 'commune' and snapshot.commune_code = ${area.code})
        )
        and (
          jsonb_array_length(${contractJson}::jsonb) = 0
          or snapshot.contract_kind in (
            select jsonb_array_elements_text(${contractJson}::jsonb)
          )
        )
        and (
          ${query.scope.remote}::text is null
          or classification.remote_mode = ${query.scope.remote}
        )
        and (
          ${periodDays}::integer is null
          or snapshot.source_published_at >=
            dataset.source_cutoff_at - (${periodDays}::integer * interval '1 day')
        )
    ), aggregated as (
      select
        to_char(source_cutoff_at at time zone 'Europe/Paris', 'YYYY-MM-DD') as date,
        dataset_version as "datasetVersion",
        classifier_version as "classifierVersion",
        metric_versions as "metricVersions",
        quality_summary as "qualitySummary",
        published_at,
        count(*)::integer as "sampleSize",
        count(*) filter (
          where status = 'classified'
            and claims_junior = true
            and minimum_experience_months >= 24
        )::integer as "contradictionNumerator",
        count(*) filter (
          where status = 'classified'
            and claims_junior = true
            and minimum_experience_months is not null
        )::integer as "contradictionDenominator",
        count(*) filter (
          where status = 'classified'
            and claims_junior = true
            and minimum_experience_months is null
        )::integer as "contradictionUnknown",
        count(*) filter (
          where status = 'ambiguous' and claims_junior = true
        )::integer as "contradictionAmbiguous",
        count(*) filter (
          where status = 'classified' and beginner_friendly = true
        )::integer as "beginnerNumerator",
        count(*) filter (
          where status = 'classified' and beginner_friendly is not null
        )::integer as "beginnerDenominator",
        count(*) filter (
          where status <> 'ambiguous' and beginner_friendly is null
        )::integer as "beginnerUnknown",
        count(*) filter (where status = 'ambiguous')::integer as "beginnerAmbiguous",
        count(*) filter (where salary_transparent = true)::integer as "salaryNumerator"
      from scoped
      group by
        dataset_id,
        dataset_version,
        classifier_version,
        metric_versions,
        quality_summary,
        source_cutoff_at,
        published_at
    ), ranked as (
      select *, row_number() over (
        partition by date order by published_at desc, "datasetVersion" desc
      ) as date_rank
      from aggregated
    )
    select
      date,
      "datasetVersion",
      "classifierVersion",
      "metricVersions",
      "qualitySummary",
      "sampleSize",
      "contradictionNumerator",
      "contradictionDenominator",
      "contradictionUnknown",
      "contradictionAmbiguous",
      "beginnerNumerator",
      "beginnerDenominator",
      "beginnerUnknown",
      "beginnerAmbiguous",
      "salaryNumerator"
    from ranked
    where date_rank = 1
    order by date desc
    limit 366
  `;
  const rows = rawRows.map((row) => trendRowSchema.parse(row)).reverse();
  const currentMetricVersion = currentDataset.metricVersions[query.metric];
  if (!currentMetricVersion) {
    throw new Error("The current dataset does not define the requested metric");
  }

  const points = rows.map((row, index) => {
    const counters = countersFor(row, query.metric);
    const populationCount =
      counters.denominator + counters.unknownCount + counters.ambiguousCount;
    const sampleQuality = rateSampleQuality(counters.denominator);
    const previous = index > 0 ? rows[index - 1] : undefined;
    const partial = row.qualitySummary["decision"] === "publish_partial";
    const classifierChanged =
      previous !== undefined &&
      previous.classifierVersion !== row.classifierVersion;
    const metricChanged =
      previous !== undefined &&
      previous.metricVersions[query.metric] !==
        row.metricVersions[query.metric];
    const annotation = partial
      ? { kind: "partial_day" as const, label: "Collecte partielle" }
      : metricChanged
        ? { kind: "methodology_change" as const, label: "Méthode mise à jour" }
        : classifierChanged
          ? {
              kind: "classifier_change" as const,
              label: "Classificateur mis à jour",
            }
          : null;

    return {
      date: row.date,
      value: publishableRate(
        counters.numerator,
        counters.denominator,
        sampleQuality,
      ),
      ...counters,
      populationCount,
      coverage:
        populationCount === 0 ? null : counters.denominator / populationCount,
      sampleQuality,
      quality: partial ? ("partial" as const) : ("normal" as const),
      datasetVersion: row.datasetVersion,
      annotation,
    };
  });
  const response: TrendsResponse = {
    data: {
      scope: query.scope,
      metric: query.metric,
      metricVersion: currentMetricVersion,
      timezone: "Europe/Paris",
      points,
    },
    meta: responseMeta(
      currentDataset,
      generatedAt,
      rows.at(-1)?.sampleSize ?? 0,
    ),
  };

  return trendsResponseSchema.parse(response);
}
