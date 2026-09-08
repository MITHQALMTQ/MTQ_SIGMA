# Task ID: P1-A
Agent: full-stack-developer
Task: Backend AI gateway — Gemini + Groq + Hugging Face integration (4 lib modules + 4 API routes, server-side only, with graceful fallback rules)

## Files CREATED (only files in my ownership)
- `src/lib/ai/keys.ts` (server-side key validation + 4 feature flags)
- `src/lib/ai/policy-briefer.ts` (Gemini 2.0 Flash — COO-voice 3-paragraph briefing, 60s cache, fallback-rules)
- `src/lib/ai/blueprint-qa.ts` (Gemini 2.0 Flash long-context Q&A over blueprint TS constants, §-citation extraction)
- `src/lib/ai/risk-signals.ts` (Groq llama-3.3-70b-versatile — 2-5 risk signals, 15s cache, fallback-rules)
- `src/lib/ai/sanctions-screen.ts` (Hugging Face NER + regex fallback)
- `src/app/api/ai/briefing/route.ts` (GET → calls getSnapshot() + generateBriefing; HTTP 503 if disabled)
- `src/app/api/ai/qa/route.ts` (POST → reads {question}; max 500 chars; falls back to "unavailable" message)
- `src/app/api/ai/risk-signals/route.ts` (GET → calls getSnapshot() + generateRiskSignals)
- `src/app/api/ai/screen/route.ts` (POST → reads {text}; max 5000 chars; ONLY route with CORS headers)

## Files NOT touched (per ownership rules)
- Anything in `src/lib/mtq/` (engine.ts, blueprint.ts, pilot-state.ts, etc.) — READ ONLY.
- Existing `src/app/api/*` routes — READ ONLY.
- Any `src/components/*` — READ ONLY.

## Design decisions

### Server-side-only invariant (defense in depth)
- `keys.ts` reads `process.env.GEMINI_API_KEY / GROQ_API_KEY / HUGGINGFACE_API_KEY` exactly ONCE at module load.
- `getKeys()` throws `Error("AI keys must only be accessed server-side")` if `typeof window !== 'undefined'` — even if a lib module accidentally leaks into a client bundle, the keys can never be read there.
- Routes never call `process.env` directly — they import feature flags from `keys.ts`.
- No lib module has `'use client'` — these are pure server lib modules.

### Feature flags (defaults to `true`)
- `AI_BRIEFING_ENABLED`, `AI_QA_ENABLED`, `AI_RISK_SIGNALS_ENABLED`, `AI_SCREEN_ENABLED`.
- Read once at module load. Truthy values: "true" / "1" / "on" (case-insensitive). Falsy: "false" / "0" / "off".
- When `false`, the corresponding route returns HTTP 503 with `{ error: "AI feature disabled", model: "disabled" }`.

### Snapshot shape reconciliation (engine contract)
- The task spec referenced `snap.ejectStage` as a scalar `> 0` boolean test, but the engine defines `ejectStage: { USD, EUR, GBP, JPY, CNY }` (per-currency 0-4 stage). I added a `maxEjectStage(snap)` helper that returns `Math.max(...Object.values(snap.ejectStage))` and used it everywhere instead of the spec's scalar test. Reported both the per-currency object AND the max in the snapshot JSON summary sent to Gemini.
- The task spec used `top.sharePct` as a percentage, but the engine's `ConcentrationReport.sharePct` is a fraction 0-1 (status `warn` when sharePct >= 0.25, `breach` when >= 0.30). I multiplied by 100 in BOTH the prompt JSON summary AND the fallback text. (e.g. PAXOS at 25.93% of NAV.)
- The pilot currently has `liability = 0` (no MTQ minted yet), so `RR = Infinity` and `LCR = Infinity`. JSON.stringify converts Infinity to `null`. The fallback path handles this explicitly: `"n/a (no MTQ minted yet)"` instead of `"Infinity"`. The prompt JSON summary passes `null` when not finite.
- `snap.reconciliation` fields F1-F4 have `severity: "fixed" | "outstanding" | "informational"`. The fallback picks only `severity === "outstanding"` for the Risk Watch paragraph.

