# MTQΣ — TASK 9: FULL CONTRACT AUTHORIZATION AUDIT & EVIDENCE-BASED GAP CLOSURE

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**
§1 VERIFICATION-ONLY was respected throughout: read-only `eth_call` / `eth_getCode` / `eth_getStorageAt` / `eth_getLogs` / `eth_getBalance` / `eth_getTransactionReceipt` / `eth_getBlockByNumber` / Solana `getAccountInfo` family / Blockscout public API. **ZERO transactions were sent. No role was granted/revoked. No contract was deployed or upgraded. No key material is exposed in this report.**

Probed: 2026-10-21, 21:36–22:30 UTC · Monad block 73,066,261–73,069,003 · Arc block 68,414,779–68,416,416
Raw evidence: `audit-work/v9-task9/evidence/` (raw.jsonl = every request/response with retries; per-chain inventory JSONs; creation receipts; scan states)
Scripts: `audit-work/v9-task9/{full-audit,log-scan,deploy-recovery,scan-resume}.ts` — re-run with `bun <script> <chain>`.

**HEADLINE RECOMMENDATION (G.8): NOT ACCEPTED** — conditionally acceptable later, only after the P0 sequence in §G.7. Evidence below.

---

## G.1 CONTRACT INVENTORY & BYTECODE/SOURCE IDENTITY

### Monad Testnet (chainId 10143 — asserted at every probe; reported `0x279f` = 10143 ✓)

| Contract | Address | Deployed | Code size | Runtime keccak256 | Deploy block | Creator | Proxy |
|---|---|---|---|---|---|---|---|
| MTQ.sol | `0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD` | ✓ | 6,681 B | `0x9057c3e61d81f7d3e261f71b4cb5710a2d5043666766894772459dd643d55bbb` | **UNVERIFIED** (before RPC state horizon ~63.47M; explorer CF-gated) | deployer EOA (inferred, unverified) | none |
| Governance.sol | `0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66` | ✓ | **25,819 B** ⚠ over standard EIP-170 (24,576 B) | `0xb0624cbd4b9f219e36d4204ce180f17b2cd8f3692f097c35ff13d1011676057a` | UNVERIFIED (same) | — | none |
| Safe.sol | `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0` | ✓ | 171 B (SafeProxy) | `0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c` — **byte-identical to Arc** | UNVERIFIED | — | SafeProxy v1.4.1, singleton `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` (slot 0 = masterCopy ✓) |
| Algorithm.sol | `0x8839ce50e8D414005518769999c0A5b961D00CB2` | ✓ | 2,546 B | `0x20c147d708f712282e6823e27f5bd2785dc2ebe2387a76125cea7a1e38fd200a` | UNVERIFIED | — | none |
| Reserve.sol | `0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177` | ✓ | 5,703 B | `0x04a7116dd28265573d7f8ec5c984fa25453ec59567b241c8cc03d16651af4290` | UNVERIFIED | — | none |
| Mint.sol | `0x197e9CB28216dfe18a199b4c2930F74C2F460809` | ✓ | 5,644 B | `0x2373495eed7956512bc7cd6960d83fc19405c30332d8a251e2a5b6b57a87a9fb` | UNVERIFIED | — | none |
| Redeem.sol | `0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4` | ✓ | 6,170 B | `0x8e8538e58ee3708ddd8f3d7fa836a39397e7cb6d049ec8a1b9467524df97017c` | UNVERIFIED | — | none |
| Oracle.sol | `0xDfcA66ac0450C9AB86307af1942E157C5A4DB713` | ✓ | 5,273 B | `0xf057e6e5a983c585a46c558402738f2ba72bf5f5e8acd8a2a6e9eaa857ded2e7` | UNVERIFIED | — | none |
| Takaful.sol | `0x3eC27BB283644eF0A98B9961E9FBED0583a02f19` | ✓ | 6,043 B | `0xb28868f69b3086ab9552cb0f5378c70913eabd733367fc7998d255be0a26c8e0` | UNVERIFIED | — | none |

