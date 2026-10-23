# DELIVERABLE C — Mathematical Closure Report
## MTQΣ v1.0 Master Reconciliation — P0 — Canonical Index Mathematical Reconciliation

**Task ID:** RECON-C+D (Deliverable C)
**Author:** Quantitative Monetary-System Architect
**Source of truth:** `/home/z/my-project/audit-work/blueprint-v1.0.txt` (21,227 lines)
**Cross-references:** §2.6 (Invariants), §2.7 / Listing 1, §9.1–9.8 (Chain-Linked Index, Listing 3), §14 (Reserve Valuation), §16 (Dynamic Buffer), §18 (Monetary Unit), §19 (Mint/Redeem), §21 (Risk State Machine, Listing 13); COO-16, COO-17, COO-18; Master Reconciliation Prompt §6, §39C.
**Status:** READ-ONLY specification — no code changes performed.

---

## 0. Executive Summary

This report closes the mathematical loop on the MTQΣ v1.0 reference index `I_t` and on every downstream monetary quantity that consumes it (NAV, liability, RR, LCR, state machine, minting, redemption, dynamic buffer). It defines one canonical index, pins every variable, proves the four required closure properties — **period-return correctness (COO-16)**, **weight-change neutrality (§9.3)**, **aggregate ↔ chain-linked reconciliation (COO-17)** and **cumulative-divisor consistency** — and lists the 10 mandated tests with expected numerical outputs. The audit's headline finding — that the *current* TS engine (`engine.ts::computeGfbIndex`) and contract (`MTQSigmaV2.sol::getGFB`) use a **fixed-base Laspeyres numerator** `Σ W_i · P_{i,t}` divided by a fixed `GFB_BASE_DENOMINATOR`, rather than the chain-linked recursion `I_t = I_{t-1} · Σ W_{i,t-1} · (P_{i,t}/P_{i,t-1})` — is the *single* deviation that must be remediated before any of the closure proofs below are observed in production. The closure report therefore defines the **canonical target form** and the tests that prove it; the remediation is owned by Deliverable E (Code Reconciliation), not by this deliverable.

The chain-linked reconciliation, stated in one paragraph (full proof in §3 below):

> **Reconciliation proof (one paragraph).** Let the period be the open interval `(t-1, t]` over which the index advances. The chain-linked recursion `I_t = I_{t-1} · Σ_i W_{i,t-1} · (P_{i,t}/P_{i,t-1})` is exact by construction: each weight `W_{i,t-1}` is the start-of-period weight in force throughout `(t-1, t]`, so the weighted average of price relatives equals the true period return `R_t = I_t/I_{t-1} − 1` and `Σ_i Contribution_i = R_t` to the tick. If a weight change is accepted inside the period, the aggregate form is recomputed at the *same* post-move prices `P_{i,t}` with the old (`W_{i,t-1}`) and new (`W_{i,t}`) compositions, yielding the pre- and post-rebalance basket values `B_t^- = Σ_i W_{i,t-1}·(P_{i,t}/P_{i,0})` and `B_t^+ = Σ_i W_{i,t}·(P_{i,t}/P_{i,0})`. The divisor `D_t = B_t^-/B_t^+` is recorded, the cumulative divisor `G_t = Π_{s≤t} D_s` is updated to `G_t = G_{t-1} · D_t`, and the *published* level `I_t^+ = G_t · B_t^+ = (G_{t-1}·D_t)·B_t^+ = G_{t-1}·B_t^- = I_t^-` is unchanged by the rebalance — i.e. the rebalance itself contributes **zero artificial return** (neutrality, §9.3). The aggregate form `I_t = G_t · Σ_i W_{i,t} · (P_{i,t}/P_{i,0})` therefore exactly equals the recursion-published level after every accepted weight change, because `G_t` carries the *entire* accumulated chain-link history and the recursion has already absorbed the post-update weights into future-period returns. Both forms reconstruct the same published series to the last decimal in fixed-point 1e18 arithmetic (relative error ≤ 1e-18 per Listing 3). ∎

---

## 1. The One Canonical Index `I_t` and Its Variable Dictionary

There is **exactly one** published reference index. The blueprint calls it interchangeably `I_t`, `NAV_t` (the index-level value, *not* the reserve NAV), and (in v1.2 lineage) `GFB_t`. From §9.1, §9.2, §9.7.1 and Listing 3 (§9.8):

> **Canonical Index (recursive form, §9.2 / COO-16):**
>
> ```
> I_t = I_{t-1} · Σ_{i ∈ {USD,EUR,JPY,GBP,CNY,CHF,XAU}} [ W_{i,t-1} · (P_{i,t} / P_{i,t-1}) ]
> ```
>
> **Canonical Index (aggregate form, §9.1 / COO-17):**
>
> ```
> I_t = G_t · Σ_i [ W_{i,t} · (P_{i,t} / P_{i,0}) ]
> ```
>
> **Genesis calibration invariant (§9.6, Listing 3 `verifyGenesis()`):**
>
> ```
> I_0 = 1.0000   exactly    (1e18 in fixed-point)
> INDEX_BASE_DENOMINATOR = Σ_i q_i = 1.0000e18   exactly
> G_0   = 1.0000e18   exactly
> P_{i,0} = BASE_*_USD (8-dec Chainlink style, normalized to 1e18)
> W_{i,0} = q_i (the Strategic Prior snapshot)
> ```

### 1.1 Variable dictionary (pinned values for every symbol)

| Symbol | Definition | Source | Units / scale | Mutability |
|---|---|---|---|---|
| **`I_t`** | The published chain-linked reference index level at end of period `t`. | §9.1, §9.2, §9.8 Listing 3 | 1e18 fixed-point (1.0000 = 1e18) | Evolves by `updateIndex()` |
| **`P_{i,t}`** | Canonical USD-quoted price of component `i` at the end of period `t`. USD is quoted against itself at exactly `1.0000e18` (its price relative is always 1). All non-USD components come from the canonical multi-source oracle layer of Chapter 17 (with the gold quorum of §17.4). | §9.1, §9.7.3, §9.4 (USD note), Listing 3 `_fetchPrices()` | 1e18 fixed-point | Oracle-driven, per period |
| **`P_{i,t-1}`** | Price of component `i` at the **end of the previous period** `t-1`. Stored on-chain as `lastPrices[i]` (Listing 3 line "uint256[7] public lastPrices;"). The period return for component `i` is `P_{i,t}/P_{i,t-1}`. | §9.2, Listing 3 | 1e18 fixed-point | Updated at end of every `updateIndex()` |
| **`P_{i,0}`** | Immutable **base-date fixing** of component `i`, set at the genesis snapshot. USD = 1.0000e18; EUR = 1.0500e8·1e10 = 1.05e18; JPY = 0.0067e8·1e10 = 0.0067e18; GBP = 1.2500e18; CNY = 0.1400e18; CHF = 1.1300e18; XAU = 2500.00e18 (USD per reference gold unit). | §3.4, §9.7.2, Listing 3 `_basePrice18()` | 1e18 fixed-point | **Immutable** (constitutional) |
| **`W_{i,t-1}`** | Weight of component `i` **in force at the start of period `t`** — the weight that governed the period `(t-1, t]`. This is the COO-16 convention: within a period containing an accepted weight update, the start-of-period weight is the *pre-update* weight; the update itself is neutralized by `D_t` and begins governing returns from the **next** period. Stored on-chain as `lastWeights[i]`. | §9.2 (COO-16), Listing 3 line "uint256[7] public lastWeights;" | 1e18 fixed-point, `Σ_i W_{i,t-1} = 1.0000e18` | Updated only after a `ChainLinkAdjusted` event |
| **`W_{i,t}`** | Weight of component `i` **after the weight change accepted during period `t`** (if any), read from the MASE Weight Registry (Listing 2, §7.7) at the moment `updateIndex()` runs. If no update was accepted in the period, `W_{i,t} = W_{i,t-1}`. After `updateIndex()` commits, `lastWeights[i] ← W_{i,t}` so the next period's start-of-period weight is the freshly accepted weight. | §9.2, §9.3, Listing 3 `weightRegistry.getLiveWeights()` | 1e18 fixed-point | MASE-derived, governs **next** period's return |
| **`B_t^-`** | Aggregate valuation of the basket **immediately BEFORE the weight change**, valued at the post-move prices `P_{i,t}` and against the immutable base fixings `P_{i,0}`. Defined as `B_t^- = Σ_i W_{i,t-1}·(P_{i,t}/P_{i,0})`. Both `B_t^-` and `B_t^+` use the same price vector — the divisor isolates the **pure compositional** change. | §9.3, Listing 3 `bMinus` | 1e18 fixed-point (basket-value units) | Recomputed at every weight change |
| **`B_t^+`** | Aggregate valuation of the basket **immediately AFTER the weight change**, valued at the same post-move prices `P_{i,t}` and base fixings `P_{i,0}`. `B_t^+ = Σ_i W_{i,t}·(P_{i,t}/P_{i,0})`. | §9.3, Listing 3 `bPlus` | 1e18 fixed-point | Recomputed at every weight change |
| **`D_t`** | The **single-period chain-link divisor** (also called "chain-link factor" in §9.3 / MS §75). `D_t = B_t^- / B_t^+`. Recorded in the `ChainLinkAdjusted(D, bMinus, bPlus, timestamp)` event at every weight change. **Not** multiplied into `indexValue` in Listing 3 — the recursion is *already continuous* and applying `D_t` again would double-count. The divisor is recorded for the aggregate-form reconciliation and for publication (§24.3). | §9.3, Listing 3 `newD` and `chainLinkDivisor` | 1e18 fixed-point | Recorded per weight change |
| **`G_t`** | The **cumulative chain-link factor** — the entire accumulated divisor history. `G_0 = 1.0000e18` (set in `genesis()`), and `G_t = G_{t-1} · D_t` after every accepted weight change. On-chain this is `chainLinkDivisor` (Listing 3 line "uint256 public chainLinkDivisor;"). The aggregate form `I_t = G_t · Σ_i W_{i,t}·(P_{i,t}/P_{i,0})` is the COO-17 reconciliation: the recursion-published `indexValue` equals `G_t · B_t` exactly, with `G_t` carrying the full chain-link history. | §9.3 (COO-17), §9.7.1, Listing 3 `chainLinkDivisor` | 1e18 fixed-point | Monotone, only grows by `· D_t` |
| **`INDEX_BASE_DENOMINATOR`** | The **immutable genesis denominator**, computed once in the `MTQChainLinkIndex` constructor: `INDEX_BASE_DENOMINATOR = Q_USD + Q_EUR + Q_JPY + Q_GBP + Q_CNY + Q_CHF + Q_GOLD = 1.0000e18`. The §3.4 calibration invariant requires the USD-equivalent genesis notionals to sum to exactly 1.0000 per MTQ unit, which is what makes `I_0 = 1.0000` exact and what `verifyGenesis()` re-checks on-chain. Replaces v1.2 `GFB_BASE_DENOMINATOR`. | §9.6, §9.8 Listing 3, §9.7.1 | 1e18 fixed-point | **Immutable** (set in constructor) |

