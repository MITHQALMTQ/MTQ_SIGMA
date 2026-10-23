**MTQ Σ**

**Equation-by-Equation Developer Alignment Specification**

Formula descriptions, implementation checks, constants, and source-level
reconciliation gates

Source: MTQ Σ Master Monetary Architecture & Quantitative Specification
v1.0\
Issued 2026-09-08 · Status in source: Candidate for Public Testing ---
Not Production-Authorized

**Purpose: implementation alignment only. No formula is approved,
corrected, or production-validated by this document.**

# Developer handoff: mandatory instruction

Use this document together with the full 301-page master blueprint. The
blueprint remains the authoritative source; this handoff is a navigable
formula catalogue and verification checklist, not a replacement for the
full specification.

-   Read the blueprint line by line, including tables, worked examples,
    formula paragraphs and all smart-contract listings. Trace every
    formula from input data through calculation, constraints, state
    transition, execution, publication and tests.

-   Implement formulas as written unless the source itself contains an
    ambiguity or conflict. Where a conflict is listed in Section
    "Source-level reconciliation gates", stop and document the
    discrepancy; do not silently choose, simplify, "correct", or invent
    a coefficient.

-   Keep the three independent mathematical layers separate: (1)
    constituency/eligibility, (2) MASE target weights, and (3) MARP
    execution plus reserve management.

-   Keep reference-basket value, MTQ token liability, and reserve
    backing as different quantities. Keep index weights and reserve
    weights independent.

-   Keep the four weight states distinct: W\^Prior, W\^Target, W\^Smooth
    and W\^Execution. Show each in logs/API/UI with clear labels.

-   The initial 27/20/9/8/5/5/26 vector is a strategic prior and genesis
    snapshot, not a fixed basket definition or a final optimal
    allocation.

-   PAR = 1 basket-unit is not a fixed \$1 peg. Mint pricing must use
    the adaptive reference price; redemption uses the specified
    reserve/NAV method, with the exact meaning of NAV disambiguated as
    noted below.

-   Daily calculation does not imply daily trading. MARP requires
    trigger eligibility plus cost-benefit, liquidity, reserve, oracle
    and execution guards.

-   Publish the data version, methodology version, oracle versions,
    target/smoothed/execution states and decision log so an independent
    auditor can reproduce outputs.

-   Keep legacy v1.2/fixed-quantity formulas explicitly marked
    historical; do not let them override the current adaptive v2.0 /
    Master v1.0 equations.

-   Production must remain disabled until the blueprint's validation
    gates are evidenced and the on-chain honest-status state permits
    production. The uploaded blueprint status is not
    production-authorized.

# Reading and notation rules

The "Equation as specified" lines preserve the mathematical relationship
as rendered in the source text. The DOCX may render
subscripts/superscripts as plain text in places; where exact
index/weight timing or symbol meaning matters, use the source section
and reconciliation gate instead of guessing. "Developer alignment check"
means what needs to be verified against the normative section and source
code; it is not a claim that the current implementation is already
correct.

# Constitutional concept gates --- do not violate

  ------------------------------------------------------------------------
  **Concept**             **What it means**       **Non-negotiable
                                                  implementation
                                                  implication**
  ----------------------- ----------------------- ------------------------
  **Reference basket**    Defines one unit of     Its weights are model
                          account / the adaptive  outputs under a fixed
                          index value.            published methodology.

  **MTQ Σ token**         Transferable monetary   Its issue and redemption
                          unit / liability.       calculations must
                                                  reference current
                                                  index/NAV rules.

  **Reserve portfolio**   Eligible collateral and Its allocation is not
                          liquidity that back     forced to equal
                          obligations.            reference-basket
                                                  weights.

  **Constituency engine** Determines which        Eligibility is scored
                          currencies/Gold         and
                          qualify.                hysteresis-controlled,
                                                  not a manual weight
                                                  allocation.

  **MASE**                Determines target       Ensemble of multiple
                          weights for eligible    models plus constraints;
                          assets.                 no fixed outcome
                                                  guarantee.

  **MARP / reserve        Decides if, when and    No-trade bands,
  engine**                how target gaps are     cost-benefit, partial
                          actually corrected.     execution, liquidity and
                                                  reserve controls.

  **Weight states**       Prior → Target → Smooth Do not label any
                          → Execution.            intermediate state as
                                                  the effective live state
                                                  without saying which
                                                  state.

  **Index vs reserve**    W\^Index ≠ W\^Reserve   Reserve size/composition
                          in general.             follows obligations,
                                                  redemptions, liquidity,
                                                  custody and collateral
                                                  constraints.
  ------------------------------------------------------------------------

# Equation and calculation catalogue

Each entry contains the source section, an equation rendered from that
section, the equation's role, and a concrete implementation check. If a
source expression is symbolic (for example f(...)) rather than fully
parameterized, the entry says so; no missing numerical function is
invented here.

# 1--2. Architecture, variables and invariants

## EQ-001 · Four distinct weight states

> **W\^Prior ≠ W\^Target ≠ W\^Smooth ≠ W\^Execution**

**Source:** §2.3; §3.2

**Description:** The strategic prior is only an anchor; target is the
optimizer output; smooth is the risk-paced published/live state;
execution is the trade decision after MARP checks.

**Developer alignment check:** Do not collapse these values into one
variable. Store and publish each state separately; log every
transformation between them.

## EQ-002 · Index weights and reserve weights are decoupled

> **W\^Index ≠ W\^Reserve (in general)**

**Source:** §2.4

**Description:** The reference basket defines the monetary unit; the
reserve portfolio supplies collateral and liquidity. They are
operationally related but must not have identical weights by assumption.

**Developer alignment check:** Do not automatically allocate reserve
assets using the reference-index weights. Reserve management is
obligation-, liquidity-, and collateral-driven.

## EQ-003 · Immutable denomination constant

> **PAR = 1.00 basket-unit**

**Source:** §2.5; §18.1

**Description:** One MTQ Σ is denominated as one unit of the reference
basket at genesis. PAR is a unit-of-account convention, not a fixed USD
price.

**Developer alignment check:** Do not implement PAR as a USD peg or
hardcode 1 MTQ = \$1 at all times.

## EQ-004 · Token supply identity

> **S_t = Minted_t − Burned_t**

**Source:** §2.5; §20.1

**Description:** Total token supply follows cumulative minting less
cumulative burning; distinguish total supply from circulating supply
where the blueprint does so.

**Developer alignment check:** Check treasury-held tokens, burns, and
circulating-supply accounting are not conflated.

## EQ-005 · Liability identity

> **L_t = S_circ,t × P_MTQ,t**

**Source:** §2.5; §18.2

**Description:** USD-equivalent liabilities are circulating supply
multiplied by the current adaptive reference price.

**Developer alignment check:** Use circulating supply and current
reference price; do not use a fixed USD peg or total minted supply
unless the definition specifically calls for it.

## EQ-006 · Net reserve asset value

> **V_net,t = Σ_j Q_j,t × P_j,t × (1 − H_j)**

**Source:** §2.5; §14.1

**Description:** Each reserve position is valued at quantity times
oracle price, discounted by its asset-specific haircut.

**Developer alignment check:** Every applicable NAV/coverage calculation
must use the haircut-adjusted value. A raw gross-value number must not
silently substitute for V_net.

## EQ-007 · Reserve ratio

> **RR_t = V_net,t / L_t**

**Source:** §2.5; §14.2

**Description:** Measures haircut-adjusted reserve value relative to
token liabilities.

**Developer alignment check:** Enforce the three reserve-ratio tiers
described in §§2.9, 14.2, and 21; do not permit RR below the
constitutional hard floor in normal operation.

## EQ-008 · Liquidity coverage ratio

> **LCR_t = LiquidAssets_t / StressRedemption_t**

**Source:** §2.5; §13.4

**Description:** Compares immediately liquid eligible reserve assets
with the defined near-term/stress redemption demand.

**Developer alignment check:** The numerator must follow the approved
liquid-asset class; the denominator must use the specified stress-demand
model, not an ad hoc value.

## EQ-009 · Candidate currency universe

> **U = {USD, EUR, JPY, GBP, CNY, CHF, CAD, AUD, SGD, ..., GOLD}**

**Source:** §2.4

**Description:** Defines the expandable universe that the constituency
engine may evaluate.

**Developer alignment check:** An initial monitored universe is not the
same as the active set; membership must be determined by eligibility
rules.

# 3. Adaptive reference basket and gold allocation

## EQ-010 · Live weight pipeline

> **W_t\^Live = MASE(Data_t, W\^Prior, Risk_t, Macro_t, PP_t,
> Liquidity_t, Cost_t)**

**Source:** §3.1

**Description:** Live composition is computed from data and model inputs
rather than copied from a fixed percentage table.

**Developer alignment check:** The live state must be the result of the
constrained pipeline in §§7--8 and the MARP execution layer; document
which exact state this shorthand denotes.

## EQ-011 · Live weights are not the strategic prior

> **W_t\^Live ≠ W\^StrategicPrior (in general)**

**Source:** §3.1

**Description:** The published prior is a soft stabilizing anchor and is
not the current index composition.

**Developer alignment check:** Never display prior percentages as the
live basket weights.

## EQ-012 · Strategic prior vector

> **W\^Prior = \[USD 27%, EUR 20%, JPY 9%, GBP 8%, CNY 5%, CHF 5%, Gold
> 26%\]**

**Source:** §3.2; §26.4

**Description:** The current starting-prior vector sums to 100% and is
retained as a research/initialization snapshot.

**Developer alignment check:** Use as genesis/prior input only. It must
not be treated as fixed live weights or a proven optimal allocation.

## EQ-013 · Fixed-weight interpretation explicitly rejected

> **MTQ Σ ≠ {USD=27%, EUR=20%, JPY=9%, GBP=8%, CNY=5%, CHF=5%,
> Gold=26%}**

**Source:** §3.1

**Description:** The displayed percentages are not the definition of MTQ
Σ.

**Developer alignment check:** Any UI/API/documentation calling those
percentages "the MTQ basket" as current composition violates the
blueprint.

## EQ-014 · Legacy gold multiplier

> **W_i,raw = S_i × K_i**

**Source:** §3.3 \[historical\]

**Description:** This is the former gold-factor form that modified
currency weights; v2.0 retains it only as an input-signal/history, not
as the current gold-allocation mechanism.

**Developer alignment check:** Mark as legacy/superseded. Do not let
this formula silently replace the independent gold allocation model.

## EQ-015 · Adaptive gold target

> **W_G,t\^Target = f(W_G\^Prior, RiskContribution_G, Diversification_G,
> Inflation_G, Crisis_G, Liquidity_G, PurchasingPower_G)**

**Source:** §3.3

**Description:** Gold receives its own target from risk,
diversification, inflation, crisis, liquidity, and purchasing-power
inputs.

**Developer alignment check:** Do not hardcode gold at 26%, 26.25%, or a
±3% macro adjustment as the current allocation rule.

## EQ-016 · Genesis normalization condition

> **I_0 = 1.0000**

**Source:** §3.4; §9.6

**Description:** Base fixings and the genesis snapshot are initialized
so the reference index begins at 1.0000.

**Developer alignment check:** Independently recompute the genesis
denominator and emit/verify the genesis event before enabling minting or
rebalancing.

# 4. Currency constituency and eligibility

## EQ-017 · Composite eligibility score

