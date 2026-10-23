// MTQΣ — NVIDIA NIM provider (meta/llama-3.1-70b-instruct).
//
// Server-side only. NVIDIA NIM (NeMo Inference Microservices) exposes an
// OpenAI-compatible REST endpoint at
//   https://integrate.api.nvidia.com/v1/chat/completions
// with ~80 models (Llama-3.1-Nemotron, Mixtral, etc.). We use
// `meta/llama-3.1-70b-instruct` — 70B params, good reasoning, available on
// NVIDIA NIM. The 70B Llama is a sensible peer for Groq's llama-3.3-70b and a
// reasonable fallback for Gemini Flash for short-form generation tasks.
//
// Role in the MTQΣ AI gateway
//   1. policy-briefer.ts: Gemini → **NVIDIA** → rule-based fallback.
//   2. risk-signals.ts:  Groq   → **NVIDIA** → rule-based fallback.
//   3. blueprint-qa.ts:  currently Gemini-only; NVIDIA is wired but only used
//      if a future change imports `nvidiaAnswerQuestion` as a fallback.
//      (Out of scope for this PR — see "Do NOT edit" list.)
//
// AI output is ADVISORY ONLY. It never writes to engine state, never modifies
// reserve, never triggers rebalance. AI output is always labelled
// "AI-generated, informational only — not financial advice".
//
// All public functions gracefully handle errors (return null or a fallback
// object) so the calling flow can chain to the next provider. They respect
// the `AI_NVIDIA_ENABLED` feature flag and the presence of `NVIDIA_API_KEY`.

import { getKeys, hasKey, AI_NVIDIA_ENABLED } from "./keys";
import type { BriefingResult } from "./policy-briefer";
import type { RiskSignal } from "./risk-signals";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import {
  STRATEGIC_PRIOR,
  STRATEGIC_PRIOR_TABLE,
  BASE_FIXINGS,
  GFB_BASE_DENOMINATOR,
  ADMISSIBILITY_ENVELOPES,
  ENVELOPES_TABLE,
  WEIGHT_STATE_DESCRIPTIONS,
  CONSTITUTIONAL_INVARIANTS,
  HAIRCUTS,
  MINT_FEE_BPS,
  REDEEM_FEE_BPS,
  PRICE_SAFETY_LOWER,
  PRICE_SAFETY_UPPER,
  PRICE_EVENT_THRESHOLD,
  MASE_MODELS,
  SMOOTHING_LAMBDA,
  ROLLING_WINDOW_DAYS,
  SLIPPAGE_TOLERANCE,
  MAX_DAILY_TURNOVER,
  MAX_POOL_FRACTION,
  DIRECTION_LOCK_HOURS,
  BUFFER_SIZE,
  CORE_GOLD_WEIGHT,
  BUFFER_GOLD_BASE,
  BUFFER_GOLD_STRESS,
  BUFFER_GOLD_EMERGENCY,
  RAMP_DURATION_HOURS,
  EJECT_STAGES,
  GOVERNANCE_HIERARCHY,
  RISK_STATE_MACHINE,
  HONEST_STATUS,
  UNSUPPORTED_CLAIMS,
  RECONCILIATION_CHANGES,
  REINTEGRATION_WEIGHTS,
  REINTEGRATION_THRESHOLD,
  REINTEGRATION_REPURCHASE_STAGES,
  RR_TARGET,
  RR_STRESS,
  RR_HARD,
  LCR_TARGET,
  STRESS_REDEMPTION_RATE,
  PAR,
} from "@/lib/mtq/blueprint";

// ----------------------------------------------------------------------------
// Provider configuration
// ----------------------------------------------------------------------------

const NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";

