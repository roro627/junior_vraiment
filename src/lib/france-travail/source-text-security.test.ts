// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  externalContentToPlainText,
  normalizeFranceTravailOffer,
} from "./normalize";
import { franceTravailOfferSchema, validateSourceSearchPage } from "./schemas";
import { hasStorageCompatibleText } from "./storage-text";

const validOffer = {
  id: "synthetic-security",
  intitule: "Développeur junior",
  description: "2 ans d'expérience requis",
};

describe("source text storage boundary", () => {
  it.each(["\u0000", "\ud800", "\udfff"])(
    "quarantines unsafe text %j in every retained representation",
    (unsafe) => {
      const variants = [
        { ...validOffer, id: "id" + unsafe },
        { ...validOffer, description: "text" + unsafe },
        { ...validOffer, entreprise: { nom: "company" + unsafe } },
        { ...validOffer, contact: { arbitrary: [{ nested: unsafe }] } },
        { ...validOffer, arbitrary: [{ [unsafe]: "value" }] },
        { ...validOffer, [unsafe]: "value" },
      ];
      const result = validateSourceSearchPage({
        resultats: [...variants, validOffer],
      });
      expect(result.offers).toEqual([validOffer]);
      expect(result.quarantined).toHaveLength(variants.length);
      expect(result.quarantined.map((item) => item.index)).toEqual([
        0, 1, 2, 3, 4, 5,
      ]);
      expect(hasStorageCompatibleText(result.quarantined)).toBe(true);
      variants.forEach((offer) =>
        expect(franceTravailOfferSchema.safeParse(offer).success).toBe(false),
      );
    },
  );

  it("keeps valid Unicode and unknown fields without modifying the source", () => {
    const offer = {
      ...validOffer,
      description: "Débutant accepté 🧑‍💻",
      extra: { "🚀": ["𐀀", "\\u0000"] },
    };
    const result = validateSourceSearchPage({ resultats: [offer] });
    expect(result.offers).toEqual([offer]);
    expect(result.quarantined).toEqual([]);
    expect(normalizeFranceTravailOffer(result.offers[0]!).rawPayload).toEqual(
      offer,
    );
  });

  it("keeps diagnostic field names safe for JSONB too", () => {
    const result = validateSourceSearchPage({
      resultats: [validOffer],
      ["bad\u0000field"]: true,
    });
    expect(result.warnings[0]?.field).toBe("[invalid-field-name]");
    expect(hasStorageCompatibleText(result.warnings)).toBe(true);
  });

  it.each([
    "&#1114112;",
    "&#x110000;",
    "&#X110000;",
    "&#0;",
    "&#x0;",
    "&#55296;",
    "&#xDFFF;",
    "&#" + "9".repeat(400) + ";",
  ])(
    "preserves invalid numeric entity %s without throwing or creating invalid storage text",
    (entity) => {
      expect(externalContentToPlainText(entity)).toBe(entity);
      const offer = normalizeFranceTravailOffer(
        franceTravailOfferSchema.parse({
          ...validOffer,
          intitule: entity,
          description: entity,
        }),
      );
      expect(offer.title).toBe(entity);
      expect(offer.descriptionText).toBe(entity);
      expect(hasStorageCompatibleText(offer)).toBe(true);
    },
  );

  it.each([
    ["&#65;", "A"],
    ["&#x1F600;", "😀"],
    ["&#X1F600;", "😀"],
    ["&#1114111;", "\u{10ffff}"],
    ["&amp;", "&"],
  ])("preserves legitimate entity decoding %s", (entity, expected) => {
    expect(externalContentToPlainText(entity)).toBe(expected);
  });
});
