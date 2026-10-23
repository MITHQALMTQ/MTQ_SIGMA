# MTQΣ — TASK 12 · D8: OWNER-APPROVAL CHECKLIST

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

Every decision below is pending. **A general instruction to "continue working"
authorizes NONE of these.** Each approval must name the exact chain, target,
action, amount (where relevant), authority, destination, expected
postconditions, and reviewers (Task 12 §10). Carried checkpoint IDs keep
continuity with Task 11 D7; T12-* items are new in this cycle.

---

## A. Baseline acceptance

| # | Decision | Needed to unlock | Approver(s) |
|---|---|---|---|
| **CKPT-0** | Accept the Task 11 package (as corrected by Task 11.1) AND this Task 12 package (implementation + migration packages + release controls) as the remediation baseline | All Phase-0/1+ work below | Owner |
| **T12-0** | Accept the **census correction**: a 7th worktree copy of C-045-b existed in base58 form (`verify-sol-key2.ts`), found and purged by the Task 12 scanner — prior "base58 secrets: none" claims are superseded | Record integrity | Owner + Security Lead |

## B. Exposure-surface closure (repository & external)

| # | Decision | Detail | Approver(s) |
|---|---|---|---|
| **CKPT-1 / OWNER-ATT-1** | **Remote-existence attestation**: does ANY hosted repo, CI system, Turso database, backup, or external clone of this repository exist (or has ever existed)? | Unlocks T-0.4 credential rotation (mandatory if Y/unknown); determines D3 blast radius | Owner (attestation) |
| **T12-1** | Approve the **git-history rewrite** (D3 plan: filter-repo/BFG strip of all encodings of both literals, reflog expiry, re-clone, verification) | Post-worktree purge; reduces ongoing spread; NEVER treated as key revocation | Owner + Security Lead |
| **T12-2** | Declare **all pre-rewrite clones/backup snapshots void** and coordinate re-clones | Part of D3 §2 | Owner (convener) |
| **T12-3** | If OWNER-ATT-1 is Y/unknown: approve **credential rotation set** (TURSO_AUTH_TOKEN, TURSO_DATABASE_URL creds, FRED_API_KEY, DISCORD_WEBHOOK, KEEPER_URL, platform PATs) + Actions cache/artifact invalidation | D3 §3 step 7 | Owner + Security Lead |
| **T12-4** | Acknowledge the **session-transcript disclosure (PI-3)** stands (retention/access outside this audit's control) and fold it into the rotation-urgency decision | Posture | Owner |

## C. EVM authority migration (D4 package)

| # | Decision | Unlocks | Approver(s) |
|---|---|---|---|
| **CKPT-3/4** | Signer provisioning plan + committee constitution: approve the 7-custodian independence/custody/recovery requirements and the actual **⟨OWNER-1..7⟩ public addresses** once generated in the human ceremony | T-1.2/T-1.3 deployment args | Owner (convener) + Security Lead |
| **T12-5** | Select the **SafeProxyFactory ⟨FACTORY⟩ deployment per chain** and the fallback-handler/guard policy for Safe-B | exact T-1.2/T-1.3 calldata | Security Lead |
| **CKPT-5/6** | Approve the **Safe-B dossiers + quorum proofs** (T-1.4 hard-gate outputs) and the **exact grant set** (D4 §3 Phase 2 rows, incl. Arc normalization + ECON-DEC-2 ±Reserve-MINTER) | Phase 2 grants (the handover window opens) | Owner + Committee (+ Economic authority for ECON-DEC-2) |
| **T12-6 (with CKPT-5/6)** | Choose the **handover-window policy**: tight batch (a) / pause-window T-1.5 (b) / accept-the-window (c) — all imperfect; window is disclosed as unavoidable | Execution style | Owner |
| **CKPT-7** | Approve the **revoke set + irreversibility inventory** (T-3.1…T-3.7 are permanent for the exposed key's authority) AND the **T-3.8 evacuation destinations** (per-asset: Safe-B / burn / leave-in-place; gen-A transferOwnership vs accept-provenance) | Phase 3 revocations + evacuation | Owner + Committee |
| **T12-7** | OPS-DEC-1: whether a separate operational mint key holds module-MINTER under Safe-B admin (default: MINTER on Safe-B only) | End-state policy | Owner + Committee |
| — | Governor sources (N-01): publish the two Governance builds' sources for audit | Closure of bypass pathway D4 §5.1 | Owner |

## D. Solana containment (D5 package)

| # | Decision | Unlocks | Approver(s) |
|---|---|---|---|
| **CKPT-2 / OWNER-ATT-2** | **DbFjz custody attestation** (the current-mint authority key was never in the repo; where is it and who controls it?) | SOL-DEC-1 posture | Owner |
| **CKPT-8** | **Squads program identity**: take the program ID + version from official docs and verify live on devnet (the prior NULL probe asserted nothing) | T-4.1 (if S-1/S-6) | Owner (owner-side verification) |
| **T12-8** | Acknowledge T-4.4 urgency: the 4saT wallet's **4.98 SOL is drainable by any repo holder** — approve evacuating it with/before the revocations | T-4.4 | Owner |
| **CKPT-7 (Solana part)** | Approve the **S-5 revocation set** (superseded mint mint+freeze authorities → None; permanent) + evacuation destination | T-4.3/T-4.5 | Owner |
| **SOL-DEC-1** | Current-mint disposition: **S-1** transfer to multisig / **S-2** revoke / **S-3** leave-pending (single-key chokepoint + CKPT-2 as the only control — acceptance must be recorded) / **S-4** redeploy conformant | T-4.2 (and S-4 planning if chosen) | Owner (+ Economic authority if S-4) |
| **DEC-3 (ECONOMIC)** | **Decimals decision** — an OPTION requiring economic approval (u64 table, D5 §2); prerequisites to any fresh mint; NO silent ≤9 selection; no test-driven tokenomics change | S-4 only | Owner + Economic Authority |

## E. Canonical architecture (D6)

| # | Decision | Unlocks | Approver(s) |
|---|---|---|---|
| **DEC-1…DEC-7** | Canonical selection (which generation, or none), disposition of gen-A/B/C + RH rows, cross-chain conflict resolutions (RH Takaful==Monad Reserve hex; RH MockUSDC==Arc Oracle hex; Safe/Governance same-hex rows) | authoritative address book (Tier-1) | Constituted governance (+ Economic authority where flagged) |
| **T12-9** | Approve the address-book validation as the standing inventory tool (findings surfaced, ok=false honest state) | Adoption | Owner |

## F. Release-control advancement (only after the above)

| # | Decision | Approver(s) |
|---|---|---|
| Software-tests control grant | record the passing suite evidence as a control grant (owner-authored authorization file) | Owner |
| Contract-verification / economic-validation grants | only with independent evidence (D9) | Owner + respective reviewers |
| Governance-approval / independent security / legal review grants | named human sign-offs | Owner + Committee + independent parties |
| **Live-pilot authorization** | enables keeper-tx-submission etc. — STILL not production | Owner + Committee |
| **Production authorization** | requires ALL prior + §25.5 gates (external audit, Sharia, legal, institutional, 30-day stress…) | Owner + Committee (7/7 class) |

## G. Independent verification (precedes any "contained" language)

| # | Decision | Approver(s) |
|---|---|---|
| **CKPT-9** | Commission the independent reviewer; scope = D9 plan (post-remediation suite + Task 12 control review: scanner efficacy, allowlist audit, release-control red-team, keeper guard re-review, redaction-marker integrity, history-rewrite verification) | Security Lead |
| **K-7** | Post-D8-verification address-book Tier-1/Tier-2 updates (superseded → RETIRED-AUTHORITY-REVOKED etc.) | Owner |

**Stop point: none of the above is granted by this package. Every execution
stage requires its explicit approval. Release status: NOT ACCEPTED.**
