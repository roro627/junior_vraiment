import { expect, test } from "@playwright/test";

test("trust content remains readable at 320px without horizontal page scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 812 });
  for (const path of [
    "/",
    "/explorer",
    "/a-propos",
    "/methodologie",
    "/statut-donnees",
  ]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      )
      .toBeLessThanOrEqual(1);
  }
});

test("privacy information is reachable and the proof can be opened without a mouse", async ({
  page,
}) => {
  await page.goto("/a-propos", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", {
      name: "Pas de profil candidat ni de suivi d’audience activé",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Lire les détails de conservation et de confidentialité",
    }),
  ).toHaveAttribute("href", /\/PRIVACY\.md$/u);
  await page.goto("/explorer", { waitUntil: "domcontentloaded" });
  const trigger = page.getByRole("button", { name: "Voir la preuve" }).first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 2 }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});
