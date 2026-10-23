# MTQΣ — TASK 12 · D6: CANONICAL-ARCHITECTURE VALIDATION (address book + deployment inventory)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

Implemented tooling: `src/lib/mtq/address-book-validation.ts` (+ tests, +
live exposure via `/api/release-state`). This module is the mandated
implementation of Task 12 §5. **It never auto-selects a canonical generation
and never deletes conflicting evidence — findings are surfaced, records kept.**

---

## 1. The six distinctions (implemented as classifications)

| Classification | Meaning | Where it applies today |
|---|---|---|
| **CANONICAL-CANDIDATE** | proposed canonical (owner's "WHAT YOU HAVE NOW"), NOT governance-approved | the 4 CANONICAL_MTQ_ADDRESSES entries (Monad/Arc/RH/Solana) |
| **CURRENT-UNAPPROVED** | live, wired, source/build identity UNVERIFIED | all 18+ registry deployment rows |
| **SUPERSEDED** | provenance-only generations (retained, never deleted) | gen-A `0x0Ac2…`/`0x2420…`, `2EaK5c…` |
| **DUPLICATE-CONFLICT** | same hex on multiple chains/roles → per-chain verification required | see §3 |
| **UNVERIFIED** | zero-address/pending/missing-chainId rows | Base + Arbitrum pending rows |
| **APPROVED-CANONICAL** | explicit governance declaration | **NONE — zero rows; the decision is pending by design** |

## 2. Automated validation rules (all reject-side; all tested)

| Rule | Severity | Current count | Example finding |
|---|---|---|---|
| `cross-chain-hex-reuse` (with role conflict) | **BLOCKER** | 2 | **RH "Takaful" `0x1bbC…6177` == Monad "Reserve"** (same hex, different semantic role, different chains); **RH "MockUSDC" `0xFd2B…861e` == Arc "Oracle"** |
| `cross-chain-hex-reuse` (same role, needs per-chain verification) | MAJOR | 2 | Safe `0xE718…A7D0` on Monad+Arc (distinct instances, same config — needs per-chain identity proof); Governance `0xE35a…Bd66` on Monad+Arc (**different runtime bytecode at the same address** — two contracts share one address-book row) |
| `explicit-canonical-flag-without-governance-approval` | MAJOR | 1 | Robinhood MTQToken row carries `canonical: true` — recorded as CANDIDATE ONLY; the flag is not approval |
| `testnet-only-posture-vs-mainnet-rows` | MAJOR | 2 | Base (8453) + Arbitrum One (42161) listed while the posture is TESTNET-ONLY — deployment remains an unauthorized action |
| `zero-address-placeholder` | MAJOR | 2 | Base/Arbitrum "pending deploy" rows |
| `conflicting-canonical-entries` | BLOCKER | 0 today (fires if two candidates ever share a chainId) | — |
| `missing-chain-id` | BLOCKER | 0 today | — |

**Validator verdict today: `ok=false` (2 BLOCKERs) — this is the honest state.**
A green result would require resolving the cross-chain conflicts via
per-chain independent verification AND a governance decision — not a code change.

## 3. Deployment inventory — source/build identity status (carried forward, unchanged)

- **The 18 current-estate deployed contracts** (9 Monad `0x9e6E…`/`0xE35a…`/`0xE718…`/`0x8839…`/`0x1bbC…`/`0x197e…`/`0x9632…`/`0xDfcA…`/`0x3eC2…` + 9 Arc `0x237c…`/…) are **UNVERIFIED** as source/build identity until each deployed runtime is reconciled to compiler settings, source, libraries, immutable values, and reproducible build artifacts (Task 10 D3 matrix; Task 11 identity anchors reproduce CODE anchors byte-exactly — that proves deployed-code stability, NOT source provenance).
- **A matching bytecode size, contract name, selector list, or deployment address alone is INSUFFICIENT** — recorded as standing policy; no row is upgraded to "verified" on such evidence.
- **The Redeem-module finding is preserved OPEN** per Task 11.1: the Monad Redeem token-MINTER grant is unusable **by the module's deployed code at the recorded anchors** (complete six-site call-graph enumeration + shift-reconstructed-selector scan + one-level indirection closure), but the grant ORIGIN is unexplained (requires source — N-01) and the module-side custom role cells (E-15/E-16) remain UNVERIFIED. No categorical safety claim is made; disposition = T-3.1 revoke by Safe-B (D4).
- The Governor pair (same hex, two builds) remains the standing example of why same-address rows must be verified per chain.

## 4. Canonical decision state

**UNSELECTED.** Candidates exist (4); approvals none (0); the selection is
reserved to constituted governance (DEC-1…DEC-7, carried from Task 10/11 D6).
The validator reports `canonicalDecisionPending=true` until a governance
declaration exists; nothing in the app, tests, or tooling may promote a
candidate automatically (asserted by `address-book-validation.test.ts`).

## 5. Evidence & reproduction

- Module: `src/lib/mtq/address-book-validation.ts`; tests: `src/lib/mtq/__tests__/address-book-validation.test.ts` (**12/12 PASS**); live output: `GET /api/release-state` (`addressBookValidation` block).
- Fresh chain-state anchors for the inventory rows: `evidence/fresh-anchors-task12.json` (Monad 73,243,944 / Arc 68,520,264 / RH 140,748,341 / Solana 513,885,476 — all cells identical to Task 11).
- Registry source of truth: `src/lib/mtq/contracts.ts` (addresses untouched by Task 12 — only classifications/rules were ADDED; historical records remain traceable).

**Canonical architecture remains UNSELECTED. NOT ACCEPTED.**