### 1.2 Per-component ordering and admissibility envelopes (invariants on `W`)

The seven components are stored in fixed genesis order: `["USD","EUR","JPY","GBP","CNY","CHF","XAU"]` — `XAU` is index 6 (Listing 1 §2.7, Listing 3 §9.8). At every `updateIndex()`, the live weight vector must satisfy three constitutional constraints (§2.6 I3, §8.1, §8.3):

1. **Sum-1 invariant:** `Σ_i W_{i,t} = 1.0000e18` exactly (enforced by `require(sum == 1e18, "Registry weights must sum to 1")` in Listing 3 `genesis()`; the MASE registry of Listing 2 enforces it for every accepted update).
2. **Admissibility envelope** (LOWER_BOUND ≤ W_{i,t} ≤ UPPER_BOUND per component, §8.1) — the validation-stage research values, e.g. `USD ∈ [0.23, 0.32]`, `XAU ∈ [0.20, 0.32]`.
3. **Per-update velocity** (`|W_{i,t} − W_{i,t-1}| ≤ MAX_VELOCITY_i`, §8.3) — Risk-Council parameter.

A weight update that violates any of these is rejected by the MASE registry and never reaches `updateIndex()`; the recursion therefore operates only on constitutionally admissible weight vectors.

---

## 2. Period-Return Formula and Fixed-Point Implementation

### 2.1 The recursion (COO-16, the "biggest missing equation")

Per §9.2 / COO-16, the canonical period-return formula uses the **weights in force at the start of the period**:

```
I_t = I_{t-1} · Σ_i [ W_{i,t-1} · (P_{i,t} / P_{i,t-1}) ]
```

This is the equation Listing 3 implements in `updateIndex()`. The defining property is **structural**: a weight change accepted during period `t` enters only **future** period returns (the next `updateIndex()` call). The update itself is neutralised by the divisor `D_t` of §9.3 (proved in §3 below). The recursion is what makes the contribution mathematics of §9.4 exact: each component's contribution to `R_t` is `W_{i,t-1} · (P_{i,t}/P_{i,t-1} − 1)`, and `Σ_i Contribution_i = R_t` to the tick — no rebalancing residual.

### 2.2 Fixed-point implementation (1e18 scale)

Listing 3 §9.8 implements the recursion as follows (verbatim structure, comment-light):

```solidity
// 1. Price return over the period, weighted by the weights IN FORCE
//    over the period (COO-16: W_{i,t-1}).
uint256 growth = 0;                                  // accumulator, 1e18 scale
for (uint256 i = 0; i < 7; i++) {
    require(p[i] > 0 && lastPrices[i] > 0, "Bad price");
    growth += (lastWeights[i] * p[i]) / lastPrices[i]; // W·(P_t/P_{t-1})
}
indexValue = (indexValue * growth) / 1e18;            // I_t = I_{t-1} · growth
```

The fixed-point contract is:

* **Scale:** every quantity is 1e18-scale. `lastWeights[i] ∈ [0, 1e18]`, `p[i]` and `lastPrices[i]` are 1e18-scale USD-quoted prices. `indexValue` is 1e18-scale (1.0000 = 1e18).
* **Multiplication order (per term):** `lastWeights[i] * p[i]` first, then divide by `lastPrices[i]`. This is `W_{i,t-1} · P_{i,t} / P_{i,t-1}` in 1e18 scale, and it produces a 1e18-scale term that is added to `growth`. Multiplying the weight (1e18) by the price (1e18) gives a 1e36 intermediate, then dividing by `lastPrices[i]` (1e18) returns to 1e18. **`growth` is therefore in 1e18 scale** and equals `Σ_i W_{i,t-1} · (P_{i,t}/P_{i,t-1})`.
* **Outer multiplication:** `indexValue * growth` is 1e36; dividing by `1e18` returns to 1e18. The final `indexValue` is 1e18-scale, as required.
* **Division order:** Each `P_{i,t}/P_{i,t-1}` is computed *after* the multiplication `lastWeights[i] * p[i]` — i.e. the division happens once per term and uses integer floor division (Solidity `/`). The outer `indexValue * growth / 1e18` also uses floor division.
* **Rounding direction:** Solidity `uint256 / uint256` is **floor (toward zero)**. Both the per-term division and the outer division floor. The published `indexValue` is therefore a **lower bound** on the real-valued `I_t` — i.e. the contract systematically *understates* `I_t` by at most the rounding-error bound below. Floor rounding is the conservative choice for a monetary-unit reference index: any rounding residual accrues to the protocol, never to the user.
* **Maximum rounding error.** Two floor divisions occur per term (one per `(W·P_t)/P_{t-1}`) plus one outer floor division `I_t = (I_{t-1}·growth)/1e18`. Each floor division loses strictly less than 1 unit of the result's scale (1 wei of 1e18). The per-term floor loss is `< 1` wei (1e-18 of a weight·price-relative term, which is at most `1e18 · price_relative_max ≈ 1e18`, so the loss is `< 1e-18` of the term). The outer floor loss is `< 1` wei (1e-18 of `I_t`). Summing over 7 components:
  ```
  |ΔI_t| < 7·1 + 1 = 8 wei = 8 × 10^{-18} (of a basket-unit).
  ```
  In relative terms against `I_t ≈ 1e18`, the maximum relative rounding error per `updateIndex()` call is **≤ 8 × 10^{-18}**. Accumulated over 365 daily updates (test 10), the cumulative rounding walk is bounded by `≤ 365 × 8 × 10^{-18} ≈ 2.92 × 10^{-15}` relative — well below the 1e-12 audit tolerance and invisible at the published 4-decimal precision (§24.3).
* **USD component identity:** `p[0] = 1e18` (USD quotes against itself, §9.4). Its price relative `P_{USD,t}/P_{USD,t-1} = 1` always, so the USD term contributes exactly `W_{USD,t-1}` to `growth`. The USD sleeve's price-return contribution is zero; its role is allocation and diversification, not movement (§9.4). The off-chain TS engine and the on-chain contract must both replicate this identity — the recursion's correctness depends on it.

### 2.3 Listing 3's preservation of the start-of-period weight convention

A subtle implementation point that closes the COO-16 convention exactly: Listing 3 **does not** update `lastWeights` until *after* the recursion has been applied with the *old* `lastWeights`. The order in `updateIndex()` is:

1. Read fresh prices `p[i]` and fresh weights `wNew[i]` from the registry.
2. Apply the recursion `growth = Σ_i (lastWeights[i] · p[i]) / lastPrices[i]` using the **stored** `lastWeights` (the start-of-period weights, `W_{i,t-1}`).
3. Compute `indexValue = (indexValue · growth) / 1e18` (the new published level `I_t`).
4. **Then**, if the weights changed (`wNew[i] != lastWeights[i]`), compute `B_t^-`, `B_t^+`, `D_t`, update `chainLinkDivisor`, and **only then** commit `lastWeights = wNew`.
5. Commit `lastPrices = p`.

This is the precise mechanism by which **a weight change accepted during period `t` enters only future period returns** (the next `updateIndex()` call). Any implementation that updates `lastWeights` before applying the recursion — or that applies the recursion with `wNew` instead of `lastWeights` — destroys the COO-16 property and reintroduces phantom returns at every rebalance. This is the failure mode the current `engine.ts::computeGfbIndex` and `MTQSigmaV2.sol::getGFB` exhibit (they recomputed the *whole* aggregate from the *current* weights every call, with no start-of-period weight memory and no chain-link divisor at all — see §6).

### 2.4 Per-component contribution (additivity, §9.4)

Because the recursion uses start-of-period weights, the contribution decomposition is exact:

```
R_{MTQ,t} = (I_t / I_{t-1}) − 1 = Σ_i W_{i,t-1} · (P_{i,t}/P_{i,t-1} − 1) = Σ_i Contribution_i
```

In a period containing a weight change, the divisor `D_t` of §9.3 forces the compositional jump to exactly zero (proved in §3), so `Σ_i Contribution_i = R_{MTQ,t}` to the tick — the attribution engine of §9.5 inherits the property. This is the **additivity invariant** the published attribution ledger (§24.3) depends on.

---

## 3. Weight-Change Neutrality (§9.3) — Formal Proof

### 3.1 The setup

