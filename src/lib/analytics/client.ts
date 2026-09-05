"use client";

import type { CaptureResult, PostHog } from "posthog-js";

export type AnalyticsContext = {
  appVersion: string;
  datasetId: string;
  classifierVersion: string;
  methodologyVersion: string;
};

export type AnalyticsEvent =
  | {
      name: "page_view";
      properties: {
        route_name:
          | "home"
          | "explorer"
          | "methodology"
          | "about"
          | "data_status"
          | "insight";
        insight_slug?: string;
      };
    }
  | {
      name: "filter_changed";
      properties: {
        filter_name:
          | "job_family"
          | "technology"
          | "region"
          | "department"
          | "city"
          | "contract_type"
          | "remote_mode"
          | "period"
          | "classification";
        action: "add" | "remove" | "clear";
        value_id: string;
      };
    }
  | {
      name: "filter_set_shared";
      properties: {
        active_filter_count: number;
        share_method: "copy_link" | "native_share" | "linkedin";
      };
    }
  | {
      name: "metric_opened";
      properties: {
        metric_id:
          | "junior_contradiction_rate"
          | "beginner_friendly_rate"
          | "salary_transparency_rate"
          | "minimum_experience_distribution"
          | "offer_volume"
          | "technology_mentions"
          | "contract_distribution"
          | "remote_mode_distribution";
        displayability: "hidden" | "caution" | "standard";
        sample_size_bucket: "0-19" | "20-49" | "50-199" | "200-999" | "1000+";
      };
    }
  | {
      name: "chart_interacted";
      properties: {
        chart_id: string;
        interaction:
          "focus_point" | "change_series" | "open_table" | "download_image";
      };
    }
  | {
      name: "offer_opened";
      properties: {
        classification: AnalyticsClassificationLabel;
        entry_point: "offer_table" | "metric_detail" | "insight";
        rank_bucket: "1-5" | "6-10" | "11-25" | "26+";
      };
    }
  | {
      name: "evidence_expanded";
      properties: {
        classification: AnalyticsClassificationLabel;
        evidence_kind:
          | "junior_claim"
          | "required_experience"
          | "desired_experience"
          | "exclusion"
          | "ambiguity";
      };
    }
  | {
      name: "source_offer_clicked";
      properties: {
        classification: AnalyticsClassificationLabel;
        source_type: "france_travail" | "partner";
      };
    }
  | {
      name: "methodology_opened";
      properties: {
        entry_point: "header" | "metric" | "offer" | "footer" | "data_warning";
      };
    }
  | {
      name: "insight_shared";
      properties: {
        insight_slug: string;
        share_method:
          "copy_link" | "native_share" | "linkedin" | "download_image";
      };
    }
  | {
      name: "data_warning_opened";
      properties: {
        warning_code:
          | "SMALL_SAMPLE"
          | "PARTIAL_COLLECTION"
          | "STALE_DATA"
          | "SOURCE_SCHEMA_CHANGE"
          | "CLASSIFICATION_DRIFT"
          | "UNKNOWN";
        severity: "info" | "warning" | "critical";
      };
    };

export type AnalyticsClassificationLabel =
  | "contradictory"
  | "beginner_friendly"
  | "junior_unresolved"
  | "other_junior"
  | "not_explicitly_junior"
  | "ambiguous"
  | "unknown";

const allowedEvents = new Set<string>([
  "page_view",
  "filter_changed",
  "filter_set_shared",
  "metric_opened",
  "chart_interacted",
  "offer_opened",
  "evidence_expanded",
  "source_offer_clicked",
  "methodology_opened",
  "insight_shared",
  "data_warning_opened",
]);
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
  "filter_name",
  "action",
  "value_id",
  "active_filter_count",
  "metric_id",
  "displayability",
  "sample_size_bucket",
  "chart_id",
  "interaction",
  "classification",
  "entry_point",
  "rank_bucket",
  "evidence_kind",
  "source_type",
  "warning_code",
  "severity",
]);

let initialized = false;
let analyticsClient: PostHog | undefined;
let initializationPromise: Promise<void> | undefined;

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
  if (initializationPromise) return initializationPromise;

  initializationPromise = import("posthog-js").then(({ default: posthog }) => {
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
  });
  return initializationPromise;
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
