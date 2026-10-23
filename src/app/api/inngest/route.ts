// /api/inngest — Inngest serve endpoint (GET / POST / PUT)
//
// Receives event-driven job execution requests from Inngest Cloud. This is
// the webhook Inngest calls to execute the 6 scheduled functions
// (keeper tick, sync, backup, monitor, FRED, prune).
//
// Architecture:
//   Inngest Cloud (scheduler) → POST /api/inngest → serverless (execute)
//
// Setup (production):
//   1. Deploy this route
//   2. https://app.inngest.com → connect → add endpoint:
//      https://<host>/api/inngest
//   3. Set INNGEST_SIGNING_KEY in the environment — the SDK reads it
//      automatically and verifies request signatures in cloud mode.
//
// [16b-001/16a-006 fix, Task 16-fix-A] FAIL-CLOSED configuration gate.
// The previous version called serve() unconditionally: with no
// INNGEST_SIGNING_KEY the SDK enters cloud mode, throws "In cloud mode but
// no signing key found", and the route answered a raw 500 to every GET/POST.
// The old comment claiming "in dev (no signing key), Inngest runs in dev
// mode (no signature check)" was WRONG — the SDK only enters dev mode when
// the INNGEST_DEV env var is explicitly "1".
//
// Now:
//   • no signing key AND INNGEST_DEV != "1" → clean 503
//     {error:"Inngest disabled (no signing key)", mode:"disabled"} on
//     GET/POST/PUT (honest "disabled" instead of a broken 500; the scheduled
//     functions remain disclosed design rows on the dashboards);
//   • INNGEST_DEV=1 → serve() runs in dev mode. NOTE (16e-011): dev mode
//     performs NO signature checks, so set it ONLY on a local dev host,
//     never on an exposed deployment;
//   • INNGEST_SIGNING_KEY set → serve() runs with signature verification.

import { NextResponse } from "next/server";
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { allFunctions } from "@/lib/inngest/functions";

export const dynamic = "force-dynamic";

const signingKey = process.env.INNGEST_SIGNING_KEY;
const inngestActive =
  (typeof signingKey === "string" && signingKey.length > 0) ||
  process.env.INNGEST_DEV === "1";

const handlers = inngestActive
  ? serve({ client: inngest, functions: allFunctions })
  : null;

function disabled() {
  return NextResponse.json(
    { error: "Inngest disabled (no signing key)", mode: "disabled" },
    { status: 503 },
  );
}

export const GET = handlers ? handlers.GET : disabled;
export const POST = handlers ? handlers.POST : disabled;
export const PUT = handlers ? handlers.PUT : disabled;
