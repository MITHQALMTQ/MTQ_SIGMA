// ============================================================================
// MTQΣ — Task 47: FREE-TIER MULTI-PROVIDER AI CONSENSUS ENGINE
// ----------------------------------------------------------------------------
// Owner directive 2026-11-06 (verbatim): "be sure we connect to totally free
// api open source that is totaly free and no billing ever needed … All AI
// models work in consensus and remove all z.ai … check all models for each
// AI model, and be sure to use what is best for the tasks, and can use couple
// of models in the same AI model."
//
// WHAT CHANGED vs the Task-P1 fallback chain (model-fallback.ts):
//   OLD: one model answered; providers were tried sequentially until one
//        succeeded (single-source output, no cross-checking).
//   NEW: EVERY AI feature fans the same prompt out to a multi-provider voter
//        panel (NVIDIA NIM + OpenRouter — the two providers whose keys passed
//        the 2026-11-06 live validation — plus Google AI Studio Gemini since
//        the 2026-11-08 key re-validation), then aggregates:
//          * structured JSON  → field-level majority vote (exact canonical
//                               value comparison; roster-priority tie-break)
//          * prose            → medoid draft (the draft with the highest mean
//                               pairwise lexical similarity to the others)
//        Quorum = ceil(k/2) voters parse OK. Every run + every vote is
//        persisted (ConsensusRun/ConsensusVote) — a machine-checkable
//        attestation trail, in the platform's audit culture.
//
// LIVE-VALIDATED ROSTER (probe evidence: scripts/ai/*.ts, 2026-11-06):
//   NVIDIA  ✅ auth OK, 84-model catalog; working chat endpoints:
//            mistralai/mistral-large-4-1t-a52b   2.1s   (anchor — 1T-param MoE)
//            meta/llama-3.2-90b-vision-instruct 15.3s  (verifier)
//            google/gemma-4-31b-it              30.0s  (verifier, cold-start)
//            poolside/laguna-xs-2.1              0.26s (fast)
//            nvidia/nemotron-3.5-bolt-e4b        0.36s (fast)
//   OPENROUTER ✅ auth OK; $0-pricing ("free") models that generate:
//            xingchen-agi/xing4.0-29b-a4b:free   0.85s (verifier)
//            openrouter/free                     0.77s (anchor meta-router)
//   GEMINI  ✅ key re-validated 2026-11-08 (owner-supplied AQ.…-format key;
//            the OLD AIza… key was leak-revoked). Live model IDs probe-
//            verified: gemini-3.8-flash (current gen — Google's retirement
//            notice) · gemini-3.5-flash. CAVEAT: the sandbox egress region
//            is geo-blocked by Google (400 FAILED_PRECONDITION "User
//            location is not supported") — generation serves from supported
//            regions (e.g. the Vercel US deploy target). Geo-fails are FAST
//            (~0.2s) so a blocked voter never burns the panel budget.
//   REMOVED (not working — see .env header): Groq 403 · HuggingFace
//   402-paywall (zero free models on the router, re-probed 2026-11-08).
//   z.ai/zai-org models (e.g. NVIDIA z-ai/glm-5.3-flash) are EXCLUDED BY
//   POLICY per the owner's "remove all z.ai" directive.
//
// HONEST CONTRACT: AI output is ADVISORY ONLY — never writes engine state,
// never modifies reserves, never triggers rebalance. Persistence failures are
// swallowed (best-effort) so the AI layer can never take the pilot down.
// ============================================================================

import { createHash } from "node:crypto";
import { createClient } from "@libsql/client";
import { db } from "@/lib/db";
import { hasKey, type AIProvider } from "./keys";

// ---------------------------------------------------------------------------
// The validated consensus roster
// ---------------------------------------------------------------------------

export type ConsensusRole = "anchor" | "verifier" | "fast";

export interface RosterEntry {
  provider: "nvidia" | "openrouter" | "gemini";
  model: string;
  role: ConsensusRole;
  /** roster priority — lower = preferred (tie-break in majority votes) */
  priority: number;
  /** per-model timeout budget (ms) — measured latency × safety factor */
  timeoutMs: number;
  /** measured first-token latency from the Task-47 probe (display) */
  probeLatencyMs: number;
  note: string;
}

