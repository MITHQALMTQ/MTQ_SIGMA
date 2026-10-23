# MTQΣ — TASK 11 · D5: TRANSACTION REGISTER (ordered, unsigned proposals)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

**Every row in this register is: PROPOSED — NOT SIGNED — NOT EXECUTED.**
Nothing below has been constructed into a transaction, signed by anyone, or broadcast to
any network. This register exists so the owner can review, amend, and — only after the
D7 approvals — authorize execution in a human-controlled process.

Conventions:
- `⟨…⟩` = placeholder to be bound by the owner at provisioning time. **No identity is invented here.**
- Role hashes: ADMIN `0x0000…0000` · MINTER `0x9f2df0fe…956a6` · PAUSER `0x65d7a28e…862a`.
- "Signer: EXPOSED-KEY" marks the unavoidable-handover rows (D3 §4.2 / D4 §4). The
  exposed key must be loaded **only** in an owner-controlled session, never in this repo
  or any AI environment.
- Calldata is expressed as `selector@target(args)` — reviewable ABI form. Byte-exact
  encoding is produced at execution time by the owner's tooling and re-verified against
  these arguments before signing.
- EVM testnet gas is free but requires native balance; Solana devnet fees ≈ 5,000
  lamports/tx + rent for new accounts.

---

## Phase 0 — Repository containment (no chain transactions) — **[C11.1-05] recommended-first PARALLEL hygiene track**

**[C11.1-05 — reclassified (was: "prerequisites for everything"):** these steps stop the
**ongoing spread** of the literals and protect future credentials — they **do not reduce
the on-chain authority exposure of either compromised key by anything**, and therefore
must NOT delay or gate the chain phases. The only hard prerequisites for chain actions
remain the D7 checkpoints and the T-1.4-style destination verification. Phase 0 may run
before, during, or after Phases 1–4; it is recommended FIRST (stops fresh copies) but is
**not a blocker.** Repo housekeeping is hygiene, not revocation — a deleted key file still
signs transactions (D2 §1.4).]

| ID | Action | Kind | Depends | Precondition | Postcondition / acceptance | Approver |
|---|---|---|---|---|---|---|
| **T-0.1** | Purge both literals from the 7 script files (replace with env-var loader `process.env.MTQ_*` and a documented manual step) | REPO | — | none | `forensics-census-task11.ts` re-run: worktree EVM hits = 0, SOL hits = 0 | Owner |
| **T-0.2** | Replace the `worklog.md` plaintext quote with an **append-only redaction notice** (never silent deletion — audit trail preserved) | REPO | — | none | worklog contains notice; census re-run clean; no history rewritten at this step | Owner |
| **T-0.3** | History rewrite: `git filter-repo` (or BFG) stripping both literals from **all 25 commits**; expire reflogs + `git gc --prune=now --aggressive`; every existing clone/backup declared void by owner notice | REPO | T-0.1, T-0.2 | owner coordinates with all clone holders | fresh-clone + full-history scan clean (`git log -S` / grep per commit) | Owner + Security Lead |
| **T-0.4** | Credential rotation (CONDITIONAL — only if T-ATT-1 attests any remote ever existed): rotate `TURSO_AUTH_TOKEN`, `TURSO_DATABASE_URL` creds, `FRED_API_KEY`, `DISCORD_WEBHOOK`, `KEEPER_URL`, any platform PAT that touched the repo; invalidate all Actions caches/artifacts/releases | CRED | T-ATT-1 | remote-existence attestation first | rotation log; old credentials confirmed dead | Owner + Security Lead |
| **T-0.5** | Post-purge census re-run + fresh-clone verification (D8 §1) | REPO | T-0.3 (± T-0.4) | — | D8 repo tests all green | Security Lead |

**Step-class taxonomy [C11.1-05]:**

| Class | Steps | Effect | Explicitly NOT an effect |
|---|---|---|---|
| Hygiene (reduces ongoing spread) | T-0.1–T-0.5 | stops fresh copies; protects future secrets | does NOT revoke either key; does NOT change any on-chain privilege |
| New-governance establishment | T-1.1–T-1.4 (+T-4.1) | creates + **verifies** the destination authority | does NOT de-expose until Phase 2/3 execute |
| True de-exposure (the only containment) | Phase 2 grants → Phase 3 revokes (T-3.6/T-3.7 LAST) → T-3.8; T-4.3/T-4.4/T-4.5 | removes the compromised keys' on-chain authority; drains reachable value | cannot precede destination verification (T-1.4 hard gate) |

