import { describe, expect, it } from "vitest";

import { readToolEnvironment } from "@/lib/env";

import { createFranceTravailClient } from "./create-server-client";

const liveTestsEnabled = readToolEnvironment().RUN_LIVE_FRANCE_TRAVAIL === "1";

describe.runIf(liveTestsEnabled)("FranceTravailClient live smoke test", () => {
  it("authenticates and validates one current offer without logging its content", async () => {
    const client = createFranceTravailClient();
    const page = await client.search({
      occupationReference: "M1805",
      rangeSize: 1,
    });

    expect(page.quarantined).toEqual([]);
    expect(page.items).toHaveLength(1);
    expect(page.total).toBeGreaterThan(0);

    const firstOffer = page.items.at(0);
    expect(firstOffer).toBeDefined();
    if (!firstOffer) {
      throw new Error("The validated live page did not contain an offer.");
    }

    const detail = await client.getById(firstOffer.id);
    expect(detail.id).toBe(firstOffer.id);

    const occupations = await client.getReferenceData();
    expect(occupations.some(({ code }) => code === "M1805")).toBe(true);
  });
});
