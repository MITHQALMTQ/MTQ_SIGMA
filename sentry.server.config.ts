// Sentry server-side initialization (TASK-9-MONITORING).
//
// This file is auto-loaded by @sentry/nextjs on the Node.js server runtime.
// It MUST be a no-op when `SENTRY_DSN` is unset (graceful degradation — the
// app still runs without a Sentry account).
//
// Sample rates (per task spec):
//   - errors:     100%
//   - transactions: 10%
//
// Server-side we use the server-only SENTRY_DSN (no NEXT_PUBLIC_ prefix) so
// the DSN is never exposed to the browser bundle. The DSN is a public value
// by design (Sentry accepts events sent with it) but using a separate server
// DSN keeps the client/server event streams separable in the Sentry dashboard.

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN && SENTRY_DSN.length > 0) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1, // 10% of server transactions
    sampleRate: 1.0, // 100% of errors
    debug: false,
    enabled: process.env.NODE_ENV !== "development" || process.env.SENTRY_DEBUG === "1",
    // Server-side: do NOT send PII (wallets, IP addresses, request bodies).
    sendDefaultPii: false,
    // Ignore the noisy Next.js dev-mode chunk-loading errors that are not
    // real production failures.
    ignoreErrors: [
      "Cannot find module",
      "Module not found",
    ],
  });
}
