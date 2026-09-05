// @vitest-environment node

import { describe, expect, it } from "vitest";

import { franceBusinessDate } from "./run-limited-ingestion";

describe("franceBusinessDate", () => {
  it("uses the Europe/Paris calendar day", () => {
    expect(franceBusinessDate(new Date("2026-09-03T22:30:00.000Z"))).toBe(
      "2026-09-04",
    );
  });

  it("accounts for the winter timezone offset", () => {
    expect(franceBusinessDate(new Date("2026-12-31T23:30:00.000Z"))).toBe(
      "2027-01-01",
    );
  });
});