**Both failure modes are forbidden (re-stated):** (a) treating housekeeping as containment
(extends the exposure window — housekeeping must never block or delay the chain phases);
(b) revoking the only working administrative path before the destination authority is
verified (T-1.4 → grants → last-revokes invariant is law).

## Phase 1 — EVM destination provisioning (human-controlled ceremony; no estate change)

| ID | Action | Chain | Depends | Precondition | Postcondition / acceptance | Signer | Fees | Failure modes → recovery |
|---|---|---|---|---|---|---|---|---|
| **T-1.1** | Provision 7 independent committee signers `⟨OWNER-1..7⟩` per D3 §3 (hardware/air-gapped, outside repo/AI; custodian + recovery register) | off-chain | **[C11.1-05]** none hard — may proceed in parallel with Phase 0 (no dependency on repo state); T-0.x recommended first but not blocking | D3 §3 reqs 1–4 approved | 7 addresses recorded in owner's private register; independence attested | n/a | n/a | custodian loss <3 → survivable; ≥3 → Safe-B frozen (documented, owner-accepted) |
| **T-1.2** | Deploy **Safe-B(Monad)**: `createProxyWithNonce(singleton=0x29fcB43b…C762, salt)` @ SafeProxyFactory `⟨FACTORY⟩`, then `setup(owners=[⟨OWNER-1..7⟩], threshold=4, to=0, data=0x, fallbackHandler=⟨per policy⟩, paymentToken=0, payment=0, paymentReceiver=0)` | Monad | T-1.1 | ceremony env; factory funded | `getOwners()==7 declared` · `getThreshold()==4` · `nonce()==0` · `VERSION()=="1.4.1"` · singleton slot == canonical (byte-anchored vs `identity-anchors-task11.json`) · modules empty · guard/fallback per policy | ⟨NEW-ROTATION-EOA⟩ (owner-side, funded) | gas only | wrong salt → different address (re-deploy); wrong setup → deploy anew (no estate touched yet — **zero blast radius**) |
| **T-1.3** | Deploy **Safe-B(Arc)** — same as T-1.2 | Arc | T-1.1 | same | same | ⟨NEW-ROTATION-EOA⟩ | gas only | same |
| **T-1.4** | **Quorum proof (hard gate):** Safe-B executes one no-op/low-risk `execTransaction` (e.g., `VERSION()` call or dust self-transfer) with exactly 4 signatures | both | T-1.2/3 | dossier checks pass | nonce incremented by 1; event log proves 4-sig execution; 7-sig NOT required for ops | 4 of ⟨OWNER-1..7⟩ | gas | quorum fails → DO NOT proceed to Phase 2; diagnose custody/signing first |
| **T-1.5** | (OPTIONAL, owner decision) pause-window policy: pause both MTQs during Phase 2→3 to block transfers during handover | both | — | disclosed tradeoff: requires EXPOSED-KEY signature (PAUSER); blocks pilot mint/redeem for the window | both tokens `paused()==true` for the window; unpause by Safe-B after T-3.6/7 | EXPOSED-KEY (if chosen) | gas | unpause forgotten → pilot frozen (Safe-B holds PAUSER post-grant and can unpause) |

## Phase 2 — EVM grants (grant-before-revoke; signed by the current admin = exposed key — the unavoidable handover window D3 §4.2)

All rows: Signer **EXPOSED-KEY** (owner-controlled session) · fees gas-only ·
precondition T-1.4 passed (destination proven) · postcondition verified by fresh
`hasRole` probe BEFORE the next row executes.

| ID | Call (reviewable form) | Chain | Postcondition | Failure → recovery |
|---|---|---|---|---|
| **T-2.1** | `grantRole(ADMIN, ⟨SAFE-B_M⟩)` + `grantRole(MINTER, ⟨SAFE-B_M⟩)` + `grantRole(PAUSER, ⟨SAFE-B_M⟩)` @ MTQ `0x9e6E…53aD` (3 txs) | Monad | hasRole ×3 == true for Safe-B | grant reverts → no state change, retry; **estate still admin-complete (safe)** |
| **T-2.2** | `grantRole(ADMIN, ⟨SAFE-B_M⟩)` @ Algorithm / Reserve / Mint / Redeem / Oracle / Takaful (6 txs) | Monad | 6× hasRole true | same |
| **T-2.3** | `grantRole(MINTER, ⟨SAFE-B_M⟩)` @ Mint module `0x197e…0809` | Monad | hasRole true | same |
| **T-2.4** | **CONDITIONAL (ECON-DEC-2):** `grantRole(MINTER, ⟨SAFE-B_M⟩)` @ Reserve module `0x1bbC…6177` — only if Reserve is intended to mint | Monad | hasRole true | same |
| **T-2.5** | `grantRole(ADMIN, ⟨SAFE-B_A⟩)` + `grantRole(MINTER, ⟨SAFE-B_A⟩)` + `grantRole(PAUSER, ⟨SAFE-B_A⟩)` @ MTQ `0x237c…6601` (3 txs) | Arc | ×3 true | same |
| **T-2.6** | `grantRole(ADMIN, ⟨SAFE-B_A⟩)` @ the 6 Arc modules (6 txs) | Arc | 6× true | same |
| **T-2.7** | `grantRole(MINTER, ⟨SAFE-B_A⟩)` @ Arc Mint module `0x0dd8…c3aa` | Arc | true | same |

