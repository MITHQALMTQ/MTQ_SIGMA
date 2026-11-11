# Phase 0 — EVM Key Compromise Containment Readiness (Deliverable C)

**Document ID:** SEC-P0-EVMCR-001 · **Version:** 1.0 · **Prepared:** 2026-11-11T13:50Z (UTC) · **Workstream:** C
**Branch:** security/phase-0-review-prep @ fc9ad97 (docs-only; ancestry unchanged) · **Author role:** implementer AI-agent lineage (evidence preparer — NOT an independent auditor)
**Release classification:** TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED

> **Standing independence limitation:** prepared inside the assessed environment by the implementer's own agent lineage; all network/chain results herein are implementer-side and require independent reproduction per the reviewer handoff package (SEC-P0-HANDOFF-001). No secret value is reproduced anywhere — fingerprints, status codes, counts, and object identifiers only.

**Companion documents (this branch, referenced by ID):** SEC-P0-EVIDENCE-001 (Workstream A) · SEC-P0-EXPOSURE-001 (B) · **SEC-P0-EVMCR-001 (C — this file)** · SEC-P0-SOLCR-001 (D) · SEC-P0-APIREV-001 (E) · SEC-P0-BOOT-001 (F) · SEC-P0-IDENT-001 (G) · SEC-P0-HANDOFF-001 (H) · SEC-P0-DECISIONS-001 (I) · SEC-P0-EXEC-001 (J). Extends, never contradicts: SEC-P0-ADDENDUM-001, SEC-P0-IRP-001, SEC-P0-MGMT-001, SEC-P0-DELTA-001, SEC-P0-SECHIST-001.

---

## 0. Framing, scope, and guardrail compliance

**0.1 Treat-as-compromised rule.** The exposed EVM signer material (C-045-a, deriving EOA `0x3C3932F865892EFabE45892f453f81B64f6c8d8c`) is treated as **compromised**: it is never used, reproduced, derived, displayed, or tested in this session [VERIFIED-FACT — zero signing operations performed; probe log in §1 contains read-only RPC methods only]. Its public git-history exposure is anonymously retrievable by direct object address [HISTORICAL — SEC-P0-ADDENDUM-001 §2/§5]; rotation is therefore mandatory regardless of any containment sequencing below.

**0.2 Fresh independent verification is mandatory.** Everything in §1 is labeled **implementer-side fresh read (NOT independent verification)** and is preparer evidence only. The external reviewer must reproduce every cell from an independent network path before any containment stage is labeled verified (master directive §4; SEC-P0-MGMT-001 §5.1 Phase A; SEC-P0-HANDOFF-001). A failed query is UNVERIFIED — never a negative result.

**0.3 Guardrail compliance (this session).**

| Guardrail | Status |
|---|---|
| No on-chain transactions (eth_call/eth_blockNumber/eth_chainId/eth_getBalance/eth_getCode only, via anonymous public RPC) | RESPECTED [VERIFIED-FACT — §1 probe inventory] |
| No key use, derivation, import, or testing | RESPECTED — the compromised material was never touched |
| No contract modification / deletion / deployment ("delete not working" instruction) | **DECLINED — see §7** |
| Exactly one output file written; no other file created/modified/deleted; no git mutation | RESPECTED — this file only; read-only `git show/log` for historical address recovery |
| Secret-gate hygiene (64-hex values on neutral-word lines only) | RESPECTED — role constants carry neutral labels; fingerprints used elsewhere |
| 2026-11-11 owner-message credential disclosure event (values redacted) | Registered §7.4 — rotation urgently recommended, relationship to embedded push token UNKNOWN pending owner comparison |

**0.4 What this document is NOT.** No rotation, revocation, migration, renunciation, deprecation, evacuation, or remediation is claimed performed or completed anywhere below. Every owner action remains OPEN. EVM contracts are immutable — all authority changes are owner-authorized Phase-1 transactions (§6).

---

## 1. Fresh implementer-side read-only chain evidence — 2026-11-11T13:27:58Z–13:38:42Z

**1.0 Method.** Anonymous read-only JSON-RPC over HTTPS via `curl -s -m 12 -X POST -H 'content-type: application/json'` to the three public testnet RPCs; each probe set anchored with `eth_blockNumber` **before AND after**; UTC timestamps recorded per set; `eth_chainId` asserted per chain. Calldata encoding: `hasRole(bytes32,address)` = `0x91d14854` + role hash (64 hex) + account **zero-padded to 32 bytes** (24 leading zeros + 40-hex address); TRUE = result word ends `…01`, FALSE = `…00` (SEC-P0-MGMT briefing §5). `owner()` `0x8da5cb5b` · `getOwner()` `0x893d20e8` · `getOwners()` `0xa0e67e2b` · `getThreshold()` `0xe75235b8` · `nonce()` `0xaffed0e0` · `paused()` `0x5c975abb` · `name()` `0x06fdde03` · `symbol()` `0x95d89b41` · `totalSupply()` `0x18160ddd` · `balanceOf(address)` `0x70a08231`. Method noise disclosure: two early calldata-construction mistakes (unpadded address argument; `printf` padding failure) produced `-32602 Invalid params` / revert outputs that were **discarded** — discarded outputs are not negative results and are excluded; every reported cell below used verified-encoded calldata. No probe files were written to any filesystem.

### 1.1 Monad Testnet (chainId 10143 — asserted `0x279f` ✓; RPC `https://testnet-rpc.monad.xyz`) — implementer-side fresh read (NOT independent verification)

| Probe set | Window (UTC) | Block anchor before → after |
|---|---|---|
| A — MTQ role matrix (15 cells) | 13:30:43–13:30:52Z | 78,853,496 → 78,853,525 |
| B — metadata + owner()/getOwner() + Safe dossier + balances | 13:31:12–13:31:21Z | 78,853,586 → 78,853,619 |
| C — module-side roles | 13:36:27–13:36:35Z | 78,854,602 → 78,854,627 |
| D — Governance-contract surface | 13:37:22–13:37:25Z | 78,854,781 → 78,854,790 |
| E — generation probes (gen-A/gen-B) | 13:34:12–13:34:36Z | 78,854,174 → 78,854,249 |
| F — token balanceOf (EOA/Safe) | 13:38:38–13:38:42Z | 78,855,023 → 78,855,033 |

