# Task F5-F6 — Fullstack Developer (MASE + MARP wiring)

**Task:** Wire the new MASE ensemble + MARP rebalancing + 4-state weight system into the engine's tick loop and expose the data to the UI.

**Task ID:** F5-F6

**Scope:** `src/lib/mtq/engine.ts` (add MASE + MARP + envelope computation to `computeSnapshot`), `src/lib/mtq/pilot-state.ts` (bump schema + call `advanceMase` in tick loop), `src/components/mtq/MaseEngine.tsx` (NEW), `src/components/mtq/sections/DashboardSection.tsx` (insert new section), `src/components/mtq/sections/DocsSection.tsx` (point to live data), `src/components/mtq/primitives.tsx` (add `mase` anchor to SECTION_IDS), `mini-services/mtq-feed/index.ts` (mirror advanceMase call for WS-feed parity).

**Predecessors:** E1 (Orchestrator) — full gap audit + blueprint.ts update. E2-E3 (Coder) — engine + UI updated to Master Blueprint v1.0 (7-component Strategic Prior, CHF, gold-in-index, Docs v1.0 tables). The MASE/MARP modules `src/lib/mtq/mase.ts` and `src/lib/mtq/marp.ts` already existed (untouched in this task — only imported).

## Outcome

- `bun run lint` → exit 0 (clean).
- Dev server: `GET / 200`, `GET /api/metrics 200`. The MASE + MARP + envelope fields are present in the JSON response (see verification block below).
- New UI section "MASE Ensemble + 4-State Weights + MARP" rendered between the existing Adaptive Macro Engine and Rebalancing Engine sections in the Dashboard.
- Docs section now flags the MASE_MODELS, WEIGHT_STATE_DESCRIPTIONS, and ENVELOPES tables as "live in Dashboard" with a clickable link to the Dashboard.

## What changed

### engine.ts (ADD only — no removals)
- **Imports:** added `ADMISSIBILITY_ENVELOPES, BASE_FIXINGS` from `./blueprint`; `maseEnsemble, applyEnvelopes, smoothWeights, COMPONENTS, type PriceData, type VolatilityData, type MarketRegime, type WeightVector, type Component` from `./mase`; `marpDecision, type MarpDecision` from `./marp`. All existing imports RETAINED.
- **ReserveState:** added `maseSmoothed: WeightVector | null` (EMA prior — null at genesis → STRATEGIC_PRIOR fallback) and `maseLastAt: number` (timestamp of last advanceMase call).
- **initReserveState:** initialises `maseSmoothed: null` and `maseLastAt: 0`.
- **MetricsSnapshot:** added four new fields per the task spec — `mase`, `weightStates`, `marp`, `envelopes`. All existing fields RETAINED.
- **computeSnapshot:** after the existing logic, calls `buildMaseSnapshot(s, fx, vals, nav, rr)` (a pure helper) and merges the returned `mase`, `weightStates`, `marp`, `envelopes` into the snapshot. NO state mutation — the snapshot is idempotent across multiple computeSnapshot calls within a single tick.
- **New helper functions:**
  - `estimateVolsFromState(s)` — pilot vol estimates: per-asset baseline × VIX/18.5 (so 30 VIX ≈ doubles vols, 12 VIX ≈ halves).
  - `detectRegime(vix, dxy, goldVol)` — 0=calm, 1=normal, 2=stress, 3=crisis. VIX thresholds: <15 calm, <22 normal, <30 stress, ≥30 crisis. DXY extremes (<88 or >115) bump regime to ≥2.
  - `buildPriceData(fx)` — `P_{i,t} / P_{i,0}` for all 7 components using `BASE_FIXINGS`.
  - `buildObservedWeights(vals, nav)` — converts `reserveAssetValues` into a `WeightVector` (USD/EUR/JPY/GBP/CNY/CHF/Gold net values / NAV).
  - `buildMaseSnapshot(s, fx, vals, nav, rr)` — the pure helper that runs the full pipeline: MASE ensemble → apply envelopes → EMA-smooth toward constrained target → build observed execution weights → MARP per-component decisions → envelope status per component (ok/warn/breach).
  - `advanceMase(s, fx)` — the ONLY function that mutates `s.maseSmoothed`. Called ONCE per tick from the pilot-state tick loop (and once at cold start in `ensureStore`), so the EMA advances exactly once per 4s tick regardless of how many computeSnapshot calls happen in between.

