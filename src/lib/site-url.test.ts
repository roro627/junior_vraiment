import { describe, expect, it } from "vitest";

import { resolveSiteUrl } from "./site-url";

describe("resolveSiteUrl", () => {
  it("prefers the explicit public URL", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "https://observatoire.example/",
        VERCEL_PROJECT_PRODUCTION_URL: "deployment.vercel.app",
      }),
    ).toBe("https://observatoire.example");
  });

  it("uses Vercel's real production domain without inventing one", () => {
    expect(
      resolveSiteUrl({
        VERCEL_PROJECT_PRODUCTION_URL: "junior-vraiment.vercel.app",
      }),
    ).toBe("https://junior-vraiment.vercel.app");
  });

  it("uses localhost only outside a configured deployment", () => {
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
  });
});
