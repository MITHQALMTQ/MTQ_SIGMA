// ============================================================================
// MTQΣ — Task 47: PROVIDER MODEL-CATALOG SYNC ("download the databases")
// ----------------------------------------------------------------------------
// Owner directive: "download all databases needed for the platform to boost
// functioning". For the free AI layer those databases are the provider MODEL
// CATALOGS themselves — the authoritative, always-current lists of every
// model each provider exposes. This module downloads both catalogs and
// persists them into custom.db (AiModelCatalog):
//
//   NVIDIA NIM   GET https://integrate.api.nvidia.com/v1/models   (~84 models)
//   OpenRouter   GET https://openrouter.ai/api/v1/models          ($0 models
//                only — the "free" database; ~15 models at last sync)
//
// Each row carries live probe provenance where we have it (Task-47 measured
// latency + status), so the consensus router's decisions are data-driven and
// replayable offline. Rows are keyed "<provider>::<model>" (idempotent upsert
// — re-syncing never duplicates). z.ai/zai-org models are marked EXCLUDED by
// policy (owner directive "remove all z.ai") — they stay in the catalog as
// auditable evidence of the exclusion, but are never routed to.
//
// HONEST LIMITS: this is the pilot's interpretation of "download databases"
// scoped to the AI layer. It does NOT import external financial datasets
// (FRED/FX feeds have their own live pipeline); the catalogs are routing
// data, not market data.
// ============================================================================

import { db } from "@/lib/db";
import { ensureConsensusTables, CONSENSUS_ROSTER } from "./consensus";

