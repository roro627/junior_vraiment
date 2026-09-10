import { neon } from "@neondatabase/serverless";
import { readDatabaseEnvironment } from "../src/lib/env";

async function inspect() {
  const sql = neon(readDatabaseEnvironment().DATABASE_URL);
  const rows =
    await sql`select id,trigger_run_id,business_date,status,error_summary,
    (select count(*)::int from ingestion_run_queries q where q.ingestion_run_id=r.id and q.status='failed') as failed_queries,
    (select count(*)::int from ingestion_run_queries q where q.ingestion_run_id=r.id and q.status='succeeded') as succeeded_queries
    from ingestion_runs r where mode='full' order by created_at desc limit 5`;
  process.stdout.write(
    JSON.stringify(
      rows.map(({ error_summary, ...row }) => ({
        ...row,
        error:
          typeof error_summary === "string" &&
          /^[a-z_0-9 :-]{0,180}$/iu.test(error_summary)
            ? error_summary
            : "withheld",
      })),
      null,
      2,
    ),
  );
  const pending =
    await sql`select q.id,s.query_key,q.checkpoint,s.definition from ingestion_run_queries q join source_queries s on s.id=q.source_query_id where q.ingestion_run_id=${rows[0]?.["id"]} and q.status in ('running', 'failed') limit 1`;
  process.stdout.write(JSON.stringify(pending, null, 2));
  if (pending[0])
    process.stdout.write(
      JSON.stringify(
        await sql`select range_start,next_range_start,is_terminal,source_total,received_count,committed_at from ingestion_query_pages where ingestion_run_query_id=${pending[0]["id"]} order by range_start`,
        null,
        2,
      ),
    );
}
inspect().catch(() => {
  process.stderr.write(
    "Collection diagnostic unavailable; details withheld.\n",
  );
  process.exitCode = 1;
});
