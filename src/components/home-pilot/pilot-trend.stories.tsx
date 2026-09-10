import type { Meta, StoryObj } from "@storybook/react-vite";
import type { TrendsResponse } from "@/application/queries/contracts";
import { PilotTrend } from "./pilot-trend";
import "@/styles/home-pilot.css";

// Isolated, explicit UI fixtures; never used by the server dashboard.
const point: TrendsResponse["data"]["points"][number] = {
  date: "2026-09-04",
  value: 0.2,
  numerator: 20,
  denominator: 100,
  populationCount: 100,
  unknownCount: 0,
  ambiguousCount: 0,
  coverage: 1,
  sampleQuality: "normal",
  quality: "normal",
  datasetVersion: "fixture-1",
  annotation: null,
};
const meta = {
  title: "Pilote accueil/Historique",
  component: PilotTrend,
  args: {
    points: [
      point,
      {
        ...point,
        date: "2026-09-05",
        value: 0.3,
        numerator: 30,
        datasetVersion: "fixture-2",
      },
    ],
    dataHref: "/api/v1/trends?metric=junior_contradiction_rate",
  },
  decorators: [
    (Story) => (
      <div className="home-pilot">
        <div className="pilot-history">
          <div className="pilot-container pilot-history__data">
            <Story />
          </div>
        </div>
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Jeux de démonstration UI. Échelle 0–100 %, dates calendaires et ruptures explicites.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PilotTrend>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Normal: Story = {};
export const SansHistorique: Story = { args: { points: [] } };
export const UneCollecte: Story = { args: { points: [point] } };
export const Rupture: Story = {
  args: {
    points: [
      point,
      {
        ...point,
        date: "2026-09-06",
        datasetVersion: "fixture-2",
        annotation: {
          kind: "source_change",
          label: "Périmètre modifié — comparaison non directe",
        },
      },
    ],
  },
};
export const NonPubliable: Story = {
  args: {
    points: [
      {
        ...point,
        value: null,
        numerator: 0,
        denominator: 5,
        populationCount: 5,
        sampleQuality: "insufficient",
      },
    ],
  },
};
