import { neon } from "@neondatabase/serverless";
import { readCurrentDataset } from "../src/db/queries/current-dataset";
import { readDatabaseEnvironment } from "../src/lib/env";

async function inspect() {
  const sql = neon(readDatabaseEnvironment().DATABASE_URL);
  const current = await readCurrentDataset(sql);
  const metrics =
    await sql`select metric_key, metric_version, numerator, denominator, value_numeric
    from daily_metrics where dataset_id=${current.datasetId} order by metric_key limit 10`;
  process.stdout.write(
    JSON.stringify(
      {
        datasetId: current.datasetId,
        datasetVersion: current.datasetVersion,
        ingestionRunId: current.ingestionRunId,
        memberCount: current.memberCount,
        classifierVersion: current.classifierVersion,
        metricVersions: current.metricVersions,
        sourceCutoffAt: current.sourceCutoffAt,
        publishedAt: current.publishedAt,
        metrics,
      },
      null,
      2,
    ),
  );
}
inspect().catch(() => {
  process.stderr.write(
    "Publication inspection failed; sensitive details withheld.\n",
  );
  process.exitCode = 1;
});
