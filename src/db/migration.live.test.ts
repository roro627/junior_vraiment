// @vitest-environment node

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

import { classifyOffer } from "@/domain/classification/classifier";
import type { NormalizedOffer } from "@/domain/offers/normalized-offer";
import { readDatabaseEnvironment, readToolEnvironment } from "@/lib/env";

import { publishDataset } from "./publish-dataset";
import { beginLimitedIngestionRun } from "./ingestion-run";
import { storeClassification } from "./store-classification";
import { storeNormalizedOffer } from "./store-normalized-offer";

if (existsSync(".env.local")) {
  loadEnvFile(".env.local");
}

const liveTestsEnabled = readToolEnvironment().RUN_LIVE_DATABASE === "1";

describe.runIf(liveTestsEnabled)("Neon migration live integration", () => {
  it("materializes the schema and rolls back an incomplete transaction", async () => {
    const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();
    const sql = neon(DATABASE_DIRECT_URL);
    const directUrl = new URL(DATABASE_DIRECT_URL);

    expect(directUrl.protocol).toBe("postgresql:");
    expect(directUrl.searchParams.get("sslmode")).toBe("require");

    const [server] = await sql`
      select current_setting('server_version_num')::integer as "versionNumber"
    `;
    expect(server?.["versionNumber"]).toBeGreaterThanOrEqual(180_000);

    const relations = await sql`
      select relname as "relationName", relkind as "relationKind"
      from pg_class
      where relnamespace = 'public'::regnamespace
        and relkind in ('r', 'v')
    `;
    expect(
      relations.filter(({ relationKind }) => relationKind === "r"),
    ).toHaveLength(20);
    expect(relations).toContainEqual({
      relationName: "ingestion_query_pages",
      relationKind: "r",
    });
    expect(relations).toContainEqual({
      relationName: "published_dataset_offers",
      relationKind: "r",
    });
    expect(relations).toContainEqual({
      relationName: "current_public_offer_classifications",
      relationKind: "v",
    });

    const constraints = await sql`
      select conname as "constraintName"
      from pg_constraint
      where connamespace = 'public'::regnamespace
    `;
    const constraintNames = new Set(
      constraints.map(({ constraintName }) => constraintName),
    );
    expect(constraintNames).toContain("daily_metrics_counts_check");
    expect(constraintNames).toContain(
      "offer_snapshots_raw_payload_expiry_check",
    );
    expect(constraintNames).toContain("classifications_status_check");

    const [extension] = await sql`
      select exists (
        select 1 from pg_extension where extname = 'pgcrypto'
      ) as "isInstalled"
    `;
    expect(extension?.["isInstalled"]).toBe(true);

    const [migrationJournal] = await sql`
      select count(*)::integer as "migrationCount"
      from drizzle.__drizzle_migrations
    `;
    expect(migrationJournal?.["migrationCount"]).toBeGreaterThanOrEqual(1);

    const rollbackKey = `integration-rollback-${randomUUID()}`;
    await expect(
      sql.transaction([
        sql`
          insert into sources (key, label, attribution_url)
          values (${rollbackKey}, 'Rollback probe', 'https://example.invalid')
        `,
        sql`select 1 / 0`,
      ]),
    ).rejects.toThrow();

    const rollbackRows = await sql`
      select id from sources where key = ${rollbackKey}
    `;
    expect(rollbackRows).toHaveLength(0);
  });

  it("keeps unchanged, changed and reverted offer snapshots consistent", async () => {
    const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();
    const sql = neon(DATABASE_DIRECT_URL);
    const sourceKey = `integration-snapshots-${randomUUID()}`;
    const [source] = await sql`
      insert into sources (key, label, attribution_url)
      values (${sourceKey}, 'Snapshot probe', 'https://example.invalid')
      returning id
    `;
    const sourceId = source?.["id"];
    expect(typeof sourceId).toBe("string");
    if (typeof sourceId !== "string") {
      throw new Error("La source de test n’a pas été créée.");
    }

    const initialOffer: NormalizedOffer = {
      source: "france-travail",
      externalId: `offer-${randomUUID()}`,
      title: "Développeur junior",
      descriptionText: "Débutant accepté.",
      companyName: "Entreprise de test",
      publishedAt: new Date("2026-09-01T08:00:00Z"),
      updatedAt: new Date("2026-09-01T08:00:00Z"),
      location: {
        label: "Paris",
        communeCode: "75056",
        departmentCode: "75",
        regionCode: "11",
        latitude: 48.8566,
        longitude: 2.3522,
      },
      contract: { sourceCode: "CDI", normalized: "cdi", label: "CDI" },
      structuredExperience: {
        required: false,
        label: "Débutant accepté",
      },
      salary: null,
      applicationUrl: "https://example.invalid/apply",
      sourceUrl: "https://example.invalid/offer",
      rawPayload: { fixture: true },
    };

    try {
      const first = await storeNormalizedOffer({
        sql,
        sourceId,
        offer: initialOffer,
        observedAt: new Date("2026-09-01T10:00:00Z"),
        rawPayloadRetentionDays: 90,
      });
      const firstClassification = classifyOffer(initialOffer);
      const classificationCreated = await storeClassification({
        sql,
        snapshotId: first.snapshotId,
        classification: firstClassification,
        classifiedAt: new Date("2026-09-01T10:01:00Z"),
      });
      const duplicateClassificationCreated = await storeClassification({
        sql,
        snapshotId: first.snapshotId,
        classification: firstClassification,
        classifiedAt: new Date("2026-09-01T10:02:00Z"),
      });
      const unchanged = await storeNormalizedOffer({
        sql,
        sourceId,
        offer: { ...initialOffer, rawPayload: { fixture: "refetched" } },
        observedAt: new Date("2026-09-02T10:00:00Z"),
        rawPayloadRetentionDays: 90,
      });
      const changed = await storeNormalizedOffer({
        sql,
        sourceId,
        offer: {
          ...initialOffer,
          descriptionText: "Deux ans d’expérience exigés.",
        },
        observedAt: new Date("2026-09-03T10:00:00Z"),
        rawPayloadRetentionDays: 90,
      });
      const reverted = await storeNormalizedOffer({
        sql,
        sourceId,
        offer: initialOffer,
        observedAt: new Date("2026-09-04T10:00:00Z"),
        rawPayloadRetentionDays: 90,
      });

      expect(first.snapshotCreated).toBe(true);
      expect(classificationCreated).toBe(true);
      expect(duplicateClassificationCreated).toBe(false);
      expect(unchanged).toEqual({
        ...first,
        offerCreated: false,
        snapshotCreated: false,
      });
      expect(changed.snapshotCreated).toBe(true);
      expect(reverted.snapshotCreated).toBe(true);
      expect(reverted.snapshotId).not.toBe(first.snapshotId);

      const [history] = await sql`
        select
          count(*)::integer as "snapshotCount",
          count(*) filter (where valid_to is null)::integer as "currentCount",
          bool_and(raw_payload_expires_at is not null) as "retentionApplied"
        from offer_snapshots
        where offer_id = ${first.offerId}
      `;
      expect(history).toEqual({
        snapshotCount: 3,
        currentCount: 1,
        retentionApplied: true,
      });

      const [classificationStorage] = await sql`
        select
          count(distinct classification.id)::integer as "classificationCount",
          count(evidence.id)::integer as "evidenceCount"
        from classifications classification
        left join classification_evidence evidence
          on evidence.classification_id = classification.id
        where classification.snapshot_id = ${first.snapshotId}
      `;
      expect(classificationStorage).toEqual({
        classificationCount: 1,
        evidenceCount: firstClassification.evidence.length,
      });
    } finally {
      await sql.transaction([
        sql`delete from offers where source_id = ${sourceId}`,
        sql`delete from sources where id = ${sourceId}`,
      ]);
    }
  });

  it("reuses a limited ingestion run across Trigger retry attempts", async () => {
    const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();
    const sql = neon(DATABASE_DIRECT_URL);
    const triggerRunId = `integration-trigger-${randomUUID()}`;

    const first = await beginLimitedIngestionRun({
      sql,
      businessDate: "2099-01-01",
      triggerRunId,
      startedAt: new Date("2099-01-01T03:30:00Z"),
      rangeSize: 10,
    });

    try {
      await sql`
        update ingestion_runs
        set
          status = 'failed',
          finished_at = '2099-01-01T03:31:00Z',
          requests_count = 1,
          offers_received = 10,
          error_summary = '{"code":"retry_probe"}'::jsonb
        where id = ${first.ingestionRunId}
      `;

      const retried = await beginLimitedIngestionRun({
        sql,
        businessDate: "2099-01-01",
        triggerRunId,
        startedAt: new Date("2099-01-01T03:32:00Z"),
        rangeSize: 10,
      });

      expect(retried).toEqual(first);

      const [run] = await sql`
        select
          status,
          finished_at as "finishedAt",
          requests_count as "requestsCount",
          offers_received as "offersReceived",
          error_summary as "errorSummary"
        from ingestion_runs
        where id = ${first.ingestionRunId}
      `;
      expect(run).toEqual({
        status: "running",
        finishedAt: null,
        requestsCount: 0,
        offersReceived: 0,
        errorSummary: {},
      });
    } finally {
      await sql`delete from ingestion_runs where id = ${first.ingestionRunId}`;
    }
  });

  it("rejects a dataset without immutable membership and metric", async () => {
    const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();
    const sql = neon(DATABASE_DIRECT_URL);
    const sourceKey = `integration-publication-${randomUUID()}`;
    const [source] = await sql`
      insert into sources (key, label, attribution_url)
      values (${sourceKey}, 'Publication probe', 'https://example.invalid')
      returning id
    `;
    const sourceId = source?.["id"];
    if (typeof sourceId !== "string") {
      throw new Error("La source de test n’a pas été créée.");
    }

    try {
      const datasets = await sql`
        insert into published_datasets (
          dataset_version,
          source_id,
          classifier_version,
          metric_versions,
          query_set_version,
          taxonomy_versions,
          source_cutoff_at,
          computed_at,
          status
        ) values (
          ${`integration-empty-${randomUUID()}`}, ${sourceId}, 'classifier-test',
          '{}'::jsonb, 'query-test', '{}'::jsonb, now(), now(), 'validated'
        )
        returning id
      `;
      const firstId = datasets.at(0)?.["id"];
      if (typeof firstId !== "string") {
        throw new Error("Les datasets de test n’ont pas été créés.");
      }

      await expect(
        publishDataset({
          sql,
          datasetId: firstId,
          publishedAt: new Date(),
        }),
      ).rejects.toThrow();

      const [dataset] = await sql`
        select status, is_current as "isCurrent"
        from published_datasets where id = ${firstId}
      `;
      expect(dataset).toEqual({ status: "validated", isCurrent: false });
    } finally {
      await sql`delete from published_datasets where source_id = ${sourceId}`;
      await sql`delete from sources where id = ${sourceId}`;
    }
  });
});