### Gemini model deprecation handling (sandbox discovery)
- The spec says to use `gemini-2.0-flash`. The live Gemini API in this sandbox returns HTTP 404 with `"This model models/gemini-2.0-flash is no longer available. Please update your code to use models/gemini-3.6-flash for the latest features and improvements"`.
- I added a candidate-model loop: try the spec model first, then if a 404 contains a `models/<name>` suggestion, extract that name and retry. Also falls through a hardcoded fallback list `[gemini-3.6-flash, gemini-2.5-flash, gemini-2.0-flash-001, gemini-flash-latest]`. The `model` field returned to the client is the model that actually produced the text (or `"gemini-2.0-flash"` if that one worked). All retries are capped by the per-fetch 10s (briefing) / 12s (qa) AbortSignal.
- After all 5 candidates fail, the deterministic fallback path kicks in. In this sandbox every Gemini candidate returns either 404 (deprecated) or 400 (`"User location is not supported for the API use"`), so the fallback is always exercised — which is exactly the spec's graceful-degradation contract.

### Caching
- `policy-briefer.ts`: 60s in-memory cache (module-level `let cached: { briefing, at } | null`). Both AI-success and fallback-success write to the cache so 4s polling does not burn API quota or recompute the fallback.
- `risk-signals.ts`: 15s cache (fresher than briefing — risk signals need to reflect recent state).
- `blueprint-qa.ts`: no cache (every question is unique).
- `sanctions-screen.ts`: no cache (every text is unique).

