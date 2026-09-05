import type { Meta, StoryObj } from "@storybook/react-vite";

import exampleDocument from "../../docs/reference/openapi-examples.json";

import { taxonomiesResponseSchema } from "@/application/queries/contracts";

import { FilterBar } from "./filter-bar";

const taxonomies = taxonomiesResponseSchema.parse(
  exampleDocument.taxonomies,
).data;

const meta = {
  title: "Produit/Filtres",
  component: FilterBar,
  args: {
    scope: {
      job: "frontend",
      technologies: ["react"],
      area: "region:32",
      contracts: ["cdi"],
      remote: "hybrid",
      period: "30d",
    },
    taxonomies,
  },
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof FilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FiltresAppliques: Story = {};
