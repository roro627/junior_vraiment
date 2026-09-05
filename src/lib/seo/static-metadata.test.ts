import { describe, expect, it } from "vitest";

import { buildStaticPageMetadata } from "./static-metadata";

describe("buildStaticPageMetadata", () => {
  it("keeps canonical and social copy aligned", () => {
    const metadata = buildStaticPageMetadata({
      canonical: "/methodologie",
      description: "Description publique",
      title: "Méthodologie — Junior, vraiment ?",
    });

    expect(metadata.alternates).toEqual({ canonical: "/methodologie" });
    expect(metadata.openGraph).toMatchObject({
      title: "Méthodologie — Junior, vraiment ?",
      description: "Description publique",
      url: "/methodologie",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary" });
    expect(metadata.robots).toBeUndefined();
  });

  it("marks combinatorial pages as non-indexable while keeping their links crawlable", () => {
    const metadata = buildStaticPageMetadata({
      canonical: "/explorer",
      description: "Explorer",
      index: false,
      title: "Explorer",
    });

    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
