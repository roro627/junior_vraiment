import { z } from "zod";

type EnvironmentInput = Readonly<Record<string, string | undefined>>;

const httpUrl = z
  .url()
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
    {
      message: "Une URL HTTP(S) est requise.",
    },
  );

const baseServerEnvironmentSchema = z.object({
  APP_ENV: z
    .enum(["development", "test", "preview", "production"])
    .default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DATASET_STALE_AFTER_HOURS: z.coerce.number().int().positive().default(72),
  DATASET_CRITICAL_AFTER_HOURS: z.coerce.number().int().positive().default(168),
  RAW_PAYLOAD_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
});

const franceTravailEnvironmentSchema = z.object({
  FRANCE_TRAVAIL_CLIENT_ID: z.string().min(1),
  FRANCE_TRAVAIL_CLIENT_SECRET: z.string().min(1),
  FRANCE_TRAVAIL_TOKEN_URL: httpUrl,
  FRANCE_TRAVAIL_API_BASE_URL: httpUrl,
  INGESTION_REQUESTS_PER_SECOND: z.coerce
    .number()
    .positive()
    .max(10)
    .default(5),
});

const databaseEnvironmentSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    DATABASE_DIRECT_URL: z.string().min(1).optional(),
    DATABASE_URL_UNPOOLED: z.string().min(1).optional(),
  })
  .transform((environment, context) => {
    const directUrl =
      environment.DATABASE_DIRECT_URL ?? environment.DATABASE_URL_UNPOOLED;

    if (!directUrl) {
      context.addIssue({
        code: "custom",
        message: "Une connexion PostgreSQL directe est requise.",
        path: ["DATABASE_DIRECT_URL"],
      });

      return z.NEVER;
    }

    return {
      DATABASE_URL: environment.DATABASE_URL,
      DATABASE_DIRECT_URL: directUrl,
    };
  });

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SITE_URL: httpUrl.optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: httpUrl.optional(),
});

const siteEnvironmentSchema = z.object({
  NEXT_PUBLIC_SITE_URL: httpUrl.optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z
    .string()
    .min(1)
    .max(253)
    .regex(/^[a-z0-9.-]+$/iu)
    .optional(),
});

const analyticsEnvironmentSchema = z.object({
  ANALYTICS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: httpUrl.optional(),
});

const revalidationEnvironmentSchema = z.object({
  REVALIDATION_SECRET: z.string().min(32),
});

const cursorEnvironmentSchema = z.object({
  API_CURSOR_SECRET: z.string().min(32),
});

const toolEnvironmentSchema = z.object({
  CI: z.string().optional(),
  PLAYWRIGHT_BASE_URL: httpUrl.optional(),
  PLAYWRIGHT_EXPECT_PUBLIC_INDEXING: z.enum(["true", "false"]).optional(),
  RUN_DATASET_ROLLBACK_GAME_DAY: z.string().optional(),
  RUN_LIVE_DATABASE: z.string().optional(),
  RUN_LIVE_FRANCE_TRAVAIL: z.string().optional(),
});

const rollbackGameDayEnvironmentSchema = z.object({
  ROLLBACK_GAME_DAY_DATABASE_URL: z
    .string()
    .min(1)
    .refine((value) => value.startsWith("postgresql://"), {
      message: "Une URL PostgreSQL dédiée au game day est requise.",
    }),
});

const deploymentEnvironmentSchema = z.object({
  APP_ENV: z.enum(["development", "test", "preview", "production"]).optional(),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
});

const nextBuildEnvironmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  SKIP_EXTERNAL_DATA_DURING_BUILD: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

const sentryServerEnvironmentSchema = z.object({
  SENTRY_DSN: httpUrl.optional(),
  SENTRY_ENVIRONMENT: z.string().min(1).max(64).default("development"),
});

const sentryBuildEnvironmentSchema = z.object({
  SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
  SENTRY_ORG: z.string().min(1).optional(),
  SENTRY_PROJECT: z.string().min(1).optional(),
});

const nextRuntimeEnvironmentSchema = z.object({
  NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),
});

export type BaseServerEnvironment = z.infer<typeof baseServerEnvironmentSchema>;
export type FranceTravailEnvironment = z.infer<
  typeof franceTravailEnvironmentSchema
