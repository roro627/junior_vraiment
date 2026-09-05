import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "./security-headers";

describe("security headers", () => {
  it("builds a restrictive production policy compatible with static rendering", () => {
    const policy = buildContentSecurityPolicy({
      allowDevelopmentEvaluator: false,
      upgradeInsecureRequests: true,
    });

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain(" *");
  });

  it("allows the evaluator only for the Next.js development overlay", () => {
    const policy = buildContentSecurityPolicy({
      allowDevelopmentEvaluator: true,
      upgradeInsecureRequests: false,
    });

    expect(policy).toContain("'unsafe-eval'");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  it("sets every required defense-in-depth header", () => {
    const headers = new Map(
      buildSecurityHeaders({
        allowDevelopmentEvaluator: false,
        upgradeInsecureRequests: true,
      }).map(({ key, value }) => [key, value]),
    );

    expect(headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
  });

  it("keeps local production audits on HTTP without upgrading asset requests", () => {
    const policy = buildContentSecurityPolicy({
      allowDevelopmentEvaluator: false,
      upgradeInsecureRequests: false,
    });

    expect(policy).not.toContain("upgrade-insecure-requests");
    expect(policy).not.toContain("'unsafe-eval'");
  });
});
