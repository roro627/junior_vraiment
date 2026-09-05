import type { Meta, StoryObj } from "@storybook/react-vite";

import examples from "../../docs/reference/openapi-examples.json";

import {
  offersResponseSchema,
  offersSearchParamsSchema,
} from "@/application/queries/contracts";
import { buildAnalyticsContext } from "@/lib/analytics/context";

import { OfferResults } from "./offer-results";

const response = offersResponseSchema.parse(examples.offers);

const meta = {
  title: "Produit/Explorer/Résultats",
  component: OfferResults,
  args: {
    response,
    query: offersSearchParamsSchema.parse({}),
    analyticsContext: buildAnalyticsContext(response.meta),
  },
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof OfferResults>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DesktopEtCartesMobiles: Story = {};
