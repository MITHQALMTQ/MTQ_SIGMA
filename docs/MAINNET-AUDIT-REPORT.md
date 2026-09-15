# MTQΣ — Mainnet Readiness Audit & Production Hardening Report

**Prepared by:** Lead AI Platform Developer (acting as COO / CTO / Tokenomics Expert / Crypto Structuring Expert)
**Date:** 2026-09-15
**Subject:** Honest top-tier audit, gap analysis, and mainnet transition roadmap
**Classification:** Internal — for governance council review before any GO/NO-GO vote

---

## 0. Executive Summary — READ THIS FIRST

### The honest verdict

**MTQΣ is NOT mainnet-ready.** The protocol has a solid architectural foundation and a thoughtful monetary blueprint, but it currently carries **12 critical blockers** that would each individually disqualify it from mainnet deployment under any serious framework (CertiK, OpenZeppelin, Trail of Bits, Spearbit). The gap between the current testnet state and a defensible mainnet launch is approximately **5–7 months of focused engineering plus a 2-month external audit** — call it **7–9 months to a responsible mainnet** under a well-resourced team.

This is not a criticism of the work done so far. The testnet pilot has successfully proven:
- ✅ The 7-component GFB index math (chain-linked, divisor-adjusted)
- ✅ The 6-state risk machine with 48h RECOVERY hysteresis
- ✅ 4 testnet deployments (Monad, Arc, Robinhood, Solana) with live contracts
- ✅ The audit trail (§24) writing 20K+ rows to Turso
- ✅ 30 Foundry tests passing + 151 canonical invariant assertions
- ✅ Live FX feeds (8/8) and the FRED integration

But testnet success and mainnet readiness are **different categories**. What follows is the unvarnished truth.

### Scorecard

| Dimension | Score | One-line verdict |
|---|---|---|
| Smart contract security | **5/10** | 7 critical gaps; governance dead code; admin can fake NAV |
| Tokenomics | **6/10** | Single-collateral masquerading as 7-currency; no liquidation; band too wide |
| Oracle architecture (I9) | **3/10** | On-chain ≠ off-chain; adapters are stubs; sources not independent |
| Governance | **2/10** | 4 council addresses have no setters; Listing 14 is dead code |
| Engine correctness | **6/10** | Solid math, but redemption policy contradicts itself; silent negative-holdings bug |
| Testing coverage | **4/10** | ~40% line coverage; Layer 6 backtest never run; MARP untested; 4/5 fuzz tests have cached failures |
| Infrastructure | **4/10** | Keeper has a price-inversion bug; no RPC fallback; backups can't be restored |
| Operational readiness | **3/10** | Single-key pause authority; no 24/7 paging; no named on-call |
| Regulatory & compliance | **HIGH RISK** | Likely a security (Howey); likely an ART (MiCA); no KYC/AML; no sanctions screening |
| **Overall mainnet readiness** | **3.5/10** | **NOT READY — 7–9 months to responsible mainnet** |

### Mainnet blocker count

- 🔴 **12 CRITICAL** — each is an individual NO-GO
- 🟠 **16 HIGH** — must fix before audit
- 🟡 **17 MEDIUM** — should fix before mainnet
- 🟢 **9 LOW** — nice-to-have

**Total: 54 findings.** Full detail in §3.

---

## 1. What "Mainnet-Ready" Actually Means

Before scoring, let's be explicit about the bar. A defensible mainnet launch of a stablecoin-like monetary asset requires:

### The 7 Pillars of Mainnet Readiness

1. **External security audit** — at least one top-tier firm (CertiK, OpenZeppelin, Trail of Bits, Spearbit, Hacken) with no unresolved high/critical findings. **Status: ❌ Never performed.**

2. **Functional governance** — multi-sig on hardware wallets, timelocked admin actions, working parameter-change proposals. **Status: ❌ Single EOA, no timelock, governance setters don't exist.**

3. **Real oracle infrastructure** — 3 truly independent sources with on-chain adapters, not synthetic witnesses derived from one reference. **Status: ❌ Adapters are stubs; 2 of 3 sources are derived from 1 reference.**

4. **Battle-tested monetary engine** — historical backtest (10 years), property-based fuzzing, adversarial stress, integration tests against a real RPC. **Status: ❌ Layer 6 backtest never run; no property tests; no integration tests.**

5. **Operational maturity** — 24/7 paging, named on-call, tested disaster recovery, key rotation procedure, war-room runbook exercised in game-day. **Status: ❌ Discord-only alerts; no PagerDuty; restore script doesn't exist.**

6. **Legal & regulatory posture** — legal opinion on token classification, KYC/AML for fiat on/off ramps, wallet-level sanctions screening, incorporated legal entity. **Status: ❌ None of these exist.**

7. **Gradual mainnet rollout** — capped TVL ($100K → $1M → $10M), shadow fork stress, bug bounty live for 30+ days before public launch. **Status: ❌ No plan documented.**

**Current state: 0 of 7 pillars met.** This is the honest starting point.

---

## 2. Critical Blockers (Ranked — each is an individual NO-GO)

### 🔴 B1 — Governance is dead code (4 council addresses never initialized)

**Where:** `contracts/MTQSigmaV2.sol:298-301` declares `dao`, `riskCouncil`, `emergencyCouncil`, `constitutionalCouncil`. Constructor at L403-462 never sets them. No setter functions exist (grep-confirmed).

