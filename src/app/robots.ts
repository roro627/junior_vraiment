import type { MetadataRoute } from "next";

import { isPublicIndexingEnabled } from "@/lib/env";
import { resolveSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  if (!isPublicIndexingEnabled()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  const siteUrl = resolveSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
    host: siteUrl,
  };
}
