import { describe, expect, it } from "vitest";

import {
  decodeOffersCursor,
  encodeOffersCursor,
  InvalidCursorError,
  offersFilterHash,
  publicOfferId,
} from "./public-id";
import type { Scope } from "./contracts";

const secret = "cursor-secret-that-is-long-enough-for-tests";
const scope: Scope = {
  job: "frontend",
  technologies: ["react", "typescript"],
  area: "france",
  contracts: ["cdi"],
  remote: null,
  period: "current",
};

describe("public identifiers and cursors", () => {
  it("encodes an opaque stable public offer id", () => {
    const internal = "113803eb-674f-4b22-aa72-e6c54a6c0170";
    const publicId = publicOfferId(internal);

    expect(publicId).toMatch(/^jv_[a-zA-Z0-9_-]{22}$/u);
    expect(publicId).not.toContain(internal);
    expect(publicOfferId(internal)).toBe(publicId);
  });

  it("round-trips a cursor bound to its dataset, filters and sort", () => {
    const filterHash = offersFilterHash({
      scope: { ...scope },
      classification: "contradictory",
      salaryPublished: null,
      experience: [],
    });
    const cursor = {
      version: 1 as const,
      datasetVersion: "dataset-1",
      filterHash,
      sort: "published_desc" as const,
      offerId: "113803eb-674f-4b22-aa72-e6c54a6c0170",
      primary: 1_788_532_800_000,
    };
    const encoded = encodeOffersCursor(cursor, secret);

    expect(
      decodeOffersCursor(
        encoded,
        {
          datasetVersion: cursor.datasetVersion,
          filterHash,
          sort: cursor.sort,
        },
        secret,
      ),
    ).toEqual(cursor);
  });

  it("rejects tampering and cross-filter cursor reuse", () => {
    const filterHash = offersFilterHash({
      scope: { ...scope },
      classification: null,
      salaryPublished: null,
      experience: [],
    });
    const encoded = encodeOffersCursor(
      {
        version: 1,
        datasetVersion: "dataset-1",
        filterHash,
        sort: "published_desc",
        offerId: "113803eb-674f-4b22-aa72-e6c54a6c0170",
        primary: null,
      },
      secret,
    );

    expect(() =>
      decodeOffersCursor(
        `${encoded.slice(0, -1)}x`,
        { datasetVersion: "dataset-1", filterHash, sort: "published_desc" },
        secret,
      ),
    ).toThrow(InvalidCursorError);
    expect(() =>
      decodeOffersCursor(
        encoded,
        {
          datasetVersion: "dataset-1",
          filterHash: "0".repeat(64),
          sort: "published_desc",
        },
        secret,
      ),
    ).toThrow(InvalidCursorError);
  });
});
