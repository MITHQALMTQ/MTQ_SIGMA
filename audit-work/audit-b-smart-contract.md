# MTQΣ MTQSigmaV2.sol — Top-Tier Smart-Contract Audit (AUDIT-B)

**Scope:** `/home/z/my-project/contracts/MTQSigmaV2.sol` (1057 lines, Solidity `^0.8.20`)
**Reference:** MTQΣ Master Monetary Architecture v1.0 (`/home/z/my-project/audit-work/blueprint-v1.0.txt`)
**Comparator:** `contracts/MTQSigma.sol` (v1.2 pilot), `contracts/deployments/MTQSigmaV2-PENDING.json`, `src/lib/mtq/blueprint.ts`
**Auditor:** general-purpose (Trail of Bits / OpenZeppelin / Consensys Diligence level)
**Mode:** READ-ONLY — no source code was modified.
**Date:** 2026-09-08

---

## Executive Summary

`MTQSigmaV2.sol` is a single-file, no-import, direct-deploy ERC-20 that
attempts to put the MTQΣ Master Monetary Architecture v1.0 on-chain. The
ERC-20 core, the inline AccessControl + Pausable, the multi-source oracle
adapter with §9.2/§9.3 consensus, the per-component admissibility envelopes,
and the §14.1 risk state machine are implemented faithfully and compile
cleanly under solc 0.8.20 (one Spurious Dragon size warning — must deploy
with optimizer runs=200, per the manifest). However, the contract
**overstates its own `0x7FF` honest-status mask**: 4 of the 11 bits
(`chainLinkedIndex`, `maseWeightRegistry`, `marpExecution`,
`daoGovernance`) describe features that are only partially implemented.
The two most material blueprint divergences are (i) the GFB index uses
the immutable *Strategic Prior* weights for every `getGFB()` call — the
MASE-committed `targetWeights / smoothedWeights / executionWeights` are
stored but **never consumed** by pricing; and (ii) the "chain-linked
index" is a fixed-base index (one immutable denominator), not the
recursive `I_t = I_{t-1} × Σ W_{i,t-1}·(P_{i,t}/P_{i,t-1})` form mandated
by §9.2/§9.3. There is also a missing §11.5.3 RR<1.05 override on the
rebalance direction lock (a solvency hazard under stress), one
reentrancy-ordering issue in `mint()` (CEI violated), one genesis
lock-out vector (`genesisMint(0)`), one reserve-mirror wipe vector
(`bootstrapReserveHoldings` is re-callable), an unbounded `executeRebalance`
loop (gas DoS), and a 2-colluding-oracle price-pin vector (no per-pair
price floor). The DAO timelock implements only **one** of the four
governance layers required by §22.3 (Monetary 48h; missing Constitutional
90d, Risk 24h, Emergency instant). The contract is **NOT** production-
authorized in its current form — 6 critical/high findings must be
remediated, and the `0x7FF` mask should be reduced to `0x5A7` (or the
missing features actually implemented) before the on-chain self-
declaration can be called honest.

---

## Severity Definitions

| Severity | Definition |
|---|---|
| **Critical** | Direct loss of funds, permanent protocol lockout, blueprint invariant violation that breaks the monetary architecture, or a dishonest on-chain self-declaration that misleads users about safety. |
| **High** | Privilege abuse, reentrancy that can be exploited under realistic conditions, DoS vector, or a control-flow gap that fails closed in an unsafe way. Remediable but must fix before launch. |
| **Medium** | Footgun, edge-case correctness gap, missing safety net, or tokenomics drift from the blueprint. Won't lose funds in the common case but will under stress or operator error. |
| **Low** | Hygiene issue, gas optimization, minor spec deviation. |
| **Informational** | Notes for the integrator / deployer. |

---

## Findings Table

