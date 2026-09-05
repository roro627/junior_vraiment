import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationDirectory = join(process.cwd(), "src", "db", "migrations");

async function readMigrations(): Promise<string> {
  const migrationFiles = (await readdir(migrationDirectory)).filter((file) =>
    file.endsWith(".sql"),
  );

  expect(migrationFiles.length).toBeGreaterThan(0);
  const migrations = await Promise.all(
    migrationFiles
      .toSorted()
      .map((migrationFile) =>
        readFile(join(migrationDirectory, migrationFile), "utf8"),
      ),
  );
  if (migrations.length === 0) {
    throw new Error("The SQL migrations are missing.");
  }

  return migrations.join("\n");
}

describe("initial database migration", () => {
  it("creates every versioned data table and the public read view", async () => {
    const migration = await readMigrations();
    const expectedTables = [
      "sources",
      "source_queries",
      "ingestion_runs",
      "ingestion_run_queries",
      "ingestion_query_pages",
      "ingestion_quarantine_entries",
      "offers",
      "offer_query_matches",
      "offer_snapshots",
      "ingestion_run_offer_sightings",
      "classifications",
      "classification_evidence",
      "technologies",
      "technology_aliases",
      "offer_snapshot_technologies",
      "published_datasets",
      "published_dataset_offers",
      "daily_metrics",
      "data_quality_events",
      "insights",
    ];

    for (const table of expectedTables) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }

    expect(migration).toContain('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    expect(migration).toContain(
      'CREATE VIEW "public"."current_public_offer_classifications"',
    );
  });

  it("keeps the KPI denominator and raw-payload retention constraints in SQL", async () => {
    const migration = await readMigrations();

    expect(migration).toContain("daily_metrics_counts_check");
    expect(migration).toContain("daily_metrics_value_check");
    expect(migration).toContain("offer_snapshots_raw_payload_expiry_check");
    expect(migration).toContain("offer_snapshots_offer_hash_idx");
    expect(migration).toContain("ingestion_runs_trigger_run_unique_idx");
    expect(migration).toContain("ingestion_runs_scope_attempt_unique");
    expect(migration).toContain("ingestion_runs_attempt_check");
    expect(migration).toContain("published_datasets_lifecycle_check");
    expect(migration).toContain("published_dataset_offers");
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN|SCHEMA)\b/iu);
  });
});
