"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react";

import {
  captureAnalyticsEvent,
  initializeAnalytics,
  type AnalyticsContext,
  type AnalyticsEvent,
} from "@/lib/analytics/client";
import type { AnalyticsEnvironment } from "@/lib/env";

const disabledAnalytics = { enabled: false } as const;
const AnalyticsConfigContext =
  createContext<AnalyticsEnvironment>(disabledAnalytics);

export function AnalyticsProvider({
  config,
  children,
}: Readonly<{
  config: AnalyticsEnvironment;
  children: ReactNode;
}>) {
  useEffect(() => {
    if (config.enabled) void initializeAnalytics(config).catch(() => undefined);
  }, [config]);

  return (
    <AnalyticsConfigContext.Provider value={config}>
      {children}
    </AnalyticsConfigContext.Provider>
  );
}

export function useAnalyticsCapture(): (
  event: AnalyticsEvent,
  context: AnalyticsContext,
) => void {
  const config = useContext(AnalyticsConfigContext);

  return useCallback(
    (event: AnalyticsEvent, context: AnalyticsContext) => {
      if (!config.enabled) return;
      void initializeAnalytics(config)
        .then(() => captureAnalyticsEvent(event, context))
        .catch(() => undefined);
    },
    [config],
  );
}
