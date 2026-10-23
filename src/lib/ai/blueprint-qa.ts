// MTQΣ — Blueprint Q&A (5-provider fallback chain, long-context).
//
// Server-side only. Answers user questions about the MTQΣ Master Monetary
// Architecture v1.0 by feeding the authoritative TS constants from
// `src/lib/mtq/blueprint.ts` as context (NOT the raw 3270-line docx — the TS
// constants are the live, reconciled v1.0 source of truth).
//
// The model is asked to cite section numbers (e.g. "per §9.2"). We extract
// those citations with a regex so the UI can highlight them.
//
// Provider chain (handled by src/lib/ai/model-fallback.ts):
//   1. Groq (llama-3.3-70b-versatile)
//   2. OpenRouter (meta-llama/llama-3.3-70b-instruct)
//   3. NVIDIA (meta/llama-3.3-70b-instruct)
//   4. Gemini (gemini-2.0-flash-001)
//   5. HuggingFace (meta-llama/Llama-3.3-70B-Instruct)
//   6. fallback (deterministic — always works)
//
// AI output is ADVISORY ONLY. It never modifies engine state. Every answer
// includes the disclaimer.

import { callWithFallback } from "./model-fallback";
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

const DISCLAIMER =
  "AI-generated from the blueprint constants. Informational only.";
const FALLBACK_MODEL = "fallback";
const FALLBACK_ANSWER =
  "Blueprint Q&A unavailable (all 5 AI providers unreachable). The full v1.0 blueprint is documented in the Docs section above; the authoritative TS constants live in src/lib/mtq/blueprint.ts.";

const MAX_QUESTION = 500;

export interface QaResult {
  answer: string;
  citations: string[];
  model: string;
  disclaimer: string;
}

/** Strip control chars + collapse whitespace; reject empty / oversized input. */
function sanitizeQuestion(raw: string): string | null {
  if (typeof raw !== "string") return null;
  // Remove control chars (except \n \t which we collapse anyway).
  const stripped = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
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

const SYSTEM_INSTRUCTION = [
  "You are the MTQΣ protocol documentation assistant. Answer questions about the MTQΣ Master Monetary Architecture v1.0. Cite section numbers (e.g., 'per §9.2', 'per §14.1') when relevant. If the question is outside the blueprint scope, say so. Do not invent facts. Be concise (3-5 sentences).",
].join("\n");

/** Extract §X.Y style section citations from the answer. */
function extractCitations(answer: string): string[] {
  // Matches "§2", "§9.2", "§14.1", "§3.4.2", optionally prefixed with 'per '.
  const re = /§\s*(\d+(?:\.\d+){0,2})\b/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer)) !== null) {
    set.add("§" + m[1]);
  }
  return Array.from(set);
}

export async function answerQuestion(question: string): Promise<QaResult> {
  const q = sanitizeQuestion(question);
  if (!q) {
    return {
      answer:
        "Question is empty or exceeds the 500-character limit. Please ask a concise question about the MTQΣ Master Monetary Architecture v1.0.",
      citations: [],
      model: FALLBACK_MODEL,
      disclaimer: DISCLAIMER,
    };
  }

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

  // Try the 5-provider fallback chain (Groq → OpenRouter → NVIDIA → Gemini → HuggingFace).
  // maxTokens is sized to fit within the smallest provider credit limit we've
  // observed in production (OpenRouter free tier can deny >100 max_tokens).
  try {
    const aiResult = await callWithFallback(
      [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: prompt },
      ],
      { maxTokens: 100, temperature: 0.2 },
    );
    console.error(
      `[ai/qa] callWithFallback result: success=${aiResult.success} provider=${aiResult.provider} model=${aiResult.model} latencyMs=${aiResult.latencyMs} contentLen=${aiResult.content?.length ?? 0} error=${aiResult.error ?? "n/a"}`,
    );

    if (aiResult.success && aiResult.content && aiResult.content.length > 0) {
      return {
        answer: aiResult.content,
        citations: extractCitations(aiResult.content),
        model: aiResult.model,
        disclaimer: DISCLAIMER,
      };
    }
    if (!aiResult.success) {
      console.error(
        `[ai/qa] all 5 AI providers failed — using deterministic fallback. lastError=${aiResult.error ?? "n/a"}`,
      );
    }
  } catch (e) {
    console.error(
      "[ai/qa] callWithFallback threw:",
      (e as Error).message?.slice(0, 200),
    );
  }

  // All providers failed → deterministic fallback answer.
  return {
    answer: FALLBACK_ANSWER,
    citations: [],
    model: FALLBACK_MODEL,
    disclaimer: DISCLAIMER,
  };
}