Monad deploy blocks: the public RPC prunes historical state (served window ≈ back to block ~63.47M; probes below it error `Block requested not found… historical state not available`), and all nine contracts are **already deployed at the oldest servable block** → RPC cannot recover their deployment records. testnet.monadscan.com is Cloudflare-bot-gated (three navigation attempts + checkbox click failed — evidence in session log). **Honest status: UNVERIFIED, not guessed.**

### Arc Testnet (chainId 5042002 — asserted at every probe; reported `0x4cef52` = 5042002 ✓)

| Contract | Address | Deployed | Code size | Runtime keccak256 | Deploy block (RPC binary search, cross-validated by creation-tx receipt) | Creator (creation tx) | Proxy |
|---|---|---|---|---|---|---|---|
| MTQ.sol | `0x237c3Aa2B79248f86f6523D3890095BCd1996601` | ✓ | 3,474 B | `0x0183b25ee34b9f8e7d18e976eadc6fb021652f9b52c5d6876a536aad92d12fcf` | **55,772,115 — 2026-08-07 12:03:14Z** | deployer EOA `0x3c39…d8c` (tx `0x3d17fd1a…ca16e`) | none |
| Governance.sol | `0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66` | ✓ | 13,129 B — **different bytecode from Monad at the same address** | `0x214a785c40138641e42a955466a9c5ab977980a18dfb207215c8ed3c522c4b82` | **55,772,118 — 2026-08-07 12:03:16Z** | deployer EOA (tx `0xe1da6f28…1a65`) | none |
| Safe.sol | `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0` | ✓ | 171 B (SafeProxy) | `0xd7d408eb…331fb4c` — **byte-identical to Monad's** | **55,875,156 — 2026-08-08 02:46:26Z** | deployer EOA (tx `0x2ac55b3f…9436`, via SafeProxyFactory — receipt contractAddress null as expected) | SafeProxy v1.4.1, singleton `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` (same as Monad) |
| Algorithm.sol | `0x62f8E5243f32eE5C87a14A7896C61104aD9e7727` | ✓ | 1,237 B | `0x0c0cd82de2dc452f3e66887476d1093597776ad506287ae484ce14ef986a31a5` | 55,772,122 — 2026-08-07 12:03:18Z | deployer EOA (tx `0x4cf76018…ca6b`) | none |
| Reserve.sol | `0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471` | ✓ | 2,897 B | `0x79e161397a85f090afa5a5d166e674561bfa7413f90138b9b43f85d1a72bd748` | 55,774,558 — 2026-08-07 12:24:41Z | deployer EOA (tx `0x55cf7212…aaf9`) | none |
| Mint.sol | `0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa` | ✓ | 2,847 B | `0xe6346a6fa05fcf6e04ab573626f21f7a825b375f10143532a1f9f11e20d1ced0` | 55,775,391 — 2026-08-07 12:32:10Z | deployer EOA (tx `0xd656de83…d496`) | none |
| Redeem.sol | `0xcAde4594177829597882555Ff57d0e34092daF8e` | ✓ | 3,037 B | `0x410c8d3660a4a208…` (full hash in evidence) | 55,775,393 — 2026-08-07 12:32:11Z | deployer EOA (tx `0xe515b1ca…a298`) | none |
| Oracle.sol | `0xFd2B8d176bf059287638Db30D02C6651dA02861e` | ✓ | 2,601 B | `0x0c14190ddcce23aadc615b9c0750981ccb0f9a2e593b0de5616832d825f2deb6` | 55,775,396 — 2026-08-07 12:32:13Z | deployer EOA (tx `0xb916460b…8a69`) | none |
| Takaful.sol | `0xA3B89FfdE28577A7D30E2c22503dB33509044EF0` | ✓ | 3,033 B | `0xde0ba8daa2ef32ea…` (full hash in evidence) | 55,775,399 — 2026-08-07 12:32:15Z | deployer EOA (tx `0xe1c81114…5b78`) | none |

**Arc history (complete, explorer-indexed):** the whole set was created by the deployer EOA in one 29-minute session on 2026-08-07 (12:03:14–12:32:15), plus the Safe on 2026-08-08. All eight non-Safe contracts are direct deployments (no proxies, no EIP-1967 slots set, slot 0 zero for non-Safes; SafeProxy slot 0 = singleton ✓).

### Solana devnet (read-only `getAccountInfo`/`getTokenSupply`)

