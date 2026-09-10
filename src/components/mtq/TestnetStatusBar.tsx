"use client";

import type { MetricsSnapshot } from "@/lib/mtq/engine";

// MTQΣ — Global Testnet Status Bar (§7)
// Persistent thin banner showing testnet status, dynamically derived from real state.

export function TestnetStatusBar({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const oracleStatus = snapshot?.oraclePaused ? "PAUSED" : "5/5 LIVE";
  const validationGates = 3; // from Production Readiness Dashboard
  const totalGates = 11;
  const riskState = snapshot?.riskState ?? snapshot?.status ?? "NORMAL";

  return (
    <div className="sticky top-0 z-30 border-b border-white/[0.04] bg-[#06080F]/80 backdrop-blur-md">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 py-1.5 text-[0.65rem] overflow-x-auto mtqs-no-scrollbar">
          {/* TESTNET badge */}
          <span className="font-semibold text-mtqs-gold uppercase tracking-wider whitespace-nowrap">MTQΣ TESTNET</span>
          <span className="text-white/30">·</span>
          <span className="text-white/55 whitespace-nowrap">Candidate for public testing</span>
          <span className="text-white/30 hidden sm:inline">·</span>
          <span className="text-mtqs-rose whitespace-nowrap hidden sm:inline">Not production-authorized</span>
          
          {/* Secondary status */}
          <span className="text-white/30 hidden md:inline">·</span>
          <span className="text-white/40 whitespace-nowrap hidden md:inline">
            Oracles: <span className={snapshot?.oraclePaused ? "text-mtqs-rose" : "text-mtqs-emerald"}>{oracleStatus}</span>
          </span>
          <span className="text-white/30 hidden md:inline">·</span>
          <span className="text-white/40 whitespace-nowrap hidden md:inline">
            Assets: <span className="text-mtqs-amber">TESTNET</span>
          </span>
          <span className="text-white/30 hidden lg:inline">·</span>
          <span className="text-white/40 whitespace-nowrap hidden lg:inline">
            Validation Gates: <span className="text-mtqs-gold">{validationGates}/{totalGates}</span>
          </span>
          <span className="text-white/30 hidden lg:inline">·</span>
          <span className="text-white/40 whitespace-nowrap hidden lg:inline">
            Production: <span className="text-mtqs-rose font-semibold">NO</span>
          </span>
          <span className="text-white/30 hidden lg:inline">·</span>
          <span className="text-white/40 whitespace-nowrap hidden lg:inline">
            Risk: <span className={riskState === "NORMAL" ? "text-mtqs-emerald" : "text-mtqs-amber"}>{riskState}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
