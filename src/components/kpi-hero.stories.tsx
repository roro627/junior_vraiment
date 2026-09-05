import type { Meta, StoryObj } from "@storybook/react-vite";

import { KpiHero } from "./kpi-hero";

const normalMetric = {
  metric: "junior_contradiction_rate" as const,
  metricVersion: "junior-contradiction-1.0.0",
  value: 0.38,
  numerator: 123,
  denominator: 324,
  populationCount: 361,
  unknownCount: 31,
  ambiguousCount: 6,
  coverage: 324 / 361,
  sampleQuality: "normal" as const,
};

const meta = {
  title: "Produit/KPI principal",
  component: KpiHero,
  args: { metric: normalMetric, period: "30d" },
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof KpiHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const EchantillonInsuffisant: Story = {
  args: {
    metric: {
      ...normalMetric,
      value: null,
      numerator: 2,
      denominator: 8,
      populationCount: 10,
      unknownCount: 1,
      ambiguousCount: 1,
      coverage: 0.8,
      sampleQuality: "insufficient",
    },
  },
};
