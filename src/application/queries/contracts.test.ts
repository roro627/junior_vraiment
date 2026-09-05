import { describe, expect, it } from "vitest";

import examples from "../../../docs/reference/openapi-examples.json";

import {
  API_MAX_QUERY_STRING_LENGTH,
  dataStatusResponseSchema,
  offersResponseSchema,
  offersSearchParamsSchema,
  overviewResponseSchema,
  overviewSearchParamsSchema,
  parseApiSearchParams,
  taxonomiesResponseSchema,
  trendsResponseSchema,
  trendsSearchParamsSchema,
} from "./contracts";

describe("public API contracts", () => {
  it("validates every documented response fixture", () => {
    expect(overviewResponseSchema.parse(examples.overview)).toEqual(
      examples.overview,
    );
    expect(trendsResponseSchema.parse(examples.trends)).toEqual(
      examples.trends,
    );
    expect(offersResponseSchema.parse(examples.offers)).toEqual(
      examples.offers,
    );
    expect(taxonomiesResponseSchema.parse(examples.taxonomies)).toEqual(
      examples.taxonomies,
    );
    expect(dataStatusResponseSchema.parse(examples.dataStatus)).toEqual(
      examples.dataStatus,
    );
  });

  it("normalizes the shared scope deterministically", () => {
    expect(
      parseApiSearchParams(
        new URLSearchParams(
          "job=frontend&tech=typescript,react,react&area=region:32&contract=cdi,cdd&remote=hybrid&period=current",
        ),
        overviewSearchParamsSchema,
      ),
    ).toEqual({
      job: "frontend",
      technologies: ["react", "typescript"],
      area: "region:32",
      contracts: ["cdd", "cdi"],
      remote: "hybrid",
      period: "current",
    });
  });

  it("rejects unknown, repeated, oversized and excessive filters", () => {
    expect(() =>
      parseApiSearchParams(
        new URLSearchParams("unknown=value"),
        overviewSearchParamsSchema,
      ),
    ).toThrow();
    expect(() =>
      parseApiSearchParams(
        new URLSearchParams("job=frontend&job=backend"),
        overviewSearchParamsSchema,
      ),
    ).toThrow();
    expect(() =>
      parseApiSearchParams(
        new URLSearchParams("tech=react,vue,angular,svelte"),
        overviewSearchParamsSchema,
      ),
    ).toThrow();
    expect(() =>
      parseApiSearchParams(
        new URLSearchParams(`job=${"a".repeat(API_MAX_QUERY_STRING_LENGTH)}`),
        overviewSearchParamsSchema,
      ),
    ).toThrow();
    expect(() =>
      parseApiSearchParams(
        new URLSearchParams("job=blockchain-wizard"),
        overviewSearchParamsSchema,
      ),
    ).toThrow();
    expect(() =>
      parseApiSearchParams(
        new URLSearchParams("tech=unknown-framework"),
        overviewSearchParamsSchema,
      ),
    ).toThrow();
  });

  it("bounds offer pagination and allowlists the sort", () => {
    expect(offersSearchParamsSchema.parse({})).toMatchObject({
      limit: 25,
      sort: "published_desc",
      cursor: null,
    });
    expect(() => offersSearchParamsSchema.parse({ limit: "51" })).toThrow();
    expect(() =>
      offersSearchParamsSchema.parse({ sort: "published_at desc; drop table" }),
    ).toThrow();
  });

  it("requires a complete trend range of at most 366 days", () => {
    expect(() =>
      trendsSearchParamsSchema.parse({
        metric: "junior_contradiction_rate",
        from: "2026-01-01",
      }),
    ).toThrow();
    expect(() =>
      trendsSearchParamsSchema.parse({
        metric: "junior_contradiction_rate",
        from: "2025-01-01",
        to: "2026-01-02",
      }),
    ).toThrow();
  });
});