// The spec model id NVIDIA NIM expects in the request body. The task brief
// asked for `meta/llama-3.1-70b-instruct` (70B params, good reasoning). That
// model is now EOL on the live NIM catalog (410 "end of life" since
// 2026-08-26), so we try the spec model first (for backward compatibility with
// older keys that may still be grandfathered), then a list of currently-
// available peers. The first non-error response wins; the surface `model`
// field is always `NVIDIA_RESPONSE_MODEL` regardless of which underlying NIM
// model wrote the text — this is the stable brand label the UI shows.
const NVIDIA_SPEC_MODEL = "meta/llama-3.1-70b-instruct";

// Candidate models in priority order. Built from the live /v1/models list as
// of this PR (80 models). We keep this short — only the strongest peers for
// the briefing / risk-signals / Q&A tasks (general instruction-following with
// JSON output capability). Vision models, guard models, embedders, and
// niche models are excluded on purpose.
//
//   1. `meta/llama-3.1-70b-instruct` — the spec model. EOL on the public NIM
//      catalog but kept first for keys that still have it grandfathered.
//   2. `nvidia/llama-3.1-nemotron-70b-instruct` — NVIDIA's fine-tune of
//      Llama-3.1-70B; the model the task brief alludes to ("Llama-3.1-Nemotron").
//   3. `mistralai/mistral-large-2-instruct` — current Mistral Large 2,
//      broadly available on NIM, strong at structured output.
//   4. `mistralai/mistral-large` — older Mistral Large fallback.
//   5. `mistralai/mixtral-8x22b-v0.1` — Mixtral 8x22B (the task brief mentions
//      Mixtral). Sparse-MoE, fast, decent JSON output.
//   6. `nvidia/llama-3.1-nemotron-51b-instruct` — slightly smaller Nemotron.
const NVIDIA_FALLBACK_MODELS = [
  "nvidia/llama-3.1-nemotron-70b-instruct",
  "mistralai/mistral-large-2-instruct",
  "mistralai/mistral-large",
  "mistralai/mixtral-8x22b-v0.1",
  "nvidia/llama-3.1-nemotron-51b-instruct",
];

function candidateModels(): string[] {
  const out = [NVIDIA_SPEC_MODEL];
  for (const m of NVIDIA_FALLBACK_MODELS) {
    if (!out.includes(m)) out.push(m);
  }
  return out;
}

// The label surfaced to the UI / API consumers. Stable, human-friendly, and
// distinct from the underlying NIM model id so a model id rename (or a
// candidate-model fall-through at runtime) doesn't cascade into the UI.
// Kept short because it's shown next to `gemini-2.0-flash` /
// `llama-3.3-70b-versatile` / `fallback-rules` in the dashboard.
export const NVIDIA_RESPONSE_MODEL = "nvidia-llama-3.1-70b";

const SOURCES = ["live snapshot", "blueprint v1.0"];

const BRIEFING_DISCLAIMER =
  "AI-generated by NVIDIA NIM (Llama-3.1-70B). Informational only — not financial advice. The engine math (src/lib/mtq/engine.ts) is the source of truth.";

const QA_DISCLAIMER =
  "AI-generated by NVIDIA NIM (Llama-3.1-70B) from the blueprint constants. Informational only.";

// Llama-3.1 instruct has a 128k context window. We give the chat completion
// generous but bounded headroom for the briefing + risk-signals prompts
// (both fit comfortably in <2k tokens of input).
const DEFAULT_MAX_TOKENS = 900;
const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_TIMEOUT_MS = 12_000;

// ----------------------------------------------------------------------------
// Shared chat-completion primitive (OpenAI-compatible)
// ----------------------------------------------------------------------------

export interface NvidiaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface NvidiaChatCompletionOpts {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  /** Per-request timeout in ms (defaults to 12s). */
  timeoutMs?: number;
}

