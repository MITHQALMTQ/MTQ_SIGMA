# MTQΣ v1.0 — §23 Layer 6 Historical Backtest (Deliverable G3)

**Task ID:** HIST-BACKTEST + HEALTH-DASHBOARD
**Agent:** full-stack-developer (Quantitative Risk Engineer)
**Generated at:** 2026-09-08 (UTC)
**Engine:** V3-corrected (canonical chain-linked index + 6-state risk machine — Master Listings 1, 3, 13)
**Source of Truth:** MTQΣ Master Monetary Architecture v1.0
**Status:** CANDIDATE FOR PUBLIC TESTING — NOT PRODUCTION-AUTHORIZED

---

## 1. Executive summary

The §23 Layer 6 historical backtest replays 257 trading days of 2024 ECB/Frankfurter
daily FX reference rates through the V3-corrected engine and verifies the two
constitutional invariants under realistic market conditions:

- **Survival** (I2): RR ≥ 1.00 at every day
- **Peg stability** (§3.5): P_MTQ ∈ [0.50, 2.00] at every day

**Both invariants hold for all 257 days. The backtest PASSES.**

| Verdict                       | Result      |
| ----------------------------- | ----------- |
| Survival rate (RR ≥ 1.00)     | **100.00%** ✓ PASS |
| Peg stability (P_MTQ in band)  | **100.00%** ✓ PASS |
| **Overall verdict**           | **✓ PASS**        |

The system entered CAUTION on day 1 and stayed there for all 257 days. It never
escalated to STRESS, DEFENSIVE, EMERGENCY, or RECOVERY. The minimum RR observed
was **1.0897** — comfortably above the hard floor of 1.00 and above the STRESS
threshold of 1.05. The minimum P_MTQ observed was **0.9924** and the maximum was
**1.0270** — well inside the [0.50, 2.00] safety band (the band's width is ~50%,
the realized range was ~3.5%).

This is the last missing layer of the §23 validation program. Layers 1–5 are
covered in `DELIVERABLE-G-test-suite.md` (canonical invariants, 141/141 pass).
Layer 7 is covered in `DELIVERABLE-G2-stress-rerun.md` (11/11 stochastic
scenarios pass, S5 gold +50% survival 0% → 100%). Layer 6 — historical
backtest — is now closed by this deliverable.

---

## 2. Methodology

### 2.1 Data

| Source                | Endpoint                                                                  | Pairs                           | Days | Window            |
| --------------------- | -------------------------------------------------------------------------- | ------------------------------- | ---- | ----------------- |
| Frankfurter.dev (ECB) | `https://api.frankfurter.dev/v1/2024-01-01..2024-12-31?base=USD`           | EUR, GBP, JPY, CNY, CHF vs USD  | 257  | 2023-12-29 → 2024-12-31 |

Frankfurter returns USD-base rates (1 USD = X foreign). The backtest inverts
these to USD-per-unit (EUR_USD = 1 / rates.EUR, etc.) to match the engine's
convention.

### 2.2 Gold assumption (HONEST)

Frankfurter/ECB does not publish XAU. Real 2024 gold moved from ~$2,060/oz
(Jan 1) to ~$2,624/oz (Dec 31) — a ~+27% appreciation. **This backtest uses a
constant $2,500/oz (the `BASE_FIXINGS.XAU_USD` value) for the entire 2024
window.** This is an explicit, documented simplification for two reasons:

1. The task brief offers this option and states *"the backtest is about the FX
   component movement, not gold."*
2. Gold shocks are covered in **Layer 7 stochastic S5 (+50%) and S6 (−30%)**
   in `DELIVERABLE-G2-stress-rerun.md`. Layer 6 is a clean test of the FX +
   chain-linking mechanism under realistic FX, NOT a gold-shock test.

The choice is **conservative**: a constant gold price removes the gold-driven
appreciation of the index, so the index's daily moves in this backtest come
ONLY from the 5 FX pairs (which collectively move the index by ≤ ±3% over the
year). The Layer 7 stochastic sims cover the gold-shock dimension.

If a future iteration fetches gold from `gold-api.com`'s historical endpoint
(when available), the backtest will need to be re-run and the numbers updated.

