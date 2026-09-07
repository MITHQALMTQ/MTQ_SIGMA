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
  if (url.searchParams.get("force") === "1") {
    const { runAllTests } = await import("@/lib/mtq/monte-carlo");
    const result = runAllTests();
    const audit = buildAudit(result);
    return NextResponse.json({ ...result, audit, cached: false });
  }
  try {
    if (!existsSync("src/lib/mtq/test-results.json")) {
      // Generate on-the-fly if no cached results
      const { runAllTests } = await import("@/lib/mtq/monte-carlo");
      const result = runAllTests();
      const audit = buildAudit(result);
      return NextResponse.json({ ...result, audit, cached: false });
    }
    return NextResponse.json({ ...JSON.parse(readFileSync("src/lib/mtq/test-results.json", "utf8")), cached: true });
  } catch (e: any) {
    // Fallback: generate on-the-fly
    try {
      const { runAllTests } = await import("@/lib/mtq/monte-carlo");
      const result = runAllTests();
      const audit = buildAudit(result);
      return NextResponse.json({ ...result, audit, cached: false });
    } catch (e2: any) {
      return NextResponse.json({ error: e2.message?.slice(0, 200) }, { status: 500 });
    }
  }
}