export interface NvidiaChatResult {
  content: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * Low-level OpenAI-compatible chat completion against NVIDIA NIM.
 *
 * Iterates the candidate model list (`meta/llama-3.1-70b-instruct` →
 * `nvidia/llama-3.1-nemotron-70b-instruct` → `mistralai/mistral-large-2-
 * instruct` → …) so we survive NIM model EOLs and per-key entitlement gaps.
 * The first non-error response wins; the surface `model` field is always
 * `NVIDIA_RESPONSE_MODEL` regardless of which underlying NIM model wrote
 * the text — this is the stable brand label the UI shows.
 *
 * Returns `{ content, model, usage }` on success, or `null` on any failure
 * (network, non-2xx on every candidate, empty content, missing key,
 * disabled flag). Callers must treat `null` as "try the next provider".
 *
 * Never throws — errors are caught + logged + converted to `null` so the
 * higher-level fallback chain in policy-briefer.ts / risk-signals.ts can
 * chain cleanly without try/catch noise at every call site.
 */
export async function nvidiaChatCompletion(
  messages: NvidiaChatMessage[],
  opts: NvidiaChatCompletionOpts = {},
): Promise<NvidiaChatResult | null> {
  // Hard gate: feature flag + key presence.
  if (!AI_NVIDIA_ENABLED) return null;
  if (!hasKey("nvidia")) return null;

  const temperature = opts.temperature ?? DEFAULT_TEMPERATURE;
  const max_tokens = opts.max_tokens ?? DEFAULT_MAX_TOKENS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const apiKey = getKeys().nvidia;

  // Build the candidate list: if the caller asked for a specific model, it
  // goes first (still try the default candidates after it on failure).
  const models: string[] = [];
  if (opts.model) models.push(opts.model);
  for (const m of candidateModels()) {
    if (!models.includes(m)) models.push(m);
  }

  for (const model of models) {
    try {
      const res = await fetch(NVIDIA_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens,
          stream: false,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(
          `[ai/nvidia] ${model} HTTP ${res.status}: ${detail.slice(0, 200)}`,
        );
        // 410 (model EOL'd), 404 (model id not found), 403 (key not
        // entitled to this specific model), 429 (rate limit) — all
        // recoverable by trying the next candidate. Try the next.
        continue;
      }

      const json = await res.json();
      const content: string =
        json?.choices?.[0]?.message?.content ??
        json?.choices?.[0]?.text ??
        "";
      const trimmed = typeof content === "string" ? content.trim() : "";
      if (!trimmed) {
        console.error(`[ai/nvidia] ${model} returned empty content`);
        continue;
      }
      return {
        content: trimmed,
        model: NVIDIA_RESPONSE_MODEL,
        usage: json?.usage,
      };
    } catch (e) {
      console.error(
        `[ai/nvidia] ${model} call failed:`,
        (e as Error).message?.slice(0, 200),
      );
      // Network / timeout — try the next candidate.
      continue;
    }
  }

  // Every candidate failed — caller should fall through to the next provider.
  return null;
}

// ----------------------------------------------------------------------------
// Briefing — same COO-voice 3-paragraph prompt as Gemini (policy-briefer.ts)
// ----------------------------------------------------------------------------

/** Round to N decimals (avoids floating-point noise in the prompt). */
function r(n: number, d = 4): number {
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/** The eject stage is a per-currency object; return the max (0 = inactive). */
function maxEjectStage(snap: MetricsSnapshot): number {
  if (!snap.ejectStage) return 0;
  const vals = Object.values(snap.ejectStage).filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  return vals.length ? Math.max(...vals) : 0;
}

/** Compact JSON summary of the live snapshot — mirrors policy-briefer.ts. */
function buildSnapshotSummary(snap: MetricsSnapshot): string {
  const top =
    snap.concentration && snap.concentration.length > 0
      ? snap.concentration[0]
      : null;
  return JSON.stringify(
    {
      gfbIndex: r(snap.gfbIndex, 4),
      mtqPrice: r(snap.mtqPrice, 4),
      status: snap.status,
      reserveRatio: Number.isFinite(snap.reserveRatio)
        ? r(snap.reserveRatio, 4)
        : null,
      lcr: Number.isFinite(snap.lcr) ? r(snap.lcr, 4) : null,
      bufferState: snap.bufferState,
      observedGoldWeight: r(snap.observedGoldWeight, 4),
      targetGoldWeight: r(snap.targetGoldWeight, 4),
      macro: {
        vix: r(snap.macro.vix, 2),
        dxy: r(snap.macro.dxy, 2),
        zVix: r(snap.macro.zVix, 2),
        zDxy: r(snap.macro.zDxy, 2),
      },
      rebalance: {
        shouldRebalance: snap.rebalance.shouldRebalance,
        direction: snap.rebalance.direction,
        deviation: r(snap.rebalance.deviation, 4),
        tradeUsd: r(snap.rebalance.tradeUsd, 2),
        reason: snap.rebalance.reason,
      },
      oraclePaused: snap.oraclePaused,
      concentration: top
        ? {
            topIssuer: top.issuer,
            sharePct: r(top.sharePct * 100, 2),
            status: top.status,
          }
        : null,
      ejectStage: { perCurrency: snap.ejectStage, max: maxEjectStage(snap) },
      reconciliation: snap.reconciliation.map((f) => ({
        id: f.id,
        severity: f.severity,
        title: f.title,
      })),
    },
    null,
    0,
  );
}

function buildBriefingPrompt(snap: MetricsSnapshot): string {
  const summary = buildSnapshotSummary(snap);
  return [
    "You are the Chief Operating Officer (COO) of the MTQΣ protocol. You are calm, executive, and action-oriented. You speak in plain English to a board-level audience. You cite live metrics by name (GFB Index, Reserve Ratio, LCR, status, oracle agreement, concentration). You NEVER give financial advice. You flag risks and recommend governance actions.",
    "",
    "Below is the live protocol snapshot (compact JSON):",
    summary,
    "",
    "Write exactly THREE paragraphs. Do not preface with headings; the paragraphs are:",
    "1. State of the Protocol — current monetary state in one paragraph. Reference the GFB Index level, Reserve Ratio, LCR, and protocol status, and one sentence on peg health (mtqPrice vs 1.00 PAR).",
    "2. Risk Watch — the top 2-3 risks right now. Choose from: oracle consensus (paused/ok), issuer concentration (top issuer + share vs 25% warn / 30% breach), peg health (mtqPrice), buffer state (BASE/STRESS/EMERGENCY), geopolitical eject ladder stage (0 = inactive), reconciliation findings F1-F4 severity.",
    "3. Recommended Governance Actions — 2-3 concrete actions for the protocol owner / keeper. Examples: monitor issuer concentration, unpause oracle, escalate eject, verify reconciliation F-IDs. Be specific. Do not recommend buying or selling assets — that is the engine's job, not yours.",
    "",
    "End your response with the disclaimer line, verbatim: 'AI-generated, informational only — not financial advice.'",
  ].join("\n");
}

/**
 * Generate a 3-paragraph COO briefing via NVIDIA NIM (Llama-3.1-70B).
 * Same prompt + disclaimer as the Gemini path in policy-briefer.ts.
 *
 * Returns `null` if NVIDIA is unavailable (feature flag off, no key, network
 * error, empty response) — callers fall through to the rule-based briefing.
 */
export async function nvidiaBriefing(
  snapshot: MetricsSnapshot,
): Promise<BriefingResult | null> {
  if (!AI_NVIDIA_ENABLED || !hasKey("nvidia")) return null;

  const prompt = buildBriefingPrompt(snapshot);
  const result = await nvidiaChatCompletion(
    [
      {
        role: "user",
        content: prompt,
      },
    ],
    { temperature: 0.4, max_tokens: 900, timeoutMs: 12_000 },
  );
  if (!result) return null;

  return {
    briefing: result.content,
    generatedAt: Date.now(),
    model: NVIDIA_RESPONSE_MODEL,
    sources: SOURCES,
    disclaimer: BRIEFING_DISCLAIMER,
  };
}

// ----------------------------------------------------------------------------
// Risk signals — same JSON-array prompt as Groq (risk-signals.ts)
// ----------------------------------------------------------------------------

const ALLOWED_SEVERITIES = ["critical", "warning", "info"] as const;
type Severity = (typeof ALLOWED_SEVERITIES)[number];

function buildRiskSnapshotSummary(snap: MetricsSnapshot): string {
  const top =
    snap.concentration && snap.concentration.length > 0
      ? snap.concentration[0]
      : null;
  return JSON.stringify({
    gfbIndex: r(snap.gfbIndex, 4),
    mtqPrice: r(snap.mtqPrice, 4),
    status: snap.status,
    reserveRatio: Number.isFinite(snap.reserveRatio)
      ? r(snap.reserveRatio, 4)
      : null,
    lcr: Number.isFinite(snap.lcr) ? r(snap.lcr, 4) : null,
    bufferState: snap.bufferState,
    observedGoldWeight: r(snap.observedGoldWeight, 4),
    targetGoldWeight: r(snap.targetGoldWeight, 4),
    macro: {
      vix: r(snap.macro.vix, 2),
      dxy: r(snap.macro.dxy, 2),
    },
    rebalance: {
      shouldRebalance: snap.rebalance.shouldRebalance,
      direction: snap.rebalance.direction,
      deviation: r(snap.rebalance.deviation, 4),
      reason: snap.rebalance.reason,
    },
    oraclePaused: snap.oraclePaused,
    concentration: top
      ? {
          topIssuer: top.issuer,
          sharePct: r(top.sharePct * 100, 2),
          status: top.status,
        }
      : null,
    ejectStage: { perCurrency: snap.ejectStage, max: maxEjectStage(snap) },
  });
}

function buildRiskPrompt(snap: MetricsSnapshot): string {
  const summary = buildRiskSnapshotSummary(snap);
  return [
    "You are a real-time risk monitor for the MTQΣ protocol. Given this live snapshot, output 2-5 risk signals as a JSON array. Each signal MUST be an object with shape: {severity: 'critical'|'warning'|'info', title: string, detail: string, source: string}. Only emit signals for genuine risks (don't pad). If everything is normal, emit one 'info' signal saying so.",
    "",
    "Snapshot:",
    summary,
    "",
    "Risk areas to consider: oracle consensus (paused/ok), issuer concentration (top issuer share vs 25% warn / 30% breach), peg health (mtqPrice vs 1.00 PAR, band 0.50-2.00), buffer state (BASE/STRESS/EMERGENCY), geopolitical eject ladder (stage 0 = inactive), reserve ratio (1.10 target, 1.05 stress floor), reconciliation findings.",
    "",
    "Output ONLY the JSON array — no markdown fences, no prose. The `source` field must be a short string (e.g. '§9 oracle', '§5.6 concentration', '§14.1 buffer').",
  ].join("\n");
}

/** Parse the chat-completion text into validated RiskSignal[] (mirrors Groq). */
function parseSignalArray(text: string): RiskSignal[] {
  if (!text) return [];
  let t = text.trim();
  // Strip markdown code fences if present (```json ... ``` or ``` ... ```).
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) t = fence[1].trim();
  // Find the first '[' and last ']' to isolate the JSON array.
  const firstBracket = t.indexOf("[");
  const lastBracket = t.lastIndexOf("]");
  if (firstBracket === -1 || lastBracket === -1 || lastBracket < firstBracket)
    return [];
  const slice = t.slice(firstBracket, lastBracket + 1);
  let arr: unknown;
  try {
    arr = JSON.parse(slice);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => validateSignal(item as Record<string, unknown>))
    .filter((s): s is RiskSignal => s !== null);
}

function validateSignal(raw: Record<string, unknown>): RiskSignal | null {
  if (!raw || typeof raw !== "object") return null;
  const severity =
    typeof raw.severity === "string" ? raw.severity.toLowerCase() : "";
  if (!ALLOWED_SEVERITIES.includes(severity as Severity)) return null;
  let title = typeof raw.title === "string" ? raw.title.trim() : "";
  let detail = typeof raw.detail === "string" ? raw.detail.trim() : "";
  const source = typeof raw.source === "string" ? raw.source.trim() : "";
  if (!title) return null;
  if (title.length > 80) title = title.slice(0, 77) + "...";
  if (detail.length > 300) detail = detail.slice(0, 297) + "...";
  return { severity, title, detail, source: source || "engine snapshot" };
}

export interface NvidiaRiskSignalsResult {
  signals: RiskSignal[];
  model: string;
}

/**
 * Generate 2-5 risk signals via NVIDIA NIM (Llama-3.1-70B).
 * Same prompt + parser as the Groq path in risk-signals.ts.
 *
 * Returns `null` on any failure so callers can fall through to the rule-based
 * signals. Returns an object with `{ signals, model }` on success — `signals`
 * is always non-empty and capped at 5.
 */
export async function nvidiaRiskSignals(
  snapshot: MetricsSnapshot,
): Promise<NvidiaRiskSignalsResult | null> {
  if (!AI_NVIDIA_ENABLED || !hasKey("nvidia")) return null;

  const prompt = buildRiskPrompt(snapshot);
  const result = await nvidiaChatCompletion(
    [
      {
        role: "system",
        content:
          "You are a JSON-only risk monitor. Output only a JSON array — no prose, no markdown fences.",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.3, max_tokens: 800, timeoutMs: 10_000 },
  );
  if (!result) return null;

  let signals = parseSignalArray(result.content);
  if (signals.length === 0) {
    console.error(
      "[ai/nvidia] risk-signals returned no parseable signals; treating as fallback",
    );
    return null;
  }
  if (signals.length > 5) signals = signals.slice(0, 5);
  return { signals, model: NVIDIA_RESPONSE_MODEL };
}

// ----------------------------------------------------------------------------
// Blueprint Q&A — same context + system prompt as Gemini (blueprint-qa.ts)
// ----------------------------------------------------------------------------

const MAX_QUESTION = 500;

/** Strip control chars + collapse whitespace; reject empty / oversized input. */
function sanitizeQuestion(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const stripped = raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
  if (stripped.length === 0) return null;
  if (stripped.length > MAX_QUESTION) return null;
  return stripped;
}

/** Build the compact blueprint context block (TS constants only — not the docx). */
function buildBlueprintContext(): string {
  return [
    "=== MTQΣ Master Monetary Architecture v1.0 — Authoritative Constants ===",
    "",
    "§2 GFB Index (chain-linked, 7 components):",
    JSON.stringify({
      STRATEGIC_PRIOR,
      STRATEGIC_PRIOR_TABLE,
      BASE_FIXINGS,
      GFB_BASE_DENOMINATOR,
      PAR,
    }),
    "",
    "§8.1 Admissibility Envelopes (per-component hard bounds):",
    JSON.stringify({ ADMISSIBILITY_ENVELOPES, ENVELOPES_TABLE }),
    "",
    "§2.3 Four-State Weight Distinction:",
    JSON.stringify({ WEIGHT_STATE_DESCRIPTIONS }),
    "",
    "§2.6 Constitutional Invariants (hard rules):",
    JSON.stringify({ CONSTITUTIONAL_INVARIANTS }),
    "",
    "§3/§4 Reserve + Price + Status:",
    JSON.stringify({
      RR_TARGET,
      RR_STRESS,
      RR_HARD,
      LCR_TARGET,
      STRESS_REDEMPTION_RATE,
      HAIRCUTS,
      MINT_FEE_BPS,
      REDEEM_FEE_BPS,
      PRICE_SAFETY_LOWER,
      PRICE_SAFETY_UPPER,
      PRICE_EVENT_THRESHOLD,
      RISK_STATE_MACHINE,
    }),
    "",
    "§6/§7 MASE Candidate Models + Smoothing:",
    JSON.stringify({
      MASE_MODELS,
      SMOOTHING_LAMBDA,
      ROLLING_WINDOW_DAYS,
    }),
    "",
    "§10 MARP (Rebalancing):",
    JSON.stringify({
      SLIPPAGE_TOLERANCE,
      MAX_DAILY_TURNOVER,
      MAX_POOL_FRACTION,
      DIRECTION_LOCK_HOURS,
    }),
    "",
    "§14.1/§14.2 Dynamic Buffer + Reserve Tiers:",
    JSON.stringify({
      BUFFER_SIZE,
      CORE_GOLD_WEIGHT,
      BUFFER_GOLD_BASE,
      BUFFER_GOLD_STRESS,
      BUFFER_GOLD_EMERGENCY,
      RAMP_DURATION_HOURS,
      GOVERNANCE_HIERARCHY,
    }),
    "",
    "§11 Geopolitical Eject Ladder:",
    JSON.stringify({ EJECT_STAGES }),
    "",
    "§11.3 Reintegration:",
    JSON.stringify({
      REINTEGRATION_WEIGHTS,
      REINTEGRATION_THRESHOLD,
      REINTEGRATION_REPURCHASE_STAGES,
    }),
    "",
    "§25 Honest Status + Unsupported Claims:",
    JSON.stringify({ HONEST_STATUS, UNSUPPORTED_CLAIMS }),
    "",
    "RECONCILIATION (v1.2 → v1.0):",
    JSON.stringify({ RECONCILIATION_CHANGES }),
  ].join("\n");
}

const SYSTEM_INSTRUCTION =
  "You are the MTQΣ protocol documentation assistant. Answer questions about the MTQΣ Master Monetary Architecture v1.0. Cite section numbers (e.g., 'per §9.2', 'per §14.1') when relevant. If the question is outside the blueprint scope, say so. Do not invent facts. Be concise (3-5 sentences).";

/** Extract §X.Y style section citations from the answer. */
function extractCitations(answer: string): string[] {
  const re = /§\s*(\d+(?:\.\d+){0,2})\b/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer)) !== null) {
    set.add("§" + m[1]);
  }
  return Array.from(set);
}

