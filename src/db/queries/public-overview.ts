import type { NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";

import {
  experienceBucketSchema,
  overviewResponseSchema,
  type OverviewQuery,
  type OverviewResponse,
  type ResponseMeta,
} from "@/application/queries/contracts";
import { rateFromCounts } from "@/domain/metrics/rate";

import { readCurrentDataset, type CurrentDataset } from "./current-dataset";

const groupedCountSchema = z
  .object({
    key: z.string(),
    label: z.string().optional(),
    count: z.number().int().nonnegative(),
  })
  .strict();

const aggregateRowSchema = z
  .object({
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
    experienceBuckets: z.array(
      groupedCountSchema.extend({ key: experienceBucketSchema }),
    ),
    technologies: z.array(groupedCountSchema),
    contracts: z.array(groupedCountSchema),
    remoteModes: z.array(groupedCountSchema),
  })
  .strict();

type PublicOverviewInput = {
  sql: NeonQueryFunction<false, false>;
  query: OverviewQuery;
  generatedAt: Date;
};

const experienceKeys = [
  "none",
  "1_12",
  "13_23",
  "24_35",
  "36_59",
  "60_plus",
  "unknown",
  "ambiguous",
] as const;

const contractLabels: Record<string, string> = {
  cdi: "CDI",
  cdd: "CDD",
  interim: "Intérim",
  alternance: "Alternance",
  internship: "Stage",
  freelance: "Freelance",
  public: "Secteur public",
  other: "Autre",
  unknown: "Non précisé",
};

const remoteLabels: Record<string, string> = {
  remote: "100 % à distance",
  hybrid: "Hybride",
  onsite: "Sur site",
  unknown: "Non précisé",
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

function withShares(
  items: readonly z.infer<typeof groupedCountSchema>[],
  population: number,
  labels: Readonly<Record<string, string>> = {},
) {
  return items
    .map(({ key, label, count }) => ({
      key,
      label: label ?? labels[key] ?? key,
      count,
      share: population === 0 ? null : count / population,
    }))
    .sort(
      (left, right) =>
        right.count - left.count || left.key.localeCompare(right.key),
    );
}

function requiredMetricVersion(
  dataset: CurrentDataset,
  metric: string,
): string {
  const version = dataset.metricVersions[metric];
  if (!version) throw new Error(`Missing metric version for ${metric}`);
  return version;
}

export async function getPublicOverview({
  sql,
  query,
  generatedAt,
}: PublicOverviewInput): Promise<OverviewResponse> {
  const dataset = await readCurrentDataset(sql);
  const area = parseArea(query.area);
  const technologyJson = JSON.stringify(query.technologies);
  const contractJson = JSON.stringify(query.contracts);
  const periodDays =
    query.period === "7d"
      ? 7
      : query.period === "30d"
        ? 30
        : query.period === "90d"
          ? 90
          : null;
  const rawRows = await sql`
    with scoped as materialized (
      select
        membership.offer_id,
        membership.classification_id,
        classification.status,
        classification.claims_junior,
        classification.minimum_experience_months,
        classification.beginner_friendly,
        classification.salary_transparent,
        classification.remote_mode,
        snapshot.contract_kind
      from published_dataset_offers membership
      join offer_snapshots snapshot on snapshot.id = membership.snapshot_id
      join classifications classification
        on classification.id = membership.classification_id
      where membership.dataset_id = ${dataset.datasetId}
        and (
          ${query.job}::text is null
          or exists (
            select 1
            from offer_query_matches matched
            join source_queries source_query on source_query.id = matched.source_query_id
            where matched.offer_id = membership.offer_id
              and source_query.query_set_version = ${dataset.querySetVersion}
              and ${query.job}::text = any(source_query.job_families)
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
        and (${query.remote}::text is null or classification.remote_mode = ${query.remote})
        and (
          ${periodDays}::integer is null
          or snapshot.source_published_at >=
            ${dataset.sourceCutoffAt}::timestamptz - (${periodDays}::integer * interval '1 day')
        )
    ), metrics as (
      select
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
    ), experience as (
      select jsonb_agg(
        jsonb_build_object('key', bucket, 'count', count)
        order by bucket
      ) as items
      from (
        select
          case
            when status = 'ambiguous' then 'ambiguous'
            when minimum_experience_months is null then 'unknown'
            when minimum_experience_months = 0 then 'none'
            when minimum_experience_months <= 12 then '1_12'
            when minimum_experience_months <= 23 then '13_23'
            when minimum_experience_months <= 35 then '24_35'
            when minimum_experience_months <= 59 then '36_59'
            else '60_plus'
          end as bucket,
          count(*)::integer as count
        from scoped
        group by bucket
      ) grouped
    ), contracts as (
      select jsonb_agg(
        jsonb_build_object('key', contract_kind, 'count', count)
        order by contract_kind
      ) as items
      from (
        select contract_kind, count(*)::integer as count
        from scoped
        group by contract_kind
      ) grouped
    ), remote_modes as (
      select jsonb_agg(
        jsonb_build_object('key', remote_mode, 'count', count)
        order by remote_mode
      ) as items
      from (
        select remote_mode, count(*)::integer as count
        from scoped
        group by remote_mode
      ) grouped
    ), technology_counts as (
      select jsonb_agg(
        jsonb_build_object(
          'key', slug,
          'label', label,
          'count', count
        ) order by count desc, slug
      ) as items
      from (
        select
          technology.slug,
          technology.label,
          count(distinct scoped.offer_id)::integer as count
        from scoped
        join offer_snapshot_technologies mention
          on mention.classification_id = scoped.classification_id
        join technologies technology on technology.id = mention.technology_id
        group by technology.slug, technology.label
        order by count desc, technology.slug
        limit 10
      ) grouped
    )
    select
      metrics.*,
      coalesce(experience.items, '[]'::jsonb) as "experienceBuckets",
      coalesce(technology_counts.items, '[]'::jsonb) as technologies,
      coalesce(contracts.items, '[]'::jsonb) as contracts,
      coalesce(remote_modes.items, '[]'::jsonb) as "remoteModes"
    from metrics
    cross join experience
    cross join technology_counts
    cross join contracts
    cross join remote_modes
  `;
  if (rawRows.length !== 1)
    throw new Error("Invalid overview aggregate result");
  const row = aggregateRowSchema.parse(rawRows[0]);
  const experienceCounts = new Map(
    row.experienceBuckets.map(({ key, count }) => [key, count] as const),
  );
  const remoteCounts = new Map(
    row.remoteModes.map(({ key, count }) => [key, count] as const),
  );
  const response: OverviewResponse = {
    data: {
      scope: query,
      headline: rateFromCounts({
        metric: "junior_contradiction_rate",
        metricVersion: requiredMetricVersion(
          dataset,
          "junior_contradiction_rate",
        ),
        numerator: row.contradictionNumerator,
        denominator: row.contradictionDenominator,
        unknownCount: row.contradictionUnknown,
        ambiguousCount: row.contradictionAmbiguous,
      }),
      beginnerFriendly: rateFromCounts({
        metric: "beginner_friendly_rate",
        metricVersion: requiredMetricVersion(dataset, "beginner_friendly_rate"),
        numerator: row.beginnerNumerator,
        denominator: row.beginnerDenominator,
        unknownCount: row.beginnerUnknown,
        ambiguousCount: row.beginnerAmbiguous,
      }),
      salaryTransparency: rateFromCounts({
        metric: "salary_transparency_rate",
        metricVersion: requiredMetricVersion(
          dataset,
          "salary_transparency_rate",
        ),
        numerator: row.salaryNumerator,
        denominator: row.sampleSize,
        unknownCount: 0,
        ambiguousCount: 0,
      }),
      experienceBuckets: experienceKeys.map((key) => ({
        key,
        count: experienceCounts.get(key) ?? 0,
      })),
      topTechnologies: withShares(row.technologies, row.sampleSize),
      contracts: withShares(row.contracts, row.sampleSize, contractLabels),
      remoteModes: Object.entries(remoteLabels).map(([key, label]) => {
        const count = remoteCounts.get(key) ?? 0;
        return {
          key,
          label,
          count,
          share: row.sampleSize === 0 ? null : count / row.sampleSize,
        };
      }),
      examples: [],
    },
    meta: responseMeta(dataset, generatedAt, row.sampleSize),
  };

  return overviewResponseSchema.parse(response);
}