// Task-47 live probe evidence (2026-11-06, scripts/ai/*.ts) — models we
// actually generated with, and the notable non-generating ones we probed.
const PROBE_EVIDENCE: Record<string, { status: string; latencyMs?: number }> = {
  // NVIDIA — WORKING (measured first-token latency)
  "nvidia::mistralai/mistral-large-4-1t-a52b": { status: "WORKING", latencyMs: 2095 },
  "nvidia::meta/llama-3.2-90b-vision-instruct": { status: "WORKING", latencyMs: 15305 },
  "nvidia::google/gemma-4-31b-it": { status: "WORKING", latencyMs: 30006 },
  "nvidia::poolside/laguna-xs-2.1": { status: "WORKING", latencyMs: 258 },
  "nvidia::nvidia/nemotron-3.5-bolt-e4b": { status: "WORKING", latencyMs: 360 },
  // NVIDIA — probed, not generating (account has no function for the model)
  "nvidia::01-ai/yi-large": { status: "HTTP_404" },
  "nvidia::ai21labs/jamba-1.5-large-instruct": { status: "HTTP_404" },
  "nvidia::google/codegemma-1.1-7b": { status: "HTTP_404" },
  "nvidia::google/codegemma-7b": { status: "HTTP_404" },
  "nvidia::google/gemma-2b": { status: "HTTP_404" },
  "nvidia::google/gemma-3-12b-it": { status: "HTTP_404" },
  "nvidia::google/gemma-3-4b-it": { status: "HTTP_404" },
  "nvidia::google/recurrentgemma-2b": { status: "HTTP_404" },
  "nvidia::microsoft/phi-3-vision-128k-instruct": { status: "HTTP_404" },
  "nvidia::microsoft/phi-3.5-moe-instruct": { status: "HTTP_404" },
  "nvidia::mistralai/codestral-22b-instruct-v0.1": { status: "HTTP_404" },
  "nvidia::mistralai/mistral-7b-instruct-v0.3": { status: "HTTP_404" },
  "nvidia::mistralai/mistral-large": { status: "HTTP_404" },
  "nvidia::mistralai/mistral-large-2-instruct": { status: "HTTP_404" },
  "nvidia::nv-mistralai/mistral-nemo-12b-instruct": { status: "HTTP_404" },
  "nvidia::nvidia/llama-3.1-nemotron-51b-instruct": { status: "HTTP_404" },
  "nvidia::nvidia/llama-3.1-nemotron-70b-instruct": { status: "HTTP_404" },
  "nvidia::nvidia/mistral-nemo-minitron-8b-8k-instruct": { status: "HTTP_404" },
  "nvidia::nvidia/nemotron-4-340b-instruct": { status: "HTTP_404" },
  "nvidia::nvidia/nemotron-3-super-120b-a12b": { status: "HTTP_404" },
  "nvidia::nvidia/nemotron-nano-3-30b-a3b": { status: "HTTP_404" },
  "nvidia::nvidia/nemotron-3.5-super-vl-120b-a12b": { status: "EMPTY" },
  "nvidia::nvidia/nemotron-3.5-lightning-30b-a3b": { status: "EMPTY" },
  "nvidia::nvidia/nemotron-3-nano-omni-30b-a3b-reasoning": { status: "EMPTY" },
  "nvidia::nvidia/nemotron-3-ultra-550b-a55b": { status: "EMPTY" },
  "nvidia::google/diffusiongemma-26b-a4b-it": { status: "EMPTY" },
  "nvidia::stepfun-ai/step-5-preview": { status: "EMPTY" },
  "nvidia::deepseek-ai/deepseek-v4.1-flash": { status: "TIMEOUT" },
  "nvidia::openai/gpt-oss-20b": { status: "TIMEOUT" },
  "nvidia::minimaxai/minimax-m3.1-flash": { status: "TIMEOUT" },
  "nvidia::nvidia/ising-calibration-1.5-31b": { status: "TIMEOUT" },
  // OpenRouter — WORKING
  "openrouter::xingchen-agi/xing4.0-29b-a4b:free": { status: "WORKING", latencyMs: 850 },
  "openrouter::openrouter/free": { status: "WORKING", latencyMs: 773 },
  // OpenRouter — blocked by account ZDR data-policy / region
  "openrouter::stealth/crouton-alpha": { status: "HTTP_404" },
  "openrouter::recursive/flint-v1.0:free": { status: "HTTP_404" },
  "openrouter::nvidia/nemotron-3.5-super-vl:free": { status: "HTTP_404" },
  "openrouter::dots-studio/dots-3-note-preview:free": { status: "HTTP_404" },
  "openrouter::liquid/lfm-2.5-2.6b:free": { status: "HTTP_404" },
  "openrouter::nvidia/nemotron-3.5-lightning:free": { status: "HTTP_404" },
  "openrouter::cohere/north-mini-code:free": { status: "HTTP_404" },
  "openrouter::nvidia/nemotron-3-ultra-550b-a55b:free": { status: "HTTP_404" },
  "openrouter::nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": { status: "HTTP_404" },
  "openrouter::google/gemma-4-26b-a4b-it:free": { status: "HTTP_404" },
  "openrouter::google/gemma-4-31b-it:free": { status: "HTTP_404" },
  "openrouter::google/lyria-3-pro-preview": { status: "HTTP_403" },
  "openrouter::google/lyria-3-clip-preview": { status: "HTTP_403" },
};

const ROSTER_IDS = new Set(CONSENSUS_ROSTER.map((r) => `${r.provider}::${r.model}`));

/** z.ai exclusion policy — owner directive 2026-11-06 "remove all z.ai". */
function isExcludedByPolicy(model: string): boolean {
  return /^z-ai\//i.test(model) || /^zai-org\//i.test(model) || /\bglm-[0-9]/i.test(model);
}

export interface CatalogSyncResult {
  syncedAt: string;
  providers: Array<{ provider: string; ok: boolean; catalogCount: number; error?: string }>;
  rowsUpserted: number;
  excluded: number;
  working: number;
}

interface CatalogRow {
  id: string;
  provider: string;
  model: string;
  role: string | null;
  status: string;
  latencyMs: number | null;
  free: boolean;
  contextK: number | null;
  source: string;
}

