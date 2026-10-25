// MTQΣ — Mandate Compliance Panel (Single Source of Truth v5.0+Ext1/2/3)
// =============================================================================
// Fetches /api/mandate and renders the mandate compliance state:
//   1. Authorization banner — production trading NOT authorized; shadow mode
//      active; MTQΣ NOT USD-pegged (Part 2 constitutional invariants).
//   2. Listing self-tests — the corrected-arithmetic vectors run LIVE.
//   3. Corrected 21-step pipeline demo — shadow-mode decision record.
//   4. Genesis 7-step sequence (OD-33) with the seven-component basket.
//   5. Ext-3 external specs: OD-35 live Safe verification (CRITICAL finding),
//      OD-34 per-chain oracle feed configuration, OD-37 token standard.
//   6. Registers — OD-1..38 open decisions, C-001..043 conflicts, T-01..88
//      test matrix with honest status labels (labels are NOT interchangeable).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ScrollText, ShieldCheck, ShieldAlert, CheckCircle2, XCircle, RefreshCw,
  Scale, Landmark, ListChecks, AlertTriangle, Eye, FlaskConical, Gavel,
  Radar, Coins, FileWarning,
} from "lucide-react";
import { Panel, Reveal, Pill, GlowDot, SectionHeading, Skeleton, Stat } from "@/components/mtq/primitives";

interface SelfTest { id: string; name: string; pass: boolean; expected: string; actual: string }
interface MandateResp {
  source: string;
  fetchedAt: string;
  authorization: {
    testnetActivity: string;
    productionReserveTrading: string;
    livePilot: string;
    economicEligibilityEnabled: boolean;
    shadowMode: string;
    constitutional: { notUsdPegged: boolean; numeraireConvention: string };
  };
  objectiveVersions: {
    jsTradeGate: string;
    protectionModel: string;
    thresholdPolicy: { absoluteUsd: number; relativePct: number; committeeDecision: string };
  };
  selfTests: SelfTest[];
  selfTestsSummary: { total: number; passed: number; failed: number };
  pipelineDemo: {
    scenario: string;
    decision: string;
    reason: string;
    shadowOnly: boolean;
    signedImprovement: number;
    directionEligible: boolean;
    grossBenefitUsd: number;
    costUsd: number;
    protectionUsd: number;
    netBenefitUsd: number;
    thresholdUsd: number;
    oracleHealth: string;
    steps: string[];
    decisionRecord: {
      decisionId: string;
      objectiveVersion: string;
      protectionModelVersion: string;
      thresholdPolicyStatus: string;
      finalityState: string;
      statusLabel: string;
      costItems: { kind: string; quoteEmbedded: boolean; source: string }[];
    };
  };
  genesis: {
    ok: boolean;
    steps: { step: number; name: string; detail: string; event?: string }[];
    safe: string;
    basket: { component: string; weightPct: number; usdAmount: number }[];
    indexBaseDenominator: number;
    verifyIndexBaseNote: string;
  };
  safeVerification: {
    safeAddress: string;
    generatedAt: string;
    expected: string;
    evidence: string;
    chains: Record<string, {
      name: string;
      blockNumber: number;
      verdict: string;
      verdictDetail?: string;
      findings: {
        codeBytes: number;
        threshold: string;
        ownersCount: number;
        owners: string[];
        version: string;
        nonce: string;
        modulesCount: number;
        guardIsZero: boolean;
        singleton: string;
      };
    }>;
  } | null;
  oracleFeeds: {
    od: string; conflict: string; test: string; gate: string;
    specRefs: string[];
    counts: Record<string, number>;
    stalenessTable: { feedClass: string | null; stalenessSeconds: number | null; confidenceMaxPct: number | null; pairs: string[]; note?: string }[];
    validation: { deviationBreakerPct: number; correlationThresholdPct: number; correlationWarningAfterUpdates: number; heartbeatNote: string };
    chains: { id: string; label: string; chainId: number | string; onChainOracle: string | null; deployedBy: string | null; codeStatus: string; abiStatus: string; gateStatus: string }[];
    limitations: string[];
  };
  tokenStandard: {
    od: string; test: string; standard: string;
    posture: { transferRestrictions: string; supplyCap: string; upgradeability: string };
    implementation: string;
    compile: { compiler: string; optimizerRuns: number; zeroErrors: boolean; storageLayoutUnchanged: boolean; appendedSlots: number };
    eip170: { runtimeBytes: number; limitBytes: number; exceeded: boolean; note: string };
    deployedOnChain: boolean;
    doc: string;
  };
  registers: {
    openDecisions: { id: string; decision: string; owner: string; blocks: string; status: string; note: string; codeRef?: string }[];
    conflicts: { id: string; conflict: string; resolution: string; codeRef?: string }[];
    tests: { id: string; test: string; expected: string; status: string; codeRef?: string }[];
    rollups: {
      odTotal: number; odOpen: number;
      conflictsTotal: number; conflictsResolvedByCode: number;
      testsTotal: number; testsUnitTested: number; testsImplemented: number;
      testsShadow: number; testsNotDemonstrated: number; testsDemonstratedFailed: number; testsDeferred: number;
    };
  };
}

