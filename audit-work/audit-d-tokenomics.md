# MTQΣ v1.0 — Tokenomics Deep Review (AUDIT-D) — CFO + Tokenomics Expert View

**Audit ID:** AUDIT-D
**Agent:** general-purpose (acting as CFO + tokenomics expert)
**Sources audited (READ ONLY):**
- `/home/z/my-project/audit-work/blueprint-v1.0.txt` (Master Blueprint v1.0 — 21,227 lines)
- `/home/z/my-project/src/lib/mtq/blueprint.ts` (constants)
- `/home/z/my-project/src/lib/mtq/engine.ts` (reference monetary engine — 1,836 lines)
- `/home/z/my-project/src/lib/mtq/registry.ts` (asset admission registry — 166 lines)
- `/home/z/my-project/contracts/MTQSigmaV2.sol` (v1.0 on-chain contract — 1,057 lines)
- `/home/z/my-project/contracts/MTQSigma.sol` (v1.2 pilot contract — 345 lines, for comparison)

**Audit type:** READ-ONLY. No code modified.
**Date:** 2026-09-08 (per blueprint issue date)

---

## Executive Summary

The MTQΣ v1.0 protocol is a **non-USD, multi-currency + gold, purchasing-power unit** with an asset-backed reserve. Tokenomics is built around four pillars:

1. **Mint-on-deposit supply creation** priced against the adaptive GFB Index (no inflation, no staking, no max cap) — supply grows 1:1 with net USDC deposits (after a 0.10% mint fee) divided by the live `P_MTQ` price.
2. **Anti-fragile fee schedule** — mint fee 0.10% (NORMAL/CAUTION, throttled), redeem fee 0.15% / 0.50% / 2.00% rising with risk state.
3. **Three-tier reserve ratio (RR)** regime: TARGET 1.10, STRESS 1.05, HARD 1.00 — with a 1,000,000 MTQ genesis reserve locked and excluded from circulating supply.
4. **Honest-status-first** governance: no fixed composition, no guaranteed outcomes, no "optimal" percentages; explicit "Candidate for Public Testing — NOT Production-Authorized" declaration.

The architecture is **conceptually excellent** — the constitutional separation between the GFB Index (purchasing-power definition) and the Reserve (liability-matching portfolio), the haircut-based prudential NAV, the 25%-in-30-day stress redemption LCR, and the staged geopolitical eject ladder are all best-in-class design choices that exceed the rigor of DAI, Reserve Protocol and Frax at the specification level.

However, this deep review surfaced **14 findings**, including **3 critical** issues that materially affect the protocol's long-term sustainability claim:

- **C1 (CRITICAL):** The Reserve Ratio naturally decays toward the 1.00 hard floor as minting scales, with no automatic mechanism in the v1.0 contract that re-grows the surplus. At ~$110M minted, RR ≈ 1.01; at ~$1B, RR ≈ 1.002. The protocol depends on (a) fee revenue recycled into the reserve, (b) treasury sweep replenishment, or (c) MASE-driven rebalancing realizing capital gains — none of which are wired into `MTQSigmaV2.sol`.
- **C2 (CRITICAL):** The contract does **not** separate fees into an Operational Wallet (per §20.4); all USDC, including the 0.10% mint fee and the 0.15–2.00% redeem fee, sits in `reserveVault` and counts toward NAV/RR. This **inflates the reported RR** by approximately 10–25 bps of liability and breaks the §20.2 three-pool accounting separation that the blueprint makes a constitutional rule.
- **C3 (CRITICAL):** The contract implements a **5-state** risk machine (NORMAL/CAUTION/DEFENSIVE/EMERGENCY/RECOVERY) and does **NOT pause redemption in EMERGENCY** — it only raises the fee to 2.00%. The blueprint's §21.2 specifies a **6-state** machine (NORMAL/CAUTION/**STRESS**/DEFENSIVE/EMERGENCY/RECOVERY) where the EMERGENCY state **pauses redemptions** (state matrix §21.4: "Redemption → Paused" in S5). The contract also collapses blueprint's STRESS (RR 1.02–1.05, 0.50% fee) and DEFENSIVE (RR 1.00–1.02, 1.00% fee) into a single "DEFENSIVE" state at 0.50%. The user prompt's premise that "§21 says redemption is still allowed (with increased fee)" describes the v1.2 pilot's behavior, **not** the v1.0 blueprint's specification.

Additional non-critical but substantive findings include a CHF base-fixing numerical inconsistency (engine uses `BASE_CHF_USD = 0.88`; blueprint Listing 12 §20.5 uses `BASE_CHF_USD = 1.13e18` — CHF underweighted by ~28% in the genesis denominator), the absence of any vesting/public-sale/distribution plan for the 1,000,000 genesis MTQ (100% deployer-held at genesis — centralization risk), the absence of any governance token or documented signer-selection process for the 7/7 Constitutional Multi-Sig, and the gap that the v1.0 contract's `getHonestStatus()` returns `0x7FF` ("all 11 v1.0 bits set") despite the contract being a TypeScript-only specification artifact not yet deployed to mainnet with real oracle adapters (inconsistent with §25.4 "Production-Ready? NO").

**Final tokenomics score: 68/100** — Strong specification, weak implementation alignment, sustainability gap.

---

## A. Supply Dynamics

### A.1 Genesis supply
Per `engine.ts` line 257–258: `totalSupply: 1_000_000` and `genesisReserve: 1_000_000`. Per `MTQSigmaV2.sol` line 953–958 (`genesisMint`), the deployer calls `genesisMint(1_000_000e18)` once, minting to `genesisReserve` (which defaults to `address(this)` per line 361). Per §20.1.4, these tokens are sent to a 4/7 Gnosis Safe "Genesis Reserve Account" and excluded from circulating supply. **Verified: 1,000,000 MTQ locked in genesisReserve.**

### A.2 Initial circulating supply
At genesis (before any user mint): `circulatingSupply = totalSupply - genesisReserveBalance = 1,000,000 - 1,000,000 = 0`. **Verified: 0.**

### A.3 New supply creation
Per `MTQSigmaV2.sol` §3.4.2/§12.1 (`mint`, line 463) and `engine.ts` line 913 (`computeMint`): `MTQ_minted = (gross × (1 - mintFeeBps/10_000)) / P_MTQ`. There is no inflation, no staking reward, no governance emission — supply grows only on USDC deposit. **Verified: mint-on-deposit only.**

### A.4 Supply destruction
Per `MTQSigmaV2.sol` line 514 (`_burn(msg.sender, mtqAmount)`) and `engine.ts` line 1030 (`s.totalSupply -= inputMtq`): redeem burns MTQ from the caller's balance and decrements `totalSupply`. **Verified: redeem burns MTQ.**

### A.5 Maximum supply cap
There is no `MAX_SUPPLY` constant in either the contract or the engine. Per §2.5 core variable table: `S_t` is "Dynamic" with `S_t = Minted − Burned`. The blueprint does not specify a cap, and the protocol's design (purchasing-power unit, not value-capture token) implies no cap is intended. **Verified: no cap, intentional per blueprint.** This is a reasonable choice for a monetary unit (gold has no max supply either), but it means MTQ's per-token value is entirely derived from the reserve ratio + the GFB index, not from scarcity.

### A.6 USDC collateral ↔ MTQ supply relationship
At mint time, gross USDC is divided by `P_MTQ` to determine MTQ minted: `MTQ = (gross × (1 - 0.001)) / P_MTQ`. At the base date (`P_MTQ = 1.0`), 1 USDC mints ~0.999 MTQ. At `P_MTQ = 1.76` (current engine output), 1 USDC mints ~0.568 MTQ — so each MTQ represents ~$1.76 of basket value. **Verified: NOT a 1:1 USD peg; purchasing-power equivalence is enforced.**

### A.7 Implied market cap at full backing
At full backing (RR = 1.10): `MarketCap ≈ NAV / 1.10 = (circulatingSupply × P_MTQ) × RR`. With current `P_MTQ ≈ 1.76` (per the live snapshot quoted in worklog Task P1-C), and circulating supply growing with adoption, the implied market cap scales linearly with `circulatingSupply`. **Verified.**