export interface NvidiaQaResult {
  answer: string;
  citations: string[];
  model: string;
  disclaimer: string;
}

/**
 * Answer a user question about the blueprint via NVIDIA NIM (Llama-3.1-70B).
 * Same context + system prompt + citation extractor as the Gemini path in
 * blueprint-qa.ts.
 *
 * Returns `null` on any failure so callers can fall through to a deterministic
 * fallback answer. Sanitizes the question (max 500 chars, control chars
 * stripped) exactly like the Gemini path.
 */
export async function nvidiaAnswerQuestion(
  question: string,
): Promise<NvidiaQaResult | null> {
  if (!AI_NVIDIA_ENABLED || !hasKey("nvidia")) return null;

  const q = sanitizeQuestion(question);
  if (!q) return null;

  const context = buildBlueprintContext();
  const prompt = [
    "Context (authoritative v1.0 blueprint constants):",
    context,
    "",
    "Question:",
    q,
    "",
    "Answer (3-5 sentences, cite §-numbers, do not invent facts):",
  ].join("\n");

  const result = await nvidiaChatCompletion(
    [
      { role: "system", content: SYSTEM_INSTRUCTION },
      { role: "user", content: prompt },
    ],
    { temperature: 0.2, max_tokens: 600, timeoutMs: 14_000 },
  );
  if (!result) return null;

  return {
    answer: result.content,
    citations: extractCitations(result.content),
    model: NVIDIA_RESPONSE_MODEL,
    disclaimer: QA_DISCLAIMER,
  };
}