**MTQ `0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD` — metadata [VERIFIED-FACT, set B]:** `name()` = "MITHQAL" (ABI len 7, `4d49544851414c`) · `symbol()` = "MTQ" · `totalSupply()` = 310,949,000,000,000,000,000 wei = **310.949 MTQ** (raw `0x10db48c40586f08000`) · `paused()` = FALSE.

**hasRole matrix on the MTQ token [VERIFIED-FACT, set A] (TRUE/FALSE per cell):**

| Role (on MTQ) | EOA `0x3C39…c8d8c` | Genesis Safe `0xE718…A7D0` | Governance `0xE35a…Bd66` | Mint module `0x197e…0809` | Redeem module `0x9632…35a4` |
|---|---|---|---|---|---|
| DEFAULT_ADMIN_ROLE | **TRUE** | **TRUE** | FALSE | FALSE | FALSE |
| MINTER_ROLE | **TRUE** | **TRUE** | FALSE | **TRUE** | **TRUE** |
| PAUSER_ROLE | **TRUE** | **TRUE** | FALSE | FALSE | FALSE |

**Module-side roles (roles ON the modules, EOA as account) [VERIFIED-FACT, set C]:** Mint module ADMIN=TRUE, MINTER=TRUE · Redeem module ADMIN=TRUE, MINTER=FALSE.

**Ownership surface [VERIFIED-FACT, set B]:** `owner()` and `getOwner()` on the MTQ token, the Mint module and the Redeem module all **EVM-revert** → no Ownable owner surface on the canonical estate; module authority is AccessControl DEFAULT_ADMIN (fresh cells above; remaining 4 modules not re-probed this session — [HISTORICAL] Task-12 D4 @ block 73,243,944: deployer ADMIN on all 6 Monad modules).

**Genesis Safe `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0` [VERIFIED-FACT, set B]:** `getOwners()` = `[0x3C39…c8d8c]` (1 owner) · `getThreshold()` = **1** · `nonce()` = **0**.

**Balances [VERIFIED-FACT, sets B/F]:** EOA native = 0.224343224122819642 MON · Safe native = 0 · EOA `balanceOf` MTQ = 309.948999999999999997 (99.68% of supply) · Safe `balanceOf` MTQ = 0.

**Governance contract `0xE35a…Bd66` [VERIFIED-FACT, set D]:** `hasRole(ADMIN, EOA)` and `owner()` both EVM-revert — non-AccessControl surface re-confirmed (no source published → N-01 no-interaction rule [HISTORICAL — TASK9 G.2; IRP-001 §3.1.4]).

### 1.2 Arc Testnet (chainId 5042002 — asserted `0x4cef52` ✓; RPC `https://rpc.testnet.arc.io`) — implementer-side fresh read (NOT independent verification)

| Probe set | Window (UTC) | Block anchor before → after |
|---|---|---|
| A+B — metadata + role matrix + owner()/getOwner() + Safe dossier + balances | 13:31:31–13:31:54Z | 71,884,725 → 71,884,770 |
| C — module-side roles | 13:36:27–13:36:35Z | 71,885,315 → 71,885,325 |
| D — Governance-contract surface | 13:37:22–13:37:25Z | 71,885,422 → 71,885,425 |
| E — generation probes | 13:34:12–13:34:36Z | 71,885,044 → 71,885,092 |
| F — token balanceOf (EOA/Safe) | 13:38:38–13:38:42Z | 71,885,572 → 71,885,575 |

**MTQ `0x237c3Aa2B79248f86f6523D3890095BCd1996601` — metadata [VERIFIED-FACT]:** name = "MITHQAL" · symbol = "MTQ" · totalSupply = 1,000,000,000,000,000,000,000 wei = **1,000 MTQ** · `paused()` = FALSE.

**hasRole matrix on the MTQ token [VERIFIED-FACT]:**

| Role (on MTQ) | EOA | Genesis Safe | Governance | Mint module `0x0dd8…c3aa` | Redeem module `0xcAde…aF8e` |
|---|---|---|---|---|---|
| DEFAULT_ADMIN_ROLE | **TRUE** | FALSE | FALSE | FALSE | FALSE |
| MINTER_ROLE | **TRUE** | FALSE | FALSE | **TRUE** | FALSE |
| PAUSER_ROLE | **TRUE** | **TRUE** | FALSE | FALSE | FALSE |

**Module-side roles [VERIFIED-FACT]:** Mint module ADMIN=TRUE, MINTER=TRUE · Redeem module ADMIN=TRUE, MINTER=FALSE. **Ownership:** `owner()`/`getOwner()` revert on token, Mint module, Redeem module. **Genesis Safe [VERIFIED-FACT]:** owners = `[EOA]` · threshold = **1** · nonce = **0**. **Governance `0xE35a…Bd66`:** hasRole/owner revert (different bytecode from Monad at the same hex [HISTORICAL — TASK9 G.1]; same no-source caveat).

**Balances [VERIFIED-FACT]:** EOA native = 19.026597151851474173 (Arc native) · Safe native = 0 · EOA `balanceOf` MTQ = 998.999999999999999997 (99.9% of supply) · Safe `balanceOf` MTQ = 0.

### 1.3 Robinhood Chain Testnet (chainId 46630 — asserted `0xb626` ✓) — implementer-side fresh read (NOT independent verification)