### A.8 TotalSupply identity
Per `MTQSigmaV2.sol` line 448: `getCirculatingSupply() = totalSupply - genesisReserveBalance`. Per `engine.ts` line 467: `circulatingSupply(s) = max(0, s.totalSupply - s.genesisReserve)`. **Verified: `totalSupply = circulatingSupply + genesisReserveBalance` (per §3.3 / §18.2).**

---

## B. Fee Model

### B.1 Mint fee
Per `blueprint.ts` line 124: `MINT_FEE_BPS = 10` (0.10%). Per `MTQSigmaV2.sol` line 205: `mintFeeBps = 10`. Per `engine.ts` line 913: `feeUsd = inputUsd * (MINT_FEE_BPS / 10_000)`. Per §19.2 Step 1: `X_net = X × (1 - F_mint)`, `F_mint = 0.001`. **Verified: 0.10% NORMAL, state-throttled (50% in CAUTION, 25% in RECOVERY, paused in DEFENSIVE/EMERGENCY).**

### B.2 Redeem fee
Per `MTQSigmaV2.sol` lines 505–507:
```
feeBps = redeemFeeBps;            // default 15 (0.15%)
if (protocolStatus == DEFENSIVE) feeBps = 50;   // 0.50%
if (protocolStatus == EMERGENCY) feeBps = 200;  // 2.00%
```
Per `engine.ts` line 993–998 (same logic). **Verified for the 5-state machine implemented.** Note: the blueprint's 6-state machine (§21.4) specifies a different schedule — 0.15% (NORMAL/CAUTION) → 0.50% (STRESS) → 1.00% (DEFENSIVE) → paused (EMERGENCY) → 0.30% (RECOVERY). See Finding F-CHF-03 / F-RISK-01 below.

### B.3 Where do fees accrue? — CRITICAL FINDING (F-FEE-01)
Per `MTQSigmaV2.sol` line 473 (mint) and line 516 (redeem):
```solidity
require(usdc.transferFrom(msg.sender, reserveVault, usdcAmount), ...);   // mint
require(usdc.transferFrom(reserveVault, msg.sender, usdcOut), ...);     // redeem
```
**All USDC (gross on mint, gross-minus-fee on redeem) sits in `reserveVault`.** The fee is captured implicitly — the contract receives the full gross but mints MTQ against only the net (mint) or releases only the net (redeem). The fee never moves to a separate Operational Wallet.

This **directly contradicts §20.4** ("All fees — minting, redemption and rebalancing — accrue to the Operational Wallet in USDC") and §20.2 ("Critical rule: assets in the Operational Wallet and Cold Treasury are not counted toward the Reserve Ratio (RR) or collateralization. They are explicitly excluded from all liability calculations").

**Effect:** The contract's reported `getReserveRatio()` includes the fee USDC in the numerator. This means:
- The reported RR is **inflated** relative to the blueprint's intended conservative measure.
- The Operational Wallet (which the blueprint uses to pay gas, oracles, keeper bots, audits) **does not exist** in the v1.0 contract. Operational costs would have to be paid out of `reserveVault` — which then reduces reserve coverage.
- The treasury sweep mechanism (§20.3, $10,000 threshold, sweep excess to Cold Treasury) is **not implemented** in `MTQSigmaV2.sol`.

### B.4 Fee usage
Per blueprint §20.4.1: fees flow to Operational Wallet → SWEEP_THRESHOLD ($10,000) → Cold Treasury (4/7 Multi-Sig). The Cold Treasury may be used for emergency reserve replenishment when RR < 1.05 (Stress Mode), via 4/7 Multi-Sig approval. None of (a) reserve replenishment, (b) operational surplus, (c) explicit burn is wired into the contract. **Not verified — gap.**

### B.5 Projected annual fee revenue at $1B mints + $1B redeems (NORMAL)
- Mint fees: $1,000,000,000 × 0.10% = **$1,000,000**
- Redeem fees: $1,000,000,000 × 0.15% = **$1,500,000**
- Total: **$2,500,000 annual fee revenue at NORMAL state**

This is comparable to mid-tier stablecoin protocol revenues. For context:
- DAI stability fee historically 0.5–4% (variable, but on collateral types, not mint/redeem flow).
- USDC / USDT: $0 on primary mint/redeem (Circle/Tether monetize via reserve interest, not flow fees).
- LUSD: 0.5% mint/redeem fee (similar to MTQ's blend).

MTQ's 0.10/0.15% blend is **competitive and reasonable** — slightly above USDC/USDT (free), slightly below LUSD, and far below emergency stablecoin redeem fees during crises (e.g., UST's death spiral had no state-throttled fee, which is precisely the gap MTQ fills).

### B.6 Anti-fragility
Per `MTQSigmaV2.sol` lines 505–507 and the §21.4 state matrix: redeem fees **rise monotonically with stress** (0.15% → 0.50% → 2.00%). This is the **classical anti-fragile pattern** (à la Taleb): stress increases the cost of exit, which (i) discourages exit, (ii) compensates remaining holders, (iii) slows the redemption wave that would otherwise force fire-sales. This is sound design.

**However**, see F-EMERG-01: the blueprint's EMERGENCY state *pauses* redemptions (not just raises the fee). The contract only raises the fee to 2.00%, which may be insufficient to stop a true run. A 2% fee on $1 of redeemable value is $0.02 — small relative to the loss a user fears from a 10% NAV haircut. The economic disincentive is weak in true EMERGENCY.

### B.7 Competitor comparison
| Protocol | Mint Fee | Redeem Fee | Stress Throttle | Notes |
|---|---|---|---|---|
| **MTQΣ v1.0** | 0.10% | 0.15% / 0.50% / 2.00% | Yes (5-state) | Priced against GFB index, not USD |
| USDC | $0 | $0 | No | Circle monetizes reserve interest |
| USDT | $0 (primary) | $0 (primary) | No | Tether monetizes reserve interest |
| DAI | 0% (mint) | 0% (redeem) | No | 0.5–8% stability fee on collateral types (varies) |
| LUSD | 0.50% | 0.50% | No | Fixed; no state-throttling |
| FRAX | 0.05–0.20% | 0.05–0.20% | Partial | Algorithmic; AMO-based |

**MTQ at 0.10/0.15% is reasonable.** The state-throttled escalation is the differentiator — none of DAI/LUSD/FRAX have a built-in 5-state fee escalator that auto-engages on RR deterioration.

---

## C. Genesis Distribution

### C.1 Genesis MTQ allocation
Per §20.1.4 and `engine.ts` line 257: 1,000,000 MTQ minted to `genesisReserve`, locked, excluded from circulating supply. **Verified.**

### C.2 Genesis USDC collateral
Per §20.1.2: 1,100,000 USDC deposited at deployment → RR = 1,100,000 / (1,000,000 × 1.0000) = 1.10 (exactly at TARGET). **Verified.**

### C.3 GenesisReserve ownership
- **v1.2 pilot (`MTQSigma.sol` line 104):** `genesisReserve = address(this)` (contract self-holds).
- **v1.0 (`MTQSigmaV2.sol` line 361):** `genesisReserve = address(this)` (same default), but mutable via `setGenesisReserve(address)` (line 961, ADMIN_ROLE only).
- **Blueprint §20.1.4:** "These tokens are sent to the Genesis Reserve Account — a dedicated 4/7 Gnosis Safe with the same signers as the Emergency Council."

**Finding F-GEN-01 (MEDIUM):** The contract defaults to contract-self-holding the genesis reserve, with no enforcement of a 4/7 Multi-Sig. Until `setGenesisReserve()` is called by the ADMIN_ROLE holder to a real 4/7 multisig, **the deployer unilaterally controls the genesis reserve.** This is a deployment-time gap that should be closed in the deployment script (require `genesisReserve` to be set to a verified multisig address before any user mint is allowed).

### C.4 Vesting schedule
Per §20.1.4: "The genesis supply is non-circulating... excluded from circulating supply." There is **no vesting schedule** specified. The 1,000,000 MTQ is locked indefinitely (no `unlock()` function in either contract).

