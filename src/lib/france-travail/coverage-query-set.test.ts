import { describe, expect, it } from "vitest";
import candidate from "../../../docs/reference/query-set.observed-v3-draft.json";
import {
  parseQuerySet,
  buildAtomicQueries,
  titleMatchesAny,
} from "../../../scripts/collect-query-set-validation";
import { JOB_FAMILIES } from "@/domain/taxonomies/job-registry";

describe("expanded coverage candidate", () => {
  const registry = parseQuerySet(candidate);
  it("uses existing domain families and no seniority restriction", () => {
    expect(registry.groups).toHaveLength(10);
    for (const group of registry.groups) {
      expect(JOB_FAMILIES.map((family) => family.id)).toContain(group.id);
      expect(group.enabled).toBe(false);
      expect(group.keywordsAny.join(" ")).not.toMatch(/junior|débutant/iu);
    }
    expect(
      new Set(buildAtomicQueries(registry).map((query) => query.id)).size,
    ).toBe(566);
  });
  it.each([
    ["software", "Développeur Java H/F"],
    ["software", "Développeur C# .NET H/F"],
    ["software", "Ingénieur logiciel embarqué Linux (H/F)"],
    ["frontend", "Développeur React F/H"],
    ["frontend", "Développeur Front Angular (H/F)"],
    ["data", "Data scientist (H/F)"],
    ["ai-ml", "Ingénieure en intelligence artificielle"],
  ])("admits explicit %s role: %s", (id, title) => {
    expect(
      titleMatchesAny(
        title,
        registry.groups.find((group) => group.id === id)!.titleIncludesAny,
      ),
    ).toBe(true);
  });
  it.each([
    ["software", "Technicien Chiffreur H/F"],
    ["software", "Chargé de développement commercial"],
    ["software", "Opérateur applicateur"],
    ["frontend", "Commercial solutions React"],
    ["data", "Opérateur saisie de données"],
    ["ai-ml", "Commercial outils IA"],
  ])("does not admit adjacent %s title: %s", (id, title) => {
    expect(
      titleMatchesAny(
        title,
        registry.groups.find((group) => group.id === id)!.titleIncludesAny,
      ),
    ).toBe(false);
  });
});
