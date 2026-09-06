import type { NeonQueryFunction } from "@neondatabase/serverless";
import { assessProductionHealth } from "@/domain/ingestion/production-health";
import { assessOperationalChanges } from "@/domain/ingestion/operational-health";
import {
  readComparableOperationalSamples,
  reconcileOperationalIncidents,
} from "@/db/operational-health";
import { readCurrentDataset } from "@/db/queries/current-dataset";
import { getDataStatus } from "@/db/queries/get-data-status";

export async function checkDataHealth(
  sql: NeonQueryFunction<false, false>,
  now: Date,
) {
  const dataset = await readCurrentDataset(sql);
  const [status, history] = await Promise.all([
    getDataStatus({ sql, now, staleAfterHours: 30, criticalAfterHours: 72 }),
    readComparableOperationalSamples(sql, dataset.datasetId),
  ]);
  // The public status includes these very incidents: inspect facts to avoid a self-sustaining alarm.
  const reasons = assessProductionHealth(
    { ...status, data: { ...status.data, status: "operational" } },
    now.getTime(),
  );
  if (history.current)
    reasons.push(
      ...assessOperationalChanges(history.current, history.previous),
    );
  await reconcileOperationalIncidents({
    sql,
    sourceId: dataset.sourceId,
    reasons,
    now,
  });
  return {
    healthy: reasons.length === 0,
    reasons,
    comparableDays: history.previous.length,
  };
}
