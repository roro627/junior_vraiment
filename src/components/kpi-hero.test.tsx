import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KpiHero } from "./kpi-hero";

const metric = {
  metric: "junior_contradiction_rate" as const,
  metricVersion: "junior-contradiction-1.0.0",
  value: 0.38,
  numerator: 123,
  denominator: 324,
  populationCount: 361,
  unknownCount: 31,
  ambiguousCount: 6,
  coverage: 324 / 361,
  sampleQuality: "normal" as const,
};

describe("KpiHero", () => {
  it("shows the public rate with its fraction and coverage", () => {
    render(<KpiHero metric={metric} period="30d" />);

    expect(screen.getByRole("heading", { name: "38 %" })).toBeInTheDocument();
    expect(
      screen.getByText(/123 offres sur 324 classables/u),
    ).toBeInTheDocument();
    expect(screen.getByText(/89,8/u)).toBeInTheDocument();
  });

  it("never turns an insufficient sample into zero percent", () => {
    render(
      <KpiHero
        metric={{
          ...metric,
          value: null,
          numerator: 0,
          denominator: 8,
          populationCount: 10,
          unknownCount: 1,
          ambiguousCount: 1,
          coverage: 0.8,
          sampleQuality: "insufficient",
        }}
        period="7d"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Pas assez de données" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("0 %")).not.toBeInTheDocument();
  });
});
