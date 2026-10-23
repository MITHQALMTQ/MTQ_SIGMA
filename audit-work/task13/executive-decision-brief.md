# MTQΣ — TASK 13 · EXECUTIVE DECISION BRIEF (deliverable 1)

**For:** Project Owner / COO · **Date:** 2026-10-22 · **Mandate:** MTQSIGMA-COO-MANDATE-003 (v3.0)
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. Production authorization: FALSE.**

## 1. P0 — your message contained a private key and a request to put it in `.env`. That was refused, and the key is contained.

- The attached `private_key.txt` (66 bytes, arrived 13:26 UTC) was **never opened, read, printed, or copied by me**. A value-safe scanner classified it: it is the **already-known compromised EVM key (C-045-a / R-1, fingerprint `0xdbe1…62d6`)** — the same key recorded as compromised since the Task 10 incident. Not a new key.
- **Why refused:** your own mandate §2 rule 1 forbids it; no operation in this engagement needs a private key (all verification is public-address read-only; migration packages are unsigned by design); and the key is already compromised — the only correct handling is non-use plus rotation via the Task 12 D4 package after your D8 approvals.
- **Containment (verified):** the file is double-gitignored and can never be committed accidentally; it has never been in any commit; the worktree secret gate is now — correctly — **red with exactly this one finding** and will stay red until you decide its disposition (**D-13.1**: authorize deletion naming the exact path, or destroy it platform-side). One limitation is yours to fix: the file is root-owned mode 777 on the sandbox host; I cannot restrict it from my session.

## 2. Stage A (baseline) is delivered — the headline findings

`audit-work/task13/baseline-and-change-matrix.md` contains the full evidence. In one paragraph:

The codebase contains **four un-reconciled economic families** (v1.0/v2.0 adaptive-reserve 7-currency at RR 110%; MITHQAL 11-currency bank model at RR 130%, 80/18/2; the **deployed** 5-currency v1.2 pilot with admin-set prices; the undeployed V3 non-custodial bank-mediated design). The reserve concept is load-bearing in ~15 modules — issuance capacity, pricing, redemption, solvency states, rebalancing all depend on it — so the v3.0 no-reserve redesign is a **replacement program, not a relabel**. The basket is fixed at 7 **by construction** (immutable arrays, enums, `!== 7` guards) — an expandable constituency engine means contract redesign, and the codebase itself admits "Constituency is STATIC." Fees exist in code (mint 0.10%, redeem ladder, rebalance 0.20%) but V3 has no fee-sweep function and V2 commingles fees with collateral; every rate is an unapproved parameter. Oracle independence is not yet real (one live upstream per pair with synthetic witnesses). No payment-instrument registry exists. Nothing revenue-generating beyond those fees is implemented. All 18 deployed contracts have unverifiable source identity, and **every on-chain authority still resolves to the single compromised deployer EOA** — the mandate's Stage-H requirement is currently unmet on-chain and is being addressed only through the unsigned, approval-gated Task 12 migration packages.

## 3. Fresh gate re-run (2026-10-22) — honest

typecheck PASS · lint PASS · no-neon PASS (45 routes) · security suite 36/37 (the one failure is the worktree secret-gate test, red **because of the uploaded key file** — fail-closed working as designed) · worktree scan FAIL = 1 finding = the same file · canonical-invariants re-run recorded in the test matrix · all 11 release gates NOT CONDUCTED · all 8 release controls NOT_GRANTED · **overall NOT ACCEPTED, unchanged.**

## 4. Decisions requested from you (all others stay open; nothing is chosen silently)

| ID | Decision | Why it blocks |
|---|---|---|
| **D-13.1** | Disposition of `upload/private_key.txt` — authorize deletion (name the path) or destroy platform-side | Only item blocking a green worktree secret gate |
| **D-13.2** | Acknowledge the `.env` refusal protocol (mandate §2.1 governs; keys are never accepted into this environment) | Confirms the safer reading of your own mandate |
| **Gate B set (D-13.3…D-13.7)** | Monetary semantics: what MTQΣ IS (basket-referenced asset / purchasing-power unit / algorithmic token / hybrid); stability objective; which of the four economic families (if any) survives as the v3.0 baseline; supply policy; redemption/market mechanism | The v3.0 specs (deliverables 3–12) will present alternatives — but the mandate's Stage B requires your explicit selection before any economic implementation |
| Carried | Task 12 D8 approval chain (OWNER-ATT-1 → T12-1/T12-3 → CKPT-2/3/4 → CKPT-5/6/7), SOL-DEC-1, DEC-3, DEC-1..7 | Both compromised keys remain REAL and fully privileged at the latest fresh anchors |

## 5. What happens next (safe work only)

Stage B–J specification drafting as **proposals with alternatives** (no silent choices), the constituency-registry schema, index-continuity tests, the payment-instrument registry design, the emergency-state spec, and the quantitative-validation pipeline. No signing, no transactions, no deployment, no history rewrite, no gate advancement at any point.

