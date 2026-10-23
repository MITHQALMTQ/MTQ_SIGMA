# MTQΣ — No-Reserve Model: Compatibility & Migration (MANDATE-006 §16.7)

**Document ID:** MTQSIGMA-T13-NORESERVE · **Date:** 22 October 2026
**Mandate:** MTQSIGMA-COO-MANDATE-006 §8 (Monetary semantics, reserve assumptions, and holder rights), §16.7
**Companion specifications:** `mtqsigma-v3-no-reserve-economic-spec.md` (deliverable 3 — the master v3.0 architecture + the 14-row reserve-removal plan, PROPOSED) · `baseline-and-change-matrix.md` §6 (the reserve-dependence inventory with file:line citations) · `security-remediation-and-release-gates.md` (the migration-approval chain). This document reconciles compatibility and migration; it changes nothing.
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**

---

## 1. The premise (SPECIFIED — owner direction)

The target concept is an **adaptive currency-and-gold reference methodology intended to improve purchasing-power resilience — not a fixed-price peg.** The earlier design contains substantial reserve-backed and redemption-related assumptions. The proposed v3.0 model must **not inherit those obligations silently** (MANDATE-006 §8).

## 2. Reserve-dependent legacy assumptions — inventory and what breaks (VERIFIED inventory; disposition PROPOSED)

Full file:line inventory: `baseline-and-change-matrix.md` §6; module-by-module replacement plan: `mtqsigma-v3-no-reserve-economic-spec.md` §3 (14-row plan). Summary of what is load-bearing today:

| Legacy component | Reserve dependence | What breaks if removed silently |
|---|---|---|
| `proof-of-reserve.ts` | RR = backing/liability; custodian allowlist; Chainlink PoR stub (throws); pilot synthesizes attestation (hard-coded 80/18/0.02) | PoR status surface; the RR input to solvency states |
| `protected-backing-cell.ts` (§47) | AvailableBacking = Recognized − Encumbered − Allocated; `maxMtqIssuanceUsd = availableBacking/1.30` | **Issuance capacity — the ONLY mechanism computing it today** |
| `mtq-final-reserve-spec.ts` | RR 130/105/100 canon; sleeves 80/18/2; DMCE grossCapacity = verifiedBacking/1.30; DRQS/TGRS/BRI/SAE | The controlling MITHQAL-family issuance/solvency canon (C-INV-1 fork vs blueprint RR 1.10) |
| `available-backing-certificate.ts` | ABC → V3 BM-11 gate | The V3 bank-mediated workflow's issuance gate |
| `genesis.ts` | 1.1M USDC genesis funding; RR 1.10 | The genesis story — **already DISPROVEN on-chain** (supplies 310.949/1,000; Safe holds 0) |
| `engine.ts` | ReserveState 10-token vault (incl. PAXG/XAUT); NAV V_net; LCR; `applyMint` = basket acquisition; `applyRedeem` = proportional liquidation; MARP gold↔stable trades | Mint/redeem pricing (NAV-based); solvency states S1–S6 keyed on RR; LCR mint-pause; MARP rebalancing |
| `finality-before-mint.ts` | 7-layer gate whose L3 input is reserve sufficiency | The finality-before-mint chain |
| Contracts V2/V3/v1.2 | V2 `reserveVault` + `reserveHeldUsd[7]` + `getReserveRatio/getLCR` + USDC-pull mint + proportional redeem; V3 stability pool (sole USDC custody, EMERGENCY deficit cover); v1.2 vault-balance economics | Contract-level reserve mirrors and the deployed pilot's entire economic behavior |
| Docs/blueprint | RR-decay solvency model (DELIVERABLE-F), gold reserve core+buffer, redemption-at-NAV (I6), custody attestations, 1.30-vs-1.10 canon conflict (C-INV-1) | The reserve-era narrative the v3.0 program replaces |

