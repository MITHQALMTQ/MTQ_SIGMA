// GET /api/validation — MTQΣ §23 Validation & Research Program stress suite.
//
// Exposes runAllStressTests() from src/lib/mtq/audit-stress.ts (11 scenarios,
// ~6s runtime) behind a disk cache (src/lib/mtq/validation-results.json),
// following the same pattern as /api/tests:
//   - cache hit            → file contents, cached: true
//   - cache miss (cold)    → run suite, persist, cached: false
//   - ?force=1             → always re-run, overwrite cache, cached: false
//
// HONEST LABELING (§1 standing directive): this is a reference-engine
// simulation stage only. The audit object below is a pure function of the
// results — PASS/WARN/FAIL is computed from survivalRate and NEVER massaged.
// No §25.5 validation gate is claimed as passed anywhere in this response.

import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
import type { StressResult, StressTestSuite } from "@/lib/mtq/audit-stress";

export const dynamic = "force-dynamic";

const CACHE_PATH = "src/lib/mtq/validation-results.json";

// Blueprint § mapping for the 11 §23 scenarios (spec-mandated).
const BLUEPRINT_MAPPING: Record<string, string> = {
  S1: "§23.5 Monte Carlo",
  S2: "§23.5 Monte Carlo",
  S3: "§23.5 Monte Carlo",
  S4: "§23.5 Monte Carlo",
  S5: "§23.8.1 Gold Shocks",
  S6: "§23.8.1 Gold Shocks",
  S7: "§23.8.5 Oracle Disagreement",
  S8: "§23.9 Currency Depeg",
  S9: "§23.10 Redemption Run",
  S10: "§23.11 Reserve Stress Equation",
  S11: "§23.6 Parameter Perturbation",
};

// Scenario ids are emitted as "S1 · §23.5 Historical Block Bootstrap" (or a
// bare "S1" on the engine's error path) — reduce to the bare id.
function scenarioId(scenario: string): string {
  return scenario.split(" · ")[0].trim();
}

// Verdict rule (spec-mandated): PASS if survivalRate ≥ 0.99,
// WARN if ≥ 0.90, FAIL otherwise. Applied verbatim, no exceptions.
function severityFor(survivalRate: number): "PASS" | "WARN" | "FAIL" {
  if (survivalRate >= 0.99) return "PASS";
  if (survivalRate >= 0.9) return "WARN";
  return "FAIL";
}

// Static, honest description of what produced these numbers.
function buildFramework(results: StressResult[]) {
  return {
    name: "MTQΣ §23 Validation & Research Program — Stress Suite",
    stage: "validation-stage",
    engine: "TypeScript reference engine (src/lib/mtq/audit-stress.ts)",
    method:
      "Monte Carlo simulation + deterministic scenario replay (fixed seeds, synthetic paths — reproducible, not live market data)",
    scenarioCount: results.length,
    scenarioIds: results.map((r) => scenarioId(r.scenario)),
    survivalThresholds: { PASS: "survivalRate ≥ 0.99", WARN: "0.90 ≤ survivalRate < 0.99", FAIL: "survivalRate < 0.90" },
    blueprintSectionsCovered: [...new Set(Object.values(BLUEPRINT_MAPPING))],
    productionAuthorized: false,
  };
}

// Pure audit summary computed from results — never from claims.
function buildAudit(results: StressResult[]) {
  const scenarioVerdicts = results.map((r) => ({
    scenario: r.scenario,
    severity: severityFor(r.survivalRate),
    survivalRate: r.survivalRate,
    worstMinRR: r.worstMinRR,
  }));
  const passCount = scenarioVerdicts.filter((v) => v.severity === "PASS").length;
  const warnCount = scenarioVerdicts.filter((v) => v.severity === "WARN").length;
  const failCount = scenarioVerdicts.filter((v) => v.severity === "FAIL").length;
  const failIds = results.filter((r) => severityFor(r.survivalRate) === "FAIL").map((r) => scenarioId(r.scenario));

  let overallVerdict =
    `Validation-stage stress suite: ${passCount} PASS / ${warnCount} WARN / ${failCount} FAIL ` +
    `across ${results.length} §23 scenarios (survival thresholds: PASS ≥ 99%, WARN ≥ 90%, FAIL < 90%).`;
  if (failCount > 0) {
    overallVerdict += ` Failing scenarios (survivalRate < 0.90): ${failIds.join(", ")}.`;
  } else if (warnCount > 0) {
    overallVerdict += ` No scenario fell below the 90% survival floor, but ${warnCount} scenario(s) sit in the WARN band (< 99% survival).`;
  }
  overallVerdict +=
    " These are reference-engine simulation results only — NOT PRODUCTION-AUTHORIZED — validation-stage results only. " +
    "No §25.5 validation gate is passed by this output.";

  return {
    title: "MTQΣ §23 Validation & Research Program — Stress Suite (validation-stage)",
    overallVerdict,
    passCount,
    warnCount,
    failCount,
    scenarioVerdicts,
    blueprintMapping: results.map((r) => ({
      scenario: scenarioId(r.scenario),
      name: r.scenario,
      blueprintSection: BLUEPRINT_MAPPING[scenarioId(r.scenario)] ?? "unmapped",
    })),
    disclosure:
      "These results are reference-engine simulations run against the MTQΣ pilot TypeScript engine with deterministic " +
      "seeds and synthetic price paths. This is NOT the full §23 production research program: no 2010 historical backtest, " +
      "no walk-forward validation record, and no purged/leakage-controlled out-of-sample study is included here (§23.2–§23.4 " +
      "remain deferred). All §25.5 validation gates (smart-contract audit, independent model validation, Sharia " +
      "certification, legal opinion, public testnet, penetration testing, institutional review, liquidity bootstrapping, " +
      "governance launch, community stress test, mainnet approval) remain NOT PASSED. Nothing in this payload authorizes " +
      "production use of the MTQΣ system.",
  };
}

