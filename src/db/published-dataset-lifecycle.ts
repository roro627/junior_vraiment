import type { NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";
import { JUNIOR_OBSERVATION_VERSION } from "@/domain/classification/junior-observation";
import {
  computeJuniorObservationMetric,
  JUNIOR_OBSERVATION_METRIC_VERSION,
} from "@/domain/metrics/junior-observation";

import {
  CLASSIFIER_VERSION,
  type ClassificationResult,
} from "@/domain/classification/types";
import {
  computeJuniorContradictionMetric,
  JUNIOR_CONTRADICTION_METRIC_VERSION,
  type JuniorContradictionMetric,
} from "@/domain/metrics/junior-contradiction";
import {
  BEGINNER_FRIENDLY_METRIC_VERSION,
  computeBeginnerFriendlyMetric,
  type BeginnerFriendlyMetric,
} from "@/domain/metrics/beginner-friendly";
import {
  computeSalaryTransparencyMetric,
  SALARY_TRANSPARENCY_METRIC_VERSION,
  type SalaryTransparencyMetric,
} from "@/domain/metrics/salary-transparency";

const OVERALL_DIMENSION_HASH = "overall-v1";

export type DatasetQualityDecision = "publish" | "publish_partial" | "hold";

export type DraftDatasetInput = {
  sql: NeonQueryFunction<false, false>;
  datasetVersion: string;
  ingestionRunId: string;
  classifierVersion: string;
  metricVersions: Readonly<Record<string, string>>;
  taxonomyVersions: Readonly<Record<string, string>>;
  qualitySummary: Readonly<Record<string, unknown>>;
  computedAt: Date;
};

export type DraftDataset = {
  datasetId: string;
  datasetVersion: string;
  sourceId: string;
  querySetVersion: string;
  businessDate: string;
  status: "draft" | "validated" | "published" | "withdrawn";
};

export type FrozenDatasetMembership = {
  datasetId: string;
  memberCount: number;
  missingClassificationCount: number;
};

export type DatasetMetric = {
  datasetId: string;
  metric:
    | JuniorContradictionMetric
    | ReturnType<typeof computeJuniorObservationMetric>
    | BeginnerFriendlyMetric
    | SalaryTransparencyMetric;
};

export type DatasetValidationResult = {
  datasetId: string;
  validated: boolean;
  invariants: {
    publishDecision: boolean;
    hasMembers: boolean;
    membershipMatchesScope: boolean;
    classificationsComplete: boolean;
    metricPresent: boolean;
    observationEvidenceComplete: boolean;
  };
};

function requiredString(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Le champ base ${field} est absent.`);
  }
  return value;
}

function requiredInteger(row: Record<string, unknown>, field: string): number {
  const value = row[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`Le compteur base ${field} est invalide.`);
  }
  return value;
}

function asDatasetStatus(value: string): DraftDataset["status"] {
  if (
    value === "draft" ||
    value === "validated" ||
    value === "published" ||
    value === "withdrawn"
  ) {
    return value;
  }
  throw new Error("Le statut du dataset est invalide.");
}

/**
 * Creates the immutable dataset shell. Repeating the operation is safe only
 * when the version still denotes the exact same completed ingestion run.
 */
export async function createOrResumeDraftDataset(
  input: DraftDatasetInput,
): Promise<DraftDataset> {
  if (input.datasetVersion.length < 1 || input.datasetVersion.length > 100)
    throw new RangeError(
      "La version du dataset dépasse le contrat public (100 caractères).",
    );
  const metricVersions = JSON.stringify(input.metricVersions);
  const taxonomyVersions = JSON.stringify(input.taxonomyVersions);
  const qualitySummary = JSON.stringify(input.qualitySummary);

  await input.sql`
    insert into published_datasets (
      dataset_version, source_id, ingestion_run_id, classifier_version,
      metric_versions, query_set_version, taxonomy_versions, source_cutoff_at,
      computed_at, status, is_current, quality_summary
    )
    select
      ${input.datasetVersion}, run.source_id, run.id, ${input.classifierVersion},
      ${metricVersions}::jsonb, run.query_set_version, ${taxonomyVersions}::jsonb,
      source_pages.cutoff_at, ${input.computedAt},
      'draft', false, ${qualitySummary}::jsonb
    from ingestion_runs run
    cross join lateral (
      select max(page.committed_at) as cutoff_at
      from ingestion_run_queries query
      join ingestion_query_pages page on page.ingestion_run_query_id = query.id
      where query.ingestion_run_id = run.id
    ) source_pages
    where run.id = ${input.ingestionRunId}
      and run.mode = 'full'
      and run.status in ('succeeded', 'partial')
      and run.finished_at is not null
      and source_pages.cutoff_at is not null
      and source_pages.cutoff_at <= run.finished_at
    on conflict (dataset_version) do nothing
  `;

  const rows = await input.sql`
    select
      dataset.id as "datasetId",
      dataset.dataset_version as "datasetVersion",
      dataset.source_id as "sourceId",
      dataset.query_set_version as "querySetVersion",
      run.business_date::text as "businessDate",
      dataset.status,
      dataset.ingestion_run_id as "ingestionRunId",
      dataset.classifier_version as "classifierVersion"
    from published_datasets dataset
    join ingestion_runs run on run.id = dataset.ingestion_run_id
    where dataset.dataset_version = ${input.datasetVersion}
  `;
  const row = rows.at(0);
  if (!row) {
    throw new Error(
      "Le run complet doit être terminé avant le gel du dataset.",
    );
  }
  if (
    requiredString(row, "ingestionRunId") !== input.ingestionRunId ||
    requiredString(row, "classifierVersion") !== input.classifierVersion
  ) {
    throw new Error(
      "Cette version de dataset est déjà rattachée à une autre provenance.",
    );
  }

  return {
    datasetId: requiredString(row, "datasetId"),
    datasetVersion: requiredString(row, "datasetVersion"),
    sourceId: requiredString(row, "sourceId"),
    querySetVersion: requiredString(row, "querySetVersion"),
    businessDate: requiredString(row, "businessDate"),
    status: asDatasetStatus(requiredString(row, "status")),
  };
}

/**
 * Captures the current, active perimeter once. Existing membership is never
 * refreshed: a published dataset must keep the snapshot and classification it
 * was computed from even if the source changes later.
 */
export async function freezeDatasetMembership(input: {
  sql: NeonQueryFunction<false, false>;
  datasetId: string;
}): Promise<FrozenDatasetMembership> {
  const existingRows = await input.sql`
    select count(*)::integer as "memberCount"
    from published_dataset_offers
    where dataset_id = ${input.datasetId}
  `;
  const existingCount = requiredInteger(
    existingRows.at(0) ?? {},
    "memberCount",
  );

  if (existingCount === 0) {
    await input.sql`
      insert into published_dataset_offers (
        dataset_id, offer_id, snapshot_id, classification_id, job_families
      )
      select distinct on (offer.id)
        dataset.id, offer.id, snapshot.id, classification.id,
        array(
          select distinct family.key
          from offer_query_matches matched
          join source_queries query on query.id = matched.source_query_id
          cross join lateral unnest(coalesce(matched.matched_job_families, query.job_families)) family(key)
          where matched.offer_id = offer.id
            and query.source_id = dataset.source_id
            and query.query_set_version = dataset.query_set_version
            and query.enabled = true and query.valid_to is null
          order by family.key
        )
      from published_datasets dataset
      join offers offer
        on offer.source_id = dataset.source_id
        and offer.closed_at is null
      join offer_snapshots snapshot
        on snapshot.offer_id = offer.id
        and snapshot.valid_to is null
      join classifications classification
        on classification.snapshot_id = snapshot.id
        and classification.classifier_version = dataset.classifier_version
      where dataset.id = ${input.datasetId}
        and dataset.status = 'draft'
        and exists (
          select 1
          from offer_query_matches matched
          join source_queries query
            on query.id = matched.source_query_id
          where matched.offer_id = offer.id
            and query.source_id = dataset.source_id
            and query.query_set_version = dataset.query_set_version
            and query.enabled = true
            and query.valid_to is null
        )
      order by offer.id, classification.id
      on conflict (dataset_id, offer_id) do nothing
    `;
  }

  const counts = await input.sql`
    with dataset_scope as (
      select dataset.id, dataset.source_id, dataset.query_set_version,
        dataset.classifier_version
      from published_datasets dataset
      where dataset.id = ${input.datasetId}
    ), active_scope as (
      select distinct offer.id
      from dataset_scope dataset
      join offers offer
        on offer.source_id = dataset.source_id
        and offer.closed_at is null
      where exists (
        select 1
        from offer_query_matches matched
        join source_queries query on query.id = matched.source_query_id
        where matched.offer_id = offer.id
          and query.source_id = dataset.source_id
          and query.query_set_version = dataset.query_set_version
          and query.enabled = true
          and query.valid_to is null
      )
    ), incomplete_scope as (
      select active_scope.id
      from active_scope
      join offer_snapshots snapshot
        on snapshot.offer_id = active_scope.id and snapshot.valid_to is null
      join dataset_scope dataset on true
      left join classifications classification
        on classification.snapshot_id = snapshot.id
        and classification.classifier_version = dataset.classifier_version
      where classification.id is null
    )
    select
      (select count(*)::integer from published_dataset_offers
        where dataset_id = ${input.datasetId}) as "memberCount",
      (select count(*)::integer from incomplete_scope) as "missingClassificationCount"
  `;
  const row = counts.at(0) ?? {};
  return {
    datasetId: input.datasetId,
    memberCount: requiredInteger(row, "memberCount"),
    missingClassificationCount: requiredInteger(
      row,
      "missingClassificationCount",
    ),
  };
}

function metricClassification(
  row: Record<string, unknown>,
): ClassificationResult {
  const status = requiredString(row, "status");
  const claimsJunior = row["claimsJunior"];
  const minimumExperienceMonths = row["minimumExperienceMonths"];
  const beginnerFriendly = row["beginnerFriendly"];
  const salaryTransparent = row["salaryTransparent"];
  if (
    (claimsJunior !== null && typeof claimsJunior !== "boolean") ||
    (beginnerFriendly !== null && typeof beginnerFriendly !== "boolean") ||
    typeof salaryTransparent !== "boolean" ||
    (minimumExperienceMonths !== null &&
      (typeof minimumExperienceMonths !== "number" ||
        !Number.isInteger(minimumExperienceMonths) ||
        minimumExperienceMonths < 0))
  ) {
    throw new Error("Les données de classification métrique sont invalides.");
  }
  if (
    status !== "classified" &&
    status !== "ambiguous" &&
    status !== "unclassified"
  ) {
    throw new Error("Le statut de classification métrique est invalide.");
  }
  return {
    classifierVersion: CLASSIFIER_VERSION,
    status,
    claimsJunior,
    minimumExperienceMonths,
    beginnerFriendly,
    contradictoryJunior: null,
    salaryTransparent,
    remoteMode: "unknown",
    technologySlugs: [],
    evidence: [],
    ruleIds: [],
    warnings: [],
  };
}

export async function computeAndStorePublishedMetrics(input: {
  sql: NeonQueryFunction<false, false>;
  datasetId: string;
  computedAt: Date;
}): Promise<DatasetMetric[]> {
  const classificationRows = await input.sql`
    select
      classification.status,
      classification.claims_junior as "claimsJunior",
      classification.minimum_experience_months as "minimumExperienceMonths",
      classification.beginner_friendly as "beginnerFriendly",
      classification.salary_transparent as "salaryTransparent"
      , classification.junior_observation_version as "observationVersion"
      , classification.junior_observation_status as "observationStatus"
      , classification.junior_observation_contradictory as "observationContradictory"
    from published_dataset_offers membership
    join classifications classification on classification.id = membership.classification_id
    where membership.dataset_id = ${input.datasetId}
    order by membership.offer_id
  `;
  const classifications = classificationRows.map(metricClassification);
  const datasetRows = await input.sql`
    select run.business_date::text as "businessDate", dataset.metric_versions as "metricVersions"
    from published_datasets dataset
    join ingestion_runs run on run.id = dataset.ingestion_run_id
    where dataset.id = ${input.datasetId}
  `;
  const dataset = datasetRows.at(0);
  if (!dataset) throw new Error("Le dataset est introuvable.");
  const versions = z
    .record(z.string(), z.string())
    .parse(dataset["metricVersions"]);
  const observationSchema = z
    .object({
      observationVersion: z.literal(JUNIOR_OBSERVATION_VERSION),
      observationStatus: z.enum(["resolved", "unknown", "ambiguous"]),
      observationContradictory: z.boolean().nullable(),
      claimsJunior: z.boolean().nullable(),
    })
    .refine(
      (row) =>
        (row.observationStatus === "resolved") ===
        (row.observationContradictory !== null),
    );
  const juniorVersion = versions["junior_contradiction_rate"];
  if (
    juniorVersion !== JUNIOR_CONTRADICTION_METRIC_VERSION &&
    juniorVersion !== JUNIOR_OBSERVATION_METRIC_VERSION
  )
    throw new Error("Version du KPI principal non prise en charge.");
  const juniorMetric =
    juniorVersion === JUNIOR_OBSERVATION_METRIC_VERSION
      ? computeJuniorObservationMetric(
          classificationRows.map((row) => {
            const value = observationSchema.parse(row);
            return {
              claimsJunior: value.claimsJunior,
              status: value.observationStatus,
              contradictory: value.observationContradictory,
            };
          }),
        )
      : computeJuniorContradictionMetric(classifications);
  const metrics = [
    juniorMetric,
    computeBeginnerFriendlyMetric(classifications),
    computeSalaryTransparencyMetric(classifications),
  ];
  for (const metric of metrics)
    if (versions[metric.metric] !== metric.metricVersion)
      throw new Error(
        "Le calcul ne correspond pas à la méthode déclarée du dataset.",
      );
  const businessDate = requiredString(dataset, "businessDate");
  for (const metric of metrics) {
    const metadata = JSON.stringify({
      methodology: metric.metricVersion,
      population: "frozen_dataset_membership",
    });

    await input.sql`
      insert into daily_metrics (
        dataset_id, metric_key, metric_version, period_start, period_end,
        dimensions, dimension_hash, numerator, denominator, population_count,
        unknown_count, ambiguous_count, value_numeric, coverage_numeric,
        sample_quality, metadata, computed_at
      ) values (
        ${input.datasetId}, ${metric.metric}, ${metric.metricVersion},
        ${businessDate}, ${businessDate}, '{}'::jsonb, ${OVERALL_DIMENSION_HASH},
        ${metric.numerator}, ${metric.denominator}, ${metric.populationCount},
        ${metric.unknownCount}, ${metric.ambiguousCount}, ${metric.value},
        ${metric.coverage}, ${metric.sampleQuality}, ${metadata}::jsonb,
        ${input.computedAt}
      )
      on conflict (
        dataset_id, metric_key, metric_version, period_start, period_end, dimension_hash
      ) do update set
        numerator = excluded.numerator,
        denominator = excluded.denominator,
        population_count = excluded.population_count,
        unknown_count = excluded.unknown_count,
        ambiguous_count = excluded.ambiguous_count,
        value_numeric = excluded.value_numeric,
        coverage_numeric = excluded.coverage_numeric,
        sample_quality = excluded.sample_quality,
        metadata = excluded.metadata,
        computed_at = excluded.computed_at
      where exists (
        select 1 from published_datasets dataset
        where dataset.id = ${input.datasetId} and dataset.status = 'draft'
      )
    `;
  }

  return metrics.map((metric) => ({ datasetId: input.datasetId, metric }));
}

export async function computeAndStoreJuniorContradictionMetric(input: {
  sql: NeonQueryFunction<false, false>;
  datasetId: string;
  computedAt: Date;
}): Promise<DatasetMetric> {
  const metrics = await computeAndStorePublishedMetrics(input);
  const metric = metrics.find(
    (candidate) => candidate.metric.metric === "junior_contradiction_rate",
  );
  if (!metric) throw new Error("La métrique principale n'a pas été calculée.");
  return metric;
}

/** Validation deliberately returns false for unmet invariants; it never turns a
 * draft into a validated dataset on partial or unclassified source data. */
export async function validateDraftDataset(input: {
  sql: NeonQueryFunction<false, false>;
  datasetId: string;
  qualityDecision: DatasetQualityDecision;
}): Promise<DatasetValidationResult> {
  const rows = await input.sql`
    with dataset as (
      select id, source_id, query_set_version, classifier_version, metric_versions, status
      from published_datasets
      where id = ${input.datasetId}
    ), active_scope as (
      select distinct offer.id
      from dataset
      join offers offer
        on offer.source_id = dataset.source_id and offer.closed_at is null
      where exists (
        select 1
        from offer_query_matches matched
        join source_queries query on query.id = matched.source_query_id
        where matched.offer_id = offer.id
          and query.source_id = dataset.source_id
          and query.query_set_version = dataset.query_set_version
          and query.enabled = true
          and query.valid_to is null
      )
    ), scope_with_classification as (
      select active_scope.id, classification.id as classification_id
      from active_scope
      left join offer_snapshots snapshot
        on snapshot.offer_id = active_scope.id and snapshot.valid_to is null
      left join dataset on true
      left join classifications classification
        on classification.snapshot_id = snapshot.id
          and classification.classifier_version = dataset.classifier_version
    )
    select
      (select count(*)::integer from published_dataset_offers
        where dataset_id = ${input.datasetId}) as "memberCount",
      (select count(*)::integer from active_scope) as "scopeCount",
      (select count(*)::integer from scope_with_classification
        where classification_id is null) as "missingClassificationCount",
      exists (
        select 1 from daily_metrics metric
        where metric.dataset_id = ${input.datasetId}
          and metric.dimension_hash = ${OVERALL_DIMENSION_HASH}
          and (
            (metric.metric_key = 'junior_contradiction_rate'
              and metric.metric_version = (select metric_versions->>'junior_contradiction_rate' from dataset))
            or (metric.metric_key = 'beginner_friendly_rate'
              and metric.metric_version = ${BEGINNER_FRIENDLY_METRIC_VERSION})
            or (metric.metric_key = 'salary_transparency_rate'
              and metric.metric_version = ${SALARY_TRANSPARENCY_METRIC_VERSION})
          )
        group by metric.dataset_id
        having count(distinct metric.metric_key) = 3
      ) as "metricPresent",
      not exists (
        select 1 from dataset d
        join published_dataset_offers m on m.dataset_id=d.id
        join classifications c on c.id=m.classification_id
        where d.metric_versions->>'junior_contradiction_rate' = ${JUNIOR_OBSERVATION_METRIC_VERSION}
          and (c.junior_observation_version is distinct from ${JUNIOR_OBSERVATION_VERSION}
            or c.junior_observation_status is null
            or (c.junior_observation_status='resolved' and not exists (
              select 1 from classification_evidence e where e.classification_id=c.id and e.evidence_kind='junior_claim' and length(trim(e.excerpt)) > 0
            ))
            or (c.junior_observation_contradictory=true and not exists (
              select 1 from classification_evidence e where e.classification_id=c.id and e.evidence_kind='required_experience' and length(trim(e.excerpt)) > 0
            )))
      ) as "observationEvidenceComplete",
      (select status from dataset) as status
  `;
  const row = rows.at(0);
  if (!row) throw new Error("Le dataset est introuvable.");
  const memberCount = requiredInteger(row, "memberCount");
  const scopeCount = requiredInteger(row, "scopeCount");
  const missingClassificationCount = requiredInteger(
    row,
    "missingClassificationCount",
  );
  const metricPresent = row["metricPresent"] === true;
  const status = asDatasetStatus(requiredString(row, "status"));
  const invariants = {
    publishDecision:
      input.qualityDecision === "publish" ||
      input.qualityDecision === "publish_partial",
    hasMembers: memberCount > 0,
    membershipMatchesScope: memberCount === scopeCount,
    classificationsComplete: missingClassificationCount === 0,
    metricPresent,
    observationEvidenceComplete: row["observationEvidenceComplete"] === true,
  };
  const canValidate =
    status === "validated" ||
    status === "published" ||
    (status === "draft" && Object.values(invariants).every(Boolean));

  if (status === "draft" && canValidate) {
    await input.sql`
      update published_datasets
      set status = 'validated'
      where id = ${input.datasetId} and status = 'draft'
    `;
  }

  return { datasetId: input.datasetId, validated: canValidate, invariants };
}
