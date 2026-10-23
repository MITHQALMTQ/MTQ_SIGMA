# D-2 — CUSTODY & TOKEN-SUPPLY RECONCILIATION DOSSIER

**MTQΣ — Evidence Reconciliation and Pre-Remediation Control Directive (§3, §7.2)**
READ-ONLY dossier. **NOT ACCEPTED. No custody remediation performed or authorized.** Prior adverse findings (v5 round) are preserved verbatim and extended — never replaced.

| | |
|---|---|
| Fresh reads (Gen-3) | 2026-10-19 ~20:50–21:05 UTC — Monad blocks 72,486,899 / 72,487,204 / 72,487,374 / 72,488,308 · Arc blocks 68,070,028 / 68,070,214 / 68,070,288 / 68,070,826 |
| Probe scripts (all read-only) | `scripts/verify-safe.ts` · `scripts/verify-safe-balances.ts` · `scripts/verify-custody-inventory.ts` (new) · `scripts/verify-usdc-custody.ts` (new) |
| Machine evidence | `audit-work/v6/custody-inventory-probe.json` · `audit-work/v6/usdc-custody-probe.json` · refreshed `audit-work/v5/safe-verification.json` + `safe-balance-probe.json` · logs in `audit-work/v6/logs/` |
| Prior generations preserved | Gen-1 (`a56646b`-era: Monad 72,421,819 / Arc 68,031,046) and Gen-2 (`b68ccb8`: Monad 72,458,443 / Arc 68,052,939) findings stand unchanged in their committed files |

**Method note (directive §3 honored):** current custody is established **only** from on-chain state reads; historical custody is established **only** from recorded constraints (nonce, balances, code); anything else is listed under "cannot be established". In particular we do **NOT** conclude "an asset was never held" from zero balance + zero nonce alone (§3 warning) — see §2 for the exact logical boundary.

---

## 1. Genesis Reserve Safe `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0` — current configuration (Gen-3, reproduced)

