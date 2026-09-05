import { beforeEach, describe, expect, it, vi } from "vitest";

import exampleDocument from "../../../../../docs/reference/openapi-examples.json";

import { getCachedPublicOverview } from "@/application/queries/cached-public-data";
import { overviewResponseSchema } from "@/application/queries/contracts";

import { GET } from "./route";

vi.mock("@/application/queries/cached-public-data", () => ({
  getCachedPublicOverview: vi.fn(),
}));

const getCachedPublicOverviewMock = vi.mocked(getCachedPublicOverview);
const overviewExample = overviewResponseSchema.parse(exampleDocument.overview);

describe("GET /api/v1/overview", () => {
  beforeEach(() => {
    getCachedPublicOverviewMock.mockReset();
  });

  it("normalizes filters and returns the documented response", async () => {
    getCachedPublicOverviewMock.mockResolvedValue(overviewExample);
    const response = await GET(
      new Request(
        "https://example.test/api/v1/overview?tech=typescript,react&period=current",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=300, stale-while-revalidate=3600",
    );
    expect(getCachedPublicOverviewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        technologies: ["react", "typescript"],
        period: "current",
      }),
    );
    await expect(response.json()).resolves.toEqual(overviewExample);
  });

  it("returns Problem Details for an invalid area", async () => {
    const response = await GET(
      new Request("https://example.test/api/v1/overview?area=everywhere"),
    );

    expect(response.status).toBe(400);
    expect(getCachedPublicOverviewMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_FILTER",
      status: 400,
    });
  });
});
