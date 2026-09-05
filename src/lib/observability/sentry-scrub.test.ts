import { describe, expect, it } from "vitest";

import { redactTelemetryText, scrubSentryEvent } from "./sentry-scrub";

describe("Sentry redaction", () => {
  it("preserves valid technical trace identifiers without context payloads", () => {
    const traceId = "1234567890abcdef1234567890abcdef";
    const spanId = "1234567890abcdef";
    const event = scrubSentryEvent({
      contexts: {
        trace: {
          trace_id: traceId,
          span_id: spanId,
          data: { "db.statement": "private source content" },
        },
        browser: { name: "private context" },
      },
    });
    expect(event.contexts).toEqual({
      trace: { trace_id: traceId, span_id: spanId },
    });
    expect(
      scrubSentryEvent({
        contexts: { trace: { trace_id: "private value", span_id: spanId } },
      }),
    ).not.toHaveProperty("contexts");
  });

  it("removes invalid URLs, span payloads and local exception variables", () => {
    const event = scrubSentryEvent({
      request: { url: "not-a-url?secret=fixture" },
      spans: [
        {
          span_id: "1234567890abcdef",
          trace_id: "1234567890abcdef1234567890abcdef",
          start_timestamp: 1,
          timestamp: 2,
          op: "db.query",
          description: "select 'source content'",
          data: { "db.statement": "private source content" },
        },
      ],
      exception: {
        values: [
          {
            stacktrace: {
              frames: [
                { vars: { secret: "fixture" }, filename: "app.js", lineno: 3 },
              ],
            },
          },
        ],
      },
    });

    expect(event.request).toEqual({});
    expect(event.spans?.[0]).not.toHaveProperty("description");
    expect(event.spans?.[0]?.data).toEqual({});
    expect(event.exception?.values?.[0]?.stacktrace?.frames?.[0]).toEqual({
      filename: "app.js",
      lineno: 3,
    });
  });

  it("redacts credentials and contact details before transmission", () => {
    const redacted = redactTelemetryText(
      "postgresql://user:secret@db.example/app Bearer abc.def contact@example.com 06 12 34 56 78",
    );

    expect(redacted).not.toContain("secret");
    expect(redacted).not.toContain("abc.def");
    expect(redacted).not.toContain("contact@example.com");
    expect(redacted).not.toContain("06 12 34 56 78");
  });

  it("drops request payloads, query strings, identity and breadcrumbs", () => {
    const event = scrubSentryEvent({
      user: { ip_address: "127.0.0.1" },
      extra: { description: "offre complète" },
      breadcrumbs: [{ message: "texte libre" }],
      request: {
        method: "GET",
        url: "https://example.test/explorer?company=secret",
        headers: { authorization: "Bearer secret" },
        data: "offre complète",
      },
    });

    expect(event).toEqual({
      request: { method: "GET", url: "https://example.test/explorer" },
    });
  });
});
