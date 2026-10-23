# MTQΣ — TASK 11 · FINAL REPORT (compromised-key containment & authority-migration readiness)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

> **Task 11.1 revision note:** this report was corrected in place by the Task 11.1
> evidence-integrity review with traceable markers `[C11.1-nn]` resolving to
> `CORRECTIONS-REGISTER.md`. The pre-correction version is preserved byte-identical in
> `versions/task11-v1/TASK11-FINAL-REPORT.md`. No conclusion of substance was reversed;
> several were **narrowed, re-founded on stronger evidence, or scope-qualified** as marked.

**Project status: NOT ACCEPTED.** This task prepared a verifiable, owner-reviewable
containment package for the two reported compromised keys. It made the system **ready for
safe remediation — it did not perform remediation and does not claim containment.**

---

## Executive summary

Task 11 re-verified the entire exposure and authority picture with fresh, read-only,
request/response-hashed probes (Monad 73,193,262 · Arc 68,490,282 · Robinhood 140,634,936 ·
Solana slot 513,824,771 · Ethereum mainnet ground-truth fetch), built a per-key exposure
census (worktree, git, CI/CD, env/db/log), and produced a complete, ordered,
**PROPOSED — NOT SIGNED — NOT EXECUTED** transaction package: EVM grant-before-revoke
rotation into new per-chain 4-of-7 Safes (D3/D5), Solana mint-by-mint authority
settlement with the u64/decimals analysis and a provisioning-defined Squads option
(D4/D5), a generation-comparison decision package reserved for human governance (D6), a
named-approver checkpoint matrix (D7), and the exact post-remediation test suite (D8).

