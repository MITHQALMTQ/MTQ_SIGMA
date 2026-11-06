// ============================================================================
// MTQΣ — Task 47: FREE-TIER AI PROVIDER VALIDATOR
// ----------------------------------------------------------------------------
// Live-tests every provider key from .env against the real API:
//   1) AUTH  — can the key list models? (key validity + free-tier access)
//   2) GEN   — can it actually generate? (tiny "reply OK" completion)
//   3) CATALOG — snapshot the full model list (for the consensus router DB)
//
// Usage: bun run scripts/ai/validate-providers.ts [--json]
// Exit 0 if at least MIN_PROVIDERS (2) pass both AUTH+GEN — else exit 1.
// ============================================================================
import { readFileSync } from "node:fs";

// --- load .env manually (works under bun & node; no dotenv dep needed) -----
function loadEnv(path = ".env"): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const txt = readFileSync(path, "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith("#")) out[m[1]] = m[2];
    }
  } catch {}
  return out;
}
const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };

const GROQ_KEY = env.GROQ_API_KEY ?? "";
const OR_KEY = env.OPENROUTER_API_KEY ?? "";
const NV_KEY = env.NVIDIA_API_KEY ?? "";
const GO_KEY = env.GEMINI_API_KEY ?? "";
const HF_KEY = env.HUGGINGFACE_API_KEY ?? "";

const MIN_PROVIDERS = 2;

interface ProviderResult {
  provider: string;
  keyPresent: boolean;
  auth: boolean;
  gen: boolean;
  genModel?: string;
  genLatencyMs?: number;
  genError?: string;
  catalogCount: number;
  catalogSample: string[];
  notes: string;
}

async function timedFetch(url: string, init: RequestInit, ms = 20000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}

