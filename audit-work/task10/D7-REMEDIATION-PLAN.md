# MTQΣ — TASK 10 · D7: TRANSACTION-FREE REMEDIATION PLAN (dependencies, risks, approvals)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

**Nothing in this plan has been executed.** Every on-chain item is a transaction plan awaiting explicit
written human approval; every repo item preserves the evidence trail (append-only corrections; no silent
deletions). Sequence matters — executing out of order can brick the estate or destroy evidence.

## Phase 0 — Containment (BLOCKING, P0; no on-chain action required)

| ID | Step | Kind | Depends on | Risks | Acceptance criteria | Approval authority |
|---|---|---|---|---|---|---|
| K-1 | Purge BOTH literals from the working tree: 7 script files; replace `worklog.md:4648` with an append-only redaction notice (never silently delete log history) | REPO | none | audit-trail loss if done silently | repo secret-scan clean (re-run `forensics-key-incident.ts` → 0 EXACT hits); worklog correction note appended | Project owner |
| K-2 | Rewrite git history (filter-repo/BFG) to strip both literals from all 24 commits; expire every remote clone/backup; rotate ALL tokens/credentials that ever touched the repo or its remotes | REPO | K-1 | invalidates clones; must be coordinated; missed remotes retain secrets | fresh clone history scan clean; credential-rotation log | Owner + security lead |
| K-3 | EVM key rotation SEQUENCE (transaction plan): fund NEW key → grant roles to NEW key (or to the re-configured Safe) → reconfigure BOTH Safes to real 4/7 (owners=7 council members, threshold 4, guard) → transfer module admin to governed paths → **last**: renounce the exposed key's roles. Never leave the estate admin-less; never sign with the exposed key | ON-CHAIN (PLAN ONLY) | K-2, R-03 decision | wrong order = brickable estate; committee must exist first (OD-3) | post-rotation probe: deployer-EOA roles FALSE everywhere, Safe threshold 4/nonce>0, new addresses recorded | Owner + constituted committee |
| K-4 | Solana rotation (transaction plan): move 4saT's 4.983686 SOL + old-mint ATA to a fresh wallet; revoke (or Squads-multisig) the 2EaK5c mint+freeze authority per the drafted `set-solana-multisig.mjs` | ON-CHAIN (PLAN ONLY) | K-2 | old mint stays mintable by the exposed key until revoked | 4saT balance 0; old-mint authority revoked/multisig on devnet; fresh wallet recorded | Owner |
| K-5 | DbFjz key hygiene: keep env-var-only; verify no remote/backup copy exists (census covered the repo only); rotate if the owner's own copies are uncertain | OWNER ACTION | K-2 | UNVERIFIED remote surfaces | owner attestation + no repo exposure (already verified) | Owner |
| K-6 | Solana conformant-redeploy decision: pick decimals ≤ 9 (or alternate representation) so mandated supplies are u64-representable; update `solana-create-fresh.ts` BEFORE it is ever run (its current 10B×10¹⁸ mint would revert) | ON-CHAIN (PLAN ONLY) | K-4, D6-8 | another non-conformant mint if executed as written | reviewed spec + corrected script + approved deploy plan | Owner + committee |
| K-7 | Adopt D2 canonical address book (three tiers) — documentation only; fixes the mis-associated rotation doc; C-041 selection reserved to governance | REPO | none | none (documentation) | merged book; rotation doc corrected; fake-Safe rows annotated | Governance (C-041) for Tier-1 selection; owner for book merge |

## Phase 1 — Architecture (after containment)

| ID | Step | Depends on | Notes |
|---|---|---|---|
| R-03 | Formal C-041 canonical-token declaration (MITHQAL vs MTQΣ families vs conformant redeploy) | K-1/K-2 | blocks everything identity-related |
| N-01 | Publish + verify deployed sources on both explorers (owner action; Monadscan is CF-gated — do it from the owner's browser) | none | unblocks D3/D4 verification, closes "UNESTABLISHABLE" rows |
| R-02 | Safe 4/7 reconfiguration (folded into K-3 sequence above) | K-3 | OD-35 closure |
| N-02 (re-scoped) | Govern the EXISTING Mint↔token wiring (grants are not needed — wiring exists); disposition the Monad Redeem-module MINTER anomaly (revoke-plan or documented justification) | R-03, committee | CORR-1 changed the scope: no blind re-grant |
| R-04 | Genesis custody per approved plan: mint/transfer the chosen canonical supply to the re-configured Safe with canonical events, or adopt a conformant redeploy | R-03 + K-3 | C-043/C-046/C-047 closure path |
| R-06 / D-4 | Contract-size remediation: reproducible ≤24,576 B build (V2/V3 and the oversized Governors), green Foundry runs, committed sources; resolve the 23,220-B unproven claim | R-03 | portability prerequisite for ANY mainnet-adjacent target |
| N-04 | Canonical genesis events on any future deployment | R-06 | App D.2 |
| R-09…R-16 | §23 quantitative program, walk-forward, real-feed oracle validation, external security/Sharia/legal reviews, shadow-acceptance, CI — unchanged from D-5/Task 9 registers | multiple | gate-relevant, non-auto-advancing |

## Release-gate interaction

No step above advances any release gate automatically. Gates 3–7 require the §23 program, constituted
governance, and independent reviews (see D8). The K-sequence is a precondition for ANY later conditional
acceptance; it is not itself an acceptance.

## What this task already performed (zero-risk only)

Read-only forensics/probes; evidence files; corrections to app surfaces (append-only wording); deliverable
documents; worklog entry. **No transaction, no role change, no asset movement, no key use, no publish.**
