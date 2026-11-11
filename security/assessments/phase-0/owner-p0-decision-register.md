# MTQΣ Phase-0 — Owner P0 Decision Register (Prioritized)

**Document ID:** SEC-P0-DECISIONS-001 · **Version:** 1.0 · **Prepared:** 2026-11-11T14:05Z (UTC) · **Workstream:** I (directive §10)
**Branch:** security/phase-0-review-prep @ fc9ad97 (docs-only; ancestry unchanged) · **Author role:** implementer AI-agent lineage (evidence preparer — NOT an independent auditor)
**Release classification:** TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED

> **Standing independence limitation:** prepared inside the assessed environment by the implementer's own agent lineage. Every "required evidence" item below names the verification the OWNER or the INDEPENDENT REVIEWER must still produce; nothing in this register has been executed. No owner decision is assumed to have been made merely because a recommendation appears in a companion document.

---

## 0. Purpose and decision rules

1. This register is the single prioritized queue of owner decisions required to move from documented containment readiness to actual containment. It consolidates the directive §10 minimum table with every additional decision surfaced by the 2026-11-13:2xZ–14:xxZ review session.
2. **A recommendation appearing in any document is NOT a decision.** Decisions exist only when the named decision owner records an explicit, dated authorization.
3. No row in this register has been executed by the implementer. All rows are OPEN.
4. Status vocabulary: `OPEN` (no owner action recorded) · `EVIDENCE READY` (the supporting evidence package exists and is hash-verifiable, owner action still pending) · `DECIDED` (owner record exists — none to date) · `CLOSED` (owner-recorded completion — none to date).
5. Any containment operation that touches keys, credentials, contracts, chain state, repository settings, or infrastructure additionally requires the approvals of the matrix in `evm-key-compromise-containment-readiness.md` §5 (SEC-P0-EVMCR-001) and the sign-off rules of `independent-security-reviewer-handoff.md` §5 (SEC-P0-HANDOFF-001).

---

## 1. Directive §10 — minimum decision table (verbatim scope)

| # | Priority | Decision | Decision owner | Required evidence | Current status |
|---|---|---|---|---|---|
| 1 | P0 | Historical EVM key containment | Owner | Fresh chain roles and migration risk assessment | OPEN — evidence READY (SEC-P0-EVMCR-001: fresh implementer-side role matrix 2026-11-11T13:27–13:38Z, no drift vs 2026-10-21, incl. Robinhood chain; independent reviewer reproduction still REQUIRED) |
| 2 | P0 | Historical Solana key containment | Owner | Fresh mint/freeze authority matrix | OPEN — evidence READY (SEC-P0-SOLCR-001: fresh devnet reads 13:28–13:35Z, slots 521117590→521119239; superseded mint authorities confirmed operative; independent reproduction REQUIRED) |
| 3 | P0 | Repository visibility containment | Owner | Exposure and evidence-preservation assessment | OPEN — evidence READY (SEC-P0-EXPOSURE-001: no-drift re-verification battery 13:29–13:41Z; urgent recommendation recorded) |
| 4 | P0 | GitHub push credential audit | Owner/GitHub administrator | Token identity, permissions and audit log | OPEN — checklist READY (SEC-P0-IDENT-001 §3 T-1…T-10; embedded credential class verified present, redacted; token identity/scope EXTERNAL EVIDENCE REQUIRED) |
| 5 | P0 | Platform re-image containment | Owner/platform provider | Root-cause and platform audit evidence | OPEN (SEC-P0-IDENT-001 §4 formal assessment + SEC-P0-BOOT-001 §4 reflog evidence; platform-side audit EXTERNAL EVIDENCE REQUIRED) |
| 6 | P1 | AI API authorization | Security reviewer | Route and ingress verification | OPEN (SEC-P0-APIREV-001: source-level auth ABSENT verified for both routes; external ingress + live reachability UNVERIFIED — reviewer task RT-06/RT-07) |
| 7 | P1 | Source-integrity boot authorization | Security reviewer | Failure-path evidence | OPEN (SEC-P0-BOOT-001: 10 mandatory questions answered with file:line evidence; remediation backlog owner-authorized Phase-1) |
| 8 | P1 | Independent review engagement | Owner | Reviewer qualification and scope | OPEN (SEC-P0-HANDOFF-001: qualification, 12 reproduction tasks RT-01…RT-12, sign-off rules) |
| 9 | P1 | Evidence archive custody | Owner/security custodian | SHA-256 and transfer record | OPEN (SEC-P0-EVIDENCE-001 manifest; custody transfer OUT of this sandbox required; no custodian named — none exists yet) |

