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

describe("streamed body limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("REVALIDATION_SECRET", SECRET);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function streamRequest(
    chunks: Uint8Array[],
    headers: Record<string, string> = {},
  ) {
    let consumed = 0;
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          if (consumed < chunks.length) controller.enqueue(chunks[consumed++]!);
          else controller.close();
        },
        cancel,
      },
      { highWaterMark: 0 },
    );
    const request = new Request("http://localhost/api/internal/revalidate", {
      method: "POST",
      headers,
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    return { request, cancel, consumed: () => consumed };
  }

  it.each([undefined, "1", "invalid", "-1"])(
    "cancels overflow with absent or unreliable Content-Length %s",
    async (length) => {
      const headers: Record<string, string> = {};
      if (length !== undefined) headers["content-length"] = length;
      const stream = streamRequest(
        [new Uint8Array(16384), new Uint8Array(1), new Uint8Array(100)],
        headers,
      );
      const response = await POST(stream.request);
      expect(response.status).toBe(413);
      expect(stream.cancel).toHaveBeenCalledOnce();
      expect(stream.consumed()).toBe(2);
      expect(revalidateTag).not.toHaveBeenCalled();
    },
  );

  it("accepts exactly the byte limit with split Unicode and valid HMAC", async () => {
    const json = JSON.stringify({
      datasetVersion: "dataset-1",
      tags: ["overview"],
      timestamp: new Date().toISOString(),
    });
    const raw = json + " ".repeat(16384 - Buffer.byteLength(json));
    const encoded = new TextEncoder().encode(raw);
    const stream = streamRequest([encoded.slice(0, 11), encoded.slice(11)], {
      [REVALIDATION_SIGNATURE_HEADER]: createRevalidationSignature(SECRET, raw),
    });
    expect((await POST(stream.request)).status).toBe(200);
    expect(stream.cancel).not.toHaveBeenCalled();
  });

  it("handles BOM and multi-byte characters split between chunks like Request.text", async () => {
    const raw =
      JSON.stringify({
        datasetVersion: "dataset-1",
        tags: ["overview"],
        timestamp: new Date().toISOString(),
      }) + "\u00a0";
    const bytes = new TextEncoder().encode("\ufeff" + raw);
    const stream = streamRequest(
      [bytes.slice(0, 1), bytes.slice(1, -1), bytes.slice(-1)],
      {
        [REVALIDATION_SIGNATURE_HEADER]: createRevalidationSignature(
          SECRET,
          raw,
        ),
      },
    );
    // JSON does not accept NBSP: correct decoding/signature reaches the 400 parser response.
    expect((await POST(stream.request)).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("returns a bounded client error when the incoming stream fails", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.error(new Error("private upstream failure"));
      },
    });
    const request = new Request("http://localhost/api/internal/revalidate", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_payload" });
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
