// MTQΣ — Live Monetary State (§2, §3, §4)
// Bespoke metric tiles, not generic shadcn cards.

"use client";

import { motion } from "framer-motion";
import { Panel, Reveal, TickNumber, GlowDot, Pill, MiniBar } from "./primitives";
import {
  fmtFixed,
  fmtUsd,
  fmtUsdCompact,
  fmtRatio,
  rrColor,
  lcrColor,
  statusColor,
  fmtNum,
} from "./format";
import {
  RR_TARGET,
  RR_STRESS,
  RR_HARD,
  PRICE_SAFETY_LOWER,
  PRICE_SAFETY_UPPER,
  RISK_STATE_MACHINE,
  GFB_BASE_DENOMINATOR,
} from "@/lib/mtq/blueprint";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

function CardTopStripe({ color = "gold" }: { color?: "gold" | "emerald" | "rose" | "amber" }) {
  const c = {
    gold: "rgba(43, 171, 251, 0.55)",
    emerald: "rgba(0, 229, 255, 0.55)",
    rose: "rgba(255, 93, 115, 0.55)",
    amber: "rgba(255, 184, 77, 0.55)",
  }[color];
  return (
    <div
      className="absolute inset-x-0 top-0 h-px"
      style={{ background: `linear-gradient(90deg, transparent, ${c}, transparent)` }}
    />
  );
}

function MetricTile({
  eyebrow,
  children,
  stripe = "gold",
  className = "",
}: {
  eyebrow: string;
  children: React.ReactNode;
  stripe?: "gold" | "emerald" | "rose" | "amber";
  className?: string;
}) {
  return (
    <Panel className={`relative p-5 ${className}`}>
      <CardTopStripe color={stripe} />
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[0.625rem] uppercase tracking-[0.25em] text-white/55">
          {eyebrow}
        </span>
      </div>
      {children}
    </Panel>
  );
}

