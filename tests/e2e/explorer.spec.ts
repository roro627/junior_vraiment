import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the explorer filters, paginates and restores browser history", async ({
  page,
  isMobile,
}) => {
  await page.goto("/explorer");
  await expect(
    page.getByRole("heading", { level: 1, name: "Explorer les offres" }),
  ).toBeVisible();

  if (isMobile) {
    await expect(page.locator(".offer-card").first()).toBeVisible();
    await expect(page.getByRole("table")).toBeHidden();
    await page.locator(".explorer-filters__mobile > summary").click();
  } else {
    await expect(page.getByRole("table")).toBeVisible();
  }

  await page
    .locator('select[name="classification"]:visible')
    .selectOption("beginner_friendly");
  await page.getByRole("button", { name: "Afficher les résultats" }).click();
  await expect(page).toHaveURL(/classification=beginner_friendly/u);
  await expect(
    isMobile
      ? page.getByText("Filtres · 1", { exact: true })
      : page.getByText("1 actif", { exact: true }),
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/explorer$/u);
  await expect(
    isMobile
      ? page.getByText("Filtres · 0", { exact: true })
      : page.getByText("0 actif", { exact: true }),
  ).toBeVisible();

  const firstOffer = isMobile
    ? page.locator(".offer-card h3").first()
    : page.locator(".offer-table tbody tr td:first-child strong").first();
  const firstTitle = await firstOffer.innerText();
  await page.getByRole("link", { name: "Page suivante" }).click();
  await expect(page).toHaveURL(/cursor=/u);
  await expect(firstOffer).not.toHaveText(firstTitle);
});

test("the evidence panel is keyboard accessible", async ({ page }) => {
  await page.goto("/explorer");
  const visibleTrigger = page
    .getByRole("button", { name: "Voir la preuve" })
    .first();

  await visibleTrigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { level: 2 })).toBeFocused();
  await expect(dialog.getByText(/Classificateur/u)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(visibleTrigger).toBeFocused();
});

test("@a11y the explorer and evidence panel have no serious automated violations", async ({
  page,
}) => {
  // The dialog below is the readiness signal; background resources must not
  // hold up this accessibility check after the document is usable.
  await page.goto("/explorer", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Voir la preuve" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Measure the final colors, not the intentional opening crossfade.
  await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1");
  await expect(page.locator(".evidence-overlay")).toHaveCSS("opacity", "1");

  const results = await new AxeBuilder({ page }).analyze();
  const blockingViolations = results.violations.filter(
    ({ impact }) => impact === "critical" || impact === "serious",
  );

  expect(blockingViolations).toEqual([]);
});

test("the lazy evidence panel reports a chunk failure and can retry", async ({
  page,
}) => {
  // Initial scripts must finish before injecting a lazy-chunk failure; unrelated
  // background requests are not a readiness signal for this interaction.
  await page.goto("/explorer", { waitUntil: "load" });
  await page.route("**/*.js", (route) => route.abort());
  const trigger = page.getByRole("button", { name: "Voir la preuve" }).first();

  await trigger.click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Impossible d’ouvrir les preuves" }),
  ).toBeVisible();
  await expect(trigger).toBeEnabled();
  await page.unroute("**/*.js");
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