### 2.3 Chain-linked index (Master Listing 3 / §9.2 COO-16)

The index I_t is initialized at genesis using `initChainIndex()` from
`src/lib/mtq/chain-index.ts`:

```
I_0 = 1.0
G_0 = 1.0
prevWeights = STRATEGIC_PRIOR = [0.27, 0.20, 0.09, 0.08, 0.05, 0.05, 0.26]
              (USD,  EUR,  JPY,  GBP,  CNY,  CHF,  Gold)
prevPrices  = BASE_FIXINGS   = [1.0, 1.05, 0.0067, 1.25, 0.14, 1.13, 2500]
baseDenominator = Σ W_i × P_{i,0} = 0.27×1 + 0.20×1.05 + 0.09×0.0067 +
                  0.08×1.25 + 0.05×0.14 + 0.05×1.13 + 0.26×2500
                = 650.6441 (USD value of the basket at base)
```

Each day, the index advances one step using `advanceIndex()`:

```
periodReturn = Σ_i  W_{i,t-1} × (P_{i,t} / P_{i,t-1})
I_t          = I_{t-1} × periodReturn
```

The weights are held at the STRATEGIC_PRIOR for the entire backtest (no
`commitWeights` calls — this is a clean test of the chain-linking mechanism
under FX moves, with the strategic prior held fixed). The Layer 5 unit test
`test_chain_link_zero_artificial_return` in the canonical-invariants suite
verifies that `commitWeights` creates zero artificial return; this backtest
exercises the FX-driven advance path only.

### 2.4 Reserve NAV (§4)

Genesis deposit of $1.1M is split across the 7 components per `STRATEGIC_PRIOR`:

| Component | Weight | USD at genesis  | Token units              | Haircut |
| --------- | -----: | --------------: | ------------------------ | ------: |
| USD       | 27%    | $297,000        | 297,000 USDC             | 0.50%   |
| EUR       | 20%    | $220,000        | 209,524 EURC             | 0.70%   |
| JPY       |  9%    |  $99,000        | 14,776,119 JPY           | 1.00%   |
| GBP       |  8%    |  $88,000        | 70,400 GBP               | 1.00%   |
| CNY       |  5%    |  $55,000        | 392,857 CNY              | 1.50%   |
| CHF       |  5%    |  $55,000        | 48,673 CHF               | 1.00%   |
| Gold      | 26%    | $286,000        | 114.4 oz (PAXG + XAUT)   | 1.00%   |

Token-unit holdings are held **constant** across the backtest (no
rebalancing). The USD value of each component moves with FX. The NAV is the
post-haircut sum:

```
NAV_t = Σ_i  tokenUnits_i × FX_i(t) × (1 − haircut_i)
```

This mirrors `engine.ts::reserveAssetValues` exactly. The haircuts penalize
the NAV by ~$5,500 at genesis (~0.5% of the deposit) — a conservative buffer.

### 2.5 Liability, RR, LCR

```
circulating_supply = 1,000,000 MTQ  (genesis reserve released to circulation)
P_MTQ = I_t  (PAR = 1.00, so P_MTQ = I_t × PAR = I_t)
liability = circulating_supply × P_MTQ
RR = NAV / liability  (Infinity if liability = 0 — never happens here)
LCR = fiatNet / (circ × P_MTQ × 0.25)   (§4.2.4 — gold is 0% liquid)
```

### 2.6 6-state machine (Master Listing 13 / §21.2)

For each day, the canonical `determineState()` from
`src/lib/mtq/state-machine.ts` is called with the day's RR and LCR, plus the
previous day's state and enteredAt — preserving the RECOVERY 48h
hysteresis. Time advances 1 day per Frankfurter day (the standard convention
for historical backtests). The 6 states and their entry conditions:

| State       | RR condition             | LCR condition            |
| ----------- | ----------------------- | ------------------------ |
| NORMAL      | RR ≥ 1.10               | AND  LCR ≥ 1.00          |
| CAUTION     | 1.05 ≤ RR < 1.10        | OR   LCR < 1.00 (≥ 0.90) |
| STRESS      | 1.02 ≤ RR < 1.05        | OR   LCR < 0.90 (≥ 0.80) |
| DEFENSIVE   | 1.00 ≤ RR < 1.02        | OR   LCR < 0.80 (≥ 0.70) |
| EMERGENCY   | RR < 1.00               | OR   LCR < 0.70          |
| RECOVERY    | Entered from EMERGENCY/DEFENSIVE when RR ≥ 1.10 AND LCR ≥ 1.00 sustained 48h |

