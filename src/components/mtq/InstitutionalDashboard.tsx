// MTQΣ — Institutional Dashboard (UPSCALE-1)
// Comprehensive visual dashboard for banks + institutional users.
// Fetches all 14 blueprint-module API routes and renders them as tabbed
// sections A–N. Single 'use client' component; useEffect + useState fetching.
// Wired into src/app/page.tsx via the "investors" section route.
"use client";

import { useEffect, useRef, useState, type ReactNode, type ComponentType } from "react";
import { motion } from "framer-motion";
import {
  Building2, CheckCircle2, AlertTriangle, XCircle, Lock, Database,
  Layers, ShieldCheck, Scale, ScanLine, Workflow, Cloud, Cpu, AlertCircle,
  Landmark, Droplets, CircuitBoard, FileCheck,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Panel, Reveal, Pill, GlowDot, Skeleton, MiniBar } from "./primitives";

const fmtUsd = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};
const fmtPct = (n: number | null | undefined, d = 1): string =>
  n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(d)}%`;

function SectionHeader({ icon: Icon, eyebrow, title, right }: { icon: ComponentType<{ className?: string }>; eyebrow: string; title: ReactNode; right?: ReactNode; }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <Icon className="h-5 w-5 text-mtqs-gold/80 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">{eyebrow}</div>
        <h3 className="mt-1 text-base font-semibold text-white">{title}</h3>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
const PassPill = ({ ok, label }: { ok: boolean; label?: string }) => ok
  ? <Pill tone="emerald"><CheckCircle2 className="h-3 w-3" />{label ?? "PASS"}</Pill>
  : <Pill tone="amber"><AlertTriangle className="h-3 w-3" />{label ?? "BLOCKED"}</Pill>;

function StatBox({ label, value, tone = "default" }: { label: string; value: ReactNode; tone?: "default" | "gold" | "rose" | "emerald" | "amber" }) {
  const cls = tone === "gold" ? "text-mtqs-gold" : tone === "rose" ? "text-mtqs-rose" : tone === "emerald" ? "text-mtqs-emerald" : tone === "amber" ? "text-mtqs-amber" : "text-white";
  return (
    <div className="rounded-md border border-white/[0.06] p-3">
      <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">{label}</div>
      <div className={`font-mono text-lg mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-mtqs-rose/30 bg-mtqs-rose/5 p-4 flex items-start gap-2.5">
      <AlertCircle className="h-4 w-4 text-mtqs-rose shrink-0 mt-0.5" aria-hidden="true" />
      <div className="text-[0.75rem] text-white/75 leading-relaxed"><span className="text-mtqs-rose font-medium">Failed to load: </span>{message}</div>
    </div>
  );
}
const LoadingRows = () => (
  <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
);
function ScrollList({ rows }: { rows: ReactNode[] }) {
  return (
    <div className="max-h-72 overflow-y-auto mtqs-scroll rounded-md border border-white/[0.06]">
      {rows.map((r, i) => <div key={i} className={`px-3 py-2 ${i % 2 ? "bg-white/[0.01]" : ""} border-t border-white/[0.06] first:border-t-0`}>{r}</div>)}
    </div>
  );
}

function useJson<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(url, { cache: "no-store" })
      .then(async (r) => { if (!r.ok) throw new Error(`${r.status}`); return (await r.json()) as T; })
      .then((j) => { if (mounted.current) { setData(j); setError(null); } })
      .catch((e) => { if (mounted.current) setError(String(e?.message ?? e)); })
      .finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, [url]);
  return { data, loading, error };
}

function SectionA() {
  const { data, loading, error } = useJson<{ report: {
    acceptanceCriteriaSummary: { met: number; total: number; acceptanceRate: number };
    institutionalGatesSummary: { passed: number; total: number };
    institutionalGates: Array<{ id: string; gate: string; status: string; evidence: string }>;
    finalStatus: string;
  } }>("/api/implementation-status");
  if (loading) return <LoadingRows />; if (error || !data) return <ErrorPanel message={error ?? "no data"} />;
  const r = data.report, ac = r.acceptanceCriteriaSummary, gs = r.institutionalGatesSummary;
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <SectionHeader icon={CheckCircle2} eyebrow="§87 · acceptance + gates" title="Implementation Status"
          right={<Pill tone="amber"><AlertTriangle className="h-3 w-3" />NOT PROD-AUTHORIZED</Pill>} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[0.7rem] uppercase tracking-[0.18em] text-white/55">Acceptance criteria</span>
              <span className="font-mono text-sm text-white">{ac.met}/{ac.total} ({fmtPct(ac.acceptanceRate, 0)})</span>
            </div>
            <MiniBar value={ac.met} max={ac.total} colorClass="bg-mtqs-gold" />
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[0.7rem] uppercase tracking-[0.18em] text-white/55">Institutional gates</span>
              <span className="font-mono text-sm text-white">{gs.passed}/{gs.total} ({fmtPct(gs.passed / gs.total, 0)})</span>
            </div>
            <MiniBar value={gs.passed} max={gs.total} colorClass="bg-mtqs-rose" />
          </div>
        </div>
        <p className="mt-3 text-[0.72rem] text-white/55 leading-relaxed">{r.finalStatus}</p>
      </Panel>
      <Panel className="p-5">
        <div className="mb-2 flex items-center gap-2"><GlowDot color="gold" size="h-2 w-2" /><h4 className="text-sm font-semibold text-white/90">All {r.institutionalGates.length} gates (0 passed)</h4></div>
        <ScrollList rows={r.institutionalGates.map((g) => (
          <div key={g.id} className="grid grid-cols-[auto_minmax(0,2fr)_minmax(0,3fr)] gap-2 items-center">
            <span className="font-mono text-[0.65rem] text-mtqs-gold/75">{g.id}</span>
            <div><div className="text-[0.78rem] font-medium text-white leading-snug">{g.gate}</div><div className="text-[0.68rem] text-white/55">{g.evidence}</div></div>
            <span className="justify-self-end"><Pill tone="muted"><Lock className="h-3 w-3" />{g.status}</Pill></span>
          </div>
        ))} />
      </Panel>
    </div>
  );
}