**RPC discovery (worktree, read-only):** `TESTNET_READINESS.md` carries **no** Robinhood addresses (chain-readiness checklists only — [VERIFIED-FACT, grep]). A public RPC **was found**: `https://rpc.testnet.chain.robinhood.com/rpc` in `scripts/run-onchain-tests.ts:38`, `scripts/check-usdc.ts:5`, `scripts/deploy-ecosystem.ts:19`, `scripts/onchain-tests.ts:186`, worklog.md:7786/8691, and `audit-work/task12/evidence/fresh-anchors-task12.json:92`. Token addresses found read-only: MTQToken `0xAF5B…C5A5` (scripts + worklog) and the full 10-contract set recovered via read-only `git show a6baced^:contracts/deployments/Robinhood-Chain-Testnet-Ecosystem.json` (rows removed from the live registry by owner decision 2026-10-24 [HISTORICAL — worklog Task 23; DEPLOYMENT-RECORD §3.4]). Because a public RPC was found, the chain was probed identically — the registry removal did **not** remove chain state.

| Probe set | Window (UTC) | Block anchor before → after |
|---|---|---|
| A — metadata + role matrix + owner()/getOwner() + gen-A owner + "Safe" dossier + balances | 13:33:30–13:33:53Z | 151,835,320 → 151,835,447 |
| B — module-side roles | 13:36:27–13:36:35Z | 151,836,345 → 151,836,357 |
| C — token balanceOf (EOA) | 13:38:38–13:38:42Z | 151,837,126 → 151,837,135 |

**MTQToken `0xAF5B85658d074e071BbF392395a2ddA9B644C5A5` (gen-B twin) [VERIFIED-FACT]:** name = "MTQΣ" (ABI len 5, `4d5451cea3`) · symbol = "MTQ" · totalSupply = 1,001,000,000,000,000,299,700,000 wei ≈ **1,001,000.00000000003 MTQ** · `paused()` = FALSE.

**hasRole matrix on the Robinhood MTQToken [VERIFIED-FACT]:**

| Role (on MTQToken) | EOA | Registry "Safe" `0xa3CE…5691` | Governance `0x80FF…32B56` | Mint module `0xeF32…D084` | Redeem module `0x3aCE…8ac44` |
|---|---|---|---|---|---|
| DEFAULT_ADMIN_ROLE | **TRUE** | FALSE | FALSE | FALSE | FALSE |
| MINTER_ROLE | **TRUE** | FALSE | FALSE | **TRUE** | FALSE |
| PAUSER_ROLE | **TRUE** | **TRUE** | FALSE | FALSE | FALSE |

**Module-side roles [VERIFIED-FACT]:** Mint module ADMIN=TRUE, MINTER=TRUE · Redeem module ADMIN=TRUE. **Ownership:** `owner()`/`getOwner()` revert on MTQToken, Mint module, Redeem module. **gen-A "MTQSigma" `0xA3B89FfdE28577A7D30E2c22503dB33509044EF0` (Ownable): `owner()` = `0x3C39…c8d8c` [VERIFIED-FACT]** — the deployer's owner() power on this token is live today.