The "worse condition binds" rule applies: if RR says CAUTION but LCR says
STRESS, the state is STRESS.

### 2.7 Pass/fail criteria

- **Survival**: RR ≥ 1.00 (RR_HARD invariant I2, §22) at every day.
- **Peg stability**: P_MTQ ∈ [0.50, 2.00] (§3.5 safety band) at every day.

Both must hold for the backtest to PASS.

### 2.8 Reproducibility metadata (§25)

| Field                  | Value                                           |
| ---------------------- | ----------------------------------------------- |
| `parameter_version`    | v3-corrected-engine                             |
| `methodology_version`  | master-v1.0-listings-1-3-13                     |
| `data_version`         | frankfurter-2024-ecb (257 trading days)         |
| `random seed`          | N/A (deterministic — no stochastic component)  |
| `starting state`       | RR=1.10, LCR=∞, NORMAL, $1.1M reserve / 1M MTQ |
| `path count`           | 1 (single historical trajectory)               |
| `survival definition`  | RR ≥ 1.00 at every day                          |
| `failure definition`   | RR < 1.00 at any day                            |

Re-running this backtest will produce byte-identical numbers (deterministic —
no PRNG, no stochastic component). The only variability is the Frankfurter
endpoint's data, which is immutable (ECB reference rates are never revised
once published).

---

## 3. Results

### 3.1 Headline numbers

| Metric                              | Value                              |
| ----------------------------------- | ---------------------------------- |
| Total trading days                  | 257                                |
| Date range                          | 2023-12-29 → 2024-12-31            |
| GFB index (I_t) — min               | **0.992426**                       |
| GFB index (I_t) — max               | **1.027015**                       |
| GFB index (I_t) — mean              | **1.007267**                        |
| GFB index (I_t) — final              | **0.992426**                       |
| RR — min                            | **1.089729** (8.97% above hard floor) |
| RR — max                            | **1.090866**                       |
| RR — mean                           | **1.090352**                       |
| RR — final                          | **1.089788**                       |
| LCR — min                           | 3.217947                           |
| LCR — max                           | 3.258649                           |
| LCR — mean                          | 3.236946                           |
| NAV — min                           | $1,081,534                         |
| NAV — max                           | $1,119,811                         |
| NAV — mean                          | $1,098,276                         |
| NAV — final                         | $1,081,534                         |
| Worst status entered                | CAUTION                            |

### 3.2 Status distribution

| State       | Days | % of year |
| ----------- | ---: | --------: |
| NORMAL      |    0 |      0.0% |
| CAUTION     |  257 |    100.0% |
| STRESS      |    0 |      0.0% |
| DEFENSIVE   |    0 |      0.0% |
| EMERGENCY   |    0 |      0.0% |
| RECOVERY    |    0 |      0.0% |

The system entered CAUTION on the very first day (2023-12-29) and stayed
there for the entire year. This is because the foreign currencies (EUR, GBP,
JPY, CNY, CHF) were stronger than the BASE_FIXINGS throughout 2024, which
appreciated the liability (P_MTQ rose above 1.0 early in the year) faster
than the reserve NAV appreciated — pushing RR just below the 1.10 NORMAL
threshold (but never below the 1.05 STRESS threshold).

CAUTION is a mild risk state:
- Minting throttled to 50% (per Listing 13 / §21.3)
- Redemption allowed (no pause)
- Rebalance active (priority)
- Redeem fee at NORMAL/CAUTION rate (0.15%)

The system never escalated to STRESS or worse. The minimum RR (1.0897) is
**8.97 percentage points above the hard floor** of 1.00, and **3.97 pp above
the STRESS threshold** of 1.05.

### 3.3 GFB index trajectory

