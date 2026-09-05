import { describe, expect, it, vi } from "vitest";

import {
  createRevalidationSignature,
  hasValidRevalidationSignature,
  isAllowedRevalidationTag,
  isFreshRevalidationTimestamp,
  requestRevalidation,
  RevalidationRequestError,
} from "./request-revalidation";

const SECRET = "a".repeat(64);

describe("request revalidation", () => {
  it("signs the exact body and rejects a modified payload", () => {
    const rawBody = '{"datasetVersion":"dataset-1"}';
    const signature = createRevalidationSignature(SECRET, rawBody);

    expect(
      hasValidRevalidationSignature({
        secret: SECRET,
        rawBody,
        providedSignature: signature,
      }),
    ).toBe(true);
    expect(
      hasValidRevalidationSignature({
        secret: SECRET,
        rawBody: `${rawBody} `,
        providedSignature: signature,
      }),
    ).toBe(false);
  });

  it("only accepts documented cache tags", () => {
    expect(isAllowedRevalidationTag("overview")).toBe(true);
    expect(isAllowedRevalidationTag("tech:typescript")).toBe(true);
    expect(isAllowedRevalidationTag("../../../admin")).toBe(false);
    expect(isAllowedRevalidationTag("unknown:tag")).toBe(false);
  });

  it("rejects timestamps outside the anti-replay window", () => {
    const now = new Date("2026-09-04T09:00:00.000Z");

    expect(isFreshRevalidationTimestamp(now.toISOString(), now)).toBe(true);
    expect(isFreshRevalidationTimestamp("2026-09-04T08:54:59.999Z", now)).toBe(
      false,
    );
  });

  it("posts a signed, bounded payload without exposing the secret", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ revalidated: true, tagCount: 3 }));

    await expect(
      requestRevalidation({
        url: "https://app.example/api/internal/revalidate",
        secret: SECRET,
        datasetVersion: "dataset-1",
        tags: ["overview", "offers", "data-status"],
        now: new Date("2026-09-04T09:00:00.000Z"),
        fetcher,
      }),
    ).resolves.toEqual({ revalidated: true, tagCount: 3 });

    const [, init] = fetcher.mock.calls[0] ?? [];
    expect(init?.headers).toMatchObject({ "content-type": "application/json" });
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain(SECRET);
  });

  it("returns a typed error without copying an external response body", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("sensitive upstream detail", { status: 401 }),
      );

    const promise = requestRevalidation({
      url: "https://app.example/api/internal/revalidate",
      secret: SECRET,
      datasetVersion: "dataset-1",
      tags: ["overview"],
      fetcher,
    });

    await expect(promise).rejects.toBeInstanceOf(RevalidationRequestError);
    await expect(promise).rejects.not.toThrow("sensitive upstream detail");
  });
});