### AI outputs always include `disclaimer` field
- `policy-briefer.ts`: `"AI-generated by Gemini. Informational only — not financial advice. The engine math (src/lib/mtq/engine.ts) is the source of truth."` (mutated slightly when fallback runs to say "by fallback rules…").
- `blueprint-qa.ts`: `"AI-generated by Gemini from the blueprint constants. Informational only."`
- `risk-signals.ts`: no disclaimer field (it's a structured array, not text — the per-signal `source` field already labels them as advisory). The spec did not ask for a disclaimer field here.
- `sanctions-screen.ts`: `"AI-generated by Hugging Face NER. Informational only — not a substitute for OFAC/EU/UN sanctions list checks."` (mutated when fallback runs to say "by fallback regex…").

### CORS
- `screen` route is the ONLY one that emits `Access-Control-Allow-Origin: *` (per spec — it may be called from external screening tools). Added OPTIONS preflight handler that returns 204 with the CORS headers.
- The other 3 routes (`briefing`, `qa`, `risk-signals`) are same-origin — no CORS headers.
- Verified: `curl -I OPTIONS /api/ai/screen` returns the 3 CORS headers; `curl -I /api/ai/briefing` returns NO CORS headers.

### AI is ADVISORY ONLY — never writes to engine state
- Every lib function is `async ... Promise<...>` — pure read-only over the snapshot.
- No function calls `applyMint`, `applyRebalanceTrade`, `applyMarpRebalance`, `commitIndexGold`, or any state mutator from `engine.ts`.
- The routes only read `getSnapshot()` (the snapshot is already a pure projection); they never call `applyTrial` or any mutator.

## Verification

### 1. `bun run lint` → exit 0
```
$ eslint .
$ EXIT=0
```
Zero ESLint errors, zero warnings across all 9 new files.

### 2. `/api/ai/briefing` (GET)
```text
model: fallback-rules
briefing length: 505
first 200: State of the Protocol: GFB Index at 1.7587, MTQ price at 1.7587 (peg outside band),
Reserve Ratio n/a (no MTQ minted yet) (target 1.10, stress floor 1.05), LCR n/a (no MTQ minted yet),
protocol status NORMAL. Risk Watch: Issuer concentration warning: PAXOS at 25.91% of NAV, above the
25% warn threshold. Recommended Governance Actions: Continue the multi-issuer concentration optimizer
(§5.6) to bring the top issuer below the 25% warn threshold.
```
- All 5 Gemini candidates returned either HTTP 404 ("no longer available") or HTTP 400 ("User location is not supported").
- The deterministic fallback briefing renders the live snapshot correctly (GFB / status / concentration / reconciliation findings F1-F4 → only F2 is "outstanding", currently PAXOS at 25.9%).

### 3. `/api/ai/qa` (POST)
```text
model: fallback
answer: Blueprint Q&A unavailable (Gemini unreachable). The full v1.0 blueprint is documented in the Docs section above.
```
- Same Gemini region block. Fallback returns the spec-mandated fallback message verbatim.

### 4. `/api/ai/risk-signals` (GET)
```text
model: fallback-rules
signal count: 1
first: {'severity': 'warning', 'title': 'Issuer concentration warn', 'detail': 'PAXOS at 25.91% of NAV — above the 25% warn threshold.', 'source': '§5.6 concentration'}
```
- Groq returned HTTP 403 (`{"error":{"message":"Forbidden"}}`) in this sandbox. The deterministic rule-based fallback correctly emitted the single active warning (PAXOS concentration). Oracle not paused, eject stages all 0, status NORMAL, RR `Infinity` (skipped by `Number.isFinite(rr) && rr < 1.05` guard) → only the concentration warn fires.

### 5. `/api/ai/screen` (POST)
```text
model: fallback-regex
entity count: 3
entities:
  - { text: 'The US Treasury', type: 'Unknown (regex)', start: 0, end: 15, score: 0.5 }
  - { text: 'Russian',         type: 'Unknown (regex)', start: 31, end: 38, score: 0.5 }
  - { text: 'Ivan Ivanov',     type: 'Unknown (regex)', start: 48, end: 59, score: 0.5 }
```
- Hugging Face returned `fetch failed` (network blocked). The regex fallback found capitalized multi-word phrases including the actual oligarch name "Ivan Ivanov", the country adjective "Russian", and the organization "US Treasury". Per spec, the fallback regex is "clearly labeled as fallback" (model="fallback-regex", type="Unknown (regex)").
- CORS verified: `OPTIONS /api/ai/screen` returns 204 + `Access-Control-Allow-Origin: *` + `Access-Control-Allow-Methods: POST, OPTIONS` + `Access-Control-Allow-Headers: Content-Type`.

### 6. dev.log (last 30 lines)
No engine crashes; no Next.js runtime errors. Only the expected AI-provider-unreachable `console.error` lines (which are information logs from my code so the protocol owner can see why the fallbacks are kicking in), followed by the `200` responses:
```
[ai/briefing] Gemini gemini-2.0-flash HTTP 404: ... no longer available ...
[ai/briefing] Gemini gemini-3.6-flash HTTP 400: ... User location is not supported ...
[ai/briefing] Gemini gemini-2.5-flash HTTP 400: ... User location is not supported ...
[ai/briefing] Gemini gemini-2.0-flash-001 HTTP 404: ... no longer available ...
[ai/briefing] Gemini gemini-flash-latest HTTP 400: ... User location is not supported ...
 GET /api/ai/briefing 200 in 1118ms
[ai/qa] Gemini gemini-2.0-flash HTTP 404: ...
[ai/qa] Gemini gemini-3.6-flash HTTP 400: ...
[ai/qa] Gemini gemini-2.5-flash HTTP 400: ...
[ai/qa] Gemini gemini-2.0-flash-001 HTTP 404: ...
[ai/qa] Gemini gemini-flash-latest HTTP 400: ...
 POST /api/ai/qa 200 in 1452ms
[ai/risk-signals] Groq HTTP 403: {"error":{"message":"Forbidden"}}
 GET /api/ai/risk-signals 200 in 36ms
[ai/screen] HF call failed: fetch failed
 POST /api/ai/screen 200 in 11ms
```
- All 4 AI routes return HTTP 200 — they never crash the engine.
- `/api/metrics` continues to return 200 every 4s — the AI gateway does NOT touch engine state.

## Stage Summary
- 9 new files (5 lib modules + 4 API routes) created. Zero files outside ownership touched.
- `bun run lint` → exit 0. Zero ESLint errors.
- All 4 AI endpoints respond correctly:
  * briefing → fallback-rules (Gemini region-blocked)
  * qa → fallback (Gemini region-blocked)
  * risk-signals → fallback-rules (Groq 403)
  * screen → fallback-regex (HF unreachable) — but CORS headers present and entities extracted via regex
- AI is ADVISORY ONLY: every lib function is read-only over the snapshot; no engine mutator is called.
- Every AI output includes the spec-mandated `disclaimer` field.
- The retry-on-model-deprecation logic in `policy-briefer.ts` and `blueprint-qa.ts` is forward-compatible: when the Gemini deprecation eventually removes `gemini-2.0-flash` permanently (which it already has in this sandbox), the code automatically retries with the API-suggested model name. In a sandbox with working AI, the spec's `gemini-2.0-flash` would be tried first per the spec; if it 404s, the suggested model is tried.
- Graceful degradation contract honored: if any AI provider is down, the deterministic fallback content kicks in — the pilot stays fully functional. This is the most important contract because it means the AI gateway can NEVER block the dashboard.
- Next step (not in this task's scope): the frontend components can now poll `/api/ai/briefing`, `/api/ai/risk-signals` at the same 4s cadence (or slower), and on user-trigger submit `/api/ai/qa` and `/api/ai/screen`. The `model` field lets the UI label the source ("by Gemini" / "by fallback rules"). The `disclaimer` field MUST be displayed verbatim under every AI panel.
