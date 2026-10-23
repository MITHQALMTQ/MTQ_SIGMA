# MTQΣ — TASK 11 · D4: SOLANA AUTHORITY & TOKEN-DISPOSITION PLAN (mint-by-mint)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

**Every proposal on this page is PROPOSED — NOT SIGNED — NOT EXECUTED.** No authority was
changed, no asset moved, no mint created or frozen during this task. Fresh evidence:
Solana devnet slot 513,824,771 / epoch 1189 (confirmed commitment), RPC
`https://api.devnet.solana.com`, request/response-hashed transport
(`evidence/onchain-solana-task11.json`, `raw-task11-solana.jsonl`).

---

## 1. Mint-by-mint dossier (fresh, jsonParsed-authoritative)

### 1.1 CURRENT mint — `GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4`

| Field | Value (fresh) | Verdict |
|---|---|---|
| Token program | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` (SPL Token) | standard |
| isInitialized | true | VERIFIED |
| **mintAuthority** | **`DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3`** (single key — **NOT in repo** per byte-census) | single-key control; owner-attestation required |
| freezeAuthority | **NONE** | VERIFIED ✓ |
| decimals | **18** | ANOMALY (SPL convention 6–9; structural conflict §3) |
| supply (raw) | **18,446,744,073,709,551,615 = 2⁶⁴−1 (u64 ceiling)** | deliberate `mintTo(u64::MAX)` 2026-08-10 12:06:09Z (creation trail: 3 txs 12:06:06–09, feePayer DbFjz; plus 2 earlier wallet txs 12:01–12:02) |
| Whole-token display | **18.446744073709551615 MTQ** | — |
| Token accounts | 1 known: DbFjz ATA `3FfntZrc…m6MUKi` holds **the full u64-max raw** (jsonParsed census; no delegate, no close authority, state initialized) | 100% single-key custody |
| Wallet | DbFjz: **9.99500752 SOL** (fresh), 6 lifetime signatures (all 2026-08-10/09-06) | drainable by whoever holds that key |

**Disposition decision required (owner):** this mint is the live, wired mint, but it is
(а) structurally non-conformant at decimals=18 for ANY mandate-scale supply (§3), (б)
100% single-key custodied, and (в) its authority key lives outside the repo with
unverified custody. Options (all deferred — none executed):

| Option | Description | Precondition |
|---|---|---|
| **S-1 (transfer)** | `SetAuthority(mintAuthority: → Squads 2-of-3 multisig)` after §5 provisioning | Squads program identity verified by owner; multisig provisioned + exercised once |
| **S-2 (revoke)** | `SetAuthority(mintAuthority: → None)` — supply becomes permanently frozen at u64-max | only after a replacement mint decision exists (else the pilot's Solana leg is frozen) |
| **S-3 (leave pending)** | no change until the conformant-redeploy decision (K-6/D6) | documented risk: single key remains a chokepoint |
| **S-4 (redeploy)** | fresh conformant mint at approved decimals (§3 table), migrate authority to multisig, decommission this one | economic approval of decimals (§3) + full deploy plan |

**Default plan assumption: S-1 or S-3, with S-4 as the structural fix — owner decides (D7 SOL-DEC-1).**

### 1.2 SUPERSEDED mint — `2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY`

| Field | Value (fresh) | Verdict |
|---|---|---|
| mintAuthority | **`4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d` = the EXPOSED key (C-045-b)** | **NOT harmless — anyone with the repo key can mint unlimited old-generation tokens** |
| freezeAuthority | **`4saT…cA1d` (same exposed key)** | can freeze ANY old-mint holder's account |
| decimals / supply | 18 · **4,477,988,020,393,345,024 raw = 4.477988020393345024 whole** | — |
| Token accounts | 1: 4saT ATA `BLwtDcSn…MuBsX33` holds **100% of supply** (no delegate/close) | the "supply" is a hostage balance |
| Wallet | 4saT: **4.98368596 SOL**, 5 lifetime sigs (all 2026-09-06 branding) | drainable |

**Disposition decision required (owner) — a superseded mint with live authorities is an
active threat surface, not a harmless relic:**

| Option | Description | Notes |
|---|---|---|
| **S-5 (revoke both)** | `SetAuthority(mintAuthority→None)` + `SetAuthority(freezeAuthority→None)` | permanent; simplest; loses nothing (no third party holds the token) — **default proposal** |
| **S-6 (multisig)** | transfer both authorities to Squads 2-of-3 | only if the owner wants future utility for the old mint (unlikely; more provisioning surface) |
| **S-7 (retire formally)** | revoke authorities + annotate in address book Tier-2 + (optional) burn the ATA by closing… **NOT proposed**: closing an ATA with balance requires wrapping/burning — unnecessary complexity for a dead testnet artifact; annotation suffices | recommended end-state: authorities None + Tier-2 annotation |

**Default plan assumption: S-5 (+ Tier-2 annotation). Executed only after §6 sequencing (evacuate SOL first).**

### 1.3 Cross-cutting fact (do not lose): the exposed 4saT key ALSO needs its **SOL
evacuated** (T-4.4: transfer 4.98368596 SOL to an owner-controlled destination) and its
ATA is valueless post-revoke (supply has no external holders — verified: single-ATA
census). Order matters: **evacuate-then-revoke** avoids a stranded-authority situation
(after revocation the key still holds SOL — that remains drainable by anyone with the
literal, so evacuation is urgent regardless).

## 2. u64 representation analysis (the decimals decision, quantified)

SPL Token stores supply as u64. Raw amount = wholeTokens × 10^decimals must be ≤
2⁶⁴−1 = **18,446,744,073,709,551,615** for EVERY mint/burn/transfer. Fresh computed table
(`u64Ceilings` in evidence, computed locally from first principles):

| decimals | Max whole tokens EVER representable (floor) | Mandated genesis 1,000,000 raw | Fits? | Historical script plan 10,000,000,000 raw | Fits? |
|---|---|---|---|---|---|
| 18 (deployed) | **18** | 10²⁴ | **NO (1M is 54,229,682× the ceiling)** | 10²⁸ | **NO** |
| 13 | 1,844,674 | 10¹⁹ | yes (54.2% of ceiling — dangerously tight headroom) | 10²³ | NO |
| 12 | 18,446,744 | 10¹⁸ | yes (5.4%) | 10²² | NO |
| **9** | **18,446,744,073** | 10¹⁵ | yes (0.0054%) | 10¹⁹ | yes (54.2% headroom) |
| 8 | 184,467,440,737 | 10¹⁴ | yes | 10¹⁸ | yes (5.4%) |
| 6 | 18,446,744,073,709 | 10¹² | yes | 10¹⁶ | yes (0.054%) |

**Readings (facts):**
1. At the deployed decimals=18, the current u64-max supply **is the maximum the mint can
   ever hold** — no conformant supply (1M ≫ 18.45) is representable, and the historical
   `solana-create-fresh.ts` plan (10B × 10¹⁸ = 10²⁸ raw) **arithmetically reverts**.
2. Decimals=13 can represent the 1M mandate but leaves only ~84% headroom over genesis —
   any adaptive-supply/blueprint growth would overflow; it is technically possible and
   economically fragile.
3. Decimals ≤ 9 accommodates both the 1M mandate and the 10B scenario with headroom.

**Decision framing (per Task 11 §6):** decimals ≤ 9 is an **OPTION REQUIRING ECONOMIC
APPROVAL** — it is not automatically mandated by this report. Choosing it changes the
token's precision vs the EVM leg (18 decimals there) with UX/integration consequences
(display precision, cross-chain equivalence math, UI rounding). The alternatives are:
(a) keep decimals 18 and accept the ≤18.45-whole-token ceiling (definitely non-conformant
with the mandate — recorded, not chosen); (b) decimals ≤ 9 with economic sign-off
(default proposal S-4 prerequisite); (c) a non-SPL-Token representation (custom program /
Token-2022 with u128 supply — UNVERIFIED in this session, requires its own design+audit
and is NOT proposed beyond noting existence). **The choice is reserved to the owner +
economic authority (D7 ECON-DEC-3).**

## 3. Squads 2-of-3 migration option — only as defined capability (not endorsement)

**Program identity: UNVERIFIED in this session.** A candidate program ID
(`SMPLecH531NA7dL1u4Yb2uJkg7who9g2mFxpM18i4rL`) was probed live and returned **NULL on
both devnet and mainnet** (raw log) — so **no Squads program ID is asserted anywhere in
this package.** Before ANY multisig work the owner MUST (i) take the program ID + version
from official Squads documentation, (ii) verify it live on devnet themselves, (iii) record
it in the address book with the verification evidence. Until then every Squads reference
below is conditional.

**Signer provisioning requirements (2-of-3, defined BEFORE any authority transfer):**
1. Three signer keypairs generated **outside this repo/sandbox/AI environment** (owner
   ceremony; hardware wallet or air-gapped; material never transits repo — D2 rules).
2. Independence: 3 distinct custodians; no two under one person/system; custodian register
   (pseudonymous acceptable) kept by the owner.
3. Custody: documented storage + backup per signer.
4. Recovery: with threshold 2-of-3, one lost signer leaves a working 2-sig quorum; two
   simultaneous losses **freeze** the multisig — Squads supports member management via
   its own threshold transactions, which themselves need 2 sigs; the owner must document
   the accepted freeze-risk and the third-party-assisted recovery path BEFORE transfer.
5. Verification-before-transfer (hard gate): provision multisig → record its address →
   `getAccountInfo` layout checks (members, threshold, permissions) → execute ONE
   low-risk transaction from the multisig (e.g., self-transfer of dust SOL) → only then
   transfer any mint authority to it. Mirror of D3 §3 T-2.3 for Solana.

**Proposed transfer sequence (S-1/S-6, per mint — all PROPOSED):**
```
T-4.1  (if Squads route chosen) provision + verify multisig per §3
T-4.2  SetAuthority(current mint, mintAuthority → multisig | None)   [feePayer: DbFjz-controlled
       source of funds — owner-side; NOT the exposed key]
