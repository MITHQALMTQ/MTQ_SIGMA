// Task 47 diagnostic — dump what each voter actually returns for the
// risk-signals prompt (raw content, server-side only).
import { createClient } from "@libsql/client";
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

const MODELS: Array<{ provider: "nvidia" | "openrouter"; model: string }> = [
  { provider: "nvidia", model: "nvidia/nemotron-3.5-bolt-e4b" },
  { provider: "nvidia", model: "poolside/laguna-xs-2.1" },
  { provider: "openrouter", model: "openrouter/free" },
];
const ENDPOINTS = {
  nvidia: "https://integrate.api.nvidia.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

const SYSTEM = "You are a JSON-only risk monitor. Output only a JSON array — no prose, no markdown fences.";
const USER = `You are a real-time risk monitor for the MTQΣ protocol. Given this live snapshot, output 2-5 risk signals as a JSON array. Each signal MUST be an object with shape: {severity: 'critical'|'warning'|'info', title: string, detail: string, source: string}. Only emit signals for genuine risks (don't pad). If everything is normal, emit one 'info' signal saying so.

Snapshot:
{"gfbIndex":1.1828,"mtqPrice":1.1828,"status":"NORMAL","reserveRatio":null,"lcr":null,"bufferState":"BASE","oraclePaused":false,"concentration":{"topIssuer":"CIRCLE","sharePct":25.57,"status":"warn"},"ejectStage":{"perCurrency":{},"max":0}}

Risk areas to consider: oracle consensus (paused/ok), issuer concentration (top issuer share vs 25% warn / 30% breach), peg health (mtqPrice vs 1.00 PAR, band 0.50-2.00), buffer state (BASE/STRESS/EMERGENCY), geopolitical eject ladder (stage 0 = inactive), reserve ratio (1.10 target, 1.05 stress floor), reconciliation findings.

Output ONLY the JSON array — no markdown fences, no prose. The 'source' field must be a short string (e.g. '§9 oracle', '§5.6 concentration', '§14.1 buffer').`;

async function main() {
  for (const m of MODELS) {
    const t0 = Date.now();
    try {
      const res = await fetch(ENDPOINTS[m.provider], {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${env[m.provider === "nvidia" ? "NVIDIA_API_KEY" : "OPENROUTER_API_KEY"]}`,
          ...(m.provider === "openrouter" ? { "HTTP-Referer": "https://mtq-sigma.vercel.app", "X-Title": "MTQ-Sigma Pilot" } : {}),
        },
        body: JSON.stringify({ model: m.model, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: USER }], max_tokens: 500, temperature: 0.2, top_p: 1 }),
        signal: AbortSignal.timeout(30000),
      });
      const lat = Date.now() - t0;
      if (!res.ok) {
        console.log(`\n### ${m.provider}/${m.model} — HTTP ${res.status} (${lat}ms): ${(await res.text()).slice(0, 120)}`);
        continue;
      }
      const j = await res.json();
      const content = j.choices?.[0]?.message?.content ?? "";
      console.log(`\n### ${m.provider}/${m.model} — ${lat}ms, ${content.length} chars`);
      console.log(content.slice(0, 700));
    } catch (e: any) {
      console.log(`\n### ${m.provider}/${m.model} — ERROR ${String(e?.message ?? e).slice(0, 100)}`);
    }
  }
}
main();
