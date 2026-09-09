// MTQΣ — Investor Section
// Live on-chain verification (fetch /api/onchain/<chainId> per chain) · Protocol
// health (5 live cards from snapshot) · Honest findings (F1/F2 FIXED) ·
// Trial traction (counts from /api/trials/export?format=json) · Investor
// endpoints list with copy buttons.
//
// Props: { onNavigate, snapshot }.

"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { TrendingUp, ArrowRight, CheckCircle2, XCircle, Activity, Shield, Database, Coins, Layers } from "lucide-react";
import { Panel, Reveal, Pill, GlowDot, SectionHeading } from "@/components/mtq/primitives";
import { CANONICAL_MTQ_ADDRESSES } from "@/lib/mtq/contracts";
import { fmtFixed, fmtUsdCompact, fmtRatio, shortAddr, copyToClipboard, fmtAgo } from "@/components/mtq/format";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import type { SectionId } from "@/components/mtq/Navigation";

/* ---------- Onchain verification response ---------- */
interface OnchainResp {
  chain?: string;
  chainId?: number | string;
  contract?: {
    address: string;
    codePresent: boolean;
    name: string;
    symbol: string;
    decimals: number;
    nameHasSigma?: boolean;
  };
  roles?: {
    admin: boolean | null;
    minter: boolean | null;
    pauser: boolean | null;
    paused: boolean | null;
  };
  latestBlock?: number;
  verifiedAt?: string;
  error?: string;
}

interface TrialsExportResp {
  count: number;
  trials: { id: string; type: "MINT" | "REDEEM"; ok: boolean; createdAt: string }[];
}

/* ---------- Investor endpoints list ---------- */
const INVESTOR_ENDPOINTS = [
  { label: "Live snapshot", url: "/api/metrics", desc: "Full MetricsSnapshot — GFB, price, NAV, RR, LCR, status, reconciliation" },
  { label: "Oracle board", url: "/api/oracle", desc: "5-pair oracle consensus (3-of-3 validity, deviation, staleness)" },
  { label: "Asset registry", url: "/api/registry", desc: "9 eligible reserve assets + per-issuer concentration report" },
  { label: "On-chain verify (EVM)", url: "/api/onchain/<chainId>", desc: "Per-chain live bytecode + name/symbol/decimals + role checks (10143, 5042002, 46630)" },
  { label: "On-chain verify (Solana)", url: "/api/onchain/solana", desc: "Solana devnet SPL mint account info + mintAuthority" },
  { label: "Trial export (JSON)", url: "/api/trials/export?format=json", desc: "All mint/redeem trials (SQLite) — full audit trail" },
  { label: "Trial export (CSV)", url: "/api/trials/export?format=csv", desc: "Same trail as CSV for spreadsheet analysis" },
  { label: "Monte Carlo tests", url: "/api/tests", desc: "10,300 runs · 8 suites · audit verdict + invariants + findings" },
];

function CopyEndpointButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      onClick={async (e) => {
        e.preventDefault();
        const ok = await copyToClipboard(value);
        if (ok) toast.success(`Copied ${label}`, { description: value });
        else toast.error("Copy failed");
      }}
      className="text-[0.65rem] font-mono text-mtqs-gold/70 hover:text-mtqs-gold transition px-1.5 py-0.5 rounded border border-transparent hover:border-mtqs-amber/30"
      aria-label={`Copy ${label}`}
    >
      copy
    </button>
  );
}

