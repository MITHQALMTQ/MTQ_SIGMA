// MTQΣ — Cross-vendor multi-model AI consensus engine.
//
// DESIGN (owner directive, 2026-11-06): every AI capability in the terminal
// (briefing / QA / risk-signals / screen) is answered by a CONSENSUS of
// independent vendors rather than a single model:
//
//   1. FAN-OUT     — the prompt is sent to every healthy consensus member in
//                    parallel (5 free open-source vendors + the platform LLM
//                    bootstrap member).
//   2. COLLECT     — successful responses are collected with full provenance
//                    (vendor, model, latency, raw content).
//   3. AGREE       — pairwise text agreement is scored (Jaccard similarity on
//                    salient tokens); the response with the highest mean
//                    agreement to its peers is the "centroid" answer.
//   4. SYNTHESIZE  — the centroid content is returned as the consensus answer;
//                    dissent (member responses that disagree strongly) is
//                    recorded, never discarded silently.
//
// Degradation ladder (honest, never fabricated):
//   ≥2 members answer  → mode "consensus"  (agreement score reported)
//    1 member  answers → mode "single-source" (labelled as such)
//    0 members answer  → mode unavailable; the caller falls back to the
//                        deterministic rule-based generator. AI output is
//                        ADVISORY ONLY — it never writes engine state.
//
// MEMBER HEALTH: every member call updates a module-level health map. A
// member that fails (bad key, credits exhausted, network) is placed in a
// 10-minute cooldown and skipped — dead keys never burn request latency.
// `GET /api/ai/status` exposes the live board.
//
// The empty-key discipline: a member without a key never enters the pool —
// which is why revoked/unrecoverable keys are simply left out of .env; pasting
// a fresh key joins the consensus with zero code changes.
//
// This module is SERVER-SIDE ONLY (never import from a client component).

import type { MetricsSnapshot } from "@/lib/mtq/engine";

export type MemberId =
  | "groq"
  | "openrouter"
  | "nvidia"
  | "gemini"
  | "huggingface"
  | "platform";

export type ConsensusMode = "consensus" | "single-source" | "unavailable";

export interface MemberDef {
  id: MemberId;
  /** Display vendor name (board UI). */
  vendor: string;
  /** Ordered model candidates — the first that the vendor accepts is used. */
  models: string[];
  /** Env var holding the API key (empty → member not in the pool). */
  keyEnv: string;
  /** Wire protocol used to talk to this member. */
  kind: "openai-compatible" | "gemini" | "hf-router" | "platform";
  endpoint: string;
  /** True for the sandbox platform LLM bootstrap member. */
  bootstrap?: boolean;
}

export interface MemberHealth {
  id: MemberId;
  vendor: string;
  model: string;
  configured: boolean;
  healthy: boolean;
  lastError?: string;
  latencyMs?: number;
  cooldownUntil?: number;
}

export interface MemberResponse {
  id: MemberId;
  vendor: string;
  model: string;
  content: string;
  latencyMs: number;
}

export interface ConsensusResult {
  success: boolean;
  provider: MemberId | "fallback";
  vendor: string;
  model: string;
  content: string;
  mode: ConsensusMode;
  /** Mean pairwise agreement across answering members (0–1); null when
   *  fewer than two members answered. */
  agreement: number | null;
  /** Every member that answered (including dissenters), with provenance. */
  members: MemberResponse[];
  /** Board snapshot at call time (for /api/ai/status). */
  board: MemberHealth[];
  latencyMs: number;
  error?: string;
}

// ─── Member registry ───────────────────────────────────────────────────────
// The five free open-source vendors named in the owner directive, plus the
// platform LLM as a bootstrap member (AI_PLATFORM_ENABLED, default true) so
// the consensus machinery is demonstrable while external keys rotate in.
// Model notes (best-per-task, all free tiers, verified against each vendor's
// published catalog):
//   groq        — llama-3.3-70b-versatile: fastest 70B, 0.7 ctx, JSON-capable
//   openrouter  — meta-llama/llama-3.3-70b-instruct:free: region-agnostic
//   nvidia      — meta/llama-3.3-70b-instruct: NIM OpenAI-compatible
//   gemini      — gemini-2.0-flash-001: fast, generous free quota
//   huggingface — router chat completions (Llama-3.3-70B-Instruct)
//   platform    — sandbox LLM (GLM family) via z-ai-web-dev-sdk

