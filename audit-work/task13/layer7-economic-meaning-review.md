# MTQΣ — TASK 13 CLOSEOUT · LAYER 7 ECONOMIC-MEANING REVIEW (Priority 3)
## S3 / S5 / S6 — what the numbers mean, what they do not, and how they were verified

**Date:** 2026-10-22 (verification window 18:21–19:12 UTC) · **Suite:** `src/lib/mtq/__tests__/canonical-invariants.ts` Layer 7 (META header: *MTQΣ Master v1.0*, deliverable G).
**Fresh verification this cycle:** (i) `--layer7=s3 --merge` re-run — exact cover of 200/200 from 5 partials, survivors 85, worst min RR 0.076, S3 2/2 PASS, exit 0; (ii) chunk-4 (trajectories 120–159) **re-executed independently with per-tick instrumentation** (`evidence/l7-s3-failure-diagnostic.ts` + range JSONs) — reproduces the recorded partial **bit-exact** (survivors 19 = 19; worst min RR 0.07585525867923032 = 0.07585525867923032, |Δ| < 1e-15) — proving both the replica's faithfulness and the seed-determinism of the chunked record across re-runs and wall clocks.

**Standing honesty rule:** everything below describes a **model-internal, reserve-era simulation** (the OLD family — $9M mint, strategic-prior 26% gold composition, haircuts, chain-linked index, MASE, 6-state machine). Passing software assertions here are **not** proof of economic safety, reserve adequacy, market-price stability, or real-world performance, and are **inadmissible as evidence for any v3.0 model** (options paper §13). Quantitative, independent economic validation remains **NOT PERFORMED** (D-13.25/D-13.26 protocol unratified; no graded run conducted).

---

## 1. Exact definitions (units and acceptance criteria)

| Term | Definition (from the harness, verified by code review) |
|---|---|
| **RR** | Reserve ratio = NAV ÷ liabilities, dimensionless. NAV = haircut asset values; liabilities = supply × index-derived MTQ price. |
| **RR_HARD** | 1.00 — the absolute solvency floor (Invariant I2; blueprint constant). |
| **survived (one trajectory)** | min RR over ALL of the trajectory's ticks ≥ 1.00 (a single sub-1.00 tick fails the trajectory). |
| **survival (a scenario)** | survivors ÷ runs — the fraction of FIXED-SEED trajectories that never breach. |
| **worst min RR** | the deepest RR value reached by any trajectory at its worst tick. |
| **S5** | gold **+50% single shock** at tick 1 of 30; Gaussian noise σ=0.2%; seedBase 5000; 100 runs. Assertions: survival ≥ 95%; worst min RR ≥ 1.00. (Plus one documentation assertion — see §4.) |
| **S6** | gold **−30% single shock** at tick 1 of 30; Gaussian noise; seedBase 6000; 100 runs. Assertions: survival ≥ 95%; worst min RR ≥ 1.00. |
| **S3** | **Cauchy fat-tailed shocks on all 6 currency/gold legs + VIX/DXY, every tick**, 90 ticks; per-leg scales 0.4–1.5% (gold 1.5%); seedBase 3000; 200 runs. Assertions: (1) a documentation carrier (always-true) recording the measured value; (2) survival **strictly > 35.1%**. |
| **Generator truncations** | gold floored at $500 (0.2× base $2,500); fiat legs floored (EUR ≥ 0.4, etc.) with **no upper bound**; VIX clamped [10,80]; DXY clamped [80,120]. The suite comment "infinite tails" is accurate only for **upward fiat moves** — a material modeling choice (see §5). |

## 2. S3 — 85/200 surviving trajectories (42.5%)

