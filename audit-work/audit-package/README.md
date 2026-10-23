# MTQΣ — Audit Package for Trail of Bits / OpenZeppelin

## Scope
- **Contract**: `contracts/MTQSigmaV2.sol` (V3, 1467 lines, Solidity ^0.8.20)
- **Engine**: `src/lib/mtq/` (TS reference engine, 1446 lines)
- **Tests**: 141 unit + 257 historical + 11 stress (409 total, all pass)
- **Blueprint**: `audit-work/MTQSIGMA-MASTER-BLUEPRINT-V1.0-FINAL.md` (8,177 lines)

## Key Areas to Audit
1. **Chain-linked index** (§9.2 COO-16) — `advanceIndex()` + `commitWeights()` — verify zero-artificial-return property
2. **MASE weight registry** (§7.7) — `submitTargetWeights()` — verify envelopes + velocity + smoothing
3. **NAV-based redemption** (§19.3.2) — `redeem()` — verify NAV_t computation + fee schedule
4. **6-state risk machine** (§21.2) — `updateState()` — verify worse-condition-binds + 48h recovery
5. **4 governance layers** (§22.3) — `GovernanceParameterRegistry` — verify timelocks + role checks
6. **Reentrancy** — `mint()`, `redeem()`, `executeRebalance()` — verify ReentrancyGuard + CEI
7. **Oracle adapter** — `getOracleConsensus()` — verify §9.2/§9.3 validation + source independence

## Compile Settings
```
solc 0.8.20 + viaIR=true + optimizer runs=200
```

## Test Suite
```bash
# TS tests (run in sandbox)
bun src/lib/mtq/__tests__/canonical-invariants.ts  # 141/141 pass
bun src/lib/mtq/__tests__/stress-rerun.ts           # 11/11 pass
bun src/lib/mtq/__tests__/historical-backtest.ts    # 257/257 pass

# Solidity tests (requires Foundry)
forge install foundry-rs/forge-std
forge test -vvv --match-contract MTQSigmaV3Test     # 30 tests
```
