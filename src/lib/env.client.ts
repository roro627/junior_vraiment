type EnvironmentInput = Readonly<Record<string, string | undefined>>;

export type SentryClientEnvironment =
  | { enabled: false; environment: string }
  | { enabled: true; dsn: string; environment: string };

function readOptionalHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_SENTRY_DSN doit être une URL valide.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SENTRY_DSN doit être une URL HTTP(S).");
  }
  return value;
}

export function readSentryClientEnvironment(
  environment?: EnvironmentInput,
): SentryClientEnvironment {
  // Direct property access is required for Next.js to inline public variables.
  const input = environment ?? {
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  };
  const dsn = readOptionalHttpUrl(input["NEXT_PUBLIC_SENTRY_DSN"]);
  const sentryEnvironment =
    input["NEXT_PUBLIC_SENTRY_ENVIRONMENT"] ?? "development";
  if (sentryEnvironment.length === 0 || sentryEnvironment.length > 64) {
    throw new Error(
      "NEXT_PUBLIC_SENTRY_ENVIRONMENT doit contenir entre 1 et 64 caractères.",
    );
  }

  return dsn
    ? { enabled: true, dsn, environment: sentryEnvironment }
    : { enabled: false, environment: sentryEnvironment };
}