export function LiveMonetaryState({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  if (!snapshot) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-white/[0.03] border border-white/[0.06]" />
        ))}
      </div>
    );
  }

  const rr = snapshot.reserveRatio;
  const rrFin = Number.isFinite(rr);
  const lcr = snapshot.lcr;
  const lcrFin = Number.isFinite(lcr);
  const sc = statusColor(snapshot.status);
  const policy = RISK_STATE_MACHINE.find((p) => p.status === snapshot.status) ?? RISK_STATE_MACHINE[0];

  return (
    <div className="space-y-4">
      {/* Row 1 — top 4 tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Reveal delay={0}>
          <MetricTile eyebrow="Reference Index (§2)" stripe="gold">
            <div className="flex items-baseline gap-2">
              <TickNumber
                value={snapshot.gfbIndex}
                format={(n) => fmtFixed(n, 4)}
                className="text-3xl font-semibold mtqs-gold-text"
              />
              <span className="text-xs text-white/55 font-mono" title="USD is used here only as an external reporting/valuation numeraire. It does not define the MTQΣ monetary unit; no fixed USD parity is implied or guaranteed.">·USD reporting</span>
            </div>
            <p className="mt-2 text-[0.7rem] text-white/55">
              normalised = 1.00 at 2026-01-01 00:00 UTC
            </p>
            <div className="mt-3 flex items-center gap-2 text-[0.65rem] text-white/55">
              <span className="font-mono">7-component prior / GFB_base = ${GFB_BASE_DENOMINATOR.toFixed(2)}</span>
            </div>
          </MetricTile>
        </Reveal>

        <Reveal delay={0.04}>
          <MetricTile eyebrow="Reference Value (§3)" stripe={snapshot.priceInBand ? "emerald" : "rose"}>
            <div className="flex items-baseline gap-2">
              <TickNumber
                value={snapshot.mtqPrice}
                format={(n) => fmtFixed(n, 4)}
                className={`text-3xl font-semibold ${snapshot.priceInBand ? "text-mtqs-emerald" : "text-mtqs-rose"}`}
              />
              {snapshot.priceInBand ? (
                <Pill tone="emerald">in-band</Pill>
              ) : (
                <Pill tone="rose">CIRCUIT BREAKER</Pill>
              )}
            </div>
            <p className="mt-2 text-[0.7rem] text-white/55">
              Safety band {PRICE_SAFETY_LOWER.toFixed(2)}–{PRICE_SAFETY_UPPER.toFixed(2)} (USD reporting)
            </p>
            <div className="mt-3">
              <MiniBar
                value={snapshot.mtqPrice}
                min={PRICE_SAFETY_LOWER}
                max={PRICE_SAFETY_UPPER}
                colorClass={snapshot.priceInBand ? "bg-emerald-400" : "bg-rose-400"}
                height="h-1.5"
              />
              <div className="mt-1 flex justify-between text-[0.6rem] text-white/60 font-mono">
                <span>{PRICE_SAFETY_LOWER.toFixed(2)}</span>
                <span>{PRICE_SAFETY_UPPER.toFixed(2)}</span>
              </div>
            </div>
          </MetricTile>
        </Reveal>

        <Reveal delay={0.08}>
          <MetricTile eyebrow="Reserve NAV · USD reporting (§4)" stripe="gold">
            <TickNumber
              value={snapshot.nav}
              format={fmtUsd}
              className="text-3xl font-semibold mtqs-gold-text"
            />
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-[0.7rem] text-white/55">
                <span>fiat net</span>
                <span className="font-mono">{fmtUsdCompact(snapshot.reserve.fiatNet)}</span>
              </div>
              <div className="flex justify-between text-[0.7rem] text-white/55">
                <span>gold net (PAXG + XAUT)</span>
                <span className="font-mono">{fmtUsdCompact(snapshot.reserve.goldNet)}</span>
              </div>
              <div className="flex justify-between text-[0.7rem] text-white/55">
                <span>gold price</span>
                <span className="font-mono">{fmtUsdCompact(snapshot.reserve.goldPrice)}/oz</span>
              </div>
            </div>
          </MetricTile>
        </Reveal>

        <Reveal delay={0.12}>
          <MetricTile eyebrow="Reserve Ratio (§4.2)" stripe={rrColor(rr).includes("emerald") ? "emerald" : rrColor(rr).includes("amber") ? "amber" : "rose"}>
            <div className="flex items-baseline gap-2">
              <TickNumber
                value={rrFin ? rr : null}
                format={(n) => fmtRatio(n)}
                className={`text-3xl font-semibold ${rrColor(rr)}`}
              />
              {!rrFin && <span className="text-base text-mtqs-emerald/80">∞ — no liability</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Pill tone={rrFin && rr >= RR_TARGET ? "emerald" : "muted"}>TGT {(RR_TARGET * 100).toFixed(0)}%</Pill>
              <Pill tone={rrFin && rr >= RR_STRESS && rr < RR_TARGET ? "amber" : "muted"}>STR {(RR_STRESS * 100).toFixed(0)}%</Pill>
              <Pill tone={rrFin && rr >= RR_HARD && rr < RR_STRESS ? "rose" : "muted"}>HRD {(RR_HARD * 100).toFixed(0)}%</Pill>
            </div>
            <p className="mt-3 text-[0.7rem] text-white/55">
              {policy.rrTarget >= 1 ? `target ${fmtRatio(policy.rrTarget)} (§14.1)` : "no target"}
            </p>
          </MetricTile>
        </Reveal>
      </div>

      {/* Row 2 — LCR, NAV/token (RG-02), status, supply */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Reveal delay={0}>
          <MetricTile eyebrow="Liquidity Coverage Ratio (§4.3)" stripe={lcrFin && lcr >= 1.0 ? "emerald" : "amber"}>
            <div className="flex items-baseline gap-2">
              <TickNumber
                value={lcrFin ? lcr : null}
                format={(n) => fmtRatio(n)}
                className={`text-3xl font-semibold ${lcrColor(lcr)}`}
              />
              {!lcrFin && <span className="text-base text-mtqs-emerald/80">∞ — no liability</span>}
            </div>
            <p className="mt-2 text-[0.7rem] text-white/55">
              LCR = liquid-fiat / (S · P_MTQ · 25%) · target ≥ 100%
            </p>
            <p className="mt-2 text-[0.7rem] text-white/55">
              STRESS_REDEMPTION_RATE 25% / 30 days
            </p>
          </MetricTile>
        </Reveal>

        {/* AUDIT-FIX §7 item 9 / RG-02 — NAV per MTQΣ card. NAV/MTQ = V_net / S_circ
            (the USD book value per token; what redemption actually pays, Invariant I6).
            It is a DIFFERENT symbol from P_MTQ (the chain-linked index reference
            price, shown in Row 1). The two must remain visibly distinct. */}
        <Reveal delay={0.04}>
          <MetricTile
            eyebrow="NAV per MTQΣ (§19.3)"
            stripe={
              snapshot.indexNavDivergence.status === "normal"
                ? "gold"
                : snapshot.indexNavDivergence.status === "monitor"
                ? "amber"
                : "rose"
            }
          >
            <div className="flex items-baseline gap-2">
              <TickNumber
                value={snapshot.indexNavDivergence.navPerMtq}
                format={(n) => `$${fmtFixed(n, 4)}`}
                className="text-3xl font-semibold mtqs-gold-text"
              />
              <span
                className={`font-mono tabular-nums text-[0.7rem] ${
                  snapshot.indexNavDivergence.status === "normal"
                    ? "text-mtqs-emerald"
                    : snapshot.indexNavDivergence.status === "monitor"
                    ? "text-mtqs-amber"
                    : "text-mtqs-rose"
                }`}
                aria-label={`Divergence versus index price ${snapshot.indexNavDivergence.divergencePct.toFixed(2)} percent, status ${snapshot.indexNavDivergence.status}`}
              >
                Δ {snapshot.indexNavDivergence.divergence >= 0 ? "+" : "−"}
                {Math.abs(snapshot.indexNavDivergence.divergencePct).toFixed(2)}%
              </span>
            </div>
            <p className="mt-2 text-[0.7rem] text-white/55">
              book value per token (§19.3) — distinct from P<sub>MTQ</sub> (index)
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Pill tone="muted">
                P<sub>MTQ</sub> ${fmtFixed(snapshot.indexNavDivergence.pMtq, 4)}
              </Pill>
              <Pill
                tone={
                  snapshot.indexNavDivergence.status === "normal"
                    ? "emerald"
                    : snapshot.indexNavDivergence.status === "monitor"
                    ? "amber"
                    : "rose"
                }
              >
                divergence {snapshot.indexNavDivergence.status}
              </Pill>
            </div>
            <p className="mt-3 text-[0.7rem] text-white/55">
              NAV/MTQ = V<sub>net</sub> / S<sub>circ</sub> · redemption pays NAV (I6)
            </p>
          </MetricTile>
        </Reveal>

        <Reveal delay={0.08}>
          <MetricTile eyebrow="Protocol Status (§14.1)" stripe={snapshot.status === "NORMAL" ? "emerald" : snapshot.status === "EMERGENCY" ? "rose" : "amber"}>
            <div className="flex items-center gap-2 mb-2">
              <GlowDot
                color={
                  snapshot.status === "NORMAL"
                    ? "emerald"
                    : snapshot.status === "CAUTION"
                    ? "amber"
                    : snapshot.status === "DEFENSIVE"
                    ? "amber"
                    : snapshot.status === "EMERGENCY"
                    ? "rose"
                    : "gold"
                }
              />
              <span className={`text-2xl font-semibold ${sc.text} ${sc.bg} rounded-md px-2 py-0.5 border ${sc.border}`}>
                {snapshot.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.7rem] text-white/90">
              <span className="text-white/55">minting</span>
              <span className="text-right">{policy.minting}</span>
              <span className="text-white/55">redemption</span>
              <span className="text-right">{policy.redemption}</span>
              <span className="text-white/55">rebalancing</span>
              <span className="text-right">{policy.rebalancing}</span>
              <span className="text-white/55">RR target</span>
              <span className="text-right font-mono">{fmtRatio(policy.rrTarget)}</span>
            </div>
          </MetricTile>
        </Reveal>

        <Reveal delay={0.12}>
          <MetricTile eyebrow="Supply (§13.1)" stripe="gold">
            <div className="space-y-2.5">
              <div>
                <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/55">Circulating</div>
                <TickNumber
                  value={snapshot.circulatingSupply}
                  format={(n) => fmtNum(n, 2)}
                  className="text-2xl font-semibold text-mtqs-gold"
                />
                <span className="ml-1 text-xs text-white/55 font-mono">MTQ</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[0.7rem] text-white/55">
                <div>
                  <div className="text-white/60">Total</div>
                  <div className="font-mono text-white">{fmtNum(snapshot.totalSupply, 0)} MTQ</div>
                </div>
                <div>
                  <div className="text-white/60">Genesis Reserve</div>
                  <div className="font-mono text-white">{fmtNum(snapshot.genesisReserve, 0)} MTQ</div>
                </div>
              </div>
              <p className="text-[0.62rem] text-white/45">
                engine ledger (simulated) — on-chain supplies: see Contracts
              </p>
            </div>
          </MetricTile>
        </Reveal>
      </div>

      {/* Row 3 — FX */}
      <Reveal delay={0}>
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[0.625rem] uppercase tracking-[0.25em] text-white/55">
              Live FX & Macro Signals (§6.2)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[0.65rem] text-white/55 font-mono">{snapshot.fx.source}</span>
              {snapshot.fx.degraded ? <Pill tone="amber">degraded</Pill> : <Pill tone="emerald">live</Pill>}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { k: "EUR/USD", v: snapshot.fx.EUR_USD, digits: 4 },
              { k: "GBP/USD", v: snapshot.fx.GBP_USD, digits: 4 },
              { k: "JPY/USD", v: snapshot.fx.JPY_USD, digits: 5 },
              { k: "CNY/USD", v: snapshot.fx.CNY_USD, digits: 5 },
              { k: "CHF/USD", v: snapshot.fx.CHF_USD, digits: 4 },
              { k: "XAU/USD", v: snapshot.fx.XAU_USD, digits: 2, isUsd: true },
            ].map((r) => (
              <div key={r.k} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                <div className="text-[0.6rem] uppercase tracking-[0.2em] text-white/55">{r.k}</div>
                <div className="font-mono tabular-nums text-sm text-mtqs-gold">
                  {r.isUsd ? `$${r.v.toFixed(r.digits)}` : r.v.toFixed(r.digits)}
                </div>
              </div>
            ))}
            {/* VIX/DXY — wired to fx.liveVix / fx.liveDxy: the chip reflects the
                LIVE source state (emerald when the feed is live, amber “sim” when
                the fallback OU walk produced the value; the header pill above
                covers the snapshot-wide `degraded` flag). */}
            <div
              className={`rounded-md border p-2.5 ${
                snapshot.fx.liveVix
                  ? "border-mtqs-emerald/20 bg-mtqs-emerald/5"
                  : "border-mtqs-amber/20 bg-mtqs-amber/5"
              }`}
              title={snapshot.fx.liveVix ? "VIX is live (Yahoo Finance ^VIX / FRED VIXCLS)." : "VIX is the seeded OU-walk fallback (no live feed this tick)."}
            >
              <div
                className={`text-[0.6rem] uppercase tracking-[0.2em] ${
                  snapshot.fx.liveVix ? "text-mtqs-emerald/80" : "text-mtqs-amber/80"
                }`}
              >
                VIX · {snapshot.fx.liveVix ? "live" : "sim"}
              </div>
              <div
                className={`font-mono tabular-nums text-sm ${
                  snapshot.fx.liveVix ? "text-mtqs-emerald" : "text-mtqs-amber"
                }`}
              >
                {snapshot.fx.VIX.toFixed(2)}
              </div>
            </div>
            <div
              className={`rounded-md border p-2.5 ${
                snapshot.fx.liveDxy
                  ? "border-mtqs-emerald/20 bg-mtqs-emerald/5"
                  : "border-mtqs-amber/20 bg-mtqs-amber/5"
              }`}
              title={snapshot.fx.liveDxy ? "DXY is live (Yahoo Finance DX-Y.NYB / FRED DTWEXBGS, or Frankfurter self-calc)." : "DXY is the seeded OU-walk fallback (no live feed this tick)."}
            >
              <div
                className={`text-[0.6rem] uppercase tracking-[0.2em] ${
                  snapshot.fx.liveDxy ? "text-mtqs-emerald/80" : "text-mtqs-amber/80"
                }`}
              >
                DXY · {snapshot.fx.liveDxy ? "live" : "sim"}
              </div>
              <div
                className={`font-mono tabular-nums text-sm ${
                  snapshot.fx.liveDxy ? "text-mtqs-emerald" : "text-mtqs-amber"
                }`}
              >
                {snapshot.fx.DXY.toFixed(2)}
              </div>
            </div>
          </div>
          <p className="mt-3 text-[0.7rem] text-white/55">
            {snapshot.fx.liveVix && snapshot.fx.liveDxy ? (
              <>
                VIX &amp; DXY are <span className="text-mtqs-emerald/90">live from Yahoo Finance</span> (CBOE ^VIX + ICE
                DX-Y.NYB), with Frankfurter self-calc (official geometric DXY formula) + seeded OU walk as honest
                fallbacks.
              </>
            ) : (
              <>
                VIX &amp; DXY sources: Yahoo Finance (CBOE ^VIX + ICE DX-Y.NYB) when reachable, else the{" "}
                <span className="text-mtqs-amber/90">seeded OU-walk fallback</span> — see each chip&apos;s live/sim state.
              </>
            )}{" "}
            FX (EUR/GBP/JPY/CNY/CHF) sourced from Frankfurter (ECB) + gold from gold-api.com. CHF is a
            first-class index component in v1.0 (5% strategic prior).{" "}
            {snapshot.fx.liveCount != null
              ? `${snapshot.fx.liveCount} of 8 macro signals are live in this snapshot.`
              : "Live-signal count unavailable for this snapshot."}
          </p>
        </Panel>
      </Reveal>
    </div>
  );
}

// Constant displayed under GFB Index tile — the v1.0 chain-linked denominator
// is dominated by the Gold component (W_Au × P_Au,0 = 0.26 × 2500 = 650) so it
// is shown dynamically from the blueprint constant above.
// (Legacy v1.2 string removed — it referenced the 5-currency fixed q_i basket.)
