import type { NeonQueryFunction } from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";
import { freezeDatasetMembership } from "./published-dataset-lifecycle";

describe("frozen job-family provenance", () => {
  it("captures admitted families with the first membership freeze", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ memberCount: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { memberCount: 2, missingClassificationCount: 0 },
      ]);
    await freezeDatasetMembership({
      sql: query as unknown as NeonQueryFunction<false, false>,
      datasetId: "fixture",
    });
    const insert = (query.mock.calls[1]![0] as TemplateStringsArray).join("?");
    expect(insert).toContain("classification_id, job_families");
    expect(insert).toContain("select distinct family.key");
    expect(insert).toContain("matched.matched_job_families");
    expect(insert).toContain(
      "query.query_set_version = dataset.query_set_version",
    );
  });
  it("never refreshes families on replay of an already frozen dataset", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ memberCount: 2 }])
      .mockResolvedValueOnce([
        { memberCount: 2, missingClassificationCount: 0 },
      ]);
    await freezeDatasetMembership({
      sql: query as unknown as NeonQueryFunction<false, false>,
      datasetId: "fixture",
    });
    expect(query).toHaveBeenCalledTimes(2);
    const statements = query.mock.calls
      .map((call) => (call[0] as TemplateStringsArray).join("?"))
      .join("\n");
    expect(statements).not.toMatch(/\b(?:insert|update)\b/iu);
  });
});
