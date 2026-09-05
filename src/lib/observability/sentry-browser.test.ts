import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  options: vi.fn(),
  initialize: vi.fn(),
  setClient: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  BrowserClient: class {
    constructor(options: unknown) {
      sdk.options(options);
    }
    init() {
      sdk.initialize();
    }
  },
  browserApiErrorsIntegration: () => ({ name: "BrowserApiErrors" }),
  dedupeIntegration: () => ({ name: "Dedupe" }),
  defaultStackParser: vi.fn(),
  eventFiltersIntegration: () => ({ name: "EventFilters" }),
  getCurrentScope: () => ({ setClient: sdk.setClient }),
  globalHandlersIntegration: () => ({ name: "GlobalHandlers" }),
  makeFetchTransport: vi.fn(),
  captureException: vi.fn(),
}));

import { init } from "./sentry-browser";
import { scrubSentryEvent } from "./sentry-scrub";

beforeEach(() => vi.clearAllMocks());

describe("minimal Sentry browser client", () => {
  it("keeps error capture and redaction without tracing or replay integrations", () => {
    init({ dsn: "https://fixture@example.test/1", environment: "test" });

    expect(sdk.options).toHaveBeenCalledExactlyOnceWith({
      dsn: "https://fixture@example.test/1",
      environment: "test",
      release: undefined,
      sendDefaultPii: false,
      maxBreadcrumbs: 0,
      beforeSend: scrubSentryEvent,
      transport: expect.any(Function),
      stackParser: expect.any(Function),
      integrations: [
        { name: "EventFilters" },
        { name: "BrowserApiErrors" },
        { name: "GlobalHandlers" },
        { name: "Dedupe" },
      ],
    });
    expect(sdk.setClient).toHaveBeenCalledOnce();
    expect(sdk.initialize).toHaveBeenCalledOnce();
  });
});