// --------------------------------------------------------------------------
// GROQ — https://api.groq.com/openai/v1 (OpenAI-compatible)
// --------------------------------------------------------------------------
async function testGroq(): Promise<ProviderResult> {
  const r: ProviderResult = { provider: "groq", keyPresent: !!GROQ_KEY, auth: false, gen: false, catalogCount: 0, catalogSample: [], notes: "free tier, LPU-fast" };
  if (!GROQ_KEY) { r.notes = "no key"; return r; }
  try {
    const res = await timedFetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${GROQ_KEY}` } });
    if (res.ok) {
      const j = await res.json();
      const ids: string[] = (j.data ?? []).map((m: any) => m.id).filter((x: string) => !/whisper|tts|guard|prompt-guard/i.test(x));
      r.auth = true; r.catalogCount = ids.length; r.catalogSample = ids.slice(0, 30);
    } else { r.notes = `auth HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`; return r; }
  } catch (e: any) { r.notes = `auth error ${e?.message ?? e}`; return r; }
  // tiny generation on a small fast model
  const genModel = r.catalogSample.find((m) => /llama-3\.1-8b-instant|llama-3\.3-8b|gemma-2-9b/i.test(m)) ?? r.catalogSample[0];
  if (!genModel) { r.notes = "no chat model in catalog"; return r; }
  try {
    const t0 = Date.now();
    const res = await timedFetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({ model: genModel, messages: [{ role: "user", content: "Reply with exactly: OK" }], max_tokens: 8, temperature: 0 }),
    });
    if (res.ok) {
      const j = await res.json();
      const c = j.choices?.[0]?.message?.content ?? "";
      if (c.trim().length > 0) { r.gen = true; r.genModel = genModel; r.genLatencyMs = Date.now() - t0; }
      else r.genError = "empty content";
    } else r.genError = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
  } catch (e: any) { r.genError = String(e?.message ?? e); }
  return r;
}

// --------------------------------------------------------------------------
// OPENROUTER — https://openrouter.ai/api/v1 (free models have :free suffix)
// --------------------------------------------------------------------------
async function testOpenRouter(): Promise<ProviderResult> {
  const r: ProviderResult = { provider: "openrouter", keyPresent: !!OR_KEY, auth: false, gen: false, catalogCount: 0, catalogSample: [], notes: "aggregator; :free models are $0" };
  if (!OR_KEY) { r.notes = "no key"; return r; }
  try {
    const res = await timedFetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${OR_KEY}` } });
    if (res.ok) {
      const j = await res.json();
      r.auth = true;
      r.notes = `free-tier aggregator; key usage=${JSON.stringify(j.data?.usage ?? null).slice(0, 120)}`;
    } else { r.notes = `key check HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`; return r; }
  } catch (e: any) { r.notes = `auth error ${e?.message ?? e}`; return r; }
  try {
    const res = await timedFetch("https://openrouter.ai/api/v1/models");
    if (res.ok) {
      const j = await res.json();
      const free = (j.data ?? []).filter((m: any) => {
        const p = m.pricing ?? {};
        const zero = (v: any) => v === "0" || Number(v) === 0;
        return (zero(p.prompt) && zero(p.completion)) || /:free$/.test(m.id);
      }).map((m: any) => m.id);
      r.catalogCount = free.length; r.catalogSample = free.slice(0, 40);
    }
  } catch (e: any) { r.notes += ` | models error ${e?.message ?? e}`; }
  const genModel = r.catalogSample.find((m) => /llama-3\.3-70b|qwen3|mistral-small|gemma-3/i.test(m)) ?? r.catalogSample[0];
  if (!genModel) { r.notes += " | no free chat model"; return r; }
  try {
    const t0 = Date.now();
    const res = await timedFetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OR_KEY}`, "HTTP-Referer": "https://mtq-sigma.vercel.app", "X-Title": "MTQ-Sigma Pilot" },
      body: JSON.stringify({ model: genModel, messages: [{ role: "user", content: "Reply with exactly: OK" }], max_tokens: 8, temperature: 0 }),
    });
    if (res.ok) {
      const j = await res.json();
      const c = j.choices?.[0]?.message?.content ?? "";
      if (c.trim().length > 0) { r.gen = true; r.genModel = genModel; r.genLatencyMs = Date.now() - t0; }
      else r.genError = "empty content";
    } else r.genError = `HTTP ${res.status}: ${(await res.text()).slice(0, 250)}`;
  } catch (e: any) { r.genError = String(e?.message ?? e); }
  return r;
}

// --------------------------------------------------------------------------
// NVIDIA NIM — https://integrate.api.nvidia.com/v1 (OpenAI-compatible)
// --------------------------------------------------------------------------
async function testNvidia(): Promise<ProviderResult> {
  const r: ProviderResult = { provider: "nvidia", keyPresent: !!NV_KEY, auth: false, gen: false, catalogCount: 0, catalogSample: [], notes: "NIM build endpoints" };
  if (!NV_KEY) { r.notes = "no key"; return r; }
  try {
    const res = await timedFetch("https://integrate.api.nvidia.com/v1/models", { headers: { Authorization: `Bearer ${NV_KEY}` } });
    if (res.ok) {
      const j = await res.json();
      const ids: string[] = (j.data ?? []).map((m: any) => m.id);
      r.auth = true; r.catalogCount = ids.length; r.catalogSample = ids.slice(0, 40);
    } else { r.notes = `auth HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`; return r; }
  } catch (e: any) { r.notes = `auth error ${e?.message ?? e}`; return r; }
  const genModel = r.catalogSample.find((m) => /llama-3\.1-8b-instruct|nemotron|qwen/i.test(m)) ?? r.catalogSample[0];
  if (!genModel) { r.notes += " | no chat model"; return r; }
  try {
    const t0 = Date.now();
    const res = await timedFetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${NV_KEY}`, Accept: "application/json" },
      body: JSON.stringify({ model: genModel, messages: [{ role: "user", content: "Reply with exactly: OK" }], max_tokens: 8, temperature: 0, top_p: 1 }),
    });
    if (res.ok) {
      const j = await res.json();
      const c = j.choices?.[0]?.message?.content ?? "";
      if (c.trim().length > 0) { r.gen = true; r.genModel = genModel; r.genLatencyMs = Date.now() - t0; }
      else r.genError = "empty content";
    } else r.genError = `HTTP ${res.status}: ${(await res.text()).slice(0, 250)}`;
  } catch (e: any) { r.genError = String(e?.message ?? e); }
  return r;
}

// --------------------------------------------------------------------------
// GOOGLE AI STUDIO — generativelanguage.googleapis.com (Gemini free tier)
// --------------------------------------------------------------------------
async function testGoogle(): Promise<ProviderResult> {
  const r: ProviderResult = { provider: "google", keyPresent: !!GO_KEY, auth: false, gen: false, catalogCount: 0, catalogSample: [], notes: "Gemini API free tier" };
  if (!GO_KEY) { r.notes = "no key"; return r; }
  try {
    const res = await timedFetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${GO_KEY}`);
    if (res.ok) {
      const j = await res.json();
      const models = (j.models ?? []).filter((m: any) => (m.supportedGenerationMethods ?? []).includes("generateContent"));
      const ids: string[] = models.map((m: any) => m.name.replace(/^models\//, ""));
      r.auth = true; r.catalogCount = ids.length; r.catalogSample = ids.slice(0, 40);
    } else { r.notes = `auth HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`; return r; }
  } catch (e: any) { r.notes = `auth error ${e?.message ?? e}`; return r; }
  const genModel = r.catalogSample.find((m) => /gemma-3-(4|12|27)b|gemini-2\.0-flash\b|gemini-2\.5-flash\b|gemini-3\.[58]-flash\b/i.test(m)) ?? r.catalogSample.find((m) => !/embedding|aqa|image|tts|veo/i.test(m));
  if (!genModel) { r.notes += " | no chat model"; return r; }
  try {
    const t0 = Date.now();
    const res = await timedFetch(`https://generativelanguage.googleapis.com/v1beta/models/${genModel}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GO_KEY },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with exactly: OK" }] }], generationConfig: { maxOutputTokens: 8, temperature: 0 } }),
    });
    if (res.ok) {
      const j = await res.json();
      const c = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
      if (c.trim().length > 0) { r.gen = true; r.genModel = genModel; r.genLatencyMs = Date.now() - t0; }
      else r.genError = "empty content (finishReason=" + (j.candidates?.[0]?.finishReason ?? "?") + ")";
    } else r.genError = `HTTP ${res.status}: ${(await res.text()).slice(0, 250)}`;
  } catch (e: any) { r.genError = String(e?.message ?? e); }
  return r;
}

