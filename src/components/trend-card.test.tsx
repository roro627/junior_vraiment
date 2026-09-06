import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TrendCard } from "./trend-card";
import type { TrendsResponse } from "@/application/queries/contracts";

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
describe("trend comparability", () => {
  it("breaks the line and visibly explains a perimeter change", () => {
    const { container } = render(
      <TrendCard
        points={[
          point,
          {
            ...point,
            date: "2026-09-06",
            value: 0.3,
            datasetVersion: "fixture-2",
            annotation: {
              kind: "source_change",
              label: "Périmètre élargi — comparaison non directe",
            },
          },
        ]}
      />,
    );
    expect(
      container.querySelector("path")?.getAttribute("d")?.match(/M/g),
    ).toHaveLength(2);
    expect(container.querySelector("path")?.getAttribute("d")).not.toContain(
      "L",
    );
    expect(screen.getByText(/Périmètre élargi/)).toBeVisible();
  });
  it("never bridges an unpublished value", () => {
    const { container } = render(
      <TrendCard
        points={[
          point,
          {
            ...point,
            date: "2026-09-05",
            value: null,
            datasetVersion: "fixture-gap",
          },
          {
            ...point,
            date: "2026-09-06",
            value: 0.3,
            datasetVersion: "fixture-2",
          },
        ]}
      />,
    );
    expect(container.querySelector("path")?.getAttribute("d")).not.toContain(
      "L",
    );
  });
});
