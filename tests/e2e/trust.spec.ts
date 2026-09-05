import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const trustPages = [
  ["/methodologie", "Notre méthodologie, en toute transparence"],
  ["/statut-donnees", "État des données"],
  ["/a-propos", "Mesurer les annonces, pas juger les personnes"],
  ["/limites", "Ce que ces chiffres ne disent pas"],
  ["/changelog", "Changelog"],
  ["/signaler", "Signaler une erreur"],
] as const;

test("all trust pages publish useful server-rendered content", async ({
  page,
}) => {
  for (const [path, heading] of trustPages) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
    await expect(page.locator("main")).not.toBeEmpty();
  }
});

test("the data status exposes verified run facts without infrastructure details", async ({
  page,
}) => {
  await page.goto("/statut-donnees");

  await expect(page.getByText("Toutes les données sont à jour")).toBeVisible();
  await expect(page.getByText("Offres reçues", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Taux de validation", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Taux d’ambiguïté", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /DATABASE_URL|neon\.tech|trigger_run_id/u,
  );
});

test("@a11y methodology and data status have no serious automated violations", async ({
  page,
}) => {
  for (const path of ["/methodologie", "/statut-donnees"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    const blockingViolations = results.violations.filter(
      ({ impact }) => impact === "critical" || impact === "serious",
    );
    expect(blockingViolations, path).toEqual([]);
  }
});
