import { beforeEach, describe, expect, it, vi } from "vitest";

import exampleDocument from "../../../../../docs/reference/openapi-examples.json";

import { getCachedDataStatus } from "@/application/queries/cached-public-data";
import { dataStatusResponseSchema } from "@/application/queries/contracts";
import { NoPublishedDatasetError } from "@/db/queries/current-dataset";

import { GET } from "./route";

vi.mock("@/application/queries/cached-public-data", () => ({
  getCachedDataStatus: vi.fn(),
}));

const getCachedDataStatusMock = vi.mocked(getCachedDataStatus);
const dataStatusExample = dataStatusResponseSchema.parse(
  exampleDocument.dataStatus,
);

describe("GET /api/v1/data-status", () => {
  beforeEach(() => {
    getCachedDataStatusMock.mockReset();
  });

  it("returns the documented representation with cache headers", async () => {
    getCachedDataStatusMock.mockResolvedValue(dataStatusExample);
    const request = new Request("https://example.test/api/v1/data-status");

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(response.headers.get("etag")).toMatch(/^"[a-zA-Z0-9_-]+"$/u);
    await expect(response.json()).resolves.toEqual(dataStatusExample);
  });

  it("honors If-None-Match", async () => {
    getCachedDataStatusMock.mockResolvedValue(dataStatusExample);
    const first = await GET(
      new Request("https://example.test/api/v1/data-status"),
    );
    const etag = first.headers.get("etag");
    const second = await GET(
      new Request("https://example.test/api/v1/data-status", {
        headers: { "if-none-match": etag ?? "" },
      }),
    );

    expect(second.status).toBe(304);
    await expect(second.text()).resolves.toBe("");
  });

  it("returns a safe Problem Details response without a dataset", async () => {
    getCachedDataStatusMock.mockRejectedValue(new NoPublishedDatasetError());

    const response = await GET(
      new Request("https://example.test/api/v1/data-status"),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json; charset=utf-8",
    );
    await expect(response.json()).resolves.toMatchObject({
      code: "DATA_UNAVAILABLE",
      status: 503,
    });
  });
});
