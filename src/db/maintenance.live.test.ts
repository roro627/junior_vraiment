// @vitest-environment node
import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";
import { readRollbackGameDayEnvironment, readToolEnvironment } from "@/lib/env";
import {
  purgeExpiredAuxiliaryData,
  readExpiredAuxiliaryData,
} from "./retention";
import {
  readComparableOperationalSamples,
  reconcileOperationalIncidents,
} from "./operational-health";
import { readCurrentDataset } from "./queries/current-dataset";
import { checkDataHealth } from "@/application/maintenance/check-data-health";

// Mutates disposable cloned data; never falls back to the application connection.
describe.runIf(readToolEnvironment().RUN_DATASET_ROLLBACK_GAME_DAY === "1")(
  "maintenance on an isolated database",
  () => {
    it("purges by bounded batches, retains proofs/counts and audits exactly once", async () => {
      const { ROLLBACK_GAME_DAY_DATABASE_URL } =
        readRollbackGameDayEnvironment();
      const sql = neon(ROLLBACK_GAME_DAY_DATABASE_URL);
      const now = new Date();
      const before =
        await sql`select (select count(*)::integer from published_dataset_offers) as members,
      (select count(*)::integer from classification_evidence) as evidence,
      (select count(*)::integer from daily_metrics) as metrics`;
      const fixtures =
        await sql`select id, content_hash from offer_snapshots order by id limit 2`;
      expect(fixtures).toHaveLength(2);
      for (const fixture of fixtures) {
        await sql`update offer_snapshots set raw_payload = '{"fixture":"expired-retention-test"}'::jsonb,
        raw_payload_expires_at = ${now}::timestamptz - interval '1 second' where id = ${fixture["id"]}`;
      }
      const [query] =
        await sql`select query.id from ingestion_run_queries query join ingestion_runs run on run.id = query.ingestion_run_id
      where run.status = 'succeeded' order by query.id limit 1`;
      expect(query).toBeDefined();
      await sql`insert into ingestion_quarantine_entries (ingestion_run_query_id, range_start, item_ordinal, issues, created_at)
      values (${query!["id"]}, 0, 99999, '[{"code":"fixture"}]'::jsonb, ${now}::timestamptz - interval '31 days')`;
      const first = await purgeExpiredAuxiliaryData({ sql, now, batchSize: 1 });
      expect(first).toEqual({ rawPayloads: 1, validationErrors: 1 });
      expect(
        await purgeExpiredAuxiliaryData({ sql, now, batchSize: 1 }),
      ).toEqual({ rawPayloads: 1, validationErrors: 0 });
      expect(await purgeExpiredAuxiliaryData({ sql, now })).toEqual({
        rawPayloads: 0,
        validationErrors: 0,
      });
      expect(await readExpiredAuxiliaryData(sql, now)).toEqual({
        rawPayloads: 0,
        validationErrors: 0,
      });
      const after =
        await sql`select (select count(*)::integer from published_dataset_offers) as members,
      (select count(*)::integer from classification_evidence) as evidence,
      (select count(*)::integer from daily_metrics) as metrics`;
      expect(after).toEqual(before);
      for (const fixture of fixtures) {
        const [snapshot] =
          await sql`select content_hash, raw_payload, raw_payload_expires_at from offer_snapshots where id = ${fixture["id"]}`;
        expect(snapshot).toMatchObject({
          content_hash: fixture["content_hash"],
          raw_payload: null,
          raw_payload_expires_at: null,
        });
      }
      const [audit] =
        await sql`select count(*)::integer as count from data_quality_events where event_code = 'RETENTION_PURGED' and created_at = ${now}`;
      expect(audit?.["count"]).toBe(2);
    });

    it("reads comparable frozen samples and opens/resolves an incident without duplicates", async () => {
      const { ROLLBACK_GAME_DAY_DATABASE_URL } =
        readRollbackGameDayEnvironment();
      const sql = neon(ROLLBACK_GAME_DAY_DATABASE_URL);
      const dataset = await readCurrentDataset(sql);
      const history = await readComparableOperationalSamples(
        sql,
        dataset.datasetId,
      );
      expect(history.current?.members).toBe(dataset.memberCount);
      const input = {
        sql,
        sourceId: dataset.sourceId,
        reasons: ["DATA_OLDER_THAN_30H"],
        now: new Date(),
      };
      await reconcileOperationalIncidents(input);
      await reconcileOperationalIncidents(input);
      const [opened] =
        await sql`select count(*)::integer as count from data_quality_events where scope = ${`monitor:${dataset.sourceId}`} and resolved_at is null`;
      expect(opened?.["count"]).toBe(1);
      await reconcileOperationalIncidents({ ...input, reasons: [] });
      const [closed] =
        await sql`select count(*)::integer as count from data_quality_events where scope = ${`monitor:${dataset.sourceId}`} and resolved_at is null`;
      expect(closed?.["count"]).toBe(0);
      const health = await checkDataHealth(sql, new Date());
      expect(health.healthy).toBe(true);
    });
  },
);
