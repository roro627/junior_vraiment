import type { Meta, StoryObj } from "@storybook/react-vite";

import { MetricCard } from "./metric-card";

const meta = {
  title: "Produit/Carte métrique",
  component: MetricCard,
  args: {
    title: "Débutants explicitement acceptés",
    value: 0.29,
    numerator: 65,
    denominator: 223,
    detail: "offres classables",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MetricCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const SansEchantillon: Story = {
  args: { value: null, numerator: 0, denominator: 8 },
};
