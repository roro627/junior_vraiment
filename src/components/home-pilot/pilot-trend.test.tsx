import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { TrendsResponse } from "@/application/queries/contracts";
import { PilotTrend } from "./pilot-trend";

afterEach(cleanup);
const point: TrendsResponse["data"]["points"][number] = {
  date: "2026-09-04",
  value: 0.2,
  numerator: 20,
  denominator: 100,
  populationCount: 100,
  unknownCount: 0,
  ambiguousCount: 0,
  coverage: 1,
  sampleQuality: "normal",
  quality: "normal",
  datasetVersion: "fixture-1",
  annotation: null,
};
describe("pilot trend presentation", () => {
  it("exposes the real values and keeps a scoped source link", () => {
    render(
      <PilotTrend
        dataHref="/api/v1/trends?metric=junior_contradiction_rate&job=frontend"
        points={[
          point,
          {
            ...point,
            date: "2026-09-05",
            value: 0,
            numerator: 0,
            datasetVersion: "fixture-2",
          },
        ]}
      />,
    );
    expect(screen.getByRole("cell", { name: /^0\s*%$/u })).toBeVisible();
    expect(screen.getByRole("cell", { name: "20 / 100" })).toBeVisible();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/api/v1/trends?metric=junior_contradiction_rate&job=frontend",
    );
  });
  it("does not connect a missing calendar day or a change of scope", () => {
    const { container } = render(
      <PilotTrend
        dataHref="/api/v1/trends"
        points={[
          point,
          { ...point, date: "2026-09-06", datasetVersion: "fixture-2" },
          {
            ...point,
            date: "2026-09-07",
            datasetVersion: "fixture-3",
            annotation: {
              kind: "source_change",
              label: "Périmètre élargi — comparaison non directe",
            },
          },
        ]}
      />,
    );
    expect(container.querySelector("path")?.getAttribute("d")).not.toContain(
      "L",
    );
    expect(screen.getByText(/Périmètre élargi/u)).toBeVisible();
  });
  it("does not connect through a non-publishable point or invent a zero", () => {
    const { container } = render(
      <PilotTrend
        dataHref="/api/v1/trends"
        points={[
          point,
          {
            ...point,
            date: "2026-09-05",
            value: null,
            numerator: 0,
            denominator: 5,
            populationCount: 5,
            sampleQuality: "insufficient",
            datasetVersion: "fixture-2",
          },
          { ...point, date: "2026-09-06", datasetVersion: "fixture-3" },
        ]}
      />,
    );
    expect(container.querySelector("path")?.getAttribute("d")).not.toContain(
      "L",
    );
    expect(screen.getByRole("cell", { name: "Non publiable" })).toBeVisible();
    expect(container.querySelectorAll("circle")).toHaveLength(2);
  });
  it("does not draw a trend without two publishable observations", () => {
    render(<PilotTrend dataHref="/api/v1/trends" points={[point]} />);
    expect(screen.getByText("Historique en constitution")).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: /^20\s*%$/u })).toBeVisible();
  });
});
