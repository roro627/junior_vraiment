import {
  BrowserClient,
  browserApiErrorsIntegration,
  dedupeIntegration,
  defaultStackParser,
  eventFiltersIntegration,
  getCurrentScope,
  globalHandlersIntegration,
  makeFetchTransport,
} from "@sentry/nextjs";

import { readSentryClientRelease } from "@/lib/env.client";

import { scrubSentryEvent } from "./sentry-scrub";

export { captureException } from "@sentry/nextjs";

export function init(options: { dsn: string; environment: string }): void {
  // Creating the client explicitly lets the bundler omit tracing, replay and
  // breadcrumb integrations. Server-side traces keep their own sampling.
  const client = new BrowserClient({
    ...options,
    release: readSentryClientRelease(),
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    beforeSend: scrubSentryEvent,
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations: [
      eventFiltersIntegration(),
      browserApiErrorsIntegration(),
      globalHandlersIntegration(),
      dedupeIntegration(),
    ],
  });
  getCurrentScope().setClient(client);
  client.init();
}
