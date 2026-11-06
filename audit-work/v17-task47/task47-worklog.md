# Task 47 — Free-Tier Multi-Provider AI Consensus Layer (2026-11-06)

## Owner directive (verbatim, session web-32fffef0… trace 1a1b137dc437a1e9)
"proceed and be sure we connect to totaly free api open source that is totaly free and no billing ever needed. download all databases needed for the platform to boost functioning and outsmart all competitors. use: GROQ API: … OPENROUTER AI: … Nvidea api: … Google ai studio: … hugging face api … in consensus and remove all z.ai. check all models for each AI model, and be sure to use what is best for the tasks, and can use couple of models in the same AI model. All AI models work in consensus and remove all z.ai. check if the api ai is already available if not, add them and remove not working from the .env and only keep what is working. then proceed our audit and checking"

## §1 LIVE KEY VALIDATION (all five keys, scripts/ai/validate-providers.ts + probes)

| Provider | Key present | AUTH | GEN | Verdict | Evidence |
|---|---|---|---|---|---|
| NVIDIA NIM | ✅ | ✅ 84 models | ✅ 5 endpoints | **KEEP** | mistral-large-4-1t 2.1s · llama-3.2-90b 15.3s · gemma-4-31b 30.0s(cold) · poolside/laguna-xs 0.26s · nemotron-3.5-bolt 0.36s |
| OpenRouter | ✅ | ✅ key meter | ✅ 2 free endpoints | **KEEP** | xing4.0-29b-a4b:free 0.85s · openrouter/free 0.77s (rest: ZDR-blocked or region-403) |
| Groq | ✅ | ❌ 403 Forbidden | ❌ | **REMOVE** | `{"error":{"message":"Forbidden"}}` at /openai/v1/models |
| Google AI Studio | ✅ | ❌ 403 | ❌ | **REMOVE** | `"Your API key was reported as leaked"` — Google's leaked-credential scanner revoked it |
| Hugging Face | ✅ | ✅ whoami (user=fortleem) | ❌ 402 | **REMOVE** | `"Purchase pre-paid credits"` = paywall → violates "no billing ever"; api-inference domain no longer resolves |

.env pruned to NVIDIA_API_KEY + OPENROUTER_API_KEY only (header documents removals).

## §2 MODEL MATRIX (validated, per task — "use what is best for the tasks")

**Roster (7 endpoints, 2 providers):**
- nvidia/mistralai/mistral-large-4-1t-a52b — ANCHOR (strongest reasoner; intermittent empty-content, retried)
- openrouter/openrouter/free — ANCHOR (meta-router; intermittently ZDR-404/429)
- openrouter/xingchen-agi/xing4.0-29b-a4b:free — VERIFIER (reliable on SHORT JSON prompts)
- nvidia/nvidia/nemotron-3.5-bolt-e4b — FAST (best instruction-follower)
- nvidia/poolside/laguna-xs-2.1 — FAST (258ms)
- nvidia/meta/llama-3.2-90b-vision-instruct — VERIFIER (5-voter panels)
- nvidia/google/gemma-4-31b-it — VERIFIER (cold-start heavy, 5-voter panels)

**Capability findings (live-evidenced):**
- mistral-large-4 times out on ≥4KB contexts / long outputs (45s+) — works on short prompts (adhoc 13s good answers)
- xing4.0 (29B) rambles unparseably on complex multi-paragraph instructions; fine on short JSON
- bolt-e4b + poolside are the reliable long-context instruction-followers
- PANEL_3 (short/JSON): mistral+xing4+bolt · PANEL_FAST (long-context/prose): bolt+poolside+xing4

**z.ai exclusion (owner directive):** nvidia/z-ai/glm-5.3-flash exists in the NVIDIA catalog — recorded as `EXCLUDED` in AiModelCatalog (auditable, never routed). The append-only approval ledger's historical "zai-web session" channel strings are IMMUTABLE AUDIT EVIDENCE and were not rewritten.

## §3 ARCHITECTURE (src/lib/ai/)