function SectionB() {
  const { data, loading, error } = useJson<{
    status: string; implementedMask: number; authorizedMask: number; version: string;
    validationGates: Array<{ id: string; name: string; description: string; passed: boolean; evidence: string }>;
    gateSummary: { passed: number; total: number };
  }>("/api/honest-status");
  if (loading) return <LoadingRows />; if (error || !data) return <ErrorPanel message={error ?? "no data"} />;
  const { passed, total } = data.gateSummary;
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <SectionHeader icon={Scale} eyebrow="§0.11 · 11 validation gates" title="Honest Status"
          right={<Pill tone="rose"><XCircle className="h-3 w-3" />{data.status}</Pill>} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="implementedMask" tone="gold" value={`0x${data.implementedMask.toString(16).toUpperCase().padStart(3, "0")}`} />
          <StatBox label="authorizedMask" tone="rose" value={`0x${data.authorizedMask.toString(16).toUpperCase().padStart(3, "0")}`} />
          <StatBox label="gates passed" value={`${passed}/${total}`} />
          <StatBox label="version" tone="emerald" value={data.version} />
        </div>
      </Panel>
      <Panel className="p-5">
        <div className="mb-2 flex items-center gap-2"><GlowDot color="amber" size="h-2 w-2" /><h4 className="text-sm font-semibold text-white/90">All 11 §25.5 validation gates</h4></div>
        <ScrollList rows={data.validationGates.map((g) => (
          <div key={g.id} className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2"><span className="font-mono text-[0.65rem] text-mtqs-gold/75">{g.id}</span>
                <span className="text-[0.8rem] font-medium text-white">{g.name}</span></div>
              <p className="text-[0.7rem] text-white/55 leading-relaxed mt-0.5">{g.description}</p>
              <p className="text-[0.68rem] text-white/55 mt-0.5"><span className="text-mtqs-gold/70">evidence: </span>{g.evidence}</p>
            </div>
            <PassPill ok={g.passed} label={g.passed ? "PASS" : "FAIL"} />
          </div>
        ))} />
      </Panel>
    </div>
  );
}

