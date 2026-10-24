// MTQΣ — Transparency, Reproducibility & Publication Section (Blueprint v2.0 · Ch 24)
//
// Chapter 24 made operational: deterministic reproducibility (§24.1 — same
// versioned inputs ⟹ same W_t^Live, verifiable via the ReproducibilityPanel),
// the four version layers (§24.2), weight publication (§24.3 — what is
// published + the LIVE four-state weight table from the snapshot), the
// rebalancing decision log (§24.4 — latest live decisions), and the final
// live-weight equation (§24.5 — the composed pipeline from Data_t to
// executed weights).
//
// Live data: the injected snapshot (weightStates 4-state weights, rebalance
// + marp decisions, oracle board, mase objective version, source lineage),
// with /api/gfb as the honest fallback for the weight table. No fabricated
// values — absent fields render "—" or "published via /api/evidence".
//
// Props: { onNavigate, snapshot } — shared section contract.

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Panel,
  Reveal,
  Pill,
  GlowDot,
  SectionHeading,
  MiniBar,
  Skeleton,
} from "@/components/mtq/primitives";
import { ReproducibilityPanel } from "@/components/mtq/ReproducibilityPanel";
import { fmtUsd } from "@/components/mtq/format";
import {
  getNavForm,
  fxToPriceVector,
  verifyDivisorLedger,
  type NavFormResult,
} from "@/lib/mtq/chain-index";
import type { SectionId } from "@/components/mtq/Navigation";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import {
  FileText,
  History,
  Layers,
  ScrollText,
  ShieldAlert,
  ArrowRight,
  FlaskConical,
  Scale,
  Link2,
} from "lucide-react";

/* ---------- /api/gfb fallback shape (weight table only) ---------- */
interface GfbDto {
  components: Record<string, { weight: number }>;
  smoothedWeights: Record<string, number> | null;
  executionWeights: Record<string, number> | null;
}

/* ---------- Canonical 7-component order ---------- */
const CANON = ["USD", "EUR", "JPY", "GBP", "CNY", "CHF", "Gold"] as const;

/* ---------- §24.3 Published artifacts (blueprint table, faithful) ---------- */
const PUBLISHED_ARTIFACTS: { artifact: string; content: string }[] = [
  {
    artifact: "Source data",
    content:
      "The versioned input snapshot (DataVersion) — prices, institutional data, oracle histories — sufficient to re-run the entire pipeline (§24.1).",
  },
  {
    artifact: "Methodology version",
    content: "The full version tuple of §24.2 under which the weights were computed.",
  },
  {
    artifact: "Scoring tables",
    content:
      "Component-level scores: constituency eligibility scores Q_i (§4.2), candidate-model scores, ensemble coefficients α_m (§7.6).",
  },
  {
    artifact: "Eligibility decisions",
    content:
      "The universe actually used: admitted, retired, monitored candidates, with thresholds and hysteresis state (§4.2, §4.7).",
  },
  {
    artifact: "Constraint status",
    content:
      "Envelope checks, velocity compliance, sum-to-one, smoothing state — pass/fail per constraint, per component.",
  },
  {
    artifact: "Deviation from prior period",
    content:
      "W_t against W_{t−1} with the attributed causes (signal changes, regime shifts, score movements).",
  },
  {
    artifact: "Rebalancing decision",
    content:
      "The MARP outcome for the period — executed corrections with DecisionIDs, or the logged no-trade decision with its justification (§24.4).",
  },
  {
    artifact: "Transaction-cost estimate",
    content:
      "The modeled and realized cost of any weight movement, spread and slippage (Chapters 10–11).",
  },
];

/* ---------- §24.4 Decision-log record fields (blueprint table, faithful) ---------- */
const DECISION_FIELDS: { field: string; meaning: string }[] = [
  { field: "DecisionID", meaning: "Unique identifier of the trade decision; the join key to the version records of §24.2." },
  { field: "TargetWeight", meaning: "The weight vector the pipeline called for (the smoothed target the trade serves)." },
  { field: "ActualWeight", meaning: "The live weight vector measured before the trade — the state the correction starts from." },
  { field: "Drift", meaning: "The deviation between target and actual, per component, that triggered evaluation." },
  { field: "RiskScore", meaning: "The risk state at decision time — crisis score, regime, liquidity conditions (§5.4–§5.5)." },
  { field: "ExpectedBenefit", meaning: "The modeled benefit of correcting the drift (tracking-error reduction, risk reduction)." },
  { field: "ExpectedCost", meaning: "The modeled cost — spreads, slippage, market impact — of executing the correction." },
  { field: "ExecutionAmount", meaning: "The size actually traded, per component, after threshold and sizing rules." },
  { field: "ExecutionPrice", meaning: "The realized prices achieved, against which the cost model is later scored." },
  { field: "PostTradeWeight", meaning: "The weight vector after execution — the new actual state, and the next period's starting point." },
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
    <div className="overflow-hidden rounded-md border border-white/[0.06]">
      <div className={`${maxHeight} overflow-y-auto mtqs-scroll`}>
        <table className="w-full text-[0.74rem]">
          <thead className="bg-white/[0.02] text-white/55 sticky top-0">
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
                className={`border-t border-white/[0.06] ${ri % 2 ? "bg-white/[0.01]" : ""}`}
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
    <code className="block font-mono text-[0.78rem] sm:text-[0.85rem] text-mtqs-gold-light bg-white/[0.03] border border-white/[0.06] rounded-md px-4 py-3 overflow-x-auto whitespace-nowrap">
      {children}
    </code>
  );
}