| Read | Monad Testnet | Arc Testnet |
|---|---|---|
| `eth_getCode` | 171 B — keccak `0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c` | **byte-identical** (same keccak) |
| Proxy singleton (slot 0) | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` (24,421 B, keccak `0xb1f926978a0f44a2c0ec8fe822418ae969bd8c3f18d61e5103100339894f81ff` — identical on both chains) | identical |
| `getThreshold()` | **1** (mandate: 4) | **1** |
| `getOwners()` | **`[0x3C3932F865892EFabE45892f453f81B64f6c8d8c]`** — 1 owner (mandate: 7) | identical |
| `VERSION()` | "1.4.1" | identical |
| `nonce()` | **0** | **0** |
| Modules | **none** (0) | none |
| Guard (storage slot `keccak256("guard_manager.guard.address")`) | **address(0)** | identical |
| Native balance | **0.0** | **0.0** |
| MTQ balances (all candidates) | **0** (§3) | **0** |
| USDC balance | **0** (§4) | **0** |

**Verdict (unchanged, Gen-1/2/3): CRITICAL — genuine Gnosis Safe v1.4.1 proxy, but 1-of-1 deployer-controlled; NOT the mandated 4/7.** Full-bytecode identity is now keccak-proven (upgrading Gen-1's length+prefix inference — `SAFE-VERIFICATION.md` §6.7 limitation closed).

## 2. Historical custody — exactly what the evidence supports

1. **The Safe has never executed a transaction** — `nonce() == 0` is authoritative: every Gnosis Safe asset-moving operation (`execTransaction`, module execution) increments the nonce. **Established.**
2. **No modules, no guard, no fallback handlers were ever added** — module lists are empty and guard slot is zero. Combined with (1): the Safe cannot have *sent* anything at any point in its existence. **Established.**
3. **"The Safe has never *received* anything" — NOT ESTABLISHABLE from available evidence.** An inbound ERC-20 transfer does not touch the Safe (no nonce bump, no event on the Safe). A theoretical historical pattern (asset received, then removed by *third-party* mechanics — e.g., a seizable/blacklistable token contract, or an approval the token contract acted on) cannot be excluded without Transfer logs, and log history is **inaccessible via the public RPCs** (§5). The v5 report's stronger reading ("never received, held, or executed anything, ever" — `CUSTODY-BALANCE-REVERIFICATION.md` §3) is **preserved as recorded** and re-classified here: "never executed / never held-then-sent" = established; "never received" = highly probable but not provable without logs.
4. **The Safe's deployment transaction and creation date are not recorded anywhere in this repo** (no deploy tx for `0xE718…A7D0` in any deployment JSON — recorded in D-6).

## 3. MTQ token supply reconciliation — all candidates, both chains (Gen-3)

Raw-wei values from `custody-inventory-probe.json` (read at single recorded blocks; 18 decimals):

### Monad Testnet (block 72,486,899)
| Candidate | Address | Code | totalSupply | Deployer EOA | Genesis Safe | Other identified | Unlocated |
|---|---|---|---|---|---|---|---|
| A — v5.0 §5.1 record (live name **MITHQAL**) | `0x9e6E…53aD` | 6,681 B — keccak `0x9057c3e6…d55bbb` | 310,949,000,000,000,000,000 (310.949) | 309,948,999,999,999,999,997 (309.949 − 3 wei) | **0** | — | **1.000000000000000003 MTQ** |
| B — canonical-map + Ecosystem-JSON (live name **MTQΣ**) | `0x0Ac2…982f` | 3,413 B — keccak `0x31496b92…68c0180` | 1,000,000,000,000,019,980,000,000 (1,000,000.00000001998) | 1,000,000,000,000,019,979,999,997 (~100%) | **0** | — | **3 wei** |
| C — deployment-JSON MTQSigma (live name **MTQΣ**) | `0x5D95…fd4a` | 11,666 B — keccak `0xa7331051…900e92e` | 1,012,987,000,000,000,000,000,000 (1,012,987) | 12,986,999,999,999,999,999,997 (12,987 − 3 wei) | **0** | **`genesisReserve()` = the token contract itself, holding 1,000,000** | **3 wei** |

### Arc Testnet (block 68,070,028)
| Candidate | Address | Code | totalSupply | Deployer EOA | Genesis Safe | Other identified | Unlocated |
|---|---|---|---|---|---|---|---|
| A — v5.0 §5.1 record (live name **MITHQAL**) | `0x237c…6601` | 3,474 B — keccak `0x0183b25e…d12fcf` | 1,000,000,000,000,000,000,000 (1,000) | 998,999,999,999,999,999,997 (999 − 3 wei) | **0** | — | **1.000000000000000003 MTQ** |
| B — canonical-map + Ecosystem-JSON (live name **MTQΣ**) | `0x2420…9897` | 3,413 B — keccak `0x31496b92…68c0180` **byte-identical to Monad B** | 1,000,000,000,000,019,980,000,000 | 1,000,000,000,000,019,979,999,997 (~100%) | **0** | — | **3 wei** |
| C — deployment-JSON MTQSigma (live name **MTQ Sigma**) | `0x826b…63c1` | 11,551 B — keccak `0x0e6a6e1a…709a0d` | 1,005,889,000,000,000,000,000,000 (1,005,889) | 5,879,999,999,999,999,999,997 (5,888 − 3 wei) | **0** | **`genesisReserve()` = the token contract itself, holding 1,000,000** | **3 wei** |

**New findings:**
- **C-046 (CRITICAL): candidate-C genesis self-custody.** On both chains `genesisReserve()` on the deployment-JSON MTQSigma contract returns **the token contract's own address**, and the contract holds exactly 1,000,000 MTQ of its own supply. The mandated step "mint 1M to the Genesis Reserve Safe" was implemented as **mint-to-self** for this family; `reserveVault()` and `owner()` both return the **deployer EOA**. (Gen-1/2 probes had only reconciled candidate C as "supply − deployer remainder"; the remainder's location is now established on-chain.)
- **Dust pattern (reported, immaterial):** every candidate on both chains shows **exactly 3 wei** outside (deployer + identified reserves) — and candidate A shows 1.000000000000000003 MTQ unlocated. Fractions: 3×10⁻¹⁸ of supply. Reported per directive stop-condition; explanation requires logs (§5). Not material to custody conclusions.
- **Cross-chain identity (keccak-proven):** candidate B is the **only** token byte-identical across chains (`0x31496b92…` both). Candidate A differs cross-chain (6,681 B vs 3,474 B — different contracts, despite both reading "MITHQAL"); candidate C differs (11,666 B vs 11,551 B).

## 4. USDC-side custody — NEW (closes the v5 open item "custody of the 1.1M USDC genesis deposit is NOT evidenced anywhere in this repo")

`scripts/verify-usdc-custody.ts` (Gen-3: Monad block 72,488,308 / Arc block 68,070,826):

| Read | Monad MockUSDC `0x28a2…d6DE` | Arc MockUSDC `0x334D…0dEb` |
|---|---|---|
| name / symbol / decimals | "USD Coin (Mock Pilot)" / "USDC" / 6 | identical |
| totalSupply | 1,100,000,000,000 raw = **1,100,000 USDC** | **1,100,000 USDC** |
| **Deployer EOA balance** | **1,100,000,000,000 raw = 100.00%** | **100.00%** |
| Genesis Safe | **0** | **0** |
| Ecosystem MintContract / ReserveVault (JSON) | 0 / 0 | 0 / 0 |
| contracts.ts Mint / Reserve | 0 / 0 | 0 / 0 |
| MTQSigma candidate C | 0 | 0 |

**C-047 (CRITICAL): the 1.1M USDC genesis deposit NEVER left the deployer EOA on either chain.** Every recorded "reserve funding" narrative (deployment JSONs' `reserveUsdc: 1100000` read-back; Ecosystem MintContract funding claims) is **disproved as protocol custody**: the recorded balances are the deployer's personal holdings. Ch. 20.1 step-4 (reserve deposit) and step-5 (1M MTQ to Safe) are both disproved for the live deployments on both chains.

## 5. What CANNOT be established from available evidence (per directive §3(3))

1. **Full Transfer/event history on both chains** — `eth_getLogs`: Monad RPC refuses **every** tested window (500 / 2,000 / 10,000 / 50,000 / 100,000 blocks / full-range — HTTP 413, verbatim errors recorded); Arc accepts **≤2,000-block windows** (full range refused with -32012 "requested range too large") — enumerating 68M Arc blocks needs ~34,000 requests (infeasible in this environment). ⇒ Locations of the 3-wei dust, the 1.000000000000000003 MTQ (candidate A), and any historical movements cannot be established. **Requires archive/explorer-grade access (remediation item R-12).**
2. **Safe creation transaction / date / deployer-of-record** — not in any repo record; block explorers not independently consulted this round.
3. **Signer/off-chain identity of `0x3C39…8d8c`** — no attestation exists anywhere; the only identity-relevant artifact is the **committed private-key literal (C-045, D-1 §6.4)**.
4. **Robinhood Chain Testnet and Solana custody** — not probed this round (Robinhood untested; Solana uses SPL model — two conflicting token records exist, D-3 §4). All custody conclusions above are **Monad + Arc only**.
5. **Whether the deployer EOA ever transferred assets between the three generations of reads** — no logs; balances at Gen-1/2/3 are mutually consistent and stable, which is corroborating but not conclusive.

## 6. Current-custody summary (the audit-grade statement)

> As of Monad block 72,488,308 / Arc block 68,070,826 (2026-10-19 ~21:00 UTC), **100% of the genesis assets on both chains** — 1,100,000 USDC each (MockUSDC), ~100% of the 1,000,000.00000001998 candidate-B "MTQΣ" supply, and admin control of the 1,000,000 self-custodied candidate-C supply — **sit under the unilateral control of the deployer EOA `0x3C3932F865892EFabE45892f453f81B64f6c8d8c`**, whose plaintext private key is committed in the repository (C-045). The mandated 4/7 Genesis Reserve Safe `0xE718…A7D0` holds **zero assets, has never executed a transaction, and is itself 1/1-controlled by the same EOA**. No remediation was performed. Any asset movement remains **prohibited** until the authorized remediation sequence (D-5: R-01…R-05) is executed under human approval.

---
*Every value is traceable to the probe JSONs and logs cited in the header. Adverse v5 findings preserved; new findings C-045/C-046/C-047 registered additively (D-5, D-6). No on-chain action authorized by this dossier.*