> **Q_i = a_R R_i + a_T T_i + a_L L_i + a_S S_i + a_D D_i + a_C C_i −
> a_G G_i − a_X X_i**

**Source:** §4.2

**Description:** Combines reserve relevance, trade/payment relevance,
liquidity, stability, diversification, and convertibility positively;
geopolitical concentration and transferability/capital-control risks
reduce the score.

**Developer alignment check:** Normalize input units before comparing
scores. Publish the coefficient set and data/methodology version.

## EQ-018 · Eligibility threshold

> **Q_i ≥ Q_min**

**Source:** §4.2

**Description:** A currency meets the eligibility threshold when its
composite score is at least the governed threshold.

**Developer alignment check:** Entry and exit hysteresis thresholds are
separate; do not use one threshold for both directions.

## EQ-019 · Score normalization

> **Q̃\_i = (Q_i − Q_min) / (Q_max − Q_min)**

**Source:** §4.2.1

**Description:** The specification states min--max normalization across
the candidate universe for the current evaluation round.

**Developer alignment check:** The source uses Q_min both as an
eligibility threshold and in a sentence about minimum observed scores.
Resolve and document the symbol distinction before implementation; do
not silently alter the intended threshold.

## EQ-020 · Structural input z-score

> **z_i,k = (x_i,k − μ_k) / σ_k**

**Source:** §4.5

**Description:** Normalizes input k for currency i using the
cross-sectional mean and standard deviation.

**Developer alignment check:** Define behavior when σ_k = 0 or data are
missing; if using rank/percentile alternatives, version and publish the
transform.

## EQ-021 · Aggregated structural score

> **S_i\^Structural = Σ_k a_k z_i,k**

**Source:** §4.5; Appendix A

**Description:** Combines normalized structural inputs using published
aggregation coefficients.

**Developer alignment check:** Run parameter perturbation tests on a_k
and publish intermediate structural scores.

## EQ-022 · Entering-currency weight ramp

> **W_j,t = r_t × W_j,target**

**Source:** §4.6

**Description:** Gradually ramps an admitted currency toward its target
allocation.

**Developer alignment check:** The default linear ramp is r_t = t/T;
define the time index, clip at 1, and apply MARP gates throughout the
transition.

## EQ-023 · Hysteresis/dead-band logic

> **Q_i \> Q_entry (entry); Q_i \< Q_exit (exit); Q_entry \> Q_exit**

**Source:** §4.7

**Description:** Requires a higher score to enter than to remain
eligible, preventing repeated boundary oscillation.

**Developer alignment check:** Persist membership state so a currency
that has entered is not exited using the entry threshold.

## EQ-024 · Transition smoothness and cadence

> **Σ_h ω_h = 1**

**Source:** §4.7

**Description:** The chapter also uses horizon weights that sum to one;
this identity applies to the multi-horizon blend detailed in §5.1.

**Developer alignment check:** Keep the horizon-weight constraint
separate from the constituency entry/exit thresholds.

# 5. MASE input signals and regime detection

## EQ-025 · Multi-horizon volatility

> **σ_i\^MH = Σ_h ω_h σ_i,h, h ∈ {30d, 90d, 252d, 756d}**

**Source:** §5.1

**Description:** Blends annualized volatility estimates over four
trailing horizons.

**Developer alignment check:** Confirm all component volatilities use
comparable annualization and validated source prices; ω_h must sum to
one.

## EQ-026 · Gold price in currency i

> **P_i,t = price of one unit of gold expressed in currency i**

**Source:** §5.2

**Description:** Defines the input price series used to compare each
currency with gold.

**Developer alignment check:** Keep quote direction and units explicit;
do not mix gold units, USD prices, or currency-per-gold quotations.

## EQ-027 · Gold-relative purchasing-power return

> **GPR_i,t = (P_i,t−1 / P_i,t) − 1**

**Source:** §5.2

**Description:** Blueprint formula for the gold-relative
purchasing-power signal over the stated period.

**Developer alignment check:** Preserve the exact source formula and
confirm its sign convention against the definition of P_i,t; do not
reverse the ratio without an approved change.

## EQ-028 · Multi-horizon gold signal

> **GSignal_i = f(GPR_30, GPR_90, GPR_252, GPR_756)**

**Source:** §5.2

**Description:** Combines gold-relative signals across 30-, 90-, 252-,
and 756-day horizons.

**Developer alignment check:** Document the selected function and
coefficients in the published methodology; the shorthand f alone is not
enough for reproducibility.

## EQ-029 · VIX rolling mean and standard deviation

> **μ_VIX,t = (1/90) Σ\_{i=0}\^{89} VIX_t−i; σ_VIX,t = √\[(1/90)
> Σ\_{i=0}\^{89}(VIX_t−i − μ_VIX,t)\^2\]**

**Source:** §5.3

**Description:** Calculates a 90-observation mean and standard deviation
for VIX before standardization.

**Developer alignment check:** Confirm whether population or sample
standard deviation is intended; the displayed source equation uses
denominator 90.

## EQ-030 · VIX and DXY z-scores

> **z_t\^VIX = (VIX_t − μ_VIX,t)/(σ_VIX,t + ε); z_t\^DXY = (DXY_t −
> μ_DXY,t)/(σ_DXY,t + ε)**

**Source:** §5.3

**Description:** Standardizes macro indicators while ε prevents division
by zero.

**Developer alignment check:** Specify ε, windowing, stale-data
fallback, and any clamping exactly as source constants/rules require.

## EQ-031 · Regime probability vector

> **p_t = \[P(N), P(I), P(D), P(S), P(L), P(G)\]**

**Source:** §5.4

**Description:** Represents probabilities for the six defined regimes in
the regime model.

**Developer alignment check:** Map each symbol to the blueprint's regime
labels and verify probabilities sum to one; retain the source ordering.

## EQ-032 · Regime-conditional target

> **W_t\^Regime = Σ_r P(r \| X_t) W\^(r)**

**Source:** §5.4

**Description:** Probability-weights the regime-specific candidate
portfolios.

**Developer alignment check:** Regime probabilities must come from the
specified classifier and must be versioned/reproducible.

## EQ-033 · Crisis risk score

> **CrisisScore_t = f(FXVol, CrossAssetCorrelation, LiquidityStress,
> InflationShock, CreditStress, MarketDrawdown,
> GeopoliticalIndicators)**

**Source:** §5.5

**Description:** Aggregates indicators that determine crisis posture and
adapt the tail-risk weight/smoothing behavior.

**Developer alignment check:** The source gives a functional form, not
fixed coefficients here. Obtain the normative model definition/version;
do not invent coefficients.

## EQ-034 · Crisis-scaled CVaR penalty

> **λ_CVaR,t = λ_CVaR,0 × (1 + k × CrisisScore_t)**

**Source:** §5.5

**Description:** Raises the CVaR penalty as crisis risk rises.

**Developer alignment check:** Bound/normalize CrisisScore and k so the
resulting penalty stays within governed parameter envelopes.

# 6. Risk estimation and candidate optimization models

## EQ-035 · Covariance matrix

> **Σ_t = Cov(R_1, ..., R_n)**

**Source:** §6.1

**Description:** Builds the component-return covariance matrix from
validated multi-horizon return series.

**Developer alignment check:** Define return intervals, sample windows,
missing-data treatment, and component order consistently.

## EQ-036 · Robust covariance shrinkage

> **Σ_robust = λF + (1 − λ)Σ̂, 0 ≤ λ ≤ 1**

**Source:** §6.2

**Description:** Shrinks the estimated covariance matrix toward a stable
structured target F.

**Developer alignment check:** Ensure F and Σ̂ are dimensionally
compatible and the chosen λ is validated out of sample.

## EQ-037 · Minimum-variance objective

> **min_w wᵀ Σ_robust,t w**

**Source:** §6.3

**Description:** Finds admissible weights minimizing modeled portfolio
variance.

**Developer alignment check:** Optimization is subject to all Chapter 8
constraints and the eligibility set; this output is only one candidate
model.

## EQ-038 · Component risk contribution and portfolio volatility

> **RC_i = w_i(Σw)\_i; σ_p = √(wᵀΣw); RC%\_i = RC_i / Σ_j RC_j**

**Source:** §6.4

**Description:** Computes each component's contribution to portfolio
risk and its share of total risk contribution.

**Developer alignment check:** Use consistent covariance/weight units;
define behavior if total risk contribution is zero.

## EQ-039 · Equal-risk-contribution objective

> **min_w Σ_i (RC%\_i − 1/n)\^2**

**Source:** §6.4

**Description:** Chooses weights that make each eligible component's
fraction of risk contribution approach 1/n.

**Developer alignment check:** n is the number of eligible active
components; update n and the model dimension on constituency changes.

## EQ-040 · Maximum diversification ratio

> **max_w (Σ_i w_i σ_i) / √(wᵀΣw)**

**Source:** §6.5

**Description:** Maximizes weighted standalone volatility relative to
portfolio volatility.

**Developer alignment check:** Subject to the same constraints; do not
confuse this with maximizing return.

## EQ-041 · Value at Risk

> **VaR_α = inf{ℓ : P(L ≤ ℓ) ≥ α}**

**Source:** §6.6

**Description:** Defines the α-quantile of the loss distribution.

**Developer alignment check:** Specify α and loss sign convention in the
methodology version.

## EQ-042 · Conditional Value at Risk

> **CVaR_α = E\[L \| L ≥ VaR_α\]**

**Source:** §6.6

**Description:** Measures expected loss conditional on losses lying at
or beyond the VaR threshold, as defined by the blueprint.

**Developer alignment check:** Keep the tail convention, α, estimator,
and sampling window consistent across optimization, validation, and
reporting.

## EQ-043 · Running peak, drawdown and maximum drawdown

> **M_t = max\_{τ≤t} V_τ; DD_t = V_t/M_t − 1; MDD = min_t DD_t**

**Source:** §6.7

**Description:** Measures current decline from the running peak and the
worst drawdown in the period.

**Developer alignment check:** The source expresses drawdowns as
non-positive returns; preserve that sign convention wherever MDD enters
scores.

## EQ-044 · Global Purchasing Power index

> **GPP_t = f(GlobalCPI, Food, Energy, TradeGoods,
> OtherRelevantConsumptionWeights)**

**Source:** §6.8

**Description:** Represents a consumption-relevant benchmark for global
purchasing-power change.

**Developer alignment check:** The source gives the input family, not a
complete fixed numerical index here. Do not invent CPI weights or data
sources.

## EQ-045 · Purchasing-power tracking error

> **PPError_t = R_MTQ,t − R_GPP,t**

**Source:** §6.8

**Description:** Compares the reference basket's return with the
benchmark purchasing-power return.

**Developer alignment check:** Define both returns over the same
interval and in compatible units; publish GPP construction and data
versions.

## EQ-046 · Purchasing-power objective measures

> **E\[(PPError_t)\^2\] and/or MAE(PPError)**

**Source:** §6.8

**Description:** The blueprint identifies mean-squared error and/or mean
absolute error as measures for optimizing purchasing-power stability.

**Developer alignment check:** Research must select and publish the
metric; do not switch metrics silently between optimization and
validation.

# 7. Composite MASE objective and ensemble

## EQ-047 · Strategic-prior quadratic drift

> **StrategicDrift = Σ_i (w_i − W_i\^Prior)\^2**

**Source:** §7.1