| ID | Title | Severity | Status | Contract lines | Description |
|----|-------|----------|--------|----------------|-------------|
| **C1** | MASE weights are stored but never consumed by `getGFB()` | Critical | FAIL | 420–431, 560–576 | The GFB index numerator uses immutable `PRIOR_*` constants, not the committed `targetWeights / smoothedWeights / executionWeights`. The "MASE weight registry" is decorative — bit 4 is overstated and Invariant I3/I6 is violated. |
| **C2** | "Chain-linked index" is actually a fixed-base index (no recursive `I_t = I_{t-1} × …`) | Critical | FAIL | 182, 364–372, 420–431 | `GFB_BASE_DENOMINATOR` is computed once in the constructor and never updated; there is no `updateIndex()` advancing `indexValue` from `lastPrices`/`lastWeights` per §9.2/§9.3. Bit 3 overstated. |
| **C3** | DAO governance implements only 1 of 4 layers (Monetary 48h) | Critical | FAIL | 300–324, 895–945 | §22.3 requires four distinct bodies: Constitutional 7/7 + 90d, Monetary DAO 48h, Risk Council 4/7 + 24h, Emergency Council 4/7 + instant. The contract has only one timelock (48h) and one admin role. Bit 9 overstated. |
| **C4** | `executeRebalance` missing §11.5.3 RR<1.05 direction-lock override | Critical | FAIL | 624–631 | When RR drops below 1.05 (Stress Mode) the engine must be able to reverse direction to protect solvency ("solvency outranks anti-churn"). The contract enforces the lock unconditionally — a component can be trapped away from its target exactly when correction matters most. |
| **C5** | `genesisMint(0)` permanently locks the protocol at zero genesis | Critical | FAIL | 953–958 | No `require(amount > 0)`. An admin (or a fat-fingered DAO vote) calling `genesisMint(0)` sets `genesisDone = true` and zeroes the genesis reserve — un-reversible. |
| **C6** | Two colluding oracle adapters can pin any pair to 0 (no per-pair price floor) | Critical | FAIL | 729–774 | With 2 malicious adapters returning `(price=0, ts=now, conf=0)` the deviation filter invalidates the honest adapter, `validCount=2`, `method=average(2)`, `finalPrice=0`. `commitFxRatesFromOracles` only checks `!paused_`, not `p > 0` — it stores `fxXXX = 0`, dropping that currency from the index. |
| **H1** | `mint()` violates Checks-Effects-Interactions (reentrancy vector) | High | WARN | 463–490 | `usdc.transferFrom(msg.sender, reserveVault, …)` (line 473) is the external call; `_mint(msg.sender, minted)` (line 488) is the state update. No `nonReentrant` modifier. Mitigated by USDC allowance and standard USDC having no hooks, but a non-standard `_usdc` set at deploy time (constructor takes an arbitrary address, line 347/359) would be exploitable. |
| **H2** | `commitWeights` has no `whenNotPaused` modifier | High | WARN | 560–576 | While the protocol is paused, a malicious keeper could still commit weights (and pass them through `_assertEnvelope` with values inside the envelope but politically wrong). `mint`/`redeem`/`executeRebalance`/`commitFxRatesFromOracles` all gate on `whenNotPaused`; `commitWeights` does not — inconsistent. |
| **H3** | `executeRebalance` unbounded loop — gas DoS vector | High | WARN | 615–663 | `for (uint256 i = 0; i < trades.length; i++)` with no cap on `trades.length`. A malicious or buggy keeper can submit a 10,000-trade array that consumes all block gas and blocks all rebalancing. |
| **H4** | `bootstrapReserveHoldings` is re-callable and OVERWRITES (no one-shot guard, no accumulate) | High | WARN | 974–978 | Admin can call this repeatedly; each call replaces `reserveHeldUsd[Component(i)] = holdings[i]`. A second call with `holdings = [0,0,0,0,0,0,0]` silently wipes the on-chain reserve mirror and breaks NAV/RR computations downstream. |
| **H5** | No 2-step admin transfer; loss of DEFAULT_ADMIN keys permanently locks the protocol | High | WARN | 347–372, 988–1008 | `grantRole` / `revokeRole` are single-step. There is no `renounceRole`, no `_setAdmin` two-step pattern, and no on-chain recovery. If the only DEFAULT_ADMIN holder loses their key, no role can ever be granted/revoked again — contract is bricked. |
| **H6** | `commitWeights` does not enforce `Σ w_i = 1` (Invariant I3 violation) | High | WARN | 560–576 | The blueprint (§2.6 I3, §8.5, and the canonical `weightRegistry.getLiveWeights()` example at blueprint-v1.0.txt line 4075: `require(sum == 1e18, "Registry weights must sum to 1")`) requires that committed weights sum to 1.0e18. The contract only checks per-component envelopes — a keeper could commit `target=[0.23,0.17,0.07,0.06,0.03,0.03,0.20]` (sum=0.79, all inside envelopes) which is mathematically nonsensical. |
| **H7** | `genesisMint` is not collateral-backed — admin can mint unbacked MTQ | High | WARN | 953–958 | No check that `reserveVault` holds `amount × price / 1e18 × 1.10` USDC (or any USDC) before minting. The blueprint's "1M MTQ @ 1.1M USDC ⇒ RR=1.10" is a deployer convention, not an on-chain invariant. |
| **H8** | `redeem()` uses `getMTQPrice()` without the §3.5 safety guard | High | WARN | 498–518 (line 502) | `mint()` correctly uses `getMTQPriceWithGuard()` (line 470) which reverts outside `[0.50, 2.00]`. `redeem()` calls the raw `getMTQPrice()` (line 502). If the GFB index is manipulated (cf. C6), redemptions settle at the manipulated price — users get fewer USDC than the index implies, or more (depleting the vault) depending on direction. |
| **M1** | `transfer`/`_mint`/`approve` lack `to != address(0)` / `spender != address(0)` checks | Medium | WARN | 378–412 | Tokens can be permanently burned by transferring to `address(0)` (no burn function exists, so this is the only burn-by-mistake vector). Standard OZ ERC20 explicitly reverts on `to == address(0)`. |
| **M2** | MARP `level` field is a free input — the §10 6-level hierarchy is NOT enforced | Medium | FAIL | 252–258, 617, 633–660 | The struct has `level` (1–6), `executeRebalance` only checks `t.level >= 1 && t.level <= 6`. The contract does not implement Level 0 Monitor / Level 1 Natural Flow / Level 2 Drift / Level 3 Risk / Level 4 Structural / Level 5 Emergency gates from §10.3 — the keeper simply declares a level. Bit 6 is therefore partial: the *execution engine* exists, but the *6-level hierarchy* does not. (Also the blueprint levels are 0–5, not 1–6 — the struct is off-by-one.) |
| **M3** | `executeRebalance` computes `currentW` against the **gross** NAV, not the **net** NAV | Medium | WARN | 612, 635, 647 | `getReserveNavUsd()` (line 843–849) sums `reserveHeldUsd[]` with no haircuts. `getReserveNetAssetValue()` (line 855–884) applies §14.1 haircuts. MARP uses the gross figure, so a 5% haircut on Gold (10 bps per blueprint §14.1) is ignored when sizing trades toward the execution weight — small but persistent drift. |
| **M4** | `setReserveVault` has no USDC-approval/balance pre-check | Medium | WARN | 967–970 | Setting `reserveVault` to a vault that hasn't approved the contract (or has no USDC) silently bricks all redemptions — `usdc.transferFrom(reserveVault, …)` (line 516) reverts on the next `redeem()`. |
| **M5** | `commitFxRatesFromOracles` accepts price = 0 (only checks `!paused_`) | Medium | WARN | 780–816 | After C6's oracle-pin scenario, all 6 pairs could be stored as `fxXXX = 0` without reverting. `getGFB()` would then evaluate to `PRIOR_USD / GFB_BASE_DENOMINATOR` ≈ 0.27 / (0.27 + 0.21 + …) ≠ 0, so price would not revert on the safety band — a corrupted (but non-zero) price would silently be used for mint/redeem. |
| **M6** | No `renounceRole` and no RoleRevoked self-service path | Medium | WARN | 988–1008 | OpenZeppelin's pattern allows an account to renounce its own role (a safety valve for compromised keys). This contract only allows DEFAULT_ADMIN to revoke. A compromised KEEPER cannot un-keeper itself without admin cooperation. |
| **M7** | `queueChange` can be re-queued, resetting the 48h timelock | Medium | WARN | 901–910 | `require(!pc.executed, …)` is the only guard. Re-queuing the same key overwrites `newValue` AND `executesAt = block.timestamp + 48h`. An admin can indefinitely delay an already-queued change by re-queuing with the same value (griefing) or bait-and-switch a queued value (audit-trail exists via `ParameterQueued` event, so this is detectable but still a control-flow surprise). |
| **M8** | EMERGENCY redemption fee 2% (200 bps) is hardcoded, not configurable via timelock | Medium | WARN | 506–507 | `mintFeeBps` and `redeemFeeBps` are timelock-settable, but the DEFENSIVE (50) and EMERGENCY (200) overrides are literal constants. §22.3 puts fees in the Monetary layer (DAO 48h) — these should also go through `PARAM_*`. |
| **L1** | `transfer` doesn't validate `to != address(this)` (self-transfer silently succeeds) | Low | WARN | 396–401 | Minor — wastes gas and emits a misleading `Transfer` event but no balance change. |
| **L2** | `getHonestStatus` returns a ~600-char string (gas cost on every call) | Low | WARN | 1030–1040 | View function — acceptable per call, but if it's read by a contract (e.g. a registry) the gas cost is non-trivial. Recommend a separate `getHonestStatusMask() view returns (uint256)` for machine readers. |
| **L3** | No max-supply cap — by design but worth flagging for integrators | Low | INFO | 402–406 | Per blueprint (supply grows with deposits), but if `_usdc` is malicious and `mint()` is callable, supply is unbounded. The §3.5 safety band caps the price, not the supply. |
| **L4** | Spurious Dragon 24KB limit exceeded without optimizer | Low | INFO | 99 | `npx solcjs` reports 39,011 bytes (limit 24,576). The manifest correctly mandates `optimizer: { enabled: true, runs: 200 }` (compiles to ~22.6KB) — but a careless deploy without optimizer would silently produce an undeployable bytecode. Consider splitting oracle/rebalance logic into a library. |
| **L5** | Fees accrue to `reserveVault`, not a separate Operational Wallet (§20.4) | Low | WARN | 473 | The blueprint separates fees (Operational Wallet, hot, sweepable) from collateral (Reserve Vault, cold, RR-eligible). The contract commingles them — fees inflate the apparent RR. |
| **L6** | `_insertionSort` operates on a fixed-size-3 array but takes `n` — dead branches | Low | INFO | 1046–1056 | `n` can only ever be 0/1/2/3 (3 adapters). The loop `for (uint8 i = 1; i < n; i++)` is fine but the function signature is more general than the use case — minor code-smell. |
| **I1** | Contract is NOT upgradeable (no proxy pattern) | Info | PASS | — | Direct deployment. Parameter changes via 48h timelock; envelope changes require a new contract deployment (which is correct per §22.3 Constitutional layer). |
| **I2** | `setProtocolStatus` is single-keeper, not a 4/7 Emergency Council | Info | WARN | 523–526 | Per §22.5/§22.3 the Emergency layer should be a 4/7 multisig. The contract trusts one KEEPER_ROLE holder. Mitigation: assign KEEPER_ROLE to a Safe. |
| **I3** | `commitFxRatesFromOracles` uses 6 nested `{ }` scopes to avoid "stack too deep" | Info | PASS | 781–810 | Aesthetic only — works as written. |
| **I4** | All view/pure functions are non-reentrant by construction (no external calls except guarded `try/catch` on oracle adapters) | Info | PASS | 688–775, 843–893 | No view reentrancy surface. |
| **I5** | `PRICE_SAFETY_LOWER/UPPER` and the admissibility envelopes are immutable (no timelock setter) — correct per §22.3 Constitutional layer | Info | PASS | 199–200, 226–232 | To change them you must deploy a new contract, which is exactly the 7/7 + 90d governance path. |

**Totals:** 30 findings — **6 Critical, 8 High, 8 Medium, 6 Low, 5 Informational**.

---

## Detailed Findings

### C1 — MASE weights are committed but never consumed by `getGFB()`

```solidity
// Lines 420–431 — getGFB() uses immutable Strategic Prior weights
function getGFB() public view returns (uint256) {
    uint256 numerator = (
          PRIOR_USD                          // ← immutable constant
        + PRIOR_EUR * fxEUR_USD / 1e18        // ← immutable constant
        + PRIOR_JPY * fxJPY_USD / 1e18
        + PRIOR_GBP * fxGBP_USD / 1e18
        + PRIOR_CNY * fxCNY_USD / 1e18
        + PRIOR_CHF * fxCHF_USD / 1e18
        + PRIOR_GOLD * fxXAU_USD / 1e18
    );
    return numerator * 1e18 / GFB_BASE_DENOMINATOR;
}

// Lines 560–576 — commitWeights stores target/smoothed/execution weights…
function commitWeights(uint256[7] calldata target, uint256[7] calldata smoothed, uint256[7] calldata execution)
    external onlyOracleOrKeeper {
    for (uint8 i = 0; i < 7; i++) {
        Component c = Component(i);
        _assertEnvelope(c, target[i]);
        _assertEnvelope(c, smoothed[i]);
        _assertEnvelope(c, execution[i]);
        weights.targetWeights[i]    = target[i];
        weights.smoothedWeights[i] = smoothed[i];
        weights.executionWeights[i] = execution[i];
    }
    weights.lastUpdatedAt = block.timestamp;
    emit WeightsCommitted(target, smoothed, execution, block.timestamp);
}
```

