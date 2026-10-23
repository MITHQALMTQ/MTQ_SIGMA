# MTQΣ — TASK 13 · Cross-Chain Supply & Authority Review (deliverable 9 — Stage H)

**STATUS: PRODUCED (v1) — a READ-ONLY RECONCILIATION of prior evidence plus UNSIGNED, approval-gated PROPOSALS.** Nothing in this document is decided, deployed, signed, broadcast, or freshly verified this cycle. This file replaces the Stage-A placeholder stub in full (filename unchanged).

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. Production authorization: FALSE.**

**Evidence-status legend** (per `audit-work/task13/README.md`): `VERIFIED` (independently reproduced with cited evidence) · `DEVELOPER-REPORTED` (stated by prior in-repo work, not re-executed) · `SIMULATED` · `PROPOSED` · `UNVERIFIED` · `NOT IMPLEMENTED`.

**Two evidence classes govern every table below:**

- **On-chain facts** (supplies, roles, Safe dossiers, Solana authorities, native balances): **DEVELOPER-REPORTED at the Task 12 fresh read-only anchors — Monad testnet 10143 block 73,243,944 · Arc testnet 5042002 block 68,520,264 · Robinhood Chain testnet 46630 block 140,748,341 · Solana devnet slot 513,885,476 (epoch 1189)** — `audit-work/task12/evidence/fresh-anchors-task12.json` (response-hashed). **No on-chain probe was re-run for this deliverable; no fresh-verification claim is made anywhere below.** Robinhood contract-level cells were last probed at the Task 10/11 anchors (blocks 140,564,404 / 140,634,936); the Task 12 probe covered RH deployer native balance + txCount only.
- **Registry facts** (addresses, chain IDs, names, classifications in `src/lib/mtq/contracts.ts` + `src/lib/mtq/address-book-validation.ts`): **VERIFIED as registry content against the owner's "WHAT YOU HAVE NOW" table, 34/34, per Task 12 D6**; the address-book suite passed 12/12 within the Stage A re-run of 2026-10-22 (recorded in `baseline-and-change-matrix.md` §9). This is a statement that the registry matches the owner's table — **not** that on-chain state is fresh.

**Verbatim mandate clause governing this deliverable (§10 — Cross-chain integrity and migration):**

> Reconcile every deployed token, contract, mint, chain, supply, role, owner, proxy, Safe, and address-book entry against read-only evidence.
> Do not infer that source-ready contracts are deployed. Do not infer that a contract is safe because it is labeled a Safe in an address book.
> Produce unsigned migration plans and explicit preconditions. No live migration, key rotation transaction, mint, burn, transfer, role change, contract deployment, ownership change, or transaction broadcast is authorized by this mandate.
> All affected compromised authorities must remain clearly identified as unresolved until independently verified remediation evidence is available.

Clause coverage: clause 1 → §1, §3; clause 2 → §2 (and §1.6); clause 3 → §5; clause 4 → §4, §8, §11.

**Cross-reference note (inconsistency flagged, not silently fixed):** `baseline-and-change-matrix.md` §5 (Stage H row) cites the supply-model decision as "D-13.12"; the authoritative decisions register (`unresolved-decisions-and-owner-approvals.md` §A) assigns **D-13.10 = cross-chain supply model** and D-13.12 = gold-component disposition. This document uses **D-13.10** and flags the baseline cell for correction.

---

## 1. Per-chain reconciliation (four networks, one compromised authority)

**Estate summary.** 18 deployed EVM contracts across Monad/Arc/RH testnets + one current Solana SPL mint + one superseded Solana mint + gen-era tokens. Every deployed EVM privileged role ultimately resolves to deployer EOA `0x3C3932F865892EFabE45892f453f81B64f6c8d8c` — the **compromised R-1 key (C-045-a)**. Address-book verdict (Task 12 D6, implemented in `address-book-validation.ts`): **`ok=false`, 2 BLOCKER cross-chain hex-role conflicts, APPROVED-CANONICAL count = 0 by design** — canonical selection is reserved to governance and has not happened.

**Deployed token generation (crucial):** the on-chain estate is the **v1.2 five-currency pilot** (`contracts/MTQSigma.sol`: USD/EUR/GBP/JPY/CNY weights 0.389/0.278/0.1669/0.1111/0.055, gold reserve-only, MockUSDC flows) **plus `MtqEcosystem.sol` modules** (MTQ + Mint + Redeem + ReserveVault + Takaful, admin-set prices). It is **not** any 7-component family (§2).

### 1.1 Monad testnet 10143 (DEVELOPER-REPORTED @ block 73,243,944)

| Row | Contract | Address | Runtime / size | Supply / notes |
|---|---|---|---|---|
| Token | MTQ (v1.2 pilot) | `0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD` | 6,681 B / 25 sels | name `MITHQAL`, symbol `MTQ`, decimals 18, **totalSupply 310.949 MTQ** (0.031% of the 1M genesis mandate), paused=false, **no `cap()`** |
| Governance | Governance.sol | `0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66` | 25,819 B / 50 sels (**exceeds EIP-170**) | same hex as Arc twin, **different runtime bytecode** (§1.7); auth UNESTABLISHABLE without source (N-01) |
| Safe | Safe.sol | `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0` | 171 B SafeProxy **v1.4.1** | **threshold 1, sole owner = deployer EOA, nonce 0, no modules, no guard; holds ZERO assets** (§1.6) |
| Algorithm | Algorithm.sol | `0x8839ce50e8D414005518769999c0A5b961D00CB2` | 2,546 B | module DEFAULT_ADMIN = deployer |
| Reserve | Reserve.sol | `0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177` | 5,703 B | same hex recorded as RH "Takaful" (BLOCKER, §1.7); deployer holds module MINTER here (Monad only) |
| Mint | Mint.sol | `0x197e9CB28216dfe18a199b4c2930F74C2F460809` | 5,644 B | holds token-side MINTER — **the wired mint path** (Mint.mint → MTQ.mint) |
| Redeem | Redeem.sol | `0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4` | 6,170 B | **holds token-side MINTER — ANOMALY** (§1.7, E-15/16) |
| Oracle | Oracle.sol | `0xDfcA66ac0450C9AB86307af1942E157C5A4DB713` | 5,273 B | ABI unpublished — feed contents UNVERIFIED; same hex recorded as Arc ecosystem-era "Safe" row (non-Safe) |
| Takaful | Takaful.sol | `0x3eC27BB283644eF0A98B9961E9FBED0583a02f19` | 6,043 B | module DEFAULT_ADMIN = deployer |