**Description:** Penalizes squared deviation from the strategic prior.

**Developer alignment check:** Confirm this is the selected version. The
same source also presents an absolute-deviation alternative below; do
not combine both unless methodology says so.

## EQ-048 · Strategic-prior absolute drift alternative

> **StrategicDrift = Σ_i \|w_i − W_i\^Prior\|**

**Source:** §7.1

**Description:** Alternative L1 form of the strategic-drift penalty also
shown by the specification.

**Developer alignment check:** The chosen L1/L2 form must be versioned
and consistent with the objective and reproducibility record.

## EQ-049 · Herfindahl concentration measure

> **HHI = Σ_i w_i\^2**

**Source:** §7.2

**Description:** Measures weight concentration in the reference basket.

**Developer alignment check:** Use the currently eligible components and
normalized weights; retain published component order.

## EQ-050 · Concentration penalty

> **Penalty_conc = λ_C × HHI**

**Source:** §7.2

**Description:** Adds a governed concentration penalty to the optimizer
objective.

**Developer alignment check:** Publish λ_C and keep it within validated
bounds.

## EQ-051 · Portfolio turnover

> **Turnover_t = Σ_i \|w_i,t − w_i,t−1\|**

**Source:** §7.3

**Description:** Measures total absolute weight movement between
consecutive calculated states.

**Developer alignment check:** Do not confuse index weight drift with
executed trade turnover; both may be logged separately.

## EQ-052 · Turnover penalty

> **Penalty_turn = λ_T Σ_i \|w_i,t − w_i,t−1\|**

**Source:** §7.3

**Description:** Prices frequent/large weight changes into the
optimization objective.

**Developer alignment check:** Use the published λ_T and the same
observation cadence as the source.

## EQ-053 · Full composite MASE objective

> **min_w \[λ₁ Risk + λ₂ CVaR + λ₃ PPError + λ₄ CorrRisk + λ₅ Turnover +
> λ₆ StrategicDrift + λ₇ Concentration + λ₈ LiquidityRisk\]**

**Source:** §7.4

**Description:** Eight-term objective combining variance/risk, tail
loss, purchasing-power error, correlation fragility, turnover, strategic
drift, concentration, and liquidity risk.

**Developer alignment check:** Keep every term's units/scaling and λ
coefficient explicit. λ values are governed/validated; the objective is
not a single-metric optimizer.

## EQ-054 · Weight and reserve constraints

> **Σ_i w_i = 1; w_i ≥ 0; L_i,t ≤ w_i,t ≤ U_i,t; \|w_i,t − w_i,t−1\| ≤
> Δ_i,t; Coverage_t ≥ 100%; LiquidityCoverage_t ≥ LCR_min**

**Source:** §7.4; §8.5

**Description:** Complete constraint set: sum-to-one, non-negativity,
dynamic/constitutional envelopes, velocity, full backing, and liquidity
coverage.

**Developer alignment check:** Validate every constraint both at model
output/projection and at execution time. Passing weight checks alone is
not sufficient if reserve/liquidity constraints fail.

## EQ-055 · Candidate ensemble

> **W\^Ensemble = Σ_m α_m W\^(m); Σ_m α_m = 1**

**Source:** §7.5

**Description:** Combines model candidate vectors, with coefficients α_m
summing to one.

**Developer alignment check:** Project the mixture back into the
admissible set after averaging; an average of feasible/infeasible
outputs is not automatically feasible.

## EQ-056 · Model performance-stability score

> **Score_m,t = f(OOSRisk, CVaR, PPError, Turnover, Robustness)**

**Source:** §7.6

**Description:** Scores each candidate model using out-of-sample
risk/stability features.

**Developer alignment check:** Define exact component scaling and score
orientation. Only OOS statistics may determine adaptive model weights.

## EQ-057 · Adaptive model weight softmax

> **α_m,t = exp(−η Score_m,t) / Σ_k exp(−η Score_k,t)**

**Source:** §7.6

**Description:** Converts model scores into adaptive ensemble
coefficients using temperature η.

**Developer alignment check:** The prose states better models receive
greater weight. Therefore confirm the score is "lower-is-better" under
this negative-exponent form; do not reverse signs without recording a
specification change.

## EQ-058 · Adaptive ensemble output

> **W_t\^Ensemble = Σ_m α_m,t W_t\^(m); Σ_m α_m,t = 1**

**Source:** §7.6

**Description:** Produces the live candidate mixture using time-varying
coefficients.

**Developer alignment check:** Do not use the older illustrative
45/35/20 split as fixed coefficients; the blueprint explicitly says it
is not a system parameter.

# 8. Constitutional constraints and smoothing

## EQ-059 · Dynamic lower bound

> **L_i,t = f(L_base, Q_i, Risk_i, Liquidity_i)**

**Source:** §8.2

**Description:** Allows lower admissibility bounds to respond to
eligibility, risk, liquidity, and baseline bounds.

**Developer alignment check:** The source leaves f symbolic and
explicitly says concrete functions are a research deliverable. Do not
fabricate an implementation formula.

## EQ-060 · Dynamic upper bound

> **U_i,t = f(U_base, Q_i, Risk_i, Liquidity_i)**

**Source:** §8.2

**Description:** Allows upper admissibility bounds to respond to the
same state variables.

**Developer alignment check:** The dynamic bounds must stay inside the
constitutional envelope; activation waits for validation.

## EQ-061 · Dynamic bound containment

> **L_i\^const ≤ L_i,t ≤ U_i,t ≤ U_i\^const**

**Source:** §8.2

**Description:** Keeps adaptive inner bounds inside immutable outer
constitutional limits.

**Developer alignment check:** Never allow dynamic-bound logic to widen
outside the constitutional arrays.

## EQ-062 · Weight velocity limit

> **\|w_i,t − w_i,t−1\| ≤ Δ_i**

**Source:** §8.3

**Description:** Caps per-update movement for a component.

**Developer alignment check:** The deployed MAX_VELOCITY values are per
accepted update; keep them distinct from daily turnover caps and trading
triggers.

## EQ-063 · State-dependent velocity limit

> **\|w_i,t − w_i,t−1\| ≤ Δ_i,t; Δ_i,t = g(Liquidity_i,t, Stress_t,
> Cost_i,t, StructuralEvent_i,t)**

**Source:** §8.3

**Description:** Allows the permitted weight speed to respond to
liquidity, stress, execution cost, and structural transitions.

**Developer alignment check:** Any concrete g must be specified, bounded
and versioned; a symbolic form is not enough for deterministic
production implementation.

## EQ-064 · Stress-adaptive smoothing

> **W_t\^Smooth = ρ_t W_t−1 + (1 − ρ_t)W_t\^Target; 0 \< ρ_t \< 1**

**Source:** §8.4

**Description:** Blends the previous live weight vector with today's
constrained target; larger ρ slows changes.

**Developer alignment check:** Use ρ=0.50 in normal conditions and
ρ=0.75 under stress as the current listed defaults, subject to the
source's status/validation caveats. Ensure weights still sum to one
after fixed-point rounding.

## EQ-065 · Consolidated feasibility condition

> **Σ_i w_i = 1; w_i ≥ 0; L_i,t ≤ w_i,t ≤ U_i,t;
> \|w_i,t−w_i,t−1\|≤Δ_i,t; Coverage_t≥100%;
> LiquidityCoverage_t≥LCR_min**

**Source:** §8.5

**Description:** Repeats the complete constrained admissibility envelope
for developer-facing implementation.

**Developer alignment check:** Must be reflected in registry validation
and in MARP/reserve gates; no optimizer or emergency override may
silently bypass the constitutional bounds.

# 9. Chain-linked index valuation and attribution

## EQ-066 · Value-aggregate reference index

> **I_t = G_t × Σ_i W_i,t × (P_i,t / P_i,0)**

**Source:** §9.1

**Description:** Builds an index from live weights, current constituent
prices, immutable base prices, and cumulative chain-link normalization
G_t.

**Developer alignment check:** This is the intended current
adaptive-index form; specify how G_t includes all divisor/constituency
changes and ensure output is normalized at genesis.

## EQ-067 · Base index condition

> **I_0 = 1**

**Source:** §9.1

**Description:** Initial index is one at the genesis base date.

**Developer alignment check:** Match the 1.0000 convention used
elsewhere and use the same base denominator in the contract and
off-chain verifier.

## EQ-068 · Recursive index form A

> **I_t = I_t−1 × \[Σ_i W_i,t × (P_i,t / P_i,t−1)\]**

**Source:** §9.2 \[formula as printed\]

**Description:** One displayed recursive form uses current-period
weights for constituent price relatives.

**Developer alignment check:** The next source formula uses prior-period
weights; reconcile the intended convention against the prose and
implementation before coding. Do not pick one silently.

## EQ-069 · Recursive index form B

> **I_t = I_t−1 × \[Σ_i W_i,t−1 × (P_i,t / P_i,t−1)\]**

**Source:** §9.2 \[formula as printed\]

**Description:** A second displayed recursive form uses
beginning-of-period/prior weights for price relatives.

**Developer alignment check:** Record which equation is normative and
why. Tests must demonstrate equivalence/expected behavior against the
value-aggregate form and published return series.

## EQ-070 · Chain-link divisor

> **D_t = B_t− / B_t+**

**Source:** §9.3

**Description:** Computes the divisor factor at a rebalance using pre-
and post-rebalance basket values at the same prices.

**Developer alignment check:** Define B_t− and B_t+ valuation basis
explicitly; publish the basis and D_t for each change.

## EQ-071 · Continuity at a rebalance

> **I_t+ = D_t × B_t+ = B_t−**

**Source:** §9.3

**Description:** Ensures a composition change creates no artificial
index jump by construction.

**Developer alignment check:** No phantom return may arise solely from
changing weights or constituency.

## EQ-072 · Gold period contribution

> **Contribution_G = W_G,t−1 × \[(P_G,t / P_G,t−1) − 1\]**

**Source:** §9.4

**Description:** Measures gold's contribution to reference-index return
using the prior period weight.

**Developer alignment check:** Use the same period-weight convention as
the selected chain-linked recursion.

## EQ-073 · Currency/component period contribution

> **Contribution_i = W_i,t−1 × \[(P_i,t / P_i,t−1) − 1\]**

**Source:** §9.4

**Description:** Measures each component's contribution to index return.

**Developer alignment check:** Sum over the same active constituency and
use price series with consistent units.

## EQ-074 · Total index return attribution

> **R_MTQ,t = Σ_i Contribution_i**

**Source:** §9.4

**Description:** Aggregates per-component return contributions.

**Developer alignment check:** Attribution plus separately reported
execution costs and smoothing/tracking effects should explain the
difference from realized portfolio results.

## EQ-075 · Expanded attribution terms

> **R_MTQ = R_USD + R_EUR + R_JPY + R_GBP + R_CNY + R_CHF + R_Gold**

**Source:** §9.4

**Description:** Shows the initial seven-component contribution
decomposition.

**Developer alignment check:** Generalize the summation to the active
set if constituency changes; do not permanently freeze the universe to
the seven initial components.

## EQ-076 · Legacy GFB fixed-quantity index

> **GFB_t = (q_USD·1.00 + q_EUR·FX_EUR/USD,t + q_GBP·FX_GBP/USD,t +
> q_JPY·FX_JPY/USD,t + q_CNY·FX_CNY/USD,t) / (q_USD·1.00 +
> q_EUR·FX_EUR/USD,base + q_GBP·FX_GBP/USD,base +
> q_JPY·FX_JPY/USD,base + q_CNY·FX_CNY/USD,base)**

