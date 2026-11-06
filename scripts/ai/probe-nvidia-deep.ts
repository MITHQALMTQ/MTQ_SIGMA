// Task 47 probe #3 — NVIDIA deep probe (full catalog + long timeouts)
// + OpenRouter openrouter/free retry
import { readFileSync } from "node:fs";
function loadEnv(p = ".env"): Record<string, string> {
  const o: Record<string, string> = {};
  for (const l of readFileSync(p, "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !l.trim().startsWith("#")) o[m[1]] = m[2];
  }
  return o;
}
const env = loadEnv();
const NV = env.NVIDIA_API_KEY ?? "";
const OR = env.OPENROUTER_API_KEY ?? "";

async function gen(url: string, key: string, model: string, ms: number, extra: Record<string, string> = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...extra },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with exactly: OK" }], max_tokens: 16, temperature: 0 }),
      signal: AbortSignal.timeout(ms),
    });
    const lat = Date.now() - t0;
    if (!res.ok) return { ok: false, lat, err: `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}` };
    const j = await res.json();
    const c = j.choices?.[0]?.message?.content ?? "";
    return c.trim() ? { ok: true, lat, content: c.trim().slice(0, 30) } : { ok: false, lat, err: "empty" };
  } catch (e: any) { return { ok: false, lat: Date.now() - t0, err: String(e?.message ?? e).slice(0, 80) }; }
}

async function main() {
  console.log("=== NVIDIA full catalog (84) ===");
  const res = await fetch("https://integrate.api.nvidia.com/v1/models", { headers: { Authorization: `Bearer ${NV}` } });
  const j = await res.json();
  const all: string[] = (j.data ?? []).map((m: any) => m.id);
  console.log(all.join("\n"));

  console.log("\n=== NVIDIA long-timeout candidates ===");
  const candidates = [
    "deepseek-ai/deepseek-v4.1-flash",
    "google/gemma-4-31b-it",
    "google/diffusiongemma-26b-a4b-it",
    "deepseek-ai/deepseek-v4.1", // guess
  ].filter((m) => all.includes(m) || m.includes("v4.1"));
  const extraFromCatalog = all.filter((m) => /deepseek|qwen|llama-3|mistral-large|kimi|glm|ernie|granite/i.test(m) && !candidates.includes(m));
  const tryList = [...candidates, ...extraFromCatalog.slice(0, 12)];
  for (const m of tryList) {
    const g = await gen("https://integrate.api.nvidia.com/v1/chat/completions", NV, m, 75000, { Accept: "application/json" });
    console.log(`${g.ok ? "✅" : "❌"} ${m} — ${g.lat}ms ${g.ok ? `"${g.content}"` : g.err}`);
  }

  console.log("\n=== OpenRouter openrouter/free retry (3x) ===");
  for (let i = 0; i < 3; i++) {
    const g = await gen("https://openrouter.ai/api/v1/chat/completions", OR, "openrouter/free", 45000, { "HTTP-Referer": "https://mtq-sigma.vercel.app", "X-Title": "MTQ-Sigma Pilot" });
    console.log(`${g.ok ? "✅" : "❌"} attempt ${i + 1} — ${g.lat}ms ${g.ok ? `"${g.content}"` : g.err}`);
    if (g.ok) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
}
main();
