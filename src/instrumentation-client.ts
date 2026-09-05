import { readSentryClientEnvironment } from "@/lib/env.client";

const sentry = readSentryClientEnvironment();

if (sentry.enabled) {
  void import("@/lib/observability/sentry-browser").then((Sentry) => {
    Sentry.init({
      dsn: sentry.dsn,
      environment: sentry.environment,
    });
  });
}