>;
export type DatabaseEnvironment = z.infer<typeof databaseEnvironmentSchema>;
export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;
export type SiteEnvironment = z.infer<typeof siteEnvironmentSchema>;
export type AnalyticsEnvironment =
  { enabled: false } | { enabled: true; key: string; host: string };
export type RevalidationEnvironment = z.infer<
  typeof revalidationEnvironmentSchema
>;
export type CursorEnvironment = z.infer<typeof cursorEnvironmentSchema>;
export type ToolEnvironment = z.infer<typeof toolEnvironmentSchema>;
export type RollbackGameDayEnvironment = z.infer<
  typeof rollbackGameDayEnvironmentSchema
>;
export type NextBuildEnvironment = z.infer<typeof nextBuildEnvironmentSchema>;
export type SentryRuntimeEnvironment =
  | { enabled: false; environment: string }
  | { enabled: true; dsn: string; environment: string };

export type WorkerRuntimeEnvironment = Readonly<{
  APP_ENV: string | undefined;
  DATABASE_URL: string | undefined;
  DATABASE_DIRECT_URL: string | undefined;
  FRANCE_TRAVAIL_CLIENT_ID: string | undefined;
  FRANCE_TRAVAIL_CLIENT_SECRET: string | undefined;
  FRANCE_TRAVAIL_TOKEN_URL: string | undefined;
  FRANCE_TRAVAIL_API_BASE_URL: string | undefined;
  INGESTION_REQUESTS_PER_SECOND: string | undefined;
  REVALIDATION_URL: string | undefined;
  REVALIDATION_SECRET: string | undefined;
}>;

export function readBaseServerEnvironment(
  environment: EnvironmentInput = process.env,
): BaseServerEnvironment {
  return baseServerEnvironmentSchema.parse(environment);
}

export function readFranceTravailEnvironment(
  environment: EnvironmentInput = process.env,
): FranceTravailEnvironment {
  return franceTravailEnvironmentSchema.parse(environment);
}

export function readDatabaseEnvironment(
  environment: EnvironmentInput = process.env,
): DatabaseEnvironment {
  return databaseEnvironmentSchema.parse(environment);
}

export function readPublicEnvironment(
  environment: EnvironmentInput = process.env,
): PublicEnvironment {
  return publicEnvironmentSchema.parse({
    NEXT_PUBLIC_SITE_URL: environment["NEXT_PUBLIC_SITE_URL"],
    NEXT_PUBLIC_POSTHOG_KEY: environment["NEXT_PUBLIC_POSTHOG_KEY"],
    NEXT_PUBLIC_POSTHOG_HOST: environment["NEXT_PUBLIC_POSTHOG_HOST"],
  });
}

export function readSiteEnvironment(
  environment: EnvironmentInput = process.env,
): SiteEnvironment {
  return siteEnvironmentSchema.parse({
    NEXT_PUBLIC_SITE_URL: environment["NEXT_PUBLIC_SITE_URL"],
    VERCEL_PROJECT_PRODUCTION_URL: environment["VERCEL_PROJECT_PRODUCTION_URL"],
  });
}

export function readAnalyticsEnvironment(
  environment: EnvironmentInput = process.env,
): AnalyticsEnvironment {
  const parsed = analyticsEnvironmentSchema.parse(environment);
  if (!parsed.ANALYTICS_ENABLED) return { enabled: false };

  if (!parsed.NEXT_PUBLIC_POSTHOG_KEY || !parsed.NEXT_PUBLIC_POSTHOG_HOST) {
    throw new Error(
      "L'analytics activé requiert une clé publique et un hôte PostHog.",
    );
  }

  return {
    enabled: true,
    key: parsed.NEXT_PUBLIC_POSTHOG_KEY,
    host: parsed.NEXT_PUBLIC_POSTHOG_HOST,
  };
}

export function readRevalidationEnvironment(
  environment: EnvironmentInput = process.env,
): RevalidationEnvironment {
  return revalidationEnvironmentSchema.parse(environment);
}

export function readCursorEnvironment(
  environment: EnvironmentInput = process.env,
): CursorEnvironment {
  return cursorEnvironmentSchema.parse(environment);
}