interface SuiteShape {
  results: StressResult[];
  generatedAt: number;
  totalRuntimeMs: number;
}

// Run the suite (~6s), persist the full payload to the cache file, and return
// it with cached: false. Used by both the ?force=1 path and the cold path.
async function generateAndCache(): Promise<SuiteShape & { framework: unknown; audit: unknown }> {
  // Dynamic import, same as /api/tests — avoids loading the heavy engine on
  // every request and keeps it out of other routes' module graphs.
  const { runAllStressTests } = await import("@/lib/mtq/audit-stress");
  const suite: StressTestSuite = await runAllStressTests();
  const payload: SuiteShape & { framework: unknown; audit: unknown } = {
    results: suite.results,
    generatedAt: suite.generatedAt,
    totalRuntimeMs: suite.totalRuntimeMs,
    framework: buildFramework(suite.results),
    audit: buildAudit(suite.results),
  };
  try {
    writeFileSync(CACHE_PATH, JSON.stringify(payload, null, 2));
  } catch {
    // Cache write failure must not fail the request — results are still valid.
  }
  return payload;
}

// Read the cached suite. Returns null if the file is missing or malformed.
function readCached(): SuiteShape | null {
  try {
    if (!existsSync(CACHE_PATH)) return null;
    const parsed = JSON.parse(readFileSync(CACHE_PATH, "utf8"));
    if (!parsed || !Array.isArray(parsed.results) || parsed.results.length === 0) return null;
    return {
      results: parsed.results,
      generatedAt: typeof parsed.generatedAt === "number" ? parsed.generatedAt : 0,
      totalRuntimeMs: typeof parsed.totalRuntimeMs === "number" ? parsed.totalRuntimeMs : 0,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  // Rate limiter — same "health" bucket pattern as /api/three-book.
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "health");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rl.resetAt },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  const url = new URL(req.url);
  const forceRequested = url.searchParams.get("force") === "1";
  // [16a-002/16c-001 fix, Task 16-fix-A] force-run gating (memory guard).
  // The full Monte-Carlo stress suite runs IN-REQUEST under the dev heap cap
  // and previously OOM-KILLED the whole server (audit 16a-002 incident: curl
  // ?force=1 → no response in 118s, next dev exited, watchdog restart). A
  // re-run is now only honored when the host explicitly opts in via
  // ALLOW_FORCE_RUNS="true" (default: unset → denied). When force is
  // requested but denied, the cached/last recorded run is served and the
  // response carries forceUsed:false + forceNote so the caller knows why.
  const forceUsed = forceRequested && process.env.ALLOW_FORCE_RUNS === "true";
  const FORCE_NOTE =
    "Re-runs are disabled on this host (memory guard) — serving the last recorded run.";
  const headers = { "X-RateLimit-Remaining": String(rl.remaining) };

  try {
    // ?force=1 + ALLOW_FORCE_RUNS=true → re-run and overwrite the cache.
    if (forceUsed) {
      const payload = await generateAndCache();
      return NextResponse.json({ ...payload, cached: false, forceUsed: true }, { status: 200, headers });
    }

    const cachedSuite = readCached();
    if (cachedSuite) {
      // Serve the persisted suite. The audit is recomputed here from the very
      // results being served (pure function), so the verdict can never drift
      // from the data — a stale or tampered cache file cannot smuggle in a
      // rosier audit than the numbers support.
      return NextResponse.json(
        {
          ...cachedSuite,
          framework: buildFramework(cachedSuite.results),
          audit: buildAudit(cachedSuite.results),
          cached: true,
          forceUsed: false,
          ...(forceRequested ? { forceNote: FORCE_NOTE } : {}),
        },
        { status: 200, headers },
      );
    }

    // Cold path (no cache file, no force requested): original run-once-and-
    // persist behavior. But if force was requested-and-denied and there is
    // no recorded run at all, refuse rather than run the suite in-request.
    if (forceRequested) {
      return NextResponse.json(
        {
          error: "No recorded validation run is available on this host, and re-runs are disabled (memory guard).",
          forceUsed: false,
          forceNote: FORCE_NOTE,
        },
        { status: 503, headers },
      );
    }

    const payload = await generateAndCache();
    return NextResponse.json({ ...payload, cached: false, forceUsed: false }, { status: 200, headers });
  } catch (e: unknown) {
    // [16a-004-class fix] Generic error body; detail stays server-side.
    console.error("[api/validation] internal error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
