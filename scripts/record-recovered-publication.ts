import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { readDatabaseEnvironment } from "../src/lib/env";

async function record() {
  const withdrawnId = z.uuid().parse(process.argv[2]);
  if (process.argv[3] !== "--confirm-recording") throw new Error();
  const sql = neon(readDatabaseEnvironment().DATABASE_URL);
  // Only a completed, audited rollback can supply the incident's actual timestamps.
  const rows = await sql`
    insert into data_quality_events (severity,event_code,scope,message,details,is_public,created_at,resolved_at)
    select 'warning','PUBLICATION_CONTRACT_RECOVERED','publication',
      'Une mise à jour a temporairement rendu les indicateurs indisponibles ; le jeu précédent a été rétabli.',
      jsonb_build_object('withdrawnDatasetId',d.id,'rollbackAuditEventId',a.id),true,d.published_at,a.created_at
    from published_datasets d join data_quality_events a on a.dataset_id=d.id and a.event_code='DATASET_ROLLBACK'
    where d.id=${withdrawnId} and d.status='withdrawn' and d.is_current=false
      and d.published_at is not null and a.created_at >= d.published_at
      and not exists (select 1 from data_quality_events e where e.event_code='PUBLICATION_CONTRACT_RECOVERED'
        and e.details->>'withdrawnDatasetId'=${withdrawnId})
    order by a.created_at limit 1 returning id,created_at,resolved_at`;
  process.stdout.write(
    JSON.stringify({ recorded: rows.length === 1, events: rows }),
  );
}
record().catch(() => {
  process.stderr.write(
    "Recovered incident could not be recorded; details withheld.\n",
  );
  process.exitCode = 1;
});
