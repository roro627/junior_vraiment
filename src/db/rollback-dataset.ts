import type { NeonQueryFunction } from "@neondatabase/serverless";

const rollbackReasonCode = /^[A-Z][A-Z0-9_]{2,63}$/;

export type DatasetRollbackResult = Readonly<{
  changed: boolean;
  withdrawnDatasetId: string;
  withdrawnDatasetVersion: string;
  currentDatasetId: string;
  currentDatasetVersion: string;
}>;

function requiredString(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Le champ de rollback ${field} est absent.`);
  }
  return value;
}

/**
 * Atomically restores an already-published, measured dataset from the same
 * source. Replaying the exact rollback is safe and only repeats cache
 * revalidation in the caller.
 */
export async function rollbackDataset(input: {
  sql: NeonQueryFunction<false, false>;
  targetDatasetVersion: string;
  reasonCode: string;
  rolledBackAt: Date;
}): Promise<DatasetRollbackResult> {
  if (
    input.targetDatasetVersion.length < 1 ||
    input.targetDatasetVersion.length > 128
  ) {
    throw new RangeError("La version de dataset cible est invalide.");
  }
  if (!rollbackReasonCode.test(input.reasonCode)) {
    throw new RangeError("Le code de motif du rollback est invalide.");
  }

  const rows = await input.sql`
    with target as materialized (
      select id, dataset_version, source_id
      from published_datasets
      where dataset_version = ${input.targetDatasetVersion}
        and status = 'published'
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
    ), current_dataset as materialized (
      select id, dataset_version, source_id
      from published_datasets
      where is_current = true and status = 'published'
      for update
    ), eligible as materialized (
      select
        target.id as target_id,
        target.dataset_version as target_version,
        current_dataset.id as current_id,
        current_dataset.dataset_version as current_version
      from target
      join current_dataset on current_dataset.source_id = target.source_id
    ), withdrawn as (
      update published_datasets dataset
      set status = 'withdrawn', is_current = false
      from eligible
      where dataset.id = eligible.current_id
        and eligible.current_id <> eligible.target_id
      returning dataset.id
    ), activated as (
      update published_datasets dataset
      set status = 'published', is_current = true
      from eligible
      where dataset.id = eligible.target_id
        and (
          eligible.current_id = eligible.target_id
          or exists (select 1 from withdrawn)
        )
      returning dataset.id
    ), audit_event as (
      insert into data_quality_events (
        dataset_id, severity, event_code, scope, message, details,
        is_public, created_at
      )
      select
        eligible.current_id,
        'error',
        'DATASET_ROLLBACK',
        'publication',
        'Le dataset courant a été retiré au profit d’une version saine.',
        jsonb_build_object(
          'reasonCode', ${input.reasonCode}::text,
          'targetDatasetId', eligible.target_id,
          'targetDatasetVersion', eligible.target_version
        ),
        false,
        ${input.rolledBackAt}
      from eligible
      where eligible.current_id <> eligible.target_id
        and exists (select 1 from activated)
      returning id
    )
    select
      eligible.current_id as "withdrawnDatasetId",
      eligible.current_version as "withdrawnDatasetVersion",
      eligible.target_id as "currentDatasetId",
      eligible.target_version as "currentDatasetVersion",
      eligible.current_id <> eligible.target_id as changed,
      (select count(*)::integer from audit_event) as "auditEventCount"
    from eligible
    where exists (select 1 from activated)
  `;

  const row = rows.at(0);
  if (!row || typeof row["changed"] !== "boolean") {
    throw new Error(
      "Le rollback exige un dataset courant et une cible publiée, mesurée et de même source.",
    );
  }
  const auditEventCount = row["auditEventCount"];
  if (
    typeof auditEventCount !== "number" ||
    (row["changed"] && auditEventCount !== 1) ||
    (!row["changed"] && auditEventCount !== 0)
  ) {
    throw new Error("L’audit atomique du rollback n’a pas été confirmé.");
  }

  return {
    changed: row["changed"],
    withdrawnDatasetId: requiredString(row, "withdrawnDatasetId"),
    withdrawnDatasetVersion: requiredString(row, "withdrawnDatasetVersion"),
    currentDatasetId: requiredString(row, "currentDatasetId"),
    currentDatasetVersion: requiredString(row, "currentDatasetVersion"),
  };
}
