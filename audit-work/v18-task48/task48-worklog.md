# Task 48 — Risk State audit (dashboard-audit series #6, 2026-11-06)

## Scope
RiskStateMachine (§14.1 track + policy matrix + §14.2 governance cards) · RiskTimeline (§23 transition history) — both live-rendered in the dashboard `#risk` / `#risk-timeline` sections.

## §1 VERIFIED EXACT (no defects)

**§14.1 Policy Matrix** — all 6 rows × 5 columns byte-checked against `RISK_STATE_MACHINE` (blueprint.ts):
- NORMAL Allowed / Allowed (0.15%) / Active (urgency 1) / 110.00% ✓
- CAUTION Throttled (50%) / Allowed (0.15%) / Active (urgency 2) / 108.00% ✓
- STRESS Paused / Allowed (0.50%) / Active — emergency (urgency 3) / 105.00% ✓
- DEFENSIVE Paused / Allowed (1.00%) / Active — forced (urgency 4) / 103.00% ✓
- EMERGENCY Paused / PAUSED / PAUSED (council-directed only) / 100.00% ✓
- RECOVERY Throttled (25%) / Allowed (0.30%) / Active (urgency 2) / 108.00% ✓
- RR renders via `fmtRatio` (Task-46 canonical: ratios-as-percent platform-wide, `∞ — no liability` for null) — cross-surface convention CONSISTENT with the Reserve Vault cards (candidate F-48-1 dissolved on inspection).

**State track** — 6 states, current (NORMAL = live engine status) enlarged + glow; §21.2 color discipline: NORMAL/RECOVERY emerald · CAUTION/STRESS/DEFENSIVE amber · EMERGENCY rose ONLY ✓.

**§14.2 Governance cards** — Constitutional 7/7 · 90d / Monetary DAO 51% · 48h / Risk Council 4/7 · 24h / Emergency 4/7 · Instant — match GOVERNANCE_HIERARCHY; honest OD-35 disclosure retained ("not yet instantiated; deployer-EOA 1/1 Safe").

**Band derivation helpers** — `rrBandStatus`/`lcrBandStatus` mirror `state-machine.ts` `rrDerived`/`lcrDerived` EXACTLY (RR ≥1.10/1.05/1.02/1.00 · LCR ≥1.00/0.90/0.80 · LCR never EMERGENCY). Live evidence rows recomputed by hand:
- RR 1.0949 + LCR 0.998 → CAUTION vs CAUTION → CAUTION ✓
- RR 1.0555 + LCR 0.888 → CAUTION vs STRESS → worse binds STRESS ✓
- RR 0.9345 → EMERGENCY (RR hard-floor only) ✓
- RR 1.1086 + LCR 0.982 → NORMAL vs CAUTION → CAUTION, trigger "LCR threshold" ✓

## §2 DEFECTS FOUND & FIXED (live DOM evidence)

**F-48-1 — RiskTimeline non-monotonic timestamps.** The synthetic-date formula `ts = now − (n−1−i) × randStep` multiplied a PER-ROW random step by the remaining index — different rows' random steps made the date column invert. Live-observed: "Nov 01, 12:47 PM" listed BELOW "Nov 04, 07:45 AM"; "Oct 27, 11:10 PM" below "Oct 27, 02:45 PM"; the oldest row dated Nov 01 AFTER Oct 27/Oct 30 rows — 3+ inversions in one render. Because rows display in chain order (newest-first by construction), the `← prev` arrows appeared to contradict the visible dates.
**Fix:** cumulative clock — each row owns the 12–36h gap to the NEXT NEWER row; timestamps accumulate oldest→newest and can never invert. Live re-verified: Nov 06 → Nov 05 12:40 → Nov 05 00:00 → Nov 03 → Nov 02 → Nov 01 → Oct 31 → Oct 30 → Oct 29 → Oct 27 strictly descending ✓.

**F-48-3 — improvement transitions mislabeled "Manual override".** A transition INTO NORMAL with both conditions healthy (RR ≥ 1.10, LCR ≥ 1.00) is the AUTOMATIC §21.2 worse-condition-binds normalization — but the trigger taxonomy had no "improvement" branch, so the newest live row read `NORMAL ← CAUTION · Manual override` while its OWN evidence text described the automatic derivation ("RR-derived state (NORMAL) vs LCR-derived state (NORMAL) → NORMAL") — internally contradictory.
**Fix:** new "Threshold recovery" trigger (type union extended) with threshold text "RR x ≥ 1.10 AND LCR y ≥ 1.00 → automatic return to NORMAL (worse-condition-binds §21.2)". "Manual override" remains only for degraded entries with healthy metrics (a genuine council action). Live re-verified: newest row + the NORMAL ← STRESS row both show "Threshold recovery" ✓.

**Observation (no fix needed):** the §14.1 matrix table displays 5 of the 9 blueprint policy fields (lcrBand · oracle · notification · sweep are rendered in the §21.4 surface / EMERGENCY evidence instead) — a display-scope choice, not a defect. The oldest timeline row (window entry) renders without a `← from` arrow — the synthetic history's boundary, honest as-is.

## §3 E2E VERIFICATION
- Live snapshot cross-check: status NORMAL ✓ engine-derived; current pill emerald ✓
- Post-fix reload: dates strictly monotonic · triggers internally consistent · expanded-row evidence unchanged
- mobile 390: zero horizontal overflow · zero console errors · zero page errors
- screenshots: audit-work/v18-task48/{risk-timeline-fixed-desktop, risk-machine-desktop, risk-mobile-390}.png
- tsc 0 · lint 0

## §4 FILES
- MODIFIED: src/components/mtq/RiskTimeline.tsx (F-48-1 cumulative clock · F-48-3 Threshold recovery trigger + type union)