**Source:** §9.7.1 \[historical fixed-quantity form\]

**Description:** Carries the former fixed-quantity GFB formula in the
historical index-construction section.

**Developer alignment check:** Treat as legacy/source-lineage only
unless the owner explicitly reclassifies it. It omits CHF and gold and
is not the current adaptive seven-component formula; the v2.0 index
equations govern current behavior.

# 10. MARP: Monetary Adaptive Rebalancing Protocol

## EQ-077 · MARP calculation state

> **Calc_t = {W_t\^Target, Risk_t, CVaR_t, ReserveCoverage_t,
> Liquidity_t, OracleHealth_t, TransactionCost_t}**

**Source:** §10.1

**Description:** State inputs for a daily execution decision.

**Developer alignment check:** Keep daily calculation separate from
execution. A daily data calculation must not imply a daily trade.

## EQ-078 · Component urgency score

> **U_i = aD_i + b RiskDeterioration_i + c PPDeterioration_i + d
> Crisis_i − e TransactionCost_i**

**Source:** §10.2

**Description:** Combines deviation, risk deterioration,
purchasing-power deterioration and crisis signal, less transaction cost.

**Developer alignment check:** Define coefficient signs/scales and the
threshold U_min in a versioned rule set.

## EQ-079 · Deviation and no-trade zone

> **D_i,t = \|W_i,t\^Actual − W_i,t\^Target\|; Trade_i = 0 if D_i,t ≤
> θ_i,t**

**Source:** §10.4--10.5

**Description:** If deviation is within the no-trade band, no trade is
executed.

**Developer alignment check:** No-trade bands do not override emergency
or risk-trigger rules explicitly allowed by the blueprint.

## EQ-080 · Dynamic base threshold

> **θ_i,t = θ_base + f(Volatility_i, Liquidity_i, Spread_i,
> Slippage_i)**

**Source:** §10.5

**Description:** Widens the no-trade band when market or execution risk
rises.

**Developer alignment check:** The precise f must be defined in the
normative implementation; do not invent weights.

## EQ-081 · Expanded no-trade threshold form

> **θ_i,t = θ_base + κ₁σ̃\_i + κ₂(1 − Liquiditỹ\_i) + κ₃Spread̃\_i +
> κ₄Slippagẽ\_i**

**Source:** §10.5

**Description:** One explicitly displayed expanded form using normalized
volatility, liquidity, spread, and slippage.

**Developer alignment check:** Confirm units/scaling for every
normalized input and calibrate κ values under validation.

## EQ-082 · Partial rebalancing

> **Trade_i = β_i,t × (W_i,t\^Target − W_i,t\^Actual), 0 \< β_i,t ≤ 1**

**Source:** §10.6

**Description:** Corrects only a fraction of the full allocation gap to
reduce impact and avoid overtrading.

**Developer alignment check:** The source worked example uses β=0.40;
that is an example parameter, not a universal fixed β.

## EQ-083 · Adaptive partial-rebalance fraction

> **β_i,t = clip(β₀ + β₁U_i − β₂ ImpactHat_i, β_min, 1)**

**Source:** §10.6

**Description:** Adjusts trade fraction upward with urgency and downward
with estimated market impact, bounded by β_min and 1.

**Developer alignment check:** Publish β parameters and confirm the
clipping function's fixed-point implementation.

## EQ-084 · Residual trade after natural flows

> **TradeNeeded_i = TargetGap_i − CF_i,t**

**Source:** §10.7

**Description:** Subtracts the gap closed by mints, redemptions, and
other natural flows from the target gap.

**Developer alignment check:** Apply natural-flow netting before
constructing an external-market trade.

## EQ-085 · Trade sized from residual

> **Trade_i = f(TradeNeeded_i)**

**Source:** §10.7

**Description:** Maps the residual need to an execution quantity subject
to liquidity, turnover and trade-direction constraints.

**Developer alignment check:** Define exact f through MARP execution
rules; natural flow is not a substitute for final cost and safety gates.

## EQ-086 · Execution cost decomposition

> **Cost_i = Spread_i + Slippage_i + Fees_i + Impact_i +
> OperationalCost_i**

**Source:** §10.8

**Description:** Total expected cost comprises spread, slippage, fees,
market impact, and operational cost.

**Developer alignment check:** Ensure units all represent comparable
value/cost terms; include gas and router fees where the execution
implementation specifies them.

## EQ-087 · Net-benefit gate

> **NetBenefit_i = Benefit_i − Cost_i; execute only when NetBenefit_i \>
> ε**

**Source:** §10.8

**Description:** External execution is permitted only when expected
stability benefit exceeds estimated execution cost by a positive
threshold.

**Developer alignment check:** A trade outside the no-trade band can
still be rejected by this gate, except where the blueprint explicitly
defines a safety override.

## EQ-088 · Expanded net benefit

> **NetBenefit = RiskReduction + PPImprovement +
> DiversificationImprovement − ExecutionCost**

**Source:** §10.8

**Description:** Describes the principal benefits net of execution
friction.

**Developer alignment check:** Document how benefits are
measured/normalized; do not treat the function's labels as self-defining
numerical outputs.

## EQ-089 · Trade optimization objective

> **J(ΔW) = λ₁(W_obs − W_Target − ΔW)\^2 + λ₂(Spread·ΔW + FixedGas) +
> λ₃Urgency + λ₄\|ΔW\|**

**Source:** §10.9

**Description:** Balances remaining deviation, execution cost, urgency,
and turnover in a trade-sizing objective as printed in §10.9.

**Developer alignment check:** The printed formula does not visibly
state the minimize/maximize operator and the sign treatment of the
urgency term is not fully explicit. Confirm the intended optimization
direction before implementation; do not infer it silently.

## EQ-090 · Dynamic execution frequency

> **Frequency_t = f(Drift, Risk, Liquidity, Cost, StructuralChange)**

**Source:** §10.10

**Description:** Actual trading cadence is responsive to state and cost,
while deeper methodology review is quarterly by default.

**Developer alignment check:** Keep the periodic strategic-review
schedule separate from MARP's event-driven trade frequency.

# 11--12. Execution mechanics, quoting and slippage

## EQ-091 · Observed component weight

> **W_i,t\^obs = V_i,t / V_net,t; W_Gold,t\^obs = V_Gold,t / V_net,t**

**Source:** §11.1

**Description:** Computes observed weights from component/reserve
values.

**Developer alignment check:** The denominator and numerator must use a
consistent valuation basis and haircut convention.

## EQ-092 · Execution cost: gas plus slippage

> **ExecutionCost = GasPrice × GasUnits + Slippage(\|ΔW\|)**

**Source:** §11.4; §12.4

**Description:** Models fixed/estimated transaction gas together with
trade-size-dependent slippage.

**Developer alignment check:** Scale to one currency (normally USD
equivalent) before comparing with expected benefit.

## EQ-093 · Maximum trade size

> **TradeSize_max = min(\|Δ_t\| × V_net,t, 0.10 × PoolDepth_24h)**

**Source:** §11.4; §12.4

**Description:** Caps the trade at the portfolio gap value or 10% of
24-hour pool depth, whichever is smaller.

**Developer alignment check:** Respect the stricter of this cap, the
daily turnover cap and any route-specific liquidity cap.

## EQ-094 · Sell slippage bound

> **ExecRate ≥ OracleRate × (1 − τ_sell)**

**Source:** §11.5.1; §12.3

**Description:** Selling gold must not execute below the oracle
reference beyond the sell-side tolerance.

**Developer alignment check:** Use sell-side tolerance only; reject
stale quotes and quote expiry violations.

## EQ-095 · Buy slippage bound

> **ExecRate ≤ OracleRate × (1 + τ_buy)**

**Source:** §11.5.1; §12.3

**Description:** Buying gold must not execute above the oracle reference
beyond the buy-side tolerance.

**Developer alignment check:** Use buy-side tolerance only; test both
sides independently.

## EQ-096 · Full execution-cost function

> **ExecutionCost(q) = Spread(q) + Slippage(q) + Impact(q) + Fees(q)**

**Source:** §12.1

**Description:** Models the cost dependence on a trade quantity q.

**Developer alignment check:** The detailed implementations may also
include gas and operational costs; reconcile the broad function with
§10.8 and contract code.

## EQ-097 · Execution constraints

> **ExecutionTime ≤ T_max; MarketImpact ≤ I_max**

**Source:** §12.1

**Description:** Imposes upper bounds on execution duration and market
impact.

**Developer alignment check:** Define T_max and I_max in the governed
parameter registry and fail closed when the quote/execution path cannot
satisfy them.

## EQ-098 · Minimum profitability gate

> **NetBenefit = ReductionInDeviation − EstimatedExecutionCost \> 0**

**Source:** §12.5

**Description:** Simplified positive-profitability guard in the
execution-optimization chapter.

**Developer alignment check:** Section 10.8's more explicit form uses
NetBenefit_i \> ε with ε \> 0. Decide which threshold is normative and
align implementations.

## EQ-099 · Minimum profitability threshold

> **NetBenefit_i = ReductionInDeviation_i − EstimatedCost_i \> ε; ε \>
> 0**

**Source:** §12.5

**Description:** Requires positive surplus above a minimum tolerance
rather than merely break-even.

**Developer alignment check:** Do not let one contract use \>0 while
another uses \>ε without documenting the policy difference.

## EQ-100 · Cost estimate

> **EstimatedCost = (gasPrice × gasUnits) + slippage + routerFee**

**Source:** §12.7

**Description:** The execution contract's cost estimate includes gas,
slippage and router fee.

**Developer alignment check:** Check consistent units, fresh gas data,
quote amount, and fail-safe behavior if the estimate is unavailable.

# 13--16. Reserve coverage, asset concentrations and dynamic buffer

## EQ-101 · Reserve sizing function

> **Reserve_t = f(OutstandingMTQ_t, RedemptionRisk_t, Liquidity_t,
> CollateralRequirements_t, GoldRequirements_t)**

**Source:** §13.1

**Description:** Reserve composition is designed to meet obligations,
liquidity, collateral and gold-linked requirements.

**Developer alignment check:** Reserve positions are not mechanically
copied from the index weights.

## EQ-102 · Coverage ratio

> **CoverageRatio_t = EligibleReserveNAV_t /
> OutstandingMTQObligations_t; CoverageRatio_t ≥ 1 (100%)**

**Source:** §13.2

**Description:** Requires eligible reserve NAV to cover outstanding
claims at least one-for-one.

**Developer alignment check:** Use net eligible NAV and
scenario-appropriate liability valuation; if below one, report and
activate the specified governed recovery path.

## EQ-103 · Eligible reserve NAV

> **EligibleReserveNAV_t = V_net,t = Σ_j Q_j,t × P_j,t × (1 − H_j)**

**Source:** §13.2.1; §14.1

**Description:** Defines the coverage numerator using eligible assets
with haircuts.

**Developer alignment check:** Admission status, price validity,
custody/issuer restrictions and haircut schedules must feed eligibility.

## EQ-104 · Gold index/reserve separation

> **W_Gold\^Index ≠ W_Gold\^Reserve (in general)**

**Source:** §13.3

**Description:** The reference gold share expresses purchasing-power
reference; reserve gold is sized for
backing/liquidity/custody/redemption needs.

