// MTQΣ — AI Consensus UI (cross-vendor consensus edition, 2026-11-06).
//
// Two exports:
//   • <ConsensusBadge consensus={…} />  — provenance chips attached to every
//     AI answer panel (briefing / risk signals / QA): execution mode
//     (CONSENSUS · SINGLE-SOURCE · FALLBACK), answering members with vendor +
//     model, pairwise agreement score, and the FRED-grounded indicator.
//   • <AIConsensusBoard /> — the live member board (fetches /api/ai/status,
//     60s poll + manual refresh): every consensus member's configuration,
//     health, sticky model, latency, cooldown, last error — plus the FRED
//     data member and the honest summary line.
//
// Design language: identical to the rest of the terminal (Panel primitive,
// Pill + GlowDot, #0E1F1B ink, #E3EAE6 hairlines, gold accents, emerald =
// healthy, amber = cooldown, rose = failed, muted = not configured).
// NO indigo, NO blue. Honest by construction: the board never invents state —
// it renders exactly what /api/ai/status reports.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, CheckCircle2, MinusCircle, XCircle, Clock, Database, Users } from "lucide-react";
import { Panel, Reveal, Pill, GlowDot, Skeleton, SectionHeading } from "./primitives";
import { fmtAgo } from "./format";

/* ---------- shared provenance types (mirror src/lib/ai/consensus.ts) ---------- */

export interface ConsensusMemberResponse {
  id: string;
  vendor: string;
  model: string;
  latencyMs: number;
}

export interface ConsensusMeta {
  mode: "consensus" | "single-source" | "unavailable";
  provider: string;
  vendor: string;
  agreement: number | null;
  members: ConsensusMemberResponse[];
  fredGrounded?: boolean;
}

/* ---------- <ConsensusBadge /> ---------- */

const MODE_TONE: Record<ConsensusMeta["mode"], "emerald" | "gold" | "muted"> = {
  consensus: "emerald",
  "single-source": "gold",
  unavailable: "muted",
};

const MODE_LABEL: Record<ConsensusMeta["mode"], string> = {
  consensus: "CONSENSUS",
  "single-source": "SINGLE-SOURCE",
  unavailable: "FALLBACK RULES",
};

export function ConsensusBadge({ consensus }: { consensus?: ConsensusMeta | null }) {
  if (!consensus) {
    // Deterministic fallback-rules answer (no member responded).
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone="muted">
          <GlowDot color="amber" size="h-1.5 w-1.5" />
          FALLBACK RULES
        </Pill>
        <span className="text-[0.62rem] text-[#7A8C86]">
          no consensus member answered — deterministic engine output
        </span>
      </div>
    );
  }

  const memberNames = consensus.members.map((m) => m.vendor).join(" · ");
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <Pill tone={MODE_TONE[consensus.mode]}>
        <GlowDot
          color={consensus.mode === "consensus" ? "emerald" : consensus.mode === "single-source" ? "gold" : "amber"}
          size="h-1.5 w-1.5"
        />
        {MODE_LABEL[consensus.mode]}
        {consensus.mode === "consensus" && consensus.agreement != null && (
          <span className="ml-1 font-mono">σ {(consensus.agreement * 100).toFixed(0)}%</span>
        )}
      </Pill>
      {consensus.members.length > 0 && (
        <span className="text-[0.62rem] text-[#5B6E68]">
          answered: <span className="text-[#33544C] font-medium">{memberNames}</span>
          {consensus.members.length > 1 && (
            <span className="ml-1 text-[#7A8C86]">({consensus.members.length} models)</span>
          )}
        </span>
      )}
      {consensus.fredGrounded && (
        <Pill tone="gold">
          <Database className="h-2.5 w-2.5" aria-hidden />
          FRED
        </Pill>
      )}
    </div>
  );
}

/* ---------- <AIConsensusBoard /> ---------- */

interface BoardMember {
  member: string;
  vendor: string;
  role: "external vendor" | "platform bootstrap" | string;
  model: string;
  configured: boolean;
  healthy: boolean;
  latencyMs: number | null;
  cooldownMs: number;
  lastError: string | null;
}

interface StatusResponse {
  source: string;
  fetchedAt: string;
  engine: string;
  board: BoardMember[];
  dataMembers: {
    fred: { configured: boolean; note: string };
  };
  summary: {
    activeMembers: number;
    configuredMembers: number;
    totalMembers: number;
    mode: string;
  };
}

function MemberStateIcon({ m }: { m: BoardMember }) {
  if (!m.configured) {
    return <MinusCircle className="h-3.5 w-3.5 text-[#A8B5B0]" aria-hidden />;
  }
  if (m.healthy) {
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />;
  }
  if (m.cooldownMs > 0) {
    return <Clock className="h-3.5 w-3.5 text-mtqs-amber" aria-hidden />;
  }
  return <XCircle className="h-3.5 w-3.5 text-mtqs-rose" aria-hidden />;
}

function memberStateText(m: BoardMember): string {
  if (!m.configured) return "not configured (no key)";
  if (m.healthy) return m.latencyMs != null ? `live · ${m.latencyMs} ms` : "live";
  if (m.cooldownMs > 0) return `cooldown ${Math.ceil(m.cooldownMs / 60000)} min`;
  return "unavailable";
}

