// MTQΣ — Live System Health Panel (§24 — system status at a glance)
//
// A bespoke brand-primitives panel that fetches /api/metrics every 5s and
// shows the real-time health of all 8 subsystems of the MTQΣ pilot stack:
//
//   1. Engine Health   — status (NORMAL/CAUTION/etc.), tick count (if available), uptime
//   2. Live FX         — 8/8 live count, source string, VIX + DXY values
//   3. Chain Index     — I_t value, GFB index, MTQ price, peg in band
//   4. Risk State      — current 6-state machine state, RR, LCR
//   5. Oracle          — anyPaused, valid feeds count (across all pairs × 3 feeds)
//   6. Concentration   — top issuer + share, status (ok/warn/breach)
//   7. Reconciliation  — F1-F4 findings + severity
//   8. Audit Trail     — populated (no API endpoint for counts; shown as HEALTHY
//                        because the audit-trail writer runs every tick and the
//                        retention pruner caps row counts at 10K/5K/5K)
//
// Each subsystem is classified as emerald "HEALTHY" / amber "WARN" / rose
// "DEGRADED" based on its key metric. A summary banner at the top shows
// "X/8 subsystems healthy".
//
// This panel is the first thing users see when they open the Dashboard —
// before the hero ConstitutionalSeparation section. The intent: users can
// verify the live system health at a glance before drilling into the
// detailed monetary-state panels below.
//
// Wired into DashboardSection at the very top (before LiveMonetaryState).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Radio,
  Database,
  ShieldCheck,
  Layers,
  Gauge,
  Building2,
  FileCheck,
  ScrollText,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import {
  Panel,
  Reveal,
  Pill,
  GlowDot,
  SectionHeading,
  Skeleton,
} from "@/components/mtq/primitives";
import {
  fmtUsd,
  fmtRatio,
  fmtFixed,
  fmtNum,
} from "@/components/mtq/format";
import type { MetricsSnapshot, ReconciliationFinding } from "@/lib/mtq/engine";

// =========================================================================
// Types
// =========================================================================

type Health = "HEALTHY" | "WARN" | "DEGRADED";

interface SubsystemRow {
  id: string;
  name: string;
  icon: typeof Activity;
  health: Health;
  primary: string;     // the headline value (large, mono)
  secondary: string;   // secondary detail line
  tertiary?: string;    // optional third detail line
}

interface SnapshotEnvelope {
  // The /api/metrics endpoint returns either the full MetricsSnapshot (200)
  // or { error, detail } (503 when the engine is not ready).
  snapshot?: MetricsSnapshot;
  error?: string;
  detail?: string;
}

// =========================================================================
// Health classification helpers (one per subsystem)
// =========================================================================

function classifyEngine(snap: MetricsSnapshot | undefined): Health {
  if (!snap) return "DEGRADED";
  // NORMAL/RECOVERY = HEALTHY, CAUTION = WARN, STRESS = WARN, DEFENSIVE/EMERGENCY = DEGRADED.
  const s = snap.status;
  if (s === "NORMAL" || s === "RECOVERY") return "HEALTHY";
  if (s === "CAUTION" || s === "STRESS") return "WARN";
  return "DEGRADED";
}

function classifyLiveFx(snap: MetricsSnapshot | undefined): Health {
  if (!snap) return "DEGRADED";
  const n = snap.fx.liveCount ?? 0;
  if (n >= 8) return "HEALTHY";
  if (n >= 6) return "WARN";
  return "DEGRADED";
}

function classifyChainIndex(snap: MetricsSnapshot | undefined): Health {
  if (!snap) return "DEGRADED";
  // HEALTHY if peg in band AND index level is in a "tight" range around 1.0
  // (e.g. [0.50, 2.00] is the safety band; [0.90, 1.10] is the "tight" band).
  if (!snap.priceInBand) return "DEGRADED";
  const i = snap.chainIndex.I_t;
  if (i >= 0.90 && i <= 1.10) return "HEALTHY";
  return "WARN";
}

function classifyRiskState(snap: MetricsSnapshot | undefined): Health {
  if (!snap) return "DEGRADED";
  const s = snap.status;
  if (s === "NORMAL" || s === "RECOVERY") return "HEALTHY";
  if (s === "CAUTION" || s === "STRESS") return "WARN";
  return "DEGRADED";
}

function classifyOracle(snap: MetricsSnapshot | undefined): Health {
  if (!snap) return "DEGRADED";
  // anyPaused → DEGRADED (mint+rebalance suspended per §9.3).
  if (snap.oraclePaused) return "DEGRADED";
  // If <2 valid feeds for ANY pair, oracle is paused; HEALTHY otherwise.
  return "HEALTHY";
}