**Developer alignment check:** Never infer reserve gold quantity as 26%
of holdings from the index prior.

## EQ-105 · Liquidity coverage

> **LiquidityCoverage_t = ImmediatelyLiquidEligibleAssets_t /
> NearTermObligations_t ≥ LCR_min**

**Source:** §13.4

**Description:** The generic LCR formulation uses eligible immediately
liquid assets over near-term obligations.

**Developer alignment check:** Tie this general formula to the contract
getter's specific stress-redemption denominator and the approved liquid
class.

## EQ-106 · Stablecoin/liquid asset value

> **LiquidAssets_t = Σ\_{j∈Stablecoins} Q_j,t × P_j,t × (1 − H_j)**

**Source:** §13.4

**Description:** Defines the liquidity numerator as net stablecoin value
in the current implementation.

**Developer alignment check:** Tokenized gold is described as 0% liquid
for LCR purposes; do not include it in this numerator unless governance
changes the liquidity classification.

## EQ-107 · Stress redemption demand

> **StressRedemptionDemand_t = S_circ,t × P_MTQ,t × 0.25**

**Source:** §13.4

**Description:** Assumes stress demand equal to 25% of circulating
liability value in the deployed reference implementation.

**Developer alignment check:** Treat 25% as the stated parameterization,
not a universal economic truth; validate it and keep code/docs aligned.

## EQ-108 · Strategic gold reserve-sizing function

> **R_G = f(MTQ obligations, GoldLinked obligations, Liquidity, Stress,
> Custody, Redemption)**

**Source:** §13.5

**Description:** Reserve gold allocation responds to obligations,
liquidity, stress, custody and redemption demand---not a fixed
percentage.

**Developer alignment check:** Do not use the old v1.2 26%/26.25% as a
fixed reserve target in v2.0.

## EQ-109 · Core and buffer reserve value

> **V_net,t = V_core,t + V_buffer,t; V_core,t = S_circ,t × P_MTQ,t;
> V_buffer,t = 0.10 × S_circ,t × P_MTQ,t**

**Source:** §13.5.2 \[legacy core-plus-buffer structure\]

**Description:** Describes a 100% core liability layer plus a 10% buffer
in the historical core-plus-buffer configuration.

**Developer alignment check:** Blueprint marks this as historical v1.2
input. Confirm how it coexists with the v2.0 live NAV measurement; don't
treat a target decomposition as actual reserves held.

## EQ-110 · Buffer gold/fiat split

> **V_buffer,gold,t = V_buffer,t × B_gold(RR_t); V_buffer,fiat,t =
> V_buffer,t × (1 − B_gold(RR_t))**

**Source:** §13.5.2; §16.3

**Description:** Allocates the buffer between gold and fiat/liquid
assets using a state-dependent gold ratio.

**Developer alignment check:** Use the current buffer state and target
split; keep the core reserve separate from the managed buffer
accounting.

## EQ-111 · Historical total gold weight formula

> **W_gold,total = 0.20 + 0.10 × B_gold(RR_t)**

**Source:** §13.5.2 \[legacy formula retained as reference\]

**Description:** The 20% core gold plus 10% buffer allocation formula
from the prior structure.

**Developer alignment check:** Historical initialization only; the
master spec states the v2.0 core gold share is adaptive. Do not mislabel
this formula as the current reference-index gold weight.

## EQ-112 · Prudential reserve NAV

> **V_net,t = Σ\_{j=1}\^n Q_j,t × P_j,t × (1 − H_j)**

**Source:** §14.1

**Description:** The canonical haircut-adjusted reserve asset value.

**Developer alignment check:** Must be identical in the reserve manager,
RR getter, daily state vector, stress reports and published audit
records.

## EQ-113 · Conservative gold NAV price

> **P_gold,t = min(P_gold,reference, P_gold,executable)**

**Source:** §14.1

**Description:** Uses the more conservative of reference gold spot and
executable tokenized-gold price for reserve NAV.

**Developer alignment check:** Do not confuse this reserve valuation
min-rule with the independent canonical gold-reference index price.

## EQ-114 · Solvency ratio and liability

> **RR_t = V_net,t / L_t; L_t = S_circ,t × P_MTQ,t**

**Source:** §14.2

**Description:** Defines the solvency metric and its liability
denominator.

**Developer alignment check:** Use the adaptive current index price and
haircut-adjusted reserve value. Check all getters against these
identities.

## EQ-115 · Issuer concentration hard cap

> **IssuerShare_i = ValueOfAssetsIssuedByIssuer_i / TotalReserveValue ≤
> 30%**

**Source:** §15.6.1

**Description:** Limits reserve exposure to one issuer; 25% is a soft
checkpoint and 30% a hard block under the stated baseline.

**Developer alignment check:** Any temporary increase to 35% is a
governed emergency exception with the stated approval/timelock/public
disclosure.

## EQ-116 · Reserve asset concentration

> **C_j = ReserveValue_j / TotalReserveValue; C_j ≤ C_max**

**Source:** §15.6.2

**Description:** Caps concentration in each reserve instrument.

**Developer alignment check:** Publish C_max by asset/class and ensure
the same base valuation is used in numerator and denominator.

## EQ-117 · Currency exposure cap

> **w_i ≤ w_i,max**

**Source:** §15.6.3

**Description:** Bounds a currency exposure rather than mandating a
fixed live weight.

**Developer alignment check:** Map the cap to the appropriate
index/reserve exposure rule; do not treat the cap as a target
allocation.

## EQ-118 · Buffer gold-ratio transition

> **B_gold,t = 0.625 + (0.85 − 0.625) × t/24**

**Source:** §16.3

**Description:** Linear interpolation from 62.5% to 85% gold in the
buffer across a 24-hour BASE-to-STRESS ramp.

**Developer alignment check:** Define t in hours and clamp the result to
the intended end values; apply the correct direction for the reverse
transition.

## EQ-119 · Total target gold weight in historical core+buffer model

> **W_target,gold,total,t = 0.20 + 0.10 × B_gold(RR_t)**

**Source:** §16.3

**Description:** Combines a 20% core-gold input with the gold fraction
of a 10% buffer.

**Developer alignment check:** Historical v1.2-derived formula; do not
substitute for the independent adaptive reference-index gold objective
of §3.3.

## EQ-120 · Total target fiat weight in historical core+buffer model

> **W_target,fiat,total,t = 0.80 + 0.10 × (1 − B_gold(RR_t))**

**Source:** §16.3

**Description:** Complements the gold allocation in the prior
core-plus-buffer model.

**Developer alignment check:** Validate that fiat plus gold targets sum
to one, and keep this reserve formula separate from index-weight
calculations.

## EQ-121 · Asset eligibility function

> **E_j = f(UnderlyingGoldCoverage, Custody, Redemption, IssuerRisk,
> Liquidity, Auditability, LegalRights); E_j ≥ E_min**

**Source:** §15.2; §14.3

**Description:** Requires an instrument to meet a published composite
eligibility floor.

**Developer alignment check:** The exact f and E_min must be specified
by the asset-admission methodology and versioned; do not infer them from
this symbolic formula.

# 17. Oracle architecture and canonical gold price

## EQ-122 · Three-source consensus rule

> **3 valid feeds → median; 2 valid feeds → average + sanity check;
> fewer than 2 → pause minting and rebalancing**

**Source:** §17.2

**Description:** Defines current provider combination behavior for
Chainlink, Pyth and Chronicle sources.

**Developer alignment check:** A later section says an outlier-filtered
mean is returned with the median as the rejection anchor. Reconcile
branch-by-branch behavior and which function is authoritative.

## EQ-123 · Oracle independent-source quorum

> **N_valid ≥ 2; \|source families\| ≥ 2**

**Source:** §17.2--17.3

**Description:** Requires at least two valid feeds from at least two
independent source families.

**Developer alignment check:** Three feeds from a single underlying
source family do not satisfy independence.

## EQ-124 · Freshness check

> **t_now − τ_i ≤ θ_stale(feed)**

**Source:** §17.3.1

**Description:** A feed is fresh only if its publication/update
timestamp is within the feed-class staleness threshold.

**Developer alignment check:** Use the provider's source timestamp, not
the time of an on-chain read.

## EQ-125 · Pyth confidence-width check

> **confidence_i / P_i ≤ maxConfidenceWidth_i**

**Source:** §17.3.2

**Description:** Rejects a Pyth price if its uncertainty interval is too
wide as a fraction of the price.

**Developer alignment check:** Initial caps described in the blueprint:
major FX 0.5%; minor FX 1.0%; gold 1.0%; VIX/DXY 2.0%.

## EQ-126 · Deviation circuit breaker

> **\|P_i − P̃\| ≤ 0.025 × P̃**

**Source:** §17.3.3

**Description:** Discards any feed that deviates more than 2.5% from the
median anchor.

**Developer alignment check:** Run after feed-level validation; verify
arithmetic on the example 1.00, 1.02, 1.25 and test both borderline and
over-threshold cases.

## EQ-127 · Canonical gold raw aggregate

> **P_G\^raw = Median(P_1, ..., P_n)**

**Source:** §17.4

**Description:** Produces a robust base aggregate from independent gold
sources; a reliability-weighted median is an approved alternative under
a methodology version.

**Developer alignment check:** Gold sources must span the required
independent source classes; no single MTQ-native AMM defines canonical
gold.

## EQ-128 · Canonical gold filter

> **P_G\^canonical = Filter(P_G\^raw, Staleness, Liquidity, Outlier)**

**Source:** §17.4

**Description:** Applies freshness, liquidity-quality, deviation, and
confidence rules before publishing the canonical price.

**Developer alignment check:** Do not consume the unfiltered raw median
as a canonical price.

## EQ-129 · Feed validity predicate

> **valid_i = (P_i \> 0) ∧ (t_now − τ_i ≤ θ_stale,i) ∧ (P_min,i ≤ P_i ≤
> P_max,i)**

**Source:** §17.5

**Description:** A feed must have a positive price, be fresh, and sit
within a broad sanity interval.

**Developer alignment check:** Pyth adds its confidence-width test; all
gates are conjunctive.

## EQ-130 · Median validity anchor and filtered mean

> **P̃ = Median({P_i : valid_i}); P_agg = (1/\|S\|) Σ\_{i∈S} P_i**

**Source:** §17.5

**Description:** The median is the outlier-deviation anchor; the source
describes the reported aggregate as the mean of feeds surviving
validation and deviation filtering.

**Developer alignment check:** This differs from the simple "median if
all three / average if two" summary. Implement and test the exact
normative rule rather than assuming the summaries are identical in all
conditions.

## EQ-131 · Gold oracle confidence

> **Confidence_G = A\^βA × F\^βF × L\^βL × D\^βD × C\^βC; Σ_k β_k = 1**

**Source:** §17.6

**Description:** Bounded geometric aggregate of source agreement,
freshness, liquidity, deviation stability and source coverage.

**Developer alignment check:** The exponents/factor transforms are
validation-stage parameters. A collapsed input should lower the
confidence sharply as the blueprint intends.

## EQ-132 · Confidence degradation threshold

> **Confidence_G \< C_min ⇒ OracleDegraded**

**Source:** §17.6--17.7

**Description:** Moves the oracle into degraded mode below the minimum
gold-confidence threshold; the listed default C_min is 0.60.