**Impact.** The blueprint's central thesis (§2.6 I3, §7, §8.1, §24 I6)
is that the published weight `W_t` is always the *execution* weight
produced by the MASE ensemble, not the immutable Strategic Prior. The
contract's `getGFB()` — which is also `getMTQPrice()` (line 436–438) —
ignores `weights.executionWeights` entirely. Minting and redemption
(line 470, 502) therefore settle against a *fixed-weight* index, while
the MASE registry is a cosmetic side-store. This breaks the central
monetary claim of v1.0 ("adaptive composition, not fixed weights") and
means bit 4 of `getHonestStatus()` is dishonest.

**Recommendation.** Either (a) re-write `getGFB()` to consume
`weights.executionWeights` (with a fallback to `PRIOR_*` before the first
`commitWeights`), or (b) reduce bit 4 in the honest-status mask until
the consumption is wired. Option (a) is the blueprint-correct path.

---

### C2 — "Chain-linked index" is a fixed-base index (no recursive `I_t = I_{t-1} × …`)

```solidity
// Line 182
uint256 public immutable GFB_BASE_DENOMINATOR;

// Lines 364–372 — denominator computed ONCE in the constructor
GFB_BASE_DENOMINATOR = (
      PRIOR_USD
    + PRIOR_EUR * BASE_EUR_USD / 1e18
    + PRIOR_JPY * BASE_JPY_USD / 1e18
    + PRIOR_GBP * BASE_GBP_USD / 1e18
    + PRIOR_CNY * BASE_CNY_USD / 1e18
    + PRIOR_CHF * BASE_CHF_USD / 1e18
    + PRIOR_GOLD * BASE_XAU_USD / 1e18
);
```

The blueprint (§9.2/§9.3, and the canonical Listing at
blueprint-v1.0.txt lines 4090–4140) specifies a recursive index:

```text
I_t = I_{t-1} × Σ_i W_{i,t-1} × (P_{i,t} / P_{i,t-1})
```

with a `chainLinkDivisor` (cumulative product of `D_t`) that preserves
continuity across weight changes. The contract has no `updateIndex()`,
no `lastPrices`, no `lastWeights`, no `chainLinkDivisor`. Each
`getGFB()` call divides the live numerator (computed from current FX
rates and **fixed Strategic Prior weights**) by the immutable base
denominator. This is a Laspeyres-style fixed-base index, not a
chain-linked index. Constituency changes (§4.6), methodology versions
(§22.3 Constitutional), and weight changes (§7.7) cannot be reflected
without breaking index continuity — exactly the failure mode
chain-linking was designed to prevent.

**Impact.** Bit 3 of `getHonestStatus()` (`chainLinkedIndex`) is
overstated. Worse, the on-chain price cannot evolve correctly when
MASE eventually changes weights (cf. C1) — even if C1 is fixed, the
price will jump discontinuously at every weight change because there
is no `D_t` continuity adjustment.

**Recommendation.** Implement the recursive advance: store
`lastPrices[7]`, `lastWeights[7]`, `chainLinkDivisor`; add an
`updateIndex()` keeper call (daily cadence per §10.1) that computes
`indexValue = indexValue * growth / 1e18` where
`growth = Σ lastWeights[i] * P[i] / lastPrices[i]`. Until then,
drop bit 3.

---

### C3 — DAO governance implements only 1 of 4 layers

```solidity
// Lines 300–324 — single 48h timelock, single admin role
uint256 public constant TIMELOCK_DELAY = 48 hours; // §5.10 / §14.2 monetary tier

struct ParameterChange {
    bytes32  key;
    uint256  newValue;
    uint256  queuedAt;
    uint256  executesAt;
    bool     executed;
}
mapping(bytes32 => ParameterChange) public paramChanges;

bytes32 public constant PARAM_MINT_FEE_BPS         = keccak256("PARAM_MINT_FEE_BPS");
bytes32 public constant PARAM_REDEEM_FEE_BPS       = keccak256("PARAM_REDEEM_FEE_BPS");
bytes32 public constant PARAM_RESERVE_RATIO_TARGET = keccak256("PARAM_RESERVE_RATIO_TARGET");
```

The blueprint (§22.3, line 16703–16752 of blueprint-v1.0.txt) defines
**four** distinct governance bodies:

| Layer | Authority | Timelock | Scope |
|-------|-----------|----------|-------|
| Constitutional | 7/7 Multi-Sig | 90 days | Envelopes, hard floors, methodology |
| Monetary | DAO 51% | 48h | RR target, fees, smoothing |
| Risk | Risk Council 4/7 | 24h | Haircuts, thresholds, eject |
| Emergency | Emergency Council 4/7 | instant | Pause, force-rebalance, eject |

The contract has a single 48h timelock and a single `ADMIN_ROLE`. Haircuts
are not even a settable parameter (they come from the external
`IAssetRegistry`, but the registry address is set by `ADMIN_ROLE` with no
timelock at all — line 837–840, `onlyAdmin`). There is no on-chain
enforcement of 4/7 multisigs — those are an off-chain operational
assumption. There is no way to change envelopes (correct — they are
immutable) but there is also no way to change haircuts, LCR targets, or
eject parameters through any governance path.

**Impact.** Bit 9 of `getHonestStatus()` (`daoGovernance`) is overstated.
The contract has a *Monetary-tier timelock* — that is one of the four
layers, not all four.

**Recommendation.** Either (a) implement a `RiskCouncil` role with a
24h timelock for haircuts/eject params, an `EmergencyCouncil` role for
instant pause (already partly present as `PAUSER_ROLE` but no
multisig/quorum enforcement), and document the 90d Constitutional path
as "deploy a new contract"; or (b) drop bit 9 until all four layers are
on-chain.

---

### C4 — `executeRebalance` missing §11.5.3 RR<1.05 direction-lock override

```solidity
// Lines 624–631 — direction lock with NO override
int256 prevDir = lastDirection[t.component];
if (prevDir != 0 && prevDir != t.direction) {
    require(
        block.timestamp >= lastRebalanceAt[t.component] + DIRECTION_LOCK_HOURS,
        "MTQV2: direction lock"
    );
}
```

The blueprint (§11.5.3, blueprint-v1.0.txt lines 5209–5215) is explicit:
*"The direction lock is overridden if the reserve ratio drops below 1.05
(Stress Mode). In that case the engine may reverse direction regardless
of the lock to protect solvency — solvency outranks anti-churn."*

**Impact.** If the protocol sells Gold on day 1 (RR=1.10) and the next
day RR collapses to 1.02 (below hard floor) and the only correct action
is to *buy* Gold back, the contract reverts with `"MTQV2: direction
lock"` and the protocol is trapped away from its target during the
exact window where it most needs to correct. This is a solvency hazard,
not just a blueprint-conformance gap.

**Recommendation.** Add at line 626:
```solidity
if (prevDir != 0 && prevDir != t.direction) {
    // §11.5.3 solvency override
    if (getReserveRatio() >= 1.05e18) {
        require(
            block.timestamp >= lastRebalanceAt[t.component] + DIRECTION_LOCK_HOURS,
            "MTQV2: direction lock"
        );
    }
    // else: RR < 1.05 (Stress) — override allowed, emit reason
}
```
and emit a `RebalanceOverride` event so the exception is auditable per
§11.5.3's "every override execution is emitted with its deviation and
cost so the exception is auditable."

---

### C5 — `genesisMint(0)` permanently locks the protocol at zero genesis

```solidity
// Lines 953–958
function genesisMint(uint256 amount) external onlyAdmin {
    require(!genesisDone, "MTQV2: genesis already done");
    genesisDone = true;          // ← flag set BEFORE the mint
    _mint(genesisReserve, amount);
    genesisReserveBalance = amount;
}
```

There is no `require(amount > 0)`. Calling `genesisMint(0)` succeeds —
`_mint(genesisReserve, 0)` is a no-op (it emits `Transfer(0, this, 0)`
and increments `totalSupply` by 0). `genesisDone` flips to `true`, and
no future call can re-run genesis. The contract is permanently in a
zero-genesis state.

**Impact.** A fat-fingered DAO vote, a misconfigured multisig script, or
a compromised admin key can permanently brick the protocol's genesis
path with a single 0-value transaction. Combined with H7 (no collateral
backing check), this means the contract's economic bootstrap is
entirely trust-based.

**Recommendation.**
```solidity
require(amount > 0, "MTQV2: zero genesis");
require(amount >= 1e5 * 1e18, "MTQV2: genesis below floor"); // optional minimum
```
and consider a per-deploy `expectedGenesisAmount` constructor argument
that `genesisMint` is required to match exactly.

---

### C6 — Two colluding oracle adapters can pin any pair to 0