Token roles (fresh @ 73,243,944): ADMIN {deployer, Safe} · MINTER {deployer, Safe, Mint module, **Redeem module**} · PAUSER {deployer, Safe}. Module ADMIN: deployer on all 6 modules (6/6). Deployer holds 309.948999999999999997 MTQ + 0.224343224122819642 MON; burn address `0x…dEaD` holds 1.000000000000000003; **Safe holds 0**. Two-holder census closes exactly against supply (arithmetic, not mandate custody — Task 10 D5).

### 1.2 Arc testnet 5042002 (DEVELOPER-REPORTED @ block 68,520,264)

| Row | Contract | Address | Runtime / size | Supply / notes |
|---|---|---|---|---|
| Token | MTQ (v1.2 pilot) | `0x237c3Aa2B79248f86f6523D3890095BCd1996601` | 3,474 B / 37 sels | name `MITHQAL`, symbol `MTQ`, decimals 18, **totalSupply 1,000 MTQ** (0.1% of mandate), paused=false, **no `cap()`**; oldest of 4 Arc generations (2026-08-07 receipts) |
| Governance | Governance.sol | `0xE35a…Bd66` (same hex as Monad) | **13,129 B / 74 sels** | different build at the same address (§1.7) |
| Safe | Safe.sol | `0xE718…A7D0` (same hex as Monad) | 171 B SafeProxy v1.4.1, **byte-identical to the Monad instance** | **threshold 1, sole owner = deployer, nonce 0; holds ZERO assets**; Arc Safe holds **PAUSER only** (Monad/Arc asymmetry) |
| Algorithm | Algorithm.sol | `0x62f8E5243f32eE5C87a14A7896C61104aD9e7727` | 1,237 B | module ADMIN = deployer |
| Reserve | Reserve.sol | `0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471` | 2,897 B | module ADMIN = deployer; no MINTER here |
| Mint | Mint.sol | `0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa` | 2,847 B | holds token-side MINTER (wired path) |
| Redeem | Redeem.sol | `0xcAde4594177829597882555Ff57d0e34092daF8e` | 3,037 B | holds **NO** token roles (record correction PI-11.1-d retained) |
| Oracle | Oracle.sol | `0xFd2B8d176bf059287638Db30D02C6651dA02861e` | 2,601 B | ABI unpublished; Arc USDC/USD = 1.0 by construction (native gas, Ext-3 A.4); same hex recorded as RH "MockUSDC" (BLOCKER, §1.7) |
| Takaful | Takaful.sol | `0xA3B89FfdE28577A7D30E2c22503dB33509044EF0` | 3,033 B | same hex as the RH gen-A "MTQSigma" twin (DUPLICATE-CONFLICT family) |

Token roles (fresh @ 68,520,264): ADMIN {deployer only} · MINTER {deployer, Mint module} · PAUSER {deployer, Safe}. Module ADMIN: deployer 6/6. Deployer holds 998.999999999999999997 MTQ + 19.026597151851474173 native; `0x…dEaD` 1.000000000000000003; Safe 0. Deployer nonce 92 (Monad 103).

### 1.3 Robinhood Chain testnet 46630 (provenance tier; deployer cells @ 140,748,341; contract cells last probed Task 10/11)

| Row | Contract | Address | Notes |
|---|---|---|---|
| Token | MTQΣ Token (AccessControl + Pausable, gen-B twin) | `0xAF5B85658d074e071BbF392395a2ddA9B644C5A5` | name `MTQΣ`, decimals 18; **ADMIN+MINTER+PAUSER on deployer; not paused**; supply ≈ **1,001,000.00000000002997** (deployer 1,000,999.999999999999997); registry note says "genesis 1,000,000 MTQ" — **figure divergence flagged**; carries `canonical:true` flag — **a flag, NOT an approval** |
| Governance | Governance.sol | `0x80FF03DAD374E1f2f5C110F355B7a448Aa732B56` | 3,487 B (`0xcf0c00d3…0ac3`, Task 10) — distinct from the Monad/Arc Governance hex |
| "Safe" | Safe.sol "(Multi-Sig, 4/7)" | `0xa3CE28A10854B375272D528EeC4295D6bcd75691` | 3,321 B; getThreshold/getOwners/nonce **all REVERT → NOT a genuine Safe** — the address-book label is contradicted by the runtime dossier (mandate clause 2) |
| Algorithm | AlgorithmEngine.sol | `0x8C012fC945a2EEa9Fd25aCC8aCeadF180BDc9244` | — |
| Reserve | ReserveVault.sol | `0x5929cBEb7d308b974B9F3Ff5272fD27813967d6e` | — |
| Mint | MintContract.sol | `0xeF3290d060249D05685617F8954F2B64d7A6D084` | holds MINTER_ROLE on MTQ; "funded 1,100,000 USDC" per registry note (DEVELOPER-REPORTED, not re-probed) |
| Redeem | RedeemContract.sol | `0x3aCE703dc20c95381D425fceBbAC3AFA0B8Dac44` | — |
| Oracle | Oracle.sol | `0x02D9531A3ce1f47B38E4EA00b84a62d5C4fB6A9F` | — |
| Takaful | Takaful.sol | `0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177` | **same hex as the Monad "Reserve Vault" row — address-book BLOCKER (§1.7)** |
| Collateral | MockUSDC.sol | `0xFd2B8d176bf059287638Db30D02C6651dA02861e` | **same hex as the Arc "Oracle" row — address-book BLOCKER (§1.7)** |

Fresh deployer cells (@ 140,748,341): native 0.0098211602 ETH, txCount 60. RH disposition = provenance-tier decision (DEC-4), not rotation (Task 12 D4 §1.3).

### 1.4 Solana devnet (DEVELOPER-REPORTED @ slot 513,885,476 / epoch 1189)

| Object | Address / authority | Fresh facts |
|---|---|---|
| **Current mint** | `GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4` | decimals **18 (anomaly)**; supply raw **18,446,744,073,709,551,615 = 2⁶⁴−1 (u64 ceiling)** = 18.446744073709551615 whole — a deliberate `mintTo(u64::MAX)` 2026-08-10 (3 lifetime txs); mintAuthority = `DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3` (single key, NOT in repo; **custody UNVERIFIED — CKPT-2**); freezeAuthority NONE (verified); single ATA of DbFjz holds the full supply |
| **Superseded mint** | `2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY` | decimals 18; supply 4.477988020393345024 (all in the 4saT ATA); **mint+freeze authority = `4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d` = the exposed C-045-b key** |
| Wallet (current authority) | `DbFjz…QhXb3` | 9.99500752 SOL (drainable by whoever holds that key) |
| Wallet (exposed) | `4saT…cA1d` | **4.98368596 SOL — drainable by ANY repository holder** (T12-8 urgency) |