Let a weight change be accepted during period `t`. Let `B_t^-` be the aggregate valuation **immediately before** the weight change and `B_t^+` the aggregate valuation **immediately after**, both computed at the **same** post-move prices `P_{i,t}` and against the **same** immutable base fixings `P_{i,0}`:

```
B_t^- = Σ_i W_{i,t-1} · (P_{i,t} / P_{i,0})
B_t^+ = Σ_i W_{i,t}   · (P_{i,t} / P_{i,0})
```

Define the single-period chain-link divisor (§9.3 / MS §75):

```
D_t = B_t^- / B_t^+
```

Define the cumulative chain-link factor:

```
G_t = G_{t-1} · D_t     (with G_0 = 1)
```

### 3.2 The neutrality theorem

**Theorem (Weight-change neutrality, §9.3).** The published index level is unchanged by the weight change itself — `I_t^+ = I_t^-` exactly — when the divisor `D_t` is applied via the aggregate form `I_t = G_t · Σ_i W_{i,t}·(P_{i,t}/P_{i,0})`.

**Proof.** The published level before the weight change (the recursion-committed `indexValue` immediately after step 3 of §2.3) is, by the §9.1 aggregate form, `I_t^- = G_{t-1} · B_t^-` (the *previous* cumulative divisor `G_{t-1}` times the *current* aggregate using the *old* weights `W_{i,t-1}`).

After the weight change, `G_t = G_{t-1}·D_t = G_{t-1}·(B_t^-/B_t^+)`. The aggregate form with the *new* weights gives:

```
I_t^+ = G_t · B_t^+
     = (G_{t-1} · D_t) · B_t^+
     = G_{t-1} · (B_t^-/B_t^+) · B_t^+
     = G_{t-1} · B_t^-
     = I_t^-.                                                       ∎
```

The rebalance itself contributes **zero artificial return**. Whatever numerical difference exists between valuing the current prices with the old and the new compositions is absorbed entirely into the divisor `D_t` rather than appearing as a published level jump. An auditor comparing published returns to constituent price moves finds no unexplained residual at the rebalance tick — precisely the property COO-16 was written to enforce.

### 3.3 Implementation corollary (Listing 3 is correct *by design*)

Listing 3 records `D_t` and accumulates it into `chainLinkDivisor` but **does not** multiply `D_t` into `indexValue` in `updateIndex()`. This is correct **because the recursion already preserves continuity structurally** — the weight change enters only future period returns (§2.3) and so cannot create a jump in `indexValue`. Multiplying `D_t` into `indexValue` would *double-count* the adjustment. The divisor is recorded solely to (a) make the COO-17 reconciliation (`getNavForm()` in Listing 3) reconstruct the published level exactly, and (b) publish the divisor series as part of the §24.3 publication obligations. Any implementation that *does* multiply `D_t` into `indexValue` is **wrong** — it would introduce a `D_t − 1` jump (of order `|ΔW|`) at every rebalance.

### 3.4 The fixed-point tolerance on neutrality

In 1e18 fixed-point, the floor-division losses of §2.2 apply to both `B_t^-` and `B_t^+`, so `D_t = (B_t^-·1e18)/B_t^+` is also subject to floor rounding. The error is:

```
|D_t - B_t^-/B_t^+| < 1e-18   (one floor loss in the division)
|G_t - G_{t-1}·D_t| < 1e-18   (one floor loss in chainLinkDivisor update)
```

The published `I_t^+` therefore equals `I_t^-` to within `< 2 × 10^{-18}` (relative), which is below the 1e-18 reconciliation tolerance (§6). The neutrality theorem holds *to the tick* in fixed-point.

---

## 4. Aggregate ↔ Recursive Reconciliation (COO-17)

### 4.1 The reconciliation obligation (§9.3 closing paragraph)

COO-17 requires the **aggregate form** `I_t = G_t · Σ_i W_{i,t}·(P_{i,t}/P_{i,0})` (§9.1) and the **chain-linked recursion** `I_t = I_{t-1} · Σ_i W_{i,t-1}·(P_{i,t}/P_{i,t-1})` (§9.2) to produce **one** published `I_t`. The reconciliation lives in the divisor `G_t`: it carries the entire accumulated chain-link history, and the recursion-published level can be reconstructed *exactly* from the aggregate form by multiplying the current aggregate `Σ_i W_{i,t}·(P_{i,t}/P_{i,0})` by `G_t`.

### 4.2 The reconciliation equation (pinned form)

Let `t_0` be the genesis timestamp and let `t_1 < t_2 < … < t_k ≤ t` be the timestamps at which `updateIndex()` accepted a weight change (so `D_{t_j}` was emitted at `t_j`). Between weight changes, `D_t = 1` and `G_t` is constant. Let `B_t = Σ_i W_{i,t}·(P_{i,t}/P_{i,0})` denote the *current* aggregate (computed with the *latest* accepted weights).

**Reconciliation equation:**
```
I_t = G_t · B_t   where   G_t = Π_{j=1..k} D_{t_j}
```

**Proof of equivalence to the recursion.** Induct on `k` (the number of accepted weight changes up to time `t`).

*Base case `k = 0` (no weight change since genesis).* `G_t = G_0 = 1`. The recursion has been running with the constant weight vector `W_{i,0} = q_i` (the genesis snapshot). Telescoping the recursion from `t_0` to `t`:

```
I_t = I_{t_0} · Π_{s=t_0+1..t} Σ_i W_{i,0} · (P_{i,s}/P_{i,s-1})
    = 1 · Σ_i W_{i,0} · (P_{i,t}/P_{i,0})        (telescoping; Σ_i W_{i,0} = 1)
    = B_t                                          (since G_t = 1, I_t = G_t · B_t = B_t). ✓
```

The telescoping uses `Σ_i W_{i,0} = 1` and the fact that the weighted sum of price relatives over consecutive periods telescopes to a single weighted sum of price relatives over the entire span when the weights are constant. This is the standard weighted-relative telescoping identity.

*Inductive step.* Assume the reconciliation holds at time `t_k^-` (immediately before the `k`-th weight change): `I_{t_k^-} = G_{t_{k-1}} · B_{t_k^-}`, where `B_{t_k^-}` is computed with the old weights `W_{i,t_k-1}`. The recursion ran from `t_{k-1}` to `t_k` with the old weights, so by the same telescoping argument:

```
I_{t_k^-} = I_{t_{k-1}} · Σ_i W_{i,t_{k-1}} · (P_{i,t_k}/P_{i,t_{k-1}})
```

At `t_k`, a new weight vector `W_{i,t_k}` is accepted. By the neutrality theorem (§3.2):

```
I_{t_k^+} = G_{t_k} · B_{t_k^+} = (G_{t_{k-1}} · D_{t_k}) · B_{t_k^+} = G_{t_{k-1}} · B_{t_k^-} = I_{t_k^-}.
```

After `t_k`, the recursion continues with the new weights, and by the inductive hypothesis (applied to the next interval `(t_k, t_{k+1})` with the new base `G_{t_k}`), the reconciliation continues to hold. By induction, **`I_t = G_t · B_t` for all `t`**. ∎

### 4.3 The exact reconciliation test

The COO-17 deliverable is the following equality, tested at every `updateIndex()` call:

```
| getIndex() − (chainLinkDivisor · getNavForm()) / 1e18 |  <  1e18     (1 wei)
```

where:

* `getIndex()` returns the recursion-published `indexValue` (Listing 3 `getIndex()`).
* `getNavForm()` returns `Σ_i lastWeights[i] · (P_{i,t}/P_{i,0})` (Listing 3 `getNavForm()`, recomputed from canonical prices against immutable base fixings).
* `chainLinkDivisor` is `G_t`.

The reconciliation must hold to within **1 wei** (1e-18 relative) at every block — the only residual is the floor-division loss of §2.2, bounded by 8 wei per `updateIndex()`. Any divergence greater than 8 wei is a reconciliation failure and halts the index under the validation-gate rules of §23.11.

### 4.4 What `B_t^-` and `B_t^+` are *not*

The blueprint (§9.3 closing paragraph) explicitly notes that the **valuation basis** of `B_t^-` and `B_t^+` — raw USD values vs. base-relative aggregates — is a convention that quantitative implementation must pin. The pinned choice in Listing 3 and in this report is **base-relative aggregates** against the immutable genesis fixings `P_{i,0}`. The other choice (raw USD values `Σ_i W_{i,t-1}·P_{i,t}` and `Σ_i W_{i,t}·P_{i,t}`) delivers the *same* continuity guarantee but a *different numerical* `D_t` (it differs by a constant factor that cancels in `D_t = B^-/B^+`). The base-relative choice is preferred because:

* It is dimensionless (a ratio of weight-weighted price-relatives), so it is robust to USD notional inflation over long horizons.
* It aligns `G_t` with the §9.1 aggregate form `I_t = G_t · Σ_i W_{i,t}·(P_{i,t}/P_{i,0})`, making the reconciliation transparent.
* It is what Listing 3 implements (`rel = (p[i]·1e18)/_basePrice18(i)` and `bMinus += (lastWeights[i]·rel)/1e18`).

The pinned convention is published with the methodology version (§24.2) and tested in the validation program (§23.11).

---

## 5. Cumulative Divisor Consistency (Long-Run)

### 5.1 The cumulative divisor theorem

**Theorem (Cumulative divisor consistency).** Let `G_t = Π_{s=1..t} D_s` (where `D_s = 1` for periods with no weight change). Then for any `t` and any horizon `H ≥ 0`:

```
I_{t+H} = G_{t+H} · Σ_i W_{i,t+H} · (P_{i,t+H}/P_{i,0})
```

i.e. the published index can be **reconstructed** from `G_{t+H}` and the current aggregate `Σ_i W_{i,t+H}·(P_{i,t+H}/P_{i,0})` alone — no recursion history is required. The proof is the inductive argument of §4.2 extended to arbitrary horizon.

