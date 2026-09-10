import { describe, expect, it } from "vitest";

import draftGoldSet from "@/tests/fixtures/classifier/gold-v1.draft.json";
import noExperienceFixtures from "@/tests/fixtures/classifier/no-experience.json";
import exclusionAudit from "@/tests/fixtures/classifier/exclusion-audit.json";

import type { NormalizedOffer } from "../offers/normalized-offer";
import { classifyOffer } from "./classifier";
import { resolveJuniorObservation } from "./junior-observation";
import { computeJuniorObservationMetric } from "../metrics/junior-observation";
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

describe("observable contradiction v2 candidate", () => {
  it.each(["Jeune diplômé-e", "Jeune diplômée", "Jeune diplômé"])(
    "recognizes accented title endings: %s",
    (title) => {
      const result = classifyOffer(
        fixtureOffer({
          fixtureId: "accented-junior",
          title: `Consultant — ${title}`,
          description: "",
          experienceRequired: true,
          experienceLabel: "0 An(s)",
        }),
      );
      expect(resolveJuniorObservation(result)).toMatchObject({
        claimsJunior: true,
        status: "resolved",
        contradictory: false,
      });
      expect(result.evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "junior_claim",
            ruleId: "JUNIOR_EXPLICIT_TITLE",
          }),
        ]),
      );
    },
  );
  it.each([
    "En tant qu'ingénieur OS Temps Réel & Cybersécurité Expérimenté vous serez amené à intervenir.",
    "Nous recrutons un(e) développeur(se) informatique expérimenté C#.NET.",
    "Encadrer en tant que lead technique l'équipe de développeurs.",
  ])("preserves a conflicting applicant role: %s", (description) => {
    const result = classifyOffer(
      fixtureOffer({
        fixtureId: "applicant-level",
        title: "Développeur",
        description,
        experienceRequired: false,
        experienceLabel: "Débutant accepté",
      }),
    );
    expect(resolveJuniorObservation(result)).toMatchObject({
      claimsJunior: true,
      status: "ambiguous",
      contradictory: null,
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "SENIOR_ROLE_JUNIOR_CONFLICT" }),
      ]),
    );
  });
  it.each([
    "Stage et alternance inclus pour les profils juniors.",
    "Junior ou expérimenté, nous cherchons un esprit innovant.",
    "Experience Level:\nEntry Level",
  ])("captures explicit applicant positioning: %s", (description) => {
    const result = classifyOffer(
      fixtureOffer({
        fixtureId: "positioning-regression",
        title: "Développeur",
        description,
        experienceRequired: true,
        experienceLabel: "3 ans",
      }),
    );
    expect(resolveJuniorObservation(result)).toMatchObject({
      claimsJunior: true,
      status: "resolved",
      contradictory: true,
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "junior_claim",
          ruleId: "JUNIOR_EXPLICIT_BODY",
          field: "description",
        }),
      ]),
    );
  });
  it("does not confuse company longevity with applicant experience", () => {
    const result = classifyOffer(
      fixtureOffer({
        fixtureId: "longevity-regression",
        title: "Développeur",
        description:
          "Plus de 55 ans d'expérience dans le nucléaire et positionné dans le top 3 des plus grandes entreprises d'ingénierie nucléaire.",
        experienceRequired: false,
        experienceLabel: "Débutant accepté",
      }),
    );
    expect(resolveJuniorObservation(result)).toMatchObject({
      status: "resolved",
      contradictory: false,
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "exclusion", excerpt: "55 ans" }),
      ]),
    );
  });
  it("keeps explicit medior/senior positioning unresolved", () => {
    const result = classifyOffer(
      fixtureOffer({
        fixtureId: "senior-body-regression",
        title: "DevOps",
        description: "Profil Medior+ / Sénior (5 ans d'expérience).",
        experienceRequired: false,
        experienceLabel: "Débutant accepté",
      }),
    );
    expect(resolveJuniorObservation(result)).toMatchObject({
      status: "ambiguous",
      contradictory: null,
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "conflict",
          ruleId: "SENIOR_ROLE_JUNIOR_CONFLICT",
          excerpt: "Profil Medior+ / Sénior",
        }),
      ]),
    );
  });
  it("does not infer a junior claim from an inconsistent zero-year requirement", () => {
    const result = classifyOffer(
      fixtureOffer({
        fixtureId: "zero-conflict-regression",
        title: "Développeur",
        description: "Vous avez une expérience de 3-5 ans.",
        experienceRequired: true,
        experienceLabel: "0 An(s)",
      }),
    );
    expect(resolveJuniorObservation(result)).toMatchObject({
      claimsJunior: null,
      contradictory: null,
    });
  });
  const cases = [
    {
      description: "Vous justifiez de 3 ans d'expérience obligatoire.",
      label: "Débutant accepté",
      required: false,
      status: "resolved",
      contradictory: true,
    },
    {
      description: "Vous justifiez de 3 ans d'expérience obligatoire.",
      label: "1 an",
      required: true,
      status: "ambiguous",
      contradictory: null,
    },
    {
      description: "Vous justifiez de 3 ans d'expérience obligatoire.",
      label: "5 ans",
      required: true,
      status: "resolved",
      contradictory: true,
    },
    {
      description: "5 ans d'expérience souhaités.",
      label: null,
      required: null,
      status: "unknown",
      contradictory: null,
    },
    {
      description: "Débutants acceptés. Entreprise fondée il y a 30 ans.",
      label: null,
      required: null,
      status: "resolved",
      contradictory: false,
    },
    {
      description:
        "Débutants acceptés. Pas besoin d'avoir 10 ans d'expérience.",
      label: null,
      required: null,
      status: "resolved",
      contradictory: false,
    },
    {
      description: "Vous justifiez de 1 an d'expérience obligatoire.",
      label: "Débutant accepté",
      required: false,
      status: "resolved",
      contradictory: false,
    },
  ] as const;

  it.each(cases)("resolves $description / $label", (fixture) => {
    const input = fixtureOffer({
      fixtureId: "synthetic-observation-v2",
      title: "Développeur junior",
      description: fixture.description,
      experienceRequired: fixture.required,
      experienceLabel: fixture.label,
    });
    const classification = classifyOffer(input);
    const before = structuredClone(classification);
    const observation = resolveJuniorObservation(classification);
    expect(observation).toMatchObject({
      status: fixture.status,
      contradictory: fixture.contradictory,
    });
    expect(classification).toEqual(before);
    if (classification.status === "ambiguous")
      expect(classification.beginnerFriendly).toBeNull();
    if (observation.contradictory === true) {
      expect(
        observation.evidence.some(({ kind }) => kind === "junior_claim"),
      ).toBe(true);
      expect(
        observation.evidence.some(
          ({ kind, normalizedValue }) =>
            kind === "required_experience" && Number(normalizedValue) >= 24,
        ),
      ).toBe(true);
    }
    for (const proof of observation.evidence) {
      const source =
        proof.field === "title"
          ? input.title
          : proof.field === "experienceLabel"
            ? (input.structuredExperience.label ?? "")
            : input.descriptionText;
      expect(source.slice(proof.start, proof.end)).toBe(proof.excerpt);
    }
    const metric = computeJuniorObservationMetric([observation]);
    expect(metric.populationCount).toBe(
      metric.denominator + metric.unknownCount + metric.ambiguousCount,
    );
    expect(metric.value).toBeNull();
  });

  it("excludes new blocking warnings by default and preserves sample thresholds", () => {
    const classification = classifyOffer(
      fixtureOffer({
        fixtureId: "synthetic-v2",
        title: "Développeur junior",
        description: "3 ans d'expérience obligatoire.",
        experienceRequired: false,
        experienceLabel: "Débutant accepté",
      }),
    );
    const resolved = resolveJuniorObservation(classification);
    expect(
      computeJuniorObservationMetric(
        Array.from({ length: 20 }, () => resolved),
      ),
    ).toMatchObject({
      numerator: 20,
      denominator: 20,
      value: 1,
      metricVersion: "junior-contradiction-2.0.0",
    });
    classification.warnings.push({
      code: "FUTURE_UNCERTAINTY",
      severity: "blocking",
      message: "Fixture",
    });
    expect(resolveJuniorObservation(classification)).toMatchObject({
      status: "ambiguous",
      contradictory: null,
    });
  });
});

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

