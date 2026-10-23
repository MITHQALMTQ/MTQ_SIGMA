"use client";

// MTQΣ — Constituency Succession Lab (§3.3 · §21.5 · §9.2)
//
// Interactive drill: what happens when a currency LOSES ITS POWER?
//   decay → depeg detection → staged liquidation ladder → ejection →
//   governed successor admission — with ZERO artificial index return.
//
// The lab runs against the LIVE chain-linked index (server-side clone — the
// pilot state is never mutated) and the LIVE per-MTQ reserve holdings, so the
// numbers are real, not synthetic. Gold cannot be ejected (constitutional
// anchor, I3/I12).

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Panel, Reveal, GlowDot, Pill, Skeleton, GlowBadge } from "./primitives";
import { fmtFixed } from "./format";
import type { SuccessionSimulation, SuccessionCandidate } from "@/lib/mtq/succession";
import { toast } from "sonner";
import {
  Play,
  ShieldAlert,
  ShieldCheck,
  ArrowDown,
  Coins,
  Landmark,
  History,
  RotateCcw,
  Zap,
} from "lucide-react";

interface SuccessionGetResp {
  universe: SuccessionCandidate[];
  quotes: { quotes: Record<string, number>; live: boolean; source: string };
  basket: string[];
  ejectedOptions: string[];
  live: {
    iLevel: number;
    weights: Record<string, number> | null;
    holdingsPerMtq: Record<string, number> | null;
    basis: string | null;
  };
}

const EJECTED_OPTIONS = ["USD", "EUR", "JPY", "GBP", "CNY", "CHF"] as const;

const PHASE_META: Record<string, { label: string; tone: "gold" | "emerald" | "rose" | "amber" }> = {
  baseline: { label: "BASELINE", tone: "gold" },
  decay: { label: "DECAY", tone: "amber" },
  depeg: { label: "DEPEG", tone: "amber" },
  ladder: { label: "LADDER", tone: "rose" },
  eject: { label: "EJECT", tone: "rose" },
  succession: { label: "SUCCESSION", tone: "emerald" },
  post: { label: "POST", tone: "emerald" },
};

