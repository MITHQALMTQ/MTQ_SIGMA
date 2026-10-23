# MTQΣ — TASK 10 · D8: RELEASE-GATE REPORT (updated 2026-10-22 — status preserved)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

## Overall: **NOT ACCEPTED**

Task 10 performed containment forensics and canonical reconciliation only. **No gate advanced. No gate may
be advanced by any software result.** The seven-indicator separation is preserved verbatim; evidence strings
are updated where Task 10 changed the factual picture (corrections are additive and evidence-preserving).

| # | Release indicator | Status (unchanged) | Evidence (Task-10-updated) |
|---|---|---|---|
| 1 | Build & automated tests | **PARTIAL (software only)** | tsc 0 errors · eslint 0 · canonical-invariants suite green (prior cycle) · §23 stress items remain FAIL/pending as disclosed. Software result carries NO release authority. |
| 2 | Contract & architecture verification | **FAIL** | single-key control on both chains + Solana; **two CONFIRMED REAL exposed key literals (C-045-a/b) in repo + worklog + all 24 git commits — the admin key itself is exposed**; Safes 1/1 deployer, nonce 0; genesis custody 100% deployer EOA (current) / self-custody (gen-A/C) / single-key (Solana); **Mint↔token wiring EXISTS (Task 9 'unwired' claim corrected — governance still single-key; Monad Redeem-module MINTER anomaly)**; sources unpublished — all 18 deployed contracts lack established source identity; Governance = two different builds at one address; Monad Governance 25,819 B non-portable; non-event genesis; 3+ live token generations per chain; Solana mint structurally non-conformant (u64 ceiling at 18 decimals); Robinhood chain alive with fake-Safe row (contamination extends to a third chain) |
| 3 | Economic & quantitative validation | **NOT PERFORMED** | walk-forward not executed; 30-day coverage absent; oracle feeds unverified (OD-34); synthetic data only — disclosed live |
| 4 | Governance approval | **NOT GRANTED** | committee not constituted (OD-3); OD-1/OD-2 economic eligibility decisions OPEN |
| 5 | Independent security / legal / Sharia review | **ABSENT** | none exists; none is claimed anywhere |
| 6 | Live-pilot authorization | **NOT AUTHORIZED** | economic eligibility disabled; shadow mode enforced at every execution boundary; keeper inert — correct posture until gates 2–5 pass |
| 7 | Production authorization | **NOT AUTHORIZED** | G0–G7 not-passed per mandate register; §25.1 posture enforced app-wide |

## Conditional-acceptance path (unchanged shape, updated preconditions)

**K-1/K-2 (purge + history rewrite + credential rotation) → K-3/K-4 (key rotations behind re-configured
Safes/multisigs) → R-03 (C-041 canonical declaration) → R-04 (conformant genesis/custody) → N-01 (publish
sources) → N-02 re-scoped (govern the existing wiring; disposition the Redeem anomaly) → R-06 (size
remediation) → K-6 (conformant Solana decision) → full §23 program → independent reviews → constituted
committee gate run.**

Every arrow is an approved-transaction plan, not an executed action. Nothing in Task 10 moved any of them.

## Honesty statement

- Zero transactions were sent in Task 10 (all probes read-only; forensics offline).
- No key material was published, placed in new configuration, or used for anything.
- Task 9's incorrect "not wired" conclusion was corrected evidence-preservingly (CORR-1) — the correction
  NARROWS the remediation scope (N-02) but does NOT improve any gate: gate 2 remains FAIL for the governance
  and exposure reasons stated above.
- All prior adverse findings (C-041…C-049, OD-1…OD-37, T-87 demonstrated-failed, 9-FAIL validation set,
  honest verdicts 20-PASS/9-FAIL/1-UNVERIFIED) are re-asserted; none was downgraded or re-labeled.
- Items that could not be verified are labeled UNVERIFIED/UNESTABLISHABLE with method disclosed (squashed
  git horizon; Cloudflare-gated explorer; RPC log-scan caps; 4byte registry indicative-only; Solana RPC
  rate-limit retries logged).
