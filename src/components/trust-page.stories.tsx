import type { Meta, StoryObj } from "@storybook/react-vite";
import { TrustPage } from "./trust-page";

const meta = {
  title: "Pages/Confiance",
  component: TrustPage,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: {
    eyebrow: "Comprendre les chiffres",
    title: "Une méthode ouverte, des limites explicites.",
    lead: "Exemple de composition. Les textes et volumes de cette story sont des fixtures UI, pas une publication de données.",
    navigation: [
      { href: "#source", label: "La source" },
      { href: "#limites", label: "Les limites" },
    ],
    children: (
      <>
        <section id="source">
          <h2>Des annonces observées</h2>
          <p>
            L’observatoire étudie les offres, pas les recrutements effectués.
          </p>
        </section>
        <section id="limites">
          <h2>Pas assez de données</h2>
          <p>
            Un échantillon insuffisant ne devient jamais un taux de zéro pour
            cent.
          </p>
        </section>
      </>
    ),
  },
} satisfies Meta<typeof TrustPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AvecSommaire: Story = {};
export const SansSommaire: Story = { args: { navigation: [] } };