**Developer alignment check:** Confirm behavior when confidence returns
above threshold, and ensure degraded mode cannot silently continue as
healthy.

## EQ-133 · Per-source state set

> **s_i ∈ {VALID, DEGRADED, STALE, OUTLIER, HALTED}**

**Source:** §17.7

**Description:** Classifies the state of each source independently.

**Developer alignment check:** Define inclusion/exclusion treatment for
each state; do not treat DEGRADED as identical to VALID.

## EQ-134 · Cross-source correlation warning (implementation rule)

> **RelativeDeviation = \|P_i − P̃\| / P̃; repeated source-correlation
> warnings can pause rebalancing**

**Source:** §17.8--17.9

**Description:** The implementation detects correlation/repeated
warnings as a separate safeguard against nominally different feeds
depending on one underlying source.

**Developer alignment check:** The source describes a warning counter
and pause after three warnings; verify exact threshold scaling and
source-family mapping in code.

# 18. Monetary unit, daily state vector and monitoring

## EQ-135 · Reference price of one MTQ Σ

> **P_MTQ,t = I_t / I_base**

**Source:** §18.1

**Description:** Converts the chain-linked index value into the
USD-equivalent reference price, normalized against the genesis
denominator.

**Developer alignment check:** Confirm I_base refers to the source's
canonical genesis denominator/base value and is not confused with a
value that is already normalized to one.

## EQ-136 · Liability and solvency identity

> **L_t = S_circ,t × P_MTQ,t; RR_t = V_net,t / L_t**

**Source:** §18.2

**Description:** Connects circulating supply and current reference value
to the reserve coverage ratio.

**Developer alignment check:** The same identity must be shared by
mint/redemption, reserve management, risk states, and reporting.

## EQ-137 · Daily state vector

> **X_t = \[W_t, Risk_t, CVaR_t, MDD_t, PPError_t, Liquidity_t,
> Coverage_t, OracleConfidence_t, CrisisScore_t, Turnover_t, Cost_t\]**

**Source:** §18.3

**Description:** One published daily snapshot captures all primary
inputs/outputs used for decisions.

**Developer alignment check:** Publish the same field definitions and
units consistently; never omit oracle confidence, coverage, or costs.

## EQ-138 · Action function

> **Action_t = f(X_t) ≠ f(Calendar)**

**Source:** §18.3

**Description:** Protocol actions are determined by measured state
rather than calendar changes alone.

**Developer alignment check:** A calendar tick can trigger
calculation/publication but not an economically unjustified trade.

# 19. Minting, redemption and slippage guards

## EQ-139 · Net mint deposit

> **X_net = X × (1 − F_mint)**

**Source:** §19.2

**Description:** Deducts the mint fee from the deposit value before
calculating token quantity.

**Developer alignment check:** The documented normal mint fee is 0.10%;
apply the fee once, in the intended denomination.

## EQ-140 · Minted token quantity

> **MTQ_minted = X_net / P_MTQ,t**

**Source:** §19.2

**Description:** Prices minting against the current adaptive index
reference price; a higher price means fewer MTQ units for the same net
deposit.

**Developer alignment check:** Never mint at a fixed 1:1 USD peg. Apply
approved price freshness/guard and rounding rules.

## EQ-141 · Index reference price

> **P_MTQ,t = I_t / I_base**

**Source:** §19.2

**Description:** Uses the current index/base denominator relationship
for monetary-unit pricing.

**Developer alignment check:** Align this duplicate form with §18.1 and
the core contract's fixed-point scaling.

## EQ-142 · Redemption per-token NAV

> **NAV_t = V_net,t / S_circ,t**

**Source:** §19.3

**Description:** Defines the reserve net value per circulating token for
redemption pricing in §19.3.

**Developer alignment check:** The source also uses NAV_t in other
contexts with different meanings; define unique identifiers/symbols for
total reserve NAV and per-token NAV in implementation/API.

## EQ-143 · Gross redemption value

> **RedeemValue_USD = Y × NAV_t**

**Source:** §19.3

**Description:** Computes the value of redeeming Y tokens at the
specified redemption NAV per token.

**Developer alignment check:** Use haircut-adjusted reserves and the
exact chosen redemption-value convention.

## EQ-144 · Net redemption after fee

> **RedeemValue_net = RedeemValue_USD × (1 − F_redeem)**

**Source:** §19.3

**Description:** Deducts the applicable redemption fee.

**Developer alignment check:** The current fee is risk-state dependent:
Normal 0.15%, Stress 0.50%, Defensive 1.00% in the contract constants.
Ensure the state-dependent fee is chosen exactly once.

## EQ-145 · Pro-rata asset release

> **Release_i = RedeemValue_net × (V_i / V_net)**

**Source:** §19.3

**Description:** Distributes the net redemption value proportionally
across reserve holdings under the full-basket redemption doctrine.

**Developer alignment check:** Confirm the distribution basis and
rounding/dust handling; redemption is not automatically a one-asset
payout unless that router mode is explicitly selected.

## EQ-146 · Mint slippage minimum

> **minMTQOut_default = (X_net / P_MTQ,t) × (1 − τ_user)**

**Source:** §19.4.1

**Description:** Minimum token output given user-defined tolerance
τ_user.

**Developer alignment check:** Revert if output falls below user
minimum; test index move/quote expiry/rounding.

## EQ-147 · Execution-price redemption guard

> **revert if ExecPrice \< OraclePrice × (1 − τ_user)**

**Source:** §19.4.2

**Description:** Rejects execution when effective redemption price is
below the oracle reference beyond the user tolerance, as rendered in the
source formula.

**Developer alignment check:** Confirm this guard's direction against
the actual sell/buy path and payout denomination. Do not generalize the
gold swap guard indiscriminately to every redemption route.

# 20. Genesis, accounting and treasury

## EQ-148 · Genesis reserve ratio worked calculation

> **RR_genesis = 1,100,000 / (1,000,000 × 1.0000) = 1.10 = 110%**

**Source:** §20.1

**Description:** Example genesis has \$1.1M reserve value against one
million MTQ at a \$1.00 reference price.

**Developer alignment check:** Reproduce from actual genesis
deposit/supply and base-denominator calculation; the example is not a
guarantee about later solvency.

## EQ-149 · Genesis index base denominator

> **I_base = q_USD·1.00 + q_EUR·FX_EUR/USD,base +
> q_JPY·FX_JPY/USD,base + q_GBP·FX_GBP/USD,base +
> q_CNY·FX_CNY/USD,base + q_CHF·FX_CHF/USD,base + q_XAU·P_Gold,base**

**Source:** §20.1.5

**Description:** Computes the initial weighted USD-equivalent
denominator from all seven genesis components, including CHF and gold.

**Developer alignment check:** Use the immutable base fixings and
consistent units/scales. The legacy fixed-quantity GFB formula elsewhere
is not a substitute for this seven-component genesis formula.

## EQ-150 · Treasury sweep threshold

> **Sweep only the balance above 10,000 USD (SWEEP_THRESHOLD)**

**Source:** §20.3.1

**Description:** Keeps an operational balance threshold while sweeping
surplus to cold treasury under the defined security controls.

**Developer alignment check:** Test threshold equality, token decimals,
and destination controls; never sweep restricted reserve collateral as
an operational balance.

## EQ-151 · Fee accrual schedule (normal defaults)

> **Mint = 0.10%; Redeem = 0.15%; Rebalance = 0.20%**

**Source:** §20.4

**Description:** Lists the default fee rates and operational-wallet
destination; risk-state overrides apply to redemption fees.

**Developer alignment check:** Fees are excluded from reserve NAV and
deducted before execution as stated by the blueprint.

# 21--22. Risk state machine and governance

## EQ-152 · Risk-state function

> **State_t = F(RR_t, LCR_t) ∈ {S1, ..., S6}**

**Source:** §21.2--21.3

**Description:** Maps solvency and liquidity conditions into the six
defined risk states.

**Developer alignment check:** Preserve the source's complete state
mapping, threshold priority and state-specific actions; RR and LCR both
matter.

## EQ-153 · Escalation path

> **NORMAL → CAUTION → STRESS → DEFENSIVE → EMERGENCY (immediate on
> breach)**

**Source:** §21.3

**Description:** Deterioration escalates immediately when the specified
threshold is breached.

**Developer alignment check:** Implement each state's exact RR/LCR
boundaries, not just a textual order.

## EQ-154 · Recovery path and confirmation

> **EMERGENCY → DEFENSIVE → STRESS → CAUTION → NORMAL; t_confirm ≥ 48 h
> sustained without breach per recovery step**

**Source:** §21.3

**Description:** Recovery is staged and requires a sustained
confirmation period before relaxing controls.

**Developer alignment check:** Do not instantly jump from EMERGENCY to
NORMAL. Verify whether transitions require 48 hours individually and
whether other state-specific durations also apply.

## EQ-155 · Reintegration score

> **R_score = w₁·TimeInBand + w₂·LiquidityDepth + w₃·OracleAgreement +
> w₄·(1 − Volatility)**

**Source:** §21.5.4

**Description:** Scores an asset's eligibility for reintegration after
de-peg ejection.

**Developer alignment check:** The listed weights are 0.40, 0.25, 0.20
and 0.15, summing to 1. Confirm each feature is normalized to the same
scale.

## EQ-156 · Reintegration threshold

> **R_score ≥ 0.80**

**Source:** §21.5.4

**Description:** The score threshold for considering an ejected
currency/asset for reintegration.

**Developer alignment check:** This is not sufficient by itself if
issuer freeze, sanctions, liquidity or other special-case blockers
remain active.

## EQ-157 · Staged de-peg liquidation

> **Stage 1: 10%; Stage 2: additional 15%; Stage 3: additional 25%;
> Stage 4: remaining value**

**Source:** §21.5.3; Listing 14

**Description:** Liquidation is staged rather than one instantaneous
100% sale.

**Developer alignment check:** Confirm whether each percentage is
computed against the original position or the remaining position. The
prose summary uses cumulative 10%→25%→50%→100%; the implementation
labels 15% and 25% as additional amounts.

## EQ-158 · Governance boundary

> **Governance → {rules}; Governance ↛ individual live weights**

**Source:** §22.3--22.4

**Description:** Governance approves methods, constraints and parameter
bounds, not discretionary individual weight outcomes.

**Developer alignment check:** No admin/DAO/council path should directly
set W_USD,t or W_Gold,t outside the published MASE pipeline.

# 23--26. Validation, reproducibility and final live-weight pipeline

## EQ-159 · Walk-forward protocol

> **Train_t → Optimize → OutOfSample_t+1; then roll forward**

**Source:** §23.3

**Description:** Training/optimization must precede the next
out-of-sample evaluation window.

**Developer alignment check:** Run the process sequentially; do not
shuffle time-series data or allow future information into current
inputs.

## EQ-160 · Purged training set

> **D_train(purged) = {τ : \[τ, τ + h_label) ∩ \[t, t + h_test) = ∅}**

**Source:** §23.4

**Description:** Excludes training labels whose information interval
overlaps the test interval.

**Developer alignment check:** Implement label horizon and test horizon
exactly; verify zero leakage and the embargo/purging rule in tests.

## EQ-161 · Parameter perturbation sensitivity

> **ΔPerformance(θ, δ) = \|Perf(θ + δ) − Perf(θ − δ)\|**

**Source:** §23.6

**Description:** Measures performance sensitivity to parameter
perturbations around a selected value.