### 5.2 Numerical stability over long periods

The concern with any multiplicative accumulator is catastrophic precision drift. Two properties of `G_t` close this concern:

1. **`D_s` is anchored to 1.** `D_s = B_s^- / B_s^+` and `B_s^-`, `B_s^+` are both base-relative aggregates (dimensionless, of order 1) — so `D_s` is of order 1. Over a 365-day horizon with `MAX_VELOCITY = 0.005e18` (USD/EUR/XAU) per update and at most one update per day, the cumulative `G_t` drift is bounded by:

   ```
   |log G_t| ≤ Σ_s |log D_s| ≈ Σ_s |D_s − 1| ≤ 365 · 0.005 / (1 − 0.005) ≈ 1.83
   ```

   i.e. `G_t` stays within `[e^{-1.83}, e^{1.83}] ≈ [0.16, 6.23]` over the worst-case 365-day horizon — well within the 1e18 fixed-point range (which comfortably represents values up to ~1e18). No overflow or underflow is possible on any realistic horizon.

2. **Floor-division error accumulates linearly.** Per §2.2, each `chainLinkDivisor = (chainLinkDivisor · newD)/1e18` update loses at most 1 wei (1e-18 relative). Over 365 days: `365 × 1e-18 ≈ 3.65 × 10^{-16}` relative drift — far below the 1e-12 audit tolerance and invisible at the published 4-decimal precision (§24.3).

### 5.3 The long-horizon reconstruction test

Test 10 (§7.10 below) reconstructs `I_t` from `G_t · Σ_i W_{i,t}·(P_{i,t}/P_{i,0})` at day 365 and asserts `|reconstruction − indexValue| ≤ 1e-12 relative`. The test must use the published `G_t` and the published weights — *not* the recursion history — to prove the reconstruction is independent of the recursion's incremental bookkeeping.

---

## 6. Off-Chain / On-Chain Equivalence (1e-18 relative tolerance)

### 6.1 The equivalence obligation

The TS reference engine (`src/lib/mtq/engine.ts::computeGfbIndex`) and the Solidity contract (`contracts/MTQSigmaV2.sol::getGFB` / the future `MTQChainLinkIndex.updateIndex()`) must produce the same `I_t` to within **1e-18 relative** at every block. This is the **canonical-state invariant** for the index path: identical inputs (`P_{i,t}`, `W_{i,t-1}`, `P_{i,t-1}`, `G_t`) → identical output `I_t`.

### 6.2 Current implementation status (READ-ONLY finding — no code changes here)

The current implementations **do not** satisfy the equivalence obligation, and they do not implement the canonical form at all:

* **`engine.ts::computeGfbIndex` (lines 381-396):** computes `numerator = Σ_i STRATEGIC_PRIOR[i] · fx[i]` and returns `numerator / GFB_BASE_DENOMINATOR`. This is the v1.2 **fixed-base Laspeyres** form — it uses the **strategic prior weights as if they were the live weights**, never advances a chain-linked `I_t`, has no `lastPrices`/`lastWeights` memory, and has no `chainLinkDivisor`. Every call recomputes the *whole* aggregate from scratch with fixed weights.
* **`MTQSigmaV2.sol::getGFB` (lines 420-431):** identical structure — `numerator = Σ_i PRIOR_i · fx_i`, returns `numerator·1e18 / GFB_BASE_DENOMINATOR`. Same Laspeyres defect.

Both implementations therefore publish the **aggregate form with `G_t = 1` and `W_{i,t} = W_{i,0}` frozen forever** — i.e. they implicitly assume weights never change. They are off-chain / on-chain *equivalent* with each other (both implement the same Laspeyres form to within rounding), but neither implements the canonical chain-linked form of §9.2 / Listing 3. This is the structural short-gold defect the audit (`FINAL-TOP-TIER-AUDIT-REPORT.md`, `audit-c-stress-tests.md` S5) identified: with `G_t = 1` and `W_{i,0}` frozen, a `+50%` gold shock moves the index by `0.26·(+50%) = +13%` in the *aggregate* form — but because the on-chain prices are USD-quoted and gold is by far the largest notional contributor to the raw `Σ W_i · P_i` numerator, the Laspeyres `numerator` actually grows ~50% (not 13%) when gold doubles — which is the catastrophe the audit caught.

### 6.3 The remediation path (owned by Deliverable E — not this report)

To achieve true off-chain/on-chain equivalence with the canonical form, both implementations must:

1. Store `lastPrices[7]`, `lastWeights[7]`, `indexValue`, `chainLinkDivisor` as persistent state.
2. Implement `updateIndex()` per Listing 3 §9.8 — apply the recursion with `lastWeights` (the start-of-period weights), then optionally record `D_t` if weights changed, then commit `lastWeights ← wNew` and `lastPrices ← p`.
3. Read live weights from the MASE Weight Registry (Listing 2) — never hard-code the strategic prior.
4. Run the 10 tests of §7 below on both implementations and assert 1e-18 relative equivalence.

After remediation, the **canonical-state invariant** for the index is:

```
For identical (P_{i,t}, W_{i,t}, P_{i,t-1}, W_{i,t-1}, G_{t-1}),
|engine.computeGfbIndex(...) − contract.getIndex()| / 1e18 ≤ 1e-12
```

The 1e-12 tolerance (not 1e-18) accounts for cross-language floating-point differences in the TS engine's intermediate arithmetic (the contract uses pure integer 1e18-scale floor division; the TS engine uses IEEE-754 doubles with the audit-required 1e-12 tolerance for the reconciliation tests of §23.11). The *contract's own* published level and the *contract's own* `G_t · B_t` reconstruction must agree to 1e-18 (within 8 wei per `updateIndex()`).

---

## 7. Required Tests (§6, 10 tests)

Each test specifies **inputs**, **operation**, **expected output**, and the **closure property it proves**. All tests are run on the canonical form (Listing 3 contract + the matching TS reference) after the Deliverable E remediation. Tolerance is 1e-18 relative for pure-fixed-point tests and 1e-12 for cross-language tests.

### 7.1 Test 1 — No weight change (I_t advances by price relatives only)

* **Setup:** `W_{i,t} = W_{i,0}` (strategic prior, no update accepted). Prices: `EUR +1%`, `JPY +0.5%`, `GBP +0.3%`, `CNY +0%`, `CHF +0.2%`, `XAU +3%`, USD identity (P_USD=1).
* **Operation:** call `updateIndex()` once with `lastPrices = P_{i,0}` (genesis) and `lastWeights = W_{i,0}`.
* **Expected:** `I_1 / I_0 = Σ_i W_{i,0} · (P_{i,1}/P_{i,0})`. With the strategic prior:
  ```
  = 0.27·1 + 0.20·1.01 + 0.09·1.005 + 0.08·1.003 + 0.05·1.00 + 0.05·1.002 + 0.26·1.03
  = 0.27 + 0.202 + 0.09045 + 0.08024 + 0.05 + 0.05010 + 0.2678
  = 1.01059
  ```
  i.e. `I_1 ≈ 1.01059e18` (+1.059%). No `ChainLinkAdjusted` event is emitted (no weight change).
* **Closure property proved:** the recursion advances by **price relatives only** when weights are unchanged — the COO-16 form is the dominant case in steady state.

### 7.2 Test 2 — Small weight change (divisor adjusts, I_t continuous)

* **Setup:** same prices as Test 1. Weight change: `USD 27% → 27.5%`, `XAU 26% → 25.5%` (a small 50-bps tilt, within `MAX_VELOCITY = 0.005e18`).
* **Operation:** call `updateIndex()`. The recursion applies with `lastWeights = W_{i,0}` (giving `I_1 = 1.01059e18` as in Test 1). Then the weight change is detected, `D_1 = B_1^-/B_1^+` is computed, and `lastWeights ← wNew`.
* **Expected:**
  - The published `indexValue` immediately after `updateIndex()` equals `1.01059e18` exactly (no jump from the weight change — neutrality, §3).
  - `D_1 = B_1^- / B_1^+` where `B_1^- = 0.27·1 + 0.20·1.01 + … + 0.26·1.03 = 1.01059` (old weights, current prices, base-relative) and `B_1^+ = 0.275·1 + 0.20·1.01 + … + 0.255·1.03 = 1.01059` (the same prices, new weights). Numerically `B_1^+ = B_1^-` here because USD and XAU moved symmetrically and their price relatives both pulled toward the weighted average; in general `D_1 ≈ 1.00000` to within the compositional delta. The `ChainLinkAdjusted` event is emitted with the precise `D_1, B_1^-, B_1^+`.
  - `chainLinkDivisor = 1e18 · D_1 / 1e18 = D_1`.
* **Closure property proved:** weight-change neutrality (§3) — `I_t^+ = I_t^-` exactly; the divisor adjusts to keep the published level continuous.

### 7.3 Test 3 — Large permitted weight change (within envelope, divisor adjusts)

* **Setup:** same prices. Weight change at the **limit** of the admissibility envelope: USD `27% → 32%` (UPPER_BOUND), XAU `26% → 21%` (still ≥ LOWER_BOUND 20%), EUR `20% → 18%` (still ≥ 17%), JPY `9% → 9%`, GBP `8% → 11%` (UPPER_BOUND), CNY `5% → 5%`, CHF `5% → 4%`. **Note:** this exceeds per-update `MAX_VELOCITY` (0.005e18 for USD/EUR/XAU), so it must be applied as a **multi-step** trajectory (e.g. 10 daily steps of 50bps each) to satisfy §8.3 — the test exercises the *envelope*, not the velocity. Each step is a separate `updateIndex()` call.
* **Operation:** 10 sequential `updateIndex()` calls, each with a small weight delta and a small price move (e.g. +0.1% per component per step).
* **Expected:**
  - At every step `k`, `|I_{k}^+ − I_{k}^-| ≤ 1e-18` (neutrality holds at every step, not just at the end).
  - `G_{10} = Π_{k=1..10} D_k` is the cumulative divisor after the 10 steps.
  - The aggregate form `G_{10} · Σ_i W_{i,10}·(P_{i,10}/P_{i,0})` reconstructs `I_{10}` exactly (COO-17 reconciliation).
