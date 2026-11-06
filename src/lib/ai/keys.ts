// MTQΣ — Server-side AI key validation + feature flags.
//
// IMPORTANT: This module is server-side ONLY. It must NEVER be imported from a
// client component (the bundler would tree-shake `process.env` to a literal
// undefined, but we add an explicit `typeof window !== 'undefined'` guard in
// `getKeys()` as defense in depth).
//
// Task 47 (2026-11-06) — owner directive "totally free api open source … no
// billing ever … All AI models work in consensus and remove all z.ai". All
// five supplied keys were LIVE-validated (scripts/ai/validate-providers.ts):
// only NVIDIA and OpenRouter generate successfully and are kept in .env
// (GROQ 403 · GEMINI leaked-key 403 · HUGGINGFACE 402-paywall — removed).
// The keys are read from `process.env` exactly once at module load and are
// NEVER exposed to the client. AI calls always happen server-side via the
// /api/ai/* routes.
//
// Feature flags default to `true`. The protocol owner can disable a specific
// AI capability (e.g. AI_BRIEFING_ENABLED=false) without changing code — the
// corresponding /api/ai/* route returns HTTP 503 with `{ model: "disabled" }`.

export type AIProvider = "gemini" | "groq" | "huggingface" | "nvidia" | "openrouter";

export interface AIKeys {
  gemini: string;
  groq: string;
  huggingface: string;
  nvidia: string;
  openrouter: string;
}

// Read once at module load — keys do not change at runtime.
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const HF_KEY = process.env.HUGGINGFACE_API_KEY ?? "";
const NVIDIA_KEY = process.env.NVIDIA_API_KEY ?? "";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? "";

/**
 * Returns the three AI provider keys. Throws if called from a browser
 * (defense in depth — even if a lib module accidentally leaks to the client
 * bundle, the keys can never be read there).
 */
export function getKeys(): AIKeys {
  if (typeof window !== "undefined") {
    throw new Error("AI keys must only be accessed server-side");
  }
  return { gemini: GEMINI_KEY, groq: GROQ_KEY, huggingface: HF_KEY, nvidia: NVIDIA_KEY, openrouter: OPENROUTER_KEY };
}

/** True if the given provider has a non-empty API key configured. */
export function hasKey(provider: AIProvider): boolean {
  const k = getKeys();
  return k[provider].length > 0;
}

/** True when ANY consensus-capable provider has a key configured.
 *
 *  SINGLE GATE HELPER (2026-11-08 root-cause fix): the consensus-capability
 *  gate was hard-coded as `hasKey("nvidia") || hasKey("openrouter")` in FOUR
 *  separate files (the /api/ai/consensus route + briefing/risk-signals/qa
 *  libs), so when the owner's fresh Gemini key was validated and pasted in,
 *  every AI route stayed 503-blocked — the gate is now derived here, once.
 *  Keep the provider list in sync with CONSENSUS_ROSTER in consensus.ts
 *  (nvidia · openrouter · gemini as of 2026-11-08). */
export function anyConsensusProviderKeyed(): boolean {
  return hasKey("nvidia") || hasKey("openrouter") || hasKey("gemini");
}

/** Parse an env feature flag. Defaults to `true` when unset; truthy values:
 *  "true" / "1" / "on" (case-insensitive). Anything else disables the flag. */
function readFlag(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  const s = v.trim().toLowerCase();
  if (s === "true" || s === "1" || s === "on") return true;
  if (s === "false" || s === "0" || s === "off") return false;
  return def;
}

// Feature flags — exposed as `const` so the route handlers can branch on them.
export const AI_BRIEFING_ENABLED = readFlag("AI_BRIEFING_ENABLED", true);
export const AI_QA_ENABLED = readFlag("AI_QA_ENABLED", true);
export const AI_RISK_SIGNALS_ENABLED = readFlag("AI_RISK_SIGNALS_ENABLED", true);
export const AI_SCREEN_ENABLED = readFlag("AI_SCREEN_ENABLED", true);
export const AI_NVIDIA_ENABLED = readFlag("AI_NVIDIA_ENABLED", true);
/** Task 47 — multi-provider consensus mode (all AI models vote). When false,
 *  features fall back to the single-model chain (model-fallback.ts). */
export const AI_CONSENSUS_ENABLED = readFlag("AI_CONSENSUS_ENABLED", true);
