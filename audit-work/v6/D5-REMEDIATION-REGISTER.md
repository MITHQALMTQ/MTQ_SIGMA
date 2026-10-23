# D-5 — GATE-BY-GATE REMEDIATION REGISTER (OWNERS · DEPENDENCIES · EVIDENCE · APPROVAL AUTHORITIES)

**MTQΣ — Evidence Reconciliation and Pre-Remediation Control Directive (§7.5)**
This is a **plan for authorization**, not an authorization. Every on-chain item below remains **PROHIBITED until its transaction plan is reviewed and expressly approved** by the named authority, per directive §1. No item was executed.

**Global preconditions (apply to every on-chain item):** C-045 key exposure is open ⇒ **no asset movement of any kind until R-01 completes**; all actions in testnet-only scope; shadow posture unchanged; every action produces a reviewable transaction plan (template at the end) BEFORE execution.

---

## Part 1 — Remediation items

| ID | Item | Finding refs | Owner | Depends on | Evidence required to close | Approval authority | On-chain? |
|---|---|---|---|---|---|---|---|
| **R-01** | **Purge committed private-key literal + rotate the deployer key** — remove `scripts/verify-key-and-audit-roles.ts:5` literal (and audit repo history strategy), generate a NEW key in secure storage (HSM/managed wallet), fund it with gas via a plan, then move admin control. | **C-045 (CRITICAL)** | Project owner + security lead | none (FIRST) | (a) secret-scan of repo history post-purge; (b) new address recorded; (c) rotation transaction plan executed + receipts; (d) re-run custody probes showing new ownership | Project owner + Security auditor sign-off | **YES (rotation txs)** — plan first |
| **R-02** | **Reconfigure Genesis Reserve Safe to 4/7** — add 7 Constitutional signers, threshold 4, consider guard + modules per mandate; then re-run `scripts/verify-safe.ts` for "VERIFIED 4/7" | OD-35, T-87, C-040 | Governance + Security auditor | R-01 (a 1/1 Safe must not be reconfigured while its key is public), OD-3 (signers must be constituted humans) | on-chain reads: threshold=4, owners=7 (attested signers), nonce increment recorded, new probe JSON committed | Governance (constituted committee per OD-3) | **YES** — plan first |
| **R-03** | **Declare the canonical MTQ contract per chain** | C-041, C-044; D-3 (draft) | Constituted governance (OD-3) | R-01; D-3 review | signed address-book decision recorded in repo (resolution of C-041); address book updated in ONE place with cross-chain contamination removed | Governance + Project owner | No (declaration), but unlocks R-04 |
| **R-04** | **Transfer/jettison genesis supply to the 4/7 Safe** — per approved plan: canonical-token 1M → Safe; resolve candidate-C self-custody (1M inside token contracts) and candidate-B deployer holdings; USDC 1.1M → designated reserve custodian | C-043, C-046, C-047 | Governance + Project owner | R-01, R-02, R-03 | executed tx refs; re-run `verify-safe-balances.ts` + `verify-usdc-custody.ts` showing Safe/reserve custody > 0 and deployer share per plan | Governance (written, per Gate-5 rules) | **YES** — plan first |
| **R-05** | **Key-rotation rehearsal on the declared canonical token only** (T-35 prerequisite) | T-35, C-041 | Smart-contract lead | R-01..R-04 | rehearsal logs + role-change evidence on canonical contract only | Project owner | **YES** — plan first |
| **R-06** | **Contract-size remediation** — select one D-4 option (A/B/C/E), implement, compile ≤ 24,576 B, full §4 execution matrix green in reproducible CI | C-044, OD-37, T-88; D-4 | Smart-contract lead + independent reviewer | R-03 (token identity/feature scope decision); OD-37-scope or OD-16 decision where applicable | reproducible build (keccak-hashed) + green Foundry run logs + independent security review report | Committee + Legal (OD-37 scope) / Constitutional Council (OD-16 if upgradeable) | No (build only); deployment is separate item |
| **R-07** | **Deploy remediated token (testnet)** | C-044 | Smart-contract lead | R-06 + approved deploy plan | deployment record (address, tx, block, bytecode keccak, constructor args) matching D-1 manifest format; address-book update in one place | Project owner (testnet scope) | **YES** — plan first |
| **R-08** | **Resolve Foundry failure caches** — re-run the 4 fuzz counterexamples + reentrancy test in protocol-owner env; fix or refute with evidence | D-4 E-17/E-18, D-6 #7 | Smart-contract lead | forge environment | passing run logs (or documented refutation) committed; caches annotated | Project owner | No |
| **R-09** | **Oracle real-feed verification** — obtain published Oracle.sol ABI or re-deploy with published source; verify real vs. mock; wire ≥3 independent families (Chainlink/Pyth/Chronicle) per §17.10; test stale/divergent/depeg/malformed behaviors | OD-34; D-1 §6.3 | Smart-contract lead + Risk Council | R-07 (for re-deploy path) | per-chain feed config registry with real addresses; behavioral test logs; health-state transition evidence | Risk Council (Gate-2 acceptance) | Possibly (adapter deploys) — plan first |
| **R-10** | **Quantitative validation program** — constitute Committee (OD-3), approve OD-1/OD-2/OD-5 + acceptance criteria, execute the D-1 §6.2 walk-forward protocol (≥250 OOS evals, leakage controls, baselines, adversarial regimes) | OD-1/2/3/5, Gate-1/3 | Quantitative Committee | OD-3 constitution | approved protocol + results dossier + committee sign-off (acceptance ≠ authorization) | Quantitative Committee | No |
| **R-11** | **Repository remote + CI** (per D-1 §7) — purge C-045 BEFORE first push; private hosted repo; protected branches; lint/typecheck/suites/size-gate/secret-scan CI; evidence-tag policy | D-1 §7, C-045 | Project owner | R-01 (purge first!) | remote URL + access list + CI green runs + evidence tags | Project owner | No |
| **R-12** | **Archive-grade log access** — obtain explorer/archive data (or operator-supplied event exports) for full Transfer/history reconciliation on both chains; close the "cannot be established" list (D-2 §5) | D-2 §5, D-6 #12 | Project owner + auditor | none | complete event-history dossier; explanation of 3-wei dust + 1.000000000000000003 MTQ (or documented unexplainable) | Project owner | No (read-only) |
| **R-13** | **Probe Robinhood (46630) + Solana devnet** — full read-only inventory (tokens, "Safe", roles, supplies) mirroring the Monad/Arc probes; resolve the two conflicting Solana records and the unprobed entries (`0x5C72…` Arc, `0xaf7c…` Robinhood) | D-3 §3/§4, D-6 #13/#14 | Verification engineer | none (read-only) | probe JSONs + address-book update draft | Project owner | No (read-only) |
| **R-14** | **Per-chain EIP-170 enforcement confirmation** — authoritative chain docs or a single authorized probe-deploy of an intentionally-oversized contract (one per chain) | D-4 §2 | Smart-contract lead | explicit approval | documented per-chain limit; probe-deploy tx + result (if approved) | Project owner (testnet) | **YES (probe only, if approved)** — plan first |
| **R-15** | **Docs/record hygiene** — fix stale references: MANDATE-COMPLIANCE OD-35 label; audit-package README counts; dead RPC + divergent explorer URLs; DEPLOYMENT-RECORD HEAD pointer; CRITICAL-PRIVATE-KEY-ROTATION.md chain-row mis-associations; `bun test` no-op script; add commit-message conventions | D-1 §2, D-6 #3–#6 | Verification engineer | none | PR with the exact diff + review | Project owner | No |
| **R-16** | **Genesis-sequence correction** — after R-04, re-verify Ch. 20.1 steps 4–5 against live state; record corrected genesis evidence (USDC custody, MTQ custody, denominator 1.0000) | C-043/C-046/C-047, T-85 | Verification engineer | R-04 | fresh custody probes + corrected narrative committed | Project owner | No |

