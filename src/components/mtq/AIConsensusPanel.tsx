// MTQΣ — AI Multi-Model Consensus Panel (Task 47)
// ----------------------------------------------------------------------------
// Renders the free-tier multi-provider AI consensus layer:
//   * provider health (NVIDIA ✅ · OpenRouter ✅ — the two live-validated
//     free providers; Groq/Google/HF shown as removed with reasons)
//   * the validated voter roster (7 models · anchor/verifier/fast roles ·
//     measured probe latencies)
//   * the downloaded model-catalog databases (AiModelCatalog stats)
//   * recent consensus runs with per-vote attestations (ConsensusRun/Vote)
//   * a LIVE consensus check: the operator's question goes to the 3-voter
//     panel; the response shows the field-majority result, per-vote status,
//     and the agreement score.
//
// Data: GET /api/ai/status (120s poll, pauses hidden) · POST /api/ai/consensus
// (rate-limited 5/min shared bucket) · POST /api/ai/catalog-sync.
//
// Brand: obsidian + gold, font-mono on identifiers, lucide icons (no emojis),
// Panel + Reveal + Pill + GlowDot + Skeleton primitives. NO indigo, NO blue.

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Network, RefreshCw, Send, Database, CheckCircle2, XCircle, ShieldCheck, Layers } from "lucide-react";
import { Panel, Reveal, Pill, GlowDot, Skeleton } from "./primitives";

/* ---------- API shape contracts ---------- */
interface StatusVote {
  provider: string;
  model: string;
  role: string;
  ok: boolean;
  latencyMs: number | null;
  error: string | null;
}

interface StatusRun {
  id: string;
  taskType: string;
  status: string;
  votersOk: number;
  votersAsked: number;
  quorum: boolean;
  agreement: number | null;
  durationMs: number | null;
  createdAt: string;
  votes: StatusVote[];
}

interface StatusResponse {
  mode: string;
  providers: Array<{ provider: string; keyPresent: boolean; endpoint: string; rosterModels: number }>;
  roster: Array<{ provider: string; model: string; role: string; probeLatencyMs: number; timeoutMs: number; note: string; excluded: boolean }>;
  defaults: { voters: number; quorumRule: string; agreementRule: string };
  catalog: { total: number; working: number; excluded: number; byProvider: Record<string, number> } | null;
  recentRuns: StatusRun[];
  policy: string;
}

interface ConsensusResponse {
  status: string;
  ok: boolean;
  result: { answer?: string; confidence?: string; caveat?: string } | null;
  consensus: {
    votersAsked: number;
    votersOk: number;
    quorumMet: boolean;
    agreement: number | null;
    durationMs: number;
    runId?: string;
    votes: Array<{ provider: string; model: string; role: string; ok: boolean; parsed: boolean; latencyMs: number; fieldAgreement?: number; error?: string }>;
  };
  disclaimer: string;
}

/** Non-working providers — surfaced honestly with their failure reason. */
const REMOVED_PROVIDERS: Array<{ name: string; reason: string }> = [
  { name: "Groq", reason: "403 Forbidden — key rejected" },
  { name: "Google AI Studio", reason: "403 — key auto-revoked as leaked" },
  { name: "Hugging Face", reason: "402 paywall — not free (removed)" },
];

function roleTone(role: string): "gold" | "muted" | "amber" {
  if (role === "anchor") return "gold";
  if (role === "verifier") return "amber";
  return "muted";
}

