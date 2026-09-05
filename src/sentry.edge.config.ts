import * as Sentry from "@sentry/nextjs";

import { readSentryServerEnvironment } from "@/lib/env";
import { scrubSentryEvent } from "@/lib/observability/sentry-scrub";

const sentry = readSentryServerEnvironment();

Sentry.init({
  dsn: sentry.enabled ? sentry.dsn : undefined,
  enabled: sentry.enabled,
  environment: sentry.environment,
  sendDefaultPii: false,
  tracesSampleRate: sentry.enabled ? 0.02 : 0,
  maxBreadcrumbs: 0,
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryEvent,
});
