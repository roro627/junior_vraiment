import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FilterBar } from "./filter-bar";

const taxonomies = {
  versions: {
    jobs: "jobs-1.0.0",
    technologies: "technologies-1.2.0",
    geography: "geography-2026.1",
    contracts: "contracts-1.0.0",
  },
  jobs: [
    { id: "frontend", label: "Développement frontend", availableCount: 20 },
  ],
  technologies: [{ id: "react", label: "React", availableCount: 12 }],
  popularAreas: [
    {
      id: "region:32",
      label: "Hauts-de-France",
      availableCount: 10,
      parentId: "france",
    },
  ],
  contracts: [{ id: "cdi", label: "CDI", availableCount: 8 }],
  remoteModes: [{ id: "hybrid", label: "Hybride", availableCount: 6 }],
};

describe("FilterBar", () => {
  it("exposes named, preselected GET controls", () => {
    render(
      <FilterBar
        scope={{
          job: "frontend",
          technologies: ["react"],
          area: "region:32",
          contracts: ["cdi"],
          remote: "hybrid",
          period: "30d",
        }}
        taxonomies={taxonomies}
      />,
    );

    const jobFields = screen.getAllByLabelText("Métier");
    expect(jobFields).toHaveLength(2);
    for (const field of jobFields) expect(field).toHaveValue("frontend");
    expect(screen.getAllByRole("button", { name: /Appliquer/u })).toHaveLength(
      2,
    );
  });
});
