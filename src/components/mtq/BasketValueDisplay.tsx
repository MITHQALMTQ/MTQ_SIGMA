"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Panel, Reveal, GlowDot } from "./primitives";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

// MTQΣ — Live Pilot-Ledger Reference Value Display (GOLD-ANCHORED)
//
// The live value of 1 MTQΣ is expressed BY the reserve basket — each reserve
// asset in its OWN native unit, individually. The assets are NOT connected to
// each other through a dollar conversion: there is no "≈ $X share" line and
// no dollar headline. The canonical anchor quote is GOLD (grams of fine gold
// per MTQΣ). The reserve basket is anchored by gold and NOT pegged to USD —
// the USD figure appears only as a small "reporting numeraire" footnote,
// exactly as the blueprint permits (USD may be a unit of account for
// reporting; never a peg).
//
// Data source: snapshot.holdings — the ACTUAL reserve holdings (native units)
// divided by the supply base (circulating when > 0, else total genesis).

interface BasketValueProps {
  snapshot: MetricsSnapshot | null;
}

const TROY_OZ_GRAMS = 31.1034768;

// Per-asset metadata: native symbol, name, on-chain token, accent color.
// Each asset is an individual store of value — displayed in its own unit.
const ASSET_META = [
  { code: "USD", unit: "USD", symbol: "", name: "US Dollar", token: "USDC · USDP · USDT", color: "#2BABFB", key: "usd" as const },
  { code: "EUR", unit: "EUR", symbol: "€", name: "Euro", token: "EURC (Circle)", color: "#00E5FF", key: "eur" as const },
  { code: "JPY", unit: "JPY", symbol: "¥", name: "Japanese Yen", token: "JPY₿ (registry-resolved)", color: "#3882F6", key: "jpy" as const },
  { code: "GBP", unit: "GBP", symbol: "£", name: "British Pound", token: "GBP₿ (registry-resolved)", color: "#8B5CF6", key: "gbp" as const },
  { code: "CNH", unit: "CNH", symbol: "", name: "Offshore Yuan", token: "CNH₿ (offshore)", color: "#FF8C42", key: "cny" as const },
  { code: "CHF", unit: "CHF", symbol: "", name: "Swiss Franc", token: "CHF₿ (registry-resolved)", color: "#FF4D6D", key: "chf" as const },
] as const;

function formatGold(grams: number): { value: string; unit: string } {
  if (!Number.isFinite(grams) || grams <= 0) return { value: "—", unit: "g" };
  if (grams >= 1) return { value: `${grams.toFixed(4)} g`, unit: "grams of fine gold" };
  const mg = grams * 1000;
  if (mg >= 1) return { value: `${mg.toFixed(4)} mg`, unit: "milligrams of fine gold" };
  return { value: `${(mg * 1000).toFixed(4)} µg`, unit: "micrograms of fine gold" };
}

function formatNative(code: string, amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  switch (code) {
    case "USD": return amount.toFixed(6);
    case "JPY": return amount.toFixed(4);
    default: return amount.toFixed(6);
  }
}

