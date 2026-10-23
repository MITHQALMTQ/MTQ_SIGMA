// MTQΣ — Evidence Package v6 (Review-Only Reconciliation Surface)
// =============================================================================
// Fetches /api/evidence and renders the Evidence Reconciliation and
// Pre-Remediation Control Directive package:
//   0. NOT-ACCEPTED posture banner (no gate advanced, no on-chain action).
//   1. Absolute restrictions (§1) — all enforced this round.
//   2. Deliverables D-1..D-6 (§7) with file paths + key points.
//   3. Findings register (C-040..C-049) — severities preserved, color-coded.
//   4. Suite re-run results at HEAD (with logs).
//   5. Compile matrix (EIP-170 adjudication) — all rows over-limit flagged.
//   6. Custody reconciliation table (raw-wei precision).
//   7. Gate-by-gate status (§0.5 gates — nothing advanced).
//   8. OD decision matrix (implemented ≠ verified ≠ approved ≠ authorized).
//   9. Stop conditions (§7) + remediation top items (D-5).
//
// This surface is REVIEW-ONLY: it displays evidence; it cannot and does not
// trigger any protocol action.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardCheck, ShieldAlert, ShieldBan, FileWarning, RefreshCw, CheckCircle2,
  Ban, Landmark, AlertTriangle, Scale, ListChecks, Boxes, Lock, ExternalLink,
} from "lucide-react";
import { Panel, Reveal, Pill, GlowDot, SectionHeading, Skeleton, Stat } from "@/components/mtq/primitives";

