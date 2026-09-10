import type { Meta, StoryObj } from "@storybook/react-vite";
import { PilotDistribution } from "./pilot-primitives";
import "@/styles/home-pilot.css";

const meta = {
  title: "Pilote accueil/Répartitions",
  component: PilotDistribution,
  args: {
    items: [
      { key: "none", label: "Débutant accepté", count: 25, share: 0.25 },
      { key: "two", label: "2 ans", count: 50, share: 0.5 },
      { key: "ambiguous", label: "Ambigu", count: 25, share: 0.25 },
    ],
  },
  decorators: [
    (Story) => (
      <div className="home-pilot">
        <div className="pilot-container pilot-market">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Fixtures UI uniquement. La longueur encode la part exacte ; zéro n’a pas de barre minimale.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PilotDistribution>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Normal: Story = {};
export const Classement: Story = { args: { variant: "ranked" } };
export const Vide: Story = { args: { items: [] } };
export const ZeroEtInconnu: Story = {
  args: {
    items: [
      { key: "zero", label: "Zéro observé", count: 0, share: 0 },
      { key: "unknown", label: "Part non calculable", count: 0, share: null },
    ],
  },
};