export const CONSENSUS_ROSTER: readonly RosterEntry[] = Object.freeze([
  {
    provider: "nvidia",
    model: "mistralai/mistral-large-4-1t-a52b",
    role: "anchor",
    priority: 1,
    timeoutMs: 45_000,
    probeLatencyMs: 2095,
    note: "1T-param MoE — strongest single reasoner on the validated set",
  },
  {
    provider: "openrouter",
    model: "openrouter/free",
    role: "anchor",
    priority: 2,
    timeoutMs: 30_000,
    probeLatencyMs: 773,
    note: "OpenRouter meta-router — auto-selects a live free endpoint",
  },
  {
    provider: "openrouter",
    model: "xingchen-agi/xing4.0-29b-a4b:free",
    role: "verifier",
    priority: 3,
    timeoutMs: 30_000,
    probeLatencyMs: 850,
    note: "29B MoE — independent family cross-check (2nd provider)",
  },
  {
    provider: "nvidia",
    model: "nvidia/nemotron-3.5-bolt-e4b",
    role: "fast",
    priority: 4,
    timeoutMs: 20_000,
    probeLatencyMs: 360,
    note: "sub-second MoE — fast classification/drafting vote",
  },
  {
    provider: "nvidia",
    model: "poolside/laguna-xs-2.1",
    role: "fast",
    priority: 5,
    timeoutMs: 20_000,
    probeLatencyMs: 258,
    note: "fastest validated endpoint — 258ms probe",
  },
  {
    provider: "nvidia",
    model: "meta/llama-3.2-90b-vision-instruct",
    role: "verifier",
    priority: 6,
    timeoutMs: 45_000,
    probeLatencyMs: 15_305,
    note: "90B — slow but strong verifier (5-voter panels only)",
  },
  {
    provider: "nvidia",
    model: "google/gemma-4-31b-it",
    role: "verifier",
    priority: 7,
    timeoutMs: 45_000,
    probeLatencyMs: 30_006,
    note: "cold-start heavy — 5-voter panels only",
  },
  {
    provider: "gemini",
    model: "gemini-3.8-flash",
    role: "anchor",
    priority: 8,
    timeoutMs: 30_000,
    probeLatencyMs: 0,
    note: "Google AI Studio current-gen flash — key re-validated 2026-11-08; sandbox egress geo-blocked (fast-fail 400 in ~0.2s), serves from supported regions",
  },
  {
    provider: "gemini",
    model: "gemini-3.5-flash",
    role: "verifier",
    priority: 9,
    timeoutMs: 30_000,
    probeLatencyMs: 0,
    note: "previous-gen flash still serving — cross-gen verifier within Google AI Studio",
  },
] as const);

/** Default voter panels. Panel selection guarantees ≥2 providers whenever
 *  both provider keys are present (the consensus requirement), and every
 *  panel is ordered anchor-first so the field-majority tie-break prefers
 *  the strongest models.
 *
 *  Capability note (live-validated 2026-11-06): mistral-large-4-1t is the
 *  strongest reasoner but throttles on LONG outputs (>30s for ~700 tokens)
 *  and xing4.0-29B struggles with complex multi-paragraph instructions — so
 *  long-prose tasks (briefing) pass an explicit fast panel instead. */
const PANEL_3 = ["mistralai/mistral-large-4-1t-a52b", "gemini-3.8-flash", "xingchen-agi/xing4.0-29b-a4b:free", "nvidia/nemotron-3.5-bolt-e4b"] as const;
const PANEL_5 = [
  ...PANEL_3,
  "openrouter/free",
  "poolside/laguna-xs-2.1",
  "gemini-3.5-flash",
] as const;
/** Fast instruction-followers spanning all keyed providers — the panel for
 *  long-context and long-prose tasks (briefing · QA · risk-signals). Live
 *  evidence: mistral-large-4 times out on ≥4KB contexts and xing4.0 rambles
 *  unparseably on complex instructions, while these three parse reliably.
 *  (xing4.0 handles SHORT JSON prompts fine — it is the reliable OpenRouter
 *  voter here; the openrouter/free meta-router intermittently 404s ZDR /
 *  429s upstream.) */
export const PANEL_FAST = ["nvidia/nemotron-3.5-bolt-e4b", "poolside/laguna-xs-2.1", "xingchen-agi/xing4.0-29b-a4b:free", "gemini-3.8-flash"] as const;

function providerKeyPresent(p: "nvidia" | "openrouter" | "gemini"): boolean {
  return hasKey(p as AIProvider);
}

/** Pick the voter panel for a run: the requested size, filtered to models
 *  whose provider key is present, ensuring ≥2 providers when possible. */
function selectVoters(size: 3 | 5, panel?: readonly string[]): RosterEntry[] {
  const names = panel ?? (size === 5 ? PANEL_5 : PANEL_3);
  const picked = names
    .map((m) => CONSENSUS_ROSTER.find((r) => r.model === m))
    .filter((r): r is RosterEntry => !!r && providerKeyPresent(r.provider));
  const providers = new Set(picked.map((v) => v.provider));
  // Degradation: if only one provider's key is present, fill from that
  // provider's remaining roster entries so the panel still has k voters.
  if (providers.size < 2 && picked.length < size) {
    const lone = picked[0]?.provider ?? "nvidia";
    for (const r of CONSENSUS_ROSTER) {
      if (picked.length >= size) break;
      if (r.provider === lone && !picked.some((p) => p.model === r.model)) picked.push(r);
    }
  }
  return picked;
}

// ---------------------------------------------------------------------------
// Unified OpenAI-compatible caller (NVIDIA + OpenRouter speak it; Gemini has
// its own generateContent caller below)
// ---------------------------------------------------------------------------

const ENDPOINTS: Record<"nvidia" | "openrouter" | "gemini", string> = {
  nvidia: "https://integrate.api.nvidia.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  // Google AI Studio (Gemini) is NOT OpenAI-compatible: the model rides the
  // request path and the body is contents/parts — handled in callModelOnce.
  gemini: "https://generativelanguage.googleapis.com/v1beta",
};