describe("observed exclusion regressions (anonymized fixtures)", () => {
  it.each(exclusionAudit)(
    "resolves $fixtureId without manufacturing experience",
    (fixture) => {
      const offer = fixtureOffer({
        fixtureId: fixture.fixtureId,
        title: "Développeur logiciel",
        description: fixture.description,
        experienceRequired: fixture.required,
        experienceLabel: fixture.label,
      });
      const result = classifyOffer(offer);
      expect(result.minimumExperienceMonths).toBe(fixture.months);
      expect(result.status).toBe(fixture.status);
      for (const evidence of result.evidence) {
        const source =
          evidence.field === "description"
            ? offer.descriptionText
            : evidence.field === "title"
              ? offer.title
              : (offer.structuredExperience.label ?? "");
        expect(source.slice(evidence.start, evidence.end)).toBe(
          evidence.excerpt,
        );
      }
      if (fixture.months === 0)
        expect(
          result.evidence.filter((e) => e.kind === "required_experience"),
        ).toHaveLength(0);
      else
        expect(result.evidence).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              kind: "required_experience",
              field: "description",
              normalizedValue: String(fixture.months),
            }),
          ]),
        );
      if (fixture.fixtureId === "full-year-unit")
        expect(result.evidence.some((e) => e.excerpt === "3 années")).toBe(
          true,
        );
      if (fixture.fixtureId === "different-modalities")
        expect(result.evidence).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              kind: "desired_experience",
              normalizedValue: "60",
            }),
          ]),
        );
    },
  );
});

