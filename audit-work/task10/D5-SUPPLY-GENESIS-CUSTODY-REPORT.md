# MTQΣ — TASK 10 · D5: SUPPLY, GENESIS & CUSTODY RECONCILIATION

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**
Fresh probes 2026-10-22 (Monad block 73,167,496 · Arc block 68,475,006 · Solana confirmed-commitment).
No transfer/mint/burn/bridge/custody transaction was performed or proposed for execution.

---

## 1. The authoritative mandate (independently re-derived)

Master Blueprint **§20.1** (as encoded in `src/lib/mtq/genesis.ts`, cross-checked against
`audit-work/blueprint-v2.0.txt`): the seven-step Genesis requires —
1. protocol deposits **1,100,000 USDC** (10% above the mint → genesis RR = 1.10);
2. base-fixings verification freezes I₀ = 1.0000;
3. **1,000,000 MTQ minted TO THE GENESIS RESERVE SAFE**;
4. canonical Genesis events emitted (GenesisVerification, GenesisCompleted — and ERC-20-conformant
   Transfer-from-zero for the mint itself per App D.2).

## 2. Current state vs mandate (fresh evidence)

| Chain | Mandate | Live actual | Gap |
|---|---|---|---|
| Monad 10143 | 1,000,000 MTQ → Safe + 1.1M USDC deposit + genesis events | **totalSupply 310.949** (310,949e15 raw) · deployer 309.94899999999999999997 · `0x…dEaD` 1.000000000000000003 · Safe 0 · genesis balances constructor-set, **ZERO Transfer events** · no USDC at any current address (deployer native 0.224343224 MON) | supply = **0.031%** of mandate; custody 100% single-key; deposit absent; events absent |
| Arc 5042002 | same | **totalSupply 1,000** · deployer 998.999…997 · dead 1.000000000000000003 · Safe 0 · single historical transfer = the burn (block 60,796,421, 2026-09-06) · native ≈ 19.026597151851474173 (not 1.1M USDC) | supply = **0.1%** of mandate; custody 100% single-key; deposit absent |
| Solana devnet | monetary-policy-conformant supply | see §4 | structural non-conformance (u64) |

Both chains' balances close EXACTLY against supply (2-holder census: deployer + dead). **Custody is
nevertheless NOT declared closed**: balances summing to supply proves arithmetic, not mandate custody — the
mandate requires the Safe to hold the genesis; the Safe holds 0 on both chains and has nonce 0 (C-043
preserved and re-proven).

## 3. Generations reconciliation (who holds what, per generation — fresh probes)

| Generation | Supply (whole tokens, 18 dec) | Deployer holds | Other holders (proven) |
|---|---|---|---|
| Monad gen-A `0x5D95…` "MTQΣ" | 1,012,987 | 12,986.9999999999999999997 | **the token contract itself: 1,000,000 (self-custodied genesis — C-046 located)** · dead 3 wei |
| Monad gen-B `0x0Ac2…` | 1,000,000.000000000001998 | ≈ all of it | dead 3 wei |
| Arc gen-A `0x826b…` "MTQ Sigma" | 1,005,889 | 5,886.999999999999999997 | **self-custody 1,000,000** · dead 1.000000000000000003 |
| Arc gen-B `0x2420…` | 1,000,000.000000000001998 | ≈ all | dead 3 wei |
| Arc gen-C `0x5C72…` | 1,002,997 | 2,996.999999999999999998 | **self-custody 1,000,000** · dead 2 wei |
| Robinhood `0xAF5B…` "MTQΣ" | ≈ 1,001,000.00000000002997 | not census-scanned (provenance tier) | — |

No gen-era ecosystem contract (Safe/Mint/Reserve/Governance/Oracle/Takaful/MockUSDC rows) holds any balance of
its generation's token (holder-hunt probes all zero) — the gen-A/C "1M" sits in the token itself, matching
`contracts/MTQSigma.sol` (`genesisReserve = address(this)`; `genesisMint(uint256)` → `_mint(genesisReserve,…)`),
with `owner()` = deployer EOA (probed) — so the gen-A family's genesis is **controllable by the exposed
C-045-a key through owner-gated mints**, not by any committee.