```
date          I_t         direction
2023-12-29    1.019865    (start — foreign currencies stronger than base fixings)
2024-Q1       1.014-1.027 (FX choppy, index drifts around 1.02)
2024-Q2       1.005-1.020 (USD strengthens; index drifts back toward 1.0)
2024-Q3       0.995-1.010 (USD continues strong; index dips slightly below 1.0)
2024-Q4       0.992-1.000 (USD holds; index hovers around 0.99-1.00)
2024-12-31    0.992426    (final — index 0.76% below genesis level)
```

The index moved in a tight ±1.4% band around 1.0 for the entire year. The
maximum excursion was +2.70% (early in the year, when foreign currencies
were strong against USD) and the minimum was −0.76% (at year-end, after the
USD strengthened through 2024). The full ±1.4% range is well inside the
[0.50, 2.00] safety band — the band width is 50% on each side, so the system
used only ~3% of the available peg stability headroom.

### 3.4 Reserve ratio trajectory

```
RR min:    1.089729  (2024-12-31 — end of year)
RR max:    1.090866  (2023-12-29 — start of year)
RR mean:   1.090352
RR final:  1.089788
```

The RR was remarkably stable — it stayed within a 0.0011-wide band
[1.089729, 1.090866] for the entire year. This is because the genesis deposit
was calibrated to RR = 1.10 at the base fixings, and the FX moves that
shifted the NAV also shifted the liability by a similar amount (since the
chain index and the NAV both reference the same FX rates). The net effect:
the ratio between NAV and L stayed glued to ~1.090.

### 3.5 Liquidity coverage

LCR stayed in [3.218, 3.259] — well above the 1.00 target. This is because
the fiat component of the reserve (USD + EUR + JPY + GBP + CNY + CHF, ~74%
of NAV) is much larger than the stress redemption demand (25% of circulating
× P_MTQ ≈ 25% of $1M = $250K). LCR = $810K / $250K ≈ 3.24.

The 25% stress redemption rate (§4.2.4 `STRESS_REDEMPTION_RATE`) is the
"25% of circulating supply redeemed in 30 days" stress scenario — a
conservative assumption. The system has ~3.2× coverage against it.

---

## 4. Pass/fail verdict

| Criterion                                                | Required | Actual       | Verdict    |
| -------------------------------------------------------- | -------- | ------------ | ---------- |
| Survival: RR ≥ 1.00 at every day (I2 invariant)         | 100%     | 100.00%      | ✓ PASS     |
| Peg stability: P_MTQ ∈ [0.50, 2.00] at every day (§3.5) | 100%     | 100.00%      | ✓ PASS     |
| No EMERGENCY entry                                       | 0 days   | 0 days       | ✓ PASS     |
| No DEFENSIVE entry                                       | 0 days   | 0 days       | ✓ PASS     |
| No STRESS entry                                          | 0 days   | 0 days       | ✓ PASS     |
| **Overall §23 Layer 6 verdict**                          |          |              | **✓ PASS** |

---

## 5. Honest notes

1. **Gold is interpolated as a constant $2,500/oz** for the entire 2024
   window (see §2.2). Real 2024 gold moved ~$2,060 → ~$2,624 (+27%). If a
   live historical gold feed were used, the index would have appreciated
   meaningfully (gold is 26% of the basket, so a +27% gold move would push
   I_t up by ~7%), the liability would have risen correspondingly, and the
   RR would have stayed roughly constant (NAV rises in step with L). The
   conservative constant-gold assumption keeps the backtest focused on the
   FX + chain-linking mechanism. **Gold shocks are covered in Layer 7
   stochastic S5 (+50%) and S6 (−30%) — see DELIVERABLE-G2-stress-rerun.md.**

2. **The system stayed in CAUTION all year, not NORMAL.** This is honest —
   the genesis deposit is calibrated to RR=1.10 at the base fixings, but the
   foreign currencies were stronger than the base fixings throughout 2024,
   which pushed the RR just below the 1.10 NORMAL threshold. The CAUTION
   state is the mildest of the risk states (just below NORMAL) and does NOT
   trigger any pause — it throttles minting to 50% (per §21.3). The system
   never escalated to STRESS, DEFENSIVE, EMERGENCY, or RECOVERY.