**Structural non-conformance:** SPL supply is u64; at decimals 18 the mandated 1,000,000 MTQ (10²⁴ raw) is **physically unrepresentable** (10²⁴ ≫ 2⁶⁴−1 ≈ 1.84×10¹⁹). The current mint cannot conform to the intended monetary policy at decimals 18 under any supply the mandate contemplates (Task 10 D5 §4; Task 12 D5 §2). Decimals ≤ 9 is an option **requiring economic approval (DEC-3)** — never auto-selected.

### 1.5 Generations inventory (Tier-2 provenance; supplies DEVELOPER-REPORTED from Task 10 D5 @ its anchors, unchanged family per Task 11/12)

| Generation | Members | Key facts |
|---|---|---|
| gen-A "MTQΣ / MTQ Sigma" (Ownable; byte-identical family keccak `0xa7331051…`) | Monad `0x5D9564C2…129bfd4a` · Arc gen-A `0x826b82F7…128B63c1` · Arc gen-C `0x5C728F72…93A2563` · RH "MTQSigma" `0xA3B89Ffd…09044EF0` | **self-custodies its own 1,000,000 genesis inside the token contract** (`genesisReserve = address(this)`, owner-gated `genesisMint`); `owner()` = deployer EOA → **the exposed key can inflate any member**; supplies 1,012,987 / 1,005,889 / 1,002,997 / (RH, provenance) |
| gen-B "MTQΣ" (AccessControl; keccak `0x31496b92…`) | Monad `0x0Ac20360…18A5982f` · Arc `0x24203404…80d9897` · RH "MTQToken" `0xAF5B…C5A5` | deployer ADMIN+MINTER+PAUSER; supplies 1,000,000.000000000001998 / same / ≈1,001,000.00000000002997 |
| Superseded canonical row (registry, provenance only) | `SUPERSEDED_CANONICAL_MTQ` (contracts.ts): monad `0x0Ac20360…`, arc `0x24203404…`, solana `2EaK5c…` | retained for provenance, never deleted; OD-35-era live reads |

No gen-era ecosystem contract holds any balance of its generation's token (holder-hunt probes zero). **No current-generation Safe holds any asset on any chain** (C-043 preserved).

### 1.6 Proxies and Safes (consolidated; mandate clause 1: "every proxy, Safe")

- **EIP-1967 implementation/admin/beacon slots are UNSET (zero) on all 18 deployed EVM contracts** — there are **no UUPS or transparent proxies anywhere**; in-place upgrades are impossible; any change requires new deployments (Task 10 D4 §2).
- The only proxy code on the estate is **SafeProxy v1.4.1** (171 B runtime), byte-identical between the Monad and Arc instances at the shared hex `0xE718…A7D0`; singleton `0x29fcB43b…C762` = canonical SafeL2 v1.4.1, byte-anchored Monad = Arc = Ethereum mainnet (Task 11 identity anchors); the formal canonical-proxy comparison is UNVERIFIED.
- **Safe configuration is the problem, not the Safe code:** threshold **1**, sole owner **= the compromised deployer EOA**, nonce 0 (never executed a transaction), no modules, no guard, **holds ZERO assets on both chains**. A 1/1 deployer-controlled Safe is custody-in-name-only — "Safe" labels in the address book are **labels**, not dossiers (mandate clause 2).
- The RH "Safe (Multi-Sig, 4/7)" row is **not a Safe at all** (Safe ABI reads revert; 3,321 B). It must never be treated as custody.

### 1.7 Known anomalies (carried register — all OPEN at the Task 12 anchors)

1. **Governance same-address-different-runtime-bytecode:** `0xE35a…Bd66` hosts two OZ-Governor builds (Monad 25,819 B / 50 sels — exceeds the EIP-170 24,576 B limit; Arc 13,129 B / 74 sels) at the same deployer nonce; both expose propose/queue/execute/cancel/relay/ERC-1271; votingDelay=1, quorumNumerator=1; **proposer/executor auth UNESTABLISHABLE without source (N-01)**; NO interaction planned — not even renouncing (unknown behavior could brick or trigger).
2. **Shared Safe address across chains:** `0xE718…A7D0` on Monad AND Arc (separate instances, byte-identical proxies) — one address-book row must never be treated as one contract cross-chain (DUPLICATE-CONFLICT classification).
3. **Monad Redeem token-side MINTER anomaly (E-15/16):** the Redeem module holds MINTER on the Monad MTQ token (Arc: false) — a redemption contract that can mint; call-graph-scoped proof shows no executable mint path in the recorded code and the grant origin is unexplained (H-1 hypothesis: symmetric deployment script — unprovable without source); module custom-role cells E-15/E-16 UNPROBED; hygiene revoke T-3.1 pending approvals.
4. **Solana decimals-18 + u64 supply-field anomaly:** §1.4 — structural non-conformance; any "fresh mint" plan at 18 decimals (10B×10¹⁸) reverts arithmetically; that script is now a fail-closed stub.
5. **RH hex-role conflicts (address-book BLOCKERs):** RH "Takaful" `0x1bbC…6177` == Monad "Reserve Vault"; RH "MockUSDC" `0xFd2B…861e` == Arc "Oracle" — the same hex carries **different roles/names across chains**; evidence preserved on all sides, nothing auto-merged; resolution requires per-chain independent verification + governance.
6. **RH `canonical:true` flag** — explicitly a candidate marker, NOT an approval (AB-canonical-flag finding); **APPROVED-CANONICAL count = 0**.
7. **Name identity conflict:** on-chain `MITHQAL` (Monad/Arc) vs `MTQΣ` (RH gen-B) vs "MTQ Sigma" (gen-A) — three live names, one mandate (D6-1 / DEC-2).
8. **RH supply figure divergence:** registry note "genesis 1,000,000 MTQ" vs probed ≈1,001,000.00000000002997 (Task 10/11).
9. **Mainnet rows vs testnet-only posture:** Base 8453 and Arbitrum 42161 rows exist in the registry with zero-address "pending deploy" placeholders — flagged MAJOR; deployment remains an unauthorized action; `.env.example` still documents `DEPLOYER_PRIVATE_KEY` (Stage-H cleanup item, never with a real value).
10. **Oracle rows:** both Monad and Arc Oracle module ABIs are unpublished — feed contents UNVERIFIED; deployed pilot economics use admin-set prices → the reference/price surface is itself authority-controlled today.

