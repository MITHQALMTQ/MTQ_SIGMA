// MTQΣ — Geopolitical Eject (§11) + Reintegration Score (§11.3)
// 5-currency table with peg health, depeg hours, eject ladder (0–4 stages 10/25/50/100%).
// Per-currency Reintegration Score radial gauge (0→1, 0.80 threshold),
// with 4 contributing factor mini-bars + R_score + repurchaseStage (0/1/2/3).

"use client";

import { motion } from "framer-motion";
import { Panel, Reveal, Pill, GlowDot, TickNumber, MiniBar } from "./primitives";
import { fmtFixed, fmtPct, pegIsHealthy } from "./format";
import {
  EJECT_STAGES,
  EJECT_DEPEG_BAND_LOWER,
  EJECT_DEPEG_BAND_UPPER,
  REINTEGRATION_WEIGHTS,
  REINTEGRATION_THRESHOLD,
  REINTEGRATION_REPURCHASE_STAGES,
} from "@/lib/mtq/blueprint";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

type Cur = "USD" | "EUR" | "GBP" | "JPY" | "CNY";
const CURRENCIES: Cur[] = ["USD", "EUR", "GBP", "JPY", "CNY"];

function EjectStageBadge({ stage }: { stage: number }) {
  if (stage === 0) return <Pill tone="emerald">stage 0 · none</Pill>;
  const s = EJECT_STAGES[stage - 1];
  if (!s) return <Pill tone="muted">{stage}</Pill>;
  const tone = stage === 4 ? "rose" : stage === 3 ? "rose" : stage === 2 ? "amber" : "amber";
  return (
    <Pill tone={tone}>
      <GlowDot color={tone === "rose" ? "rose" : "amber"} size="h-1.5 w-1.5" />
      stage {stage} · {(s.sellPct * 100).toFixed(0)}% sold
    </Pill>
  );
}

function ReintegrationGauge({ score, size = 80 }: { score: number; size?: number }) {
  const r = 32;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score));
  const threshold = REINTEGRATION_THRESHOLD;
  // Arc from -90deg to (pct*360 - 90)deg
  const dash = pct * circ;
  const thresholdDash = threshold * circ;

  const tone = pct >= threshold ? "#3ddc97" : pct >= threshold * 0.6 ? "#e8b964" : "#ff5d73";

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Reintegration score ${pct.toFixed(2)}, threshold ${threshold}`}
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
      {/* threshold tick */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="rgba(232,185,100,0.45)"
        strokeWidth="1"
        strokeDasharray={`2 ${circ}`}
        strokeDashoffset={-thresholdDash}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <motion.circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={tone}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        initial={{ strokeDasharray: `0 ${circ}` }}
        animate={{ strokeDasharray: `${dash} ${circ}` }}
        transition={{ duration: 0.7 }}
        style={{ filter: "drop-shadow(0 0 6px rgba(232,185,100,0.3))" }}
      />
      <text x={cx} y={cy - 1} textAnchor="middle" fontSize="14" fill={tone} fontFamily="var(--font-geist-mono), monospace" fontWeight="700">
        {pct.toFixed(2)}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="6.5" fill="rgba(255,255,255,0.55)" fontFamily="var(--font-geist-sans), sans-serif" letterSpacing="1">
        R_SCORE
      </text>
    </svg>
  );
}

function CurrencyRow({ snapshot, cur }: { snapshot: MetricsSnapshot; cur: Cur }) {
  const peg = snapshot.pegHealth[cur];
  const depegHours = snapshot.depegHours?.[cur] ?? 0;
  const stage = snapshot.ejectStage?.[cur] ?? 0;
  const rein = snapshot.reintegration[cur];
  const healthy = pegIsHealthy(peg);
  const repurchaseStage = rein.repurchaseStage ?? 0;
  const repurchasePct = repurchaseStage === 0 ? 0 : REINTEGRATION_REPURCHASE_STAGES[repurchaseStage - 1] * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-lg border p-3.5 ${
        stage >= 3
          ? "border-mtqs-rose/30 bg-mtqs-rose/5"
          : stage > 0
          ? "border-amber-400/25 bg-amber-500/[0.03]"
          : "border-border bg-white/[0.015]"
      }`}
    >
      {/* Top row: currency + peg */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-3">
        <div className="sm:w-24 shrink-0">
          <div className="font-mono text-base font-semibold text-foreground/90">{cur}</div>
          <div className="text-[0.65rem] text-muted-foreground">peg vs ref</div>
        </div>

        {/* Peg health + eject */}
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div className="rounded-md border border-border bg-black/[0.02] p-2">
            <div className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">Peg Health</div>
            <div className={`font-mono text-base font-semibold ${healthy ? "text-mtqs-emerald" : "text-mtqs-rose"}`}>
              {peg.toFixed(4)}
            </div>
            <div className="text-[0.6rem] text-muted-foreground/60">
              band [{EJECT_DEPEG_BAND_LOWER}, {EJECT_DEPEG_BAND_UPPER}]
            </div>
          </div>
          <div className="rounded-md border border-border bg-black/[0.02] p-2">
            <div className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">Depeg Hours</div>
            <div className={`font-mono text-base font-semibold ${depegHours > 0 ? "text-mtqs-gold" : "text-mtqs-emerald"}`}>
              {depegHours.toFixed(1)}h
            </div>
            <div className="mt-1"><EjectStageBadge stage={stage} /></div>
          </div>
        </div>

        {/* Gauge */}
        <div className="sm:w-28 shrink-0 flex flex-col items-center">
          <div className="w-20 h-20"><ReintegrationGauge score={rein.score} size={80} /></div>
          <div className="mt-1 text-[0.6rem] text-muted-foreground">
            threshold <span className="font-mono text-mtqs-gold">{REINTEGRATION_THRESHOLD.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Factor bars */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <FactorBar label="Time-in-band (48h)" value={rein.timeInBand48h} max={1} color="emerald" />
        <FactorBar label="Liquidity depth" value={rein.liquidityDepth} max={1} color="gold" />
        <FactorBar label="Oracle agreement" value={rein.oracleAgreement} max={1} color="gold" />
        <FactorBar label="1 − Volatility" value={1 - rein.volatility} max={1} color="emerald" />
      </div>

      <div className="mt-2 flex items-center justify-between text-[0.65rem] text-muted-foreground">
        <span>repurchase stage <span className="font-mono text-mtqs-gold">{repurchaseStage}/3</span></span>
        <span>repurchased <span className={`font-mono ${repurchaseStage > 0 ? "text-mtqs-emerald" : "text-muted-foreground"}`}>{repurchasePct.toFixed(0)}%</span></span>
      </div>
    </motion.div>
  );
}

