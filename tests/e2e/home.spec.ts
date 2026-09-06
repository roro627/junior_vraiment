import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { z } from "zod";

test("the home page publishes the verified current dataset", async ({
  page,
  request,
}) => {
  const statusResponse = await request.get("/api/v1/data-status");
  const overviewResponse = await request.get("/api/v1/overview");
  expect(statusResponse.ok()).toBe(true);
  expect(overviewResponse.ok()).toBe(true);
  const status = z
    .object({
      data: z.object({
        status: z.enum(["operational", "degraded", "unavailable"]),
        freshness: z.enum(["fresh", "delayed", "stale", "unavailable"]),
      }),
    })
    .parse(await statusResponse.json());
  const overview = z
    .object({ meta: z.object({ quality: z.string() }) })
    .parse(await overviewResponse.json());
  const expectedFreshness =
    overview.meta.quality === "partial"
      ? "partial"
      : status.data.status !== "operational" ||
          status.data.freshness === "unavailable"
        ? "incident"
        : status.data.freshness;
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Le vrai état du marché tech junior en France.",
    }),
  ).toBeVisible();
  await expect(page.locator(".kpi-hero__value")).toContainText("%");
  await expect(page.getByText(/offres se présentant comme/u)).toBeVisible();
  await expect(
    page.locator(`.freshness-badge[data-freshness="${expectedFreshness}"]`),
  ).toBeVisible();
});

test("filters are represented by the URL and restored on render", async ({
  page,
  isMobile,
}) => {
  await page.goto("/?job=frontend&period=current");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Le vrai état du marché tech junior en France.",
    }),
  ).toBeVisible();
  const mobileFilters = page.locator(".filter-form--mobile > summary");
  if (isMobile) {
    // The heading can arrive before the streamed filter form.
    await expect(mobileFilters).toBeVisible();
    await mobileFilters.click();
  }

  await expect(page.locator('select[name="job"]:visible')).toHaveValue(
    "frontend",
  );
  await expect(page.locator('select[name="period"]:visible')).toHaveValue(
    "current",
  );
});

test("@a11y the home page has no serious automated violations", async ({
  page,
}) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page }).analyze();
  const blockingViolations = results.violations.filter(
    ({ impact }) => impact === "critical" || impact === "serious",
  );

  expect(blockingViolations).toEqual([]);
});

test("reduced motion removes interface transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const target = page.locator(
    '.filter-form--mobile > summary:visible, .filter-form--desktop button[type="submit"]:visible',
  );

  await expect(target).toBeVisible();
  await expect
    .poll(() =>
      target.evaluate((element) =>
        getComputedStyle(element)
          .transitionDuration.split(",")
          .every((duration) => {
            const value = Number.parseFloat(duration);
            return duration.trim().endsWith("ms") ? value <= 1 : value <= 0.001;
          }),
      ),
    )
    .toBe(true);
});
