import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const insightSlugs = [
  "junior-et-deux-ans-france-2026-09-04",
  "debutants-explicitement-acceptes-france-2026-09-04",
  "transparence-salariale-france-2026-09-04",
] as const;

test("three real insight snapshots are published and verifiable", async ({
  page,
}) => {
  await page.goto("/insights");
  await expect(page.locator(".insight-card")).toHaveCount(3);

  for (const slug of insightSlugs) {
    await page.goto(`/insights/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".insight-hero__metric strong")).toContainText(
      "%",
    );
    await expect(
      page.getByText("Population observée", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Voir les offres actuelles correspondant au critère",
      }),
    ).toHaveAttribute("href", /\/explorer\?/u);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`/insights/${slug}$`, "u"),
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
  }
});

test("the generated social card is a real 1200 by 630 PNG", async ({
  page,
  request,
}) => {
  await page.goto(`/insights/${insightSlugs[0]}`);
  const imageUrl = await page
    .locator('meta[property="og:image"]')
    .getAttribute("content");
  expect(imageUrl).toBeTruthy();
  const image = new URL(imageUrl!);
  const sameOriginImageUrl = `${image.pathname}${image.search}`;

  const response = await request.get(sameOriginImageUrl);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  const dimensions = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  }, sameOriginImageUrl);
  expect(dimensions).toEqual({ width: 1200, height: 630 });
});

test("unknown insights return a real 404", async ({ page }) => {
  const response = await page.goto("/insights/inexistant");
  expect(response?.status()).toBe(404);
});

test("@a11y insight index and detail have no serious automated violations", async ({
  page,
}) => {
  for (const path of ["/insights", `/insights/${insightSlugs[0]}`]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const blockingViolations = results.violations.filter(
      ({ impact }) => impact === "critical" || impact === "serious",
    );
    expect(blockingViolations, path).toEqual([]);
  }
});
