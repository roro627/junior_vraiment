import type { NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";

import {
  offersResponseSchema,
  publicOfferSchema,
  type OffersQuery,
  type OffersResponse,
  type PublicOffer,
  type ResponseMeta,
} from "@/application/queries/contracts";
import {
  decodeOffersCursor,
  encodeOffersCursor,
  offersFilterHash,
  publicOfferId,
} from "@/application/queries/public-id";

import { readCurrentDataset, type CurrentDataset } from "./current-dataset";

const salaryDataSchema = z
  .object({
    originalLabel: z.string(),
    minimumOriginal: z.number().nullable(),
    maximumOriginal: z.number().nullable(),
    period: z.enum(["hour", "month", "year"]).nullable(),
    currency: z.string().nullable(),
    grossOrNet: z.enum(["gross", "net", "unknown"]),
    normalizedAnnualMinimum: z.number().nullable(),
    normalizedAnnualMaximum: z.number().nullable(),
    normalizationWarning: z.string().nullable(),
  })
  .strict();

const evidenceRowSchema = z
  .object({
    kind: z.string(),
    ruleId: z.string(),
    sourceField: z.string().nullable(),
    excerpt: z.string(),
    normalizedValue: z.string().nullable(),
    ordinal: z.number().int().nonnegative(),
  })
  .strict();

const publicOfferRowSchema = z
  .object({
    offerId: z.string().uuid(),
    title: z.string(),
    companyName: z.string().nullable(),
    locationLabel: z.string().nullable(),
    contractLabel: z.string().nullable(),
    sourcePublishedAt: z.coerce.date().nullable(),
    lastSeenAt: z.coerce.date(),
    missingSince: z.coerce.date().nullable(),
    closedAt: z.coerce.date().nullable(),
    structuredExperienceLabel: z.string().nullable(),
    minimumExperienceMonths: z.number().int().nonnegative().nullable(),
    classificationStatus: z.enum(["classified", "ambiguous", "unclassified"]),
    claimsJunior: z.boolean().nullable(),
    beginnerFriendly: z.boolean().nullable(),
    contradictoryJunior: z.boolean().nullable(),
    classifierVersion: z.string(),
    warnings: z.array(z.object({ code: z.string() }).passthrough()),
    salaryTransparent: z.boolean(),
    remoteMode: z.enum(["remote", "hybrid", "onsite", "unknown"]),
    salaryData: salaryDataSchema.nullable(),
    applicationUrl: z.string().nullable(),
    sourceUrl: z.string().nullable(),
    sourceLabel: z.string(),
    attributionUrl: z.string(),
    evidence: z.array(evidenceRowSchema),
    technologies: z.array(z.string()),
    totalCount: z.number().int().nonnegative(),
  })
  .strict();

type PublicOffersInput = {
  sql: NeonQueryFunction<false, false>;
  query: OffersQuery;
  cursorSecret: string;
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

function safeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function requiredSafeUrl(value: string): string {
  const url = safeUrl(value);
  if (url === null) {
    throw new Error("Invalid source attribution URL in the published dataset");
  }
  return url;
}

function clipped(value: string | null, maximum: number): string | null {
  return value === null ? null : value.slice(0, maximum);
}

function mapPublicOffer(
  row: z.infer<typeof publicOfferRowSchema>,
): PublicOffer {
  const salary = row.salaryData;
  const publicOffer: PublicOffer = {
    id: publicOfferId(row.offerId),
    title: row.title.slice(0, 250),
    companyName: clipped(row.companyName, 250),
    locationLabel: clipped(row.locationLabel, 250),
    contractLabel: clipped(row.contractLabel, 150),
    publishedAt: row.sourcePublishedAt?.toISOString() ?? null,
    lastSeenAt: row.lastSeenAt.toISOString(),
    availability:
      row.closedAt !== null
        ? "closed"
        : row.missingSince !== null
          ? "not_seen"
          : "active",
    minimumExperienceMonths: row.minimumExperienceMonths,
    experienceLabel: clipped(row.structuredExperienceLabel, 250),
    classification: {
      status: row.classificationStatus,
      claimsJunior: row.claimsJunior,
      beginnerFriendly: row.beginnerFriendly,
      contradictoryJunior: row.contradictoryJunior,
      classifierVersion: row.classifierVersion,
      warnings: row.warnings.map(({ code }) => code.slice(0, 120)),
    },
    evidence: row.evidence.map((evidence) => ({
      kind: evidence.kind as PublicOffer["evidence"][number]["kind"],
      ruleId: evidence.ruleId,
      sourceField: evidence.sourceField,
      excerpt: evidence.excerpt.slice(0, 700),
      normalizedValue: evidence.normalizedValue,
    })),
    technologies: row.technologies,
    salary:
      salary === null
        ? null
        : {
            published: row.salaryTransparent,
            label: clipped(salary.originalLabel, 250),
            minimumAnnualGross: salary.normalizedAnnualMinimum,
            maximumAnnualGross: salary.normalizedAnnualMaximum,
            currency: salary.currency,
            period: salary.period,
          },
    remoteMode: row.remoteMode,
    source: {
      label: row.sourceLabel.slice(0, 100),
      offerUrl: safeUrl(row.applicationUrl) ?? safeUrl(row.sourceUrl),
      attributionUrl: requiredSafeUrl(row.attributionUrl),
    },
  };

  return publicOfferSchema.parse(publicOffer);
}

function metaFor(
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

export async function getPublicOffers({
  sql,
  query,
  cursorSecret,
  generatedAt,
}: PublicOffersInput): Promise<OffersResponse> {
  const dataset = await readCurrentDataset(sql);
  const area = parseArea(query.scope.area);
  const technologyJson = JSON.stringify(query.scope.technologies);
  const contractJson = JSON.stringify(query.scope.contracts);
  const experienceJson = JSON.stringify(query.experience);
  const periodDays =
    query.scope.period === "7d"
      ? 7
      : query.scope.period === "30d"
        ? 30
        : query.scope.period === "90d"
          ? 90
          : null;
  const filterHash = offersFilterHash({
    scope: query.scope,
    classification: query.classification,
    salaryPublished: query.salaryPublished,
    experience: query.experience,
  });
  const cursor = query.cursor
    ? decodeOffersCursor(
        query.cursor,
        {
          datasetVersion: dataset.datasetVersion,
          filterHash,
          sort: query.sort,
        },
        cursorSecret,
      )
    : null;
  const cursorPrimary = cursor?.primary ?? null;
  const cursorOfferId = cursor?.offerId ?? null;
  const rows = await sql`
    with scoped as (
      select
        membership.offer_id,
        snapshot.id as snapshot_id,
        membership.classification_id,
        snapshot.source_published_at,
        classification.minimum_experience_months,
        case
          when classification.status = 'ambiguous' then 'ambiguous'
          when classification.status = 'unclassified' then 'unknown'
          when classification.status = 'classified'
            and classification.contradictory_junior = true then 'contradictory'
          when classification.status = 'classified'
            and classification.beginner_friendly = true then 'beginner_friendly'
          when classification.status = 'classified'
            and classification.claims_junior = true
            and (classification.beginner_friendly is null
              or classification.contradictory_junior is null) then 'junior_unresolved'
          when classification.status = 'classified'
            and classification.claims_junior = true
            and classification.beginner_friendly = false
            and classification.contradictory_junior = false then 'other_junior'
          when classification.status = 'classified'
            and classification.claims_junior = false then 'not_explicitly_junior'
          else 'unknown'
        end as classification_segment
      from published_dataset_offers membership
      join offer_snapshots snapshot on snapshot.id = membership.snapshot_id
      join classifications classification
        on classification.id = membership.classification_id
      where membership.dataset_id = ${dataset.datasetId}
        and (
          ${query.scope.job}::text is null
          or ${query.scope.job}::text = any(membership.job_families)
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
            ${dataset.sourceCutoffAt}::timestamptz - (${periodDays}::integer * interval '1 day')
        )
    ), filtered as (
      select *
      from scoped
      where (${query.classification}::text is null
        or classification_segment = ${query.classification})
        and (${query.salaryPublished}::boolean is null or exists (
          select 1 from classifications salary_classification
          where salary_classification.id = scoped.classification_id
            and salary_classification.salary_transparent = ${query.salaryPublished}
        ))
        and (
          jsonb_array_length(${experienceJson}::jsonb) = 0
          or exists (
            select 1
            from jsonb_array_elements_text(${experienceJson}::jsonb) requested(bucket)
            where requested.bucket = case
              when classification_segment = 'ambiguous' then 'ambiguous'
              when minimum_experience_months = 0 then 'none'
              when minimum_experience_months between 1 and 12 then '1_12'
              when minimum_experience_months between 13 and 23 then '13_23'
              when minimum_experience_months between 24 and 35 then '24_35'
              when minimum_experience_months between 36 and 59 then '36_59'
              when minimum_experience_months >= 60 then '60_plus'
              else 'unknown'
            end
          )
        )
    ), page as (
      select *
      from filtered
      where ${cursorOfferId}::uuid is null
        or (
          ${query.sort}::text = 'published_desc' and (
            (${cursorPrimary}::double precision is not null and (
              source_published_at < to_timestamp(${cursorPrimary}::double precision / 1000.0)
              or source_published_at is null
              or (source_published_at = to_timestamp(${cursorPrimary}::double precision / 1000.0)
                and offer_id < ${cursorOfferId}::uuid)
            ))
            or (${cursorPrimary}::double precision is null
              and source_published_at is null and offer_id < ${cursorOfferId}::uuid)
          )
        )
        or (
          ${query.sort}::text = 'published_asc' and (
            (${cursorPrimary}::double precision is not null and (
              source_published_at > to_timestamp(${cursorPrimary}::double precision / 1000.0)
              or source_published_at is null
              or (source_published_at = to_timestamp(${cursorPrimary}::double precision / 1000.0)
                and offer_id > ${cursorOfferId}::uuid)
            ))
            or (${cursorPrimary}::double precision is null
              and source_published_at is null and offer_id > ${cursorOfferId}::uuid)
          )
        )
        or (
          ${query.sort}::text = 'experience_desc' and (
            (${cursorPrimary}::double precision is not null and (
              minimum_experience_months < ${cursorPrimary}::double precision
              or minimum_experience_months is null
              or (minimum_experience_months = ${cursorPrimary}::double precision
                and offer_id < ${cursorOfferId}::uuid)
            ))
            or (${cursorPrimary}::double precision is null
              and minimum_experience_months is null and offer_id < ${cursorOfferId}::uuid)
          )
        )
        or (
          ${query.sort}::text = 'experience_asc' and (
            (${cursorPrimary}::double precision is not null and (
              minimum_experience_months > ${cursorPrimary}::double precision
              or minimum_experience_months is null
              or (minimum_experience_months = ${cursorPrimary}::double precision
                and offer_id > ${cursorOfferId}::uuid)
            ))
            or (${cursorPrimary}::double precision is null
              and minimum_experience_months is null and offer_id > ${cursorOfferId}::uuid)
          )
        )
      order by
        case when ${query.sort} = 'published_desc' then source_published_at end desc nulls last,
        case when ${query.sort} = 'published_asc' then source_published_at end asc nulls last,
        case when ${query.sort} = 'experience_desc' then minimum_experience_months end desc nulls last,
        case when ${query.sort} = 'experience_asc' then minimum_experience_months end asc nulls last,
        case when ${query.sort} in ('published_desc', 'experience_desc') then offer_id end desc,
        case when ${query.sort} in ('published_asc', 'experience_asc') then offer_id end asc
      limit ${query.limit + 1}
    )
    select
      page.offer_id as "offerId",
      snapshot.title,
      snapshot.company_name as "companyName",
      snapshot.location_label as "locationLabel",
      snapshot.contract_label as "contractLabel",
      snapshot.source_published_at as "sourcePublishedAt",
      offer.last_seen_at as "lastSeenAt",
      offer.missing_since as "missingSince",
      offer.closed_at as "closedAt",
      snapshot.structured_experience_label as "structuredExperienceLabel",
      classification.minimum_experience_months as "minimumExperienceMonths",
      classification.status as "classificationStatus",
      classification.claims_junior as "claimsJunior",
      classification.beginner_friendly as "beginnerFriendly",
      classification.contradictory_junior as "contradictoryJunior",
      classification.classifier_version as "classifierVersion",
      classification.warnings,
      classification.salary_transparent as "salaryTransparent",
      classification.remote_mode as "remoteMode",
      snapshot.salary_data as "salaryData",
      snapshot.application_url as "applicationUrl",
      snapshot.source_url as "sourceUrl",
      source.label as "sourceLabel",
      source.attribution_url as "attributionUrl",
      coalesce(evidence.items, '[]'::jsonb) as evidence,
      coalesce(technology.slugs, '{}'::text[]) as technologies,
      (select count(*)::integer from filtered) as "totalCount"
    from page
    join offers offer on offer.id = page.offer_id
    join sources source on source.id = offer.source_id
    join offer_snapshots snapshot on snapshot.id = page.snapshot_id
    join classifications classification on classification.id = page.classification_id
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'kind', item.evidence_kind,
        'ruleId', item.rule_id,
        'sourceField', item.source_field,
        'excerpt', item.excerpt,
        'normalizedValue', item.normalized_value,
        'ordinal', item.ordinal
      ) order by item.ordinal) as items
      from classification_evidence item
      where item.classification_id = page.classification_id
    ) evidence on true
    left join lateral (
      select array_agg(item.slug order by item.slug) as slugs
      from offer_snapshot_technologies mention
      join technologies item on item.id = mention.technology_id
      where mention.classification_id = page.classification_id
    ) technology on true
    order by
      case when ${query.sort} = 'published_desc' then page.source_published_at end desc nulls last,
      case when ${query.sort} = 'published_asc' then page.source_published_at end asc nulls last,
      case when ${query.sort} = 'experience_desc' then page.minimum_experience_months end desc nulls last,
      case when ${query.sort} = 'experience_asc' then page.minimum_experience_months end asc nulls last,
      case when ${query.sort} in ('published_desc', 'experience_desc') then page.offer_id end desc,
      case when ${query.sort} in ('published_asc', 'experience_asc') then page.offer_id end asc
  `;
  const parsedRows = rows.map((row) => publicOfferRowSchema.parse(row));
  const hasNext = parsedRows.length > query.limit;
  const pageRows = parsedRows.slice(0, query.limit);
  const last = pageRows.at(-1);
  const nextCursor =
    hasNext && last
      ? encodeOffersCursor(
          {
            version: 1,
            datasetVersion: dataset.datasetVersion,
            filterHash,
            sort: query.sort,
            offerId: last.offerId,
            primary: query.sort.startsWith("published")
              ? (last.sourcePublishedAt?.getTime() ?? null)
              : last.minimumExperienceMonths,
          },
          cursorSecret,
        )
      : null;
  const response: OffersResponse = {
    data: {
      items: pageRows.map(mapPublicOffer),
      page: { nextCursor, hasNext },
    },
    meta: metaFor(dataset, generatedAt, parsedRows[0]?.totalCount ?? 0),
  };

  return offersResponseSchema.parse(response);
}