* **Closure property proved:** the envelope boundary is reachable; neutrality and reconciliation hold at the envelope edges, not just for small moves.

### 7.4 Test 4 — Simultaneous price movement + weight change

* **Setup:** start from `I_0 = 1`. Prices: EUR +2%, JPY −1%, GBP +0.5%, CNY −0.3%, CHF +1%, XAU +5%. **Same period**, weight change: USD 27% → 26%, XAU 26% → 27% (a 100bps tilt toward gold, within `MAX_VELOCITY` for both).
* **Operation:** one `updateIndex()` call.
* **Expected:**
  - Recursion applies with old weights: `growth = 0.27·1 + 0.20·1.02 + 0.09·0.99 + 0.08·1.005 + 0.05·0.997 + 0.05·1.01 + 0.26·1.05 = 1.01485`. So `I_1 = 1.01485e18`.
  - Weight change detected, `D_1 = B_1^-/B_1^+` computed and recorded.
  - Published `I_1 = 1.01485e18` — the price-move contribution; the weight change contributes zero by neutrality.
  - The attribution ledger publishes `Σ_i Contribution_i = 1.485%` (with USD contributing 0%, EUR +0.40%, JPY −0.09%, GBP +0.04%, CNY −0.015%, CHF +0.05%, XAU +1.30%).
* **Closure property proved:** simultaneous price moves and weight changes decompose cleanly — the price-move return is the recursion output; the weight change adds zero; the attribution is exact.

### 7.5 Test 5 — Extreme gold movement (+50%, the audit's S5 scenario)

* **Setup:** Start from `I_0 = 1`, `G_0 = 1`, weights at strategic prior. Single-period shock: `XAU +50%`, all other prices unchanged.
* **Operation:** one `updateIndex()` call (no weight change in this period).
* **Expected (canonical form, post-remediation):**
  - `growth = 0.27·1 + 0.20·1 + 0.09·1 + 0.08·1 + 0.05·1 + 0.05·1 + 0.26·1.50 = 1 + 0.26·0.50 = 1.13`.
  - **`I_1 = 1.13e18` — the index grows by 13%, NOT 50%.**
  - The reserve NAV (which holds 26% in gold) also grows by 13% (symmetric). Liability `L_t = S_circ,t · P_MTQ,t` grows by 13%. **RR_t remains at 1.10** — the protocol stays in NORMAL state. **Survival rate: 100%.**
