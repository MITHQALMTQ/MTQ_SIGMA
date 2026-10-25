// MTQΣ — GFB Basket Reference (§2, v1.0 Master Blueprint)
// Strategic Prior table (7 components incl. Gold + CHF), base FX fixings, the
// computed GFB_BASE_DENOMINATOR (chain-linked), and the normalisation formula.
//
// v1.0 CHANGES (vs the legacy v1.2 GfbBasket):
//   - BASKET_TABLE (5 fixed-currency q_i) → STRATEGIC_PRIOR_TABLE (7 components,
//     adaptive W_t with Gold + CHF as first-class index members).
//   - Gold is now BOTH in the GFB Index AND the reserve portfolio (see the
//     GoldInReserve component below for the dual-role explanation).
//   - The denominator formula displayed is the new chain-linked sum
//     (USD·1 + EUR·1.05 + JPY·0.0067 + GBP·1.25 + CNY·0.14 + CHF·1.13 + Gold·2500).
//   - AUDIT-FIX F-1: the formula panel shows the ACTUAL canonical chain-linked
//     recursion (Master §9.2, form B) + the divisor-continuity note (§9.3) —
//     the deprecated Laspeyres fixed-basket form has been removed.

"use client";

import { Panel, Reveal } from "./primitives";
import { fmtUsdCompact, fmtFixed } from "./format";
import {
  STRATEGIC_PRIOR_TABLE,
  BASE_FIXINGS,
  GFB_BASE_DENOMINATOR,
} from "@/lib/mtq/blueprint";

const baseFx = [
  { pair: "EUR/USD", value: BASE_FIXINGS.EUR_USD },
  { pair: "GBP/USD", value: BASE_FIXINGS.GBP_USD },
  { pair: "JPY/USD", value: BASE_FIXINGS.JPY_USD },
  { pair: "CNY/USD", value: BASE_FIXINGS.CNY_USD },
  { pair: "CHF/USD", value: BASE_FIXINGS.CHF_USD },
  { pair: "XAU/USD", value: BASE_FIXINGS.XAU_USD, isGold: true },
];

// AUDIT-FIX F-1 — build the denominator string from BASE_FIXINGS so it can
// never drift from the engine constants again (CHF = 1.1300 per the Master
// Blueprint v1.0; the stale 0.88 was the legacy pre-v1.0 fixing).
const fmtFixing = (v: number) => (v < 0.01 ? v.toFixed(4) : v.toFixed(2));