export function AIConsensusBoard({ className = "" }: { className?: string }) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/status", { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as StatusResponse;
      if (!mountedRef.current) return;
      setData(json);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchStatus();
    const id = setInterval(() => {
      if (!document.hidden) fetchStatus();
    }, 60_000);
    const onVisible = () => {
      if (!document.hidden) fetchStatus();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchStatus]);

  const active = data?.summary.activeMembers ?? 0;
  const summaryTone: "emerald" | "gold" | "muted" =
    active >= 2 ? "emerald" : active === 1 ? "gold" : "muted";

  return (
    <Reveal>
      <Panel className={`p-5 sm:p-6 ${className}`}>
        <SectionHeading
          eyebrow="AI LAYER · CROSS-VENDOR CONSENSUS"
          title="Consensus Member Board"
          right={
            <div className="flex items-center gap-2">
              <Pill tone={summaryTone}>
                <GlowDot
                  color={active >= 2 ? "emerald" : active === 1 ? "gold" : "amber"}
                  size="h-1.5 w-1.5"
                />
                {data ? data.summary.mode : "…"}
              </Pill>
              <button
                onClick={fetchStatus}
                disabled={loading}
                aria-label="Refresh consensus board"
                className="inline-flex items-center justify-center rounded-md border border-[#E3EAE6] bg-[#F7FAF8] h-8 w-8 text-[#5B6E68] hover:text-[#0E1F1B] hover:bg-[#F0F7F4] transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
              </button>
            </div>
          }
        />

        <p className="mt-1 mb-4 text-[0.72rem] text-[#33544C] leading-relaxed">
          Every AI answer fans out to all healthy members in parallel; the centroid response
          (highest mean pairwise agreement) becomes the consensus answer with full member
          provenance. Pasting a valid key into <span className="font-mono text-mtqs-gold">.env</span> joins
          the consensus with zero code changes. AI output is advisory only.
        </p>

        {error ? (
          <div className="rounded-md border border-mtqs-rose/40 bg-mtqs-rose/5 p-4 flex items-center gap-3">
            <XCircle className="h-4 w-4 text-mtqs-rose shrink-0" aria-hidden />
            <span className="text-[0.75rem] text-[#33544C]">Board unavailable: {error}</span>
          </div>
        ) : !data ? (
          <div className="space-y-2" aria-hidden>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-[70%]" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[0.74rem]">
                <thead>
                  <tr className="text-[0.58rem] uppercase tracking-widest text-[#5B6E68] border-b border-[#E3EAE6]">
                    <th className="text-left font-medium py-2 pr-3">Member</th>
                    <th className="text-left font-medium py-2 px-3">Model</th>
                    <th className="text-left font-medium py-2 px-3">State</th>
                    <th className="text-right font-medium py-2 pl-3">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {data.board.map((m) => (
                    <tr key={m.member} className="border-b border-[#EDF2EF] last:border-b-0">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <MemberStateIcon m={m} />
                          <div className="min-w-0">
                            <div className="font-medium text-[#0E1F1B]">{m.vendor}</div>
                            <div className="text-[0.6rem] text-[#7A8C86]">
                              {m.role === "platform bootstrap" ? "platform bootstrap" : "external vendor"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono text-[0.66rem] text-[#33544C] truncate max-w-[13rem]">
                        {m.model}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-[0.68rem] ${
                            !m.configured
                              ? "text-[#7A8C86]"
                              : m.healthy
                                ? "text-emerald-700"
                                : m.cooldownMs > 0
                                  ? "text-mtqs-amber"
                                  : "text-mtqs-rose"
                          }`}
                        >
                          {memberStateText(m)}
                        </span>
                        {m.lastError && m.configured && (
                          <div
                            className="text-[0.58rem] text-[#7A8C86] mt-0.5 truncate max-w-[16rem]"
                            title={m.lastError}
                          >
                            {m.lastError.slice(0, 60)}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pl-3 text-right font-mono tabular-nums text-[#33544C]">
                        {m.latencyMs != null ? `${m.latencyMs} ms` : "—"}
                      </td>
                    </tr>
                  ))}
                  {/* FRED data member row */}
                  <tr className="border-t border-[#E3EAE6] bg-[#FAFCFA]">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        {data.dataMembers.fred.configured ? (
                          <Database className="h-3.5 w-3.5 text-mtqs-gold" aria-hidden />
                        ) : (
                          <MinusCircle className="h-3.5 w-3.5 text-[#A8B5B0]" aria-hidden />
                        )}
                        <div>
                          <div className="font-medium text-[#0E1F1B]">FRED</div>
                          <div className="text-[0.6rem] text-[#7A8C86]">data member</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3 font-mono text-[0.66rem] text-[#33544C]">
                      macro observations
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`text-[0.68rem] ${
                          data.dataMembers.fred.configured ? "text-emerald-700" : "text-[#7A8C86]"
                        }`}
                      >
                        {data.dataMembers.fred.configured ? "live grounding" : "not configured"}
                      </span>
                    </td>
                    <td className="py-2 pl-3 text-right font-mono text-[0.66rem] text-[#7A8C86]">
                      VIX · DXY · Gold · 10Y
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.65rem] text-[#5B6E68]">
              <Users className="h-3 w-3 text-mtqs-gold/80" aria-hidden />
              <span>
                {data.summary.activeMembers}/{data.summary.totalMembers} members active ·{" "}
                {data.summary.configuredMembers} configured · fetched {fmtAgo(Date.parse(data.fetchedAt))}
              </span>
            </div>
          </>
        )}
      </Panel>
    </Reveal>
  );
}

export default AIConsensusBoard;
