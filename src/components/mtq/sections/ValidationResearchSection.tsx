// MTQΣ — Validation & Research Program Section (Blueprint v2.0 · Ch 23)
//
// Chapter 23 is a PRODUCTION PRECONDITION, not an appendix: no adaptive
// component may govern a live monetary reference until the full program has
// been executed, documented, independently reproduced and passed [MS §79].
// This section renders:
//   §23.1 the methodology + the negative rule (old-architecture figures are
//          NOT evidence),
//   the LIVE §23 stress matrix from /api/validation (S1–S11 deterministic
//          Monte Carlo / stress / perturbation, reference engine),
//   §23.5 the seven Monte Carlo generator families,
//   §23.4 purged + embargoed leakage discipline,
//   §23.7 the model-selection criterion,
//   and the honest split: what the reference engine already exercises vs what
//   the full program still requires before §23.12/§25.5 gates can run.
//
// Live data: GET /api/validation (built by the backend agent). If the endpoint
// is unavailable, an honest error panel is shown — NO stress data is faked.
//
// Props: { onNavigate, snapshot } — shared section contract.

"use client";

import { useEffect, useState } from "react";
import {
  Panel,
  Reveal,
  Pill,
  GlowDot,
  SectionHeading,
  MiniBar,
  Skeleton,
} from "@/components/mtq/primitives";
import type { SectionId } from "@/components/mtq/Navigation";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import {
  ShieldAlert,
  Ban,
  Eye,
  FlaskConical,
  Beaker,
  Lock,
  Target,
  GitBranch,
  ArrowRight,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";

/* ---------- /api/validation response shape (backend contract) ---------- */
interface ValidationResultDto {
  scenario: string;
  description: string;
  runs: number;
  survivalRate: number; // fraction of runs that survived
  meanMinRR: number;
  worstMinRR: number;
  meanTimeToRecover: number;
  pegStabilityPct: number;
  finalStatus: string;
  worstStatus: string;
  breachCount: number;
  notes: string[] | string;
}

interface ValidationAuditDto {
  overallVerdict: string;
  scenarioVerdicts: { scenario: string; severity: string; survivalRate: number; worstMinRR: number }[];
  // Contract says { scenario, section }; the live API also carries name /
  // blueprintSection aliases + counts — all handled defensively.
  blueprintMapping: { scenario: string; name?: string; section?: string; blueprintSection?: string }[];
  disclosure: string;
  passCount?: number;
  warnCount?: number;
  failCount?: number;
}

interface ValidationDto {
  results: ValidationResultDto[];
  generatedAt: string | number;
  totalRuntimeMs: number;
  cached: boolean;
  audit: ValidationAuditDto;
}

/* ---------- §23.5 Monte Carlo generator families (blueprint table) ---------- */
const MC_FAMILIES: { family: string; generator: string; attacks: string }[] = [
  {
    family: "Historical block bootstrap",
    generator: "Resampled blocks of joint currency/gold returns, preserving short-horizon dependence.",
    attacks: "That the future resembles reordered history.",
  },
  {
    family: "Parametric Gaussian",
    generator: "Multivariate normal with the shrunk covariance of §6.2.",
    attacks: "Behavior under idealized, thin-tailed dynamics.",
  },
  {
    family: "Fat-tailed",
    generator: "Multivariate Student-t with heavy degrees of freedom.",
    attacks: "That tails are Gaussian-sized.",
  },
  {
    family: "Regime-switching",
    generator: "Markov switching among the six regimes of §5.4 with stress transitions.",
    attacks: "That regimes arrive gently and rarely.",
  },
  {
    family: "Jump / crisis",
    generator: "Jump-diffusion paths with synchronized FX and gold jumps.",
    attacks: "That moves are continuous.",
  },
  {
    family: "Correlation collapse",
    generator: "Paths with ρ_ij → 1.",
    attacks: "That diversification persists when needed (§23.9).",
  },
  {
    family: "Purchasing-power drift",
    generator: "Paths with persistent divergence between currency returns and the GPP index.",
    attacks: "That purchasing-power tracking is easy.",
  },
];

/* ---------- Shared bordered table shell (DocsSection pattern) ---------- */
function BorderedTable({
  headers,
  rows,
  maxHeight = "max-h-96",
}: {
  headers: React.ReactNode[];
  rows: React.ReactNode[][];
  maxHeight?: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[#E3EAE6]">
      <div className={`${maxHeight} overflow-y-auto mtqs-scroll`}>
        <table className="w-full text-[0.74rem]">
          <thead className="bg-[#F7FAF8] text-[#5B6E68] sticky top-0">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="text-left px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className={`border-t border-[#E3EAE6] ${ri % 2 ? "bg-[#F7FAF8]" : ""}`}
              >
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2.5 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Formula line styling ---------- */
function Formula({ children }: { children: React.ReactNode }) {
  return (
    <code className="block font-mono text-[0.78rem] sm:text-[0.85rem] text-mtqs-gold-light bg-[#F7FAF8] border border-[#E3EAE6] rounded-md px-4 py-3 overflow-x-auto whitespace-nowrap">
      {children}
    </code>
  );
}

/* ---------- Verdict badge from audit severity ---------- */
function VerdictBadge({ severity }: { severity: string | undefined }) {
  const s = (severity ?? "").toUpperCase();
  if (s.startsWith("PASS")) {
    return (
      <Pill tone="emerald">
        <GlowDot color="emerald" size="h-1.5 w-1.5" />
        PASS
      </Pill>
    );
  }
  if (s.startsWith("WARN")) {
    return (
      <Pill tone="amber">
        <GlowDot color="amber" size="h-1.5 w-1.5" />
        WARN
      </Pill>
    );
  }
  if (s.startsWith("FAIL")) {
    return (
      <Pill tone="rose">
        <GlowDot color="rose" size="h-1.5 w-1.5" />
        FAIL
      </Pill>
    );
  }
  return <Pill tone="muted">{severity || "—"}</Pill>;
}

/* ---------- Overall verdict badge (derive tone from counts / text) ---------- */
function OverallVerdictBadge({ audit }: { audit: ValidationAuditDto }) {
  const failCount =
    audit.failCount ?? Number(/(\d+)\s+FAIL/i.exec(audit.overallVerdict)?.[1] ?? 0);
  const warnCount =
    audit.warnCount ?? Number(/(\d+)\s+WARN/i.exec(audit.overallVerdict)?.[1] ?? 0);
  const passCount =
    audit.passCount ?? Number(/(\d+)\s+PASS/i.exec(audit.overallVerdict)?.[1] ?? 0);
  if (failCount > 0) {
    return (
      <Pill tone="rose">
        <GlowDot color="rose" size="h-1.5 w-1.5" />
        {failCount} FAIL · {passCount} PASS
      </Pill>
    );
  }
  if (warnCount > 0) {
    return (
      <Pill tone="amber">
        <GlowDot color="amber" size="h-1.5 w-1.5" />
        {warnCount} WARN · {passCount} PASS
      </Pill>
    );
  }
  return (
    <Pill tone="emerald">
      <GlowDot color="emerald" size="h-1.5 w-1.5" />
      ALL PASS
    </Pill>
  );
}

export function ValidationResearchSection({
  onNavigate,
  snapshot: _snapshot,
}: {
  onNavigate: (id: SectionId) => void;
  snapshot: MetricsSnapshot | null;
}) {
  const [data, setData] = useState<ValidationDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/validation", { cache: "no-store" });
        if (!res.ok) {
          if (mounted) setError(`HTTP ${res.status}`);
          return;
        }
        const dto = (await res.json()) as ValidationDto;
        if (mounted) {
          setData(dto);
          setError(null);
        }
      } catch (e) {
        if (mounted) setError(String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [retry]);

  // Look up the blueprint § mapping + verdict for a scenario row. The mapping
  // may key on the full scenario name OR the short id ("S1"); the section may
  // be `section` (contract) or `blueprintSection` (live API).
  const sectionFor = (scenario: string) => {
    const map = data?.audit?.blueprintMapping ?? [];
    const norm = (s: string) => s.trim().toLowerCase();
    const m =
      map.find((x) => norm(x.scenario) === norm(scenario)) ??
      map.find((x) => norm(x.name ?? "") === norm(scenario)) ??
      // Word-boundary prefix (mapping may key on the short id: "S1", "S10"…)
      map.find((x) => scenario === x.scenario || scenario.startsWith(`${x.scenario} `));
    return m ? (m.blueprintSection ?? m.section ?? "—") : "—";
  };
  const verdictFor = (scenario: string) =>
    data?.audit?.scenarioVerdicts?.find(
      (v) => v.scenario === scenario || v.scenario.trim().toLowerCase() === scenario.trim().toLowerCase(),
    )?.severity;

  return (
    <div className="space-y-10">
      {/* ============ §23 — header ============ */}
      <SectionHeading
        eyebrow="§23 · production precondition"
        title="Validation &amp; Research Program — §23"
        className="mb-0"
        right={
          <Pill tone="amber">
            <GlowDot color="amber" size="h-1.5 w-1.5" />
            PRODUCTION PRECONDITION · NOT PASSED
          </Pill>
        }
      />

      {/* ============ Truth banner — the three exact statements ============ */}
      <Reveal>
        <div className="rounded-xl border border-mtqs-amber/25 bg-mtqs-amber/[0.06] p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2.5">
            <Pill tone="amber" className="font-mono font-semibold tracking-widest">
              <FlaskConical className="h-3 w-3" aria-hidden="true" />
              TESTNET ONLY
            </Pill>
            <Pill tone="amber" className="font-mono font-semibold tracking-widest">
              <Eye className="h-3 w-3" aria-hidden="true" />
              SHADOW MODE ENFORCED
            </Pill>
            <Pill tone="rose" className="font-mono font-semibold tracking-widest">
              <Ban className="h-3 w-3" aria-hidden="true" />
              RESERVE TRADING NOT AUTHORIZED
            </Pill>
          </div>
          <p className="text-[0.76rem] text-amber-700 leading-relaxed">
            The validation program is not an appendix to the MTQΣ design — it is a production
            precondition [MS §79]. The §25.5 gates have not been conducted;{" "}
            <span className="text-[#0E1F1B] font-medium">
              no performance figure may be quoted as a measured property of MTQΣ (§23.1)
            </span>
            . Until the §23.12 gates pass, any performance figure must be labeled a prior or an
            illustrative projection — never a measured property of the system.
          </p>
        </div>
      </Reveal>

      {/* ============ §23.1 — methodology ============ */}
      <section id="validation-methodology" aria-labelledby="validation-methodology-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§23.1 · methodology"
          title="The Negative Rule &amp; Program Structure"
          className="mb-0"
          right={<Pill tone="gold">Perf(old) ⇏ Perf(MTQΣ)</Pill>}
        />
        <Reveal>
          <Panel className="p-5">
            <p className="text-[0.78rem] text-[#5B6E68] mb-3" id="validation-methodology-h">
              The starting point of the methodology is a{" "}
              <span className="text-[#0E1F1B]">negative rule</span>. Historical performance figures
              produced under the old architecture — approximately{" "}
              <span className="font-mono text-[#0E1F1B]">5.21% annualized volatility</span> and a
              maximum drawdown of{" "}
              <span className="font-mono text-[#0E1F1B]">−4.1%</span> — must{" "}
              <span className="text-rose-600 font-medium">not be presented as evidence for MTQΣ</span>,
              because they were calculated under the prior architecture: a fixed-quantity basket with
              a fixed gold percentage and a single-AMM gold price. That engine shared none of the
              live machinery of v2.0 — no constituency engine, no MASE multi-model ensemble, no
              multi-source oracle consensus, no MARP execution gates — so its statistics describe a
              different system answering a different question:
            </p>
            <Formula>Perf(old architecture) ⇏ Perf(MTQΣ)</Formula>
            <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[0.62rem]">
              <GitBranch className="h-3.5 w-3.5 text-mtqs-gold/70" aria-hidden="true" />
              <span className="uppercase tracking-[0.18em] text-[#7A8C86] mr-1">program structure</span>
              {[
                "backtest §23.2",
                "walk-forward §23.3",
                "purged / embargo §23.4",
                "Monte Carlo §23.5",
                "perturbation §23.6",
                "selection criterion §23.7",
                "stress suites §23.8–§23.11",
                "gates §23.12",
              ].map((s, i) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full border border-[#E3EAE6] bg-[#F7FAF8] font-mono text-[#5B6E68]">
                    {s}
                  </span>
                  {i < 7 && <span className="text-mtqs-gold/50" aria-hidden="true">→</span>}
                </span>
              ))}
            </div>
            <p className="text-[0.68rem] text-[#7A8C86] mt-3">
              Historical evidence comes from the backtest (§23.2) and walk-forward validation (§23.3),
              both executed under the leakage-control discipline of §23.4. Synthetic evidence comes
              from Monte Carlo testing (§23.5). Robustness evidence from the parameter perturbation
              study (§23.6). Model selection is governed by the criterion of §23.7, and adversarial
              evidence comes from the stress suites of §23.8–§23.11, all measured through the reserve
              stress equation. §23.12 consolidates the gate sequence; the gate table itself is
              maintained in §25.5. The discipline is the same as the no-fixed-weighting principle of
              §3.1: evidence about the composition is an output of transparent validation — it may
              not be asserted in advance of the machinery that produces it.
            </p>
          </Panel>
        </Reveal>
      </section>

      {/* ============ live §23 stress matrix (fetched) ============ */}
      <section id="validation-matrix" aria-labelledby="validation-matrix-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§23.5 – §23.11 · live reference engine"
          title="Live §23 Stress Matrix"
          className="mb-0"
          right={
            data ? (
              <Pill tone={data.cached ? "emerald" : "gold"}>
                <GlowDot color={data.cached ? "emerald" : "gold"} size="h-1.5 w-1.5" />
                {data.cached ? "cached · deterministic seeds" : "fresh run"}
              </Pill>
            ) : (
              <Pill tone="muted">S1–S11</Pill>
            )
          }
        />
        <Reveal>
          <Panel className="p-5">
            <p className="text-[0.76rem] text-[#5B6E68] mb-4" id="validation-matrix-h">
              The TS reference engine executes the §23.5–§23.11 scenario battery — Monte Carlo
              families, gold and currency stress, stable-value failures, correlation collapse and
              parameter perturbation — on deterministic seeded generators against the live pilot
              state. These results exercise the reference implementation; they are{" "}
              <span className="text-[#0E1F1B]">necessary but not sufficient</span> for the §23.12
              gates (see the remaining-program panel below).
            </p>

            {error ? (
              <div className="p-4 rounded-lg border border-rose-200 bg-rose-50">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="h-4 w-4 text-rose-600" aria-hidden="true" />
                  <span className="text-[0.8rem] font-semibold text-rose-700">
                    §23 stress matrix unavailable
                  </span>
                </div>
                <p className="text-[0.72rem] text-rose-600 mb-3">
                  /api/validation did not respond ({error}). No stress data is fabricated — the
                  blueprint program above remains the specification, and the matrix will render
                  once the stress engine endpoint is available.
                </p>
                <button
                  onClick={() => setRetry((r) => r + 1)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E3EAE6] bg-white text-[0.7rem] text-[#5B6E68] hover:bg-[#F0F7F4] transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Retry
                </button>
              </div>
            ) : !data ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[0.68rem] text-[#7A8C86] mb-1">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  Running / loading the deterministic §23 scenario battery…
                </div>
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-md" />
                ))}
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-md border border-[#E3EAE6]">
                  <div className="max-h-96 overflow-y-auto mtqs-scroll">
                    <table className="w-full text-[0.7rem]">
                      <thead className="bg-[#F7FAF8] text-[#5B6E68] sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Scenario</th>
                          <th className="text-left px-3 py-2 font-medium">§</th>
                          <th className="text-right px-3 py-2 font-medium">Runs</th>
                          <th className="text-left px-3 py-2 font-medium w-[15%]">Survival</th>
                          <th className="text-right px-3 py-2 font-medium">Worst min RR</th>
                          <th className="text-left px-3 py-2 font-medium">Final status</th>
                          <th className="text-left px-3 py-2 font-medium">Verdict</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.results.map((r, i) => (
                          <tr key={`${r.scenario}-${i}`} className="border-t border-[#E3EAE6]">
                            <td className="px-3 py-2.5">
                              <div className="font-semibold text-[#0E1F1B]">{r.scenario}</div>
                              <div className="text-[0.6rem] text-[#7A8C86] max-w-md leading-snug">
                                {r.description}
                              </div>
                              {r.breachCount > 0 && (
                                <div className="text-[0.58rem] font-mono text-rose-600 mt-0.5">
                                  {r.breachCount} breach run{r.breachCount === 1 ? "" : "s"} · worst state {r.worstStatus}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[0.62rem] text-mtqs-gold/80 whitespace-nowrap">
                              {sectionFor(r.scenario) ?? "—"}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-[#5B6E68]">{r.runs}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <MiniBar
                                  value={r.survivalRate}
                                  max={1}
                                  colorClass={
                                    r.survivalRate >= 0.99
                                      ? "bg-mtqs-emerald/70"
                                      : r.survivalRate >= 0.9
                                      ? "bg-mtqs-amber/70"
                                      : "bg-rose-500"
                                  }
                                  className="w-14"
                                />
                                <span className="font-mono text-[#33544C]">
                                  {(r.survivalRate * 100).toFixed(1)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-[#33544C]">
                              {Number.isFinite(r.worstMinRR) ? r.worstMinRR.toFixed(3) : "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="font-mono text-[0.64rem] text-[#5B6E68]">{r.finalStatus}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <VerdictBadge severity={verdictFor(r.scenario)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Run meta */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[0.66rem]">
                  <div className="p-2 rounded-lg bg-[#F7FAF8]">
                    <div className="text-[#7A8C86] text-[0.55rem] uppercase tracking-wider">Generated at</div>
                    <div className="font-mono text-[#33544C]">
                      {data.generatedAt != null
                        ? new Date(data.generatedAt).toISOString()
                        : "—"}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#F7FAF8]">
                    <div className="text-[#7A8C86] text-[0.55rem] uppercase tracking-wider">Total runtime</div>
                    <div className="font-mono text-[#33544C]">
                      {Number.isFinite(data.totalRuntimeMs) ? `${(data.totalRuntimeMs / 1000).toFixed(1)}s` : "—"}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#F7FAF8]">
                    <div className="text-[#7A8C86] text-[0.55rem] uppercase tracking-wider">Cache</div>
                    <div className="font-mono text-[#33544C]">{data.cached ? "cached" : "fresh"}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#F7FAF8]">
                    <div className="text-[#7A8C86] text-[0.55rem] uppercase tracking-wider">Scenarios</div>
                    <div className="font-mono text-[#33544C]">{data.results.length}</div>
                  </div>
                </div>

                {/* Audit verdict + disclosure — verbatim */}
                {data.audit && (
                  <div className="mt-3 p-4 rounded-lg border border-[#E3EAE6] bg-[#F7FAF8]">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <ClipboardCheck className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
                      <span className="text-[0.66rem] uppercase tracking-[0.18em] text-[#5B6E68]">
                        Audit verdict — verbatim
                      </span>
                      <OverallVerdictBadge audit={data.audit} />
                    </div>
                    <p className="text-[0.74rem] text-[#0E1F1B] font-medium mb-2">
                      {data.audit.overallVerdict}
                    </p>
                    <p className="text-[0.68rem] text-[#5B6E68] leading-relaxed border-l-2 border-mtqs-gold/30 pl-3">
                      {data.audit.disclosure}
                    </p>
                  </div>
                )}

                <p className="text-[0.6rem] text-[#7A8C86] mt-3">
                  cached deterministic seeds · re-runs available via{" "}
                  <span className="font-mono text-[#5B6E68]">?force=1</span> on the API. Survival =
                  fraction of runs with reserve ratio ≥ RR_HARD; worst min RR = the lowest reserve
                  ratio observed in any run.
                </p>
              </>
            )}
          </Panel>
        </Reveal>
      </section>

      {/* ============ §23.5 — Monte Carlo families ============ */}
      <section id="validation-montecarlo" aria-labelledby="validation-montecarlo-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§23.5 · synthetic evidence"
          title="Monte Carlo Generator Families"
          className="mb-0"
          right={<Pill tone="gold">7 families · {`{W_t^(k)} k=1..N`}</Pill>}
        />
        <Reveal>
          <Panel className="p-5">
            <p className="text-[0.76rem] text-[#5B6E68] mb-3" id="validation-montecarlo-h">
              Historical data contains one realized path; a monetary reference must survive the paths
              that did not happen. Monte Carlo testing generates N simulated paths under multiple
              distributions and regimes, and tests the stability of the live weight trajectory W_t
              under path variations [MS §83]. Each family is constructed so that it{" "}
              <span className="text-[#0E1F1B]">attacks a different assumption of the engine</span>, and
              each generator is versioned with the methodology so results are reproducible (§24.1):
            </p>
            <BorderedTable
              headers={["Family", "Generator", "Failure assumption attacked"]}
              rows={MC_FAMILIES.map((f) => [
                <span key="f" className="text-[#0E1F1B]">{f.family}</span>,
                <span key="g" className="text-[#5B6E68]">{f.generator}</span>,
                <span key="a" className="text-mtqs-amber/90">{f.attacks}</span>,
              ])}
            />
            <p className="text-[0.68rem] text-[#7A8C86] mt-3">
              For each family the program reports the dispersion of the weight trajectories, the
              distribution of turnover and execution cost, the drawdown distribution against the
              constitutional MDD envelope, and the reserve coverage distribution (§23.11). The
              stability requirement is not that W_t be constant — the architecture exists to let
              weights move — but that the distribution of outcomes remain inside the envelopes, the
              velocity limits and the cost budget across the path population. A model family whose
              behavior bifurcates under modest path variation is treated as non-robust by §23.7
              regardless of its mean performance.
            </p>
          </Panel>
        </Reveal>
      </section>

      {/* ============ §23.4 — leakage discipline ============ */}
      <section id="validation-leakage" aria-labelledby="validation-leakage-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§23.4 · leakage control"
          title="Purged &amp; Embargoed Validation"
          className="mb-0"
          right={<Pill tone="rose">binding rule [MS §82, COO-24]</Pill>}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Reveal>
            <Panel className="p-5 h-full">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-mtqs-gold/70" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0E1F1B]">The binding rule</h3>
              </div>
              <blockquote className="text-[0.72rem] text-[#5B6E68] leading-relaxed border-l-2 border-mtqs-rose/40 pl-3 mb-3" id="validation-leakage-h">
                &ldquo;All model calibration, feature construction, optimizer parameter selection and
                ensemble weighting shall be performed without access to future test-period
                information. For overlapping data, leakage controls and purging shall be applied
                where required.&rdquo; [COO-24]
              </blockquote>
              <p className="text-[0.7rem] text-[#5B6E68]">
                Walk-forward alone is not airtight when observations overlap: 756-day volatilities,
                long-window correlations, regime labels and ensemble performance scores can extend
                into or across the test period, quietly leaking future information into training.
                Four estimation targets receive the treatment explicitly —{" "}
                <span className="text-[#0E1F1B]">volatility, correlations, regimes, model ensemble
                weights</span> [MS §82] — because their long windows make them the natural leakage
                channels.
              </p>
            </Panel>
          </Reveal>
          <Reveal delay={0.05}>
            <Panel className="p-5 h-full">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="h-4 w-4 text-mtqs-gold/70" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0E1F1B]">Purging + embargo</h3>
              </div>
              <p className="text-[0.68rem] text-[#5B6E68] mb-2">
                <span className="text-[#0E1F1B]">Purging</span> removes from the training set any
                observation whose label window overlaps the test window — a 756-day volatility
                estimate whose window reaches into the test period is{" "}
                <span className="text-[#0E1F1B]">dropped, not truncated</span>:
              </p>
              <Formula>D_train^purged = {`{ τ : [τ, τ+h_label) ∩ [t, t+h_test) = ∅ }`}</Formula>
              <p className="text-[0.68rem] text-[#5B6E68] mt-3 mb-2">
                <span className="text-[#0E1F1B]">Embargo</span> then deletes a further block of
                training observations immediately following the test window, because serial
                correlation lets information cross the boundary even without literal overlap:
              </p>
              <Formula>Embargo: τ ∈ (t+h_test, t+h_test+h_embargo) excluded</Formula>
              <p className="text-[0.66rem] text-[#7A8C86] mt-3">
                h_embargo is set at least as long as the longest autocorrelation in the return and
                signal series — by default the <span className="font-mono">30-day</span> horizon —
                and is itself a published methodology parameter.
              </p>
            </Panel>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <div className="mt-4 rounded-lg border border-mtqs-rose/25 bg-mtqs-rose/[0.05] p-4">
            <p className="text-[0.72rem] text-rose-700 leading-relaxed">
              <span className="font-semibold text-rose-600">Why this matters enormously:</span> MTQΣ
              is intended to govern a monetary reference methodology [COO-24]. A leaked validation
              record does not merely flatter a trading strategy — it silently changes what is claimed
              about a <em>unit of account</em>. Every out-of-sample number in the evidence base
              inherits its credibility from this section, and any methodology version that cannot
              demonstrate purge and embargo discipline in its validation logs is{" "}
              <span className="font-semibold text-rose-600">inadmissible at the gates of §23.12</span>.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ============ §23.7 — model-selection criterion ============ */}
      <section id="validation-selection" aria-labelledby="validation-selection-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§23.7 · selection criterion"
          title="The Model-Selection Criterion"
          className="mb-0"
          right={<Pill tone="gold">stability, not return [MS §85]</Pill>}
        />
        <Reveal>
          <Panel className="p-5">
            <p className="text-[0.76rem] text-[#5B6E68] mb-3" id="validation-selection-h">
              When several candidate models, parameterizations or methodology versions compete, the
              winner is <span className="text-[#0E1F1B]">not the highest return</span>. Return is not
              the objective of a monetary reference; stability is. The decision function:
            </p>
            <Formula>
              Score = a(−Volatility) + b(−CVaR) + c(−MDD) + d(−PPError) + e(−Turnover) + f(−Cost) + g(Diversification) + h(Robustness)
            </Formula>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="p-3 rounded-lg border border-[#E3EAE6] bg-[#F7FAF8]">
                <div className="text-[0.62rem] uppercase tracking-[0.18em] text-[#7A8C86] mb-1">
                  Every term oriented so higher is more stable
                </div>
                <p className="text-[0.68rem] text-[#5B6E68] leading-relaxed">
                  Volatility, CVaR, maximum drawdown, purchasing-power error, turnover and cost enter
                  negatively; diversification and robustness enter positively. Coefficients a–h are
                  set by the Risk Council within constitutional envelopes, published with the
                  methodology version, and themselves subject to the §23.6 perturbation study — so
                  the ranking of models is not an artifact of the ranking weights.
                </p>
              </div>
              <div className="p-3 rounded-lg border border-[#E3EAE6] bg-[#F7FAF8]">
                <div className="text-[0.62rem] uppercase tracking-[0.18em] text-[#7A8C86] mb-1">
                  Two terms deserve emphasis
                </div>
                <p className="text-[0.68rem] text-[#5B6E68] leading-relaxed">
                  The drawdown coefficient <span className="font-mono text-mtqs-gold">c</span> is{" "}
                  <span className="text-[#0E1F1B]">explicitly non-zero</span> because
                  purchasing-power protection is experienced as drawdown, not as variance — a unit
                  whose value never oscillates but occasionally drops 15% has failed its users even
                  if its volatility statistics look excellent (§6.7). The robustness coefficient{" "}
                  <span className="font-mono text-mtqs-gold">h</span> aggregates the §23.6
                  perturbation sensitivities and §23.5 Monte Carlo dispersion, so a model that scores
                  well only on the single realized history —{" "}
                  <span className="text-[#0E1F1B]">the signature of overfitting</span> — is penalized
                  exactly where it is weakest.
                </p>
              </div>
            </div>
            <p className="text-[0.68rem] text-[#7A8C86] mt-3">
              The criterion operates at three levels: choosing among candidate models inside the
              ensemble (feeding the adaptive weights of §7.6), choosing the ensemble architecture
              itself, and promoting a new methodology version through the §23.12 gates. At every
              level the comparison uses the{" "}
              <span className="text-[#0E1F1B]">purged, walk-forward, out-of-sample record</span> —
              never in-sample statistics, and never a single favorable window.
            </p>
          </Panel>
        </Reveal>
      </section>

      {/* ============ remaining program vs live engine ============ */}
      <section id="validation-remaining" aria-labelledby="validation-remaining-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§23.2 / §23.3 / §23.12 · honest status"
          title="Remaining Program vs Live Engine"
          className="mb-0"
          right={<Pill tone="amber">gates not executed</Pill>}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Reveal>
            <Panel className="p-5 h-full border-mtqs-emerald/20">
              <div className="flex items-center gap-2 mb-3">
                <Beaker className="h-4 w-4 text-mtqs-emerald" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0E1F1B]">
                  Already exercised by the reference engine
                </h3>
              </div>
              <ul className="space-y-2 text-[0.72rem] text-[#5B6E68]" id="validation-remaining-h">
                <li className="flex gap-2">
                  <span className="text-mtqs-emerald mt-0.5" aria-hidden="true">✓</span>
                  <span>
                    The <span className="text-[#0E1F1B]">S1–S11 deterministic scenario battery</span> —
                    Monte Carlo families, gold and currency stress, redemption runs, correlation
                    collapse and parameter perturbation (§23.5–§23.11) — rendered live in the stress
                    matrix above from /api/validation.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-mtqs-emerald mt-0.5" aria-hidden="true">✓</span>
                  <span>
                    Canonical <span className="text-[#0E1F1B]">risk state-machine tests</span> — the
                    6-state machine with hysteresis, throttles and fee ladders.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-mtqs-emerald mt-0.5" aria-hidden="true">✓</span>
                  <span>
                    The <span className="text-[#0E1F1B]">canonical invariant suite</span> —
                    constitutional invariants, MARP level logic, chain-link continuity, oracle
                    pause/fallback discipline.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-mtqs-emerald mt-0.5" aria-hidden="true">✓</span>
                  <span>
                    <span className="text-[#0E1F1B]">Deterministic seeded generators</span> — every
                    scenario re-runs identically, path-for-path (§24.1), so results are reproducible.
                  </span>
                </li>
              </ul>
            </Panel>
          </Reveal>
          <Reveal delay={0.05}>
            <Panel className="p-5 h-full border-mtqs-amber/20">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-mtqs-amber" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0E1F1B]">
                  Still required by the full program
                </h3>
              </div>
              <ul className="space-y-2 text-[0.72rem] text-[#5B6E68]">
                <li className="flex gap-2">
                  <span className="text-mtqs-amber mt-0.5" aria-hidden="true">•</span>
                  <span>
                    <span className="text-[#0E1F1B]">G1 (§23.12) — the 2010-start multi-horizon backtest</span>{" "}
                    (§23.2): full pipeline with costs, spanning the 2011 euro crisis, 2013 taper
                    tantrum, 2015 franc depeg, 2020 COVID shock and the 2022–2023 inflation surge.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-mtqs-amber mt-0.5" aria-hidden="true">•</span>
                  <span>
                    <span className="text-[#0E1F1B]">G2 (§23.12) — the concatenated walk-forward record</span>{" "}
                    (§23.3): expanding <em>and</em> rolling windows, varied re-estimation cadence,
                    under §23.4 purging + embargo with zero leakage findings.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-mtqs-amber mt-0.5" aria-hidden="true">•</span>
                  <span>
                    <span className="text-[#0E1F1B]">G4 (§23.12) — Risk-Council robustness bounds B_θ</span>{" "}
                    (§23.6): ΔPerformance ≤ B_θ for every registry parameter, not just the
                    perturbation set the reference engine already runs.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-mtqs-amber mt-0.5" aria-hidden="true">•</span>
                  <span>
                    <span className="text-[#0E1F1B]">Gate execution §23.12 / §25.5</span>: the ordered
                    §23.12 evidence sequence (G1–G7) with independent reproduction, plus the 11 §25.5
                    production gates — none has been conducted; all report NOT PASSED.
                  </span>
                </li>
              </ul>
              <p className="text-[0.66rem] text-[#7A8C86] mt-3">
                Failure at a gate does not end the program — it routes back to the implicated
                architecture layer, and the affected version re-enters validation.
              </p>
            </Panel>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-[#E3EAE6] bg-[#F7FAF8]">
            <p className="text-[0.72rem] text-[#5B6E68] max-w-2xl">
              The complete pilot evidence record — invariant test results, stress artifacts, audit
              findings and honest-status disclosures — is published in the Evidence Package.
            </p>
            <button
              onClick={() => onNavigate("evidence")}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-mtqs-gold/30 bg-mtqs-gold/10 text-mtqs-gold text-[0.75rem] font-semibold hover:bg-mtqs-gold/20 transition-colors mtqs-focus"
            >
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              Open Evidence Package
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
