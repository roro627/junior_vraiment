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
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return undefined;
    }
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return undefined;
  }
}

export function scrubSentryEvent<T extends Event>(event: T): T {
  const trace = event.contexts?.trace;
  delete event.user;
  delete event.extra;
  delete event.breadcrumbs;
  delete event.contexts;
  // Sentry requires the technical trace identifiers to accept sampled
  // transactions. Retain only validated identifiers, never trace payloads.
  if (
    trace?.trace_id &&
    /^[a-f0-9]{32}$/i.test(trace.trace_id) &&
    trace.span_id &&
    /^[a-f0-9]{16}$/i.test(trace.span_id)
  ) {
    event.contexts = {
      trace: { trace_id: trace.trace_id, span_id: trace.span_id },
    };
  }

  if (event.message) event.message = redactTelemetryText(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) {
      exception.value = redactTelemetryText(exception.value);
    }
    for (const frame of exception.stacktrace?.frames ?? []) {
      delete frame.vars;
    }
  }

  // SQL and HTTP spans can contain credentials or source content even when
  // the top-level request and exception have already been scrubbed.
  for (const span of event.spans ?? []) {
    delete span.description;
    span.data = {};
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
    else delete event.request.url;
  }

  return event;
}