### C.5 Centralization risk
**Finding F-GEN-02 (MEDIUM):** At genesis, **100% of the initial supply (1,000,000 MTQ) is held by the deployer / genesisReserve.** Until the first user mint creates circulating supply, the deployer holds the entire non-circulating supply. This is the standard pattern for an asset-backed stablecoin (the genesis supply is the protocol's own "capital" not a market distribution), but it concentrates protocol power in the deployer multisig. Mitigated by:
- Genesis MTQ is non-circulating (cannot be sold).
- The 7/7 Constitutional Multi-Sig controls `genesisReserve` rotation.
- The 4/7 Emergency Council can use it only for emergency reserve replenishment (§20.4.1).

Still, the deployer must publicly commit to the multisig structure and signer selection (see F-GOV-01).

### C.6 Public sale / airdrop / liquidity bootstrap
**Finding F-GEN-03 (MEDIUM):** The blueprint contains **no public sale, no airdrop, no liquidity-mining program, no LBP/IDO plan.** The only path to circulating supply is user-initiated minting against USDC. This is **philosophically consistent** with MTQ being a monetary unit (not a speculative token), but it creates a **cold-start problem**: there is no incentive for early liquidity providers, no DEX seed liquidity, and no market maker program. The pilot deployment on Monad/Arc/Solana devnet (per worklog Task 1) does not address mainnet liquidity bootstrapping.

**Recommendation:** Document a genesis distribution plan that aligns with the monetary-unit identity. Suggested split of the 1,000,000 genesis MTQ:
- 50% (500,000) → DAO Treasury (4/7 multisig, 4-year vesting via stream)
- 30% (300,000) → Liquidity provision (USDC/MTQ Uniswap v3 0.05% pool, lock 2 years)
- 20% (200,000) → Team & advisors (4-year vesting, 1-year cliff)

This preserves the non-circulating property at genesis (all 1M locked) but pre-commits the distribution path.

### C.7 Recommendation
See F-GEN-03 recommendation above.

---

## D. Reserve Ratio (RR) and Liquidity Coverage Ratio (LCR)

### D.1 RR formula
Per §14.2 / `engine.ts` line 475 / `MTQSigmaV2.sol` line 888:
```
RR_t = V_net,t / L_t
where L_t = circulatingSupply × P_MTQ
and V_net,t = Σ_j Q_j × P_j × (1 - H_j)   (haircut-adjusted)
```
**Verified.**

### D.2 Three floors
Per `blueprint.ts` lines 99–101:
```
RR_TARGET = 1.10  // 110% — target reserve ratio
RR_STRESS = 1.05  // 105% — stress floor
RR_HARD   = 1.00  // 100% — hard solvency floor (I2)
```
**Verified.** Note: the blueprint's 6-state machine also has a 1.02 tier (between STRESS and DEFENSIVE) — see F-RISK-01.

### D.3 RR at genesis
At genesis: `circulatingSupply = 0`, `liability = 0 × P_MTQ = 0`, `RR = V_net / 0 = Infinity`. Per `engine.ts` line 476: `if (liability <= 0) return Infinity`. Per `MTQSigmaV2.sol` line 891: `if (liab == 0) return type(uint256).max`. **Verified.** This is correct — with zero circulating supply, there is no liability to back, so RR is undefined / infinite.

### D.4 RR after first mint (the decay math) — CRITICAL FINDING (F-RR-01)
Assume:
- Genesis: V_0 = 1,100,000 USDC (after swap into basket, ignoring haircuts), L_0 = 0, RR_0 = ∞.
- User mints X USDC. Mint fee 0.10%. At base date, P_MTQ = 1.0.

**Under the blueprint's intended design** (fees → Operational Wallet, **excluded** from reserve NAV):
- ΔV = X × (1 - 0.001) = 0.999·X (only net adds to reserve)
- ΔL = 0.999·X (liability = circulating × P = (0.999X/P) × P = 0.999X)
- RR(X) = (1,100,000 + 0.999X) / (0.999X) = 1 + 1,100,000/(0.999X)

| X (USDC minted) | V | L | RR |
|---|---|---|---|
| 1,000,000 | 2,099,000 | 999,000 | **2.1011** |
| 5,000,000 | 6,095,000 | 4,995,000 | **1.2202** |
| 10,000,000 | 11,090,000 | 9,990,000 | **1.1101** |
| 11,000,000 | 12,089,000 | 10,989,000 | **1.1001** ← back at TARGET |
| 25,000,000 | 26,075,000 | 24,975,000 | **1.0440** ← STRESS |
| 50,000,000 | 51,050,000 | 49,950,000 | **1.0220** |
| 100,000,000 | 101,000,000 | 99,900,000 | **1.0110** |
| 110,000,000 | 110,990,000 | 109,890,000 | **1.0100** |
| 500,000,000 | 500,600,000 | 499,500,000 | **1.0022** |
| 1,000,000,000 | 1,000,100,000 | 999,000,000 | **1.0011** ← approaching HARD |

**Under the contract's actual design** (fees stay in `reserveVault`, **included** in NAV):
- ΔV = X (full gross adds to NAV)
- ΔL = 0.999X
- RR(X) = (1,100,000 + X) / (0.999X)

| X (USDC minted) | V | L | RR |
|---|---|---|---|
| 1,000,000 | 2,100,000 | 999,000 | 2.1021 |
| 11,000,000 | 12,100,000 | 10,989,000 | 1.1011 |
| 25,000,000 | 26,100,000 | 24,975,000 | 1.0450 |
| 100,000,000 | 101,100,000 | 99,900,000 | 1.0120 |
| 500,000,000 | 501,100,000 | 499,500,000 | 1.0032 |
| 1,000,000,000 | 1,001,100,000 | 999,000,000 | 1.0021 |

**Interpretation:**

1. **The RR decays asymptotically toward 1.00 (blueprint design) or 1.001 (contract design) as minting scales.** The 1,100,000 USDC genesis buffer is amortized over an ever-growing liability base.
2. **At ~$11M minted, RR returns to TARGET 1.10** — this is the "re-equilibrium" point where the genesis buffer exactly backstops the liability at the target ratio.
3. **At ~$25M minted, RR drops to STRESS 1.05** — the protocol enters CAUTION/STRESS state, mint throttles to 50%, redeem fee rises.
4. **At ~$110M minted, RR drops to ~1.01** — protocol is in DEFENSIVE, mint paused.
5. **At ~$1B minted, RR drops to ~1.002** — protocol hovers just above the HARD floor.

**This is the fundamental tokenomics sustainability issue.** Without active mechanisms that **grow V faster than L**, the protocol will inevitably slide toward the hard floor as adoption scales. The blueprint identifies three such mechanisms:

a. **Fee revenue recycled into reserve** (§20.4) — but the contract does not implement this. Fees stay in `reserveVault`, so they DO contribute to NAV (good), but they're not separated, swept, or governed.

b. **Treasury sweep replenishment** (§20.4.1) — Cold Treasury surplus transferred to Reserve Vault when RR < 1.05. The contract has no `sweep()` function and no Cold Treasury address.

c. **MASE-driven rebalancing realizing capital gains** (§10/§11) — if the reserve's gold allocation appreciates vs the liability currency mix, NAV rises faster than liability. But gold appreciation also raises `P_MTQ` (gold is in the index), which raises the liability proportionally. **The net effect is roughly neutral** — gold appreciation does not structurally improve RR. This is a critical subtlety: because gold is BOTH in the index AND in the reserve, gold price moves affect both sides of the ratio symmetrically.

**Sustainability verdict:** The protocol is **sustainable only if** (a) the 0.10/0.15% fees compound into the reserve at scale (which they do in the contract, but not in the blueprint's intended accounting), AND (b) the treasury sweep + replenishment cycle is implemented, AND (c) adoption does not out-pace the fee-accumulation rate. At $1B minted, fees generate ~$2.5M/year, which adds ~25 bps/year to V — this barely offsets the natural decay from continued minting.

**Recommendation:** Implement an explicit **reserve-replenishment auto-cycle** in `MTQSigmaV2.sol`:
1. Add `sweepFeesToOperationalWallet()` that transfers accumulated fees from `reserveVault` to a separate `operationalWallet` (per §20.4), and a separate `coldTreasury` (4/7 multisig) per §20.3.
2. Add `replenishReserveFromTreasury(amount)` (4/7 multisig, RR < 1.05 precondition) per §20.4.1.
3. Document a **target adoption curve**: at $100M minted, the protocol should have grown V by at least 1% through fees/treasury to maintain RR ≥ 1.02. At $1B minted, V must grow by ~10% (capital raise or accumulated fees) to maintain RR ≥ 1.10.
4. Consider a **dynamic mint fee** that rises with inverse RR: `F_mint = max(0.10%, (1.10/RR_t - 1) × 5%)`. At RR=1.10, F=0.10%; at RR=1.05, F=0.34%; at RR=1.02, F=0.49%. This creates an automatic rebalancing pressure: as RR drops, the mint fee rises, discouraging new minting when it would most harm the ratio.

### D.5 LCR formula
Per §13.4 / `engine.ts` line 480 / `MTQSigmaV2.sol` (LCR not implemented in V2 contract):
```
LCR_t = LiquidAssets_t / StressRedemptionDemand_t
where:
  LiquidAssets_t = Σ_stablecoins Q × P × (1 - H)  (gold = 0% liquid)
  StressRedemptionDemand_t = circulatingSupply × P_MTQ × 0.25  (25% in 30 days)
```
**Verified in engine.** The v1.0 contract `MTQSigmaV2.sol` does **NOT** implement `getLCR()` despite listing it as part of the Honest Status `0x7FF` mask. **Finding F-LCR-01 (MEDIUM): the contract claims `multiSourceOracle` (bit 8), `daoGovernance` (bit 9), `honestStatusExposed` (bit 10), but does not implement `getLCR()` — a clear §13.4 specification requirement.**

### D.6 LCR at genesis
At genesis: `stressDemand = 0 × P × 0.25 = 0`, so `LCR = liquidAssets / 0 = Infinity`. Per `engine.ts` line 484: `if (stressDemand <= 0) return Infinity`. **Verified.**

### D.7 LCR under 10% redemption surge
Per §13.4.2, the LCR uses a **25% in 30 days** stress redemption demand. A 10% redemption surge (vs the 25% stress) is **below the stress threshold**, so LCR is not the binding constraint. However, a one-shot 10% redemption in a single day would:
- Burn 10% of circulating supply → reduce L by 10%.
- Release 10% of reserve (proportional) → reduce V by 10% (approximately, before haircuts on the released basket).
- Net effect: if RR was 1.10 before, after 10% redemption: V' = 0.9·V, L' = 0.9·L, so RR' = 0.9V/0.9L = V/L = 1.10 (unchanged, in theory).
- **In practice:** the released basket includes gold (0% liquid for LCR), so the liquid-asset share of the reserve rises post-redemption → LCR **improves** after a redemption (because the protocol hands out pro-rata gold, reducing its own gold weight).

**Verified: redemptions improve LCR.** This is the self-correcting property of the pro-rata release design.

---

## E. Survivorship Analysis

### E.1 All circulating supply redeemed
If 100% of circulating supply is redeemed:
- All circulating MTQ burned → `totalSupply` returns to `genesisReserveBalance = 1,000,000`.
- All reserve assets released pro-rata → reserve vault returns to genesis state plus accumulated fee USDC.
- The protocol is back to genesis: 1M MTQ locked, ~1,100,000 USDC-equivalent + accumulated fees in vault, RR = ∞ (no liability).
- The protocol **survives** the total-redemption scenario and is left with a positive net asset value.

### E.2 Gold price drops 50% overnight
Per the strategic prior, gold weight = 26% of the index. If gold drops 50%:
- `P_MTQ` drops by 26% × 50% = **13%** (because gold is in the GFB index).
- NAV drops by gold's reserve weight × 50%. If reserve gold weight is ~26% (matching index) → NAV drops by 13%.
- **Both numerator and denominator drop by ~13%, so RR is roughly preserved.**

But there's an asymmetry: gold has a 1% haircut (PAXG/XAUT), so:
- V_net drops by ~13% × (1 - 0.01) ≈ 12.87%
- L drops by ~13%
- RR drops by ~(0.13 × 0.01) / (1 - 0.13) ≈ **0.15%** — small degradation.

If RR was 1.10 → after a 50% gold crash, RR ≈ 1.0985. **The protocol stays in NORMAL state.** This is the beauty of including gold in the index — gold crashes don't break RR because they crash the liability symmetrically.

### E.3 USDC depegs (USDC → $0.90)
USDC weight in the strategic prior = 27%. If USDC depegs to $0.90:
- USDC contributes to NAV at $0.90 × (1 - 0.005 haircut) = $0.8955 per USDC (vs $0.995 before).
- V_net drops by (USDC share) × (1 - 0.8955/0.995) = 27% × 9.95% = 2.69%.
- USDC is **NOT** in the GFB index (USD weight in GFB uses base fixing = 1.0, unchanged). So P_MTQ is unchanged → L unchanged.
- RR drops by 2.69%: from 1.10 to ~1.070 → **protocol enters CAUTION** (RR < 1.10 but ≥ 1.05).

The §21.5 Geopolitical Eject ladder engages: USDC depeg > 12h → Stage 1 (sell 10% of USDC holdings). The protocol begins rebalancing out of USDC into other stablecoins + gold.

### E.4 Death spiral scenario
The classical stablecoin death spiral requires: (i) sustained redemptions, (ii) reserve asset crash, (iii) oracle failure. For MTQ:
1. **Sustained redemptions** → pro-rata release of basket → reduces V and L proportionally → RR roughly preserved (per E.2 above).
2. **Gold crash** → P_MTQ drops, L drops, V drops proportionally → RR preserved.
3. **USDC depeg** → V drops, L unchanged → RR drops to ~1.07, protocol enters CAUTION, mint throttled, redeem fee rises.
4. **Oracle failure** (multi-source consensus fails, <2 feeds valid) → `commitFxRatesFromOracles()` reverts (`paused_ = true`), `getMTQPrice()` falls back to last-known-good. The §18.4 sanity band 0.50–2.00 triggers `PAUSE_MINT`. Redemption stays open at last-known-good price.

**The combination that breaks MTQ:** USDC depeg + gold crash + oracle failure simultaneously. Then:
- USDC depeg → V drops 2.7%
- Gold crash → P_MTQ drops 13%, V drops 13% (symmetric)
- Oracle failure → price freezes at last-known-good (no further adjustment)
- Users rush to redeem at frozen price → reserve releases real, devalued assets at the frozen price → protocol realizes losses → RR drops further
- Eventually RR < 1.00 → HARD FLOOR BREACH → protocol enters EMERGENCY

In the contract's 5-state machine, EMERGENCY raises the redeem fee to 2% but does NOT pause redemptions. **The protocol continues to bleed until the reserve is depleted below the liability.** This is the death spiral scenario.

In the blueprint's 6-state machine, EMERGENCY **pauses redemptions** — breaking the spiral at the cost of user exit. **This is the single most important difference between the blueprint's intended design and the contract's actual implementation.**

### E.5 Circuit breaker that pauses all redemptions?
**Finding F-EMERG-01 (CRITICAL):**
- `MTQSigmaV2.sol` line 498: `function redeem(uint256 mtqAmount) external whenNotPaused returns (uint256 usdcOut)`. The only `whenNotPaused` guard on redeem.
- Line 466: `mint` has `require(protocolStatus != DEFENSIVE && protocolStatus != EMERGENCY, "MTQV2: mint paused by risk state")` — **mint is paused in DEFENSIVE/EMERGENCY**.
- Line 505–507: redeem fee scales with status but **redeem is NOT paused in any state** (only `whenNotPaused` global pause applies).

**Per blueprint §21.2 + §21.4 state matrix:**
- S5 EMERGENCY (RR < 1.00 OR LCR < 0.70): "Redemption → **Paused**", "Rebalancing → Paused", "Minting → Paused". Only the council-directed `forceRebalance` (Level 5 of §10.3) can move reserve assets.

**The contract does not implement this pause.** The contract's EMERGENCY state only raises the redeem fee to 2% — it does not stop the bleed. The blueprint's EMERGENCY explicitly stops redemptions to prevent the death spiral.

### E.6 Philosophical choice: pause redeem in EMERGENCY?
The user prompt asks: "should the protocol pause REDEEM in EMERGENCY? §21 says redemption is 'still allowed (with increased fee)'". **This premise is INCORRECT** — it describes the v1.2 pilot's behavior, not the v1.0 blueprint.

The v1.0 blueprint explicitly chooses: **pause redemption in EMERGENCY** (§21.4 matrix S5 row). The rationale (§21.1, §13.6, I12): "solvency without liquidity is a solvency that cannot be delivered on time" and "no reserve asset may be used for secondary-market price support". Allowing redemptions at a stale/frozen price during EMERGENCY would force the protocol to liquidate real, devalued assets against an inflated last-known-good price — which is precisely the "market-price support" prohibited by I12.

The blueprint's choice is **philosophically correct and internally consistent**: protect the reserve by pausing exit when RR < 1.00, accept the user-trust cost of "I cannot exit right now", and resume only after the 48-hour RECOVERY_CONFIRMATION_PERIOD sustained above 1.00 (§21.3). The contract's choice (only raise the fee to 2%) is **inconsistent with the blueprint** and exposes the protocol to the death spiral in E.4.

**Recommendation:** Implement redemption pause in EMERGENCY in `MTQSigmaV2.sol`:
```solidity
function redeem(uint256 mtqAmount) external whenNotPaused returns (uint256 usdcOut) {
    require(mtqAmount > 0, "MTQV2: zero amount");
    require(balanceOf[msg.sender] >= mtqAmount, "MTQV2: insufficient balance");
    require(protocolStatus != Status.EMERGENCY, "MTQV2: redemption paused in EMERGENCY");  // NEW
    ...
}
```
And add the missing STRESS state (RR 1.02–1.05) to the 5-state enum → 6-state machine per §21.2.

---

## F. Governance Tokenomics

### F.1 Is MTQ a governance token?
**No.** Per §2.5 core variables: MTQ is the unit of account (PAR = 1.00 basket-unit). Per §18.1: "PAR is not a peg and not a price promise — the reference price moves with the index". Holding MTQ confers no voting rights in either contract (no `vote()` function, no `proposal()` function, no `delegate()` function). The token is purely a monetary unit, like holding a stablecoin.

### F.2 Voting rights
**No.** Neither `MTQSigma.sol` nor `MTQSigmaV2.sol` has any governance-voting function on MTQ holdings. The `onlyAdmin` / `onlyKeeper` / `onlyPauser` / `onlyOracle` / `onlyRole` modifiers check role assignments, not MTQ balances.

### F.3 Separate governance token?
**Finding F-GOV-01 (MEDIUM):** The blueprint specifies a 4-layer governance hierarchy (§22.3, also `blueprint.ts` line 174):
```
Constitutional (methodology, envelopes)   → 7/7 Multi-Sig, 90-day timelock
Monetary (fees, RR target)                → DAO Vote (51%), 48h timelock
Risk (haircuts, thresholds)              → Risk Council (4/7), 24h timelock
Emergency (pause/eject)                   → 4/7 Multi-Sig, instant
```
But there is **no specification** for:
- A separate governance token (e.g., MTQGOV) that would carry the DAO Vote weight.
- A DAO vote contract / governor module.
- Snapshot / Tally integration.
- Vote delegation / quorum / voting period.
- A Constitution document hash and its amendment process.

The contract has `queueChange` / `executeChange` (lines 901–922) implementing a 48h timelock for `PARAM_MINT_FEE_BPS`, `PARAM_REDEEM_FEE_BPS`, `PARAM_RESERVE_RATIO_TARGET` — this is the Monetary-tier timelock. But the actual DAO vote that authorizes the queue is not implemented. `queueChange` is `onlyAdmin` — meaning the deployer multisig (DEFAULT_ADMIN_ROLE holder) can queue any parameter change with 48h notice, unilaterally. **This collapses the 4-layer hierarchy into a single-admin model in the contract.**

### F.4 Multi-Sig signer selection
**Finding F-GOV-02 (MEDIUM):** The blueprint does not document:
- How the 7 Constitutional Multi-Sig signers are selected (election? appointment? self-selection by deployer?).
- Geographic distribution requirements (§20.3.3 mentions "geographically distributed" for the Cold Treasury but not for the Constitutional Multi-Sig).
- Hardware wallet enforcement (only mentioned for Cold Treasury signers, not for the 7/7 Constitutional signers).
- Signer rotation cadence and process.
- Removal process for compromised/malicious signers.

### F.5 DAO constitution
**Finding F-GOV-03 (MEDIUM):** No documented DAO constitution, charter, or articles of association. The "DAO Vote (51%)" tier in the governance hierarchy has no operational definition:
- 51% of what? Token-weighted (which token?), 1-member-1-vote, quadratic?
- What is the proposal threshold (e.g., 1% of supply to propose)?
- What is the quorum (e.g., 10% of supply to vote)?
- What is the voting period?
- What is the execution path after the vote passes (queue the parameter change for the 48h timelock)?

### F.6 Recommendation
Either:
- **Option A (Recommended for a monetary unit):** Document a "no governance token" decision in a Constitution document. The DAO is constituted by the 7/7 signers themselves acting as a "Constitutional Convention" — they vote on monetary-tier changes internally, with the 48h timelock exposing the queue to public scrutiny and a veto window. This avoids the regulatory complexity of issuing a governance token while preserving the 4-layer separation.
- **Option B (Token-based DAO):** Issue a separate `MTQGOV` token (fixed supply 100M, airdropped 1:1 to genesis MTQ holders, non-transferable for 1 year) for the Monetary tier. Snapshot off-chain voting + on-chain timelock execution. Document the tokenomics of MTQGOV separately.

Either way, the contract must be updated to:
1. Make `queueChange` callable by a DAO vote contract / multisig, not just `onlyAdmin`.
2. Add an `emit ParameterChangeProposed` event with the proposing signer/vote identifier.
3. Add a `constitutionHash` immutable constant pointing to the IPFS hash of the Constitution document.

---

## G. Honest Status (§25)

### G.1 Production-Ready declaration
Per `blueprint.ts` line 200 (`HONEST_STATUS`): `"Production Authorization": "NO — validation program (Chapter 23) is a precondition"`. Per §25.4: `"Production-Ready? NO — CANDIDATE FOR PUBLIC TESTING (Testnet)"`. **Verified that the blueprint is honest.**

### G.2 Contract's getHonestStatus()
**Finding F-HONEST-01 (MEDIUM):**
- `MTQSigma.sol` line 293: `implementedMask = 0x400` (only bit 10 set — honestStatusExposed). `contractVersion = 0` (v1.2 pilot). Correct and honest.
- `MTQSigmaV2.sol` line 1036: `implementedMask = 0x7FF` (all 11 v1.0 bits set). `contractVersion = 1`.

The V2 contract declares ALL 11 v1.0 capability bits set, but:
- The contract is **NOT deployed** (worklog says "NOT YET DEPLOYED — source ready, pending deployment by the protocol owner", per `MTQSigmaV2.sol` line 29).
- The contract **does not implement** `getLCR()` (§13.4) despite bit 8 implying oracle-anchored LCR.
- The contract does **NOT** have a real DAO vote contract wired (`daoGovernance` bit 9), only `onlyAdmin` access control.
- The contract does **NOT** have a real asset registry contract wired (the `setAssetRegistry` exists but no registry contract deployed; bit 7 set).
- The contract does **NOT** have real Chainlink/Pyth/Chronicle adapters wired (bit 8 set but adapters are `address(0)` until `setOracleAdapter` called).

**Recommendation:** The `getHonestStatus()` should return a **dynamic mask** computed from actually-wired adapter/registry addresses, not a hardcoded `0x7FF`. Suggested:
```solidity
uint256 mask = 0x400; // bit 10 always set (this function exists)
if (fxXAU_USD != BASE_XAU_USD) mask |= 0x001 | 0x002; // 7-component + gold in index (heuristic)
if (fxCHF_USD != BASE_CHF_USD) mask |= 0x004;        // CHF in index
mask |= 0x008;  // chain-linked denominator (always true, computed in constructor)
if (weights.lastUpdatedAt > 0) mask |= 0x010 | 0x020; // MASE + admissibility
if (address(chainlinkAdapter) != address(0) || address(pythAdapter) != address(0) || address(chronicleAdapter) != address(0)) mask |= 0x100;
if (address(assetRegistry) != address(0)) mask |= 0x080;
// ... etc.
return (mask, 1, 1, "v1.0 Master Blueprint on-chain. Honest status reflects actually-wired adapters + registry + governance.");
```
This makes the honest-status function actually honest — currently it overstates capabilities.

### G.3 Supported claims (§25.2)
Per `blueprint.ts` lines 193–201 (HONEST_STATUS table) and the §25.2 list: the blueprint correctly claims only what is mathematically demonstrable. **Verified.** The public website / docs (per worklog) should align exactly with this list — no "100% Halal", no "σ_NAV = 4.34%", no "Crisis-Proof", no "1 MTQ = 1 Big Mac", no "Optimal", no "fixed composition", no "guaranteed outcomes", no "final optimal percentages".

### G.4 Unsupported claims (§25.3)
Per `blueprint.ts` lines 204–213 (UNSUPPORTED_CLAIMS) and §25.3 list: 11 forbidden claims. **Verified** that the blueprint explicitly disavows:
- "100% Halal / Fatwa-ready" (no fatwa yet)
- "σ_NAV = 4.34%" (preliminary, undisclosed methodology)
- "94/100 Utility Score" (no defined utility function)
- "4x rebalances / year" (design target, not demonstrated)
- "Optimal" (no formal optimization validation)
- "Crisis-Proof" (resilience ≠ guarantee)
- "1 MTQ = 1 Big Mac" (Big Mac is metaphor)
- "World's first" (marketing)
- "MTQΣ holds 27% USD, 26% gold, …" (those are strategic priors, not live weights)
- "Guaranteed purchasing power / returns"
- "Current percentages are the final optimal weights"

**Verified the protocol does NOT claim any of these.** The frontend (per worklog Task 8) explicitly carries the `REMOVED_CLAIMS` table with strike-through styling. **Honest.**

---

## H. Comparison to Similar Protocols

### H.1 Comparison matrix

| Dimension | MTQΣ v1.0 | DAI | Reserve Protocol (RSR/RTokens) | Frax |
|---|---|---|---|---|
| **Peg target** | Adaptive GFB index (USD/EUR/JPY/GBP/CNY/CHF/Gold) | $1.00 USD | $1.00 USD per RToken | $1.00 USD |
| **Collateral** | Multi-asset adaptive basket (USDC/USDP/USDT/EURC/PAXG/XAUT) | Multi-asset (ETH/wstBTC/USDC/RWA) | Multi-asset (any ERC-20 basket) | Multi-asset (FXS/USDC/curve LP) |
| **Mint flow** | USDC → MTQ at `P_MTQ` (mint-on-deposit, fee 0.10%) | Open vault, deposit collateral, generate DAI | Deposit basket collateral, mint RToken 1:1 | Mint FRAX with collateral + FXS burn |
| **Redeem flow** | Burn MTQ → pro-rata basket release (fee 0.15% / 0.50% / 2.00%) | Pay back DAI debt + stability fee, free collateral | Burn RToken → return basket | Burn FRAX → return collateral + FXS mint |
| **Reserve ratio** | TARGET 1.10, STRESS 1.05, HARD 1.00 (haircut-adjusted) | Variable (collateral ratio 1.0+; no explicit target above 1.0) | 1:1 + RSR overcollateralization (first-loss) | Algorithmic + collateral mix (variable) |
| **Risk state machine** | 6-state (NORMAL/CAUTION/STRESS/DEFENSIVE/EMERGENCY/RECOVERY) | None (governance-set parameters) | None (RSR backstop auto-depletes on shortfall) | Partial (algorithmic adjustments) |
| **Adaptive weights** | MASE ensemble (6 candidate models, smoothed) | None (fixed collateral types) | None (basket is fixed per RToken) | None (FXS algorithmic) |
| **Gold exposure** | First-class index component (20–32% envelope) + reserve instrument | None | Possible (if basket includes PAXG) | None |
| **Oracle** | Multi-source (Chainlink/Pyth/Chronicle, median/avg consensus, ≤60s staleness, <1% confidence, <2.5% deviation) | Median of custom oracles | Chainlink + custom | Chainlink + Uniswap TWAP |
| **Governance** | 4-layer hierarchy (7/7 Constitutional / 51% DAO / 4/7 Risk Council / 4/7 Emergency) | MKR token holders | RSR stakers (governance + insurance) | FXS holders |
| **Governance token** | None (MTQ is monetary unit only) | MKR (separate) | RSR (separate) | FXS (separate, also algorithmic) |
| **Honest-status function** | Yes (on-chain `getHonestStatus()` returns 11-bit mask) | No | No | No |
| **Production status** | CANDIDATE FOR PUBLIC TESTING (per §25.4) | Live mainnet since 2017 | Live mainnet since 2023 | Live mainnet since 2021 |
| **Audit status** | Not conducted (per §25.5 Gate 1) | Multiple (CertiK, Trail of Bits, etc.) | Multiple | Multiple |

### H.2 MTQ's unique value proposition
1. **Gold + CHF as first-class index components** (not just reserve collateral) — no other stablecoin protocol does this. This makes MTQ a true purchasing-power unit (gold = crisis hedge, CHF = safe-haven fiat) rather than a USD-pegged stablecoin.
2. **MASE ensemble** of 5+ weighting models (min-variance, ERC, max-diversification, CVaR, PPP, regime-adaptive) — much more sophisticated than DAI's static collateral factors or Reserve's fixed basket.
3. **§14.1 Constitutional separation** of index gold vs reserve gold — gold's index weight ≠ gold's reserve weight. This is structurally novel and prevents the "replication portfolio" trap of forcing the reserve to mirror the index.
4. **Honest-status on-chain** (§25.7, `getHonestStatus()`) — no other stablecoin protocol exposes its implementation completeness as a queryable on-chain bit-mask.
5. **6-state risk machine** (vs DAI's no states, Reserve's none, Frax's partial) — the only one with an explicit pause-redemption-in-EMERGENCY rule (per blueprint).

### H.3 Competitive risks
1. **Liquidity** — at $0 mainnet TVL, MTQ has zero DEX liquidity. DAI has $5B+ TVL, Reserve has $500M+ TVL, Frax has $1B+ TVL. Cold-start is the hardest problem.
2. **Adoption** — MTQ's purchasing-power pitch competes with the simplicity of USDC. Users must understand the GFB index to value MTQ — this is a UX/education challenge.
3. **Regulatory** — multi-currency + gold + CHF reserve triggers Swiss, EU, US, and Singapore regulatory scrutiny. Reserve Protocol has a Sarbanes-Oxley-style registration path; MTQ does not yet.
4. **Oracle dependence** — Chainlink + Pyth + Chronicle for 6 pairs is a single point of systemic risk if all three are compromised simultaneously. The §18.4 0.50–2.00 sanity band is the last line of defense, but it pauses mint (not redeem) — so a coordinated oracle attack could still drain the reserve through redemptions at a stale-frozen price.

### H.4 Differentiation verdict
**MTQ is the most intellectually rigorous specification in the stable-asset space.** Its design exceeds DAI, Reserve, and Frax in methodological depth. The risk is that the rigor is not yet matched by implementation maturity (contract not deployed, oracles not wired, DAO not constituted). The §25.4 "Production-Ready? NO" declaration is correct and should be preserved.

---

## Findings Table

| ID | Title | Severity | Description | Recommendation |
|---|---|---|---|---|
| F-RR-01 | RR decay toward hard floor | CRITICAL | As minting scales, RR decays asymptotically toward 1.00 (blueprint design) or 1.001 (contract design). At ~$25M minted, RR hits STRESS 1.05; at ~$110M, RR ≈ 1.01; at ~$1B, RR ≈ 1.002. No automatic mechanism in the contract re-grows the surplus. | (1) Implement `sweepFeesToOperationalWallet` + `replenishReserveFromTreasury`. (2) Consider a dynamic mint fee that rises with inverse RR. (3) Document the adoption-curve sustainability math. |
| F-FEE-01 | Fees accrue to reserveVault, not Operational Wallet | CRITICAL | `MTQSigmaV2.sol` lines 473 + 516 route all USDC (incl. fees) to `reserveVault`. §20.4 requires fees → Operational Wallet (excluded from NAV). This inflates reported RR by ~10–25 bps and breaks the §20.2 three-pool separation. | Add `operationalWallet` address + `sweepFees()` function; transfer accumulated fees out of reserveVault daily; exclude operationalWallet balance from `getReserveNetAssetValue()`. |
| F-EMERG-01 | Redeem NOT paused in EMERGENCY | CRITICAL | Contract §21 (5-state machine) only raises redeem fee to 2% in EMERGENCY; does not pause. Blueprint §21.4 specifies 6-state machine with redemption **Paused** in S5 EMERGENCY. Death spiral possible under combined USDC depeg + gold crash + oracle failure. | (1) Add `require(protocolStatus != Status.EMERGENCY, "redeem paused")` to `redeem()`. (2) Add the missing STRESS state (RR 1.02–1.05) for the 6-state machine. |
| F-RISK-01 | 5-state vs 6-state risk machine mismatch | HIGH | Contract implements 5 states (NORMAL/CAUTION/DEFENSIVE/EMERGENCY/RECOVERY); blueprint specifies 6 (NORMAL/CAUTION/STRESS/DEFENSIVE/EMERGENCY/RECOVERY) with different RR thresholds (1.10/1.05/1.02/1.00) and fee schedule (0.15/0.50/1.00/paused/0.30). | Add `STRESS` to enum; re-map DEFENSIVE → STRESS (0.50% fee), DEFENSIVE → 1.00% fee, EMERGENCY → paused redemption. |
| F-CHF-01 | CHF base-fixing numerical inconsistency | HIGH | Engine + V2 contract use `BASE_CHF_USD = 0.88` (0.88 USD per CHF — incorrect: CHF is currently ~$1.13). Blueprint Listing 10 §18.5 line 12744 and Listing 12 §20.5 line 14452 use `1.13e18`. CHF underweighted in GFB denominator by 28% (0.044 vs 0.0565); GFB_base differs by 0.0125 (0.002% — small but real). | Change `BASE_FIXINGS.CHF_USD = 1.13` in `blueprint.ts`; change `BASE_CHF_USD = 1.13e18` in `MTQSigmaV2.sol` line 175; update `fx.ts` default to 1.13. |
| F-LCR-01 | `getLCR()` not implemented in contract | HIGH | `MTQSigmaV2.sol` claims `0x7FF` honest status (bit 8 = multiSourceOracle) but does not implement `getLCR()` despite §13.4 making it a first-class constitutional constraint. Engine implements it (line 480). | Add `getLCR()` to `MTQSigmaV2.sol`: numerator = `Σ stablecoin Q × P × (1 - H)`, denominator = `getCirculatingSupply() × getMTQPrice() × 0.25 / 1e18`. |
| F-GEN-01 | genesisReserve defaults to address(this) | MEDIUM | `MTQSigmaV2.sol` line 361: `genesisReserve = address(this)` (contract self-holds). `setGenesisReserve(address)` is `onlyAdmin` — deployer can set it to anything. Blueprint §20.1.4 requires 4/7 Gnosis Safe. | Deployment script must require `genesisReserve != address(this)` before any user mint is allowed. Add a `require(genesisReserve != address(this), "set genesis reserve to 4/7 multisig first")` guard on `mint()`. |
| F-GEN-02 | 100% deployer-held initial supply | MEDIUM | At genesis, the deployer holds 100% of non-circulating supply (1,000,000 MTQ). Standard for asset-backed tokens, but centralization risk if multisig not formalized. | Public commitment to a 7-signer multisig with documented selection process + geographic distribution + hardware wallets + annual rotation. |
| F-GEN-03 | No public distribution plan | MEDIUM | Blueprint has no public sale, airdrop, LBP, or liquidity bootstrap. Cold-start risk. | Document a genesis distribution plan (50% DAO treasury / 30% liquidity / 20% team vesting over 4 years), all locked at genesis. |
| F-GOV-01 | No governance token / no DAO contract | MEDIUM | Blueprint specifies 4-layer hierarchy (§22.3) but contract has only `onlyAdmin` access — collapses to single-admin. No DAO vote contract, no governance token. | Either (A) document "no governance token" decision + signers act as Constitutional Convention, or (B) issue separate `MTQGOV` token + governor contract. Either way, replace `onlyAdmin` on `queueChange` with a DAO vote contract call. |
| F-GOV-02 | Multi-Sig signer selection undocumented | MEDIUM | Blueprint does not document how 7/7 Constitutional Multi-Sig signers are selected, rotated, or removed. §20.3.3 geographic/hardware requirements only apply to Cold Treasury signers. | Add a Constitution document (IPFS hash + on-chain immutable) specifying signer selection, rotation cadence (annual), hardware-wallet requirement, geographic distribution, removal process. |
| F-GOV-03 | DAO vote mechanics undefined | MEDIUM | "DAO Vote (51%)" tier in §22.3 has no operational definition (51% of what? quorum? voting period? execution path?). | Specify DAO vote mechanics (token or signer-based, quorum, voting period, proposal threshold, execution path). |
| F-HONEST-01 | `getHonestStatus()` overstates capabilities | MEDIUM | `MTQSigmaV2.sol` line 1036 returns hardcoded `0x7FF` (all 11 bits set) regardless of whether adapters/registry/DAO are actually wired. Contract not deployed yet. | Make the mask dynamic — compute from actually-wired adapter/registry/governance addresses, not hardcoded. |
| F-FX-01 | v1.0 contract vs v1.2 pilot divergence underdocumented | LOW | The V2 contract and v1.2 pilot coexist (different deployments, different honest statuses). No migration plan, no deprecation timeline for v1.2. | Add a `deprecated` flag on the v1.2 pilot; document the migration path v1.2 → v1.0 in the blueprint Appendix. |

**Total findings: 14.** Critical: 3. High: 3. Medium: 7. Low: 1.

---

## Survivorship Analysis (Quantitative)

### S1. Total redemption (100% of circulating)
- Burn 100% of circulating → `circulatingSupply = 0`, `liability = 0`.
- Release 100% of reserve pro-rata → `V_net` returns to genesis state (1,100,000 USDC equivalent) + accumulated fees.
- `RR = V_net / 0 = ∞`.
- **Survival: YES.** Protocol returns to genesis state with positive NAV.

### S2. Gold price drops 50% overnight
- Gold weight in strategic prior = 26% (index and reserve roughly aligned).
- `P_MTQ` drops by 26% × 50% = 13%.
- `V_net` drops by 26% × 50% × (1 - 0.01 haircut) = 12.87%.
- `L` drops by 13% (gold is in the GFB index).
- RR delta: (1 - 0.1287) / (1 - 0.13) - 1 = 0.0015 → RR drops by **0.15%** (1.10 → 1.0985).
- **Survival: YES.** Stays in NORMAL. Symmetric exposure insulates RR.

### S3. USDC depegs (USDC → $0.90)
- USDC weight in strategic prior = 27%. USDC is NOT in the GFB index (USD base fixing = 1.0, unchanged).
- `V_net` drops by 27% × (1 - 0.90 × (1 - 0.005) / 0.995) = 27% × 9.50% = 2.56%.
- `L` unchanged (P_MTQ unchanged).
- RR: 1.10 → 1.0717 → protocol enters **CAUTION** (1.05 ≤ RR < 1.10).
- §21.5 Geopolitical Eject: USDC depeg > 12h → Stage 1 (sell 10% of USDC holdings).
- **Survival: YES.** CAUTION state, mint throttled to 50%, emergency rebalance active.

### S4. Combined: USDC depeg + gold crash + oracle failure
- USDC → $0.90: V drops 2.56%, L unchanged.
- Gold → $1,250: V drops 12.87%, L drops 13%.
- Combined: V drops ~15.4%, L drops ~13% → RR = 0.946 × V_0 / 0.87 × L_0 = (1.10 × 0.846) / 0.87 = 1.069 → **CAUTION** (close to STRESS).
- Oracle failure: P_MTQ freezes at last-known-good. `commitFxRatesFromOracles()` reverts. `mint` pauses (sanity band guard). `redeem` stays open at frozen price.
- Users redeem at frozen (high) price against real (now low) reserve → protocol realizes losses → RR drops further.
- If RR drops below 1.00 → EMERGENCY.
- **Contract's behavior (5-state):** redeem continues at 2% fee → death spiral possible.
- **Blueprint's behavior (6-state):** redeem paused in EMERGENCY → spiral stopped, users trapped but reserve protected.
- **Survival: DEPENDS on implementation.** Contract: NO. Blueprint: YES (with user-trust cost).

### S5. 30-day sustained redemption (25% stress scenario per §13.4.2)
- 25% of circulating redeemed over 30 days.
- V drops by 25% (pro-rata release), L drops by 25%.
- RR roughly preserved (symmetric).
- LCR drops (because released basket includes gold, which is 0% liquid) → liquid asset share rises post-redemption → LCR **improves**.
- **Survival: YES.** Self-correcting through the pro-rata release design.

### S6. NAV haircut stress (per §13.2.3 "stress buffer")
- Apply stressed haircuts (e.g., 2× normal: USDC 1.0%, PAXG 2.0%, EURC 1.4%, etc.).
- V_net drops by ~1.5–2.5% extra (depending on basket composition).
- If normal RR = 1.10, stressed RR ≈ 1.075 → still in NORMAL/CAUTION boundary.
- **Survival: YES.** Stress buffer designed for this.

---

## Comparison Matrix (Detailed)

| Criterion | MTQΣ v1.0 | DAI | Reserve Protocol | Frax |
|---|---|---|---|---|
| **Peg** | Adaptive GFB (multi-currency + gold) | $1.00 USD | $1.00 USD | $1.00 USD |
| **Stability mechanism** | Adaptive basket + haircut + RR tiers + state machine | Overcollateralization + stability fee | Overcollateralization + RSR backstop | Algorithmic + collateral |
| **Mint cost** | 0.10% + gas | 0% + stability fee | 0% + gas | ~0.05–0.20% + FXS burn |
| **Redeem cost** | 0.15% (NORMAL) → 2.00% (EMERGENCY) | 0% + repay debt | 0% + gas | ~0.05–0.20% + FXS mint |
| **State machine** | 6-state (blueprint) / 5-state (contract) | None | None | Partial |
| **Adaptive weights** | MASE ensemble (6 models) | None | None | None |
| **Gold in unit** | YES (20–32% envelope) | NO | Optional (basket-dependent) | NO |
| **CHF in unit** | YES (3–7% envelope) | NO | NO | NO |
| **Honest-status on-chain** | YES (`getHonestStatus()`) | NO | NO | NO |
| **Multi-source oracle** | YES (Chainlink + Pyth + Chronicle, median consensus) | Custom oracles | Chainlink | Chainlink + Uniswap TWAP |
| **Geopolitical eject** | YES (4-stage 10/25/50/100% ladder) | NO | NO | NO |
| **Treasury sweep** | YES (blueprint) / NO (contract) | N/A | YES (RSR backstop) | N/A |
| **Governance** | 4-layer hierarchy (blueprint) / admin-only (contract) | MKR holders | RSR stakers | FXS holders |
| **TVL (mainnet)** | $0 (not deployed) | ~$5B | ~$500M | ~$1B |
| **Audit status** | Not conducted | Multiple | Multiple | Multiple |
| **Production status** | CANDIDATE FOR PUBLIC TESTING | Live since 2017 | Live since 2023 | Live since 2021 |

---

## Final Tokenomics Score

**Overall: 68 / 100** (Top-tier specification with implementation alignment gaps)

### Score breakdown

| Dimension | Score | Weight | Weighted | Justification |
|---|---|---|---|---|
| **Supply design** | 85 | 20% | 17.0 | Clean mint-on-deposit; no inflation; no cap (intentional for monetary unit); purchasing-power equivalence enforced via `P_MTQ` pricing. Loses points for no public distribution plan (F-GEN-03). |
| **Fee model** | 75 | 15% | 11.25 | Anti-fragile 5-state escalation is best-in-class. Loses points for: (1) fee accounting mismatch with §20.4 (F-FEE-01), (2) 2% EMERGENCY fee may be insufficient to stop a true run (F-EMERG-01). |
| **Genesis distribution** | 55 | 15% | 8.25 | Strong conceptual design (locked non-circulating reserve) but: deployer holds 100% (F-GEN-02), no multisig enforcement in contract (F-GEN-01), no public distribution plan (F-GEN-03). |
| **RR sustainability** | 50 | 20% | 10.0 | The asymptotic decay toward 1.00 is the fundamental tokenomics weakness. Without active replenishment + dynamic fee, the protocol will hit STRESS at ~$25M minted and HARD at ~$1B+ minted. The math is real and the contract does not auto-correct. |
| **Governance** | 45 | 15% | 6.75 | 4-layer hierarchy is excellent on paper; contract collapses to single-admin; no governance token; no DAO contract; no documented signer selection. Significant gap between blueprint and implementation. |
| **Honesty** | 95 | 15% | 14.25 | Best-in-class. On-chain `getHonestStatus()` is unique. §25 supported/unsupported claims list is rigorous and verifiably adhered to. Loses points for hardcoded `0x7FF` overstatement (F-HONEST-01). |
| **TOTAL** | — | 100% | **67.5 ≈ 68** | Strong specification, weak implementation alignment, sustainability gap. |

### Grade interpretation
- 90–100: Production-ready tokenomics
- 75–89: Solid tokenomics with minor gaps
- **60–74: Strong specification, implementation gaps requiring remediation**
- 45–59: Conceptual flaws requiring redesign
- 0–44: Tokenomics broken

**MTQΣ v1.0 is at 68/100 — strong specification, implementation gaps requiring remediation.** The 3 critical findings (F-RR-01, F-FEE-01, F-EMERG-01) must be addressed before mainnet deployment. The 3 high findings (F-RISK-01, F-CHF-01, F-LCR-01) should be addressed before public testnet expansion.

---

## Top 3 Tokenomics Risks (Executive)

1. **RR decay toward the hard floor as minting scales.** Without active reserve replenishment + dynamic fees, the protocol will hit STRESS at ~$25M minted and approach HARD at ~$1B minted. The 1,100,000 USDC genesis buffer is finite; it does not scale with adoption. This is the single biggest threat to the protocol's long-term sustainability.

2. **Fee accounting mismatch with the blueprint's three-pool separation.** The contract accumulates fees inside `reserveVault` (inflating reported RR by 10–25 bps) instead of sweeping them to a separate Operational Wallet + Cold Treasury. This (i) violates §20.2/§20.4, (ii) makes the reported RR non-comparable to the blueprint's intended conservative measure, (iii) means there is no operational wallet to pay gas/keepers/oracles/audits from, forcing those costs to come out of the reserve.

3. **EMERGENCY redemption not paused in the contract.** The blueprint explicitly pauses redemptions in EMERGENCY to break the death spiral; the contract only raises the fee to 2%. Under combined USDC depeg + gold crash + oracle failure, the contract's design allows a slow bleed to insolvency; the blueprint's design stops the bleed at the cost of user exit. This is the most important blueprint-vs-implementation divergence in the entire tokenomics model.

---

## Appendix: Verification Commands

```bash
# Confirm the report file exists
wc -l /home/z/my-project/audit-work/audit-d-tokenomics.md

# Read the first 50 lines back to confirm structure
head -50 /home/z/my-project/audit-work/audit-d-tokenomics.md
```

**READ-ONLY audit.** No code was modified. The audit-d-tokenomics.md report is the sole deliverable.

---

*End of AUDIT-D report.*
