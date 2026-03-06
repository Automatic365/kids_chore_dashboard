import * as Sentry from "@sentry/nextjs";

let initialized = false;

function ensureInitialized() {
  if (initialized) return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || "";
  if (!dsn) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
  initialized = true;
}

export function reportError(error: unknown, context?: Record<string, string | number>) {
  ensureInitialized();
  if (!initialized) {
    return;
  }
  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setTag(key, String(value));
      }
    }
    Sentry.captureException(error);
  });
}
