import { readSentryClientEnvironment } from "@/lib/env.client";
import { scrubSentryEvent } from "@/lib/observability/sentry-scrub";

const sentry = readSentryClientEnvironment();
type RouterTransitionArguments = Parameters<
  typeof import("@sentry/nextjs").captureRouterTransitionStart
>;
let captureRouterTransitionStart:
  ((...arguments_: RouterTransitionArguments) => void) | undefined;

if (sentry.enabled) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: sentry.dsn,
      enabled: true,
      environment: sentry.environment,
      sendDefaultPii: false,
      tracesSampleRate: 0.02,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      maxBreadcrumbs: 0,
      beforeSend: scrubSentryEvent,
      beforeSendTransaction: scrubSentryEvent,
    });
    captureRouterTransitionStart = Sentry.captureRouterTransitionStart;
  });
}

export function onRouterTransitionStart(
  ...arguments_: RouterTransitionArguments
): void {
  captureRouterTransitionStart?.(...arguments_);
}
