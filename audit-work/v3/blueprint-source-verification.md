# Blueprint Source Verification (RG-01..RG-15 + parameter table)

**Task ID:** 2-b · **Agent:** Blueprint source verification agent · **Mode:** READ-ONLY documentation audit
**Authoritative source:** `/home/z/my-project/audit-work/v2/blueprint-full.txt` (pandoc plain-text of *MTQ Σ — Master Monetary Architecture & Quantitative Specification v1.0, Master Edition, issued 2026-09-08*; 13,529 lines in this extraction)
**Document under audit:** `/home/z/my-project/audit-work/v3/eq-by-eq-spec.md` (lines 2584–2776 = RG-01..RG-15; lines 2434–2582 = parameter table)

Section → line map used throughout (body of blueprint-full.txt): §2.5=889, §2.7=951 (Listing 1), §2.9=1207, §3.2=1257, §3.4=1301, §4.2=1339, §4.2.1=1369, §5.2=1455, §5.5=1521, §7.6=1689, §7.7=1705 (Listing 2), §8.1=1923, §8.2=1957, §8.3=1977, §8.4=2003, §9.1=2055, §9.2=2075, §9.3=2089, §9.7.1=2233, §9.8=2291 (Listing 3), §10.5=2863, §10.6=2879, §10.8=2905, §10.9=2935, §11.4=3073, §11.5.2=3105, §11.8=3173, §11.11=3239 (Listing 4), §12.3=4173, §12.4=4209, §12.5=4253, §12.8=4305 (Listing 5), §13.4=5031, §13.5=5085, §13.5.2=5113, §14.1=5171, §14.2=5211, §14.6=5351 (Listings 5/6), §15.2=5769, §15.6.1=5903, §15.8=5989 (Listing 7), §16.2=6305, §16.3=6335, §16.4=6381, §17.2=7009, §17.3=7041 (17.3.1=7045, 17.3.2=7065, 17.3.3=7083), §17.4=7097, §17.5=7117, §17.6=7145, §17.12 Listing 9≈7440, §18.1=8051, §19.3=8647, §20.1=9197, §20.1.5=9263, §20.3.1=9313, §20.4=9345, §21.2=9935, §21.3=9961, §21.4=9977, §21.5.3=10045, §21.6=10113 (Listing 13), Listing 14 staged liquidation≈10601, §23.8=11777, §25≈12057 (claims table at 12088), Appendix A.1=13031, Appendix C=13269.

Verdict legend: **CONFIRMED** = the spec's claim about what the blueprint shows is accurate; **PARTIALLY CONFIRMED** = claim substantially accurate but with a material nuance/correction; **NOT FOUND** = cited passage does not exist.

---

## Per-gate findings (RG-01..RG-15)

### RG-01 · Index recursion uses two different weight timestamps — **CONFIRMED** (with a major nuance the spec missed)

**Claim:** §9.2 displays both `I_t = I_t−1 × Σ W_i,t (P_i,t/P_i,t−1)` and `I_t = I_t−1 × Σ W_i,t−1 (P_i,t/P_i,t−1)`.

**Blueprint evidence (§9.2, lines 2075–2087):**
- Line 2079: `I_(t) = I_(t-1) ( ∑_(i) W_(i,t) (P_(i,t))/(P_(i,t-1)) )` — the [MS §74] form.
- Line 2083: `I_(t) = I_(t-1) [ ∑_(i) W_(i,t-1) (P_(i,t))/(P_(i,t-1)) ]` — the [COO-16] reconstruction ("weights in force at the start of the period").
- Line 2087: "The two written forms — W_{i,t} in the specification [MS §74], W_{i,t-1} in the review reconstruction [COO-16] — are the same equation under two conventions, and the operative convention is fixed per methodology version … **period returns are computed with the weights in force at the start of the period**. … **Listing 3 implements exactly this convention**."
- Listing 3 header (lines 2307–2309): "Authoritative recursion (§9.2, COO-16): I_t = I_{t-1} * [ sum_i W_{i,t-1} * P_{i,t} / P_{i,t-1} ]".

**Nuance the spec missed:** the gate's "Required developer action" says to *choose* the normative convention "only after reconciling", implying the blueprint leaves it open. It does not fully: §9.2 already pins the operative convention (start-of-period weights W_{i,t−1}), and Listing 3's doc-comment labels that form "Authoritative". What *is* still open is the separate COO-17 obligation to reconcile the §9.1 value-aggregate form with the recursion (pinned G_t functional form, valuation basis of B_t^−/B_t^+; lines 2071, 2101, 2105). Also, the gate's source locator "P596 and P598" cannot be resolved against blueprint-full.txt (no page markers exist; §9.2 is printed page 75 per the TOC; the formulas sit at lines 2079/2083). The substantive claim itself is confirmed.

### RG-02 · NAV symbol is overloaded — **CONFIRMED** (spec missed a third conflicting definition)

**Claim:** §2.5 defines NAV_t as index value; §14.1 defines V_net; §19.3 defines NAV_t = V_net,t/S_circ,t.

**Blueprint evidence:**
- §2.5, line 902: "`I_t (NAV_t)` — USD value of the chain-linked reference index … G_t · Σ_i W_{i,t} · (P_{i,t}/P_{i,0}) … Chain-linked; normalized to 1.00 at genesis".
- §14.1, line 5177: `V_(net,t) = ∑_(j=1)^(n) Q_(j,t) × P_(j,t) × (1 - H_(j))` ("The net asset value of the reserve at time t is:").
- §19.3.2 Step 1, lines 8667–8671: "The per-token net asset value is read from the reserve accounting: `NAV_(t) = (V_(net,t))/(S_(circ,t))`".