describe("explicit senior positioning (synthetic regression fixtures)", () => {
  it("keeps an explicitly offered junior alternative in the observation", () => {
    const result = classifyOffer(
      fixtureOffer({
        fixtureId: "junior-alternative",
        title: "Ingénieur QA Confirmé (ou junior)",
        description: "3 à 7 ans d’expérience requis.",
        experienceRequired: false,
        experienceLabel: "Débutant accepté",
      }),
    );
    expect(result.status).toBe("ambiguous");
    expect(resolveJuniorObservation(result)).toMatchObject({
      status: "resolved",
      contradictory: true,
    });
  });
  it("keeps the exact senior-profile proof explaining an excluded observation", () => {
    const result = classifyOffer(
      fixtureOffer({
        fixtureId: "senior-profile",
        title: "Développeur",
        description:
          "En tant que profil senior, vous avez 7 ans d’expérience obligatoire.",
        experienceRequired: false,
        experienceLabel: "Débutant accepté",
      }),
    );
    const observation = resolveJuniorObservation(result);
    expect(observation.status).toBe("ambiguous");
    expect(observation.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "conflict",
          excerpt: "En tant que profil senior",
        }),
      ]),
    );
  });
  it.each([
    "Qualifications5 ans minimum sur stack Java + React.js",
    "Qualifications 5 ans minimum sur stack Java + React.js",
  ])("recognizes the professional requirement in %s", (description) => {
    const result = classifyOffer(
      fixtureOffer({
        fixtureId: "stack-qualification",
        title: "Développeur",
        description,
        experienceRequired: false,
        experienceLabel: "Débutant accepté",
      }),
    );
    expect(result.minimumExperienceMonths).toBe(60);
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "required_experience",
          normalizedValue: "60",
        }),
      ]),
    );
    expect(resolveJuniorObservation(result)).toMatchObject({
      status: "resolved",
      contradictory: true,
    });
  });
  it.each(["Senior", "Confirmé", "Confirmée", "Expérimenté/e", "Lead"])(
    "preserves a conflict proof for %s despite structured beginner acceptance",
    (level) => {
      const result = classifyOffer(
        fixtureOffer({
          fixtureId: "senior-position",
          title: `Développeur ${level}`,
          description: "Vous avez 3 ans d’expérience obligatoire.",
          experienceRequired: false,
          experienceLabel: "Débutant accepté",
        }),
      );
      expect(result.status).toBe("ambiguous");
      expect(result.beginnerFriendly).toBeNull();
      expect(result.evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "conflict",
            field: "title",
            ruleId: "SENIOR_TITLE_JUNIOR_CONFLICT",
          }),
        ]),
      );
      expect(resolveJuniorObservation(result)).toMatchObject({
        status: "ambiguous",
        contradictory: null,
      });
    },
  );
  it("recognizes the candidate's senior role but not a senior colleague", () => {
    const base = {
      fixtureId: "body-senior",
      title: "Développeur",
      experienceRequired: false,
      experienceLabel: "Débutant accepté",
    };
    const senior = classifyOffer(
      fixtureOffer({
        ...base,
        description:
          "En tant que Senior, vous avez 3 ans d’expérience obligatoire.",
      }),
    );
    expect(senior.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "conflict",
          field: "description",
          ruleId: "SENIOR_ROLE_JUNIOR_CONFLICT",
          excerpt: "En tant que Senior",
        }),
      ]),
    );
    expect(resolveJuniorObservation(senior).status).toBe("ambiguous");
    const colleague = classifyOffer(
      fixtureOffer({
        ...base,
        description: "Vous êtes accompagné par un senior.",
      }),
    );
    expect(colleague.status).toBe("classified");
    expect(colleague.beginnerFriendly).toBe(true);
  });
});

