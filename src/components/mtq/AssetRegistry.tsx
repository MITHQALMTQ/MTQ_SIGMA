// MTQΣ — Asset Admission Registry (§5)
// 9 admitted assets across 3 USD issuers + 1 EUR issuer + 2 gold issuers
// (Circle/Paxos/Tether), with 8-criteria checklist + state badge + concentration
// report.
//
// Brand v2 (F2 RESOLVED): the genesis issuer concentration breach is now FIXED.
// USDC/Circle + EURC/Circle are joined by USDP/Paxos + USDT/Tether + PAXG/Paxos
// + XAUT/Tether. The §5.6 optimizer splits USD 3-way and gold 2-way so every
// issuer sits ≤ 25% warn threshold. The panel leads with an emerald "Resolved"
// block describing the fix, then the live per-issuer concentration breakdown
// (each row coloured ok/warn/breach per the live snapshot).

"use client";

import { motion } from "framer-motion";
import { Panel, Reveal, GlowDot, Pill, MiniBar } from "./primitives";
import { fmtUsd } from "./format";
import {
  ELIGIBILITY_CRITERIA,
  type AssetRecord,
  type ConcentrationReport,
  type AssetState,
  eligibilityScore,
} from "@/lib/mtq/registry";
import {
  REGISTRY_TIMELOCK_HOURS,
  CONCENTRATION_LIMIT_PCT,
  CONCENTRATION_WARN_PCT,
  CONCENTRATION_CRISIS_LIMIT_PCT,
} from "@/lib/mtq/blueprint";

const STATE_TONE: Record<AssetState, "emerald" | "amber" | "rose" | "muted"> = {
  ACTIVE: "emerald",
  WATCH: "amber",
  RESTRICTED: "amber",
  EJECTED: "rose",
};

const STATE_LABEL: Record<AssetState, string> = {
  ACTIVE: "ACTIVE",
  WATCH: "WATCH",
  RESTRICTED: "RESTRICTED",
  EJECTED: "EJECTED",
};

function CriteriaGrid({ rec }: { rec: AssetRecord }) {
  const cells = ELIGIBILITY_CRITERIA.map((c) => ({
    id: c.id,
    label: c.label,
    desc: c.desc,
    ok: rec.criteria[c.id as keyof typeof rec.criteria],
  }));
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {cells.map((c) => (
        <div
          key={c.id}
          title={`${c.label} — ${c.desc}`}
          className={`group relative flex items-center justify-center rounded-md border h-8 text-[0.65rem] font-medium ${
            c.ok
              ? "border-mtqs-emerald/30 bg-mtqs-emerald/5 text-mtqs-emerald"
              : "border-mtqs-rose/30 bg-mtqs-rose/5 text-mtqs-rose/80"
          }`}
        >
          {c.ok ? "✓" : "✗"}
        </div>
      ))}
    </div>
  );
}