| Item | Value | Verdict |
|---|---|---|
| SPL Mint `GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4` | initialized ✓ · Token program-owned ✓ | VERIFIED |
| Decimals | **18** | ANOMALY (SPL convention 6–9; owner-declared, preserved) |
| mintAuthority | `DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3` (owner wallet) — **SET** | SINGLE-KEY CONTROL |
| freezeAuthority | NONE ✓ | VERIFIED |
| Supply raw | `18446744073709551615` = **2⁶⁴−1 (u64 ceiling)** = 18.446744073709551615 MTQ | ANOMALY — max-value field; not a meaningful supply |
| Wallet token account | 1 account for this mint (wallet holds it) | VERIFIED |
| Superseded mint `2EaK5cQt…` | ACCOUNT EXISTS on devnet (provenance record; registry marks superseded) | preserved |

### Source/build identity (all 18 EVM contracts)

- **No deployed contract matches ANY local build artifact.** Local: MTQSigma V1 = 5,948 B (`0xe409ccc7…`), V2 = **30,608 B** (`0x0e155b68…`, over EIP-170), V3 = **38,921 B** (`0x88d510bc…`, over EIP-170). On-chain MTQs: 6,681 B / 3,474 B — matches neither each other, nor V1/V2/V3 (hash comparison incl. metadata-stripped variants: all distinct).
- **Neither explorer carries verified source** for the deployed MTQ/Governance (Arc Blockscout `is_verified: false`; Monadscan CF-gated). ABIs are unpublished → **privileged-function inventories below are role-probe + receipt based; full function-level verification of the deployed semantics is UNESTABLISHABLE until source is published/verified.**
- **EIP-170 portability:** Monad Governance.sol (25,819 B) EXCEEDS the standard 24,576-byte limit — deployable on Monad testnet (chain-specific leniency) but NOT on canonical mainnet EVMs. V2/V3 token builds exceed it by 25%/59% (contract-size remediation R-06/D-4 remains open).

### Duplicate-MTQ dossier (address-book generations, fresh probes)

| Chain | Generation | Address | Live now | Identity |
|---|---|---|---|---|
| Monad | current owner-declared (this registry) | `0x9e6E…53aD` | ✓ | "MITHQAL"/MTQ, 310.949 supply |
| Monad | gen-A (`contracts/deployments/Monad-Testnet.json`, 2026-09-06) | `0x5D9564C27111EA65Da3228a79833F0FF129bfd4a` | ✓ (probed this session) | "MTQΣ" family, 11,666 B, supply ~1,012,987 (v6-era), **deployed 2026-09-06 per manifest; tx recorded** |
| Monad | gen-B (OD-35-era superseded canonical) | `0x0Ac20360234b4C988a19586CBe55733e18A5982f` | ✓ | "MTQΣ", 3,413 B, byte-identical cross-chain twin of Arc gen-B |
| Arc | current owner-declared | `0x237c…6601` | ✓ | "MITHQAL"/MTQ, 1,000 supply — **deployed 2026-08-07, the OLDEST of three Arc generations** |
| Arc | gen-A (`contracts/deployments/Arc-Testnet.json`, 2026-09-05) | `0x826b82F79FD6c5347cDC568B1d0A7918128B63c1` | ✓ (deploy block 60,619,345 — 2026-09-05 18:22:12Z, recovered this session) | "MTQ Sigma" family, 11,551 B |
| Arc | gen-B (OD-35-era superseded) | `0x24203404B9b971C907e8Ced96106Fa74380d9897` | ✓ (deploy block 60,768,469 — 2026-09-06 15:44:01Z) | "MTQΣ", 3,413 B, cross-chain-identical twin |

**Finding:** the repo carries ≥3 live generations of "the MTQ token" per chain across artifacts; the CURRENT owner-declared canonical is the oldest on Arc. Cross-chain hex collisions (C-042-1..9 register) remain: e.g. `0xDfcA…B713` = Monad Oracle but a 3,321-B non-Safe on Arc; `0xE35a…Bd66` = Governance with DIFFERENT code per chain; `0x1bbC…6177` = Monad Reserve / Robinhood Takaful; `0xFd2B…861e` = Arc Oracle / Robinhood MockUSDC.

