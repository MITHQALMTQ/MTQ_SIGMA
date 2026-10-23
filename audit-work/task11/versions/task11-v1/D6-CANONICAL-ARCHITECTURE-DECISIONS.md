# MTQΣ — TASK 11 · D6: CANONICAL ARCHITECTURE DECISIONS (reserved for human governance)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

**No canonical generation is selected by this document.** Per Task 11 §7 the choice
(C-041) is expressly reserved to constituted human governance. This page lays out the
evidence comparison, separates **technical facts** from **hypotheses** and from
**decisions requiring approval**, and invents nothing.

Fresh anchors: Monad 73,193,262 · Arc 68,490,282 · RH 140,634,936 · Solana slot
513,824,771 · runtime keccaks re-proven byte-exact vs Task 10
(`evidence/identity-anchors-task11.json`).

---

## 1. Candidate comparison (all 9 EVM MTQ generations + 2 Solana mints)

### 1.1 Current owner-declared estate ("MITHQAL")

| Property | Monad | Arc |
|---|---|---|
| Address | `0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD` | `0x237c3Aa2B79248f86f6523D3890095BCd1996601` |
| Runtime keccak (bytes-conv.) | `0x9057c3e6…d55bbb` | `0x0183b25e…12fcf` |
| Size / selectors | 6,681 B / 25 | 3,474 B / 37 |
| Deployment evidence | deploy record UNVERIFIED (pruned state; inferred from roles/nonce) | creation receipts 2026-08-07 12:03–12:32, deployer EOA (Task 9) |
| Source/build identity | **NONE — matches no local build; explorer unverified** | **NONE** (is_verified false) |
| name/symbol | **MITHQAL** / MTQ (conflict D6-1) | **MITHQAL** / MTQ |
| Supply / holders | 310.949 — deployer 309.949 + dead 1.000000000000000003 | 1,000 — deployer 999 + dead 1.000000000000000003 |
| Permissions | deployer ADMIN+MINTER+PAUSER; Safe ADMIN+MINTER+PAUSER; Mint module MINTER; **Redeem module MINTER (dormant, CORR-6)** | deployer ×3; Safe PAUSER only; Mint module MINTER |
| Wiring | **LIVE — Mint module can mint the token** (module-MINTER held by deployer); modules wired to token/algorithm/reserve (probed views) | same (OZ-v5-era build family) |
| Dependencies | 7 modules + 1/1 Safe + unassessed Governor ("MITHQAL Governance", params 1/1/1/1, 25,819 B **non-portable build**) | 7 modules + 1/1 Safe + unassessed Governor (13,129 B, 74 sels, different build at same hex) |
| Known discrepancies | name conflict · genesis non-event · no cap() · oversized Governance twin | same + Safe asymmetry |

### 1.2 gen-A family "MTQΣ" (Ownable — byte-identical, keccak `0xa7331051…e92e`)

| Property | Value |
|---|---|
| Members | Monad `0x5D9564C2…129bfd4a` · Arc gen-C `0x5C728F72…93A2563` · RH "MTQSigma" `0xA3B89Ffd…09044EF0` (11,666 B identical) · Arc gen-A `0x826b82F7…128B63c1` ("MTQ Sigma", 11,551 B sibling) |
| Deployment evidence | Monad/Arc gen-A: 2026-09-05/06 manifests; RH: Ecosystem manifest; gen-C: verify-key-script era |
| Source identity | matches local `contracts/MTQSigma.sol` semantics (genesisReserve = self, genesisMint owner-gated — C-046) — **closest of all families but unverified on explorers** |
| Supplies / holders | Monad 1,012,987 (self-custody 1,000,000; deployer 12,987; dead 3 wei) · Arc gen-A 1,005,889 (self 1M; deployer 5,887) · Arc gen-C 1,002,997 (self 1M; deployer 2,997) |
| Permissions | **Ownable, owner = deployer EOA** (re-probed on all three) — owner-gated genesisMint → the EXPOSED key can inflate any family member |
| Dependencies | none wired (no ecosystem contract holds balances — holder-hunt zero, re-probed) |
| Known discrepancies | self-custodied genesis ≠ mandate (Safe custody); name variants MTQΣ / MTQ Sigma; supply drift from 1M by burn artifacts |

### 1.3 gen-B family "MTQΣ" (AccessControl — byte-identical, keccak `0x31496b92…0180`)

| Property | Value |
|---|---|
| Members | Monad `0x0Ac20360…18A5982f` · Arc `0x24203404…80d9897` · RH "MTQToken" `0xAF5B8565…B644C5A5` (3,413 B identical) |
| Supplies / holders | Monad 1,000,000.000000000001998 (≈ all deployer; dead 3 wei) · Arc same · RH 1,001,000.00000000002997 (deployer 1,000,999.999999999999997 — fresh cell) |
| Permissions | deployer ADMIN+MINTER+PAUSER (re-probed true on both) |
| Dependencies | none wired |
| Known discrepancies | tiny (3.4 KB) — minimal implementation; provenance tier candidates |

