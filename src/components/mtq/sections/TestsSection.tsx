// MTQΣ — Tests Section
// Fetch /api/tests on mount · verdict banner (PASS/FAIL) · 8 suite cards (survival
// rate + worst min RR) · invariants list · findings list · methodology disclosure
// · re-run button (calls /api/tests?force=1).
//
// Props: { onNavigate }.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  TestTube,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FlaskConical,
  ArrowRight,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { Panel, Reveal, Pill, GlowDot, SectionHeading, Skeleton } from "@/components/mtq/primitives";
import type { SectionId } from "@/components/mtq/Navigation";

/* ---------- API response shape ---------- */
interface SuiteResult {
  id: string;
  scenario: string;
  days: number;
  minRR: number;
  survived: boolean;
  endStatus: string;
}
interface SuiteSummary {
  survivalRate: number;
  meanMinRR: number;
  worstMinRR: number;
  meanDaysInStress: number;
  meanTimeToRecover: number;
  pegStabilityPct: number;
}
interface Suite {
  id: string;
  name: string;
  description: string;
  runs: number;
  results: SuiteResult[];
  summary: SuiteSummary;
}
interface AuditFinding {
  severity: string;
  title: string;
  detail: string;
}
interface Audit {
  title: string;
  generatedAt: string;
  totalRuns: number;
  overallVerdict: string;
  invariantsTested: string[];
  findings: AuditFinding[];
}
interface TestsResp {
  suites: Suite[];
  generatedAt?: string;
  totalRuns?: number;
  elapsedMs?: number;
  cached?: boolean;
  audit?: Audit;
  error?: string;
}

