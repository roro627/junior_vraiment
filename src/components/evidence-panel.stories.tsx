import type { Meta, StoryObj } from "@storybook/react-vite";

import examples from "../../docs/reference/openapi-examples.json";

import { publicOfferSchema } from "@/application/queries/contracts";

import { EvidencePanel } from "./evidence-panel";

const offer = publicOfferSchema.parse(examples.offers.data.items[0]);

const meta = {
  title: "Produit/Panneau de preuve",
  component: EvidencePanel,
  args: {
    offer,
    rank: 1,
    analyticsContext: {
      appVersion: "0.1.0",
      datasetId: "dataset-fixture",
      classifierVersion: "classifier-1.2.0",
      methodologyVersion: "methodology-1.0.0",
    },
  },
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof EvidencePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ferme: Story = {};
