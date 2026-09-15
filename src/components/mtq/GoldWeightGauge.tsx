"use client";

import * as React from "react";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import {
  BASE_GOLD_WEIGHT,
  GOLD_WEIGHT_LOWER,
  GOLD_WEIGHT_UPPER,
} from "@/lib/mtq/blueprint";
import { fmtFixed } from "./format";

const LOWER = GOLD_WEIGHT_LOWER * 100;
const UPPER = GOLD_WEIGHT_UPPER * 100;
const BASE = BASE_GOLD_WEIGHT * 100;

/** Convert a gold-weight fraction (0..1) to a percentage along the 18%–34% display window. */
function pct(v: number): number {
  const span = 34 - 18; // 16%
  const clamped = Math.min(34, Math.max(18, v * 100));
  return ((clamped - 18) / span) * 100;
}

export function GoldWeightGauge({ snapshot }: { snapshot: MetricsSnapshot }) {
  const observed = snapshot.observedGoldWeight ?? 0;
  const target = snapshot.targetGoldWeight ?? 0;
  const buffer = snapshot.bufferGoldRatio ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Observed" value={`${fmtFixed(observed * 100, 2)}%`} accent="text-foreground" />
        <Stat label="Target" value={`${fmtFixed(target * 100, 2)}%`} accent="text-amber-300" />
        <Stat
          label="Buffer state"
          value={snapshot.bufferState}
          accent={
            snapshot.bufferState === "EMERGENCY"
              ? "text-rose-300"
              : snapshot.bufferState === "STRESS"
                ? "text-orange-300"
                : "text-emerald-300"
          }
        />
        <Stat
          label="Buffer gold ratio"
          value={fmtFixed(buffer * 100, 1) + "%"}
          accent="text-amber-200"
        />
      </div>

      {/* Observed vs target bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          <span>Observed vs target (display window 18%–34%)</span>
          <span className="font-mono text-amber-300/80">
            bounds {LOWER.toFixed(0)}%–{UPPER.toFixed(0)}% • base {BASE.toFixed(2)}%
          </span>
        </div>
        <div className="relative h-9 w-full overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
          {/* allowed band [22, 30] */}
          <div
            className="absolute inset-y-0 bg-emerald-500/[0.08]"
            style={{
              left: `${pct(LOWER / 100)}%`,
              right: `${100 - pct(UPPER / 100)}%`,
            }}
          />
          {/* base 26.25 tick */}
          <div
            className="absolute inset-y-0 w-px bg-amber-300/40"
            style={{ left: `${pct(BASE / 100)}%` }}
            aria-hidden
          />
          {/* lower / upper ticks */}
          <div
            className="absolute inset-y-0 w-px bg-emerald-400/40"
            style={{ left: `${pct(LOWER / 100)}%` }}
            aria-hidden
          />
          <div
            className="absolute inset-y-0 w-px bg-emerald-400/40"
            style={{ left: `${pct(UPPER / 100)}%` }}
            aria-hidden
          />
          {/* observed bar (gold gradient) */}
          <div
            className="absolute inset-y-1 rounded-md bg-gradient-to-r from-amber-400/60 to-amber-500/80"
            style={{ width: `${pct(observed)}%` }}
          >
            <span className="absolute inset-y-0 right-0 w-1 bg-amber-300" />
          </div>
          {/* target marker (vertical white) */}
          <div
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.6)]"
            style={{ left: `${pct(target)}%` }}
            aria-hidden
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground/80">
          <span>18%</span>
          <span>26%</span>
          <span>30%</span>
          <span>34%</span>
        </div>
      </div>

      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs text-muted-foreground">
        <span className="text-amber-300/90">Tokenomics note:</span> §6 base 26.25% ≡ §8
        BASE total (0.20 core + 0.10 × 0.625 buffer). Unified target
        W<sub>target</sub> = clamp( base<sub>buffer</sub>(RR) + θ<sub>smoothed</sub>, 22%, 30% ).
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-mono text-lg font-semibold tabular-nums ${accent}`}>
        {value}
      </div>
    </div>
  );
}
