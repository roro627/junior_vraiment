import type { Meta, StoryObj } from "@storybook/react-vite";

import { DataAvailabilityCard } from "./data-availability-card";

const meta = {
  title: "Produit/Disponibilité des données",
  component: DataAvailabilityCard,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DataAvailabilityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EchantillonInsuffisant: Story = {};