describe("classifyOffer no-experience threshold", () => {
  it("recognizes an explicit stack minimum after a separate qualifications sentence", () => {
    const result = classifyOffer(
      fixtureOffer({
        fixtureId: "separate-stack-minimum",
        title: "Développeur fullstack",
        description:
          "Qualifications : diplôme informatique ou équivalent.5 ans minimum sur la stack Java et React.",
        experienceRequired: false,
        experienceLabel: "Débutant accepté",
      }),
    );
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "required_experience",
          excerpt: "5 ans",
          normalizedValue: "60",
        }),
      ]),
    );
    expect(resolveJuniorObservation(result)).toMatchObject({
      status: "resolved",
      contradictory: true,
    });
  });
  it("recognizes a position explicitly open to junior profiles", () => {
    const result = classifyOffer(
      fixtureOffer({
        fixtureId: "open-junior-profiles",
        title: "Expert exploitation cloud",
        description:
          "Au moins 3 ans d'expérience en SRE. Poste ouvert aux profils juniors justifiant d'une expérience en alternance.",
        experienceRequired: true,
        experienceLabel: "3 An(s)",
      }),
    );
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "junior_claim",
          excerpt: "Poste ouvert aux profils juniors",
        }),
      ]),
    );
    expect(resolveJuniorObservation(result)).toMatchObject({
      status: "resolved",
      contradictory: true,
    });
  });
  it("excludes employer longevity in a why-join benefits section", () => {
    const result = classifyOffer(
      fixtureOffer({
        fixtureId: "employer-benefits",
        title: "Développeur Python",
        description:
          "Pourquoi rejoindre notre communauté ? Rejoignez une aventure digitale ! Plus de 55 ans d'expérience dans des projets industriels complexes.",
        experienceRequired: false,
        experienceLabel: "Débutant accepté",
      }),
    );
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "exclusion",
          ruleId: "EXP_EMPLOYER_HISTORY",
          excerpt: "55 ans",
        }),
      ]),
    );
    expect(resolveJuniorObservation(result)).toMatchObject({
      status: "resolved",
      contradictory: false,
    });
  });
  it("keeps a senior recruitment statement despite malformed source parentheses", () => {
    const result = classifyOffer(
      fixtureOffer({
        fixtureId: "malformed-senior-role",
        title: "Développeur Python",
        description:
          "Nous recherchons un(e SENIOR DEVELOPPEUR PYTHON. Vous justifiez de 7 ans d'expérience.",
        experienceRequired: false,
        experienceLabel: "Débutant accepté",
      }),
    );
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "conflict",
          ruleId: "SENIOR_ROLE_JUNIOR_CONFLICT",
        }),
      ]),
    );
    expect(resolveJuniorObservation(result)).toMatchObject({
      status: "ambiguous",
      contradictory: null,
    });
  });
  it("keeps a distant trailing preference attached to its duration", () => {
    const result = classifyOffer(
      fixtureOffer({
        fixtureId: "distant-preference",
        title: "Consultant cybersécurité",
        description:
          "Une expérience professionnelle de 2 à 3 ans dans le domaine de la Cyber Sécurité des Systèmes d'Information (CSSI) est souhaitée.",
        experienceRequired: false,
        experienceLabel: "Débutant accepté",
      }),
    );
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "desired_experience",
          excerpt: "2 à 3 ans",
        }),
      ]),
    );
    expect(resolveJuniorObservation(result)).toMatchObject({
      status: "resolved",
      contradictory: false,
    });
  });
  it("preserves an explicit experienced-profile conflict in the body", () => {
    const result = classifyOffer(
      fixtureOffer({
        fixtureId: "experienced-profile",
        title: "Ingénieur cloud",
        description:
          "Profil expérimenté avec une formation Bac+5, vous justifiez d'au moins 4 ans d'expérience.",
        experienceRequired: false,
        experienceLabel: "Débutant accepté",
      }),
    );
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "conflict",
          excerpt: "Profil expérimenté",
        }),
      ]),
    );
    expect(resolveJuniorObservation(result)).toMatchObject({
      status: "ambiguous",
      contradictory: null,
    });
  });
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
