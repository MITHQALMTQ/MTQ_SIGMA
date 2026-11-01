# MTQΣ Reference Library

**Purpose:** Always-available baseline reference documents for the MTQΣ Pilot
Command Center. These documents are the stable, human-readable baseline for
(1) the deployed contract estate and (2) the role & mandate division of labor.

**Status:** Testnet pilot · Candidate for public testing · NOT production-authorized.

---

## Contents

| Document | What it holds | Authority |
|---|---|---|
| [`CONTRACTS-BASELINE.md`](./CONTRACTS-BASELINE.md) | The complete deployed estate: all 19 contracts across Monad Testnet / Arc Testnet / Solana devnet, deployer wallets, AccessControl roles, the 7-command operator reference, known findings affecting the estate, and the change protocol. | Snapshot of the runtime registries (`src/lib/mtq/contracts.ts`, `src/lib/mtq/roles.ts`) — those files remain the **single source of truth**; this doc is the dated human-readable baseline. |
| [`ROLES-AND-MANDATES.md`](./ROLES-AND-MANDATES.md) | The full role division: executive/operational mandates (COO / CTO / CFO / PM / Security), on-chain AccessControl roles, the 4-tier governance hierarchy (blueprint-specified vs. current reality), sign-off authority matrix, and escalation paths. | Derived from the blueprint (§21), the audit corpus (`audit-work/`), and the org structure used across the worklog. |

---

## How to use this library

- **"What is deployed right now?"** → open `CONTRACTS-BASELINE.md`, §2–§4.
  For live verification, use the app's **Contracts**, **Authorization Audit**, and
  **Networks** sections (they read the live registries and re-verify on-chain).
- **"Who decides / who signs off?"** → open `ROLES-AND-MANDATES.md`, §5–§6.
- **"How does the baseline change?"** → see `CONTRACTS-BASELINE.md`, §7
  (change protocol: owner directive → registry update → live re-verification →
  dated addendum here + `docs/DEPLOYMENT-RECORD.md`).

## Related authoritative documents

- `docs/DEPLOYMENT-RECORD.md` — chronological deployment record & addenda
- `docs/governance/UPGRADEABILITY.md` — the V2 upgrade path
- `docs/ops/ROLE_ROTATION.md` — key rotation plan (Gate 5)
- `docs/SECURITY.md`, `RUNBOOK.md` — security posture & operations
- `audit-work/COO-RECOMMENDATIONS.md` — the 5 production-readiness gates

---

*Baseline established 2026-11-01 (Task 36 audit session). Next scheduled review:
upon any registry change or the next owner estate directive.*
