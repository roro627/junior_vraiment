import type { Meta, StoryObj } from "@storybook/react-vite";

import { InsightShare } from "./insight-share";

const meta = {
  title: "Produit/Partage d’un insight",
  component: InsightShare,
  args: {
    slug: "junior-et-deux-ans-france-2026-09-04",
    title:
      "0,2 % des offres junior classables demandent au moins deux ans d’expérience",
    summary:
      "1 sur 408 offres se présentant comme junior avec un minimum obligatoire résolu demande au moins 24 mois d’expérience.",
    canonicalUrl:
      "https://junior-vraiment.example/insights/junior-et-deux-ans-france-2026-09-04",
    analyticsContext: {
      appVersion: "0.1.0",
      datasetId: "dataset-fixture",
      classifierVersion: "classifier-1.2.0",
      methodologyVersion: "methodology-1.0.0",
    },
  },
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof InsightShare>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};
