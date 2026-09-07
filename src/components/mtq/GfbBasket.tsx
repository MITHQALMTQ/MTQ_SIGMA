// MTQΣ — GFB Basket Reference (§2)
// BASKET_TABLE, base FX fixings, the computed GFB_BASE_DENOMINATOR, and
// the normalisation formula.

"use client";

import { Panel, Reveal } from "./primitives";
import { fmtUsdCompact, fmtFixed } from "./format";
import {
  BASKET_TABLE,
  BASE_EUR_USD,
  BASE_GBP_USD,
  BASE_JPY_USD,
  BASE_CNY_USD,
  GFB_BASE_DENOMINATOR,
  Q_USD, Q_EUR, Q_GBP, Q_JPY, Q_CNY,
} from "@/lib/mtq/blueprint";

const baseFx = [
  { pair: "EUR/USD", value: BASE_EUR_USD },
  { pair: "GBP/USD", value: BASE_GBP_USD },
  { pair: "JPY/USD", value: BASE_JPY_USD },
  { pair: "CNY/USD", value: BASE_CNY_USD },
];

export function GfbBasket() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground/90">Basket Composition (§2.1)</div>
            <span className="text-[0.7rem] text-muted-foreground/70 font-mono">immutable · 7/7 Multi-Sig · 90d</span>
          </div>
          <div className="overflow-hidden rounded-md border border-white/[0.07]">
            <table className="w-full text-[0.75rem]">
              <thead className="bg-white/[0.02] text-muted-foreground/70">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Currency</th>
                  <th className="text-left px-3 py-2 font-medium">Asset</th>
                  <th className="text-right px-3 py-2 font-medium">Quantity (qᵢ)</th>
                  <th className="text-right px-3 py-2 font-medium">Weight</th>
                </tr>
              </thead>
              <tbody>
                {BASKET_TABLE.map((row, i) => (
                  <tr key={row.currency} className={`border-t border-white/[0.05] ${i % 2 ? "bg-white/[0.01]" : ""}`}>
                    <td className="px-3 py-2 font-mono text-amber-200">{row.currency}</td>
                    <td className="px-3 py-2 text-foreground/85">{row.asset}</td>
                    <td className="px-3 py-2 font-mono text-right text-amber-200">{row.quantity.toFixed(4)}</td>
                    <td className="px-3 py-2 font-mono text-right text-muted-foreground/80">{(row.weight * 100).toFixed(2)}%</td>
                  </tr>
                ))}
                <tr className="border-t border-white/[0.1] bg-amber-500/[0.04]">
                  <td className="px-3 py-2 font-semibold" colSpan={2}>Σ qᵢ · Total</td>
                  <td className="px-3 py-2 font-mono text-right font-semibold text-amber-200">
                    {(Q_USD + Q_EUR + Q_GBP + Q_JPY + Q_CNY).toFixed(4)}
                  </td>
                  <td className="px-3 py-2 font-mono text-right font-semibold text-amber-200">100.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      </Reveal>

      <Reveal delay={0.05}>
        <Panel className="p-5">
          <div className="mb-3 text-sm font-semibold text-foreground/90">Base FX Fixings + Normalisation</div>
          <div className="grid grid-cols-2 gap-2 text-[0.72rem] mb-4">
            {baseFx.map((b) => (
              <div key={b.pair} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                <div className="text-muted-foreground/70 text-[0.65rem] uppercase tracking-[0.18em]">{b.pair}</div>
                <div className="font-mono text-amber-200">{b.value.toFixed(4)}</div>
                <div className="text-[0.6rem] text-muted-foreground/60">2026-01-01 00:00 UTC</div>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-amber-400/30 bg-amber-500/[0.04] p-3">
            <div className="text-[0.65rem] uppercase tracking-[0.18em] text-amber-200/80 mb-1">GFB Base Denominator</div>
            <div className="font-mono text-base text-amber-200">{GFB_BASE_DENOMINATOR.toFixed(8)}</div>
            <div className="mt-2 text-[0.65rem] text-muted-foreground/70 font-mono leading-relaxed break-words">
              = Q_USD·1.00 + Q_EUR·1.05 + Q_GBP·1.25 + Q_JPY·0.0067 + Q_CNY·0.14
            </div>
          </div>
          <div className="mt-3 rounded-md border border-emerald-400/20 bg-emerald-500/[0.04] p-3">
            <div className="text-[0.65rem] uppercase tracking-[0.18em] text-emerald-300/80 mb-1">Normalisation Formula</div>
            <div className="font-mono text-sm text-emerald-200 leading-relaxed">
              GFB_t = (Σ qᵢ · FX_i/USD) / GFB_base
            </div>
            <div className="mt-1 text-[0.65rem] text-muted-foreground/70">GFB = 1.00 exactly at base date · drift reflects currency moves.</div>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}

// Gold in the Reserve (not in the GFB basket — gold is in the reserve portfolio)
export function GoldInReserve({ snapshot }: { snapshot?: import("@/lib/mtq/engine").MetricsSnapshot | null }) {
  if (!snapshot) return null;
  const r = snapshot.reserve;
  const perIssuer = snapshot.perIssuer;
  return (
    <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/[0.03] p-4">
      <div className="text-[0.625rem] uppercase tracking-[0.25em] text-amber-300/80 mb-3">
        §4 + §8 · Gold in the Reserve Portfolio (NOT in the GFB Index)
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <div className="text-[0.7rem] text-muted-foreground/70">PAXG (Paxos)</div>
          <div className="text-lg font-mono text-amber-200">{fmtUsdCompact(perIssuer?.paxgUsd ?? r.goldNet / 2)}</div>
        </div>
        <div>
          <div className="text-[0.7rem] text-muted-foreground/70">XAUT (Tether)</div>
          <div className="text-lg font-mono text-amber-200">{fmtUsdCompact(perIssuer?.xautUsd ?? r.goldNet / 2)}</div>
        </div>
        <div>
          <div className="text-[0.7rem] text-muted-foreground/70">Gold Price</div>
          <div className="text-lg font-mono text-amber-200">${fmtFixed(r.goldPrice, 0)}/oz</div>
        </div>
        <div>
          <div className="text-[0.7rem] text-muted-foreground/70">Gold Weight</div>
          <div className="text-lg font-mono text-amber-200">{(snapshot.observedGoldWeight * 100).toFixed(2)}%</div>
        </div>
      </div>
      <p className="mt-3 text-[0.7rem] text-muted-foreground/60">
        The GFB Index (above) is a 5-currency basket that defines the VALUE of MTQΣ.
        Gold is NOT in the index — it's in the RESERVE PORTFOLIO that backs the token.
        The reserve holds ~24% gold (PAXG + XAUT) as collateral, adjusted dynamically by the §6 Macro Engine + §8 Buffer.
      </p>
    </div>
  );
}