T-4.3  SetAuthority(superseded mint, mintAuthority → None)           [signed by 4saT — see §4 caveat]
T-4.4  evacuate 4saT SOL (4.98368596) to owner-controlled destination
T-4.5  SetAuthority(superseded mint, freezeAuthority → None)         [order: can precede or follow T-4.3]
```

## 4. The 4saT signing caveat (same unavoidable-handover logic as D3 §4.2)

The superseded mint's authority can only be changed **by signing with the exposed key
itself** (or its multisig destination after a transfer — which also requires the exposed
key to sign the transfer). Consequences, honestly stated:
- Whoever executes T-4.3/T-4.5 must load the compromised key into a signing tool **once,
  deliberately, in a controlled owner-side session** — never inside this repo or any AI
  environment (D2 rules; also the exact reason the key must not be "fixed in place").
- Until T-4.3 executes, ANY repo holder can race the revocation by minting/freezing the
  old mint — devnet-only impact today (no external holders verified), but the exposure is
  real and the disposal should not linger.
- The key is **not** "revoked" by deleting it from the repo (D2 §1.4 logic applies
  verbatim to Solana: ed25519 keys self-authenticate).

## 5. Fees / failure modes (per proposal — details in D5 register)

- Devnet fees are negligible but nonzero (per-tx fee ≈ 5,000 lamports + rent for new
  accounts; multisig creation adds rent-exempt deposits). Estimated total for T-4.2–T-4.5:
  < 0.1 SOL including a multisig.
- Failure modes: (a) SetAuthority with wrong authority-type byte → tx fails, no state
  change (retry); (b) transfer to a wrongly-verified multisig → **unrecoverable** (the
  verification gate §3.5 exists for this); (c) revoke-then-need-mint-back → impossible
  (revocation is permanent — S-2/S-5 must be consciously accepted); (d) ATA close attempts
  with balance → program error (not proposed anyway).

## 6. Sequencing with the EVM phases (summary — full register D5)

Solana Phase 4 is INDEPENDENT of the EVM phases and can run before, during, or after them
(different keys, different chains). The ONLY cross-constraint: T-4.4 (SOL evacuation)
should precede or accompany repo purge publicity, and the S-4 fresh-mint decision (if
taken) must complete the decimals approval (ECON-DEC-3) **before** any new mint script is
written — the existing `solana-create-fresh.ts` (10B × 10¹⁸) must never be executed as
written (it would revert, and if "fixed" by lowering decimals without approval it would
create another non-conformant mint).
