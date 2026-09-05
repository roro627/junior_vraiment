declare namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_PUBLIC_SENTRY_DSN?: string;
    readonly NEXT_PUBLIC_SENTRY_ENVIRONMENT?: string;
  }
}
