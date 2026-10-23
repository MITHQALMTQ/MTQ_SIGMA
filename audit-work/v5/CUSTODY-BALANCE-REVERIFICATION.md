# CUSTODY-BALANCE-REVERIFICATION — Independent Post-Implementation Verification (§2 supplement)

| | |
|---|---|
| **Date** | 2026-10-19 (reads executed ~18:4x UTC) |
| **Mandate** | *MTQ Σ — Post-Implementation Independent Verification and Remediation Mandate*, §1 (baseline) + §2 (priority-zero custody) |
| **Scope** | Independent re-verification at repo HEAD `b24e7e0fad15ea5aea6ad63afe5e9746b6423f85` (branch `main`, clean tree). The prior OD-35/T-87 evidence (SAFE-VERIFICATION.md) was produced against working-tree state later committed as `a56646b`; this document re-runs the verification against the committed baseline and closes the balance/tx-history gap that report honestly left open (its §6.8). |
| **Scripts** | `scripts/verify-safe.ts` (re-run, exit 0) · `scripts/verify-safe-balances.ts` (NEW, read-only) |
| **Machine evidence** | `audit-work/v5/safe-balance-probe.json` (full raw reads) |
| **Mode** | **READ-ONLY ONLY** — `eth_chainId`, `eth_blockNumber`, `eth_call`, `eth_getBalance`, `eth_getLogs`. No private key was read, nothing signed, no transaction broadcast, no state changed, no asset transferred. |

---

## §1 Baseline re-verification (fresh, this run)

| Item | Observed |
|---|---|
| Repo / branch / HEAD | `/home/z/my-project` · `main` · `b24e7e0fad15ea5aea6ad63afe5e9746b6423f85` |
| Working tree | **Clean** (`git status --porcelain` empty) |
| Mandate source hash | `audit-work/MTQ_SIGMA-unrtf.txt` sha256 `ac9638200369d066d12e4e2d2b06e1cbeb3e1a0c5e88e3ad5c7cb287defb3a75` (178,220 bytes; v5.0 + Ext-1 + Ext-2 + Ext-3 consolidated) |
| Toolchain | lint exit 0 · `tsc --noEmit` exit 0 · solcjs 0.8.36 (forge NOT installed in this sandbox — Foundry suite not runnable here) |
| Reference suites (re-run at HEAD) | canonical-invariants **250/250** · mandate-vectors **66/66** · e2e-integration **26/26** · stress-rerun **11/11** · audit-retention **PASS** · historical-backtest **PASS** · `scripts/run-onchain-tests.ts` (read-only RPC) **28/28** · EIP-712 harness (eip712-verify.cjs) **all 4 digest/round-trip checks MATCH** |
| Live services | web :3000 healthy (`v3-source-ready`) · mtq-feed :3003 · keeper :3040 (`keeper:"(unset)"`, `contract:"(unset)"`, `lastTick:null` — no key loaded, no chain writes) |
| Shadow enforcement at boundary | **No route in `src/app/api/**` contains any Wallet/signer/broadcast code** (search: zero hits). Reference engine (`engine.ts`, `pilot-state.ts`) contains zero transaction-broadcast code. Mint/redeem are `applyTrial` simulations persisted to DB only. Keeper cannot sign (env unset → init error path). Live Ch.19 golden path re-verified: mint 1,000 → fee $1.00 (0.10%) → 837.81 MTQ at P=1.19239 (= X_net/P). |

## §2 Safe configuration re-run — `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0`

`scripts/verify-safe.ts` re-executed at HEAD, live against official RPCs (Monad `https://testnet-rpc.monad.xyz` chainId 10143 asserted · Arc `https://rpc.testnet.arc.io` chainId 5042002 asserted).

