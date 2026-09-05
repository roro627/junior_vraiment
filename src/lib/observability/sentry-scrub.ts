import type { Event } from "@sentry/nextjs";

const emailPattern = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/giu;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]+/giu;
const postgresPattern = /postgres(?:ql)?:\/\/[^\s]+/giu;
const phonePattern = /(?<!\d)(?:\+33|0)[1-9](?:[ .-]?\d{2}){4}(?!\d)/gu;

export function redactTelemetryText(value: string): string {
  return value
    .replace(postgresPattern, "[redacted-database-url]")
    .replace(bearerPattern, "Bearer [redacted]")
    .replace(emailPattern, "[redacted-email]")
    .replace(phonePattern, "[redacted-phone]")
    .slice(0, 500);
}

function sanitizeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return undefined;
  }
}

export function scrubSentryEvent<T extends Event>(event: T): T {
  delete event.user;
  delete event.extra;
  delete event.breadcrumbs;
  delete event.contexts;

  if (event.message) event.message = redactTelemetryText(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) {
      exception.value = redactTelemetryText(exception.value);
    }
  }

  if (event.request) {
    const method = event.request.method;
    const url = sanitizeUrl(event.request.url);
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.env;
    delete event.request.headers;
    delete event.request.query_string;
    if (method) event.request.method = method;
    if (url) event.request.url = url;
  }

  return event;
}
