import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";

const meta = {
  title: "Interface/Bouton",
  component: Button,
  args: {
    children: "Appliquer les filtres",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Principal: Story = {};

export const Desactive: Story = {
  args: {
    disabled: true,
  },
};
