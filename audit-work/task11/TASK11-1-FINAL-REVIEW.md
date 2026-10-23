# MTQΣ — TASK 11.1 · FINAL REVIEW (evidence integrity, security-status corrections, remediation readiness)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**
**Overall status: NOT ACCEPTED — unchanged by this review (§7: documentation corrections do not advance gates)**

Task 11.1 reviewed the completed Task 11 package and corrected its contradictions,
unsupported conclusions, incomplete evidence references, and overstatements **before the
owner considers authorizing remediation**. This is the review report. Every correction is
traceable via `[C11.1-nn]` markers to `CORRECTIONS-REGISTER.md`; every pre-correction file
is preserved byte-identical in `versions/task11-v1/` (sha256 manifest in the register);
all raw evidence is unmodified. **Nothing was executed** — no transaction, no signature,
no deployment, no role or authority change, no asset movement, no source-control history
rewrite, no destructive evidence cleanup, no release-gate advancement.

---

## 1. Review method

- Re-read all 11 Task 11 deliverables and 7 evidence files; located every claim in the
  five categories the tasking listed (stable-state assertions, allowances, repository/Git
  exposure, external systems, Solana state, source/build identity, remediation
  sequencing).
- Built a fresh **read-only forensics probe** (`redeem-module-forensics.ts`, v1→v4, its
  own incidents disclosed as PI-11.1-a…e) to re-found the Redeem-module finding:
  full disassembly of both Redeem + both Mint modules (positive controls), complete
  external-call-site enumeration, per-site target/calldata tracing, live storage-slot
  reads, dispatch-table extraction for the modules and both MTQ tokens, an automated
  shift-reconstructed-selector scan, and a fresh Ethereum-mainnet canonical SafeL2
  re-confirmation. 23 read-only RPC requests, 0 failures, hashed transport, block-anchored
  (Monad 73,216,883 · Arc 68,504,186 · mainnet 26,247,495). All recorded code anchors
  reproduced **byte-exactly** — deployed code is unchanged since Task 11 (one false
  mismatch during the review was the probe's own transcription defect — PI-11.1-a —
  disclosed and fixed by loading anchors programmatically).
- **No key material was printed, reproduced, transmitted, or newly processed** at any
  point. The literal-derivation census was **not** re-run (§7 prohibition: no
  reconfirmation processing). No on-chain test transaction was made; no module was
  invoked.

## 2. Current key-exposure status (the corrected disclosure record)

**Both keys remain REAL and fully privileged, exactly as Task 11 recorded.** Nothing in
Task 11.1 reduced their power — nothing could have, without execution. The disclosure
record is now **five-channel and channel-precise [C11.1-01]**:

| Channel | Status |
|---|---|
| Package files + evidence artifacts (Tasks 10/11/11.1) | **clean — VERIFIED** (byte-level; 11.1 artifacts clean by construction) |
| **Session transcript** | **the EVM literal WAS emitted once (PI-3)** — see §3 |
| Repository worktree | **2 EVM files (incl. the worklog plaintext quote) + 6 Solana files — CONFIRMED** |
| Git history | **25/25 commits, both literals — CONFIRMED** |
| Remotes / CI / artifacts / backups / clones / transcript retention | **UNVERIFIED — UNRESOLVED** (no local remote configured ≠ no remote copies; CKPT-1 attestation required) |

**Standing principle, stated explicitly:** repository cleanup — file purge, history
rewrite, credential rotation — **does not revoke an exposed private key**. Keys are
self-authenticating data; only on-chain rotation (D3/D5 EVM, D4/D5 Solana), executed
after the D7 approvals and proven by D8, removes their power.

## 3. The transcript disclosure, explained

**What happened (unchanged facts, precise framing):** during Task 11, the first version of
the exposure census passed the EVM key literal as a command-line argument to `git grep`;
one failing call caused Node to print the process argv — including the literal — into the
AI session's terminal transcript (PI-3). No deliverable file, evidence file, or
repository file received the literal as a result of that call (all outputs are
fingerprint-redacted, and the repo already contained the literal in 25 commits).

**How it is now classified:** a **security disclosure**, not an administrative note. A
session transcript is a storage and transmission surface: it may be retained
indefinitely, may be accessible to parties beyond the operator, and its retention policy
is not under this audit's control. Task 11's package-level statement "zero key material
published" was therefore an **overstatement** — true only for the package's *files*,
false as a blanket claim. Task 11.1 replaced it with the five-channel record above
wherever it appeared (README, final report, D1) **[C11.1-01]**.

**Applicable controls, honestly assigned:** session **access control** — platform/owner
side, UNVERIFIED who else can read; **retention** — unknown policy, treated as indefinite;
**incident review** — this register + D1 §5/D2 constitute the disclosure record and the
owner's security review must include session storage in scope. **Evidence was not
destroyed and no purge was attempted** — the transcript is part of the forensic record,
and §7 forbids destructive cleanup. The Task 11 tooling defect was already fixed
(patterns via stdin; the literal never re-enters argv); Task 11.1 added its own
equivalent discipline (no re-derivation, no re-census).

