import { describe, expect, it } from "vitest";

import {
  buildAtomicQueries,
  buildBlindSample,
  collectAtomicQuery,
  parseQuerySet,
  type AtomicQuery,
} from "../../../scripts/collect-query-set-validation";
import { FranceTravailError } from "./errors";

const query: AtomicQuery = {
  id: "query",
  codeROME: "M1805",
  motsCles: null,
  kind: "occupation-only",
  groupIds: ["frontend"],
  jobFamilies: ["frontend"],
  titleIncludesAnyByGroup: { frontend: [] },
};

const sourceOffer = {
  id: "offer-1",
  intitule: "Développeur",
  description: "Description sans donnée de contact",
};

describe("query-set validation collector", () => {
  it("deduplicates atomic codeROME/motsCles pairs across groups", () => {
    const set = parseQuerySet({
      documentVersion: "1",
      querySetVersion: "1",
      source: "france-travail",
      requestRules: {
        maxRequestsPerSecondInitial: 5,
        maxResultsPerRange: 150,
        maxStartIndex: 3000,
        maxEndIndex: 3149,
      },
      groups: [
        {
          id: "one",
          enabled: false,
          jobFamilies: ["one"],
          occupationReferences: ["M1805"],
          keywordsAny: ["react"],
        },
        {
          id: "two",
          enabled: false,
          jobFamilies: ["two"],
          occupationReferences: ["M1805"],
          keywordsAny: ["react"],
        },
      ],
    });
    const queries = buildAtomicQueries(set);
    expect(queries).toHaveLength(3);
    expect(queries.find((item) => item.kind === "overlap")?.groupIds).toEqual([
      "one",
      "two",
    ]);
  });

  it("keeps group-specific title filters on shared source queries", () => {
    const set = parseQuerySet({
      documentVersion: "1",
      querySetVersion: "1",
      source: "france-travail",
      requestRules: {
        maxRequestsPerSecondInitial: 5,
        maxResultsPerRange: 150,
        maxStartIndex: 3000,
        maxEndIndex: 3149,
      },
      groups: [
        {
          id: "one",
          enabled: false,
          jobFamilies: ["one"],
          occupationReferences: ["M1805"],
          keywordsAny: [],
          titleIncludesAny: ["front-end"],
        },
        {
          id: "two",
          enabled: false,
          jobFamilies: ["two"],
          occupationReferences: ["M1805"],
          keywordsAny: [],
          titleIncludesAny: ["back-end"],
        },
      ],
    });
    expect(buildAtomicQueries(set)[0]?.titleIncludesAnyByGroup).toEqual({
      one: ["front-end"],
      two: ["back-end"],
    });
  });

  it("paginates to completion and rejects a non-progressing nextRange", async () => {
    const firstPageOffers = Array.from({ length: 150 }, (_, index) => ({
      ...sourceOffer,
      id: `offer-${index + 1}`,
    }));
    const pages = [
      {
        items: firstPageOffers,
        total: 151,
        nextRange: "150-299",
        validationStatus: "valid" as const,
        warnings: [],
        quarantined: [],
      },
      {
        items: [{ ...sourceOffer, id: "offer-151" }],
        total: 151,
        nextRange: null,
        validationStatus: "valid" as const,
        warnings: [],
        quarantined: [],
      },
    ];
    const result = await collectAtomicQuery(
      { search: async () => pages.shift()! },
      query,
    );
    expect(result.run.status).toBe("complete");
    expect(result.run.pages).toBe(2);
    expect(result.run.offerIds).toHaveLength(151);
  });

  it("marks totals above the API cap without fetching more pages", async () => {
    let calls = 0;
    const result = await collectAtomicQuery(
      {
        search: async () => {
          calls += 1;
          return {
            items: [],
            total: 3151,
            nextRange: "150-299",
            validationStatus: "valid" as const,
            warnings: [],
            quarantined: [],
          };
        },
      },
      query,
    );
    expect(result.run.status).toBe("over_cap");
    expect(calls).toBe(1);
  });

  it("backs off and retries a transient source failure", async () => {
    let calls = 0;
    const delays: number[] = [];
    const result = await collectAtomicQuery(
      {
        search: async () => {
          calls += 1;
          if (calls === 1) {
            throw new FranceTravailError(
              "rate limited",
              "http_error",
              true,
              429,
            );
          }
          return {
            items: [],
            total: 0,
            nextRange: null,
            validationStatus: "valid" as const,
            warnings: [],
            quarantined: [],
          };
        },
      },
      query,
      {
        sleep: async (milliseconds) => {
          delays.push(milliseconds);
        },
        random: () => 0,
      },
    );
    expect(calls).toBe(2);
    expect(delays).toEqual([1_000]);
    expect(result.run.status).toBe("complete");
  });

  it("selects an opaque, deterministic blind sample", () => {
    const offer = {
      externalId: "external-1",
      title: "Titre",
      description: "Texte",
      structuredExperienceRequired: null,
      structuredExperienceLabel: null,
      groupChannels: new Map([
        ["frontend", new Set(["keyword-only" as const])],
      ]),
      groupQueryIds: new Map([["frontend", new Set(["query"])]]),
    };
    const rows = buildBlindSample(
      [
        {
          id: "frontend",
          enabled: false,
          jobFamilies: ["frontend"],
          occupationReferences: [],
          keywordsAny: [],
        },
      ],
      new Map([[offer.externalId, offer]]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.reviewId).not.toContain("external-1");
    expect(rows[0]?.discoveryChannels).toEqual(["keyword-only"]);
  });
});