### 1.4 Solana mints — see D4 §1. Current mint (u64-max, decimals 18, DbFjz authority,
non-conformant at mandate scale) · superseded mint (exposed-key controlled, full supply
in 4saT ATA).

## 2. FACTS vs HYPOTHESES vs DECISIONS (explicit separation)

**Technical facts (evidence-backed, fresh):**
1. Four distinct code generations exist across three EVM chains; two families are
   byte-proven identical cross-chain (gen-A `0xa7331051…`, gen-B `0x31496b92…`).
2. The current estate is the ONLY generation with live module wiring and module-held
   MINTER; the gen families are unwired tokens.
3. NO deployed contract has established source identity (18/18 no local-build match,
   explorers unverified) — this blocks ANY safety claim about internals, incl. both Governors.
4. Genesis mandate (1M → Safe, canonical events, 1.1M USDC deposit) is unmet on every
   chain and every generation; all live custody resolves to the deployer EOA or self-custody.
5. The exposed key controls: current estate roles (both chains), gen-A ownership (all
   members), gen-B roles, RH assets, and the superseded Solana mint.
6. Governor builds differ per chain at the same hex; parameters are trivially small
   (1/1/1/1); proposer/executor auth UNESTABLISHABLE.
7. The deployed Safe infrastructure (proxy + singleton) is byte-genuine (v1.4.1, anchored
   vs mainnet) — the Safe *configuration* (1/1) is the problem, not the code.

**Hypotheses (stated as such, not to be cited as facts):**
- H-1 The Monad Redeem MINTER grant originated from a symmetric deployment script
  (CORR-6 origin story — unprovable without source).
- H-2 The two chains' modules are different source generations (OZ-v4-era vs v5-era)
  because they were compiled/deployed months apart — consistent with all selector/metadata
  evidence but unproven (N-01 would prove it).
- H-3 The same-hex Governance divergence is a same-deployer-nonce artifact (mechanically
  expected; creation receipts for Monad are pruned, so partially evidenced only).

**Decisions reserved for humans (with the approval role):**

| # | Decision | Options on the table (this report recommends none) | Approver |
|---|---|---|---|
| DEC-1 | **C-041 canonical family** | (a) current MITHQAL estate (wired, name-conflicted, supply 0.031%/0.1% of mandate) · (b) gen-A family (mandate-named, self-custody genesis, Ownable) · (c) gen-B family · (d) fresh conformant redeploy after R-06 size remediation + rotation | Governance (constituted committee) + Owner |
| DEC-2 | Token name identity | MITHQAL vs MTQΣ vs "MTQ Sigma" (three live names, one mandate) | Governance |
| DEC-3 | Solana representation policy | decimals ≤ 9 (economic approval required — D4 §2 table) · keep 18 + accept ceiling · Token-2022/custom program (own design+audit) | Owner + Economic authority |
| DEC-4 | Robinhood set tier | keep as Tier-3 provenance · formal decommission · (post-rotation) include in canonical if DEC-1 selects its twins | Owner |
| DEC-5 | Genesis completion path | complete-on-current (mint to Safe-B post-rotation, canonical events) vs redeploy-conformant (R-06 first) — NEVER pre-rotation | Governance + Economic |
| DEC-6 | Governor pair treatment | publish sources (N-01) then re-audit → activate · or treat as retired artifacts of prior iterations and deploy a governed replacement | Owner + Security Lead |
| DEC-7 | Old Safes disposition | inert-provenance · decommission annotation (recommended in D3 §4.3 — still a recommendation, not a decision) | Owner |

## 3. Interaction with the rotation plan (D3/D5) — why these decisions do NOT block de-exposure

The authority rotation is performed on the **current estate as it exists** (it is the
wired, privileged surface the exposed key controls). DEC-1..DEC-7 may re-shape the
architecture LATER; they cannot make the rotation wasted (removing the exposed key's
roles/ownership is necessary under every candidate future). The ONLY decision that must
precede specific rotation steps: **ECON-DEC-2** (Reserve-module MINTER destination,
D3 §4.4) and **SOL-DEC-1** (current-mint authority action, D4) — both flagged in D7.

## 4. What would make this comparison decision-grade (owner actions, no chain changes)

1. N-01 source publication + explorer verification for all 18 EVM contracts → converts
   selector-level facts into verified ABIs, proves/crushes H-1/H-2, unlocks Governor audit.
2. R-06 reproducible ≤24,576 B build → makes option DEC-1(d) real.
3. Constitution of the 7-signer committee (T-1.1) → creates the body that DEC-1 requires.
4. Explorer-verified deploy dates for Monad current estate (Monadscan from owner's
   browser; RPC state pruned) → closes the Monad provenance gap.
