# MTQΣ — Layer-8 Test Corrections — Evidence Pack (MANDATE-006 §16.11)

**Document ID:** MTQSIGMA-T13-L8-PACK · **Date:** 22 October 2026 · **APPLIED-UPDATE:** 23 October 2026
**Mandate:** MTQSIGMA-COO-MANDATE-006 §13 (Resolve the six canonical Layer 8 test failures) + §16.11

**APPLIED 2026-10-23 (owner-approved):** the six corrections were applied VERBATIM to `src/lib/mtq/__tests__/canonical-invariants.ts` under the owner directive of 23 October 2026 (`owner-directive-2026-10-23-delegated-execution.md` — "make all fixing … needed"; D-13.26 review gate approved per directive §2 item 1). Pre-application exactness re-verified fresh: `evidence/extract-and-verify-layer8-diffs.ts` exit 0 (30/30 removed + 23/23 context lines byte-exact). **The suite is GREEN with the corrected assertions:** focused Layer 8 **94/94 pass, 0 fail, exit 0** (was 85/91, 6 fail) — `evidence/l8-focused-mandate008-2026-10-23.txt`; deterministic Layers 1-6+8 **246/246 pass, 0 fail, exit 0** (was 237/243, 6 fail) — `evidence/l-deterministic-mandate008-2026-10-23.txt`; read-only fixture verification re-run exit 0 — `evidence/l8-fixture-verification-mandate008-2026-10-23.txt`. Full-suite verdict with Layer-7 7/7 carried: **253/253 PASS** (250 → 253; the three new invariant-coverage assertions are live). NO assertion was weakened; the §4 expectation below (246/246 deterministic; 253/253 with Layer-7) is now the OBSERVED fresh result. This is code-quality evidence only — no economic, legal, security, or release approval; carried-open items (OD-2, β₁/β₂ publication, §12.7 gas basis) remain open.
**Consolidates (does not replace):** `layer8-six-failures-adjudication.md` (per-finding adjudication vs the authoritative v2.0 text) · `d13.26-layer8-evidence-pack.md` (per-finding evidence + proposed diffs + fixture verification + regression command set) · `evidence/l8-d13-26-fixture-verification.ts/.json` (empirical fixture verification) · fresh regression runs recorded below.
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**

**Verdict discipline (as written 2026-10-22; superseded 2026-10-23 — see the APPLIED note above):** the canonical suite verdict on the tree at authoring time was **FAIL — 244/250** (deterministic layers 237/243 + Layer-7 7/7 from the recorded chunked evidence; the deterministic layers re-run that cycle: 237/243, exit 1 — the same six failures, byte-identical). Nothing was applied at authoring time; no assertion was weakened; the verdict stayed FAIL until the owner/validator-approved corrections were applied — **which occurred 2026-10-23: the verdict is now PASS 253/253 (deterministic 246/246 fresh + Layer-7 7/7 carried), 0 fail, exit 0** (fresh logs named above). A passing general `bun test` suite (37/37 that cycle) does **not** override a canonical verdict — the canonical suite itself is now the green record.

---

## 1. Re-verification of current state (MANDATE-006 §13 requires it before anything else)

| Run (2026-10-22, this cycle) | Command | Result · exit |
|---|---|---|
| Layer-8 focused (fresh) | `bun src/lib/mtq/__tests__/canonical-invariants.ts --layers=8` | **85/91 pass, 6 fail** · **exit 1** (evidence: `evidence/l8-focused-mandate006-2026-10-22.txt`) |
| Deterministic Layers 1–6+8 (fresh) | `bun src/lib/mtq/__tests__/canonical-invariants.ts --layers=1,2,3,4,5,6,8` | L1 41/41 · L2 42/42 · L3 25/25 · L4 12/12 · L5 29/29 · L6 3/3 · L8 85/91 → **237/243, 6 fail** · **exit 1** (evidence: `evidence/l-deterministic-mandate006-2026-10-22.txt`) |
| Layer 7 | carried from the recorded chunked evidence (S5 PASS · S6 PASS · S3 42.5% via 5×40 chunks + exact-cover merge; `evidence/canonical-layer7/`) | no source change since — carried |
| Repo suites (fresh) | `bun test` | **37/37** · exit 0 |
| Quality gates (fresh) | `bun run typecheck` / `bun run lint` / `bun run security:scan` | PASS / PASS / PASS (2,221 files, 0 findings) |

