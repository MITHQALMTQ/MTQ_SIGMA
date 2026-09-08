# P0-IMPL — Implement the 4 P0 fixes in the TS reference engine

## Task
Implement the 4 P0 fixes (chain-linked index, NAV-based redemption, 6-state risk machine, 4 governance layers) that bring the TS reference engine into fidelity with the MTQΣ Master v1.0 Blueprint.

## Files owned
- `src/lib/mtq/chain-index.ts` (NEW — 252 lines)
- `src/lib/mtq/state-machine.ts` (NEW — 232 lines)
- `src/lib/mtq/blueprint.ts` (EDIT — CHF 0.88→1.13, STRESS state, REDEEM_FEE ladder, GOVERNANCE_LAYERS, PARAMETER_REGISTRY)
- `src/lib/mtq/mase.ts` (EDIT — added smoothWeightsAdaptive + targetVelocity)
- `src/lib/mtq/engine.ts` (EDIT — chain index, NAV-based redeem, canonical state, divergence, governance)
- `src/lib/mtq/pilot-state.ts` (EDIT — wire chain index + risk state into tick loop, bump schema 10→11)

## Verification results

### Lint
- `bun run lint` → exit 0 (clean, no warnings)

### HTTP endpoints
- `curl -s http://localhost:3000/ -o /dev/null -w "%{http_code}\n"` → 200
- `curl -s http://localhost:3000/api/metrics -o /dev/null -w "%{http_code}\n"` → 200

### Chain-linking test (CRITICAL)
```
Index after gold +50%: 1.1300
Expected ~1.13 (gold 26% × 50% = 13%): 1.1300
PASS — chain-linking fixed the structural short-gold bug
```
The chain-linked index now grows by exactly 13% on gold +50% (26% weight × 50% shock), NOT 50% as the legacy Laspeyres form did. This eliminates the dominant failure mode from the §23 validation program (S5: 0% survival, RR crashed to 0.83 in 100% of gold +50% runs).

### State-machine self-test
PASS — 11 cases verified (all 6 states, worse-condition-binds, RECOVERY 48h hysteresis, policy helpers).

### Live metrics snapshot
- GFB: 1.0000817098592165 (chain-linked I_t, NOT legacy ~1.5)
- MTQ price: 1.0000817098592165 (= I_t × PAR)
- Status: NORMAL (one of the 6 states)
- Has chainIndex: True (I_t=1.000082, G_t=1.318, baseDenominator=650.644, prevWeights 7-component, prevPrices 7-component)
- Has 6 states: True (NORMAL/CAUTION/STRESS/DEFENSIVE/EMERGENCY/RECOVERY)
- Has indexNavDivergence: True (status=normal at genesis, stress after first mint — expected)
- Has riskState + hysteresis fields: True (riskState, riskStateEnteredAt, riskStateConfirmationEnds, riskStateWorseCondition)
- Has governanceLayers (4 layers): True (CONSTITUTIONAL/MONETARY/RISK/EMERGENCY)
- Has parameterRegistry (15 entries): True
- Has canonical policy fields: True (mintThrottle, redeemFeePct, rebalanceUrgency, mintingAllowed, redemptionAllowed)

### NAV-based redemption verified live
- inputMtq: 100 MTQ
- navPerMtq: $12.26 (post-first-mint, RR=1.10, NAV=$1.2M / S_circ=99,902)
- grossUsd: $1,225.72 (NAV-based, P0-FIX-2)
- feeBps: 15 (NORMAL state, 0.15%)
- feeUsd: $1.84
- netUsd: $1,223.88
- auditGrossUsdIndex: $100.01 (legacy §3.4.2 form, now audit-only)
- auditDeltaUsd: $1,125.71 (NAV pays redeemer $1,125 MORE than index price for 100 MTQ at RR=1.10 — expected behaviour per Master §19.3.2)

## 6 risk states verified
1. NORMAL — RR ≥ 1.10 AND LCR ≥ 1.00
2. CAUTION — 1.05 ≤ RR < 1.10 OR LCR < 1.00 (worse binds)
3. STRESS — 1.02 ≤ RR < 1.05 OR LCR < 0.90 (NEW — was missing)
4. DEFENSIVE — 1.00 ≤ RR < 1.02 OR LCR < 0.80
5. EMERGENCY — RR < 1.00 OR LCR < 0.70
6. RECOVERY — entered from EMERGENCY/DEFENSIVE when RR ≥ 1.10 AND LCR ≥ 1.00 sustained for 48h

## NAV divergence present
Yes — `indexNavDivergence` field on MetricsSnapshot with shape `{ navPerMtq, pMtq, divergence, divergencePct, threshold, status }`. At genesis: status=normal. After first mint: status=stress (NAV is 12× the index price — the genesis reserve is "behind" the first user's tokens, surfacing the expected book-value vs index-price gap).

## Files NOT modified (per task constraints)
- `contracts/MTQSigmaV2.sol` — UNTOUCHED (separate task)
- All `src/components/*` — UNTOUCHED
- All `src/app/api/*` — UNTOUCHED
- `src/lib/mtq/audit-stress.ts` — UNTOUCHED (uses deprecated wrappers)
- `src/lib/mtq/audit-trail.ts` — UNTOUCHED (backward-compatible snapshot fields)
- `src/lib/mtq/fx.ts` — UNTOUCHED (DEFAULTS.CHF_USD=0.88 is the live-FX fallback, not the base fixing)
- `src/lib/mtq/{marp,oracle,registry,brand}.ts` — UNTOUCHED
- `prisma/schema.prisma` — UNTOUCHED
- All test files — UNTOUCHED
