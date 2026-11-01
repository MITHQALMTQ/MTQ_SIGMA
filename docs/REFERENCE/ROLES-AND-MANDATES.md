# MTQΣ — Roles & Mandates Baseline

**Baseline date:** 2026-11-01
**Scope:** The division of labor for the MTQΣ Pilot Command Center — executive/operational mandates, on-chain access roles, governance tiers, sign-off authority, and escalation paths.
**Companion:** `CONTRACTS-BASELINE.md` (estate), `audit-work/COO-RECOMMENDATIONS.md` (the 5 gates).

---

## 1. Operating principle

The platform is operated as a **role-mandated virtual executive team** (the
"Orchestrator" model used across the worklog). Every task is executed under an
explicit role, every role has a written mandate, and every consequential
decision requires the sign-off defined in §5. No individual — including the
deployer EOA on testnet — is a standing exception to the sign-off matrix.

---

## 2. Executive & operational mandates

### COO — Chief Operating Officer
**Owns:** platform truth posture, external communication, production-readiness gates.
- Sole authority to classify the platform's honest status (currently: *candidate for public testing — NOT production-authorized*) and to require the UI to surface it everywhere.
- Owns the 5 production-readiness gates and **will not sign off on mainnet** until all five pass (chain-linking fix, 4 P0 fixes, §23 validation program, independent external audit, genesis + governance documented).
- Approves all external communication language (what we say / what we never say — see `audit-work/COO-RECOMMENDATIONS.md` §7).
- Unilateral powers (already exercised): honest-mask downgrades, audit-finding surfacing in the UI, audit-report linking.

### CTO — Chief Technology Officer
**Owns:** architecture, the reference engine, smart-contract posture, deploy gates.
- Owner of `src/lib/mtq/engine.ts` (the monetary math single source of truth) — constitutional math changes (settlement pricing, index methodology, risk machine) require CTO authorship + owner sign-off.
- Owns the fail-closed deploy guard (C-045-a): `DEPLOYER_PRIVATE_KEY` stays absent from CI until the owner provides a fresh, funded key created outside any AI environment.
- Owns the transport architecture decisions (e.g., the in-process pilot engine + 4s polling pivot over the sandbox-fragile WebSocket service).
- Authorizes repo-wide cleanups only with a citation sweep + zero-loss backup (the Task 34/35 method).

### CFO — Chief Financial Officer
**Owns:** solvency modeling, fee accounting, reserve economics disclosure.
- Owns the RR-decay disclosure and the sustainability narrative (at $1B mints, RR decays toward the hard floor without ongoing rebalancing — must be visible to users).
- Co-owns the Operational Wallet separation fix (fees must not inflate reported RR).

### PM — Project Manager
**Owns:** task intake, sequencing, the worklog, and delivery evidence.
- Every task gets a Task ID, an agent-role attribution, a work log, and a stage summary in `worklog.md`.
- Enforces forward-only git discipline, session-open batteries, and pre-change backups.

### Security / QA Directorate
**Owns:** secret hygiene, fail-closed controls, verification batteries.
- Secret-scan gates (pre-commit + CI), the allowlist, redaction tooling.
- Security suite (32/32) covering release controls and address-book validation.
- Browser E2E verification is **mandatory before declaring any UI task done**
  (rendering + interactivity + responsive + zero console errors).

---

## 3. On-chain AccessControl roles (current, live-verified)

| Role | Holder today | Mandated holder | Gap |
|---|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Deployer EOA | 4/7 Safe (post-rotation) | Rotation blocked on Safe reconfiguration (Gate 5) |
| `MINTER_ROLE` | Deployer EOA | 4/7 Safe / governed minter | Same |
| `PAUSER_ROLE` | Deployer EOA | Risk Council path (4/7) | Same |

**Testnet reality is acceptable for a pilot and documented as such; mainnet is not authorized under 1/1 key control.**

## 4. Governance tiers (blueprint-specified vs. current)

| Tier | Scope | Blueprint authority / timelock | Current implementation |
|---|---|---|---|
| Constitutional | methodology, envelopes | Multi-Sig 7/7 · 90 days | ❌ not implemented (1/1 Safe) |
| Monetary | fees, RR target | DAO vote 51% · 48h | ❌ not implemented |
| Risk | haircuts, thresholds | Risk Council 4/7 · 24h | ❌ not implemented |
| Emergency | pause / eject | Multi-Sig 4/7 · instant | ⚠️ pause() exists, but under single-key control |

The honest-status layer reports exactly this gap (honest mask `0x5A7`-class
overstatements corrected; 4 of 11 blueprint bits not truly implemented).

---

## 5. Sign-off authority matrix

| Decision | Required sign-off |
|---|---|
| Constitutional math change (settlement pricing, index, risk machine) | CTO author + protocol owner |
| Mainnet deployment authorization | COO (5 gates) + CTO + owner |
| Testnet deployment execution | CTO (fail-closed guard) + owner-supplied fresh key |
| Registry/estate change | Owner directive + live re-verification evidence |
| Repo-wide deletion/cleanup | Citation sweep + zero-loss backup + CTO |
| External communication about status | COO |
| Honest-status / truth-posture change | COO |
| New external dependency or credential | Security directorate review + owner |
| Destructive DB operation | Backup + recovery plan + owner authorization |

## 6. Escalation path

1. **Engineer/QA** finds issue → record in the remediation register with severity (P0–P3).
2. **P0/P1** (security, data integrity, core workflow) → CTO + COO immediately; fix before any other feature work; re-verify with tests + browser E2E.
3. **P2** (UX, integration, performance) → scheduled within the current task cycle.
4. **P3** (refinement) → backlog, batched.
5. Anything requiring owner action (keys, credentials, external services) → documented as **BLOCKED** with the precise unblock step — never silently dropped, never faked.

---

## 7. Honesty rules that bind every role

- We never claim a feature works without testing it.
- We never display data we do not actually have (degraded states are labeled).
- We never remove audit history; dispositions are recorded, not erased.
- The honest status is the protocol's most valuable asset — every role protects it.

---

*Baseline established 2026-11-01 (Task 36 audit session). Review trigger: any
governance-layer implementation, role rotation execution, or org change.*