export function GfbBasket() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-[#0E1F1B]">Strategic Prior (§3.2 — v1.0)</div>
            <span className="text-[0.7rem] text-[#5B6E68] font-mono">adaptive · 7 components · 7/7 Multi-Sig · 90d</span>
          </div>
          <div className="overflow-hidden rounded-md border border-[#E3EAE6]">
            <table className="w-full text-[0.75rem]">
              <thead className="bg-[#F7FAF8] text-[#5B6E68]">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Component</th>
                  <th className="text-left px-3 py-2 font-medium">Token (Registry-Resolved)</th>
                  <th className="text-right px-3 py-2 font-medium">W<sup>Prior</sup></th>
                </tr>
              </thead>
              <tbody>
                {STRATEGIC_PRIOR_TABLE.map((row, i) => (
                  <tr key={row.component} className={`border-t border-[#E3EAE6] ${i % 2 ? "bg-[#FAFCFA]" : ""}`}>
                    <td className="px-3 py-2 font-mono text-mtqs-gold">{row.component}</td>
                    <td className="px-3 py-2 text-[#0E1F1B]">{row.token}</td>
                    <td className="px-3 py-2 font-mono text-right text-mtqs-gold">{(row.weight * 100).toFixed(2)}%</td>
                  </tr>
                ))}
                <tr className="border-t border-[#E3EAE6] bg-mtqs-amber/5">
                  <td className="px-3 py-2 font-semibold" colSpan={2}>Σ W<sup>Prior</sup> · Total</td>
                  <td className="px-3 py-2 font-mono text-right font-semibold text-mtqs-gold">100.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[0.7rem] text-[#5B6E68] leading-relaxed">
            <span className="text-mtqs-gold/80 font-mono">W<sup>Prior</sup> ≠ W<sup>Target</sup> ≠ W<sup>Smooth</sup> ≠ W<sup>Execution</sup></span>.
            The prior is a soft anchor — deviation is penalised, not enforced. Live weights are computed
            by the MASE ensemble (§7) under per-component admissibility envelopes (§8.1).
          </p>
        </Panel>
      </Reveal>

      <Reveal delay={0.05}>
        <Panel className="p-5">
          <div className="mb-3 text-sm font-semibold text-[#0E1F1B]">Base-Date Fixings + Chain-Linked Denominator (§3.4)</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[0.72rem] mb-4">
            {baseFx.map((b) => (
              <div key={b.pair} className={`rounded-md border p-2.5 ${b.isGold ? "border-mtqs-amber/40 bg-amber-50" : "border-[#E3EAE6] bg-[#F7FAF8]"}`}>
                <div className="text-[#5B6E68] text-[0.65rem] uppercase tracking-[0.18em]">{b.pair}</div>
                <div className="font-mono text-mtqs-gold">{b.isGold ? `$${b.value.toFixed(2)}` : b.value.toFixed(4)}</div>
                <div className="text-[0.6rem] text-[#5B6E68]">P<sub>i,0</sub> · 2026-01-01 00:00 UTC</div>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-mtqs-amber/30 bg-mtqs-amber/5 p-3">
            <div className="text-[0.65rem] uppercase tracking-[0.18em] text-mtqs-gold/80 mb-1">GFB Base Denominator (chain-linked)</div>
            <div className="font-mono text-base text-mtqs-gold">{GFB_BASE_DENOMINATOR.toFixed(4)}</div>
            <div className="mt-2 text-[0.65rem] text-[#5B6E68] font-mono leading-relaxed break-words">
              = W<sub>USD</sub>·1.00 + W<sub>EUR</sub>·{fmtFixing(BASE_FIXINGS.EUR_USD)} + W<sub>JPY</sub>·{fmtFixing(BASE_FIXINGS.JPY_USD)} + W<sub>GBP</sub>·{fmtFixing(BASE_FIXINGS.GBP_USD)} + W<sub>CNY</sub>·{fmtFixing(BASE_FIXINGS.CNY_USD)} + W<sub>CHF</sub>·{fmtFixing(BASE_FIXINGS.CHF_USD)} + W<sub>Au</sub>·{BASE_FIXINGS.XAU_USD.toFixed(0)}
            </div>
          </div>
          {/* AUDIT-FIX F-1 — the canonical chain-linked recursion (Master §9.2, form B)
              replaces the deprecated Laspeyres fixed-basket display. */}
          <div className="mt-3 rounded-md border border-mtqs-emerald/20 bg-mtqs-emerald/5 p-3">
            <div className="text-[0.65rem] uppercase tracking-[0.18em] text-mtqs-emerald/80 mb-1">
              Chain-Linked Index Recursion (§9.2 — canonical)
            </div>
            <div className="font-mono text-sm text-mtqs-emerald leading-relaxed break-words">
              I<sub>t</sub> = I<sub>t−1</sub> × Σ<sub>i</sub> W<sub>i,t−1</sub> × ( P<sub>i,t</sub> / P<sub>i,t−1</sub> )
            </div>
            <div className="mt-1.5 font-mono text-[0.75rem] text-[#0E1F1B] leading-relaxed">
              P<sub>MTQ</sub> = I<sub>t</sub> × PAR <span className="text-[#7A8C86]">·</span> PAR = 1 basket-unit
            </div>
            <div className="mt-2 text-[0.65rem] text-[#5B6E68] leading-relaxed">
              Weight updates apply the divisor{" "}
              <span className="font-mono text-mtqs-emerald/90">D<sub>t</sub> = B<sub>t</sub><sup>−</sup> / B<sub>t</sub><sup>+</sup></span> — zero
              artificial return (§9.3). Start-of-period weights W<sub>i,t−1</sub> make the §9.4 contributions exact.
              I<sub>0</sub> = 1.00 at the base date; drift reflects currency + gold moves. Gold is{" "}
              <span className="text-mtqs-gold/80">a first-class index component</span> (P<sub>Au,t</sub> = XAU/USD).
            </div>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}

// Gold — first-class INDEX component (v3 no-reserve posture; Task 15/16).
// In the legacy v1/v2 economy, gold was BOTH an index member (26% Strategic
// Prior, 20–32% §8.1 envelope) AND a reserve asset — two MANDATORILY SEPARATE
// roles per §14.1 (index gold defines purchasing power; reserve gold was
// sized by liquidity/custody/redemption risk). Under the v3.0
// no-conventional-reserve objective (Gate B, D-13.3–D-13.7 open) the reserve
// role itself is slated for removal; the pilot ledger below is the LABELED
// legacy v1/v2 reference path (simulated holdings, G8), retained to exercise
// the §5.6 issuer-diversification + §8 envelope machinery until Gate B lands.
// The user-visible copy inside the panel carries the same framing.
export function GoldInReserve({ snapshot }: { snapshot?: import("@/lib/mtq/engine").MetricsSnapshot | null }) {
  if (!snapshot) return null;
  const r = snapshot.reserve;
  const perIssuer = snapshot.perIssuer;
  return (
    <div className="mt-4 rounded-lg border border-mtqs-amber/20 bg-amber-50 p-4">
      <div className="text-[0.625rem] uppercase tracking-[0.25em] text-mtqs-amber/80 mb-3">
        §3.2 + §14.1 · Gold — First-Class Index Component (holdings: legacy v1/v2 pilot-ledger path)
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <div className="text-[0.7rem] text-[#5B6E68]">PAXG (Paxos) · sleeve</div>
          <div className="text-lg font-mono text-mtqs-gold">{fmtUsdCompact(perIssuer?.paxgUsd ?? r.goldNet / 2)}</div>
          <div className="text-[0.6rem] font-mono text-[#7A8C86]">
            {snapshot.holdings
              ? `${snapshot.holdings.paxgOz.toFixed(3)} oz · ${((snapshot.holdings.paxgOz / snapshot.holdings.goldOz) * 100).toFixed(1)}% of gold`
              : "net of 1.0% haircut"}
          </div>
        </div>
        <div>
          <div className="text-[0.7rem] text-[#5B6E68]">XAUT (Tether) · sleeve</div>
          <div className="text-lg font-mono text-mtqs-gold">{fmtUsdCompact(perIssuer?.xautUsd ?? r.goldNet / 2)}</div>
          <div className="text-[0.6rem] font-mono text-[#7A8C86]">
            {snapshot.holdings
              ? `${snapshot.holdings.xautOz.toFixed(3)} oz · ${((snapshot.holdings.xautOz / snapshot.holdings.goldOz) * 100).toFixed(1)}% of gold`
              : "net of 1.0% haircut"}
          </div>
        </div>
        <div>
          <div className="text-[0.7rem] text-[#5B6E68]">Gold Price</div>
          <div className="text-lg font-mono text-mtqs-gold">${fmtFixed(r.goldPrice, 0)}/oz</div>
        </div>
        <div>
          <div className="text-[0.7rem] text-[#5B6E68]">Gold Weight</div>
          <div className="text-lg font-mono text-mtqs-gold">{(snapshot.observedGoldWeight * 100).toFixed(2)}%</div>
        </div>
      </div>
      <p className="mt-3 text-[0.7rem] text-[#5B6E68] leading-relaxed">
        The Adaptive Reference Basket (above) is a 7-component basket that defines the VALUE of MTQΣ — Gold is
        <span className="text-mtqs-gold font-medium"> a first-class index component</span> (26% Strategic
        Prior, 20-32% admissibility envelope). The two sleeve values are{" "}
        <span className="text-mtqs-gold font-medium">identical by §5.6 design</span> — gold is water-filled
        50/50 across Paxos/Tether under the 25% issuer cap, and both tokens are marked at the same live
        XAU/USD oracle price with the same 1.0% haircut (§14.1.1). Under the v3.0 no-conventional-reserve
        objective the reserve role itself is slated for removal (Gate B, D-13.3–D-13.7 open); the pilot
        ledger above is the legacy v1/v2 reference path — simulated holdings, no real tokens or vaults
        (G8) — retained until that migration lands.
      </p>
    </div>
  );
}