interface EvidenceMeta {
  directive: string;
  status: string;
  statusDetail: string;
  baselineCommit: string;
  baselineNote: string;
  remote: string;
  mandateSha256: string;
  freshAnchors: { monadBlocks: number[]; arcBlocks: number[]; dateUtc: string };
  docsDir: string;
  runtimeHead: string | null;
  runtimeHeadNote: string;
  posture: string;
}
interface Restriction { id: string; rule: string; enforced: string }
interface Deliverable { id: string; file: string; title: string; summary: string; keyPoints: string[] }
interface Finding { id: string; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"; title: string; detail: string; refs: string }
interface SuiteResult { suite: string; command: string; result: string; note?: string }
interface CompileRow { source: string; evm: string; runs: number | string; viaIr: boolean; runtime: number; over: number; keccak: string; note?: string }
interface CustodyRow { chain: string; asset: string; address: string; supply: string; deployerShare: string; safeShare: string; note: string }
interface GateRow { gate: string; definition: string; status: string; blockers: string }
interface DecisionRow { id: string; decision: string; implemented: string; verified: string; proposed: string; approved: string; authorized: string }
interface EvidenceResp {
  meta: EvidenceMeta;
  restrictions: Restriction[];
  deliverables: Deliverable[];
  findings: Finding[];
  rerunResults: SuiteResult[];
  compileMatrix: CompileRow[];
  custody: CustodyRow[];
  gates: GateRow[];
  decisionMatrix: DecisionRow[];
  stopConditions: { condition: string; triggered: boolean; disposition: string }[];
  remediationTop: { id: string; text: string; onChain: boolean }[];
  claimCounts: { total: number; critical: number; high: number; resolvedThisRound: number };
}

/* Register rollups live in /api/mandate (the evidence payload does not carry
   them) — fetched live so the rollup line is derived, never hardcoded. */
interface MandateRollupsResp {
  registers?: {
    rollups?: {
      odTotal?: number;
      odOpen?: number;
      odByStatus?: Record<string, number>;
    };
  };
  error?: string;
}

const sevTone = (s: string): "rose" | "amber" | "gold" | "muted" =>
  s === "CRITICAL" ? "rose" : s === "HIGH" ? "amber" : s === "MEDIUM" ? "gold" : "muted";

const short = (h: string) => (h ? h.slice(0, 10) : "—");

export function EvidencePackageSection() {
  const [data, setData] = useState<EvidenceResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [rollups, setRollups] = useState<NonNullable<MandateRollupsResp["registers"]>["rollups"] | null>(null);
  const [rollupsError, setRollupsError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/evidence", { cache: "no-store" });
      if (!res.ok) throw new Error(`/api/evidence → HTTP ${res.status}`);
      const json = (await res.json()) as EvidenceResp;
      if (!mountedRef.current) return;
      setData(json);
      setError(null);
      setFetchedAt(new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC");
    } catch (e) {
      if (mountedRef.current) setError((e as Error).message);
    }
    // Register rollups — fetched live from /api/mandate (fail-honest: on error
    // the counts are withheld, never fabricated).
    try {
      const mRes = await fetch("/api/mandate", { cache: "no-store" });
      if (!mRes.ok) throw new Error(`HTTP ${mRes.status}`);
      const mJson = (await mRes.json()) as MandateRollupsResp;
      if (!mJson?.registers?.rollups) throw new Error("registers.rollups missing from /api/mandate response");
      if (mountedRef.current) {
        setRollups(mJson.registers.rollups);
        setRollupsError(null);
      }
    } catch (e2) {
      if (mountedRef.current) setRollupsError(String(e2).slice(0, 200));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => { mountedRef.current = false; };
  }, [load]);

  if (error) {
    return (
      <Panel className="p-6 border-rose-400/30">
        <div className="flex items-center gap-3 text-rose-200">
          <ShieldAlert className="h-5 w-5" />
          <span>Evidence package unavailable: {error}</span>
        </div>
      </Panel>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const m = data.meta;
  const odByStatus = rollups?.odByStatus ?? null;
  const odOpenCount = odByStatus?.["OPEN"] ?? rollups?.odOpen ?? null;
  const stopTotal = data.stopConditions.length;
  const triggeredCount = data.stopConditions.filter((s) => s.triggered).length;

  return (
    <div className="space-y-8">
      {/* ── 0. Posture banner ─────────────────────────────────────────── */}
      <Reveal>
        <Panel className="p-5 sm:p-6 border-rose-400/40" >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <ShieldBan className="h-6 w-6 text-rose-300 shrink-0" aria-hidden />
              <span className="text-base sm:text-lg font-semibold tracking-wide text-rose-100">
                {m.status} — Controlled Verification Phase
              </span>
              <Pill tone="rose">NO GATE ADVANCED</Pill>
              <Pill tone="rose">NO ON-CHAIN ACTION</Pill>
              <Pill tone="amber">SHADOW POSTURE PRESERVED</Pill>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-300/90">{m.statusDetail}</p>
            <p className="text-[11px] text-slate-400/80">
              Directive: <em>{m.directive}</em> · Review-only surface — nothing here authorizes or executes anything.
            </p>
          </div>
        </Panel>
      </Reveal>

      {/* ── 0.b Meta strip ────────────────────────────────────────────── */}
      <Reveal>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Baseline commit (verified at)" value={short(m.baselineCommit)} valueClass="font-mono text-amber-200" />
          <Stat label="Runtime HEAD (request time)" value={m.runtimeHead ? short(m.runtimeHead) : "n/a"} valueClass="font-mono text-amber-200" />
          <Stat label="Fresh read anchors (M/A)" value={`${m.freshAnchors.monadBlocks.length}× Monad · ${m.freshAnchors.arcBlocks.length}× Arc`} valueClass="text-amber-200" />
          <Stat label="Git remote" value={m.remote || "NONE"} valueClass={m.remote ? "text-amber-200" : "text-rose-300"} />
        </div>
        <Panel className="p-4 mt-3">
          <div className="grid gap-2 text-[11px] font-mono text-slate-400 break-all">
            <div>mandate SSOT sha256: {m.mandateSha256}</div>
            <div>Monad blocks: {m.freshAnchors.monadBlocks.join(" · ")} — Arc blocks: {m.freshAnchors.arcBlocks.join(" · ")} — {m.freshAnchors.dateUtc}</div>
            <div className="text-slate-500">{m.baselineNote}</div>
          </div>
        </Panel>
      </Reveal>

      {/* ── 1. Absolute restrictions ─────────────────────────────────── */}
      <Reveal>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Lock className="h-5 w-5 text-amber-300" aria-hidden /> §1 Absolute Restrictions — all enforced
          </h2>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            {fetchedAt ? <span>fetched {fetchedAt}</span> : null}
            <button onClick={() => void load()} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 hover:border-amber-300/40 hover:text-amber-200 transition" aria-label="Refresh evidence package">
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
        </div>
        <Panel className="p-4 mt-3">
          <ul className="grid md:grid-cols-2 gap-3">
            {data.restrictions.map((r) => (
              <li key={r.id} className="flex gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-300 mt-0.5 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-200"><span className="font-mono text-amber-200">{r.id}</span> — {r.rule}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{r.enforced}</div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </Reveal>

      {/* ── 2. Deliverables ───────────────────────────────────────────── */}
      <Reveal>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <ClipboardCheck className="h-5 w-5 text-amber-300" aria-hidden /> §7 Deliverables — D-1 … D-6 (review only)
        </h2>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          {data.deliverables.map((d) => (
            <Panel key={d.id} className="p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Pill tone="gold">{d.id}</Pill>
                <span className="text-sm font-semibold text-slate-100">{d.title}</span>
              </div>
              <p className="text-xs text-slate-300/90 mt-2 leading-relaxed">{d.summary}</p>
              <ul className="mt-2 space-y-1.5">
                {d.keyPoints.map((k, i) => (
                  <li key={i} className="text-[11px] text-slate-400 flex gap-2"><GlowDot className="mt-1" />{k}</li>
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-amber-200/70 break-all">
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden /> {d.file}
              </div>
            </Panel>
          ))}
        </div>
      </Reveal>

      {/* ── 3. Findings register ──────────────────────────────────────── */}
      <Reveal>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <FileWarning className="h-5 w-5 text-rose-300" aria-hidden /> Findings register — severities preserved (C-040 … C-049)
        </h2>
        <Panel className="p-0 mt-3 overflow-hidden">
          <div className="max-h-96 overflow-y-auto mtqs-scroll">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#0A1124] text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2.5">ID</th>
                  <th className="px-3 py-2.5">Severity</th>
                  <th className="px-3 py-2.5">Finding</th>
                  <th className="px-3 py-2.5 hidden sm:table-cell">Refs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.findings.map((f) => (
                  <tr key={f.id} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 font-mono text-amber-200 whitespace-nowrap">{f.id}</td>
                    <td className="px-3 py-2.5"><Pill tone={sevTone(f.severity)}>{f.severity}</Pill></td>
                    <td className="px-3 py-2.5 min-w-0">
                      <div className="font-medium text-slate-200">{f.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{f.detail}</div>
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell font-mono text-[10px] text-slate-500 whitespace-nowrap">{f.refs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Reveal>

      {/* ── 4. Suite re-runs at HEAD ─────────────────────────────────── */}
      <Reveal>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <ListChecks className="h-5 w-5 text-emerald-300" aria-hidden /> §2 Re-runs at HEAD {short(m.baselineCommit)} — complete logs committed
        </h2>
        <Panel className="p-0 mt-3 overflow-hidden">
          <div className="max-h-80 overflow-y-auto mtqs-scroll">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#0A1124] text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2.5">Suite</th>
                  <th className="px-3 py-2.5">Result</th>
                  <th className="px-3 py-2.5 hidden lg:table-cell">Command (reproducible)</th>
                  <th className="px-3 py-2.5">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.rerunResults.map((s) => (
                  <tr key={s.suite} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 text-slate-200 whitespace-nowrap">{s.suite}</td>
                    <td className={`px-3 py-2.5 font-mono whitespace-nowrap ${s.result.includes("CRITICAL") ? "text-rose-300" : "text-emerald-300"}`}>{s.result}</td>
                    <td className="px-3 py-2.5 hidden lg:table-cell font-mono text-[10px] text-slate-500 break-all">{s.command}</td>
                    <td className="px-3 py-2.5 text-[11px] text-amber-200/80">{s.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Reveal>

      {/* ── 5. Compile matrix (EIP-170 adjudication) ─────────────────── */}
      <Reveal>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Boxes className="h-5 w-5 text-amber-300" aria-hidden /> §5 Compile matrix — EIP-170 adjudication (limit 24,576 B)
        </h2>
        <Panel className="p-0 mt-3 overflow-hidden">
          <div className="max-h-80 overflow-y-auto mtqs-scroll">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#0A1124] text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">evm / runs / viaIR</th>
                  <th className="px-3 py-2.5 text-right">Runtime B</th>
                  <th className="px-3 py-2.5 text-right">Δ over limit</th>
                  <th className="px-3 py-2.5 hidden md:table-cell">keccak(runtime)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.compileMatrix.map((c, i) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 text-slate-200">{c.source}{c.note ? <span className="block text-[10px] text-amber-200/70">{c.note}</span> : null}</td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-slate-400 whitespace-nowrap">{c.evm} / {c.runs} / {c.viaIr ? "IR" : "no-IR"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-200">{c.runtime.toLocaleString()}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${c.over > 0 ? "text-rose-300" : "text-emerald-300"}`}>{c.over > 0 ? `+${c.over.toLocaleString()}` : "within"}</td>
                    <td className="px-3 py-2.5 hidden md:table-cell font-mono text-[10px] text-slate-500">{c.keccak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-white/[0.05] px-3 py-2 text-[11px] text-rose-200/90 flex items-center gap-2">
            <Ban className="h-3.5 w-3.5 shrink-0" aria-hidden /> C-044: the repository currently contains ZERO deployable-within-limit token source (best case +142 B over).
          </div>
        </Panel>
      </Reveal>

      {/* ── 6. Custody reconciliation ─────────────────────────────────── */}
      <Reveal>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Landmark className="h-5 w-5 text-amber-300" aria-hidden /> §3 Custody reconciliation — raw-wei precision, both chains
        </h2>
        <Panel className="p-0 mt-3 overflow-hidden">
          <div className="max-h-96 overflow-y-auto mtqs-scroll">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#0A1124] text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2.5">Chain</th>
                  <th className="px-3 py-2.5">Asset</th>
                  <th className="px-3 py-2.5 text-right">Supply</th>
                  <th className="px-3 py-2.5 text-right">Deployer EOA</th>
                  <th className="px-3 py-2.5 text-right">Safe</th>
                  <th className="px-3 py-2.5 hidden md:table-cell">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.custody.map((c, i) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 font-mono text-[10px] text-slate-400 whitespace-nowrap">{c.chain}</td>
                    <td className="px-3 py-2.5 text-slate-200 font-mono text-[10px]">{c.asset}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-300">{c.supply}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-rose-300">{c.deployerShare}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-400">{c.safeShare}</td>
                    <td className="px-3 py-2.5 hidden md:table-cell text-[11px] text-amber-200/80">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-white/[0.05] px-3 py-2 text-[11px] text-rose-200/90">
            100% of genesis assets on both chains sit under ONE exposed key (C-045): 1.1M USDC × 2 chains + candidate-B supply + candidate-C control. The mandated 4/7 Safe holds zero and has never executed (nonce 0).
          </div>
        </Panel>
      </Reveal>

      {/* ── 7. Gates ──────────────────────────────────────────────────── */}
      <Reveal>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Scale className="h-5 w-5 text-amber-300" aria-hidden /> Gate-by-gate status — nothing advanced
        </h2>
        <Panel className="p-0 mt-3 overflow-hidden">
          <div className="max-h-80 overflow-y-auto mtqs-scroll">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#0A1124] text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2.5">Gate</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Blockers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.gates.map((g) => (
                  <tr key={g.gate} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 text-slate-200 whitespace-nowrap">{g.gate}</td>
                    <td className={`px-3 py-2.5 font-mono text-[10px] whitespace-nowrap ${g.status.includes("BLOCKED") || g.status.includes("NOT") ? "text-rose-300" : "text-amber-200"}`}>{g.status}</td>
                    <td className="px-3 py-2.5 text-[11px] text-slate-400">{g.blockers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Reveal>

      {/* ── 8. OD decision matrix ─────────────────────────────────────── */}
      <Reveal>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <AlertTriangle className="h-5 w-5 text-amber-300" aria-hidden /> §6 Decision matrix — implemented ≠ verified ≠ approved ≠ authorized
        </h2>
        <Panel className="p-0 mt-3 overflow-hidden">
          <div className="max-h-96 overflow-y-auto mtqs-scroll">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#0A1124] text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2.5">ID</th>
                  <th className="px-3 py-2.5 hidden lg:table-cell">Implemented</th>
                  <th className="px-3 py-2.5 hidden lg:table-cell">Verified</th>
                  <th className="px-3 py-2.5">Approved</th>
                  <th className="px-3 py-2.5">Authorized</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.decisionMatrix.map((d) => (
                  <tr key={d.id} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-amber-200 whitespace-nowrap">{d.id}</div>
                      <div className="text-[11px] text-slate-400">{d.decision}</div>
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell text-[11px] text-slate-400">{d.implemented}</td>
                    <td className="px-3 py-2.5 hidden lg:table-cell text-[11px] text-slate-400">{d.verified}</td>
                    <td className={`px-3 py-2.5 text-[11px] ${d.approved.includes("OPEN") || d.approved.includes("pending") ? "text-amber-200" : "text-slate-400"}`}>{d.approved}</td>
                    <td className="px-3 py-2.5 text-[11px] text-rose-300 whitespace-nowrap">{d.authorized}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-white/[0.05] px-3 py-2 text-[11px] text-slate-400">
            {rollups ? (
              <>
                Register rollups (live /api/mandate): {odOpenCount ?? 0} OPEN ·{" "}
                {odByStatus?.["IMPLEMENTED-PENDING-APPROVAL"] ?? 0} IMPLEMENTED-PENDING-APPROVAL ·{" "}
                {odByStatus?.["SATISFIED-BY-DOCUMENT"] ?? 0} SATISFIED-BY-DOCUMENT ·{" "}
                {odByStatus?.["VERIFIED-FAILED"] ?? 0} VERIFIED-FAILED. No committee approval exists
                anywhere.
              </>
            ) : rollupsError ? (
              <span className="text-rose-300/90">
                Register rollups unavailable — live /api/mandate fetch failed ({rollupsError});
                counts are withheld rather than fabricated.
              </span>
            ) : (
              "Register rollups: loading from /api/mandate…"
            )}
          </div>
        </Panel>
      </Reveal>

      {/* ── 9. Stop conditions + remediation ──────────────────────────── */}
      <Reveal>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <ShieldAlert className="h-5 w-5 text-rose-300" aria-hidden /> §7 Stop conditions — {triggeredCount}/{stopTotal} triggered, all reported
        </h2>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <Panel className="p-4">
            <ul className="space-y-3">
              {data.stopConditions.map((s) => (
                <li key={s.condition} className="flex gap-3">
                  <Ban className="h-4 w-4 text-rose-300 mt-0.5 shrink-0" aria-hidden />
                  <div>
                    <div className="text-xs font-medium text-slate-200">{s.condition}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{s.disposition}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel className="p-4">
            <div className="text-xs font-semibold text-amber-200 mb-3">Remediation sequence (D-5 — every on-chain step needs an approved transaction plan)</div>
            <ul className="space-y-3">
              {data.remediationTop.map((r) => (
                <li key={r.id} className="flex gap-3">
                  <span className={`font-mono text-[11px] mt-0.5 shrink-0 ${r.onChain ? "text-rose-300" : "text-emerald-300"}`}>{r.id}</span>
                  <div className="text-[11px] text-slate-300">{r.text}{r.onChain ? <span className="text-rose-300/80"> — ON-CHAIN (plan first)</span> : null}</div>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="Unresolved claims (D-6)" value={String(data.claimCounts.total)} valueClass="text-rose-300" />
              <Stat label="Critical" value={String(data.claimCounts.critical)} valueClass="text-rose-300" />
              <Stat label="Resolved this round" value={String(data.claimCounts.resolvedThisRound)} valueClass="text-emerald-300" />
            </div>
          </Panel>
        </div>
        <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">
          Full documents: <span className="font-mono">{m.docsDir}</span> (D-1…D-6, BASELINE-MANIFEST.txt, machine JSONs, complete logs).
          All on-chain interactions in this package were read-only view calls. Production reserve trading remains NOT AUTHORIZED.
        </p>
      </Reveal>
    </div>
  );
}