function apiKey(p: "nvidia" | "openrouter" | "gemini"): string {
  const k = { nvidia: process.env.NVIDIA_API_KEY, openrouter: process.env.OPENROUTER_API_KEY, gemini: process.env.GEMINI_API_KEY };
  return (k[p] ?? "") as string;
}

export interface VoteMessage {
  role: "system" | "user";
  content: string;
}

async function callModel(
  entry: RosterEntry,
  messages: VoteMessage[],
  opts: { maxTokens: number; temperature: number },
): Promise<{ ok: true; content: string; latencyMs: number } | { ok: false; error: string; latencyMs: number }> {
  let r = await callModelOnce(entry, messages, opts);
  // Free-tier resilience: one retry on 429 (upstream rate-limit) or an
  // intermittent "empty content" (NVIDIA mistral endpoint load-balances
  // across instances, some of which return empty bodies).
  if (
    !r.ok &&
    (/HTTP 429/.test(r.error) || r.error === "empty content") &&
    r.latencyMs < entry.timeoutMs - 2500
  ) {
    await new Promise((res) => setTimeout(res, 1500));
    r = await callModelOnce(entry, messages, opts);
  }
  return r;
}

async function callModelOnce(
  entry: RosterEntry,
  messages: VoteMessage[],
  opts: { maxTokens: number; temperature: number },
): Promise<{ ok: true; content: string; latencyMs: number } | { ok: false; error: string; latencyMs: number }> {
  const t0 = Date.now();
  try {
    if (entry.provider === "gemini") return await callGeminiOnce(entry, messages, opts, t0);
    const res = await fetch(ENDPOINTS[entry.provider], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey(entry.provider)}`,
        ...(entry.provider === "openrouter"
          ? { "HTTP-Referer": "https://mtq-sigma.vercel.app", "X-Title": "MTQ-Sigma Pilot" }
          : {}),
      },
      body: JSON.stringify({
        model: entry.model,
        messages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        top_p: 1,
      }),
      signal: AbortSignal.timeout(entry.timeoutMs),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      return { ok: false, error: `HTTP ${res.status}: ${body}`, latencyMs };
    }
    const data = await res.json() as any;
    const content: string = data.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) return { ok: false, error: "empty content", latencyMs };
    return { ok: true, content, latencyMs };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.slice(0, 200), latencyMs: Date.now() - t0 };
  }
}

/** Google AI Studio (Gemini) — generateContent protocol (NOT OpenAI-
 *  compatible). The key passes as a query param (the documented AI Studio
 *  auth mode; the 2026-11-08 AQ.…-format key is accepted there). The system
 *  message becomes systemInstruction; multi-part text replies are joined.
 *  A geo-blocked egress fails FAST (HTTP 400 in ~0.2s) and the honest error
 *  string is persisted on the vote attestation. */
async function callGeminiOnce(
  entry: RosterEntry,
  messages: VoteMessage[],
  opts: { maxTokens: number; temperature: number },
  t0: number,
): Promise<{ ok: true; content: string; latencyMs: number } | { ok: false; error: string; latencyMs: number }> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const user = messages.filter((m) => m.role !== "system").map((m) => m.content).join("\n\n");
  const url = `${ENDPOINTS.gemini}/models/${entry.model}:generateContent?key=${encodeURIComponent(apiKey("gemini"))}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: opts.maxTokens, temperature: opts.temperature },
      }),
      signal: AbortSignal.timeout(entry.timeoutMs),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      return { ok: false, error: `HTTP ${res.status}: ${body}`, latencyMs };
    }
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
    const content = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => (typeof p.text === "string" ? p.text : ""))
      .join("");
    if (!content.trim()) return { ok: false, error: "empty content", latencyMs };
    return { ok: true, content, latencyMs };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.slice(0, 200), latencyMs: Date.now() - t0 };
  }
}

// ---------------------------------------------------------------------------
// JSON extraction + canonicalization
// ---------------------------------------------------------------------------

/** Placeholder-shaped value detection — some small models echo the JSON
 *  example back literally ({"answer": "<text>"}) or emit degenerate
 *  ellipsis-only content ("...", "[...]"). Such votes carry no real content
 *  and must NOT count toward quorum or win a medoid. */
const PLACEHOLDER_RE = /^<?\s*(string|text|placeholder|your\s+[a-z0-9 ]{3,40}|[a-z0-9-]+(\s+[a-z0-9-]+){0,4}\s+here)\s*>?$/i;
const ELLIPSIS_ONLY_RE = /^[.\s\[…\]]*$/;

function hasPlaceholderValue(v: unknown): boolean {
  if (typeof v === "string") {
    const t = v.trim();
    if (t.length === 0) return false; // empties handled elsewhere
    if (ELLIPSIS_ONLY_RE.test(t)) return true;
    return PLACEHOLDER_RE.test(t) || /^<[^>]{1,60}>$/.test(t);
  }
  if (Array.isArray(v)) return v.some(hasPlaceholderValue);
  if (v && typeof v === "object") return Object.values(v).some(hasPlaceholderValue);
  return false;
}

/** Extract the first balanced JSON object/array from model output (models
 *  wrap JSON in prose or ```json fences despite instructions). */
