import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataAvailabilityCard } from "./data-availability-card";

describe("DataAvailabilityCard", () => {
  it("announces an insufficient sample instead of a false percentage", () => {
    render(<DataAvailabilityCard />);

    expect(
      screen.getByRole("heading", { name: "Pas assez de données" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("0 %")).not.toBeInTheDocument();
  });
});