---

## 2. Source-ready vs deployed gap (mandate clause 2)

- **The 7-component `MTQSigmaV2.sol` and the bank-mediated `MTQSigmaV3.sol` exist ONLY as source.** Registry status: `SOURCE_READY_PENDING_DEPLOY` (`contracts/deployments/MTQSigmaV2-PENDING.json`; `MTQSIGMA_V2` block in `contracts.ts`: expectedAddress `null`, deployTx `null`, deployedAt `null`). **It is forbidden to infer that these are deployed.** Nothing in §1 belongs to the V2/V3 design.
- **The deployed set diverges from every blueprint family:** v1.0/v2.0 adaptive-reserve (7-comp, RR 1.10) — not deployed; MITHQAL v25.3.1 (11-ccy, RR 1.30, 80/18/2) — not deployed; V3 non-custodial bank-mediated — not deployed. What runs on-chain is the **v1.2 5-currency pilot** with admin-set prices and vault-balance economics (contradictions C-INV-1/C-INV-2 stand).
- **"Safe" is a label; dossiers are facts.** The only two genuine Safe instances are 1/1 deployer-owned and hold zero assets; the RH "4/7 Safe" reverts on Safe ABI reads. No address-book row implies custody or multi-sig control.
- **Source/build identity is UNVERIFIED for all 18 deployed EVM contracts** — no local build matches any runtime; explorer verification absent; this blocks any safety claim about contract internals, including both Governors (N-01).
- **No bridge, relayer, lock-mint, or burn-mint code exists anywhere in the repository** (Stage A source inventory 13-a2). Any v3.0 cross-chain mechanism starts from zero and must be labeled as such.
- **MTQΣ is not its own blockchain.** The estate is a set of smart-contract deployments on four third-party test networks (plus two mainnet placeholder rows); no independent consensus or ledger infrastructure exists, and no such claim is made.

---

## 3. Supply integrity per chain and cross-chain

### 3.1 Per-chain supply ledger (all DEVELOPER-REPORTED @ anchors in §1)

| Chain | Token | Supply (whole, 18 dec unless noted) | vs 1M genesis mandate | Custody reality |
|---|---|---|---|---|
| Monad 10143 | MTQ `0x9e6E…53aD` | **310.949** | 0.031% | deployer EOA 309.949 + burn address 1.000000000000000003; **Safe 0** |
| Arc 5042002 | MTQ `0x237c…6601` | **1,000** | 0.1% | deployer 998.999…997 + dead 1.000000000000000003; **Safe 0** |
| RH 46630 | MTQΣ `0xAF5B…C5A5` (gen-B twin, provenance tier) | ≈**1,001,000.00000000002997** | ≈100.1% (only place the 1M order of magnitude exists) | deployer ≈ sole holder |
| Solana devnet | current mint `GAGRdY6…` | **18.446744073709551615** (u64 ceiling) | **unrepresentable** (§1.4) | 100% in the DbFjz single-key ATA |
| Solana devnet | superseded mint `2EaK5c…` | 4.477988020393345024 | n/a (retired) | 100% in the exposed 4saT ATA |
| gen-A/C family | 4 EVM tokens | 1M self-custodied **inside each token contract** | 100% but wrong custodian | `owner()` = deployer EOA → exposed key can inflate via owner-gated `genesisMint` |

**Genesis mandate DISPROVEN on-chain everywhere:** no chain shows 1.1M USDC deposited, 1M MTQ in the Safe, or canonical genesis events; both current Safes hold 0 and have nonce 0; balances close arithmetically (2-holder censuses) which proves accounting, **not** mandate custody. Neither current EVM token has an on-chain supply cap (`cap()` absent) — minting is bounded only by who holds MINTER, which today is the compromised EOA (plus the wired Mint modules and the Monad Redeem anomaly).

### 3.2 Cross-chain reality: NO supply model exists (D-13.10 — OPEN)

- The four supplies are **independent ledgers**. Three EVM deployments were made independently (same EOA, per-chain nonces 103 / 92 / 60) and one Solana mint; **no bridge, lock, mint-burn, or shared accounting exists** (13-a2). A naïve cross-chain sum is arithmetically computable but **semantically undefined** — no approved document says these are the same asset across chains.
- **Oracle consistency does not exist cross-chain either:** the reference value is computed off-chain in the TS reference layer; the deployed on-chain Oracle modules are admin-set (compromised-authority-controlled) with unpublished ABIs; Arc USDC/USD is 1.0 by construction. The pilot oracle pipeline is single-live-upstream-per-pair with synthetic 3-source witnesses (independence NOT met — disclosed).
- Therefore "reconcile supply across all supported networks" (mandate §10) currently has **no reconciliation target**: there is no defined aggregate, no defined per-chain relationship, and no duplicate-supply prevention of any kind. This is decision **D-13.10 (Gate G per the decisions register) — OPEN**.

### 3.3 Candidate cross-chain supply models — OPTIONS, NOT CHOICES (input to D-13.10)

