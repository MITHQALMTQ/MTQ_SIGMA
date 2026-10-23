# MTQΣ — TASK 11.1 · OPEN-RISK & APPROVAL-DEPENDENCY MATRIX (concise)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED**

Companion to `CORRECTIONS-REGISTER.md` (detail) and `TASK11-1-FINAL-REVIEW.md` (narrative).
Risk = live while the row stays OPEN. **Nothing in this matrix is executed or authorized.**

## A. Open risks (current, evidence-backed)

| # | Risk | Evidence status | Severity (testnet) | Contained only by |
|---|---|---|---|---|
| R-1 | **EVM deployer key (C-045-a)** — full estate control on Monad/Arc/RH: roles ×15 AC contracts, both 1/1 Safes, gen-A ownership, ~100% supplies, natives | CONFIRMED REAL · worktree 2 files · 25/25 commits | CRITICAL | D3/D5 Phase 1→3 rotation, D8-verified |
| R-2 | **Solana superseded-mint key (C-045-b)** — mint+freeze authority, full old supply in ATA, 4.98 SOL drainable | CONFIRMED REAL · 6 files · 25/25 commits | CRITICAL | D4/D5 T-4.3/4.4/4.5 |
| R-3 | **Session-transcript disclosure (PI-3)** — EVM literal emitted once; retention/access owner-side | CONFIRMED DISCLOSURE [C11.1-01] | HIGH (adds reader surface to R-1) | nothing audit-side; folded into R-1's clock — rotate sooner |
| R-4 | **Remote/CI/backup/clone spread** — existence unknown | UNVERIFIED [C11.1-04] | HIGH if remote exists | CKPT-1 attestation → T-0.4 rotation; hygiene never revokes keys |
| R-5 | **DbFjz current-mint authority** — single key, full u64-max supply, custody outside repo | UNVERIFIED (CKPT-2) | HIGH | CKPT-2 + SOL-DEC-1 (S-1/S-3/S-4) |
| R-6 | **Current-mint structural non-conformance** — decimals 18 vs u64 ceiling (mandate unrepresentable) | CONFIRMED (recorded) | MEDIUM (functional) | DEC-3 economic decision (≤9 = option requiring approval) |
| R-7 | **Governor pair unassessed** — same hex, two builds, proposer/executor unknown (N-01) | UNESTABLISHABLE | MEDIUM-HIGH | publish sources → audit; no interaction until then |
| R-8 | **Redeem-module token-MINTER grant** — unusable by the module's deployed code | **PROVEN unusable at bytecode level [C11.1-02]**; grant origin unexplained; custom module roles unprobed (E-15/16) | LOW (hygiene) | T-3.1 revoke by Safe-B; D8 cells close the bookkeeping |
| R-9 | **1/1 Genesis Safes** — sole owner = exposed EOA | CONFIRMED; singleton genuine ≠ governance safe [C11.1-03] | HIGH (governance) | Safe-B 4/7 (T-1.x) + old-Safe strip (T-3.2/3.3) |
| R-10 | **Squads program identity** — candidate probed NULL; nothing asserted | UNVERIFIED | blocking for S-1/S-6 only | owner verification from official docs (CKPT-8) |
| R-11 | **Canonical-proxy reference comparison** for the 171-B proxy runtime; L1-variant Safe singleton reference | NOT PERFORMED / empty-code probe [C11.1-03] | LOW (evidence completeness) | optional Security-Lead fetch of canonical references |
| R-12 | **Unprobed allowance combinations / unprobed surfaces generally** | UNVERIFIED by definition | LOW | scope language enforced [C11.1-04]; D8 re-census |

## B. Approval-dependency matrix (execution cannot start before the named humans say yes)

| Step (D5) | Risk closed | Hard prerequisites | Approver(s) | Notes |
|---|---|---|---|---|
| T-0.1/T-0.2 purge | R-1/R-2 spread only | CKPT-0 | Owner | hygiene — **does not revoke keys; must not delay chain phases [C11.1-05]** |
| T-0.3 history rewrite | spread reduction | T-0.1/2 + CKPT-0 | Owner + Security Lead | unfalsifiable for adversary copies |
| T-0.4 credential rotation | R-4 | **CKPT-1 = Y/unknown** | Owner + Security Lead | skip only with signed N-attestation |
| T-1.1 signer ceremony | — | CKPT-3/4 | Owner (convener) | parallel to Phase 0 |
| T-1.2–T-1.4 Safe-B + quorum proof | R-9 destination | T-1.1 | Security Lead verifies | **hard gate before any grant** |
| T-2.1–2.7 grants | opens handover window | CKPT-5/6 | Owner + Committee (+ Econ for ECON-DEC-2 rows) | window disclosed (D3 §4.2) |
| T-3.1 Redeem-MINTER revoke | R-8 | T-2.1 verified | Committee | hygiene |
| T-3.2–T-3.5 strips | R-9 partial | respective grants verified | Committee | verify-after-each |
| **T-3.6/T-3.7 LAST revokes** | **R-1** | all prior verified + **CKPT-7** | Owner + Committee | irreversible by design |
| T-3.8 evacuation | asset exposure | T-3.6/7 + CKPT-7 destinations | Owner | probe-verify destinations |
| T-4.1 Squads provisioning | R-10 (if S-1/S-6) | CKPT-8 identity verification | Owner | program ID from official docs only |
| T-4.2 current-mint authority | R-5 | CKPT-2 + CKPT-8 (SOL-DEC-1; DEC-3 if S-4) | Owner + Economic Authority | decimals = economic approval |
| T-4.3/T-4.5 old-mint revokes | **R-2** | **CKPT-7** (T-0.x NOT a prerequisite [C11.1-05]) | Owner | exposed-key signing session — D4 §4 |
| T-4.4 SOL evacuation | R-2 funds | — (with/before T-4.3) | Owner | urgent — drainable by any repo holder |
| D8 verification (incl. E-15/16/17) | proves all | every executed step | **Independent Reviewer** | before any "contained" language |
| K-7 address book | documentation | D8 pass | Owner | Tier-1/Tier-2 updates |
| DEC-1…DEC-7 | R-6 + canonical items | CKPT-9/10 | Committee (+ Economic Authority where flagged) | reserved to constituted governance |

## C. Standing rules

1. **Sequence is law** — no row runs before its prerequisites are probe-verified on-chain.
2. **Hygiene ≠ containment** — repo work never substitutes for rotation and never gates it.
3. **Never revoke the only working admin path** before the destination is verified (T-1.4 →
   grants → last-revokes invariant).
4. **No bundling** — rotation steps never mix with genesis/custody/supply/canonical work.
5. **Language discipline** — no "contained/rotated/revoked" wording before CKPT-9 sign-off.
6. **No gate advancement** from documentation corrections, typechecking, linting, or UI
   tests (Task 11.1 §7).
7. **UNVERIFIED ≠ negative** — failed or unmade queries are never treated as clean results.
