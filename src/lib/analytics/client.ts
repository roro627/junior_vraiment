"use client";

import type { CaptureResult, PostHog } from "posthog-js";

export type AnalyticsContext = {
  appVersion: string;
  datasetId: string;
  classifierVersion: string;
  methodologyVersion: string;
};

type AnalyticsEvent =
  | {
      name: "page_view";
      properties: {
        route_name: "insight";
        insight_slug: string;
      };
    }
  | {
      name: "insight_shared";
      properties: {
        insight_slug: string;
        share_method: "copy_link" | "native_share" | "linkedin";
      };
    };

const allowedEvents = new Set(["page_view", "insight_shared"]);
const allowedProperties = new Set([
  "token",
  "distinct_id",
  "$device_id",
  "$lib",
  "$lib_version",
  "$process_person_profile",
  "app_version",
  "dataset_id",
  "classifier_version",
  "methodology_version",
  "locale",
  "viewport_bucket",
  "referrer_category",
  "route_name",
  "insight_slug",
  "share_method",
]);

let initialized = false;
let analyticsClient: PostHog | undefined;

export function sanitizeAnalyticsCapture(
  capture: CaptureResult | null,
): CaptureResult | null {
  if (!capture || !allowedEvents.has(capture.event)) return null;

  return {
    ...capture,
    properties: Object.fromEntries(
      Object.entries(capture.properties).filter(([key]) =>
        allowedProperties.has(key),
      ),
    ),
  };
}

export async function initializeAnalytics(config: {
  key: string;
  host: string;
}): Promise<void> {
  if (initialized) return;

  const { default: posthog } = await import("posthog-js");
  posthog.init(config.key, {
    api_host: config.host,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_performance: false,
    disable_session_recording: true,
    disable_surveys: true,
    advanced_disable_feature_flags: true,
    person_profiles: "never",
    persistence: "memory",
    respect_dnt: true,
    before_send: sanitizeAnalyticsCapture,
  });
  analyticsClient = posthog;
  initialized = true;
}

function viewportBucket(): "mobile" | "tablet" | "desktop" {
  if (window.innerWidth < 640) return "mobile";
  if (window.innerWidth < 1024) return "tablet";
  return "desktop";
}

function referrerCategory(): "direct" | "search" | "social" | "other" {
  if (!document.referrer) return "direct";

  try {
    const hostname = new URL(document.referrer).hostname;
    if (/linkedin|bsky|twitter|x\.com|facebook|mastodon/u.test(hostname)) {
      return "social";
    }
    if (/google|bing|duckduckgo|qwant|ecosia/u.test(hostname)) return "search";
    return "other";
  } catch {
    return "other";
  }
}

export function captureAnalyticsEvent(
  event: AnalyticsEvent,
  context: AnalyticsContext,
): void {
  if (!initialized) return;

  analyticsClient?.capture(event.name, {
    ...event.properties,
    app_version: context.appVersion,
    dataset_id: context.datasetId,
    classifier_version: context.classifierVersion,
    methodology_version: context.methodologyVersion,
    locale: document.documentElement.lang || "fr",
    viewport_bucket: viewportBucket(),
    referrer_category: referrerCategory(),
  });
}
