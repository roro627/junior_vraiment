// @vitest-environment node
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginFullIngestionRun,
  completeFullQuery,
  failFullQuery,
  failFullRun,
  IngestionPaginationIncompleteError,
} from "@/db/full-ingestion-run";
import { syncTechnologyTaxonomy } from "@/db/sync-taxonomies";
import type { FranceTravailClient } from "@/lib/france-travail/client";
import {
  createDatasetVersion,
  runFullFranceTravailIngestion,
} from "./run-daily-ingestion";
import { responseMetaSchema } from "../queries/contracts";

vi.mock("@/db/full-ingestion-run", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/db/full-ingestion-run")>();
  return {
    ...actual,
    beginFullIngestionRun: vi.fn(),
    completeFullQuery: vi.fn(),
    markFullQueryRunning: vi.fn(),
    failFullQuery: vi.fn(),
    failFullRun: vi.fn(),
  };
});
vi.mock("@/db/sync-taxonomies", () => ({ syncTechnologyTaxonomy: vi.fn() }));
vi.mock("@/lib/france-travail/active-query-set", () => ({
  loadActiveFranceTravailQuerySet: () => ({
    querySetVersion: "fixture-query-set",
  }),
  buildFranceTravailAtomicQueries: () => [
    {
      queryKey: "fixture-query",
      kind: "keyword",
      keyword: "fixture",
      memberships: [],
    },
  ],
}));

describe("full ingestion recovery (isolated fixtures)", () => {
  it("keeps a method-versioned publication inside the public metadata contract", () => {
    const version = createDatasetVersion({
      startedAt: new Date("2026-09-10T01:30:44.456Z"),
      querySetVersion: "queries-3.0.0",
    });
    expect(version).toContain("__kpi-2.0.0__");
    expect(
      responseMetaSchema.shape.datasetVersion.safeParse(version).success,
    ).toBe(true);
    expect(() =>
      createDatasetVersion({
        startedAt: new Date(),
        querySetVersion: "x".repeat(100),
      }),
    ).toThrow();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(beginFullIngestionRun).mockResolvedValue({
      ingestionRunId: "fixture-run",
      sourceId: "fixture-source",
      status: "running",
      startedAt: new Date("2026-09-09T01:30:00Z"),
      queries: [
        {
          queryKey: "fixture-query",
          sourceQueryId: "fixture-source-query",
          ingestionRunQueryId: "fixture-run-query",
          status: "failed",
          pagesReceived: 2,
          offersReceived: 185,
          requestCount: 2,
          checkpoint: {
            nextRangeStart: null,
            sourceTotal: 185,
            offersValid: 185,
            offersQuarantined: 0,
            offersInPerimeter: 168,
            sourceWarnings: 0,
          },
        },
      ],
    });
    vi.mocked(completeFullQuery).mockRejectedValue(
      new IngestionPaginationIncompleteError(),
    );
  });

  function dependencies(attempt?: number) {
    const search = vi.fn();
    return {
      sql: vi.fn() as unknown as NeonQueryFunction<false, false>,
      client: { search } as unknown as FranceTravailClient,
      scheduledAt: new Date("2026-09-09T01:30:00Z"),
      triggerRunId: "fixture-distinct-trigger-run",
      ...(attempt === undefined ? {} : { attempt }),
      rawPayloadRetentionDays: 30,
      requestsPerSecond: 5,
      revalidationUrl: "https://example.invalid/revalidation",
      revalidationSecret: "fixture-only",
      search,
    };
  }

  it("records an invalid terminal checkpoint as failed without refetching or erasing pages", async () => {
    const input = dependencies();
    await expect(runFullFranceTravailIngestion(input)).rejects.toBeInstanceOf(
      IngestionPaginationIncompleteError,
    );
    expect(input.search).not.toHaveBeenCalled();
    expect(input.sql).not.toHaveBeenCalled();
    expect(failFullQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        ingestionRunQueryId: "fixture-run-query",
        errorCode: "pagination_incomplete",
      }),
    );
    expect(failFullRun).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "pagination_incomplete" }),
    );
    expect(beginFullIngestionRun).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1 }),
    );
  });

  it("passes the distinct attempt and Trigger run to the durable identity", async () => {
    await expect(
      runFullFranceTravailIngestion(dependencies(2)),
    ).rejects.toBeInstanceOf(IngestionPaginationIncompleteError);
    expect(beginFullIngestionRun).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 2,
        triggerRunId: "fixture-distinct-trigger-run",
      }),
    );
  });

  it.each([0, -1, 1.5, 4, Number.NaN])(
    "rejects an unbounded/invalid attempt %s before any write",
    async (attempt) => {
      await expect(
        runFullFranceTravailIngestion(dependencies(attempt)),
      ).rejects.toBeInstanceOf(RangeError);
      expect(syncTechnologyTaxonomy).not.toHaveBeenCalled();
      expect(beginFullIngestionRun).not.toHaveBeenCalled();
    },
  );
});
