import { describe, expect, it } from "vitest";

import type { NormalizedOffer } from "@/domain/offers/normalized-offer";

import {
  classifyRemoteMode,
  classifySalaryTransparency,
  detectTechnologies,
} from "./enrichers";

function offer(
  values: Partial<
    Pick<NormalizedOffer, "title" | "descriptionText" | "salary">
  > = {},
): NormalizedOffer {
  return {
    source: "france-travail",
    externalId: "fixture",
    title: "Développeur logiciel",
    descriptionText: "",
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
    structuredExperience: { required: null, label: null },
    salary: null,
    applicationUrl: null,
    sourceUrl: null,
    rawPayload: null,
    ...values,
  };
}

describe("deterministic classification enrichers", () => {
  it("uses longest technology matches and preserves source evidence", () => {
    const input = offer({
      title: "Développeur React Native",
      descriptionText: "Stack TypeScript, Next.js et PostgreSQL.",
    });

    const result = detectTechnologies(input);

    expect(result.technologySlugs).toEqual([
      "nextjs",
      "postgresql",
      "react-native",
      "typescript",
    ]);
    expect(result.technologySlugs).not.toContain("react");
    for (const evidence of result.evidence) {
      const source =
        evidence.field === "title" ? input.title : input.descriptionText;
      expect(source.slice(evidence.start, evidence.end)).toBe(evidence.excerpt);
    }
  });

  it("requires technical context for ambiguous short aliases", () => {
    expect(
      detectTechnologies(
        offer({ descriptionText: "Vous allez go rejoindre nos équipes." }),
      ).technologySlugs,
    ).not.toContain("go");
    expect(
      detectTechnologies(
        offer({
          descriptionText:
            "Vous développerez des microservices backend en Go et PostgreSQL.",
        }),
      ).technologySlugs,
    ).toContain("go");
  });

  it("does not count vague salary language as transparency", () => {
    const vague = classifySalaryTransparency(
      offer({
        salary: {
          originalLabel: "Rémunération attractive selon profil",
          minimumOriginal: null,
          maximumOriginal: null,
          period: null,
          currency: null,
          grossOrNet: "unknown",
          normalizedAnnualMinimum: null,
          normalizedAnnualMaximum: null,
          normalizationWarning: null,
        },
      }),
    );
    const explicit = classifySalaryTransparency(
      offer({
        salary: {
          originalLabel: "Annuel de 35 000 à 42 000 euros brut",
          minimumOriginal: 35_000,
          maximumOriginal: 42_000,
          period: "year",
          currency: "EUR",
          grossOrNet: "gross",
          normalizedAnnualMinimum: 35_000,
          normalizedAnnualMaximum: 42_000,
          normalizationWarning: null,
        },
      }),
    );

    expect(vague).toEqual({ salaryTransparent: false, evidence: [] });
    expect(explicit.salaryTransparent).toBe(true);
    expect(explicit.evidence[0]?.excerpt).toContain("35 000");
  });

  it("classifies explicit remote modes without inferring onsite from a place", () => {
    expect(
      classifyRemoteMode(offer({ descriptionText: "Poste basé à Lille." }))
        .remoteMode,
    ).toBe("unknown");
    expect(
      classifyRemoteMode(
        offer({ descriptionText: "Télétravail possible après intégration." }),
      ),
    ).toMatchObject({
      remoteMode: "hybrid",
      warningCode: "REMOTE_FREQUENCY_UNKNOWN",
    });
    expect(
      classifyRemoteMode(
        offer({ title: "Ingénieur backend 100 % télétravail" }),
      ).remoteMode,
    ).toBe("remote");
  });
});