| Model | Duplicate-supply prevention requirements | Oracle-consistency requirements | What breaks if one chain's authority is compromised |
|---|---|---|---|
| **M-A · Single canonical supply** (one chain hosts the authoritative ledger; others hold representations or nothing) | A verified canonical ledger + representation contracts whose totals are provably bounded by it; per-representation caps enforced at the representation contract; attestation/proof path from canonical to satellites; replay-protection | One authoritative supply source (no supply oracle needed); representation-vs-canonical reconciliation proofs; canonical-chain finality assumptions must be stated | If the **canonical chain's** authority is compromised → the total supply is forgeable/inflatable everywhere; if a **satellite** is compromised → representations diverge from the ledger (broken parity claims) |
| **M-B · Chain-specific issuance limits** (independent supplies with per-chain caps) | On-chain `cap()` per chain (currently ABSENT on both EVM tokens); a governance-held chain→cap registry; aggregate-cap enforcement is procedural (governance), not cryptographic; periodic proof that no chain exceeds its cap | Aggregate supply reporting needs per-chain supply feeds aggregated with consistent decimals (EVM 18-dec vs Solana u64/decimals-D — DEC-3 interacts); staleness windows per chain | The compromised chain can exceed its cap silently (no on-chain cap today); other chains are unaffected but **any aggregate supply claim becomes false**; gen-era pots can be inflated and double-counted if census rules are not defined |
| **M-C · Lock-and-mint** (lock on source, mint on destination) | Verified lock events; mint authorization strictly pegged to locked value; custodian/multisig or light-client bridge; unique message IDs; burn-before-unlock discipline | Lock-event oracles (or a trustless bridge) so mints are never made on unverified locks; value-parity monitoring lock↔mint | Compromised **destination** minter → over-mint beyond locked collateral; compromised **source** authority → unlock without burn → the same underlying value is represented twice |
| **M-D · Burn-and-mint** (global conservation: burn source / mint destination) | Global invariant Σ per-chain supplies = constant across every cross-chain transfer; atomic burn+mint or proof-of-burn with finality-before-mint; per-chain supply oracles feeding an aggregate invariant monitor | Aggregate supply oracle across chains with consistent decimals handling; divergence alarm thresholds; finality rules per chain | A compromised authority on **ANY** chain breaks the global invariant (can mint without a matching burn); the invariant monitor becomes the only detector, and it is off-chain |

**Cross-cutting preconditions for ANY model:** (i) supply caps or bounds on every participating token (absent today); (ii) the Solana representation decision (DEC-3: decimals ≤ 9 or accept the u64 ceiling — economic approval, never automatic); (iii) oracle source independence (unmet in the pilot); (iv) a census rule for gen-era tokens (self-custodied 1M pots must never be counted as circulating under any model without an explicit decision); (v) execution only after the §5 authority migration — deploying any cross-chain mechanism while every chain resolves to the compromised EOA would hand the attacker the duplicate-supply surface itself. **This review proposes and compares; it selects nothing (D-13.10 remains with the owner).**

---

## 4. Authority and compromise status (mandate clause 4)

**Both compromised credentials remain REAL and fully privileged at the Task 12 anchors. Both are UNRESOLVED.**

### 4.1 EVM — R-1 / C-045-a (deployer EOA `0x3C3932F865892EFabE45892f453f81B64f6c8d8c`)

- **DEFAULT_ADMIN on every AccessControl contract probed on both EVM chains** — token role triples (ADMIN/MINTER/PAUSER) on both MTQ tokens + module ADMIN on all 6 modules × 2 chains (12/12 fresh cells) → the key can grant/revoke every role on every AC contract unilaterally (`getRoleAdmin` = DEFAULT_ADMIN everywhere).
- **Safe 1-of-1 owner on both chains** (`0xE718…A7D0` ×2) — one signature executes anything the Safes can do; `owner()` of the gen-A/C family (owner-gated genesisMint on 1M pots); gen-B roleholder; RH asset holder (0.00982 ETH + gen-B holdings).
- Exposure surfaces: git history contains the literal in **25/25 commits, all encodings** (worktree copies purged in Task 12 K-1 — history rewrite awaits T12-1); the upload channel proved live (T13-INC-001: `upload/private_key.txt` quarantined, disposition **D-13.1 OPEN**, worktree secret gate intentionally RED); remote/CI/backup/clone exposure **UNVERIFIED** (OWNER-ATT-1).

### 4.2 Solana — C-045-b (`4saT…cA1d`)

- **Mint + freeze authorities of the superseded mint** (`2EaK5c…`): anyone holding the repo literals can mint unlimited old-generation tokens and freeze old-mint accounts; the full old supply sits hostage in its ATA.
- **Wallet holding 4.98368596 SOL — drainable by any repository holder** (most urgent single fact on the estate; T12-8).
- Exposure: same 25/25-commit history (plus the base58 7th worktree copy found and purged in Task 12 — census correction T12-0).

### 4.3 Adjacent but distinct: DbFjz (current-mint authority)

- The DbFjz key is **NOT in the repository** (census-verified) — its **custody is UNVERIFIED (CKPT-2/OWNER-ATT-2 attestation required)**; it currently controls the whole current Solana supply (single ATA) and 9.99500752 SOL. It is not classified as compromised; it is classified as an **unverified single point of failure** (S-3 acceptance would make its attestation the standing control).

### 4.4 Standing principle (unchanged across Tasks 11/12/13)

**Repository cleanup ≠ private-key revocation.** A secp256k1/Ed25519 key is self-authenticating data; deleting every copy changes nothing about what a holder can sign, and copies cannot be proven absent. The ONLY effective containment is on-chain rotation (§5). The working tree is now clean of known literals, but: history is unwritten (T12-1), the uploaded file awaits disposition (D-13.1), remote exposure is unverified (OWNER-ATT-1). **Accordingly, both compromised authorities remain clearly identified as UNRESOLVED until independently verified remediation evidence exists** — no remediation has been executed, so there is nothing to verify yet (CKPT-9 must precede any "contained/rotated/revoked" language). Software-side controls (release-controls default-deny; keeper first-statement guard; live-verified observe-only) limit what THIS codebase will sign — they do not touch on-chain authority held by the keys.

---

## 5. Unsigned migration plans and preconditions (mandate clause 3)

**Consolidation of Task 12 D4 (EVM) and D5 (Solana) — carried forward as-is, NOT re-invented here. Every step is PROPOSED — NOT SIGNED — NOT BROADCAST — NOT EXECUTED. Cumulative transactions under Tasks 10–13: ZERO.**

### 5.1 EVM package (Task 12 `D4-EVM-AUTHORITY-MIGRATION-PACKAGE.md`)

