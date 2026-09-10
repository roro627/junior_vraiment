import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PilotDistribution, PilotHeadline } from "./pilot-primitives";

afterEach(cleanup);

const metric = {
  metric: "junior_contradiction_rate" as const,
  metricVersion: "junior-contradiction-1.0.0",
  value: 0,
  numerator: 0,
  denominator: 100,
  populationCount: 120,
  ambiguousCount: 15,
  unknownCount: 5,
  coverage: 100 / 120,
  sampleQuality: "normal" as const,
};
describe("home art-direction pilot", () => {
  it("keeps a genuine zero distinct from insufficient data and exposes excluded cases", () => {
    render(
      <PilotHeadline
        metric={metric}
        scopeLabel="France · 30 jours"
        explorerHref="/explorer?classification=contradictory"
      />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("0 %");
    expect(screen.getByText(/15 cas ambigus et 5/u)).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Comprendre ce zéro" }),
    ).toHaveTextContent("Les cas dont le seuil ne peut pas être résolu");
    expect(
      screen.getByRole("link", { name: /Voir les offres/u }),
    ).toHaveAttribute("href", "/explorer?classification=contradictory");
  });
  it("does not manufacture a percentage for an insufficient sample", () => {
    render(
      <PilotHeadline
        metric={{
          ...metric,
          value: null,
          denominator: 5,
          populationCount: 25,
          coverage: 0.2,
          sampleQuality: "insufficient",
        }}
        scopeLabel="France"
        explorerHref="/explorer"
      />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      /Pas assez\s*de données\./u,
    );
    expect(screen.queryByText("0 %")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("complementary", { name: "Comprendre ce zéro" }),
    ).not.toBeInTheDocument();
  });
  it("does not describe a rounded positive percentage as no confirmed cases", () => {
    render(
      <PilotHeadline
        metric={{ ...metric, numerator: 1, denominator: 10000, value: 0.0001 }}
        scopeLabel="France"
        explorerHref="/explorer"
      />,
    );
    expect(
      screen.queryByRole("complementary", { name: "Comprendre ce zéro" }),
    ).not.toBeInTheDocument();
  });
  it("provides an explicit empty distribution state", () => {
    render(<PilotDistribution items={[]} />);
    expect(screen.getByText(/Aucune observation/u)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
  it("keeps a zero-length bar and an unknown share distinct", () => {
    const { container } = render(
      <PilotDistribution
        items={[
          { key: "zero", label: "Aucune", count: 0, share: 0 },
          { key: "unknown", label: "Inconnue", count: 0, share: null },
        ]}
      />,
    );
    expect(screen.getByText("0 %")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(
      container.querySelectorAll('[style="--pilot-share: 0%;"]'),
    ).toHaveLength(2);
  });
});
