# Phase 0 — Security Phase Plan (Phases 1–7)

Independently reviewable phases with measurable acceptance criteria. **Phase 0 is complete (this directory); Phase 1+ requires the approval gate (§17) — nothing below has started.** Complexity: S/M/L/XL. Every phase lists the findings it closes and the independent-review requirement (§19: implementer ≠ assessor).

## Phase 1 — Security architecture & trust boundaries (design only) [closes F-0-P0-03 design-part, F-0-P1-01 design-part] — M
Deliverables: separated-authority design (app / transaction-policy / signing / recovery / monitoring / deployment as independent domains with distinct credentials); identity model (human operator, automation bot, reviewer, emergency officer); AI-agent permission matrix (what the agent may NEVER do alone: push security-critical paths, dispatch deploys, modify recovery policy, re-register scheduler without second signal); monetary-invariant enforcement map (§12 register skeleton from engine invariants); emergency-authority charter (narrowly scoped pause ≠ monetary authority).
**Acceptance criteria:** architecture review sign-off by an independent reviewer; every §20-D attack path has a designed closer; no single-identity authority path remains in the target architecture.
Dependencies: none. Complexity M.

## Phase 2 — Developer, AI-agent & software supply chain [closes F-0-P1-04, F-0-P3-01/03; hardens F-0-P0-03] — L
Deliverables: CODEOWNERS + verified branch protection (2-approvals, required checks incl. blocking lint + fixed Slither trigger) evidenced from GitHub side (outside sandbox — owner action); automation identity separation (scoped bot token ≠ agent credential ≠ reviewer); signed commits + SBOM + provenance-attested builds with a documented SLSA gap analysis and progression milestones (§5); secret-provisioning inventory (owner-side attestation of which CI secrets exist + rotation procedures); disclosure channel + triage SLA (closes P3-01).
**Acceptance criteria (gate):** unapproved source/artifact/identity demonstrably cannot reach main (T-3/4/5/6/7 adversarial battery green in a fork); CI evidence readable by an independent reviewer; egress still open documented as accepted substrate residual.
Dependencies: Phase 1 sign-off. Complexity L (external coordination heavy).

## Phase 3 — Transaction, wallet & treasury security [closes F-0-P1-01; executes F-0-P0-01 rotation] — XL
Deliverables: transaction-policy engine (decode-and-validate canonical requests; recipient allowlists; per-tx/aggregate/velocity caps; cooling-off for policy changes; simulation freshness; fail-closed) in front of EVERY monetary mutation (simulate endpoints, issuance, MBG, any future custody op); removal/scoping of `MBG_TESTNET_BYPASS`; custody design (tiers justified by threat model — testnet-scope first: the ONLY asset class today is testnet tokens, so tier-0 custody = the rotated on-chain admin set); **execution of the C-045 rotation program** (fresh funded key → role migration → Safe 4/7 → live role matrix re-verification) — owner-action-dependent; emergency signing suspension + revocation drills under service outage (T-30/T-31).
**Acceptance criteria (gate):** T-9..T-15, T-17/T-30/T-31 green — no single compromised identity (agent, key share, admin) can authorize protected operations; live eth_call matrix shows the old key holds nothing.
Dependencies: Phase 2 (else the rotation lands on an unverifiable channel). Complexity XL.

## Phase 4 — Network, contract & external-system security [closes F-0-P1-03] — L
Deliverables: councils + timelocks DEPLOYED BEFORE the V2/V3 estate (remove DEFAULT_ADMIN bypass or bind admin to timelock; Safe 4/7 first — sequence from Master-E2E owner-blockers); invariant register (§12 full fields incl. negative adversarial tests + runtime monitoring hooks for: price band, turnover cap, LCR, oracle gates, supply accounting, three-book/PBC, INV-A); re-verification line-by-line of the 26 CLAIMED V3 audit fixes (DELIVERABLE-H caveat) with independent re-audit engagement; bridge controls declared as PRE-INTRODUCTION requirements (nothing exists now — §11 set documented as gate condition, not implemented); oracle reference-layer hardening decisions (real-anchor roadmap vs disclosed-sim status quo).
**Acceptance criteria (gate):** T-16/T-17/T-18/T-20/T-23/T-24 green on fork harnesses; invariant register complete with bypass analysis; independent audit evidence.
Dependencies: Phase 3 (rotated authority). Complexity L.

## Phase 5 — Infrastructure & operational resilience [closes F-0-P0-02 containment-part, F-0-P1-02, F-0-P1-05, F-0-P2-01/02/04] — L
Deliverables: head-only boot rule enforced from origin (never boot unadjudicated divergence — plane-5 contract pinned; watchdog refuses boot when heal layer absent — remove `|| true`); declarative scheduler manifest (§13.3 fields) + post-reimage auto-validation + dead-man alert for consecutive failed fires; lineage-adjudication runbook with evidence-freeze; rate-limit completion (9 uncovered routes) + XFF-spoof posture decision (enforce gateway-only ingress or accept-with-monitoring — documented either way); running `/app/Caddyfile` alignment (platform owner action); doc/code single-source-of-truth (battery numbering, watchdog header claims) with CI doc assertions; `/api/validation` cache relocated out of tree.
**Acceptance criteria (gate):** T-25..T-29 green (snapshot substitution, DB rollback, reimage state loss, registry loss, concurrent recovery/publish races); re-image drill on a harness sandbox shows BLOCKED-not-boot → authorized recovery → independent verification; scheduler manifest round-trip demonstrated after a simulated wipe.
Dependencies: Phase 2. Complexity L.

## Phase 6 — Adversarial validation program (full §15 battery, non-destructive) — L
Execute T-1..T-31 mapped to this system's reality (NOT-APPLICABLE entries documented with re-test triggers, e.g. bridges/7702). Remediate findings, retest independently.
**Acceptance criteria (gate):** no unresolved critical issue for the requested testnet scope; all residual risks formally accepted by the authorized reviewer.
Dependencies: Phases 2-5. Complexity L.

## Phase 7 — Controlled testnet authorization assessment — M
Evidence package + independent assessment; authorize ONLY capabilities that passed their gates (e.g.: pilot-terminal + devnet + rotated on-chain estate with councils; NOT custody of real value, NOT bridges, NOT production). §18 status labels assigned per control; PRODUCTION AUTHORIZED never assigned by this program.

## Sequencing rationale (why this order)

F-0-P0-03 (single credential domain) must fall FIRST — every other control lands through the push channel it owns (Phase 2 before 3/4/5). F-0-P0-01 (key rotation) is owner-blocked today; the plan sequences its EXECUTION into Phase 3 so the new authority lands inside an already-hardened release channel. F-0-P0-02's containment upgrades are Phase 5 because the origin-side plane-5 chain already provides interim containment — but note **the interim containment is absent at the substituted HEAD; the FIRST Phase-1 action item is the lineage adjudication decision (approval gate), not code**.

## Immediate containment recommendations (gate decision #1, before Phase 1)

1. **Adjudicate the live divergence:** authorize forward-only realignment of the sandbox to origin/main 926ee00 (the two local commits are a content-subsumed task46 line preserved on origin/backup-incident10-amend + one UUID telemetry commit recoverable verbatim), THEN boot via the origin contract. (Evidence and procedure: this directory; plane-5 bootstrap guard already classifies BLOCKED — the human gate is what it waits for.)
2. Keep scheduler jobs 522460/522457 registered (registry survived); note their fires currently execute the guard only → BLOCKED relays (safe).
3. Do NOT rotate/delete any credential or rewrite history as Phase-0 work (owner-action items, documented in register).