export function BasketValueDisplay({ snapshot }: BasketValueProps) {
  const holdings = snapshot?.holdings ?? null;
  const updatedAt = snapshot?.fetchedAt ?? Date.now();

  // Hydration-safe clock (SSR renders UTC, client renders local — gate it).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const gold = holdings ? formatGold(holdings.perMtq.goldGrams) : { value: "—", unit: "grams of fine gold" };
  const goldOz = holdings ? holdings.perMtq.goldOz : null;

  // Live NAV shares (actual portfolio weights — sums to 100%).
  const navShares = holdings?.navShares ?? null;
  const shareSum = navShares
    ? (navShares.usd + navShares.eur + navShares.gbp + navShares.jpy + navShares.cny + navShares.chf + navShares.gold) * 100
    : null;

  const basisLabel =
    holdings?.basis === "circulating"
      ? "per CIRCULATING MTQΣ (the liability base — genesis-reserve tokens are locked)"
      : "per TOTAL supply (pure genesis state — nothing circulates yet; the locked genesis tokens carry the full backing)";

  return (
    <Reveal>
      <Panel className="p-5 sm:p-6 mtqs-glow">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <GlowDot color="gold" size="h-3 w-3" className="mt-1" />
            <div>
              <div className="mtqs-eyebrow flex items-center gap-2">
                Live · Simulated Pilot Ledger (legacy v1/v2 reserve path)
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="inline-flex items-center gap-1 text-[0.55rem] text-mtqs-emerald"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-mtqs-emerald" />
                  updating
                </motion.span>
              </div>
              <h3 className="text-lg font-semibold text-white/90 mt-1">1 MTQΣ — Pilot-Ledger Reference Basket (simulated, legacy v1/v2)</h3>
              <p className="text-xs text-white/55 mt-1">
                Each ledger asset is held per unit in its <span className="text-mtqs-gold/80">own native unit</span> — individual,
                not connected through the dollar. Gold is the anchor. Values are engine-live; the ledger itself is the
                simulated pilot ledger (G8) — no on-chain proof of real assets. Under the v3.0 no-conventional-reserve
                objective this display is the legacy reference path (Gate B, D-13.3–D-13.7 open).
              </p>
            </div>
          </div>
          <div className="text-[0.55rem] text-white/35 text-right shrink-0">
            <div>updated</div>
            <div className="font-mono text-mtqs-gold/50">
              {mounted ? new Date(updatedAt).toLocaleTimeString("en-US", { hour12: false }) : "—"}
            </div>
          </div>
        </div>

        {/* ===== The Anchor: grams of gold per 1 MTQΣ (live) ===== */}
        <div className="mb-4 p-4 rounded-xl border border-mtqs-gold/25" style={{ background: "rgba(43,171,251,0.06)" }}>
          <div className="flex flex-wrap items-baseline gap-3">
            <motion.span
              key={gold.value}
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="font-mono text-2xl sm:text-3xl font-bold mtqs-gold-text tabular-nums"
            >
              {gold.value}
            </motion.span>
            <span className="text-sm text-white/60">of gold <span className="text-white/35">· {gold.unit}</span></span>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-mtqs-gold/30 bg-mtqs-gold/10 px-2.5 py-1 text-[0.55rem] uppercase tracking-[0.18em] text-mtqs-gold">
              <span aria-hidden="true">🥇</span> the anchor
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.68rem] text-white/45">
            {goldOz != null && <span className="font-mono">{goldOz.toExponential(3)} troy oz / MTQΣ</span>}
            {holdings && (
              <span className="font-mono">
                index vault {(holdings.indexGoldOz).toFixed(2)} oz + reserve buffer {(holdings.reserveGoldOz).toFixed(2)} oz
                <span className="text-white/30"> (§14.1 separation)</span>
              </span>
            )}
            <span>anchored by gold — <span className="text-mtqs-gold/70">not pegged to USD</span> (§18.1 · §3.5 · I5/I6 — P<sub>MTQ,t</sub> = I<sub>t</sub>/I<sub>base</sub>; mint priced against the adaptive index, redemption against NAV)</span>
          </div>
        </div>

        {/* ===== Per-asset native backing grid — each asset individual ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {ASSET_META.map((a, i) => {
            const qty = holdings ? holdings.perMtq[a.key] : null;
            const share = navShares
              ? a.key === "usd" ? navShares.usd : navShares[a.key === "cny" ? "cny" : a.key]
              : null;
            return (
              <motion.div
                key={a.code}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color, boxShadow: `0 0 6px ${a.color}80` }} />
                  <span className="text-[0.6rem] uppercase tracking-wider text-white/55">{a.code}</span>
                  {share != null && (
                    <span className="text-[0.55rem] text-mtqs-gold/50 ml-auto">
                      {(share * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="font-mono text-sm font-semibold tabular-nums" style={{ color: a.color }}>
                  {qty != null ? (
                    <>
                      {a.symbol}
                      {formatNative(a.code, qty)}
                      <span className="text-[0.6rem] text-white/40 ml-1">{a.unit}</span>
                    </>
                  ) : (
                    <span className="text-white/30">—</span>
                  )}
                </div>
                <div className="text-[0.55rem] text-white/40 mt-0.5">{a.name}</div>
                <div className="text-[0.5rem] text-white/30 mt-0.5">{a.token}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Gold card — the anchor sleeve, its own tile */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-mtqs-gold/20 bg-mtqs-gold/[0.04] flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #f5d27a, #EFC268)", boxShadow: "0 0 12px rgba(43,171,251,0.25)" }}>
              <span className="text-base" aria-hidden="true">🥇</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[0.6rem] uppercase tracking-wider text-amber-100/80">Gold (XAU)</span>
                {navShares && <span className="text-[0.55rem] text-mtqs-gold/60 ml-auto">{(navShares.gold * 100).toFixed(1)}%</span>}
              </div>
              <div className="font-mono text-sm font-semibold text-mtqs-gold-light tabular-nums">
                {goldOz != null ? (
                  <>
                    {goldOz.toExponential(3)} <span className="text-[0.6rem] text-white/40">oz / MTQΣ</span>
                  </>
                ) : "—"}
              </div>
              <div className="text-[0.5rem] text-white/30">PAXG · XAUT — reference allocation · simulated custody model</div>
            </div>
          </div>
          <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] flex items-center">
            <p className="text-[0.65rem] text-white/45 leading-relaxed">
              <span className="text-white/70">No dollar cross-conversion.</span> Each quantity above is the{" "}
              <span className="text-mtqs-gold/70">modeled holding</span> of that asset per MTQΣ in the{" "}
              <span className="text-mtqs-amber/80">simulated pilot ledger</span> — a reference allocation under a
              simulated custody model (the pilot has no real vaults, issuers or custodians; G8). The unit is a basket of
              stores of value, one of which is gold at the{" "}
              <span className="text-mtqs-gold/70">largest single anchor weight</span>.
            </p>
          </div>
        </div>

        {/* Reconciliation — NAV shares (not dollar shares) */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6rem] text-white/40">
          <GlowDot color="emerald" size="h-1.5 w-1.5" />
          <span>
            Σ live NAV shares:{" "}
            <span className="font-mono text-mtqs-emerald">{shareSum != null ? `${shareSum.toFixed(2)}%` : "—"}</span>{" "}
            (USD {(((navShares?.usd ?? 0) * 100)).toFixed(1)} · EUR {(((navShares?.eur ?? 0) * 100)).toFixed(1)} · Gold {(((navShares?.gold ?? 0) * 100)).toFixed(1)} …)
          </span>
          <span className="text-white/25">·</span>
          <span>basis: {basisLabel}</span>
        </div>

        {/* Honest note + USD reporting-numeraire footnote */}
        <p className="mt-3 text-[0.7rem] text-white/40 leading-relaxed">
          1 MTQΣ represents one unit of the Adaptive Reference Basket. The quantities above are live — they update every 4s
          from the simulated pilot ledger as the engine mints, redeems and rebalances. When the pilot&apos;s circulating supply is
          small relative to the genesis reserve, the per-token backing exceeds par (over-collateralization) — that surplus is
          redeemable at NAV, not a promise of face value. MTQΣ is <span className="text-mtqs-gold/70">PAR-referenced to the
          basket and gold-anchored</span> — it is never pegged to the US dollar or any single currency.
        </p>
        {snapshot && (
          <p className="mt-1.5 text-[0.6rem] text-white/30 leading-relaxed">
            Reporting numeraire only (never a peg): 1 MTQΣ ≈{" "}
            <span className="font-mono text-white/45">${snapshot.mtqPrice.toFixed(6)}</span> at the live chain-linked index
            I_t = <span className="font-mono text-white/45">{snapshot.gfbIndex.toFixed(6)}</span> · P_MTQ = I_t × PAR, PAR = 1.00 basket-unit.
          </p>
        )}
      </Panel>
    </Reveal>
  );
}