- **Destination:** new "Safe-B" per chain — **4-of-7**, owners `⟨OWNER-1…7⟩` (do NOT exist yet; generated in a human ceremony outside repo/sandbox/AI; independence + custody + recovery documented; quorum-loss freeze risk owner-accepted first). Singleton `0x29fcB43b…C762` (SafeL2 v1.4.1). The current 1/1 Safes are **not acceptable destinations** and are not reused.
- **Phase 1 — provisioning (zero blast radius):** T-1.1 signer ceremony → T-1.2/T-1.3 deploy Safe-B(Monad)/Safe-B(Arc) via `createProxyWithNonce` + `setup` → **T-1.4 QUORUM PROOF hard gate**: full on-chain dossier check (owners, threshold 4, nonce 0, version 1.4.1, canonical singleton slot, no modules, guard/fallback per policy) + one 4-signature no-op `execTransaction` proving the quorum end-to-end **before any estate change** → optional T-1.5 pause-window policy.
- **Phase 2 — grants (grant-before-revoke):** T-2.1…T-2.7 grant ADMIN/MINTER/PAUSER to Safe-B on both tokens and ADMIN on all 12 modules (+Mint-module MINTER; T-2.4 Reserve-module MINTER **conditional on ECON-DEC-2**). Invariant: every surface has ≥2 admins; a mid-sequence failure leaves the estate admin-REDUNDANT, never admin-less. Executed by the exposed key in an owner-controlled session only.
- **Phase 3 — revocations + evacuation (executed by Safe-B 4-of-7):** T-3.1 revoke the dormant Monad Redeem-module MINTER (hygiene; grant-origin question stays open) → T-3.2/T-3.3 strip the old 1/1 Safes' roles → T-3.4/T-3.5 module ADMIN revokes → **T-3.6/T-3.7 the LAST revokes of the deployer's token roles — the de-exposure moment, irreversible by design** → T-3.8 evacuation (Monad 309.949 MTQ + 0.2243 MON; Arc 999 MTQ + 19.0266 native; RH gen-B holdings + 0.00982 ETH; gen-A family `transferOwnership(⟨dest⟩)` or explicit accept-provenance) with destination probe-verification before EACH transfer.
- **Handover window (disclosed, unavoidable):** only the current (compromised) admin can create its successor; between Safe-B deployment and T-3.6/3.7 the key could race the migration. Owner policy options — tight batch / pause-window / accept — are all imperfect; **no risk-free sequence exists and none is represented as such.**
- **Specificity blockers (honest list):** `⟨OWNER-1…7⟩` unbound; `⟨FACTORY⟩` + `⟨FALLBACK-POLICY⟩` unselected; ECON-DEC-2 (Reserve minting intent); evacuation destinations; N-01 (Governor sources); OPS-DEC-1 (module-MINTER end-state).
- **Bypass pathways explicitly NOT closed by the package:** the unassessed Governor pair (no interaction — not even renouncing); unprobed module custom-role cells E-15/16; gen-A Ownable powers (persist past EOA-role revocation); deployer-held balances; the key's residual ability to SIGN; new-owner compromise (rests on ceremony quality).

### 5.2 Solana package (Task 12 `D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md`)

- **Ordering rule (evacuation-first):** T-4.4 **evacuate the 4saT wallet's 4.98368596 SOL** WITH or BEFORE T-4.3 — an authority-dead wallet stays drainable. Exposed-key signing happens in an owner-controlled session only, never in this repo/AI environment.
- **T-4.1 (conditional, S-1/S-6):** provision + verify a Squads-style 2-of-3 multisig — **program identity UNVERIFIED** (candidate probed NULL on devnet AND mainnet; owner must take the program ID from official Squads documentation and verify it live themselves — CKPT-8) → layout checks → ONE low-risk dust self-transfer before any authority transfer.
- **T-4.3 / T-4.5:** `SetAuthority(2EaK5c…, MintTokens, None)` and `(…, FreezeAccount, None)` — permanent, consciously-accepted one-way doors (S-5 default proposal + T-4.6 address-book annotation; S-6/S-7 alternatives).
- **T-4.2 (SOL-DEC-1):** current-mint disposition — S-1 transfer authority to multisig / S-2 revoke (freezes supply at u64-max; only after a replacement exists) / S-3 leave-pending (single-key chokepoint stays; CKPT-2 attestation becomes the ONLY control; acceptance must be recorded) / S-4 redeploy a conformant mint at approved decimals (**requires DEC-3 + a full deploy plan**). Signed by the DbFjz key (owner-side, not in repo).
- **Decimals/supply design-decision analysis (documented, choice NOT made):** SPL u64 ceiling table — at decimals 18 max 18.45 whole tokens (1M = 54,229,682× the ceiling; the historical 10B×10¹⁸ plan reverts); decimals 9 → 18.4B max (1M fits with 54.2% headroom at 10B); **decimals ≤ 9 is an ECONOMIC option (DEC-3), never auto-selected**; Token-2022/u128 noted only as existing, UNVERIFIED.

### 5.3 Approval preconditions (extract of the Task 12 D8 chain; full register: `task12/D8-OWNER-APPROVAL-CHECKLIST.md` + deliverable 14 §B)

Execution order of owner approvals: **OWNER-ATT-1** (remote/CI/backup existence attestation — gates credential rotation + history-rewrite blast radius) → **T12-1** (git-history rewrite plan) / **T12-3** (credential rotation, conditional on ATT-1) → **CKPT-2/OWNER-ATT-2** (DbFjz custody attestation) → **CKPT-3/4** (signer ceremony binds `⟨OWNER-1…7⟩`) → **CKPT-5/6** (Safe-B dossiers + quorum proofs + exact grant set, with ECON-DEC-2/OPS-DEC-1) + T12-6 (handover-window policy) → **CKPT-7** (revoke set + irreversibility inventory + evacuation destinations) → … → **CKPT-9** (independent reviewer commissioning — precedes ANY "contained" language). Solana-side: T12-8 (SOL evacuation urgency), CKPT-8 (Squads identity), SOL-DEC-1, DEC-3. Adjacent hygiene: D-13.1 (uploaded key file disposition). **A general instruction to "continue" authorizes none of these.**

### 5.4 Execution status

**NOTHING has been executed.** Zero transactions, zero signatures, zero deployments, zero role changes, zero Safe changes, zero authority changes, zero asset movements, zero history rewrites — across Tasks 10, 11, 11.1, 12, and 13 to date. The packages above are the standing remediation path and remain unsigned.

---

## 6. Interaction with the v3.0 redesign

