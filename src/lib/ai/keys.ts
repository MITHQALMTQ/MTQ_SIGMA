// MTQΣ — Server-side AI key validation + feature flags.
//
// IMPORTANT: This module is server-side ONLY. It must NEVER be imported from a
// client component (the bundler would tree-shake `process.env` to a literal
// undefined, but we add an explicit `typeof window !== 'undefined'` guard in
// `getKeys()` as defense in depth).
//
// The three provider keys (Gemini / Groq / Hugging Face) are read from
// `process.env` exactly once at module load. They are NEVER exposed to the
// client. AI calls always happen server-side via the /api/ai/* routes.
//
// Feature flags default to `true`. The protocol owner can disable a specific
// AI capability (e.g. AI_BRIEFING_ENABLED=false) without changing code — the
// corresponding /api/ai/* route returns HTTP 503 with `{ model: "disabled" }`.

export type AIProvider = "gemini" | "groq" | "huggingface";

export interface AIKeys {
  gemini: string;
  groq: string;
  huggingface: string;
}

// Read once at module load — keys do not change at runtime.
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const HF_KEY = process.env.HUGGINGFACE_API_KEY ?? "";

/**
 * Returns the three AI provider keys. Throws if called from a browser
 * (defense in depth — even if a lib module accidentally leaks to the client
 * bundle, the keys can never be read there).
 */
export function getKeys(): AIKeys {
  if (typeof window !== "undefined") {
    throw new Error("AI keys must only be accessed server-side");
  }
  return { gemini: GEMINI_KEY, groq: GROQ_KEY, huggingface: HF_KEY };
}

/** True if the given provider has a non-empty API key configured. */
export function hasKey(provider: AIProvider): boolean {
  const k = getKeys();
  return k[provider].length > 0;
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