**Additional evidence the spec missed (strengthens the gate):** Appendix A.1 glossary, line 13054: "`NAV_t` — Net asset value of the reserve (gross of nothing — see V_{net,t}); collateralizes the token. §2.5; Chapter 14" — a *third* definition that contradicts §2.5's index-value meaning while citing §2.5 as its source. The overload is therefore three-way (index level / total reserve NAV / per-token redemption NAV), and the blueprint's own glossary is internally inconsistent. (Bonus: the same glossary redefines `D_t` as "Weight deviation |W^Target − W^Actual|" and `B_t^−/B_t^+` as "dynamic-buffer boundaries" — line 13058/13060 — colliding with §9.3's divisor D_t and pre/post-rebalance basket values B_t^±.)

### RG-03 · Core getter and reserve manager NAV semantics — **CONFIRMED**

**Claim:** §2.7 Listing 1 getter returns `reserveState.fiatValue + reserveState.goldValue` with comments labeling the fields *gross*; §14.6 describes netFiat/netGold assignment; §14.1 requires per-asset haircuts.

**Blueprint evidence:**
- §2.7 Listing 1, lines 1041–1043: `uint256 fiatValue; // USD value of all stablecoins (gross)` / `uint256 goldValue; // USD value of gold holdings (gross)` (line 1045 adds `liquidValue; // USD value of stablecoins only (net)`).
- Lines 1123–1127: `function getNAV() … return reserveState.fiatValue + reserveState.goldValue;` and lines 1131–1139: `getReserveRatio()` divides `getNAV()` by `getLiability()` — i.e., the RR getter consumes the gross-labeled fields.
- §14.6 Listing 5/6, lines 5413–5415: `fiatValue; // net USD value of all stablecoins (post-haircut)` / `goldValue; // net USD value of tokenized gold (post-haircut)`; lines 5509–5523: `netUsdc = … * (1e18 - HAIRCUT_USDC) / 1e18 … netGold = grossGold * (1e18 - HAIRCUT_PAXG) / 1e18; netFiat = netUsdc + netEurc; reserveState.fiatValue = netFiat; reserveState.goldValue = netGold;` (line 5557: same `fiatValue + goldValue` getter, now net).
- §14.1, lines 5175–5179: haircut definition, "This definition is constitutional: invariant I4 … requires that V_{net,t} is always calculated with asset-specific haircuts".

**Nuance:** the §14.6 fidelity note (line 5723) states this explicitly: "BP applied a blended stablecoin haircut 'for simplicity' and stored gross values, which its own illustrative getNAV then returned; this listing applies per-asset haircuts and stores net values so invariant I4 … holds by construction — gross values are retained only as monitoring fields." The blueprint therefore acknowledges the gross-vs-net tension and resolves it in favor of net for the reserve manager, but Listing 1 (§2.7) is left with gross-labeled fields feeding its own getNAV/getReserveRatio/getLCR — the gate is accurate and the end-to-end trace it demands is genuinely required.

### RG-04 · Legacy fixed-quantity GFB formula omits CHF + gold — **CONFIRMED**

**Claim:** §9.7.1's legacy GFB_t includes q_USD, EUR, GBP, JPY, CNY terms but not CHF/gold; the v2.0 index is adaptive with seven genesis components and chain linking.

**Blueprint evidence (§9.7.1, lines 2233–2247):**
- Line 2237: `GFB_(t) = (q_(USD)· 1.00 + q_(EUR)· FX^(EUR/USD)_(t) + q_(GBP)· FX^(GBP/USD)_(t) + q_(JPY)· FX^(JPY/USD)_(t) + q_(CNY)· FX^(CNY/USD)_(t)) / (… _base …)` — exactly five terms, no CHF, no gold.
- Lines 2241–2243: "The v2.0 adaptation replaces fixed quantities with live weights and the base-value denominator with the base fixings plus a divisor: `I_(t) = G_(t) ∑_(i) W_(i,t) (P_(i,t))/(P_(i,0))`".
- Line 2247 (fidelity note): "the Modification Specification supersedes this with the adaptive, MASE-weighted basket of seven components (Section 3.1)".
- Line 2289: "Under v2.0, getGFB() is superseded by getIndex() of Listing 3".

### RG-05 · Eligibility threshold Q_min symbol reused — **CONFIRMED**

**Claim:** §4.2 makes Q_i ≥ Q_min the eligibility threshold; §4.2.1's min–max normalization uses Q_min/Q_max as observed universe minimum/maximum.

**Blueprint evidence:**
- §4.2, line 1367: "A currency becomes eligible for the active basket only if: `Q_(i) ≥ Q_(min)`".
- §4.2.1, line 1373: `Q̃_(i) = (Q_(i) - Q_(min))/(Q_(max) - Q_(min))`; line 1375: "where Q_{min} and Q_{max} are the minimum and maximum composite scores across the candidate universe in the current evaluation round".
- Line 1377 confirms the double role in one sentence: "The scoring coefficients a_k **and the threshold Q_{min}** are methodology parameters" — i.e., the same symbol names both a governance threshold and an observed statistic.

### RG-06 · Softmax score orientation vs negative exponent — **CONFIRMED**

**Claim:** §7.6 gives α_m,t = exp(−η Score_m,t)/Σ_k exp(−η Score_k,t) plus prose that better models receive greater weight.

**Blueprint evidence (§7.6, lines 1689–1703):**
- Line 1693: `Score_(m,t) = f(OOSRisk, CVaR, PPError, Turnover, Robustness)` (itself symbolic — feeds RG-15).
- Line 1695: "the coefficients follow a softmax with temperature η **(score orientation chosen so that better models receive greater weight)**".
- Line 1697: `α_(m,t) = (e⁻^(η Score)_(m,t))/(∑_(k) e⁻^(η Score)_(k,t))`.
- Line 1703: "This allows the **best-performing robust models to receive greater influence** …".

**Nuance:** with a negative exponent, "greater weight for better models" requires Score to be *lower-is-better* (an error/risk score). The blueprint's parenthetical asserts the orientation is "chosen", but Score_m = f(OOSRisk, CVaR, PPError, Turnover, **Robustness**) mixes plausibly higher-is-better inputs, no numeric η is given anywhere (confirmed by search; η appears only symbolically at lines 1695/1697/13108), and the score function itself is unspecified — so the spec's gate is fair; the blueprint's own hedge confirms the convention is not yet fixed.

### RG-07 · Gold purchasing-power signal sign convention — **CONFIRMED**

**Claim:** §5.2 defines GPR_i,t = P_i,t−1/P_i,t − 1 with P_i,t the price of one unit of gold in currency i.

**Blueprint evidence (§5.2, lines 1457–1465):**
- Line 1459: "`P_(i,t)` = price of one unit of gold expressed in currency i".
- Line 1463: `GPR_(i,t) = (P_(i,t-1))/(P_(i,t)) - 1`.
- Line 1465 (the sign prose the spec asks about): "(or equivalently according to the chosen direction convention — **the convention is fixed per methodology version to avoid sign errors**)".

**Interpretation note:** as written, if gold becomes more expensive in currency i (P_i,t rises), GPR is negative — i.e., the displayed form yields a *negative* number when the currency's gold purchasing power *falls*. The blueprint itself flags the direction-convention issue and defers it to methodology versioning, exactly the ambiguity RG-07 describes. §9.2 (line 2087) cross-references this same convention mechanism.

### RG-08 · Oracle consensus summary vs implemented aggregate — **CONFIRMED**

**Claim:** §17.2 says median for three, average for two, pause below two; §17.5 says the median is the validity/outlier anchor while the published aggregate is the filtered mean.

**Blueprint evidence:**
- §17.2, lines 7027–7031: "If all three are available: **use the median price**. / If only two are available: **use the average of the two**, with a sanity check. / If fewer than two are available: **pause minting and rebalancing** until feeds are restored."
- §17.5, lines 7139–7141: "`P̃ = Median({P_(i) : valid_(i)})  P^(agg) = 1/(|S|) ∑_(i ∈ S) P_(i)` … the returned aggregate is the **outlier-filtered mean, and the median is the validity anchor**: the breaker measures deviations from the median even when the published number is the filtered mean … the consensus rule of Section 17.2 (median of three) and the implementation agree in the normal case."

**Nuance:** the conflict is real and the blueprint soft-pedals it ("agree in the normal case" — a mean of three ≠ median of three whenever feeds are asymmetric, which is precisely the outlier case the median exists for). Additional wrinkle the spec's action item gestures at but does not spell out: the **canonical gold price uses a different aggregation again** — §17.4 line 7103: `P_(G)^(raw) = Median(P₁, …, P_(n))` (median, or robust weighted median) — so gold publishes a median while FX publishes a filtered mean, from the same Listing 9 pipeline.

### RG-09 · MARP objective "lacks explicit optimization operator/sign" — **PARTIALLY CONFIRMED** (spec misrepresents §10.9 on the argmin point)

**Claim:** the displayed J(ΔW) line shows remaining-deviation, spread/gas, urgency and turnover terms but "does not show an explicit argmin/argmax and the urgency sign convention is unclear".

**Blueprint evidence (§10.9, lines 2941–2975):**
- Line 2943: `J(Δ W) = λ₁ (W^(obs) - W^(Target) - Δ W)² + λ₂ (Spread · Δ W + FixedGas) + λ₃ Urgency + λ₄ |Δ W|` — this displayed line indeed contains no argmin/argmax.
- **However**, line 2969–2971 immediately supplies the operator: "The engine searches for the optimal trade size ΔW* that minimizes J(ΔW): `Δ W^(*) = argmin_(Δ W) J(Δ W)`".
- Lines 2960–2966 pin the coefficients numerically: λ₁=0.40, λ₂=0.30, λ₃=0.20, λ₄=0.10 ("governance-controlled default [BP §7.3], reproduced in Listing 4 as LAMBDA_1 through LAMBDA_4", line 2975; Listing 4 lines 3259–3265).
- Urgency term, line 2952: "Urgency = 1/RR_t if RR_t < 1.10, else 0 — Penalises deviation when the reserve ratio is low."

**Verdict rationale:** the *section* §10.9 does display an explicit argmin (line 2971) and does fix all four λ values numerically, so the gate's blanket statement that §10.9 "lacks an explicit optimization operator" **misrepresents the blueprint** (only the single J(ΔW) line, viewed in isolation, lacks it). The urgency concern survives partially: λ₃·Urgency is **independent of ΔW**, so it shifts J uniformly and cannot affect the argmin at all — the prose "penalises deviation" does not match the displayed additive form, leaving the term's actual role (and the intended sign) genuinely unclear. A correct gate would say: "operator and λ's are given; the urgency term is ΔW-invariant, so its stated purpose is inconsistent with the displayed formula."

### RG-10 · Profitability threshold differs across chapters — **CONFIRMED** (spec understates: ε is already pinned twice)

**Claim:** §10.8 requires NetBenefit_i > ε; §12.5 gives NetBenefit > 0 and also NetBenefit_i > ε with ε > 0.

**Blueprint evidence:**
- §10.8, line 2911: `NetBenefit_(i) = Benefit_(i) - Cost_(i)  **execute only when NetBenefit_(i) > ε**`; line 2929: "The margin ε is a predefined economic margin [MS §41] — a positive buffer …".
- §12.5, line 4257: `NetBenefit = ReductionInDeviation - EstimatedExecutionCost > 0` ("If NetBenefit ≤ 0, the trade is suppressed").
- §12.5, line 4263: `NetBenefit_(i) = ReductionInDeviation_(i) - EstimatedCost_(i) > ε   ε > 0` — both conditions appear in §12.5, as the spec says.
- Line 4265: "the on-chain implementation enforces ε as the minProfitability parameter, **initialized to $10** (MIN_PROFITABILITY, Section 12.8)" (Listing 5: `minProfitability = 10e18; // $10 minimum net benefit (§12.5)`, line 4363; guard `netBenefit > minProfitability`, line 4745).
- §11.8 line 3200 + Listing 4 line 3307: a *second* margin constant — `BENEFIT_MARGIN = 0.01e18; // 1% (validation-stage)` — with Listing 4's gate written as "benefit > costTerm + BENEFIT_MARGIN" (line 2933).

**Nuance the spec missed:** the blueprint does not leave ε's nature open ("zero or positive") — it declares ε > 0 and instantiates it **twice, differently**: 1% of value (BENEFIT_MARGIN, Listing 4/MARP engine) and $10 absolute (MIN_PROFITABILITY, Listing 5/execution contract). The real reconciliation is 1%-vs-$10 (and %-of-what), not zero-vs-positive.

### RG-11 · Buffer target equations historical vs adaptive v2.0 core gold — **CONFIRMED**

**Claim:** core-plus-buffer formulas use 20% core gold, buffer ratios 62.5/85/100%, 10% buffer; fidelity notes mark them v1.2 initialization inputs with v2.0 adaptive core gold.

**Blueprint evidence:**
- §13.5.2, lines 5115–5131: "The core held **20% gold** (CORE_GOLD_WEIGHT)"; "the buffer is an additional **10%** of excess collateral"; `V_(buffer,t) = 0.10 × S_(circ,t) × P_(MTQ,t)` (line 5117); `W_(gold)^(total) = 0.20 + 0.10 × B_(gold)(RR_(t))` (line 5121); state table line 5126–5130: BASE (RR ≥ 1.10) **62.5%** → total 26.25%; STRESS (1.05 ≤ RR < 1.10) **85%** → 28.5%; EMERGENCY (RR < 1.05) **100%** → 30.0%.
- Line 5133: "In v2.0 this structure is retained as **historical input and candidate policy** … its specific numbers are **validation-stage values**, to be re-derived under the Section 13.5.1 inputs and the Section 23.11 stress tests rather than quoted as the reserve's definition."
- §16.2, lines 6312–6316: identical 62.5/85/100 state table; line 6319: "'100% gold' means the entire 10% buffer is held in gold — never that the whole reserve becomes gold"; lines 6325–6329: 26.25%/28.5%/30.0% arithmetic.
- §16.2 fidelity note, line 6333: "the fixed core gold weight of 20% (and hence the 26.25%/28.5%/30.0% totals) is a **v1.2 constant** tied to the fixed gold allocation; **under v2.0 the core reserve's gold share is an output of the reserve optimization (Section 14.4)** … the v1.2-simulated 62.5% BASE split retained as a **validation-stage initialization value**…"
- §16.3 line 6341 (10% buffer decomposition, 24h/48h ramp rules at lines 6356–6364); §16.4.1 line 6423: adaptive form `W^{target}_{gold,total,t} = W^{core}_{gold,t} + 0.10 × B_{gold}(RR_t)`.

### RG-12 · De-peg liquidation percentages / denominator — **CONFIRMED** (but the source already pins the denominator)

**Claim:** summary wording is cumulative 10%→25%→50%→100%; the contract listing says 10%, additional 15%, additional 25%, remaining.

**Blueprint evidence:**
- §21.5.3, line 10047: "**Each stage sells an additional fraction of the original position**"; table lines 10052–10058 (column header "Cumulative Sell %"): Stage 1 **10%** "Sell 10% of the asset immediately"; Stage 2 **25%** "Sell an **additional 15%** (total 25%)"; Stage 3 **50%** "Sell an **additional 25%** (total 50%)"; Stage 4 **100%** "Sell the **remaining 50%** (total 100%)".
- Line 10061: "The cumulative percentages (10% → 25% → 50% → 100%) are constitutional and immutable".
- Listing 14 (lines 10617–10653): `sellAmount = totalValue * 10 / 100;` / `sellAmount = totalValue * 15 / 100; // additional 15%` / `sellAmount = totalValue * 25 / 100; // additional 25%` / Stage 4: `sellAmount = totalValue - getRemainingValue(currencyCode);` — every stage computed off `totalValue`, the original position.
- Summary wording (§25 claims / §26 / Ch.21 header rows): lines 12088 ("liquidated in stages (10% → 25% → 50% → 100%)"), 12152, 12497, 12960, 13140, and the §22 parameter matrix rows 11078/11180 ("Liquidation Stages 1–4 (cumulative) … 10% / 25% / 50% / 100% … Constitutional (immutable)").

**Nuance:** the gate asks developers to "specify whether each percentage is relative to original position or remaining position" — the blueprint already answers this three ways (line 10047 prose, the "Cumulative Sell %" column with "(total X%)" parentheticals, and Listing 14's `totalValue`-based arithmetic). The wording difference the gate flags is real but the two forms are arithmetically consistent in the source; the residual implementation risk is partial fills/skipped stages (where "(total X%)" assumes all earlier stages executed), not an unspecified denominator.

### RG-13 · Six-state machine, thresholds, EMERGENCY entry, RECOVERY role — **CONFIRMED** (spec missed a competing 5-status table)

**Claim:** §21.2–21.3 map RR/LCR to six states NORMAL, CAUTION, STRESS, DEFENSIVE, EMERGENCY, RECOVERY.

**Canonical table (§21.2, lines 9941–9955):**
| State | RR range | LCR range | Entry trigger |
|---|---|---|---|
| NORMAL (S1) | RR ≥ 1.10 | LCR ≥ 1.00 | Immediate while both targets hold |
| CAUTION (S2) | 1.05 ≤ RR < 1.10 | LCR ≥ 0.90 | Immediate on RR < 1.10 or LCR < 1.00 |
| STRESS (S3) | 1.02 ≤ RR < 1.05 | LCR ≥ 0.80 | Immediate on RR < 1.05 or LCR < 0.90 |
| DEFENSIVE (S4) | 1.00 ≤ RR < 1.02 | LCR ≥ 0.70 | Immediate on RR < 1.02 or LCR < 0.80 |
| EMERGENCY (S5) | RR < 1.00 | **Any** | **Immediate on hard-floor breach (Invariant I2, §2.6)** |
| RECOVERY (S6) | RR ≥ 1.05 (rising) | LCR ≥ 0.90 | From a more restrictive state, after 48 h sustained confirmation |

- Escalation path & 48h rule (§21.3, lines 9963–9971): "NORMAL → CAUTION → STRESS → DEFENSIVE → EMERGENCY (immediate on breach)" / "EMERGENCY → DEFENSIVE → STRESS → CAUTION → NORMAL (48 h sustained confirmation per step)" / "t_(confirm) ≥ 48 h (sustained, no breach)".
- **EMERGENCY enters only via the RR hard floor — YES, explicitly:** line 9952 (trigger column, LCR "Any"); line 9957: "the EMERGENCY boundary is constitutional: RR < 1.00 violates the hard floor of Invariant I2 … which is why the S5 entry trigger is immediate"; Listing 13 `updateState()` lines 10305–10307: `else if (rr < RR_HARD_FLOOR) { newState = ProtocolState.EMERGENCY; }` — no LCR condition on that branch.
- **RECOVERY's exact role:** line 9959: "RECOVERY (S6) is the **residual posture of the classifier**: solvency at or above the hard floor with ratios improving but not yet back to the NORMAL thresholds. The formal classifier reaches it when the ratios fail the DEFENSIVE liquidity test while solvency holds — for example, RR ≥ 1.05 with LCR below 0.70 — or during a confirmed climb back from a deeper state. Its action profile (25% minting throttle, 0.30% redemption fee, increased rebalancing urgency) sits deliberately between CAUTION and STRESS." Listing 13 implements it as the residual `else` branch (lines 10309–10315).
- Listing 13 classification (lines 10289–10317) matches the table exactly: NORMAL `rr ≥ rrTarget && lcr ≥ lcrTarget`; CAUTION `rr ≥ 1.05 && lcr ≥ 0.90`; STRESS `rr ≥ 1.02 && lcr ≥ 0.80`; DEFENSIVE `rr ≥ RR_HARD_FLOOR && lcr ≥ 0.70`; EMERGENCY `rr < RR_HARD_FLOOR`; else RECOVERY.
- §21.4 action matrix (lines 9984–9996): minting Allowed/50%/Paused/Paused/Paused/25%; redemption 0.15%/0.15%/0.50%/1.00%/Paused/0.30%; rebalancing urgency 1/2/3/4/Paused/2; RR target 1.10/1.08/1.05/1.03/1.00/1.08; sweep $10,000 (Paused in S5); oracle confirmation ladder; governance notification Quarterly→Immediate.

**Nuances the spec missed (both belong in any "canonical mapping" work):**
1. **§14.2.2 carries a competing FIVE-status table** (lines 5237–5249): NORMAL (RR ≥ 1.10, LCR ≥ 1.00), CAUTION (1.05 ≤ RR < 1.10, LCR ≥ 0.90), **DEFENSIVE (1.00 ≤ RR < 1.05, LCR "Any")** — i.e., no STRESS state and a different DEFENSIVE band — EMERGENCY (RR < 1.00), **RECOVERY (RR ≥ 1.05 rising, LCR ≥ 0.95)** — vs §21.2's LCR ≥ 0.90. Listing 6's `getProtocolStatus` implements this five-status variant (`if (rr >= RR_STRESS && lcr >= 0.90e18) return "CAUTION"; … return "DEFENSIVE";`, lines 5627–5631), and its fidelity note (line 5723) says BP's version "could never return RECOVERY … the recoveryMode flag plus RECOVERY_CONFIRMATION_PERIOD (48 hours, Listing 1) restore the Section 14.2.2 row". So the source contains **two state machines** (§14.2.2/Listing 6: 5 statuses, RECOVERY LCR ≥ 0.95; §21.2/Listing 13: 6 states, RECOVERY LCR ≥ 0.90) — the spec's RG-13 cites only §21.2–21.3.
2. **48h governance class conflict:** §2.9 (line 1226) classes the Recovery Confirmation Period as "DAO Vote (51%)"; Listing 13 declares `RECOVERY_CONFIRMATION_PERIOD = 48 hours` as a constant (line 10149) — the blueprint itself flags and "resolves" this conservatively (line 9973: "this edition retains the immutable constant as the conservative reading … and flags the discrepancy for resolution during deployment registration").

### RG-14 · Genesis normalization and reference price scaling — **CONFIRMED**

**Claim:** index normalized to 1.0000 at genesis; P_MTQ = I_t/I_base; I_base built from q_i × base fixings.

**Blueprint evidence:**
- §3.4, line 1303: "the basket is seeded with USD-equivalent notionals equal to the strategic prior, **so that the index starts at exactly 1.0000**. The genesis snapshot is immutable…"; table lines 1308–1322: notionals 0.2700/0.2000 (at EUR/USD 1.0500)/0.0900 (at 0.0067)/0.0800 (at 1.2500)/0.0500 (at 0.1400)/0.0500 (at CHF/USD 1.1300)/0.2600 (at USD 2,500 per reference unit) = **Total 1.0000**. (§3.5 line 1331 and §20.1 line 9199 repeat "exactly 1.0000".)
- §9.1, lines 2061–2067: `NAV_(t) = G_(t) ∑_(i) W_(i,t) (P_(i,t))/(P_(i,0))`; `NAV₀ = 1`; "one unit of the reference index is worth 1.0000 at genesis … This value is the I_t (NAV_t) variable of the core variable table (Section 2.5)".
- §18.1, lines 8055–8059: `P_(MTQ,t) = (I_(t))/(I_(base))`; "I_base is fixed at the genesis snapshot (Section 3.4), so P_{MTQ,genesis} = 1.00 exactly."
- §20.1.5, line 9267: `I_(base) = q_(USD)·1.00 + q_(EUR)·FX_(EUR/USD,base) + q_(JPY)·FX_(JPY/USD,base) + q_(GBP)·FX_(GBP/USD,base) + q_(CNY)·FX_(CNY/USD,base) + q_(CHF)·FX_(CHF/USD,base) + q_(XAU)·P_(Gold,base)` — **all seven components including CHF and gold**; line 9269: "The v1.2 formula carried five currency terms; the v2.0 extension **adds CHF and gold** so that the denominator matches the seven-component genesis snapshot exactly … (EUR/USD 1.0500, GBP/USD 1.2500, JPY/USD 0.0067, CNY/USD 0.1400, CHF/USD 1.1300, gold at USD 2,500 per reference unit)".

**Nuance:** §9.6.2 retains the v1.2 five-term `verifyGFBBase()` (lines 2189–2203) explicitly labeled "v1.2 lineage"; the v2.0 `verifyGenesis()` recomputes from the seven-component constants *and* "additionally checks the calibration invariant of Section 3.4: the USD-equivalent genesis notionals sum to exactly 1.0000 per MTQ unit, which is what makes I_0 = 1.0000 exact" (line 2205). The lineage is cleanly separated, supporting the "no double normalization" requirement.

### RG-15 · Symbolic f(...)/g(...) forms without fixed coefficients — **CONFIRMED per section, with concrete numbers documented** (§15.2 inclusion imprecise)

Claim: §4.2, §5.5, §8.2–8.3, §10.5–10.6, §13.5, §15.2 give f(...)/g(...) forms with parameter families but no fully fixed coefficients.

**Symbolic forms found (quotes):**
- **§4.2** (line 1343): `Q_(i) = a_R R_i + a_T T_i + a_L L_i + a_S S_i + a_D D_i + a_C C_i − a_G G_i − a_X X_i`; line 1377: "The scoring coefficients a_k and the threshold Q_min are methodology parameters … fixed per published methodology version". (Related: §4.5 line 1419 `S_i^Structural = ∑_k a_k z_{i,k}` — also symbolic.) No numbers given. **Symbolic — confirmed.**
- **§5.5** (line 1525): `CrisisScore_(t) = f(FXVol, CrossAssetCorrelation, LiquidityStress, InflationShock, CreditStress, MarketDrawdown, GeopoliticalIndicators)`; line 1529: `λ_(CVaR,t) = λ_(CVaR,0) · (1 + k · CrisisScore_(t))` with "The scaling constant k and the baseline λ_{CVaR,0} are Risk-Council parameters within constitutional envelopes" — no numbers for f, k or λ_CVaR,0. **Symbolic — confirmed.** Concrete number nearby: the *crisis threshold* 0.70 is fixed (§8.4 line 2017 "threshold 0.70; conservative default to stress"; Listing 4 line 3319 `crisisThreshold = 0.70e18`).
- **§8.2** (lines 1961–1963): `L_(i,t) = f(L_base, Q_i, Risk_i, Liquidity_i)` / `U_(i,t) = f(U_base, Q_i, Risk_i, Liquidity_i)`; fidelity note line 1975: "the concrete f (monotone in Q_i and Liquidity_i, inverse in Risk_i, bounded by the constitutional envelope) is a **quantitative-implementation deliverable** of the research program". **Symbolic — confirmed.**
- **§8.3** (line 1997): `Δ_(i,t) = g(Liquidity_(i,t), Stress_(t), Cost_(i,t), StructuralEvent_(i,t))` — **symbolic g confirmed**; but the *deployed* per-update cap is concrete: line 1999 "USD and EUR 0.50%, JPY and GBP 0.30%, CNY and CHF 0.20%, and gold 0.50% per accepted update" (arrays at lines 1081/1735).
- **§10.5** (lines 2867–2875): `θ_(i,t) = θ_(base) + f(Volatility, Liquidity, Spread, Slippage)`; validated instantiation (line 2873): `θ_(i,t) = θ_(base) + κ₁ σ̃_i + κ₂ (1 − Liquiditỹ_i) + κ₃ Spread̃_i + κ₄ Slippagẽ_i` — **the κ₁..κ₄ vector is symbolic** ("Risk-Council parameters within constitutional envelopes", line 2875). Concrete numbers elsewhere: **θ_base = 0.75% base / 1.5% stress** (§11.8 line 3198 "No-Trade Band (v2.0) θ_base 0.75% base; 1.5% stress"; Listing 4 lines 3301–3303 `noTradeBand = 0.0075e18` / `noTradeBandStress = 0.015e18`), and crisis widening "doubles the base band" (line 2877). Appendix C worked examples use *illustrative* band values θ_USD = 1.0% (line 13273) and θ_Gold = 2.0% (line 13287) — example values, not normative constants.
- **§10.6** (lines 2883–2891): `Trade_(i) = β_(i,t)(W^(Target) − W^(Actual))`, `β_(i,t) = clip(β₀ + β₁ U_i − β₂ Impact̂_i, β_(min), 1)` — β₀, β₁, β₂, β_min **symbolic**, no numbers in §10.6. Appendix C.2 uses an illustrative **β = 0.40** (line 13287: "the partial-rebalance coefficient is β = 0.40 [MS §69]"; arithmetic at line 13299).
- **§13.5** (line 5089): `R_(G) = f(MTQ obligations, GoldLinked obligations, Liquidity, Stress, Custody, Redemption)` — "not simply R_G = 26%"; §13.5.3 line 5139: `E_(j) = f(UnderlyingGoldCoverage, Custody, Redemption, IssuerRisk, Liquidity, Auditability, LegalRights)`, `E_j ≥ E_min` — **symbolic, confirmed** (E_min not numeric).
- **§15.2 — imprecise in the spec:** §15.2 itself is the eight-criterion **pass/fail** eligibility standard with *concrete* thresholds — liquidity ≥ **$1,000,000** 24h DEX volume (line 5786), top-tier audit within **12 months** (line 5784), issuer concentration ≤ **30%** (line 5790), admission 48h timelock/4-of-7 (line 5793) — not an f(...)/g(...) form. The symbolic composite score the spec means is `E_j = f(...)` of §14.3 (line 5257) / §13.5.3, which §15.2 cross-references ("the eligibility score E_j of Section 14.3 is the quantitative expression of criteria 2, 3, 5 and 7", line 5793). Listing 7 adds concrete bounds: `MAX_ISSUER_CONCENTRATION = 0.30e18`, `MIN_LIQUIDITY_THRESHOLD = 1000000e18`, `HAIRCUT_FLOOR = 0.005e18`, `HAIRCUT_CEILING = 0.10e18` (lines 6011–6017).

**Other concrete numbers the blueprint supplies adjacent to the "symbolic" sections** (useful calibration data the spec's table also carries): ρ = 0.50 normal / 0.75 stress (§8.4 line 2017; Listing 2 lines 1739–1741); crisis threshold 0.70 (line 2017; Listing 4 line 3319); envelopes 23–32/17–24/7–12/6–11/3–7/3–7/20–32 (§8.1 lines 1932–1944); λ₁–λ₄ = 0.40/0.30/0.20/0.10 (§10.9 lines 2960–2966; §11.8 lines 3180–3186); reintegration score weights 0.40/0.25/0.20/0.15 with thresholds 0.80/0.85/0.90 (§21.5.4 lines 10078–10089); v1.2 θ_t coefficients α = 0.15, β = 0.10, θ_max = 0.03 around a 26.25% base, explicitly "legacy … initialization values" (§5.3 line 1503).

---

## Parameter table verification

| # | Parameter | Spec value (spec lines 2446–2581) | Blueprint value (quote/line) | Verdict | Blueprint line ref |
|---|---|---|---|---|---|
| 1 | Strategic prior | USD 27; EUR 20; JPY 9; GBP 8; CNY 5; CHF 5; Gold 26 (%) | "USD 27%, EUR 20%, JPY 9%, GBP 8%, CNY 5%, CHF 5%, Gold 26% … Total 100%"; "Strategic Prior — NOT Fixed Weight" | **CONFIRMED** | §3.2: 1264–1278; also §2.5: 898; Listing 1: 977; glossary: 13042 |
| 2 | Genesis base FX fixing | EUR/USD 1.0500; GBP/USD 1.2500; JPY/USD 0.0067; CNY/USD 0.1400; CHF/USD 1.1300 | `BASE_EUR_USD = 1.0500e8` … `BASE_CHF_USD = 1.1300e8`; §9.7.2 table "EUR/USD 1.05000 … CHF/USD 1.13000"; §3.4 notional table "(at EUR/USD 1.0500) … (at CHF/USD 1.1300)" | **CONFIRMED** | Listing 1: 995–1003; §9.7.2: 2256–2265; §3.4: 1310–1318; Listing 3: 2345–2353; §20.1.5: 9269 |
| 3 | Genesis gold fixing | USD 2,500 per reference gold unit | `BASE_GOLD_USD = 2500.00e8`; "gold base fixing of USD 2,500.00 per reference gold unit"; §3.4 "0.2600 (at USD 2,500 per reference unit)" | **CONFIRMED** | 1007; 2265; 1320; 2355; 9269 |
| 4 | Constitutional weight bounds | USD 23–32; EUR 17–24; JPY 7–12; GBP 6–11; CNY 3–7; CHF 3–7; Gold 20–32 (%) | §8.1 "Initial Research Guardrail" table exactly these ranges; "validation-stage admissibility ranges, not fixed weighting targets"; arrays [0.23,0.17,0.07,0.06,0.03,0.03,0.20] / [0.32,0.24,0.12,0.11,0.07,0.07,0.32] | **CONFIRMED** | 1932–1949; Listing 1: 1075–1077; Listing 2: 1729–1731 |
| 5 | MAX_VELOCITY per accepted update | USD 0.50; EUR 0.50; JPY 0.30; GBP 0.30; CNY 0.20; CHF 0.20; Gold 0.50 (%) | "USD and EUR 0.50%, JPY and GBP 0.30%, CNY and CHF 0.20%, and gold 0.50% per accepted update"; `MAX_VELOCITY = [0.005e18, 0.005e18, 0.003e18, 0.003e18, 0.002e18, 0.002e18, 0.005e18]` | **CONFIRMED** | §8.3: 1999; Listing 1: 1081; Listing 2: 1735 |
| 6 | Smoothing rho | Normal 0.50; Stress 0.75; crisis threshold 0.70 | "The deployed values are smoothingRhoNormal = 0.50 and smoothingRhoStress = 0.75 (1e18 scale …), with the stress flag sourced from the crisis-score oracle path of Section 5.5 (threshold 0.70 …)"; `smoothingRhoNormal = 0.50e18; smoothingRhoStress = 0.75e18`; `crisisThreshold = 0.70e18` | **CONFIRMED** | §8.4: 2017; Listing 2: 1737–1741; Listing 4: 3319 |
| 7 | Reserve ratio tiers | Target 1.10; stress floor 1.05; hard floor 1.00 | §2.9 "RR_target 1.10 / RR_stress 1.05 / RR_hard 1.00 (Constitutional, immutable)"; §14.2.1 three-floor table 1.10/1.05/1.00; `RR_HARD_FLOOR = 1.00e18` | **CONFIRMED** | 1214–1218; 5226–5231; §21.2: 9944–9952; Listing 13: 10147; Listing 5: 5395–5397 |
| 8 | LCR target/floor | 1.00 (100%); operational target may sit above floor | `LCR_(t) ≥ 1.00` (§13.4.3); §2.9 "LCR_target 1.00"; "the operational target (lcrTarget …, a Risk-Council parameter initialized at 1.00) may be set above the floor following stress-test results" — matches the spec's note verbatim | **CONFIRMED** | 5069; 1224; 5081; Listing 1: 1031 |
| 9 | Normal operational fees | Mint 0.10%; redeem 0.15%; rebalance 0.20% | §20.4 table: "Mint Fee 0.10% / Redeem Fee 0.15% / Rebalancing Fee 0.20% → Operational Wallet"; §2.9 lists mint 0.10% and redeem 0.15% (no rebalance row) | **CONFIRMED** (note: the 0.20% rebalancing fee appears in §20.4, not §2.9) | 9352–9356; 1220–1222 |
| 10 | Stress / defensive redemption fee | Stress 0.50%; Defensive 1.00% | Listing 1: `redeemFeeStress = 0.005e18; // 0.50%` / `redeemFeeDefensive = 0.010e18; // 1.00%`; §21.4 matrix "Allowed (0.50%)" S3, "Allowed (1.00%)" S4 | **CONFIRMED** | 1027–1029; 9986; 5251 |
| 11 | Recovery confirmations | 48 hours; some buffer transitions specify 24h ramps/confirmation | `t_(confirm) ≥ 48 h (sustained, no breach)`; `RECOVERY_CONFIRMATION_PERIOD = 48 hours`; §16.3 transitions use 24h ramps and 24/48-consecutive-hour rules — matches the spec's note | **CONFIRMED** (governance-class caveat: §2.9 lists it as DAO-vote 51% while Listing 13 makes it a constant — the blueprint flags this itself at line 9973) | 1226; 9969; 10149; Listing 5: 5403; §16.3: 6356–6364 |
| 12 | Issuer concentration baseline | 25% soft checkpoint; 30% hard cap; 35% crisis ceiling with 4/7, 24h timelock + disclosure | "Value of assets issued by issuer_i / Total Reserve Value ≤ 30%"; "The 25% soft checkpoint and 30% hard block create a warning band … A 4-of-7 Risk Council vote can temporarily raise the limit to 35% during a liquidity crisis, but the override requires a 24-hour timelock and public disclosure" | **CONFIRMED** | §15.6.1: 5907–5909; criterion 8: 5790; Listing 7: 6011 |
| 13 | Oracle source quorum | ≥2 valid feeds from ≥2 source families | `N_(valid) ≥ 2 and |source families| ≥ 2`; "constitutional constant (Section 17.10) changeable only by the 7/7 Constitutional Multi-Sig with the 90-day timelock" | **CONFIRMED** | 7037–7039; §17.3.4: 7091–7095 |
| 14 | Oracle staleness | Major FX 60s; minor FX 120s; gold 60s; VIX/DXY 120s | §17.3.1 table: "Major FX (EUR/USD, GBP/USD) 60 seconds / Minor FX (JPY/USD, CNY/USD) 120 seconds / Gold (PAXG/XAU) 60 seconds / VIX, DXY 120 seconds — Discard feed" | **CONFIRMED** | 7051–7061 |
| 15 | Oracle confidence width caps | Major FX 0.5%; minor FX 1.0%; gold 1.0%; VIX/DXY 2.0% | §17.3.2 table: "Major FX (EUR/USD) 0.5% / Minor FX (JPY/USD, CNY/USD) 1.0% / Gold (PAXG) 1.0% / VIX, DXY 2.0%"; "The width caps are Risk-Council parameters (4/7) with the initial values above" | **CONFIRMED** | 7069–7081 |
| 16 | Oracle deviation breaker | 2.5% from median anchor | "If any feed deviates by more than 2.5% from the median of the available feeds, it is discarded"; `\|P_i − P̃\| ≤ 0.025 P̃`; "The 2.5% threshold is a Risk-Council parameter (4/7)"; Listing 9 `DEVIATION_BPS = 250` | **CONFIRMED** | 7085–7089; 7449 |
| 17 | Gold oracle confidence minimum | C_min = 0.60; liquidity input default 0.90 | "the threshold C_min (validation-stage default 0.60)"; Listing 9: `C_MIN = 0.60e18` / `liquidityInput = 0.90e18; // keeper-posted (§17.6)` — "validation-stage defaults" | **CONFIRMED** | 7169; 7453–7459 |
| 18 | Stress redemption demand | 25% of circulating liability value; NTO = S_circ × P_MTQ × 0.25 | `StressRedemptionDemand_(t) = S_(circ,t) × P_(MTQ,t) × 0.25`; Listing 1 getLCR: `stressDemand = (circSupply * price / 1e18) * 25 / 100`; Listing 5 `STRESS_REDEMPTION_RATE = 0.25e18` | **CONFIRMED** | 5063; 1151; 5401; 5750 |
| 19 | Dynamic buffer | 10% of liability buffer size; gold ratio BASE 62.5%, STRESS 85%, EMERGENCY 100%; v2.0 core gold adaptive | `V_(buffer,t) = 0.10 × S_circ × P_MTQ`; §16.2 state table 62.5/85/100; fidelity note "fixed core gold weight of 20% … is a v1.2 constant … under v2.0 the core reserve's gold share is an output of the reserve optimization" | **CONFIRMED** | 6341; 6312–6316; 6321–6333; §13.5.2: 5115–5133 |
| 20 | Maximum pool fraction | 10% of 24-hour pool depth | `TradeSize_max = min(\|Δ_t\| × V_net, 0.10 × PoolDepth_24h)`; "the protocol never consumes more than 10% of the pool's daily volume in a single trade"; `MAX_POOL_FRACTION = 0.10e18`; `maxPoolFraction = 0.10e18 // 10% of 24h pool depth (§12.4.1)` | **CONFIRMED** | 3077, 3086; 4215; 3194; 3277; 4361 |
| 21 | Maximum daily turnover | 5% | "maximum daily turnover of 5% of the total reserve value"; §11.8 "Max Daily Turnover — 5% of NAV"; `MAX_DAILY_TURNOVER = 0.05e18; // 5%` | **CONFIRMED** | 3107; 3192; 3273 |
| 22 | Slippage tolerance | 1% default in MARP listing; separate sell/buy constants and example-specific tolerances also exist | "Slippage Tolerance τ — 1%"; "with τ = 0.01 (1%) by default, adjustable by the Risk Council"; `slippageTolerance = 0.01e18; // 1% (default)`; separate constants `SLIPPAGE_BPS_SELL = 15 / SLIPPAGE_BPS_BUY = 20`; §12.3.3 per-class table stablecoins 0.5% / gold 1.0% / minor FX 1.5%; §12.3.1–2 examples use τ = 0.01 | **CONFIRMED** | 3188; 3103; 3269; 3295–3297; 4200–4204 |
| 23 | Trade deadline | 5 minutes | "Trades include a deadline — maximum 5 minutes from submission"; `TRADE_DEADLINE = 300; // 5 minutes` ("constitutional, immutable (BP §10.10)") | **CONFIRMED** | 4275; 4331–4333; 4537 |
| 24 | Gas fallback estimate | $50 equivalent; 150,000 gas units | "Gas Fallback GAS_FALLBACK $50 — Constitutional (immutable)"; `GAS_FALLBACK = 50e18; // $50 USD equivalent`; `GAS_UNITS_ESTIMATE = 150000; // 150k gas` | **CONFIRMED** | 3190; 3285; 3289 |
| 25 | Genesis example | $1,100,000 reserve; 1,000,000 MTQ minted; RR = 1.10 | "the protocol team deposits 1,100,000 USDC … Why 1,100,000? To achieve a 110% reserve ratio against 1,000,000 MTQ Σ … RR_genesis = 1,100,000 / (1,000,000 × 1.0000) = 1.10 = 110%" | **CONFIRMED** | 9215–9223; 9253 |
| 26 | Treasury sweep threshold | $10,000 | "Sweep Threshold = 10,000 USD"; §21.4 row "Sweep Threshold $10,000" (Paused in S5) | **CONFIRMED** | 9317–9319; 9992 |
| 27 | Gold shock tests | +50%, +25%, −10%, −20%, −30% | §23.8 scenario table: "Gold +50% / Gold +25% / Gold −10% / Gold −20% / Gold −30%" (+ liquidity reduction, issuer failure, custody interruption, oracle disagreement scenarios); §23.8.1 heading "Gold Price Shocks (+50%, +25%, −10%, −20%, −30%)" | **CONFIRMED** | 11784–11792; 11805 |

**Parameter-table result: 27/27 rows CONFIRMED. Zero DIFFERS. Zero NOT FOUND.** Two citation-level notes: (a) the 0.20% rebalancing fee is in §20.4 only (§2.9's table omits it); (b) "§7.7" as the location of the ρ constants is correct only via Listing 2 (the §7.7 contract), with §8.4 being the prose source. The spec's governance-status annotations (immutable vs mutable vs validation-stage) also track the blueprint's own labels (e.g., envelopes constitutional/7-of-7 with 90-day timelock at line 1951; velocity Risk-Council at line 1999; width caps "Risk-Council parameters (4/7) with the initial values above" at line 7081; θ_base/ε "validation-stage" at line 3207).

---

## Notes: where the eq-by-eq spec MISREPRESENTS (or under-/over-states) the blueprint

The eq-by-eq spec is under audit; these are the points where its characterization of the blueprint is not accurate or is materially incomplete:

1. **RG-09 — misrepresentation (most significant).** The gate asserts §10.9's displayed objective "does not show an explicit argmin/argmax". False for the section as a whole: §10.9 *does* display `ΔW* = argmin_ΔW J(ΔW)` (line 2971) and pins all four coefficients numerically (λ = 0.40/0.30/0.20/0.10, lines 2960–2966, repeated in §11.8 lines 3180–3186 and Listing 4 lines 3259–3265). Only the single J(ΔW) equation line (2943), read alone, lacks the operator. The *legitimate* residual issue the gate should have stated: the urgency term λ₃·(1/RR_t if RR_t<1.10 else 0) is independent of ΔW, so it cannot "penalise deviation" as the blueprint's own table claims (line 2952) and has no effect on the argmin — the sign/role of the urgency term is the real defect, not a missing optimization operator. A developer following RG-09 as written would re-derive an optimization direction the blueprint already states.
2. **RG-01 — overstates what is unresolved.** The gate tells developers to "choose the normative convention only after reconciling…". The blueprint already fixes the operative convention in §9.2 (line 2087: period returns use start-of-period weights; "Listing 3 implements exactly this convention") and Listing 3's header (lines 2307–2309) labels the W_{i,t−1} form "Authoritative recursion (§9.2, COO-16)". The genuinely open item is narrower: the COO-17 reconciliation of the §9.1 value-aggregate (G_t form; B_t^± valuation basis) with the recursion (lines 2071, 2101, 2105). Also, the gate's source locator "P596 and P598" does not resolve to anything in blueprint-full.txt (no page markers; TOC places §9.2 at printed p. 75; the formulas are at lines 2079/2083) — a citation defect, not a substantive one.
3. **RG-12 — denominator already pinned in source.** The gate's required action ("specify whether each percentage is relative to original position or remaining position") is already answered by the blueprint three times: "Each stage sells an additional fraction **of the original position**" (line 10047); the table column "**Cumulative Sell %**" with "(total 25%)"-style parentheticals (lines 10050–10058); and Listing 14 computing every stage off `totalValue` (10/100, 15/100, 25/100, remainder of totalValue — lines 10621–10651). The 10→25→50→100 summary phrasing (lines 10061, 12088, 12152, 12497, 12960, 13140) is the *same* convention stated cumulatively, not a conflicting one. The gate is not wrong that a precise denominator belongs in the implementation spec, but it presents as an open source ambiguity something the source resolves.
4. **RG-10 — understates the source.** The gate frames the open question as "whether ε is zero or a positive margin". The blueprint declares ε > 0 and instantiates it **twice with different units**: BENEFIT_MARGIN = 1% (§11.8 line 3200; Listing 4 line 3307; gate `benefit > costTerm + BENEFIT_MARGIN`, line 2933) and MIN_PROFITABILITY = $10 (§12.5 line 4265; Listing 5 line 4363; guard `netBenefit > minProfitability`, line 4745). The real Listing-4-vs-Listing-5 / percent-vs-absolute reconciliation is a source-level discrepancy the spec's gate list never names.
5. **RG-02 — misses the third definition.** The spec's gate covers §2.5/§14.1/§19.3 but not Appendix A.1 line 13054, where the blueprint's own glossary defines NAV_t as "Net asset value of the reserve (gross of nothing — see V_{net,t})" *while citing §2.5*, directly contradicting §2.5's index-value definition. Any approved nomenclature mapping must also fix the glossary. (Related unflagged collisions in the same glossary: D_t = "Weight deviation" vs §9.3's chain-link divisor D_t; B_t^± = "dynamic-buffer boundaries" vs §9.3's pre/post-rebalance basket values — lines 13056–13060 vs 2091–2097.)
6. **RG-13 — misses the competing five-status table.** The spec asks for a "single canonical table" but does not disclose that the source contains a second, conflicting status machine: §14.2.2 (lines 5237–5249) has FIVE statuses (no STRESS; DEFENSIVE = 1.00 ≤ RR < 1.05 with LCR "Any"; RECOVERY LCR ≥ **0.95**), implemented by Listing 6's `getProtocolStatus` (lines 5627–5631, default-DEFENSIVE fallthrough), vs §21.2's six states (STRESS 1.02–1.05, DEFENSIVE 1.00–1.02 with LCR ≥ 0.70, RECOVERY LCR ≥ **0.90**) implemented by Listing 13 (lines 10289–10317). Also unmentioned: the 48h confirmation period's governance class is self-contradictory in-source (§2.9 "DAO Vote (51%)" at line 1226 vs Listing 13 immutable constant at line 10149; blueprint flags it at line 9973). A canonical mapping exercise that starts only from §21.2–21.3 would leave §14.2.2/Listing 6 unresolved.
7. **RG-15 — §15.2 inclusion imprecise.** §15.2 is a concrete pass/fail standard (eight criteria; liquidity ≥ $1M; audit ≤ 12 months; 30% concentration; Listing 7 bounds 30%/$1M/0.5%–10% haircut floor-ceiling — lines 5786, 5784, 5790, 6011–6017), not a symbolic f(...)/g(...) section; the symbolic composite score E_j = f(...) lives in §14.3/§13.5.3 and is only cross-referenced by §15.2 (line 5793). The gate's blanket "these sections contain symbolic forms" is right for §4.2, §5.5, §8.2–8.3, §10.5–10.6 and §13.5, and wrong-by-omission-of-context for §15.2. Conversely the gate's message ("no developer may fill gaps with undocumented constants") is well supported: for every symbolic form the blueprint explicitly defers concrete calibration to the validation program/methodology version (lines 1377, 1529, 1975, 2875, 2891, 5091).
8. **RG-08 — gold-vs-FX aggregation mode not spelled out.** The gate's truth-table action item mentions "gold-specific mode" without noting the concrete source fact: §17.4 defines the canonical gold price as `P_G^raw = Median(P₁,…,P_n)` (line 7103, optionally robust weighted median) while §17.5's getPrice pipeline returns the outlier-filtered **mean** for FX (lines 7131, 7139–7141). Two different published aggregates in one oracle chapter is a bigger reconciliation surface than "summary vs implementation".
9. **Minor scope note.** The spec's preamble calls the master blueprint "301-page"; the task brief said "~21,000+ lines". The authoritative extraction audited here is 13,529 lines (the prior 21,227-line extraction in the project history was superseded). Line-number citations in the eq-by-eq spec (e.g., "P596/P598") do not correspond to this extraction; section-number citations do, without exception.

**Overall assessment:** 14 of 15 gates are CONFIRMED as descriptions of the blueprint (RG-09 PARTIALLY CONFIRMED with one genuine misrepresentation). The parameter table is fully accurate — 27/27 values match the blueprint exactly, including governance-status annotations. The gates' *required developer actions* are generally sound but in four cases (RG-01, RG-09, RG-10, RG-12) they direct developers to resolve questions the blueprint has already answered, while in two cases (RG-02, RG-13) they understate real conflicts the blueprint contains (glossary NAV_t; §14.2.2 five-status table; ε 1%-vs-$10). No source code was modified during this audit.