**Impact:** `proposeChange` (L787) checks `msg.sender == dao` etc. Since all four default to `address(0)`, **no parameter change can ever be proposed**. The entire Listing 14 governance system (registerParameter/proposeChange/executeChange/cancelChange) is dead code. Only `DEFAULT_ADMIN` (the deployer EOA) can do anything via `registerParameter`.

**Why it blocks mainnet:** A protocol where governance cannot act is a protocol with no recovery path. Any parameter misconfiguration requires a contract redeployment.

**Fix:** 4h — add `setDao`/`setRiskCouncil`/`setEmergencyCouncil`/`setConstitutionalCouncil` (onlyConstitutionalCouncil with DEFAULT_ADMIN bypass), call them in the deployment script with Safe addresses, emit events, add timelock.

---

### 🔴 B2 — `DEFAULT_ADMIN_ROLE` on a single deployer EOA (whose private key leaked)

**Where:** Constructor at L439 grants `DEFAULT_ADMIN_ROLE` to `msg.sender`. The deployer is `0x3C3932F865892EFabE45892f453f81B64f6c8d8c`. The private key is in `upload/private_key.txt` (gitignored but on disk). The audit could not confirm the key hasn't been copied.

**Impact:** Single-key compromise = total protocol takeover. Attacker can: grant themselves any role, pause/unpause at will, call `setReserveHolding` to fake NAV, drain USDC via `setReserveVault`.

**Why it blocks mainnet:** This is the single largest concentration of risk in the entire system. No auditor will pass this. No insurance policy will cover it. No institutional user will touch it.

**Fix:** 4h — deploy Safe multi-sigs (4/7 Constitutional, 4/7 Emergency, 2/3 Monetary DAO, 4/7 Risk) on each target chain. Call `grantRole(DEFAULT_ADMIN, safe)` then `renounceRole(DEFAULT_ADMIN, deployer)` from the deployer. Rotate the deployer key. Document in `CRITICAL-PRIVATE-KEY-ROTATION.md`.

---

### 🔴 B3 — `mint` and `redeem` don't check oracle health (stale-price window)

**Where:** `mint` (L1147) and `redeem` (L1179) use `getMTQPriceWithGuard()` which reads `indexValue` and `INDEX_BASE_DENOMINATOR` — both derived from `lastPrices[]` which is only updated by `commitFxRatesFromOracles`. If oracles fail mid-cycle, `lastPrices[]` is stale indefinitely.

**Impact:** A 60-second keeper outage = users mint/redeem against prices that may be hours or days old. A sophisticated attacker can monitor the keeper, wait for it to miss a tick, then mint at a stale favorable price.

**Why it blocks mainnet:** Every major stablecoin exploit since 2020 has involved stale oracle prices (Cream, bZx, Bonq, Mango Markets). This is the #1 historical attack vector.

**Fix:** 6h — add `require(!getOracleConsensus().paused_, "oracle paused")` to `mint` and `redeem`. Add a `lastOracleCommitAt` timestamp with `require(block.timestamp - lastOracleCommitAt < 120 seconds)`.

---

### 🔴 B4 — No real oracle adapters (the 3-source consensus is fictional)

**Where:** `IOracleAdapter` interface at L101. No `ChainlinkAdapter.sol`, `PythAdapter.sol`, or `ChronicleAdapter.sol` exist. Tests use `MockOracleAdapter`. The TS `oracle.ts:24-28` admits "real Chainlink/Pyth/Chronicle feeds require on-chain access we don't have in this pilot" and uses synthetic witnesses derived from a single Frankfurter/gold-api reference.

**Impact:** The I9 "3-source median consensus" is fictional. There is 1 source (Frankfurter ECB for FX, gold-api for gold) with 2 synthetic noise variants. Source independence — the entire point of I9 — is not honored.

**Why it blocks mainnet:** I9 is a constitutional invariant. Deploying without real 3-source consensus is deploying without the constitution. Any single feed compromise = total index corruption.

**Fix:** 60-120h — write 3 real adapter contracts:
- `ChainlinkAdapter.sol` — reads AggregatorV3Interface for EUR/USD, GBP/USD, JPY/USD, CNY/USD (Chainlink has these on mainnet), XAU/USD
- `PythAdapter.sol` — reads Pyth Network PriceServiceV2 for the same pairs
- `ChronicleAdapter.sol` — reads Chronicle Scribe for FX + gold
- Each adapter must implement staleness check, deviation check, confidence check
- Deploy on each target chain, wire to `setOracleAdapter`
- Add a `sourceIndependenceCheck` that verifies the 3 adapter addresses are distinct AND that their reported prices don't correlate >0.95 (statistical independence)

---

### 🔴 B5 — `setReserveHolding` lets admin silently fake NAV (no event, no timelock)

**Where:** `setReserveHolding` (L1361, `onlyAdmin`) sets any component's `reserveHeldUsd[i]` to any value. No event emitted. No timelock.

**Impact:** An admin (currently the deployer EOA) can set Gold reserve to $1B → fake 1000% RR → mint unbounded MTQ → drain real USDC. There is zero on-chain audit trail.

**Why it blocks mainnet:** This is a backdoor. Even if the admin is a Safe multi-sig, the lack of a timelock means the multi-sig can rug instantly. The lack of an event means off-chain monitors can't detect it.

