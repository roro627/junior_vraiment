import { describe, expect, it } from "vitest";

import {
  createInitialInsightDraft,
  insightExplorerHref,
  type InsightMetricSnapshot,
} from "./editorial";

function snapshot(
  values: Partial<InsightMetricSnapshot> = {},
): InsightMetricSnapshot {
  return {
    datasetId: "113803eb-674f-4b22-aa72-e6c54a6c0170",
    metricKey: "junior_contradiction_rate",
    metricVersion: "junior-contradiction-1.0.0",
    periodStart: "2026-09-04",
    periodEnd: "2026-09-04",
    numerator: 1,
    denominator: 408,
    populationCount: 518,
    unknownCount: 0,
    ambiguousCount: 110,
    value: 1 / 408,
    coverage: 408 / 518,
    sampleQuality: "normal",
    ...values,
  };
}

describe("createInitialInsightDraft", () => {
  it("creates stable, factual copy from a stored metric snapshot", () => {
    const draft = createInitialInsightDraft(snapshot());

    expect(draft.slug).toBe("junior-et-deux-ans-france-2026-09-04");
    expect(draft.title).toContain("0,2\u00a0%");
    expect(draft.summary).toContain("1 sur 408");
    expect(draft.filters).toEqual({
      job: null,
      technologies: [],
      area: "france",
      contracts: [],
      remote: null,
      period: "current",
    });
  });

  it("refuses to editorialize an insufficient sample", () => {
    expect(() =>
      createInitialInsightDraft(
        snapshot({
          denominator: 12,
          populationCount: 12,
          ambiguousCount: 0,
          value: null,
          coverage: 1,
          sampleQuality: "insufficient",
        }),
      ),
    ).toThrow("échantillon publiable");
  });
});

describe("insightExplorerHref", () => {
  it.each([
    ["junior_contradiction_rate", "classification=contradictory"],
    ["beginner_friendly_rate", "classification=beginner_friendly"],
    ["salary_transparency_rate", "salaryPublished=true"],
  ] as const)("links %s to its verifiable offer subset", (metric, expected) => {
    expect(insightExplorerHref(metric)).toContain(expected);
  });
});