export const MEMBER_REGISTRY: MemberDef[] = [
  {
    id: "groq",
    vendor: "Groq",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    keyEnv: "GROQ_API_KEY",
    kind: "openai-compatible",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
  },
  {
    id: "openrouter",
    vendor: "OpenRouter",
    models: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "meta-llama/llama-3.1-8b-instruct:free",
    ],
    keyEnv: "OPENROUTER_API_KEY",
    kind: "openai-compatible",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
  },
  {
    id: "nvidia",
    vendor: "NVIDIA NIM",
    models: ["meta/llama-3.3-70b-instruct", "meta/llama-3.1-8b-instruct"],
    keyEnv: "NVIDIA_API_KEY",
    kind: "openai-compatible",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
  },
  {
    id: "gemini",
    vendor: "Google AI Studio",
    models: ["gemini-2.0-flash-001", "gemini-2.0-flash"],
    keyEnv: "GEMINI_API_KEY",
    kind: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
  },
  {
    id: "huggingface",
    vendor: "Hugging Face",
    models: ["meta-llama/Llama-3.3-70B-Instruct"],
    keyEnv: "HUGGINGFACE_API_KEY",
    kind: "hf-router",
    endpoint: "https://router.huggingface.co/v1/chat/completions",
  },
  {
    id: "platform",
    vendor: "Platform LLM (sandbox)",
    models: ["platform-glm"],
    keyEnv: "AI_PLATFORM_ENABLED",
    kind: "platform",
    endpoint: "z-ai-web-dev-sdk",
    bootstrap: true,
  },
];

// ─── Health map (module-level, per server process) ─────────────────────────

interface HealthEntry {
  healthy: boolean;
  lastError?: string;
  latencyMs?: number;
  cooldownUntil: number;
  /** Model that produced the last success (sticky across calls). */
  stickyModel?: string;
}

const health = new Map<MemberId, HealthEntry>();
const COOLDOWN_MS = 10 * 60 * 1000;

function keyFor(def: MemberDef): string {
  // "platform" is gated by the AI_PLATFORM_ENABLED flag (default true);
  // external vendors by their API key env var.
  if (def.bootstrap) {
    const v = process.env[def.keyEnv];
    return v === undefined || v === "" ? "true" : v.trim().toLowerCase();
  }
  return (process.env[def.keyEnv] ?? "").trim();
}

function enabled(def: MemberDef): boolean {
  if (def.bootstrap) {
    const v = process.env[def.keyEnv];
    if (v === undefined || v === "") return true; // default true
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "on";
  }
  return keyFor(def).length > 0;
}

/** Live board snapshot — consumed by /api/ai/status and the UI board. */
export function getBoard(): MemberHealth[] {
  return MEMBER_REGISTRY.map((def) => {
    const h = health.get(def.id);
    const cfg = enabled(def);
    const cooling = h ? h.cooldownUntil > Date.now() : false;
    return {
      id: def.id,
      vendor: def.vendor,
      model: h?.stickyModel ?? def.models[0],
      configured: cfg,
      healthy: cfg && !cooling && (h ? h.healthy : true),
      lastError: cooling || !h ? h?.lastError : h.lastError,
      latencyMs: h?.latencyMs,
      cooldownUntil: h ? Math.max(0, h.cooldownUntil - Date.now()) : undefined,
    };
  });
}

// ─── z-ai platform member (lazy singleton) ─────────────────────────────────
// Server-side only; created on first use and reused for the process lifetime.

let platformClient: any = null;
let platformPromise: Promise<any> | null = null;