**Invariant after Phase 2:** every surface has ≥2 admins (exposed key + Safe-B). The
estate is admin-REDUNDANT — failure of any single step never leaves it admin-less.

## Phase 3 — EVM revocations + evacuation (signed by Safe-B 4-of-7 unless noted; this is the actual de-exposure)

| ID | Call | Chain | Signer | Depends | Postcondition | Failure → recovery |
|---|---|---|---|---|---|---|
| **T-3.1** | `revokeRole(MINTER, 0x9632…35a4)` @ Monad MTQ — **the Redeem anomaly (CORR-6: dormant; hygiene)** | Monad | Safe-B | T-2.1 | hasRole(MINTER, Redeem)==false | revert → retry; no admin loss |
| **T-3.2** | `revokeRole(ADMIN/MINTER/PAUSER, 0xE718…A7D0)` @ Monad MTQ (3 txs) — strip the old 1/1 Safe | Monad | Safe-B | T-2.1 | old Safe ×3 false | same |
| **T-3.3** | `revokeRole(PAUSER, 0xE718…A7D0)` @ Arc MTQ | Arc | Safe-B | T-2.5 | false | same |
| **T-3.4** | `revokeRole(ADMIN, 0x3C39…d8c)` @ the 6 Monad modules (6 txs) | Monad | Safe-B | T-2.2 | deployer module-ADMIN false ×6 | **ordering guard:** execute only after T-2.2 verified; if done early, Safe-B still admin → recoverable by re-grant |
| **T-3.5** | `revokeRole(ADMIN, 0x3C39…d8c)` @ the 6 Arc modules (6 txs) | Arc | Safe-B | T-2.6 | false ×6 | same |
| **T-3.6** | **LAST ON MONAD:** `revokeRole(ADMIN, 0x3C39…d8c)` + `revokeRole(MINTER, …)` + `revokeRole(PAUSER, …)` @ Monad MTQ (3 txs) — the de-exposure moment | Monad | Safe-B | T-3.1–T-3.4 all verified | deployer roles FALSE ×3; only Safe-B (+wired modules) remain | **unrecoverable-by-design** once done (that is the point); D8 must run immediately after |
| **T-3.7** | **LAST ON ARC:** same ×3 @ Arc MTQ | Arc | Safe-B | T-3.5 | same | same |
| **T-3.8** | **Asset & native evacuation (OWNER DECISION REQUIRED — what to move where):** candidate inventory = Monad 309.94899999999999999997 MTQ + 0.224343224 MON; Arc 998.999…997 MTQ + 19.026597151851474173 native; RH 1,000,999.999999999999997 "MTQΣ" + native 0x22e44b0d00d200; gen-A family self-custodied 1M ×3 + gen-B balances (also: **transferOwnership(⟨dest⟩)** on gen-A Ownable tokens, or accept-provenance per D6). Destination options: Safe-B (chain-matched), burn-to-dead, or leave-in-place with documented acceptance. **Default proposal: move current-estate MTQ balances to the chain's Safe-B via `transfer` after T-3.6/7; natives fund committee ops keys; generations follow the D6 disposition.** | all 3 | Safe-B / deployer per row | T-3.6/7 | balances at declared destinations; deployer balances per decision (0 if evacuated) | transfer reverts (paused?) → unpause first; wrong destination → **irreversible** — destination must be probe-verified before each transfer |

## Phase 4 — Solana authority & asset settlement (independent of EVM phases)