**Current state vs historical conclusions:** the above is *current* state. Historical custody (who held what
before each burn/transfer) is NOT inferred from balances/nonces — it remains bounded by the preserved Task 9
evidence (Arc full explorer census; Monad sampled windows within RPC limits). C-041 (canonical declaration),
C-042 (contamination register), C-043 (genesis-to-Safe), C-044 (no EIP-170 build), C-046 (self-custody),
C-047 (USDC 100% in deployer EOA) all remain OPEN, none re-labeled.

## 4. Solana — independent verification (fresh getAccountInfo/JSON-RPC, base64 parsed)

| Field | Value (fresh 2026-10-22 06:31Z) | Verdict |
|---|---|---|
| Mint account `GAGRdrY6…` | initialized · owner = Token Program `TokenkegQfe…3VQ5DA` · 82 B | VERIFIED |
| mintAuthority | **SET → `DbFjz…QhXb3`** | single-key control (key NOT in repo — D1 §4) |
| freezeAuthority | NONE | VERIFIED ✓ |
| decimals | **18** | ANOMALY (SPL convention 6–9) |
| supply raw | **18,446,744,073,709,551,615 = 2⁶⁴−1 (u64 ceiling)** | ANOMALY — but internally CONSISTENT: `DbFjz`'s single ATA holds exactly the full supply (Task 9 census + fresh re-probe) |
| Mint history | 3 txs ever (slots 482,635,368/372/377; 2026-08-10 12:06:06–09Z; none failed) — create + ATA + **a deliberate `mintTo(u64::MAX)`** (feePayer DbFjz) | genesis event trail |
| Superseded mint `2EaK5c…` | exists · mint+freeze authority = `4saT…` (**C-045-b**) · supply 4.477988020393345024 (all in 4saT's ATA) | old generation, exposed-key controlled |

**u64-ceiling explanation (§3 of the task):** SPL Token stores supply as u64. At decimals = 18 the maximum
representable whole-token supply is (2⁶⁴−1)/10¹⁸ = **18.446744073709551615 MTQ**. Therefore: (a) the current
value is the absolute maximum a u64 field can hold — a deliberate one-transaction `mintTo(u64::MAX)` by the
owner wallet, not a corrupt field (ATA balance equals it); (b) **the mandated 1,000,000 MTQ (10²⁴ raw) is
physically unrepresentable** in this mint — 10²⁴ ≫ 2⁶⁴−1 ≈ 1.84×10¹⁹; (c) the scripted "fresh mint" plan
(`solana-create-fresh.ts`: 10 billion × 10¹⁸ = 10²⁸ raw) would **revert with overflow** on-chain.
**Conformance verdict: the deployed Solana mint CANNOT conform to the intended monetary policy at
decimals=18, under any supply the mandate contemplates.** Conformant options require decimals ≤ 9 (1M at 9 dec
= 10¹⁵ raw fits; even 10B fits), or a different program/representation — decision reserved (K-6, D6-8).

## 5. Custody summary (what a reviewer must approve)

1. No USDC/reserve custody exists at ANY current-generation address (mandate's 1.1M deposit: absent).
2. Genesis custody on the current estate: 100% deployer EOA (Monad 309.949 / Arc 999−3wei) — not the Safe.
3. Gen-A/C custody: 1M each self-custodied inside the token contract (owner = deployer EOA).
4. Solana current-mint custody: 100% DbFjz single key; old mint: 100% exposed 4saT key.
5. Safes: 0 assets, 0 executions, threshold 1 — they are custody vehicles in name only today.
6. Every custody concentration above resolves to **one of two single keys, one of which is exposed (D1)**.