function FactorBar({ label, value, max, color }: { label: string; value: number; max: number; color: "gold" | "emerald" }) {
  return (
    <div>
      <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground mb-1">{label}</div>
      <MiniBar
        value={value}
        max={max}
        colorClass={color === "gold" ? "bg-amber-400" : "bg-emerald-400"}
        height="h-1.5"
      />
      <div className="text-[0.6rem] text-muted-foreground font-mono mt-0.5">{value.toFixed(2)}</div>
    </div>
  );
}

export function EjectReintegration({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  return (
    <div className="space-y-4">
      <Reveal>
        <Panel className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-semibold text-foreground/90">
                Geopolitical Eject + Reintegration (§11)
              </div>
              <div className="text-[0.7rem] text-muted-foreground">
                5-currency staged liquidation ladder + R_score reintegration
              </div>
            </div>
            <Pill tone="amber">depeg band [{EJECT_DEPEG_BAND_LOWER}–{EJECT_DEPEG_BAND_UPPER}]</Pill>
          </div>
          {/* Ladder ladder summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[0.7rem]">
            {EJECT_STAGES.map((s) => (
              <div key={s.stage} className="rounded-md border border-border bg-black/[0.02] p-2">
                <div className="text-muted-foreground">Stage {s.stage} · {(s.sellPct * 100).toFixed(0)}% sold</div>
                <div className="text-[0.65rem] text-muted-foreground/60">{s.condition}</div>
              </div>
            ))}
          </div>
        </Panel>
      </Reveal>

      {/* Per-currency rows */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {(snapshot ? CURRENCIES : []).map((c, i) => (
          <Reveal key={c} delay={i * 0.05}>
            <CurrencyRow snapshot={snapshot as MetricsSnapshot} cur={c} />
          </Reveal>
        ))}
        {!snapshot && [...Array(5)].map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-lg bg-black/[0.03]" />
        ))}
      </div>

      {/* §11.3 formula */}
      <Reveal>
        <Panel className="p-4 sm:p-5">
          <div className="mb-2 text-[0.625rem] uppercase tracking-[0.25em] text-muted-foreground">
            §11.3 Reintegration Score · Anti-Gaming Formula
          </div>
          <div className="font-mono text-sm text-mtqs-gold mb-2">
            R_score = w₁·TimeInBand(48h) + w₂·LiquidityDepth + w₃·OracleAgreement + w₄·(1−Volatility)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[0.72rem]">
            <div className="rounded-md border border-border bg-black/[0.02] p-2">
              <div className="text-muted-foreground">w₁ · Time-in-band</div>
              <div className="font-mono text-mtqs-gold">{REINTEGRATION_WEIGHTS.w1_TimeInBand.toFixed(2)}</div>
            </div>
            <div className="rounded-md border border-border bg-black/[0.02] p-2">
              <div className="text-muted-foreground">w₂ · Liquidity</div>
              <div className="font-mono text-mtqs-gold">{REINTEGRATION_WEIGHTS.w2_LiquidityDepth.toFixed(2)}</div>
            </div>
            <div className="rounded-md border border-border bg-black/[0.02] p-2">
              <div className="text-muted-foreground">w₃ · Oracle agreement</div>
              <div className="font-mono text-mtqs-gold">{REINTEGRATION_WEIGHTS.w3_OracleAgreement.toFixed(2)}</div>
            </div>
            <div className="rounded-md border border-border bg-black/[0.02] p-2">
              <div className="text-muted-foreground">w₄ · 1−Volatility</div>
              <div className="font-mono text-mtqs-gold">{REINTEGRATION_WEIGHTS.w4_OneMinusVolatility.toFixed(2)}</div>
            </div>
          </div>
          <p className="mt-3 text-[0.72rem] text-muted-foreground leading-relaxed">
            When R_score &gt; {REINTEGRATION_THRESHOLD.toFixed(2)} the currency re-enters staged re-purchase: 25% → 50% → 100% of pre-eject exposure, one stage per cycle. A currency must score above threshold for several cycles before eject stage decrements.
          </p>
        </Panel>
      </Reveal>
    </div>
  );
}
