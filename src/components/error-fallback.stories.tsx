import type { Meta, StoryObj } from "@storybook/react-vite";

import { ErrorFallback } from "./error-fallback";

const meta = {
  title: "États/Erreur de page",
  component: ErrorFallback,
  args: {
    error: new Error("Incident de démonstration"),
    retry: () => undefined,
  },
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ErrorFallback>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};
