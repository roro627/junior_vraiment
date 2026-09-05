"use client";

import type { ComponentProps } from "react";

import { useAnalyticsCapture } from "@/components/providers/analytics-provider";
import type {
  AnalyticsClassificationLabel,
  AnalyticsContext,
} from "@/lib/analytics/client";

type TrackedSourceOfferLinkProps = ComponentProps<"a"> & {
  analyticsContext: AnalyticsContext;
  classification: AnalyticsClassificationLabel;
};

export function TrackedSourceOfferLink({
  analyticsContext,
  classification,
  onClick,
  ...linkProps
}: TrackedSourceOfferLinkProps) {
  const capture = useAnalyticsCapture();

  return (
    <a
      {...linkProps}
      onClick={(event) => {
        onClick?.(event);
        capture(
          {
            name: "source_offer_clicked",
            properties: {
              classification,
              source_type: "france_travail",
            },
          },
          analyticsContext,
        );
      }}
    />
  );
}
