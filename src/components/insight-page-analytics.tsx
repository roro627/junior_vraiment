"use client";

import { useEffect } from "react";

import { useAnalyticsCapture } from "@/components/providers/analytics-provider";
import type { AnalyticsContext } from "@/lib/analytics/client";

export function InsightPageAnalytics({
  slug,
  context,
}: {
  slug: string;
  context: AnalyticsContext;
}) {
  const capture = useAnalyticsCapture();

  useEffect(() => {
    capture(
      {
        name: "page_view",
        properties: { route_name: "insight", insight_slug: slug },
      },
      context,
    );
  }, [capture, context, slug]);

  return null;
}
