"use client";

import { motion } from "framer-motion";
import { Panel, Reveal, GlowDot } from "./primitives";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

// MTQΣ — Basket Purchasing Power Display
// Shows what 1 MTQΣ is worth in ALL 7 basket components (live).
// "1 MTQΣ = $X = €Y = £Z = ¥N = ¥C = ₣S = G oz"

interface BasketValueProps {
  snapshot: MetricsSnapshot | null;
}

const COMPONENTS = [
  { code: "USD", symbol: "$", name: "US Dollar", color: "#F0B90B", weight: 0.27 },
  { code: "EUR", symbol: "€", name: "Euro", color: "#00D68F", weight: 0.20 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", color: "#2BD4E0", weight: 0.09 },
  { code: "GBP", symbol: "£", name: "British Pound", color: "#7B61FF", weight: 0.08 },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", color: "#FF8C42", weight: 0.05 },
  { code: "CHF", symbol: "₣", name: "Swiss Franc", color: "#FF4D6D", weight: 0.05 },
  { code: "Gold", symbol: "oz", name: "Gold (troy oz)", color: "#FCD535", weight: 0.26 },
];

export function BasketValueDisplay({ snapshot }: BasketValueProps) {
  const mtqPrice = snapshot?.mtqPrice ?? 1.0;
  const fx = snapshot?.fx;

  // Calculate what 1 MTQΣ is worth in each currency
  const values = COMPONENTS.map((comp) => {
    let value: number | null = null;
    if (comp.code === "USD") {
      value = mtqPrice; // 1 MTQ = $mtqPrice
    } else if (fx) {
      const fxKey = `${comp.code}_USD` as keyof typeof fx;
      const rate = (fx as unknown as Record<string, number>)[fxKey];
      if (rate && rate > 0) {
        value = mtqPrice / rate; // divide USD by FX rate to get the currency amount
      }
    }
    return { ...comp, value };
  });

  return (
    <Reveal>
      <Panel className="p-5 sm:p-6 mtqs-glow">
        <div className="flex items-start gap-3 mb-4">
          <GlowDot color="gold" size="h-3 w-3" className="mt-1" />
          <div>
            <div className="mtqs-eyebrow">Live · Purchasing Power</div>
            <h3 className="text-lg font-semibold text-white/90 mt-1">1 MTQΣ = What You Can Buy</h3>
            <p className="text-xs text-white/55 mt-1">The Global Purchasing Power Unit — live value against all 7 basket components</p>
          </div>
        </div>

        {/* Main value: 1 MTQ = $X */}
        <div className="mb-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-2xl font-bold mtqs-gold-text tabular-nums">{mtqPrice.toFixed(4)}</span>
            <span className="text-sm text-white/55">USD per 1 MTQΣ</span>
          </div>
          <div className="mt-2 text-xs text-white/40">GFB Index: {snapshot?.gfbIndex?.toFixed(4) ?? "—"}</div>
        </div>

        {/* Grid of all 7 currencies */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {values.map((v, i) => (
            <motion.div
              key={v.code}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color, boxShadow: `0 0 6px ${v.color}80` }} />
                <span className="text-[0.6rem] uppercase tracking-wider text-white/55">{v.code}</span>
                <span className="text-[0.55rem] text-white/30 ml-auto">{(v.weight * 100).toFixed(0)}%</span>
              </div>
              {v.value !== null ? (
                <div className="font-mono text-sm font-semibold tabular-nums" style={{ color: v.color }}>
                  {v.code === "Gold" 
                    ? `${v.value.toFixed(4)} oz`
                    : v.code === "JPY"
                    ? `${v.symbol}${Math.round(v.value).toLocaleString()}`
                    : `${v.symbol}${v.value.toFixed(2)}`}
                </div>
              ) : (
                <div className="font-mono text-sm text-white/30">—</div>
              )}
              <div className="text-[0.55rem] text-white/40 mt-0.5">{v.name}</div>
            </motion.div>
          ))}
        </div>

        {/* Honest note */}
        <p className="mt-4 text-[0.7rem] text-white/40 leading-relaxed">
          1 MTQΣ represents one unit of the GFB Index — a chain-linked 7-component basket.
          The values above show what 1 MTQΣ is worth in each component currency at live FX rates.
          Gold (PAXG + XAUT) is a first-class index component (26% Strategic Prior), not just reserve collateral.
        </p>
      </Panel>
    </Reveal>
  );
}
