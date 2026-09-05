import { describe, expect, it } from "vitest";

import examples from "../../../docs/reference/openapi-examples.json";

import { publicOfferSchema } from "@/application/queries/contracts";

import { buildAnalyticsContext } from "./context";
import { buildFilterChangeEvents } from "./filter-events";
import {
  analyticsClassificationLabel,
  analyticsRankBucket,
  primaryAnalyticsEvidenceKind,
} from "./offer-events";

describe("analytics event contracts", () => {
  it("derives the versioned context from public response metadata", () => {
    expect(
      buildAnalyticsContext({
        datasetVersion: "dataset-2026-09-05",
        classifierVersion: "classifier-1.2.0",
      }),
    ).toEqual({
      appVersion: "0.1.0",
      datasetId: "dataset-2026-09-05",
      classifierVersion: "classifier-1.2.0",
      methodologyVersion: "methodology-1.0.0",
    });
  });

  it("reports only changed, allowlisted filters with opaque taxonomy ids", () => {
    expect(
      buildFilterChangeEvents(
        {
          job: "frontend",
          tech: "react",
          area: "region:32",
          period: "30d",
        },
        {
          job: "backend",
          tech: "react",
          area: "department:75",
          period: "30d",
          salaryPublished: "true",
        },
      ),
    ).toEqual([
      {
        name: "filter_changed",
        properties: {
          filter_name: "job_family",
          action: "remove",
          value_id: "frontend",
        },
      },
      {
        name: "filter_changed",
        properties: {
          filter_name: "job_family",
          action: "add",
          value_id: "backend",
        },
      },
      {
        name: "filter_changed",
        properties: {
          filter_name: "region",
          action: "remove",
          value_id: "region-32",
        },
      },
      {
        name: "filter_changed",
        properties: {
          filter_name: "department",
          action: "add",
          value_id: "department-75",
        },
      },
    ]);
  });

  it("keeps generated taxonomy ids inside the normative format", () => {
    const [event] = buildFilterChangeEvents(
      { job: "" },
      {
        job: `${"développement-".repeat(8)}frontend`,
      },
    );

    expect(event?.properties.value_id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
    expect(event?.properties.value_id.length).toBeLessThanOrEqual(64);
  });

  it("derives aggregate offer properties without exposing the offer identity", () => {
    const offer = publicOfferSchema.parse(examples.offers.data.items[0]);

    expect(analyticsClassificationLabel(offer)).toBe("contradictory");
    expect(analyticsRankBucket(1)).toBe("1-5");
    expect(analyticsRankBucket(11)).toBe("11-25");
    expect(primaryAnalyticsEvidenceKind(offer)).toBe("junior_claim");
  });
});
