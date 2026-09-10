// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { ogTokens } from "./og-tokens";

it("keeps the social-card palette aligned with the approved CSS tokens", () => {
  const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
  for (const value of Object.values(ogTokens)) expect(css).toContain(value);
});
