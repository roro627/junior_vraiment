import type { Meta, StoryObj } from "@storybook/react-vite";

import examples from "../../docs/reference/openapi-examples.json";

import {
  offersResponseSchema,
  offersSearchParamsSchema,
} from "@/application/queries/contracts";

import { OfferResults } from "./offer-results";

const meta = {
  title: "Produit/Explorer/Résultats",
  component: OfferResults,
  args: {
    response: offersResponseSchema.parse(examples.offers),
    query: offersSearchParamsSchema.parse({}),
  },
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof OfferResults>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DesktopEtCartesMobiles: Story = {};