## Part 2 — Gate-by-gate remediation map (mandate §0.5 gates; nothing advances without the cited evidence)

| Gate | Blockers (findings) | Remediation items required before the gate can be assessed | Approval authority for the gate |
|---|---|---|---|
| **Gate 1 (closure)** | OD-1/2/3/5 OPEN; 43+ conflicts (C-041/042/043/044/045/046/047…); J(s) candidate-only | R-03, R-10 (committee approvals), C-register dispositions, R-15 | Committee + Project owner |
| **Gate 2 (shadow)** | OD-34 real-vs-mock UNDETERMINED; feeds unwired | R-09 (shadow acceptance), 30-day coverage evidence | Risk Council |
| **Gate 3 (quant/technical)** | walk-forward not executed; 26 OOS insufficient; synthetic-data backtest only | R-10 full program + R-06/R-08 (execution matrix green) | Quantitative Committee |
| **Gate 4 (shadow acceptance)** | depends on Gate 3 + ≥30-day shadow window + coverage criteria | Gate-3 items + coverage report | Risk Council + Committee |
| **Gate 5 (limited live pilot)** | **OD-35 1/1 Safe; C-043 zero custody; C-045 key exposure; C-046 self-custody; C-047 USDC in EOA** | **R-01 → R-02 → R-03 → R-04 (+ R-05), R-06/R-07 (deployable corrected token), OD-6/OD-7/OD-13 approvals** | Governance (written, separate approval per §0.5) |
| **Gate 6 (production)** | all of the above + independent security review (none exists) | R-06 independent review + full dossier resubmission | Governance |
| **Gate 7 (Solana/multichain)** | Solana records unverified | R-13 + OD-9/OD-10 | Separate release decision |

## Part 3 — Transaction-plan template (mandatory for every on-chain item per directive §1)

For any R-item marked "plan first", the plan MUST contain, before execution is requested:
1. **Purpose** and the remediation item it closes (R-xx, finding refs).
2. **Chain(s), chainId(s)** asserted against RPC at execution time; target block-range context.
3. **From-address** (signer), **to-address(es)**, **calldata (ABI-decoded + raw hex)**, value, gas params.
4. **Expected state changes** — exact storage effects, balances before/after (from read-only probes).
5. **Risks** — failure modes, revert conditions, blast radius, MEV/nonce considerations.
6. **Recovery plan** — rollback/compensation path, emergency contacts, Safe-based timelock where applicable.
7. **Required approvals** — named authority sign-off(s) recorded in-repo before execution.
8. **Post-execution evidence** — tx hashes, receipts, block numbers, and the re-run probe scripts that must show the expected post-state (committed to git as evidence round).

---
*No item in this register was executed. The register exists to convert the NOT-ACCEPTED state into an auditable authorization path. The current state remains: **production reserve trading NOT AUTHORIZED; all gates NOT ADVANCED.***
