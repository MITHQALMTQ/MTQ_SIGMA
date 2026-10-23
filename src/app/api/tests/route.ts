import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
export const dynamic = "force-dynamic";

function buildAudit(result: { suites: any[]; totalRuns: number; generatedAt: string }) {
  const suites = result.suites;
  const allSurvived = suites.every((s: any) => s.summary?.survivalRate >= 0.999);
  const findings = suites.map((s: any) => {
    const sr = s.summary?.survivalRate ?? 0;
    const worstRR = s.summary?.worstMinRR ?? 0;
    let severity = "PASS";
    if (sr < 0.90) severity = "FAIL";
    else if (sr < 0.99) severity = "WARN";
    return {
      severity,
      title: `${s.name}: survival ${(sr * 100).toFixed(1)}%`,
      detail: `worst min RR ${worstRR.toFixed(4)}, runs ${s.runs}`,
    };
  });
  return {
    title: "MTQΣ Test Suite — Audit Report",
    generatedAt: result.generatedAt,
    totalRuns: result.totalRuns,
    overallVerdict: allSurvived
      ? "PASS — protocol maintains RR ≥ 1.00 across all suites. The 110% buffer absorbs all shocks."
      : `CONDITIONAL — ${findings.filter((f: any) => f.severity === "FAIL").length} suite(s) failed`,
    invariantsTested: [
      "§4.2.1 Hard floor (RR≥1.00)",
      "§4.2.1 Stress floor (RR≥1.05)",
      "§4.2.1 Target (RR≥1.10)",
      "§4.3 LCR≥1.00",
      "§3.5 Price band [0.50,2.00]",
      "§11 Peg stability [0.98,1.02]",
      "§7 Rebalancer deviation",
      "§8 Buffer BASE/STRESS/EMERGENCY",
      "§9 Oracle pause",
    ],
    findings,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const forceRequested = url.searchParams.get("force") === "1";
  // [16a-002/16c-001 fix, Task 16-fix-A] force-run gating (memory guard) —
  // same posture as /api/validation: the Monte-Carlo suite runs IN-REQUEST
  // and an unguarded ?force=1 is the same OOM-kill class that took the dev
  // server down (audit 16a-002). Re-runs are only honored when the host opts
  // in via ALLOW_FORCE_RUNS="true"; otherwise the cached/last recorded run is
  // served with forceUsed:false (+ forceNote when force was requested).
  const forceUsed = forceRequested && process.env.ALLOW_FORCE_RUNS === "true";
  const FORCE_NOTE =
    "Re-runs are disabled on this host (memory guard) — serving the last recorded run.";
  if (forceUsed) {
    const { runAllTests } = await import("@/lib/mtq/monte-carlo");
    const result = runAllTests();
    const audit = buildAudit(result);
    return NextResponse.json({ ...result, audit, cached: false, forceUsed: true });
  }
  try {
    if (!existsSync("src/lib/mtq/test-results.json")) {
      if (forceRequested) {
        // force requested but denied AND no recorded run exists — refuse
        // rather than run the suite in-request (memory guard).
        return NextResponse.json(
          {
            error: "No recorded test run is available on this host, and re-runs are disabled (memory guard).",
            cached: false,
            forceUsed: false,
            forceNote: FORCE_NOTE,
          },
          { status: 503 },
        );
      }
      // Generate on-the-fly if no cached results (original cold path)
      const { runAllTests } = await import("@/lib/mtq/monte-carlo");
      const result = runAllTests();
      const audit = buildAudit(result);
      return NextResponse.json({ ...result, audit, cached: false, forceUsed: false });
    }
    return NextResponse.json({
      ...JSON.parse(readFileSync("src/lib/mtq/test-results.json", "utf8")),
      cached: true,
      forceUsed: false,
      ...(forceRequested ? { forceNote: FORCE_NOTE } : {}),
    });
  } catch (e: any) {
    // Fallback: generate on-the-fly
    try {
      const { runAllTests } = await import("@/lib/mtq/monte-carlo");
      const result = runAllTests();
      const audit = buildAudit(result);
      return NextResponse.json({ ...result, audit, cached: false, forceUsed: false });
    } catch (e2: any) {
      // [16a-004-class fix] Generic error body; detail stays server-side.
      console.error("[api/tests] internal error:", e2);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }
}
