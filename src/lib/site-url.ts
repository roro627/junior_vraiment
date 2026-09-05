import { readSiteEnvironment } from "./env";

export function resolveSiteUrl(
  environment?: Readonly<Record<string, string | undefined>>,
): string {
  const siteEnvironment = readSiteEnvironment(environment);
  const explicit = siteEnvironment.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/u, "");

  if (siteEnvironment.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${siteEnvironment.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  return "http://localhost:3000";
}