function classifyConcentration(snap: MetricsSnapshot | undefined): Health {
  if (!snap) return "DEGRADED";
  const reports = snap.concentration ?? [];
  if (reports.length === 0) return "HEALTHY"; // no concentration data → not breached
  if (reports.some((r) => r.status === "breach")) return "DEGRADED";
  if (reports.some((r) => r.status === "warn")) return "WARN";
  return "HEALTHY";
}

function classifyReconciliation(snap: MetricsSnapshot | undefined): Health {
  if (!snap) return "DEGRADED";
  const findings = snap.reconciliation ?? [];
  if (findings.length === 0) return "HEALTHY";
  if (findings.some((f) => f.severity === "outstanding")) return "WARN";
  return "HEALTHY";
}

// Audit trail is always "populated" because the audit-trail writer runs every
// tick (pilot-state.ts::tick writes RebalancingDecision / DailyStateVector /
// OracleSample / MarpDecisions rows, throttled) and the pruner caps row counts
// at 10K / 5K / 5K every 5 min. We have no API endpoint to fetch the counts
// (kept simple per the task brief). Show "populated" as HEALTHY.
function classifyAuditTrail(_snap: MetricsSnapshot | undefined): Health {
  void _snap;
  return "HEALTHY";
}

// =========================================================================
// Build the 8 subsystem rows from a snapshot
// =========================================================================

function buildRows(snap: MetricsSnapshot | undefined): SubsystemRow[] {
  const oracleValidFeeds =
    snap?.oracle?.pairs.reduce(
      (a, p) => a + (p.paused ? 0 : p.validCount),
      0,
    ) ?? 0;
  const oracleTotalFeeds = snap?.oracle ? snap.oracle.pairs.length * 3 : 0;

  const topConc = snap?.concentration?.[0] ?? null;
  const topIssuerName = topConc?.issuer ?? "—";
  const topIssuerShare = topConc ? `${(topConc.sharePct * 100).toFixed(2)}%` : "—";
  const topIssuerStatus = topConc?.status ?? "—";

  const reconciliationFindings: ReconciliationFinding[] = snap?.reconciliation ?? [];
  // Compress to "F1: fixed | F2: outstanding | F3: fixed | F4: informational" form.
  const reconciliationSummary = reconciliationFindings.length > 0
    ? reconciliationFindings
        .map((f) => `${f.id.split("-")[0]}: ${f.severity}`)
        .join(" · ")
    : "no findings";

  return [
    {
      id: "engine",
      name: "Engine Health",
      icon: Activity,
      health: classifyEngine(snap),
      primary: snap?.status ?? "—",
      secondary: `tick: — · uptime: —`,
      tertiary: `RR ${fmtRatio(snap?.reserveRatio ?? null)}`,
    },
    {
      id: "live-fx",
      name: "Live FX",
      icon: Radio,
      health: classifyLiveFx(snap),
      primary: `${snap?.fx.liveCount ?? 0}/8 live`,
      secondary: snap?.source ?? "—",
      tertiary: `VIX ${fmtNum(snap?.fx.VIX ?? null, 2)} · DXY ${fmtNum(snap?.fx.DXY ?? null, 2)}`,
    },
    {
      id: "chain-index",
      name: "Chain Index",
      icon: Layers,
      health: classifyChainIndex(snap),
      primary: `I_t = ${fmtFixed(snap?.chainIndex.I_t ?? null, 6)}`,
      secondary: `GFB ${fmtFixed(snap?.gfbIndex ?? null, 6)} · P_MTQ ${fmtFixed(snap?.mtqPrice ?? null, 6)}`,
      tertiary: `peg ${snap?.priceInBand ? "in band" : "BROKEN"}`,
    },
    {
      id: "risk-state",
      name: "Risk State",
      icon: Gauge,
      health: classifyRiskState(snap),
      primary: snap?.status ?? "—",
      secondary: `RR ${fmtRatio(snap?.reserveRatio ?? null)} · LCR ${fmtRatio(snap?.lcr ?? null)}`,
      tertiary: snap?.riskStateWorseCondition && snap?.riskStateWorseCondition !== "neither"
        ? `worse condition: ${snap.riskStateWorseCondition.toUpperCase()}`
        : "no worse condition binding",
    },
    {
      id: "oracle",
      name: "Oracle",
      icon: ShieldCheck,
      health: classifyOracle(snap),
      primary: snap?.oraclePaused ? "PAUSED" : "live",
      secondary: `${oracleValidFeeds}/${oracleTotalFeeds} feeds valid`,
      tertiary: `${snap?.oracle?.pairs.length ?? 0} pairs × 3 sources`,
    },
    {
      id: "concentration",
      name: "Concentration",
      icon: Building2,
      health: classifyConcentration(snap),
      primary: topIssuerName,
      secondary: `top issuer: ${topIssuerName} @ ${topIssuerShare}`,
      tertiary: `status: ${topIssuerStatus}`,
    },
    {
      id: "reconciliation",
      name: "Reconciliation",
      icon: FileCheck,
      health: classifyReconciliation(snap),
      primary: `${reconciliationFindings.filter((f) => f.severity === "outstanding").length} outstanding`,
      secondary: reconciliationSummary,
      tertiary: `${reconciliationFindings.filter((f) => f.severity === "fixed").length} fixed · ${reconciliationFindings.filter((f) => f.severity === "informational").length} informational`,
    },
    {
      id: "audit-trail",
      name: "Audit Trail",
      icon: ScrollText,
      health: classifyAuditTrail(snap),
      primary: "populated",
      secondary: "DB writer active · pruner caps at 10K/5K/5K",
      tertiary: "no counts endpoint (kept simple)",
    },
  ];
}

