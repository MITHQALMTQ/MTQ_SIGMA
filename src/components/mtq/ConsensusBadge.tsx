// MTQΣ — Consensus provenance badge (shared AI UI primitive).
//
// Renders the Task-47 consensus attestation inline: status · voter quorum ·
// agreement, with a per-vote breakdown (provider/model, ok/failed, latency)
// on hover + as tiny chips. Used by BlueprintQA (and available to any other
// consensus-backed surface — briefing/risk carry their own footers).
//
// Shape contract = QaResult.consensus / BriefingResult.consensus in the
// lib/ai/* modules (Task-47 ConsensusResult projection):
//   { status, votersOk, votersAsked, agreement, winner?, runId?, votes[] }
//
// Brand: obsidian + gold, font-mono on numerics, lucide-free (chips only),
// NO indigo, NO blue. Server data only — this is a display component.

"use client";

import { GlowDot } from "./primitives";

export interface ConsensusVoteView {
  provider: string;
  model: string;
  role: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface ConsensusMeta {
  status: string;
  votersOk: number;
  votersAsked: number;
  agreement: number | null;
  winner?: string;
  runId?: string;
  votes: ConsensusVoteView[];
}

/** Tone for the status word — emerald when a quorum met, amber when degraded. */
function statusTone(status: string): "emerald" | "amber" | "rose" {
  const s = status.toUpperCase();
  if (s === "CONSENSUS") return "emerald";
  if (s === "NO-QUORUM") return "amber";
  return "rose";
}

const TONE_TEXT: Record<"emerald" | "amber" | "rose", string> = {
  emerald: "text-emerald-700",
  amber: "text-mtqs-amber",
  rose: "text-mtqs-rose",
};

export function ConsensusBadge({
  consensus,
}: {
  consensus: ConsensusMeta | null | undefined;
}) {
  if (!consensus) return null;

  const tone = statusTone(consensus.status);
  const tooltip = consensus.votes
    .map(
      (v) =>
        `${v.provider}/${v.model}: ${v.ok ? "ok" : (v.error ?? "failed")} ${v.latencyMs}ms`,
    )
    .join("\n");

  return (
    <div className="space-y-1" data-testid="consensus-badge">
      <div
        className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.62rem] font-mono text-[#5B6E68]"
        title={tooltip || undefined}
      >
        <span className="uppercase tracking-[0.16em] text-[#7A8C86]">
          Consensus
        </span>
        <span className={TONE_TEXT[tone]}>
          {consensus.status.toLowerCase()}
        </span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">
          {consensus.votersOk}/{consensus.votersAsked} voters
        </span>
        {consensus.agreement !== null && consensus.agreement !== undefined && (
          <>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              agreement {(consensus.agreement * 100).toFixed(0)}%
            </span>
          </>
        )}
        {consensus.winner && (
          <>
            <span aria-hidden="true">·</span>
            <span className="truncate max-w-[16rem]">{consensus.winner}</span>
          </>
        )}
      </div>
      {consensus.votes.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[0.6rem] font-mono text-[#7A8C86]">
          {consensus.votes.map((v) => (
            <span
              key={`${v.provider}/${v.model}`}
              className="inline-flex items-center gap-1"
              title={
                v.ok
                  ? `${v.provider}/${v.model} · ${v.role} · ${v.latencyMs}ms`
                  : `${v.provider}/${v.model} · ${v.role} · ${v.error ?? "failed"}`
              }
            >
              <GlowDot color={v.ok ? "gold" : "rose"} size="h-1 w-1" />
              {v.provider}/{v.model.split("/").pop()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default ConsensusBadge;
