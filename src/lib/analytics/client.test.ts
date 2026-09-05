import type { CaptureResult } from "posthog-js";
import { describe, expect, it } from "vitest";

import { sanitizeAnalyticsCapture } from "./client";

describe("sanitizeAnalyticsCapture", () => {
  it("drops unknown events", () => {
    expect(
      sanitizeAnalyticsCapture({
        uuid: "event-id",
        event: "$autocapture",
        properties: {},
      }),
    ).toBeNull();
  });

  it("removes URLs and free text from allowed events", () => {
    const capture: CaptureResult = {
      uuid: "event-id",
      event: "insight_shared",
      properties: {
        token: "public-key",
        distinct_id: "anonymous-id",
        insight_slug: "junior-et-deux-ans-france-2026-09-04",
        share_method: "copy_link",
        $current_url: "https://example.test/private?search=secret",
        offer_description: "contenu interdit",
      },
    };

    expect(sanitizeAnalyticsCapture(capture)?.properties).toEqual({
      token: "public-key",
      distinct_id: "anonymous-id",
      insight_slug: "junior-et-deux-ans-france-2026-09-04",
      share_method: "copy_link",
    });
  });
});
