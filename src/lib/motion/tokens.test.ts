import { describe, expect, it } from "vitest";

import { duration } from "./tokens";

describe("motion tokens", () => {
  it("keeps ordinary interface motion below 500 milliseconds", () => {
    expect(Math.max(...Object.values(duration))).toBeLessThan(0.5);
  });
});