Headline facts (fresh): **both keys remain REAL and fully privileged** (re-derived
offline; identical addresses; 2 + 6 worktree files; **25/25 git commits**); on-chain
state is **cell-for-cell identical** to Task 10 — no unknown activity occurred between
audits; the Redeem-module MINTER anomaly is now **proven function-level DORMANT** (no
mint path exists in its bytecode, no proxy to add one); allowances are **all zero**
(first-time census); the Safe proxy + singleton are **byte-proven genuine** (identical to
Ethereum mainnet's canonical v1.4.1); the Governor pair remains an **unassessed authority
surface** (sources unpublished); the Solana current mint remains structurally
non-conformant (u64 ceiling at 18 decimals) and single-key custodied by DbFjz (key NOT in
repo; custody attestation required).

---

## 1. What was verified (fresh, evidence-hashed, this session)

1. **Key identities:** both literals re-derived offline → exactly the deployer EOA
   `0x3C39…d8c` (Monad+Arc+RH full estate admin) and Solana `4saT…cA1d` (superseded-mint
   mint+freeze authority, funded wallet). Fingerprints only — never reproduced.
2. **Exposure surfaces:** working tree (EVM 2 files incl. `worklog.md`; SOL 6 files),
   git (**25/25 commits contain both**), `.env`/db/dev.log/rotation-doc clean,
   `upload/private_key.txt` absent, **no git remote configured**, 6 CI/CD workflows
   inventoried (checkout+artifact patterns; TURSO/FRED/DISCORD/KEEPER/GITHUB_TOKEN secrets).
3. **EVM authority state (Monad+Arc):** 15-cell role matrices on both tokens (deployer
   TRUE×3 both chains; Safe Monad ×3 / Arc PAUSER-only; Mint module MINTER both;
   **Redeem module MINTER Monad-only**); module ADMIN matrix (deployer 12/12, Safe 0);
   role-admin = DEFAULT_ADMIN everywhere; paused=false; no cap(); EIP-1967 zero on all 18
   (no proxies); deployer nonces 103/92; natives 0.224343224 MON / 19.026597…; supplies
   310.949 / 1,000 with the 2-holder census closing to the wei.
4. **New census — allowances:** **[C11.1-04]** all **36 queried** deployer⇄estate
   allowance cells returned zero **at the recorded blocks, for the queried (owner,
   spender) pairs, via the standard allowance method** — no pull-permissions exist among
   the queried cells; other asset/spender combinations were **not queried (UNVERIFIED,
   not implied zero)**.
5. **Safe dossiers:** both 1/1, nonce 0, v1.4.1, modules empty (pagination-sentinel shape
   `[..., 0x…01]`), guard/fallback storage slots zero, zero assets. **[C11.1-03]**
   documented per artifact: **singleton** `0x29fcB43b…C762` (canonical **SafeL2 v1.4.1**,
   24,421 B, bytes-keccak `0xb1f92697…f81ff`) byte-identical Monad = Arc = Ethereum
   mainnet @ the same address (re-confirmed fresh at mainnet block 26,247,495);
   **proxy** (171 B, bytes-keccak `0xd7d408eb…fb4c`) byte-identical **across the two
   instances** — its comparison against a canonical SafeProxy reference was **NOT
   performed (UNVERIFIED, not claimed)**; proxy and singleton are different artifacts
   and were never byte-identical to each other. Genuine bytecode ≠ safe governance:
   both Safes remain 1/1 owned by the exposed deployer EOA.
6. **Redeem-module MINTER anomaly (narrowed, re-founded):** **[C11.1-02]** for the
   deployed runtime bytecode (anchor-reproduced), the Monad Redeem module contains
   **exactly six external-call sites, all traced per site** — token
   `balanceOf/transferFrom/burn` (immutable target, literal selectors) plus
   `Algorithm.getNAV()`, `Reserve.0x41bf3f26(address,uint256)`, `Reserve.reserveRatio()`
   (stored references, live-verified as the recorded Algorithm/Reserve modules). **No
   mint selector exists in any encoding** (literal or shift-reconstructed — automated
   scan; Task 11's byte-wise scan alone was insufficient, as the Arc case below proves);
   **zero CALLDATACOPY** (no caller-calldata forwarding is constructible); no
   DELEGATECALL/CALLCODE/CREATE/CREATE2/SELFDESTRUCT; neither reachable reference module
   can mint (Algorithm: zero call sites; Reserve: STATICCALL-only views). **Scoped
   conclusion: no direct or indirect execution path in the deployed code can exercise
   the token-side MINTER_ROLE held by the Monad Redeem module — the grant is unusable by
   this code, at the recorded code hash and block.** The grant itself remains
   **unexplained** and stays an open finding; two module-side custom-role membership
   cells (ADMIN_ROLE `0xa4980720…`, redeem role `0xf65a18a7…`) were **never probed —
   UNVERIFIED**, proposed as D8 cells E-15/E-16. **Arc correction:** the Arc Redeem
   module **does** call `burn(uint256)` via a shift-encoded selector (`0x0852cd8d ≪ 227`)
   — Task 11's “transferFrom only” was a byte-scan artifact (PI-11.1-d); Arc Redeem
   holds no token-side roles.
7. **Governors:** fresh parameters (votingDelay 1, votingPeriod 1, proposalThreshold 1,
   quorumNumerator 1), **name() = "MITHQAL Governance"** on both chains, two different
   builds at one hex (25,819 B / 13,129 B); proposalCount() reverts; auth UNESTABLISHABLE.
8. **Generations + RH:** gen-A family byte-identical (Monad genA = Arc genC = RH
   "MTQSigma"; keccak `0xa7331051…`), gen-B family byte-identical (Monad/Arc/RH
   `0x31496b92…`), self-custody 1M proven on gen-A/C, owners = deployer; RH deployer
   holds ~the entire RH supply (1,000,999.999999999999997) with 60 tx history; RH "Safe"
   re-proven fake (all ABI calls revert).
9. **Solana:** current mint — DbFjz authority, no freeze, 18 decimals, u64-max supply,
   full supply in DbFjz ATA, wallet 9.99500752 SOL, 6 sigs; superseded mint — 4saT
   authority+freeze, supply 4.477988020393345024 fully in 4saT ATA, wallet 4.98368596
   SOL, 5 sigs; **Squads candidate program ID probed NULL on devnet+mainnet → asserted
   nowhere**.
10. **State stability:** **[C11.1-04]** cell-for-cell identity with Task 10 **at the
    recorded block anchors, for every probed method and queried address/cell** — no drift
    was observed in any probed cell; unprobed surfaces are unobserved and the probes
    cannot exclude activity leaving no trace in probed cells; plus identity anchors
    re-hashed under the historical convention reproducing every Task 10 keccak exactly
    (and re-reproduced fresh by the Task 11.1 forensics probe at Monad 73,216,883 /
    Arc 68,504,186).

## 2. What could NOT be verified (and how it is classified)

- **Pre-squash git history** (before 2026-10-19): UNVERIFIABLE — exposure window treated
  as [≥2026-08-07 … present].
- **Any remote git host / CI execution / Turso database / external clones:** UNVERIFIED
  from this sandbox → UNRESOLVED until owner attestation (CKPT-1); workflows exist that
  WOULD spread the repo if a remote exists.
- **DbFjz key custody** (current Solana mint authority — outside repo census): owner
  attestation required (CKPT-2).
- **Source identity of all 18 deployed EVM contracts + both Governors' proposer/executor
  auth:** UNESTABLISHABLE without published sources (N-01) — recorded as residual risk.
- **Monad current-estate creation records:** pruned RPC state + CF-gated explorer — deploy
  authorship inferred, not receipted.
- **Squads multisig program identity:** NULL probes → deliberately unasserted.
- **RH chain full deployer history:** not census-scanned (provenance tier).
- **Whether anyone else has copied the exposed literals:** fundamentally unprovable —
  this is why on-chain rotation is the only robust containment.

## 3. What was corrected in reporting (evidence-preserving; originals untouched)

- **CORR-5:** this session's first probe hashed hex-strings, not bytecode-bytes —
  disclosed; all anchors re-hashed under the historical convention; every Task 10 keccak
  reproduced exactly.
- **CORR-6:** Task 10's "redeemer can mint" was overstated → narrowed: **[C11.1-02]** the
  Monad Redeem module's token-side MINTER_ROLE is **unusable by the module's deployed
  code** — now proven by complete call-site enumeration + per-site selector tracing
  (all six sites traced; no mint selector in any encoding; no forwarding; live-verified
  stored targets cannot mint), **not** by the original selector-absence byte-scan (which
  was shown insufficient by the Arc burn case). The role grant remains unexplained
  (hygiene); revocation is planned at T-3.1 by Safe-B. Task 9's opposite error remains
  corrected by CORR-1; the two corrections reconcile the anomaly with precise scope.
- **PI-1/PI-2:** a malformed address constant and a bad byte-parser produced failed
  probes — both preserved in the raw log as **FAILED-UNVERIFIED** (never as negative
  results), then fixed (constant verbatim from Task 10; jsonParsed authoritative parse).
- **PI-3 (self-disclosure):** one failed tooling call printed the EVM literal into the
  AI-session transcript (argv leak). No file/evidence artifact received it; the census
  was rewritten to pass patterns via stdin. The transcript is now listed as an exposure
  surface (D2).
- **PI-4:** `getGuard()/getFallbackHandler()` reverts resolved as v1.4.1-normal behavior
  (no such dispatched getters in the canonical build) — with the singleton byte-proven
  genuine against mainnet, this STRENGTHENS Safe authenticity evidence.
- Task 9's role-reporting error remains reconciled exactly as Task 10 left it (CORR-1
  with originals preserved in `audit-work/v9-task9/`).

## 4. What remains exposed (until the approved plan is executed AND D8-verified)

1. Both keys: full estate control (EVM) and superseded-mint control + SOL (Solana) —
   unchanged since Task 10; both in 25/25 commits and 8 worktree files.
2. The unavoidable-handover window: until T-3.6/T-3.7 and T-4.3/T-4.5 execute, ANY repo
   holder can do everything the owner can (mint, grant, reconfigure 1/1 Safes, inflate
   gen-A, mint/freeze the old Solana mint, drain SOL).
3. Single-key chokepoints that survive EVM rotation unless separately decided: DbFjz
   (current mint), the current-mint u64-max/decimals-18 structural non-conformance, the
   unassessed Governor pair, gen-A family ownership.
4. The transcript exposure (PI-3) and every UNRESOLVED remote surface (§2).

## 5. What requires owner approval (the decision queue — D7 has the full matrix)

**Immediate (P0, blocking):** CKPT-0 approve this package · CKPT-1 remote-existence
attestation · CKPT-2 DbFjz custody attestation · T-0.1–T-0.3 repo purge + history rewrite.
**Before any chain action:** CKPT-3/4 signer provisioning + committee constitution ·
CKPT-5/6 Safe-B verification + grant-set approval · CKPT-7 irreversibility acknowledgment ·
CKPT-8 Solana decisions (SOL-DEC-1 S-1/2/3/4; DEC-3 decimals — economic approval; Squads
program identity owner-verification). **After execution:** CKPT-9 Independent-Reviewer D8
sign-off. **Later, separately:** DEC-1..DEC-7 canonical/governance decisions (CKPT-10) —
explicitly NOT taken by this report.

## 6. What has actually been executed

**NOTHING.** Zero transactions sent. Zero roles granted or revoked. No Safe or multisig
created. No ownership, threshold, or authority changed. No assets or native balances
moved. No mint, burn, pause, freeze, bridge, or transfer. No key generated inside this
repo/environment. No gate advanced. No release status changed: **NOT ACCEPTED.** Every
on-chain item in this package remains **PROPOSED — NOT SIGNED — NOT EXECUTED**, pending
the named human approvals in D7. Passing TypeScript, lint, API, or browser tests does not
satisfy blockchain authority migration or monetary acceptance — and none is claimed to.

---

### Deliverables in this package (`audit-work/task11/`)

| File | Content |
|---|---|
| `D1-INCIDENT-STATUS.md` | exposure status, evidence confidence, affected systems, fresh anchors, corrections PI-1..4 / CORR-5/6 |
| `D2-EXPOSURE-SURFACE.md` | per-key exposure census; why deletion ≠ invalidation; CI/CD + unresolved remote surfaces; 7-category containment mapping |
| `D3-EVM-ROTATION-PLAN.md` | chain-by-chain function-level authority inventory; Safe-B destination design + signer provisioning; grant-before-revoke ordering; handover-window disclosure |
| `D4-SOLANA-AUTHORITY-PLAN.md` | mint-by-mint dossiers + disposition options; u64/decimals tables (≤9 = option requiring economic approval); Squads 2-of-3 defined capability (program identity UNVERIFIED) |
| `D5-TRANSACTION-REGISTER.md` | ordered T-0.x–T-4.x register: targets, methods, args, chains, dependencies, pre/postconditions, signers, fees, failure modes, recovery limits — all PROPOSED — NOT SIGNED — NOT EXECUTED |
| `D6-CANONICAL-ARCHITECTURE-DECISIONS.md` | 9-generation + 2-mint comparison; facts vs hypotheses vs reserved decisions DEC-1..DEC-7 |
| `D7-APPROVAL-AND-DEPENDENCY-MATRIX.md` | named approver roles, CKPT-0..10, per-item dependency/risk matrix, rules of engagement |
| `D8-POST-REMEDIATION-VERIFICATION.md` | exact tests (repo/EVM/Solana/custody/posture) required before any "contained" claim |
| `D9-TASK11-RELEASE-GATES.md` | 7 indicators unchanged, all rejections preserved, corrections ledger, conditional path |
| `TASK11-FINAL-REPORT.md` | this document |
| `evidence/` | `onchain-evm-task11.json` · `onchain-solana-task11.json` · `identity-anchors-task11.json` · `exposure-surface-census-task11.json` · `safe-singleton-probe.json` · `raw-task11-evm.jsonl` · `raw-task11-solana.jsonl` |
| scripts (reproducible, read-only) | `verify-evm.ts` · `verify-solana.ts` · `forensics-census-task11.ts` · `hash-anchors.ts` · `probe-safe-singleton.ts` |

All artifacts are **file-scoped clean**: no key material beyond redacted fingerprints
appears in any deliverable or evidence file of this package (byte-verified; the Task 11.1
artifacts are clean by construction). **[C11.1-01]** The full disclosure record is
five-channel: files clean (VERIFIED) · session transcript — the EVM literal **was emitted
once** (PI-3, confirmed disclosure; access/retention/incident review are owner-side,
UNVERIFIED) · worktree — 2 EVM + 6 Solana files (CONFIRMED) · git history — 25/25 commits
(CONFIRMED) · remote/CI/backup/clone surfaces (UNVERIFIED — no local remote ≠ no remote
copies; CKPT-1 attestation required). **Repository cleanup alone does not revoke an
exposed key.** Stop point honored: this package ends at review. Execution begins only
where D7 says a human says yes.
