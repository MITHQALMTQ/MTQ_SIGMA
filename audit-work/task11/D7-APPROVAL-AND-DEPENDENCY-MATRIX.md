# MTQΣ — TASK 11 · D7: APPROVAL & DEPENDENCY MATRIX (named roles, prerequisites, checkpoints)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

Nothing in this package is executable without the named human approvals below. Several
approver roles **do not yet exist** (the committee is not constituted — OD-3); creating
them is itself a prerequisite, not an afterthought. No gate may advance by this document.

---

## 1. Approver roles (who must say yes)

| Role | Exists today? | Scope in this package |
|---|---|---|
| **Project Owner** | yes (project authority) | repo purge/history rewrite · evacuation destinations · pause-window option · all default proposals accepted/amended · owner attestations (remote systems, DbFjz custody) |
| **Security Lead** | to be designated | K-2 history-rewrite execution · credential rotation · D8 verification sign-off |
| **Constituted Governance Committee (7 signers, 4-of-7)** | **NO — must be provisioned (T-1.1)** | DEC-1 canonical family · DEC-2 name · DEC-5 genesis path · all Safe-B authority actions |
| **Economic Authority (CFO/monetary-policy owner)** | role exists in mandate; not yet exercised | DEC-3 Solana decimals (≤9 is an option, NOT automatic) · ECON-DEC-2 Reserve-module MINTER policy |
| **Independent Reviewer** (not the executor of any migration step) | to be appointed | D8 post-remediation verification report — **no "contained/rotated/revoked" language before this sign-off** |

## 2. Checkpoint map (each checkpoint is a hard stop — no later step may start)

| CKPT | Gate content | Approver(s) | Unlocks |
|---|---|---|---|
| **CKPT-0** | Approve this Task 11 package (D1–D9) as the remediation baseline, amendments included | Owner (+ Security Lead) | Phase 0 (T-0.1–T-0.3) |
| **CKPT-1 (OWNER-ATT-1)** | Attestation: does ANY remote git host / CI system / Turso database / external clone of this repo exist, or ever exist? (Y → T-0.4 mandatory; N → T-0.4 skipped with signed attestation; unknown → treat as Y) | Owner | T-0.4 decision; K-2 scope |
| **CKPT-2 (OWNER-ATT-2)** | Attestation of DbFjz key custody (storage, copies, generation environment) — the current-mint authority is outside census reach | Owner | SOL-DEC-1 posture |
| **CKPT-3** | Signer-provisioning plan approved (D3 §3 reqs 1–5 / D4 §3 reqs 1–5: independence, custody, recovery, freeze-risk acceptance) | Owner + Security Lead + (committee-custodian sign-up) | T-1.1, T-4.1 |
| **CKPT-4** | Committee constituted: 7 owner addresses recorded; independence attested | Owner (as convener) | T-1.2/T-1.3 (Safe-B deploys) |
| **CKPT-5** | Safe-B dossiers + quorum proof VERIFIED (T-1.4 postconditions) | Security Lead (independent read) | Phase 2 grants (the handover window opens) |
| **CKPT-6** | Grant-set review: exact grant list (incl. normalization D3 §4.4 and ECON-DEC-2 resolution) approved verbatim | Owner + Committee (economic rows: Economic Authority) | T-2.1–T-2.7 execution |
| **CKPT-7** | Revoke-set review: irreversibility inventory (T-3.6/T-3.7, T-4.3/T-4.5, T-3.8 destinations) explicitly acknowledged | Owner + Committee | Phase 3 / T-4.3–T-4.5 |
| **CKPT-8** | Solana decisions recorded: SOL-DEC-1 (S-1/2/3/4) + DEC-3 decimals (if S-4) + Squads program identity owner-verified (currently UNVERIFIED — none asserted) | Owner + Economic Authority | T-4.2 (and S-4 planning if chosen) |
| **CKPT-9** | D8 verification executed by Independent Reviewer; report accepted | Independent Reviewer + Owner | "contained/rotated/revoked" language permitted; K-3/K-4 close; address book Tier-1 update (K-7) |
| **CKPT-10** | Canonical decisions DEC-1..DEC-7 taken by the constituted bodies | Committee (+ Economic Authority where flagged) | conditional-acceptance path (D9) may begin — still NOT a gate pass |