**Developer alignment check:** Each parameter needs a Risk-Council bound
B_θ; pass requires ΔPerformance ≤ B_θ as specified.

## EQ-162 · Model-selection stability score

> **Score = a(−Volatility) + b(−CVaR) + c(−MDD) + d(−PPError) +
> e(−Turnover) + f(−Cost) + g(Diversification) + h(Robustness)**

**Source:** §23.7

**Description:** Ranks models on stability, tail protection,
purchasing-power tracking, low turnover/cost, diversification and
robustness---not highest return.

**Developer alignment check:** The sign/orientation must be preserved;
coefficients and metric scaling are governance/research parameters and
must be published.

## EQ-163 · Scenario reserve coverage

> **CoverageRatio_s = ReserveNAV_s / Obligations_s; CoverageRatio_s ≥ 1
> for every defined acceptable stress case**

**Source:** §23.11

**Description:** Measures the reserve against scenario-marked
obligations after shocks, haircuts, de-pegs, liquidity discounts and
recovery values.

**Developer alignment check:** Report coverage for every scenario; if
below one, document the explicit governed recovery mechanism. Do not
alter the reference basket to conceal reserve failure.

## EQ-164 · Deterministic reproducibility

> **(Data_t, Parameters_t, Versions_t) identical ⇒ W_t\^Live identical**

**Source:** §24.1

**Description:** Identical data, parameters, methodology/model/oracle
versions must reproduce identical live weights.

**Developer alignment check:** Publish content hashes/versions and
provide independent recomputation tests.

## EQ-165 · Complete live-weight pipeline

> **W_t\^Live =
> Execute\[Smooth\[Constrain\[Ensemble\[Constituency(Data_t)\]\]\]\]**

**Source:** §24.5; §26.3

**Description:** Canonical end-to-end computation: data determines
eligibility; model ensemble proposes weights; constraints project;
smoothing paces; execution gates decide what actually trades.

**Developer alignment check:** Verify order of operations and the
meaning of W_live in relation to the registry's smoothed state versus
MARP's executed state.

## EQ-166 · Target-weight function

> **W_t\^Target = MASE(Data_t, W\^Prior, Risk_t, CVaR_t, PP_t,
> Liquidity_t, Regime_t, Cost_t)**

**Source:** §24.5

**Description:** Describes the inputs that feed the current MASE target
calculation.

**Developer alignment check:** Every input must have data provenance,
units, timestamp, fallback behavior and versioning.

## EQ-167 · Constraint projection

> **W_t\^Constrained = Projection_Ct(W_t\^Target)**

**Source:** §24.5

**Description:** Projects MASE's unconstrained target into the
admissible set C_t.

**Developer alignment check:** The projection must enforce all Chapter 8
bounds and return a reproducible feasible vector.

## EQ-168 · Final smoothing step

> **W_t\^Smooth = ρ_t W_t−1 + (1 − ρ_t)W_t\^Constrained**

**Source:** §24.5

**Description:** Produces a risk-paced weight state from prior live
weights and the projected target.

**Developer alignment check:** Use the same smoothing state and stress
flag as the on-chain registry, with fixed-point rounding tests.

## EQ-169 · MARP execution decision

> **W_t\^Execution = MARP(W_t\^Smooth, W_t\^Actual, Cost_t, Liquidity_t,
> Reserve_t)**

**Source:** §24.5

**Description:** Determines the actual correction after observed drift,
cost, liquidity and reserve checks.

**Developer alignment check:** Execution output may be no trade or
partial trade; it is not identical by definition to the smoothed index
weights.

## EQ-170 · Adaptive weight vector

> **W_t = \[w_USD,t, w_EUR,t, w_JPY,t, w_GBP,t, w_CNY,t, w_CHF,t,
> w_Gold,t\], with Σ_i w_i,t = 1**

**Source:** §26.4

**Description:** Represents the seven initial components at time t, with
normalized total weight.

**Developer alignment check:** Generalize the vector to the current
eligible universe after constituency changes; the initial seven
components are not necessarily permanent.

## EQ-171 · No-trade worked example

> **D = \|28.2% − 28.5%\| = 0.3%; 0.3% \< θ_USD=1.0% ⇒ Trade=0**

**Source:** Appendix C §C.1

**Description:** Illustrates a deviation inside the no-trade band and
therefore no trade.

**Developer alignment check:** This example must pass exactly and be
recorded in the decision log.

## EQ-172 · Partial gold correction worked example

> **D = \|27.0% − 29.4%\| = 2.4%; 2.4% \> θ_Gold=2.0% ⇒ trigger; Trade =
> 0.40 × (27.0% − 29.4%) = −0.96%**

**Source:** Appendix C §C.2

**Description:** Illustrates a 40% partial correction of a 2.4
percentage-point overshoot in gold.

**Developer alignment check:** The signed −0.96% trade means reducing
gold weight. After execution, the example states actual gold weight
28.44% and residual deviation 1.44%.

## EQ-173 · Natural-flow worked example

> **TradeNeeded = 1.5% − 0.9% = 0.6%**

**Source:** Appendix C §C.3

**Description:** Natural inflows/outflows close 0.9 percentage points of
a 1.5-point gap, leaving 0.6 points for external trading.

**Developer alignment check:** Apply flow netting before external
quote/cost checks.

## EQ-174 · Rejected cost-gate example

> **B − C = 0.12% − 0.17% = −0.05% \< 0 ⇒ Trade = 0**

**Source:** Appendix C §C.4

**Description:** Execution is rejected because expected costs exceed the
benefit even though deviation may qualify for a trade.

**Developer alignment check:** A no-trade-zone breach is not sufficient
to execute; cost-benefit must also pass unless an explicit safety
override applies.

## EQ-175 · Adaptive gold target example

> **W_Gold\^Target = 29.2% ≠ W_Gold\^Prior = 26%**

**Source:** Appendix C §C.5

**Description:** Demonstrates that target gold allocation can differ
from the 26% strategic prior.

**Developer alignment check:** Treat 29.2% as an illustrative case, not
an approved optimal/live allocation.

# Numerical parameters and defaults requiring exact alignment

These values are as stated in the blueprint. They are not all of the
same governance status: some are immutable invariants, some are mutable
governed parameters, and some are validation-stage research defaults.
Developers must retain that distinction in code, configuration, UI and
tests.

  ---------------------------------------------------------------------------------
  **Parameter**      **Source value**   **Section**       **Interpretation /
                                                          implementation note**
  ------------------ ------------------ ----------------- -------------------------
  **Strategic        USD 27%; EUR 20%;  §3.2              Soft anchor / genesis
  prior**            JPY 9%; GBP 8%;                      snapshot; not live
                     CNY 5%; CHF 5%;                      weights.
                     Gold 26%                             

  **Genesis base FX  EUR/USD 1.0500;    §2.7, §3.4        Immutable normalization
  fixing**           GBP/USD 1.2500;                      fixings. Confirm decimal
                     JPY/USD 0.0067;                      scaling in each
                     CNY/USD 0.1400;                      deployment.
                     CHF/USD 1.1300                       

  **Genesis gold     USD 2,500 per      §2.7, §3.4        Base price concept; not a
  fixing**           reference gold                       promise or peg.
                     unit                                 

  **Constitutional   USD 23--32%; EUR   §8.1              Validation-stage
  weight bounds**    17--24%; JPY                         admissibility envelopes,
                     7--12%; GBP                          not composition targets.
                     6--11%; CNY 3--7%;                   
                     CHF 3--7%; Gold                      
                     20--32%                              

  **MAX_VELOCITY per USD 0.50%; EUR     §8.3; Listings    Risk-Council controlled
  accepted update**  0.50%; JPY 0.30%;  1--2              per-update bounds.
                     GBP 0.30%; CNY                       
                     0.20%; CHF 0.20%;                    
                     Gold 0.50%                           

  **Smoothing rho**  Normal 0.50;       §8.4; §7.7        1e18 fixed-point scale in
                     Stress 0.75                          contracts; crisis
                                                          threshold listed at 0.70.

  **Reserve ratio    Target 1.10        §2.9, §14.2, §21  Hard floor
  tiers**            (110%); stress                       constitutional. Do not
                     floor 1.05 (105%);                   confuse desired operating
                     hard floor 1.00                      point with
                     (100%)                               legal/constitutional
                                                          minimum.

  **LCR              1.00 (100%)        §2.9, §13.4       Source notes operational
  target/floor**     initial                              target may be set above
                     target/floor                         the floor after stress
                                                          testing.

  **Normal           Mint 0.10%; redeem §2.9, §20.4       Rebate/fee destination
  operational fees** 0.15%; rebalance                     and reserve exclusion
                     0.20%                                must follow the
                                                          blueprint; redemption
                                                          fees are state-dependent.

  **Stress /         Stress 0.50%;      §2.7, §21         Risk-state dependent
  defensive          Defensive 1.00%                      contract defaults.
  redemption fee**                                        

  **Recovery         48 hours           §2.9, §21         Some buffer transitions
  confirmations**                                         separately specify
                                                          24-hour
                                                          ramps/confirmation;
                                                          preserve the exact
                                                          state-transition rule.

  **Issuer           25% soft           §15.6.1           Temporary exception is
  concentration      checkpoint; 30%                      bounded and governed.
  baseline**         hard cap;                            
                     temporary crisis                     
                     ceiling 35% with                     
                     4/7, 24h timelock                    
                     and disclosure                       

  **Oracle source    At least 2 valid   §17.2--17.3       Constitutional
  quorum**           feeds from at                        requirement.
                     least 2 source                       
                     families                             

  **Oracle           Major FX 60 sec;   §17.3.1           Feed class thresholds;
  staleness**        minor FX 120 sec;                    stale feeds are
                     Gold 60 sec;                         discarded.
                     VIX/DXY 120 sec                      

  **Oracle           Major FX 0.5%;     §17.3.2           Pyth-specific initial
  confidence width   minor FX 1.0%;                       caps.
  caps**             gold 1.0%; VIX/DXY                   
                     2.0%                                 

  **Oracle deviation 2.5% from median   §17.3.3           Risk-Council parameter in
  breaker**          anchor                               source.

  **Gold oracle      C_min = 0.60;      §17.6; Listing 9  Validation-stage
  confidence         liquidity input                      defaults, not production
  minimum**          default 0.90                         evidence.

  **Stress           25% of circulating §13.4; Listing 1  NTO = S_circ × P_MTQ ×
  redemption         liability value                      0.25.
  demand**                                                

  **Dynamic buffer** 10% of liability   §16.2--16.4       Legacy/core-plus-buffer
                     as historical                        initialization values;
                     buffer size; gold                    v2.0 core-gold allocation
                     ratio BASE 62.5%,                    described as adaptive.
                     STRESS 85%,                          
                     EMERGENCY 100%                       

  **Maximum pool     10% of 24-hour     §11.4, §12.4      Pool/route cap; stricter
  fraction**         pool depth                           limits may apply.

  **Maximum daily    5%                 §11.5.2; Listing  Separate from
  turnover**                            4                 per-component weight
                                                          velocity.

  **Slippage         1% default in MARP §11.8, §12.3      Do not assume all routes
  tolerance**        listing; source                      share one tolerance;
                     also contains                        reconcile the effective
                     separate sell/buy                    route-specific values.
                     constants and                        
                     example-specific                     
                     tolerances                           

  **Trade deadline** 5 minutes          §12.8             Expired quotes must
                                                          fail/revert.

  **Gas fallback     \$50 equivalent;   §11.8             Fallback estimates must
  estimate**         gas units estimate                   be distinguished from
                     150,000                              live provider values.

  **Genesis          \$1,100,000        §20.1             Worked calculation only.
  example**          reserve; 1,000,000                   
                     MTQ minted;                          
                     RR=1.10                              

  **Treasury sweep   \$10,000           §20.3.1           Sweep balance above
  threshold**                                             threshold according to
                                                          treasury rules.

  **Gold shock       +50%, +25%, −10%,  §23.8             Research validation
  tests**            −20%, −30%                           cases, not forecast
                                                          scenarios.
  ---------------------------------------------------------------------------------

