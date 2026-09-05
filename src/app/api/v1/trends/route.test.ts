import { beforeEach, describe, expect, it, vi } from "vitest";

import exampleDocument from "../../../../../docs/reference/openapi-examples.json";

import { getCachedPublicTrends } from "@/application/queries/cached-public-data";
import { trendsResponseSchema } from "@/application/queries/contracts";

import { GET } from "./route";

vi.mock("@/application/queries/cached-public-data", () => ({
  getCachedPublicTrends: vi.fn(),
}));

const getCachedPublicTrendsMock = vi.mocked(getCachedPublicTrends);
const trendsExample = trendsResponseSchema.parse(exampleDocument.trends);

describe("GET /api/v1/trends", () => {
  beforeEach(() => {
    getCachedPublicTrendsMock.mockReset();
  });

  it("requires an allowlisted metric and returns the documented response", async () => {
    getCachedPublicTrendsMock.mockResolvedValue(trendsExample);
    const response = await GET(
      new Request(
        "https://example.test/api/v1/trends?metric=junior_contradiction_rate&period=current",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=900, stale-while-revalidate=21600",
    );
    expect(getCachedPublicTrendsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: "junior_contradiction_rate",
      }),
    );
    await expect(response.json()).resolves.toEqual(trendsExample);
  });

  it("rejects a missing metric", async () => {
    const response = await GET(
      new Request("https://example.test/api/v1/trends"),
    );

    expect(response.status).toBe(400);
    expect(getCachedPublicTrendsMock).not.toHaveBeenCalled();
  });
});
