// MTQΣ — AI Model Fallback Chain (Task 47: VALIDATED single-model path)
//
// ROLE AFTER TASK 47: this is the DEGRADATION path. The primary AI path is
// now the multi-provider CONSENSUS engine (src/lib/ai/consensus.ts) — every
// feature fans out to a voter panel and aggregates. This chain is used when
// AI_CONSENSUS_ENABLED=false or as the last resort before fallback-rules.
//
// All endpoints below were LIVE-validated on 2026-11-06 (Task-47 probes):
//   1. NVIDIA  mistralai/mistral-large-4-1t-a52b     (2.1s — anchor)
//   2. OpenRouter xingchen-agi/xing4.0-29b-a4b:free  (0.85s — 2nd provider)
//   3. NVIDIA  nvidia/nemotron-3.5-bolt-e4b          (0.36s — fast)
//   4. OpenRouter openrouter/free                    (0.77s — meta-router)
//   5. NVIDIA  poolside/laguna-xs-2.1                (0.26s — fastest)
//   6. fallback-rules (deterministic, always works, no AI)
// REMOVED from the chain (failed live validation): Groq llama-3.3 (key 403),
// OpenRouter meta-llama (ZDR-blocked), NVIDIA meta/llama-3.3 (404), Gemini
// 2.0-flash (key leaked-revoked), HF Llama-3.3 (402 paywall — not free).
// z.ai/zai-org models are excluded by owner directive "remove all z.ai".

export type AIModelProvider = "groq" | "openrouter" | "nvidia" | "gemini" | "huggingface" | "fallback";

export interface AIModelConfig {
  provider: AIModelProvider;
  model: string;
  apiKey: string;
  endpoint: string;
  maxTokens: number;
  temperature: number;
}

export interface AIModelResult {
  provider: AIModelProvider;
  model: string;
  content: string;
  success: boolean;
  error?: string;
  latencyMs: number;
}

// The fallback chain — tried in order until one succeeds (validated set;
// ordered by observed reliability: bolt first, weak instruction-followers last)
export const MODEL_CHAIN: AIModelConfig[] = [
  {
    provider: "nvidia",
    model: "nvidia/nemotron-3.5-bolt-e4b",
    apiKey: process.env.NVIDIA_API_KEY ?? "",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    maxTokens: 1024,
    temperature: 0.2,
  },
  {
    provider: "openrouter",
    model: "openrouter/free",
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    maxTokens: 1024,
    temperature: 0.2,
  },
  {
    provider: "nvidia",
    model: "mistralai/mistral-large-4-1t-a52b",
    apiKey: process.env.NVIDIA_API_KEY ?? "",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    maxTokens: 1024,
    temperature: 0.2,
  },
  {
    provider: "nvidia",
    model: "poolside/laguna-xs-2.1",
    apiKey: process.env.NVIDIA_API_KEY ?? "",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    maxTokens: 1024,
    temperature: 0.2,
  },
  {
    provider: "openrouter",
    model: "xingchen-agi/xing4.0-29b-a4b:free",
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    maxTokens: 1024,
    temperature: 0.2,
  },
];

/**
 * Try each model in the fallback chain until one succeeds.
 * Returns the first successful result, or a fallback-rules result if all fail.
 */
export async function callWithFallback(
  messages: Array<{ role: string; content: string }>,
  options?: { maxTokens?: number; temperature?: number },
): Promise<AIModelResult> {
  const maxTokens = options?.maxTokens ?? 1024;
  const temperature = options?.temperature ?? 0.7;

  for (const config of MODEL_CHAIN) {
    if (!config.apiKey) continue; // skip if no key configured

    const start = Date.now();
    try {
      const content = await callModel(config, messages, maxTokens, temperature);
      if (content && content.length > 0) {
        return {
          provider: config.provider,
          model: config.model,
          content,
          success: true,
          latencyMs: Date.now() - start,
        };
      }
    } catch (e: any) {
      console.error(`[ai-fallback] ${config.provider} (${config.model}) failed: ${(e?.message ?? String(e)).slice(0, 1000)}`);
      // Continue to next model
    }
  }

  // All models failed — return fallback
  return {
    provider: "fallback",
    model: "fallback-rules",
    content: "", // caller provides the fallback content
    success: false,
    error: "All AI providers failed",
    latencyMs: 0,
  };
}

async function callModel(
  config: AIModelConfig,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number,
): Promise<string> {
  if (config.provider === "gemini") {
    return callGemini(config, messages, maxTokens, temperature);
  }
  if (config.provider === "huggingface") {
    return callHuggingFace(config, messages, maxTokens, temperature);
  }

  // Groq, OpenRouter, NVIDIA all use OpenAI-compatible API
  const res = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...(config.provider === "openrouter" ? { "HTTP-Referer": "https://mtq-sigma.vercel.app" } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${config.provider} HTTP ${res.status}: ${err.slice(0, 500)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(
  config: AIModelConfig,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number,
): Promise<string> {
  const model = config.model;
  const url = `${config.endpoint}/${model}:generateContent?key=${config.apiKey}`;
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${err.slice(0, 100)}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callHuggingFace(
  config: AIModelConfig,
  messages: Array<{ role: string; content: string }>,
  _maxTokens: number,
  temperature: number,
): Promise<string> {
  const prompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const url = `${config.endpoint}/${config.model}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { temperature, max_new_tokens: _maxTokens, return_full_text: false },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HuggingFace HTTP ${res.status}: ${err.slice(0, 100)}`);
  }

  const data = await res.json();
  if (Array.isArray(data) && data[0]?.generated_text) {
    return data[0].generated_text;
  }
  return "";
}

/**
 * Get the status of all AI providers (for monitoring/debugging).
 */
export function getProviderStatus(): Array<{ provider: string; configured: boolean; model: string }> {
  return MODEL_CHAIN.map((c) => ({
    provider: c.provider,
    configured: c.apiKey.length > 0,
    model: c.model,
  }));
}