Tree state: HEAD `12dc545` (docs-only commit; the engine, harness, and all contract files byte-identical to the state the six failures were adjudicated in); worktree delta = Task-13 audit documents only. **The six-failure set is unchanged, deterministic, and order-independent** (now reproduced across five independent windows incl. this cycle's two fresh runs).

## 2. The six findings — adjudicated classification (one line each; full evidence in the annexes)

| # | Assertion (verbatim name) | Authoritative source (v2.0) | Current code behavior | Classification | Invariant state in code |
|---|---|---|---|---|---|
| 1 | C.1: θ_base = 0.75% and the band boundary is strict (<) | §10.4: "Trade_i = 0 if D_{i,t} ≤ θ_{i,t}" — **inclusive** | `inNoTradeZone` returns `≤` (`marp.ts:699`, "v2.0-FIX" comment) | Obsolete test expectation | INTACT (never trades at D = θ) |
| 2 | C.3: tradeUsd ≈ β × 0.6%×NAV = 0.50 × $6,000 = $3,000 | §10.6: state-dependent β_{i,t} = clip(β₀+β₁U−β₂Î, β_min, 1) | β = 0.86 for this fixture → tradeUsd $5,160 (`marp.ts:445-458`) | Obsolete test expectation (fixed-β legacy) | INTACT (full §10.6 form) |
| 3 | RG-10 ε boundary: net ≈ +$5 → pass=false; net ≈ +$15 → pass=true | §10.8/§12.8 strict `net > ε`; ε=$10 legacy candidate (OD-2 OPEN) | Default cost assembly (§12.7 exact model) → both fixture nets deeply negative | Obsolete fixture premise (cost assembly) | INTACT (`net > ε` strict; ε-assertion passes) |
| 4 | RG-10: net benefit $4.79 ≤ ε → shouldRebalance=false (ACTIVE path) | §10.8/§12.8 unified gate on the active route | Under §12.7 costs the fixture's net = +$36.28 > ε → correctly executes; reject branch unreachable | Obsolete fixture premise (cost assembly) | INTACT (reject branch `net ≤ ε` exists and never trades) |
| 5 | RG-10: rejection reason cites the unified §10.8/§12.8 gate | Listing 4 skip-reason contract | Same root cause as #4 — reason string is the execute-form | Obsolete fixture premise (same root cause) | INTACT (reject reason contains §10.8/§12.8) |
| 6 | §21.5.3: in-band decay 2×dtHours (30h → 10h) → stage 0 | §21.5.2: "the timer **resets to zero** the moment the price returns inside the band" | `engine.ts:1787-1793` resets to 0 ("v2.0 §21.5.2" comment) | Obsolete test expectation (pre-v2.0 decay) | INTACT (strictly-consecutive detector) |

**Common root cause (adjudicated):** all six are assertion-vs-code mismatches in which the **code matches the current authoritative v2.0 text** and the assertions encode superseded parameterization. No code defect was found; no invariant requires weakening. (Annex A §"Common root-cause finding".)

## 3. Proposed corrections — exact diffs, review status, and what each preserves

**The exact proposed diffs** (test-file edits to `canonical-invariants.ts`, shown hunk-by-hunk with before/after assertion code) are in `d13.26-layer8-evidence-pack.md` §2–§6 per finding and are **NOT APPLIED**. Summary of the correction directions:

| # | Proposed correction | Direction | Weakening? |
|---|---|---|---|
| 1 | Re-pin to inclusive `≤` with §10.4 re-citation + end-to-end sandwich through `marpDecision` (0.74% Level-2 hold / 0.76% passes) | Strictly **more conservative** (one fewer trade-triggering point) | No |
| 2 | Assert the full §10.6 β-form end-to-end (β=0.86 record, urgency 0.72, residual-only property, ≠ raw-gap $12,900) | **Stronger** (verifies the form, not a scalar) | No |
| 3 | Pin the legacy worked-example vector **explicitly** through the documented back-compat positional signature `(0.001, 50)` → nets +$5/+$15 exactly | **Identical intent** (boundary test restored; pure ε-rule test) | No |
| 4 | Recalibrate the active-path fixture: nav $6,000, surplus $60 → net +$5.70 ∈ (0, ε] → REJECT (branch-reach proven empirically) | **Original meaning restored** (reject region reachable without touching the band) | No |
| 5 | Resolved by #4's recalibration (reject reason verified to cite §10.8/§12.8) | Same | No |
| 6 | Expect reset-to-zero (30h → 0) + NEW 12h detector boundary (h=12 → stage 0; h=13 → stage 1) + NEW oscillation discriminator | **Strictly more conservative detector** + three NEW invariant-coverage assertions | No (net assertions increase 250 → 253) |

**Compatibility separation (MANDATE-006 §13):** the current cost-model tests (default-path §12.7 assembly, unchanged and passing elsewhere in the suite) remain **separate** from the legacy worked-example compatibility test (#3's positional-signature vector) — the correction does not modify the current implementation to satisfy an obsolete fixture; it uses the documented explicit-override path whose sole purpose is worked-example vectors (`marp.ts:713-714`).

**Review status: all six corrections are ☐ OPEN under the D-13.26 protocol.** Application requires the owner/validator evidence-based review of every proposed test change (a prioritized owner decision, MANDATE-006 §18 item 7). **Nothing has been applied**; the canonical suite is byte-identical.

## 4. Post-correction expectations (pre-registered, not yet observed)

- Deterministic Layers 1–6+8: **246/246** expected (152 unchanged + 94 Layer-8 assertions incl. 3 new) — currently 237/243.
- Suite count 250 → **253** with the three new invariant-coverage assertions; expected post-application verdict **253/253**.
- Layer 7: unchanged by the pack; re-run per the chunked protocol (S5, S6, S3×5 + merge) — currently recorded PASS at the byte-identical tree.
- Repo suites: `bun test` 37/37 · typecheck PASS · lint PASS expected to hold (test-file-only edits).

**Full regression command set:** `d13.26-layer8-evidence-pack.md` §9 — to be run **only after** approval; any failed row blocks and is reported as FAIL.

## 5. Empirical verification of every proposed fixture value (done, read-only, outside the canonical suite)

`evidence/l8-d13-26-fixture-verification.ts` + `.json` (MANDATE-005 cycle, re-verified present and clean this cycle): Part 1 C.1 boundary + sandwich ✓ · Part 2 C.3 Î=0 + full β derivation to the last digit (β=0.86; $5,160 ≠ $12,900) ✓ · Part 3 legacy vector nets +$5/+$15 ✓ (and the default-path −41,577.82/−41,497.82 explaining today's failure) · Part 4 active-path branch-reach proof (recalibrated net +$5.70 → reject; band + direction-lock guards demonstrably passed; Case B executes +$60.58) ✓ · Part 5 reset/boundary/oscillation proofs (30h→0; h=12/h=13; oscillation 10→0→5 vs decay 13) ✓.

## 6. Carried-open items (passing any corrected assertion confers no policy approval)

OD-2 (ε $10 vs 1% benefit-margin conflict — legacy candidate, do-not-activate clause stands) · β₁/β₂ Risk-Council publication (§11.10) · §12.7 gas basis $17.82 is a recorded accounting-cost estimate (Appendix-F P0-3), not a gas price · MASE pilot-substitute status unchanged. All Layer-8 passing assertions are **code-quality evidence only** — never economic, legal, security, or release approval.

## 7. Status block

| Item | Status |
|---|---|
| Six findings adjudicated vs the controlling specification | DONE (annex A) |
| Exact proposed diffs per finding | DONE — **NOT APPLIED** (annex B) |
| Fixture values empirically verified | DONE (annex C) |
| Owner/validator review (D-13.26) | ☐ **OPEN** — the gating approval |
| Corrections applied | **NO** |
| Canonical verdict | **FAIL (244/250)** on the current tree (fresh: 237/243 deterministic + 7/7 Layer-7 carried) |
| Assertions weakened anywhere | **NO** — each correction is identical-intent, stronger, or more conservative; three new assertions added |

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**
