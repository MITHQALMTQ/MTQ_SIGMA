# Phase 0 — Executive Summary & Final Acceptance Report

**Program:** MTQΣ Network — Sovereign Security Architecture (assume-breach). **Phase:** 0 — READ-ONLY FORENSIC BASELINE.
**Date:** 2026-11-11T00:20Z–01:0xZ (UTC). **Deliverable set:** all 17 §2 documents in `security/assessments/phase-0/` (this file + 16 companions).
**Release classification (unchanged):** TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED.

---

## A. Executive decision

- **Phase acceptance criteria (§17 Phase 0):** repository/runtime ground truth ✔ (incl. a LIVE platform re-image substitution captured mid-audit); component inventory with six-label classifications ✔; asset & authority inventory with the 10 questions ✔; trust-boundary diagrams (9) ✔; threat model (STRIDE + abuse + economic) ✔; P0/P1/P2/P3 register with full §3 fields ✔; proposed architectures clearly separated from existing ✔; dependency/tool register without installs ✔; phased plan with measurable gates ✔; evidence index (reproducible commands) ✔; forensic baseline preserved without changing application/monetary/deployment/database/signing behavior ✔.
- **Main findings (P0, all OPEN in closure sense):**
  1. **F-0-P0-01** — the estate's entire on-chain authority (3 chains, all roles, 1/1 Safe) is one EOA whose private key is **recoverable from this repository's git history** (verified at commits 2e684d9/2da73fd); rotation documented since 2026-10-24, owner-blocked, unexecuted.
  2. **F-0-P0-02** — the platform re-image state-substitution class struck **during the audit itself** (00:20Z): sandbox rolled to a lineage 2/168 behind origin, dumps stale by ≈19,870 blocks, DBs deleted, scheduler previously wiped 2×; the origin-side plane-5 containment (verified OK through 2026-11-10T23:31:59Z, deficit 19,613→0) is **absent at the substituted HEAD** — Phase 0 deliberately **did not boot** the application (booting = restoring stale state).
  3. **F-0-P0-03** — a single credential domain (sandbox user + embedded push token + single git persona + in-band scheduler + co-located monitoring) governs source, deployment, recovery, scheduler, monitoring, and evidence — the §22 sovereign-authority test answers YES in every domain; 38 automation commits already landed on main without review trace.
- **Critical remaining risks:** as above, plus P1-05 (scheduler persistence not declarative; registration ≠ execution; 15 silent fire failures), P1-04 (supply-chain/CI claims unverifiable), P1-03 (governance inverted at every running layer), P1-02 (anti-deletion heal broken at substituted HEAD), P1-01 (unauthenticated pilot monetary mutations + latent MBG bypass).
- **Phase-0 criteria met?** YES (read-only discipline held; evidence reproducible; no claims beyond evidence per §0.4).
- **Next phase authorized?** **NO — STOP per §21 STEP 10.** Phase 1 requires management approval of architecture direction and remediation priorities. **Gate decision #1 for the approver is the live divergence adjudication** (recommendation: authorize forward-only realignment to origin/main 926ee00, then boot via the origin contract — evidence and rationale in `security-phase-plan.md` §Immediate containment).

## B. Component security matrix (condensed; full per-domain documents)

| Component | Reality | Required control | Impl. status | Test status | Evidence | Residual |
|---|---|---|---|---|---|---|
| Pilot API surface (59 routes) | EXISTING/VERIFIED | transaction-policy boundary | NOT STARTED | — | 2-a report | F-0-P1-01 |
| Pilot monetary engine | EXISTING/VERIFIED (shadow) | invariant enforcement + authz | IMPLEMENTED (invariants) | unit/in-engine | engine.ts map | unauth mutation |
| Devnet chain/consensus/gov | EXISTING/VERIFIED (sim) | monetary firewall | SECURITY TESTED | engine+guard tests | shared.ts:341-350 | sim-scope |
| On-chain v1.2 estate + Safe | EXISTING/VERIFIED | separated authority | NOT STARTED | live reads 2026-10-19 | roles.ts; Safe probe | F-0-P0-01 |
| V2/V3/V4 contracts | PROTOTYPE | councils+timelocks pre-deploy | IMPLEMENTED (source) | forge (partial) | PENDING.json | F-0-P1-03 |
| Recovery/DB integrity (plane-5) | VERIFIED on origin; NOT PRESENT at HEAD | forward-only+guard | SECURITY TESTED (incidents) | live recoveries | ledger/heartbeats | F-0-P0-02/P1-02 |
| Scheduler persistence | platform-only | declarative manifest | NOT STARTED | — | cron evidence | F-0-P1-05 |
| Secret gate (pre-commit+CI) | EXISTING/VERIFIED (local) | fail-closed scanning | SECURITY TESTED (unit) | tests+hook | .githooks wiring | staged-only scope |
| CI/branch protection/SBOM/SLSA | EXISTING/UNVERIFIED → NOT PRESENT | verified release channel | DOCUMENTED | unverifiable | BRANCH-PROTECTION.md | F-0-P1-04 |
| Watchdog v5 | EXISTING/VERIFIED (code, INERT) | fail-closed boot chain | IMPLEMENTED | incident-driven | dev-watchdog.sh | heal-layer skew |
| Monitoring independence | NOT PRESENT (co-located) | out-of-band observer | NOT STARTED | — | §14 analysis | F-0-P0-03 |

