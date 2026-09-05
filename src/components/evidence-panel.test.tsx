import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import examples from "../../docs/reference/openapi-examples.json";

import { publicOfferSchema } from "@/application/queries/contracts";

import { EvidencePanel } from "./evidence-panel";

const offer = publicOfferSchema.parse(examples.offers.data.items[0]);
const analyticsContext = {
  appVersion: "0.1.0",
  datasetId: "dataset-fixture",
  classifierVersion: "classifier-1.2.0",
  methodologyVersion: "methodology-1.0.0",
};

describe("EvidencePanel", () => {
  it("focuses its title, closes with Escape and restores the trigger focus", async () => {
    const user = userEvent.setup();
    render(
      <EvidencePanel
        offer={offer}
        rank={1}
        analyticsContext={analyticsContext}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Voir la preuve" });

    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: offer.title });
    const title = screen.getByRole("heading", { name: offer.title });

    expect(dialog).toBeInTheDocument();
    await waitFor(() => expect(title).toHaveFocus());
    expect(screen.getByText(/Classificateur/u)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
