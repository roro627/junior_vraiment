import { expect, test } from "@playwright/test";

test("public pages send the launch security headers", async ({ request }) => {
  const response = await request.get("/");

  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
});

test("API responses are excluded from search indexing", async ({ request }) => {
  const response = await request.get("/api/v1/data-status");

  expect(response.status()).toBe(200);
  expect(response.headers()["x-robots-tag"]).toBe(
    "noindex, nofollow, nosnippet",
  );
});

test("non-production builds block indexing and expose no sitemap URL", async ({
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /");

  const sitemap = await request.get("/sitemap.xml");
  const sitemapBody = await sitemap.text();
  expect(sitemapBody).toContain("<urlset");
  expect(sitemapBody).not.toContain("<url>");
});

test("homepage structured data is valid and Explorer is non-indexable", async ({
  page,
}) => {
  await page.goto("/");
  const website = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ??
      "",
  ) as Record<string, unknown>;
  expect(website["@type"]).toBe("WebSite");

  await page.goto("/explorer");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/u,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/explorer$/u,
  );
});