**Fix:** 8h — (1) add `event ReserveHoldingUpdated(uint256 indexed component, uint256 oldValue, uint256 newValue, address indexed by)` and emit it; (2) wrap in a 48h timelock (propose → wait → execute); (3) add a `MAX_RESERVE_HOLDING_DELTA` (e.g. 5% of NAV per proposal) to bound the damage.

---

### 🔴 B6 — On-chain I9 still allows 2-source averaging (off-chain was fixed, on-chain wasn't)

**Where:** `getOracleConsensus` (L895-969) at L965-968: `if (validCount == 2) { method = 1 (average); }`. The TS `oracle.ts` was fixed to strict-I9 in TASK-7-ORACLE-I9 (pause at <3), but the Solidity contract was never updated.

**Impact:** On-chain ≠ off-chain behavior. The TS engine pauses when <3 feeds valid; the contract keeps averaging 2. A user minting directly against the contract (bypassing the TS engine) gets a stale/averaged price while the UI shows "paused."

**Why it blocks mainnet:** Consistency between off-chain and on-chain is a constitutional requirement (I3, reproducibility). Any divergence is a reproducibility violation.

**Fix:** 2h — change L965-968 to: `if (validCount < 3) { paused_ = true; method = 2 (paused); finalPrice = 0; }`. Remove the 2-source average branch entirely (or gate it behind a `governanceOverride` flag matching the TS implementation).

---

### 🔴 B7 — Keeper EUR/USD price inversion bug

**Where:** `mini-services/keeper/index.ts:271-275`. Frankfurter API returns "1 USD = X EUR" (EUR per USD ≈ 0.92). The keeper pushes `eur = fx.rates.EUR` (= 0.92e18) directly to the contract. The engine (`fx.ts:163`) correctly inverts to `EUR_USD = 1 / r.EUR` ≈ 1.08.

**Impact:** If the keeper were pointed at a real contract, it would feed EUR=0.92 instead of EUR=1.08 within one tick. The chain-linked index would diverge from reality immediately. Every subsequent mint/redeem would be at a ~15% wrong price.

**Why it blocks mainnet:** This is a showstopper. The keeper is the bridge between off-chain data and on-chain state. A bug here corrupts everything downstream.

**Fix:** 1h — invert the FX rates in the keeper before pushing to the contract: `eur = 1e36 / (fx.rates.EUR * 1e18)` etc. Add a unit test that verifies the keeper's output matches the engine's `fetchFxSnapshot` output for the same input.

---

### 🔴 B8 — Redemption policy contradiction (NAV-based vs P_MTQ-based)

**Where:** `REDEMPTION_POLICY` (engine.ts:2125-2134) says §3.4.2 (P_MTQ-based, arbitrage-safe) is canonical. The actual `applyRedeem` code (engine.ts:1147-1282) does §12.2 (NAV-based): `grossUsd = inputMtq × navPerMtq` where `navPerMtq = V_net / circulatingSupply`.

**Impact:** At RR=110% (the target), NAV_per_MTQ = 1.10 × P_MTQ. Redeemers receive 10% more than the index price. This drains the buffer surplus via arbitrage on every redemption. The policy comment explicitly warns against this; the code does it anyway.

**Why it blocks mainnet:** This is a sustained drain of the protocol's surplus. At scale, it would erode the 10% buffer within months. It is also a contradiction in the spec — either the policy or the code is wrong.