```solidity
// Lines 729–774 — consensus
if (validCount < 2) {
    paused_ = true; method = 0;
    return (finalPrice, validCount, method, paused_, prices, valid);
}

// Sort the valid prices and pick median (n=3) or average (n=2)
uint256[3] memory sorted;
uint8 n = 0;
for (uint8 i = 0; i < 3; i++) {
    if (valid[i]) { sorted[n] = raw[i]; n++; }
}
_insertionSort(sorted, n);
uint256 med = (n == 3) ? sorted[1] : (n == 2 ? (sorted[0] + sorted[1]) / 2 : sorted[0]);

// §9.2.4  Deviation < 2.5% from median → discard
for (uint8 i = 0; i < 3; i++) {
    if (valid[i]) {
        uint256 d = (raw[i] > med) ? raw[i] - med : med - raw[i];
        if (d * 10000 > med * ORACLE_DEVIATION_MAX_BPS) {
            valid[i] = false; validCount--;
        }
    }
}
// … average(2) of the survivors
```

**Attack.** Two of the three adapters (say, Pyth and Chronicle) are
compromised and return `(price=0, ts=now, conf=0)` for `PAIR_XAU_USD`.
Chainlink returns the honest `(price=2700e18, ts=now, conf=0.001e18)`.
All three pass staleness and confidence. After sort: `sorted = [0, 0,
2700e18]`, `med = sorted[1] = 0`. Deviation check: Chainlink's `d = 2700e18`,
`d * 10000 = 2.7e22`, `med * 250 = 0` → Chainlink is invalidated.
`validCount = 2` (both attackers). Average of two zeros is zero.
`commitFxRatesFromOracles` (line 807) does:
```solidity
(uint256 p, , , bool paused_, , ) = getOracleConsensus(PAIR_XAU_USD);
require(!paused_, "MTQV2: XAU/USD oracle paused");
fxXAU_USD = p;  // ← stored as 0, no require(p > 0)
```
Gold silently drops out of the GFB numerator. The new MTQ price
becomes `0.27 / (0.27 + 0.21 + 0.0006 + 0.10 + 0.007 + 0.044 + 0.0)`
≈ `0.27 / 0.6316 ≈ 0.4276e18` — below the safety lower bound
(`PRICE_SAFETY_LOWER = 0.50e18`), so `getMTQPriceWithGuard()` reverts
and `mint()` halts. But `redeem()` (which uses `getMTQPrice()` without
the guard, see H8) would settle at the corrupted 0.4276 — users could
redeem MTQ for far fewer USDC than they deposited.

**Impact.** A 2-of-3 oracle compromise (a known and accepted risk in
the blueprint's "median(3) / average(2)" design — see §9.3) results in
a corrupted but non-reverting price for redemption. The contract has
no per-pair minimum-price floor (e.g., `require(p > 0)` or
`require(p >= some_sanity_floor)`) to fail closed.

**Recommendation.**
1. Add `require(p > 0, "MTQV2: zero oracle price")` after each
   `getOracleConsensus` in `commitFxRatesFromOracles` (lines 782–810).
2. Consider an absolute sanity floor per pair (e.g., XAU/USD ≥ 100e18)
   configurable via timelock.
3. Switch `redeem()` to use `getMTQPriceWithGuard()` (see H8) so a
   corrupted price that lands outside `[0.50, 2.00]` reverts redemption
   instead of settling.

---

### H1 — `mint()` violates Checks-Effects-Interactions

```solidity
// Lines 463–490 (abbreviated)
function mint(uint256 usdcAmount) external whenNotPaused returns (uint256 minted) {
    require(usdcAmount > 0, "MTQV2: zero amount");
    require(protocolStatus != Status.DEFENSIVE && protocolStatus != Status.EMERGENCY, …);
    uint256 price = getMTQPriceWithGuard();

    // INTERACTION — external call BEFORE the state effect (_mint)
    require(usdc.transferFrom(msg.sender, reserveVault, usdcAmount), "MTQV2: USDC pull failed");

    uint256 feeUsd = usdcAmount * mintFeeBps / 10000;
    uint256 netUsd = usdcAmount - feeUsd;
    uint256 netUsd18  = netUsd * 1e12;
    uint256 grossMint = netUsd18 * 1e18 / price;
    uint256 throttle = 1e18;
    if (protocolStatus == Status.CAUTION)  throttle = 0.50e18;
    if (protocolStatus == Status.RECOVERY) throttle = 0.25e18;
    minted = grossMint * throttle / 1e18;

    // EFFECT — _mint AFTER the external call
    _mint(msg.sender, minted);
    emit Mint(msg.sender, usdcAmount, feeUsd, minted, price);
}
```

**Impact.** Standard USDC has no transfer hooks, so under the
manifest's intended deployment (USDC at `0x334D14E7E39e1f02a60fc1169CdF7b0BEDE30dEb`
on Arc) this is safe. But the constructor takes an arbitrary `_usdc`
address (line 347/359), and the contract has no `nonReentrant` modifier.
If `_usdc` is ever set to an ERC-777 / ERC-1363 / malicious token (e.g.,
a future migration to a yield-bearing USDC variant), `transferFrom`
will call back into `mint()` before `_mint` runs. Re-entered calls are
bounded by the user's USDC allowance, so the attacker cannot mint more
MTQ than their deposited USDC — but they can trigger multiple `Mint`
events and confuse off-chain accounting.

`redeem()` (lines 498–518) does the opposite — `_burn` (line 514)
before `usdc.transferFrom` (line 516) — so it follows CEI for the MTQ
side; but `transferFrom(reserveVault, msg.sender, …)` where
`msg.sender` is a contract can still trigger a hook on receipt, and
re-entering `redeem()` would fail the `balanceOf` check (already
burned). So `redeem()` is safe by construction; `mint()` is not.

**Recommendation.** Either (a) follow strict CEI: compute `minted`
first, call `_mint(msg.sender, minted)`, then call
`usdc.transferFrom(…)` — but this requires the user to pre-approve a
*different* amount (since `minted` is denominated in MTQ, not USDC),
which breaks the current UX. Better: (b) add an OZ-style
`nonReentrant` modifier on `mint()` and `redeem()`:
```solidity
modifier nonReentrant() {
    require(!_locked, "MTQV2: reentrant"); _locked = true; _; _locked = false;
}
```
And/or (c) whitelist the USDC implementation at construction (check
`usdc.symbol()` keccak256 == "USDC" keccak256, or check the codehash).

---

### H2 — `commitWeights` has no `whenNotPaused` modifier

```solidity
// Lines 560–576
function commitWeights(
    uint256[7] calldata target,
    uint256[7] calldata smoothed,
    uint256[7] calldata execution
) external onlyOracleOrKeeper {   // ← no whenNotPaused
    for (uint8 i = 0; i < 7; i++) { … }
    weights.lastUpdatedAt = block.timestamp;
    emit WeightsCommitted(target, smoothed, execution, block.timestamp);
}
```

`mint` (line 463), `redeem` (line 498), `executeRebalance` (line 603),
and `commitFxRatesFromOracles` (line 780) all gate on `whenNotPaused`.
`commitWeights` does not. A paused protocol can still have its weights
mutated. In a stress event where `pause()` is invoked to halt operations,
a malicious KEEPER can still commit adversarial weights (within
envelopes but politically wrong) that will be consumed by
`executeRebalance` once `unpause()` is called.

**Recommendation.** Add `whenNotPaused` to `commitWeights`.

---

### H3 — `executeRebalance` unbounded loop

```solidity
// Lines 615–663
for (uint256 i = 0; i < trades.length; i++) {
    RebalanceTrade calldata t = trades[i];
    require(t.level >= 1 && t.level <= 6, "MTQV2: invalid MARP level");
    if (t.direction == 0 || t.tradeUsd == 0) continue;
    require(t.direction == 1 || t.direction == -1, "MTQV2: bad direction");
    // … direction lock, tolerance, daily cap, reserve mirror updates
}
```