## 4. Review findings — separating confirmed observations, analysis, inference, and unresolved questions

### 4.1 Confirmed observations (fresh, evidence-hashed, block-anchored — "verified at the recorded block or slot, for the queried addresses and methods")

1. All Task 11 identity anchors reproduce byte-exactly under the raw-byte keccak
   convention (fresh getCode of Mint/Redeem modules + both MTQ tokens + mainnet SafeL2
   singleton). **Deployed code is unchanged since Task 11** (the one apparent mismatch was
   the review's own transcription defect — PI-11.1-a).
2. **Monad Redeem module call graph (complete):** exactly six external-call sites — token
   `balanceOf` / `transferFrom` / `burn` (immutable embedded target, literal selectors) +
   `Algorithm.getNAV()` / `Reserve.0x41bf3f26(address,uint256)` / `Reserve.reserveRatio()`
   (stored references; live slot values = the recorded Algorithm and Reserve modules).
   Zero CALLDATACOPY; no DELEGATECALL/CALLCODE; no CREATE/CREATE2; no SELFDESTRUCT in the
   executable region; no mint selector in **any encoding** (literal or shift-reconstructed
   — automated scan); none of the three stored-target selectors appears in either MTQ
   token's dispatch; the module embeds no other estate address (no Mint-module, Safe, or
   deployer reference). The **Mint modules** are positive controls and show their real
   mint call sites (monad: literal `0x40c10f19`; arc: `0x40c10f19 ≪ 224`).
3. **Arc Redeem correction (new):** it **does** call `burn(uint256)` — the selector is
   shift-encoded (`PUSH4 0x0852cd8d; SHL 0xe3`), which is why Task 11's byte-wise scan
   mislabeled the module "transferFrom only" (PI-11.1-d). Arc Redeem holds **no
   token-side roles** (fresh role matrix) — a record correction, not an exposure change.
4. **Safe artifacts, documented independently [C11.1-03]:** singleton `0x29fcB43b…C762`
   (canonical **SafeL2 v1.4.1**, 24,421 B, `0xb1f926978a0f44a2…f81ff`) — byte-identical
   Monad = Arc = Ethereum mainnet @ the same address (re-confirmed fresh). Proxy (171 B,
   `0xd7d408eb…fb4c`) — byte-identical **across the two instances**; a canonical-SafeProxy
   reference comparison was **never performed → UNVERIFIED (no longer claimed)**. Proxy and
   singleton are different artifacts and were never byte-identical to each other. Genuine
   bytecode does not make the governance safe: both Safes are 1/1, sole owner = the exposed
   deployer EOA, nonce 0, empty modules (pagination-sentinel shape), guard/fallback slots
   zero, zero balances.
5. Live Redeem storage slots: slot 0 zero · slot 1 = Reserve module · slot 2 = Algorithm
   module (both chains — identical layout).
6. On-chain state (Task 11 probes, scope-qualified [C11.1-04]): supplies, role matrices,
   module admin cells, Safe dossiers, nonces, natives, and the 36 **queried** allowance
   cells are recorded at the Task 11 block anchors; the review re-probed and reproduced
   code identity and adds nothing contradictory. Allowances: the **36 queried cells**
   returned zero — other asset/spender combinations are **UNVERIFIED, not implied zero**.

### 4.2 Analysis (conclusions the review draws from the confirmed observations)

- **The Monad Redeem MINTER grant is unusable by the module's deployed code** — this is
  now a *call-graph-scoped proof* (complete site enumeration + per-site selector tracing +
  one-level indirection closure), strictly stronger than Task 11's selector-absence
  inference. The path question is **decided, not UNRESOLVED**; the claim is scoped to
  the recorded code hash and block, and the code at that address cannot be replaced by
  the module itself (no proxy, no SELFDESTRUCT, no CREATE).
- **Byte-wise selector scans are insufficient as standalone evidence** — proven by the
  Arc burn case. All selector claims in this package now rest on per-call-site tracing
  (or on scans *plus* shift-reconstruction analysis).
- **Remediation sequencing semantics:** Phase 0 is source/credential **hygiene that
  reduces ongoing spread but not on-chain exposure**; it must not delay the chain phases
  [C11.1-05]. The grant-before-revoke core, the T-1.4 hard gate, and the last-revokes
  invariant are correct and unchanged.

### 4.3 Inference (labeled as such — not evidence)

- The origin of the Monad Redeem token-MINTER grant (symmetric deployment script
  hypothesis) remains an **unproven hypothesis** (requires source — N-01).
- Prior-session transcript exposure beyond PI-3 is *likely* (the worklog plaintext was
  quoted by an earlier agent) but is **outside this sandbox's auditability** — treated as
  exposed posture, not counted as a confirmed event.

### 4.4 Unresolved questions (each assigned an owner, none blocking the review's acceptance)