---

## G.2 FUNCTION-LEVEL ROLE & AUTHORITY MATRIX

### Owner reference check (explicitly requested) — CONFIRMED LIVE, both chains

`hasRole(DEFAULT_ADMIN_ROLE / MINTER_ROLE / PAUSER_ROLE, 0x3C3932F865892EFabE45892f453f81B64f6c8d8c)` on MTQ.sol:
- Monad `0x9e6E…53aD` (block 73,066,261): **TRUE · TRUE · TRUE** ✓
- Arc `0x237c…6601` (block 68,414,779): **TRUE · TRUE · TRUE** ✓
- `paused()` = false on both. Role hashes used are exactly the owner's reference constants (OZ keccak of `MINTER_ROLE`/`PAUSER_ROLE`). **Owner reference confirmed; no fabrication.**

### Role holdings (individual eth_call per role×account×contract; full JSON in evidence)

| Contract (per chain) | DEFAULT_ADMIN deployer | MINTER deployer | PAUSER deployer | Safe | Governance | Notes |
|---|---|---|---|---|---|---|
| MTQ.sol (Monad) | TRUE | TRUE | TRUE | **TRUE (admin+minter+pauser)** | false ×3 | Safe holds all three roles on Monad |
| MTQ.sol (Arc) | TRUE | TRUE | TRUE | **PAUSER only** | false ×3 | cross-chain Safe asymmetry preserved |
| Algorithm/Reserve/Mint/Redeem/Oracle/Takaful (both chains) | TRUE | — (no external minters found) | — | false | false | deployer is DEFAULT_ADMIN on **all 7 AccessControl contracts on both chains** |
| Governance.sol (both) | hasRole → **EVM revert** | revert | revert | revert | revert | **no OZ AccessControl surface at all** (also owner()/paused()/getRoleAdmin/MemberCount revert) — reproducibility re-checked ×2 rounds/chain, consistent |
| Safe.sol (both) | hasRole → **EVM revert** | revert | revert | revert | revert | no AccessControl (Safe governs via threshold signature) |

**Role-admin wiring (fresh evidence):** on all 7 AccessControl contracts, `getRoleAdmin(admin|minter|pauser) = 0x000…000` (DEFAULT_ADMIN) → **whoever holds DEFAULT_ADMIN (the deployer EOA) can grant/revoke MINTER and PAUSER on every one of them.** `getRoleMemberCount` reverts everywhere → plain AccessControl, NOT enumerable (role membership is not on-chain enumerable; census is probe-based only — enumeration limits disclosed).

**No Mint.sol/Redeem.sol/Reserve.sol contract holds MINTER_ROLE on the MTQ token on either chain** (all cross-contract hasRole probes false). Consequence: the deployed Mint.sol cannot mint the deployed MTQ.sol under current roles — the **architecture is not wired together on-chain** (matches prior findings; app-layer simulation only). Reserve/Oracle movement authority: ABIs unpublished → the privileged-function sets of Reserve.sol/Oracle.sol/Mint.sol/Redeem.sol/Takaful.sol/Algorithm.sol **cannot be verified from deployed artifacts**; the blueprint-mandated enforcement (mint via Mint.sol with MINTER_ROLE, reserve custody in Safe, etc.) is NOT instantiated on-chain. UNESTABLISHABLE, disclosed — not inferred as correct.

### Authority graph (who can perform each sensitive action, enforced where — evidence-based)