export function SuccessionLab() {
  const [meta, setMeta] = useState<SuccessionGetResp | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [ejected, setEjected] = useState<string>("CNY");
  const [shockPct, setShockPct] = useState<number>(40);
  const [successor, setSuccessor] = useState<string>("SGD");
  const [result, setResult] = useState<SuccessionSimulation | null>(null);
  const [running, setRunning] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch("/api/succession", { cache: "no-store" });
      if (!res.ok) {
        // Surface the /api/succession error text when the body carries one.
        let detail = `HTTP ${res.status}`;
        try {
          const errJson = (await res.json()) as { error?: string };
          if (errJson?.error) detail = `${detail}: ${errJson.error}`;
        } catch {
          /* non-JSON error body — status alone */
        }
        throw new Error(`/api/succession → ${detail}`);
      }
      const data = (await res.json()) as SuccessionGetResp;
      if (mountedRef.current) {
        setMeta(data);
        setMetaError(null);
      }
    } catch (e) {
      // Never fail silently — an empty successor selector must be explained.
      if (mountedRef.current) setMetaError(String(e).slice(0, 200));
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/succession", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ejected, shockPct, successor: successor || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Succession drill rejected", { description: data?.error ?? `HTTP ${res.status}` });
        return;
      }
      if (mountedRef.current) {
        setResult(data.sim as SuccessionSimulation);
        toast.success("Succession drill complete", {
          description: data.sim.ejectedFromBasket
            ? `${ejected} ejected · ${(data.sim.successor?.code ?? "no successor")} admitted · zero artificial return`
            : `${ejected} degraded but NOT ejected — eject conditions unmet at −${shockPct}%`,
        });
      }
    } catch (e) {
      toast.error("Succession drill failed", { description: String(e) });
    } finally {
      if (mountedRef.current) setRunning(false);
    }
  }, [ejected, shockPct, successor]);

  // Derived display values
  const cont = result?.continuity;
  const verdictPass = cont?.pass && result?.successorSanity?.pass !== false;
  // Live ejected options from the /api/succession GET payload — the hardcoded
  // list is only a fallback when the live array is absent/empty.
  const ejectedOptions =
    meta?.ejectedOptions && meta.ejectedOptions.length > 0
      ? meta.ejectedOptions
      : [...EJECTED_OPTIONS];

  return (
    <Reveal>
      <Panel className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <GlowDot color="rose" size="h-3 w-3" className="mt-1" />
            <div>
              <div className="mtqs-eyebrow flex items-center gap-2">
                Constituency Succession Lab · §3.3 / §21.5
              </div>
              <h3 className="text-lg font-semibold text-white/90 mt-1">
                If a Currency Loses Its Power — What Happens to the Unit?
              </h3>
              <p className="text-xs text-white/55 mt-1 max-w-2xl">
                Run a live drill against the actual chain-linked index: a currency collapses, the staged liquidation ladder
                defends the reserve, the component is ejected, and a governed successor takes its place — the unit never
                jumps (zero artificial return, §9.2). Gold is the constitutional anchor and cannot be ejected.
              </p>
            </div>
          </div>
          <GlowBadge variant="gold" className="shrink-0 hidden sm:inline-flex">state-clone · read-only</GlowBadge>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-4">
          {/* Failing currency */}
          <div className="lg:col-span-4 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-white/55 mb-2">Failing currency</div>
            <div className="flex flex-wrap gap-1.5">
              {ejectedOptions.map((c) => (
                <button
                  key={c}
                  onClick={() => setEjected(c)}
                  aria-pressed={ejected === c}
                  className={`px-2.5 py-1.5 rounded-md text-[0.7rem] font-mono border transition ${
                    ejected === c
                      ? "border-rose-400/50 bg-rose-400/10 text-rose-200"
                      : "border-white/[0.08] bg-white/[0.02] text-white/55 hover:text-white hover:border-white/20"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          {/* Shock magnitude */}
          <div className="lg:col-span-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[0.6rem] uppercase tracking-[0.22em] text-white/55">Power loss</span>
              <span className="font-mono text-[0.8rem] text-rose-200">−{shockPct}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={90}
              step={5}
              value={shockPct}
              onChange={(e) => setShockPct(Number(e.target.value))}
              aria-label="Purchasing power loss magnitude"
              className="w-full accent-rose-300"
            />
            <div className="text-[0.55rem] text-white/35 mt-1">purchasing-power collapse vs the basket</div>
          </div>
          {/* Successor */}
          <div className="lg:col-span-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-white/55 mb-2">Successor candidate</div>
            <select
              value={successor}
              onChange={(e) => setSuccessor(e.target.value)}
              aria-label="Successor currency"
              className="w-full bg-white/[0.03] border border-white/[0.1] rounded-md px-2 py-1.5 text-[0.75rem] font-mono text-white/85 focus:outline-none focus:border-mtqs-gold/40"
            >
              <option value="">— none (eject only) —</option>
              {(meta?.universe ?? []).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <div className="text-[0.55rem] text-white/35 mt-1">
              quotes: {meta ? (meta.quotes.live ? "live ECB/Frankfurter" : "fixture fallback") : "…"}
            </div>
          </div>
          {/* Run */}
          <div className="lg:col-span-2 flex items-stretch">
            <button
              onClick={run}
              disabled={running}
              className="w-full rounded-lg border border-rose-300/30 bg-rose-300/10 hover:bg-rose-300/20 disabled:opacity-50 disabled:cursor-not-allowed transition px-4 py-3 inline-flex items-center justify-center gap-2 text-[0.78rem] font-semibold text-rose-100"
            >
              {running ? (
                <>
                  <Zap className="h-4 w-4 animate-pulse" aria-hidden="true" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Run drill
                </>
              )}
            </button>
          </div>
        </div>

        {/* Result */}
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 rounded-xl border border-dashed border-white/[0.1] text-center"
            >
              <ShieldAlert className="h-6 w-6 text-white/30 mx-auto mb-2" aria-hidden="true" />
              <p className="text-[0.75rem] text-white/45 max-w-xl mx-auto">
                Pick a failing currency, a loss magnitude, and a successor — then run the drill. The simulation runs on a
                clone of the live index and live reserve holdings; nothing on the pilot is mutated.
              </p>
            </motion.div>
          ) : !result.ok ? (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-lg border border-rose-400/30 bg-rose-400/10 text-[0.78rem] text-rose-200">
              {result.error}
            </motion.div>
          ) : (
            <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Verdict banner */}
              <div
                className={`p-4 rounded-xl border ${
                  result.ejectedFromBasket
                    ? verdictPass
                      ? "border-mtqs-emerald/30 bg-mtqs-emerald/[0.06]"
                      : "border-rose-400/30 bg-rose-400/[0.06]"
                    : "border-amber-300/30 bg-amber-300/[0.06]"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  {result.ejectedFromBasket ? (
                    verdictPass ? (
                      <ShieldCheck className="h-4 w-4 text-mtqs-emerald" aria-hidden="true" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-rose-300" aria-hidden="true" />
                    )
                  ) : (
                    <History className="h-4 w-4 text-amber-300" aria-hidden="true" />
                  )}
                  <span className="text-[0.85rem] font-semibold text-white/90">
                    {result.ejectedFromBasket
                      ? `${result.ejected} ejected${result.successor ? ` → ${result.successor.code} admitted` : " → no successor"} — ${verdictPass ? "unit continuity PROVEN" : "CONTINUITY CHECK FAILED"}`
                      : `${result.ejected} degraded but NOT ejected (monitor path)`}
                  </span>
                  {cont && (
                    <Pill tone={verdictPass ? "emerald" : "rose"} className="ml-auto font-mono">
                      artificial return {cont.artificialReturnPct.toFixed(9)}%
                    </Pill>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[0.7rem]">
                  <div className="p-2 rounded-lg bg-white/[0.03]">
                    <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">P_MTQ before</div>
                    <div className="font-mono text-white/85">{fmtFixed(result.baseline.iLevel, 6)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.03]">
                    <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">P_MTQ after</div>
                    <div className="font-mono text-white/85">{fmtFixed(result.after.iLevel, 6)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.03]">
                    <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">Honest loss accrued</div>
                    <div className="font-mono text-rose-200">−{result.continuity.accruedLossPct.toFixed(3)}%</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.03]">
                    <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">Chain factor G_t</div>
                    <div className="font-mono text-white/85">{fmtFixed(result.after.gFactor, 6)}</div>
                  </div>
                </div>
                {result.successorSanity && (
                  <p className="mt-2 text-[0.62rem] text-white/45">
                    Successor slot check: a +{result.successorSanity.movePct}% move in {result.successor?.code} moves P_MTQ by{" "}
                    <span className="font-mono text-mtqs-emerald">{result.successorSanity.actualIndexMovePct.toFixed(4)}%</span>{" "}
                    (expected {result.successorSanity.expectedIndexMovePct.toFixed(4)}% = seed weight {((result.successor?.seedWeight ?? 0) * 100).toFixed(1)}% ×{" "}
                    {result.successorSanity.movePct}%) —{" "}
                    {result.successorSanity.pass ? <span className="text-mtqs-emerald">PASS</span> : <span className="text-rose-300">FAIL</span>}
                  </p>
                )}
              </div>

              {/* Timeline */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Landmark className="h-3.5 w-3.5 text-mtqs-gold/70" aria-hidden="true" />
                  <span className="text-[0.62rem] uppercase tracking-[0.22em] text-white/55">Crisis timeline</span>
                </div>
                <ol className="relative border-l border-white/[0.08] ml-2 space-y-0 max-h-96 overflow-y-auto custom-scroll pr-2">
                  {result.timeline.map((s, i) => {
                    const pm = PHASE_META[s.phase] ?? PHASE_META.decay;
                    return (
                      <motion.li
                        key={`${s.phase}-${s.t}-${i}`}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="ml-4 pb-4 relative"
                      >
                        <span
                          className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border ${
                            s.phase === "eject" || s.phase === "ladder"
                              ? "bg-rose-400/40 border-rose-300/50"
                              : s.phase === "succession" || s.phase === "post"
                                ? "bg-mtqs-emerald/40 border-mtqs-emerald/50"
                                : "bg-mtqs-gold/40 border-mtqs-gold/50"
                          }`}
                          aria-hidden="true"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[0.6rem] text-white/35">h+{s.t}</span>
                          <Pill tone={pm.tone} className="text-[0.55rem]">{pm.label}</Pill>
                          {s.ejectStage > 0 && (
                            <span className="text-[0.55rem] font-mono text-rose-200/80 border border-rose-300/25 rounded px-1.5 py-0.5">
                              stage {s.ejectStage}
                            </span>
                          )}
                          <span className="font-mono text-[0.68rem] text-mtqs-gold/80">I_t {fmtFixed(s.iLevel, 6)}</span>
                          {s.divisor != null && (
                            <span className="font-mono text-[0.58rem] text-white/40">D {s.divisor.toPrecision(5)}</span>
                          )}
                        </div>
                        <div className="text-[0.75rem] text-white/80 mt-0.5">{s.label}</div>
                        <p className="text-[0.62rem] text-white/45 mt-0.5 max-w-3xl leading-relaxed">{s.note}</p>
                      </motion.li>
                    );
                  })}
                </ol>
              </div>

              {/* Weights before → after */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center gap-2 mb-2">
                    <Coins className="h-3.5 w-3.5 text-white/50" aria-hidden="true" />
                    <span className="text-[0.62rem] uppercase tracking-[0.22em] text-white/55">Basket before</span>
                  </div>
                  <ul className="space-y-1.5">
                    {result.baseline.weights.map((w) => (
                      <li key={w.component} className="flex items-center gap-2">
                        <span className="w-10 text-[0.65rem] font-mono text-white/60">{w.component}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                          <div className="h-full rounded-full bg-mtqs-gold/50" style={{ width: `${w.weight * 100}%` }} />
                        </div>
                        <span className="w-12 text-right font-mono text-[0.65rem] text-white/70">{(w.weight * 100).toFixed(2)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center gap-2 mb-2">
                    <Coins className="h-3.5 w-3.5 text-mtqs-gold" aria-hidden="true" />
                    <span className="text-[0.62rem] uppercase tracking-[0.22em] text-white/55">Basket after</span>
                  </div>
                  <ul className="space-y-1.5">
                    {result.after.weights.map((w) => (
                      <li key={w.component} className="flex items-center gap-2">
                        <span className={`w-10 text-[0.65rem] font-mono ${w.component === result.ejected ? "text-white/25 line-through" : w.component === result.successor?.code ? "text-mtqs-emerald" : "text-white/60"}`}>
                          {w.component}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden relative">
                          <div
                            className={`h-full rounded-full ${w.component === result.successor?.code ? "bg-mtqs-emerald/60" : "bg-mtqs-gold/50"}`}
                            style={{ width: `${w.weight * 100}%` }}
                          />
                          {w.envelope && (
                            <div
                              className="absolute top-0 bottom-0 w-px bg-white/25"
                              style={{ left: `${w.envelope.lower * 100}%` }}
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <span className="w-12 text-right font-mono text-[0.65rem] text-white/70">{(w.weight * 100).toFixed(2)}%</span>
                        <span
                          className={`w-6 text-[0.55rem] ${
                            w.inEnvelope == null ? "text-white/25" : w.inEnvelope ? "text-mtqs-emerald" : "text-rose-300"
                          }`}
                          title={w.envelope ? `envelope ${(w.envelope.lower * 100).toFixed(0)}–${(w.envelope.upper * 100).toFixed(0)}%` : "no envelope"}
                        >
                          {w.inEnvelope == null ? "—" : w.inEnvelope ? "✓" : "!"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="text-[0.55rem] text-white/35 mt-1.5">✓ in envelope · ! outside (MASE re-asserts, velocity-capped §8.3)</div>
                </div>
              </div>

              {/* Reserve ladder */}
              {result.reserveFlow && (
                <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-300/80" aria-hidden="true" />
                    <span className="text-[0.62rem] uppercase tracking-[0.22em] text-white/55">
                      Reserve defence — staged liquidation of the {result.ejected} sleeve
                    </span>
                    <span className="ml-auto text-[0.55rem] font-mono text-white/40">
                      holding {result.reserveFlow.ejectedHoldingNativePerMtq.toPrecision(4)} {result.ejected}/MTQΣ
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[0.68rem]">
                      <thead>
                        <tr className="text-white/40 text-left">
                          <th className="py-1 pr-3 font-normal">Stage</th>
                          <th className="py-1 pr-3 font-normal">Hour</th>
                          <th className="py-1 pr-3 font-normal">Sell (incr.)</th>
                          <th className="py-1 pr-3 font-normal">{result.ejected} price</th>
                          <th className="py-1 pr-3 font-normal">Proceeds /MTQΣ</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono text-white/75">
                        {result.reserveFlow.ladder.map((l) => (
                          <tr key={l.stage} className="border-t border-white/[0.05]">
                            <td className="py-1 pr-3 text-rose-200/90">{l.stage}</td>
                            <td className="py-1 pr-3">h+{l.triggerHour}</td>
                            <td className="py-1 pr-3">{(l.sellPct * 100).toFixed(0)}%</td>
                            <td className="py-1 pr-3">{l.priceUsd.toPrecision(4)}</td>
                            <td className="py-1 pr-3">{l.proceedsUsdPerMtq.toPrecision(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[0.65rem]">
                    <div className="p-2 rounded-lg bg-white/[0.03]">
                      <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">Initial exposure</div>
                      <div className="font-mono text-white/80">{result.reserveFlow.initialExposureUsdPerMtq.toPrecision(4)}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white/[0.03]">
                      <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">Realized (ladder)</div>
                      <div className="font-mono text-mtqs-emerald">{result.reserveFlow.realizedUsdPerMtq.toPrecision(4)}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white/[0.03]">
                      <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">If held to the end</div>
                      <div className="font-mono text-rose-200">{result.reserveFlow.finalMarkUsdPerMtq.toPrecision(4)}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white/[0.03]">
                      <div className="text-white/40 text-[0.55rem] uppercase tracking-wider">Saved by acting</div>
                      <div className="font-mono text-mtqs-gold-light">+{result.reserveFlow.savedByActingUsdPerMtq.toPrecision(3)}</div>
                    </div>
                  </div>
                  <p className="mt-2 text-[0.6rem] text-white/40">
                    Proceeds reallocate to the post-succession basket per its weights (USD sleeve → USDC/USDP/USDT ⅓ each ·
                    gold sleeve → PAXG/XAUT 50/50, §15.6). USD figures here are reporting numeraires for the flow plan only.
                  </p>
                </div>
              )}

              {/* Reintegration */}
              <div className="flex items-start gap-2 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <RotateCcw className="h-3.5 w-3.5 text-white/45 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <div className="text-[0.62rem] uppercase tracking-[0.22em] text-white/55 mb-1">
                    Can the ejected currency come back?
                  </div>
                  <p className="text-[0.68rem] text-white/50 leading-relaxed">{result.reintegrationNote}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading meta skeleton / honest fetch-error state */}
        {metaError ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-[0.68rem] leading-relaxed text-rose-200">
            <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <span className="font-semibold">Succession metadata unavailable — </span>
              the candidate universe and live admission quotes could not be loaded
              (<span className="font-mono">{metaError}</span>). The successor selector is empty
              because nothing is fabricated.
              <button
                onClick={loadMeta}
                className="ml-2 underline decoration-rose-300/50 hover:decoration-rose-200 text-rose-100 transition"
              >
                retry fetch
              </button>
            </div>
          </div>
        ) : !meta ? (
          <div className="mt-3 flex items-center gap-2 text-[0.65rem] text-white/40">
            <Skeleton className="h-3 w-3 rounded-full" />
            Loading candidate universe + live quotes…
          </div>
        ) : null}
      </Panel>
    </Reveal>
  );
}