export function AIConsensusPanel({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // live consensus check state
  const [question, setQuestion] = useState("");
  const [runResult, setRunResult] = useState<ConsensusResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/status", { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as StatusResponse;
      if (!mountedRef.current) return;
      setStatus(json);
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
    }, 120_000);
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

  const runConsensusCheck = useCallback(async () => {
    const q = question.trim();
    if (!q || running) return;
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    try {
      const res = await fetch("/api/ai/consensus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const json = (await res.json()) as ConsensusResponse & { error?: string };
      if (!mountedRef.current) return;
      if (!res.ok) {
        setRunError(json?.error ?? `consensus ${res.status}`);
        return;
      }
      setRunResult(json);
      // refresh the runs list so the new attestation shows
      fetchStatus();
    } catch (e) {
      if (!mountedRef.current) return;
      setRunError(String(e instanceof Error ? e.message : e));
    } finally {
      if (mountedRef.current) setRunning(false);
    }
  }, [question, running, fetchStatus]);

  const syncCatalogs = useCallback(async () => {
    try {
      await fetch("/api/ai/catalog-sync", { method: "POST" });
      fetchStatus();
    } catch {
      /* surfaced by the next status poll */
    }
  }, [fetchStatus]);

  const providers = status?.providers ?? [];
  const roster = status?.roster ?? [];
  const catalog = status?.catalog;
  const recentRuns = status?.recentRuns ?? [];

  return (
    <Reveal>
      <Panel className={`p-5 sm:p-6 ${className}`}>
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <Network className="h-3.5 w-3.5 text-mtqs-gold/85" aria-hidden="true" />
              <span className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/85">
                AI · Multi-Model Consensus
              </span>
            </div>
            <h3 className="text-base font-semibold text-[#0E1F1B]">
              Free-Tier AI Consensus Layer
            </h3>
            <p className="text-[0.72rem] text-[#33544C] leading-relaxed">
              Every AI feature fans out to a 3-voter panel spanning two live-validated free
              providers. Quorum ≥ ceil(k/2). Zero billing — ever. z.ai excluded by owner directive.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Pill tone="gold" className="font-mono">
              <GlowDot color="gold" size="h-1.5 w-1.5" />
              {catalog ? `${catalog.working} live models` : "consensus"}
            </Pill>
            <button
              onClick={fetchStatus}
              disabled={loading}
              aria-label="Refresh consensus status"
              className="inline-flex items-center justify-center rounded-md border border-[#E3EAE6] bg-[#F7FAF8] h-8 w-8 text-[#5B6E68] hover:text-[#0E1F1B] hover:bg-[#F0F7F4] transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-mtqs-rose/40 bg-mtqs-rose/5 p-4 flex items-start gap-3">
            <XCircle className="h-4 w-4 text-mtqs-rose shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-[0.72rem] text-[#33544C]">Consensus status unavailable: {error}</div>
          </div>
        ) : loading && !status ? (
          <div className="space-y-2.5" aria-hidden="true">
            <Skeleton className="h-3 w-[88%]" />
            <Skeleton className="h-3 w-[75%]" />
            <Skeleton className="h-3 w-[82%]" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* ---------- Providers ---------- */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-3 w-3 text-mtqs-gold/70" aria-hidden="true" />
                <span className="text-[0.62rem] uppercase tracking-[0.18em] text-[#5B6E68]">
                  Providers (live-validated 2026-11-06)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {providers.map((p) => (
                  <div
                    key={p.provider}
                    className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {p.keyPresent ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-mtqs-rose shrink-0" aria-hidden="true" />
                      )}
                      <span className="text-[0.75rem] font-medium text-[#0E1F1B] capitalize truncate">{p.provider}</span>
                      <span className="text-[0.65rem] font-mono text-[#7A8C86]">{p.rosterModels} models</span>
                    </div>
                    <span className={`text-[0.62rem] font-mono ${p.keyPresent ? "text-emerald-700" : "text-mtqs-rose"}`}>
                      {p.keyPresent ? "FREE · OK" : "NO KEY"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {REMOVED_PROVIDERS.map((rp) => (
                  <span key={rp.name} className="text-[0.6rem] text-[#7A8C86] font-mono">
                    <span className="line-through">{rp.name}</span> — {rp.reason}
                  </span>
                ))}
              </div>
            </div>

            {/* ---------- Roster ---------- */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-3 w-3 text-mtqs-gold/70" aria-hidden="true" />
                <span className="text-[0.62rem] uppercase tracking-[0.18em] text-[#5B6E68]">
                  Voter roster — best model per task
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[0.7rem]">
                  <thead>
                    <tr className="text-left text-[#7A8C86] border-b border-[#E3EAE6]">
                      <th className="py-1.5 pr-3 font-medium">Model</th>
                      <th className="py-1.5 pr-3 font-medium">Role</th>
                      <th className="py-1.5 pr-3 font-medium text-right">Probe</th>
                      <th className="py-1.5 font-medium hidden sm:table-cell">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF3F0]">
                    {roster.map((r) => (
                      <tr key={`${r.provider}/${r.model}`} className="text-[#0E1F1B]">
                        <td className="py-1.5 pr-3 font-mono text-[0.65rem] max-w-[12rem] truncate" title={`${r.provider}/${r.model}`}>
                          <span className="text-[#7A8C86]">{r.provider}/</span>
                          {r.model}
                        </td>
                        <td className="py-1.5 pr-3">
                          <Pill tone={roleTone(r.role)} className="text-[0.55rem] uppercase tracking-wider">{r.role}</Pill>
                        </td>
                        <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-[#33544C] whitespace-nowrap">
                          {r.probeLatencyMs >= 1000 ? `${(r.probeLatencyMs / 1000).toFixed(1)}s` : `${r.probeLatencyMs}ms`}
                        </td>
                        <td className="py-1.5 text-[0.65rem] text-[#5B6E68] hidden sm:table-cell max-w-[16rem] truncate" title={r.note}>
                          {r.note}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[0.6rem] text-[#7A8C86] font-mono">
                Default panel: anchor + verifier + fast (2 providers) · {status?.defaults.quorumRule}
              </p>
            </div>

            {/* ---------- Downloaded catalog databases ---------- */}
            <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Database className="h-3.5 w-3.5 text-mtqs-gold/70 shrink-0" aria-hidden="true" />
                  <span className="text-[0.72rem] font-medium text-[#0E1F1B]">Model-catalog databases</span>
                  {catalog ? (
                    <span className="text-[0.65rem] font-mono text-[#33544C]">
                      {catalog.total} downloaded · {catalog.working} working · {catalog.excluded} excluded
                      {Object.entries(catalog.byProvider).map(([p, n]) => ` · ${p}:${n}`).join("")}
                    </span>
                  ) : (
                    <span className="text-[0.65rem] font-mono text-[#7A8C86]">not synced yet</span>
                  )}
                </div>
                <button
                  onClick={syncCatalogs}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#E3EAE6] bg-white px-2.5 py-1.5 text-[0.65rem] font-medium text-[#33544C] hover:text-[#0E1F1B] hover:bg-[#F0F7F4] transition"
                >
                  <Database className="h-3 w-3" aria-hidden="true" />
                  Re-sync catalogs
                </button>
              </div>
            </div>

            {/* ---------- Live consensus check ---------- */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Send className="h-3 w-3 text-mtqs-gold/70" aria-hidden="true" />
                <span className="text-[0.62rem] uppercase tracking-[0.18em] text-[#5B6E68]">
                  Live consensus check (3 voters · field-majority)
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runConsensusCheck();
                  }}
                  placeholder="Ask the voter panel anything (max 500 chars)…"
                  aria-label="Consensus question"
                  className="flex-1 rounded-md border border-[#E3EAE6] bg-white px-3 py-2 text-[0.78rem] text-[#0E1F1B] placeholder:text-[#7A8C86] focus:outline-none focus:ring-1 focus:ring-mtqs-gold/40 focus:border-mtqs-gold/40 transition"
                />
                <button
                  onClick={runConsensusCheck}
                  disabled={running || question.trim().length === 0}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-mtqs-gold/30 bg-mtqs-gold/10 px-4 py-2 text-[0.72rem] font-medium text-[#8A6D1F] hover:bg-mtqs-gold/20 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} aria-hidden="true" />
                  {running ? "Voting…" : "Run consensus"}
                </button>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {runError && (
                  <motion.div
                    key="run-error"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mt-3 rounded-md border border-mtqs-rose/40 bg-mtqs-rose/5 p-3 text-[0.7rem] text-mtqs-rose"
                  >
                    {runError}
                  </motion.div>
                )}
                {runResult && (
                  <motion.div
                    key="run-result"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mt-3 rounded-md border border-[#E3EAE6] bg-white p-3 space-y-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={runResult.ok ? "gold" : "rose"} className="font-mono">
                        <GlowDot color={runResult.ok ? "gold" : "rose"} size="h-1.5 w-1.5" />
                        {runResult.status}
                      </Pill>
                      <span className="text-[0.65rem] font-mono text-[#33544C]">
                        {runResult.consensus.votersOk}/{runResult.consensus.votersAsked} voters
                        {runResult.consensus.agreement !== null && ` · agreement ${(runResult.consensus.agreement * 100).toFixed(0)}%`}
                        {` · ${(runResult.consensus.durationMs / 1000).toFixed(1)}s`}
                        {runResult.consensus.runId && ` · ${runResult.consensus.runId}`}
                      </span>
                    </div>
                    {runResult.result?.answer && (
                      <p className="text-[0.82rem] leading-relaxed text-[#0E1F1B] whitespace-pre-wrap">
                        {runResult.result.answer}
                        {runResult.result.confidence && (
                          <span className="ml-2 text-[0.62rem] font-mono text-[#7A8C86]">[{runResult.result.confidence}]</span>
                        )}
                      </p>
                    )}
                    {runResult.result?.caveat && (
                      <p className="text-[0.65rem] text-[#5B6E68] italic">{runResult.result.caveat}</p>
                    )}
                    <div className="space-y-1">
                      {runResult.consensus.votes.map((v) => (
                        <div key={`${v.provider}/${v.model}`} className="flex items-center justify-between gap-2 text-[0.62rem] font-mono">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <GlowDot color={v.ok && v.parsed ? "gold" : "rose"} size="h-1 w-1" />
                            <span className="text-[#7A8C86] truncate">{v.provider}/{v.model}</span>
                          </span>
                          <span className="text-[#33544C] whitespace-nowrap">
                            {v.ok && v.parsed ? `${v.latencyMs}ms${v.fieldAgreement !== undefined ? ` · agree ${(v.fieldAgreement * 100).toFixed(0)}%` : ""}` : (v.error?.slice(0, 40) ?? "failed")}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[0.6rem] text-[#7A8C86]">{runResult.disclaimer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ---------- Recent runs (attestation trail) ---------- */}
            {recentRuns.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Network className="h-3 w-3 text-mtqs-gold/70" aria-hidden="true" />
                  <span className="text-[0.62rem] uppercase tracking-[0.18em] text-[#5B6E68]">
                    Recent consensus runs (persisted attestations)
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-md border border-[#E3EAE6] divide-y divide-[#EEF3F0]">
                  {recentRuns.map((r) => (
                    <div key={r.id} className="px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <GlowDot color={r.quorum ? "gold" : "amber"} size="h-1 w-1" />
                        <span className="text-[0.7rem] font-medium text-[#0E1F1B]">{r.taskType}</span>
                        <span className="text-[0.6rem] font-mono text-[#7A8C86]">{r.id}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[0.6rem] font-mono text-[#33544C]">
                        <span>{r.votersOk}/{r.votersAsked}</span>
                        {r.agreement !== null && <span>· {(r.agreement * 100).toFixed(0)}%</span>}
                        {r.durationMs !== null && <span>· {(r.durationMs / 1000).toFixed(1)}s</span>}
                        <span className={r.quorum ? "text-emerald-700" : "text-mtqs-amber"}>{r.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---------- Footer policy ---------- */}
            <div className="pt-3 border-t border-[#E3EAE6]">
              <p className="text-[0.62rem] text-[#5B6E68] leading-relaxed">{status?.policy}</p>
            </div>
          </div>
        )}
      </Panel>
    </Reveal>
  );
}

export default AIConsensusPanel;