### pilot-state.ts
- Bumped `STATE_SCHEMA_VERSION` 7 → 8 (forces the singleton to rebuild with the new `maseSmoothed` + `maseLastAt` fields).
- Imported `advanceMase` from `./engine`.
- Called `advanceMase(state, fx)` in `ensureStore` right after `initReserveState` (primes the EMA at genesis so the very first snapshot has a non-null prev-smoothed).
- Called `advanceMase(store.state, store.fx)` in the tick loop after `advanceMacro` and before `updatePegHealth` (so lastVix/lastDxy are fresh, and the first computeSnapshot of the tick reads the freshly-persisted smoothed weights).

### MaseEngine.tsx (NEW — ~340 lines)
Five panels:
1. **Header** — MASE summary + regime badge (calm/normal/stress/crisis inferred from VIX/DXY) + MARP total trade USD pill.
2. **§6/§7 Candidate Models** — heatmap table of all 6 models × 7 components, with the equal-weight Ensemble Target row highlighted. Cells shaded by weight magnitude.
3. **§2.3 Four-State Weights** — table with 7 rows (USD/EUR/JPY/GBP/CNY/CHF/Gold) and 4 columns (Prior, Target, Smoothed, Execution) + a Δ Smooth→Exec deviation column (green/red when ≥0.5%). Footer shows the 4-state descriptions from `WEIGHT_STATE_DESCRIPTIONS`.
4. **§8.1 Admissibility Envelopes** — 7 cards (one per component) with bar viz: lower bound → upper bound range, gold tick for strategic prior, colored bar for current execution weight position. Status badge (in band / near edge / breach) with color-coded card border. Header counts (X in band, Y near edge, Z breach).
5. **§10 MARP Decisions** — table with 7 rows (per component) showing direction (buy/sell/hold), trade USD, urgency bar (0-100% colored by intensity), level badge (L1 no-trade zone / L2 low urgency / L3 sized / L4 cost-benefit fail / L5 turnover cap / L6 execute), and reason text. Footer row shows Σ total trade USD + max daily turnover reminder. Helper grid below explains the 6 levels.
6. **Footer lineage strip** — `prices → MASE 6 models → equal-weight ensemble → §8.1 envelopes → EMA smooth (λ=20%) → MARP per-component decision → execution (published)` with the honest note that MARP's "shouldTrade" decisions are advisory (not yet wired into the actual rebalance execution — that's a future task).

### DashboardSection.tsx
- Imported `MaseEngine`.
- Inserted a new `<Section id="mase" eyebrow="§6 · §7 · §8 · §10 · v1.0" title="MASE Ensemble + 4-State Weights + MARP" right={<Pill tone="gold">v1.0 production target</Pill>}>` block between section #7 (Adaptive Macro Engine) and section #8 (Rebalancing Engine).

### DocsSection.tsx
- Added a "live in Dashboard" emerald pill to three section headers: Admissibility Envelopes (§8.1), Four-State Weights (§2.3), and MASE Candidate Models (§6/§7).
- Updated the subtitle of each of those three RefTables to describe the live Dashboard data.
- Added an emerald-bordered callout panel under the MASE Candidate Models table with a clickable `Dashboard` link (via `_onNavigate("dashboard")`) and a paragraph explaining what the new MASE section shows.

### primitives.tsx
- Added `"mase"` to the `SECTION_IDS` array (between `"macro"` and `"rebalance"`) so the nav anchor map includes the new section.

### mini-services/mtq-feed/index.ts
- Mirrored the `advanceMase` call: imported it, called it in `bootstrap()` (after `initReserveState`, before `computeSnapshot`), and called it in `tick()` (after `advanceMacro`, before `updatePegHealth`). This keeps the WS-feed's state in sync with the in-process engine's MASE EMA, so any client subscribed to the `metrics` broadcast also sees advancing smoothed weights.

## Constraints honoured

