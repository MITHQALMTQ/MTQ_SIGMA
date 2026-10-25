"use client";

import { useEffect, useState } from "react";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

// MTQΣ — Global Testnet Status Bar (§7)
// Persistent thin banner showing testnet status, dynamically derived from real state.
//
// TRUTH-POSTURE FIX (2026-10-24): the validation-gate count used to be a
// hardcoded "3/11" that contradicted the live /api/honest-status payload
// (0/11 passed). The count is now fetched live from the honest-status API
// (once on mount + on tab focus regain) and degrades to "—/—" (never a
// fabricated number) if the API cannot be reached.
//
// The bar has a deterministic fixed height (h-7 = 28px) so the sticky Header
// below it can offset by exactly top-7 without overlap.

type HonestStatusLite = {
  validationGates?: Array<{ id: string; passed: boolean }>;
  gateSummary?: { passed: number; total: number };
};

export function TestnetStatusBar({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const oracleStatus = snapshot?.oracleFailed
    ? "FAILED"
    : snapshot?.oracleDegraded
      ? "DEGRADED · REDEEM OPEN"
      : "LIVE";
  const [gates, setGates] = useState<{ passed: number; total: number } | null>(null);

  // Live validation gates from /api/honest-status (never fabricated).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/honest-status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as HonestStatusLite;
        if (cancelled || !data) return;
        const list = Array.isArray(data.validationGates) ? data.validationGates : [];
        const passed = data.gateSummary?.passed ?? list.filter((g) => g.passed).length;
        const total = data.gateSummary?.total ?? list.length;
        if (Number.isFinite(passed) && Number.isFinite(total) && total > 0) {
          setGates({ passed, total });
        }
      } catch {
        /* keep null → renders "—/—" honestly */
      }
    };
    load();
    // Refresh when the tab regains focus (gates change rarely, but never show stale).
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const riskState = snapshot?.riskState ?? snapshot?.status ?? "NORMAL";

  return (
    <div className="sticky top-0 z-30 h-7 border-b border-[#E3EAE6] bg-white">
      <div className="mx-auto flex h-full max-w-[1400px] items-center pl-14 pr-4 sm:pr-6 md:px-6 lg:px-8">
        <div className="flex items-center gap-4 text-[0.65rem] overflow-x-auto mtqs-no-scrollbar">
          {/* TESTNET badge */}
          <span className="font-semibold text-mtqs-gold uppercase tracking-wider whitespace-nowrap">MTQΣ TESTNET</span>
          <span className="text-[#7A8C86]">·</span>
          <span className="text-[#5B6E68] whitespace-nowrap">Candidate for public testing</span>
          <span className="text-[#7A8C86] hidden sm:inline">·</span>
          <span className="text-mtqs-rose whitespace-nowrap hidden sm:inline">Not production-authorized</span>

          {/* Secondary status */}
          <span className="text-[#7A8C86] hidden md:inline">·</span>
          <span className="text-[#7A8C86] whitespace-nowrap hidden md:inline">
            Oracles: <span className={snapshot?.oracleFailed ? "text-mtqs-rose" : snapshot?.oracleDegraded ? "text-mtqs-amber" : "text-mtqs-emerald"}>{oracleStatus}</span>
          </span>
          <span className="text-[#7A8C86] hidden md:inline">·</span>
          <span className="text-[#7A8C86] whitespace-nowrap hidden md:inline">
            Assets: <span className="text-mtqs-amber">TESTNET</span>
          </span>
          <span className="text-[#7A8C86] hidden lg:inline">·</span>
          <span className="text-[#7A8C86] whitespace-nowrap hidden lg:inline">
            Validation Gates: <span className={gates && gates.passed > 0 ? "text-mtqs-emerald" : "text-mtqs-gold"}>{gates ? `${gates.passed}/${gates.total}` : "—"}</span>
          </span>
          <span className="text-[#7A8C86] hidden lg:inline">·</span>
          <span className="text-[#7A8C86] whitespace-nowrap hidden lg:inline">
            Production: <span className="text-mtqs-rose font-semibold">NO</span>
          </span>
          <span className="text-[#7A8C86] hidden lg:inline">·</span>
          <span className="text-[#7A8C86] whitespace-nowrap hidden lg:inline">
            Risk: <span className={riskState === "NORMAL" ? "text-mtqs-emerald" : "text-mtqs-amber"}>{riskState}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
