import type { NeonQueryFunction } from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";
import { createOrResumeDraftDataset } from "./published-dataset-lifecycle";

describe("dataset source clock", () => {
  it("freezes the observed page clock instead of the delayed completion clock", async () => {
    const sql = vi.fn(async (parts: TemplateStringsArray) => {
      const statement = parts.join("?");
      if (statement.includes("insert into published_datasets")) {
        expect(statement).toContain("max(page.committed_at)");
        expect(statement).toContain("source_pages.cutoff_at, ?");
        expect(statement).toContain("source_pages.cutoff_at is not null");
        expect(statement).toContain(
          "source_pages.cutoff_at <= run.finished_at",
        );
        expect(statement).toContain("on conflict (dataset_version) do nothing");
        expect(statement).not.toContain("run.finished_at, ?");
        return [];
      }
      return [
        {
          datasetId: "dataset",
          datasetVersion: "fixture__source-pages-1",
          sourceId: "source",
          querySetVersion: "queries-test",
          businessDate: "2026-09-07",
          status: "draft",
          ingestionRunId: "run",
          classifierVersion: "classifier-test",
        },
      ];
    });
    expect(
      await createOrResumeDraftDataset({
        sql: sql as unknown as NeonQueryFunction<false, false>,
        datasetVersion: "fixture__source-pages-1",
        ingestionRunId: "run",
        classifierVersion: "classifier-test",
        metricVersions: {},
        taxonomyVersions: {},
        qualitySummary: {},
        computedAt: new Date("2026-09-07T06:44:00Z"),
      }),
    ).toMatchObject({ datasetId: "dataset" });
  });
});