- **Exact meaning:** 85 of 200 fixed-seed Cauchy-shocked trajectories never let the modeled RR fall below 1.00 at any of their 90 daily ticks. **115 trajectories (57.5%) breached the modeled solvency floor at least once.**
- **Acceptance criterion and its provenance:** the only substantive S3 assertion is `survival > 0.351`, strictly. The 35.1% is the **AUDIT-C legacy measurement** (`audit-work/audit-c-stress-tests.md`: S3 Cauchy, 2,000 runs, **Laspeyres** index, survival 35.1% vs a ≥85% requirement → recorded FAIL, worst RR 0.146). The suite's threshold text was written into the committed harness **before** this cycle's runs; the threshold itself predates the current measurements (it was inherited from the G-suite era, see §6). It was therefore **pre-specified relative to this cycle's observation** — but it is a *benchmark-comparison* threshold, not an adequacy threshold: any survival above 35.100001% passes.
- **The first S3 assertion is tautological** (`… — survival documented`, condition `true`): it is a documentation carrier that prints the measured value into the result record. It proves nothing. The recorded "Layer 7: 7/7 PASS" therefore comprises **5 substantive assertions** (S5 ×2, S6 ×2, S3 ×1) plus 2 documentation carriers (S5 #3 re-points to the Layer-1 chain-linked-index proof without re-measuring; S3 #1).
- **What the metric says about the modeled system:** under this harness, the modeled reserve-era system survives the modeled Cauchy regime **less than half the time**; the passing grade records only that the chain-linked index regime beats the legacy Laspeyres regime on the same scenario family. It says **nothing** about the probability of real-world solvency, nothing about reserve adequacy (there is no real reserve in this model — the state is synthetic), and nothing about market-price stability (the modeled MTQ "price" is the index itself; no market-price feed exists in the simulation).

## 3. The worst minimum RR ≈ 0.0759

- **Exact meaning (now fully attributed, this cycle):** trajectory **#146** (seed 3146) reached min RR **0.07585525867923032 at tick 89 (the final tick)** with **NAV $8.00M vs liabilities $105.50M**, worst/final status **EMERGENCY**, gold at **0.201× base** (its modeled floor — a −99.74% single-tick gold crash occurred in the path), and only 3 ticks below the floor before the window closed. The mechanism: the gold leg collapsed to the $500 clamp while **unbounded-upward Cauchy fiat shocks inflated the index** (and thus liabilities) by an order of magnitude — the haircut NAV could not keep pace.
- **MANDATE-005 denominator clarification (recorded; measurements unchanged):** the "0.2× base" figure is referenced to the **base fixing** ($2,500 → floor $500), while the "−99.74% single-tick crash" is referenced to the **pre-crash in-trajectory gold level of that tick** — an unbounded-upward Cauchy excursion that first ballooned the gold leg ~78× above base before collapsing back to near the floor. A base-referenced crash to the floor would read −79.9%. The two figures use different denominators and do not contradict; both are generator artifacts (gold clamped below at 0.2× base, unbounded above). See `executive-decision-brief.md` §7 for the owner-facing statement.
- **No assertion bounds the worst case.** The S3 assertions do not test worst-min-RR at all; a passing S3 run is compatible with arbitrarily deep modeled collapses (0.0759 is the observed depth of this one; nothing prevents deeper). This is the single most decision-relevant number in the Layer-7 record and it is carried **only as a printed detail**, not as a gate.

## 4. S5 — 100% survival, worst min RR 1.110 · S6 — both assertions PASS

- **S5 (gold +50%):** survival 100.0% ≥ 95% ✓ and worst min RR 1.110 ≥ 1.00 ✓ (both thresholds pre-specified in the committed harness). Meaning: in the model, a one-time gold up-shock grows the chain-linked index by ≈ 26% weight × 50% = +13%, so liabilities reprice **with** the reserve and RR holds near the 1.10 target rather than crashing to 0.83 as under the legacy Laspeyres index. This is an **index-repricing property**, not a market-price property: the model contains no market for MTQ, no trading at other prices, no redemption stress — it assumes by construction that MTQ is worth the index. It is **not** evidence that a real token's market price would track anything.
- **S5's third assertion** ("chain-linked index growth = 13% (NOT 50%)") is a **documentation carrier** (condition `true`) pointing at the Layer-1 unit proof; it does not re-measure the scenario.
- **S6 (gold −30%):** both assertions (survival ≥ 95%; worst min RR ≥ 1.00) held — recorded PASS with exit 0 in the Stage-A run (16:58–17:04 UTC). **Honest gap:** the S6 headline measured values were truncated from the captured transcript tail, so the recorded evidence for S6 is the exit code plus the assertion conditions, **not** the printed survival/min-RR numbers. The Stage-K rewrite should re-capture them; no claim about the specific S6 values is made here.

## 5. Failed-trajectory analysis and parameter sensitivity (fresh evidence, chunk 4)

The 21 failures in trajectories 120–159 (re-executed with instrumentation, bit-exact vs the record):

| Observation | Value | Interpretation |
|---|---|---|
| Worst risk state reached | **21/21 EMERGENCY** | every failure reaches the modeled terminal state |
| Breach tick (min RR) | min 34 · **median 88** · max 89 | breaches are **late, cumulative-drift events**, not single-shock events |
| Gold at breach < 0.5× base | 10/21 | gold crashes dominate the failure set |
| Gold trough at the $500 floor (0.2×) | 13/21 | most failures ride the modeled gold floor |
| Gold ≥ 0.9× base at breach | **5/21 (24%)** | a quarter of failures are **not** gold-crash-driven |
| Gold **UP** at breach | 2 (both at 2.07×) | #124 (min RR 0.979 — marginal) and #145 (min RR 0.447, liabilities $24.9M vs NAV $11.1M) — unbounded upward fiat tails inflate index/liabilities faster than haircut NAV grows |
| Liabilities > $20M at breach (vs ≈ $9.5M initial) | 4/21 | the fiat up-tail ballooning mechanism (#145/146/148/152) |
| **Survivor margin above the 1.00 floor** | min **+0.0206** · median +0.0718 · max +0.1102 | the surviving population is dominated by **near-misses** — the tightest survivor cleared the floor by 2.1 RR-points |

**Sensitivity conclusions (honest):**
1. **Harness/regime sensitivity is empirically demonstrated** by the S3 family's measured history: 35.1% (AUDIT-C: Laspeyres, 2,000 runs) → 39.5% (G suite) → 78.8% (G2 rerun) → 80.4% (T-66) → **42.5% (current: 200 runs × 90 ticks)**. There is no single "the survival rate is X%" fact; the metric moves by tens of points across legitimate harness/parameter variants. Any citation of one number without its exact regime is inadmissible.
2. **Generator asymmetries shape the failure distribution:** fiat legs have no upward clamp (fat tails inflate liabilities without bound) while gold is floored at 0.2× — the "24% non-gold failures" and the $105M-liability trajectory are artifacts of this modeling choice as much as of the "system".
3. **The mandated parameter-sensitivity program has NOT been run.** The VAL-* families (historical + stress windows, 8 mandated metrics, pre-registered thresholds) in `quantitative-validation-plan.md` remain plan-only (D-13.25/D-13.26 unratified). **Quantitative and independent economic validation: NOT PERFORMED.**

## 6. Chunking/merging integrity (MANDATE-004 §3 compliance, re-verified this cycle)

- **Code review:** trajectories are pure functions of `(seed, ticks, fxGen)` with freshly constructed state per call; seeds are `seedBase + i` over **disjoint** i-ranges; the RNG is seeded per-trajectory (no cross-trajectory RNG state); `survivors` is exact integer addition; `worstMinRr` is an associative/commutative min. Partials carry only `{scenario, trajStart, trajCount, survivors, worstMinRr}` (no secret-shaped data possible by construction) and execute **no** assertions. The merge hard-exits (exit 2) on any gap, overlap, out-of-range, or malformed record; the scenario assertions run **only** on a proven exact cover and are byte-identical to the pre-selection version.
- **Empirical re-verification (this cycle):** the S3 merge re-run verified the exact cover of 200/200 from the 5 recorded partials (survivors 85, worst 0.076, S3 2/2 PASS, exit 0). Chunk 4 was **re-executed from scratch** and reproduced the recorded partial bit-exact (19 survivors; worst 0.07585525867923032). The 5 partials' arithmetic: 17+13+18+19+18 = 85 ✓; min(0.4354, 0.4230, 0.2728, 0.0759, 0.4255) = 0.0759 ✓.
- **Conclusion:** chunked execution is value-identical to single-process execution for these scenarios; the isolation edit (committed in `7633116`) did not alter the scenario set, seeds, or aggregate assertions. **One residual nondeterminism surface exists** — `stepEngineCanonical` passes `Date.now()` into the risk-state machine and buffer update — but the bit-exact re-execution across different wall clocks demonstrates it does not affect outcomes in practice (confirmation-window logic never binds mid-run).

## 7. What passing means — and does not mean

Layer 7's PASS records that **the implemented reserve-era reference implementation behaves as its own designers specified under its own fixed-seed synthetic scenarios**. It is code-quality evidence about the old family only. It is not, and must not be presented as: economic safety; reserve adequacy; market-price stability (targeted or guaranteed); redemption capacity; regulatory acceptability; evidence for any v3.0 model (all four models in the Gate-B set are unsimulated); or validation (which remains **NOT PERFORMED** pending D-13.25/D-13.26 ratification and an independent validator).

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**