## 6. Update — 2026-10-22, MANDATE-004 Stage B–K cycle (read with §1–§5 above)

- The Stage B–K specification set is now **PRODUCED as PROPOSALS** (index in `README.md`): the master v3.0 architecture (deliverable 3, modules A–L with existing/intended/breaking/migration/tests/risks/acceptance per module), the MANDATE-004 §5 economic-model decision paper (`economic-model-options.md` — four models × ten dimensions; **no model selected**; advisory recommendation only; your Gate-B choices D-13.3…D-13.7 remain the gating set), constituency + index/gold/GPP specs, payment-registry + oracle/emergency specs, supply-operations spec, fee architecture + `revenue-and-unit-economics.md`, cross-chain review, quantitative-validation plan, and the security-readiness consolidation.
- The decision register now carries **D-13.1 … D-13.26 — all OPEN** (D-13.13–D-13.26 were opened by the Stage B–K specs; parallel-drafting ID collisions were renumbered and documented in the register).
- Fresh verification finding (this cycle): the canonical-invariants suite **FAILS on the current tree** — 6 stale Layer-8 assertions (deterministic and order-independent; reproduced in two independent runs). Layers 1–7 all completed and passed this cycle (Layer 7 via the mandate-authorized chunked execution). The green baseline must be restored by the Stage-K rewrite; no earlier PASS record is citable. Details: `test-matrix-and-results.md` §1–§2.
- Nothing else changed: both compromised keys remain REAL and fully privileged; the worktree secret gate stays red pending **D-13.1**; no signing, broadcasting, deployment, migration, history rewrite, or gate advancement occurred.

## 7. MANDATE-005 update (2026-10-22) — what the Layer-7 S3 result is, and is not

The prior sections record that Layer 7 "completed and passed this cycle." Five statements are required so that record cannot be over-read (full analysis: `layer7-economic-meaning-review.md`; fresh evidence: `evidence/l7-s3-failure-diagnostic-*.json`):

1. **S3 is a reserve-era simulation.** It exercises the OLD family — $9M synthetic mint, strategic-prior 26% gold, haircuts, chain-linked index, MASE, the 6-state risk machine — under fixed-seed synthetic Cauchy shocks. It models a system with a modeled reserve ratio. It is not a model of any v3.0 architecture.
2. **The 42.5% survival figure exceeded a 35.1% legacy comparison figure — that figure is not an adequacy threshold.** The 35.1% is the AUDIT-C Laspeyres-regime measurement on the same scenario family (2,000 runs, recorded FAIL there). The S3 assertion records only that the chain-linked regime beats the legacy Laspeyres regime on this scenario family. Any survival above 35.100001% passes; "passing" therefore says nothing about sufficiency.
3. **57.5% of modeled trajectories (115 of 200) breached the modeled reserve-ratio floor (RR < 1.00) at least once.** The passing grade and the majority-breach fact are simultaneously true; the pass is a benchmark comparison, not a solvency result.
4. **The simulation does not validate a no-reserve architecture or market-price stability.** There is no reserve in v3.0 as proposed; there is no market for MTQ in the simulation at all (the modeled "price" is the index itself). Nothing in Layer 7 is admissible as evidence for any v3.0 model.
5. **The v3.0 quantitative validation has not been performed.** Zero v3.0 validation runs exist. The plan is `v3-quantitative-validation-plan.md` (separate from this legacy result by design); the pre-registration (D-13.25) and validator-independence (D-13.26) protocols remain unratified.

**Gold-shock denominator clarification (measurements preserved; recorded explanation).** Two distinct denominators sit behind two figures that sound contradictory and are not:
- **"Gold at 0.2× base"** (the modeled gold floor, reached in 13 of 21 chunk-4 failures and at trajectory #146's minimum): the denominator is the **base fixing** — the $2,500 initial gold price in the fixture; the generator floors gold at $500 = 0.2 × base. At its worst tick (#146, tick 89) gold sat at 0.2014 × base ≈ $503.5.
- **The "−99.74% single-tick gold crash"** (the maximum adverse single-tick move in that trajectory): the denominator is the **pre-crash in-trajectory gold level of that tick** — an unbounded-upward Cauchy excursion that had first ballooned the gold leg roughly 78× above base before collapsing back to near the floor. The crash is therefore a crash *from the balloon peak to the floor*, not a 99.74% crash from base (a base-referenced crash to the floor would be −79.9%).
Both numbers are properties of the **model's generator** (heavy Cauchy tails with gold clamped below at 0.2× base and unbounded above), not of any market. No measurement was altered by this clarification; the earlier phrasing ("a −99.74% single-tick gold crash occurred in the path") is precise only with its denominator stated, which it previously was not — recorded here as a documentation clarification, not a data change.

**Consequence for the program:** the Layer-7 PASS is code-quality evidence about the old family only. Reserve-ratio success (or failure) is **not** a substitute for testing market, index, oracle, supply, or operational risk in v3.0 — which is why the v3.0 plan exists separately and no v3.0 run has been performed.

**Standing status: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**
