// GET /api/evidence — MTQΣ Evidence Package v6 (review-only data surface).
// Serves the reconciliation package produced under the Evidence Reconciliation
// and Pre-Remediation Control Directive. READ-ONLY: this route never mutates
// anything and contains no signing/broadcast capability of any kind.
import { NextResponse } from "next/server";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
import {
  EVIDENCE_PACKAGE_META,
  ABSOLUTE_RESTRICTIONS,
  DELIVERABLES,
  FINDINGS_V6,
  RERUN_RESULTS,
  COMPILE_MATRIX,
  CUSTODY_TABLE,
  GATE_STATUS,
  OD_MATRIX,
  STOP_CONDITIONS,
  REMEDIATION_TOP,
  CLAIM_COUNTS,
} from "@/lib/mtq/evidence-package";

export const dynamic = "force-dynamic";

const execAsync = promisify(exec);

// [16a-010 fix, Task 16-fix-A] The git HEAD probe previously ran execSync
// (a subprocess per request, blocking the event loop) with no rate limit.
// Now: async exec + in-module 60s cache + "evidence" bucket (10 req/IP/min).
// The command is a fixed string (no user input → no injection surface).
let headCache: { at: number; head: string | null } | null = null;
const HEAD_CACHE_TTL_MS = 60_000;

async function currentGitHead(): Promise<string | null> {
  if (headCache && Date.now() - headCache.at < HEAD_CACHE_TTL_MS) {
    return headCache.head;
  }
  let head: string | null = null;
  try {
    const { stdout } = await execAsync("git rev-parse HEAD", {
      cwd: process.cwd(),
      timeout: 5000,
      encoding: "utf8",
    });
    head = stdout.trim() || null;
  } catch {
    head = null;
  }
  headCache = { at: Date.now(), head };
  return head;
}

export async function GET(req: Request) {
  // [16a-010 fix] Per-IP rate limit — "evidence" bucket, 10 req/IP/min.
  const rl = await rateLimit(getClientIP(req), "evidence");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }
  try {
    const head = await currentGitHead();
    return NextResponse.json({
      meta: {
        ...EVIDENCE_PACKAGE_META,
        runtimeHead: head,
        runtimeHeadNote: head
          ? "git HEAD at request time (the evidence commit for this package is recorded in audit-work/v6/BASELINE-MANIFEST.txt)"
          : "git unavailable at runtime — see audit-work/v6/BASELINE-MANIFEST.txt for the evidence commit",
        posture: "REVIEW-ONLY — NOT ACCEPTED — no gate advanced — no on-chain action authorized",
      },
      restrictions: ABSOLUTE_RESTRICTIONS,
      deliverables: DELIVERABLES,
      findings: FINDINGS_V6,
      rerunResults: RERUN_RESULTS,
      compileMatrix: COMPILE_MATRIX,
      custody: CUSTODY_TABLE,
      gates: GATE_STATUS,
      decisionMatrix: OD_MATRIX,
      stopConditions: STOP_CONDITIONS,
      remediationTop: REMEDIATION_TOP,
      claimCounts: CLAIM_COUNTS,
    });
  } catch (e) {
    // [16a-004-class fix] Generic error body; detail stays server-side.
    console.error("[api/evidence] internal error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