type RegTab = "od" | "conflicts" | "tests";

function statusTone(status: string): string {
  if (status === "OPEN" || status === "not-demonstrated") return "text-amber-600 border-amber-200 bg-amber-50";
  if (status === "VERIFICATION-PENDING") return "text-orange-600 border-orange-200 bg-orange-50";
  if (status === "VERIFIED-FAILED" || status === "demonstrated-failed") return "text-rose-600 border-rose-200 bg-rose-50";
  if (status.startsWith("deferred")) return "text-[#33544C] border-[#E3EAE6] bg-[#F7FAF8]";
  if (status === "implemented+unit-tested") return "text-emerald-600 border-emerald-200 bg-emerald-50";
  if (status === "shadow-observed") return "text-[#0D9488] border-[#BEE3DD] bg-[#E7F4F1]";
  return "text-emerald-600 border-emerald-200 bg-emerald-50";
}

export function MandateCompliance() {
  const [data, setData] = useState<MandateResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [tab, setTab] = useState<RegTab>("od");
  const mounted = useRef(true);

  const fetchIt = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/mandate", { cache: "no-store" });
      if (!r.ok) {
        // Surface the /api/mandate error text when the body carries one.
        let detail = `HTTP ${r.status}`;
        try {
          const errJson = (await r.json()) as { error?: string };
          if (errJson?.error) detail = `${detail}: ${errJson.error}`;
        } catch {
          /* non-JSON error body — status alone */
        }
        throw new Error(`/api/mandate → ${detail}`);
      }
      const j = (await r.json()) as MandateResp & { error?: string };
      if (!j || j.error) throw new Error(`/api/mandate → ${j?.error ?? "invalid payload"}`);
      if (mounted.current) {
        setData(j);
        setFetchError(null);
      }
    } catch (e) {
      // Keep last data on refetch failures — but never fail silently.
      if (mounted.current) setFetchError(String(e).slice(0, 200));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    fetchIt();
    return () => { mounted.current = false; };
  }, [fetchIt]);

  const r = data?.registers.rollups;

  // Total fetch failure (no data at all): render an honest error panel
  // INSTEAD of the silent "–" stats and empty tables.
  if (fetchError && !data) {
    return (
      <div className="space-y-6">
        <SectionHeading
          eyebrow="SINGLE SOURCE OF TRUTH v5.0 + EXT-1/2/3"
          title={<>Mandate Compliance — Corrected Execution Layer</>}
          right={
            <button
              onClick={fetchIt}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-600 transition hover:bg-emerald-100"
              aria-label="Retry mandate fetch"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Retry fetch
            </button>
          }
        />
        <Reveal>
          <Panel variant="rose" className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <div className="text-sm font-semibold text-[#0E1F1B] mb-1">
                  Mandate compliance data unavailable — /api/mandate fetch failed
                </div>
                <div className="font-mono text-xs text-rose-600/90 break-all">{fetchError}</div>
                <p className="mt-2 text-xs leading-relaxed text-[#5B6E68]">
                  Nothing is fabricated here: the authorization banner, self-tests, pipeline demo,
                  and registers are hidden because the live mandate report could not be loaded.
                  An empty table would be indistinguishable from an empty register — so no tables
                  are shown at all. Retry the fetch above.
                </p>
              </div>
            </div>
          </Panel>
        </Reveal>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="SINGLE SOURCE OF TRUTH v5.0 + EXT-1/2/3"
        title={<>Mandate Compliance — Corrected Execution Layer</>}
        right={
          <button
            onClick={fetchIt}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-600 transition hover:bg-emerald-100"
            aria-label="Re-run mandate self-tests"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Re-run self-tests
          </button>
        }
      />

      {/* ---- Fetch-failure strip (stale data still shown) ---- */}
      {fetchError && data ? (
        <Reveal>
          <Panel variant="rose" className="p-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-rose-600">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Last /api/mandate refresh failed ({fetchError}) — showing the previously fetched
                report. Nothing below is live right now.
              </span>
            </div>
          </Panel>
        </Reveal>
      ) : null}

      {/* ---- Authorization banner (v5.0 §0.3 / §11.2) ---- */}
      <Reveal>
        <Panel className="p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="emerald"><GlowDot color="emerald" /> Testnet activity: AUTHORIZED</Pill>
                <Pill tone="rose"><ShieldAlert className="h-3 w-3" /> Production reserve trading: NOT AUTHORIZED</Pill>
                <Pill tone="amber"><Eye className="h-3 w-3" /> Shadow mode: decisions recorded, funds never move</Pill>
              </div>
              <p className="text-sm leading-relaxed text-[#33544C]">
                The corrected MARP execution layer (Listings C-1…C-10) runs in <strong className="text-[#0E1F1B]">shadow mode</strong>:
                economic eligibility stays disabled until the Quantitative Committee approves the J(s) objective
                (<span className="text-amber-600">OD-1</span>) and the threshold policy
                (<span className="text-amber-600">OD-2</span>). A live pilot requires Gate 5 + separate written
                approval; production requires Gate 6.
              </p>
              <p className="text-xs leading-relaxed text-[#5B6E68]">
                Constitutional invariant (Part 2): <strong className="text-[#0E1F1B]">MTQΣ is not pegged to USD.</strong>{" "}
                {data?.authorization.constitutional.numeraireConvention ?? "USD-equivalent figures are an accounting numeraire only."}{" "}
                The reference price is the chain-linked index I<sub>t</sub>/I<sub>base</sub> — never a $1 peg.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Open decisions" value={`${r?.odOpen ?? "–"} / ${r?.odTotal ?? "–"}`} sub="OD register (38 total)" />
              <Stat label="Conflicts resolved" value={`${r?.conflictsResolvedByCode ?? "–"} / ${r?.conflictsTotal ?? "–"}`} sub={`C-001…C-${String(r?.conflictsTotal ?? 0).padStart(3, "0")} mapped to code`} />
              <Stat label="Tests unit-tested" value={`${r?.testsUnitTested ?? "–"} / ${r?.testsTotal ?? "–"}`} sub="T-01…T-88 matrix" />
              <Stat label="Self-tests passing" value={data ? `${data.selfTestsSummary.passed}/${data.selfTestsSummary.total}` : "–"} sub="Live listing vectors" />
            </div>
          </div>
        </Panel>
      </Reveal>

      {/* ---- Listing self-tests ---- */}
      <Reveal delay={0.05}>
        <Panel className="p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold tracking-wide text-[#0E1F1B]">Listing Self-Tests — corrected arithmetic, run live</h3>
            {data && (
              <Pill tone={data.selfTestsSummary.failed === 0 ? "emerald" : "rose"}>
                {data.selfTestsSummary.failed === 0 ? "ALL PASS" : `${data.selfTestsSummary.failed} FAIL`}
              </Pill>
            )}
          </div>
          {loading && !data ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : (
            <div className="max-h-96 overflow-y-auto mtqs-scroll">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#F7FAF8] text-[11px] uppercase tracking-wider text-[#5B6E68]">
                  <tr>
                    <th className="px-2 py-2">ID</th>
                    <th className="px-2 py-2">Vector</th>
                    <th className="px-2 py-2">Expected</th>
                    <th className="px-2 py-2">Actual</th>
                    <th className="px-2 py-2 text-right">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.selfTests ?? []).map((t) => (
                    <tr key={t.id} className="border-t border-[#E3EAE6]">
                      <td className="px-2 py-1.5 font-mono text-emerald-600">{t.id}</td>
                      <td className="px-2 py-1.5 text-[#0E1F1B]">{t.name}</td>
                      <td className="px-2 py-1.5 font-mono text-[#5B6E68]">{t.expected}</td>
                      <td className="px-2 py-1.5 font-mono text-[#5B6E68]">{t.actual}</td>
                      <td className="px-2 py-1.5 text-right">
                        {t.pass ? <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" aria-label="pass" /> : <XCircle className="ml-auto h-4 w-4 text-rose-600" aria-label="fail" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[11px] text-[#7A8C86]">
            Status label: <strong>unit-tested</strong> — these are reference-implementation vectors, not chain-deployed
            evidence and not governance approvals (v5.0 Part 10.2 label discipline).
          </p>
        </Panel>
      </Reveal>

      {/* ---- Corrected 21-step pipeline demo ---- */}
      {data && (
        <Reveal delay={0.1}>
          <Panel className="p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Scale className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold tracking-wide text-[#0E1F1B]">Corrected 21-Step Execution Pipeline — Shadow Demo</h3>
              <Pill tone="gold">decision: {data.pipelineDemo.decision.toUpperCase()}</Pill>
              <Pill tone="emerald">oracle: {data.pipelineDemo.oracleHealth}</Pill>
              <Pill tone="amber">shadow-only</Pill>
            </div>
            <p className="mb-4 text-xs text-[#5B6E68]">{data.pipelineDemo.scenario}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Stat label="Signed improvement I(q)" value={data.pipelineDemo.signedImprovement.toFixed(4)} sub="Listing C-1 — |d|−|d′| > 0" />
              <Stat label="Direction eligible" value={data.pipelineDemo.directionEligible ? "YES" : "NO"} sub="§3.4.1 buy-under / sell-over" />
              <Stat label="Gross benefit G(q;s)" value={`$${data.pipelineDemo.grossBenefitUsd.toFixed(2)}`} sub="candidate J(s) — OD-1 open" />
              <Stat label="Incremental cost C(q)" value={`$${data.pipelineDemo.costUsd.toFixed(2)}`} sub="embedded vs incremental itemized" />
              <Stat label="Protection B_time" value={`$${data.pipelineDemo.protectionUsd.toFixed(2)}`} sub="conservative fallback — OD-4 open" />
              <Stat label="Net benefit N(q;s)" value={`$${data.pipelineDemo.netBenefitUsd.toFixed(2)}`} sub={`vs ε $${data.pipelineDemo.thresholdUsd} (OD-2 open)`} />
            </div>
            <div className="mt-4 max-h-64 overflow-y-auto mtqs-scroll rounded-xl border border-[#E3EAE6] bg-[#F7FAF8] p-3">
              <ol className="space-y-1.5">
                {data.pipelineDemo.steps.map((s, i) => (
                  <li key={i} className="font-mono text-[11px] leading-relaxed text-[#33544C]">
                    <span className="text-emerald-600/70">▸ </span>{s}
                  </li>
                ))}
              </ol>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-amber-600/90">
              {data.pipelineDemo.reason}
            </p>
          </Panel>
        </Reveal>
      )}

      {/* ---- Genesis 7-step ---- */}
      {data?.genesis && (
        <Reveal delay={0.15}>
          <Panel className="p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Landmark className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold tracking-wide text-[#0E1F1B]">Genesis — Seven-Step Sequence (OD-33)</h3>
              <Pill tone={data.genesis.ok ? "emerald" : "rose"}>{data.genesis.ok ? "SEQUENCE VALID" : "FAILED"}</Pill>
              <Pill tone="default">I_base = {data.genesis.indexBaseDenominator.toFixed(4)}</Pill>
            </div>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {data.genesis.basket.map((b) => (
                <span key={b.component} className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-600">
                  {b.component} {b.weightPct}% · ${(b.usdAmount / 1000).toFixed(0)}k
                </span>
              ))}
            </div>
            <div className="max-h-64 overflow-y-auto mtqs-scroll space-y-1.5">
              {data.genesis.steps.map((s) => (
                <div key={s.step} className="rounded-lg border border-[#E3EAE6] bg-[#F7FAF8] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-600">{s.step}</span>
                    <span className="text-xs font-medium text-[#0E1F1B]">{s.name}</span>
                    {s.event && <Pill tone="emerald">{s.event}</Pill>}
                  </div>
                  <p className="mt-1 pl-7 text-[11px] leading-relaxed text-[#5B6E68]">{s.detail}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-[#7A8C86]">{data.genesis.verifyIndexBaseNote} Genesis Reserve Safe: <span className="font-mono text-[#5B6E68]">{data.genesis.safe}</span> — on-chain verified 2026-10-19: Safe v1.4.1 but <strong className="text-rose-600">1/1 deployer-controlled, not the mandated 4/7</strong> (OD-35 critical finding; see verification panel below).</p>
          </Panel>
        </Reveal>
      )}

      {/* ---- Ext-3 A.5: OD-35 Safe verification (live on-chain evidence) ---- */}
      {data && (
        <Reveal delay={0.17}>
          <Panel className="border-rose-200 p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              <h3 className="text-sm font-semibold tracking-wide text-[#0E1F1B]">Genesis Reserve Safe — On-Chain Verification (OD-35 / T-87 / Ext-3 A.5)</h3>
              {data.safeVerification ? (
                <Pill tone="rose">CRITICAL FINDING — 1/1 deployer-controlled, NOT 4/7</Pill>
              ) : (
                <Pill tone="amber">evidence unavailable</Pill>
              )}
            </div>
            {data.safeVerification ? (
              <>
                <p className="mb-3 text-xs leading-relaxed text-[#5B6E68]">
                  Read-only on-chain reads (<span className="font-mono text-[#33544C]">getThreshold / getOwners / VERSION / nonce / getModulesPaginated / guard-slot</span>) at{" "}
                  <span className="font-mono text-[#33544C]">{data.safeVerification.safeAddress}</span>. Expected: {data.safeVerification.expected}.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {Object.entries(data.safeVerification.chains).map(([key, c]) => (
                    <div key={key} className="rounded-xl border border-[#E3EAE6] bg-[#F7FAF8] p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-[#0E1F1B]">{c.name}</span>
                        <Pill tone={c.verdict === "CRITICAL FINDING" ? "rose" : "amber"}>{c.verdict}</Pill>
                        <span className="font-mono text-[10px] text-[#7A8C86]">block {c.blockNumber.toLocaleString("en-US")}</span>
                      </div>
                      <table className="w-full text-left text-[11px]">
                        <tbody>
                          <tr className="border-t border-[#E3EAE6]"><td className="py-1 pr-2 text-[#5B6E68]">getThreshold()</td><td className="py-1 text-right font-mono text-rose-600">{c.findings.threshold} <span className="text-[#7A8C86]">(expected 4)</span></td></tr>
                          <tr className="border-t border-[#E3EAE6]"><td className="py-1 pr-2 text-[#5B6E68]">getOwners()</td><td className="py-1 text-right font-mono text-rose-600">{c.findings.ownersCount} <span className="text-[#7A8C86]">(expected 7)</span></td></tr>
                          <tr className="border-t border-[#E3EAE6]"><td className="py-1 pr-2 text-[#5B6E68]">sole owner</td><td className="py-1 text-right font-mono text-[10px] text-[#33544C]">{c.findings.owners[0]}</td></tr>
                          <tr className="border-t border-[#E3EAE6]"><td className="py-1 pr-2 text-[#5B6E68]">VERSION()</td><td className="py-1 text-right font-mono text-[#33544C]">{c.findings.version} <span className="text-[#7A8C86]">(Safe proxy, {c.findings.codeBytes} B)</span></td></tr>
                          <tr className="border-t border-[#E3EAE6]"><td className="py-1 pr-2 text-[#5B6E68]">nonce()</td><td className="py-1 text-right font-mono text-[#33544C]">{c.findings.nonce} <span className="text-[#7A8C86]">(never executed)</span></td></tr>
                          <tr className="border-t border-[#E3EAE6]"><td className="py-1 pr-2 text-[#5B6E68]">modules / guard</td><td className="py-1 text-right font-mono text-[#33544C]">{c.findings.modulesCount} / {c.findings.guardIsZero ? "address(0)" : "set"}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-rose-600/90">
                  Corrective action before Gate 5: constitute the 7 Constitutional signers, set threshold 4, then re-run{" "}
                  <span className="font-mono">scripts/verify-safe.ts</span> for the VERIFIED 4/7 milestone. The sole owner is the deployer EOA —
                  the repo&rsquo;s “reported 4/7” posture is disproven on-chain. Supplemental: three live MTQ token contracts per chain (C-041) +
                  Ecosystem-JSON “Safes” are not Safes (C-042) + the Safe has NEVER held any asset — the full 1,000,000 genesis supply of the
                  cross-chain “MTQΣ” token sits in the deployer EOA (C-043, balance re-verification 2026-10-19).
                </p>
                <p className="mt-2 text-[10px] text-[#7A8C86]">Evidence: {data.safeVerification.evidence}</p>
              </>
            ) : (
              <p className="text-xs text-[#5B6E68]">The live verification evidence file is not present in this environment.</p>
            )}
          </Panel>
        </Reveal>
      )}

      {/* ---- Ext-3 A.4: OD-34 per-chain oracle feed configuration ---- */}
      {data?.oracleFeeds && (
        <Reveal delay={0.18}>
          <Panel className="p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Radar className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold tracking-wide text-[#0E1F1B]">Per-Chain Oracle Feed Configuration (OD-34 / T-86 / Ext-3 A.4)</h3>
              <Pill tone="emerald">{data.oracleFeeds.counts.section1710Pairs} §17.10 pairs</Pill>
              <Pill tone="gold">≥{data.oracleFeeds.counts.requiredIndependentFamiliesPerPair} families/pair</Pill>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
              <div className="rounded-xl border border-[#E3EAE6] bg-[#F7FAF8] p-3">
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#5B6E68]">Staleness classes (§17.3.1)</h4>
                <table className="w-full text-left text-[11px]">
                  <tbody>
                    {data.oracleFeeds.stalenessTable.map((s, i) => (
                      <tr key={i} className="border-t border-[#E3EAE6]">
                        <td className="py-1 pr-2 font-mono text-[#33544C]">{s.feedClass ?? "construct"}</td>
                        <td className="py-1 text-[#5B6E68]">{s.stalenessSeconds != null ? `${s.stalenessSeconds}s` : "n/a"}</td>
                        <td className="py-1 text-right font-mono text-[10px] text-[#7A8C86]">{s.pairs.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[10px] leading-relaxed text-[#7A8C86]">
                  Deviation breaker {data.oracleFeeds.validation.deviationBreakerPct}% · correlation warning {data.oracleFeeds.validation.correlationThresholdPct}% after {data.oracleFeeds.validation.correlationWarningAfterUpdates} updates (§17.9).
                </p>
              </div>
              <div className="rounded-xl border border-[#E3EAE6] bg-[#F7FAF8] p-3">
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#5B6E68]">On-chain Oracle.sol deployments (protocol-owner)</h4>
                <table className="w-full text-left text-[11px]">
                  <tbody>
                    {data.oracleFeeds.chains.map((c) => (
                      <tr key={c.id} className="border-t border-[#E3EAE6] align-top">
                        <td className="py-1.5 pr-2 text-[#0E1F1B]">{c.label}</td>
                        <td className="py-1.5 pr-2 font-mono text-[10px] text-[#5B6E68]">{c.onChainOracle ?? "—"}</td>
                        <td className="py-1.5 text-right">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            c.codeStatus === "verified-present" ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                              : c.codeStatus === "existence-unverified" ? "text-amber-600 border-amber-200 bg-amber-50"
                              : "text-[#33544C] border-[#E3EAE6] bg-[#F7FAF8]"}`}>
                            {c.codeStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[10px] leading-relaxed text-[#7A8C86]">
                  ABI unpublished → real-vs-mock feed contents UNDETERMINED; adapter families compiled, not deployed. Arc: USDC/USD = 1.0 by construction (native gas).
                </p>
              </div>
            </div>
            <div className="mt-3 max-h-24 overflow-y-auto mtqs-scroll rounded-xl border border-[#E3EAE6] bg-[#F7FAF8] p-2">
              <ul className="space-y-0.5">
                {data.oracleFeeds.limitations.slice(0, 4).map((l, i) => (
                  <li key={i} className="text-[10px] leading-relaxed text-[#7A8C86]">• {l}</li>
                ))}
              </ul>
            </div>
          </Panel>
        </Reveal>
      )}

      {/* ---- Ext-3 A.7: OD-37 token standard ---- */}
      {data?.tokenStandard && (
        <Reveal delay={0.19}>
          <Panel className="p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Coins className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold tracking-wide text-[#0E1F1B]">MTQ Token Standard (OD-37 / T-88 / Ext-3 A.7)</h3>
              <Pill tone="emerald">{data.tokenStandard.standard}</Pill>
              {data.tokenStandard.compile.zeroErrors && <Pill tone="emerald">compiled · 0 errors</Pill>}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-[#E3EAE6] bg-[#F7FAF8] p-3 text-[11px] leading-relaxed text-[#33544C]">
                <strong className="text-[#0E1F1B]">Implemented inline (MTQSigmaV3.sol §1.b)</strong>
                <p className="mt-1 text-[#5B6E68]">EIP-2612 permit + nonces + DOMAIN_SEPARATOR; Checkpoint-based ERC20Votes: delegate / delegateBySig / getVotes / getPastVotes / getPastTotalSupply (IERC-5805/6372).</p>
              </div>
              <div className="rounded-xl border border-[#E3EAE6] bg-[#F7FAF8] p-3 text-[11px] leading-relaxed text-[#33544C]">
                <strong className="text-[#0E1F1B]">Posture (Ext-3 A.7)</strong>
                <p className="mt-1 text-[#5B6E68]">Transfer restrictions: {data.tokenStandard.posture.transferRestrictions}. Supply cap: {data.tokenStandard.posture.supplyCap}. Upgradeability: {data.tokenStandard.posture.upgradeability}.</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-600">
                <strong className="flex items-center gap-1 text-amber-700"><FileWarning className="h-3 w-3" /> EIP-170 size flag</strong>
                <p className="mt-1 text-amber-600/80">Runtime {data.tokenStandard.eip170.runtimeBytes.toLocaleString("en-US")} B &gt; {data.tokenStandard.eip170.limitBytes.toLocaleString("en-US")} B limit. {data.tokenStandard.eip170.note}</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-[#7A8C86]">
              Compile: {data.tokenStandard.compile.compiler}, optimizer runs {data.tokenStandard.compile.optimizerRuns}, zero errors; storage layout unchanged ({data.tokenStandard.compile.appendedSlots} appended slots). NOT deployed on-chain — deployment + third-party audit pending. Doc: <span className="font-mono text-[#5B6E68]">{data.tokenStandard.doc}</span>.
            </p>
          </Panel>
        </Reveal>
      )}

      {/* ---- Registers ---- */}
      {data && (
        <Reveal delay={0.2}>
          <Panel className="p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <ScrollText className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold tracking-wide text-[#0E1F1B]">Consolidated Registers</h3>
              <div className="ml-auto flex gap-1 rounded-full border border-[#E3EAE6] bg-[#F7FAF8] p-1">
                {([["od", "Open Decisions", Gavel], ["conflicts", "Conflicts", AlertTriangle], ["tests", "Test Matrix", ListChecks]] as const).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition ${tab === id ? "bg-emerald-100 text-emerald-600" : "text-[#5B6E68] hover:text-[#0E1F1B]"}`}
                    aria-pressed={tab === id}
                  >
                    <Icon className="h-3 w-3" /> {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto mtqs-scroll">
              <table className="w-full text-left text-xs">
                {tab === "od" && (
                  <>
                    <thead className="sticky top-0 bg-[#F7FAF8] text-[11px] uppercase tracking-wider text-[#5B6E68]">
                      <tr><th className="px-2 py-2">ID</th><th className="px-2 py-2">Decision</th><th className="px-2 py-2">Owner</th><th className="px-2 py-2">Blocks</th><th className="px-2 py-2">Status</th></tr>
                    </thead>
                    <tbody>
                      {data.registers.openDecisions.map((od) => (
                        <tr key={od.id} className="border-t border-[#E3EAE6] align-top">
                          <td className="px-2 py-1.5 font-mono text-amber-600">{od.id}</td>
                          <td className="px-2 py-1.5 text-[#0E1F1B]">
                            {od.decision}
                            <div className="mt-0.5 text-[11px] leading-snug text-[#7A8C86]">{od.note}{od.codeRef ? <span className="font-mono text-[#9AA9A3]"> · {od.codeRef}</span> : null}</div>
                          </td>
                          <td className="px-2 py-1.5 text-[#5B6E68]">{od.owner}</td>
                          <td className="px-2 py-1.5 text-[#5B6E68]">{od.blocks}</td>
                          <td className="px-2 py-1.5"><span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone(od.status)}`}>{od.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
                {tab === "conflicts" && (
                  <>
                    <thead className="sticky top-0 bg-[#F7FAF8] text-[11px] uppercase tracking-wider text-[#5B6E68]">
                      <tr><th className="px-2 py-2">ID</th><th className="px-2 py-2">Conflict</th><th className="px-2 py-2">Resolution</th><th className="px-2 py-2">Code</th></tr>
                    </thead>
                    <tbody>
                      {data.registers.conflicts.map((c) => (
                        <tr key={c.id} className="border-t border-[#E3EAE6] align-top">
                          <td className="px-2 py-1.5 font-mono text-amber-600">{c.id}</td>
                          <td className="px-2 py-1.5 text-[#0E1F1B]">{c.conflict}</td>
                          <td className="px-2 py-1.5 text-[#5B6E68]">{c.resolution}</td>
                          <td className="px-2 py-1.5 font-mono text-[10px] text-[#7A8C86]">{c.codeRef ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
                {tab === "tests" && (
                  <>
                    <thead className="sticky top-0 bg-[#F7FAF8] text-[11px] uppercase tracking-wider text-[#5B6E68]">
                      <tr><th className="px-2 py-2">ID</th><th className="px-2 py-2">Test</th><th className="px-2 py-2">Expected</th><th className="px-2 py-2">Status</th></tr>
                    </thead>
                    <tbody>
                      {data.registers.tests.map((t) => (
                        <tr key={t.id} className="border-t border-[#E3EAE6] align-top">
                          <td className="px-2 py-1.5 font-mono text-amber-600">{t.id}</td>
                          <td className="px-2 py-1.5 text-[#0E1F1B]">
                            {t.test}
                            {t.codeRef ? <div className="mt-0.5 font-mono text-[10px] text-[#9AA9A3]">{t.codeRef}</div> : null}
                          </td>
                          <td className="px-2 py-1.5 text-[#5B6E68]">{t.expected}</td>
                          <td className="px-2 py-1.5"><span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone(t.status)}`}>{t.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <Stat label="Unit-tested" value={String(r?.testsUnitTested ?? 0)} sub="vectors asserted" />
              <Stat label="Implemented" value={String(r?.testsImplemented ?? 0)} sub="code mapped" />
              <Stat label="Shadow-observed" value={String(r?.testsShadow ?? 0)} sub="recorded, not executed" />
              <Stat label="Not demonstrated" value={String(r?.testsNotDemonstrated ?? 0)} sub="needs chain/Committee" />
              <Stat label="Demonstrated-failed" value={String(r?.testsDemonstratedFailed ?? 0)} sub="performed; expected NOT met" />
              <Stat label="Deferred G5/G7" value={String(r?.testsDeferred ?? 0)} sub="out of gate scope" />
              <Stat label="Objective" value="candidate" sub={data.objectiveVersions.jsTradeGate} />
            </div>
          </Panel>
        </Reveal>
      )}

      <Reveal delay={0.25}>
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[#7A8C86]">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600/70" />
          Honest status (v5.0 §0.4): testnet deployments, simulated trades, and passing unit vectors are NOT evidence of
          production readiness. The path to production runs Gate 1 → Gate 6 in order, with Committee approvals and
          governance signatures at each gate.
        </p>
      </Reveal>
    </div>
  );
}