- **consensus.ts** — the engine: fan-out to k voters (Promise.allSettled) → per-vote JSON extraction (fence-tolerant, array/single-signal normalization) → placeholder/ellipsis gates → aggregation:
  - `field-majority` (JSON objects; canonical-value mode; roster-priority tie-break)
  - `medoid` (prose: draft with highest mean pairwise lexical similarity wins)
  - `signal-merge` (arrays: title-Jaccard ≥ 0.34 clustering; quorum = ≥ceil(k/2) distinct voters per cluster; majority severity)
  - quorum ≥ ceil(k/2) parsed votes; honest NO-QUORUM/ALL-FAILED otherwise
  - 429 + empty-content retry (1x, 1.5s backoff); per-model timeouts
  - persistence: ConsensusRun + ConsensusVote (sha256 content digests, no raw content) — best-effort, never breaks responses; boot-safe `CREATE TABLE IF NOT EXISTS` DDL mirror (survives stale-dump self-heal restores)
- **catalog.ts** — downloads both provider catalogs → AiModelCatalog (99 rows: NVIDIA 84 + OpenRouter free 15; probe status + latency provenance)
- **model-fallback.ts** — validated single-model degradation chain (bolt → openrouter/free → mistral → poolside → xing4; 30s timeouts)
- briefing/qa/risk-signals — consensus PRIMARY → chain degradation → deterministic fallback-rules (all preserved)
- routes: GET /api/ai/status (consensus view) · POST /api/ai/consensus (ad-hoc, MTQ fact-sheet, rate-limited) · POST /api/ai/catalog-sync
- z-ai-web-dev-sdk REMOVED from package.json (was declared, never imported in src/)

## §4 PRISMA (custom.db — additive, no data loss)
AiModelCatalog · ConsensusRun · ConsensusVote (+2 indexes each). `db:push` OK. Cloud-sync dump refreshed: 13 tables / 14,474 rows (AiModelCatalog:99 · ConsensusRun:23 · ConsensusVote:69).

## §5 LIVE VERIFICATION (all through the dev server on :3000)
- ad-hoc consensus: CONSENSUS 2/3 (math cross-check 17×23=391, 291=3×97 ✅; RR fact-sheet answers ✅; one honest NO-QUORUM under heavy test rate-limits — recorded, graceful)
- briefing: CONSENSUS 2/3, ~5s, agreement 0.63 (was 34–67s single-model before panel tuning)
- risk-signals: CONSENSUS signal-merge, 2–3 voters, agreement 1.0, ~3s ("Issuer Concentration Warning" cluster)
- qa: CONSENSUS 2/3, 2.5s, agreement 0.65, §-citations correct (§3/§4/§2.6)
- BROWSER E2E (agent-browser): #ai-consensus panel renders (providers ✅/❌ + reasons · roster table · catalog stats · live check · attestation trail) · live UI consensus run persisted (cr_mw540zda_2xx1tg) · briefing + risk footers show consensus + per-voter pills · mobile 390 zero overflow · ZERO console errors
- screenshots: audit-work/v17-task47/*.png
- tsc 0 · lint 0 · secret-scan PASS (worktree 1057 files)

## §6 HONEST LIMITS
- Free-tier endpoints rate-limit under test cadence (xing4 429s; openrouter/free ZDR-404s) — cross-provider participation is opportunistic; NVIDIA duo guarantees quorum. Production cadence (60s/15s caches, 5 req/IP/min) stays within limits.
- Consensus ≠ correctness: models agreeing does not certify facts; all output remains ADVISORY ONLY. The engine math is the source of truth.
- The "downloaded databases" are the provider MODEL CATALOGS (routing data). No external financial datasets were imported (FRED/FX keep their own live pipelines).
- Keys were supplied in an IM chat = exposed transcript; recommend rotation when convenient (recorded, not blocking).
- mistral-large-4 intermittently returns empty content (NVIDIA instance flakiness) — retried once, recorded honestly when it fails.

## §7 FILES
- NEW: src/lib/ai/consensus.ts · src/lib/ai/catalog.ts · src/app/api/ai/consensus/route.ts · src/app/api/ai/catalog-sync/route.ts · src/components/mtq/AIConsensusPanel.tsx · scripts/ai/{validate-providers,probe-models,probe-nvidia-deep,probe-final,smoke-consensus,sync-catalog,diag-risk-votes}.ts
- MODIFIED: src/lib/ai/{keys,model-fallback,policy-briefer,risk-signals,blueprint-qa}.ts · src/app/api/ai/status/route.ts · src/components/mtq/{AIPolicyBriefing,RiskSignals}.tsx · src/components/mtq/sections/DashboardSection.tsx · prisma/schema.prisma · .env.example · package.json (z-ai-web-dev-sdk removed)
