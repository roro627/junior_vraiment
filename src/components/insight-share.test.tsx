import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InsightShare } from "./insight-share";

const canonicalUrl =
  "https://junior-vraiment.example/insights/junior-et-deux-ans-france-2026-09-04";
const props = {
  slug: "junior-et-deux-ans-france-2026-09-04",
  title: "Un insight test",
  summary: "Un résumé test.",
  canonicalUrl,
  analyticsContext: {
    appVersion: "0.1.0",
    datasetId: "dataset-fixture",
    classifierVersion: "classifier-1.2.0",
    methodologyVersion: "methodology-1.0.0",
  },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("InsightShare", () => {
  it("copies only the canonical URL", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<InsightShare {...props} />);

    await user.click(screen.getByRole("button", { name: "Copier le lien" }));

    expect(writeText).toHaveBeenCalledWith(canonicalUrl);
    expect(screen.getByText("Lien copié.")).toBeInTheDocument();
  });

  it("opens LinkedIn with an encoded, attributed insight URL", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const user = userEvent.setup();
    render(<InsightShare {...props} />);

    await user.click(screen.getByRole("button", { name: "LinkedIn" }));

    const destination = new URL(String(open.mock.calls[0]?.[0]));
    const sharedUrl = new URL(destination.searchParams.get("url") ?? "");
    expect(destination.hostname).toBe("www.linkedin.com");
    expect(sharedUrl.origin + sharedUrl.pathname).toBe(canonicalUrl);
    expect(sharedUrl.searchParams.get("utm_source")).toBe("linkedin");
    expect(screen.getByText("Fenêtre LinkedIn ouverte.")).toBeInTheDocument();
  });
});