async function getPlatformClient(): Promise<any> {
  if (platformClient) return platformClient;
  if (!platformPromise) {
    platformPromise = (async () => {
      const mod = await import("z-ai-web-dev-sdk");
      const ZAI = (mod as any).default ?? mod;
      return ZAI.create();
    })().catch((e) => {
      platformPromise = null; // allow retry on next call
      throw e;
    });
  }
  platformClient = await platformPromise;
  return platformClient;
}

// ─── Per-member transports ─────────────────────────────────────────────────

const TIMEOUT_MS = 20_000;

async function callMember(
  def: MemberDef,
  messages: Array<{ role: string; content: string }>,
  opts: { maxTokens: number; temperature: number },
): Promise<{ content: string; model: string }> {
  // Model preference: sticky model from last success, else the first candidate.
  const sticky = health.get(def.id)?.stickyModel;
  const candidates = sticky
    ? [sticky, ...def.models.filter((m) => m !== sticky)]
    : def.models;

  let lastErr: unknown = null;
  for (const model of candidates) {
    try {
      const content = await transport(def, model, messages, opts);
      if (content && content.trim().length > 0) {
        const h = health.get(def.id);
        if (h) h.stickyModel = model;
        return { content, model };
      }
      lastErr = new Error(`${def.vendor} returned empty content`);
    } catch (e) {
      lastErr = e;
      // Auth/config errors are member-fatal (cooldown) — do not retry other
      // models on the same member for the same class of failure.
      const msg = String((e as Error)?.message ?? e);
      if (/HTTP 40[13]|Forbidden|leaked|not supported|credits/i.test(msg)) break;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function transport(
  def: MemberDef,
  model: string,
  messages: Array<{ role: string; content: string }>,
  opts: { maxTokens: number; temperature: number },
): Promise<string> {
  if (def.kind === "platform") {
    const client = await getPlatformClient();
    const res = await Promise.race([
      client.chat.completions.create({
        messages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
      }),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("platform timeout")), TIMEOUT_MS),
      ),
    ]);
    const content = res?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("platform: no content");
    return content;
  }

  if (def.kind === "gemini") {
    const key = keyFor(def);
    const url = `${def.endpoint}/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          maxOutputTokens: opts.maxTokens,
          temperature: opts.temperature,
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`${def.vendor} HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  if (def.kind === "hf-router") {
    const key = keyFor(def);
    const res = await fetch(def.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        stream: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`${def.vendor} HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  // openai-compatible: Groq · OpenRouter · NVIDIA
  const key = keyFor(def);
  const res = await fetch(def.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(def.id === "openrouter"
        ? { "HTTP-Referer": "https://mtq-sigma.vercel.app", "X-Title": "MTQ Sigma Pilot" }
        : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`${def.vendor} HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── Agreement analysis ────────────────────────────────────────────────────
// Jaccard similarity over salient tokens (length ≥ 4, lowercased, alphanumeric
// only — drops filler and model-specific formatting noise).

function salientTokens(text: string): Set<string> {
  const toks = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4);
  return new Set(toks);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function centroidResponse(
  responses: MemberResponse[],
): { pick: MemberResponse; agreement: number } {
  if (responses.length === 1) return { pick: responses[0], agreement: 0 };
  const tokens = responses.map((r) => salientTokens(r.content));
  const sims: number[][] = responses.map(() => new Array(responses.length).fill(0));
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < responses.length; i++) {
    for (let j = i + 1; j < responses.length; j++) {
      const s = jaccard(tokens[i], tokens[j]);
      sims[i][j] = s;
      sims[j][i] = s;
      sum += s;
      pairs++;
    }
  }
  const agreement = pairs > 0 ? sum / pairs : 0;
  // The centroid = highest mean similarity to all peers.
  let bestIdx = 0;
  let bestMean = -1;
  for (let i = 0; i < responses.length; i++) {
    const mean =
      responses.length > 1
        ? sims[i].reduce((a, b) => a + b, 0) / (responses.length - 1)
        : 0;
    if (mean > bestMean) {
      bestMean = mean;
      bestIdx = i;
    }
  }
  return { pick: responses[bestIdx], agreement };
}

// ─── The consensus call ────────────────────────────────────────────────────

export async function runConsensus(
  messages: Array<{ role: string; content: string }>,
  options?: {
    maxTokens?: number;
    temperature?: number;
    /** Optional task label for the audit log (e.g. "briefing"). */
    task?: string;
  },
): Promise<ConsensusResult> {
  const maxTokens = options?.maxTokens ?? 1024;
  const temperature = options?.temperature ?? 0.7;
  const task = options?.task ?? "generic";
  const started = Date.now();

  const eligible = MEMBER_REGISTRY.filter((def) => {
    if (!enabled(def)) return false;
    const h = health.get(def.id);
    if (h && h.cooldownUntil > Date.now()) return false; // in cooldown
    return true;
  });

  const settled = await Promise.allSettled(
    eligible.map(async (def) => {
      const t0 = Date.now();
      try {
        const { content, model } = await callMember(def, messages, {
          maxTokens,
          temperature,
        });
        const latencyMs = Date.now() - t0;
        health.set(def.id, {
          healthy: true,
          latencyMs,
          cooldownUntil: 0,
          stickyModel: model,
        });
        return {
          id: def.id,
          vendor: def.vendor,
          model,
          content,
          latencyMs,
        } satisfies MemberResponse;
      } catch (e) {
        const msg = String((e as Error)?.message ?? e).slice(0, 200);
        health.set(def.id, {
          healthy: false,
          lastError: msg,
          cooldownUntil: Date.now() + COOLDOWN_MS,
        });
        console.error(`[ai/consensus] member ${def.id} failed (${task}): ${msg}`);
        throw e;
      }
    }),
  );

  const responses: MemberResponse[] = [];
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status === "fulfilled") responses.push(s.value);
  }

  const board = getBoard();

  if (responses.length === 0) {
    return {
      success: false,
      provider: "fallback",
      vendor: "fallback-rules",
      model: "fallback-rules",
      content: "",
      mode: "unavailable",
      agreement: null,
      members: [],
      board,
      latencyMs: Date.now() - started,
      error: "No consensus member answered",
    };
  }

  const { pick, agreement } = centroidResponse(responses);
  const mode: ConsensusMode =
    responses.length >= 2 ? "consensus" : "single-source";

  console.error(
    `[ai/consensus] ${task}: mode=${mode} members=${responses.length} ` +
      `agreement=${agreement == null ? "n/a" : agreement.toFixed(3)} ` +
      `centroid=${pick.id}/${pick.model} latencyMs=${Date.now() - started}`,
  );

  return {
    success: true,
    provider: pick.id,
    vendor: pick.vendor,
    model: pick.model,
    content: pick.content,
    mode,
    agreement: responses.length >= 2 ? agreement : null,
    members: responses,
    board,
    latencyMs: Date.now() - started,
  };
}

// ─── FRED augmentation (optional context provider) ─────────────────────────
// FRED is not an LLM member — it is a DATA member: live macro observations
// (VIX · DXY · gold · yields) injected into consensus prompts as grounding
// context. Failures are non-fatal (the prompt simply loses the FRED block).

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

// ─── Snapshot → consensus context helper ───────────────────────────────────
// Shared by briefing / risk-signals / QA prompt builders that want the live
// metrics block in one canonical shape. Keeps prompts vendor-neutral so every
// consensus member answers the identical question.

export function snapshotContext(snap: MetricsSnapshot): string {
  const rr = Number.isFinite(snap.reserveRatio)
    ? snap.reserveRatio.toFixed(4)
    : "n/a (∞ — no liability)";
  const lines = [
    "Live MTQΣ pilot snapshot (deterministic engine state):",
    `- Status: ${snap.status}`,
    `- GFB Index: ${snap.gfbIndex?.toFixed(4) ?? "n/a"}`,
    `- Reserve Ratio: ${rr}`,
    `- NAV: $${(snap.nav / 1e6).toFixed(2)}M`,
    `- Oracle paused: ${snap.oraclePaused ? "YES" : "no"}`,
  ];
  return lines.join("\n");
}
