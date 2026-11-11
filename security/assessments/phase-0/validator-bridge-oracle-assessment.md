# Phase 0 — Validator, Bridge & Oracle Assessment

## 1. Validator / consensus layer (§9)

| Aspect | Reality |
|---|---|
| Validator infrastructure | SIMULATED: 4 co-located validator engines inside one Node process (src/lib/chain/node.ts:10-14), 700ms block interval; genuine BFT voting (consensus.ts verifies real ed25519 precommits, >2/3 quorum) |
| Key isolation / remote signing | NOT PRESENT — keys are deterministic PUBLIC devnet keys, disclosed "INSECURE BY DESIGN" (genesis.ts:5-8) |
| Slashing / validator admin / network segmentation | NOT PRESENT (SIM scope) |
| Validator compromise → treasury/issuance authority? | NO by construction: devnet governance constitutionally cannot touch monetary parameters (monetary-guard, 21 patterns, shared.ts:341-350; verified in code); the devnet asset is testnet credit from the public faucet |
| Validator concentration monitoring | NOT PRESENT (4/4 validators identical substrate) |
| Consensus testing | EXISTING/VERIFIED (consensus engine tests; state-root commitment state.ts:646-666) |
| External validators / real network | PLANNED only |

**Verdict:** the "validator boundary" is a simulation feature, not a security domain. The §9 requirement "validator compromise must not provide treasury/monetary-authority" is satisfied trivially because no such authority is reachable from validators — the firewall is real code (monetary guard), the stake is public testnet credit.

## 2. Bridge layer (§11)

**NOT PRESENT.** No escrow/lock/mint cross-chain mechanism exists anywhere in code or contracts. The three chain deployments (Monad/Arc/Robinhood) are independent single-admin estates, not bridged supplies. Consequences for the register: bridge attack paths (proof forgery, finality games, replay, operator abuse) are **NOT APPLICABLE today**; the latent risk is *conceptual confusion* — "MTQ exists on 3 chains" invites future bridging assumptions. Phase-4 gate condition: any future bridge must arrive with the full §11 control set (independent proof verification, rate/aggregate caps, emergency suspension, replay protection, cross-chain accounting invariants) — nothing of this exists now.

## 3. Oracle layer (§11)

Two live implementations, one design:

| Layer | Source reality | Integrity behavior | Verdict |
|---|---|---|---|
| §17.7 TS overlay (guards the pilot monetary engine) | 3 labeled sources (CHAINLINK/PYTH/CHRONICLE) implemented as **synthetic Math.random() witnesses** around real references fetched by fx.ts (Frankfurter/gold-api/FRED/Yahoo; OU fallback) | Fail-closed: FAILED pauses all ops; DEGRADED pauses mint+rebalance, redemption stays open (exit-first); deviation breaker 2.5%; staleness 60/120s; median+filtered-mean+LKG | EXISTING/VERIFIED as disclosed simulation; **not externally anchored — no individual oracle can be "manipulated" because none is real; the reference layer (fx.ts HTTP) is the actual external dependency** |
| Devnet §17.10 on-chain-style | `oracle_observe` txs from ACTIVE validators only; ≥2 source families; cross-family spread ≤200bp; freshness ≤6 blocks; median-of-medians | Fail-closed: <2 families → STALE no-publish; >200bp → DEGRADED_SPREAD value-held | EXISTING/VERIFIED (sim, genuinely gated) |
| Contract adapters (Chainlink/Pyth/Chronicle) | compiled, undeployed | n/a | PROTOTYPE |
| On-chain read path (fetchOnChainOraclePrices → V3) | requires undeployed contract + env | n/a | NOT PRESENT |

**"No individual oracle may authorize unlimited issuance/transfers":** satisfied vacuously (oracle gates only *pause*; they never *authorize*). The real integrity question is **reference-data compromise** (fx.ts feeds + a future real-oracle estate), tracked as reference-quality risk (threat-model §4) — no unlimited-authority coupling exists.

## 4. §15-relevant adversarial scenarios in scope for later phases

T-20 validator compromise (sim-asset theft impossible; assert monetary-guard holds), T-22 invalid bridge proof (N/A until bridges exist — register as NOT APPLICABLE with re-test trigger on introduction), T-23/T-24 oracle manipulation/outage (assert fail-closed pauses; assert no authorization-side effect). These are scheduled in `security-phase-plan.md` Phase 4/6 with non-destructive harnesses.
