import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import exampleDocument from "../../../docs/reference/openapi-examples.json";
import { overviewResponseSchema } from "@/application/queries/contracts";
import { PilotMetrics } from "./pilot-metrics";
import { PilotPeriod } from "./pilot-period";

afterEach(cleanup);
const { data } = overviewResponseSchema.parse(exampleDocument.overview);
describe("orange pilot overview", () => {
  it("retains the rate denominators and coverage alongside the numbers", () => {
    render(
      <PilotMetrics
        sampleSize={100000}
        beginnerFriendly={data.beginnerFriendly}
        salaryTransparency={data.salaryTransparency}
      />,
    );
    expect(screen.getByText(/100\s000/u)).toBeInTheDocument();
    expect(screen.getAllByText(/Couverture/u)).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Accessibles aux débutants" }),
    ).toHaveAttribute("href", "/methodologie#accessible");
  });
  it("does not turn missing secondary rates into zero", () => {
    render(
      <PilotMetrics
        sampleSize={0}
        beginnerFriendly={{
          ...data.beginnerFriendly,
          value: null,
          coverage: null,
          numerator: 0,
          denominator: 0,
        }}
        salaryTransparency={{
          ...data.salaryTransparency,
          value: null,
          coverage: null,
          numerator: 0,
          denominator: 0,
        }}
      />,
    );
    expect(screen.getAllByText("Pas assez de données")).toHaveLength(2);
    expect(screen.queryByText("0 %")).not.toBeInTheDocument();
    expect(screen.getAllByText(/non calculable/u)).toHaveLength(2);
  });
  it("preserves every active scope filter when switching periods", () => {
    render(
      <PilotPeriod
        scope={{
          job: "frontend",
          technologies: ["react", "typescript"],
          area: "region:32",
          contracts: ["cdi", "cdd"],
          remote: "hybrid",
          period: "90d",
        }}
      />,
    );
    const link = screen.getByRole("link", { name: "30 jours" });
    const params = new URL(link.getAttribute("href")!, "http://localhost")
      .searchParams;
    expect(Object.fromEntries(params)).toEqual({
      job: "frontend",
      tech: "react,typescript",
      area: "region:32",
      contract: "cdi,cdd",
      remote: "hybrid",
    });
    expect(screen.getByRole("link", { name: "90 jours" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });
  it("keeps current-dataset URLs accurately represented", () => {
    render(<PilotPeriod scope={{ ...data.scope, period: "current" }} />);
    expect(screen.getByRole("link", { name: "Jeu actuel" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "7 jours" })).toHaveAttribute(
      "href",
      expect.stringContaining("period=7d"),
    );
  });
});
