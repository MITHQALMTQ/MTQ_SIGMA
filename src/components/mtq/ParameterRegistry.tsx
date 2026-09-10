"use client";

import { motion } from "framer-motion";
import { Panel, Reveal, Pill, GlowDot } from "./primitives";
import { Lock, Settings, Shield } from "lucide-react";

// MTQΣ — Parameter Registry (§37)
// Institutional table showing every protocol parameter with its governance layer.

interface ParamRow {
  name: string;
  value: string;
  unit: string;
  layer: "Constitutional" | "Monetary" | "Risk" | "Emergency";
  authority: string;
  timelock: string;
  status: "IMMUTABLE" | "GOVERNED";
}

const PARAMS: ParamRow[] = [
  { name: "PAR", value: "1.00", unit: "basket-unit", layer: "Constitutional", authority: "7/7 Multi-Sig", timelock: "90 days", status: "IMMUTABLE" },
  { name: "RR Target", value: "1.10", unit: "ratio", layer: "Monetary", authority: "DAO 51%", timelock: "48h", status: "GOVERNED" },
  { name: "RR Stress Floor", value: "1.05", unit: "ratio", layer: "Risk", authority: "Risk Council 4/7", timelock: "24h", status: "GOVERNED" },
  { name: "RR Hard Floor", value: "1.00", unit: "ratio", layer: "Constitutional", authority: "7/7 Multi-Sig", timelock: "90 days", status: "IMMUTABLE" },
  { name: "LCR Target", value: "1.00", unit: "ratio", layer: "Risk", authority: "Risk Council 4/7", timelock: "24h", status: "GOVERNED" },
  { name: "Mint Fee", value: "0.10%", unit: "bps", layer: "Monetary", authority: "DAO 51%", timelock: "48h", status: "GOVERNED" },
  { name: "Redeem Fee (Normal)", value: "0.15%", unit: "bps", layer: "Monetary", authority: "DAO 51%", timelock: "48h", status: "GOVERNED" },
  { name: "Redeem Fee (Stress)", value: "0.50%", unit: "bps", layer: "Risk", authority: "Risk Council 4/7", timelock: "24h", status: "GOVERNED" },
  { name: "Redeem Fee (Defensive)", value: "1.00%", unit: "bps", layer: "Risk", authority: "Risk Council 4/7", timelock: "24h", status: "GOVERNED" },
  { name: "Smoothing λ", value: "0.20", unit: "fraction", layer: "Monetary", authority: "DAO 51%", timelock: "48h", status: "GOVERNED" },
  { name: "Slippage Tolerance", value: "1.00%", unit: "fraction", layer: "Risk", authority: "Risk Council 4/7", timelock: "24h", status: "GOVERNED" },
  { name: "Max Daily Turnover", value: "5.00%", unit: "% NAV", layer: "Risk", authority: "Risk Council 4/7", timelock: "24h", status: "GOVERNED" },
  { name: "Direction Lock", value: "24h", unit: "hours", layer: "Risk", authority: "Risk Council 4/7", timelock: "24h", status: "GOVERNED" },
  { name: "De-peg Window", value: "12h", unit: "hours", layer: "Risk", authority: "Risk Council 4/7", timelock: "24h", status: "GOVERNED" },
  { name: "Admissibility Envelopes", value: "23-32%", unit: "% per component", layer: "Constitutional", authority: "7/7 Multi-Sig", timelock: "90 days", status: "IMMUTABLE" },
  { name: "Max Weight Velocity", value: "0.5%", unit: "% per update", layer: "Risk", authority: "Risk Council 4/7", timelock: "24h", status: "GOVERNED" },
];

const LAYER_COLORS: Record<string, string> = {
  Constitutional: "#F0B90B",
  Monetary: "#00D68F",
  Risk: "#FF8C42",
  Emergency: "#FF4D6D",
};

export function ParameterRegistry() {
  return (
    <Reveal>
      <Panel className="p-5 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <Settings className="h-5 w-5 text-mtqs-gold mt-0.5" />
          <div>
            <div className="mtqs-eyebrow">§22.4 · §37</div>
            <h3 className="text-base font-semibold text-white/90 mt-1">Parameter Registry</h3>
            <p className="text-xs text-white/55 mt-1">Every protocol parameter with its governance layer, authority, and timelock</p>
          </div>
        </div>

        <div className="overflow-x-auto mtqs-scroll">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-2 px-3 font-semibold text-white/55 uppercase tracking-wider">Parameter</th>
                <th className="text-right py-2 px-3 font-semibold text-white/55 uppercase tracking-wider">Value</th>
                <th className="text-left py-2 px-3 font-semibold text-white/55 uppercase tracking-wider hidden sm:table-cell">Layer</th>
                <th className="text-left py-2 px-3 font-semibold text-white/55 uppercase tracking-wider hidden md:table-cell">Authority</th>
                <th className="text-left py-2 px-3 font-semibold text-white/55 uppercase tracking-wider hidden lg:table-cell">Timelock</th>
                <th className="text-center py-2 px-3 font-semibold text-white/55 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {PARAMS.map((p, i) => (
                <motion.tr
                  key={p.name}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-2.5 px-3 font-mono text-white/90 font-medium">{p.name}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums" style={{ color: LAYER_COLORS[p.layer] }}>{p.value}</td>
                  <td className="py-2.5 px-3 hidden sm:table-cell">
                    <span className="text-xs" style={{ color: LAYER_COLORS[p.layer] }}>{p.layer}</span>
                  </td>
                  <td className="py-2.5 px-3 text-white/55 hidden md:table-cell font-mono">{p.authority}</td>
                  <td className="py-2.5 px-3 text-white/55 hidden lg:table-cell font-mono">{p.timelock}</td>
                  <td className="py-2.5 px-3 text-center">
                    {p.status === "IMMUTABLE" ? (
                      <Pill tone="gold" className="text-[0.55rem]"><Lock className="h-2.5 w-2.5" />IMMUTABLE</Pill>
                    ) : (
                      <Pill tone="emerald" className="text-[0.55rem]"><Shield className="h-2.5 w-2.5" />GOVERNED</Pill>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[0.7rem] text-white/40">
          Immutable parameters require 7/7 Constitutional Multi-Sig + 90-day timelock. Governed parameters follow their respective layer's authority and timelock.
        </p>
      </Panel>
    </Reveal>
  );
}