/* ---------- One weight-state cell: MiniBar + mono % ---------- */
function WeightCell({ w }: { w: number | undefined | null }) {
  if (w == null || !Number.isFinite(w)) {
    return <span className="font-mono text-white/25">—</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <MiniBar value={w} max={0.35} colorClass="bg-mtqs-gold/60" className="w-16 sm:w-20" />
      <span className="font-mono text-[0.7rem] text-white/75">{(w * 100).toFixed(2)}%</span>
    </div>
  );
}

export function TransparencySection({
  onNavigate,
  snapshot,
}: {
  onNavigate: (id: SectionId) => void;
  snapshot: MetricsSnapshot | null;
}) {
  // Honest fallback for the 4-state weight table: only used when the snapshot
  // carries no weightStates (pure genesis). Never fabricates a target.
  const [gfb, setGfb] = useState<GfbDto | null>(null);
  const ws = snapshot?.weightStates ?? null;

  useEffect(() => {
    if (!snapshot || ws) return; // snapshot has the canonical 4 states — no fallback fetch
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/gfb", { cache: "no-store" });
        if (!res.ok) return;
        const dto = (await res.json()) as GfbDto;
        if (mounted) setGfb(dto);
      } catch {
        /* honest fallback stays null → "unavailable" rendering */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [snapshot, ws]);

  const rebalance = snapshot?.rebalance ?? null;
  const marp = snapshot?.marp ?? null;
  const marpDecisions = marp?.decisions ?? [];
  const firstMandate = marpDecisions.find((d) => d.mandate)?.mandate ?? null;

  // === COO-17 (v2.0 §9.1/§9.3): NAV-form reconciliation, recomputed HERE in the
  // browser from the PUBLISHED components (§24.1: every increment independently
  // recomputable from published data) — the §9.1 equation with live values,
  // the per-update D_t/B^± series, and the ledger consistency check.
  const navForm: NavFormResult | null = useMemo(() => {
    if (!snapshot) return null;
    try {
      return getNavForm(snapshot.chainIndex, fxToPriceVector(snapshot.fx));
    } catch {
      return null; // honest fallback: render "—", never fabricate
    }
  }, [snapshot]);
  const divisorLedger = useMemo(
    () => (snapshot ? verifyDivisorLedger(snapshot.chainIndex) : null),
    [snapshot],
  );

  const dirLabel = (d: number | string) =>
    d === 1 || d === "buy"
      ? "BUY"
      : d === -1 || d === "sell"
      ? "SELL"
      : "HOLD";

  return (
    <div className="space-y-10">
      {/* ============ §24 — header ============ */}
      <SectionHeading
        eyebrow="§24 · publication"
        title="Transparency, Reproducibility &amp; Publication"
        className="mb-0"
        right={
          <Pill tone="emerald">
            <GlowDot color="emerald" size="h-1.5 w-1.5" />
            deterministic · versioned · public
          </Pill>
        }
      />

      {/* Truth banner — publication posture */}
      <Reveal>
        <div className="rounded-xl border border-mtqs-amber/25 bg-mtqs-amber/[0.06] p-4">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <FlaskConical className="h-4 w-4 text-mtqs-amber" aria-hidden="true" />
            <span className="font-mono text-[0.72rem] font-semibold tracking-widest text-mtqs-amber">
              TESTNET ONLY
            </span>
            <span className="text-white/20">·</span>
            <span className="text-[0.72rem] text-amber-100/80">
              everything published on this page is pilot output
            </span>
          </div>
          <p className="text-[0.74rem] text-amber-100/70 leading-relaxed">
            The publication machinery below — version tuples, weight series, decision records — is
            exercised live on the testnet pilot so its determinism can be inspected. The{" "}
            <span className="text-white/90">production publication layer</span> requires the §25.5
            validation gates, which have <span className="text-white/90">not been passed</span>.
          </p>
        </div>
      </Reveal>

      {/* ============ §24.1 — deterministic reproducibility ============ */}
      <section id="transparency-reproducibility" aria-labelledby="transparency-repro-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§24.1 · determinism"
          title="Deterministic Reproducibility"
          className="mb-0"
          right={<Pill tone="gold">G7 gate prerequisite</Pill>}
        />
        <div className="space-y-4">
          <Reveal>
            <Panel className="p-5">
              <p className="text-[0.78rem] text-white/55 mb-3" id="transparency-repro-h">
                The transparency architecture rests on a single computational fact: given identical
                inputs, the system must produce identical outputs —
              </p>
              <Formula>(Data_t, Parameters_t, Versions_t) identical ⟹ W_t^Live identical</Formula>
              <p className="text-[0.74rem] text-white/55 mt-3 leading-relaxed">
                The MASE registry intentionally does not re-solve the optimization on-chain; that
                omission is safe only because anyone can re-run MASE off-chain from the published
                versions and obtain the identical target, which the contract then verifies against
                the constitution. The auditor is not asked to trust the submitter — only to execute
                the same deterministic function on the same versioned inputs [MS §92].
              </p>
              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[0.7rem] text-white/50">
                <li>• Random generators seeded with published constants (MC families reproduce path-for-path, §23.5).</li>
                <li>• Floating-point operations in a fixed order and precision.</li>
                <li>• No computation depends on wall-clock time, network latency or environment state.</li>
                <li>• Software versions recorded; input data snapshotted immutably under its DataVersion.</li>
              </ul>
              <p className="text-[0.68rem] text-white/40 mt-3">
                A re-run that diverges in even one weight at one timestamp is a defect that blocks
                the G7 reproducibility gate of §23.12.
              </p>
            </Panel>
          </Reveal>
          <Reveal delay={0.05}>
            {/* §24.1 made interactive — re-run the pilot calculation and compare */}
            <ReproducibilityPanel snapshot={snapshot} />
          </Reveal>
        </div>
      </section>

      {/* ============ §24.2 — versioning ============ */}
      <section id="transparency-versioning" aria-labelledby="transparency-versioning-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§24.2 · versioning"
          title="Data · Model · Parameter · Oracle Versions"
          className="mb-0"
          right={<Pill tone="gold">full audit trail [MS §93, COO-26]</Pill>}
        />
        <Reveal>
          <Panel className="p-5">
            <p className="text-[0.78rem] text-white/55 mb-4" id="transparency-versioning-h">
              Every live calculation stores the full version tuple and result record, so it is
              attributable to exactly the inputs, models, parameters and oracle configuration that
              produced it — the backbone of institutional auditability [COO-26].
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  {
                    name: "DataVersion",
                    meaning:
                      "Immutable hash of the exact input snapshot consumed: price series, COFER and BIS observations, CPI and GPP inputs, oracle histories (§4.3, §6.1).",
                    live: snapshot?.source ?? null,
                    liveLabel: "live data lineage",
                  },
                  {
                    name: "ModelVersion",
                    meaning:
                      "Identity of the candidate-model set and ensemble architecture: which models participate, in which mathematical form, with which covariance and objective structure (Chapters 6–7).",
                    live: snapshot?.mase?.objectiveVersion ?? null,
                    liveLabel: "live objective version",
                  },
                  {
                    name: "ParameterVersion",
                    meaning:
                      "Identity of the parameter vector from the registry (§22.4): objective coefficients λ, thresholds, horizon weights, ensemble temperature, envelopes.",
                    live: "BLUEPRINT-v2.0 constants · §22.4 registry (pilot)",
                    liveLabel: "live parameter set",
                  },
                  {
                    name: "OracleVersion",
                    meaning:
                      "Identity of the canonical oracle configuration: source set, aggregation method, tolerances, staleness rules (Chapter 17).",
                    live: snapshot?.oracle
                      ? `3-source board · aggregate ${snapshot.oracle.aggregateState}`
                      : null,
                    liveLabel: "live oracle board",
                  },
                ] as const
              ).map((v) => (
                <div key={v.name} className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Layers className="h-3.5 w-3.5 text-mtqs-gold/80" aria-hidden="true" />
                    <span className="font-mono text-[0.8rem] font-semibold text-mtqs-gold">{v.name}</span>
                  </div>
                  <p className="text-[0.68rem] text-white/50 leading-relaxed mb-2">{v.meaning}</p>
                  <div className="pt-2 border-t border-white/[0.05]">
                    <div className="text-[0.55rem] uppercase tracking-wider text-white/35 mb-0.5">
                      {v.liveLabel}
                    </div>
                    <div className="font-mono text-[0.66rem] text-white/70 break-words">
                      {v.live ?? "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[0.68rem] text-white/45 mt-4">
              Each record also carries the computed <span className="font-mono text-white/70">Weight</span>{" "}
              vector (the output posted to and enforced by the registry), the full{" "}
              <span className="font-mono text-white/70">Output</span> result record (component scores,
              constraint flags, pipeline intermediate states), and a{" "}
              <span className="font-mono text-white/70">DecisionID</span> linking the calculation to the
              decision log of §24.4. Version discipline: a version identifier changes only through the
              governed process for its layer — data revisions are new DataVersions (never silent
              overwrites, §4.3), parameter changes are new ParameterVersions through the registry, and
              oracle changes are new OracleVersions through oracle governance. Any calculation whose
              stored versions do not correspond to a published, governed version is invalid by
              construction.
            </p>
          </Panel>
        </Reveal>
      </section>

      {/* ============ §24.3 — weight publication ============ */}
      <section id="transparency-publication" aria-labelledby="transparency-publication-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§24.3 · weight publication"
          title="Weight Publication"
          className="mb-0"
          right={
            <Pill tone="emerald">
              <GlowDot color="emerald" size="h-1.5 w-1.5" />
              published weight = W^Execution (the §2.3 four-state rule)
            </Pill>
          }
        />
        <div className="space-y-4">
          <Reveal>
            <Panel className="p-5">
              <p className="text-[0.78rem] text-white/55 mb-3" id="transparency-publication-h">
                Reproducibility makes results verifiable in principle; publication makes them
                verifiable in practice. Only the published W_t series describes the composition of
                MTQΣ — the publication is, in the strict sense, the definition of the basket&apos;s
                realized state. For each effective period the system publishes:
              </p>
              <BorderedTable
                headers={["Published artifact", "Content"]}
                rows={PUBLISHED_ARTIFACTS.map((a) => [
                  <span key="a" className="text-white/85">{a.artifact}</span>,
                  <span key="c" className="text-white/55">{a.content}</span>,
                ])}
              />
              <p className="text-[0.68rem] text-white/45 mt-3">
                The publication set is deliberately larger than the weight vector: scoring tables and
                eligibility decisions make the constituency engine as auditable as the weighting
                engine (§4.5), and the deviation attribution connects composition change to its
                causes. Because both the weight series and the price series are public, any auditor
                can perform the Chapter 9 decomposition — separating index movement into price
                effect and composition effect — and verify composition effects occurred only through
                the logged, justified, velocity-bounded path.
              </p>
            </Panel>
          </Reveal>

          {/* LIVE four-state weight table */}
          <Reveal delay={0.05}>
            <Panel className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <h3 className="text-sm font-semibold text-white/90">
                  Live four-state weights — W^Prior → W^Target → W^Smooth → W^Execution
                </h3>
                <Pill tone={ws ? "emerald" : gfb ? "amber" : "muted"}>
                  <GlowDot color={ws ? "emerald" : gfb ? "amber" : "gold"} size="h-1.5 w-1.5" />
                  {ws ? "snapshot.weightStates" : gfb ? "/api/gfb fallback (target —)" : "unavailable"}
                </Pill>
              </div>
              <p className="text-[0.7rem] text-white/45 mb-3">
                The four states are never equivalent (§2.3).{" "}
                <span className="text-white/80">
                  The published weight is the EXECUTION weight (the §2.3 four-state rule; I6 = NAV-priced redemption per v2.0 §2.6)
                </span>{" "}
                — never the target or smoothed weight.
              </p>

              {!snapshot ? (
                <div className="space-y-2">
                  {[...Array(7)].map((_, i) => (
                    <Skeleton key={i} className="h-8 rounded-md" />
                  ))}
                </div>
              ) : ws ? (
                <div className="overflow-hidden rounded-md border border-white/[0.06]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[0.72rem]">
                      <thead className="bg-white/[0.02] text-white/55">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Component</th>
                          <th className="text-left px-3 py-2 font-medium">Prior (§3.2)</th>
                          <th className="text-left px-3 py-2 font-medium">Target (MASE)</th>
                          <th className="text-left px-3 py-2 font-medium">Smooth (§8.4)</th>
                          <th className="text-left px-3 py-2 font-medium">Execution (§2.3)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {CANON.map((c) => (
                          <tr key={c} className="border-t border-white/[0.06]">
                            <td className="px-3 py-2 font-mono text-mtqs-gold">{c}</td>
                            <td className="px-3 py-2"><WeightCell w={ws.prior?.[c]} /></td>
                            <td className="px-3 py-2"><WeightCell w={ws.target?.[c]} /></td>
                            <td className="px-3 py-2"><WeightCell w={ws.smoothed?.[c]} /></td>
                            <td className="px-3 py-2">
                              <span className={ws.execution?.[c] != null ? "" : "opacity-50"}>
                                <WeightCell w={ws.execution?.[c]} />
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : gfb ? (
                <div className="overflow-hidden rounded-md border border-white/[0.06]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[0.72rem]">
                      <thead className="bg-white/[0.02] text-white/55">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Component</th>
                          <th className="text-left px-3 py-2 font-medium">Prior (§3.2)</th>
                          <th className="text-left px-3 py-2 font-medium">Target (MASE)</th>
                          <th className="text-left px-3 py-2 font-medium">Smooth (§8.4)</th>
                          <th className="text-left px-3 py-2 font-medium">Execution (§2.3)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {CANON.map((c) => (
                          <tr key={c} className="border-t border-white/[0.06]">
                            <td className="px-3 py-2 font-mono text-mtqs-gold">{c}</td>
                            <td className="px-3 py-2"><WeightCell w={gfb.components?.[c]?.weight} /></td>
                            <td className="px-3 py-2"><WeightCell w={null} /></td>
                            <td className="px-3 py-2"><WeightCell w={gfb.smoothedWeights?.[c]} /></td>
                            <td className="px-3 py-2"><WeightCell w={gfb.executionWeights?.[c]} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-[0.72rem] text-white/40">
                  Live weight states unavailable from the snapshot and /api/gfb — nothing is
                  fabricated; the four-state definition is published via /api/evidence.
                </p>
              )}
              <p className="text-[0.6rem] text-white/35 mt-2">
                Mini-bars are scaled to a common 0–35% range for cross-state comparability. “—” =
                state not exposed by the pilot snapshot at this tick.
              </p>
            </Panel>
          </Reveal>

          {/* ===== v2.0 §9.3/§9.1 · COO-17 — chain-link divisor publication + NAV-form reconciliation ===== */}
          <Reveal delay={0.07}>
            <Panel className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                  <Scale className="h-3.5 w-3.5 text-mtqs-gold" aria-hidden="true" />
                  Chain-Link Divisor Publication · NAV-Form Reconciliation
                </h3>
                <Pill tone="gold">
                  <Link2 className="h-3 w-3" aria-hidden="true" />
                  §9.1 · §9.3 · COO-17 · basis pinned: base-relative
                </Pill>
              </div>
              <p className="text-[0.7rem] text-white/45 mb-3">
                The weight change is a compositional event — the §9.3 divisor D_t absorbs it so the
                published level never jumps, and every applied D_t is published with its B^± pair
                (the ChainLinkAdjusted payload). The §9.1 aggregate form and the §9.2 recursion are
                reconciled through the normalization factor G_t — recomputed live below from the
                published components.
              </p>

              {!navForm ? (
                <Skeleton className="h-24 rounded-lg" />
              ) : (
                <div className="space-y-4">
                  {/* §9.1 equation with live component values */}
                  <div>
                    <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/55 mb-2">
                      §9.1 · the NAV equation, live
                    </div>
                    <Formula>
                      NAV<sub>t</sub> = G<sub>t</sub> × Σ<sub>i</sub> W<sub>i,t</sub> × (P<sub>i,t</sub>
                      /P<sub>i,0</sub>) = {navForm.gImplied.toFixed(6)} ×{" "}
                      {navForm.navRaw.toFixed(6)} = {navForm.navReconciled.toFixed(6)}
                    </Formula>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[0.66rem]">
                      <div className="p-2 rounded bg-white/[0.03]">
                        <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">
                          G<sub>t</sub> (implied = I<sub>t</sub>/NAV)
                        </div>
                        <div className="font-mono text-mtqs-gold">{navForm.gImplied.toFixed(9)}</div>
                      </div>
                      <div className="p-2 rounded bg-white/[0.03]">
                        <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">
                          Σ term (Listing 3 getNavForm)
                        </div>
                        <div className="font-mono text-white/85">{navForm.navRaw.toFixed(9)}</div>
                      </div>
                      <div className="p-2 rounded bg-white/[0.03]">
                        <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">
                          NAV<sub>t</sub> (= published I<sub>t</sub>)
                        </div>
                        <div className="font-mono text-mtqs-emerald">
                          {navForm.navReconciled.toFixed(9)}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-white/[0.03]">
                        <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">
                          §9.1 equation closes
                        </div>
                        <div
                          className={`font-mono ${
                            navForm.identityCloses ? "text-mtqs-emerald" : "text-mtqs-rose"
                          }`}
                        >
                          {navForm.identityCloses
                            ? `YES · residual ${navForm.identityResidual.toExponential(2)}`
                            : `NO · residual ${navForm.identityResidual.toExponential(2)}`}
                        </div>
                      </div>
                    </div>
                    {!navForm.baseFixingsAvailable ? (
                      <p className="text-[0.62rem] text-mtqs-amber mt-2">
                        Base fixings P<sub>i,0</sub> unavailable on this in-memory state (it predates
                        the basis pinning and has not yet been healed) — the Σ term below is
                        anchored to prevPrices and is NOT exact. The next weight commit heals the
                        anchor from the genesis fixings.
                      </p>
                    ) : null}
                  </div>

                  {/* per-component §9.1 terms */}
                  <div>
                    <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/55 mb-2">
                      §9.1 · per-component terms (canonical order)
                    </div>
                    <BorderedTable
                      maxHeight="max-h-64"
                      headers={[
                        "Component",
                        "W_{i,t} (committed)",
                        "P_{i,t}/P_{i,0}",
                        "W × (P/P₀) — §9.1 term",
                      ]}
                      rows={navForm.terms.map((t) => [
                        <span key="c" className="font-mono text-mtqs-gold">{CANON[t.index]}</span>,
                        <span key="w" className="font-mono text-white/75">{(t.weight * 100).toFixed(2)}%</span>,
                        <span key="r" className="font-mono text-white/75">{t.relative.toFixed(6)}</span>,
                        <span key="t" className="font-mono text-white/85">{t.term.toFixed(6)}</span>,
                      ])}
                    />
                  </div>

                  {/* the two G senses — the COO-17 reconciliation disclosure */}
                  <div className="p-3 rounded-lg border border-mtqs-amber/20 bg-mtqs-amber/[0.04]">
                    <div className="text-[0.65rem] uppercase tracking-[0.18em] text-mtqs-amber/90 mb-2">
                      COO-17 · the two G senses (published, not merged)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[0.66rem]">
                      <div className="p-2 rounded bg-white/[0.03]">
                        <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">
                          G<sub>t</sub> recorded = Π D<sub>s</sub> (§9.3 functional form)
                        </div>
                        <div className="font-mono text-white/85">{navForm.gRecorded.toFixed(9)}</div>
                      </div>
                      <div className="p-2 rounded bg-white/[0.03]">
                        <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">
                          §9.1 aggregate with recorded G
                        </div>
                        <div className="font-mono text-white/85">
                          {navForm.navWithRecordedG.toFixed(9)}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-white/[0.03]">
                        <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">
                          residual (implied − recorded)
                        </div>
                        <div
                          className={`font-mono ${
                            Math.abs(navForm.gResidual) < 1e-9 ? "text-mtqs-emerald" : "text-mtqs-amber"
                          }`}
                        >
                          {navForm.gResidual >= 0 ? "+" : ""}
                          {navForm.gResidual.toFixed(9)}
                        </div>
                      </div>
                    </div>
                    <p className="text-[0.62rem] text-amber-100/70 mt-2 leading-relaxed">
                      v2.0 §9.1 (COO-17): “the aggregate form and the chain-linked recursion are
                      different mathematical objects that must be made to produce one published
                      I<sub>t</sub>.” The published series is the §9.2 recursion; the §9.1 equation
                      reproduces it exactly through the implied normalization factor G<sub>t</sub> =
                      I<sub>t</sub>/NAV<sub>t</sub> (Listing 3 getNavForm note). The recorded Π D
                      <sub>s</sub> is the chain-link history component of G<sub>t</sub>; the residual
                      above is the compounding difference between the two forms since the last
                      weight change — published here, never silently absorbed into the divisor.
                    </p>
                  </div>

                  {/* per-update D_t/B± series */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/55">
                        §9.3 · applied divisor records (ChainLinkAdjusted-equivalent)
                      </div>
                      <span className="font-mono text-[0.6rem] text-white/40">
                        retained {navForm.history.length} of {navForm.totalDivisorCommits} · window
                        50{navForm.historyTruncated ? " (older dropped — disclosed)" : ""}
                      </span>
                    </div>
                    {navForm.history.length === 0 ? (
                      <div className="p-3 rounded-md border border-white/[0.06] bg-white/[0.02] text-[0.7rem] text-white/50">
                        No weight change committed yet in this process lifetime — D<sub>t</sub> = 1
                        throughout and G<sub>t</sub> = 1.000000. A record is published on every
                        accepted weight change only (Listing 3 fires ChainLinkAdjusted on change,
                        not on no-op commits).
                      </div>
                    ) : (
                      <BorderedTable
                        maxHeight="max-h-64"
                        headers={["Committed at", "Kind", "D_t", "B_t^−", "B_t^+", "Basis"]}
                        rows={[...navForm.history]
                          .reverse()
                          .map((r) => [
                            <span key="a" className="font-mono text-white/60">{new Date(r.at).toISOString()}</span>,
                            <span key="k" className={`font-mono ${r.kind === "carry-forward" ? "text-mtqs-amber" : "text-white/70"}`}>
                              {r.kind}
                            </span>,
                            <span key="d" className="font-mono text-mtqs-gold">{r.D.toFixed(9)}</span>,
                            <span key="m" className="font-mono text-white/75">
                              {r.bMinus != null ? r.bMinus.toFixed(6) : "— (pre-switch era)"}
                            </span>,
                            <span key="p" className="font-mono text-white/75">
                              {r.bPlus != null ? r.bPlus.toFixed(6) : "— (pre-switch era)"}
                            </span>,
                            <span key="b" className={`font-mono ${r.basis === "raw-usd" ? "text-mtqs-amber" : "text-white/55"}`}>
                              {r.basis}
                            </span>,
                          ])}
                      />
                    )}
                    {navForm.history.some((r) => r.kind === "carry-forward") ? (
                      <p className="text-[0.62rem] text-mtqs-amber/90 mt-2 leading-relaxed">
                        The amber carry-forward row is the PRE-SWITCH era summary: this pilot process
                        started under the superseded raw-USD basis, and that era kept no per-update
                        D<sub>t</sub> records — its accumulated G is carried as one labeled factor
                        (basis raw-usd, B^± not applicable) instead of being silently dropped or
                        re-based. All rows after it are pinned base-relative. A restart re-inits
                        the pilot at genesis (G = 1, empty ledger) — this ledger is process-local
                        testnet simulation data.
                      </p>
                    ) : null}
                    {divisorLedger ? (
                      <p className="text-[0.6rem] text-white/45 mt-2 font-mono">
                        ledger check: G_t = Π D_t over retained records →{" "}
                        {divisorLedger.consistent === true
                          ? `CONSISTENT (G=${divisorLedger.recordedG.toPrecision(12)})`
                          : divisorLedger.consistent === null
                          ? "NOT VERIFIABLE from the retained window alone (older records dropped — cumulative G_t is carried, the window is bounded)"
                          : `INCONSISTENT (recorded G=${divisorLedger.recordedG.toPrecision(12)} vs Π D=${divisorLedger.recomputedG.toPrecision(12)})`}
                      </p>
                    ) : null}
                  </div>

                  {/* honest posture notes */}
                  <div className="p-3 rounded-lg border border-mtqs-amber/25 bg-mtqs-amber/[0.06]">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-mtqs-amber" aria-hidden="true" />
                      <span className="font-mono text-[0.62rem] font-semibold tracking-widest text-mtqs-amber">
                        DIVISOR BASIS SWITCH · DISCLOSED
                      </span>
                    </div>
                    <p className="text-[0.68rem] text-amber-100/75 leading-relaxed">
                      The app-layer divisor machinery previously valued B<sup>±</sup> in RAW USD
                      (Σ W × P<sub>i,t</sub>). Per Blueprint v2.0 §9.3 / Listing 3 (§9.8) and the
                      reference source MTQSigmaV3.sol commitWeights (L1384–1407) — reference
                      implementation, not deployed — the basis
                      is now pinned <span className="text-white/90">BASE-RELATIVE</span>: B<sup>±</sup>{" "}
                      = Σ W × (P<sub>i,t</sub>/P<sub>i,0</sub>) against the immutable genesis fixings
                      §3.4. The raw-USD basis is <span className="text-white/90">SUPERSEDED</span> —
                      evidence preserved in the audit records; both bases deliver the same
                      zero-artificial-return guarantee, but they produce different numeric G
                      <sub>t</sub> series for the same history, so the series was NOT silently
                      re-based: the switch is published here and in honest-status.
                    </p>
                    <p className="text-[0.66rem] text-amber-100/60 leading-relaxed mt-2">
                      TESTNET ONLY · SHADOW MODE: this is the app&apos;s shadow-mode chain-link
                      history (testnet simulation data held in the pilot&apos;s process memory) —
                      NOT on-chain ChainLinkAdjusted events. The V3 contract is not deployed here,
                      remains READ-ONLY under §1 VERIFICATION-ONLY, and exposes NO on-chain
                      getNavForm view; the §9.1 reconciliation hook on this panel is APP-LAYER
                      ONLY (chain-index.ts getNavForm). D<sub>t</sub> is recorded-not-applied:
                      the published level I<sub>t</sub> moves only with the §9.2 recursion.
                    </p>
                  </div>
                </div>
              )}
            </Panel>
          </Reveal>
        </div>
      </section>

      {/* ============ §24.4 — rebalancing decision log ============ */}
      <section id="transparency-decision-log" aria-labelledby="transparency-decision-log-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§24.4 · action records"
          title="Rebalancing Decision Log"
          className="mb-0"
          right={<Pill tone="gold">append-only · SHA-256 hash-chained (§24.4)</Pill>}
        />
        <div className="space-y-4">
          <Reveal>
            <Panel className="p-5">
              <p className="text-[0.78rem] text-white/55 mb-3" id="transparency-decision-log-h">
                Weights describe state; the decision log describes action. For each executed trade
                the system assigns a DecisionID, and that record must contain the complete economics
                of the decision [MS §95]. The same structure is written for{" "}
                <span className="text-white/80">no-trade decisions</span> — so inaction is as
                explainable as action; silence in the log is never ambiguous.
              </p>
              <BorderedTable
                headers={["Field", "Meaning"]}
                rows={DECISION_FIELDS.map((f) => [
                  <span key="f" className="font-mono text-mtqs-gold">{f.field}</span>,
                  <span key="m" className="text-white/55">{f.meaning}</span>,
                ])}
              />
            </Panel>
          </Reveal>

          {/* LIVE latest decisions from the snapshot */}
          <Reveal delay={0.05}>
            <Panel className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold text-white/90">Latest live decision records</h3>
                <div className="flex items-center gap-2">
                  <Pill tone={snapshot?.rebalancePath === "marp" ? "emerald" : "amber"}>
                    <GlowDot color={snapshot?.rebalancePath === "marp" ? "emerald" : "amber"} size="h-1.5 w-1.5" />
                    {snapshot?.rebalancePath === "marp" ? "MARP path active" : snapshot ? "legacy §7 path active" : "…"}
                  </Pill>
                  <span className="font-mono text-[0.6rem] text-white/35">
                    tick {snapshot ? new Date(snapshot.fetchedAt).toISOString() : "—"}
                  </span>
                </div>
              </div>

              {!snapshot ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 rounded-lg" />
                  <Skeleton className="h-24 rounded-lg" />
                </div>
              ) : (
                <div className="space-y-3">
                  {/* §7 single-direction decision */}
                  {rebalance ? (
                    <div className="p-3.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <History className="h-3.5 w-3.5 text-white/45" aria-hidden="true" />
                        <span className="text-[0.66rem] uppercase tracking-[0.18em] text-white/50">
                          §7 single-direction rebalance evaluation (gold ⇄ fiat)
                        </span>
                        <Pill tone={rebalance.shouldRebalance ? "emerald" : "muted"}>
                          {rebalance.shouldRebalance ? "trade warranted" : "no trade"}
                        </Pill>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[0.68rem]">
                        <div className="p-2 rounded bg-white/[0.03]">
                          <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">Direction</div>
                          <div className="font-mono text-white/85">{dirLabel(rebalance.direction)}</div>
                        </div>
                        <div className="p-2 rounded bg-white/[0.03]">
                          <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">Observed gold</div>
                          <div className="font-mono text-white/85">{(rebalance.observedGoldWeight * 100).toFixed(2)}%</div>
                        </div>
                        <div className="p-2 rounded bg-white/[0.03]">
                          <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">Target gold</div>
                          <div className="font-mono text-white/85">{(rebalance.targetGoldWeight * 100).toFixed(2)}%</div>
                        </div>
                        <div className="p-2 rounded bg-white/[0.03]">
                          <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">Deviation</div>
                          <div className={`font-mono ${(rebalance.deviation >= 0 ? "text-mtqs-gold-light" : "text-mtqs-emerald")}`}>
                            {(rebalance.deviation * 100).toFixed(2)}pp
                          </div>
                        </div>
                        <div className="p-2 rounded bg-white/[0.03]">
                          <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">Trade size</div>
                          <div className="font-mono text-white/85">{fmtUsd(rebalance.tradeUsd)}</div>
                        </div>
                        <div className="p-2 rounded bg-white/[0.03]">
                          <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">No-trade zone ½θ</div>
                          <div className="font-mono text-white/85">0.75% <span className="text-white/35">(crisis 1.5%)</span></div>
                        </div>
                      </div>
                      <p className="text-[0.66rem] text-white/50 mt-2 font-mono">{rebalance.reason}</p>
                    </div>
                  ) : (
                    <p className="text-[0.72rem] text-white/40">
                      Rebalance decision not exposed on this snapshot — published via /api/evidence.
                    </p>
                  )}

                  {/* MARP per-component decisions */}
                  {marpDecisions.length > 0 ? (
                    <div className="p-3.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <ScrollText className="h-3.5 w-3.5 text-white/45" aria-hidden="true" />
                        <span className="text-[0.66rem] uppercase tracking-[0.18em] text-white/50">
                          MARP per-component decisions ({marpDecisions.length})
                        </span>
                        {firstMandate ? (
                          <Pill tone="amber">
                            ε threshold {fmtUsd(firstMandate.thresholdUsd)} (shadow)
                          </Pill>
                        ) : null}
                      </div>
                      <div className="overflow-hidden rounded-md border border-white/[0.06]">
                        <div className="max-h-72 overflow-y-auto mtqs-scroll">
                          <table className="w-full text-[0.68rem]">
                            <thead className="bg-white/[0.02] text-white/50 sticky top-0">
                              <tr>
                                <th className="text-left px-2.5 py-1.5 font-medium">Comp</th>
                                <th className="text-left px-2.5 py-1.5 font-medium">Dir</th>
                                <th className="text-right px-2.5 py-1.5 font-medium">Lvl</th>
                                <th className="text-right px-2.5 py-1.5 font-medium">Urg</th>
                                <th className="text-right px-2.5 py-1.5 font-medium">Trade</th>
                                <th className="text-left px-2.5 py-1.5 font-medium w-1/3">Reason</th>
                              </tr>
                            </thead>
                            <tbody className="font-mono text-white/70">
                              {marpDecisions.map((d, i) => (
                                <tr key={`${d.component}-${i}`} className="border-t border-white/[0.05]">
                                  <td className="px-2.5 py-1.5 text-mtqs-gold">{d.component}</td>
                                  <td className="px-2.5 py-1.5">
                                    <span className={d.shouldTrade ? "text-mtqs-emerald" : "text-white/35"}>
                                      {dirLabel(d.direction)}
                                    </span>
                                  </td>
                                  <td className="px-2.5 py-1.5 text-right">{d.level}</td>
                                  <td className="px-2.5 py-1.5 text-right">{(d.urgency * 100).toFixed(0)}%</td>
                                  <td className="px-2.5 py-1.5 text-right">{fmtUsd(d.tradeUsd)}</td>
                                  <td className="px-2.5 py-1.5 font-sans text-white/50">{d.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      {firstMandate ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[0.66rem]">
                          <div className="p-2 rounded bg-white/[0.03]">
                            <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">Expected benefit</div>
                            <div className="font-mono text-mtqs-emerald">{fmtUsd(firstMandate.grossBenefitUsd)}</div>
                          </div>
                          <div className="p-2 rounded bg-white/[0.03]">
                            <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">Expected cost</div>
                            <div className="font-mono text-rose-200">{fmtUsd(firstMandate.costUsd)}</div>
                          </div>
                          <div className="p-2 rounded bg-white/[0.03]">
                            <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">Net benefit</div>
                            <div className="font-mono text-white/85">{fmtUsd(firstMandate.netBenefitUsd)}</div>
                          </div>
                          <div className="p-2 rounded bg-white/[0.03]">
                            <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">Mandate</div>
                            <div className="font-mono text-white/70">
                              {firstMandate.netBenefitEligible ? "eligible" : "blocked"} · shadow
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-[0.72rem] text-white/40">
                      MARP decisions not exposed on this snapshot — published via /api/evidence.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <p className="text-[0.66rem] text-white/45 max-w-2xl">
                      Entries are append-only and SHA-256 HASH-CHAINED per table (rowHash = sha256(prevHash ‖ payload), v2.0 §24.4)
                      — each entry&apos;s integrity is checkable against the published weight series. HONEST PILOT
                      LIMITATION: retention is WINDOWED in the local pilot store (10k decision / 5k state-vector rows —
                      pruning removes the oldest rows and therefore severs chain history); OD-21 (retention policy) is OPEN.
                      The chain therefore proves non-retroactivity within the retained window, not permanence. The full
                      log — with DecisionIDs, execution prices and post-trade states — is published
                      on the Evidence tab.
                    </p>
                    <button
                      onClick={() => onNavigate("evidence")}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-mtqs-gold/30 bg-mtqs-gold/10 text-mtqs-gold text-[0.72rem] font-medium hover:bg-mtqs-gold/20 transition-colors mtqs-focus"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      Open Evidence Package
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </Panel>
          </Reveal>
        </div>
      </section>

      {/* ============ §24.5 — the final live-weight equation ============ */}
      <section id="transparency-equation" aria-labelledby="transparency-equation-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§24.5 · the composed pipeline"
          title="The Final Live-Weight Equation"
          className="mb-0"
          right={<Pill tone="gold">Data_t → executed weights [MS §96]</Pill>}
        />
        <Reveal>
          <Panel className="p-5">
            <p className="text-[0.78rem] text-white/55 mb-3" id="transparency-equation-h">
              The complete conceptual pipeline — the single equation that summarizes the entire
              architecture from data to executed weights:
            </p>
            <Formula>
              W_t^Live = Execute[ Smooth( Constrain( Ensemble( Constituency(Data_t) ) ) ) ]
            </Formula>
            <p className="text-[0.72rem] text-white/50 mt-2 mb-4">
              Read from the inside out: the constituency layer decides{" "}
              <span className="text-white/80">who is in the universe</span>, the ensemble layer decides{" "}
              <span className="text-white/80">how much each component should weigh</span>, the constraint
              layer makes the result <span className="text-white/80">constitutionally admissible</span>,
              the smoothing layer makes it <span className="text-white/80">temporally stable</span>, and
              the execution layer decides <span className="text-white/80">what actually trades</span>.
            </p>
            <div className="space-y-3">
              {[
                {
                  step: "1 · Target",
                  formula: "W_t^Target = MASE(Data_t, W^Prior, Risk_t, CVaR_t, PP_t, Liquidity_t, Regime_t, Cost_t)",
                  text: "Chapters 4–7: the constituency engine filters the universe, the input signals and regime model condition the state, the candidate models propose solutions, and the composite objective with the adaptive ensemble synthesizes them — W^Prior enters only as the soft anchor of §7.1. The target is an unconstrained-in-spirit optimum: what stability mathematics wants, before the constitution speaks.",
                },
                {
                  step: "2 · Constraint",
                  formula: "W_t^Constrained = Projection_Ct( W_t^Target )",
                  text: "Chapter 8: the constitutional envelopes, sum-to-one and non-negativity, the weight-velocity limits and the eligibility bounds define C_t. The projection is applied after the ensemble average (§7.5), because an average of admissible solutions is not automatically admissible itself. This is where the constitution has the final word over the mathematics.",
                },
                {
                  step: "3 · Smoothing",
                  formula: "W_t^Smooth = ρ_t · W_{t−1} + (1 − ρ_t) · W_t^Constrained",
                  text: "The §8.4 stress-adaptive rule: ρ_t = 0.50 in normal conditions, rising to 0.75 when the crisis score is elevated — the basket moves deliberately in calm markets and even more deliberately in turbulent ones. With the velocity limits and the direction lock (§11.5) this implements stability-in-time; W^Target ≠ W^Smooth is one of the four weight states of §2.3.",
                },
                {
                  step: "4 · Execution",
                  formula: "W_t^Execution = MARP( W_t^Smooth, W_t^Actual, Cost_t, Liquidity_t, Reserve_t )",
                  text: "Chapters 10–11: MARP compares the smoothed target with the actual weights, applies the no-trade thresholds and the cost-benefit test, scales and times execution against liquidity and cost, and respects the reserve state — producing what actually trades, logged field-by-field under its DecisionID (§24.4). W_t^Execution becomes the actual weight vector of the next period, closing the loop.",
                },
              ].map((s) => (
                <div key={s.step} className="p-3.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <div className="text-[0.6rem] uppercase tracking-[0.2em] text-mtqs-gold/80 mb-1.5">
                    Step {s.step}
                  </div>
                  <code className="block font-mono text-[0.72rem] text-mtqs-gold-light bg-white/[0.03] border border-white/[0.05] rounded px-3 py-2 overflow-x-auto whitespace-nowrap mb-2">
                    {s.formula}
                  </code>
                  <p className="text-[0.68rem] text-white/50 leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-2.5 p-3 rounded-lg border border-mtqs-emerald/20 bg-mtqs-emerald/[0.05]">
              <ShieldAlert className="h-4 w-4 text-mtqs-emerald mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-[0.7rem] text-white/60 leading-relaxed">
                The final equation is the audit trail in miniature: Data_t (§24.2 versioning) through
                Constituency and Ensemble (Ch. 4; Ch. 5–7), through Constrain and Smooth (Ch. 8), to
                Execute (Ch. 10–11) — with every state transition published (§24.3) and every executed
                movement logged (§24.4). Validation (Ch. 23) establishes that the pipeline deserves to
                run; transparency (this chapter) establishes that its running can always be checked.
              </p>
            </div>
          </Panel>
        </Reveal>
      </section>
    </div>
  );
}
