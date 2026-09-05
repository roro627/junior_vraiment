"use client";

import { useEffect } from "react";

import {
  captureAnalyticsEvent,
  type AnalyticsContext,
} from "@/lib/analytics/client";

export function InsightPageAnalytics({
  slug,
  context,
}: {
  slug: string;
  context: AnalyticsContext;
}) {
  useEffect(() => {
    captureAnalyticsEvent(
      {
        name: "page_view",
        properties: { route_name: "insight", insight_slug: slug },
      },
      context,
    );
  }, [context, slug]);

  return null;
}
