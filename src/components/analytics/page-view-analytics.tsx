"use client";

import { useEffect } from "react";

import { useAnalyticsCapture } from "@/components/providers/analytics-provider";
import type { AnalyticsContext, AnalyticsEvent } from "@/lib/analytics/client";

type PageViewProperties = Extract<
  AnalyticsEvent,
  { name: "page_view" }
>["properties"];

export function PageViewAnalytics({
  context,
  route_name,
  insight_slug,
}: PageViewProperties & { context: AnalyticsContext }) {
  const capture = useAnalyticsCapture();

  useEffect(() => {
    capture(
      {
        name: "page_view",
        properties:
          insight_slug === undefined
            ? { route_name }
            : { route_name, insight_slug },
      },
      context,
    );
  }, [capture, context, insight_slug, route_name]);

  return null;
}
