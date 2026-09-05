type SecurityHeader = Readonly<{ key: string; value: string }>;
type SecurityHeaderOptions = Readonly<{
  allowDevelopmentEvaluator: boolean;
  upgradeInsecureRequests: boolean;
}>;

const POSTHOG_EU_ORIGIN = "https://eu.i.posthog.com";
const SENTRY_INGEST_ORIGINS = [
  "https://*.ingest.sentry.io",
  "https://*.ingest.de.sentry.io",
  "https://*.ingest.us.sentry.io",
].join(" ");

export function buildContentSecurityPolicy({
  allowDevelopmentEvaluator,
  upgradeInsecureRequests,
}: SecurityHeaderOptions): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${allowDevelopmentEvaluator ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${POSTHOG_EU_ORIGIN} ${SENTRY_INGEST_ORIGINS}`,
    `img-src 'self' blob: data: ${POSTHOG_EU_ORIGIN}`,
    "font-src 'self' data:",
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    ...(upgradeInsecureRequests ? ["upgrade-insecure-requests"] : []),
  ];

  return `${directives.join("; ")};`;
}

export function buildSecurityHeaders(
  options: SecurityHeaderOptions,
): SecurityHeader[] {
  return [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(options),
    },
    {
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ];
}