---

## 2. Session-extension decisions (surfaced 2026-11-11T13:2xZ–14:xxZ)

| # | Priority | Decision | Decision owner | Required evidence | Current status |
|---|---|---|---|---|---|
| 10 | **P0** | **2026-11-11 owner-message credential disclosure event — rotate ALL disclosed credentials** (types: GitHub PAT; Vercel deploy token; Turso database URL+token; Neon Postgres URL+password; Inngest event+signing keys — values redacted, never used/echoed/stored by the implementer) | Owner | Owner-side inventory + rotation confirmations for each of the five credential families; confirmation that no automation depended on the disclosed values | OPEN — URGENT (plaintext credentials now exist in a chat transcript; treat as exposed irrespective of any other containment) |
| 11 | **P0** | Embedded push-token ↔ disclosed-PAT relationship determination, then scoped replacement rotation (per SEC-P0-IDENT-001 §3 sequence) | Owner/GitHub administrator | Side-by-side token identity comparison (owner-side; never in AI env), GitHub audit log | OPEN (embedded credential verified present in BOTH clone remote configs, class `x-access-token`, values REDACTED) |
| 12 | **P0** | Solana superseded-mint neutralization decision | Owner | Fresh INDEPENDENT authority matrix (V-1…V-12); CKPT-2 custody attestation; then owner-authorized revoke/set-authority transactions (Phase-1, outside this assignment) | OPEN — evidence READY (implementer-side fresh read: superseded mint mintAuthority AND freezeAuthority both SET and operative; residual mint headroom ≈ 13.97 whole tokens at 18 decimals; freeze capability fully operative; any neutralization is an owner-authorized transaction — NOT performed) |
| 13 | **P0** | Robinhood-chain estate containment | Owner | Independent role matrix on Robinhood testnet (chainId 46630, RPC `https://rpc.testnet.chain.robinhood.com/rpc`); determination of whether the EOA's live roles on the token and the registry-removed ecosystem are to be contained or formally abandoned | OPEN — NEW finding this session (SEC-P0-EVMCR-001 §3.3: registry-row removal on 2026-10-24 did NOT remove chain state; compromised EOA still holds ADMIN+MINTER+PAUSER on the Robinhood token; the recorded "Safe" address there re-proven NOT a genuine Safe) |
| 14 | P1 | Non-functional / superseded contract & role deprecation decision (the owner's appended instruction "delete not working" was DECLINED under directive §§1.1/11 — read-only inventory delivered instead) | Owner | Post-containment inventory (SEC-P0-EVMCR-001 §2 multi-generation registry + TASK9 collisions); owner-recorded acceptance of which generations are deprecated vs monitored | OPEN (EVM contracts are immutable — "deletion" is not an on-chain operation; deprecation = owner-authorized transactions: renounce/transfer/revoke; monitoring plan required for abandoned contracts) |
| 15 | P1 | Scheduler re-registration & integrity post-re-image | Owner/platform provider | Scheduler registry state for jobs 522457/522460 post-2026-11-11T00:20Z re-image (EXTERIOR platform evidence) | OPEN (SEC-P0-IDENT-001 §4; UNVERIFIED whether the platform cron survived the re-image) |
| 16 | P1 | Safe-B replacement estate establishment (B-first stage 1) | Owner + multisig + governance (per SEC-P0-EVMCR-001 §5 matrix) | Approval matrix record; deployment plan preserving the MTQΣ monetary constitution (no parallel supply) | OPEN — PHASE 1 GATED (not authorized by this package) |
| 17 | P1 | Boot-authorization state machine remediation backlog (7 items) | Owner/security-lead | SEC-P0-BOOT-001 §3 state machine + Phase-1 backlog; failure-path evidence | OPEN — PHASE 1 GATED |
| 18 | P1 | API future security requirements implementation (central authn, RBAC, fail-closed rate limiting, LLM budgets, redaction, idempotency, audit logging, automated tests) | Owner/security reviewer | SEC-P0-APIREV-001 §6.4 design; reviewer confirmation of ingress reality first | OPEN — PHASE 1 GATED (documented, NOT implemented) |
| 19 | P1 | Monetary-constitution protection verification for any containment path | Governance + independent reviewer | Reviewer task RT-12 output (signed) | OPEN |
| 20 | P1 | Evidence archive custody transfer OUT of the assessed sandbox | Owner/security custodian | SHA-256 manifest (SEC-P0-EVIDENCE-001) + signed transfer record | OPEN (current custody limitation: the entire evidence set currently lives inside the assessed development environment — documented honestly; no transfer claimed) |

---

## 3. Cross-reference map (evidence per decision)

| Decision # | Primary evidence document (this branch) | Key facts feeding the decision |
|---|---|---|
| 1 | SEC-P0-EVMCR-001 (C) | Fresh role matrix (no drift 2026-10-24→2026-11-11); Option A/B analysis; B-first 5-stage plan; approval matrix |
| 2, 12 | SEC-P0-SOLCR-001 (D) | Superseded mint BOTH authorities SET; current mint at u64 supply ceiling; 4.98 SOL unchanged at slot 521118239; CKPT-2 pending |
| 3 | SEC-P0-EXPOSURE-001 (B) | No-drift exposure battery; 11-check reviewer package; visibility decision brief with explicit limits |
| 4, 11 | SEC-P0-IDENT-001 (G) | Embedded credential present in both clones (redacted); T-1…T-10 owner checklist; rotation sequence (a)–(e) |
| 5, 15 | SEC-P0-IDENT-001 §4 + SEC-P0-BOOT-001 §4 | PLATFORM_REIMAGE_STATE_LOSS matrix; reflog 6 forced checkouts 00:54–00:57Z; scheduler registry unknown |
| 6 | SEC-P0-APIREV-001 (E) | Source-level auth ABSENT (both routes); no middleware repo-wide; fail-open rate limits; four-way ingress classification |
| 7, 17 | SEC-P0-BOOT-001 (F) | `|| true` sites 135/158/159/180; partial-restore exit-0; heal result machine-readable nowhere; 10 questions; state machine |
| 8 | SEC-P0-HANDOFF-001 (H) | Reviewer qualifications; RT-01…RT-12; sign-off rules |
| 9, 20 | SEC-P0-EVIDENCE-001 (A) | SHA-256 manifest; custody procedure; lost-artifact honesty record |
| 10 | This register §2 row 10 + SEC-P0-EXPOSURE-001 §5.8 | Disclosure event record (types only, values redacted) |
| 13 | SEC-P0-EVMCR-001 §3.3 | Robinhood fresh probes; non-Safe determination; hex collisions |
| 14 | SEC-P0-EVMCR-001 §2 + audit-work/v9-task9 | Multi-generation registry; deprecation ≠ deletion |
| 16 | SEC-P0-EVMCR-001 §4–§5 | B-first stages; prerequisites before "safe" label; constitution constraint |
| 18 | SEC-P0-APIREV-001 §6.4 | 11 documented-not-implemented requirements |
| 19 | SEC-P0-HANDOFF-001 RT-12 | Constitution-protection verification procedure |

---

## 4. Ordering recommendation (non-binding, for owner triage)

1. **Immediately (hours):** rows 3 and 10 — visibility decision + rotation of the disclosed credentials (both are pure owner-side actions; the exposure battery shows the historical objects remain anonymously retrievable and the transcript credentials are now exposed copies).
2. **Days:** rows 1, 2, 4, 11, 12, 13 — chain-state verification by the independent reviewer, then owner containment transactions per the approval matrix.
3. **Before any Phase-1 build:** rows 5, 6, 7, 8, 9, 15 — platform/API/boot/reviewer/custody readiness.
4. **Phase-1 execution (not authorized by this package):** rows 16, 17, 18, 19, 20 completed in sequence.

---

## 5. Final status block

- `P0 CONTAINMENT READINESS — DOCUMENTED`
- `INDEPENDENT REVIEW — REQUIRED`
- `OWNER ACTIONS — OPEN`
- `PHASE 1 — NOT AUTHORIZED`
- `TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED`

Not reported (because none occurred): keys rotated; credentials revoked; permissions migrated; repository made private; independent audit passed; recovery infrastructure remediated; production security achieved.

---

*Companion documents: SEC-P0-EVIDENCE-001 (A), SEC-P0-EXPOSURE-001 (B), SEC-P0-EVMCR-001 (C), SEC-P0-SOLCR-001 (D), SEC-P0-APIREV-001 (E), SEC-P0-BOOT-001 (F), SEC-P0-IDENT-001 (G), SEC-P0-HANDOFF-001 (H), SEC-P0-EXEC-001 (J). All under `security/assessments/phase-0/` on `security/phase-0-review-prep`.*
