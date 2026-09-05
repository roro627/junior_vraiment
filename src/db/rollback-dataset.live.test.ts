// @vitest-environment node

import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

import { readRollbackGameDayEnvironment, readToolEnvironment } from "@/lib/env";

import { publishDataset } from "./publish-dataset";
import { rollbackDataset } from "./rollback-dataset";

const toolEnvironment = readToolEnvironment();
const gameDayEnabled = toolEnvironment.RUN_DATASET_ROLLBACK_GAME_DAY === "1";

describe.runIf(gameDayEnabled)("dataset rollback game day", () => {
  it("withdraws a bad publication, restores the healthy dataset and is replayable", async () => {
    const { ROLLBACK_GAME_DAY_DATABASE_URL } = readRollbackGameDayEnvironment();
    const sql = neon(ROLLBACK_GAME_DAY_DATABASE_URL);
    const suffix = randomUUID();
    const badVersion = `game-day-bad-${suffix}`;
    const [healthy] = await sql`
      select id, dataset_version as "datasetVersion"
      from published_datasets
      where is_current = true and status = 'published'
    `;
    const healthyId = healthy?.["id"];
    const healthyVersion = healthy?.["datasetVersion"];
    if (typeof healthyId !== "string" || typeof healthyVersion !== "string") {
      throw new Error(
        "Le dataset sain courant est absent de la branche de test.",
      );
    }

    let badDatasetId: string | null = null;
    try {
      const [badDataset] = await sql`
        insert into published_datasets (
          dataset_version, source_id, ingestion_run_id, classifier_version,
          metric_versions, query_set_version, taxonomy_versions,
          source_cutoff_at, computed_at, published_at, status, is_current,
          quality_summary
        )
        select
          ${badVersion}, source_id, ingestion_run_id, classifier_version,
          metric_versions, query_set_version, taxonomy_versions,
          source_cutoff_at, computed_at, ${new Date()}, 'published', false,
          quality_summary
        from published_datasets
        where id = ${healthyId}
        returning id
      `;
      badDatasetId =
        typeof badDataset?.["id"] === "string" ? badDataset["id"] : null;
      if (!badDatasetId) {
        throw new Error(
          "Le dataset défaillant de simulation n’a pas été créé.",
        );
      }

      await sql`
        insert into published_dataset_offers (
          dataset_id, offer_id, snapshot_id, classification_id
        )
        select ${badDatasetId}, offer_id, snapshot_id, classification_id
        from published_dataset_offers
        where dataset_id = ${healthyId}
      `;
      await sql`
        insert into daily_metrics (
          dataset_id, metric_key, metric_version, period_start, period_end,
          job_family, technology_slug, region_code, department_code,
          commune_code, contract_kind, remote_mode, dimensions, dimension_hash,
          numerator, denominator, population_count, unknown_count,
          ambiguous_count, value_numeric, coverage_numeric, sample_quality,
          metadata, computed_at
        )
        select
          ${badDatasetId}, metric_key, metric_version, period_start, period_end,
          job_family, technology_slug, region_code, department_code,
          commune_code, contract_kind, remote_mode, dimensions, dimension_hash,
          numerator, denominator, population_count, unknown_count,
          ambiguous_count, value_numeric, coverage_numeric, sample_quality,
          metadata, computed_at
        from daily_metrics
        where dataset_id = ${healthyId}
      `;

      await publishDataset({
        sql,
        datasetId: badDatasetId,
        publishedAt: new Date(),
      });
      const result = await rollbackDataset({
        sql,
        targetDatasetVersion: healthyVersion,
        reasonCode: "GAME_DAY_ROLLBACK",
        rolledBackAt: new Date(),
      });

      expect(result).toMatchObject({
        changed: true,
        withdrawnDatasetId: badDatasetId,
        currentDatasetId: healthyId,
        currentDatasetVersion: healthyVersion,
      });
      await expect(
        rollbackDataset({
          sql,
          targetDatasetVersion: healthyVersion,
          reasonCode: "GAME_DAY_ROLLBACK",
          rolledBackAt: new Date(),
        }),
      ).resolves.toMatchObject({ changed: false });

      const [state] = await sql`
        select
          count(*) filter (where id = ${healthyId} and is_current = true
            and status = 'published')::integer as "healthyCurrent",
          count(*) filter (where id = ${badDatasetId} and is_current = false
            and status = 'withdrawn')::integer as "badWithdrawn"
        from published_datasets
        where id in (${healthyId}, ${badDatasetId})
      `;
      expect(state).toEqual({ healthyCurrent: 1, badWithdrawn: 1 });
    } finally {
      if (badDatasetId) {
        await sql`
          with bad_withdrawn as (
            update published_datasets
            set status = 'withdrawn', is_current = false
            where id = ${badDatasetId}
            returning id
          ), healthy_restored as (
            update published_datasets
            set status = 'published', is_current = true
            where id = ${healthyId}
              and exists (select 1 from bad_withdrawn)
            returning id
          )
          select id from healthy_restored
        `;
        await sql`
          delete from data_quality_events
          where dataset_id = ${badDatasetId}
            and event_code = 'DATASET_ROLLBACK'
        `;
        await sql`delete from published_datasets where id = ${badDatasetId}`;
      }
    }
  });
});
