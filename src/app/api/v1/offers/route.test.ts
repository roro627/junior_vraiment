import { beforeEach, describe, expect, it, vi } from "vitest";

import exampleDocument from "../../../../../docs/reference/openapi-examples.json";

import { getCachedPublicOffers } from "@/application/queries/cached-public-data";
import { offersResponseSchema } from "@/application/queries/contracts";
import { InvalidCursorError } from "@/application/queries/public-id";

import { GET } from "./route";

vi.mock("@/application/queries/cached-public-data", () => ({
  getCachedPublicOffers: vi.fn(),
}));

const getCachedPublicOffersMock = vi.mocked(getCachedPublicOffers);
const offersExample = offersResponseSchema.parse(exampleDocument.offers);

describe("GET /api/v1/offers", () => {
  beforeEach(() => {
    getCachedPublicOffersMock.mockReset();
  });

  it("normalizes filters and returns the documented representation", async () => {
    getCachedPublicOffersMock.mockResolvedValue({
      outcome: "success",
      response: offersExample,
    });
    const response = await GET(
      new Request(
        "https://example.test/api/v1/offers?tech=typescript,react&limit=10&salaryPublished=true",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=60, stale-while-revalidate=600",
    );
    expect(getCachedPublicOffersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: expect.objectContaining({
          technologies: ["react", "typescript"],
        }),
        limit: 10,
        salaryPublished: true,
      }),
    );
    await expect(response.json()).resolves.toEqual(offersExample);
  });

  it("rejects unknown parameters without touching the database", async () => {
    const response = await GET(
      new Request("https://example.test/api/v1/offers?column=external_id"),
    );

    expect(response.status).toBe(400);
    expect(getCachedPublicOffersMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_FILTER",
      status: 400,
    });
  });

  it("reports a signed cursor mismatch as an invalid cursor", async () => {
    getCachedPublicOffersMock.mockResolvedValue({
      outcome: "invalid_cursor",
    });
    const response = await GET(
      new Request("https://example.test/api/v1/offers?cursor=tampered"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_CURSOR",
      status: 400,
    });
  });

  it("also handles an uncached invalid cursor error", async () => {
    getCachedPublicOffersMock.mockRejectedValue(new InvalidCursorError());
    const response = await GET(
      new Request("https://example.test/api/v1/offers?cursor=tampered"),
    );

    expect(response.status).toBe(400);
  });
});
