# MTQΣ — TASK 11 · D9: RELEASE-GATE REPORT (evidence-backed — every existing rejection preserved)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

## Overall: **NOT ACCEPTED**

Task 11 performed read-only re-verification and remediation **preparation** only. **No
gate advanced. No gate may be advanced by any software result, audit result, or plan.**
All seven indicators keep exactly their prior statuses; the evidence strings are updated
with Task 11 facts (additively; no prior adverse finding is downgraded or re-labeled).

| # | Release indicator | Status (UNCHANGED) | Evidence (Task-11-updated) |
|---|---|---|---|
| 1 | Build & automated tests | **PARTIAL (software only)** | Software status is reported separately from release status in the app (Task 9 practice, preserved). Passing TypeScript/lint/browser tests does NOT satisfy blockchain authority migration or monetary acceptance (Task 11 §9). No software work was performed in Task 11 beyond evidence tooling (tsc/eslint re-checked: 0 errors). |
| 2 | Contract & architecture verification | **FAIL** | Fresh cell-for-cell re-verification (hashed transport, block-anchored): **both exposed keys remain REAL and fully privileged** (re-derived; 2+6 worktree files; **25/25 commits** now); single-key admin on all 15 AC contracts ×2 chains + both 1/1 Safes + gen-A ownership + Solana mints; allowances all zero (first-time census — no hidden pull-permissions, but no mitigation either); **Redeem-module MINTER proven DORMANT by full-bytecode scan (CORR-6 — narrows Task 10 wording, does not improve the gate)**; Safe infrastructure byte-proven GENUINE (proxy + singleton byte-identical to mainnet canonical v1.4.1 — strengthens authenticity, not configuration: still 1/1); Governor surface remains unassessed (params 1/1/1/1, "MITHQAL Governance", source unpublished); all 18 contracts still lack source identity; 4 live EVM generations + RH twins + fake-Safe rows; Solana mint structurally non-conformant (u64 ceiling at 18 decimals — re-proven) |
| 3 | Economic & quantitative validation | **NOT PERFORMED** | walk-forward not executed; oracle feeds unverified; synthetic-data disclosures stand. NEW pending economic decision: Solana decimals (DEC-3/ECON-DEC-3 — an option requiring approval, not an automatic fix) |
| 4 | Governance approval | **NOT GRANTED** | committee still not constituted (OD-3) — Task 11 defines its provisioning requirements (T-1.1, CKPT-3/4) but creates nothing on-chain; DEC-1..DEC-7 remain open; no permission change was made (correctly — none authorized) |
| 5 | Independent security / legal / Sharia review | **ABSENT** | none exists; none claimed. Task 11 adds the D8 Independent-Reviewer requirement for post-remediation — a requirement, not a review performed |
| 6 | Live-pilot authorization | **NOT AUTHORIZED** | economic eligibility remains disabled; keeper inert; shadow mode enforced — unchanged by Task 11 |
| 7 | Production authorization | **NOT AUTHORIZED** | G0–G7 not-passed posture intact; §25.1 stance enforced app-wide |

## Preserved rejections (verbatim register — none downgraded, none re-labeled)

- **C-041** canonical-generation declaration — OPEN (D6 DEC-1 reserved to governance)
- **C-042** address-book contamination / hex collisions — OPEN (three chains, re-proven incl. RH fake Safe)
- **C-043** genesis-to-Safe custody disproved — OPEN (Safes hold zero of everything, nonce 0)
- **C-044** no EIP-170-deployable source — OPEN (V2 best case 24,718 B over by 142)
- **C-045** exposed private keys — **OPEN, upgraded twice** (Task 10: CONFIRMED REAL ×2; Task 11: re-confirmed, 25/25 commits, one additional transcript exposure PI-3 disclosed)
- **C-046** gen-A self-custodied genesis — OPEN (owner = exposed key, re-probed)
- **C-047** genesis USDC absent — OPEN
- **C-048/C-049** bytecode identities / log-scan limits — standing (identity anchors re-proven byte-exact)
- **OD-35** 1/1 Safe (T-87 demonstrated-failed) — OPEN until K-3/T-1.x..T-3.x execute + D8 passes
- Honest validation verdicts **20 PASS / 9 FAIL / 1 UNVERIFIED** — standing; §23 program — pending
- All §1 standing prohibitions — in force (testnet-only, shadow mode, no reserve transactions)

## Corrections ledger (evidence-preserving)

| ID | Correction | Effect on gates |
|---|---|---|
| CORR-1 (Task 10) | Task 9's "no module holds MINTER_ROLE" — wrong vs its own raw evidence | none — wiring exists, governance still single-key |
| CORR-2/3/4 (Task 10) | RH RPC alive; gen custody located; Solana u64-mint deliberate | none |
| **CORR-5 (Task 11)** | keccak-convention disclosure; all anchors re-hashed under the historical convention — every Task 10 hash reproduced | none (identity continuity proven, not a finding) |
| **CORR-6 (Task 11)** | Task 10's "redeemer can mint" overstated → role DORMANT (no mint path in 6,170 B of bytecode; no proxy to change that) | **none** — a narrowed wording is not a gate improvement; gate 2 remains FAIL for exposure/governance reasons |
| PI-1/PI-2 (Task 11) | probe incidents (malformed constant → FAILED-UNVERIFIED preserved; bad layout parser → jsonParsed) | none — method incidents, no conclusion drawn from bad data |
| PI-3 (Task 11) | argv leak of EVM literal to session transcript (no file contaminated) | exposure disclosure — reinforces, not weakens, C-045 |
| PI-4 (Task 11) | getGuard()/getFallbackHandler() reverts = v1.4.1-normal; singleton byte-proven genuine vs mainnet | strengthens Safe-authenticity evidence; configuration gate unchanged |

## Conditional-acceptance path (unchanged shape; Task 11 adds the executable detail)

K-1 (T-0.1/2) → K-2 (T-0.3, T-0.4-if-attested) → T-1.1 committee → T-1.2–T-1.4 Safe-B +
quorum proof → Phase 2 grants → Phase 3 revokes (T-3.6/7 LAST) → T-3.8 evacuation →
Solana T-4.x per SOL-DEC-1 → D8 Independent-Reviewer verification → K-7 address book →
then and only then: R-03 (DEC-1) → R-04 (DEC-5 genesis) → N-01 sources → N-02 governed
wiring → R-06 size remediation → K-6/DEC-3 Solana representation → full §23 program →
independent reviews → committee gate run.

**Every arrow is an approved-transaction plan. Task 11 executed none of them. The overall
status is NOT ACCEPTED and remains so until the D8-verified completion of that path — and
monetary acceptance additionally requires the §23 program and independent reviews that no
engineering task can substitute.**
