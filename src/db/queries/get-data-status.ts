import { createHash } from "node:crypto";

import type { NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";

import {
  dataStatusResponseSchema,
  type DataStatusResponse,
  type ResponseMeta,
} from "@/application/queries/contracts";

import { readCurrentDataset, type CurrentDataset } from "./current-dataset";

const terminalRunSchema = z
  .object({
    status: z.enum(["succeeded", "partial", "failed"]),
    startedAt: z.coerce.date().nullable(),
    finishedAt: z.coerce.date().nullable(),
    requests: z.number().int().nonnegative(),
    queries: z.number().int().nonnegative(),
    partialQueries: z.number().int().nonnegative(),
    received: z.number().int().nonnegative(),
    valid: z.number().int().nonnegative(),
    offersNew: z.number().int().nonnegative(),
    offersUpdated: z.number().int().nonnegative(),
    quarantined: z.number().int().nonnegative(),
    markedMissing: z.number().int().nonnegative(),
    closed: z.number().int().nonnegative().nullable(),
  })
  .strict();

const incidentRowSchema = z
  .object({
    id: z.string().uuid(),
    severity: z.enum(["info", "warning", "error", "blocking"]),
    message: z.string().max(500),
    createdAt: z.coerce.date(),
    resolvedAt: z.coerce.date().nullable(),
  })
  .strict();

type DataStatusInput = {
  sql: NeonQueryFunction<false, false>;
  now: Date;
  staleAfterHours: number;
  criticalAfterHours: number;
};

function publicIncidentId(id: string): string {
  return `incident_${createHash("sha256").update(id).digest("base64url").slice(0, 16)}`;
}

function toMeta(
  dataset: CurrentDataset,
  generatedAt: Date,
  quality: ResponseMeta["quality"],
  warnings: ResponseMeta["warnings"],
): ResponseMeta {
  return {
    generatedAt: generatedAt.toISOString(),
    dataAsOf: dataset.sourceCutoffAt.toISOString(),
    datasetVersion: dataset.datasetVersion,
    classifierVersion: dataset.classifierVersion,
    metricVersions: dataset.metricVersions,
    querySetVersion: dataset.querySetVersion,
    sampleSize: dataset.memberCount,
    quality,
    warnings,
  };
}

export async function getDataStatus({
  sql,
  now,
  staleAfterHours,
  criticalAfterHours,
}: DataStatusInput): Promise<DataStatusResponse> {
  const dataset = await readCurrentDataset(sql);
  const [terminalRuns, ambiguousRows, incidentRows] = await Promise.all([
    sql`
      select
        run.status,
        run.started_at as "startedAt",
        run.finished_at as "finishedAt",
        run.requests_count as requests,
        (select count(*)::integer from ingestion_run_queries query
          where query.ingestion_run_id = run.id) as queries,
        (select count(*)::integer from ingestion_run_queries query
          where query.ingestion_run_id = run.id
            and query.status <> 'succeeded') as "partialQueries",
        run.offers_received as received,
        run.offers_valid as valid,
        run.offers_new as "offersNew",
        run.offers_updated as "offersUpdated",
        run.offers_quarantined as quarantined,
        run.offers_marked_missing as "markedMissing",
        run.offers_closed as closed
      from ingestion_runs run
      where run.source_id = ${dataset.sourceId}
        and run.mode = 'full'
        and run.status in ('succeeded', 'partial', 'failed')
      order by coalesce(run.finished_at, run.created_at) desc, run.id desc
      limit 1
    `,
    sql`
      select count(*) filter (
        where classification.status = 'ambiguous'
      )::integer as "ambiguousCount"
      from published_dataset_offers membership
      join classifications classification
        on classification.id = membership.classification_id
      where membership.dataset_id = ${dataset.datasetId}
    `,
    sql`
      select
        event.id,
        event.severity,
        event.message,
        event.created_at as "createdAt",
        event.resolved_at as "resolvedAt"
      from data_quality_events event
      where event.is_public = true
        and (event.dataset_id = ${dataset.datasetId} or event.dataset_id is null)
        and event.created_at >= ${now}::timestamptz - interval '30 days'
      order by (event.resolved_at is null) desc, event.created_at desc
      limit 20
    `,
  ]);

  const latestRun = terminalRuns[0]
    ? terminalRunSchema.parse(terminalRuns[0])
    : null;
  const ambiguousCount = z
    .number()
    .int()
    .nonnegative()
    .parse(ambiguousRows[0]?.["ambiguousCount"]);
  const incidents = incidentRows.map((row) => incidentRowSchema.parse(row));
  const ageHours = Math.max(
    0,
    (now.getTime() - dataset.sourceCutoffAt.getTime()) / 3_600_000,
  );
  const freshness =
    ageHours <= staleAfterHours
      ? ("fresh" as const)
      : ageHours <= criticalAfterHours
        ? ("delayed" as const)
        : ("stale" as const);
  const hasOpenIncident = incidents.some(
    (incident) => incident.resolvedAt === null,
  );
  const degraded =
    freshness !== "fresh" || latestRun?.status === "partial" || hasOpenIncident;
  const warnings: ResponseMeta["warnings"] = [];

  if (freshness !== "fresh") {
    warnings.push({
      code: "STALE_DATA",
      severity: freshness === "stale" ? "critical" : "warning",
      message:
        freshness === "stale"
          ? "Les données dépassent le seuil critique de fraîcheur."
          : "La dernière collecte complète est retardée.",
    });
  }
  if (latestRun?.status === "partial") {
    warnings.push({
      code: "PARTIAL_COLLECTION",
      severity: "warning",
      message: "La dernière collecte publiée est partielle.",
    });
  }

  const response: DataStatusResponse = {
    data: {
      status: degraded ? "degraded" : "operational",
      lastSuccessfulRunAt:
        latestRun?.status === "succeeded" && latestRun.finishedAt
          ? latestRun.finishedAt.toISOString()
          : dataset.publishedAt.toISOString(),
      dataAsOf: dataset.sourceCutoffAt.toISOString(),
      freshness,
      latestRun:
        latestRun && latestRun.startedAt && latestRun.finishedAt
          ? {
              status: latestRun.status,
              durationMs: Math.max(
                0,
                latestRun.finishedAt.getTime() - latestRun.startedAt.getTime(),
              ),
              requests: latestRun.requests,
              queries: latestRun.queries,
              partialQueries: latestRun.partialQueries,
              received: latestRun.received,
              valid: latestRun.valid,
              new: latestRun.offersNew,
              updated: latestRun.offersUpdated,
              quarantined: latestRun.quarantined,
              markedMissing: latestRun.markedMissing,
              closed: latestRun.closed,
              ambiguousRate:
                dataset.memberCount === 0
                  ? 0
                  : ambiguousCount / dataset.memberCount,
            }
          : null,
      incidents: incidents.map((incident) => ({
        id: publicIncidentId(incident.id),
        status:
          incident.resolvedAt !== null
            ? ("resolved" as const)
            : incident.severity === "info" || incident.severity === "warning"
              ? ("monitoring" as const)
              : ("identified" as const),
        startedAt: incident.createdAt.toISOString(),
        resolvedAt: incident.resolvedAt?.toISOString() ?? null,
        summary: incident.message,
      })),
    },
    meta: toMeta(
      dataset,
      now,
      degraded ? (freshness === "stale" ? "stale" : "limited") : "normal",
      warnings,
    ),
  };

  return dataStatusResponseSchema.parse(response);
}