| Action | Enforced by | Who can do it TODAY (evidence) | Mandated (blueprint) |
|---|---|---|---|
| Mint MTQ | MTQ.sol MINTER_ROLE | deployer EOA; Safe (Monad only) | Mint.sol via Safe-governed process → **NOT WIRED** |
| Burn MTQ | (balance transfer to dead — standard transfer suffices, demonstrated by the Sept-6 burn) | any holder | Redeem.sol flow → NOT WIRED |
| Pause/unpause MTQ | MTQ.sol PAUSER_ROLE | deployer EOA; Safe (Monad admin implies grant; Arc pauser) | Emergency committee → single-key reality |
| Grant/revoke any role (all 7 AC contracts ×3 roles, both chains) | DEFAULT_ADMIN_ROLE (roleAdmin of every role = DEFAULT_ADMIN) | **deployer EOA unilaterally** | 4/7 Safe/committee → absent |
| Move Safe-held assets | Safe threshold | **1 signature (deployer EOA)** — not 4/7 | 4/7 — DISPROVED (OD-35, re-proven) |
| Reconfigure Safe (owners/threshold/modules/guard) | Safe owner-management | deployer EOA (sole owner) | constituted committee |
| Solana mint | SPL mintAuthority | owner wallet `DbFjzW…QhXb3` (single key) | equivalent multi-sig absent |
| Configure Oracle/Reserve/Mint/Redeem internals | unknown (ABI unpublished) | UNESTABLISHABLE (deployer deployed & holds admin where AC exists) | per §17/§13 modules |
| Upgrade contracts | n/a — **no proxies anywhere** (only SafeProxy) | impossible in-place; fixes require NEW deployments | blueprint contemplates V3 deploy |
| Genesis supply custody | constructor + transfer | **deployer EOA holds 99.9% of both chains' supplies; Safe holds 0; nonce=0** | 1M to Genesis Reserve Safe → DISPROVED (C-043 preserved; current-state re-proven) |

**Single-key control summary:** one EOA (`0x3C39…d8c`) is DEFAULT_ADMIN+MINTER+PAUSER on both tokens, admin on all 7 AC contracts on both chains, sole owner+signer of both Safes (identical 171B proxy, same address both chains), and the Solana mint authority is the owner wallet. Cross-chain differences: Safe roles on MTQ (Monad: admin+minter+pauser; Arc: pauser only) — anomaly preserved; Governance code differs per chain at the same address (25,819 B vs 13,129 B) — **two different implementations, one address book row.**

---

## G.3 SAFE CONFIGURATION & CUSTODY EVIDENCE DOSSIER (re-proven this session, both chains)

