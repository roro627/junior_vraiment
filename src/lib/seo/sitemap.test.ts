import { describe, expect, it } from "vitest";

import { buildPublicSitemap } from "./sitemap";

const insight = {
  slug: "un-constat-2026-09-04",
  correctedAt: null,
  updatedAt: "2026-09-04T12:00:00.000Z",
};

describe("buildPublicSitemap", () => {
  it("emits no public URL outside production", () => {
    expect(
      buildPublicSitemap({
        insights: [insight],
        publicIndexingEnabled: false,
        siteUrl: "https://preview.example",
      }),
    ).toEqual([]);
  });

  it("includes durable pages and real published insights", () => {
    const sitemap = buildPublicSitemap({
      insights: [insight],
      publicIndexingEnabled: true,
      siteUrl: "https://observatoire.example",
    });

    expect(sitemap.map(({ url }) => url)).toContain(
      "https://observatoire.example/insights/un-constat-2026-09-04",
    );
    expect(sitemap.map(({ url }) => url)).not.toContain(
      "https://observatoire.example/explorer",
    );
    expect(sitemap.at(-1)).toMatchObject({
      lastModified: insight.updatedAt,
      images: [
        "https://observatoire.example/insights/un-constat-2026-09-04/opengraph-image",
      ],
    });
  });
});