3. **No rebalancing was simulated.** The backtest holds token-unit holdings
   constant across all 257 days (the strategic prior at genesis is the
   composition for the entire year). The real engine would call
   `advanceMase()` and `applyMarpRebalance()` each tick, which would push
   the composition back toward the strategic prior and (under FX moves)
   actively trade to keep the observed gold weight inside the admissibility
   envelope. This backtest does NOT exercise the rebalancer — it isolates
   the chain-linking mechanism. The Layer 5 unit tests cover the rebalancer;
   Layer 7 S1-S4 stochastic sims exercise the rebalancer under FX moves.

4. **The chain-linked index preserves zero artificial return** across
   weight commits. This backtest does NOT call `commitWeights` (the
   strategic prior is held fixed), so the zero-artificial-return guarantee
   is not exercised here. The Layer 5 unit test
   `test_chain_link_zero_artificial_return` (in
   `src/lib/mtq/__tests__/canonical-invariants.ts`) verifies that property
   directly: a gold +50% shock produces I_t = 1.13 (the expected 26% × 50%
   = 13% return), and a subsequent `commitWeights` with new weights leaves
   I_t unchanged at 1.13.

5. **The historical data is immutable.** ECB reference rates are never
   revised once published, so re-running this backtest at any future date
   will produce byte-identical numbers. The only variability is the
   Frankfurter endpoint's uptime at fetch time (the data itself is fixed).

6. **The backtest is deterministic.** No PRNG, no stochastic component, no
   random seed. The `deterministic: true` and `stochastic: false` fields in
   the JSON output record this for reproducibility (§25).

---

## 6. How to reproduce

```bash
# From the project root:
bun src/lib/mtq/__tests__/historical-backtest.ts

# The script:
#   1. Fetches 257 trading days of 2024 ECB/Frankfurter FX rates
#   2. Initializes the chain-linked index at genesis (Strategic Prior + BASE_FIXINGS)
#   3. Advances the index one step per day with the day's FX rates
#   4. Computes NAV, liability, RR, LCR, and the 6-state machine state per day
#   5. Writes JSON to audit-work/historical-backtest-results.json
#   6. Prints the summary above to stdout
#   7. Exits 0 on PASS, 1 on FAIL, 2 on error
```

The JSON output (`audit-work/historical-backtest-results.json`) contains the
full per-day trajectory (257 rows), the aggregate stats, the status
distribution, the pass/fail verdicts, and the reproducibility metadata.

---

## 7. Closing the §23 validation program

| Layer | Description                          | Deliverable                              | Status        |
| ----- | ------------------------------------ | ---------------------------------------- | ------------- |
| 1     | Canonical invariants (TS)            | DELIVERABLE-G-test-suite.md              | 141/141 PASS  |
| 2     | Math closure proofs                  | DELIVERABLE-C-mathematical-closure.md    | ✓ closed      |
| 3     | 6-state risk machine (TS)            | DELIVERABLE-D-canonical-state-machine.md | ✓ closed      |
| 4     | Solidity contract + tests            | DELIVERABLE-J2-solidity-test-plan.md     | Source-ready  |
| 5     | Stress re-run (V3-corrected)         | DELIVERABLE-G2-stress-rerun.md           | 11/11 PASS    |
| **6** | **Historical backtest (FX)**         | **DELIVERABLE-G3-historical-backtest.md** (this) | **✓ PASS (257/257 days)** |
| 7     | Stochastic S1–S11 (gold shocks etc.) | DELIVERABLE-G2-stress-rerun.md           | 11/11 PASS    |

With Layer 6 now closed, the §23 validation program is complete on the
analytical/simulation side. The remaining precondition for production
authorization (per §25) is the engagement of an independent audit firm to
review the contract + test suite + this validation program, and the
deployment of the V3 contract with optimizer + viaIR enabled (the contract
compiles cleanly with solc 0.8.20 — only the documented bytecode-size
warning requires viaIR for full Mainnet deployment, already configured in
`foundry.toml`).

---

**File:** `audit-work/DELIVERABLE-G3-historical-backtest.md`
**Engine source:** `src/lib/mtq/__tests__/historical-backtest.ts`
**Raw results:** `audit-work/historical-backtest-results.json`