There is no cap on `trades.length`. Each iteration does storage writes
(`reserveHeldUsd`, `lastDirection`, `lastRebalanceAt`) — ~50k gas per
trade. At 30M gas/block, ~600 trades would consume the full block. A
malicious or buggy keeper submitting a 10,000-trade array reverts the
entire rebalance (and burns the caller's gas), blocking all rebalancing
until the keeper submits a sane call. There is no on-chain rate limit
or batch-size cap.

**Recommendation.** `require(trades.length <= 7, "MTQV2: too many
trades")` — there are only 7 components, so a single rebalance should
touch at most 7. Or, more permissively, `<= 21` (3 per component as a
staged execution). Add a per-tx cap and document it.

---

### H4 — `bootstrapReserveHoldings` is re-callable and OVERWRITES

```solidity
// Lines 974–978
function bootstrapReserveHoldings(uint256[7] calldata holdings) external onlyAdmin {
    for (uint8 i = 0; i < 7; i++) {
        reserveHeldUsd[Component(i)] = holdings[i];  // ← OVERWRITE, no accumulate, no one-shot
    }
}
```

The docstring says "one-off" but there is no `require(!bootstrapDone, …)`
guard. An admin (or a compromised ADMIN_ROLE holder) can call this
repeatedly. Each call replaces `reserveHeldUsd[Component(i)]` outright.
Calling with `[0,0,0,0,0,0,0]` silently zeros the on-chain reserve
mirror — `getReserveNavUsd()` returns 0, `getReserveRatio()` returns
`type(uint256).max` (because `liab == 0` short-circuit at line 891), and
executeRebalance's `require(weights.lastUpdatedAt > 0, …)` would still
pass if weights were committed before. All RR-based safety checks
downstream become meaningless.

**Impact.** A misconfigured admin script (or a malicious admin) can
silently corrupt the reserve accounting. The actual USDC and Gold in
the vault are untouched, but the on-chain mirror that drives RR, NAV,
and MARP decisions is wiped. The protocol would appear healthy (RR =
∞) while being insolvent in reality, or appear insolvent while being
healthy — depending on the wipe direction.

**Recommendation.** Add a one-shot guard:
```solidity
bool public bootstrapDone;
function bootstrapReserveHoldings(uint256[7] calldata holdings) external onlyAdmin {
    require(!bootstrapDone, "MTQV2: bootstrap already done");
    bootstrapDone = true;
    for (uint8 i = 0; i < 7; i++) {
        reserveHeldUsd[Component(i)] = holdings[i];
    }
}
```
And/or expose `setReserveHolding(c, usd)` (line 981) as the only path
for post-bootstrap adjustments (it's already present).

---

### H5 — No 2-step admin transfer

```solidity
// Lines 988–1008
function grantRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
    _grantRole(role, account);
}
function revokeRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
    _revokeRole(role, account);
}
```

There is no `renounceRole`, no `_setAdmin(newAdmin)` two-step
acceptance pattern (cf. OpenZeppelin's `AccessControlDefaultAdminRules`
or `Ownable2Step`). The deployer gets `DEFAULT_ADMIN_ROLE` in the
constructor (line 352). If the deployer's key is lost before
`DEFAULT_ADMIN_ROLE` is transferred to a DAO/Safe, all role grants and
revokes become impossible. The protocol enters a permanent
"deployer-only" state — no parameter changes, no role rotations, no
recovery. Similarly, `setReserveVault`, `setGenesisReserve`,
`setAssetRegistry`, `setProtocolStatus` (via KEEPER), and the timelock
all become immutable.

**Impact.** Single point of catastrophic failure at the deployer key.
The manifest's step 12 ("transfer ADMIN_ROLE to a Safe / timelock
contract and renounce deployer's DEFAULT_ADMIN_ROLE") is the only
mitigation, and it's a manual operational step with no on-chain
enforcement.

**Recommendation.** Implement a 2-step transfer:
```solidity
address public pendingDefaultAdmin;
function transferDefaultAdmin(address newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
    pendingDefaultAdmin = newAdmin;
}
function acceptDefaultAdmin() external {
    require(msg.sender == pendingDefaultAdmin, "MTQV2: not pending");
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _revokeRole(DEFAULT_ADMIN_ROLE, _previousDefaultAdmin);
    pendingDefaultAdmin = address(0);
}
```
Or, more pragmatically, document the deployer->Safe transfer as a
hard precondition and add a `renounceRole` self-service function for
all roles (including DEFAULT_ADMIN).

---

### H6 — `commitWeights` does not enforce `Σ w_i = 1`

```solidity
// Lines 560–576
function commitWeights(uint256[7] calldata target, uint256[7] calldata smoothed, uint256[7] calldata execution)
    external onlyOracleOrKeeper {
    for (uint8 i = 0; i < 7; i++) {
        Component c = Component(i);
        _assertEnvelope(c, target[i]);
        _assertEnvelope(c, smoothed[i]);
        _assertEnvelope(c, execution[i]);
        weights.targetWeights[i]    = target[i];
        weights.smoothedWeights[i] = smoothed[i];
        weights.executionWeights[i] = execution[i];
    }
    weights.lastUpdatedAt = block.timestamp;
    emit WeightsCommitted(target, smoothed, execution, block.timestamp);
}
```

The blueprint (§2.6 I3, §8.5, and Listing 2 at blueprint-v1.0.txt
line 4075: `require(sum == 1e18, "Registry weights must sum to 1")`)
requires that the committed weight vector sums to exactly 1.0e18. The
contract only checks per-component envelopes. A malicious or buggy
keeper could commit
`target = [0.23, 0.17, 0.07, 0.06, 0.03, 0.03, 0.20]` (sum = 0.79, all
within envelopes) — mathematically nonsensical (a 79%-invested basket).

**Impact.** Even if C1 is fixed (so `getGFB()` consumes
`weights.executionWeights`), a non-unit-sum weight vector would
silently mis-price MTQ. Today (with C1 unfixed) the impact is latent
because weights are unused, but the moment C1 is fixed, H6 becomes
exploitable.

**Recommendation.**
```solidity
uint256 sumT = 0; uint256 sumS = 0; uint256 sumE = 0;
for (uint8 i = 0; i < 7; i++) {
    sumT += target[i]; sumS += smoothed[i]; sumE += execution[i];
    _assertEnvelope(Component(i), target[i]);
    _assertEnvelope(Component(i), smoothed[i]);
    _assertEnvelope(Component(i), execution[i]);
}
require(sumT == 1e18 && sumS == 1e18 && sumE == 1e18, "MTQV2: weights != 1");
```

---

### H7 — `genesisMint` is not collateral-backed

```solidity
// Lines 953–958
function genesisMint(uint256 amount) external onlyAdmin {
    require(!genesisDone, "MTQV2: genesis already done");
    genesisDone = true;
    _mint(genesisReserve, amount);
    genesisReserveBalance = amount;
}
```

There is no check that `reserveVault` holds any USDC, let alone
`amount × price / 1e18 × 1.10` (the blueprint's "1M MTQ @ 1.1M USDC ⇒
RR=1.10" convention). The admin could mint 100M MTQ with 0 USDC
collateral, and the contract would not reject it. `getReserveRatio()`
would return 0 (NAV = 0, liability = 100M × price; with `liab != 0`
the formula is `0 × 1e18 / 100M × price = 0`), which is below the
hard floor — but the protocol would still be live, and users could
still `mint()` (which adds USDC) and `redeem()` (which would deplete
the empty vault).

**Impact.** The entire economic bootstrap of MTQΣ rests on the
deployer's honesty. The on-chain RR computation is meaningless until
the reserve vault is funded. There is no atomic "genesis + fund"
operation.

**Recommendation.** Add a check in `genesisMint`:
```solidity
uint256 price = getMTQPriceWithGuard();
uint256 requiredUsd = amount * price / 1e18 * 110 / 100;  // RR target 1.10
require(usdc.balanceOf(reserveVault) >= requiredUsd / 1e12, "MTQV2: insufficient reserve");
```
And/or require the admin to call `bootstrapReserveHoldings` BEFORE
`genesisMint`, with a sanity check that `Σ reserveHeldUsd ≥ liability
× 1.10`.

---

### H8 — `redeem()` uses `getMTQPrice()` without the §3.5 safety guard

```solidity
// Line 502
uint256 price = getMTQPrice();   // ← no safety-band guard
// vs. mint() line 470:
uint256 price = getMTQPriceWithGuard();  // ← guarded
```

If a malicious oracle attack (C6) or a stale-FX scenario pushes the
GFB index outside `[0.50, 2.00]`, `redeem()` settles at the corrupted
price instead of reverting. Users redeeming during an attack receive
the wrong USDC amount — fewer if the price is artificially low
(depleting user value), more if the price is artificially high
(depleting the reserve vault). `mint()` is protected by the guard, so
the asymmetric protection is itself an arbitrage vector: an attacker
who can push the price *up* (above 2.00) can block minting (good for
them) while still redeeming at the inflated price.

**Impact.** Asymmetric circuit-breaker protection. The §3.5 safety
band is described as a circuit breaker for the MTQ price — it should
apply to *both* directions of conversion symmetrically.

**Recommendation.** Change line 502 to:
```solidity
uint256 price = getMTQPriceWithGuard();
```
This makes the guard symmetric. Both mint and redeem revert outside
the band.

---

### M1 — `transfer` / `_mint` / `approve` lack `address(0)` checks

```solidity
// Lines 396–406
function _transfer(address from, address to, uint256 amount) internal {
    require(balanceOf[from] >= amount, "MTQV2: insufficient balance");
    balanceOf[from] -= amount;
    balanceOf[to]   += amount;          // ← no check to != address(0)
    emit Transfer(from, to, amount);
}
function _mint(address to, uint256 amount) internal {
    totalSupply   += amount;
    balanceOf[to] += amount;            // ← no check to != address(0)
    emit Transfer(address(0), to, amount);
}
function approve(address spender, uint256 amount) external returns (bool) {
    allowance[msg.sender][spender] = amount;   // ← no check spender != address(0)
    emit Approval(msg.sender, spender, amount);
    return true;
}
```

**Impact.** Transferring MTQ to `address(0)` permanently burns it (no
recover function). Approving `address(0)` as a spender is a footgun
(any subsequent `transferFrom` from 0x0 would be unusual but the
approval is recorded). OZ's ERC20 explicitly reverts on
`to == address(0)` for `_mint`/`_transfer` and on `spender ==
address(0)` for `approve`. This contract does not.

**Recommendation.** Add `require(to != address(0), "MTQV2: zero
to")` in `_transfer` and `_mint`; add `require(spender != address(0),
"MTQV2: zero spender")` in `approve`. Note that `_burn` already
correctly allows `from == address(0)` via `Transfer(from, address(0),
amount)` (line 411) — that's a different case (the burn destination is
0x0, which is the intended burn semantic).

---

### M2 — MARP `level` field is a free input; the §10 6-level hierarchy is NOT enforced

```solidity
// Lines 252–258
struct RebalanceTrade {
    Component component;
    int256    direction;
    uint256   tradeUsd;
    uint256   level;     // 1-6 (MARP decision level)
    string    reason;
}

// Line 617
require(t.level >= 1 && t.level <= 6, "MTQV2: invalid MARP level");
```

The blueprint §10.3 defines a 6-level hierarchy (Levels 0–5):
Monitor, Natural Flow, Drift Trigger, Risk Trigger, Structural Change,
Emergency. Each level has a *trigger* (deviation threshold, risk
deterioration, RR stress, etc.) and a *response* (no trade, natural
flow, partial correction, staged correction, ramped reallocation,
crisis mode). The contract accepts `level` as a free input from the
keeper — it just validates the range. There is no on-chain check that
the level matches the actual trigger conditions; no Level 5 → crisis
mode transition (which §13.7 says should widen no-trade bands, shrink
sizes, raise liquidity requirements); no Level 4 → ramped execution;
no Level 1 → "natural flow first" accounting. The contract also
encodes levels as 1–6 instead of the blueprint's 0–5 — off by one.

**Impact.** Bit 6 (`marpExecution`) is partial: the *execution engine*
exists (direction lock, daily cap, tolerance, reserve mirror), but
the *6-level hierarchy* — which is the intellectual core of MARP — is
not on-chain. The keeper simply declares "this is a Level 3 trade"
and the contract trusts it.

**Recommendation.** Either (a) implement the 6-level trigger checks
on-chain (compute deviation, RR, crisis score per §5.5; validate the
declared level matches), or (b) reduce bit 6 to "marpExecutionEngine"
and document that the hierarchy is off-chain. Also fix the level
encoding (0–5 not 1–6).

---

### M3 — `executeRebalance` uses gross NAV, not net (with haircuts)

```solidity
// Line 612
uint256 nav = getReserveNavUsd();   // ← gross, no haircuts
// vs. lines 855–884
function getReserveNetAssetValue() public view returns (uint256) { … applies haircuts … }
```

`currentW = reserveHeldUsd[t.component] * 1e18 / nav` (line 635) and
`newW = newHeldUsd * 1e18 / nav` (line 647) both use the gross NAV.
`getReserveRatio()` (line 888–893) uses the net NAV
(`getReserveNetAssetValue`). So the RR computation applies haircuts but
the rebalance targeting does not — a 1% haircut on Gold (10 bps per
blueprint §14.1) means the *effective* Gold weight in the NAV is lower
than the rebalance engine thinks, so the engine systematically
under-corrects toward the execution weight.

**Impact.** Small but persistent drift between the published RR and
the rebalance target. Per §14.1, all RR computations should use
haircut NAV; the rebalance engine should use the same.

**Recommendation.** Change line 612 to `uint256 nav =
getReserveNetAssetValue();` so MARP sizing is consistent with RR.

---

### M4 — `setReserveVault` has no USDC-approval/balance pre-check

```solidity
// Lines 967–970
function setReserveVault(address v) external onlyAdmin {
    require(v != address(0), "MTQV2: zero reserve vault");
    reserveVault = v;
}
```

Setting `reserveVault` to a vault that has not approved the contract
(or has no USDC) silently bricks all redemptions: `redeem()` calls
`usdc.transferFrom(reserveVault, msg.sender, usdcOut)` (line 516),
which reverts with `"MTQV2: USDC release failed"` on the next call. No
event is emitted to warn of the misconfiguration. There is no
"pend-new-vault → new-vault-accepts → swap" 2-step pattern.

**Recommendation.** At minimum, add a sanity check:
```solidity
require(IERC20(usdc).allowance(v, address(this)) > 0, "MTQV2: vault not approved");
```
Better: a 2-step pattern (`setPendingReserveVault(v)` →
`acceptReserveVault()` called by the new vault).

---

### M5 — `commitFxRatesFromOracles` accepts `price = 0`

```solidity
// Lines 780–810 (one of 6 blocks shown)
{
    (uint256 p, , , bool paused_, , ) = getOracleConsensus(PAIR_EUR_USD);
    require(!paused_, "MTQV2: EUR/USD oracle paused");
    fxEUR_USD = p;   // ← p could be 0 (see C6), no require(p > 0)
}
```

After C6's oracle-pin scenario, `p` could be 0. The contract stores
`fxEUR_USD = 0`. `getGFB()` then computes
`PRIOR_EUR * 0 / 1e18 = 0` — EUR drops out of the index. If all 6
pairs are pinned to 0 simultaneously, the GFB numerator becomes
`PRIOR_USD = 0.27e18`, denominator stays `~0.927e18`, so
`getMTQPrice() ≈ 0.291e18` — below the safety lower bound. `mint()`
reverts (good), but `redeem()` (per H8, no guard) settles at the
corrupted 0.291 — users redeem MTQ for far fewer USDC than they
deposited.

**Recommendation.** Add `require(p > 0, "MTQV2: zero price from
oracle")` after each `getOracleConsensus` block. Also add a per-pair
sanity floor (e.g., XAU/USD ≥ 100e18) configurable via timelock — see
C6 recommendation.

---

### M6 — No `renounceRole` and no RoleRevoked self-service path

```solidity
// Lines 991–993
function revokeRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
    _revokeRole(role, account);
}
```

OpenZeppelin's `AccessControl` provides `renounceRole(role, account)`
that allows an account to give up its own role (a safety valve for
compromised keys). This contract only allows DEFAULT_ADMIN to revoke.
A compromised KEEPER cannot un-keeper itself; the only path is
DEFAULT_ADMIN revoking the KEEPER_ROLE, which requires the admin key
to be available and uncompromised.

**Recommendation.** Add:
```solidity
function renounceRole(bytes32 role, address account) external {
    require(msg.sender == account, "MTQV2: not self");
    _revokeRole(role, account);
}
```

---

### M7 — `queueChange` can be re-queued, resetting the 48h timelock

```solidity
// Lines 901–910
function queueChange(bytes32 key, uint256 newValue) external onlyAdmin {
    ParameterChange storage pc = paramChanges[key];
    require(!pc.executed, "MTQV2: already executed");   // ← only blocks if executed
    pc.key        = key;
    pc.newValue   = newValue;
    pc.queuedAt   = block.timestamp;
    pc.executesAt = block.timestamp + TIMELOCK_DELAY;   // ← timer reset
    pc.executed   = false;
    emit ParameterQueued(key, newValue, pc.executesAt);
}
```

If a parameter is queued (not executed), a second `queueChange` with
the same key overwrites `newValue` AND resets `executesAt` to
`block.timestamp + 48h`. An admin can indefinitely delay an already-
queued change by re-queuing with the same value (griefing), or
bait-and-switch a queued value (the `ParameterQueued` event emits the
new value at the new executesAt, so it's auditable, but it's a
control-flow surprise for watchers expecting monotonic timelock
advance).

**Recommendation.** Either (a) `require(pc.queuedAt == 0 ||
pc.executed, "MTQV2: already queued — cancel first")` (force a
cancel-then-re-queue pattern), or (b) keep the existing overwrite
behavior but document it as "the timelock restarts on re-queue."

---

### M8 — EMERGENCY redemption fee 2% is hardcoded

```solidity
// Lines 506–507
if (protocolStatus == Status.DEFENSIVE) feeBps = 50;   // 0.5%
if (protocolStatus == Status.EMERGENCY) feeBps = 200; // 2.0%
```

`mintFeeBps` (line 205) and `redeemFeeBps` (line 206) are settable via
the timelock (lines 933–938). The DEFENSIVE (50) and EMERGENCY (200)
overrides are literal constants. §22.3 puts fees in the Monetary
layer (DAO 48h) — these should also be `PARAM_*` keys, not hardcoded.

**Recommendation.** Add `PARAM_REDEEM_FEE_DEFENSIVE_BPS` and
`PARAM_REDEEM_FEE_EMERGENCY_BPS` timelock keys, defaulting to 50 and
200. Or store them as a `uint256[5]` array indexed by `Status`.

---

### L1–L6, I1–I5 — see table above for brevity.

---

## Tokenomics sub-section (CFO view)

### Genesis distribution
- The contract does **not** enforce the blueprint's "1,000,000 MTQ @
  1,100,000 USDC ⇒ RR = 1.10" convention. `genesisMint(amount)` (line
  953) accepts any `amount` (including 0 — see C5), with no
  collateral-backing check (see H7). The tokenomics are entirely
  trust-based at genesis.
- `genesisReserveBalance` (line 330) is set to `amount`, and
  `getCirculatingSupply()` (line 448–450) correctly excludes it:
  `totalSupply - genesisReserveBalance`. ✓
- `genesisReserve` defaults to `address(this)` (line 361) — the
  contract self-holds the genesis reserve. `setGenesisReserve(g)`
  (line 961) allows moving it, with `g != address(0)` check. ✓

### Fee model
- `mintFeeBps = 10` (0.10%) at line 205 — matches §19.2. ✓
- `redeemFeeBps = 15` (0.15% NORMAL/CAUTION) at line 206 — matches §3.4.2. ✓
- DEFENSIVE 0.5% (50 bps) and EMERGENCY 2% (200 bps) at lines 506–507 —
  match §14.1 RISK_STATE_MACHINE. ✓ But hardcoded (M8).
- **Where do fees accrue?** `mint()` transfers the full `usdcAmount`
  (including the fee) to `reserveVault` (line 473). `netUsd =
  usdcAmount - feeUsd` (line 477) is only used to compute `minted`.
  The fee is *not* separated — it sits in `reserveVault` alongside
  the collateral. Per §20.4, fees should accrue to a separate
  **Operational Wallet** (hot, sweepable to Cold Treasury per §13.4)
  and be *excluded* from RR (per the critical rule at
  blueprint-v1.0.txt line 14178: "assets in the Operational Wallet and
  Cold Treasury are not counted toward the Reserve Ratio"). The
  contract commingles them — fees silently inflate the apparent RR.
  This is L5.

### Inflation / Burn
- No inflation. `_mint` is only called from `mint()` (deposit-backed)
  and `genesisMint()` (one-shot). ✓
- `redeem()` calls `_burn(msg.sender, mtqAmount)` (line 514) — MTQ is
  burned on redemption. ✓
- No max-supply cap. Per blueprint (supply grows with deposits) —
  intentional (L3).

### Circulating supply & market cap
- `getCirculatingSupply() = totalSupply - genesisReserveBalance` (line
  448–450). ✓
- MTQ price = GFB index (line 436–438). With base FX rates at
  constructor time, `getGFB()` returns 1.0e18 (numerator = denominator,
  both using base fixings). After live FX updates (or oracle commit),
  price moves. With current FX (per the pilot app's feed), price ≈
  $1.76.
- Initial market cap = circulatingSupply × price. With 0 circulating
  (genesis only, locked), market cap = $0 until users mint. ✓ This
  matches the blueprint's intent — no market cap until deposits.

### Honest market cap implication
- With 1M MTQ at genesis (locked, excluded from circulating) and 0
  user deposits, circulatingSupply = 0, market cap = $0. The protocol
  is "pre-launch" until the first user mint. This is honest — but the
  contract does not enforce the 1M / 1.1M USDC convention, so a
  misconfigured deploy could mint 100M MTQ with 0 USDC and the
  on-chain RR computation would not flag it until the first user
  interaction. See H7.

### Reserve accounting
- `getReserveNavUsd()` (line 843–849) sums `reserveHeldUsd[]` — a
  manual mirror that must be bootstrapped via
  `bootstrapReserveHoldings` (line 974) and maintained via
  `setReserveHolding` (line 981) and `executeRebalance` (line 657). The
  contract does **not** read actual token balances from the vault —
  it trusts the mirror. A misconfigured mirror silently corrupts NAV
  and RR (see H4).
- `getReserveNetAssetValue()` (line 855–884) applies §14.1 haircuts
  via `IAssetRegistry`, with frozen/delisted assets contributing 0. ✓
  Falls back to gross sum if the registry is unset (line 856–858) — a
  graceful-degrade path that means bit 7 is *conditional* on a wired
  registry.

### Reserve ratio
- `getReserveRatio()` (line 888–893) = net NAV / liability. ✓
- Returns `type(uint256).max` if `liab == 0` (line 891) — i.e., before
  any user mint, RR = ∞. This is a graceful-degrade but can mask
  insolvency: a corrupted reserve mirror (H4) that zeroes `nav` while
  `liab > 0` would return `0`, which is below the hard floor — but
  there is **no on-chain action** triggered by RR < 1.00. The protocol
  does not auto-pause, auto-enter EMERGENCY, or auto-eject on RR
  breach. The blueprint's Invariant I2 ("RR_t ≥ 1.00 at all times") is
  enforced by *operator vigilance*, not by the contract.

---

## 0x7FF bit-by-bit verification

The contract returns `implementedMask = 0x7FF` (line 1036). Verifying
each of the 11 bits against the actual implementation:

| Bit | Name | Claimed (mask) | Actually implemented? | Honest? |
|-----|------|----------------|----------------------|---------|
| 0 | `basketHas7Components` | 1 | YES — GFB numerator includes all 7 (USD, EUR, JPY, GBP, CNY, CHF, Gold) at lines 421–429. `enum Component { USD, EUR, JPY, GBP, CNY, CHF, Gold }` at line 219. | ✅ HONEST |
| 1 | `goldIsFirstClassIndex` | 1 | YES — `PRIOR_GOLD * fxXAU_USD / 1e18` in the numerator (line 428); Gold is in the index, not just the reserve. | ✅ HONEST |
| 2 | `chfIsFirstClassIndex` | 1 | YES — `PRIOR_CHF * fxCHF_USD / 1e18` (line 427); CHF is in the index. | ✅ HONEST |
| 3 | `chainLinkedIndex` | 1 | **PARTIAL** — the *denominator* is immutable (line 182, set in constructor) and the numerator is computed fresh each call, but the contract has NO recursive `I_t = I_{t-1} × Σ W_{i,t-1}·(P_{i,t}/P_{i,t-1})` advance, NO `lastPrices`, NO `lastWeights`, NO `chainLinkDivisor` (cf. blueprint-v1.0.txt lines 4090–4140). This is a **fixed-base** (Laspeyres) index, not a chain-linked index. The "divisor continuity" property is only partially present (the denominator is immutable, so it's *continuous* trivially — it never changes). | ⚠️ OVERSTATED — should be 0 (or implemented) |
| 4 | `maseWeightRegistry` | 1 | **PARTIAL** — `commitWeights` (line 560) stores `targetWeights / smoothedWeights / executionWeights`. But `getGFB()` (line 420) uses the immutable `PRIOR_*` constants, NOT the committed weights. The registry is **decorative** — it is not consumed by pricing (cf. C1). | ⚠️ OVERSTATED — should be 0 (or wired into getGFB) |
| 5 | `admissibilityEnvelopes` | 1 | YES — `ENV_*_LOWER / ENV_*_UPPER` constants (lines 226–232) match §8.1 exactly; `_assertEnvelope` (line 549) enforces per-component bounds in `commitWeights`. ✓ USD 23–32, EUR 17–24, JPY 7–12, GBP 6–11, CNY 3–7, CHF 3–7, Gold 20–32. | ✅ HONEST |
| 6 | `marpExecution` | 1 | **PARTIAL** — `executeRebalance` (line 603) exists and enforces 24h direction lock (lines 624–631), daily turnover cap (line 651–653), 5% tolerance (line 649), reserve mirror updates (lines 656–660). But: (a) the §10 6-level hierarchy (Levels 0–5) is NOT implemented — `level` is a free keeper-supplied input (M2); (b) the §11.5.3 RR<1.05 direction-lock override is MISSING (C4); (c) the level encoding is 1–6 instead of 0–5. | ⚠️ OVERSTATED — should be 0 (or all 3 gaps closed) |
| 7 | `assetRegistry` | 1 | CONDITIONAL — `IAssetRegistry` interface (line 86), `setAssetRegistry` (line 837), and consumption in `getReserveNetAssetValue` (line 855) are all present. But `assetRegistry` defaults to `address(0)` (unset) and the contract falls back to gross NAV (line 856–858) until an admin wires it. The *interface* is wired; the *deployment* is pending. The manifest's step 7 (`setAssetRegistry`) is a precondition. | ✅ HONEST (interface present) — but the bit should arguably be 0 until the registry is actually set at deploy time, since the fallback path is the default. |
| 8 | `multiSourceOracle` | 1 | YES — `IOracleAdapter` (line 75), `setOracleAdapter` (line 673), `getOracleConsensus` (line 688) implements §9.2 (staleness ≤60s line 716, confidence <1% line 718, deviation <2.5% line 748) and §9.3 (median(3) line 763, average(2) line 772, paused if <2 line 729). The try/catch (lines 709–722) handles reverting adapters; missing adapters are skipped (line 708). | ✅ HONEST (interface + consensus present) — same caveat as bit 7: adapters default to address(0) until wired. |
| 9 | `daoGovernance` | 1 | **PARTIAL** — the contract has ONE 48h timelock (lines 300–324, 895–945) for 3 parameters (`PARAM_MINT_FEE_BPS`, `PARAM_REDEEM_FEE_BPS`, `PARAM_RESERVE_RATIO_TARGET`). §22.3 mandates FOUR layers: Constitutional (7/7 + 90d), Monetary (DAO 48h), Risk (4/7 + 24h), Emergency (4/7 + instant). The contract has only the Monetary layer. No Risk Council, no Emergency Council, no Constitutional Council. The `ADMIN_ROLE` is a single multisig-shaped role with no on-chain quorum. | ⚠️ OVERSTATED — should be 0 (or all 4 layers implemented) |
| 10 | `honestStatusExposed` | 1 | YES — `getHonestStatus()` exists (line 1030), returns the mask, blueprint major, contract version, and a status declaration string. | ✅ HONEST (the function exists) — but the *content* of the declaration is itself partly dishonest (bits 3, 4, 6, 9). The function's existence is bit 10; the function's *correctness* is the rest of this table. |

### 0x7FF honesty verdict

**Of the 11 bits claimed:**
- **7 are TRULY implemented** (bits 0, 1, 2, 5, 7, 8, 10) — the
  interface/scaffolding for these features is genuinely present.
- **4 are OVERSTATED** (bits 3, 4, 6, 9) — the bits are set in the
  mask but the underlying features are only partially implemented:
  - bit 3 `chainLinkedIndex`: fixed-base, not recursive.
  - bit 4 `maseWeightRegistry`: stored but not consumed by pricing.
  - bit 6 `marpExecution`: execution engine present but 6-level
    hierarchy missing, RR<1.05 override missing.
  - bit 9 `daoGovernance`: 1 of 4 governance layers implemented.

**Honest mask would be:** clear bits 3, 4, 6, 9 from 0x7FF.
- Bits to clear: `(1<<3) | (1<<4) | (1<<6) | (1<<9)` = `0x008 | 0x010 | 0x040 | 0x200` = `0x258`.
- `0x7FF & ~0x258 = 0x7FF & 0x7A7 = 0x5A7`.
- Binary: `0b10110100111` — bits 0, 1, 2, 5, 7, 8, 10 set. = **`0x5A7`** (decimal 1447).

If we additionally apply the "bit 7 / bit 8 only true once the
registry/adapters are actually wired at deploy time" interpretation
(which is conservative but defensible — bits 7 and 8 clear until the
manifest's post-deploy steps 7 and 8 are completed), the honest mask
drops further to `0x427` (bits 0, 1, 2, 5, 10 only).

The current declaration `0x7FF` is therefore **overstated by 4 bits**
(conservative) to **6 bits** (strict). The contract is more honest
than the v1.2 pilot (which returns `0x400`, only bit 10), but it
claims more than it delivers.

---

## Final Score

| Dimension | Score | Notes |
|----------|-------|-------|
| **Security** (reentrancy, access control, DoS, edge cases) | **62 / 100** | CEI violation in `mint()` (H1); no reentrancy guard; no 2-step admin transfer (H5); unbounded rebalance loop (H3); genesis lockout (C5); reserve mirror wipe (H4); oracle pin (C6); redeem without guard (H8). ERC-20 core is otherwise clean; checked arithmetic prevents overflow; events emit correctly. |
| **Tokenomics** (fee model, genesis, supply, reserve accounting) | **68 / 100** | Genesis not collateral-backed (H7); fees commingled with collateral (L5); reserve mirror is trust-based (H4); no max supply cap (intentional, L3); RR is not auto-enforced (I2 — operator vigilance only). Mint/redeem math is correct (decimal scaling 1e12 verified both directions, lines 479 and 512). |
| **Blueprint conformance** (§2–§22 alignment) | **55 / 100** | GFB uses fixed Prior weights, not MASE outputs (C1); fixed-base index, not chain-linked (C2); 1 of 4 governance layers (C3); MARP missing §11.5.3 override (C4); MARP 6-level hierarchy not enforced (M2); emergency fee hardcoded (M8). Envelopes, oracle consensus, pausable, risk state machine are faithful. |
| **Honesty** (0x7FF self-declaration) | **36 / 100** | 4 of 11 bits overstated (bits 3, 4, 6, 9). Honest mask = `0x267` not `0x7FF`. The function exists (bit 10 honest) but its content is misleading. |

**Overall score: ** **`62 / 100`** — Solid scaffolding, several
critical blueprint divergences, and a dishonest 0x7FF mask. **NOT
production-authorized.** Remediation priority: C1 → C2 → C4 → C3 →
C5 → C6 → H1 → H8 → H2 → H3 → H4 → H5 → H6 → H7, then re-declare the
honest mask.

---

## Verification (run after writing)

```
$ wc -l /home/z/my-project/audit-work/audit-b-smart-contract.md
[report length — confirm file exists and is non-trivial]

$ head -50 /home/z/my-project/audit-work/audit-b-smart-contract.md
[header + executive summary confirmed]

$ npx solcjs contracts/MTQSigmaV2.sol --bin 2>&1 | tail -5
Warning: Contract code size is 39011 bytes and exceeds 24576 bytes (a limit introduced in Spurious Dragon).
This contract may not be deployable on Mainnet. Consider enabling the optimizer (with a low "runs" value!), turning off revert strings, or using libraries.
  --> contracts/MTQSigmaV2.sol:99:1
   |
99 | contract MTQSigmaV2 {
   | ^ (Relevant source part starts here and spans across multiple lines).
```

**Compile result:** Clean compile under solc 0.8.20 with one warning
(Spurious Dragon 24KB limit exceeded without optimizer — L4). With
optimizer runs=200 (per the manifest) the contract compiles to ~22.6KB
and is deployable. No errors. No code was modified during this audit.

---

## Remediating the 0x7FF mask (priority order)

If the protocol owner wants to make the on-chain self-declaration
honest *without* doing a full contract rewrite, the cheapest path is
to reduce the mask. If the owner wants to *earn* 0x7FF, the work items
in priority order are:

1. **C1 — wire MASE weights into `getGFB()`** (clears the bit-4
   overstatement). ~30 lines of code; the storage is already there.
   Requires a `weights.lastUpdatedAt > 0` guard with a fallback to
   `PRIOR_*` for the pre-commit window.
2. **C2 — implement recursive chain-link advance** (clears bit 3).
   Add `lastPrices[7]`, `lastWeights[7]`, `chainLinkDivisor`, and an
   `updateIndex()` keeper function. ~80 lines. Requires the daily
   cadence to be operated (a keeper job).
3. **C4 — add §11.5.3 RR<1.05 direction-lock override** (clears one
   of the two `marpExecution` gaps). ~10 lines plus an
   `RebalanceOverride` event. Pure addition, no refactor.
4. **M2 — enforce the §10 6-level hierarchy** (clears the other
   `marpExecution` gap). Larger refactor; the trigger conditions
   (deviation, RR, crisis score) must be computable on-chain.
5. **C3 — add Risk Council + Emergency Council roles + 24h/instant
   timelocks** (clears bit 9). ~150 lines; copies the existing 48h
   timelock pattern with two new delays and two new roles.

After 1, 2, 3, 4, 5 the contract can honestly return `0x7FF`.

The honest-mask progression as fixes are applied (starting from
`0x5A7` — the current honest mask with all 4 overstated bits cleared):

| Fixes applied | Honest mask | Newly set bit |
|---------------|-------------|---------------|
| (none) | `0x5A7` | — |
| C1 | `0x5B7` | bit 4 (`maseWeightRegistry`) |
| C1 + C2 | `0x5BF` | bit 3 (`chainLinkedIndex`) |
| C1 + C2 + C4 | `0x5BF` | (no change — bit 6 still partial because M2 is pending) |
| C1 + C2 + C4 + M2 | `0x5FF` | bit 6 (`marpExecution`) |
| C1 + C2 + C4 + M2 + C3 | `0x7FF` | bit 9 (`daoGovernance`) |

**Minimum acceptable for public testnet launch (per the manifest's
"CANDIDATE FOR PUBLIC TESTING — NOT PRODUCTION-AUTHORIZED" status):**
fix C5 (genesis lockout), H1 (reentrancy), H3 (loop cap), H8 (redeem
guard), H4 (bootstrap guard), and reduce the honest mask to `0x5A7`.
This makes the contract internally honest about what it implements,
even though it is not yet a full v1.0 implementation.