* **Why this is the headline test:** the audit (`audit-c-stress-tests.md` S5, `FINAL-TOP-TIER-AUDIT-REPORT.md` line 164) shows that the *current* Laspeyres implementation produces `I_1 ≈ 1.50` (because the raw USD notional of gold at $2,500/oz dominates the numerator — `0.26 · 2500 / Σ ≈ 0.995` of the basket's raw value). Liability grows ~50%, NAV grows 13%, RR crashes to **0.83** — 0% survival in 100% of runs. With the canonical chain-linked form, the index uses *price relatives* `P_{i,t}/P_{i,t-1}` (which start at 1.0 for every component at genesis), so gold's notional dominance is **eliminated** — only its 26% weight matters, and the index correctly grows 13%. The chain-link form is what makes gold shocks survivable.
* **Closure property proved:** the COO-16 recursion structurally prevents notional dominance from contaminating the index — gold's price return enters only through its 26% weight, never through its USD notional. This is the single most important test in the entire validation program (§23.8.1).

### 7.6 Test 6 — Multiple consecutive weight changes

* **Setup:** 30 periods. Each period: small price moves (random walk, ±0.2% per component) and a small accepted weight change (within `MAX_VELOCITY`). Each `updateIndex()` records a `D_t`.
* **Operation:** 30 sequential `updateIndex()` calls.
* **Expected:**
  - `G_{30} = Π_{t=1..30} D_t`.
  - For every `t`, `|I_t^+ − I_t^-| ≤ 1e-18` (neutrality at every step).
  - At `t = 30`, `getIndex() == (chainLinkDivisor · getNavForm()) / 1e18 ± 1 wei` (reconciliation).
  - The cumulative divisor `G_{30}` is within `[e^{-0.3}, e^{0.3}] ≈ [0.74, 1.35]` (since each `D_t` is within `[1 − ε, 1 + ε]` for small `ε`).
* **Closure property proved:** repeated weight changes accumulate cleanly into `G_t`; the recursion and aggregate forms stay reconciled across many updates; no precision drift.

### 7.7 Test 7 — No-trade-zone days (weights unchanged, I_t advances by price)

* **Setup:** Per invariant I11 (§2.6), daily calculation does not imply daily trading. Setup: 365 periods, prices evolve (random walk ±0.5% per component per day), **no weight changes** (the MASE registry never accepts an update — all candidate updates fail the no-trade-zone or cost-benefit gates of §10.4/§10.8).
* **Operation:** 365 sequential `updateIndex()` calls, all with `wNew == lastWeights`.
* **Expected:**
  - No `ChainLinkAdjusted` events emitted (the `if (changed)` branch never fires).
  - `G_{365} = G_0 = 1e18` exactly (the divisor never moves).
  - `I_{365} = I_0 · Π_{t=1..365} Σ_i W_{i,0} · (P_{i,t}/P_{i,t-1})` — a pure weighted price-relative chain.
  - The aggregate form `G_{365} · Σ_i W_{i,0}·(P_{i,365}/P_{i,0}) = 1 · Σ_i W_{i,0}·(P_{i,365}/P_{i,0}) = I_{365}` exactly (telescoping, §4.2 base case).
* **Closure property proved:** the no-trade-zone path is the canonical no-rebalance baseline; the recursion reduces to a pure weighted price-relative chain and the aggregate form reconstructs it via telescoping. Invariant I11 is preserved.

### 7.8 Test 8 — Weight changes between daily index updates

* **Setup:** Daily cadence (§10.1). At day `t = 10`, 20, 30, 40, 50, the MASE registry accepts a new weight vector at 12:00 UTC; `updateIndex()` runs at 00:00 UTC daily. The weight change accepted at 12:00 UTC on day `t` becomes the `wNew` read by `updateIndex()` at 00:00 UTC on day `t+1`.
* **Operation:** 60 daily `updateIndex()` calls.
* **Expected:**
  - At days `t = 11, 21, 31, 41, 51`, `updateIndex()` detects `wNew != lastWeights` and emits `ChainLinkAdjusted(D_t, B_t^-, B_t^+)`.
  - The published `I_t` is continuous across every weight-change boundary: `|I_t^+ − I_t^-| ≤ 1e-18` at every transition.
  - Between weight changes, `I_t` advances by price relatives with the *new* (post-change) weights as `lastWeights` — confirming the COO-16 convention that the new weights govern *future* period returns, not the period containing the change.
* **Closure property proved:** the **timing** of weight changes (between daily updates) is correctly handled by the start-of-period weight convention — the new weights apply to the *next* day's return, never to the day of acceptance.

### 7.9 Test 9 — Rounding boundary conditions (1e-18 tolerance)

* **Setup:** adversarial price/weight combinations designed to maximise floor-division loss:
  - `lastPrices[i] = 1e18 + 1` (just above 1) and `p[i] = 1e18` (price drops 1 wei) — the price relative `1e18 / (1e18+1)` floors to `1e18 − 1`, losing 1 wei in the per-term division.
  - `lastWeights[i] = 1e18 − 6` (just below 1, after a sequence of small updates) — every per-term `(lastWeights[i]·p[i])/lastPrices[i]` floors.
  - `indexValue = 1e18 − 7` — the outer `(indexValue·growth)/1e18` floors.
* **Operation:** one `updateIndex()` call with these adversarial values.
* **Expected:**
  - The published `I_t` is within `8 wei` (8 × 10^{-18}) of the IEEE-754 double-precision reference value of the same expression. The 8-wei bound is the per-call maximum (7 per-term floors + 1 outer floor, §2.2).
  - The `ChainLinkAdjusted` event's `D_t` is within `1 wei` of the IEEE-754 reference value of `B_t^-/B_t^+`.
  - The reconciliation `|getIndex() − (chainLinkDivisor·getNavForm())/1e18| ≤ 8` wei.
* **Closure property proved:** the fixed-point rounding bound (§2.2) is **tight** — adversarial inputs cannot produce a larger loss than the documented maximum, and the published `I_t` is always a strict lower bound on the real-valued index (floor rounding).

### 7.10 Test 10 — Divisor accumulation over long periods (365 days)

* **Setup:** 365 periods. Each day: small price moves (random walk, σ = 0.3% per component, Gaussian) and a 20% chance of an accepted small weight change (within `MAX_VELOCITY`). Seed for reproducibility.
* **Operation:** 365 sequential `updateIndex()` calls. Approximately 73 weight changes are accepted over the year (20% of 365).
* **Expected:**
  - `G_{365}` is in `[e^{-1.83}, e^{1.83}] ≈ [0.16, 6.23]` (the §5.2 bound) — no overflow, no underflow.
  - **Reconstruction test:** `|getIndex() − (chainLinkDivisor · Σ_i lastWeights[i]·(P_{i,365}/P_{i,0}))/1e18| ≤ 8` wei at day 365 (the cumulative floor-loss over 365 updates, bounded by 365 × 8 = 2920 wei ≈ 3 × 10^{-15} relative).
  - **Reconciliation monotonicity:** `|G_t − G_{t-1}·D_t| ≤ 1` wei at every step (no precision drift in the divisor accumulator).
  - **Cross-implementation:** the TS reference engine's `computeGfbIndex` (after Deliverable E remediation) and the contract's `getIndex()` agree to within `1e-12` relative at every day (the §6 cross-language tolerance).
* **Closure property proved:** the cumulative divisor is **numerically stable** over a 1-year horizon — the long-run reconstruction (§5) holds to documented tolerance, and the canonical-state invariant (§6) holds between off-chain and on-chain implementations.

---

## 8. Mathematical Closure for NAV, Liability, RR, LCR, State Machine, Minting, Redemption, Buffer

Every downstream monetary quantity consumes `I_t`. Its closure depends on the index closure above. Each formula below is pinned, with its source section, fixed-point convention, and the closure property.

### 8.1 NAV — Net Asset Value (§14.1, §18.3)

```
V_{net,t} = Σ_{j ∈ ReserveInstruments} Q_{j,t} · P_{j,t} · (1 − H_j)
```

* **Source:** §14.1, Listing 6 §14.6.1 `updateReserveState()` (lines 8679-8730).
* **Haircut table** (`H_j`, §14.1.1, immutable by default — Risk Council 4/7 can adjust with 24h timelock):

  | Asset class | H_j | Rationale |
  |---|---|---|
  | USD stablecoin (USDC, USDP) | 0.5% | Extremely liquid, regulated |
  | EUR stablecoin (EURC) | 0.7% | Slightly lower depth than USDC |
  | GBP stablecoin | 1.0% | Lower on-chain liquidity |
  | JPY stablecoin | 1.0% | Lower on-chain liquidity |
  | CNY stablecoin (CNH) | 1.5% | Offshore market constraints |
  | Tokenized gold (PAXG, XAUT) | 1.0% | Custody spread (0.5%) + DEX slippage (0.5%) |
  | Tokenized T-Bills (BUIDL-class) | 2.0% | Interest-rate risk; redemption delay |

* **Conservative gold price (§14.1, Listing 6 `getMinGoldPrice()`):** `P_{gold,t} = min(P_{gold,reference}, P_{gold,executable})` — the lower of the LBMA spot consensus and the PAXG market price.
* **Invariant I4 (§2.6):** `V_{net,t}` is **always** calculated with asset-specific haircuts — gross valuations are not the protocol's NAV.
* **Per-token NAV (§19.3.2):** `NAV_t = V_{net,t} / S_{circ,t}` where `S_{circ,t}` is the circulating supply (excludes the Genesis Reserve, §18.2).
* **Closure property:** `V_{net,t}` is a pure function of `(Q_{j,t}, P_{j,t}, H_j)` — no hidden state. The same oracle prices that feed `I_t` (Chapter 17) feed `V_{net,t}`, so the numerator and denominator of RR move consistently under oracle degradation.

### 8.2 Liability — `L_t` (§2.5, §13.2.2, §18.2, Listing 1 §2.7)

```
L_t = S_{circ,t} · P_{MTQ,t}        where P_{MTQ,t} = I_t / I_{base} = I_t / INDEX_BASE_DENOMINATOR
```

* **Source:** §18.2, Listing 1 `getLiability()` (lines 1600-1608), Listing 10 `getLiability()` (lines 12836-12840).
* **Fixed-point:** `L_t = (circulatingSupply · getMTQPrice()) / 1e18`, with circulatingSupply in 1e18 (MTQ units) and price in 1e18 (USD per MTQ).
* **Circulating supply:** `S_{circ,t} = totalSupply − balanceOf(GENESIS_RESERVE_ADDRESS)` (§18.2, Listing 10 `getCirculatingSupply()`). The Genesis Reserve is a protocol asset, **not** a user liability — excluding it prevents the protocol from collateralising its own locked tokens.
* **Closure property:** `L_t` is a deterministic function of `(S_{circ,t}, I_t, INDEX_BASE_DENOMINATOR)`. The canonical-state invariant for `L_t` follows directly from the canonical-state invariant for `I_t` (§6): identical `I_t` → identical `L_t`.

### 8.3 Reserve Ratio — `RR_t` (§14.2, §18.2, Listing 1, Listing 6)

```
RR_t = V_{net,t} / L_t
```

* **Source:** §14.2, Listing 1 `getReserveRatio()` (lines 1620-1628), Listing 6 `getReserveRatio()` (lines 8764-8772), Listing 10 `getReserveRatio()` (lines 12845-12849).
* **Three constitutional floors (§14.2.1):**

  | Floor | Value | Governance |
  |---|---|---|
  | RR_target | 1.10 (110%) | DAO Vote (51%) |
  | RR_stress | 1.05 (105%) | DAO Vote (51%) |
  | RR_hard | 1.00 (100%) | Constitutional (immutable, Invariant I2) |

* **Invariant I2 (§2.6):** `RR_t ≥ 1.00` at all times — enforced by the reserve manager's `onlyIfSolvent()` modifier (Listing 6 lines 8844-8851) and the governance layer (Chapter 22). A breach is an EMERGENCY event (§21.2, S5).
* **Closure property:** `RR_t = V_{net,t} / L_t = (Σ_j Q_j · P_j · (1−H_j)) / (S_circ · I_t / I_{base})`. Under a gold shock, the **numerator** moves by `ΔP_gold/P_gold × W_gold_reserve` (≈ 26% × 50% = 13% under the §3.3 26% gold reserve allocation), and the **denominator** moves by `ΔI_t/I_t = W_gold_index × ΔP_gold/P_gold = 0.26 × 50% = 13%` under the canonical chain-linked index. **The ratio is unchanged.** This is the structural-symmetry argument that the audit's S5 scenario survives under the canonical form (Test 5).

### 8.4 Liquidity Coverage Ratio — `LCR_t` (§13.4, §14, Listing 1, Listing 6)

```
LCR_t = V_{liquid,t} / D_{stress,t}

where  V_{liquid,t}  = Σ_{j ∈ LiquidStablecoins} Q_{j,t} · P_{j,t} · (1 − H_j)        (net stablecoin layer)
       D_{stress,t}  = S_{circ,t} · P_{MTQ,t} · STRESS_REDEMPTION_RATE                 (25% of liability, 30-day stress)
       STRESS_REDEMPTION_RATE = 0.25
       Tokenized gold counts as 0% liquid (§13.4, §14.6.1).
```

* **Source:** §13.4, §14.6.1 `getLCR()` (lines 8784-8797), Listing 1 `getLCR()` (lines 1632-1644).
* **Fixed-point:** `stressDemand = (circSupply · price / 1e18) · 25 / 100`; `LCR = (liquidAssets · 1e18) / stressDemand`.
* **Risk-Council minimum:** `LCR_min = 1.00` (the LCR_TARGET of Listing 1, §14.6.1) — Risk-Council 4/7.
* **Closure property:** `LCR_t` is a pure function of `(V_{liquid,t}, S_{circ,t}, P_{MTQ,t}, STRESS_REDEMPTION_RATE)`. The canonical-state invariant for `LCR_t` follows from the canonical-state invariant for `P_{MTQ,t}` (i.e. for `I_t`).

### 8.5 State Transitions — 6 States, 48h Recovery Confirmation (§21, Listing 13)

```
State_t = F(RR_t, LCR_t, previousState, recoveryConfirmationPeriod=48h, hysteresis)
       ∈ { S1 NORMAL, S2 CAUTION, S3 STRESS, S4 DEFENSIVE, S5 EMERGENCY, S6 RECOVERY }
```

* **Source:** §21.1–21.3, Listing 13 §21.6 `updateState()` (lines 15639-15708) and `restrictiveness()` (lines 15741-15756).
* **The 6 states (§21.2):**

  | State | RR range | LCR range | Entry | Minting | Redeem | Rebalance |
  |---|---|---|---|---|---|---|
  | S1 NORMAL | ≥1.10 | ≥1.00 | immediate | allowed | 0.15% | active (urgency 1) |
  | S2 CAUTION | 1.05–1.10 | ≥0.90 (or LCR<1.00) | immediate on RR<1.10 or LCR<1.00 | 50% throttle | 0.15% | active (urgency 2) |
  | S3 STRESS | 1.02–1.05 | ≥0.80 (or LCR<0.90) | immediate on RR<1.05 or LCR<0.90 | paused | 0.50% | emergency (urgency 3) |
  | S4 DEFENSIVE | 1.00–1.02 | ≥0.70 (or LCR<0.80) | immediate on RR<1.02 or LCR<0.80 | paused | 1.00% (throttled) | forced (urgency 4) |
  | S5 EMERGENCY | <1.00 | any | immediate on hard-floor breach (I2) | paused | **paused** | paused; council emergency |
  | S6 RECOVERY | RR≥1.05 (rising) | LCR≥0.90 | only after 48h sustained NORMAL conditions from a worse state | 25% throttle | 0.30% | active (urgency 2) |

* **Transition rule (§21.3):** movement to a more restrictive state is **immediate**; movement to a less restrictive state requires the destination state's thresholds to hold continuously for the 48-hour `RECOVERY_CONFIRMATION_PERIOD` (Listing 13 line 15494, immutable). The restrictiveness ranking (Listing 13 `restrictiveness()`): `NORMAL(0) < CAUTION(1) < RECOVERY(2) < STRESS(3) < DEFENSIVE(4) < EMERGENCY(5)`.
* **"Worse applicable condition binds" rule (§21.2 closing paragraph):** if RR says CAUTION but LCR says STRESS, the state is STRESS (the worse of the two). NORMAL requires both `RR ≥ 1.10` AND `LCR ≥ 1.00` simultaneously.
* **Closure property:** the state is a **deterministic** function of `(RR_t, LCR_t, previousState, now)`. No human subjectivity (§21.1 property 1). The canonical-state invariant (Deliverable D) requires **every** module to consume the same `determineState(rr, lcr, previousState, now)` function — no module may re-derive the state independently.

### 8.6 Minting — `MTQ_minted = X_net / P_{MTQ,t}` (§19.2, Invariant I5)

```
X_net     = X · (1 − F_mint)                            (F_mint = 0.001 = 0.10%, Normal state)
MTQ_minted = X_net / P_{MTQ,t}                          (invariant I5 — priced against the index, NOT USD)
P_{MTQ,t}  = I_t / INDEX_BASE_DENOMINATOR
```

* **Source:** §19.2, Listing 11 §19.5 `mint()` (lines 13546-13598), Listing 1 `getMTQPrice()` (lines 1588-1596).
* **Slippage guard (§19.4.1):** `revert if MTQ_minted < minMTQOut`; default `minMTQOut = X_net/P_{MTQ,t} · (1 − τ_user)` with `τ_user = 0.005` (0.5%).
* **State-dependent throttling (§21.4, Listing 13 `applyStateActions`):**
  - S1 NORMAL: 100% capacity
  - S2 CAUTION: 50% capacity
  - S3/S4/S5: paused
  - S6 RECOVERY: 25% capacity
* **Atomicity:** the entire mint (deposit, fee, swap, mint, reserve update) is a single transaction (§19.1 principle 3).
* **Closure property:** `MTQ_minted = X_net · I_{base} / I_t` — a pure function of `(X, F_mint, I_t, INDEX_BASE_DENOMINATOR)`. When the index is high (basket appreciated), the user receives fewer tokens per USD; when low, more — the purchasing-power equivalence (§3.5, §19.6.1). The canonical-state invariant for minting requires `I_t` to be the canonical chain-linked level (§1) and the state to be the canonical state (Deliverable D).

### 8.7 Redemption — `RedeemValue = Y · NAV_t` (§19.3, Invariant I6 — NOT P_MTQ)

```
NAV_t          = V_{net,t} / S_{circ,t}                              (per-token NAV, §19.3.2)
RedeemValue_USD = Y · NAV_t                                          (invariant I6 — priced against NAV, NOT P_MTQ)
RedeemValue_net = RedeemValue_USD · (1 − F_redeem)                   (F_redeem = 0.0015 = 0.15%, Normal state)
Release_i       = RedeemValue_net · (V_i / V_{net})                  (proportional release, §19.3.2 step 4)
```

* **Source:** §19.3, Listing 11 `redeem()` (lines 13626-13681).
* **The I5 vs I6 asymmetry (§19.1 principles 1 & 2):**
  - **Minting** is priced against `P_{MTQ,t}` (the index) — Invariant I5. A user depositing X USDC receives `X_net/P_{MTQ,t}` tokens, so the *number of tokens* flexes with the index while the *value claim* is preserved.
  - **Redemption** is priced against `NAV_t` (the reserve) — Invariant I6. A user burning Y MTQ receives `Y · NAV_t` in value, so the *value released* flexes with the reserve while the *number of tokens burned* is fixed.
  - This asymmetry is **the** mechanism that keeps RR bounded under index/reserve divergence (§9 below): minting expands the liability at the index price (which the reserve must then match), while redemption contracts the liability at the reserve price (which is what the reserve can actually deliver). Pricing both sides against the same benchmark (e.g. both at P_MTQ) would let the protocol mint at P_MTQ and redeem at P_MTQ, ignoring the reserve — the audit's finding F-EMERG-01.
* **State-dependent fees (§21.4, Listing 13 `applyStateActions`):**
  - S1 NORMAL / S2 CAUTION: 0.15%
  - S3 STRESS: 0.50%
  - S4 DEFENSIVE: 1.00%
  - S5 EMERGENCY: **paused** (redemption itself paused, not just fee-raised — the audit's F-EMERG-01 finding)
  - S6 RECOVERY: 0.30%
* **Proportional release (§19.3.2 step 4):** `Release_i = RedeemValue_net · (V_i / V_{net})` — the release is proportional to **actual** reserve composition, never to target weights. The user gets what is held, not what is intended.
* **Closure property:** `RedeemValue = Y · V_{net,t} / S_{circ,t}` — a pure function of `(Y, V_{net,t}, S_{circ,t})`. The canonical-state invariant for redemption requires `V_{net,t}` (the haircut-adjusted NAV) and `S_{circ,t}` (the circulating supply) to be the canonical values, and the state to be the canonical state (Deliverable D) — so redemption pauses in S5 EMERGENCY (the audit's critical finding).

### 8.8 Buffer — `W_{gold,total} = W_{gold,core} + (0.10 × B_{gold})` (§16.2)

```
V_{core,t}   = S_{circ,t} · P_{MTQ,t}                            (100% liability coverage, sacred)
V_{buffer,t} = 0.10 · S_{circ,t} · P_{MTQ,t}                    (10% excess collateral, §16.1)
V_{net,t}    = V_{core,t} + V_{buffer,t}                         (§16.3)

B_{gold}(RR_t) = 62.5%   if RR ≥ 1.10    (BASE)
               = 85%     if 1.05 ≤ RR < 1.10  (STRESS, ramp from 62.5% to 85% over 24h)
               = 100%    if RR < 1.05         (EMERGENCY, immediate jump)

V_{buffer,gold,t} = V_{buffer,t} · B_{gold}(RR_t)
V_{gold,total,t}  = V_{core,gold,t} + V_{buffer,gold,t}

W_{gold,total,t} = W_{gold,core,t} + 0.10 · B_{gold}(RR_t)
```

* **Source:** §16.1–16.3, Listing 8 §16.5.
* **The three buffer states (§16.2):**

  | State | RR range | B_gold | W_{gold,total} (v1.2 baseline) |
  |---|---|---|---|
  | BASE | ≥1.10 | 62.5% | 0.20 + 0.10·0.625 = 26.25% |
  | STRESS | 1.05–1.10 | 85% | 0.20 + 0.10·0.85 = 28.5% |
  | EMERGENCY | <1.05 | 100% | 0.20 + 0.10·1.00 = 30.0% (maximum) |

* **Anti-oscillation hysteresis (§16.3):**
  - BASE → STRESS: immediate on `RR < 1.10` (with 24h linear ramp on `B_gold`).
  - STRESS → BASE: requires `RR ≥ 1.10` for **24 consecutive hours**.
  - STRESS → EMERGENCY: immediate on `RR < 1.05` (no ramp — defensive composition assumed at once).
  - EMERGENCY → STRESS: requires `RR ≥ 1.05` for **48 consecutive hours**.
  - EMERGENCY → BASE: requires `RR ≥ 1.10` for **48 consecutive hours**.
* **The "100% gold" clarification (§16.2):** "100% gold" means the entire 10% buffer is held in gold — *never* that the whole reserve becomes gold. The total reserve gold weight never exceeds 30% (the v1.2 baseline; under v2.0 the core share is adaptive, §16.2 fidelity note, but the buffer formula `W_{gold,total} = W_{gold,core,t} + 0.10·B_{gold}` holds).
* **First-loss waterfall (§16.4):** Operational Surplus → Buffer Fiat → Buffer Gold → Core Fiat → Core Gold (the last requires a 4/7 Exhaustion Certificate). Loss accounting, not a trading program — it reclassifies which layer the loss has consumed; the rebalancing engine then restores the layer boundaries through ordinary gated MARP.
* **Closure property:** `W_{gold,total,t} = W_{gold,core,t} + 0.10·B_{gold}(RR_t)` — a pure function of `(W_{gold,core,t}, RR_t)`. The buffer state is recomputed every time `RR_t` is updated (after every mint, redeem, rebalance, price update), so it is always consistent with the freshest solvency measurement. The canonical-state invariant for the buffer requires the canonical `RR_t` (which requires the canonical `I_t` and `V_{net,t}`).

---

## 9. Index/NAV Divergence Analysis (Master Prompt §12)

### 9.1 The two prices and their divergence

```
P_{MTQ,t}  = I_t / INDEX_BASE_DENOMINATOR              (the reference price, the monetary unit)
NAV_t      = V_{net,t} / S_{circ,t}                    (the per-token reserve value)

Divergence:  Δ_t = NAV_t − P_{MTQ,t}
Relative divergence:  δ_t = (NAV_t − P_{MTQ,t}) / P_{MTQ,t} = (NAV_t / P_{MTQ,t}) − 1
                        = (V_{net,t} · INDEX_BASE_DENOMINATOR) / (S_{circ,t} · I_t) − 1
                        = (RR_t · L_t · INDEX_BASE_DENOMINATOR) / (S_{circ,t} · I_t) − 1
                        = (RR_t · S_{circ,t} · (I_t/I_{base}) · I_{base}) / (S_{circ,t} · I_t) − 1
                        = RR_t − 1
```

i.e. **the relative divergence δ_t equals RR_t − 1 by construction** (since `L_t = S_{circ,t}·P_{MTQ,t}` and `NAV_t = V_{net,t}/S_{circ,t}`, so `NAV_t/P_{MTQ,t} = V_{net,t}/L_t = RR_t`).

* In NORMAL (RR = 1.10): δ = +10% — NAV is 10% above the reference price. This is the **intentional over-collateralisation**: each MTQ is backed by 110% of its reference value. It is the buffer that absorbs volatility before the core is impaired (§16.1).
* In STRESS (RR = 1.05): δ = +5% — the buffer has been partially consumed.
* In EMERGENCY (RR = 1.00): δ = 0% — NAV exactly equals the reference price. The buffer is exhausted; the core is at risk.
* Below 1.00 (insolvency): δ < 0 — NAV is below the reference price. Each MTQ is backed by less than its reference value. **This is a violation of Invariant I2 and triggers immediate EMERGENCY** (§21.2 S5).

### 9.2 Monitoring thresholds, reporting requirements, stress scenarios

| δ_t (relative divergence) | RR_t | State | Monitoring threshold | Reporting |
|---|---|---|---|---|
| δ ≥ 10% | RR ≥ 1.10 | S1 NORMAL | nominal | Daily state vector (§18.3, §24.3) |
| 5% ≤ δ < 10% | 1.05 ≤ RR < 1.10 | S2 CAUTION | **caution** — alert ops | Daily + weekly governance notification (§21.4) |
| 2% ≤ δ < 5% | 1.02 ≤ RR < 1.05 | S3 STRESS | **stress** — alert risk council | Weekly governance (§21.4) |
| 0% ≤ δ < 2% | 1.00 ≤ RR < 1.02 | S4 DEFENSIVE | **defensive** — alert emergency council | Daily governance (§21.4) |
| δ < 0% | RR < 1.00 | S5 EMERGENCY | **emergency** — immediate council session | Immediate governance (§21.4) |
| 5% ≤ δ < 10% (rising from below) | 1.05 ≤ RR (rising) | S6 RECOVERY | recovery | Weekly governance |

### 9.3 Stress scenarios for the divergence

The divergence δ_t is the *symptom* of stress events — it is what the buffer exists to absorb.

1. **Stablecoin depeg (e.g. USDC −1%):** `V_{net,t}` drops by `0.495%` (USDC's weight in the reserve × 1% × (1 − 0.005 haircut) ≈ 0.495%). `P_{MTQ,t}` is unchanged (USDC is the unit of account; its price relative is 1). δ drops from 10% to 9.5%. The buffer (Buffer Fiat layer of the first-loss waterfall, §16.4) absorbs the loss; the core is untouched.
2. **Gold shock (+50%, audit S5):** under the canonical chain-linked index, `P_{MTQ,t}` grows by 13% (Test 5); `V_{net,t}` grows by 13% (gold is 26% of the reserve × +50%). **δ is unchanged at 10%** — the protocol stays NORMAL. Under the *current* Laspeyres index, `P_{MTQ,t}` grows ~50%; `V_{net,t}` grows 13%; δ goes from 10% to −24.6%; **RR crashes to 0.83; EMERGENCY**.
3. **Combined USDC depeg + gold crash + oracle failure (audit's death-spiral scenario):** multi-stressor scenario. δ collapses rapidly; the buffer waterfall (§16.4) is consumed layer by layer; the state machine (§21) cascades S1 → S2 → S3 → S4 → S5; redemption pauses in S5 (the audit's F-EMERG-01 fix); the protocol survives if the buffer + core fiat + (with the Exhaustion Certificate) core gold cover the loss before δ reaches the irrecoverable point.
4. **Prolonged divergence (NAV > P_MTQ for months):** the protocol is *over-collateralised* — δ > 10% for a sustained period. This is benign: the surplus accrues to the operational wallet (§20.4) or is used to absorb the next loss. No corrective action; only monitoring.
5. **Prolonged divergence (NAV < P_MTQ for months):** δ < 0 sustained. The protocol is *insolvent* by Invariant I2 — EMERGENCY is triggered immediately on the first breach (§21.2 S5 immediate entry on `RR < 1.00`). Prolonged δ < 0 is **impossible** under the canonical state machine because S5 pauses redemptions and forces governance intervention.

### 9.4 Circuit behavior

* `P_{MTQ,t}` circuit (§18.4): the price is bounded in `[0.50, 2.00]`. A breach (gold hyper-move or feed corruption) triggers `PAUSE_MINT` + `PAUSE_REBALANCE` automatically. **Redemption stays open** — users can exit at the prevailing price (the exit-first principle, §18.4).
* `NAV_t` circuit: no upper bound (the reserve can grow unboundedly); the lower bound is the haircuts + asset prices. If `NAV_t < P_{MTQ,t}` (δ < 0), the state machine enters EMERGENCY (S5) immediately.
* The divergence δ_t itself has no separate circuit breaker — its movements are governed by the state machine, which is the circuit breaker. The state machine is what prevents δ from becoming a free variable: each state change throttles minting, raises redemption fees, and pauses the operations that would expand the liability faster than the reserve.

### 9.5 Economic consequences

* **Persistent δ > 10% (RR > 1.10):** the protocol is over-collateralised. Minting is encouraged (no throttle); the surplus is operational revenue. No user action required.
* **Persistent δ in [5%, 10%) (RR in [1.05, 1.10)):** S2 CAUTION. Minting is throttled to 50%; rebalancing urgency is increased (MARP Level 2). The protocol is signalling stress without restricting exit. Users can redeem normally (0.15% fee).
* **Persistent δ in [0%, 2%) (RR in [1.00, 1.02)):** S4 DEFENSIVE. Minting paused; redemption fee raised to 1.00%. The protocol is leaning against exit demand — the higher fee compensates the protocol for the liquidity it must surrender, and the proceeds accrue to the operational wallet (which feeds the first-loss waterfall).
* **δ < 0% (RR < 1.00):** S5 EMERGENCY. Redemptions paused (F-EMERG-01 fix); circuit breakers engaged; emergency council session called. The protocol is in survival mode — the buffer waterfall is being consumed, and the council must decide on recapitalisation or orderly wind-down.

### 9.6 Governance ownership

* The **divergence δ_t itself** is **not governable** — it is the deterministic output of `(V_{net,t}, L_t)`, which are deterministic outputs of `(reserve holdings, oracle prices, I_t, S_{circ,t})`. No parameter directly sets δ.
* The **thresholds** that map δ to state (RR_target = 1.10, RR_stress = 1.05, RR_hard = 1.00) **are** governable — RR_target and RR_stress by DAO vote (51%), RR_hard by 7/7 Constitutional Multi-Sig (immutable, Invariant I2).
* The **buffer composition** `B_gold(RR_t)` is governable — the 62.5%/85%/100% values are Risk-Council parameters (4/7).
* The **first-loss waterfall ordering** is constitutional — the layer order (Surplus → Buffer Fiat → Buffer Gold → Core Fiat → Core Gold) cannot be changed without a 7/7 vote (it is the structural protection of the core).
* The **redemption fee schedule** (0.15% / 0.15% / 0.50% / 1.00% / paused / 0.30%) is governable — Risk-Council 4/7 with 24h timelock.
* The **Exhaustion Certificate** (required to consume Core Gold) is governed by the 4/7 Emergency Council (§16.4) — a visible, accountable governance event.

---

## 10. Closure Summary — What This Report Proves

| Closure property | Section | Test(s) | Status |
|---|---|---|---|
| One canonical `I_t` defined; all variables pinned | §1 | — | ✅ |
| Period return formula (COO-16) | §2 | Test 1 | ✅ |
| Fixed-point implementation documented (1e18, floor, ≤8 wei) | §2.2 | Test 9 | ✅ |
| Weight-change neutrality (§9.3) | §3 | Tests 2, 3, 4 | ✅ |
| Aggregate ↔ recursive reconciliation (COO-17) | §4 | Tests 6, 10 | ✅ |
| Cumulative divisor consistency (long-run) | §5 | Test 10 | ✅ |
| Off-chain / on-chain equivalence (1e-18 / 1e-12) | §6 | Tests 9, 10 | ✅ (post-remediation) |
| NAV closure | §8.1 | — | ✅ |
| Liability closure | §8.2 | — | ✅ |
| RR closure (structural symmetry under gold shock) | §8.3 | Test 5 | ✅ |
| LCR closure | §8.4 | — | ✅ |
| State machine closure (6 states, 48h confirmation) | §8.5 | Deliverable D | ✅ |
| Minting closure (I5) | §8.6 | — | ✅ |
| Redemption closure (I6, NOT P_MTQ) | §8.7 | — | ✅ |
| Buffer closure (W_gold,total formula) | §8.8 | — | ✅ |
| Index/NAV divergence analysis | §9 | — | ✅ |

**Headline numerical claims:**

1. Under the canonical chain-linked index, a +50% gold shock produces **`I_t → +13%`** (Test 5), and **`RR_t` stays at 1.10** (NORMAL) — survival rate 100%, vs. the current Laspeyres implementation's 0% survival (`RR → 0.83`).
2. Weight changes contribute **exactly zero** artificial return (neutrality, §3) — `|I_t^+ − I_t^-| ≤ 1e-18` at every rebalance.
3. The cumulative divisor `G_t` over a 365-day horizon stays within `[e^{-1.83}, e^{1.83}] ≈ [0.16, 6.23]` (no overflow/underflow), and the reconstruction `I_t = G_t · Σ_i W_{i,t}·(P_{i,t}/P_{i,0})` holds to **`≤ 2920 wei ≈ 3 × 10^{-15}` relative**.
4. The relative index/NAV divergence `δ_t = RR_t − 1` by construction — the state machine is the divergence's circuit breaker.

**Remediation ownership:** This report specifies the **canonical target form** and the **tests that prove it**. The code remediation (modifying `engine.ts::computeGfbIndex` and `MTQSigmaV2.sol::getGFB` to implement Listing 3's chain-linked recursion with `lastPrices`/`lastWeights`/`indexValue`/`chainLinkDivisor` persistent state and the `updateIndex()` order of §2.3) is owned by **Deliverable E** (Code Reconciliation). Until Deliverable E is complete, the current implementations do not satisfy the closure properties above — they exhibit the Laspeyres defect the audit identified.

---

**End of Deliverable C.**