See `OPEN-RISK-AND-APPROVAL-MATRIX.md` for the complete matrix. Headline items:
remote-repository existence and CI/backup/clone spread (CKPT-1); DbFjz key custody
(CKPT-2); Governor pair authority (sources unpublished — N-01); Squads program identity
(owner-verified — currently asserted nowhere); the two unprobed module-side custom roles
(D8 E-15/E-16); canonical-proxy reference comparison (optional, owner/Security Lead);
L1-variant Safe singleton reference (empty-code probe — no claim); Monad current-estate
creation records (pruned state); whether anyone has copied the exposed literals
(fundamentally unprovable — the reason on-chain rotation is the only robust containment).

## 5. What remains unverified (explicit list — nothing here was silently passed)

1. Any remote git host / CI execution / Turso database / external clone (CKPT-1
   attestation). 2. DbFjz custody (CKPT-2). 3. Governor proposer/executor auth (N-01).
4. Squads program identity (NULL probes — asserted nowhere). 5. Module-side custom
ADMIN_ROLE / redeem-role membership cells (new D8 E-15/E-16). 6. Canonical SafeProxy
reference match for the proxy runtime (comparison never performed — not claimed).
7. L1-variant Safe v1.4.1 singleton reference (empty-code probe at the recalled address —
   no address asserted). 8. Non-queried allowance combinations. 9. Unprobed on-chain
surfaces (stability claims are cell-scoped). 10. Pre-squash git history. 11. Session
transcript access/retention. 12. RH full deployer history (provenance tier). 13. Copy
status of the exposed literals (unprovable by nature). **A failed or unmade query is
UNVERIFIED — never a negative result** (all failures/retries preserved in the raw logs).

## 6. Approvals required before any execution (the decision queue — unchanged in shape, D7 is the authority)

| Order | Approval | Unlocks |
|---|---|---|
| 1 | **CKPT-0** — owner accepts the Task 11 package **as corrected by this review** (CORRECTIONS-REGISTER + markers) as the remediation baseline | Phase 0 hygiene + Phase 1 provisioning |
| 2 | **CKPT-1 (OWNER-ATT-1)** — remote/CI/Turso/clone existence attestation | T-0.4 decision (mandatory if Y/unknown) |
| 3 | **CKPT-2 (OWNER-ATT-2)** — DbFjz custody attestation | Solana posture (SOL-DEC-1) |
| 4 | **CKPT-3/4** — signer provisioning plan + committee constitution (7-of-4 Safe-B; Squads 2-of-3 equivalent) | T-1.1 → T-1.4 (+T-4.1) |
| 5 | **CKPT-5/6** — Safe-B dossier + quorum proof verified; exact grant set approved | Phase 2 (the handover window opens) |
| 6 | **CKPT-7** — revoke set + irreversibility inventory + evacuation destinations acknowledged | Phase 3 + Solana revocations/evacuation |
| 7 | **CKPT-8** — SOL-DEC-1 disposition + **DEC-3 decimals (ECONOMIC approval — an option, not automatic)** + Squads identity owner-verified | T-4.2 (and S-4 planning if chosen) |
| 8 | **CKPT-9** — Independent Reviewer D8 report (incl. the new E-15/16/17 cells) | any "contained/rotated/revoked" language; K-7 |
| 9 | **CKPT-10** — DEC-1…DEC-7 by constituted governance | conditional-acceptance path (still not a gate pass) |

**Owner decisions still pending by design:** Solana authority disposition (S-1/2/3/4) and
token decimals (DEC-3) remain pending their economic and governance approvals; canonical
architecture selection (DEC-1…DEC-7) remains reserved to humans; no 4-of-7 Safe is
assumed to exist; the current 1/1 Safes are not treated as sufficient (OD-35); no
unverified multisig program or destination configuration is treated as valid.

## 7. What Task 11.1 actually executed

**Nothing.** Zero transactions, signatures, deployments, role grants/revocations, Safe
changes, authority changes, asset movements, source-history rewrites, or destructive
cleanups. Zero key-material processing (no re-derivation, no census re-run). 23 read-only
RPC reads (getCode/getStorageAt/chainId/blockNumber) + mainnet ground-truth reads, all
hashed and logged. No gate advanced; no release status changed. The evidence-integrity
corrections themselves — including typechecking, linting, and any UI verification —
**cannot** advance any gate (§7), and none is claimed to.

## 8. Verdict

The Task 11 package, **as corrected by this review**, is evidence-backed and consistently
worded: the disclosure is fully acknowledged (five-channel, transcript included); the
Redeem-module finding is narrowed to an affirmatively-proven, scope-bounded call-graph
statement with its open residuals kept open; the Safe identity record is per-artifact and
precise; scope language is block/Method/query-bounded; the remediation sequence separates
hygiene from governance-establishment from true revocation and forbids both failure
modes. The package is **ready for human security and governance review**.

**Final posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS
FORBIDDEN · NOT ACCEPTED.** Return this package for review. Stop before execution.
