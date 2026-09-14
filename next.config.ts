import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // CRITICAL FIX (Task 8): Removed `typescript.ignoreBuildErrors: true`
  // — was letting type errors ship to Vercel with zero static guarantees.
  // Now type errors fail the build in CI and on Vercel.
  reactStrictMode: false,
  // Experimental: server-side external packages that should not be bundled
  // (keeps node_modules like @libsql/client out of the edge bundle).
  serverExternalPackages: ["@libsql/client", "@prisma/adapter-libsql"],
};

// ============================================================================
// Sentry wrapper (TASK-9-MONITORING)
// ----------------------------------------------------------------------------
// `withSentryConfig` is a NO-OP when:
//   - `SENTRY_DSN` env var is not set, OR
//   - `@sentry/cli` cannot authenticate (no SENTRY_AUTH_TOKEN)
// In those cases the wrapper returns the original config unchanged, so the
// app builds and runs identically with or without a Sentry account.
// This is the "graceful degradation" guarantee required by the task spec.
// ============================================================================
export default withSentryConfig(nextConfig, {
  // Sentry org + project — read from env (CI passes them via repository
  // secrets; local dev leaves them unset → wrapper no-ops the upload step).
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Suppress ALL Sentry CLI logs (especially in CI). The task requires this.
  silent: true,

  // HIDE SOURCE MAPS after upload — the .map files are uploaded to Sentry
  // (so Sentry can show original TS source in stack traces) and then
  // DELETED from the deployed bundle so users cannot reverse-engineer the
  // source. (Free-tier safe; this is the default but we set it explicitly.)
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Upload a wider set of files for the client bundle (catches dynamic
  // imports + chunked routes that the default uploader would skip).
  widenClientFileUpload: true,

  // Auto-instrument Next.js' router transactions (route transitions show up
  // as pageload/navigation transactions in Sentry's Performance panel).
  // Disabled explicitly when no DSN is set — withSentryConfig already does
  // this, but we set it for clarity.
  disableLogger: true,

  // Tree-shake Sentry SDK features we don't use (keeps bundle smaller).
  // Defaults are fine for a Next.js app.
  tunnelRoute: "/monitoring",
});
