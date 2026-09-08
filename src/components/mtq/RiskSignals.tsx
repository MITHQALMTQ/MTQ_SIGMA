// MTQΣ — Live Risk Monitor (P1-B)
// Renders the AI-generated risk signal list pulled from
// /api/ai/risk-signals → { signals: Array<{severity, title, detail, source}>,
// generatedAt, model }. Powered by Groq (llama-3.3-70b-versatile) for speed.
//
// Behaviour:
//   - Fetches on mount, then polls every 15s. Manual refresh button top-right.
//   - Each signal is rendered as a row card with a severity icon, a severity
//     badge Pill, a bold title, a muted detail, and a small mono source label
//     right-aligned (e.g. "oracle", "concentration", "peg", "buffer").
//   - AnimatePresence fades each row in / slides it down on change.
//   - Empty state: a single muted "No signals emitted" row.
//   - Loading state: 2 pulsing gray rows.
//   - Error state: rose-tinted panel with retry.
//   - Footer: `Generated {fmtAgo} · {count} signals` + disclaimer.
//
// Brand: obsidian + gold, font-mono on numerics, lucide icons (no emojis),
// Panel + Reveal + Pill + GlowDot from the primitives. NO indigo, NO blue.

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, RefreshCw, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Panel, Reveal, Pill, GlowDot, Skeleton } from "./primitives";
import { fmtAgo } from "./format";

/* ---------- API shape contract (must match P1-A backend) ---------- */
type SignalSeverity = "critical" | "warning" | "info";

interface RiskSignal {
  severity: SignalSeverity;
  title: string;
  detail: string;
  source: string;
}

interface RiskSignalsResponse {
  signals: RiskSignal[];
  generatedAt: number;
  model: string;
}

/* ---------- Model badge tone: gold / muted / rose ---------- */
function modelTone(model: string | null | undefined): "gold" | "muted" | "rose" {
  if (!model) return "muted";
  if (model === "disabled" || model === "error") return "rose";
  if (model.startsWith("fallback")) return "muted";
  return "gold"; // real model
}

/* ---------- Severity visual config ---------- */
function severityConfig(sev: SignalSeverity): {
  icon: typeof AlertCircle;
  pillTone: "rose" | "amber" | "muted";
  dotColor: "rose" | "amber" | "gold";
  iconClass: string;
  borderClass: string;
  bgClass: string;
} {
  if (sev === "critical") {
    return {
      icon: AlertCircle,
      pillTone: "rose",
      dotColor: "rose",
      iconClass: "text-rose-300",
      borderClass: "border-l-mtqs-rose/45",
      bgClass: "bg-mtqs-rose/[0.04]",
    };
  }
  if (sev === "warning") {
    return {
      icon: AlertTriangle,
      pillTone: "amber",
      dotColor: "amber",
      iconClass: "text-amber-300",
      borderClass: "border-l-mtqs-amber/45",
      bgClass: "bg-mtqs-amber/[0.04]",
    };
  }
  return {
    icon: Info,
    pillTone: "muted",
    dotColor: "gold",
    iconClass: "text-muted-foreground/80",
    borderClass: "border-l-white/[0.12]",
    bgClass: "bg-white/[0.02]",
  };
}

function severityLabel(sev: SignalSeverity): string {
  return sev === "critical" ? "CRITICAL" : sev === "warning" ? "WARNING" : "INFO";
}

