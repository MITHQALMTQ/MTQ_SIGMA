// Sentry edge-runtime initialization (TASK-9-MONITORING).
//
// This file is auto-loaded by @sentry/nextjs on the Edge runtime (Vercel Edge
// Functions, Cloudflare Workers, etc.). It MUST be a no-op when `SENTRY_DSN`
// is unset so the edge bundle still loads cleanly without a Sentry account.
//
// Sample rates (per task spec):
//   - errors:     100%
//   - transactions: 10%
//
// Edge runtime has a reduced feature set (no Node.js APIs) — we therefore
// keep integrations to the absolute minimum the SDK requires.

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN && SENTRY_DSN.length > 0) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1, // 10% of edge transactions
    sampleRate: 1.0, // 100% of errors
    debug: false,
    enabled: process.env.NODE_ENV !== "development" || process.env.SENTRY_DEBUG === "1",
    sendDefaultPii: false,
  });
}
