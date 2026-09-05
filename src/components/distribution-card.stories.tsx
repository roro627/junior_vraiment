import type { Meta, StoryObj } from "@storybook/react-vite";

import { DistributionCard } from "./distribution-card";

const meta = {
  title: "Produit/Distribution",
  component: DistributionCard,
  args: {
    id: "experience-story",
    title: "Expérience demandée",
    description: "La catégorie inconnue reste visible.",
    items: [
      { key: "none", label: "Débutant accepté", count: 55, share: 0.22 },
      { key: "24", label: "2 ans", count: 94, share: 0.38 },
      { key: "unknown", label: "Non précisé", count: 99, share: 0.4 },
    ],
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DistributionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
