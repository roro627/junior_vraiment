import type { Meta, StoryObj } from "@storybook/react-vite";
import { PilotHeadline, PilotIntroduction } from "./pilot-primitives";
import "@/styles/home-pilot.css";

const metric = {
  metric: "junior_contradiction_rate" as const,
  metricVersion: "junior-contradiction-1.0.0",
  value: 0.38,
  numerator: 38,
  denominator: 100,
  populationCount: 125,
  unknownCount: 5,
  ambiguousCount: 20,
  coverage: 0.8,
  sampleQuality: "normal" as const,
};
const meta = {
  title: "Pilote accueil/Question et mesure",
  component: PilotHeadline,
  args: {
    metric,
    explorerHref: "/explorer?classification=contradictory",
    scopeLabel: "France · 30 jours",
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Fixtures UI explicites ; aucune de ces valeurs ne représente une collecte de production.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="home-pilot">
        <div className="pilot-container pilot-hero">
          <PilotIntroduction />
          <Story />
        </div>
      </div>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof PilotHeadline>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Normal: Story = {};
export const ZeroReel: Story = {
  args: { metric: { ...metric, value: 0, numerator: 0 } },
};
export const Insuffisant: Story = {
  args: {
    metric: {
      ...metric,
      value: null,
      numerator: 1,
      denominator: 5,
      populationCount: 7,
      ambiguousCount: 1,
      unknownCount: 1,
      coverage: 5 / 7,
      sampleQuality: "insufficient",
    },
  },
};
export const CentPourCent: Story = {
  args: { metric: { ...metric, value: 1, numerator: 100 } },
};
export const EchantillonFaible: Story = {
  args: {
    metric: {
      ...metric,
      value: 0.2,
      numerator: 4,
      denominator: 20,
      populationCount: 25,
      ambiguousCount: 3,
      unknownCount: 2,
      sampleQuality: "caution",
    },
  },
};