| ID | Call | Chain | Signer | Depends | Precondition | Postcondition | Fees | Failure → recovery |
|---|---|---|---|---|---|---|---|---|
| **T-4.1** | **CONDITIONAL (S-1/S-6 route):** provision Squads 2-of-3 multisig per D4 §3 (owner ceremony; program ID from official docs — **currently UNVERIFIED, none asserted**); verify members/threshold via `getAccountInfo` + one dust-SOL test transaction | Solana devnet | ⟨SQUADS-SIGNER-1..3⟩ | — | program identity owner-verified | multisig address recorded + proven working | rent + fees (<0.05 SOL) | wrong program → **stop**; nothing transferred yet |
| **T-4.2** | **CURRENT mint decision (SOL-DEC-1):** `SetAuthority(GAGRdrY6…, MintTokens, newAuthority=⟨SQUADS-MSIG⟩ | None)` | Solana | DbFjz key (owner-side; NOT in repo) | T-4.1 if S-1 | S-decision recorded | `getAccountInfo(jsonParsed).mintAuthority == chosen` | ~5k lamports | wrong authority bytes → program error, retry; transfer to bad address → **unrecoverable** (verification gate) |
| **T-4.3** | `SetAuthority(2EaK5cQt…, MintTokens, None)` — kill the exposed mint path | Solana | **EXPOSED-KEY (4saT)** — D4 §4 caveat | **[C11.1-05 — dependency corrected]** CKPT-7 approval; repo housekeeping (T-0.x) is **NOT** a prerequisite — waiting for it only extends the window in which any repo holder can mint/freeze the old mint; proceeding promptly after CKPT-7 is the recommended default (owner may still sequence differently as a recorded risk-tolerance decision) | owner-controlled signing session | superseded `mintAuthority == null` | ~5k lamports | revert → retry; **permanent once done (intended)** |
| **T-4.4** | Evacuate 4saT balance: `SystemProgram.transfer(4saT → ⟨DEST-SOL⟩, 4.98368596 SOL − fee)` | Solana | **EXPOSED-KEY** | — | do **with or before** T-4.3 (authority-dead wallet still drainable by any repo holder) | 4saT balance ≈ 0 (fee dust) | fee | partial-balance leftover → repeat |
| **T-4.5** | `SetAuthority(2EaK5cQt…, FreezeAccount, None)` | Solana | **EXPOSED-KEY** | T-4.3 | — | superseded `freezeAuthority == null` | ~5k lamports | revert → retry; permanent (intended) |
| **T-4.6** | Tier-2 annotation of both mints in the address book (K-7 documentation; superseded marked RETIRED-AUTHORITY-REVOKED once T-4.3/4.5 executed) | DOC | — | T-4.3/4.5 | — | address book updated | — | — |

**DbFjz hygiene (owner action, no register row needed beyond this note):** after T-4.2 the
DbFjz key's remaining power is its SOL + (if S-3 chosen) the mint authority. If S-3
(leave-pending) is chosen, DbFjz custody attestation (D2 §6/K-5) becomes the ONLY control
on the current mint — record that acceptance explicitly.

## Phase 5 — Independent post-remediation verification (D8)

No register rows: the entire phase is the D8 test suite, executed by a party that did not
run the migration, with fresh RPC anchors and hashed transport, and reported BEFORE any
"contained/rotated/revoked" language is used anywhere.

---

## Dependency graph (compact)

```
T-0.1 → T-0.2 → T-0.3 → (T-0.4 if remote) → T-0.5
T-1.1 → T-1.2/T-1.3 → T-1.4 ──┐
                              ├→ T-2.1..2.7 (grants, EXPOSED-KEY) ─→ T-3.1..3.5 (Safe-B revokes)
                              │        → T-3.6/T-3.7 (LAST de-exposure) → T-3.8 (evacuation)
T-4.1 → T-4.2 (DbFjz)          ┤
T-4.3/T-4.4/T-4.5 (EXPOSED-KEY, independent) → T-4.6
ALL → D8 verification → only then: any "contained" claim
```

## Global failure-mode rules (apply to every row)

1. **Never sign with the exposed key inside this repository, this sandbox, or any AI
   environment** — owner-controlled session only (D2/D4 caveats).
2. **Verify-after-every-step**: each row's postcondition is probed read-only before the
   next row; a failed probe halts the sequence (estate stays admin-redundant by design
   until the LAST revoke).
3. **Reverts are retried, never "assumed"**: a failed probe is FAILED-UNVERIFIED, not a
   negative result (Task 11 §3 rule).
4. **Irreversibility inventory**: T-3.6/T-3.7 (role loss by design), T-4.3/T-4.5
   (permanent revocation by design), T-3.8/T-4.4 (transfers), T-4.2-S-2 (permanent
   freeze of current mint). Each is separately owner-acknowledged in D7.
5. **No bundling with non-rotation goals**: genesis/custody corrections, canonical-family
   migration, Solana redeploy (S-4) are separate plans (D6/D9) — never mixed into a
   handover batch.
