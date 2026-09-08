# Task ID: P0-C
Agent: full-stack-developer
Task: Wire MARP per-component decisions into actual rebalance execution + physically separate index gold from reserve gold per §14.1

## Files MODIFIED (only files in my ownership)
- `src/lib/mtq/engine.ts` (ADD-only — new fields, new functions, gold-separation helpers, MARP execution)
- `src/lib/mtq/pilot-state.ts` (MINIMAL — bumped schema 9→10, added feature flag + MARP branch alongside P0-B's audit-trail block)
- `src/components/mtq/RebalanceEngine.tsx` (REWRITE — dual-view with tab toggle + A/B badge + MARP per-component table)

## Coordination with P0-B (parallel agent)
- P0-B committed first: bumped STATE_SCHEMA_VERSION 8→9, added `lastDailyVectorAt`/`lastOracleSampleAt` to PilotStore, added 4 audit-trail persistence calls after `store.tickCount += 1`, restructured the legacy rebalance block to capture `rebalanceAudit` (pre/post-trade state).
- I bumped 9→10 (per task spec) so the singleton auto-rebuilds with BOTH sets of new fields.
- I did NOT modify P0-B's `let rebalanceAudit` block (lines 157-218) or the audit-trail persistence calls (lines 237-275).
- I added my MARP branch BEFORE P0-B's `if (!store.oracle.anyPaused && !snap0.priceInBand === false)` line, and changed that line to `else if` (additive — body unchanged). The `let rebalanceAudit` declaration stays at the same place (function-scoped via `let`).
- When USE_MARP_EXECUTION=true, `rebalanceAudit` stays null (MARP branch doesn't touch it), so P0-B's `if (rebalanceAudit)` at line 239 skips cleanly. MARP decisions are still captured by P0-B's `persistMarpDecisions` call (line 263) which reads `snapshot.marp.decisions` — so audit-trail coverage is preserved for both paths.

## Part 1 — §14.1 Constitutional Separation of Gold (engine.ts)

### ReserveState (additive — no removals)
- Added 4 new fields:
  - `indexPaxg: number` — PAXG locked to back the index Gold weight (26% Strategic Prior). Only changes via `commitIndexGold()`.
  - `indexXaut: number` — XAUT locked to back the index Gold weight.
  - `reservePaxg: number` — PAXG in the reserve buffer (MARP-rebalanced).
  - `reserveXaut: number` — XAUT in the reserve buffer (MARP-rebalanced).
- Added `rebalancePath: 'legacy' | 'marp'` to track the active execution path (driven by the USE_MARP_EXECUTION feature flag in pilot-state.ts).
- Legacy `paxg` / `xaut` fields RETAINED as totals (= indexPaxg + reservePaxg and indexXaut + reserveXaut) so existing readers (concentration optimizer, applyRedeem, etc.) work unchanged.

### initReserveState (50/50 split — documented choice)
- Split the genesis gold 50/50 between index and reserve.
- Documented the choice in a comment: 50/50 was chosen over the "26%/74% by strategic prior" alternative because at genesis the total gold IS exactly 26% of NAV (deposit × STRATEGIC_PRIOR.Gold = $1.1M × 0.26 = $286K), so a 26/74 split would leave index gold at only ~6.8% of NAV — far below the 26% index weight it is supposed to back, which is misleading. The 50/50 split gives both pools meaningful starting capital (~13% of NAV each).
- Set `rebalancePath: 'legacy'` as the default at genesis.

### commitIndexGold(s, indexPaxg, indexXaut) — keeper-role equivalent
- Sets `s.indexPaxg` and `s.indexXaut` (the locked index gold).
- Re-derives reserve = max(0, total − index) via `syncReserveFromTotal(s)`.
- Defensive: if the keeper over-commits (indexPaxg > total paxg), bumps the total to match the index and logs a console.warn so the reserve never goes negative.
- Emits an `IndexGoldCommitted` event-equivalent via `console.log` (production should emit an on-chain event).

### syncReserveFromTotal(s) / syncTotalFromReserve(s) — invariant helpers
- `syncReserveFromTotal(s)`: re-derives reserve = max(0, total − index). Called after the legacy path / concentration optimizer mutates `s.paxg` / `s.xaut` directly.
- `syncTotalFromReserve(s)`: re-derives total = index + max(0, reserve). Called after the MARP path mutates `s.reservePaxg` / `s.reserveXaut`.
- These are the ONLY sanctioned ways to maintain the §14.1 invariant.

### reserveAssetValues — extended with gold split
- Added 6 new return fields: `indexPaxgUsd`, `indexXautUsd`, `reservePaxgUsd`, `reserveXautUsd`, `indexGoldNet`, `reserveGoldNet` (USD net of haircut).
- The existing `goldNet` (= indexGoldNet + reserveGoldNet) is retained — it's the TOTAL gold used by MASE/MARP for the observed Gold weight.
- Defensive: if `s.reservePaxg < 0` (e.g. legacy path sold more gold than the buffer held before the sync was added), falls back to `max(0, s.paxg - s.indexPaxg)` so the reported value is always non-negative.

### MetricsSnapshot — extended
- `reserve.indexGoldNet: number` and `reserve.reserveGoldNet: number` — the §14.1 gold split (USD net of haircut).
- `rebalancePath: 'legacy' | 'marp'` — which execution path is currently mutating state (mirrors `s.rebalancePath`).
- `marpExecution: { appliedCount, skippedCount, totalTradeUsd, path } | null` — read-only projection of what MARP WOULD do this tick (computed in `buildMaseSnapshot`, does NOT mutate state).

### buildMaseSnapshot — observed Gold weight uses TOTAL gold
- Added a clear comment on `buildObservedWeights`: the Gold component's observed weight uses the TOTAL gold (= indexPaxg + indexXaut + reservePaxg + reserveXaut, USD-net). Both pools serve the Strategic Prior Gold weight (26%); only the reserve gold is MARP-rebalanced. The index gold is locked and only changes via `commitIndexGold()`.
- Added `marpExecution` computation: counts decisions with `shouldTrade && level >= 6` as `appliedCount` (would-execute), the rest as `skippedCount`, and sums their `tradeUsd` as `totalTradeUsd`. The `path` mirrors `s.rebalancePath`.

### Existing functions updated to maintain the §14.1 invariant
- `applyRebalanceTrade` (legacy §7 path): added 2 lines that mirror the gold delta to `s.reservePaxg` (the buffer, NOT index gold). Total `s.paxg` change unchanged; reserve split tracks it.
- `applyRedeem` (§12 redemption): added 1 line — `syncReserveFromTotal(s)` after the gold release, so the reserve split tracks the new total minus the locked index.
- `rebalanceForConcentration` (§5.6 multi-issuer optimizer): added 1 line — `syncReserveFromTotal(s)` after the PAXG/XAUT re-split, so the reserve split tracks the new total PAXG/XAUT distribution minus the locked index.

## Part 2 — Wire MARP into the rebalance execution path

### applyMarpRebalance(s, fx, decisions) — new function in engine.ts
- Input: `MarpExecDecision[]` — accepts BOTH the full `MarpDecision[]` (from marp.ts) and the trimmed version (from `snapshot.marp.decisions`) since both satisfy the interface.
- For each decision with `shouldTrade === true` and `level >= 6`:
  - Enforce `MAX_DAILY_TURNOVER` (5% of NAV) — skip trades that would breach (capped to remaining daily budget; if 0, skip).
  - Enforce `DIRECTION_LOCK_HOURS` (24h) — skip trades that reverse the last direction within 24h (whipsaw guard).
  - Apply the trade to the RESERVE holdings (index gold is LOCKED — never touched):
    - For Gold: split 50/50 across `s.reservePaxg + s.reserveXaut`. Sell gold → USD (split 1/3 across USDC/USDP/USDT). Buy gold ← USD.
    - For USD: pair with Gold (split 50/50 across `s.reservePaxg + s.reserveXaut`). Sell USD → gold. Buy USD ← gold.
    - For non-USD fiat (EUR/JPY/GBP/CNY/CHF): pair with USD (split 1/3 across USDC/USDP/USDT). Sell component → USD. Buy component ← USD.
  - Re-sync the gold totals via `syncTotalFromReserve(s)` after each gold-affecting trade.
  - Update `s.lastTradeDir`, `s.lastTradeAt`, `s.dailyTurnoverUsd`.
- Returns: `{ appliedCount, skippedCount, totalTradeUsd, path: 'marp', traces }` where `traces` is a per-decision trace (component, direction, tradeUsd, level, applied, skipReason?).

### pilot-state.ts — feature flag + tick loop wiring
- Added `const USE_MARP_EXECUTION = false` (default — keeps legacy §7 for pilot stability; MARP is the v1.0 production target).
- Imported `applyMarpRebalance` and `MarpExecDecision` type.
- Bumped `STATE_SCHEMA_VERSION` 9 → 10 (P0-B bumped 8 → 9; I bump 9 → 10 per task spec so the singleton auto-rebuilds with both sets of new fields).
- In `tick()`:
  - Set `store.state.rebalancePath = USE_MARP_EXECUTION ? 'marp' : 'legacy'` (idempotent per tick — only changes if USE_MARP_EXECUTION is recompiled).
  - Added an `if (USE_MARP_EXECUTION) { ... } else if (!store.oracle.anyPaused && !snap0.priceInBand === false) { ... }` chain. The `if` branch is my new MARP path; the `else if` branch is P0-B's existing legacy block (unchanged body).
  - The MARP branch:
    - Guarded by `!store.oracle.anyPaused && snap0.priceInBand` (oracle not paused, price in band — same conditions as the legacy path).
    - Wrapped in try/catch so a MARP failure doesn't break the tick loop.
    - Maps `snap0.marp.decisions` (trimmed) to `MarpExecDecision[]` and calls `applyMarpRebalance`.
    - Logs via `console.log` only when trades were actually applied (`result.appliedCount > 0`) to avoid log noise.
  - The legacy branch is P0-B's existing block verbatim (the `let rebalanceAudit` capture and the `evaluateRebalance + applyRebalanceTrade` call).

## Part 3 — RebalanceEngine.tsx UI (REWRITE — dual-view)

- Top: A/B badge showing "Legacy §7 active" / "MARP active" based on `snapshot.rebalancePath`. Gold pill for MARP, emerald pill for legacy.
- Tab toggle: "Legacy §7 (single-direction)" | "MARP §10 (per-component)". Default to whichever path is currently active; user can toggle to inspect the other path's view (view-only — doesn't change the actual execution path).
- Honest note (gold-bordered callout with Info icon): "MARP is the v1.0 production target. Legacy §7 is retained as a pilot fallback. Toggle the feature flag USE_MARP_EXECUTION in src/lib/mtq/pilot-state.ts to switch the active execution path (default: false → legacy). The A/B badge above reflects the currently active path; the tab toggle is view-only."

### Legacy §7 tab (existing view, preserved)
- Rebalance Decision (§7.5) panel: Direction, Observed W, Target W, Deviation, Trade USD. Direction badge, decision pill, direction text.
- Adds a "not mutating state (MARP active)" pill when `activePath !== 'legacy'` so the user knows the legacy view is informational only.
- §7.3 Objective Function Coefficients (λ1-λ4) panel — unchanged.
- §7.4 + §7.6 Execution Constraints (slippage, max daily turnover, max pool fraction, direction lock) panel — unchanged.

### MARP §10 tab (NEW)
- MARP execution summary header: gold pill "X would-execute" / muted pill "Y skipped" / muted pill "total: $Z".
- §14.1 gold split summary (3 cards):
  - Index gold (locked) — gold-bordered, gold text. "backs 26% Strategic Prior Gold weight".
  - Reserve gold (MARP buffer) — emerald-bordered, emerald text. "rebalanced by MARP per-component".
  - Total gold — neutral. "index + reserve (= observed Gold weight)".
- Per-component table (7 rows): Component, Direction (buy/sell/hold badge), Trade USD, Urgency (mini bar + %), Level (L1-L6 badge), Reason.
- Sticky header + `max-h-96 overflow-y-auto mtqs-scroll` for long-list handling on small screens.
- Σ MARP execution summary footer row: $Z total, "X applied · Y skipped · path = legacy/marp".
- 6-level hierarchy legend (6 cards explaining L1-L6).
- Footer note: "Max daily turnover = 5% of NAV ≈ $X. 24h direction lock prevents whipsaw. Index gold (PAXG + XAUT locked to back the 26% Strategic Prior Gold weight) is NEVER touched by MARP — only the reserve buffer gold is rebalanced."

### Framer Motion transitions
- Tab content uses `motion.div` with `initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}` for a subtle 250ms fade-in on tab switch.

## Verification (all pass)
1. `bun run lint` → exit 0 ✓
2. `/api/metrics` field verification:
   - `has marpExecution: True` ✓
   - `has reserve.indexGoldNet: True` ✓
   - `has reserve.reserveGoldNet: True` ✓
   - `rebalancePath: 'legacy'` ✓ (default — USE_MARP_EXECUTION=false)
3. `curl -s http://localhost:3000/ -o /dev/null -w "%{http_code}\n"` → `200` ✓
4. dev.log tail: clean (only `GET /` and `GET /api/metrics 200` lines, no errors/warnings/hydration issues) ✓
5. agent-browser verification:
   - Page title: "MTQΣ — The Monetary Observatory" returned 200, no page errors.
   - Dashboard → Rebalancing Engine section: A/B badge shows "Legacy §7 active".
   - Tab toggle "Legacy §7 (single-direction)" / "MARP §10 (per-component)" both visible and clickable.
   - Legacy §7 tab content (verified via JS eval): Direction lock (24h whipsaw guard), no trade, Observed W 25.68%, Target W 25.15%, Deviation +0.52%, Trade USD $0.00, λ1-4 coefficients, execution constraints. Honest note visible.
   - MARP §10 tab content (verified via JS eval): "§14.1 + §10 · MARP · PER-COMPONENT EXECUTION (V1.0 PRODUCTION TARGET)", "2 would-execute / 5 skipped / total: $57.36K". §14.1 gold split: Index gold (locked) $140.88K, Reserve gold (MARP buffer) $152.40K, Total gold $293.27K. Per-component table (7 rows): USD hold L2, EUR sell $23.07K L6, JPY hold L2, GBP hold L2, CNY hold L2, CHF hold L1 (no-trade zone), Gold sell $34.29K L6. Σ row: $57.36K total, "2 applied · 5 skipped · path = legacy". 6-level hierarchy legend. Footer note about index gold being locked.
   - §14.1 gold split invariant verified: $140,870.25 + $152,682.40 = $293,552.65 (matches `reserve.goldNet` exactly) ✓
   - Mobile responsive (390×844 iPhone 14 viewport): tab toggle + dual view render correctly. Screenshots saved.
   - `agent-browser errors` → empty (no page errors). `agent-browser console` → only React DevTools + HMR lines.
   - Screenshots saved: `/home/z/my-project/agent-ctx/rebalance-legacy.png`, `/home/z/my-project/agent-ctx/rebalance-marp.png`, `/home/z/my-project/agent-ctx/rebalance-mobile-legacy.png`, `/home/z/my-project/agent-ctx/rebalance-mobile-marp.png`.

## Constraints honoured
- DO NOT rewrite engine.ts from scratch — ADD to it. All existing exports/functions/fields RETAINED. ✓
- DO NOT edit `mase.ts`, `marp.ts`, `oracle.ts`, `registry.ts`, `blueprint.ts`, `audit-trail.ts`. ✓ (only edited `engine.ts`, `pilot-state.ts`, `RebalanceEngine.tsx`).
- Bump STATE_SCHEMA_VERSION 8 → 10 (coordinate with P0-B which bumps 8 → 9). ✓ (P0-B committed at v9; I bumped to v10).
- Lint must be clean. ✓ (exit 0).
- If accidentally conflict with P0-B's audit-trail changes in pilot-state.ts, prefer the resolution that keeps BOTH changes — add your lines, don't remove theirs. ✓ (P0-B's `let rebalanceAudit` block and audit-trail persistence calls untouched; only changed `if` to `else if` and added my MARP branch before it).

## Stage Summary
- §14.1 Constitutional Separation of Gold is now implemented in the TS engine: index gold (PAXG + XAUT) is locked in a separate accounting vault that backs the 26% Strategic Prior Gold weight; reserve gold (the other half at genesis) is the buffer MARP rebalances. The `commitIndexGold()` keeper-role equivalent is the only way to move gold between the two pools. The §14.1 invariant (`paxg = indexPaxg + reservePaxg`, same for xaut) is maintained via `syncReserveFromTotal()` and `syncTotalFromReserve()` helpers called from `applyRebalanceTrade`, `applyRedeem`, `rebalanceForConcentration`, and `applyMarpRebalance`. The gold split is exposed in the snapshot (`reserve.indexGoldNet` + `reserve.reserveGoldNet`) and rendered in the new MARP tab.
- MARP per-component rebalance execution is now wired into the tick loop via a feature flag (`USE_MARP_EXECUTION = false` by default — keeps legacy §7 for pilot stability; MARP is the v1.0 production target). The new `applyMarpRebalance()` function takes the per-component `MarpDecision[]` and applies each "would-execute" trade (level >= 6) to the RESERVE holdings (index gold locked), enforcing `MAX_DAILY_TURNOVER` (5% NAV) and `DIRECTION_LOCK_HOURS` (24h whipsaw guard). The trade-execution model pairs each non-USD component with USD (split 1/3 across USDC/USDP/USDT) and USD with Gold (split 50/50 PAXG/XAUT in the reserve buffer), so every trade has a clear counterparty and the total NAV is preserved (modulo haircut differences).
- The RebalanceEngine.tsx UI now renders both paths side-by-side via a tab toggle: the Legacy §7 view (single-direction, observed vs target gold weight, deviation, trade USD, λ1-λ4, execution constraints) and the new MARP view (per-component table with direction/tradeUsd/urgency/level/reason, §14.1 gold split cards, summary "X applied · Y skipped · $Z total · path = legacy/marp", 6-level hierarchy legend, footer note about index gold being locked). An A/B badge at the top shows "Legacy §7 active" / "MARP active" based on `snapshot.rebalancePath`. An honest note explains the v1.0 production target / pilot fallback relationship and points the user at the feature flag in `pilot-state.ts`.
- Lint: 0 errors. HTTP /: 200. dev.log: clean. agent-browser: dual-view renders correctly on desktop + mobile, tab toggle works, A/B badge correct, no page errors.
