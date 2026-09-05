import { afterEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
}));

vi.mock("@/lib/observability/sentry-browser", () => sdk);

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("browser instrumentation", () => {
  it("does not initialize or trace without a configured provider", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    await import("./instrumentation-client");
    await vi.dynamicImportSettled();

    expect(sdk.init).not.toHaveBeenCalled();
  });

  it("initializes the narrow SDK entry with the configured environment", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://fixture@example.test/1");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_ENVIRONMENT", "test");
    await import("./instrumentation-client");
    await vi.dynamicImportSettled();

    expect(sdk.init).toHaveBeenCalledExactlyOnceWith({
      dsn: "https://fixture@example.test/1",
      environment: "test",
    });
  });
});