export function readToolEnvironment(
  environment: EnvironmentInput = process.env,
): ToolEnvironment {
  return toolEnvironmentSchema.parse({
    CI: environment["CI"],
    PLAYWRIGHT_BASE_URL: environment["PLAYWRIGHT_BASE_URL"],
    PLAYWRIGHT_EXPECT_PUBLIC_INDEXING:
      environment["PLAYWRIGHT_EXPECT_PUBLIC_INDEXING"],
    RUN_DATASET_ROLLBACK_GAME_DAY: environment["RUN_DATASET_ROLLBACK_GAME_DAY"],
    RUN_LIVE_DATABASE: environment["RUN_LIVE_DATABASE"],
    RUN_LIVE_FRANCE_TRAVAIL: environment["RUN_LIVE_FRANCE_TRAVAIL"],
  });
}

export function readRollbackGameDayEnvironment(
  environment: EnvironmentInput = process.env,
): RollbackGameDayEnvironment {
  if (!environment["ROLLBACK_GAME_DAY_DATABASE_URL"]) {
    throw new Error("Une base dédiée au game day de rollback est requise.");
  }
  return rollbackGameDayEnvironmentSchema.parse(environment);
}

export function readNextBuildEnvironment(
  environment: EnvironmentInput = process.env,
): NextBuildEnvironment {
  return nextBuildEnvironmentSchema.parse(environment);
}

export function isExternalDataBuildSkipped(
  environment: EnvironmentInput = process.env,
): boolean {
  return readNextBuildEnvironment(environment).SKIP_EXTERNAL_DATA_DURING_BUILD;
}

export function isPublicIndexingEnabled(
  environment: EnvironmentInput = process.env,
): boolean {
  const deployment = deploymentEnvironmentSchema.parse(environment);
  if (deployment.VERCEL_ENV !== undefined) {
    return deployment.VERCEL_ENV === "production";
  }
  return deployment.APP_ENV === "production";
}

export function isHttpsDeploymentEnvironment(
  environment: EnvironmentInput = process.env,
): boolean {
  return (
    deploymentEnvironmentSchema.parse(environment).VERCEL_ENV !== undefined
  );
}

export function readSentryServerEnvironment(
  environment: EnvironmentInput = process.env,
): SentryRuntimeEnvironment {
  const parsed = sentryServerEnvironmentSchema.parse(environment);
  return parsed.SENTRY_DSN
    ? {
        enabled: true,
        dsn: parsed.SENTRY_DSN,
        environment: parsed.SENTRY_ENVIRONMENT,
      }
    : { enabled: false, environment: parsed.SENTRY_ENVIRONMENT };
}

export { readSentryClientEnvironment } from "./env.client";

export function areSentrySourceMapsConfigured(
  environment: EnvironmentInput = process.env,
): boolean {
  const parsed = sentryBuildEnvironmentSchema.parse(environment);
  return Boolean(
    parsed.SENTRY_AUTH_TOKEN && parsed.SENTRY_ORG && parsed.SENTRY_PROJECT,
  );
}

export function readNextRuntime(
  environment: EnvironmentInput = process.env,
): "nodejs" | "edge" | undefined {
  return nextRuntimeEnvironmentSchema.parse(environment).NEXT_RUNTIME;
}

export function readWorkerRuntimeEnvironment(
  environment: EnvironmentInput = process.env,
): WorkerRuntimeEnvironment {
  return {
    APP_ENV: environment["APP_ENV"],
    DATABASE_URL: environment["DATABASE_URL"],
    DATABASE_DIRECT_URL:
      environment["DATABASE_DIRECT_URL"] ??
      environment["DATABASE_URL_UNPOOLED"],
    FRANCE_TRAVAIL_CLIENT_ID: environment["FRANCE_TRAVAIL_CLIENT_ID"],
    FRANCE_TRAVAIL_CLIENT_SECRET: environment["FRANCE_TRAVAIL_CLIENT_SECRET"],
    FRANCE_TRAVAIL_TOKEN_URL: environment["FRANCE_TRAVAIL_TOKEN_URL"],
    FRANCE_TRAVAIL_API_BASE_URL: environment["FRANCE_TRAVAIL_API_BASE_URL"],
    INGESTION_REQUESTS_PER_SECOND: environment["INGESTION_REQUESTS_PER_SECOND"],
    REVALIDATION_URL: environment["REVALIDATION_URL"],
    REVALIDATION_SECRET: environment["REVALIDATION_SECRET"],
  };
}