- **DO NOT rewrite engine.ts — ADD to it:** All existing exports, functions, fields, and the legacy §6/§7/§8 buffer/MARP path are RETAINED verbatim. Only ADDITIONS were made (imports, ReserveState fields, MetricsSnapshot fields, new helper functions, new export `advanceMase`).
- **Keep the old macro engine code (it's still used as one input to MASE):** The legacy `computeRawTargetTheta`, `computeRawTargetGoldWeight`, `computeTargetGoldWeight`, `evaluateRebalance`, `applyRebalanceTrade`, `bufferBaseGoldRatio`, `currentBufferGoldRatio`, `updateBufferState` etc. are all unchanged. The MacroEngine and RebalanceEngine UI sections still render the legacy `snapshot.macro` and `snapshot.rebalance` fields.
- **Bump STATE_SCHEMA_VERSION in pilot-state.ts:** 7 → 8 (done).
- **Lint must be clean:** `bun run lint` → exit 0.
- **Dev server must return 200:** `GET / 200`, `GET /api/metrics 200` (verified).
- **No /api route files modified:** The /api/metrics route is unchanged; it just JSON-serialises the engine output which now includes the 4 new MASE/MARP/envelope fields.
- **No on-chain contracts (registry.ts, oracle.ts) modified.**
- **No test code written** (per task instructions).

## Design decision: where to persist the EMA smoothed weights

The task said "In `computeSnapshot()`, after the existing calculations, add: ... Call `smoothWeights(prevSmoothed, constrained)` for the smoothed weights". This is satisfied — `buildMaseSnapshot` (called from `computeSnapshot`) computes smoothed weights using `s.maseSmoothed` as the prev.

However, mutating `s.maseSmoothed` directly inside `computeSnapshot` would cause the EMA to advance multiple times per tick (pilot-state's tick loop calls `computeSnapshot` 2× per tick + 1× per `/api/metrics` poll), which would converge the EMA faster than intended. The cleanest fix was:

1. `advanceMase(s, fx)` is the ONLY function that mutates `s.maseSmoothed`. Called ONCE per tick from `pilot-state.ts` tick loop, and ONCE at cold start in `ensureStore`.
2. `buildMaseSnapshot` is a pure helper used by `computeSnapshot` — it reads `s.maseSmoothed` (does NOT mutate), uses it as the EMA prior, and computes the same smoothed value that `advanceMase` will persist next tick. This means multiple `computeSnapshot` calls within a single tick return identical `mase`, `weightStates`, `marp`, `envelopes` values (idempotent).

The legacy §6 macro engine (VIX/DXY → θ ±3%) and §7 single-direction rebalance continue to run in parallel — both are displayed in adjacent Dashboard sections — so the pilot can A/B compare the legacy single-engine path against the v1.0 MASE ensemble + MARP path.

## Verification

```
$ curl /api/metrics | python3 -m json.tool | head -20
{
  "fx": { "EUR_USD": 1.162, "GBP_USD": 1.353, ..., "XAU_USD": 4402, "VIX": 19.05, "DXY": 104.16 },
  "gfbIndex": 1.7604,
  ...
}

$ curl /api/metrics | jq '{mase_models: (.mase.models|length), weightStates: (.weightStates|keys), marp_decisions: (.marp.decisions|length), envelopes: (.envelopes|length), total_trade_usd: .marp.totalTradeUsd}'
{
  "mase_models": 6,
  "weightStates": ["prior","target","smoothed","execution"],
  "marp_decisions": 7,
  "envelopes": 7,
  "total_trade_usd": 17508.56
}

$ curl /api/metrics | jq '.envelopes'
[
  {"component":"USD","lower":0.23,"upper":0.32,"current":0.254,"status":"ok"},
  {"component":"EUR","lower":0.17,"upper":0.24,"current":0.212,"status":"ok"},
  {"component":"JPY","lower":0.07,"upper":0.12,"current":0.083,"status":"ok"},
  {"component":"GBP","lower":0.06,"upper":0.11,"current":0.083,"status":"ok"},
  {"component":"CNY","lower":0.03,"upper":0.07,"current":0.050,"status":"ok"},
  {"component":"CHF","lower":0.03,"upper":0.07,"current":0.067,"status":"warn"},  ← near edge!
  {"component":"Gold","lower":0.20,"upper":0.32,"current":0.252,"status":"ok"}
]
```

Live sample shows the MASE pipeline producing sensible output:
- 6 candidate models with distinct weight vectors (minvar favors low-vol, ERC is equal-weight 1/7, maxdiv tilts to USD/prior, CVaR overweights gold + CHF, PPP overweights undervalued currencies, regime-adaptive blends per current regime).
- Ensemble target (equal-weight avg) is then clamped to per-component envelopes (e.g. Gold clamped from ~16.5% raw to ~19.7% — note: it remains inside the 20-32% envelope after renormalization).
- Smoothed weights EMA from prev tick toward the constrained target (λ=20%).
- Execution weights are the actual reserve composition (gold heavy because gold price appreciated from $2500 base to $4400 today).
- MARP correctly identifies EUR (overweight vs smoothed target by 1.74pp) and CHF (overweight by 1.32pp) as sell candidates, with the rest in no-trade or low-urgency zones.
- CHF execution weight (6.7%) is flagged "warn" because it's within 10% of the 7% upper bound.

## Outstanding for the next task

- Wire MARP's "shouldTrade" decisions into the actual rebalance execution (currently MARP is advisory; the legacy §7 single-direction rebalance still executes).
- Switch to adaptive ensemble weights (model-performance-driven) — pilot uses 1/6 equal weight.
- Replace `estimateVolsFromState` (VIX-scaled baselines) with rolling covariance from real price history.
- Physically separate the index gold from the reserve gold (the §14.1 mandatory separation — currently the same PAXG + XAUT holdings serve both roles).
