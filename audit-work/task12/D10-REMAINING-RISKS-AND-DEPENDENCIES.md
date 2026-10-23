# MTQΣ — TASK 12 · D10: REMAINING RISKS & DEPENDENCIES

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

Concise, current, evidence-backed. "Contained only by" names the single
mechanism that actually closes the row — never documentation.

---

## A. Open risks (ordered by severity; testnet-scaled)

| # | Risk | Status after Task 12 | Severity | Contained only by |
|---|---|---|---|---|
| R-1 | **C-045-a EVM key** — full estate control: roles ×15, both 1/1 Safes, gen-A ownership, ~100% supplies, natives (fresh @ Monad 73,243,944 / Arc 68,520,264: UNCHANGED) | worktree purged; **history still contaminated (all commits)**; key fully privileged | **CRITICAL** | D4 package execution through D8 approvals + D9 verification |
| R-2 | **C-045-b Solana key** — superseded mint mint+freeze authority, full old supply in ATA, **4.98 SOL drainable** (fresh @ slot 513,885,476: UNCHANGED) | worktree purged (incl. the MISSED base58 copy — census corrected); history contaminated; key fully privileged | **CRITICAL** | D5 package (T-4.4 evacuate → T-4.3/4.5 revoke) + D8 |
| R-3 | **Session-transcript disclosure (PI-3)** — EVM literal emitted once into an AI-session terminal (Task 11); retention/access owner-side | stands; no new emission in Task 12 (all tooling value-redacted) | HIGH (adds reader surface to R-1) | nothing audit-side — accelerates R-1/R-2 rotation |
| R-4 | **Remote/CI/backup/clone spread** — existence UNVERIFIED (no local remote ≠ absence; 6 GH workflows imply GitHub intent) | unchanged | HIGH if remote exists | OWNER-ATT-1 → D3 §3 step 7 credential rotation |
| R-5 | **DbFjz current-mint authority** — single key, full u64-max supply, custody outside repo (9.995 SOL fresh) | unchanged | HIGH | CKPT-2 attestation + SOL-DEC-1 |
| R-6 | **Current-mint structural non-conformance** — decimals 18 vs u64 ceiling (mandated 1M supply physically unrepresentable; 10B plan arithmetically reverts) | unchanged; `solana-create-fresh.ts` neutralized as fail-closed stub | MEDIUM (functional) | DEC-3 economic decision (+ S-4 if redeploy) |
| R-7 | **Governor pair unassessed** — same hex, two builds; proposer/executor UNESTABLISHABLE without source | unchanged; no interaction planned (correctly) | MEDIUM-HIGH | N-01 source publication → audit |
| R-8 | **Monad Redeem token-MINTER grant** — unusable by the module's deployed code (call-graph-proven at recorded anchors); origin unexplained; module custom roles unprobed (E-15/16) | unchanged; finding preserved OPEN; script neutralized | LOW (hygiene) | T-3.1 revoke by Safe-B; D9 V-8 probes |
| R-9 | **1/1 Genesis Safes** — sole owner = exposed EOA (both chains, nonce 0, fresh) | unchanged | HIGH (governance) | Safe-B 4/7 (T-1.x) + old-Safe strip (T-3.2/3.3) |
| R-10 | **Squads program identity** — candidate probed NULL devnet+mainnet; nothing asserted | unchanged; `set-solana-multisig.mjs` neutralized | blocking for S-1/S-6 only | CKPT-8 owner-side verification |
| R-11 | **Canonical-proxy reference comparison + L1-variant singleton reference** | unchanged (not performed — no claim) | LOW (evidence completeness) | optional Security-Lead reference fetch |
| R-12 | **Unprobed allowance combinations / unprobed surfaces** | unchanged | LOW | scope discipline + D9 re-census |
| R-13 *(new)* | **Handover-window race** — between Safe-B deploy and deployer strip, the exposed key remains fully privileged | disclosed (D4 §4); no on-chain mitigation exists | inherent to migration | tight batch (a) / pause (b) / accept (c) — owner choice T12-6 |
| R-14 *(new)* | **Keeper-guard bypass by future fork** — the guard lives in the keeper's code path; a modified keeper could omit it | documented (D7 §5); code-review + CI integrity checks | LOW while no remote CI | D9 C-4 on every keeper change |
| R-15 *(new)* | **CI enforcement not yet exercised on a real runner** — no remote exists | commands proven locally only | LOW/MEDIUM | OWNER-ATT-1 → connect remote → observe the gate run |
| R-16 *(new)* | **Pre-existing unstaged file-mode changes in the working tree** (80 files, 0 insertions/0 deletions) — cosmetic, preserved untouched | verified content-identical to HEAD | LOW | none (informational) |

## B. Dependency graph (execution order — unchanged in shape; Task 12 adds tooling prerequisites)

```
[DONE K-1] worktree purge + scanner + hooks + CI config + release controls (this package)
   │
   ├─ OWNER-ATT-1 (remote?) ──► T-0.4 credential rotation (conditional)
   ├─ T-1.1 signer ceremony ─► T-1.2/T-1.3 Safe-B deploys ─► T-1.4 QUORUM PROOF (hard gate)
   │        └► Phase 2 grants (EXPOSED-KEY session) ─► Phase 3 revokes (Safe-B; T-3.6/3.7 LAST)
   │                 └► T-3.8 evacuation (per-destination probe-verified)
   ├─ Solana: CKPT-2 ─► SOL-DEC-1; CKPT-8 ─► (if S-1/S-6) T-4.1
   │        └► T-4.4 evacuate SOL (with/before) ─► T-4.3/T-4.5 revoke (EXPOSED-KEY session)
   ├─ D3 history rewrite (owner + security lead) — parallel; NOT a prerequisite for chain phases
   └─ ALL ─► D9 independent verification ─► only then any "contained" language
```

**Both failure modes remain forbidden**: (a) treating housekeeping (K-1/D3) as
containment or letting it delay rotation; (b) revoking the only working admin
path before the destination is verified (T-1.4 → grants → last-revokes).

## C. What Task 12 deliberately did NOT do

- No key rotation, no on-chain change of any kind (both keys remain fully privileged — verified live).
- No git-history rewrite (plan only — D3), no remote actions (none reachable).
- No canonical selection (governance-reserved), no tokenomics/decimals change.
- No release-gate advancement — all 8 controls remain NOT_GRANTED; test/typecheck/lint/UI results advance nothing.
- No handling, printing, or re-derivation of key material anywhere in this cycle.

## D. Immediate owner decision queue (smallest set that moves containment)

1. OWNER-ATT-1 (remote existence) — gates credential rotation + D3 blast radius.
2. CKPT-2 (DbFjz custody) — gates the current mint's posture.
3. CKPT-3/4 (signer ceremony convening) — the longest-lead item on the EVM path.
4. T12-8/T-4.4 (SOL evacuation) — the 4saT 4.98 SOL is the cheapest live value to protect.
5. D3 approval — every day of history retention is a day the literals are one `git log -p` away from any repo reader.

**Release status: NOT ACCEPTED. Completion of Task 12 does not mean the keys
have been rotated; it means the software side is contained, the controls are
tested, and the migration packages are execution-ready pending human approvals.**
