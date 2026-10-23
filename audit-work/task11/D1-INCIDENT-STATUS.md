# MTQΣ — TASK 11 · D1: INCIDENT STATUS (current exposure, evidence confidence, affected systems)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

Produced 2026-10-22 (fresh probes 08:15–09:05 UTC) · **Read-only verification and remediation
preparation only — ZERO transactions, ZERO privilege changes, ZERO asset movements.**
Every action item in this package is a **PROPOSED — NOT SIGNED — NOT EXECUTED** plan awaiting
explicit human authorization. **[C11.1-01 — scope-qualified:]** no key material, and no
fragment beyond a redacted fingerprint, appears in this **package's deliverable and evidence
files** (byte-verified). The repository worktree and **all 25/25 commits** DO contain both
literals, and the EVM literal was **emitted once into the Task 11 session transcript** (PI-3,
§5) — a confirmed disclosure; the full five-channel record is in
`CORRECTIONS-REGISTER.md` §A. Overall release status: **NOT ACCEPTED** (D9).

---

## 1. Incident verdict (re-verified this session, unchanged from Task 10 — now with request/response hashes)

**TWO distinct private-key literals exist in the repository, and BOTH are REAL and
live-privileged today.** Both were re-derived **offline** this session
(`forensics-census-task11.ts`) from the same seed files and produce the **same privileged
addresses** Task 10 recorded. Under the task rule ("treat both reported keys as
compromised until independent verification establishes otherwise"), **both remain
COMPROMISED-POSTURE**. No independent verification of non-exposure exists — none is
possible for a secret that has lived in version-controlled files since 2026-10-18/19.

| ID | Kind | Redacted fingerprint | Derives to (re-verified) | Live privileges (fresh) | Status |
|---|---|---|---|---|---|
| **C-045-a** | EVM secp256k1 key (`0x`+64 hex) | `0xdbe1…62d6` (66 chars) | **`0x3C3932F865892EFabE45892f453f81B64f6c8d8c`** — the deployer EOA | DEFAULT_ADMIN+MINTER+PAUSER on both current MTQ tokens · DEFAULT_ADMIN on all 7 AC modules ×2 chains · role-admin of every role · sole owner/signer of both Genesis Safes · ~100% of both current supplies · Monad 0.224343224 MON · Arc 19.026597151851474173 native · txCounts 103 / 92 | **REAL — compromised posture** |
| **C-045-b** | Solana ed25519 key (128 hex = seed‖pubkey) | `58c19e…eb60` (128 chars) | **`4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d`** — exposed wallet | mint+freeze authority of the superseded mint `2EaK5cQt…` · holds that mint's ENTIRE supply (4.477988020393345024) · **4.98368596 SOL** drainable · 5 lifetime signatures | **REAL — compromised posture** |

The **current** Solana mint authority `DbFjz…QhXb3` key was **NOT found in the repository**
(byte-level census re-run; unchanged) — but it is a single key holding the entire u64-max
supply (see D4) and its off-repo custody is **owner-attestation-required** (D2 §6).

## 2. Fresh verification anchors (Task 11, request/response hashed)

| Chain | Endpoint | chainId assert | Block anchor (start→end) | Timestamp (block) |
|---|---|---|---|---|
| Monad testnet | `https://testnet-rpc.monad.xyz` | 0x279f ✓ | 73,193,044 → 73,193,262 | 2026-10-22T08:15:51Z |
| Arc testnet | `https://rpc.testnet.arc.io` | 0x4cef52 ✓ | 68,490,121 → 68,490,282 | 2026-10-22T08:16:57Z |
| Robinhood Chain | `https://rpc.testnet.chain.robinhood.com/rpc` | 0xb626 ✓ | 140,634,467 → 140,634,936 | — |
| Ethereum mainnet (ground truth only) | `https://ethereum-rpc.publicnode.com` | — | (single `eth_getCode`) | — |
| Solana devnet | `https://api.devnet.solana.com` | — | slot 513,824,771 (confirmed) | — |

Every request/response pair is hashed (keccak256, first 26 hex) into
`evidence/raw-task11-evm.jsonl` / `raw-task11-solana.jsonl` with UTC timestamps and
retry counts. Session totals: EVM 477 requests, 83 retries, 26 revert-errors (all
classified, none treated as negative results); Solana 13 requests, 0 failures after
corrections (earlier failed attempts preserved as FAILED-UNVERIFIED — see §5).

## 3. On-chain state: cell-for-cell stable since Task 10 (no drift, no unknown activity)

| Dimension | Task 10 (block 73,167,496 / 68,475,006) | Task 11 (block 73,193,262 / 68,490,282) | Drift |
|---|---|---|---|
| MTQ supplies (Monad / Arc) | 310.949 / 1,000 | 310.949 / 1,000 | **none** |
| Holders census (deployer + dead 1.000000000000000003) | 2 holders both chains | identical | **none** |
| Roles on both tokens (admin/minter/pauser × 6 accounts) | D4 matrix | identical cell-for-cell | **none** |
| Module DEFAULT_ADMIN (deployer) | 7/7 × 2 chains | 12/12 re-verified (Safe holds none) | **none** |
| Safe (both) | 1/1, nonce 0, v1.4.1, modules none, guard 0 | identical (+ guard/fallback slots re-read: zero) | **none** |
| Deployer nonces / natives | 103 / 92; 0.224343224 MON; 19.026597… | identical | **none** |
| Solana current mint | DbFjz authority, u64-max supply, no freeze, 18 dec | identical (jsonParsed authoritative parse) | **none** |
| Solana superseded mint | 4saT authority+freeze, 4.477988020393345024 | identical | **none** |
| 4saT wallet | 4.98368596 SOL, 5 sigs | identical | **none** |
| Runtime bytecode (bytes-convention keccak) | all anchors | **all reproduced exactly** (identity-anchors re-hash) | **none** |

**Interpretation:** no unknown privileged execution occurred between audits **in any
probed cell** — this is evidence of stability **at the recorded blocks, for the probed
methods and queried addresses [C11.1-04]**, not evidence of safety, and not an observation
of unprobed surfaces. The exposed keys retain full power throughout.

## 4. Evidence confidence per system

| System / surface | Confidence | Basis | Gaps |
|---|---|---|---|
| Monad on-chain state | **HIGH** | fresh individual eth_calls, hashed transport, block-anchored | deploy-block provenance still UNVERIFIED (pruned state below ~63.47M; Monadscan CF-gated) |
| Arc on-chain state | **HIGH** | same | — |
| Robinhood on-chain state | **HIGH** | RPC alive; 4 contracts re-probed | deployer full history not census-scanned (provenance tier) |
| Solana state | **HIGH** | jsonParsed (RPC-authoritative) + getTokenSupply + ATA census | pre-Aug-2020… history beyond first 100 sigs not pulled (5/6 sigs total — complete) |
| Working-tree exposure | **HIGH** | byte-level exact-literal scan (every file, incl. binaries) | — |
| Git-history exposure | **HIGH** | per-commit `git grep -F` × 25/25 commits | pre-squash history (pre-2026-10-19) **UNVERIFIABLE from this repo** |
| Remote/CI/backup surfaces | **NONE — UNRESOLVED** | no remote configured on this machine; CI files exist but their execution is unobservable from here | owner attestation required (D2 §6) |
| Source identity of all 18 deployed EVM contracts | **NONE — UNESTABLISHABLE** | runtime matches no local build (Tasks 9/10); re-confirmed fresh in 11.1 (all anchors reproduced) — **all §2 conclusions rest on bytecode only, never on source** [C11.1-04] | explorer publication (N-01) is the owner action |
| Governor proposer/executor auth | **NONE — UNESTABLISHABLE** | no source; parameters probed only | N-01 |
| Evidence hash conventions | **DOCUMENTED** | identity claims: `keccak256(raw runtime bytes)` (`identity-anchors-task11.json`, Task 11.1 evidence); the `runtimeKeccak` fields in `onchain-evm-task11.json` use the ASCII-hex-string convention (CORR-5) — same field name, two conventions, always reconcile via address+size+bytes-anchor [C11.1-03] | — |

## 5. Corrections and probe incidents this session (all evidence-preserving; originals untouched)

| ID | What | Disposition |
|---|---|---|
| **CORR-5** | This session's first EVM probe hashed the ASCII hex string, not the bytecode bytes (Tasks 9/10 convention) — producing different keccaks for identical code. Disclosed; **all identity anchors were re-hashed under the historical convention** (`hash-anchors.ts` → `identity-anchors-task11.json`) and reproduce every Task 10 keccak exactly. | disclosed + corrected; both conventions' outputs preserved |
| **CORR-6** | Task 10's wording "Monad Redeem module … redeemer can mint" was **overstated**: **[C11.1-02 — basis upgraded, wording narrowed]** the fresh Task 11.1 forensics probe (disassembly + complete call-site enumeration + per-site selector tracing + live slot reads + shift-reconstruction scan) shows the Monad Redeem module holds an **unusable** token-side MINTER_ROLE: all six external-call sites are traced (token `balanceOf/transferFrom/burn`; `Algorithm.getNAV`; `Reserve.0x41bf3f26/reserveRatio`), no mint selector exists **in any encoding**, zero CALLDATACOPY (no forwarding), no DELEGATECALL/CREATE, and the stored references (live-verified = Reserve/Algorithm) cannot mint. The original byte-scan alone was **insufficient as proof** (PI-11.1-d). The role grant remains **unexplained** — open finding; two module-side custom-role membership cells never probed → UNVERIFIED (D8 E-15/E-16). | narrowing correction, evidence-cited (`CORRECTIONS-REGISTER.md` C11.1-02) |
| **PI-1** | A malformed superseded-mint constant in the first Solana probe produced an RPC "WrongSize" error. | recorded as **FAILED-UNVERIFIED** (not a negative result); constant corrected verbatim from Task 10's script |
| **PI-2** | A hand-rolled mint-layout byte parser produced garbage fields. | replaced by the RPC's **jsonParsed** authoritative parse; raw attempt preserved in raw log; no conclusion was drawn from the bad parse |
| **PI-3** | **Exposure-disclosure:** the first census version passed the key literal as a command-line ARGUMENT to `git grep`; one failing call made Node print the argv — including the EVM literal — into the **AI session transcript**. No evidence file, JSON, report, or repository file received it (all outputs are fingerprint-redacted; the repo already contained the literal). The census was rewritten to pass patterns via **stdin** (`git grep -f -`) so the literal never enters argv again. | disclosed here and in D2 §7; transcript treated as an exposure surface |
| **PI-4** | `getGuard()`/`getFallbackHandler()` eth_calls revert on both genuine Safes — initially suspected as a modified singleton. **[C11.1-03 — per-artifact precision]** the deployed **singleton** `0x29fcB43b…C762` (canonical **SafeL2 v1.4.1**, 24,421 B, bytes-keccak `0xb1f926978a0f44a2…f81ff`) is byte-identical to the same address on Ethereum mainnet (Task 11 fetch + fresh 11.1 re-confirmation at mainnet block 26,247,495) and the canonical build carries no `getGuard()` dispatch entry; guard/fallback correctly read via storage slots (both zero). The **proxy** (171 B, `0xd7d408eb…fb4c`) was verified byte-identical **across the two instances** — a canonical-SafeProxy-reference comparison was **not performed** (UNVERIFIED); proxy and singleton are different artifacts, never byte-identical to each other. The L1-variant canonical singleton reference is UNVERIFIED from this sandbox (empty-code probe — PI-11.1-e). | probe-method artifact resolved; singleton authenticity byte-proven vs mainnet; proxy claim narrowed |

Task 9's original role-reporting error remains reconciled exactly as Task 10 left it
(CORR-1): original files preserved unmodified in `audit-work/v9-task9/`, corrections
carried in app surfaces and Task 10/11 documents. **Nothing was overwritten.**

## 6. Affected-systems register (what a holder of each key can do RIGHT NOW)

**C-045-a (deployer EOA) — full estate control on 3 chains:**
- Mint both current MTQ tokens (direct MINTER; no cap exists on either — `cap()` reverts);
- Grant/revoke **every role on every AC contract** (role-admin of every role, both chains);
- Execute either 1/1 Safe with one signature (Monad Safe additionally holds ADMIN+MINTER+PAUSER on the Monad token);
- Reconfigure Safe owners/threshold (1/1 today);
- Re-point `Mint.setReserve` / call `Reserve.removeReserve` (module ADMIN);
- Move ~100% of both current supplies (no allowances exist — all 36 probed cells zero — so only the deployer's own balance is directly movable);
- Spend both native balances; deploy new contracts (nonces 103/92 — new deployments remain possible);
- **Cannot** upgrade anything in place (no proxies — EIP-1967 slots zero on all 18 contracts, re-verified);
- On Robinhood: holds ~the entire RH "MTQΣ" supply (1,000,999.999999999999997 of 1,001,000.00000000002997 — fresh cell) and has 60 tx history;
- On the generations: gen-A/C self-custodied genesis is reachable via **owner-gated** `genesisMint` (owner = deployer, re-proved) and gen-B supplies are ~fully deployer-held.

**C-045-b (4saT) — superseded-mint control + funds:**
- Mint unlimited old-generation tokens (mint authority `2EaK5cQt…`);
- Freeze any holder of the old mint (freeze authority — **do not assume a superseded mint is harmless**);
- Dump 4.477988020393345024 old tokens (its ATA holds 100% of supply);
- Drain 4.98368596 SOL;
- Cannot touch the current mint (never its fee payer; holds no role — 5 lifetime signatures, all 2026-09-06 branding).

**Not exposed in-repo but single-key (owner hygiene items):** `DbFjz…QhXb3` (current Solana
mint authority — 9.99500752 SOL, full u64-max supply in its ATA, 6 lifetime signatures) —
outside census reach; owner must attest custody (D2 §6, K-5).

## 7. What would change this status (nothing has)

Only executed, owner-authorized remediation changes anything: repo purge (K-1), history
rewrite + credential rotation (K-2), sequenced EVM rotation (D3/D5), Solana authority
settlement (D4/D5) — each gated by D7 approvals and proven by D8 tests. **As of this
report the exposure surface is unchanged and the keys remain fully privileged.**
