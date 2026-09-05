import type { NeonQueryFunction } from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";

import { getDataStatus } from "./get-data-status";

function sqlWithResults(
  ...results: ReadonlyArray<ReadonlyArray<Record<string, unknown>>>
): NeonQueryFunction<false, false> {
  let resultIndex = 0;
  return vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(results[resultIndex++] ?? []),
    ) as unknown as NeonQueryFunction<false, false>;
}

const dataset = {
  datasetId: "113803eb-674f-4b22-aa72-e6c54a6c0170",
  datasetVersion: "dataset-2026-09-04-v1",
  sourceId: "213803eb-674f-4b22-aa72-e6c54a6c0170",
  ingestionRunId: "313803eb-674f-4b22-aa72-e6c54a6c0170",
  classifierVersion: "classifier-1.1.0",
  metricVersions: {
    junior_contradiction_rate: "junior-contradiction-1.0.0",
  },
  querySetVersion: "queries-2.0.0",
  taxonomyVersions: {
    jobs: "jobs-1.0.0",
    technologies: "technologies-1.2.0",
  },
  qualitySummary: { decision: "publish" },
  sourceCutoffAt: "2026-09-04T13:55:27.000Z",
  computedAt: "2026-09-04T13:55:27.000Z",
  publishedAt: "2026-09-04T13:55:28.000Z",
  memberCount: 100,
  sourceLabel: "France Travail",
  sourceAttributionUrl: "https://www.francetravail.fr/",
};

describe("getDataStatus", () => {
  it("derives a public operational status without leaking internal identifiers", async () => {
    const sql = sqlWithResults(
      [dataset],
      [
        {
          status: "succeeded",
          startedAt: "2026-09-04T13:50:00.000Z",
          finishedAt: "2026-09-04T13:55:27.000Z",
          requests: 42,
          queries: 10,
          partialQueries: 0,
          received: 1_200,
          valid: 1_200,
          offersNew: 100,
          offersUpdated: 25,
          quarantined: 0,
          markedMissing: 4,
          closed: 2,
        },
      ],
      [{ ambiguousCount: 5 }],
      [],
    );

    const result = await getDataStatus({
      sql,
      now: new Date("2026-09-04T14:00:00.000Z"),
      staleAfterHours: 30,
      criticalAfterHours: 72,
    });

    expect(result.data).toMatchObject({
      status: "operational",
      freshness: "fresh",
      latestRun: {
        status: "succeeded",
        queries: 10,
        received: 1_200,
        closed: 2,
        ambiguousRate: 0.05,
      },
      incidents: [],
    });
    expect(JSON.stringify(result)).not.toContain(dataset.datasetId);
    expect(result.meta.sampleSize).toBe(100);
  });

  it("marks delayed data and public incidents as degraded", async () => {
    const sql = sqlWithResults(
      [dataset],
      [
        {
          status: "partial",
          startedAt: "2026-09-04T13:50:00.000Z",
          finishedAt: "2026-09-04T13:55:27.000Z",
          requests: 41,
          queries: 10,
          partialQueries: 1,
          received: 1_200,
          valid: 1_197,
          offersNew: 100,
          offersUpdated: 25,
          quarantined: 3,
          markedMissing: 0,
          closed: null,
        },
      ],
      [{ ambiguousCount: 5 }],
      [
        {
          id: "413803eb-674f-4b22-aa72-e6c54a6c0170",
          severity: "warning",
          message: "Collecte en retard.",
          createdAt: "2026-09-05T14:00:00.000Z",
          resolvedAt: null,
        },
      ],
    );

    const result = await getDataStatus({
      sql,
      now: new Date("2026-09-06T00:00:00.000Z"),
      staleAfterHours: 30,
      criticalAfterHours: 72,
    });

    expect(result.data.status).toBe("degraded");
    expect(result.data.freshness).toBe("delayed");
    expect(result.data.incidents[0]).toMatchObject({
      status: "monitoring",
      summary: "Collecte en retard.",
    });
    expect(result.data.incidents[0]?.id).not.toContain("413803eb");
    expect(result.meta.warnings.map(({ code }) => code)).toEqual([
      "STALE_DATA",
      "PARTIAL_COLLECTION",
    ]);
  });
});