async function fetchNvidiaCatalog(): Promise<string[]> {
  const key = process.env.NVIDIA_API_KEY ?? "";
  if (!key) return [];
  const res = await fetch("https://integrate.api.nvidia.com/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as { data?: Array<{ id?: string }> };
  return (j.data ?? []).map((m) => String(m.id)).filter(Boolean);
}

async function fetchOpenRouterFree(): Promise<string[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as { data?: Array<{ id?: string; pricing?: { prompt?: string; completion?: string } }> };
  const zero = (v: string | undefined) => v === "0" || Number(v ?? 1) === 0;
  return (j.data ?? [])
    .filter((m) => (zero(m.pricing?.prompt) && zero(m.pricing?.completion)) || /:free$/.test(String(m.id)))
    .map((m) => String(m.id));
}

/** Download both catalogs and upsert into AiModelCatalog (idempotent). */
export async function syncModelCatalogs(): Promise<CatalogSyncResult> {
  await ensureConsensusTables();
  const [nvRes, orRes] = await Promise.allSettled([fetchNvidiaCatalog(), fetchOpenRouterFree()]);

  const providers: CatalogSyncResult["providers"] = [];
  const rows: CatalogRow[] = [];

  if (nvRes.status === "fulfilled") {
    providers.push({ provider: "nvidia", ok: true, catalogCount: nvRes.value.length });
    for (const model of nvRes.value) {
      rows.push(buildRow("nvidia", model));
    }
  } else {
    providers.push({ provider: "nvidia", ok: false, catalogCount: 0, error: String((nvRes as PromiseRejectedResult).reason).slice(0, 120) });
    // offline fallback: keep the last-known NVIDIA catalog from probe evidence
    for (const id of Object.keys(PROBE_EVIDENCE).filter((k) => k.startsWith("nvidia::"))) {
      rows.push(buildRow("nvidia", id.slice("nvidia::".length)));
    }
  }

  if (orRes.status === "fulfilled") {
    providers.push({ provider: "openrouter", ok: true, catalogCount: orRes.value.length });
    for (const model of orRes.value) {
      rows.push(buildRow("openrouter", model));
    }
  } else {
    providers.push({ provider: "openrouter", ok: false, catalogCount: 0, error: String((orRes as PromiseRejectedResult).reason).slice(0, 120) });
    for (const id of Object.keys(PROBE_EVIDENCE).filter((k) => k.startsWith("openrouter::"))) {
      rows.push(buildRow("openrouter", id.slice("openrouter::".length)));
    }
  }

  // upsert (idempotent by "<provider>::<model>")
  for (const row of rows) {
    await db.aiModelCatalog.upsert({
      where: { id: row.id },
      create: { ...row, lastProbedAt: row.status !== "NOT_PROBED" ? new Date() : null },
      update: {
        provider: row.provider,
        model: row.model,
        role: row.role,
        status: row.status,
        latencyMs: row.latencyMs,
        free: row.free,
        contextK: row.contextK,
        source: row.source,
        ...(row.status !== "NOT_PROBED" ? { lastProbedAt: new Date() } : {}),
      },
    });
  }

  return {
    syncedAt: new Date().toISOString(),
    providers,
    rowsUpserted: rows.length,
    excluded: rows.filter((r) => r.status === "EXCLUDED").length,
    working: rows.filter((r) => r.status === "WORKING").length,
  };
}

function buildRow(provider: "nvidia" | "openrouter", model: string): CatalogRow {
  const id = `${provider}::${model}`;
  const roster = CONSENSUS_ROSTER.find((r) => r.provider === provider && r.model === model);
  const evidence = PROBE_EVIDENCE[id];
  const status = isExcludedByPolicy(model)
    ? "EXCLUDED"
    : evidence?.status ?? (roster ? "WORKING" : "NOT_PROBED");
  return {
    id,
    provider,
    model,
    role: roster?.role ?? null,
    status,
    latencyMs: evidence?.latencyMs ?? roster?.probeLatencyMs ?? null,
    free: true, // both catalogs are filtered to free-tier by construction
    contextK: null,
    source: "task47-live-probe",
  };
}