## C. Vulnerability register — summary counts: **P0×3 · P1×5 · P2×5 · P3×3; none closed** (details + full §3 fields in `critical-vulnerability-register.md`).

## D. Authorization-path verification (closed / restricted / possible)

- **Closed:** devnet governance cannot touch monetary parameters (code-verified firewall); serverless routes cannot query Neon (enforced check); staging failures refuse-behind dumps (forward-only, tested).
- **Restricted (control exists, incomplete):** pilot engine invariants + rate limits (no authz); MBG fail-closed-by-config; secret gate (content-only); drift-guard BLOCKED-no-realign (origin-side only).
- **Still possible (documented, prioritized):** AP-01 key→chain-total; AP-02 credential→source-substitution; AP-03 reimage→stale-boot (live instance); AP-04 unauth→pilot-state; AP-05 sentinel forgery; AP-06 registry loss; AP-07 single-secret deploy; AP-10 evidence rewrite; AP-11 DoS/tree-dirty.

## E. Adversarial test results — **NONE EXECUTED in Phase 0 (by design — read-only; §15 program defined for Phase 6 with mapping and non-destructive harness requirements).** The 10+ incident timeline in `recovery-and-state-integrity-assessment.md` §3 constitutes *involuntary* production evidence of the re-image class, including this audit's live capture.

## F. Repository & deployment evidence

- **Commit/branch:** this directory committed on evidence branch `security/phase-0-baseline` (from substituted HEAD d6fd5d6, tree-clean, docs-only; pre-commit secret gate ACTIVE and passed; no main mutation; origin/main untouched at 926ee00).
- **Changed paths:** `security/assessments/phase-0/*.md` (17 files) only. **No application/monetary/database/deployment/signing changes** (§21 STEP 10).
- **Deployment verification:** N/A — no deploy performed; last verified runtime = prior-session E2E (2026-11-10T23:31Z, heartbeat OK + browser green); current sandbox deliberately not booted (see A/D).
- **Dependency/provenance:** no installs; lockfile untouched; node_modules pre-existing.

## G. Outstanding work (ownership + measurable acceptance)

1. **Gate decision #1 (approver):** lineage adjudication — authorize forward-only realignment to origin/main 926ee00 and sanctioned boot via origin contract; acceptance = plane-5 heartbeat OK with chainTip ≥ h23846 lineage continuity. *(blocks everything else operationally)*
2. Phase 1 architecture approval (separated-authority design; acceptance = independent reviewer sign-off).
3. Owner-side (outside sandbox): C-045 rotation execution package (D4/D5) — acceptance = live role matrix shows old key holds nothing; GitHub-side attestation of branch protection/secrets/Actions history; `/app/Caddyfile` alignment.
4. Phase 2-7 per `security-phase-plan.md` (each with gate criteria).

## H. Final decision

**PHASE COMPLETE — READY FOR INDEPENDENT REVIEW.** *(Phase 0 deliverables complete and evidence-reproducible; Phase 1 NOT YET AUTHORIZED — awaiting management approval of architecture direction, remediation priorities, and the divergence-adjudication decision; production authorization remains permanently out of scope for this program.)*

---

### Honest limitations (§0.4 close-out)

- CI execution, secret provisioning, branch protection, and external hosting are **unverifiable from inside the sandbox** — treated as UNVERIFIED, not assumed.
- The full ~800-commit git-history secret sweep was not completed within this audit window (targeted verification of the two known compromised literals WAS completed; history-wide sweep scheduled for Phase 2 tooling).
- No runtime behavior was re-executed in the substituted state (deliberate read-only decision); all runtime claims cite either code evidence or the prior-session's verified telemetry.
- This summary, like all Phase-0 documents, was authored by the same AI agent lineage that operates the sandbox — **self-assessment limitation acknowledged (§19: implementer ≠ assessor is NOT satisfied for this Phase 0; independent review is explicitly the next required step).**
