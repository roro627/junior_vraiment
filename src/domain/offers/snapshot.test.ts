import { describe, expect, it } from "vitest";

import type { NormalizedOffer } from "./normalized-offer";
import { createOfferContentHash } from "./snapshot";

const offer: NormalizedOffer = {
  source: "france-travail",
  externalId: "fixture-1",
  title: "Développeuse junior",
  descriptionText: "Débutante acceptée.",
  companyName: "Exemple",
  publishedAt: new Date("2026-09-01T08:00:00Z"),
  updatedAt: new Date("2026-09-01T09:00:00Z"),
  location: {
    label: "Paris",
    communeCode: "75056",
    departmentCode: "75",
    regionCode: "11",
    latitude: 48.8566,
    longitude: 2.3522,
  },
  contract: { sourceCode: "CDI", normalized: "cdi", label: "CDI" },
  structuredExperience: { required: false, label: "Débutant accepté" },
  salary: null,
  applicationUrl: "https://example.invalid/apply",
  sourceUrl: "https://example.invalid/offer",
  rawPayload: { volatileField: "first" },
};

describe("createOfferContentHash", () => {
  it("is stable when only source metadata and raw payload change", () => {
    const changedMetadata = {
      ...offer,
      updatedAt: new Date("2026-09-02T09:00:00Z"),
      rawPayload: { volatileField: "second" },
    };

    expect(createOfferContentHash(changedMetadata)).toBe(
      createOfferContentHash(offer),
    );
  });

  it("changes when a relevant normalized field changes", () => {
    expect(
      createOfferContentHash({
        ...offer,
        descriptionText: "Deux ans d’expérience sont exigés.",
      }),
    ).not.toBe(createOfferContentHash(offer));
  });
});
