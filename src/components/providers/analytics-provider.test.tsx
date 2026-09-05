import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PageViewAnalytics } from "../analytics/page-view-analytics";
import { AnalyticsProvider } from "./analytics-provider";

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthog }));

const context = {
  appVersion: "0.1.0",
  datasetId: "dataset-fixture",
  classifierVersion: "classifier-1.2.0",
  methodologyVersion: "methodology-1.0.0",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AnalyticsProvider", () => {
  it("does not load or capture analytics while the provider is disabled", async () => {
    render(
      <AnalyticsProvider config={{ enabled: false }}>
        <PageViewAnalytics route_name="home" context={context} />
      </AnalyticsProvider>,
    );

    await waitFor(() => expect(posthog.init).not.toHaveBeenCalled());
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("initializes privacy-safe analytics before capturing the first event", async () => {
    render(
      <AnalyticsProvider
        config={{
          enabled: true,
          key: "public-project-key",
          host: "https://eu.i.posthog.com",
        }}
      >
        <PageViewAnalytics route_name="home" context={context} />
      </AnalyticsProvider>,
    );

    await waitFor(() => expect(posthog.capture).toHaveBeenCalledTimes(1));
    expect(posthog.init).toHaveBeenCalledWith(
      "public-project-key",
      expect.objectContaining({
        autocapture: false,
        capture_pageview: false,
        disable_session_recording: true,
        person_profiles: "never",
        persistence: "memory",
        respect_dnt: true,
      }),
    );
    expect(posthog.capture).toHaveBeenCalledWith(
      "page_view",
      expect.objectContaining({
        route_name: "home",
        dataset_id: "dataset-fixture",
      }),
    );
  });
});
