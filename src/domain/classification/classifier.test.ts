import { describe, expect, it } from "vitest";

import draftGoldSet from "@/tests/fixtures/classifier/gold-v1.draft.json";
import noExperienceFixtures from "@/tests/fixtures/classifier/no-experience.json";

import type { NormalizedOffer } from "../offers/normalized-offer";
import { classifyOffer } from "./classifier";
import {
  normalizeTextForMatching,
  sourceRangeForNormalizedMatch,
} from "./normalize-text";

type ClassifierFixture = {
  fixtureId: string;
  title: string;
  description: string;
  experienceRequired: boolean | null;
  experienceLabel: string | null;
};

function fixtureOffer(fixture: ClassifierFixture): NormalizedOffer {
  return {
    source: "france-travail",
    externalId: fixture.fixtureId,
    title: fixture.title,
    descriptionText: fixture.description,
    companyName: null,
    publishedAt: null,
    updatedAt: null,
    location: {
      label: null,
      communeCode: null,
      departmentCode: null,
      regionCode: null,
      latitude: null,
      longitude: null,
    },
    contract: { sourceCode: null, normalized: "unknown", label: null },
    structuredExperience: {
      required: fixture.experienceRequired,
      label: fixture.experienceLabel,
    },
    salary: null,
    applicationUrl: null,
    sourceUrl: null,
    rawPayload: null,
  };
}

describe("classifyOffer draft gold set", () => {
  it.each(draftGoldSet)("matches $fixtureId", (fixture) => {
    const result = classifyOffer(fixtureOffer(fixture));

    expect(result).toMatchObject(fixture.expected);
    if (
      result.claimsJunior !== null ||
      result.minimumExperienceMonths !== null
    ) {
      expect(result.evidence.length).toBeGreaterThan(0);
    }
  });

  it("keeps evidence offsets tied to the source text", () => {
    const fixture = draftGoldSet[0];
    if (!fixture) {
      throw new Error("Le jeu de validation est vide.");
    }
    const result = classifyOffer(fixtureOffer(fixture));

    for (const evidence of result.evidence) {
      const source =
        evidence.field === "title"
          ? fixture.title
          : evidence.field === "description"
            ? fixture.description
            : (fixture.experienceLabel ?? "");
      expect(source.slice(evidence.start, evidence.end)).toBe(evidence.excerpt);
    }
  });
});

describe("classifyOffer no-experience threshold", () => {
  it.each(noExperienceFixtures)(
    "does not create a false positive for $fixtureId",
    (fixture) => {
      const result = classifyOffer(fixtureOffer(fixture));

      expect(result).toMatchObject(fixture.expected);
      expect(result.status).toBe("classified");
      expect(result.minimumExperienceMonths).toBe(0);
      expect(result.beginnerFriendly).toBe(true);
      expect(result.contradictoryJunior).toBe(false);
      expect(result.evidence.length).toBeGreaterThan(0);
      for (const evidence of result.evidence) {
        expect(evidence.excerpt.trim()).not.toBe("");
      }
    },
  );
});

describe("normalizeTextForMatching", () => {
  it("normalizes apostrophes and whitespace while preserving a source range", () => {
    const source = "  L’EXPÉRIENCE\n  junior  ";
    const normalized = normalizeTextForMatching(source);
    const start = normalized.value.indexOf("expérience");
    const range = sourceRangeForNormalizedMatch(
      normalized,
      start,
      start + "expérience".length,
    );

    expect(normalized.value).toBe(" l'expérience junior ");
    expect(source.slice(range.start, range.end)).toBe("EXPÉRIENCE");
  });
});
