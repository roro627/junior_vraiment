import { describe, expect, it } from "vitest";

import {
  buildFranceTravailAtomicQueries,
  filterQueryMembershipsByTitle,
  loadActiveFranceTravailQuerySet,
  parseActiveFranceTravailQuerySet,
  titleMatchesAnyRolePhrase,
} from "./active-query-set";

function activeFixture() {
  return structuredClone(loadActiveFranceTravailQuerySet());
}

describe("active France Travail query set", () => {
  it("loads and validates the promoted registry", () => {
    const querySet = loadActiveFranceTravailQuerySet();

    expect(querySet.status).toBe("active");
    expect(querySet.querySetVersion).toBe("queries-3.0.0");
    expect(querySet.groups).toHaveLength(10);
    expect(querySet.groups.every((group) => group.enabled)).toBe(true);
  });

  it("rejects a draft registry, duplicate groups and invalid source references", () => {
    const draft = activeFixture();
    (draft as { status: string }).status = "draft";
    expect(() => parseActiveFranceTravailQuerySet(draft)).toThrow();

    const duplicate = activeFixture();
    duplicate.groups.push(structuredClone(duplicate.groups[0]!));
    expect(() => parseActiveFranceTravailQuerySet(duplicate)).toThrow(
      /déclaré plusieurs fois/u,
    );

    const invalidReference = activeFixture();
    invalidReference.groups[0]!.occupationReferences[0] = "M18";
    expect(() => parseActiveFranceTravailQuerySet(invalidReference)).toThrow();
  });

  it("expands all channels and shares equal source requests across groups", () => {
    const queries = buildFranceTravailAtomicQueries(activeFixture());
    const kinds = new Set(queries.map((query) => query.kind));
    const sharedM1855 = queries.find(
      (query) =>
        query.occupationReference === "M1855" && query.keyword === null,
    );

    expect(kinds).toEqual(
      new Set(["occupation-only", "keyword-only", "overlap"]),
    );
    expect(sharedM1855?.memberships.map(({ groupId }) => groupId)).toEqual([
      "frontend",
      "fullstack",
    ]);
    expect(new Set(queries.map((query) => query.queryKey)).size).toBe(
      queries.length,
    );
    expect(queries).toEqual(
      [...queries].sort((left, right) =>
        left.queryKey.localeCompare(right.queryKey, "en"),
      ),
    );
  });

  it("does not expand disabled groups", () => {
    const querySet = activeFixture();
    const disabledId = querySet.groups[0]!.id;
    querySet.groups[0]!.enabled = false;

    const queries = buildFranceTravailAtomicQueries(querySet);

    expect(
      queries
        .flatMap((query) => query.memberships)
        .some((membership) => membership.groupId === disabledId),
    ).toBe(false);
  });
});

describe("France Travail title post-filter", () => {
  it("matches complete phrases across case, accents and punctuation", () => {
    expect(
      titleMatchesAnyRolePhrase("DÉVELOPPEUR FRONT-END (H/F)", [
        "développeur front-end",
      ]),
    ).toBe(true);
    expect(
      titleMatchesAnyRolePhrase("Ingénieure en SECURITE INFORMATIQUE", [
        "sécurité informatique",
      ]),
    ).toBe(true);
  });

  it("does not accept a role signal embedded inside another word", () => {
    expect(titleMatchesAnyRolePhrase("Responsable mobilité", ["mobile"])).toBe(
      false,
    );
    expect(
      titleMatchesAnyRolePhrase("Développeur fullstacker", ["fullstack"]),
    ).toBe(false);
  });

  it("retains only memberships whose group-specific filter matches", () => {
    const query = buildFranceTravailAtomicQueries(activeFixture()).find(
      (item) => item.occupationReference === "M1855" && item.keyword === null,
    );

    expect(query).toBeDefined();
    expect(
      filterQueryMembershipsByTitle(query!, "Développeuse front-end"),
    ).toMatchObject([{ groupId: "frontend" }]);
    expect(
      filterQueryMembershipsByTitle(query!, "Développeuse full-stack"),
    ).toMatchObject([{ groupId: "fullstack" }]);
    expect(filterQueryMembershipsByTitle(query!, "Cheffe de projet")).toEqual(
      [],
    );
  });
});
