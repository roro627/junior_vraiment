import { neon } from "@neondatabase/serverless";

import { readDatabaseEnvironment } from "../src/lib/env";

const sql = neon(readDatabaseEnvironment().DATABASE_URL);
const [migrations, tables, duplicateRunScopes, datasets] = await Promise.all([
  sql`select id, created_at from drizzle.__drizzle_migrations order by created_at`,
  sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'ingestion_query_pages',
        'ingestion_run_offer_sightings',
        'published_dataset_offers'
      )
    order by table_name
  `,
  sql`
    select
      business_date as "businessDate",
      query_set_version as "querySetVersion",
      mode,
      count(*)::integer as count
    from ingestion_runs
    group by source_id, business_date, query_set_version, mode
    having count(*) > 1
    order by business_date, query_set_version, mode
  `,
  sql`
    select
      status,
      is_current as "isCurrent",
      published_at is not null as "hasPublishedAt",
      count(*)::integer as count
    from published_datasets
    group by status, is_current, (published_at is not null)
    order by status
  `,
]);

process.stdout.write(
  `${JSON.stringify(
    {
      migrationCount: migrations.length,
      lastMigrationAt: migrations.at(-1)?.["created_at"] ?? null,
      tables: tables.map((row) => row["table_name"]),
      datasets,
      duplicateRunScopes,
    },
    null,
    2,
  )}\n`,
);