## 3. Dependency + risk matrix (per plan item)

| Item | Prerequisites | Risks if executed | Risks if NOT executed | Approval |
|---|---|---|---|---|
| T-0.1/T-0.2 purge | CKPT-0 | audit-trail loss if silent (mitigated: append-only notice) | literals keep spreading (25th commit already added a copy) | Owner |
| T-0.3 history rewrite | T-0.1/2 | invalidates all clones; missed remotes keep secrets (D2 §1.4 — not a containment) | full git history remains a permanent key archive | Owner + Security Lead |
| T-0.4 credential rotation | CKPT-1 = Y | rotation disruption of any live CI/backup | exposed CI tokens persist | Owner + Security Lead |
| T-1.1 signer ceremony | CKPT-3/4 | custodian compromise; ≥3 losses freeze Safe-B | no destination authority can exist; rotation impossible | Owner (convener) |
| T-1.2–T-1.4 Safe-B | T-1.1 | misconfigured destination (dossier gate exists) | — | Security Lead verifies |
| Phase 2 grants (T-2.x) | CKPT-5/6 | **unavoidable handover window** (race risk, D3 §4.2); testnet-only blast | exposed key stays sole admin — strictly worse | Owner + Committee |
| T-3.1 Redeem-MINTER revoke | T-2.1 verified | none material (role proven dormant) | cosmetic anomaly persists | Committee (routine) |
| T-3.2/T-3.3 old-Safe strip | T-2.x | old Safe loses its token roles (intended) | old 1/1 Safe keeps Monad token privileges | Committee |
| T-3.4/T-3.5 module-ADMIN revokes | T-2.2/2.6 verified | ordering error → recoverable (Safe-B still admin) | modules keep single-key admin | Committee |
| **T-3.6/T-3.7 LAST revokes** | ALL prior verified | **irreversible** by design; a mistake here cannot be undone by the old key | exposure persists indefinitely — the entire point of the exercise | Owner + Committee (CKPT-7 ack) |
| T-3.8 evacuation | T-3.6/7 (+ CKPT-7 destinations) | wrong destination = irreversible loss (probe-verify first) | assets/natives remain at a key anyone can read from history (pre-rewrite) | Owner |
| T-4.1 Squads provisioning | CKPT-8 | program identity unverified (NULL probes) — must be owner-verified first | no Solana multisig option | Owner |
| T-4.2 current-mint action | CKPT-2 + CKPT-8 | S-2 revocation permanent (mint freezes at u64-max); S-1 transfer-to-bad-address unrecoverable | single key remains mint chokepoint | Owner + Economic Authority |
| T-4.3/T-4.5 superseded revokes | CKPT-7 | permanent (intended); exposed-key signing session required (D4 §4) | **any repo holder can mint/freeze old tokens indefinitely** | Owner |
| T-4.4 SOL evacuation | — | destination error (probe first) | 4.98 SOL stays drainable by any repo holder | Owner |
| D8 verification | all executed steps | none (read-only) | unverified "containment" claims — forbidden | Independent Reviewer |
| DEC-1..DEC-7 | CKPT-9/10 | architectural churn | estate stays non-canonical (C-041 open) | per §2 above |

## 4. Rules of engagement (standing, override nothing in §1/§2 prohibitions)

1. **Sequence is law**: no row of D5 executes before its prerequisites are evidenced on-chain
   (probe-verified), even if humans "are confident".
2. **The handover window is disclosed, never hidden**: any execution report must state its
   Phase-2→T-3.6/7 window length and what was probe-verified inside it.
3. **No bundling**: rotation steps are never combined with genesis/custody/supply changes
   or canonical migration (D5 §5 rule 5).
4. **Testnet honesty**: every approval is explicitly for TESTNET remediation rehearsal;
   nothing here authorizes mainnet behavior or advances a release gate (D9).
5. **Language discipline**: until CKPT-9, no artifact of this project may describe either
   key as contained, rotated, or revoked — including UI, logs, and commit messages.
