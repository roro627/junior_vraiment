import { describe, expect, it } from "vitest";

import {
  areSentrySourceMapsConfigured,
  isExternalDataBuildSkipped,
  isHttpsDeploymentEnvironment,
  isPublicIndexingEnabled,
  readAnalyticsEnvironment,
  readBaseServerEnvironment,
  readCursorEnvironment,
  readDatabaseEnvironment,
  readFranceTravailEnvironment,
  readSentryClientEnvironment,
  readSentryServerEnvironment,
  readNextBuildEnvironment,
  readPublicEnvironment,
  readRevalidationEnvironment,
  readRollbackGameDayEnvironment,
  readWorkerRuntimeEnvironment,
} from "./env";

describe("environment validation", () => {
  it("provides safe defaults for the application process", () => {
    expect(readBaseServerEnvironment({ NODE_ENV: "test" })).toEqual({
      APP_ENV: "development",
      LOG_LEVEL: "info",
      DATASET_STALE_AFTER_HOURS: 72,
      DATASET_CRITICAL_AFTER_HOURS: 168,
      RAW_PAYLOAD_RETENTION_DAYS: 30,
    });
  });

  it("indexes only the real production deployment", () => {
    expect(isPublicIndexingEnabled({ APP_ENV: "production" })).toBe(true);
    expect(
      isPublicIndexingEnabled({
        APP_ENV: "production",
        VERCEL_ENV: "preview",
      }),
    ).toBe(false);
    expect(isPublicIndexingEnabled({ VERCEL_ENV: "production" })).toBe(true);
    expect(isPublicIndexingEnabled({ APP_ENV: "development" })).toBe(false);
  });

  it("upgrades insecure requests only on HTTPS Vercel deployments", () => {
    expect(isHttpsDeploymentEnvironment({ VERCEL_ENV: "production" })).toBe(
      true,
    );
    expect(isHttpsDeploymentEnvironment({ VERCEL_ENV: "preview" })).toBe(true);
    expect(isHttpsDeploymentEnvironment({ APP_ENV: "production" })).toBe(false);
  });

  it("exposes the validated Next.js build mode", () => {
    expect(readNextBuildEnvironment({ NODE_ENV: "production" })).toEqual({
      NODE_ENV: "production",
      SKIP_EXTERNAL_DATA_DURING_BUILD: false,
    });
  });

  it("keeps Sentry disabled when no DSN is configured", () => {
    expect(readSentryServerEnvironment({})).toEqual({
      enabled: false,
      environment: "development",
    });
    expect(readSentryClientEnvironment({})).toEqual({
      enabled: false,
      environment: "development",
    });
  });

  it("enables Sentry only with a validated runtime DSN", () => {
    expect(
      readSentryClientEnvironment({
        NEXT_PUBLIC_SENTRY_DSN: "https://public@example.ingest.sentry.io/42",
        NEXT_PUBLIC_SENTRY_ENVIRONMENT: "preview",
      }),
    ).toEqual({
      enabled: true,
      dsn: "https://public@example.ingest.sentry.io/42",
      environment: "preview",
    });
    expect(() =>
      readSentryClientEnvironment({
        NEXT_PUBLIC_SENTRY_DSN: "javascript:alert(1)",
      }),
    ).toThrow("HTTP(S)");
  });

  it("uploads Sentry source maps only with the complete build identity", () => {
    expect(
      areSentrySourceMapsConfigured({
        SENTRY_AUTH_TOKEN: "token",
        SENTRY_ORG: "organisation",
      }),
    ).toBe(false);
    expect(
      areSentrySourceMapsConfigured({
        SENTRY_AUTH_TOKEN: "token",
        SENTRY_ORG: "organisation",
        SENTRY_PROJECT: "project",
      }),
    ).toBe(true);
  });

  it("never falls back to the production database for a rollback game day", () => {
    expect(() =>
      readRollbackGameDayEnvironment({
        DATABASE_URL: "postgresql://production.example/app",
      }),
    ).toThrow("dédiée au game day");
    expect(
      readRollbackGameDayEnvironment({
        ROLLBACK_GAME_DAY_DATABASE_URL:
          "postgresql://ephemeral.example/game_day",
      }),
    ).toEqual({
      ROLLBACK_GAME_DAY_DATABASE_URL: "postgresql://ephemeral.example/game_day",
    });
  });

  it("rejects a France Travail integration without credentials", () => {
    expect(() => readFranceTravailEnvironment({})).toThrow();
  });

  it("rejects a database integration without connection strings", () => {
    expect(() => readDatabaseEnvironment({})).toThrow();
  });

  it("requires an explicit source-only build flag", () => {
    expect(isExternalDataBuildSkipped({})).toBe(false);
    expect(
      isExternalDataBuildSkipped({
        SKIP_EXTERNAL_DATA_DURING_BUILD: "true",
      }),
    ).toBe(true);
    expect(() =>
      isExternalDataBuildSkipped({
        SKIP_EXTERNAL_DATA_DURING_BUILD: "yes",
      }),
    ).toThrow();
  });

  it("accepts the unpooled connection name emitted by the Neon CLI", () => {
    expect(
      readDatabaseEnvironment({
        DATABASE_URL: "postgresql://pooled.example/database",
        DATABASE_URL_UNPOOLED: "postgresql://direct.example/database",
      }),
    ).toEqual({
      DATABASE_URL: "postgresql://pooled.example/database",
      DATABASE_DIRECT_URL: "postgresql://direct.example/database",
    });
  });

  it("does not expose unknown variables to the public environment", () => {
    expect(readPublicEnvironment({ SOME_SECRET: "hidden" })).toEqual({});
  });

  it("keeps analytics disabled until an explicit, complete activation", () => {
    expect(
      readAnalyticsEnvironment({
        NEXT_PUBLIC_POSTHOG_KEY: "public-key",
        NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
      }),
    ).toEqual({ enabled: false });
    expect(() =>
      readAnalyticsEnvironment({ ANALYTICS_ENABLED: "true" }),
    ).toThrow("requiert une clé publique");
    expect(
      readAnalyticsEnvironment({
        ANALYTICS_ENABLED: "true",
        NEXT_PUBLIC_POSTHOG_KEY: "public-key",
        NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
      }),
    ).toEqual({
      enabled: true,
      key: "public-key",
      host: "https://eu.i.posthog.com",
    });
    expect(() =>
      readAnalyticsEnvironment({
        ANALYTICS_ENABLED: "true",
        NEXT_PUBLIC_POSTHOG_KEY: "public-key",
        NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
      }),
    ).toThrow();
  });

  it("requires a sufficiently long revalidation secret", () => {
    expect(() =>
      readRevalidationEnvironment({ REVALIDATION_SECRET: "too-short" }),
    ).toThrow();
    expect(
      readRevalidationEnvironment({ REVALIDATION_SECRET: "s".repeat(32) }),
    ).toEqual({ REVALIDATION_SECRET: "s".repeat(32) });
  });

  it("requires a dedicated sufficiently long cursor secret", () => {
    expect(() => readCursorEnvironment({})).toThrow();
    expect(() =>
      readCursorEnvironment({ API_CURSOR_SECRET: "too-short" }),
    ).toThrow();
    expect(
      readCursorEnvironment({
        API_CURSOR_SECRET: "cursor-secret-with-at-least-thirty-two-characters",
      }),
    ).toEqual({
      API_CURSOR_SECRET: "cursor-secret-with-at-least-thirty-two-characters",
    });
  });

  it("limits the worker runtime view to declared server variables", () => {
    expect(
      readWorkerRuntimeEnvironment({
        DATABASE_URL: "postgresql://database.example/app",
        SOME_SECRET: "hidden",
      }),
    ).toEqual({
      APP_ENV: undefined,
      DATABASE_URL: "postgresql://database.example/app",
      DATABASE_DIRECT_URL: undefined,
      FRANCE_TRAVAIL_CLIENT_ID: undefined,
      FRANCE_TRAVAIL_CLIENT_SECRET: undefined,
      FRANCE_TRAVAIL_TOKEN_URL: undefined,
      FRANCE_TRAVAIL_API_BASE_URL: undefined,
      INGESTION_REQUESTS_PER_SECOND: undefined,
      REVALIDATION_URL: undefined,
      REVALIDATION_SECRET: undefined,
    });
  });
});