/* ---------- RiskSignals component ---------- */
export function RiskSignals({ className = "" }: { className?: string }) {
  const [data, setData] = useState<RiskSignalsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/risk-signals", { cache: "no-store" });
      if (!res.ok) throw new Error(`risk-signals ${res.status}`);
      const json = (await res.json()) as RiskSignalsResponse;
      if (!mountedRef.current) return;
      if (json?.model === "error" || !Array.isArray(json?.signals)) {
        setData(json ?? null);
        setError(Array.isArray(json?.signals) ? null : "Risk-signals payload missing");
      } else {
        setData(json);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchSignals();
    // Poll every 15s — Groq is fast and the live snapshot updates every 4s.
    const id = setInterval(fetchSignals, 15_000);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchSignals]);

  const tone = modelTone(data?.model);
  const signals = data?.signals ?? [];

  /* ---------- Error state — rose panel + retry ---------- */
  const renderError = () => (
    <div className="rounded-md border border-mtqs-rose/40 bg-mtqs-rose/[0.06] p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-rose-300 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-rose-300">
            Risk monitor unavailable
          </div>
          <p className="mt-1 text-[0.72rem] text-muted-foreground/85 leading-relaxed break-words">
            {error ?? "Unknown error"}
          </p>
        </div>
        <button
          onClick={fetchSignals}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-mtqs-rose/30 bg-mtqs-rose/[0.06] px-2.5 py-1.5 text-[0.7rem] font-medium text-rose-200 hover:bg-mtqs-rose/[0.12] transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Retry
        </button>
      </div>
    </div>
  );

  /* ---------- Loading skeleton — 2 pulsing rows ---------- */
  const renderSkeleton = () => (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="rounded-md border border-white/[0.05] bg-white/[0.02] p-3 space-y-2"
        >
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-2.5 w-[80%]" />
        </div>
      ))}
    </div>
  );

  /* ---------- Single signal row card ---------- */
  const renderSignal = (sig: RiskSignal, idx: number) => {
    const cfg = severityConfig(sig.severity);
    const Icon = cfg.icon;
    return (
      <motion.div
        layout
        key={`${sig.title}-${idx}`}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.25, delay: idx * 0.04 }}
        className={`rounded-md border border-white/[0.06] ${cfg.bgClass} ${cfg.borderClass} border-l-2 p-3`}
      >
        <div className="flex items-start gap-3">
          {/* Severity icon */}
          <Icon className={`h-4 w-4 ${cfg.iconClass} shrink-0 mt-0.5`} aria-hidden="true" />
          {/* Body */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[0.82rem] font-semibold text-foreground/95 leading-snug">
                {sig.title}
              </span>
              <Pill tone={cfg.pillTone} className="font-mono text-[0.6rem]">
                <GlowDot color={cfg.dotColor} size="h-1.5 w-1.5" />
                {severityLabel(sig.severity)}
              </Pill>
            </div>
            <p className="text-[0.72rem] text-muted-foreground/85 leading-relaxed">
              {sig.detail}
            </p>
          </div>
          {/* Source — small mono, right-aligned */}
          {sig.source && (
            <span className="shrink-0 text-[0.62rem] font-mono text-muted-foreground/70 uppercase tracking-wider self-start mt-0.5">
              {sig.source}
            </span>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <Reveal>
      <Panel className={`p-5 sm:p-6 ${className}`}>
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-mtqs-gold/85" aria-hidden="true" />
              <span className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/85">
                AI · Risk Signals
              </span>
            </div>
            <h3 className="text-base font-semibold text-foreground/95">
              Live Risk Monitor
            </h3>
            <p className="text-[0.72rem] text-muted-foreground/75 leading-relaxed">
              Generated by Groq (llama-3.3-70b) from the live snapshot. Informational only.
            </p>
          </div>

          {/* Top-right: model badge + refresh */}
          <div className="flex items-center gap-2 shrink-0">
            <Pill tone={tone} className="font-mono">
              <GlowDot
                color={tone === "gold" ? "gold" : tone === "rose" ? "rose" : "amber"}
                size="h-1.5 w-1.5"
              />
              {data?.model ?? "—"}
            </Pill>
            <button
              onClick={fetchSignals}
              disabled={loading}
              aria-label="Refresh risk signals"
              className="inline-flex items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ---------- Body ---------- */}
        <div className="min-h-[4rem]">
          {error ? (
            renderError()
          ) : loading && !data ? (
            renderSkeleton()
          ) : (
            <div className="space-y-2 max-h-[28rem] overflow-y-auto mtqs-scroll pr-1">
              <AnimatePresence initial={false}>
                {signals.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="rounded-md border border-white/[0.06] bg-white/[0.02] p-4 text-center"
                  >
                    <GlowDot color="gold" size="h-1.5 w-1.5" className="inline-flex mr-2" />
                    <span className="text-[0.78rem] text-muted-foreground/75">
                      No signals emitted
                    </span>
                  </motion.div>
                ) : (
                  signals.map((sig, idx) => renderSignal(sig, idx))
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ---------- Footer ---------- */}
        {data && !error && (
          <div className="mt-4 pt-3 border-t border-white/[0.06] space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.68rem] font-mono tabular-nums text-muted-foreground/75">
              <GlowDot color="gold" size="h-1.5 w-1.5" />
              <span>
                Generated {fmtAgo(data.generatedAt)}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span>{signals.length} signals</span>
            </div>
            <p className="text-[0.62rem] text-muted-foreground/55 leading-relaxed">
              AI-generated. The engine math (src/lib/mtq/engine.ts) is the source of truth.
            </p>
          </div>
        )}
      </Panel>
    </Reveal>
  );
}

export default RiskSignals;
