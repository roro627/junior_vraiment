import type { NeonQueryFunction } from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";

import {
  completeFullQuery,
  IngestionPaginationIncompleteError,
  readFullIngestionQualityFacts,
} from "./full-ingestion-run";

describe("completeFullQuery", () => {
  it("keeps source-total, count and chain checks and fails with a safe typed error", async () => {
    const query = vi.fn(async (parts: TemplateStringsArray) => {
      const statement = parts.join("?");
      expect(statement).toContain(
        "page_state.minimum_source_total = page_state.maximum_source_total",
      );
      expect(statement).toContain(
        "page_state.received_count = page_state.maximum_source_total",
      );
      expect(statement).toContain(
        "next_page.range_start = page.next_range_start",
      );
      expect(statement).not.toMatch(/delete\s+from/iu);
      return [];
    });
    await expect(
      completeFullQuery({
        sql: query as unknown as NeonQueryFunction<false, false>,
        ingestionRunQueryId: "fixture-query",
        finishedAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(IngestionPaginationIncompleteError);
  });
});

describe("readFullIngestionQualityFacts", () => {
  it.each([null, 0, 3])(
    "projects and preserves the closure count %s",
    async (offersClosed) => {
      const query = vi.fn(async (parts: TemplateStringsArray) => {
        const projection = parts.join("?").split("from ingestion_runs")[0];
        expect(projection).toMatch(/offers_marked_missing,\s*offers_closed/u);
        return [
          {
            paginationComplete: true,
            sourceCapReached: false,
            offersReceived: 10,
            requestsCount: 1,
            offersValid: 10,
            offersQuarantined: 0,
            offersInPerimeter: 10,
            uniqueOffers: 10,
            offersNew: 1,
            offersUpdated: 2,
            offersMarkedMissing: 3,
            offersClosed,
            positiveClassifications: 5,
            positiveClassificationsWithEvidence: 5,
            volumeAnomalyDetected: false,
            partitionVolumes: [],
          },
        ];
      });
      const result = await readFullIngestionQualityFacts({
        sql: query as unknown as NeonQueryFunction<false, false>,
        ingestionRunId: "test-run",
        classifierVersion: "classifier-1.2.0",
      });
      expect(result.offersClosed).toBe(offersClosed);
    },
  );
});