# Source-level reconciliation gates --- resolve explicitly before release

The following are source-level formula variants, symbol collisions,
historical/current distinctions or partially specified functions visible
in the blueprint. Listing them is not a silent correction or an
assertion that one side is wrong; it prevents them from being
accidentally resolved by implementation guesswork.

## RG-01 · Index recursion uses two different weight timestamps

**Source location:** §9.2, source formulas at P596 and P598

**What the blueprint shows:** The master spec displays I_t = I_t−1 × Σ_i
W_i,t(P_i,t/P_i,t−1) and also I_t = I_t−1 × Σ_i W_i,t−1(P_i,t/P_i,t−1).

**Required developer action:** Choose the normative convention only
after reconciling with §9.1 value aggregate, §9.3 chain-link continuity,
code Listing 3, and the published methodology. Record the rationale and
add regression tests.

## RG-02 · NAV symbol is overloaded

**Source location:** §2.5, §14.1, §19.3

**What the blueprint shows:** NAV_t is described in the core table as
the chain-linked reference index value; V_net,t is reserve NAV; §19.3
then defines NAV_t = V_net,t/S_circ,t as redemption NAV per circulating
MTQ.

**Required developer action:** Define unambiguous implementation symbols
for index value, total net reserve value, and per-token redemption NAV.
Preserve formulas and values, but remove naming collisions in
code/API/docs through an approved nomenclature mapping.

## RG-03 · Core getter and reserve manager NAV semantics need tracing

**Source location:** §2.7 Listing 1; §14.6 Listing 5

**What the blueprint shows:** The core getter in §2.7 returns
reserveState.fiatValue + reserveState.goldValue, while comments label
those fields gross values; the reserve manager section later describes
netFiat/netGold assignment and §14.1 requires per-asset haircuts.

**Required developer action:** Trace the stored field semantics end to
end. Confirm that getReserveRatio() divides haircut-adjusted net value
by liability in every build/deployment. Add test vectors that catch
accidental gross-NAV use.

## RG-04 · Legacy fixed-quantity GFB formula differs from adaptive index definition

**Source location:** §9.7.1 vs §§3.1, 9.1--9.3

**What the blueprint shows:** The legacy GFB_t example includes q_USD,
EUR, GBP, JPY and CNY terms, but not CHF/gold; the active v2.0 reference
index is adaptive and includes seven genesis components with chain
linking.

**Required developer action:** Mark the GFB formula as
historical/non-normative for v2.0 unless explicitly retained for lineage
verification only. Assert that production index getter uses current
chain-linked adaptive weights.

## RG-05 · Eligibility score normalization reuses Q_min symbol

**Source location:** §4.2--4.2.1

**What the blueprint shows:** Q_i ≥ Q_min defines eligibility, while
min--max normalization describes Q_min/Q_max as universe minimum/maximum
observed composite scores.

**Required developer action:** Disambiguate the threshold symbol and
observed-minimum symbol in the implementation specification and test
data; do not silently change the threshold semantics.

## RG-06 · Softmax score orientation must match exponent sign

**Source location:** §7.6

**What the blueprint shows:** α_m,t = exp(−η Score_m,t)/Σ_k exp(−η
Score_k,t), and prose says better models get greater weight.

**Required developer action:** Define Score_m so lower values mean
better under the negative exponent, or submit an explicit methodology
change if the score is higher-is-better. Test rankings and resulting α
values with known score vectors.

## RG-07 · Gold purchasing-power signal sign convention

**Source location:** §5.2

**What the blueprint shows:** GPR_i,t = P_i,t−1/P_i,t − 1, where P_i,t
is defined as the price of one unit of gold expressed in currency i.

**Required developer action:** Document direction and sign with test
cases where gold price in the currency rises/falls. Do not reverse
numerator/denominator without change control.

## RG-08 · Oracle consensus summary and implemented aggregate differ

**Source location:** §17.2 vs §17.5/Listing 9

**What the blueprint shows:** §17.2 says median for three, average for
two; §17.5 says the median is the validity/outlier anchor while the
published aggregate is the mean of surviving feeds.

**Required developer action:** Define a truth table by valid-source
count, source-family independence, outlier count and gold-specific mode.
Make prose, off-chain oracle simulation and contract bytecode agree.

## RG-09 · MARP trade objective lacks explicit optimization operator/sign convention

**Source location:** §10.9

**What the blueprint shows:** The displayed J(ΔW) includes remaining
deviation, spread/gas, urgency and absolute turnover terms but the
displayed line does not show an explicit argmin/argmax and the urgency
sign convention is unclear.

**Required developer action:** Confirm objective direction, units and
sign of each term from the intended MARP design. Do not implement an
arbitrary minimizer from the displayed expression alone.

## RG-10 · Execution profitability threshold differs across chapters

**Source location:** §10.8 vs §12.5

**What the blueprint shows:** §10.8 requires NetBenefit_i \> ε; §12.5
gives NetBenefit \> 0 and also NetBenefit_i \> ε with ε \> 0.

**Required developer action:** Define one normative per-route rule,
including whether ε is zero or a positive margin; match MARP and
execution contract guards.

## RG-11 · Buffer target equations are historical while v2.0 says gold allocation is adaptive

**Source location:** §13.5.2, §16.2--16.3

**What the blueprint shows:** Core-plus-buffer formulas use 20% core
gold, buffer ratios 62.5/85/100%, and a 10% buffer; fidelity notes say
these values are v1.2 initialization inputs and v2.0 core gold share is
adaptive.

**Required developer action:** Separate actual reserve accounting,
target buffer allocation and historical initialization. Never treat
historical core gold constants as the adaptive index gold weight.

## RG-12 · De-peg liquidation percentages need a precise denominator

**Source location:** §21.5.3 / Listing 14 / §25.2

**What the blueprint shows:** Summary describes cumulative stages
10%→25%→50%→100%; contract listing describes 10%, then additional 15%,
then additional 25%, then remainder.

**Required developer action:** Specify whether each percentage is
relative to original position or remaining position; test actual
cumulative sold fractions for all stages and issuer-freeze override.

## RG-13 · State count and labels need a canonical mapping

**Source location:** §21.2--21.3

**What the blueprint shows:** State_t maps RR and LCR to six states; the
sequence includes NORMAL, CAUTION, STRESS, DEFENSIVE, EMERGENCY, and
RECOVERY.

**Required developer action:** Make the six-state mapping/enum and
threshold predicates a single canonical table, including overlap
priority and recovery exit rules.

## RG-14 · Genesis normalization and reference price scaling must match

**Source location:** §3.4, §9.1, §18.1, §20.1.5

**What the blueprint shows:** The index is normalized to 1.0000 at
genesis; P_MTQ,t = I_t/I_base; genesis denominator is formed from q_i
times base FX/gold fixings.

**Required developer action:** Trace units/scales of q_i, base fixings,
I_base and I_t from genesis through getIndex/getMTQPrice and off-chain
verifier. No double normalization or scaling is allowed.

## RG-15 · Dynamic bounds and some functional forms remain symbolic

**Source location:** §4.2, §5.5, §8.2--8.3, §10.5--10.6, §13.5, §15.2

**What the blueprint shows:** Several functions are given as f(...) or
g(...) with parameter families but without fully fixed numerical
coefficients/transforms in these sections.

**Required developer action:** List each as "not fully specified /
validation-stage" until exact methodology/version data are supplied. No
developer may fill gaps with undocumented constants.

# Required implementation and regression test checklist

-   Genesis index begins at exactly 1.0000 using all seven genesis
    components and immutable base fixings; the event and off-chain
    verifier agree.

-   All weight vectors sum to one within the contract's integer scaling;
    all components are non-negative and within their approved bounds.

-   Every accepted weight update passes per-component velocity limits;
    smoothing formula and stress flag match the intended normal/stress
    settings.

-   Independent reproduction: identical data, parameters,
    methodology/model/oracle versions produce identical W\^Target,
    W\^Constrained and W\^Smooth.

-   Chain-linked index has no jump caused only by a rebalance or
    constituency revision; continuity is tested using B_t−, B_t+, D_t
    and cumulative G_t.

-   Reference index return and contribution attribution reconcile, while
    spreads/slippage/gas/fees/impact remain separately visible as
    realized execution costs.

-   Oracle truth-table tests cover 3/2/1/0 valid feeds,
    independence/quorum failure, stale data, confidence-width rejection,
    deviation rejection, correlated feeds, degraded mode and recovery.

-   Gold reference price is independent of the protocol's own token/AMM;
    reserve NAV uses min(reference price, executable price) as specified
    for gold reserve valuation.

-   Net reserve NAV applies asset-specific haircuts; RR, liability, LCR,
    stress redemption demand and per-token redemption NAV match their
    definitions exactly.

-   Mint test: X_net = X(1−F_mint); MTQ_minted = X_net/P_MTQ,t; no fixed
    USD peg is used.

-   Redemption test uses the selected and unambiguous NAV symbol,
    applies the risk-state fee once, respects slippage guards, and
    verifies asset-by-asset release amounts and rounding.

-   MARP test covers no-trade inside the band, trigger just outside the
    band, partial correction, natural-flow netting, cost-gate rejection,
    daily turnover, pool cap, direction lock, emergency override and
    deferral under thin liquidity.

-   Buffer tests verify BASE/STRESS/EMERGENCY ratios, correct 24-hour
    ramping, hysteresis/recovery confirmations, and the first-loss
    waterfall in exact order.

-   De-peg tests verify the exact cumulative liquidation amount under
    stages 10%, additional 15%, additional 25%, then remaining balance;
    test issuer freeze and RR emergency overrides.

-   Stress validation runs all required gold, currency, stable-value,
    liquidity, custody, correlation-collapse and reserve scenarios;
    record CoverageRatio_s for each.

-   Public status and production-authorization functions reflect all
    validation gates; testnet must remain not production-authorized per
    the blueprint.

-   All source-level reconciliation gates RG-01 through RG-15 have an
    owner, decision record, tests, versioned resolution, and updated
    documentation before production.

# Definition of done

The task is complete only when the implementation can demonstrate
formula-by-formula traceability to the blueprint; each formula has a
named owner, input source, units, scaling, rounding and fallback
behavior; all symbolic functions have a published concrete version
before use; every source discrepancy has a recorded resolution; and
automated tests prove parity between off-chain MASE results, on-chain
guardrails, index publication, reserve accounting, MARP decisions and
the worked examples.

This document intentionally does not claim that MTQ Σ has been
mathematically validated or is production-ready. The master blueprint
states that the protocol is a candidate for public testing and that all
validation-stage numerical weights, corridors and coefficients remain
subject to the research program in Chapter 23.
