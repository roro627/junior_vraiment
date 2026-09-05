import type { NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";

import { classifyOffer } from "@/domain/classification/classifier";
import { CLASSIFIER_VERSION } from "@/domain/classification/types";
import {
  contractKinds,
  type NormalizedOffer,
} from "@/domain/offers/normalized-offer";
import { readCurrentDataset } from "@/db/queries/current-dataset";
import { storeClassification } from "@/db/store-classification";
import { syncTechnologyTaxonomy } from "@/db/sync-taxonomies";

const salarySchema = z
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

const snapshotRowSchema = z
  .object({
    snapshotId: z.string().uuid(),
    externalId: z.string().min(1),
    sourceKey: z.literal("france-travail"),
    title: z.string(),
    descriptionText: z.string(),
    companyName: z.string().nullable(),
    sourcePublishedAt: z.coerce.date().nullable(),
    sourceUpdatedAt: z.coerce.date().nullable(),
    locationLabel: z.string().nullable(),
    communeCode: z.string().nullable(),
    departmentCode: z.string().nullable(),
    regionCode: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    contractSourceCode: z.string().nullable(),
    contractKind: z.enum(contractKinds),
    contractLabel: z.string().nullable(),
    structuredExperienceRequired: z.boolean().nullable(),
    structuredExperienceLabel: z.string().nullable(),
    salaryData: salarySchema.nullable(),
    applicationUrl: z.string().nullable(),
    sourceUrl: z.string().nullable(),
  })
  .strict();

type ReclassifyCurrentDatasetInput = {
  sql: NeonQueryFunction<false, false>;
  classifiedAt: Date;
  concurrency?: number;
};

export type ReclassificationSummary = {
  datasetVersion: string;
  classifierVersion: typeof CLASSIFIER_VERSION;
  snapshotCount: number;
  classificationsCreated: number;
  classificationCount: number;
  technologyMentionCount: number;
};

function normalizedOffer(
  row: z.infer<typeof snapshotRowSchema>,
): NormalizedOffer {
  return {
    source: row.sourceKey,
    externalId: row.externalId,
    title: row.title,
    descriptionText: row.descriptionText,
    companyName: row.companyName,
    publishedAt: row.sourcePublishedAt,
    updatedAt: row.sourceUpdatedAt,
    location: {
      label: row.locationLabel,
      communeCode: row.communeCode,
      departmentCode: row.departmentCode,
      regionCode: row.regionCode,
      latitude: row.latitude,
      longitude: row.longitude,
    },
    contract: {
      sourceCode: row.contractSourceCode,
      normalized: row.contractKind,
      label: row.contractLabel,
    },
    structuredExperience: {
      required: row.structuredExperienceRequired,
      label: row.structuredExperienceLabel,
    },
    salary: row.salaryData,
    applicationUrl: row.applicationUrl,
    sourceUrl: row.sourceUrl,
    rawPayload: null,
  };
}

export async function reclassifyCurrentDataset({
  sql,
  classifiedAt,
  concurrency = 8,
}: ReclassifyCurrentDatasetInput): Promise<ReclassificationSummary> {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
    throw new RangeError("La concurrence de reclassification est invalide.");
  }

  const dataset = await readCurrentDataset(sql);
  await syncTechnologyTaxonomy(sql);
  const rows = await sql`
    select
      snapshot.id as "snapshotId",
      offer.external_id as "externalId",
      source.key as "sourceKey",
      snapshot.title,
      snapshot.description_text as "descriptionText",
      snapshot.company_name as "companyName",
      snapshot.source_published_at as "sourcePublishedAt",
      snapshot.source_updated_at as "sourceUpdatedAt",
      snapshot.location_label as "locationLabel",
      snapshot.commune_code as "communeCode",
      snapshot.department_code as "departmentCode",
      snapshot.region_code as "regionCode",
      snapshot.latitude,
      snapshot.longitude,
      snapshot.contract_source_code as "contractSourceCode",
      snapshot.contract_kind as "contractKind",
      snapshot.contract_label as "contractLabel",
      snapshot.structured_experience_required as "structuredExperienceRequired",
      snapshot.structured_experience_label as "structuredExperienceLabel",
      snapshot.salary_data as "salaryData",
      snapshot.application_url as "applicationUrl",
      snapshot.source_url as "sourceUrl"
    from published_dataset_offers membership
    join offer_snapshots snapshot on snapshot.id = membership.snapshot_id
    join offers offer on offer.id = membership.offer_id
    join sources source on source.id = offer.source_id
    where membership.dataset_id = ${dataset.datasetId}
    order by membership.offer_id
  `;
  const snapshots = rows.map((row) => snapshotRowSchema.parse(row));
  let classificationsCreated = 0;

  for (let start = 0; start < snapshots.length; start += concurrency) {
    const batch = snapshots.slice(start, start + concurrency);
    const created = await Promise.all(
      batch.map((snapshot) =>
        storeClassification({
          sql,
          snapshotId: snapshot.snapshotId,
          classification: classifyOffer(normalizedOffer(snapshot)),
          classifiedAt,
        }),
      ),
    );
    classificationsCreated += created.filter(Boolean).length;
  }

  const [verification] = await sql`
    select
      count(distinct classification.id)::integer as "classificationCount",
      count(distinct (
        technology.classification_id,
        technology.technology_id
      ))::integer as "technologyMentionCount"
    from published_dataset_offers membership
    join classifications classification
      on classification.snapshot_id = membership.snapshot_id
      and classification.classifier_version = ${CLASSIFIER_VERSION}
    left join offer_snapshot_technologies technology
      on technology.classification_id = classification.id
    where membership.dataset_id = ${dataset.datasetId}
  `;
  const classificationCount = z
    .number()
    .int()
    .nonnegative()
    .parse(verification?.["classificationCount"]);
  const technologyMentionCount = z
    .number()
    .int()
    .nonnegative()
    .parse(verification?.["technologyMentionCount"]);

  if (classificationCount !== snapshots.length) {
    throw new Error("La reclassification du dataset est incomplète.");
  }

  return {
    datasetVersion: dataset.datasetVersion,
    classifierVersion: CLASSIFIER_VERSION,
    snapshotCount: snapshots.length,
    classificationsCreated,
    classificationCount,
    technologyMentionCount,
  };
}