export function TestsSection({ onNavigate: _onNavigate }: { onNavigate: (id: SectionId) => void }) {
  const [data, setData] = useState<TestsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);
  const mountedRef = useRef(true);

  const fetchTests = useCallback(async (force?: boolean) => {
    setLoading(true);
    try {
      const url = force ? "/api/tests?force=1" : "/api/tests";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TestsResp;
      if (mountedRef.current) setData(json);
    } catch (e) {
      if (mountedRef.current) setData({ error: String(e).slice(0, 200) } as TestsResp);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRerunning(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchTests();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchTests]);

  const handleRerun = useCallback(async () => {
    setRerunning(true);
    toast.success("Re-running Monte Carlo suite…", { description: "10,300 runs across 8 suites" });
    await fetchTests(true);
    toast.success("Tests re-run complete", { description: "Fresh results loaded" });
  }, [fetchTests]);

  const suites = data?.suites ?? [];
  const audit = data?.audit;
  const verdict = audit?.overallVerdict;
  const isPass = (verdict ?? "").toUpperCase().startsWith("PASS");
  const invariants = audit?.invariantsTested ?? [];
  const findings = audit?.findings ?? [];
  const totalRuns = audit?.totalRuns ?? data?.totalRuns ?? 0;

  return (
    <div className="space-y-12">
      <SectionHeading
        eyebrow="Monte Carlo · 10,300 runs"
        title="Tests — Survival Audit Suite"
        right={
          <Pill tone={data?.cached ? "muted" : "gold"}>
            <GlowDot color={data?.cached ? "gold" : "emerald"} size="h-1.5 w-1.5" />
            {data?.cached ? "cached" : "fresh"}
          </Pill>
        }
      />

      {/* Intro + methodology disclosure */}
      <Reveal>
        <Panel className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <TestTube className="h-5 w-5 text-mtqs-gold/80 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[0.82rem] text-white/40 leading-relaxed">
              The Monte Carlo audit runs 10,300 survival simulations across 8 stress suites. Each
              suite seeds the protocol with realistic shocks (depeg cascade, oracle failure,
              liquidity crisis, hyperinflation, depression, black swan) and runs the full §3-§14
              engine forward 90-180 days. A run &ldquo;survives&rdquo; if the Reserve Ratio never
              breaches the hard floor (RR ≥ 1.00). The audit verdict aggregates all 8 suites.
            </p>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-3 text-[0.7rem] text-white/40 leading-relaxed">
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75 mb-1">
              Methodology disclosure
            </div>
            <ul className="space-y-1.5">
              <li>
                <span className="text-mtqs-gold/70 font-mono">·</span> Each suite runs N independent
                Monte Carlo simulations; results are aggregated into a survival rate, mean and
                worst-case minimum RR, mean days in stress, and mean time to recover.
              </li>
              <li>
                <span className="text-mtqs-gold/70 font-mono">·</span> Simulations use stochastic FX,
                VIX, DXY, and depeg processes consistent with the blueprint §6 / §11 ranges. F3
                (VIX/DXY simulated, not real-market) is an honest informational finding.
              </li>
              <li>
                <span className="text-mtqs-gold/70 font-mono">·</span> A run is &ldquo;failed&rdquo; if RR
                drops below 1.00 at any tick. The 110% buffer is designed to absorb all tested
                shocks without breaching the hard floor.
              </li>
              <li>
                <span className="text-mtqs-gold/70 font-mono">·</span> The audit is cached in
                <span className="font-mono"> src/lib/mtq/test-results.json</span>. Use the re-run
                button below to execute the full suite live.
              </li>
            </ul>
          </div>
        </Panel>
      </Reveal>

      {/* Loading state */}
      {loading && !data ? (
        <Reveal>
          <Panel className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <RefreshCw className="h-4 w-4 text-mtqs-gold animate-spin" aria-hidden="true" />
              <span className="text-[0.78rem] text-white/40">Loading audit results…</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-md" />
              ))}
            </div>
          </Panel>
        </Reveal>
      ) : data?.error ? (
        <Reveal>
          <Panel variant="rose" className="p-5">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-mtqs-rose mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <div className="text-sm font-semibold text-white/90 mb-1">
                  Failed to load tests
                </div>
                <div className="font-mono text-[0.72rem] text-mtqs-rose/80">{data.error}</div>
                <button
                  onClick={handleRerun}
                  disabled={rerunning}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-mtqs-gold/40 bg-mtqs-gold/10 px-3 py-1.5 text-[0.72rem] font-medium text-mtqs-gold-light hover:bg-mtqs-gold/20 transition disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${rerunning ? "animate-spin" : ""}`} aria-hidden="true" />
                  {rerunning ? "Re-running…" : "Re-run suite"}
                </button>
              </div>
            </div>
          </Panel>
        </Reveal>
      ) : (
        <>
          {/* Verdict banner */}
          <Reveal>
            <Panel
              variant={isPass ? "emerald" : "rose"}
              className="p-5 sm:p-6"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3">
                  {isPass ? (
                    <CheckCircle2 className="h-7 w-7 text-mtqs-emerald mt-0.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <XCircle className="h-7 w-7 text-mtqs-rose mt-0.5 shrink-0" aria-hidden="true" />
                  )}
                  <div>
                    <div className="text-[0.6rem] uppercase tracking-[0.22em] text-white/40/75 mb-1">
                      Overall verdict
                    </div>
                    <div
                      className={`mtqs-display text-2xl sm:text-3xl font-semibold ${
                        isPass ? "text-mtqs-emerald" : "text-mtqs-rose"
                      }`}
                    >
                      {isPass ? "PASS" : "FAIL"}
                    </div>
                    <p className="mt-1 text-[0.78rem] text-white/40 leading-relaxed max-w-2xl">
                      {verdict ?? "No verdict available."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Pill tone={isPass ? "emerald" : "rose"}>
                    <GlowDot color={isPass ? "emerald" : "rose"} size="h-1.5 w-1.5" />
                    {totalRuns.toLocaleString()} runs
                  </Pill>
                  <Pill tone="gold">
                    <FlaskConical className="h-3 w-3" aria-hidden="true" />
                    {suites.length} suites
                  </Pill>
                </div>
              </div>
              {/* Re-run button */}
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between gap-2">
                <div className="text-[0.68rem] text-white/40">
                  {data?.cached
                    ? "Showing cached results. Re-run to execute the full 10,300-run suite live."
                    : "Showing fresh results from the live Monte Carlo run."}
                </div>
                <button
                  onClick={handleRerun}
                  disabled={rerunning}
                  className="inline-flex items-center gap-1.5 rounded-md border border-mtqs-gold/40 bg-mtqs-gold/10 px-3.5 py-2 text-[0.74rem] font-medium text-mtqs-gold-light hover:bg-mtqs-gold/20 hover:border-mtqs-gold/60 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${rerunning ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  {rerunning ? "Re-running…" : "Re-run suite"}
                </button>
              </div>
            </Panel>
          </Reveal>

          {/* 8 suite cards */}
          <section aria-labelledby="tests-suites">
            <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">suites</div>
                <h3 className="mt-2 text-base font-semibold text-white">Stress Suite Results</h3>
              </div>
              <Pill tone="muted">{suites.length} suites</Pill>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {suites.map((s, i) => {
                const sr = s.summary?.survivalRate ?? 0;
                const wrr = s.summary?.worstMinRR ?? 0;
                const survived = sr >= 1.0;
                const tone =
                  sr >= 1.0 && wrr >= 1.1
                    ? "emerald"
                    : sr >= 1.0 && wrr >= 1.0
                    ? "amber"
                    : "rose";
                return (
                  <Reveal key={s.id} delay={(i % 4) * 0.04}>
                    <Panel className="p-4 h-full flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/40/75">
                            {s.id}
                          </div>
                          <div className="text-sm font-semibold text-white/90 truncate">
                            {s.name}
                          </div>
                        </div>
                        {survived ? (
                          <CheckCircle2 className="h-4 w-4 text-mtqs-emerald shrink-0" aria-hidden="true" />
                        ) : (
                          <XCircle className="h-4 w-4 text-mtqs-rose shrink-0" aria-hidden="true" />
                        )}
                      </div>
                      <div className="text-[0.68rem] text-white/40 leading-relaxed">
                        {s.description}
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-2 text-[0.7rem]">
                        <div className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-2">
                          <div className="text-[0.55rem] uppercase tracking-[0.18em] text-white/40">
                            Survival
                          </div>
                          <div
                            className={`font-mono text-sm font-semibold ${
                              tone === "emerald"
                                ? "text-mtqs-emerald"
                                : tone === "amber"
                                ? "text-mtqs-amber"
                                : "text-mtqs-rose"
                            }`}
                          >
                            {(sr * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-2">
                          <div className="text-[0.55rem] uppercase tracking-[0.18em] text-white/40">
                            Worst min RR
                          </div>
                          <div
                            className={`font-mono text-sm font-semibold ${
                              wrr >= 1.1
                                ? "text-mtqs-emerald"
                                : wrr >= 1.0
                                ? "text-mtqs-amber"
                                : "text-mtqs-rose"
                            }`}
                          >
                            {(wrr ?? 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-auto flex items-center justify-between text-[0.6rem] text-white/40/65 font-mono">
                        <span>{s.runs.toLocaleString()} runs</span>
                        <span>peg {((s.summary?.pegStabilityPct ?? 0) * 100).toFixed(0)}%</span>
                      </div>
                    </Panel>
                  </Reveal>
                );
              })}
            </div>
          </section>

          {/* Invariants tested */}
          <section aria-labelledby="tests-invariants">
            <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">invariants</div>
                <h3 className="mt-2 text-base font-semibold text-white">Invariants Tested</h3>
              </div>
              <Pill tone="emerald">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                {invariants.length} invariants
              </Pill>
            </div>
            <Reveal>
              <Panel className="p-5">
                {invariants.length === 0 ? (
                  <div className="text-center text-[0.75rem] text-white/40 py-4">
                    No invariants loaded.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {invariants.map((inv, i) => (
                      <motion.span
                        key={inv}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.03 }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-mtqs-emerald/30 bg-mtqs-emerald/5 px-3 py-1.5 text-[0.7rem] font-mono text-mtqs-emerald"
                      >
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        {inv}
                      </motion.span>
                    ))}
                  </div>
                )}
              </Panel>
            </Reveal>
          </section>

          {/* Findings */}
          <section aria-labelledby="tests-findings">
            <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">findings</div>
                <h3 className="mt-2 text-base font-semibold text-white">Audit Findings</h3>
              </div>
              <Pill tone="emerald">
                <Activity className="h-3 w-3" aria-hidden="true" />
                {findings.length} findings
              </Pill>
            </div>
            <Reveal>
              <Panel className="p-5">
                {findings.length === 0 ? (
                  <div className="text-center text-[0.75rem] text-white/40 py-4">
                    No findings loaded (the audit response may not include <code>audit.findings</code>).
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-md border border-white/[0.06]">
                    <div className="max-h-80 overflow-y-auto mtqs-scroll">
                      <table className="w-full text-[0.72rem]">
                        <thead className="bg-white/[0.03]/[0.02] text-white/40 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">Finding</th>
                            <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Detail</th>
                            <th className="text-right px-3 py-2 font-medium">Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {findings.map((f, i) => {
                            const isOk = (f.severity ?? "").toUpperCase() === "PASS";
                            return (
                              <tr
                                key={f.title + i}
                                className={`border-t border-white/[0.06] ${i % 2 ? "bg-white/[0.03]/[0.01]" : ""}`}
                              >
                                <td className="px-3 py-2.5 text-white/90">{f.title}</td>
                                <td className="px-3 py-2.5 text-white/40/75 font-mono hidden sm:table-cell">
                                  {f.detail}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  <Pill tone={isOk ? "emerald" : "rose"}>
                                    {isOk ? (
                                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                    ) : (
                                      <XCircle className="h-3 w-3" aria-hidden="true" />
                                    )}
                                    {f.severity}
                                  </Pill>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Panel>
            </Reveal>
          </section>

          {/* Closing */}
          <Reveal>
            <Panel className="p-5 sm:p-6 text-center">
              <p className="text-[0.82rem] text-white/40 leading-relaxed max-w-2xl mx-auto mb-4">
                Audit complete. For the honest disclosure of what these results mean (and don&apos;t
                mean), read the Security section. For the live protocol state driving the engine,
                open the Dashboard.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => _onNavigate("security")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03]/[0.03] px-4 py-2 text-[0.78rem] font-medium text-white hover:border-mtqs-gold/30 hover:text-white transition"
                >
                  Security Posture
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => _onNavigate("dashboard")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03]/[0.03] px-4 py-2 text-[0.78rem] font-medium text-white hover:border-mtqs-gold/30 hover:text-white transition"
                >
                  Live Dashboard
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </Panel>
          </Reveal>
        </>
      )}
    </div>
  );
}
