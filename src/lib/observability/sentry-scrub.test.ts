import { describe, expect, it } from "vitest";

import { redactTelemetryText, scrubSentryEvent } from "./sentry-scrub";

describe("Sentry redaction", () => {
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