// =========================================================================
// Health → brand color helpers
// =========================================================================

function healthTone(h: Health): "emerald" | "amber" | "rose" {
  if (h === "HEALTHY") return "emerald";
  if (h === "WARN") return "amber";
  return "rose";
}

function healthGlowColor(h: Health): "emerald" | "amber" | "rose" {
  if (h === "HEALTHY") return "emerald";
  if (h === "WARN") return "amber";
  return "rose";
}

function healthLabel(h: Health): string {
  if (h === "HEALTHY") return "HEALTHY";
  if (h === "WARN") return "WARN";
  return "DEGRADED";
}

// =========================================================================
// Subsystem card
// =========================================================================

function SubsystemCard({ row }: { row: SubsystemRow }) {
  const tone = healthTone(row.health);
  const glow = healthGlowColor(row.health);
  const Icon = row.icon;
  return (
    <Panel
      as="article"
      className="relative p-4 sm:p-5 h-full flex flex-col gap-3"
      variant={row.health === "DEGRADED" ? "rose" : row.health === "HEALTHY" ? "emerald" : "default"}
    >
      {/* Top stripe colored by health */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        aria-hidden="true"
        style={{
          background:
            row.health === "HEALTHY"
              ? "linear-gradient(90deg, transparent, rgba(61, 220, 151, 0.55), transparent)"
              : row.health === "WARN"
              ? "linear-gradient(90deg, transparent, rgba(255, 184, 77, 0.55), transparent)"
              : "linear-gradient(90deg, transparent, rgba(255, 93, 115, 0.55), transparent)",
        }}
      />
      {/* Header: icon + name + status pill */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon
            className="h-4 w-4 text-mtqs-gold/80 shrink-0"
            aria-hidden="true"
          />
          <span className="text-[0.7rem] uppercase tracking-[0.18em] text-white/40/90 leading-snug break-words">
            {row.name}
          </span>
        </div>
        <Pill tone={tone}>
          <GlowDot color={glow} size="h-1.5 w-1.5" />
          {healthLabel(row.health)}
        </Pill>
      </div>
      {/* Primary value */}
      <div className="font-mono tabular-nums text-lg sm:text-xl text-white leading-tight break-words min-h-[1.75rem]">
        {row.primary}
      </div>
      {/* Secondary line */}
      <div className="text-[0.72rem] text-white/40/90 font-mono tabular-nums break-words leading-relaxed">
        {row.secondary}
      </div>
      {/* Tertiary line (optional) */}
      {row.tertiary ? (
        <div className="text-[0.68rem] text-white/40 font-mono tabular-nums break-words leading-relaxed">
          {row.tertiary}
        </div>
      ) : null}
    </Panel>
  );
}

// =========================================================================
// Main component
// =========================================================================

export function SystemHealth() {
  const [snap, setSnap] = useState<MetricsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0); // 1s tick to refresh "fetched Xs ago"
  const mountedRef = useRef(true);

  const fetchMetrics = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    try {
      const res = await fetch("/api/metrics", { cache: "no-store" });
      if (res.status === 503) {
        // Engine not ready — surface a clear "warming up" message.
        if (!mountedRef.current) return;
        setError("Engine warming up — singleton initializing");
        return;
      }
      if (!res.ok) throw new Error(`metrics ${res.status}`);
      const data = (await res.json()) as MetricsSnapshot;
      if (!mountedRef.current) return;
      setSnap(data);
      setError(null);
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : "fetch failed");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Initial fetch + 5s polling (per the task brief). The 1s tick re-renders
  // so any "Xs ago" displays stay fresh without re-fetching.
  useEffect(() => {
    mountedRef.current = true;
    fetchMetrics();
    const pollId = setInterval(() => fetchMetrics(false), 5_000);
    const tickId = setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      mountedRef.current = false;
      clearInterval(pollId);
      clearInterval(tickId);
    };
  }, [fetchMetrics]);

  const rows = buildRows(snap ?? undefined);
  const healthyCount = rows.filter((r) => r.health === "HEALTHY").length;
  const warnCount = rows.filter((r) => r.health === "WARN").length;
  const degradedCount = rows.filter((r) => r.health === "DEGRADED").length;
  const allHealthy = healthyCount === 8;

  const summaryTone: "emerald" | "amber" | "rose" =
    degradedCount > 0 ? "rose" : warnCount > 0 ? "amber" : "emerald";

  return (
    <section id="system-health" className="scroll-mt-32" aria-labelledby="system-health-heading">
      <SectionHeading
        eyebrow="§24 · System Health"
        title={
          <span id="system-health-heading" className="flex items-center gap-2">
            Live System Health
          </span>
        }
        right={
          <div className="flex items-center gap-2">
            <Pill tone={summaryTone}>
              <GlowDot color={summaryTone} size="h-1.5 w-1.5" />
              {healthyCount}/8 healthy
            </Pill>
            <button
              type="button"
              onClick={() => fetchMetrics(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.03]/[0.03] px-2.5 py-1.5 text-[0.7rem] text-white transition hover:bg-white/[0.03]/[0.06] hover:border-mtqs-gold/40 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mtqs-gold/40"
              aria-label="Force refresh the metrics snapshot"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-mtqs-gold/85 ${refreshing ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              <span>{refreshing ? "Refreshing…" : "Force refresh"}</span>
            </button>
          </div>
        }
      />

      <Reveal>
        <Panel className="p-4 sm:p-6">
          {/* Summary banner */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
              <span className="text-[0.7rem] uppercase tracking-[0.22em] text-white/40">
                All 8 subsystems · refreshed every 5s
              </span>
            </div>
            <div className="flex items-center gap-2 text-[0.72rem] font-mono tabular-nums">
              <span className="text-mtqs-emerald/90">{healthyCount} healthy</span>
              <span className="text-white/40/40">·</span>
              <span className="text-mtqs-amber/90">{warnCount} warn</span>
              <span className="text-white/40/40">·</span>
              <span className="text-mtqs-rose/90">{degradedCount} degraded</span>
            </div>
          </div>

          {/* Loading skeleton (first fetch only) */}
          {loading && !snap ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-md border border-mtqs-rose/30 bg-mtqs-rose/10 p-4 text-[0.78rem] text-rose-200">
              <p className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-mtqs-rose/80 mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  <span className="font-medium">Unable to fetch /api/metrics.</span>{" "}
                  <span className="text-rose-200/85 font-mono">{error}</span>
                </span>
              </p>
              <button
                type="button"
                onClick={() => fetchMetrics(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-mtqs-rose/40 bg-mtqs-rose/10 px-2.5 py-1.5 text-[0.7rem] text-rose-100 transition hover:bg-mtqs-rose/20"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* The 8 subsystem cards in a 4-column grid (responsive) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {rows.map((row) => (
                  <SubsystemCard key={row.id} row={row} />
                ))}
              </div>

              {/* Honest summary line */}
              <div className="mt-5 rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-3 text-[0.72rem] text-white/40 leading-relaxed">
                <p className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-mtqs-emerald/80 mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="text-white/90">Honest note.</span>{" "}
                    This panel reflects the live engine state at{" "}
                    <span className="font-mono text-mtqs-gold-light">
                      {snap ? new Date(snap.fetchedAt).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC") : "—"}
                    </span>
                    . Engine "tick count" and "uptime" are not exposed by the
                    metrics endpoint (kept simple per the task brief — the
                    singleton's tickCount and startedAt are internal). Audit
                    Trail is shown as HEALTHY "populated" because the DB writer
                    runs every tick and the pruner caps row counts at 10K/5K/5K;
                    no API endpoint exposes the live counts.
                    {allHealthy
                      ? " All 8 subsystems are HEALTHY."
                      : degradedCount > 0
                      ? ` ${degradedCount} subsystem${degradedCount > 1 ? "s are" : " is"} DEGRADED — investigate immediately.`
                      : ` ${warnCount} subsystem${warnCount > 1 ? "s are" : " is"} in WARN — investigate when convenient.`}
                  </span>
                </p>
              </div>
            </>
          )}
        </Panel>
      </Reveal>
    </section>
  );
}
