# MTQΣ — TASK 10 · D6: SPECIFICATION DISCREPANCIES & PROPOSED RESOLUTIONS

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**
Each row: the discrepancy (verbatim finding), the evidence, the proposed resolution — **a proposal only;
nothing is executed; every on-chain step requires written human approval.** Prior findings preserved,
none downgraded.

| # | Discrepancy | Evidence (2026-10-22 unless noted) | Proposed resolution | Approval |
|---|---|---|---|---|
| D6-1 | Token identity: mandate names **MTQΣ**; the owner-declared canonical tokens are named **"MITHQAL"** (both chains, probed `name()`); a third name "MTQ Sigma" exists on Arc gen-A | `name()` probes; D2 §1 | Fold into the C-041 canonical declaration: either accept MITHQAL formally or adopt a mandate-named generation after rotation | Governance (C-041) |
| D6-2 | Genesis supply: mandate 1,000,000 → Safe; live supplies are **310.949 / 1,000**, 100% in the deployer EOA | D5 §2 | Approve one of: (a) complete genesis on current set post-rotation (mint to a re-configured 4/7 Safe + canonical events), or (b) conformant redeploy (R-06 first). Never "top up" under the exposed key | Governance |
| D6-3 | Genesis event semantics: constructor-set balances, **zero Transfer-from-zero events** (Arc RPC-scanned; App D.2 requirement) | Task 9 + fresh supply invariance | N-04: require canonical genesis events on any future deployment; do not retrofit by transaction now | SC lead |
| D6-4 | Safe mandate 4/7 vs live **1/1, nonce 0, sole owner = deployer** (both chains) | re-probed: threshold 1, owners [deployer], VERSION 1.4.1 | R-02 transaction plan (add 7 owners, threshold 4, guard) sequenced AFTER key rotation K-3 | Owner + committee |
| D6-5 | Mint wiring EXISTS (Mint module holds MINTER on both tokens — Task 9 report erred), but governance does not: all gates resolve to the single deployer key; **Monad Redeem.sol also holds MINTER (anomaly)** | CORR-1 + fresh role matrix | Re-scope N-02: committee-govern the wiring; disposition the Redeem mint authority (revoke-plan or documented justification) | Governance |
| D6-6 | Governance: same address, **two different Governor implementations** (25,819 B / 50 sels vs 13,129 B / 74 sels); proposer/executor auth UNESTABLISHABLE; Monad build exceeds EIP-170 | D3 §1–2 | Split address-book rows (D2 §3); publish sources (N-01) before any governance activation; size remediation (R-06) before any portability claim | Owner + SC |
| D6-7 | **Two exposed key literals** (EVM deployer + Solana 4saT) in repo + worklog + all 24 git commits; both live-privileged | D1 | K-1/K-2 purge + history rewrite + credential rotation; K-3/K-4 sequenced key rotation plans | Owner (P0) |
| D6-8 | Solana mint **structurally non-conformant**: decimals 18 + u64 supply ⇒ max 18.446744073709551615 whole tokens; live supply = u64-max (deliberate mintTo(u64::MAX) by DbFjz); scripted 10B×10¹⁸ plan would overflow-revert | D5 §4 | K-6: choose decimals ≤ 9 (or alternate representation) BEFORE any redeploy; never execute the current fresh-mint script as written | Owner + committee |
| D6-9 | Address-book contamination: fake "Safe" rows on 3 chains (Monad Ecosystem "Safe" 0x7435…, Arc Ecosystem "Safe" = 0xDfcA66ac…B713 which is Monad's CURRENT Oracle hex, Robinhood "Safe" 0xa3CE… — all revert on Safe ABI); rotation doc chain-row mis-associations (CRITICAL-PRIVATE-KEY-ROTATION.md maps current-Monad→Arc, current-Arc→Robinhood, superseded Solana mint→current) | manifest JSONs + fresh probes; Task 9 C-042; this session's RH probes | N-03: adopt D2 (three-tier book); rewrite the rotation doc; mark fake-Safe rows non-Safe | Project owner |
| D6-10 | Robinhood set: believed dead (R-15) — RPC is **ALIVE**; its "Safe" is fake; MTQToken/MTQSigma are byte-twins of gen-B/gen-A | CORR-2; onchain-robinhood.json | Keep as Tier-3 provenance; explicitly decommission or annotate; never treat as part of the active estate | Owner |
| D6-11 | Contract-size remediation unresolved with contradictory claims: V2 30,608 B, V3 38,921 B, best-case-viaIR 24,718 B (**over by 142**, C-044) vs PENDING manifest claim "23,220 B" that **matches no git source** | foundry artifacts; MTQSigmaV2-PENDING.json | R-06: one reproducible ≤24,576 B build, committed, green Foundry run; delete or prove the 23,220 claim | SC lead + reviewer |
| D6-12 | No deployed contract matches ANY local build; explorers unverified (Arc `is_verified:false`; Monadscan CF-gated) → all 18 deployed contracts have **no established source identity** | D3 §1 | N-01 owner action: publish+verify both explorers; then re-run D3 matrix and close the UNESTABLISHABLE rows | Project owner |
| D6-13 | Oracle feeds unverifiable (OD-34): Oracle contracts exist (5,273/2,601 B) but ABI unpublished; app displays mocked feeds (disclosed) | Task 9 OD-34; fresh sizes | After N-01, re-audit §17 feed identity; until then keep feeds labeled MOCKED | SC lead |
| D6-14 | GPP CPI-basket feed, executable E_j, κ/β/crisis coefficients: **BLOCKED** — the approved spec publishes no operative values/feeds; nothing invented (correctly) | Task 9 G.5 statuses | Owner decision: either publish operative spec values or formally descoping decision — currently honest-BLOCKED | Owner |
| D6-15 | Task 9 report error ("not wired") propagated into app surfaces and remediation N-02 wording | CORR-1 | Corrected 2026-10-22 evidence-preserving (task9-audit.ts notes + Task 10 panels); original files preserved unmodified in v9-task9 | — (done, documentation only) |

**Stop-and-report items triggered this task (per the task brief):** (i) uncertain key exposure → RESOLVED as
CONFIRMED REAL (D1) and reported; (ii) unexplained supply discrepancy → the divergent supplies are explained
by generation history and deliberate burns/u64-mint (D5) with no unexplained movement between Task 9 and Task 10
(cell-for-cell identical state); (iii) contract-identity mismatch → reported (D3: no source identity
establishable; Governance dual-implementation); (iv) unexpected privileged execution path → reported (Monad
Redeem-module MINTER anomaly + unassessed Governor relay/execute surface). No on-chain action was taken in
response to any of them.
