// ============================================================================
// Task 47 probe #2 — find WORKING (model, provider) generation pairs
// for OpenRouter (free models) and NVIDIA (chat models).
// Tries each candidate with a tiny "Reply OK" completion, 12s timeout.
// ============================================================================
import { readFileSync } from "node:fs";
function loadEnv(path = ".env"): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith("#")) out[m[1]] = m[2];
    }
  } catch {}
  return out;
}
const env = loadEnv(".env");
const OR_KEY = env.OPENROUTER_API_KEY ?? "";
const NV_KEY = env.NVIDIA_API_KEY ?? "";

async function tryGen(url: string, key: string, model: string, extraHeaders: Record<string, string> = {}): Promise<{ ok: boolean; latencyMs: number; err?: string; content?: string }> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...extraHeaders },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with exactly: OK" }], max_tokens: 16, temperature: 0 }),
      signal: AbortSignal.timeout(12000),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { ok: false, latencyMs, err: `HTTP ${res.status}: ${(await res.text()).slice(0, 150)}` };
    const j = await res.json();
    const c = j.choices?.[0]?.message?.content ?? "";
    if (!c.trim()) return { ok: false, latencyMs, err: "empty" };
    return { ok: true, latencyMs, content: c.trim().slice(0, 20) };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - t0, err: String(e?.message ?? e).slice(0, 120) };
  }
}

async function main() {
  // ---------- OpenRouter: all :free models ----------
  console.log("=== OPENROUTER free-model probe ===");
  const orModels: string[] = [];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(15000) });
    const j = await res.json();
    for (const m of j.data ?? []) {
      const p = m.pricing ?? {};
      const zero = (v: any) => v === "0" || Number(v) === 0;
      if ((zero(p.prompt) && zero(p.completion)) || /:free$/.test(m.id)) orModels.push(m.id);
    }
  } catch (e: any) { console.log("models list failed:", e?.message ?? e); }
  console.log(`free models (${orModels.length}): ${orModels.join(", ")}\n`);
  const orOK: Array<{ model: string; latencyMs: number }> = [];
  for (const m of orModels) {
    const g = await tryGen("https://openrouter.ai/api/v1/chat/completions", OR_KEY, m, { "HTTP-Referer": "https://mtq-sigma.vercel.app", "X-Title": "MTQ-Sigma Pilot" });
    if (g.ok) { orOK.push({ model: m, latencyMs: g.latencyMs }); console.log(`  ✅ ${m} — ${g.latencyMs}ms "${g.content}"`); }
    else console.log(`  ❌ ${m} — ${g.err}`);
  }

  // ---------- NVIDIA: chat-plausible models from live catalog ----------
  console.log("\n=== NVIDIA chat-model probe ===");
  const nvAll: string[] = [];
  try {
    const res = await fetch("https://integrate.api.nvidia.com/v1/models", { headers: { Authorization: `Bearer ${NV_KEY}` }, signal: AbortSignal.timeout(15000) });
    const j = await res.json();
    nvAll.push(...(j.data ?? []).map((m: any) => m.id));
  } catch (e: any) { console.log("models list failed:", e?.message ?? e); }
  // plausible instruction/chat models, prioritized
  const prefs = [
    /llama-3\.3-70b-instruct/i, /llama-3\.1-8b-instruct/i, /llama-3\.1-70b-instruct/i,
    /deepseek-r1/i, /deepseek-v/i, /qwen2\.5-(7|14|32|72)b/i, /qwen3/i, /nemotron.*instruct/i,
    /mistral.*instruct/i, /gemma/i, /phi-3/i, /yi-large/i, /jamba/i,
  ];
  const chatLike = nvAll.filter((m) => prefs.some((p) => p.test(m)) && !/embed|rerank|guard|nemoretriever|clip|sdxl|stable-diffusion|flux|neva|vla|ocr|caption/i.test(m));
  console.log(`chat-plausible (${chatLike.length}): ${chatLike.join(", ")}\n`);
  const nvOK: Array<{ model: string; latencyMs: number }> = [];
  for (const m of chatLike.slice(0, 25)) {
    const g = await tryGen("https://integrate.api.nvidia.com/v1/chat/completions", NV_KEY, m, { Accept: "application/json" });
    if (g.ok) { nvOK.push({ model: m, latencyMs: g.latencyMs }); console.log(`  ✅ ${m} — ${g.latencyMs}ms "${g.content}"`); }
    else console.log(`  ❌ ${m} — ${g.err}`);
  }

  console.log("\n=== SUMMARY ===");
  console.log("OPENROUTER working:", JSON.stringify(orOK));
  console.log("NVIDIA working:", JSON.stringify(nvOK));
}
main();
