// Sentry client-side initialization (TASK-9-MONITORING).
//
// This file is auto-loaded by @sentry/nextjs on the client. It MUST be a
// no-op when `NEXT_PUBLIC_SENTRY_DSN` is unset so the app still works in
// dev/local environments without a Sentry account.
//
// Sample rates (per task spec):
//   - errors:     100% (capture every error)
//   - transactions: 10% (1-in-10 page loads / route transitions)
//
// Environment mirrors Next.js' NODE_ENV so issues are tagged correctly in
// the Sentry dashboard (production vs development vs test).

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN && SENTRY_DSN.length > 0) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // 100% of errors are sent. Sentry's free tier covers 50k errors/mo — well
    // above the expected pilot error volume. The free tier does NOT require
    // a credit card.
    tracesSampleRate: 0.1, // 10% of transactions
    sampleRate: 1.0, // 100% of errors
    // Silence internal SDK logs in production to keep the browser console clean.
    debug: false,
    // Don't send events when running `next dev` unless explicitly enabled.
    // (We still init so that the SDK is loaded — but events are dropped.)
    enabled: process.env.NODE_ENV !== "development" || process.env.SENTRY_DEBUG === "1",
    // Browser-side integrations are kept at their defaults. The Next.js SDK
    // auto-registers the BrowserTracing integration via withSentryConfig.
    integrations: [],
    // PII redaction: do not send IP addresses or user identifiers.
    sendDefaultPii: false,
    // Ignore noisy, low-signal errors common to Next.js apps.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered packets",
      "Network request failed",
      "Failed to fetch dynamically imported module",
    ],
  });
}