| Probe | Monad (block 73,066,261) | Arc (block 68,414,779) | Verdict |
|---|---|---|---|
| getThreshold() | **1** | **1** | mandated 4/7 → **CRITICAL preserved (OD-35)** |
| getOwners() | `[0x3C39…d8c8]` (1 owner) | `[0x3C39…d8c8]` | sole owner = deployer EOA |
| VERSION() | "1.4.1" | "1.4.1" | genuine Gnosis SafeProxy |
| nonce() | **0** | **0** | never executed ANY transaction, ever |
| getModulesPaginated(sentinel) | `[]` (0 modules; prior GS105 was a paging-start artifact — resolved) | `[]` | no modules |
| Guard slot `keccak("guard_manager.guard.address")` | address(0) | address(0) | no guard |
| masterCopy (proxy slot 0) | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` | same singleton | same implementation both chains |
| Native balance | 0 | 0 | zero |
| MTQ balance | 0 | 0 | zero |
| SafeProxy runtime code | 171 B `0xd7d408eb…` | **byte-identical** | same deployment artifact both chains |
| Creation (Arc) | UNVERIFIED (RPC pruned, explorer gated) | tx `0x2ac55b3f…9436` @ 55,875,156 (2026-08-08 02:46:26Z), creator deployer EOA, via SafeProxyFactory | VERIFIED (Arc) |
| "Never received anything" (strong form) | UNESTABLISHABLE (Monad getLogs capped at 100-block ranges) | **PROVEN by complete census** — exactly 2 holders exist (deployer + dead address), full transfer history = 1 burn tx; the Safe received nothing | Arc closed; Monad bounded |

**Custody reconciliation (current state, both chains):**
- **Monad:** totalSupply 310.949 MTQ = deployer 309.94899999999999999997 + **dead address `0x000…dEaD` 1.000000000000000003** → closes EXACTLY. The long-unexplained 3-wei dust (D-6 #20) is now located on both chains: a deliberate test burn.
- **Arc:** totalSupply 1,000 MTQ = deployer 999 + dead 1.000000000000000003 → closes EXACTLY (2-holder census, explorer-indexed). The single historical transfer: deployer → dEaD, 1.000000000000000003 MTQ, `transfer()` (selector `0xa9059cbb`), block 60,796,421 (2026-09-06 19:44:01Z).
- **Genesis events:** the Arc token's 1,000 supply was set in the constructor with **ZERO Transfer events** (RPC scan of the first 500k post-deploy blocks: 0 logs) → non-standard genesis (ERC-20 Transfer-from-zero convention not followed); App D.2's missing-genesis-emitter finding now has on-chain corroboration.
- **Reserve funding:** no USDC/reserve custody exists at ANY current-generation address (Arc native USDC: deployer 19.03, all contracts 0; Monad MON: deployer 0.224, contracts 0). The mandated 1.1M reserve (Ch. 20.1) does not exist on the current deployment set; the 1.1M MockUSDC recorded in 2026-09 manifests belongs to the older generation-A addresses.
- **C-041/042/043 preserved** (canonical declaration undecided; contamination register intact; Safe custody disproved). All three remain OPEN until independently resolved — none re-labeled.

---

## G.4 CANONICAL TOKEN & CORRECTED ADDRESS-BOOK PROPOSAL (v2 of D-3, DRAFT — for human approval)

The single authoritative identity anchor per chain (runtime-bytecode keccak, this session):

| Chain | Canonical (owner-declared, registry `contracts.ts`) | keccak256 | Conflicts to resolve |
|---|---|---|---|
| Monad 10143 | MTQ.sol `0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD` "MITHQAL"/MTQ · 310.949 | `0x9057c3e6…55bbb` | name contradicts mandated "MTQΣ" identity (D-3 M-1 ⚠); two older live generations + recorded deployment txs live in other manifests |
| Arc 5042002 | MTQ.sol `0x237c3Aa2B79248f86f6523D3890095BCd1996601` "MITHQAL"/MTQ · 1,000 | `0x0183b25e…12fcf` | same; deployed 2026-08-07 (oldest of 3 Arc generations) |
| Solana devnet | Mint `GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4` | program Token · u64-max supply · mintAuthority = owner wallet | decimals-18 anomaly; supply-field anomaly |

**Proposal (NO on-chain action; a governance decision package):** (1) keep `contracts.ts` as the single address-book source and REMOVE from any custody semantics: the Ecosystem-JSON "Safe" rows (keccak-proven non-Safes), gen-A/gen-B token rows from active registers (retain under superseded/provenance); (2) record this session's keccak identities + creation txs as the per-chain anchors; (3) decide C-041 formally (constituted governance) between the owner-declared MITHQAL tokens and the protocol-feature candidates; (4) fix CRITICAL-PRIVATE-KEY-ROTATION.md chain-row mis-associations (D-6 #18) and the dead-RPC/explorer drift (R-15). **No canonical declaration is made by this audit.**

---

## G.5 REQUIREMENT-TO-CODE-TO-TEST TRACEABILITY REGISTER (consolidated; statuses preserved from Tasks 7–8 + this audit)

Status vocabulary: IMPLEMENTED (code exists & verified) · VERIFIED (live evidence) · PARTIAL · MISSING · FAILED · **BLOCKED (missing spec/data)** · **AWAITING APPROVAL**. No unresolved item is marked complete.

**Explicitly-addressed outstanding items (owner's list):**

| Requirement | Where | Status |
|---|---|---|
| GPP CPI-basket feed (§6.8) | mase.ts GPP proxy + UI formula; disclosed RG-07 | **BLOCKED (no GlobalCPI/Food/Energy/TradeGoods feed exists in the pilot)** — proxy labeled everywhere; never claimed exact |
| Executable E_j definition (§14.3) | registry.ts all-eight-criteria pass/fail; D-gold-eligibility-Ej disclosure | **BLOCKED (v2.0 publishes no executable form)** — no numeric score invented |
| κ / β / crisis coefficients (§10.5/§10.6/§11.6/§14.5) | marp.ts mechanisms live; κ=0 scaffold, β₀/β₁/β₂ validation-stage, crisis numbers validation-stage | **BLOCKED (spec publishes no operative values)** — mechanisms exist, values NOT invented |
| Oracle feed identity (§17) | deployed Oracle.sol 5,273 B (Monad) / 2,601 B (Arc) | **UNESTABLISHABLE — ABI unpublished, source unverified on explorer, feeds UNVERIFIED (OD-34 OPEN)** — mocked in app, disclosed |
| Independent quantitative validation (§23 program) | /api/validation S1–S11; walk-forward NOT executed; synthetic data only | **NOT PERFORMED** — FAIL/pending items disclosed live (no greenwashing) |
| Contract-size remediation (EIP-170) | V2 30,608 B / V3 38,921 B local artifacts; deployed Monad Governance 25,819 B | **OPEN (R-06/D-4)** — no compliant build exists; also a portability defect on the live Monad Governance |
| External reviews (security/Sharia/legal) | — | **ABSENT — none exists.** No claim of any independent audit, Sharia approval, legal opinion, committee approval, custody remediation, or production readiness is made anywhere in this report or the app |

**Representative register (46-requirement app-layer audit, Tasks 7-a..7-d, statuses at last gate):** 14 CONFORMANT · 24 PARTIAL · 7 MISSING · 1 deliberate-N/A (App D.4). Ch.10–16 execution layer: 75 requirements audited with file:line evidence; P0s fixed and verified live (direction lock §11.5.3, no-trade ≤, cost model §12.7, LCR §13.4.3, pre-trade concentration §15.6.1, canonical events §11.7/§15.7); remaining P1/P2s disclosed in worklog Task 7-b stage summary. Quant §5/§6 (Task 8-a): implemented exact-form; honest data-window disclosures live. T-01..T-88: 88/88 reconciled in `v5/T01-T88-RECONCILIATION.md` with accepted-risk documentation for the failing/not-demonstrated rows. **On-chain contract layer: NEITHER V2 NOR V3 implements Listing 15 (validationGates etc.); getHonestStatus in V3 still returns the v1.0-era string; the canonical v2.0 status string exists only in the TS mirror — undeployable under §1 (SOURCE_READY_PENDING_DEPLOY, honestly labeled).**

---

## G.6 REPRODUCIBLE TEST REPORT (this session, commit-specific)

- Environment: sandbox HEAD working tree; Next.js dev server :3000; bun 1.x; ethers 6.17.
- Evidence scripts (re-run verbatim): `bun audit-work/v9-task9/full-audit.ts {monad|arc|solana|local|duplicates-monad|duplicates-arc}`; `bun audit-work/v9-task9/deploy-recovery.ts {arc|monad}`; `bun audit-work/v9-task9/scan-resume.ts {arc|monad}`.
- Provenance: every JSON-RPC call logged with timestamp + attempts to `evidence/raw.jsonl` (7,102+ entries). Error classification tally: 6,215 × Monad getLogs 100-block-cap errors (infrastructure limit, documented); 224 × EVM reverts (expected — non-existent interfaces); 9 × Monad pruned-state errors; 13 × rate-limit events (all retried successfully); 2 × GS105 (Safe paging-start artifact, resolved via sentinel).
- Cross-validation: Arc deploy blocks recovered independently twice (RPC binary search ≡ Blockscout creation receipts, 9/9 match); supply reconciliations close exactly on both chains; Safe probes reproduced the OD-35 evidence (threshold 1, owners 1, nonce 0, no guard/modules).
- Honest limits: (a) Monad deploy blocks/creators UNVERIFIED (pruned state + Cloudflare-gated explorer); (b) Monad full Transfer history INFEASIBLE on the public RPC (100-block getLogs cap ⇒ ~730k calls) — sampled windows only, disclosed; (c) Arc full history obtained via the explorer's public API (RPC quota prevented exhaustive RPC scans) — explorer-indexed census cross-checked by direct balanceOf reads; (d) Solana mint supply field is at the u64 ceiling — raw value reported, not interpreted; (e) no deployed-contract source was available for function-level verification (publishing/verifying source is owner action).

## G.7 PRIORITIZED REMEDIATION REGISTER (extends D-5 R-01..R-16; on-chain items are TRANSACTION PLANS ONLY — awaiting explicit approval, none executed)

| # | Item | Priority | Depends on | Acceptance criteria | Approval authority |
|---|---|---|---|---|---|
| R-01 | Purge committed private-key literal (`scripts/verify-key-and-audit-roles.ts:5` — **CONFIRMED STILL PRESENT at HEAD this session**) + rotate deployer key | **P0** | none | secret-scan clean; new address recorded; rotation plan receipts | Owner + security lead |
| R-02 | Reconfigure Genesis Safe(s) to genuine 4/7 (both chains share the same 171B proxy; separate instances) | **P0** | R-01 | threshold=4, owners=7, re-probe VERIFIED | Constituted committee (OD-3) |
| R-03 | Formal canonical-token declaration (C-041) incl. the MITHQAL-vs-MTQΣ name conflict + 3-generation register | **P0** | R-01 | signed decision recorded; address book single-sourced | Governance |
| R-04 | Genesis custody transfer/jettison per approved plan (both chains' supplies sit in deployer EOA; Safe holds 0; nonce 0) | **P0** | R-01..R-03 | executed tx refs; custody probes re-run positive | Governance (written) |
| R-06 | Contract-size remediation (V2/V3 > EIP-170; ALSO: live Monad Governance 25,819 B non-portable) | P1 | R-03 | reproducible ≤24,576 B build + green Foundry run | SC lead + reviewer |
| N-01 | Publish & verify deployed-contract sources on both explorers (ABI/function-level verification is UNESTABLISHABLE today) | P1 | none (owner action) | both explorers "verified" flags; privileged-function audit re-run | Project owner |
| N-02 | Wire the architecture on-chain (Mint.sol lacks MINTER_ROLE on MTQ on both chains — deployed modules cannot perform their blueprint roles) | P1 | R-02/R-03 | role grants per approved plan (TRANSACTION PLAN ONLY) | Governance |
| N-03 | Fix address-book contamination (false "Safe" rows, chain-mis-associated rotation doc, dead RPC rows) | P1 | R-03 | R-15 diff merged | Project owner |
| N-04 | Standardize genesis event semantics for any redeployed token (current genesis emits no Transfer events; App D.2 Listing requirement) | P2 | R-06 | new deployment emits canonical genesis events | SC lead |
| R-09..R-16 | Shadow acceptance, full §23 program, remote/CI, docs hygiene (unchanged from D-5) | P1/P2 | as in D-5 | per D-5 | per D-5 |

## G.8 FINAL RECOMMENDATION — **NOT ACCEPTED**

**The current deployment set is NOT ACCEPTED as the MTQΣ protocol architecture.** Software status is deliberately separated from release status (see the seven indicators in the Authorization Audit section of the Pilot Command Center; no software gate advances a release gate):

1. Build & automated tests: tsc 0 errors, eslint 0, canonical-invariants suite green (Task 8); §23 stress items remain FAIL/pending as disclosed → **PARTIAL, not release-relevant**.
2. Contract & architecture verification: **FAIL** — single-key control everywhere; Safes 1/1 deployer; genesis custody in deployer EOA; modules unwired; sources unpublished; Governance bytecodes differ per chain at one address; Monad Governance non-portable size; non-event genesis; 3 live token generations.
3. Economic & quantitative validation: **NOT PERFORMED** (walk-forward, 30-day coverage, real-feed oracle validation all outstanding).
4. Governance approval: **NOT GRANTED** (committee not constituted — OD-3).
5. Independent security/legal/Sharia review: **ABSENT**.
6. Live-pilot authorization: **NOT AUTHORIZED** (economic eligibility disabled; shadow mode enforced — correctly so).
7. Production authorization: **NOT AUTHORIZED**.

**Conditional-acceptance path:** R-01 → R-02 → R-03 → R-04 (+ N-01/N-02 wiring with published sources) → R-06 size remediation → full §23 program → independent reviews → constituted-committee gate run. Every step is an on-chain change for which a transaction plan is presented for review; **nothing in this audit executed any of them.**

---
*Preserved findings C-041/042/043/044/045/046/047 and OD-1..37 are re-asserted, none downgraded. Evidence: `audit-work/v9-task9/evidence/` (raw.jsonl, monad-inventory.json, arc-inventory.json, monad-duplicates.json, arc-duplicates.json, solana-inventory.json, local-identity.json, monad-horizon-check.json, arc-deploy-recovery.json, monad-deploy-recovery.json, arc-creation-receipts.json, arc-scanstate.json). This document is a verification artifact — no address, role, supply, or configuration was altered.*