// --------------------------------------------------------------------------
// HUGGING FACE — router.huggingface.co/v1 (OpenAI-compatible router)
// --------------------------------------------------------------------------
async function testHuggingFace(): Promise<ProviderResult> {
  const r: ProviderResult = { provider: "huggingface", keyPresent: !!HF_KEY, auth: false, gen: false, catalogCount: 0, catalogSample: [], notes: "HF router (serverless free)" };
  if (!HF_KEY) { r.notes = "no key"; return r; }
  try {
    const res = await timedFetch("https://huggingface.co/api/whoami-v2", { headers: { Authorization: `Bearer ${HF_KEY}` } });
    if (res.ok) {
      const j = await res.json();
      r.auth = true;
      r.notes = `user=${j.name ?? "?"} type=${j.type ?? "?"} (fine-grained token works)`;
    } else { r.notes = `whoami HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`; return r; }
  } catch (e: any) { r.notes = `auth error ${e?.message ?? e}`; return r; }
  try {
    const res = await timedFetch("https://router.huggingface.co/v1/models");
    if (res.ok) {
      const j = await res.json();
      const ids: string[] = (j.data ?? []).map((m: any) => m.id);
      r.catalogCount = ids.length; r.catalogSample = ids.slice(0, 40);
    } else r.notes += ` | router models HTTP ${res.status}`;
  } catch (e: any) { r.notes += ` | router models error ${e?.message ?? e}`; }
  const genModel = r.catalogSample.find((m) => /Llama-3\.1-8B-Instruct|Qwen2\.5-7B-Instruct|Llama-3\.3-70B/i.test(m)) ?? r.catalogSample[0];
  if (!genModel) { r.notes += " | no chat model in router catalog"; return r; }
  try {
    const t0 = Date.now();
    const res = await timedFetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${HF_KEY}` },
      body: JSON.stringify({ model: genModel, messages: [{ role: "user", content: "Reply with exactly: OK" }], max_tokens: 8, temperature: 0 }),
    });
    if (res.ok) {
      const j = await res.json();
      const c = j.choices?.[0]?.message?.content ?? "";
      if (c.trim().length > 0) { r.gen = true; r.genModel = genModel; r.genLatencyMs = Date.now() - t0; }
      else r.genError = "empty content";
    } else r.genError = `HTTP ${res.status}: ${(await res.text()).slice(0, 250)}`;
  } catch (e: any) { r.genError = String(e?.message ?? e); }
  return r;
}

// --------------------------------------------------------------------------
async function main() {
  const results = await Promise.all([testGroq(), testOpenRouter(), testNvidia(), testGoogle(), testHuggingFace()]);
  const jsonFlag = process.argv.includes("--json");
  if (jsonFlag) {
    console.log(JSON.stringify({ validatedAt: new Date().toISOString(), results }, null, 2));
  } else {
    for (const r of results) {
      const status = r.auth && r.gen ? "PASS ✅" : r.auth ? "AUTH-ONLY ⚠️" : "FAIL ❌";
      console.log(`\n[${status}] ${r.provider.toUpperCase()}`);
      console.log(`   key: ${r.keyPresent ? "present" : "MISSING"} | auth: ${r.auth} | gen: ${r.gen}${r.genModel ? ` (${r.genModel})` : ""}${r.genLatencyMs ? ` ${r.genLatencyMs}ms` : ""}`);
      console.log(`   catalog: ${r.catalogCount} models | sample: ${r.catalogSample.slice(0, 8).join(", ")}`);
      console.log(`   notes: ${r.notes}${r.genError ? ` | genError: ${r.genError}` : ""}`);
    }
    const passing = results.filter((r) => r.auth && r.gen).length;
    console.log(`\n=== ${passing}/${results.length} providers fully PASS (min ${MIN_PROVIDERS}) ===`);
    process.exit(passing >= MIN_PROVIDERS ? 0 : 1);
  }
}
main();