export function extractJson(raw: string): unknown | null {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  for (const [open, close] of [["{", "}"], ["[", "]"]] as const) {
    const start = cleaned.indexOf(open);
    if (start === -1) continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(cleaned.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  // last resort: whole string
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/** Canonical string for exact value comparison in majority votes. */
function canon(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "nonfinite";
  if (typeof v === "string") return v.trim().toLowerCase();
  if (Array.isArray(v)) return `[${v.map(canon).join("|")}]`;
  if (typeof v === "object") {
    const keys = Object.keys(v as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${k}:${canon((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return String(v);
}

/** Lexical similarity (token-set Jaccard) for medoid draft selection. */
function jaccard(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().match(/[a-z0-9§.]+/g) ?? []);
  const tb = new Set(b.toLowerCase().match(/[a-z0-9§.]+/g) ?? []);
  if (ta.size === 0 && tb.size === 0) return 1;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

function sha16(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// The consensus run
// ---------------------------------------------------------------------------

export type AggregationMode = "field-majority" | "medoid" | "signal-merge";

export interface ConsensusTask {
  taskType: "briefing" | "qa" | "risk-signals" | "adhoc" | "audit-crosscheck";
  system: string;
  user: string;
  /** JSON-mode: votes must be JSON objects → field-majority vote.
   *  Medoid-mode: votes must be JSON with ONE prose field (proseField) →
   *  medoid draft wins, other fields still majority-voted.
   *  Signal-merge-mode: votes are JSON arrays (or {signals: [...]}) → items
   *  clustered by title similarity; clusters with quorum support win. */
  mode: AggregationMode;
  proseField?: string;
  voters?: 3 | 5;
  /** Explicit voter models (roster names) — overrides the default panel.
   *  Used by long-prose tasks that need fast instruction-followers. */
  panel?: readonly string[];
  maxTokens?: number;
  temperature?: number;
}

export interface VoteRecord {
  provider: string;
  model: string;
  role: ConsensusRole;
  ok: boolean;
  latencyMs: number;
  parsed: boolean;
  error?: string;
  contentDigest?: string;
  /** fraction of majority-fields where this vote matched the winner */
  fieldAgreement?: number;
}

export interface ConsensusResult<T = Record<string, unknown>> {
  ok: boolean;
  status: "CONSENSUS" | "NO-QUORUM" | "ALL-FAILED";
  /** the winning aggregated value (null when failed) */
  result: T | null;
  votes: VoteRecord[];
  votersAsked: number;
  votersOk: number;
  quorumMet: boolean;
  /** 0..1 — mean field-level agreement with the winner (JSON mode) or mean
   *  pairwise lexical similarity of the medoid (medoid mode) */
  agreement: number | null;
  winner?: string; // "<provider>/<model>" — the draft source (medoid mode)
  durationMs: number;
  runId?: string; // DB attestation id (best-effort)
  promptDigest: string;
}

const JSON_INSTRUCTION =
  'Respond with ONLY a single valid JSON value (object or array) — no prose, no markdown fences, no commentary. Replace any <placeholder> in the requested shape with your actual content.';

export async function runConsensus<T = Record<string, unknown>>(task: ConsensusTask): Promise<ConsensusResult<T>> {
  const t0 = Date.now();
  const voters = selectVoters(task.voters ?? 3, task.panel);
  const messages: VoteMessage[] = [
    { role: "system", content: task.system },
    { role: "user", content: task.user + (task.mode === "field-majority" || task.mode === "medoid" ? `\n\n${JSON_INSTRUCTION}` : "") },
  ];
  const promptDigest = sha16(task.system + "\x00" + task.user);

  // ---- fan out (all voters in parallel — this IS the consensus) ----------
  const settled = await Promise.allSettled(
    voters.map((v) => callModel(v, messages, { maxTokens: task.maxTokens ?? 1024, temperature: task.temperature ?? 0.2 })),
  );

  interface VoteData {
    entry: RosterEntry;
    call: Awaited<ReturnType<typeof callModel>> | null;
    json: Record<string, unknown> | null;
    rejectReason?: string;
  }
  const voteData: VoteData[] = voters.map((entry, i) => {
    const s = settled[i];
    const call = s.status === "fulfilled" ? s.value : null;
    let json = call && call.ok ? extractJson(call.content) : null;
    let rejectReason: string | undefined;
    if (Array.isArray(json)) json = { signals: json };
    if (json && typeof json === "object" && !Array.isArray(json)) {
      const keys = Object.keys(json as Record<string, unknown>);
      const hasArrayField = keys.some((k) => Array.isArray((json as Record<string, unknown>)[k]));
      // single signal-shaped object → normalize to a 1-item signals list
      // (models emit one object instead of an array when exactly one risk
      // is worth reporting — live-observed on the risk-signals task)
      const looksLikeSignal = keys.includes("title") && (keys.includes("severity") || keys.includes("source"));
      if (!hasArrayField && looksLikeSignal) {
        json = { signals: [json] };
      }
      if (hasPlaceholderValue(json)) {
        rejectReason = "placeholder content (echoed the JSON example)";
        json = null;
      }
    } else {
      json = null;
    }
    return { entry, call, json: json as Record<string, unknown> | null, rejectReason };
  });

  const votes: VoteRecord[] = voteData.map((d) => {
    if (!d.call) {
      const s = settled[voteData.indexOf(d)];
      return {
        provider: d.entry.provider,
        model: d.entry.model,
        role: d.entry.role,
        ok: false,
        latencyMs: 0,
        parsed: false,
        error: String((s as PromiseRejectedResult).reason).slice(0, 200),
      };
    }
    if (!d.call.ok) {
      return { provider: d.entry.provider, model: d.entry.model, role: d.entry.role, ok: false, latencyMs: d.call.latencyMs, parsed: false, error: d.call.error };
    }
    return {
      provider: d.entry.provider,
      model: d.entry.model,
      role: d.entry.role,
      ok: true,
      latencyMs: d.call.latencyMs,
      parsed: d.json !== null,
      contentDigest: sha16(d.call.content),
      error: d.rejectReason ?? (d.json === null ? "unparseable JSON" : undefined),
    };
  });

  // ---- aggregate ----------------------------------------------------------
  const parsedVotes = voteData.filter((d): d is VoteData & { json: Record<string, unknown> } => d.json !== null && d.call !== null && d.call.ok);

  const k = voters.length;
  const quorumNeeded = Math.ceil(k / 2);
  let result: Record<string, unknown> | null = null;
  let agreement: number | null = null;
  let winner: string | undefined;

  if (parsedVotes.length >= quorumNeeded && parsedVotes.length > 0) {
    if (task.mode === "field-majority") {
      ({ result, agreement } = fieldMajority(parsedVotes.map((p) => p.json!), parsedVotes.map((p) => p.entry.priority)));
      // per-vote field agreement
      for (const p of parsedVotes) {
        const fields = Object.keys(result!);
        let match = 0;
        for (const f of fields) if (canon(p.json![f]) === canon(result![f])) match++;
        votes[voteData.indexOf(p)].fieldAgreement = fields.length ? match / fields.length : 1;
      }
    } else if (task.mode === "signal-merge") {
      // cluster signal-like items by title similarity; quorum-supported clusters win
      const merged = signalMerge(parsedVotes, quorumNeeded);
      result = merged.result;
      agreement = merged.agreement;
      for (const p of parsedVotes) {
        const own = Array.isArray(p.json!.signals) ? (p.json!.signals as unknown[]).length : 0;
        votes[voteData.indexOf(p)].fieldAgreement = own ? Math.min(1, merged.keptCount / Math.max(own, merged.keptCount)) : 0;
      }
      if (result) winner = `signal-merge(${parsedVotes.length} votes, ${merged.keptCount} signals)`;
    } else {
      // medoid on the prose field; majority on the other fields
      const proseField = task.proseField ?? "text";
      const others = parsedVotes.map((p) => {
        const clone = { ...p.json! };
        delete clone[proseField];
        return clone;
      });
      const major = fieldMajority(others, parsedVotes.map((p) => p.entry.priority));
      const proses = parsedVotes.map((p) => String(p.json![proseField] ?? ""));
      let bestIdx = 0;
      let bestScore = -1;
      for (let a = 0; a < proses.length; a++) {
        let mean = 0;
        for (let b = 0; b < proses.length; b++) mean += a === b ? 1 : jaccard(proses[a], proses[b]);
        mean /= proses.length;
        if (mean > bestScore) { bestScore = mean; bestIdx = a; }
      }
      result = { ...major.result, [proseField]: proses[bestIdx] };
      agreement = bestScore;
      winner = `${parsedVotes[bestIdx].entry.provider}/${parsedVotes[bestIdx].entry.model}`;
      for (const p of parsedVotes) {
        const fields = Object.keys(major.result);
        let match = 0;
        for (const f of fields) if (canon(p.json![f]) === canon(major.result[f])) match++;
        votes[voteData.indexOf(p)].fieldAgreement = fields.length ? match / fields.length : 1;
      }
    }
  }

  const votersOk = votes.filter((v) => v.ok).length;
  const status: ConsensusResult["status"] =
    result !== null ? "CONSENSUS" : votersOk > 0 ? "NO-QUORUM" : "ALL-FAILED";

  const out: ConsensusResult<T> = {
    ok: status === "CONSENSUS",
    status,
    result: result as T | null,
    votes,
    votersAsked: k,
    votersOk,
    quorumMet: result !== null,
    agreement,
    winner,
    durationMs: Date.now() - t0,
    promptDigest,
  };

  // ---- persist (best-effort — never breaks the response) ------------------
  out.runId = await persistRun(task.taskType, out as ConsensusResult<Record<string, unknown>>).catch(() => undefined);
  return out;
}

/** Field-level majority over an array of JSON objects. Ties broken by the
 *  roster priority of the supporting voters (first occurrence wins). */
function fieldMajority(objects: Array<Record<string, unknown>>, priorities: number[]): { result: Record<string, unknown>; agreement: number } {
  const allFields = new Set<string>();
  for (const o of objects) for (const k of Object.keys(o)) allFields.add(k);
  const result: Record<string, unknown> = {};
  for (const f of allFields) {
    const counts = new Map<string, { n: number; first: number; value: unknown }>();
    objects.forEach((o, idx) => {
      if (!(f in o)) return;
      const c = canon(o[f]);
      const cur = counts.get(c);
      if (cur) cur.n++;
      else counts.set(c, { n: 1, first: priorities[idx], value: o[f] });
    });
    if (counts.size === 0) continue;
    let best: { n: number; first: number; value: unknown } | null = null;
    for (const c of counts.values()) {
      if (!best || c.n > best.n || (c.n === best.n && c.first < best.first)) best = c;
    }
    result[f] = best!.value;
  }
  // agreement: mean over objects of matched-fields fraction
  let agreeSum = 0;
  const fields = Object.keys(result);
  for (const o of objects) {
    let match = 0;
    for (const f of fields) if (canon(o[f]) === canon(result[f])) match++;
    agreeSum += fields.length ? match / fields.length : 1;
  }
  return { result, agreement: objects.length ? agreeSum / objects.length : 0 };
}

// ---------------------------------------------------------------------------
// Signal-merge aggregation — cluster the items each voter proposed, keep the
// clusters with quorum support (the multi-model "agreement" for list output).
// ---------------------------------------------------------------------------

interface MergeableVote {
  entry: RosterEntry;
  json: Record<string, unknown>;
}

function signalMerge(parsedVotes: Array<MergeableVote & { json: Record<string, unknown> }>, quorumNeeded: number): { result: Record<string, unknown> | null; agreement: number | null; keptCount: number } {
  interface Proposal {
    vote: MergeableVote;
    item: Record<string, unknown>;
    title: string;
  }
  const proposals: Proposal[] = [];
  for (const v of parsedVotes) {
    // key-agnostic: accept {"signals": [...]} OR any single array-valued
    // field (models sometimes use riskSignals / items / data)
    const arr = Array.isArray(v.json.signals)
      ? (v.json.signals as unknown[])
      : Object.values(v.json).find((x) => Array.isArray(x)) as unknown[] | undefined;
    if (!arr) continue;
    for (const item of arr) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        proposals.push({ vote: v, item: item as Record<string, unknown>, title: String((item as Record<string, unknown>).title ?? "") });
      }
    }
  }
  if (proposals.length === 0) {
    console.error(
      `[ai-consensus] signal-merge found NO signal arrays — vote shapes: ${parsedVotes
        .map((v) => `${v.entry.model}:{${Object.keys(v.json).join(",")}}`)
        .join(" ")}`,
    );
    return { result: null, agreement: null, keptCount: 0 };
  }

  // greedy clustering by title similarity (Jaccard ≥ 0.34 — calibrated so
  // semantically-equal titles with different phrasings cluster, e.g.
  // "High Issuer Concentration Detected" vs "Issuer concentration risk" = 0.4)
  const clusters: Proposal[][] = [];
  for (const p of proposals) {
    let placed = false;
    for (const cl of clusters) {
      if (cl.some((q) => jaccard(p.title, q.title) >= 0.34)) {
        cl.push(p);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([p]);
  }

  // keep clusters whose DISTINCT-voter support meets quorum
  const kept: Proposal[][] = [];
  for (const cl of clusters) {
    const distinctVoters = new Set(cl.map((p) => p.vote.entry.model)).size;
    if (distinctVoters >= quorumNeeded) kept.push(cl);
  }
  if (kept.length === 0) {
    console.error(
      `[ai-consensus] signal-merge NO-QUORUM — clusters: ${clusters
        .map((cl) => `[${cl.map((p) => `${p.vote.entry.model}:"${p.title.slice(0, 50)}"`).join(" + ")}]`)
        .join(" ")} (quorum needs ${quorumNeeded} distinct voters per cluster)`,
    );
    return { result: null, agreement: null, keptCount: 0 };
  }

  // build each kept signal: majority severity, representative item from the
  // highest-priority (lowest number) voter in the cluster
  const signals: Array<Record<string, unknown>> = kept.map((cl) => {
    const sorted = [...cl].sort((a, b) => a.vote.entry.priority - b.vote.entry.priority);
    const rep = { ...sorted[0].item };
    // severity majority (fall back to the representative's)
    const sevCounts = new Map<string, number>();
    for (const p of cl) {
      const s = String(p.item.severity ?? "").toLowerCase();
      if (s) sevCounts.set(s, (sevCounts.get(s) ?? 0) + 1);
    }
    let bestSev = "";
    let bestN = 0;
    for (const [s, n] of sevCounts) if (n > bestN || (n === bestN && s < bestSev)) { bestSev = s; bestN = n; }
    if (bestSev) rep.severity = bestSev;
    rep.support = `${new Set(cl.map((p) => p.vote.entry.model)).size}/${parsedVotes.length}`;
    return rep;
  });
  // order: critical → warning → info, then by support desc (stable)
  const sevRank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  signals.sort((a, b) => (sevRank[String(a.severity).toLowerCase()] ?? 3) - (sevRank[String(b.severity).toLowerCase()] ?? 3));

  // agreement: mean over voters of the fraction of their proposals that
  // landed in kept clusters
  let agreeSum = 0;
  for (const v of parsedVotes) {
    const own = proposals.filter((p) => p.vote === v).length;
    const inKept = proposals.filter((p) => p.vote === v && kept.some((cl) => cl.includes(p))).length;
    agreeSum += own ? inKept / own : 1;
  }
  return {
    result: { signals: signals as unknown },
    agreement: parsedVotes.length ? agreeSum / parsedVotes.length : null,
    keptCount: signals.length,
  };
}

// ---------------------------------------------------------------------------
// Persistence — with boot-safe DDL (survives a stale-dump self-heal restore)
// ---------------------------------------------------------------------------

const DDL = [
  `CREATE TABLE IF NOT EXISTS "AiModelCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_PROBED',
    "latencyMs" INTEGER,
    "free" BOOLEAN NOT NULL DEFAULT true,
    "contextK" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'task47-live-probe',
    "lastProbedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "ConsensusRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskType" TEXT NOT NULL,
    "promptDigest" TEXT NOT NULL,
    "votersAsked" INTEGER NOT NULL,
    "votersOk" INTEGER NOT NULL,
    "quorum" BOOLEAN NOT NULL,
    "agreement" REAL,
    "status" TEXT NOT NULL,
    "resultJson" TEXT,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "ConsensusVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "latencyMs" INTEGER,
    "error" TEXT,
    "contentDigest" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS "AiModelCatalog_provider_status_idx" ON "AiModelCatalog"("provider", "status");`,
  `CREATE INDEX IF NOT EXISTS "AiModelCatalog_role_idx" ON "AiModelCatalog"("role");`,
  `CREATE INDEX IF NOT EXISTS "ConsensusRun_taskType_createdAt_idx" ON "ConsensusRun"("taskType", "createdAt");`,
  `CREATE INDEX IF NOT EXISTS "ConsensusRun_createdAt_idx" ON "ConsensusRun"("createdAt");`,
  `CREATE INDEX IF NOT EXISTS "ConsensusVote_runId_idx" ON "ConsensusVote"("runId");`,
  `CREATE INDEX IF NOT EXISTS "ConsensusVote_provider_model_createdAt_idx" ON "ConsensusVote"("provider", "model", "createdAt");`,
];

let tablesEnsured: Promise<void> | null = null;

/** Idempotent DDL guard — mirrors the Prisma schema exactly so a self-heal
 *  restore from a pre-Task-47 dump cannot break consensus persistence. */
export function ensureConsensusTables(): Promise<void> {
  if (!tablesEnsured) {
    tablesEnsured = (async () => {
      const url = process.env.DATABASE_URL ?? "file:/home/z/my-project/db/custom.db";
      const c = createClient({ url: url.startsWith("file:") ? url : `file:${url}` });
      try {
        await c.executeMultiple(DDL.join("\n"));
      } finally {
        c.close();
      }
    })().catch((e) => {
      // allow a retry on the next call if boot-time DDL failed
      tablesEnsured = null;
      throw e;
    });
  }
  return tablesEnsured;
}

async function persistRun(taskType: string, r: ConsensusResult): Promise<string | undefined> {
  try {
    await ensureConsensusTables();
    const runId = `cr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await db.consensusRun.create({
      data: {
        id: runId,
        taskType,
        promptDigest: r.promptDigest,
        votersAsked: r.votersAsked,
        votersOk: r.votersOk,
        quorum: r.quorumMet,
        agreement: r.agreement,
        status: r.status,
        resultJson: r.result ? JSON.stringify(r.result).slice(0, 20_000) : null,
        durationMs: r.durationMs,
      },
    });
    if (r.votes.length) {
      await db.consensusVote.createMany({
        data: r.votes.map((v) => ({
          runId,
          provider: v.provider,
          model: v.model,
          role: v.role,
          ok: v.ok && v.parsed,
          latencyMs: v.latencyMs,
          error: v.error?.slice(0, 300) ?? null,
          contentDigest: v.contentDigest ?? null,
        })),
      });
    }
    return runId;
  } catch (e) {
    console.error("[ai-consensus] persist failed (best-effort, ignored):", e instanceof Error ? e.message : e);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Status view (for /api/ai/status + the dashboard consensus panel)
// ---------------------------------------------------------------------------

export interface ConsensusStatusView {
  providers: Array<{ provider: string; keyPresent: boolean; endpoint: string; rosterModels: number }>;
  roster: Array<{ provider: string; model: string; role: ConsensusRole; probeLatencyMs: number; timeoutMs: number; note: string; excluded: boolean }>;
  defaults: { voters: number; quorumRule: string; agreementRule: string };
  catalog: { total: number; working: number; excluded: number; byProvider: Record<string, number> } | null;
  recentRuns: Array<{ id: string; taskType: string; status: string; votersOk: number; votersAsked: number; quorum: boolean; agreement: number | null; durationMs: number | null; createdAt: string; votes: Array<{ provider: string; model: string; role: string; ok: boolean; latencyMs: number | null; error: string | null }> }>;
  policy: string;
}

export async function getConsensusStatus(limitRuns = 8): Promise<ConsensusStatusView> {
  const roster = CONSENSUS_ROSTER.map((r) => ({ ...r, excluded: false }));
  const providers = (["nvidia", "openrouter", "gemini"] as const).map((p) => ({
    provider: p,
    keyPresent: providerKeyPresent(p),
    endpoint: ENDPOINTS[p],
    rosterModels: CONSENSUS_ROSTER.filter((r) => r.provider === p).length,
  }));

  let catalog: ConsensusStatusView["catalog"] = null;
  let recentRuns: ConsensusStatusView["recentRuns"] = [];
  try {
    await ensureConsensusTables();
    const [total, working, excluded, byProv] = await Promise.all([
      db.aiModelCatalog.count(),
      db.aiModelCatalog.count({ where: { status: "WORKING" } }),
      db.aiModelCatalog.count({ where: { status: "EXCLUDED" } }),
      db.aiModelCatalog.groupBy({ by: ["provider"], _count: { _all: true } }),
    ]);
    catalog = {
      total,
      working,
      excluded,
      byProvider: Object.fromEntries(byProv.map((g) => [g.provider, g._count._all])),
    };
    const runs = await db.consensusRun.findMany({ orderBy: { createdAt: "desc" }, take: limitRuns });
    if (runs.length) {
      const allVotes = await db.consensusVote.findMany({
        where: { runId: { in: runs.map((r) => r.id) } },
        orderBy: { createdAt: "asc" },
      });
      recentRuns = runs.map((r) => ({
        id: r.id,
        taskType: r.taskType,
        status: r.status,
        votersOk: r.votersOk,
        votersAsked: r.votersAsked,
        quorum: r.quorum,
        agreement: r.agreement,
        durationMs: r.durationMs,
        createdAt: r.createdAt.toISOString(),
        votes: allVotes
          .filter((v) => v.runId === r.id)
          .map((v) => ({ provider: v.provider, model: v.model, role: v.role, ok: v.ok, latencyMs: v.latencyMs, error: v.error })),
      }));
    }
  } catch {
    // persistence unavailable — status still reports the static roster
  }

  return {
    providers,
    roster,
    defaults: {
      voters: 3,
      quorumRule: "≥ ceil(k/2) voters parse OK → quorum",
      agreementRule: "field-majority for JSON · medoid-draft for prose (mean pairwise lexical similarity)",
    },
    catalog,
    recentRuns,
    policy:
      "Free-tier providers only (no billing ever) — live-validated 2026-11-06; Gemini key re-validated 2026-11-08 (sandbox egress geo-blocked — serves from supported regions). z.ai/zai-org models excluded by owner directive. " +
      "AI output is ADVISORY ONLY — never writes engine state. Every run + vote persisted as an attestation.",
  };
}

// ---------------------------------------------------------------------------
// FRED macro grounding (owner directive: "use FRED where needed")
// ----------------------------------------------------------------------------
// Official Federal Reserve Economic Data (VIX / DXY / London gold fix / US
// 10Y) injected into consensus prompts as a DATA MEMBER — every voter sees
// the identical official macro context, so their agreement/disagreement is
// about interpretation, never about diverging inputs. Best-effort: FRED
// being down never blocks a consensus run (empty string → no context line).
// 5-minute cache so a 3-voter fan-out + retries cost one FRED round-trip.

export interface FredContext {
  vix: number | null;
  dxy: number | null;
  gold: number | null;
  treasury10y: number | null;
  fetchedAt: string;
}

let fredCache: { at: number; ctx: FredContext } | null = null;
const FRED_CACHE_MS = 5 * 60 * 1000;

export async function getFredContext(): Promise<string> {
  try {
    if (!process.env.FRED_API_KEY) return "";
    if (fredCache && Date.now() - fredCache.at < FRED_CACHE_MS) {
      return formatFred(fredCache.ctx);
    }
    const { fetchFredSeries, FRED_SERIES } = await import("@/lib/mtq/fred");
    const [vix, dxy, gold, y10] = await Promise.all([
      fetchFredSeries(FRED_SERIES.VIX, 1).catch(() => null),
      fetchFredSeries(FRED_SERIES.DXY, 1).catch(() => null),
      fetchFredSeries(FRED_SERIES.GOLD_LONDON, 1).catch(() => null),
      fetchFredSeries(FRED_SERIES.TREASURY_10Y, 1).catch(() => null),
    ]);
    const ctx: FredContext = {
      vix: vix?.latestValue ?? null,
      dxy: dxy?.latestValue ?? null,
      gold: gold?.latestValue ?? null,
      treasury10y: y10?.latestValue ?? null,
      fetchedAt: new Date().toISOString(),
    };
    fredCache = { at: Date.now(), ctx };
    return formatFred(ctx);
  } catch {
    return ""; // FRED context is best-effort grounding, never fatal
  }
}

function formatFred(ctx: FredContext): string {
  const parts: string[] = [];
  if (ctx.vix != null) parts.push(`VIX ${ctx.vix.toFixed(2)}`);
  if (ctx.dxy != null) parts.push(`DXY ${ctx.dxy.toFixed(2)}`);
  if (ctx.gold != null) parts.push(`Gold $${ctx.gold.toFixed(0)}/oz (London fix)`);
  if (ctx.treasury10y != null) parts.push(`US 10Y ${ctx.treasury10y.toFixed(2)}%`);
  if (parts.length === 0) return "";
  return `Official macro context (FRED, Federal Reserve Economic Data): ${parts.join(", ")}.`;
}
