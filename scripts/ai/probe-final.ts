// Task 47 probe #4 — final NVIDIA candidate sweep + HF legacy inference test
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
const HF = env.HUGGINGFACE_API_KEY ?? "";

async function nvGen(model: string) {
  const t0 = Date.now();
  try {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${NV}`, Accept: "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with exactly: OK" }], max_tokens: 16, temperature: 0 }),
      signal: AbortSignal.timeout(45000),
    });
    const lat = Date.now() - t0;
    if (!res.ok) return { ok: false, lat, err: `HTTP ${res.status}: ${(await res.text()).slice(0, 100)}` };
    const j = await res.json();
    const c = j.choices?.[0]?.message?.content ?? "";
    return c.trim() ? { ok: true, lat, content: c.trim().slice(0, 25) } : { ok: false, lat, err: "empty" };
  } catch (e: any) { return { ok: false, lat: Date.now() - t0, err: String(e?.message ?? e).slice(0, 60) }; }
}

async function main() {
  const candidates = [
    "openai/gpt-oss-20b",
    "nvidia/nemotron-3-super-120b-a12b",
    "nvidia/nemotron-3.5-lightning-30b-a3b",
    "nvidia/nemotron-nano-3-30b-a3b",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    "nvidia/nemotron-3-ultra-550b-a55b",
    "minimaxai/minimax-m3.1-flash",
    "nvidia/llama3-chatqa-1.5-70b",
    "mistralai/mixtral-8x22b-v0.1",
    "zyphra/zamba2-7b-instruct",
    "stepfun-ai/step-5-preview",
    "poolside/laguna-xs-2.1",
    "writer/palmyra-fin-70b-32k",
    "writer/palmyra-creative-122b",
    "nvidia/nemotron-3.5-super-vl-120b-a12b",
    "nvidia/nemotron-3.5-bolt-e4b",
    "nvidia/ising-calibration-1.5-31b",
  ];
  console.log("=== NVIDIA candidate sweep ===");
  const ok: string[] = [];
  for (const m of candidates) {
    const g = await nvGen(m);
    if (g.ok) { ok.push(m); console.log(`✅ ${m} — ${g.lat}ms "${g.content}"`); }
    else console.log(`❌ ${m} — ${g.lat}ms ${g.err}`);
  }
  console.log("\nNVIDIA WORKING:", JSON.stringify(ok));

  console.log("\n=== HF legacy api-inference (sanctions screen model) ===");
  try {
    const res = await fetch("https://api-inference.huggingface.co/models/dbmdz/bert-large-cased-finetuned-conll03-english", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${HF}` },
      body: JSON.stringify({ inputs: "President Barack Obama visited Paris with Angela Merkel." }),
      signal: AbortSignal.timeout(30000),
    });
    console.log(res.ok ? `✅ HTTP 200 — ${(await res.text()).slice(0, 150)}` : `❌ HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
  } catch (e: any) { console.log("❌", String(e?.message ?? e)); }
}
main();
