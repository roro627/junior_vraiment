"use client";

import { useEffect, type ReactNode } from "react";

import { initializeAnalytics } from "@/lib/analytics/client";
import type { AnalyticsEnvironment } from "@/lib/env";

export function AnalyticsProvider({
  config,
  children,
}: Readonly<{
  config: AnalyticsEnvironment;
  children: ReactNode;
}>) {
  useEffect(() => {
    if (config.enabled) void initializeAnalytics(config);
  }, [config]);

  return children;
}