**Fix:** 4h — decide which is canonical. If P_MTQ-based (recommended — it's arbitrage-safe): change `applyRedeem` to use `price = getMTQPriceWithGuard()` instead of `navPerMtq`. If NAV-based: delete the `REDEMPTION_POLICY` object and update the blueprint. Either way, add a test that verifies redeem at RR=110% does NOT extract surplus.

---

### 🔴 B9 — `Math.max(0, ...)` silent negative-holdings bug

**Where:** engine.ts:799, 806, 928-929, 937-939, 952-954, 959-960, 1241-1248, 1251-1252. Every reserve mutation floors negative balances to 0.

**Impact:** If a redeem requests more of an asset than the reserve holds, the code silently zeros the holding instead of reverting. The deficit disappears. Over time this creates phantom surplus. No test covers this.

**Why it blocks mainnet:** Conservation of value is a fundamental invariant. Silent loss of value is a bookkeeping fraud, even if unintentional. At scale, this could mask a slow drain.

**Fix:** 6h — replace all `Math.max(0, x)` in reserve mutations with `if (x < 0) revert "insufficient holding"` (or return `ok: false` with a reason). Add tests for redeem-into-negative on each of the 7 components.

---

### 🔴 B10 — No KYC/AML or wallet-level sanctions screening

**Where:** `/api/ai/screen` uses HuggingFace NER on user-provided TEXT, explicitly labeled "not a substitute for OFAC/EU/UN sanctions list checks" (sanctions-screen.ts:7). No wallet screening exists anywhere.

**Impact:** Every mainnet mint/redeem from a sanctioned jurisdiction is a felony (US IEEPA, EU Council Regulation, UK SAMLA). Every redeem over $3,000 USD triggers FinCEN reporting obligations the protocol cannot meet. OFAC SDN list screening is mandatory for any US-touching financial service.

**Why it blocks mainnet:** This is not a technical issue — it is a legal liability that exposes every operator, developer, and governance council member to personal criminal prosecution.

**Fix:** 40h — integrate TRM Labs or Chainalysis KYT for wallet screening. Block any wallet on OFAC SDN, EU Consolidated, UN Security Council, or HMT lists. Implement a KYC gate for mint/redeem above a threshold (e.g. $1,000). Engage counsel for a Howey test opinion and a MiCA ART opinion. Incorporate a legal entity (foundation in Switzerland or Liechtenstein is common for stablecoins).

---

### 🔴 B11 — `commitWeights` doesn't validate Σw = 1 (chain-link corruption)

**Where:** `commitWeights` (L562) does NOT validate that the submitted weights sum to 1e18. Only `submitTargetWeights` (L480) does.

**Impact:** A buggy keeper can commit weights that sum to 0.79e18 or 1.21e18. The chain-linked index recursion `I_t = I_{t-1} × Σ_i [W_{i,t-1} × (P_{i,t}/P_{i,t-1})]` would then drift systematically. With weights summing to 0.79, the index decays 21% per tick. This is a slow, hard-to-detect corruption.

**Why it blocks mainnet:** The chain-linked index is the core of the protocol. A missing invariant check on its primary input is a critical gap.

**Fix:** 1h — add `require(Math.abs(sum(weights) - 1e18) < 1e14, "weights must sum to 1e18")` to `commitWeights`.

---

### 🔴 B12 — `setOracleAdapter` doesn't enforce 3 distinct adapters

**Where:** `setOracleAdapter` (L910) checks `adapter != address(0)` but does NOT check that the 3 adapters are distinct.

**Impact:** A malicious ORACLE_ROLE holder can set all 3 slots to the same address. The "3-source consensus" collapses to 1-source. Source independence (H8) is not enforced.

**Why it blocks mainnet:** This defeats the entire purpose of I9. A single compromised adapter = total price control.

**Fix:** 1h — add `require(chainlinkAdapter != pythAdapter && chainlinkAdapter != chronicleAdapter && pythAdapter != chronicleAdapter, "adapters must be distinct")` to each `setOracleAdapter` call.

---

## 3. Full Finding Inventory (54 items)

### Smart Contract (18 findings)

| ID | Severity | Finding | Effort |
|---|---|---|---|
| B1 | 🔴 Critical | Governance addresses never initialized — Listing 14 dead | 4h |
| B2 | 🔴 Critical | DEFAULT_ADMIN on deployer EOA (key leaked) | 4h |
| B3 | 🔴 Critical | mint/redeem don't gate on oracle health | 6h |
| B4 | 🔴 Critical | No real oracle adapters (stubs only) | 60-120h |
| B5 | 🔴 Critical | setReserveHolding: no event, no timelock — admin can fake NAV | 8h |
| B6 | 🔴 Critical | On-chain I9 still allows 2-source averaging | 2h |
| B11 | 🔴 Critical | commitWeights doesn't validate Σw=1 | 1h |
| B12 | 🔴 Critical | setOracleAdapter doesn't enforce distinct adapters | 1h |
| H1 | 🟠 High | nonReentrant missing on 28 state-changing functions | 4h |
| H2 | 🟠 High | No timelock on unpause (pause-unpause MEV) | 4h |
| H3 | 🟠 High | 6 admin functions emit no events | 4h |
| H4 | 🟠 High | No circuit breaker on >10% single-tick price moves | 4h |
| H5 | 🟠 High | No slippage parameter on mint/redeem (sandwichable) | 8h |
| H6 | 🟠 High | MINTER_ROLE declared but never used (dead role) | 1h |
| H7 | 🟠 High | Symbol "MTQv3" vs UI "MTQ" — registry mismatch | 1h |
| H8 | 🟠 High | No renounceRole function (compromised key can't self-revoke) | 2h |
| M1 | 🟡 Medium | CEI ordering on mint (transferFrom before state update) | 2h |
| M2 | 🟡 Medium | No per-block mint cap (whale dilution attack) | 4h |

### Tokenomics (10 findings)

| ID | Severity | Finding | Effort |
|---|---|---|---|
| B8 | 🔴 Critical | Redemption policy contradiction (NAV vs P_MTQ) | 4h |
| B9 | 🔴 Critical | Math.max(0,...) silent negative-holdings | 6h |
| T1 | 🟠 High | Safety band [0.50, 2.00] too wide — should be [0.95, 1.05] | 2h |
| T2 | 🟠 High | Single-collateral (USDC) despite 7-currency claim | 80h+ |
| T3 | 🟠 High | No liquidation mechanism (EMERGENCY just pauses) | 40h |
| T4 | 🟠 High | Fees commingled with collateral (not separate feeWallet) | 4h |
| T5 | 🟠 High | RR decays as minting scales (no surplus regrowth mechanism) | 20h |
| T6 | 🟡 Medium | 3 of 7 index components have no admitted token (GBP/JPY/CNY) | 60h+ |
| T7 | 🟡 Medium | No redemption queue (bank-run dynamic) | 16h |
| T8 | 🟡 Medium | No per-address mint cap | 4h |

### Oracle (6 findings)

| ID | Severity | Finding | Effort |
|---|---|---|---|
| B4 | 🔴 Critical | No real adapters | 60-120h |
| B6 | 🔴 Critical | On-chain 2-source averaging | 2h |
| B12 | 🔴 Critical | Adapters not enforced distinct | 1h |
| O1 | 🟠 High | No circuit breaker on price jumps | 4h |
| O2 | 🟡 Medium | Chronicle doesn't support all 6 pairs — verify | 4h |
| O3 | 🟡 Medium | No statistical independence check | 8h |

### Engine (8 findings)

| ID | Severity | Finding | Effort |
|---|---|---|---|
| B7 | 🔴 Critical | Keeper EUR/USD inversion | 1h |
| B8 | 🔴 Critical | Redemption policy contradiction | 4h |
| B9 | 🔴 Critical | Math.max(0,...) silent bug | 6h |
| E1 | 🟠 High | MASE ensemble is placeholder (equal-weight, not adaptive) | 40h |
| E2 | 🟠 High | Eject ladder is random-only (pegHealth = Math.random) | 20h |
| E3 | 🟠 High | poolDepth24h hardcoded at $4M | 8h |
| E4 | 🟡 Medium | Buffer state thresholds misalign with risk machine | 4h |
| E5 | 🟡 Medium | JS Number (IEEE 754) vs contract uint256 1e18 — divergence risk | 20h |

### Testing (7 findings)

| ID | Severity | Finding | Effort |
|---|---|---|---|
| TEST1 | 🔴 Critical | Layer 6 historical backtest never run | 40h |
| TEST2 | 🟠 High | MARP execution path untested (USE_MARP_EXECUTION=false) | 16h |
| TEST3 | 🟠 High | 4/5 Foundry fuzz tests have cached failures | 8h |
| TEST4 | 🟠 High | No property-based tests (fast-check) | 24h |
| TEST5 | 🟠 High | No integration tests against real RPC | 16h |
| TEST6 | 🟡 Medium | ~40% line coverage — 8 major functions untested | 40h |
| TEST7 | 🟡 Medium | No adversarial test for negative holdings | 4h |

### Infrastructure (5 findings)

| ID | Severity | Finding | Effort |
|---|---|---|---|
| B7 | 🔴 Critical | Keeper price inversion | 1h |
| I1 | 🟠 High | No RPC fallback chain (single RPC_URL) | 4h |
| I2 | 🟠 High | Backup has no restore script | 8h |
| I3 | 🟠 High | Dockerfile not pinned by digest | 2h |
| I4 | 🟡 Medium | Compute engine output orphaned (JSON → nowhere) | 4h |

### Operations (4 findings)

| ID | Severity | Finding | Effort |
|---|---|---|---|
| B10 | 🔴 Critical | No KYC/AML/sanctions | 40h+ |
| OP1 | 🟠 High | PAUSER on single EOA, no Safe | 4h |
| OP2 | 🟠 High | No 24/7 paging (Discord only) | 8h |
| OP3 | 🟡 Medium | No named on-call rotation | 4h |

---

## 4. Testing Strategy — What's Needed for Mainnet

### Current state
- 30 Foundry tests (passing)
- 151 TS canonical invariant assertions (passing)
- ~40% line coverage of engine.ts
- 0 property-based tests
- 0 integration tests
- 0 historical backtests
- 0 external audits

### Required for mainnet

#### Tier 1 — Must have before audit (4–6 weeks)

1. **External security audit** (CertiK or OpenZeppelin or Trail of Bits)
   - Scope: MTQSigmaV2.sol + adapters + keeper
   - Cost: $80K–$200K
   - Timeline: 4–8 weeks
   - This is non-negotiable for any institutional user

2. **Foundry fuzz tests** (property-based, on-chain)
   - `testFuzz_Mint_NeverExceedsSafetyBand(uint256 usdcAmount)`
   - `testFuzz_RR_NeverBelowHardFloor(uint256 mintAmount, uint256 redeemAmount)`
   - `testFuzz_OracleStaleness_AlwaysReverts(uint256 staleSeconds)`
   - `testFuzz_Redemption_NeverDrainsSurplus(uint256 redeemAmount, uint256 rr)`
   - Fix the 4 cached fuzz failures first
   - Run with `forge test --fuzz-runs 10000`

3. **Echidna invariant tests** (property-based, stateful)
   - `function echidna_never_exits_safety_band() public returns (bool)`
   - `function echidna_rr_never_below_1() public returns (bool)`
   - `function echidna_total_supply_never_exceeds_nav() public returns (bool)`
   - `function echidna_oracle_always_3_sources() public returns (bool)`

4. **Integration tests** (against a real testnet RPC)
   - Full mint → wait → redeem cycle
   - Keeper advanceIndex → commitWeights → executeRebalance
   - Oracle failure → pause → recovery
   - Emergency pause → unpause

5. **Layer 6 historical backtest** (the one that's never been run)
   - 10 years of FX + gold data (FRED + ECB + LBMA)
   - Replay the MASE engine tick-by-tick
   - Assert: RR never < 1.0, index never leaves [0.95, 1.05], no death spiral
   - This is the single most important validation and it has never run

#### Tier 2 — Must have before mainnet (2–4 weeks)

6. **Adversarial scenario suite**
   - Flash loan attack simulation (on mainnet fork)
   - Oracle manipulation (submit 3 wild prices, verify pause)
   - Bank run (100 sequential redeems, verify EMERGENCY triggers)
   - Keeper compromise (malicious keeper submits bad weights)
   - Governance capture (malicious Safe majority tries to rug)

7. **Mainnet fork simulation**
   - Use `anvil --fork-url <mainnet RPC>` to fork mainnet
   - Deploy the contract, run 10,000 simulated mints/redeems
   - Verify gas costs, state transitions, event emissions

8. **Slither + Mythril + Securify** (static analysis)
   - All 3 tools, triage every finding
   - Fix all High/Critical, document Medium/Low
   - Add to CI as blocking (currently advisory)

#### Tier 3 — Must have before public mainnet (1–2 weeks)

9. **Bug bounty** (Immunefi, 30+ days before public launch)
   - $50K minimum pot (even if self-funded)
   - Scope: smart contracts + keeper
   - Severity-based payouts per Immunefi standard

10. **Shadow fork stress test**
    - Run the full stack on a mainnet shadow fork for 7 days
    - Simulate 10,000 users, $10M TVL
    - Verify keeper, oracle, engine, UI all hold up

11. **Chaos engineering game day**
    - Kill the keeper → verify monitoring catches it → verify manual recovery
    - Corrupt an oracle feed → verify pause triggers → verify Safe can unpause
    - Simulate Turso outage → verify backup restore (once implemented)

### Testing coverage target

| Metric | Current | Target |
|---|---|---|
| engine.ts line coverage | ~40% | ≥85% |
| Contract line coverage | unknown | ≥90% |
| Property-based tests | 0 | ≥20 |
| Integration tests | 0 | ≥15 |
| Historical backtest | never run | 10 years, all scenarios pass |
| External audit | none | 1 top-tier firm, no High/Critical |

---

## 5. Tokenomics Deep Analysis

### What MTQΣ is (honestly)

MTQΣ is **not a stablecoin** in the USDC/DAI sense. It is a **global purchasing power unit (GPPU)** that tracks a 7-component basket (USD/EUR/JPY/GBP/CNY/CHF/Gold) via a chain-linked index. Conceptually it is closer to the IMF SDR than to USD-stablecoins.

This is a **legitimate and interesting design** — but it has implications:

1. **The price will float.** P_MTQ = GFB_Index / base. If gold spikes 50%, P_MTQ rises ~13% (gold is 26% of the basket). Users holding MTQΣ gain purchasing power in gold terms but lose USD-peg value. This is by design, not a bug.

2. **The "safety band" [0.50, 2.00] is far too wide.** A GPPU that can drop to $0.50 or rise to $2.00 is not a usable unit of account. For mainnet, the band should be **[0.95, 1.05]** — if the index moves more than 5% from the base, something is wrong and the protocol should pause.

3. **Single-collateral (USDC) is a contradiction.** The index tracks 7 currencies, but the reserve is 100% USDC. This means:
   - If EUR appreciates 20% vs USD, the index rises ~5.6% (EUR is 28% of basket), but the USDC reserve doesn't change. MTQΣ is now "worth" 5.6% more in purchasing power but backed by the same USDC. RR drops.
   - The reserve mirror (`reserveHeldUsd[EUR]`) is a bookkeeping fiction — there is no actual EURC held.
   - **For mainnet, either (a) hold real multi-currency collateral (EURC, GBP Token, etc.), or (b) drop the multi-currency claim and be a USD-stablecoin with a gold tilt.** Option (a) is the honest path but requires 80h+ of work. Option (b) is simpler but changes the value proposition.

4. **No liquidation mechanism is a critical gap.** When EMERGENCY triggers (RR < 1.0), redemptions pause. There is no auction, no stability pool, no bad-debt market. The protocol is stuck until governance injects capital. Compare:
   - **DAI** — auction liquidation of vaults
   - **LUSD** — stability pool + 110% collateral liquidation
   - **USDe** — no liquidation needed (fully backed by spot + perp)
   - **MTQΣ** — nothing. Just pause and pray.

   **For mainnet, a liquidation mechanism is required.** The simplest option: a stability pool where users deposit USDC, earn a share of liquidation bonuses, and in EMERGENCY the pool covers the deficit. Estimated 40h.

5. **RR decays as minting scales.** At genesis, 1.1M USDC backs 1M MTQ (RR=1.10). At $110M minted, RR ≈ 1.01. At $1B minted, RR ≈ 1.001. There is no mechanism to regrow the surplus. The protocol approaches the hard floor asymptotically.
   - **Fix:** Fee recycling into a dedicated buffer wallet (not commingled with collateral). Currently fees go to `reserveVault` which inflates apparent NAV. Estimated 20h to separate + wire.

### Peer comparison (honest)

| Feature | MTQΣ | DAI | USDC | USDe | FRAX | LUSD |
|---|---|---|---|---|---|---|
| Collateral | USDC only | ETH/WBTC/RWA | Fiat bank | ETH+perp | USDC+algo | ETH |
| Peg target | GFB basket (floats) | $1 (1% band) | $1 (1:1) | $1 (yield) | $1 (algo) | $1 (110% collat) |
| Liquidation | **NONE** | Auction | N/A | N/A | Algorithmic | Stability Pool |
| Oracle | 1 real + 2 synthetic | MakerDAO OSM | N/A | CEX+DEX | Chainlink+Uni | Chainlink |
| Governance | Dead code (single EOA) | MakerDAO | Circle | Ethena DAO | Frax DAO | Immutable |
| Upgradeability | No | Yes | N/A | Yes | Yes | No |
| External audit | None | Top-tier | Top-tier | Top-tier | Top-tier | Top-tier |
| TVL | $0 (testnet) | $5B | $40B | $3B | $600M | $500M |
| Mainnet status | **NO** | Yes | Yes | Yes | Yes | Yes |

**Honest assessment:** MTQΣ is attempting something novel (GPPU, not USD-stable). The concept is sound. The execution is currently 30% of the way to mainnet. The 7–9 month timeline assumes the team fixes the 12 critical blockers, passes an external audit, and runs a gradual rollout.

---

## 6. Regulatory & Compliance Analysis

### Token classification

**Likely a security under the Howey test:**
1. Investment of money: ✅ (users deposit USDC)
2. Common enterprise: ✅ (reserve pool, shared RR)
3. Expectation of profit: ⚠️ (the marketing emphasizes "purchasing power preservation" not profit, but the MASE rebalancing + gold tilt could be read as profit-seeking)
4. Profit from efforts of others: ✅ (the keeper + MASE engine actively manage the reserve)

**Likely an Asset-Referenced Token (ART) under MiCA:**
- References a basket of 7 fiat currencies + gold
- Not e-money (not issued by an authorized institution)
- Likely exceeds the €5M threshold for "significant ART" status

**Implications:**
- US: SEC registration or Reg D exemption required for any US user
- EU: MiCA ART whitepaper + custody license required
- UK: FCA crypto registration required
- Switzerland: FINMA license (foundation structure is favorable)

### Required legal work (before any mainnet)

1. **Legal opinion on token classification** — $20K–$50K from a top crypto firm (Latham & Watkins, Goodwin, Cooley, a16z crypto)
2. **Legal entity formation** — Swiss Foundation (CHF 20K) or Liechtenstein Trust (EUR 15K)
3. **KYC/AML integration** — TRM Labs or Chainalysis KYT ($2K–$10K/month)
4. **MiCAR ART whitepaper** — legal drafting + ESMA submission
5. **Terms of service + privacy policy** — user-facing legal docs
6. **Insurance** — crime + custody policy (Lloyd's syndicates, ~$50K/year for $10M TVL)

### Sanctions screening (critical)

**Current state:** None. The `/api/ai/screen` route does text NER, explicitly "not a substitute for OFAC/EU/UN sanctions list checks."

**Required:**
- Wallet-level screening against OFAC SDN, EU Consolidated, UN Security Council, HMT lists
- Block any mint/redeem from a sanctioned wallet
- Continuous re-screening (wallets can be added to lists retroactively)
- Transaction monitoring (Chainalysis KYT for tainted funds)

**This is non-negotiable for mainnet.** The legal exposure without it is personal criminal liability for every operator.

---

## 7. Recommended Roadmap to Mainnet

### Phase 0 — Stabilize (Weeks 1–4, ~200h engineering)

**Goal:** Fix all 12 critical blockers. Zero new features.

| Week | Tasks |
|---|---|
| 1 | B1 (governance setters), B2 (Safe multi-sig), B6 (on-chain I9), B11 (Σw=1), B12 (distinct adapters), H6-H8 (dead roles, symbol, renounce) |
| 2 | B3 (oracle health gate on mint/redeem), B5 (setReserveHolding timelock + event), B7 (keeper FX inversion), B8 (redemption policy), B9 (Math.max bug) |
| 3 | B4 (real oracle adapters — Chainlink + Pyth + Chronicle), T1 (tighten safety band), T4 (separate feeWallet) |
| 4 | I1 (RPC fallback), I2 (restore script), I3 (Docker pin), I4 (compute engine wiring), OP1 (Safe as PAUSER) |

**Exit criteria:** All 12 critical blockers resolved. CI green. Testnet redeployed with real adapters.

### Phase 1 — Test & Harden (Weeks 5–12, ~400h engineering)

**Goal:** Achieve ≥85% coverage, pass internal fuzz/property tests, run Layer 6 backtest.

| Weeks | Tasks |
|---|---|
| 5–6 | TEST1 (Layer 6 historical backtest, 10 years), TEST4 (property-based tests, 20+), TEST5 (integration tests) |
| 7–8 | TEST2 (MARP execution tests), TEST3 (fix fuzz failures), TEST6 (close coverage gaps), E1-E5 (engine fixes) |
| 9–10 | T3 (liquidation mechanism / stability pool), T5 (fee recycling), T7 (redemption queue), O1-O3 (oracle hardening) |
| 11–12 | Mainnet fork simulation (anvil), adversarial scenario suite, chaos engineering game day |

**Exit criteria:** 85%+ coverage. Layer 6 backtest passes all scenarios. Mainnet fork runs 10,000 cycles without issue. 4 cached fuzz failures resolved.

### Phase 2 — External Audit (Weeks 13–20, ~$100K–$200K)

**Goal:** Pass a top-tier external audit with no High/Critical findings.

| Weeks | Tasks |
|---|---|
| 13–14 | Prepare audit scope, docs, threat model. Select firm (CertiK / OpenZeppelin / Trail of Bits). |
| 15–18 | Audit in progress (4 weeks typical). |
| 19–20 | Triage findings. Fix all High/Critical. Document Medium/Low. Re-audit if needed. |

**Exit criteria:** Audit report with 0 unresolved High/Critical. Public report published.

### Phase 3 — Legal & Compliance (Weeks 13–24, parallel with Phase 2)

**Goal:** Legal entity, legal opinion, KYC/AML, sanctions screening, insurance.

| Weeks | Tasks |
|---|---|
| 13–16 | Engage crypto counsel. Legal opinion on token classification (Howey + MiCA). |
| 17–20 | Incorporate Swiss Foundation or Liechtenstein Trust. Open bank account. |
| 21–22 | Integrate TRM Labs / Chainalysis KYT. Wire to mint/redeem. |
| 23–24 | Buy insurance (crime + custody). Publish ToS + privacy policy. |

**Exit criteria:** Legal opinion in hand. Entity incorporated. KYC/AML live. Insurance active.

### Phase 4 — Gradual Mainnet Rollout (Weeks 25–36)

**Goal:** Capped TVL rollout with live bug bounty.

| Weeks | Tasks | TVL Cap |
|---|---|---|
| 25–26 | Deploy to mainnet. Bug bounty live on Immunefi ($50K pot). | $0 (deposit only by team) |
| 27–28 | Internal pilot (team + advisors only). | $100K |
| 29–30 | Whitelisted beta (invited users). | $1M |
| 31–32 | Public beta (open mint, capped per-address). | $10M |
| 33–34 | Remove per-address cap. | $50M |
| 35–36 | Full public launch. | Unlimited |

**Exit criteria (each phase):** 7 days of stable operation, no incidents, no audit findings triggered, RR stays >1.05, oracle uptime >99.5%.

### Total timeline

| Phase | Duration | Cumulative |
|---|---|---|
| Phase 0 (Stabilize) | 4 weeks | 4 weeks |
| Phase 1 (Test & Harden) | 8 weeks | 12 weeks |
| Phase 2 (External Audit) | 8 weeks (parallel with P3) | 20 weeks |
| Phase 3 (Legal & Compliance) | 12 weeks (parallel with P2) | 24 weeks |
| Phase 4 (Gradual Rollout) | 12 weeks | 36 weeks |

**Total: ~9 months to full public mainnet.** With aggressive parallelization and adequate funding, this could compress to 7 months. Without funding, it stretches to 12+.

### Total cost estimate

| Item | Cost |
|---|---|
| External audit | $100K–$200K |
| Legal opinion + entity | $50K–$80K |
| KYC/AML (annual) | $24K–$120K |
| Insurance (annual) | $50K |
| Bug bounty pot | $50K (minimum) |
| Infrastructure (annual) | $10K–$20K |
| **Year 1 total** | **$284K–$520K** |

**This is the honest cost of a defensible mainnet stablecoin-like launch.** The "zero-cost" constraint applies to testnet. Mainnet requires real capital.

---

## 8. Recommendations — Summary

### Do now (this week)

1. **Do NOT deploy to mainnet.** Set the honest status to `0x000` (0/11 gates) and leave it there.
2. **Rotate the deployer key.** Generate a new key, transfer contract ownership to a Safe, revoke the old key's roles. Delete `upload/private_key.txt`.
3. **Fix B7 (keeper FX inversion) immediately** — it's a 1-hour fix that prevents a catastrophic testnet corruption.
4. **Fix B6 (on-chain I9) and B11 (Σw=1)** — both are 1-2 hour fixes that close critical invariant gaps.

### Do this month (Phase 0)

5. Fix all 12 critical blockers (200h engineering).
6. Engage a crypto law firm for the Howey/MiCA opinion.
7. Start shopping for an external audit firm — book them for Week 13.
8. Set up the Safe multi-sigs on each target chain (4/7 Constitutional, 4/7 Emergency, 2/3 Monetary DAO, 4/7 Risk).

### Do this quarter (Phase 1)

9. Run the Layer 6 historical backtest (10 years of data). This is the single most important validation.
10. Write the 3 real oracle adapters (Chainlink, Pyth, Chronicle).
11. Implement the liquidation mechanism (stability pool).
12. Achieve 85%+ test coverage with property-based + integration tests.

### Do before mainnet (Phases 2–4)

13. Pass the external audit with 0 High/Critical.
14. Incorporate the legal entity + get the legal opinion.
15. Integrate KYC/AML + sanctions screening.
16. Run the bug bounty for 30+ days.
17. Gradual rollout: $100K → $1M → $10M → $50M → unlimited.

---

## 9. The Honest Bottom Line

**MTQΣ has a sound monetary blueprint and a working testnet.** The architecture is thoughtful, the chain-linked index math is correct, the 6-state risk machine is well-designed, and the audit trail (§24) is a genuine transparency feature that most stablecoins lack.

**But the distance between "working testnet" and "defensible mainnet" is large and expensive.** The 12 critical blockers are not cosmetic — they are the kinds of issues that cause mainnet exploits. The governance dead code, the single-key admin, the stub oracles, the missing liquidation, the redemption policy contradiction, and the absent KYC/AML are each individually disqualifying.

**The 7–9 month timeline is honest, not pessimistic.** It assumes a focused team of 3–4 engineers working full-time, adequate funding ($300K–$500K for Year 1), and no major surprises in the external audit. It can be compressed with more resources, but it cannot be honestly compressed below 6 months without cutting corners that will surface as exploits.

**My recommendation to the COO/PM:**

1. **Approve Phase 0 (Stabilize) immediately** — 4 weeks, 200h, zero new features, just fix the 12 critical blockers.
2. **Engage legal counsel this month** — the Howey/MiCA opinion takes 4–6 weeks and gates everything.
3. **Budget $300K–$500K for Year 1** — this is the cost of a defensible mainnet launch. The zero-cost constraint was appropriate for testnet; mainnet requires real capital.
4. **Do not set a mainnet date yet.** Set it after Phase 1 (Week 12) when you have coverage data + Layer 6 backtest results + a real audit engagement.

**The protocol deserves a responsible launch.** The work done so far has earned the right to take the time to do it correctly.

---

*End of report. Full detailed findings with line-number citations are in `/home/z/my-project/worklog.md` under Task IDs `MAINNET-AUDIT-1` and `MAINNET-AUDIT-2`.*