**Robinhood "Safe" `0xa3CE28A10854B375272D528EeC4295D6bcd75691` [VERIFIED-FACT]:** `getOwners()` / `getThreshold()` / `nonce()` all EVM-revert → **re-proven NOT a genuine Safe** (matches Task 10/11 [HISTORICAL]; the registry's "Safe (Multi-Sig, 4/7)" label is contradicted by the runtime dossier). There is no Genesis Safe `0xE718…A7D0` instance on this chain in any repo record [HISTORICAL — TASK9 G.2 note: the two 171-B Genesis Safes are Monad + Arc only].

**Balances [VERIFIED-FACT]:** EOA native = 0.0098211602 ETH · registry-"Safe" native = 0 · EOA `balanceOf` MTQToken = totalSupply − 3 wei (≈ sole holder).

**Hex collisions re-noted [HISTORICAL — TASK9 G.1 "Finding"; C-042-1..9]:** Robinhood Takaful `0x1bbC…6177` = Monad Reserve; Robinhood MockUSDC `0xFd2B…861e` = Arc Oracle; `0xA3B8…44EF0` = Robinhood gen-A token AND Arc's current Takaful. Any checklist that resolves "the Robinhood estate" by hex alone will read the wrong chain's contract.

### 1.4 Multi-generation probes (Task-9 duplicate-MTQ dossier; checking one token does NOT prove the estate)

[VERIFIED-FACT — Monad blocks 78,854,174→78,854,249; Arc blocks 71,885,044→71,885,092; Robinhood block 151,835,320→151,835,447]

| Generation | Address | Fresh result |
|---|---|---|
| Monad gen-A `0x5D9564C27111EA65Da3228a79833F0FF129bfd4a` | Ownable | `owner()` = EOA |
| Arc gen-A `0x826b82F79FD6c5347cDC568B1d0A7918128B63c1` | Ownable | `owner()` = EOA |
| Arc gen-C `0x5C728F729110013A1fa59fFc85938bbD973A2563` | Ownable | `owner()` = EOA |
| Robinhood gen-A `0xA3B8…44EF0` | Ownable | `owner()` = EOA (§1.3) |
| Monad gen-B `0x0Ac20360234b4C988a19586CBe55733e18A5982f` | AccessControl | EOA holds ADMIN/MINTER/PAUSER all **TRUE**; totalSupply = 1,000,000.000000000001998 |
| Arc gen-B `0x24203404B9b971C907e8Ced96106Fa74380d9897` | AccessControl | EOA holds ADMIN/MINTER/PAUSER all **TRUE**; totalSupply identical to Monad gen-B (byte-identical twin) |

### 1.5 Drift analysis vs the 2026-10-21 role-matrix-authoritative.json [HISTORICAL]

| Cell group (authoritative matrix, Monad block 73037271 / Arc 68397451) | 2026-10-21 value | Fresh 2026-11-11 value | Verdict |
|---|---|---|---|
| Monad MTQ × {EOA, Safe, Governance} × 3 roles (9 cells) + paused() | TRUE×6 / FALSE×3 (roles) / paused FALSE | identical | **NO DRIFT** |
| Arc MTQ × {EOA, Safe, Governance} × 3 roles + paused() | TRUE×4 / FALSE×5 / paused FALSE (Safe = PAUSER only) | identical (asymmetry preserved) | **NO DRIFT** |
| Module-side cells (Mint/Redeem ADMIN/MINTER, EOA) | Mint: A=T,M=T · Redeem: A=T,M=F (both chains) | identical | **NO DRIFT** |
| Safe dossiers (both chains) | 1 owner [EOA], threshold 1, nonce 0 | identical | **NO DRIFT** |
| Supplies / name / symbol | 310.949 / 1,000 · MITHQAL / MTQ | identical | **NO DRIFT** |
| EOA native + token balances | Monad 0.224343224122819642 MON + 309.948999999999999997 MTQ · Arc 19.026597151851474173 + 998.999999999999999997 [HISTORICAL — Task-12 fresh-anchors] | identical, all three chains (RH 0.0098211602 + supply−3 wei) | **NO DRIFT — zero compromised-EOA movement 2026-10-24 → 2026-11-11** (consistent with the §5.3 zero-activity watch; any movement = active incident) |
| Token-side module grants (Mint/Redeem module as MINTER **on the token**) | **Not in the 2026-10-21 JSON**; TASK9 (same day, later session) recorded cross-contract hasRole **FALSE** on both chains | Mint module MINTER = TRUE on Monad, Arc **and** Robinhood; Redeem module MINTER = TRUE on Monad only | **DRIFT vs TASK9 2026-10-21** — the grants post-date that probe, were recorded by Task 11/12 [HISTORICAL — D4 §1.1 "dormant Redeem grant"], and persist today |
| Governance-contract surfaces | EVM reverts (no AccessControl) | EVM reverts (fresh, both chains) | **NO DRIFT** |

**Reading of the drift row:** the only authority change since 2026-10-21 is the (already-recorded) token-side MINTER grants to the Mint modules on all three chains and to the Monad Redeem module — the wired-mint path D4 planned around. No unauthorized change was detected in any probed cell; absence of drift is implementer-side evidence only, never proof of no attacker action (unprobed surfaces: §8).

---

## 2. Source-side enumeration (read-only) — contracts/MTQSigma*.sol + MtqEcosystem.sol

**2.1 Standing caveat.** No deployed contract matches any local build artifact; sources are unpublished/unverified on the explorers (Arc `is_verified: false`; Monadscan CF-gated) [HISTORICAL — TASK9 G.1/N-01]. The enumeration below is therefore an **expected-power reference**; deployed semantics (including the deployed modules' custom roles) remain UNESTABLISHABLE until source publication + verification (N-01, owner action).

**2.2 Role constants found in source [VERIFIED-FACT — file reads; hashes computed via the allowed keccak one-liner (`bun -e` with ethers `id()`), per briefing R6].** Canonical (already in evidence base): DEFAULT_ADMIN `0x0000000000000000000000000000000000000000000000000000000000000000` · MINTER `0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6` · PAUSER `0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a`. Additional constants:

| Constant (file) | Digest (keccak) |
|---|---|
| ADMIN_ROLE (MTQSigmaV2/V3/V4) | 0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775 |
| KEEPER_ROLE (V2/V3/V4; MtqEcosystem AlgorithmEngine) | 0xfc8737ab85eb45125971625a9ebdb75cc78e01d5c1fa80c4c6e5203f47bc4fab |
| ORACLE_ROLE (V2/V3; MtqEcosystem Oracle) | 0x68e79a7bf1e0bc45d0a330c573bc367f9cf464fd326078812f301165fbda4ef1 |
| MONETARY_CONTROL_ROLE (MTQSigmaV3.sol:173) | 0xea671cccb68025f77c8e462cf71311a0f427dbcfe03a2d403b16a95eea8c5549 |
| MTQ_GOVERNANCE_ROLE (MTQSigmaV4.sol:179) | 0xf55039830b025ea56c59765c7648730b4dd1dc2614d7014371d60f8f1610d114 |
| MTQ_EMERGENCY_ROLE (MTQSigmaV4.sol:183) | 0xb4856421d85c4e77f0d01a0f0954d1d86dfea18d25e9fa074b52d5b88f532cde |
| PROPOSER_ROLE / EXECUTOR_ROLE (MtqEcosystem Governance) | 0xb09aa5ae…91cc1 / 0xd8aa0f31…69e63 |
| REBALANCER_ROLE (MtqEcosystem ReserveVault) | 0xccc64574…30f46 |
| OPERATOR_ROLE (MtqEcosystem Takaful) | 0x97667070…4b929 |
| "SIGNER_ROLE" (MtqEcosystem pseudo-Safe row) | 0xe2f4eaae…85f70 (fingerprint) |
| REDEEM_ROLE (deployed Redeem custom role, D4 §5.2) | 0x23ab158a…8501e (fingerprint) |

Cross-validation: ADMIN_ROLE digest matches the deployed Redeem module's custom admin value `0xa4980720…1775` [HISTORICAL — D4 §5.2] — the source family and the deployed module role vocabulary are related, but deployed membership cells remain UNVERIFIED (D9/E-15/E-16, §8).

**2.3 Mint / genesis / reserve function inventory (source, read-only).**

| File | Mint/genesis/reserve-related functions (gating) |
|---|---|
| MTQSigma.sol (v1.2 pilot / gen-A family source) | `mint(uint256 usdcAmount)` (open USDC-collateral path) · `genesisMint(uint256)` **onlyOwner** (one-shot genesis) · `setReserveVault(address)` onlyOwner · `setMintPaused(bool)` / `setFxRates` / `setProtocolStatus` onlyOwner · MockUSDC `mint(address,uint256)` free-mint |
| MTQSigmaV2.sol (V3 source, PENDING deploy) | `mint(uint256 usdcAmount)` (nonReentrant/whenNotPaused) · `genesisMint(uint256)` / `setGenesisReserve(address)` / `setReserveVault(address)` / `setReserveHolding(...)` / `genesisIndex()` **onlyAdmin** · `renounceRole` (OZ) · KEEPER/ORACLE parameter surfaces |
| MTQSigmaV3.sol | as V2 (`genesisMint`/`setGenesisReserve`/`setReserveHolding` onlyAdmin) + council setters (`setDao`/`setRiskCouncil`/`setEmergencyCouncil`/`setConstitutionalCouncil`/`setStabilityAsset`/`setFeeWallet` — onlyConstitutionalCouncil/onlyRiskCouncil) + MONETARY_CONTROL_ROLE |
| MTQSigmaV4.sol | `grantRole`/`revokeRole` onlyRole(DEFAULT_ADMIN_ROLE); MTQ_GOVERNANCE/MTQ_EMERGENCY constants |
| MtqEcosystem.sol (modules source) | MTQToken `mint/pause/unpause` (MINTER/PAUSER) · MintContract `mint()` open-with-USDC + `setPrice` ADMIN · RedeemContract `redeem()` + `setPrice` ADMIN · Oracle `setPrice` ORACLE_ROLE · **Takaful `claim()` OPERATOR_ROLE (drains the USDC pool)** · ReserveVault `setNav` REBALANCER_ROLE · pseudo-Safe `submit/confirm` |

**2.4 Which powers survive an EOA role rotation (the §4 core question).**

| Power surface | Gating | Survives role rotation of the EOA? | Evidence |
|---|---|---|---|
| gen-A `owner()` + one-shot `genesisMint` gates + self-custodied 1,000,000 genesis (4 tokens: `0x5D95…`, `0x826b…`, `0x5C72…`, `0xA3B8…`) | Ownable | **YES** — until per-token `transferOwnership` or an explicit accept-provenance decision (D6/T-3.8) | fresh `owner()`=EOA ×4 [VERIFIED-FACT]; [HISTORICAL — D4 §1.4/§5.3 via IRP-001 §3.4] |
| gen-B twins (ADMIN+MINTER+PAUSER) | AccessControl | NO (revocable — but re-grantable by any remaining admin during any dual-admin window) | fresh all-TRUE ×2 [VERIFIED-FACT] |
| Canonical MTQ roles (both chains) | AccessControl | NO — revocation removes authority (but not the ability to sign) | fresh matrices §1.1–1.2 |
| Governance contracts (`0xE35a…Bd66`, two builds) | unknown — no source | **UNKNOWN** — no-interaction rule stands (publish source → audit → decide) | fresh reverts [VERIFIED-FACT]; [HISTORICAL — N-01] |
| Deployed-module custom roles (Redeem ADMIN/redeem-role, etc.) | unknown ABI | **UNKNOWN — UNVERIFIED** (D9 cells E-15/E-16 unprobed) | [HISTORICAL — D4 §5.2] |
| EOA-held token/native balances (all three chains) | possession | YES until evacuated (T-3.8) | fresh balances §1.1–1.3 |
| Robinhood registry rows | (registry only) | registry removal ≠ chain change — the RH estate remains fully live | fresh RH probes [VERIFIED-FACT] |

---

## 3. Owner/reviewer evidence checklist per chain (master directive §4.1 — every item; all reproducible read-only)

**3.0 Reproducibility rule.** Every role query below is reproducible with public read-only calls or an independent block explorer from an unauthenticated client on an independent network path. Exact template (briefing §5; address argument **must be zero-padded to 32 bytes**):

```
# anchor BEFORE and AFTER every probe set:
curl -s -m 12 -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' <RPC>
# role probe (hasRole):
curl -s -m 12 -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"<ADDR>","data":"0x91d14854<roleHash-64hex><addr-padded-64hex>"},"latest"]}' <RPC>
# owner()/getOwners()/getThreshold()/nonce()/paused()/name()/symbol()/totalSupply()/balanceOf():
#   selectors 0x8da5cb5b · 0x893d20e8 · 0xa0e67e2b · 0xe75235b8 · 0xaffed0e0 · 0x5c975abb · 0x06fdde03 · 0x95d89b41 · 0x18160ddd · 0x70a08231+<addr-padded>
# code hash: eth_getCode at the anchored block, then keccak256 of the returned runtime bytecode
```

Explorer guidance: **Monad** — testnet.monadscan.com is Cloudflare-bot-gated from this sandbox [HISTORICAL — TASK9 G.1]; reviewer with an unauthenticated browser must confirm code/verified-source state. **Arc** — the chain's public Blockscout instance (API used by TASK9 G.6; `is_verified:false` recorded); creation receipts are explorer-indexed there. **Robinhood** — `https://explorer.testnet.chain.robinhood.com` with `/address/<hex>` pages [VERIFIED-FACT — scripts/deploy-ecosystem.ts:19]. All three: pin the block number in every recorded read.

**3.1 Per-chain checklist (fresh implementer-side value cited; independent reproduction REQUIRED for every cell — EXTERNAL EVIDENCE REQUIRED).**

| §4.1 item | Monad 10143 | Arc 5042002 | Robinhood 46630 |
|---|---|---|---|
| Chain ID | 10143 asserted [VERIFIED-FACT] | 5042002 asserted [VERIFIED-FACT] | 46630 asserted [VERIFIED-FACT] |
| Canonical RPC source | testnet-rpc.monad.xyz (public) | rpc.testnet.arc.io (public) | rpc.testnet.chain.robinhood.com/rpc (public; found read-only in scripts/) |
| Named block height | 78,853,496–78,855,033 (§1.1) | 71,884,725–71,885,575 (§1.2) | 151,835,320–151,837,135 (§1.3) |
| Token addresses | `0x9e6E…53aD` (+gen-A `0x5D95…`, gen-B `0x0Ac2…`) | `0x237c…6601` (+gen-A `0x826b…`, gen-C `0x5C72…`, gen-B `0x2420…`) | `0xAF5B…C5A5` (+gen-A `0xA3B8…44EF0`); **all generations must be verified — one token ≠ the estate** |
| Contract code hashes | reviewer computes (eth_getCode+keccak); [HISTORICAL] fingerprints: MTQ `0x9057c3e6…55bbb` (6,681 B), gen-B `0x31496b92…0180`, gen-A `0xa7331051…e92e` | reviewer computes; [HISTORICAL] MTQ `0x0183b25e…12fcf` (3,474 B), gen-B twin identical to Monad | reviewer computes; [HISTORICAL] MTQToken = gen-B twin `0x31496b92…`, gen-A `0xa7331051…`, fake-"Safe" `0x3c6c7d25…c04e` (3,321 B) |
| Proxy implementation | none on tokens/modules [HISTORICAL — TASK9 G.1]; Safe = SafeProxy v1.4.1, singleton `0x29fcB43b…C762` | same | none; "Safe" row is a 3,321-B non-Safe (fresh reverts) |
| DEFAULT_ADMIN roles | EOA+Safe on MTQ; EOA on all 7 AC contracts (modules fresh ×2; others [HISTORICAL] D4) | EOA only on MTQ; EOA on all 7 modules (fresh ×2; others [HISTORICAL]) | EOA on MTQToken; EOA on modules (fresh ×2) |
| MINTER roles | EOA+Safe+Mint module+Redeem module on MTQ; EOA on Mint module (fresh) | EOA+Mint module on MTQ; EOA on Mint module (fresh) | EOA+Mint module on MTQToken (fresh) |
| PAUSER roles | EOA+Safe on MTQ | EOA+Safe (asymmetry) | EOA+registry-"Safe" (fresh) |
| RESERVE-related roles | Reserve module `0x1bbC…6177` ADMIN (EOA) + MINTER (EOA, ECON-DEC-2 pending) [HISTORICAL — 2026-10-21 JSON; D4 §1.1] — NOT re-probed fresh | Reserve module `0x27a1…c471` ADMIN (EOA), no MINTER [HISTORICAL] — NOT re-probed fresh | ReserveVault `0x5929…67d6e` UNVERIFIED this session |
| Module ownership | owner()/getOwner() revert (fresh ×2); authority = DEFAULT_ADMIN | same (fresh ×2) | same (fresh ×2) |
| Ownable owner addresses | gen-A `0x5D95…` owner=EOA (fresh) | gen-A `0x826b…` + gen-C `0x5C72…` owner=EOA (fresh) | gen-A `0xA3B8…` owner=EOA (fresh) |
| Genesis-mint permissions | gen-A one-shot genesisMint owner-gated [HISTORICAL — D4 §1.4]; deployed semantics UNVERIFIED | same | same |
| Safe owners | `[EOA]` (fresh) | `[EOA]` (fresh) | n/a — no genuine Safe; fake row reverts (fresh) |
| Safe threshold | **1** (fresh) — mandated 4/7 DISPROVED (OD-35) | **1** (fresh) | n/a (fake row) |
| Safe modules / guard | `[]` / address(0) [HISTORICAL — TASK9 G.3] — reviewer re-reads | same | n/a |
| Safe nonce | **0** (fresh) — never executed any transaction | **0** (fresh) | n/a |
| Treasury balances (MTQ/USDC in contracts) | Safe holds 0 MTQ (fresh); no USDC custody at current-generation addresses [HISTORICAL — TASK9 G.3] | same pattern (fresh Safe=0) | Mint module historically funded 1,100,000 MockUSDC [HISTORICAL — DEPLOYMENT-RECORD §3.4] — UNVERIFIED fresh |
| Native-asset balances | EOA 0.224343224122819642 MON / Safe 0 (fresh) | EOA 19.026597151851474173 / Safe 0 (fresh) | EOA 0.0098211602 ETH (fresh) |
| Remaining privileges of the compromised EOA | §2.4 table — roles + gen-A owner() + ~99.7% supply + native | same (+99.9% supply) | same (+≈sole holder) |

---

## 4. Rotation strategy comparison — Option A vs Option B (master directive §4.2; grounded in SEC-P0-ADDENDUM-001 §7.2–§7.3 and D4)

| Dimension | A — migrate permissions on the existing estate (D4/D5/ROLE_ROTATION) | B — independent replacement testnet estate + formal deprecation |
|---|---|---|
| Compromised-signer dependency | Every grant/revoke is signed by the exposed EOA in an owner-controlled session (D4 design premise) — the window is structural and unresolvable on this estate | **Establishment needs zero old-signer participation**; deprecation steps re-introduce it |
| Grant-before-revoke requirement | Inherent (never-batch; destination verified working first — T-1.4 hard gate) | Not applicable to establishment; re-appears in old-estate deprecation |
| Nonce competition | Every migration tx consumes the EOA nonce — attacker can interleave/replace-by-fee | None during establishment; only optional deprecation is exposed |
| Mempool front-running | Exposed throughout (public testnet mempools) | Establishment clean; deprecation-only exposure |
| Re-grant attacks | Persist until the last old-admin surface is removed; any dual-admin window admits attacker re-grants | New estate immune; **the old estate can be re-granted by the attacker at any time, forever** unless A-style revocation completes or formal abandonment is accepted |
| Dual-admin windows | Inherent (grant-before-revoke keeps both old+new privileged) | None during establishment; bounded re-introduction inside deprecation |
| Old Safe exposure | Strip of the 1/1 Safe (T-3.2); in-place `addOwnerWithThreshold×7` path passes threshold-1 windows with a growing owner set — explicit risk acceptance required; D4 fresh-Safe path avoids the surgery but its establishment still needs old-signer grants | Old Safe stays 1/1 until stripped (A-style); Safe-B is 4-of-7 from birth via `createProxyWithNonce` (T-1.4 dossier gate) |
| Ownable permissions (gen-A twins) | `transferOwnership` per twin, each old-signer-signed | New estate has fresh owners; old twins keep `owner()` + genesis one-shots unless A-style transfers / accept-provenance decisions are made (D6/T-3.8) |
| Genesis-mint privileges | Must be neutralized per-twin during the window | Same residual on the old estate; new genesis under independent control |
| Native-asset exposure | Unchanged until evacuation (T-3.8) | Unchanged — evacuation still required either way |
| Permanent lockout risk | Erroneous last-admin renounce → **permanent** (immutable, self-administered AccessControl); step-8 renounce is policy-optional, rehearsal-prechecked | New-estate lockout risk minimal (4-of-7 from birth, dossier-gated); deprecation errors strand the deprecation, not the new estate |
| New contract authorization | n/a (existing contracts) | New immutable contracts carry correct authority **from birth**; deployment authority = fresh owner-side rotation EOA/signer ceremony (CKPT-3/4) |
| Safe-B 4-of-7 governance | destination of migrated roles | established at T-1.2/T-1.3 with the 7 signers that DO NOT EXIST YET (human ceremony outside any AI environment) |
| New supply initialization | n/a | starts at zero supply — testnet re-mint; **must preserve the existing MTQΣ monetary constitution (no parallel monetary policy / unauthorized supply system — see §5.0)** |
| Existing holder balances | preserved (same contracts); evacuation of deployer-held tokens still required | old-estate balances stay drainable under the old authority surface; migration of old balances would itself require old-signer action or accept-as-loss |
| Old-estate deprecation | is the plan itself | formal notice + A-style bounded deprecation, else **live attacker-controlled authority on immutable contracts indefinitely** (testnet-acceptable only with an explicit risk-acceptance record + monitoring) |
| Old-estate remaining mint permissions | revoked by the final T-3.6/T-3.7 steps | persist until separately revoked or formally abandoned — an indefinite residual mint window if neither |
| Ownable contracts remaining in the old estate | addressed by T-3.8 transfers | the gen-A `owner()` powers (fresh-verified, §1.4) persist — B alone does not touch them |
| Genesis-mint capabilities on the old estate | neutralized per-twin | persist (same residual) |
| Accounting & user migration | not required (same contracts) | required if old balances are honored: reconciliation record of old-vs-new balances, holder communication, legal review of retirement/disclosure obligations (D13.3 owner-decision brief) |
| Reconciliation of old and new balances | n/a | a second monetary supply is PREVENTED only if the old estate is neutralized or formally deprecated; a "migrated" label without old-estate disposition leaves two live supply systems |
| Protection against a second monetary supply | revocation removes old mint authority | new estate + old-estate disposition (deprecation/monitoring) — B without disposition leaves the second system live |
| Monitoring of abandoned contracts | final matrix + per-step verification | standing watch on every abandoned old contract (management plan §5.3 — any old-estate activity = active incident) |

**Verdict [HISTORICAL — SEC-P0-ADDENDUM-001 §7.3, re-asserted]:** (1) **neither approach is atomic** — controlled multi-stage only (never-batch, verify-after-every-step, T-13 fork-replay check, final independent matrix); (2) **Option B removes the compromised-signer window from the establishment of the new authority; it does NOT remove it from the deprecation of the old estate** — full deprecation is A-style and re-opens every old-signer vector (refuse / front-run / re-grant / nonce race); if the owner declines A-style deprecation, the old estate remains live attacker-controlled authority indefinitely. Option B must therefore **not** be described as resolving the compromised authority unless the old estate is actually neutralized or its remaining risks are explicitly accepted.

---

## 5. Management recommendation (master directive §4.3) — B-first replacement strategy as the preferred DESIGN CANDIDATE

**5.0 Constitutional constraint.** Any new estate must preserve the existing MTQΣ monetary constitution — the index methodology, supply discipline, and governance designs carried forward only after re-validation; **no new parallel monetary policy and no unauthorized supply system** [HISTORICAL — D13.3 proposed-decision text: "No legacy token, supply, balance, or authority may be assumed migratable safely merely because v3.0 is specified"; legacy disposition is a separate owner decision]. The new estate is a custody/authority replacement, not a monetary restart.

**5.1 Five stages (owner-authorized, sequenced; NOTHING herein executed or signed).**

| Stage | Content | Gate before next stage |
|---|---|---|
| 1 — Establish the new independent authority | 7 signers generated in a human-controlled ceremony OUTSIDE any repo/sandbox/AI environment; Safe-B 4-of-7 per chain via `createProxyWithNonce` (canonical singleton); replacement estate contracts authorized correctly from birth | T-1.4 dossier gate (owners/threshold/nonce/VERSION/singleton slot/modules/guard) + 4-sig no-op quorum proof |
| 2 — Migrate operations to the new estate | all NEW operations (mint policy, module wiring N-02, oracle N-01) run under Safe-B; no old-signer grant required for new-estate operation | fresh independently verified role matrix on the NEW estate |
| 3 — Deprecate the old estate | formal deprecation notice (all three chains incl. Robinhood); bounded, per-step-verified A-style strip of old roles (T-3.1..T-3.7) | each postcondition probe verified; any unexpected old-estate activity = active incident (§5.3 watch) |
| 4 — Revoke old permissions where possible | revoke EOA roles on all generations; strip old 1/1 Safes; `transferOwnership` per gen-A twin; evacuate balances (T-3.8) | final matrix shows old-EOA authority = 0 |
| 5 — Formally document residual authority that cannot be safely removed | written residual register (Governance no-source surfaces; any unrevokable/unreachable cell; abandoned contracts + monitoring plan) | owner risk-acceptance signature; independent reviewer sign-off closes the evidence chain |

**5.2 "Safe" label prerequisites (all three, cumulative [HISTORICAL — ADDENDUM-001 §7.3 item 4]):** (i) fresh role matrix showing the new authority active and verified (verify-safe VERIFIED 4/7 both chains; dossier gate); (ii) old-estate power inventory driven to **zero or formally accepted-as-residual** with a deprecation notice; (iii) the Solana checklist closed (C-045-b authorities resolved — SEC-P0-SOLCR-001 / ADDENDUM-001 §6). A migrated EVM estate with a live Solana superseded mint is NOT a contained rotation. Migration may not be labeled safe before all three hold.

---

## 6. Owner approval matrix (master directive §4.4) — required approvals per containment operation (no execution or signing in this assignment)

| # | Containment operation | Owner authorization | Security-lead approval | Independent reviewer confirmation | Multisig approval | Governance approval | Implementer/sandbox may execute? |
|---|---|---|---|---|---|---|---|
| 1 | Fresh read-only verification probes (§1 method) | Informational | No | **Mandatory reproduction** (independent RPC/explorer) | No | No | Not as sole source |
| 2 | Signer ceremony (7 identities, outside AI) | Required | Required (custody docs) | Witnessed | No | No | **NEVER** |
| 3 | Establish Safe-B 4-of-7 per chain (T-1.1–T-1.4) | Explicit | Required | Dossier-gate verification before any estate change | Quorum proof itself (4-sig no-op) | No (committee unconstituted — OD-3) | **NEVER** |
| 4 | Deploy replacement estate (Option B stage 1) | Explicit | Required | Code review + verified source (N-01 pattern) | No | Post-hoc ratification (D13.3) | **NEVER** |
| 5 | Grant-before-revoke migration steps (T-2.x, A-style) | Explicit **per step** | Required | Per-step witness | No | Written where mandated | **NEVER** |
| 6 | Old-estate deprecation notice + revocations (T-3.1–T-3.7) | Explicit per step | Required | Per-step + final matrix | Safe-B executes revocations | Written (R-02/R-04 class) | **NEVER** |
| 7 | Balance evacuation / gen-A `transferOwnership` (T-3.8) | Explicit + destinations | Required | Destination probe-verified before EACH transfer | No | Written (R-04) | **NEVER** |
| 8 | Residual-authority documentation + risk acceptance (stage 5) | Signature | Signature | Sign-off closes the evidence chain | No | No | Prepare text only |
| 9 | Robinhood chain-level disposition | Explicit decision | Required | Registry-vs-chain reconciliation | No | No | **NEVER** |
| 10 | Publish/verify contract sources (N-01) | Explicit | Required | Audit re-run on verified source | No | No | No |
| 11 | Standing old-estate monitoring (§5.3 watch) | Authorize watch | Required | Alerts triaged externally | No | No | Relay-level only |
| 12 | Any "delete not working contracts" instruction | **DECLINED** (§7) | — | — | — | — | **PROHIBITED** |

---

## 7. Declined instruction and open owner decisions

**7.1 Declined instruction (registered).** This session **DECLINED** the owner's appended instruction to *"check all contracts and roles available and delete not working"* in its destructive part. The read-only inventory **IS** delivered (§§1–2: every role-bearing surface probed or marked UNVERIFIED, all three chains, all generations). "Delete" is prohibited by the directive's own absolute guardrails (§§1.1/§11: no contract modification, no on-chain transactions, no destructive recovery) — and EVM contracts are immutable in any case: deprecation/renunciation are owner-authorized Phase-1 transactions (§6 rows 6–7), not deletions an agent may perform. Registered as an OPEN owner decision in SEC-P0-DECISIONS-001.

**7.2 Open owner decisions fed by this document.** (a) B-first strategy approval (§5) and its per-stage authorizations; (b) Robinhood chain-level disposition (registry rows already removed 2026-10-24; the live on-chain estate persists — §1.3); (c) signer ceremony CKPT-3/4; (d) ECON-DEC-2 (Reserve minting intent) and OPS-DEC-1 (module-MINTER end-state); (e) evacuation destinations T-3.8; (f) N-01 source publication; (g) canonical declaration C-041 across ≥3 live generations per chain.

**7.3 R8 disclosure event.** The 2026-11-11 owner-message credential disclosure event (values redacted) is registered here for the containment record: the exposed credential types were NOT used, NOT echoed, NOT stored; rotation is urgently recommended; relationship to the repo's embedded push token is UNKNOWN pending owner comparison [HISTORICAL — briefing R8; ADDENDUM-001 §11].

**7.4 Zero-activity watch status.** Fresh balances show zero movement of the compromised EOA on all three chains since the 2026-10-24 anchors [VERIFIED-FACT §1.5] — consistent with, but not proof of, no attacker action (§8).

---

## 8. Unverified register and final status

**Could NOT be verified this session (EXTERNAL EVIDENCE REQUIRED; failed queries are never negative results):**

1. **All §1 results as *independent* evidence** — implementer-side only; reviewer reproduction on an independent path is mandatory.
2. **Governance contracts** (`0xE35a…Bd66`, two builds, + RH `0x80FF…32B56`) — proposer/executor authority UNESTABLISHABLE without published source; no-interaction rule stands [HISTORICAL — N-01].
3. **Deployed-module custom roles** (Redeem ADMIN_ROLE/redeem-role membership; D9 cells E-15/E-16) — UNPROBED.
4. **Fresh contract code hashes** — reviewer computes via eth_getCode+keccak (§3.0); only [HISTORICAL] TASK9 fingerprints cited.
5. **Reserve-module roles, Oracle/Algorithm/Takaful module roles** — not re-probed this session (outside the assigned matrix); last verified [HISTORICAL] 2026-10-21 JSON / Task-12 D4.
6. **Robinhood ReserveVault/MockUSDC/Oracle/Takaful/AlgorithmEngine cells** — addresses recovered but not probed (only the assigned token/module/Safe set was).
7. **Safe modules/guard freshness** — [HISTORICAL] TASK9 G.3 only; reviewer re-reads `getModulesPaginated` + guard slot.
8. **Deployed-contract source identity** — no local artifact matches deployed bytecode [HISTORICAL — TASK9 G.1]; §2 is expected-power reference only.
9. **Monad deploy blocks/creators** — RPC state horizon + CF-gated explorer [HISTORICAL — TASK9 G.1] — UNVERIFIED.
10. **Historical dissemination of the exposed material** — UNRESOLVED [HISTORICAL — ADDENDUM-001 §5 four-way wording].

```
PHASE 0 — CONTAINMENT READINESS (EVM) — PREPARER EVIDENCE COMPLETE
INDEPENDENT VERIFICATION REQUIRED — ROTATION NOT PERFORMED — NO ON-CHAIN ACTION TAKEN
OLD-ESTATE AUTHORITY STILL LIVE AND FRESH-CONFIRMED ON ALL THREE CHAINS
PHASE 1 — NOT AUTHORIZED · TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED
```

No P0 finding is claimed resolved; no compromised authority is claimed contained; every resolution awaits independently verified owner/reviewer evidence. One file written; no git mutation; no credential used; no state-changing call made.