function SectionC() {
  const { data, loading, error } = useJson<{ report: {
    antiComminglingTests: Array<{ id: string; description: string; reason: string }>;
    antiComminglingResults: Array<{ test: { id: string }; blocked: boolean }>;
    honestState: { threeBookOperational: boolean };
    finalStatus: string;
  } }>("/api/three-book");
  if (loading) return <LoadingRows />; if (error || !data) return <ErrorPanel message={error ?? "no data"} />;
  const r = data.report;
  const books = [
    { k: "Book A", d: "MITHQAL Corporate — operating cash, payroll, infra (8 fields)." },
    { k: "Book B", d: "Bank MTQ Obligation — applicable backing, outstanding, redemption (8 fields)." },
    { k: "Book C", d: "Corporate Participant Position — balances, available, settlement history (9 fields)." },
  ];
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <SectionHeader icon={Layers} eyebrow="§51 · non-commingling" title="Three-Book Separation"
          right={<Pill tone={r.honestState.threeBookOperational ? "emerald" : "amber"}><Lock className="h-3 w-3" />{r.honestState.threeBookOperational ? "OPERATIONAL" : "NOT OPERATIONAL"}</Pill>} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {books.map((b) => (
            <div key={b.k} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3"><div className="font-mono text-mtqs-gold text-sm">{b.k}</div><p className="text-[0.72rem] text-white/55 leading-relaxed mt-1">{b.d}</p></div>
          ))}
        </div>
      </Panel>
      <Panel className="p-5">
        <div className="mb-2 flex items-center gap-2"><GlowDot color="rose" size="h-2 w-2" /><h4 className="text-sm font-semibold text-white/90">{r.antiComminglingResults.length} anti-commingling tests ({r.antiComminglingResults.filter((x) => x.blocked).length}/{r.antiComminglingResults.length} BLOCKED)</h4></div>
        <div className="space-y-2">
          {r.antiComminglingTests.map((t, i) => {
            const res = r.antiComminglingResults[i];
            return (
              <div key={t.id} className="rounded-md border border-mtqs-emerald/25 bg-mtqs-emerald/[0.04] p-3">
                <div className="flex items-start justify-between gap-2 mb-1"><span className="font-mono text-[0.65rem] text-mtqs-emerald/80">{t.id}</span><PassPill ok={!!res?.blocked} label="BLOCKED" /></div>
                <p className="text-[0.74rem] text-white leading-snug">{t.description}</p>
                <p className="text-[0.68rem] text-white/55 mt-1 leading-relaxed">{t.reason}</p>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function SectionD() {
  const { data, loading, error } = useJson<{
    report: { cellCount: number; totals: { availableBacking: number }; maxMtqIssuanceUsd: number };
    referenceCells: Array<{ backingId: string; institutionId: string; assetClass: string; amount: number }>;
    honestState: { protectedBackingLiveCells: number };
  }>("/api/protected-backing");
  if (loading) return <LoadingRows />; if (error || !data) return <ErrorPanel message={error ?? "no data"} />;
  const r = data.report;
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <SectionHeader icon={ShieldCheck} eyebrow="§47 · AvailableBacking formula" title="Protected Backing Cells"
          right={<Pill tone="rose"><XCircle className="h-3 w-3" />0 LIVE CELLS</Pill>} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="reference cells" value={`${r.cellCount} (SIM)`} />
          <StatBox label="live cells" tone="rose" value={data.honestState.protectedBackingLiveCells} />
          <StatBox label="available backing" tone="gold" value={fmtUsd(r.totals.availableBacking)} />
          <StatBox label="max MTQ issuance" tone="emerald" value={fmtUsd(r.maxMtqIssuanceUsd)} />
        </div>
      </Panel>
      <Panel className="p-5">
        <div className="mb-2 flex items-center gap-2"><GlowDot color="gold" size="h-2 w-2" /><h4 className="text-sm font-semibold text-white/90">4 SIMULATED reference cells</h4></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {data.referenceCells.map((c) => (
            <div key={c.backingId} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3"><div className="flex items-center justify-between"><span className="font-mono text-[0.7rem] text-mtqs-gold/85">{c.backingId}</span><Pill tone="amber">SIMULATED</Pill></div><div className="text-[0.7rem] text-white/55 mt-1">{c.institutionId} · {c.assetClass}</div><div className="font-mono text-sm text-white mt-1">{fmtUsd(c.amount)}</div></div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function SectionE() {
  const { data, loading, error } = useJson<{ report: {
    dimensions: string[];
    referenceSnapshot: { totalExposure: number; constraintsMet: boolean; violations: unknown[]; concentrationScore: number };
  } }>("/api/systemic-risk");
  if (loading) return <LoadingRows />; if (error || !data) return <ErrorPanel message={error ?? "no data"} />;
  const r = data.report, s = r.referenceSnapshot;
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <SectionHeader icon={ShieldCheck} eyebrow="§52 · 13 dimensions" title="Systemic Risk Exposure"
          right={<Pill tone={s.constraintsMet ? "emerald" : "rose"}>{s.constraintsMet ? "WITHIN LIMITS" : "VIOLATIONS"}</Pill>} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="dimensions" value={r.dimensions.length} />
          <StatBox label="total exposure" tone="gold" value={fmtUsd(s.totalExposure)} />
          <StatBox label="violations" tone="rose" value={s.violations.length} />
          <StatBox label="HHI score" tone="amber" value={s.concentrationScore.toFixed(4)} />
        </div>
      </Panel>
      <Panel className="p-5">
        <div className="mb-2 flex items-center gap-2"><GlowDot color="rose" size="h-2 w-2" /><h4 className="text-sm font-semibold text-white/90">13 dimensions · preferred vs hard limits</h4></div>
        <ScrollList rows={r.dimensions.map((d, i) => (
          <div key={d} className="flex items-center justify-between">
            <span className="font-mono text-[0.72rem] text-white/85">{d}</span>
            <span className="font-mono text-[0.65rem] text-white/55">#{i + 1}</span>
          </div>
        ))} />
      </Panel>
    </div>
  );
}

function SectionF() {
  const legal = useJson<{ report: { jurisdictions: Array<{ code: string; name: string; classification: string }> } }>("/api/legal-registry");
  const lic = useJson<{ report: { activities: unknown[]; entries: Array<{ status: string }> } }>("/api/licensing-matrix");
  if (legal.loading || lic.loading) return <LoadingRows />; if (legal.error || lic.error || !legal.data || !lic.data) return <ErrorPanel message={legal.error ?? lic.error ?? "no data"} />;
  const jurs = legal.data.report.jurisdictions;
  const entries = lic.data.report.entries;
  const notObtained = entries.filter((e) => e.status === "REQUIRED_NOT_OBTAINED").length;
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <SectionHeader icon={Scale} eyebrow="§49/§50 · legal + licensing" title="Legal & Licensing Matrix"
          right={<Pill tone="rose"><XCircle className="h-3 w-3" />0 LICENSES</Pill>} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="jurisdictions" value={`${jurs.length} (PENDING)`} />
          <StatBox label="activities" value={lic.data.report.activities.length} />
          <StatBox label="licensing entries" tone="gold" value={entries.length} />
          <StatBox label="required, not obtained" tone="rose" value={notObtained} />
        </div>
      </Panel>
      <Panel className="p-5">
        <div className="mb-2 flex items-center gap-2"><GlowDot color="amber" size="h-2 w-2" /><h4 className="text-sm font-semibold text-white/90">8 jurisdictions (ALL PENDING)</h4></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {jurs.map((j) => (
            <div key={j.code} className="rounded-md border border-mtqs-amber/25 bg-mtqs-amber/[0.04] p-3"><div className="font-mono text-mtqs-gold text-sm">{j.code}</div><div className="text-[0.7rem] text-white/85 leading-snug mt-0.5">{j.name}</div><Pill tone="amber"><Lock className="h-3 w-3" />{j.classification}</Pill></div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function SectionG() {
  const { data, loading, error } = useJson<{ report: {
    patternsScanned: number; unresolvedContradictions: number;
    // Live /api/contradiction-scan shape: status ∈ {CLEAN, …} and the pattern
    // label field is `pattern` (not `name`) — reading the old fields threw a
    // TypeError that killed this tab (fixed 2026-10-24).
    perPatternResults: Array<{ pattern: { id: string; pattern: string; description: string }; status: string }>;
    finalStatus: string;
  } }>("/api/contradiction-scan");
  if (loading) return <LoadingRows />; if (error || !data) return <ErrorPanel message={error ?? "no data"} />;
  const r = data.report;
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <SectionHeader icon={ScanLine} eyebrow="§77 · static code scan" title="Contradiction Scan"
          right={<Pill tone={r.unresolvedContradictions === 0 ? "emerald" : "rose"}><CheckCircle2 className="h-3 w-3" />{r.unresolvedContradictions} UNRESOLVED</Pill>} />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatBox label="patterns scanned" value={r.patternsScanned} />
          <StatBox label="unresolved" tone="emerald" value={r.unresolvedContradictions} />
          <StatBox label="scan type" tone="gold" value="static" />
        </div>
        <p className="mt-3 text-[0.72rem] text-white/55 leading-relaxed">{r.finalStatus}</p>
      </Panel>
      <Panel className="p-5">
        <div className="mb-2 flex items-center gap-2"><GlowDot color={r.unresolvedContradictions === 0 ? "emerald" : "rose"} size="h-2 w-2" /><h4 className="text-sm font-semibold text-white/90">{r.patternsScanned} contradiction patterns ({r.unresolvedContradictions === 0 ? "all resolved" : `${r.unresolvedContradictions} unresolved`})</h4></div>
        <ScrollList rows={r.perPatternResults.map((p) => (
          <div key={p.pattern.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[0.65rem] text-mtqs-gold/75">{p.pattern.id}</span>
              <PassPill ok={p.status === "CLEAN"} label={p.status} />
            </div>
            <div className="text-[0.78rem] font-medium text-white mt-0.5">{p.pattern.pattern}</div>
            <p className="text-[0.68rem] text-white/55 mt-0.5 leading-relaxed">{p.pattern.description}</p>
          </div>
        ))} />
      </Panel>
    </div>
  );
}

function SectionH() {
  const { data, loading, error } = useJson<{ report: {
    principle: string; lifecycleStates: string[];
    resolutionWaterfall: Array<{ step: string; action: string }>;
    finalStatus: string;
  } }>("/api/bank-default");
  if (loading) return <LoadingRows />; if (error || !data) return <ErrorPanel message={error ?? "no data"} />;
  const r = data.report;
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <SectionHeader icon={Workflow} eyebrow="§48 · 8-state lifecycle" title="Bank Default Resolution"
          right={<Pill tone="amber"><Lock className="h-3 w-3" />NOT CONTRACTED</Pill>} />
        <div className="rounded-md border border-mtqs-gold/25 bg-mtqs-gold/[0.04] p-3 mb-3">
          <div className="text-[0.6rem] uppercase tracking-[0.18em] text-mtqs-gold/80 mb-1">Invariant #3 — MITHQAL is NOT guarantor</div>
          <p className="text-[0.78rem] text-white leading-snug">{r.principle}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {r.lifecycleStates.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 font-mono text-[0.7rem] text-white/85"><span className="text-mtqs-gold/75 mr-1">{i + 1}.</span>{s}</span>
              {i < r.lifecycleStates.length - 1 && <span className="text-white/30 text-xs">→</span>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[0.72rem] text-white/55 leading-relaxed">{r.finalStatus}</p>
      </Panel>
      <Panel className="p-5">
        <div className="mb-2 flex items-center gap-2"><GlowDot color="gold" size="h-2 w-2" /><h4 className="text-sm font-semibold text-white/90">Resolution waterfall ({r.resolutionWaterfall.length} steps)</h4></div>
        <ScrollList rows={r.resolutionWaterfall.map((w, i) => (
          <div key={i}>
            <div className="font-mono text-[0.65rem] text-mtqs-gold/75">{w.step}</div>
            <div className="text-[0.78rem] text-white leading-snug mt-0.5">{w.action}</div>
          </div>
        ))} />
      </Panel>
    </div>
  );
}

function SectionI() {
  const { data, loading, error } = useJson<{
    connections: {
      turso: { configured: boolean }; neon: { configured: boolean };
      inngest: { configured: boolean }; vercel: { deployed: boolean };
    };
    inngestFunctions: Array<{ id: string; schedule: string; status: string }>;
  }>("/api/sync");
  if (loading) return <LoadingRows />; if (error || !data) return <ErrorPanel message={error ?? "no data"} />;
  const c = data.connections;
  // Derive the header pill + tones from the LIVE configured flags (no green-wash:
  // ✗ boxes render amber, and "ALL CONNECTED" is only claimed when all 4 are true).
  const configuredCount = [c.turso.configured, c.neon.configured, c.inngest.configured, c.vercel.deployed].filter(Boolean).length;
  const allConnected = configuredCount === 4;
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <SectionHeader icon={Cloud} eyebrow="hybrid · Turso + Neon + Inngest + Vercel" title="Hybrid Architecture"
          right={allConnected
            ? <Pill tone="emerald"><CheckCircle2 className="h-3 w-3" />ALL CONNECTED</Pill>
            : <Pill tone="amber"><AlertTriangle className="h-3 w-3" />{configuredCount}/4 CONFIGURED · DEGRADED</Pill>} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="Turso (edge)" tone={c.turso.configured ? "emerald" : "amber"} value={c.turso.configured ? "✓" : "✗"} />
          <StatBox label="Neon (analytics)" tone={c.neon.configured ? "emerald" : "amber"} value={c.neon.configured ? "✓" : "✗"} />
          <StatBox label="Inngest (jobs)" tone={c.inngest.configured ? "emerald" : "amber"} value={c.inngest.configured ? "✓" : "✗"} />
          <StatBox label="Vercel (frontend)" tone={c.vercel.deployed ? "emerald" : "amber"} value={c.vercel.deployed ? "✓" : "✗"} />
        </div>
        {!c.inngest.configured && (
          <p className="mt-3 text-[0.68rem] text-mtqs-amber/80 leading-relaxed">
            Turso / Neon / Inngest are not configured in this environment — the scheduled functions
            below are the designed jobs, not currently executing orchestrations.
          </p>
        )}
      </Panel>
      <Panel className="p-5">
        <div className="mb-2 flex items-center gap-2"><GlowDot color="emerald" size="h-2 w-2" /><h4 className="text-sm font-semibold text-white/90">{data.inngestFunctions.length} Inngest scheduled functions</h4></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {data.inngestFunctions.map((f) => (
            <div key={f.id} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3 flex items-center justify-between">
              <div><div className="font-mono text-[0.72rem] text-mtqs-gold/85">{f.id}</div><div className="text-[0.65rem] text-white/55 mt-0.5">schedule: <span className="font-mono text-white/75">{f.schedule}</span></div></div>
              <Pill tone="emerald"><CheckCircle2 className="h-3 w-3" />{f.status}</Pill>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function SectionJ() {
  const { data, loading, error } = useJson<{
    fallbackChain: Array<{ priority: number; provider: string; model: string; configured: boolean }>;
    totalConfigured: number; totalProviders: number;
  }>("/api/ai/status");
  if (loading) return <LoadingRows />; if (error || !data) return <ErrorPanel message={error ?? "no data"} />;
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <SectionHeader icon={Cpu} eyebrow="5-provider fallback chain" title="AI Provider Status"
          right={data.totalConfigured >= data.totalProviders
            ? <Pill tone="emerald"><CheckCircle2 className="h-3 w-3" />{data.totalConfigured}/{data.totalProviders} CONFIGURED</Pill>
            : <Pill tone="amber"><AlertTriangle className="h-3 w-3" />{data.totalConfigured}/{data.totalProviders} CONFIGURED · RULES FALLBACK</Pill>} />
        <div className="space-y-2">
          {data.fallbackChain.map((p) => (
            <div key={p.priority} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3 flex items-center justify-between"><div className="flex items-center gap-3"><span className="font-mono text-[0.65rem] text-mtqs-gold/75">#{p.priority}</span><div><div className="font-mono text-[0.78rem] text-white">{p.provider}</div><div className="text-[0.65rem] text-white/55 mt-0.5 font-mono">{p.model}</div></div></div><PassPill ok={p.configured} label={p.configured ? "READY" : "NO KEY"} /></div>
          ))}
        </div>
      </Panel>
      <Panel className="p-5">
        <div className="mb-2 flex items-center gap-2"><GlowDot color="gold" size="h-2 w-2" /><h4 className="text-sm font-semibold text-white/90">Fallback behavior</h4></div>
        <p className="text-[0.72rem] text-white/55 leading-relaxed">
          When a provider fails (geo-block, rate limit, network error, model deprecated), the system automatically tries
          the next provider in the chain. If all {data.totalProviders} providers fail, deterministic fallback-rules are used.
          No single AI provider is a hard dependency — the protocol&apos;s monetary logic continues regardless of AI availability.
        </p>
      </Panel>
    </div>
  );
}

function SectionK() {
  // Proof of Reserve — fetches /api/por
  const { data, loading, error } = useJson<{
    protocol: string; module: string; version: string;
    status: string; summary: string;
    reserveRatio: number | null; liabilityUsd: number; sufficient: boolean;
    attestation: {
      attestationId: string; bank: string; totalBackingUsd: number;
      composition: { fiat: number; gold: number; digital: number };
      custodian: string; custodianAddress: string;
      timestamp: number; expiry: number; verified: boolean; hasSignature: boolean;
    };
    targets: {
      rrHardFloor: number; rrProductionTarget: number;
      fiatTarget: number; goldTarget: number; digitalTarget: number;
    };
    computedAt: string; pilot: boolean; disclaimer: string;
  }>("/api/por");
  if (loading) return <LoadingRows />; if (error || !data) return <ErrorPanel message={error ?? "no data"} />;
  const att = data.attestation;
  const tgt = data.targets;
  const comps = [
    { k: "Fiat", v: att.composition.fiat, t: tgt.fiatTarget, c: "bg-mtqs-gold" },
    { k: "Gold", v: att.composition.gold, t: tgt.goldTarget, c: "bg-mtqs-amber" },
    { k: "Digital", v: att.composition.digital, t: tgt.digitalTarget, c: "bg-mtqs-emerald" },
  ];
  const rrStr = data.reserveRatio == null ? "n/a" : data.reserveRatio.toFixed(4);
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <SectionHeader icon={FileCheck} eyebrow="§47.1 · PoR — pilot fallback (Chainlink feed not wired)" title="Proof of Reserve"
          right={<Pill tone={att.verified ? "emerald" : "rose"}>{att.verified ? "VERIFIED" : "UNVERIFIED"}</Pill>} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="status" tone={att.verified ? "emerald" : "rose"} value={data.status} />
          <StatBox label="reserve ratio" tone="gold" value={rrStr} />
          <StatBox label="liability" value={fmtUsd(data.liabilityUsd)} />
          <StatBox label="total backing" tone="gold" value={fmtUsd(att.totalBackingUsd)} />
        </div>
        <p className="mt-3 text-[0.72rem] text-white/55 leading-relaxed">{data.summary}</p>
      </Panel>
      <Panel className="p-5">
        <div className="mb-2 flex items-center gap-2"><GlowDot color="gold" size="h-2 w-2" /><h4 className="text-sm font-semibold text-white/90">Reserve composition vs targets</h4></div>
        <div className="space-y-3">
          {comps.map((c) => (
            <div key={c.k}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[0.7rem] uppercase tracking-[0.18em] text-white/55">{c.k}</span>
                <span className="font-mono text-xs text-white">{(c.v * 100).toFixed(1)}% <span className="text-white/45">/ target {(c.t * 100).toFixed(1)}%</span></span>
              </div>
              <MiniBar value={c.v * 100} max={100} colorClass={c.c} />
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="p-5">
        <div className="mb-2 flex items-center gap-2"><GlowDot color="emerald" size="h-2 w-2" /><h4 className="text-sm font-semibold text-white/90">Attestation + targets</h4></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55 mb-1">Attestation</div>
            <div className="font-mono text-[0.7rem] text-mtqs-gold/85 break-all">{att.attestationId}</div>
            <div className="text-[0.7rem] text-white/75 mt-1.5">Custodian: <span className="text-white">{att.custodian}</span></div>
            <div className="font-mono text-[0.65rem] text-white/55 mt-0.5 break-all">{att.custodianAddress}</div>
            <div className="text-[0.65rem] text-white/55 mt-1">Signature: {att.hasSignature ? "present" : "missing"} · Expires: {new Date(att.expiry * 1000).toISOString().slice(0, 19)}Z</div>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55 mb-1">Targets</div>
            <div className="grid grid-cols-2 gap-y-1.5 text-[0.7rem] mt-1">
              <span className="text-white/55">RR hard floor</span><span className="font-mono text-white justify-self-end">{tgt.rrHardFloor.toFixed(2)}</span>
              <span className="text-white/55">RR prod target</span><span className="font-mono text-mtqs-gold justify-self-end">{tgt.rrProductionTarget.toFixed(2)}</span>
              <span className="text-white/55">Fiat target</span><span className="font-mono text-white justify-self-end">{(tgt.fiatTarget * 100).toFixed(0)}%</span>
              <span className="text-white/55">Gold target</span><span className="font-mono text-white justify-self-end">{(tgt.goldTarget * 100).toFixed(0)}%</span>
              <span className="text-white/55">Digital target</span><span className="font-mono text-white justify-self-end">{(tgt.digitalTarget * 100).toFixed(0)}%</span>
            </div>
            {/* 16f-012: the 1.30 / 80-18-2 figures come from the candidate
                v25.3 final-reserve spec (CANDIDATE_MODEL_VALIDATION_PENDING) —
                label them so they cannot be read as the platform-wide 110%
                §4.2 legacy pilot target. */}
            <div className="mt-2 text-[0.6rem] leading-relaxed text-white/45">
              Candidate-spec v25.3 targets — proposed, unapproved (validation pending); the legacy
              pilot RR target shown elsewhere is 110% (§4.2).
            </div>
          </div>
        </div>
        <p className="mt-3 text-[0.65rem] text-white/45 leading-relaxed">{data.disclaimer}</p>
      </Panel>
    </div>
  );
}

function SectionL() {
  // Stability Pool — fetches /api/stability-pool
  const { data, loading, error } = useJson<{
    source: string; fetchedAt: string;
    pool: { totalDepositsUsd: number; totalUsedUsd: number; availableUsd: number; rewardRate: string };
    health: { liabilityUsd: number; navUsd: number; currentDeficitUsd: number; coveragePct: string; canCoverEmergency: boolean };
    status: string; note: string;
  }>("/api/stability-pool");
  if (loading) return <LoadingRows />; if (error || !data) return <ErrorPanel message={error ?? "no data"} />;
  const p = data.pool, h = data.health;
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <SectionHeader icon={Droplets} eyebrow="§11.5 · Emergency recovery" title="Stability Pool"
          right={<Pill tone={h.canCoverEmergency ? "emerald" : "rose"}>{h.canCoverEmergency ? "CAN COVER" : "INSUFFICIENT"}</Pill>} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="total deposits" tone="gold" value={fmtUsd(p.totalDepositsUsd)} />
          <StatBox label="available" tone="emerald" value={fmtUsd(p.availableUsd)} />
          <StatBox label="used" tone="rose" value={fmtUsd(p.totalUsedUsd)} />
          <StatBox label="coverage %" tone="amber" value={`${h.coveragePct}%`} />
        </div>
      </Panel>
      <Panel className="p-5">
        <div className="mb-2 flex items-center gap-2"><GlowDot color="amber" size="h-2 w-2" /><h4 className="text-sm font-semibold text-white/90">Pool health vs protocol liability</h4></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">Liability</div>
            <div className="font-mono text-base text-white mt-1">{fmtUsd(h.liabilityUsd)}</div>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">NAV</div>
            <div className="font-mono text-base text-mtqs-gold mt-1">{fmtUsd(h.navUsd)}</div>
          </div>
          <div className="rounded-md border border-mtqs-rose/30 bg-mtqs-rose/[0.04] p-3">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-mtqs-rose/80">Current deficit</div>
            <div className="font-mono text-base text-mtqs-rose mt-1">{fmtUsd(h.currentDeficitUsd)}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">Reward rate</div>
            <div className="font-mono text-xs text-white mt-1">{p.rewardRate}</div>
          </div>
          <Pill tone={data.status === "NORMAL" ? "emerald" : "rose"}>status: {data.status}</Pill>
        </div>
        <p className="mt-3 text-[0.7rem] text-white/55 leading-relaxed">{data.note}</p>
      </Panel>
    </div>
  );
}

function SectionM() {
  // Bank Registry — fetches /api/banks
  const { data, loading, error } = useJson<{
    source: string; fetchedAt: string;
    totalBanks: number; authorizedBanks: number;
    banks: Array<{
      address: string; name: string; jurisdiction: string; isAuthorized: boolean;
      dailyMintCapUsd: number; dailyMintUsedUsd: number; dailyMintRemainingUsd: number;
      authorizedAt: string;
    }>;
    note: string;
  }>("/api/banks");
  if (loading) return <LoadingRows />; if (error || !data) return <ErrorPanel message={error ?? "no data"} />;
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <SectionHeader icon={Landmark} eyebrow="§3.3 · permissioned wholesale" title="Bank Registry"
          right={<Pill tone="amber"><AlertCircle className="h-3 w-3" />{data.authorizedBanks}/{data.totalBanks} SPECIFIED — NOT OPERATIONAL</Pill>} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="total banks" value={data.totalBanks} />
          <StatBox label="registry entries" tone="gold" value={data.banks.length} />
          <StatBox label="access model" tone="gold" value="permissioned" />
          <StatBox label="kyc owner" value="bank" />
        </div>
        {/* 16f-006: the registry rows are hardcoded pilot placeholders (a
            published dev key); no council is constituted (OD-3 open), so no
            on-chain authorization exists anywhere. */}
        <div className="mt-3 rounded-md border border-mtqs-amber/25 bg-amber-400/[0.04] px-3 py-2 text-[0.68rem] leading-relaxed text-white/60">
          <span className="font-semibold text-mtqs-amber">Registry entries — authorization not yet granted.</span>{" "}
          These rows are hardcoded pilot placeholders (a published dev-key address); OD-3 is open — no
          council is constituted, so no bank authorization exists on-chain. The API note below carries
          the same disclosure.
        </div>
      </Panel>
      <Panel className="p-5">
        <div className="mb-2 flex items-center gap-2"><GlowDot color="gold" size="h-2 w-2" /><h4 className="text-sm font-semibold text-white/90">Registry entries ({data.banks.length})</h4></div>
        {data.banks.length === 0 ? (
          <div className="rounded-md border border-mtqs-rose/30 bg-mtqs-rose/5 p-4 text-[0.75rem] text-white/75">
            <AlertCircle className="h-4 w-4 text-mtqs-rose inline mr-2" />No authorized banks. The 7/7 Constitutional Council must authorize banks on-chain via MTQSigmaV3.authorizeBank(...).
          </div>
        ) : (
          <ScrollList rows={data.banks.map((b) => (
            <div key={b.address} className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_auto_auto_auto] gap-2 sm:gap-3 items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[0.8rem] font-medium text-white">{b.name}</span>
                  <Pill tone="muted">{b.jurisdiction}</Pill>
                </div>
                <div className="font-mono text-[0.65rem] text-mtqs-gold/70 mt-0.5 break-all">{b.address}</div>
                {/* 16f-006: authorizedAt is boot-time from the hardcoded registry —
                    never render it as an on-chain authorization fact. */}
                <div className="text-[0.6rem] text-white/45 mt-0.5">placeholder entry · no council authorization (OD-3 open)</div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">cap</div>
                <div className="font-mono text-xs text-white">{fmtUsd(b.dailyMintCapUsd)}</div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">used</div>
                <div className="font-mono text-xs text-mtqs-rose">{fmtUsd(b.dailyMintUsedUsd)}</div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">remaining</div>
                <div className="font-mono text-xs text-mtqs-emerald">{fmtUsd(b.dailyMintRemainingUsd)}</div>
              </div>
            </div>
          ))} />
        )}
        <p className="mt-3 text-[0.7rem] text-white/55 leading-relaxed">{data.note}</p>
      </Panel>
    </div>
  );
}

function SectionN() {
  // V3 Architecture — fetches /api/v3
  const { data, loading, error } = useJson<{
    source: string; fetchedAt: string;
    contract: { name: string; version: string; deployed: boolean; address: string | null; chain: string };
    architecture: {
      type: string; mintFlow: string; finality: string; custody: string; kyc: string;
      reserveRatioTarget: string; reserveComposition: string; settlementInstrument: string;
    };
    features: {
      permissionedMint: boolean; bankRegistry: boolean; availableBackingCertificate: boolean;
      workflowStateMachine: boolean; sevenLayerFinality: boolean;
      oracleAdapters: { chainlink: string; pyth: string; chronicle: string };
      stabilityPool: boolean; feeSeparation: boolean; circuitBreaker: boolean;
      slippageProtection: boolean; perTxCap: string; dailyRedeemCap: string;
      proofOfReserve: string; mbgGateway: string;
    };
    honestStatus: {
      status: string; isProductionAuthorized: boolean;
      implementedMask: string; authorizedMask: string; version: string;
      validationGatesPassed: number; validationGatesTotal: number;
    };
    validationGates: Array<{ id: string; name: string; passed: boolean; evidence: string }>;
    note: string;
  }>("/api/v3");
  if (loading) return <LoadingRows />; if (error || !data) return <ErrorPanel message={error ?? "no data"} />;
  const c = data.contract, a = data.architecture, f = data.features, hs = data.honestStatus;
  const featList = [
    { k: "permissionedMint", v: f.permissionedMint },
    { k: "bankRegistry", v: f.bankRegistry },
    { k: "availableBackingCertificate", v: f.availableBackingCertificate },
    { k: "workflowStateMachine", v: f.workflowStateMachine },
    { k: "sevenLayerFinality", v: f.sevenLayerFinality },
    { k: "stabilityPool", v: f.stabilityPool },
    { k: "feeSeparation", v: f.feeSeparation },
    { k: "circuitBreaker", v: f.circuitBreaker },
    { k: "slippageProtection", v: f.slippageProtection },
  ];
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <SectionHeader icon={CircuitBoard} eyebrow="Blueprint v25.3 · production-aligned" title="V3 Architecture"
          right={<Pill tone={c.deployed ? "emerald" : "amber"}><Lock className="h-3 w-3" />{c.deployed ? "DEPLOYED" : "NOT DEPLOYED"}</Pill>} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="contract" tone="gold" value={c.name} />
          <StatBox label="version" tone="emerald" value={c.version} />
          <StatBox label="gates passed" value={`${hs.validationGatesPassed}/${hs.validationGatesTotal}`} />
          <StatBox label="prod-authorized" tone="rose" value={hs.isProductionAuthorized ? "yes" : "no"} />
        </div>
        {c.address && <div className="mt-2 font-mono text-[0.65rem] text-mtqs-gold/70 break-all">addr: {c.address}</div>}
      </Panel>
      <Panel className="p-5">
        <div className="mb-2 flex items-center gap-2"><GlowDot color="gold" size="h-2 w-2" /><h4 className="text-sm font-semibold text-white/90">Architecture — 16-step workflow + 7-layer finality</h4></div>
        <div className="rounded-md border border-mtqs-gold/25 bg-mtqs-gold/[0.04] p-3 mb-2">
          <div className="text-[0.6rem] uppercase tracking-[0.18em] text-mtqs-gold/80 mb-1">Mint flow</div>
          <div className="text-[0.78rem] text-white leading-snug">{a.mintFlow}</div>
        </div>
        <div className="rounded-md border border-mtqs-gold/25 bg-mtqs-gold/[0.04] p-3 mb-2">
          <div className="text-[0.6rem] uppercase tracking-[0.18em] text-mtqs-gold/80 mb-1">Settlement finality</div>
          <div className="text-[0.78rem] text-white leading-snug">{a.finality}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">Custody</div>
            <div className="text-[0.74rem] text-white mt-0.5 leading-snug">{a.custody}</div>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">KYC</div>
            <div className="text-[0.74rem] text-white mt-0.5 leading-snug">{a.kyc}</div>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">RR target</div>
            <div className="font-mono text-sm text-mtqs-gold mt-0.5">{a.reserveRatioTarget}</div>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">Composition</div>
            <div className="text-[0.74rem] text-white mt-0.5">{a.reserveComposition}</div>
          </div>
        </div>
      </Panel>
      <Panel className="p-5">
        <div className="mb-2 flex items-center gap-2"><GlowDot color="emerald" size="h-2 w-2" /><h4 className="text-sm font-semibold text-white/90">Features + oracle adapters</h4></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {featList.map((ft) => (
            <div key={ft.k} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[0.65rem] text-white/85">{ft.k}</span>
              <PassPill ok={ft.v} label={ft.v ? "ON" : "OFF"} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">Chainlink</div>
            <div className="text-[0.65rem] text-white/75 mt-0.5">{f.oracleAdapters.chainlink}</div>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">Pyth</div>
            <div className="text-[0.65rem] text-white/75 mt-0.5">{f.oracleAdapters.pyth}</div>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">Chronicle</div>
            <div className="text-[0.65rem] text-white/75 mt-0.5">{f.oracleAdapters.chronicle}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">per-tx cap</div>
            <div className="font-mono text-xs text-mtqs-gold mt-0.5">{f.perTxCap}</div>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">daily redeem cap</div>
            <div className="font-mono text-xs text-mtqs-gold mt-0.5">{f.dailyRedeemCap}</div>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">PoR</div>
            <div className="font-mono text-[0.65rem] text-white/75 mt-0.5">{f.proofOfReserve}</div>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">MBG gateway</div>
            <div className="font-mono text-[0.65rem] text-white/75 mt-0.5">{f.mbgGateway}</div>
          </div>
        </div>
        <div className="mt-3 rounded-md border border-mtqs-rose/25 bg-mtqs-rose/[0.04] p-3">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-3 w-3 text-mtqs-rose" />
            <span className="text-[0.6rem] uppercase tracking-[0.18em] text-mtqs-rose/80">Honest status</span>
          </div>
          <div className="text-[0.72rem] text-white/75 leading-relaxed">{data.note}</div>
          <div className="font-mono text-[0.65rem] text-white/55 mt-2">
            implementedMask: <span className="text-mtqs-gold">{hs.implementedMask}</span> · authorizedMask: <span className="text-mtqs-rose">{hs.authorizedMask}</span> · status: {hs.status}
          </div>
        </div>
      </Panel>
    </div>
  );
}

const TABS = [
  { id: "a", label: "A · §87", icon: CheckCircle2, render: () => <SectionA /> },
  { id: "b", label: "B · §0.11", icon: Scale, render: () => <SectionB /> },
  { id: "c", label: "C · §51", icon: Layers, render: () => <SectionC /> },
  { id: "d", label: "D · §47", icon: ShieldCheck, render: () => <SectionD /> },
  { id: "e", label: "E · §52", icon: AlertTriangle, render: () => <SectionE /> },
  { id: "f", label: "F · §49/50", icon: Building2, render: () => <SectionF /> },
  { id: "g", label: "G · §77", icon: ScanLine, render: () => <SectionG /> },
  { id: "h", label: "H · §48", icon: Workflow, render: () => <SectionH /> },
  { id: "i", label: "I · Hybrid", icon: Cloud, render: () => <SectionI /> },
  { id: "j", label: "J · AI", icon: Cpu, render: () => <SectionJ /> },
  { id: "k", label: "K · PoR", icon: FileCheck, render: () => <SectionK /> },
  { id: "l", label: "L · Pool", icon: Droplets, render: () => <SectionL /> },
  { id: "m", label: "M · Banks", icon: Landmark, render: () => <SectionM /> },
  { id: "n", label: "N · V3", icon: CircuitBoard, render: () => <SectionN /> },
] as const;

export function InstitutionalDashboard({ className = "" }: { className?: string }) {
  const [tab, setTab] = useState<string>("a");
  return (
    <Reveal>
      <Panel className={`p-4 sm:p-6 mtqs-glow ${className}`}>
        <SectionHeader icon={Building2} eyebrow="§87 / §0.11 · for banks + institutional users"
          title={<span className="mtqs-gold-text">MTQΣ Institutional Dashboard</span>}
          right={<Pill tone="amber"><AlertTriangle className="h-3 w-3" />NOT PRODUCTION-AUTHORIZED</Pill>} />
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="bg-white/[0.03] border border-white/[0.06] h-auto p-1 flex flex-wrap gap-1">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="data-[state=active]:bg-mtqs-gold/15 data-[state=active]:text-mtqs-gold text-[0.7rem] font-mono">
                <t.icon className="h-3 w-3" />{t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((t) => (
            <TabsContent key={t.id} value={t.id}>
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>{t.render()}</motion.div>
            </TabsContent>
          ))}
        </Tabs>
        <div className="mt-4 flex items-center gap-2 text-[0.65rem] text-white/55">
          <Database className="h-3 w-3" /><span>All 14 sections fetched live from their respective API routes. Status: testnet candidate — not production-authorized.</span>
        </div>
      </Panel>
    </Reveal>
  );
}

export default InstitutionalDashboard;
