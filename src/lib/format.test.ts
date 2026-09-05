import { describe, expect, it } from "vitest";

import { formatInteger, formatLongDate, formatRate } from "./format";

describe("French public formatting", () => {
  it("formats rates without fake precision", () => {
    expect(formatRate(0.3796)).toBe("38 %");
    expect(formatRate(0.024)).toBe("2,4 %");
    expect(formatRate(null)).toBeNull();
  });

  it("formats counts and long dates for France", () => {
    expect(formatInteger(12_456)).toBe("12 456");
    expect(formatLongDate("2026-09-04T03:30:00.000Z")).toBe("4 septembre 2026");
  });
});
