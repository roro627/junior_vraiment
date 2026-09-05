import { describe, expect, it } from "vitest";

import observedFixture from "@/tests/fixtures/france-travail/search-page.observed-redacted.json" with { type: "json" };

import {
  externalContentToPlainText,
  normalizeFranceTravailOffer,
} from "./normalize";
import { franceTravailOfferSchema } from "./schemas";

describe("France Travail normalization", () => {
  it("maps the observed contract without leaking provider names into the domain", () => {
    const sourceOffer = franceTravailOfferSchema.parse(
      observedFixture.resultats[0],
    );
    const normalized = normalizeFranceTravailOffer(sourceOffer);

    expect(normalized.source).toBe("france-travail");
    expect(normalized.contract.normalized).toBe("cdi");
    expect(normalized.structuredExperience.required).toBe(false);
    expect(normalized.location.departmentCode).toBeNull();
  });

  it("lets the explicit alternance flag override a CDD source code", () => {
    const sourceOffer = franceTravailOfferSchema.parse({
      id: "test-alternance",
      intitule: "Titre",
      description: "Description",
      typeContrat: "CDD",
      alternance: true,
    });

    expect(normalizeFranceTravailOffer(sourceOffer).contract.normalized).toBe(
      "alternance",
    );
  });

  it("never turns a desired experience into a requirement", () => {
    const sourceOffer = franceTravailOfferSchema.parse({
      id: "test-souhaitee",
      intitule: "Titre",
      description: "Description",
      experienceExige: "S",
      experienceLibelle: "Expérience souhaitée",
    });

    expect(
      normalizeFranceTravailOffer(sourceOffer).structuredExperience.required,
    ).toBe(false);
  });

  it("converts external markup to plain text before the UI boundary", () => {
    expect(
      externalContentToPlainText(
        "<p>Junior &amp; accessible</p><script>x</script>",
      ),
    ).toBe("Junior & accessible");
  });
});