function AssetCard({ rec, index }: { rec: AssetRecord; index: number }) {
  const score = eligibilityScore(rec);
  const tone = STATE_TONE[rec.state];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className={`rounded-lg border p-4 ${
        rec.state === "EJECTED"
          ? "border-mtqs-rose/30 bg-mtqs-rose/[0.03]"
          : rec.state === "WATCH"
          ? "border-mtqs-amber/20 bg-mtqs-amber/[0.02]"
          : "border-border bg-white/[0.015]"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-mono text-base font-semibold text-foreground/90">{rec.currencyCode}</span>
            <span className="text-xs text-muted-foreground">→</span>
            <span className="font-mono text-sm text-mtqs-gold">{rec.tokenAddress}</span>
          </div>
          <div className="mt-0.5 text-[0.7rem] text-muted-foreground">
            {rec.name} · issuer <span className="text-muted-foreground font-mono">{rec.issuerId}</span>
          </div>
        </div>
        <Pill tone={tone}>
          <GlowDot color={tone === "emerald" ? "emerald" : tone === "rose" ? "rose" : "amber"} size="h-1.5 w-1.5" />
          {STATE_LABEL[rec.state]}
        </Pill>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-[0.7rem]">
        <div className="rounded-md border border-border bg-black/[0.02] px-2 py-1.5">
          <div className="text-muted-foreground">Haircut</div>
          <div className="font-mono text-mtqs-gold">{(rec.haircut * 100).toFixed(2)}%</div>
        </div>
        <div className="rounded-md border border-border bg-black/[0.02] px-2 py-1.5">
          <div className="text-muted-foreground">Liq. Min.</div>
          <div className="font-mono text-mtqs-gold">${(rec.liquidityThresholdUsd / 1_000_000).toFixed(1)}M</div>
        </div>
        <div className="rounded-md border border-border bg-black/[0.02] px-2 py-1.5">
          <div className="text-muted-foreground">Score</div>
          <div className={`font-mono ${score.allPassed ? "text-mtqs-emerald" : "text-mtqs-amber"}`}>
            {score.passed}/{score.total}
          </div>
        </div>
      </div>

      {/* Criteria mini-grid */}
      <CriteriaGrid rec={rec} />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {ELIGIBILITY_CRITERIA.map((c) => {
          const ok = rec.criteria[c.id as keyof typeof rec.criteria];
          return (
            <div key={c.id} className="flex items-center gap-1 text-[0.6rem] text-muted-foreground">
              <span className={ok ? "text-mtqs-emerald" : "text-mtqs-rose/80"}>{ok ? "✓" : "✗"}</span>
              <span>{c.label}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function ConcentrationPanel({ reports, perIssuer }: { reports: ConcentrationReport[] | null; perIssuer: { usdcUsd: number; usdpUsd: number; usdtUsd: number; eurcUsd: number; paxgUsd: number; xautUsd: number } | null }) {
  if (!reports || reports.length === 0) {
    return (
      <Panel className="p-4">
        <div className="text-sm text-muted-foreground">No concentration data.</div>
      </Panel>
    );
  }

  // Per-issuer constituent breakdown for the expandable view.
  const issuerConstituents: Record<string, { label: string; usd: number }[]> = {
    CIRCLE: [
      { label: "USDC", usd: perIssuer?.usdcUsd ?? 0 },
      { label: "EURC", usd: perIssuer?.eurcUsd ?? 0 },
    ],
    PAXOS: [
      { label: "USDP", usd: perIssuer?.usdpUsd ?? 0 },
      { label: "PAXG", usd: perIssuer?.paxgUsd ?? 0 },
    ],
    TETHER: [
      { label: "USDT", usd: perIssuer?.usdtUsd ?? 0 },
      { label: "XAUT", usd: perIssuer?.xautUsd ?? 0 },
    ],
  };

  return (
    <div className="space-y-3">
      {reports.map((r, i) => {
        const tone =
          r.status === "breach" ? "rose" : r.status === "warn" ? "amber" : "emerald";
        const limit = CONCENTRATION_LIMIT_PCT * 100;
        const warn = CONCENTRATION_WARN_PCT * 100;
        const crisis = CONCENTRATION_CRISIS_LIMIT_PCT * 100;
        const constituents = issuerConstituents[r.issuer] ?? [];
        return (
          <motion.div
            key={r.issuer}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className={`rounded-lg border p-4 ${
              r.status === "breach"
                ? "border-mtqs-rose/40 bg-mtqs-rose/5"
                : r.status === "warn"
                ? "border-mtqs-amber/40 bg-mtqs-amber/5"
                : "border-mtqs-emerald/30 bg-mtqs-emerald/5"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-mono text-sm font-semibold text-foreground/90">{r.issuer}</div>
                <div className="text-[0.7rem] text-muted-foreground">
                  {fmtUsd(r.usdValue)} ·{" "}
                  {constituents.map((c) => `${c.label} ${fmtUsd(c.usd)}`).join(" · ")}
                </div>
              </div>
              <Pill tone={tone}>
                <GlowDot color={tone === "emerald" ? "emerald" : tone === "rose" ? "rose" : "amber"} size="h-1.5 w-1.5" />
                {r.status.toUpperCase()}
              </Pill>
            </div>
            <div className="relative">
              <MiniBar
                value={r.sharePct}
                max={crisis / 100}
                colorClass={
                  r.status === "breach"
                    ? "bg-mtqs-rose"
                    : r.status === "warn"
                    ? "bg-mtqs-amber"
                    : "bg-mtqs-emerald"
                }
                height="h-2.5"
              />
              {/* Threshold ticks */}
              <div className="mt-1 flex justify-between text-[0.6rem] font-mono text-muted-foreground">
                <span>0</span>
                <span style={{ position: "absolute", left: `${(warn / crisis) * 100}%`, top: -1, transform: "translateX(-50%)" }} className="text-mtqs-amber">↓{warn}%</span>
                <span style={{ position: "absolute", left: `${(limit / crisis) * 100}%`, top: -1, transform: "translateX(-50%)" }} className="text-mtqs-rose">↓{limit}%</span>
                <span>35%</span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[0.7rem] text-muted-foreground">
              <span>share <span className={`font-mono ${tone === "emerald" ? "text-mtqs-emerald" : tone === "rose" ? "text-mtqs-rose" : "text-mtqs-amber"}`}>{(r.sharePct * 100).toFixed(2)}%</span></span>
              <span>limit <span className="font-mono">{(r.limitPct * 100).toFixed(0)}%</span></span>
              <span>warn <span className="font-mono">{(r.warnPct * 100).toFixed(0)}%</span></span>
              <span>crisis-override <span className="font-mono">{crisis.toFixed(0)}%</span></span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function AssetRegistry({
  registry,
  concentration,
  perIssuer,
}: {
  registry: AssetRecord[] | null;
  concentration: ConcentrationReport[] | null;
  perIssuer: { usdcUsd: number; usdpUsd: number; usdtUsd: number; eurcUsd: number; paxgUsd: number; xautUsd: number } | null;
}) {
  // F2 is now FIXED — the live concentration reports tell us whether every
  // issuer is ok/warn/breach. We surface an emerald "Resolved" banner if all
  // issuers are "ok"; otherwise an amber "optimizer running" banner.
  const allOk = (concentration ?? []).length > 0 && (concentration ?? []).every((c) => c.status === "ok");
  const anyBreach = (concentration ?? []).some((c) => c.status === "breach");
  const maxIssuer = (concentration ?? []).reduce(
    (acc, c) => (c.sharePct > (acc?.sharePct ?? 0) ? c : acc),
    null as ConcentrationReport | null,
  );

  return (
    <div className="space-y-5">
      <Reveal>
        <Panel className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <div>
              <div className="text-sm font-semibold text-foreground/90">
                Genesis Asset Registry · §5.4.2
              </div>
              <div className="text-[0.7rem] text-muted-foreground">
                {registry?.length ?? 0} admitted assets · 8 eligibility criteria · state machine ACTIVE/WATCH/RESTRICTED/EJECTED
              </div>
            </div>
            <Pill tone="amber">
              {REGISTRY_TIMELOCK_HOURS}h timelock for asset changes (§5.10)
            </Pill>
          </div>
        </Panel>
      </Reveal>

      {/* F2 — concentration finding (now FIXED) */}
      <Reveal>
        <Panel
          variant={anyBreach ? "rose" : "emerald"}
          className={`p-4 sm:p-5 ${anyBreach ? "mtqs-glow-rose" : "mtqs-glow-emerald"}`}
        >
          <div className="flex items-start gap-3">
            <GlowDot color={anyBreach ? "rose" : "emerald"} size="h-3 w-3" className="mt-1" />
            <div>
              <div className={`text-sm font-semibold mb-1 ${anyBreach ? "text-mtqs-rose" : "text-mtqs-emerald"}`}>
                {anyBreach
                  ? "Honest Finding — issuer concentration breach (§5.6) · optimizer running"
                  : "Resolved Finding — issuer concentration breach (§5.6) · fixed"}
              </div>
              <p className="text-[0.75rem] text-muted-foreground leading-relaxed">
                The v1.0 genesis mapping (USD → USDC, EUR → EURC, both Circle) placed Circle at
                ~54% of NAV, breaching the §5.6 30% issuer concentration limit. The registry now
                admits 3 USD issuers (USDC/Circle + USDP/Paxos + USDT/Tether) and 2 gold issuers
                (PAXG/Paxos + XAUT/Tether); the §5.6 optimizer splits USD 3-way and gold 50/50
                each tick.
                {maxIssuer && (
                  <>
                    {" "}Live max issuer = <span className="font-mono font-semibold text-foreground">
                      {maxIssuer.issuer} at {(maxIssuer.sharePct * 100).toFixed(2)}%
                    </span>{" "}
                    of NAV — {maxIssuer.status === "ok"
                      ? <span className="text-mtqs-emerald font-medium">all issuers ≤ 25% warn threshold ✓</span>
                      : maxIssuer.status === "warn"
                      ? <span className="text-mtqs-amber font-medium">at the 25% warn threshold</span>
                      : <span className="text-mtqs-rose font-medium">still breaching the 30% limit</span>}
                  </>
                )}
                . EUR remains single-issuer (EURC/Circle) until a 2nd regulated EUR stablecoin
                is admitted — honestly flagged.
              </p>
            </div>
          </div>
        </Panel>
      </Reveal>

      {/* Asset cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {registry ? (
          registry.map((rec, i) => (
            <Reveal key={`${rec.currencyCode}-${rec.tokenAddress}-${i}`} delay={i * 0.04}>
              <AssetCard rec={rec} index={i} />
            </Reveal>
          ))
        ) : (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-black/[0.03]" />
          ))
        )}
      </div>

      {/* Concentration report */}
      <Reveal>
        <Panel className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground/90">
              Issuer Concentration (§5.6)
            </div>
            <div className="text-[0.7rem] text-muted-foreground font-mono">
              warn {(CONCENTRATION_WARN_PCT * 100).toFixed(0)}% · limit {(CONCENTRATION_LIMIT_PCT * 100).toFixed(0)}% · crisis {(CONCENTRATION_CRISIS_LIMIT_PCT * 100).toFixed(0)}%
            </div>
          </div>
          <ConcentrationPanel reports={concentration} perIssuer={perIssuer} />
        </Panel>
      </Reveal>
    </div>
  );
}
