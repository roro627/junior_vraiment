import type { Meta, StoryObj } from "@storybook/react-vite";

import examples from "../../docs/reference/openapi-examples.json";

import { publicOfferSchema } from "@/application/queries/contracts";

import { EvidencePanel } from "./evidence-panel";

const offer = publicOfferSchema.parse(examples.offers.data.items[0]);

const meta = {
  title: "Produit/Panneau de preuve",
  component: EvidencePanel,
  args: { offer },
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof EvidencePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ferme: Story = {};