**VERDICT (both chains): CRITICAL FINDING — reproduced.** On-chain `getThreshold()=1` (expected 4) · `getOwners()=["0x3C3932F865892EFabE45892f453f81B64f6c8d8c"]` (1 owner, expected 7) · `VERSION()="1.4.1"` · `nonce()=0` · `getModulesPaginated` → 0 modules · guard storage slot → `address(0)` (no guard) · Ecosystem-JSON "Safe" claim `0xDfcA…713` reverts on all 7 Safe-interface reads (not a Safe). **Identical to the `a56646b`-era evidence — the finding is reproducible at HEAD.**

## §3 NEW FINDING — the Safe has never held any asset (C-043)

`scripts/verify-safe-balances.ts` (read-only), Monad block **72,458,443** · Arc block **68,052,939**:

| Probe | Monad Testnet | Arc Testnet |
|---|---|---|
| `eth_getBalance(SAFE)` (native) | **0.0** | **0.0** |
| `balanceOf(SAFE)` — candidate A "MITHQAL" (`0x9e6E…` / `0x237c…`) | **0.0** | **0.0** |
| `balanceOf(SAFE)` — candidate B "MTQΣ" canonical-map (`0x0Ac2…` / `0x2420…`) | **0.0** | **0.0** |
| `balanceOf(SAFE)` — candidate C deployment-JSON (`0x5D95…` / `0x826b…`) | **0.0** | **0.0** |
| Candidate B totalSupply → deployer EOA share | 1,000,000.00000001998 → **1,000,000.000000019979999997 (~100%)** | identical |
| Candidate C supply → deployer EOA share | 1,012,987 → 12,987 (≈1.3%) | 1,005,889 → 5,888 (≈0.6%) |

**Reading (balance + nonce logic):** an ERC-20 transfer *into* the Safe requires no Safe execution, but any transfer *out* requires a Safe execution (nonce++). Therefore `balanceOf(SAFE)=0` on every candidate **plus** `nonce()=0` **plus** zero native balance together prove the Safe has **never received, held, or executed anything, ever**.

**Consequence:** the mandated Ch. 20.1 step-5 outcome — *1,000,000 MTQ minted to the Genesis Reserve Safe* — is **DISPROVED for the live testnet deployments**. The full genesis supply of the only cross-chain-identical "MTQΣ" token (candidate B, identical bytecode and supply on both chains) sits **entirely in the deployer EOA**, i.e. under the same unilateral key the OD-35 finding already flagged. Recorded as **C-043** in `mandate-register.ts` (post-verification finding, outside the document's C-001..C-040 set, alongside C-041/C-042).

**Custody remediation scope (expanded, all governance actions — see acceptance report §8):**
1. Declare the canonical MTQ contract per chain (C-041 — undecided among the three live tokens).
2. Constitute the 7 Constitutional signers; set Safe threshold 4/7 (OD-35 corrective action; OD-3 Committee OPEN).
3. **Actually transfer the genesis supply to the 4/7 Safe** (newly required — previously assumed done).
4. Re-run `scripts/verify-safe.ts` + `scripts/verify-safe-balances.ts` and record VERIFIED 4/7 + non-zero Safe custody before Gate 5.

## §4 Honest limitations

1. Single point in time; blocks recorded above. 2. One public RPC per chain, no multi-node cross-validation (mitigated: two independent chains return mutually coherent values). 3. Full-range `eth_getLogs` refused by both RPCs (Monad HTTP 413; Arc "could not coalesce error") — recorded verbatim in `safe-balance-probe.json`; the §3 conclusion does not depend on logs (balance + nonce are sufficient and were read directly). 4. Signer identity not attested off-chain. 5. Candidate token *balances* read at the two recorded blocks only; supplies confirmed equal to the prior SAFE-VERIFICATION.md §4 values. 6. USDC/reserve asset balances of the Safe were not part of this probe (all reported reserve custodial records remain unverified on-chain — custody of the 1.1M USDC genesis deposit is likewise NOT evidenced anywhere in this repo).

---
*Every value above is traceable to `audit-work/v5/safe-balance-probe.json` and the re-run console output of `scripts/verify-safe.ts` / `scripts/verify-safe-balances.ts` at HEAD `b24e7e0`. Read-only; no assets moved; no gate advanced; production remains NOT AUTHORIZED.*
