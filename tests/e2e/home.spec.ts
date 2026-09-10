import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { z } from "zod";

test("a real zero explains its exclusions and remains keyboard readable", async ({
  page,
  request,
}) => {
  const response = await request.get("/api/v1/overview");
  expect(response.ok()).toBe(true);
  const overview = z
    .object({
      data: z.object({
        headline: z.object({
          value: z.number().nullable(),
          numerator: z.number().int().nonnegative(),
          denominator: z.number().int().nonnegative(),
        }),
      }),
    })
    .parse(await response.json());
  await page.goto("/");
  await expect(page.locator(".pilot-headline__fraction")).toContainText(
    new Intl.NumberFormat("fr-FR").format(overview.data.headline.denominator),
  );
  const explanation = page.getByRole("complementary", {
    name: "Comprendre ce zéro",
  });
  if (
    overview.data.headline.value === 0 &&
    overview.data.headline.numerator === 0
  ) {
    await expect(explanation).toBeVisible();
    const toggle = explanation.locator("summary");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(
      explanation.getByText(/Ce zéro concerne uniquement/u),
    ).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        ({ impact }) => impact === "critical" || impact === "serious",
      ),
    ).toEqual([]);
  } else {
    await expect(explanation).toHaveCount(0);
  }
});

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
      name: "Le marché tech junior, sans les idées reçues.",
    }),
  ).toBeVisible();
  await expect(page.locator(".pilot-headline__value")).toContainText("%");
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
      name: "Le marché tech junior, sans les idées reçues.",
    }),
  ).toBeVisible();
  const mobileFilters = page.locator(".filter-form--mobile > summary");
  if (isMobile) {
    // The heading can arrive before the streamed filter form.
    await expect(mobileFilters).toBeVisible();
    await mobileFilters.click();
  } else {
    await page.locator(".pilot-filter-more > summary").click();
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
  const animatedSurfaces = page.locator(
    ".pilot-introduction, .pilot-headline, .pilot-distribution__track > span",
  );
  await expect
    .poll(() =>
      animatedSurfaces.evaluateAll((elements) =>
        elements.every(
          (element) => getComputedStyle(element).animationName === "none",
        ),
      ),
    )
    .toBe(true);
});

test("the pilot remains readable at 320px with a keyboard-operable menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await expect(page.locator("section.pilot-headline")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  const menu = page.locator(".pilot-mobile-nav > summary");
  await menu.focus();
  await menu.press("Enter");
  await expect(
    page.getByRole("navigation", { name: "Navigation mobile" }),
  ).toBeVisible();
  await menu.press("Enter");
  await expect(
    page.getByRole("navigation", { name: "Navigation mobile" }),
  ).toBeHidden();
  await expect(page.locator(".freshness-badge__date")).toBeVisible();
  await page.locator(".filter-form--mobile > summary").click();
  await expect(page.locator('select[name="job"]:visible')).toBeVisible();
  await expect
    .poll(() =>
      page.locator(".filter-form--mobile").evaluate((form) => {
        const bounds = form.getBoundingClientRect();
        return [...form.querySelectorAll("select, button")].every((control) => {
          const rect = control.getBoundingClientRect();
          return rect.left >= bounds.left && rect.right <= bounds.right;
        });
      }),
    )
    .toBe(true);
});

test("home filters submit a shareable scope and preserve the trend source", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  if (isMobile) await page.locator(".filter-form--mobile > summary").click();
  await page.locator('select[name="job"]:visible').selectOption("frontend");
  if (!isMobile) await page.locator(".pilot-filter-more > summary").click();
  await page.locator('select[name="period"]:visible').selectOption("current");
  await page.getByRole("button", { name: "Appliquer", exact: true }).click();
  await expect(page).toHaveURL(/job=frontend/u);
  await expect(page).toHaveURL(/period=current/u);
  await expect(page.locator(".pilot-scope")).toContainText(
    "Développement frontend",
  );
  const source = page.locator(".pilot-trend > header a");
  await expect(source).toHaveAttribute("href", /job=frontend/u);
  await expect(source).toHaveAttribute("href", /period=current/u);
  if (isMobile) await page.locator(".filter-form--mobile > summary").click();
  await expect(page.locator('select[name="job"]:visible')).toHaveValue(
    "frontend",
  );
});

test("contract details are keyboard accessible and keep their text values", async ({
  page,
}) => {
  await page.goto("/");
  const toggle = page.locator(".pilot-contracts > summary");
  // A streamed fragment can exist in a hidden staging container before being shown.
  await expect(toggle).toBeVisible();
  await toggle.focus();
  await toggle.press("Enter");
  await expect(
    page.locator(".pilot-contracts .pilot-distribution"),
  ).toBeVisible();
  await expect(
    page.locator(".pilot-contracts .pilot-distribution__label").first(),
  ).toContainText(/\d/u);
  const result = await new AxeBuilder({ page })
    .include(".pilot-history")
    .analyze();
  expect(
    result.violations.filter(
      ({ impact }) => impact === "critical" || impact === "serious",
    ),
  ).toEqual([]);
  await toggle.press("Enter");
  await expect(
    page.locator(".pilot-contracts .pilot-distribution"),
  ).toBeHidden();
});

test("period shortcuts preserve scope and browser history", async ({
  page,
  isMobile,
}) => {
  await page.goto("/?job=frontend&period=current");
  const periods = page.getByRole("navigation", {
    name: "Période d’observation",
  });
  await expect(
    periods.getByRole("link", { name: "Jeu actuel" }),
  ).toHaveAttribute("aria-current", "true");
  await periods.getByRole("link", { name: "90 jours" }).click();
  await expect(page).toHaveURL(/job=frontend.*period=90d/u);
  await expect(periods.getByRole("link", { name: "90 jours" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.locator(".pilot-scope")).toContainText("90 derniers jours");
  await page
    .locator(
      isMobile
        ? ".filter-form--mobile > summary"
        : ".pilot-filter-more > summary",
    )
    .click();
  await expect(page.locator('select[name="period"]:visible')).toHaveValue(
    "90d",
  );
  await expect(page.locator('select[name="job"]:visible')).toHaveValue(
    "frontend",
  );
  await page.goBack();
  await expect(page).toHaveURL(/period=current/u);
  await expect(
    periods.getByRole("link", { name: "Jeu actuel" }),
  ).toHaveAttribute("aria-current", "true");
});

test("orange pilot has no horizontal overflow at its design breakpoints", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Desktop viewport matrix runs once.",
  );
  for (const width of [320, 375, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto("/");
    await expect(page.locator("section.pilot-headline")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
    if (width === 1440 || width === 375) {
      await page.screenshot({
        path: `.local/orange-pilot-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      await page.screenshot({
        path: `.local/orange-pilot-${width}-viewport.png`,
        fullPage: false,
        animations: "disabled",
      });
    }
  }
});

test("opening the native menu before hydration preserves the user's action", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 844 });
  let releaseScripts = () => {};
  const scriptsReady = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  await page.route("**/_next/static/**/*.js", async (route) => {
    await scriptsReady;
    await route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    const menu = page.locator(".pilot-mobile-nav > summary");
    await expect(menu).toBeVisible();
    await menu.focus();
    await menu.press("Enter");
    await expect(
      page.getByRole("navigation", { name: "Navigation mobile" }),
    ).toBeVisible();
  } finally {
    releaseScripts();
  }
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("navigation", { name: "Navigation mobile" }),
  ).toBeVisible();
  await page.locator(".pilot-mobile-nav > summary").press("Enter");
  await expect(
    page.getByRole("navigation", { name: "Navigation mobile" }),
  ).toBeHidden();
});