**Mandate rule (§8.1):** if the owner selects the no-conventional-reserve design, reserve-dependent logic must be **removed or redesigned consistently** — never merely renamed. **Do not rename reserves, collateral, NAV, or redemption fields.** Do not claim full collateralization, reserve adequacy, or asset backing unless qualifying assets and enforceable obligations genuinely exist and have been verified. **Reference-index gold exposure stays separate from gold collateral or actual gold holdings** (today's pilot separation is accounting-only: one physical PAXG+XAUT pot serving both an index leg and a reserve role — the Stage-D gap to resolve).

## 3. Compatibilities that CANNOT be parameterized away (recorded incompatibilities)

1. **Deployed v1.2 estate:** fixed 5-currency arrays, admin-set prices, vault-balance economics, escrow-not-burn redeem, no supply cap, all authorities → compromised EOA R-1. **Incompatible with dynamic constituency and with no-reserve semantics.** Documented; disposition is D-13.22 (re-label testnet-only legacy / decommission-and-replace / leave-with-disclosures) — and no alteration or migration without separate approval plus the Task 12 authority chain.
2. **V2/V3 source-ready contracts:** fixed `bytes3[7]`/`uint256[7]`, immutable quantities, positive-weights-only submission, `reserveHeldUsd[7]` mirrors. A registry-based dynamic-membership design and a no-reserve supply model are **contract redesigns, not parameterizations** — the v3.0 clean-slate program (D-13.4 proposed) is the proposed replacement path; a versioned-upgrade plan for any surviving element would require its own design + security review + approvals.
3. **Solvency/issuance machinery:** RR/S1–S6/LCR/DMCE/PBC→ABC have **no v3.0 replacement yet** — issuance capacity and solvency semantics become undefined until the owner selects the supply policy (D-13.6) and the model family (D-13.3/D-13.4). This is why the v3.0 spec is CONDITIONAL on Gate B.

## 4. Holder-rights consequences (§8.2 cross-reference)

Under the no-reserve candidate model: no backing claims, no redemption promise, no NAV-based exit — the alternatives and their obligations are in `issuance-burn-and-supply-policy-options.md` §5 (D-13.7 OPEN). Interface language must never imply the removed obligations survive in renamed form.

## 5. Migration sequencing constraints (nothing executes without approvals)

1. **Gate B first** (D-13.3–D-13.7): the model family and semantics decide what the replacement architecture even is.
2. **The 14-row reserve-removal plan** (`mtqsigma-v3-no-reserve-economic-spec.md` §3) then executes repo-side as proposals → implementations, per module, each with tests.
3. **Legacy MARP trading and reserve-management machinery** is retained in the reference layer and the (undeployed) contract sources until an approved migration plan removes or redesigns it — **no removal from any deployed system occurs without an approved migration and security plan** (MANDATE-006 §4.3). The deployed pilot is untouched (read-only posture; D-13.22).
4. **Any on-chain step** additionally requires the Task 12 D8 chain (OWNER-ATT-1 → … → RELEASE-GRANTS) and is forbidden in the interim (shadow mode).
5. **Git history and forensic records** remain append-only; the reserve-era documents are preserved as the historical baseline (v2.0 not modified).

## 6. Honest status

| Item | Status |
|---|---|
| Reserve-dependence inventory | `VERIFIED` (baseline §6, file:line) |
| Removal/replacement plan | `SPECIFIED` (PROPOSED — v3.0 spec §3, 14 rows; gated on Gate B) |
| v3.0 no-reserve implementation | `NOT IMPLEMENTED` — no v3.0 code exists |
| Deployed-estate migration | `UNVERIFIED/OPEN` — D-13.22 + Task 12 chain; zero on-chain actions taken |
| Backing/collateralization claims | **Prohibited** — no qualifying assets or enforceable obligations verified to exist |
| Gold collateral vs reference separation | Accounting-only today; full separation is part of the v3.0 design (D-13.12) |

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**