- **Any v3.0 deployment is a NEW-contract program.** The V2/V3 designs are undeployed (§2), so v3.0 faces **no live-contract migration constraint for the new designs** — but the deployed v1.2 legacy estate exists, is privileged, and is compromised-authority-held.
- **Mandate requirement:** the compromised deployer must **not** be a trusted long-term authority. Today this is **UNMET on-chain** — every privileged gate on all four networks resolves to the compromised EOA (or its exposed Solana twin); the mandate is satisfied only by completing §5 (or an equivalent owner-approved rotation) plus independent verification.
- **Sequencing question for the owner — BOTH options presented, decision OPEN:**
  - **Option A — rotate-then-deploy:** execute Task 12 D4/D5 first; deploy v3.0 afterwards with Safe-B / the multisig as initial authority. *Pros:* the new estate is never touched by the compromised key; the handover window is borne once, for the legacy estate; v3.0 starts with governed authority from block 0. *Cons:* v3.0 timeline is gated behind the full approval chain; the legacy estate (incl. 4.98 SOL and the gen-A 1M pots) remains exposed during the (possibly long) approval-gathering period.
  - **Option B — deploy-to-new-authority-first:** provision the destinations (D4 Phase 1 / D5 T-4.1 only), deploy v3.0 with Safe-B as initial deployer/admin (the compromised key never touches the new estate), and defer the legacy revocations/evacuation. *Pros:* v3.0 progress is unblocked by the smallest moving set (signers + destinations); the new estate is clean by construction. *Cons:* the legacy estate's compromised authorities remain **unresolved for longer** and must be prominently identified as such (mandate clause 4); two parallel authority regimes invite confusion; the deferred rotation carries the same handover-window risk later.
  - Under **either** option: no deployment is authorized under the current posture (release-controls default-deny; deployment is an unauthorized action); the legacy rotation is **not** made waste by any v3.0 outcome (removing the exposed key's authority is necessary under every candidate future — Task 11 D6 §3 logic); and the v3.0 contracts' initial authority set must be specified in the deployment plan before any approval is requested.

---

## 7. Tests required — cross-chain supply reconciliation family (NONE exists today)

The mandate test matrix names "cross-chain supply reconciliation" as a required family. **It does not exist — no test, harness, or assertion for it is present in the repository** (Stage A inventory; `NOT IMPLEMENTED`). It cannot be fully written until D-13.10 selects a model (and DEC-3 for Solana representation). Required cases when it is built:

- **TC-XC1 — Registry↔anchor reconciliation:** for each chain, a read-only re-probe at a fresh anchor must reproduce the registry row (supply, roles, Safe dossier, authorities); any delta must be explained before any claim is refreshed. (Model-agnostic; implementable safely as a repo-level harness against cited anchors.)
- **TC-XC2 — Aggregate accounting invariant:** whatever D-13.10 defines (canonical-ledger total, Σ per-chain capped totals, lock↔mint parity, or burn+mint conservation) must hold over a recorded event window, per chain and in aggregate.
- **TC-XC3 — Duplicate-supply-path proofs:** every mint path on every chain enumerated and shown bounded by the chosen model — with the **Monad Redeem-module MINTER anomaly as the permanent negative fixture** (the exact class of bug this family must catch: an unexpected role holder creating an unaccounted mint path).
- **TC-XC4 — Representation/conversion vectors:** EVM uint256/18-decimals ↔ Solana u64/decimals-D conversion; overflow reverts (10B×10¹⁸ under u64 as a durable regression); rounding-direction assertions; per-model cap-boundary cases.
- **TC-XC5 — Oracle-consistency:** identical reference values within tolerance across chains; staleness windows enforced per chain; failure containment (no chain mints on stale or divergent data); divergence alarms for aggregate monitors.
- **TC-XC6 — Authority-ledger coupling:** every supply-affecting action maps to a recorded authority; post-rotation regression: the compromised addresses hold **zero** privileged roles on every network (extends Task 12 D8's role-FALSE×15 suite with supply-reconciliation assertions); gen-era pots explicitly in or out of every census per the model's census rule.
- **TC-XC7 — Address-book invariants (exists today):** the 12/12 `address-book-validation` suite already encodes the contamination facts (hex conflicts, non-Safe "Safe", canonical-flag ≠ approval) as durable invariants — the only standing piece of this family; extend it with per-chain supply cells as they are re-anchored.

All cases above are **required, not implemented**; none may be reported green until run against fresh anchors, and no test result ever advances a release gate.

---

## 8. Risks (cross-chain-scoped register; IDs namespaced XR- to avoid the R-1/R-2 collision noted as C-INV-8)

| ID | Risk | Status |
|---|---|---|
| XR-1 | Compromised-authority race during the unavoidable handover window (only the compromised admin can create its successor) | OPEN — disclosed; no risk-free sequence |
| XR-2 | No supply cap on either EVM token + no cross-chain model → supply semantics undefined; per-chain inflation invisible to any aggregate claim | OPEN — D-13.10 + caps |
| XR-3 | Solana u64/decimals-18 anomaly → 1M unrepresentable; "fresh mint" plans revert; decimals change requires economic approval (DEC-3) | OPEN — structural |
| XR-4 | Address-book BLOCKERs → no canonical claim is possible; one hex ≠ one contract cross-chain; misreading rows would contaminate any reconciliation | OPEN — per-chain verification + governance |
| XR-5 | Source identity UNVERIFIED for all 18 deployed contracts; Governor auth unassessable (N-01); "Safe"/"4-of-7" labels contradicted by dossiers | OPEN |
| XR-6 | Evacuation irreversibility — a wrong destination is unrecoverable (probe-verify-first rules exist for this) | OPEN — gated by CKPT-7/T-3.8 |
| XR-7 | Remote/CI/backup/clone exposure UNVERIFIED (OWNER-ATT-1); the upload channel is a proven live exposure path (T13-INC-001); git history still holds both literals | OPEN — hygiene ≠ revocation |
| XR-8 | Mainnet placeholder rows (Base/Arbitrum) in a testnet-only registry + still-documented `DEPLOYER_PRIVATE_KEY` → future mis-scoped deployment risk | OPEN — cleanup gated |
| XR-9 | Deployed pilot oracles are admin-set with unpublished ABIs → price/reference surfaces are compromised-authority-controlled today; cross-chain oracle consistency unproven | OPEN |
| XR-10 | gen-A/C self-custody pots (1M each, owner-gated `genesisMint`) — the exposed key can inflate them, and the power survives EOA-role revocation (needs per-token transferOwnership or accept-provenance) | OPEN — T-3.8 |

---

## 9. Acceptance criteria for this deliverable's scope (all currently UNMET — listed so "done" is unambiguous)

1. **D-13.10 decided** by the owner with the chosen model's duplicate-supply-prevention and oracle-consistency analysis recorded (a decision document, not code), and DEC-3 resolved or explicitly scoped out for the chosen model.
2. **Task 12 D4/D5 executed in full** under their D8 approvals, with **D9 independent verification evidence** produced (compromised addresses hold zero privileged roles on all four networks; Safe-B dossiers re-probed; 4saT SOL evacuated; superseded-mint authorities None; SOL-DEC-1 outcome recorded).
3. **A fresh read-only re-probe at new anchors** reconciles this document's §1/§3 tables cell-by-cell; every delta explained; the re-anchor is a precondition to any refreshed claim in this file.
4. **Address book:** the 2 BLOCKER hex conflicts resolved by per-chain independent verification; `ok=true` becomes honest only then; **APPROVED-CANONICAL > 0 only via an explicit governance selection** (still 0 today).
5. **The §7 test family implemented and green at fresh anchors** (model-dependent cases gated on criterion 1).
6. **No deployed surface retains any compromised credential in a privileged role**, including the Governor residual (closed via N-01 source publication + audit, or explicit retirement decision DEC-6) and the gen-A/C ownership powers.
7. Until all of the above: this reconciliation remains the standing record and the posture remains **NOT ACCEPTED**. Nothing in this document advances any gate.

---

## 10. Owner approvals required (all OPEN — open checkboxes; nothing may be inferred from this document)

**New this task:**

- [ ] **D-13.10 — Cross-chain supply model** (single canonical supply / chain-specific issuance limits / lock-and-mint / burn-and-mint / other), with duplicate-supply prevention proven for the chosen model. Approver: Owner (Gate G per the decisions register).
- [ ] **D-13.1 — Disposition of `upload/private_key.txt`** (T13-INC-001; adjacent hygiene; gates the worktree secret gate returning to green). Approver: Owner.
- [ ] **D-13.2 — Key-handling protocol acknowledgment** (adjacent; prevents repeat incidents). Approver: Owner.

**Carried Task 12 chain (UNCHANGED; full register in task12/D8 + deliverable 14 §B):**

- [ ] **OWNER-ATT-1** — remote/CI/backup/clone existence attestation (gates credential rotation + history-rewrite blast radius)
- [ ] **T12-1** — git-history rewrite plan approval (Owner + Security Lead)
- [ ] **T12-3** — credential rotation set, conditional on OWNER-ATT-1 (Owner + Security Lead)
- [ ] **CKPT-2 / OWNER-ATT-2** — DbFjz custody attestation
- [ ] **CKPT-3/4** — 7-signer ceremony; bind `⟨OWNER-1…7⟩` public addresses
- [ ] **T12-5** — SafeProxyFactory + fallback-handler policy selection
- [ ] **CKPT-5/6** — Safe-B dossiers + quorum proofs + exact grant set (with ECON-DEC-2, OPS-DEC-1)
- [ ] **T12-6** — handover-window policy (batch / pause / accept)
- [ ] **CKPT-7** — revoke set + irreversibility inventory + evacuation destinations (EVM + Solana parts)
- [ ] **T12-8** — 4saT 4.98 SOL evacuation urgency acknowledgment
- [ ] **CKPT-8** — Squads program identity owner-side verification (if S-1/S-6)
- [ ] **SOL-DEC-1** — current-mint disposition (S-1/S-2/S-3/S-4)
- [ ] **DEC-3 / ECON-DEC-3** — Solana decimals (economic approval; an option, never automatic)
- [ ] **ECON-DEC-2** — Reserve-module MINTER policy (blocks T-2.4 inclusion/exclusion)
- [ ] **OPS-DEC-1 / T12-7** — module-MINTER operational policy
- [ ] **DEC-1…7** — canonical architecture selection + conflict dispositions (APPROVED-CANONICAL stays 0 until this)
- [ ] **T12-9** — adopt address-book validation as standing tool
- [ ] **CKPT-9** — commission the independent reviewer (precedes any "contained/rotated/revoked" language)
- [ ] **RELEASE-GRANTS** — any release-control grant, only via the owner-authored authorization file outside git

---

## 11. What has NOT been done (honest close-out; no PASS claims for anything not run this cycle)

- **No on-chain probe was re-run for this deliverable.** Every chain fact is DEVELOPER-REPORTED at the Task 12 anchors (Monad 73,243,944 · Arc 68,520,264 · RH 140,748,341 · Solana slot 513,885,476); a fresh re-anchor is due before any acceptance claim (§9.3). No verification of on-chain state was performed or claimed this cycle.
- **No migration step has ever been executed** — zero transactions, signatures, broadcasts, deployments, role/authority/ownership changes, asset movements, mints, burns, or history rewrites across Tasks 10–13. The §5 packages remain unsigned and unexecuted.
- **No verification of remediation exists** — nothing has been executed, so there is nothing to verify; CKPT-9 has not been commissioned. Both compromised credentials remain UNRESOLVED and fully privileged.
- **No supply model has been chosen** (D-13.10 OPEN); **no canonical generation is selected** (APPROVED-CANONICAL = 0); no fee rate, decimal, or economic parameter is approved.
- **No cross-chain supply reconciliation test exists** (§7 — NOT IMPLEMENTED); no gate was advanced by this document, and no documentation/test/typecheck/lint result ever advances a gate.
- **Repository hygiene state:** worktree clean of known secret literals, but git history still contains both literals in all encodings (T12-1 pending); `upload/private_key.txt` remains quarantined (D-13.1 pending — the worktree secret gate is intentionally RED); remote/CI/backup exposure remains UNVERIFIED (OWNER-ATT-1).
- **Posture unchanged: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**

---

### Sources (read-only, cited this cycle)

`worklog.md` (tail: Task 12 + Task 13 Stage A entries) · `audit-work/task13/README.md` · `baseline-and-change-matrix.md` (§2, §3, §5 Stage H, §9, §10) · `src/lib/mtq/contracts.ts` · `src/lib/mtq/address-book-validation.ts` · `task10/D2-CANONICAL-ADDRESS-BOOK-PROPOSAL.md`, `D4-PRIVILEGE-AUTHORITY-GRAPH.md`, `D5-SUPPLY-GENESIS-CUSTODY-REPORT.md` · `task11/D6-CANONICAL-ARCHITECTURE-DECISIONS.md`, `D2-EXPOSURE-SURFACE.md` · `task12/D4-EVM-AUTHORITY-MIGRATION-PACKAGE.md`, `D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md`, `D8-OWNER-APPROVAL-CHECKLIST.md`, `register-task12.json`, `evidence/fresh-anchors-task12.json` · `task13/unresolved-decisions-and-owner-approvals.md`. No file under `upload/` was opened, read, printed, hashed, or copied (T13-INC-001 discipline); no `.env` or secret-shaped file was read; no network/RPC command was run.
