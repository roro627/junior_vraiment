import type { Meta, StoryObj } from "@storybook/react-vite";

import { TrendCard } from "./trend-card";

const basePoint = {
  numerator: 20,
  denominator: 100,
  populationCount: 110,
  unknownCount: 8,
  ambiguousCount: 2,
  coverage: 100 / 110,
  sampleQuality: "normal" as const,
  quality: "normal" as const,
  annotation: null,
};

const meta = {
  title: "Graphiques/Tendance",
  component: TrendCard,
  args: {
    points: [
      { ...basePoint, date: "2026-09-01", value: 0.2, datasetVersion: "d1" },
      { ...basePoint, date: "2026-09-02", value: 0.27, datasetVersion: "d2" },
      { ...basePoint, date: "2026-09-03", value: 0.24, datasetVersion: "d3" },
      { ...basePoint, date: "2026-09-04", value: 0.32, datasetVersion: "d4" },
    ],
  },
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof TrendCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Serie: Story = {};
export const HistoriqueInsuffisant: Story = {
  args: {
    points: [
      { ...basePoint, date: "2026-09-04", value: 0.32, datasetVersion: "d4" },
    ],
  },
};
