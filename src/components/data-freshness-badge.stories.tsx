import type { Meta, StoryObj } from "@storybook/react-vite";

import { DataFreshnessBadge } from "./data-freshness-badge";

const meta = {
  title: "Produit/Fraîcheur des données",
  component: DataFreshnessBadge,
  args: {
    freshness: "fresh",
    dataAsOf: "2026-09-04T03:30:00.000Z",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DataFreshnessBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ajour: Story = {};
export const Partiel: Story = { args: { freshness: "partial" } };
export const Incident: Story = { args: { freshness: "incident" } };
