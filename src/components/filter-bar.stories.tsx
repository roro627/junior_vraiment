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
    analyticsContext: {
      appVersion: "0.1.0",
      datasetId: "dataset-fixture",
      classifierVersion: "classifier-1.2.0",
      methodologyVersion: "methodology-1.0.0",
    },
  },
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof FilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FiltresAppliques: Story = {};
