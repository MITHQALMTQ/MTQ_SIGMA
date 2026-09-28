// POST /api/inngest
//
// Inngest serve endpoint — receives event-driven job execution requests
// from Inngest Cloud. This is the webhook that Inngest calls to execute
// the 6 scheduled functions (keeper tick, sync, backup, monitor, FRED, prune).
//
// Architecture:
//   Inngest Cloud (scheduler) → POST /api/inngest → Vercel serverless (execute)
//
// Setup:
//   1. Deploy this route to Vercel
//   2. Go to https://app.inngest.com → connect → add endpoint:
//      https://mtq-sigma.vercel.app/api/inngest
//   3. Inngest will discover all 6 functions and schedule them automatically

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { allFunctions } from "@/lib/inngest/functions";

export const { POST, GET, PUT } = serve({
  client: inngest,
  functions: allFunctions,
  // The signing key is read from INNGEST_SIGNING_KEY env var automatically
  // In dev (no signing key), Inngest runs in "dev mode" (no signature check)
});
