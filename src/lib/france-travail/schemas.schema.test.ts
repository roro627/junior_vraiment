import { describe, expect, it } from "vitest";

import observedFixture from "@/tests/fixtures/france-travail/search-page.observed-redacted.json" with { type: "json" };

import { validateSourceSearchPage } from "./schemas";

describe("France Travail source schema", () => {
  it("accepts the redacted shape observed from the live API", () => {
    const result = validateSourceSearchPage(observedFixture);

    expect(result.status).toBe("valid");
    expect(result.offers).toHaveLength(1);
    expect(result.quarantined).toEqual([]);
  });

  it("reports new fields without rejecting an otherwise valid offer", () => {
    const result = validateSourceSearchPage({
      ...observedFixture,
      resultats: [
        { ...observedFixture.resultats[0], nouveauChamp: "non journalisé" },
      ],
    });

    expect(result.status).toBe("valid_with_warnings");
    expect(result.warnings).toContainEqual({
      path: "resultats.0",
      field: "nouveauChamp",
      observedType: "string",
    });
  });

  it("accepts the optional requirement fields observed in the live contract", () => {
    const result = validateSourceSearchPage({
      resultats: [
        {
          id: "observed-fields",
          intitule: "Développeur",
          description: "Description",
          accessibleTH: true,
          experienceCommentaire: "Information complémentaire",
          complementExercice: "Modalité complémentaire",
          langues: [{ libelle: "Langue", exigence: "Souhaité" }],
          permis: [{ libelle: "Permis", exigence: "Exigé" }],
        },
      ],
    });

    expect(result.status).toBe("valid");
    expect(result.warnings).toEqual([]);
    expect(result.quarantined).toEqual([]);
  });

  it("quarantines an offer missing its source identity", () => {
    const result = validateSourceSearchPage({
      resultats: [{ intitule: "Sans identifiant", description: "Invalide" }],
    });

    expect(result.status).toBe("valid_with_warnings");
    expect(result.offers).toEqual([]);
    expect(result.quarantined).toHaveLength(1);
  });

  it("rejects a response without a result array", () => {
    const result = validateSourceSearchPage({ erreur: "forme inattendue" });

    expect(result.status).toBe("invalid_quarantined");
    expect(result.rootIssues.length).toBeGreaterThan(0);
  });
});
