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
//     (USD·1 + EUR·1.05 + JPY·0.0067 + GBP·1.25 + CNY·0.14 + CHF·0.88 + Gold·2500).

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

export function GfbBasket() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-white/90">Strategic Prior (§3.2 — v1.0)</div>
            <span className="text-[0.7rem] text-white/55 font-mono">adaptive · 7 components · 7/7 Multi-Sig · 90d</span>
          </div>
          <div className="overflow-hidden rounded-md border border-white/[0.06]">
            <table className="w-full text-[0.75rem]">
              <thead className="bg-white/[0.03]/[0.02] text-white/55">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Component</th>
                  <th className="text-left px-3 py-2 font-medium">Token (Registry-Resolved)</th>
                  <th className="text-right px-3 py-2 font-medium">W<sup>Prior</sup></th>
                </tr>
              </thead>
              <tbody>
                {STRATEGIC_PRIOR_TABLE.map((row, i) => (
                  <tr key={row.component} className={`border-t border-white/[0.06] ${i % 2 ? "bg-white/[0.03]/[0.01]" : ""}`}>
                    <td className="px-3 py-2 font-mono text-mtqs-gold">{row.component}</td>
                    <td className="px-3 py-2 text-white">{row.token}</td>
                    <td className="px-3 py-2 font-mono text-right text-mtqs-gold">{(row.weight * 100).toFixed(2)}%</td>
                  </tr>
                ))}
                <tr className="border-t border-white/[0.1] bg-mtqs-amber/5">
                  <td className="px-3 py-2 font-semibold" colSpan={2}>Σ W<sup>Prior</sup> · Total</td>
                  <td className="px-3 py-2 font-mono text-right font-semibold text-mtqs-gold">100.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[0.7rem] text-white/55 leading-relaxed">
            <span className="text-mtqs-gold/80 font-mono">W<sup>Prior</sup> ≠ W<sup>Target</sup> ≠ W<sup>Smooth</sup> ≠ W<sup>Execution</sup></span>.
            The prior is a soft anchor — deviation is penalised, not enforced. Live weights are computed
            by the MASE ensemble (§7) under per-component admissibility envelopes (§8.1).
          </p>
        </Panel>
      </Reveal>

      <Reveal delay={0.05}>
        <Panel className="p-5">
          <div className="mb-3 text-sm font-semibold text-white/90">Base-Date Fixings + Chain-Linked Denominator (§3.4)</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[0.72rem] mb-4">
            {baseFx.map((b) => (
              <div key={b.pair} className={`rounded-md border p-2.5 ${b.isGold ? "border-mtqs-amber/40 bg-amber-500/[0.05]" : "border-white/[0.06] bg-white/[0.03]/[0.02]"}`}>
                <div className="text-white/55 text-[0.65rem] uppercase tracking-[0.18em]">{b.pair}</div>
                <div className="font-mono text-mtqs-gold">{b.isGold ? `$${b.value.toFixed(2)}` : b.value.toFixed(4)}</div>
                <div className="text-[0.6rem] text-white/55/60">P<sub>i,0</sub> · 2026-01-01 00:00 UTC</div>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-mtqs-amber/30 bg-mtqs-amber/5 p-3">
            <div className="text-[0.65rem] uppercase tracking-[0.18em] text-mtqs-gold/80 mb-1">GFB Base Denominator (chain-linked)</div>
            <div className="font-mono text-base text-mtqs-gold">{GFB_BASE_DENOMINATOR.toFixed(4)}</div>
            <div className="mt-2 text-[0.65rem] text-white/55 font-mono leading-relaxed break-words">
              = W<sub>USD</sub>·1.00 + W<sub>EUR</sub>·1.05 + W<sub>JPY</sub>·0.0067 + W<sub>GBP</sub>·1.25 + W<sub>CNY</sub>·0.14 + W<sub>CHF</sub>·0.88 + W<sub>Au</sub>·2500
            </div>
          </div>
          <div className="mt-3 rounded-md border border-mtqs-emerald/20 bg-mtqs-emerald/5 p-3">
            <div className="text-[0.65rem] uppercase tracking-[0.18em] text-mtqs-emerald/80 mb-1">Chain-Linked Index Formula</div>
            <div className="font-mono text-sm text-mtqs-emerald leading-relaxed">
              GFB<sub>t</sub> = ( Σ<sub>i</sub> W<sup>Prior</sup><sub>i</sub> · P<sub>i,t</sub> ) / GFB_base
            </div>
            <div className="mt-1 text-[0.65rem] text-white/55">
              GFB = 1.00 exactly at the base date · drift reflects currency + gold moves. Gold is now
              <span className="text-mtqs-gold/80"> a first-class index component</span> (P<sub>Au,t</sub> = XAU/USD).
            </div>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}

// Gold in BOTH the index AND the reserve (v1.0 — §3.2 + §14.1)
// In v1.2, gold was only in the reserve portfolio (a 5-currency index). In
// v1.0, gold is a first-class index component (26% prior, 20-32% envelope)
// AND a reserve asset. The two roles are MANDATORILY SEPARATE per §14.1:
//   - Index gold: defines what 1 MTQ represents (purchasing power).
//   - Reserve gold: sized by obligations/liquidity/custody/redemption risk.
// In the pilot's current state (legacy v1.2 buffer logic retained), the two
// coincide at the same PAXG + XAUT holdings. A future task will split them.
export function GoldInReserve({ snapshot }: { snapshot?: import("@/lib/mtq/engine").MetricsSnapshot | null }) {
  if (!snapshot) return null;
  const r = snapshot.reserve;
  const perIssuer = snapshot.perIssuer;
  return (
    <div className="mt-4 rounded-lg border border-mtqs-amber/20 bg-amber-400/[0.03] p-4">
      <div className="text-[0.625rem] uppercase tracking-[0.25em] text-mtqs-amber/80 mb-3">
        §3.2 + §14.1 · Gold is in BOTH the GFB Index AND the Reserve (v1.0)
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <div className="text-[0.7rem] text-white/55">PAXG (Paxos)</div>
          <div className="text-lg font-mono text-mtqs-gold">{fmtUsdCompact(perIssuer?.paxgUsd ?? r.goldNet / 2)}</div>
        </div>
        <div>
          <div className="text-[0.7rem] text-white/55">XAUT (Tether)</div>
          <div className="text-lg font-mono text-mtqs-gold">{fmtUsdCompact(perIssuer?.xautUsd ?? r.goldNet / 2)}</div>
        </div>
        <div>
          <div className="text-[0.7rem] text-white/55">Gold Price</div>
          <div className="text-lg font-mono text-mtqs-gold">${fmtFixed(r.goldPrice, 0)}/oz</div>
        </div>
        <div>
          <div className="text-[0.7rem] text-white/55">Gold Weight</div>
          <div className="text-lg font-mono text-mtqs-gold">{(snapshot.observedGoldWeight * 100).toFixed(2)}%</div>
        </div>
      </div>
      <p className="mt-3 text-[0.7rem] text-white/55/60 leading-relaxed">
        The GFB Index (above) is a 7-component basket that defines the VALUE of MTQΣ — Gold is
        <span className="text-mtqs-gold font-medium"> a first-class index component</span> (26% strategic
        prior, 20-32% admissibility envelope). The reserve holds PAXG + XAUT as the collateral that
        backs the token. In v1.0 the two roles are <span className="text-mtqs-gold font-medium">mandatorily
        separate</span> per §14.1: index gold defines what 1 MTQ represents (purchasing power); reserve
        gold is sized by obligations, liquidity, custody, and redemption risk — <span className="italic">not</span> by
        the index weight. The pilot's current state uses the same physical gold for both roles (the
        legacy §8 buffer path); a future task will physically separate them.
      </p>
    </div>
  );
}
