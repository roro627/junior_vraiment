import { beforeEach, describe, expect, it, vi } from "vitest";

import exampleDocument from "../../../../../docs/reference/openapi-examples.json";

import { getCachedPublicTaxonomies } from "@/application/queries/cached-public-data";
import { taxonomiesResponseSchema } from "@/application/queries/contracts";

import { GET } from "./route";

vi.mock("@/application/queries/cached-public-data", () => ({
  getCachedPublicTaxonomies: vi.fn(),
}));

const getCachedPublicTaxonomiesMock = vi.mocked(getCachedPublicTaxonomies);
const taxonomiesExample = taxonomiesResponseSchema.parse(
  exampleDocument.taxonomies,
);

describe("GET /api/v1/taxonomies", () => {
  beforeEach(() => {
    getCachedPublicTaxonomiesMock.mockReset();
  });

  it("returns the documented representation for 24 hours", async () => {
    getCachedPublicTaxonomiesMock.mockResolvedValue(taxonomiesExample);
    const response = await GET(
      new Request("https://example.test/api/v1/taxonomies"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
    await expect(response.json()).resolves.toEqual(taxonomiesExample);
  });

  it("rejects parameters because the route has none", async () => {
    const response = await GET(
      new Request("https://example.test/api/v1/taxonomies?hidden=true"),
    );

    expect(response.status).toBe(400);
    expect(getCachedPublicTaxonomiesMock).not.toHaveBeenCalled();
  });
});
