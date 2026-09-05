import * as Sentry from "@sentry/nextjs";

import { readNextRuntime } from "@/lib/env";

export async function register(): Promise<void> {
  const runtime = readNextRuntime();
  if (runtime === "nodejs") await import("./sentry.server.config");
  if (runtime === "edge") await import("./sentry.edge.config");
}

export const onRequestError = Sentry.captureRequestError;
