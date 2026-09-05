import { revalidateTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createRevalidationSignature,
  REVALIDATION_SIGNATURE_HEADER,
} from "@/application/use-cases/request-revalidation";

import { POST } from "./route";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const SECRET = "r".repeat(64);

function signedRequest(payload: unknown, signatureSecret = SECRET): Request {
  const rawBody = JSON.stringify(payload);

  return new Request("http://localhost/api/internal/revalidate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [REVALIDATION_SIGNATURE_HEADER]: createRevalidationSignature(
        signatureSecret,
        rawBody,
      ),
    },
    body: rawBody,
  });
}

describe("POST /api/internal/revalidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("REVALIDATION_SECRET", SECRET);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("revalidates only the signed allowlisted tags", async () => {
    const response = await POST(
      signedRequest({
        datasetVersion: "dataset-1",
        tags: ["overview", "tech:typescript"],
        timestamp: new Date().toISOString(),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      revalidated: true,
      tagCount: 2,
    });
    expect(revalidateTag).toHaveBeenCalledTimes(2);
    expect(revalidateTag).toHaveBeenCalledWith("overview", { expire: 0 });
  });

  it("rejects a request signed with another secret", async () => {
    const response = await POST(
      signedRequest(
        {
          datasetVersion: "dataset-1",
          tags: ["overview"],
          timestamp: new Date().toISOString(),
        },
        "x".repeat(64),
      ),
    );

    expect(response.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects arbitrary tags and expired requests", async () => {
    const arbitraryTagResponse = await POST(
      signedRequest({
        datasetVersion: "dataset-1",
        tags: ["path:/admin"],
        timestamp: new Date().toISOString(),
      }),
    );
    const expiredResponse = await POST(
      signedRequest({
        datasetVersion: "dataset-1",
        tags: ["overview"],
        timestamp: "2025-01-01T00:00:00.000Z",
      }),
    );

    expect(arbitraryTagResponse.status).toBe(400);
    expect(expiredResponse.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects oversized bodies before parsing", async () => {
    const rawBody = "x".repeat(16 * 1_024 + 1);
    const response = await POST(
      new Request("http://localhost/api/internal/revalidate", {
        method: "POST",
        headers: {
          [REVALIDATION_SIGNATURE_HEADER]: createRevalidationSignature(
            SECRET,
            rawBody,
          ),
        },
        body: rawBody,
      }),
    );

    expect(response.status).toBe(413);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