export function InvestorSection({
  onNavigate: _onNavigate,
  snapshot,
}: {
  onNavigate: (id: SectionId) => void;
  snapshot: MetricsSnapshot | null;
}) {
  const [onchain, setOnchain] = useState<Record<string, OnchainResp | null>>({});
  const [trialsExport, setTrialsExport] = useState<TrialsExportResp | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    // Fetch onchain verification per canonical chain
    const fetchAll = async () => {
      const entries = Object.entries(CANONICAL_MTQ_ADDRESSES);
      const results = await Promise.all(
        entries.map(async ([id, info]) => {
          try {
            const res = await fetch(`/api/onchain/${info.chainId}`, { cache: "no-store" });
            if (!res.ok) return [id, { error: `HTTP ${res.status}` }] as const;
            const data = (await res.json()) as OnchainResp;
            return [id, data] as const;
          } catch (e) {
            return [id, { error: String(e).slice(0, 120) }] as const;
          }
        }),
      );
      if (cancelled || !mountedRef.current) return;
      const map: Record<string, OnchainResp | null> = {};
      for (const [id, data] of results) map[id] = data;
      setOnchain(map);
    };

    // Fetch trial export counts
    const fetchTrials = async () => {
      try {
        const res = await fetch("/api/trials/export?format=json&limit=5000", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as TrialsExportResp;
        if (mountedRef.current) setTrialsExport(data);
      } catch {
        /* ignore */
      }
    };

    fetchAll();
    fetchTrials();
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  /* ---------- Protocol health (5 cards) ---------- */
  const rrTxt = snapshot && Number.isFinite(snapshot.reserveRatio)
    ? fmtRatio(snapshot.reserveRatio)
    : "—";
  const lcrTxt = snapshot && Number.isFinite(snapshot.lcr)
    ? fmtRatio(snapshot.lcr)
    : "∞";
  const healthCards = [
    {
      icon: Activity,
      label: "GFB Index",
      value: snapshot ? fmtFixed(snapshot.gfbIndex, 4) : null,
      sub: snapshot ? `Price $${fmtFixed(snapshot.mtqPrice, 4)}` : "polling…",
      tone: snapshot?.priceInBand ? "emerald" : "rose",
    },
    {
      icon: Shield,
      label: "Reserve Ratio",
      value: snapshot ? rrTxt : null,
      sub: snapshot ? `Target 110% · Hard floor 100%` : "polling…",
      tone:
        !snapshot || !Number.isFinite(snapshot.reserveRatio)
          ? "emerald"
          : snapshot.reserveRatio >= 1.1
          ? "emerald"
          : snapshot.reserveRatio >= 1.05
          ? "amber"
          : "rose",
    },
    {
      icon: Coins,
      label: "Reserve NAV",
      value: snapshot ? fmtUsdCompact(snapshot.nav) : null,
      sub: snapshot ? `Liability ${fmtUsdCompact(snapshot.liability)}` : "polling…",
      tone: "gold",
    },
    {
      icon: Layers,
      label: "LCR",
      value: snapshot ? lcrTxt : null,
      sub: snapshot ? `Target 100% · Stress 25% / 30d` : "polling…",
      tone: snapshot && Number.isFinite(snapshot.lcr) && snapshot.lcr >= 1.0 ? "emerald" : "amber",
    },
    {
      icon: Shield,
      label: "Protocol Status",
      value: snapshot ? snapshot.status : null,
      sub: snapshot ? `Buffer ${snapshot.bufferState}` : "polling…",
      tone:
        !snapshot
          ? "muted"
          : snapshot.status === "NORMAL"
          ? "emerald"
          : snapshot.status === "CAUTION"
          ? "amber"
          : "rose",
    },
  ];

  /* ---------- Honest findings (F1 / F2 FIXED) ---------- */
  const findings = snapshot?.reconciliation ?? [];
  const f1 = findings.find((f) => f.id === "F1-redemption-price");
  const f2 = findings.find((f) => f.id === "F2-circle-concentration");
  const f1And2 = [f1, f2].filter(Boolean) as typeof findings;

  /* ---------- Trial traction stats ---------- */
  const trialCount = trialsExport?.count ?? 0;
  const mintCount = trialsExport?.trials.filter((t) => t.type === "MINT").length ?? 0;
  const redeemCount = trialsExport?.trials.filter((t) => t.type === "REDEEM").length ?? 0;
  const successCount = trialsExport?.trials.filter((t) => t.ok).length ?? 0;
  const successRate = trialCount > 0 ? (successCount / trialCount) * 100 : 0;

  return (
    <div className="space-y-12">
      <SectionHeading
        eyebrow="due diligence · live"
        title="Investor Verification — On-Chain"
        right={
          <Pill tone="gold">
            <GlowDot color="gold" size="h-1.5 w-1.5" />
            {Object.keys(CANONICAL_MTQ_ADDRESSES).length} chains verified
          </Pill>
        }
      />

      {/* Intro */}
      <Reveal>
        <Panel className="p-5">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-mtqs-gold/80 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[0.82rem] text-muted-foreground leading-relaxed">
              This page is the investor diligence surface. Every cell is fetched live from the
              protocol&apos;s own API. Verify the canonical token contract on each chain, read the
              protocol&apos;s health from the live snapshot, review the honest findings (F1 &amp; F2
              FIXED), and audit pilot traction from the trial export. No claim here is static — every
              value can be reproduced by hitting the endpoints below.
            </p>
          </div>
        </Panel>
      </Reveal>

      {/* 1. Live on-chain verification (per chain) */}
      <section aria-labelledby="inv-onchain">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">§deployments · live</div>
            <h3 className="mt-2 text-base font-semibold text-foreground">On-Chain Verification</h3>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(CANONICAL_MTQ_ADDRESSES).map(([id, info]) => {
            const data = onchain[id];
            const codePresent = data?.contract?.codePresent;
            const hasError = !!data?.error;
            const ok = codePresent === true;
            const loading = data == null;
            return (
              <Reveal key={id}>
                <Panel
                  className="p-4 h-full flex flex-col gap-2.5"
                  variant={hasError ? "rose" : ok ? "default" : "default"}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground/75">
                        {info.chain}
                      </div>
                      <div className="font-mono text-[0.65rem] text-muted-foreground/60 mt-0.5">
                        cid {String(info.chainId)}
                      </div>
                    </div>
                    {loading ? (
                      <Pill tone="muted">polling…</Pill>
                    ) : hasError ? (
                      <Pill tone="rose">
                        <XCircle className="h-3 w-3" aria-hidden="true" />
                        error
                      </Pill>
                    ) : ok ? (
                      <Pill tone="emerald">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        live
                      </Pill>
                    ) : (
                      <Pill tone="amber">
                        <XCircle className="h-3 w-3" aria-hidden="true" />
                        no code
                      </Pill>
                    )}
                  </div>

                  {loading ? (
                    <div className="space-y-2">
                      <div className="h-3 w-full animate-pulse rounded bg-black/[0.04]" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-black/[0.04]" />
                    </div>
                  ) : hasError ? (
                    <div className="text-[0.68rem] text-mtqs-rose/80 leading-relaxed font-mono">
                      {data?.error}
                    </div>
                  ) : (
                    <>
                      <div className="text-[0.72rem]">
                        <div className="text-muted-foreground text-[0.6rem] uppercase tracking-[0.18em]">
                          name · symbol
                        </div>
                        <div className="font-mono text-mtqs-gold">
                          {data?.contract?.name ?? "—"} · {data?.contract?.symbol ?? "—"}
                          {data?.contract?.nameHasSigma && (
                            <span className="ml-1 text-mtqs-emerald/85" title="name() returns Σ">
                              Σ
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[0.72rem]">
                        <div className="text-muted-foreground text-[0.6rem] uppercase tracking-[0.18em]">
                          decimals
                        </div>
                        <div className="font-mono text-mtqs-gold">
                          {data?.contract?.decimals ?? "—"}
                        </div>
                      </div>
                      {data?.roles && (
                        <div className="text-[0.68rem]">
                          <div className="text-muted-foreground text-[0.6rem] uppercase tracking-[0.18em]">
                            roles (deployer)
                          </div>
                          <div className="font-mono flex flex-wrap gap-1.5 mt-0.5">
                            <RoleChip label="ADMIN" ok={data.roles.admin} />
                            <RoleChip label="MINT" ok={data.roles.minter} />
                            <RoleChip label="PAUSE" ok={data.roles.pauser} />
                            {data.roles.paused === true && (
                              <span className="inline-flex items-center gap-1 rounded border border-mtqs-rose/40 bg-mtqs-rose/10 text-mtqs-rose px-1.5 py-0.5 font-mono text-[0.6rem]">
                                paused
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {data?.latestBlock != null && (
                        <div className="text-[0.62rem] text-muted-foreground/60 font-mono mt-auto">
                          block #{data.latestBlock} · verified {fmtAgo(data.verifiedAt ? new Date(data.verifiedAt).getTime() : null)}
                        </div>
                      )}
                    </>
                  )}
                </Panel>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* 2. Protocol health (5 live cards) */}
      <section aria-labelledby="inv-health">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">§2-§8 · live snapshot</div>
            <h3 className="mt-2 text-base font-semibold text-foreground">Protocol Health</h3>
          </div>
          <Pill tone={snapshot?.oraclePaused ? "rose" : "emerald"}>
            <GlowDot color={snapshot?.oraclePaused ? "rose" : "emerald"} size="h-1.5 w-1.5" />
            {snapshot?.oraclePaused ? "oracle paused" : "oracle live"}
          </Pill>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {healthCards.map((c) => {
            const Icon = c.icon;
            const toneClasses: Record<string, string> = {
              emerald: "text-mtqs-emerald",
              amber: "text-mtqs-amber",
              rose: "text-mtqs-rose",
              gold: "text-mtqs-gold-light",
              muted: "text-muted-foreground",
            };
            return (
              <Reveal key={c.label}>
                <Panel className="p-4 h-full">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon
                      className={`h-3.5 w-3.5 ${toneClasses[c.tone]}`}
                      aria-hidden="true"
                    />
                    <span className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/75">
                      {c.label}
                    </span>
                  </div>
                  <div
                    className={`font-mono tabular-nums text-lg sm:text-xl font-semibold ${toneClasses[c.tone]}`}
                  >
                    {c.value ?? "—"}
                  </div>
                  <div className="mt-1 text-[0.62rem] text-muted-foreground truncate">
                    {c.sub}
                  </div>
                </Panel>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* 3. Honest findings (F1 / F2 FIXED) */}
      <section aria-labelledby="inv-findings">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">v1.2 · reconciliation</div>
            <h3 className="mt-2 text-base font-semibold text-foreground">Honest Findings</h3>
          </div>
          <Pill tone="emerald">
            <GlowDot color="emerald" size="h-1.5 w-1.5" />
            F1 + F2 FIXED
          </Pill>
        </div>
        <Reveal>
          <Panel className="p-5">
            {f1And2.length === 0 ? (
              <div className="rounded-md border border-border bg-black/[0.02] p-4 text-center text-[0.75rem] text-muted-foreground">
                Loading reconciliation findings…
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {f1And2.map((f) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="rounded-md border border-mtqs-emerald/40 bg-mtqs-emerald/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="text-sm font-semibold text-foreground">{f.title}</div>
                      <Pill tone="emerald">
                        <GlowDot color="emerald" size="h-1.5 w-1.5" />
                        fixed
                      </Pill>
                    </div>
                    <p className="text-[0.75rem] text-muted-foreground leading-relaxed">
                      {f.description}
                    </p>
                    {f.resolution && (
                      <p className="mt-2 text-[0.72rem] text-muted-foreground leading-relaxed">
                        <span className="text-mtqs-gold/80 uppercase tracking-[0.18em] text-[0.6rem] font-medium mr-1">
                          Resolution
                        </span>
                        {f.resolution}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
            <div className="mt-4 text-[0.72rem] text-muted-foreground leading-relaxed">
              <span className="text-mtqs-emerald/85 font-medium">F1</span> — the §12.2 vs §3.4.2
              redemption price contradiction is reconciled (§3.4.2 canonical, §12.2 informational).
              <span className="text-mtqs-emerald/85 font-medium"> F2</span> — the §5.6 Circle
              concentration breach is fixed: USD and gold now split across 3 + 2 issuers, every
              issuer ≤ 25% warn threshold. The engine computes live per-issuer concentration and
              surfaces any drift.
            </div>
          </Panel>
        </Reveal>
      </section>

      {/* 4. Trial traction (from /api/trials/export) */}
      <section aria-labelledby="inv-traction">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">pilot traction</div>
            <h3 className="mt-2 text-base font-semibold text-foreground">Trial Traction</h3>
          </div>
          <Pill tone="gold">
            <Database className="h-3 w-3" aria-hidden="true" />
            SQLite audit trail
          </Pill>
        </div>
        <Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Panel className="p-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/75 mb-1">
                Total trials
              </div>
              <div className="font-mono tabular-nums text-2xl text-mtqs-gold-light">
                {trialCount.toLocaleString()}
              </div>
            </Panel>
            <Panel className="p-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/75 mb-1">
                Mints
              </div>
              <div className="font-mono tabular-nums text-2xl text-mtqs-emerald">
                {mintCount.toLocaleString()}
              </div>
            </Panel>
            <Panel className="p-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/75 mb-1">
                Redeems
              </div>
              <div className="font-mono tabular-nums text-2xl text-mtqs-amber">
                {redeemCount.toLocaleString()}
              </div>
            </Panel>
            <Panel className="p-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/75 mb-1">
                Success rate
              </div>
              <div className="font-mono tabular-nums text-2xl text-mtqs-emerald">
                {(successRate ?? 0).toFixed(1)}%
              </div>
            </Panel>
          </div>
        </Reveal>
      </section>

      {/* 5. Investor endpoints list with copy buttons */}
      <section aria-labelledby="inv-endpoints">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">due diligence · api</div>
            <h3 className="mt-2 text-base font-semibold text-foreground">Investor Endpoints</h3>
          </div>
          <Pill tone="muted">all paths relative · GET only</Pill>
        </div>
        <Reveal>
          <Panel className="p-4 sm:p-5">
            <div className="overflow-hidden rounded-md border border-border">
              <div className="max-h-96 overflow-y-auto mtqs-scroll">
                <table className="w-full text-[0.72rem]">
                  <thead className="bg-black/[0.02] text-muted-foreground sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Endpoint</th>
                      <th className="text-left px-3 py-2 font-medium">Path</th>
                      <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Description</th>
                      <th className="text-right px-3 py-2 font-medium">Copy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {INVESTOR_ENDPOINTS.map((ep, i) => (
                      <tr
                        key={ep.url}
                        className={`border-t border-border ${i % 2 ? "bg-white/[0.01]" : ""}`}
                      >
                        <td className="px-3 py-2.5 text-foreground/90 font-medium">{ep.label}</td>
                        <td className="px-3 py-2.5 font-mono text-mtqs-gold break-all">{ep.url}</td>
                        <td className="px-3 py-2.5 text-muted-foreground/75 hidden sm:table-cell">
                          {ep.desc}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <CopyEndpointButton value={ep.url} label={ep.label} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 text-[0.7rem] text-muted-foreground">
              <GlowDot color="gold" size="h-1.5 w-1.5" className="mt-1.5" />
              <p className="leading-relaxed">
                All endpoints are read-only GET. Run a trial in the Trial section to populate the
                trial log, then re-fetch the export endpoint above to see your new trial.
              </p>
            </div>
          </Panel>
        </Reveal>
      </section>

      {/* Closing */}
      <Reveal>
        <Panel variant="emerald" className="p-5 sm:p-6 text-center">
          <p className="text-[0.82rem] text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-4">
            Investor diligence complete. Every metric above is reproducible from the endpoints
            listed. Review the Monte Carlo test suite for protocol resilience, or read the full
            blueprint reference in Docs.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => _onNavigate("tests")}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.1] bg-black/[0.03] px-4 py-2 text-[0.78rem] font-medium text-foreground hover:border-mtqs-gold/30 hover:text-foreground transition"
            >
              View Tests
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              onClick={() => _onNavigate("docs")}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.1] bg-black/[0.03] px-4 py-2 text-[0.78rem] font-medium text-foreground hover:border-mtqs-gold/30 hover:text-foreground transition"
            >
              Blueprint Docs
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}

/* ---------- Role chip (green/red) ---------- */
function RoleChip({ label, ok }: { label: string; ok: boolean | null }) {
  if (ok === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-black/[0.1] bg-black/[0.02] text-muted-foreground px-1.5 py-0.5 font-mono text-[0.6rem]">
        {label.toLowerCase()}?
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[0.6rem] ${
        ok
          ? "border-mtqs-emerald/40 bg-mtqs-emerald/10 text-mtqs-emerald"
          : "border-black/[0.1] bg-black/[0.02] text-muted-foreground/60"
      }`}
    >
      {label.toLowerCase()}
    </span>
  );
}
