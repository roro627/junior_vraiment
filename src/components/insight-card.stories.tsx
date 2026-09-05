import type { Meta, StoryObj } from "@storybook/react-vite";

import type { PublicInsight } from "@/db/queries/public-insights";

import { InsightCard } from "./insight-card";

const insight: PublicInsight = {
  slug: "junior-et-deux-ans-france-2026-09-04",
  title:
    "0,2 % des offres junior classables demandent au moins deux ans d’expérience",
  summary:
    "1 sur 408 offres se présentant comme junior avec un minimum obligatoire résolu demande au moins 24 mois d’expérience.",
  status: "published",
  filters: {
    job: null,
    technologies: [],
    area: "france",
    contracts: [],
    remote: null,
    period: "current",
  },
  metric: {
    metric: "junior_contradiction_rate",
    metricVersion: "junior-contradiction-1.0.0",
    value: 1 / 408,
    numerator: 1,
    denominator: 408,
    populationCount: 518,
    unknownCount: 0,
    ambiguousCount: 110,
    coverage: 408 / 518,
    sampleQuality: "normal",
  },
  periodStart: "2026-09-04",
  periodEnd: "2026-09-04",
  publishedAt: "2026-09-04T16:00:00.000Z",
  correctedAt: null,
  correctionNote: null,
  updatedAt: "2026-09-04T16:00:00.000Z",
  ogAlt: "Carte accessible.",
  datasetVersion: "dataset-fixture",
  classifierVersion: "classifier-1.2.0",
  querySetVersion: "queries-2.0.0",
  sourceLabel: "France Travail",
  sourceAttributionUrl: "https://www.francetravail.fr/",
};

const meta = {
  title: "Produit/Carte insight",
  component: InsightCard,
  args: { insight },
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof InsightCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Publie: Story = {};
