import type { NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";

import {
  taxonomiesResponseSchema,
  type ResponseMeta,
  type TaxonomiesResponse,
} from "@/application/queries/contracts";
import { JOB_FAMILIES } from "@/domain/taxonomies/job-registry";
import { TAXONOMY_VERSIONS } from "@/domain/taxonomies/versions";

import { readCurrentDataset, type CurrentDataset } from "./current-dataset";

const countRowSchema = z
  .object({
    key: z.string(),
    label: z.string().nullable().optional(),
    count: z.number().int().nonnegative(),
  })
  .strict();

type PublicTaxonomiesInput = {
  sql: NeonQueryFunction<false, false>;
  generatedAt: Date;
};

const contractLabels = {
  cdi: "CDI",
  cdd: "CDD",
  interim: "Intérim",
  alternance: "Alternance",
  internship: "Stage",
  freelance: "Freelance",
  public: "Secteur public",
  other: "Autre",
  unknown: "Non précisé",
} as const;

const remoteLabels = {
  remote: "100 % à distance",
  hybrid: "Hybride",
  onsite: "Sur site",
  unknown: "Non précisé",
} as const;

function responseMeta(
  dataset: CurrentDataset,
  generatedAt: Date,
): ResponseMeta {
  const partial = dataset.qualitySummary["decision"] === "publish_partial";
  return {
    generatedAt: generatedAt.toISOString(),
    dataAsOf: dataset.sourceCutoffAt.toISOString(),
    datasetVersion: dataset.datasetVersion,
    classifierVersion: dataset.classifierVersion,
    metricVersions: dataset.metricVersions,
    querySetVersion: dataset.querySetVersion,
    sampleSize: dataset.memberCount,
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

function countMap(rows: readonly unknown[]): Map<string, number> {
  return new Map(
    rows.map((row) => {
      const parsed = countRowSchema.parse(row);
      return [parsed.key, parsed.count] as const;
    }),
  );
}

export async function getPublicTaxonomies({
  sql,
  generatedAt,
}: PublicTaxonomiesInput): Promise<TaxonomiesResponse> {
  const dataset = await readCurrentDataset(sql);
  const [jobRows, technologyRows, areaRows, contractRows, remoteRows] =
    await Promise.all([
      sql`
        select
          family.key,
          count(distinct membership.offer_id)::integer as count
        from published_dataset_offers membership
        join offer_query_matches matched on matched.offer_id = membership.offer_id
        join source_queries source_query on source_query.id = matched.source_query_id
        cross join lateral unnest(coalesce(matched.matched_job_families, source_query.job_families)) family(key)
        where membership.dataset_id = ${dataset.datasetId}
          and source_query.query_set_version = ${dataset.querySetVersion}
        group by family.key
      `,
      sql`
        select
          technology.slug as key,
          technology.label,
          count(distinct membership.offer_id)::integer as count
        from technologies technology
        left join offer_snapshot_technologies mention
          on mention.technology_id = technology.id
        left join published_dataset_offers membership
          on membership.classification_id = mention.classification_id
          and membership.dataset_id = ${dataset.datasetId}
        where technology.taxonomy_version = ${TAXONOMY_VERSIONS.technologies}
          and technology.enabled = true
        group by technology.id
        order by technology.slug
      `,
      sql`
        select
          snapshot.region_code as key,
          count(*)::integer as count
        from published_dataset_offers membership
        join offer_snapshots snapshot on snapshot.id = membership.snapshot_id
        where membership.dataset_id = ${dataset.datasetId}
          and snapshot.region_code is not null
        group by snapshot.region_code
        order by count desc, snapshot.region_code
        limit 12
      `,
      sql`
        select snapshot.contract_kind as key, count(*)::integer as count
        from published_dataset_offers membership
        join offer_snapshots snapshot on snapshot.id = membership.snapshot_id
        where membership.dataset_id = ${dataset.datasetId}
        group by snapshot.contract_kind
      `,
      sql`
        select classification.remote_mode as key, count(*)::integer as count
        from published_dataset_offers membership
        join classifications classification
          on classification.id = membership.classification_id
        where membership.dataset_id = ${dataset.datasetId}
        group by classification.remote_mode
      `,
    ]);
  const jobs = countMap(jobRows);
  const contracts = countMap(contractRows);
  const remoteModes = countMap(remoteRows);
  const technologies = technologyRows.map((row) => countRowSchema.parse(row));
  const popularAreas = areaRows.map((row) => countRowSchema.parse(row));

  const response: TaxonomiesResponse = {
    data: {
      versions: {
        jobs: dataset.taxonomyVersions["jobs"] ?? TAXONOMY_VERSIONS.jobs,
        technologies:
          dataset.taxonomyVersions["technologies"] ??
          TAXONOMY_VERSIONS.technologies,
        geography:
          dataset.taxonomyVersions["geography"] ?? TAXONOMY_VERSIONS.geography,
        contracts:
          dataset.taxonomyVersions["contracts"] ?? TAXONOMY_VERSIONS.contracts,
      },
      jobs: JOB_FAMILIES.map((job) => ({
        id: job.id,
        label: job.label,
        availableCount: jobs.get(job.id) ?? 0,
        parentId: null,
      })),
      technologies: technologies.map((technology) => ({
        id: technology.key,
        label: technology.label ?? technology.key,
        availableCount: technology.count,
        parentId: null,
      })),
      popularAreas: popularAreas.map((area) => ({
        id: `region:${area.key}`,
        label: `Région ${area.key}`,
        availableCount: area.count,
        parentId: "france",
      })),
      contracts: Object.entries(contractLabels).map(([id, label]) => ({
        id,
        label,
        availableCount: contracts.get(id) ?? 0,
        parentId: null,
      })),
      remoteModes: Object.entries(remoteLabels).map(([id, label]) => ({
        id,
        label,
        availableCount: remoteModes.get(id) ?? 0,
        parentId: null,
      })),
    },
    meta: responseMeta(dataset, generatedAt),
  };

  return taxonomiesResponseSchema.parse(response);
}
