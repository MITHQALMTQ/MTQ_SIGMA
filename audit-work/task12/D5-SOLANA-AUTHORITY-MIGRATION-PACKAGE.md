# MTQΣ — TASK 12 · D5: SOLANA AUTHORITY-MIGRATION PACKAGE (UNSIGNED — EXECUTION-BLOCKED)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

**Every step below is PROPOSED — NOT SIGNED — NOT BROADCAST — NOT EXECUTED.**
No Solana transaction of any kind was made during Task 12: no mint created, no
decimals changed, no tokens minted or moved, no authority modified. The
retired `solana-create-*`/`set-metadata*` scripts and the fail-closed
`set-solana-multisig.mjs` stub document why (see D1/D2).

---

## 0. Fresh evidence (read-only, hashed)

Anchor: **Solana devnet slot 513,885,476 / epoch 1189** (Task 12 probe,
`evidence/fresh-anchors-task12.json`, response-hashed). Both mints re-read
jsonParsed. **All cells IDENTICAL to Task 11 — state unchanged.**

## 1. Mint-by-mint dossier (fresh @ slot 513,885,476)

### 1.1 CURRENT mint — `GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4`

| Field | Fresh value | Verdict |
|---|---|---|
| mintAuthority | `DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3` (single key; NOT found in repo census; **custody UNVERIFIED — CKPT-2**) | single-key control |
| freezeAuthority | NONE | verified |
| decimals | **18** | structural anomaly (§3) |
| supply (raw) | 18,446,744,073,709,551,615 = u64 ceiling (whole: 18.446744073709551615) | deliberate 2026-08-10 `mintTo(u64::MAX)` (Task 10/11 trail) |
| holder | single ATA of DbFjz holds the full supply (Task 11 census; unchanged family) | 100% single-key custody |
| wallet SOL | DbFjz: **9.99500752 SOL** (fresh) | drainable by whoever holds that key |

### 1.2 SUPERSEDED mint — `2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY`

| Field | Fresh value | Verdict |
|---|---|---|
| mintAuthority | **`4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d` = the EXPOSED C-045-b key** | anyone with the repo can mint unlimited old-generation tokens |
| freezeAuthority | **same exposed key** (fresh) | can freeze any old-mint account |
| decimals / supply | 18 · 4,477,988,020,393,345,024 raw (4.477988020393345024 whole) | unchanged |
| holder | 4saT ATA holds 100% (Task 11 census) | hostage balance; valueless post-revoke if authorities go to None |
| wallet SOL | 4saT: **4.98368596 SOL** (fresh) | **drainable by any repo holder — urgent regardless of everything else** |

## 2. Supply-representation DESIGN DECISION (documented analysis; choice NOT made here)

SPL Token stores supply as **u64**; every mint/burn/transfer requires
`wholeTokens × 10^decimals ≤ 2^64−1 = 18,446,744,073,709,551,615`.

| decimals | Max whole tokens representable | Mandated genesis 1,000,000 (raw) | Fits? | Historical 10B plan (raw) | Fits? |
|---|---|---|---|---|---|
| **18 (deployed)** | **18** | 10^24 | **NO — 1M is 54,229,682× the ceiling** | 10^28 | NO (arithmetically reverts) |
| 13 | 1,844,674 | 10^19 | yes (54.2% of ceiling — no headroom) | 10^23 | NO |
| 12 | 18,446,744 | 10^18 | yes (5.4%) | 10^22 | NO |
| **9** | **18,446,744,073** | 10^15 | yes (0.0054%) | 10^19 | yes (54.2% headroom) |
| 8 | 184,467,440,737 | 10^14 | yes | 10^18 | yes (5.4%) |
| 6 | 18,446,744,073,709 | 10^12 | yes | 10^16 | yes (0.054%) |

Decision inputs (owner + economic authority must weigh, none chosen here):
- **Intended lifetime supply** — the blueprint's genesis mandate is 1,000,000
  MTQ to the reserve Safe; adaptive-supply growth would need ceiling headroom.
- **Smallest useful unit / UX** — EVM legs are 18-decimals; decimals ≤ 9 changes
  display precision and cross-chain equivalence math (rounding, UI, integrations).
- **Interoperability** — SPL convention is 6–9; wallets/explorers format
  18-decimals SPL mints unusually.
- **Alternatives**: (a) keep 18 and accept the ≤18.45-whole-token ceiling
  (non-conformant with the mandate — recorded, not chosen); (b) **decimals ≤ 9
  — an OPTION REQUIRING ECONOMIC APPROVAL (DEC-3)**, prerequisite to any
  fresh mint (S-4); (c) Token-2022/custom program with u128 supply —
  UNVERIFIED, requires its own design + audit, noted only as existing.
- **No silent selection, no test-driven change**: `solana-create-fresh.ts`'s
  10B×10¹⁸ plan is u64-unrepresentable and would revert; "fixing" it by
  lowering decimals without the economic approval is forbidden (the script is
  now a fail-closed stub).

**The decision is reserved to the owner + economic authority (D8: DEC-3). No
new token is created, and no decimal changes, under Task 12.**

## 3. Destination authority (defined capability; program identity UNVERIFIED)

- Option: Squads-style 2-of-3 multisig. **Program identity: UNVERIFIED — the
  candidate `SMPLecH…i4rL` probed NULL on devnet AND mainnet (Task 11); NO
  Squads program ID is asserted anywhere in this package.** Before any
  multisig work the owner MUST (i) take the program ID + version from official
  Squads documentation, (ii) verify it live on devnet themselves, (iii) record
  it with evidence (CKPT-8). The retired `set-solana-multisig.mjs` exists in
  git history for reference ONLY.
- Signer provisioning (2-of-3): 3 keypairs generated OUTSIDE repo/sandbox/AI;
  distinct custodians; documented custody; documented recovery (1 loss → still
  2-sig; 2 losses → multisig frozen — recovery itself needs the threshold:
  owner-accepted freeze risk recorded BEFORE any transfer).
- Verification-before-transfer (hard gate): provision → record address →
  `getAccountInfo` layout checks (members/threshold/permissions) → ONE
  low-risk transaction from the multisig (dust self-transfer) → only then
  transfer any authority.

## 4. Unsigned transaction sequence (all PROPOSED; fees ≈ 5k lamports/tx + rent)

| ID | Action | Signer | Precondition | Postcondition | Failure → recovery |
|---|---|---|---|---|---|
| T-4.1 | **CONDITIONAL (S-1/S-6):** provision + verify the Squads 2-of-3 multisig per §3 | ⟨SQUADS-SIGNER-1..3⟩ (owner ceremony) | program identity owner-verified (CKPT-8) | multisig address recorded + proven working (dust tx) | wrong program → STOP (nothing transferred) |
| T-4.4 | **Evacuate 4saT SOL: `SystemProgram.transfer(4saT → ⟨DEST-SOL⟩, 4.98368596 SOL − fee)`** — do WITH or BEFORE T-4.3 (an authority-dead wallet stays drainable) | **EXPOSED KEY (C-045-b) — owner-controlled session ONLY** (task11 D4 §4) | destination probe-verified | 4saT balance ≈ fee dust | wrong destination → **unrecoverable** (verify first) |
| T-4.3 | `SetAuthority(2EaK5c…, MintTokens, None)` — kill the exposed mint path | EXPOSED KEY (as above) | CKPT-7 | superseded mintAuthority == null (permanent, intended) | revert → retry |
| T-4.5 | `SetAuthority(2EaK5c…, FreezeAccount, None)` | EXPOSED KEY | with T-4.3 | freezeAuthority == null (permanent) | revert → retry |
| T-4.2 | **CURRENT-mint decision (SOL-DEC-1):** `SetAuthority(GAGRdrY6…, MintTokens, ⟨multisig | None⟩)` | **DbFjz key (owner-side; NOT in repo; custody CKPT-2)** | SOL-DEC-1 recorded (+ T-4.1 if S-1) | current mintAuthority == chosen | bad destination → unrecoverable (verification gate §3) |
| T-4.6 | Tier-2 address-book annotation (superseded mint RETIRED-AUTHORITY-REVOKED once T-4.3/4.5 execute) | n/a (doc) | T-4.3/4.5 | registry updated | — |

**Sequencing (independent of the EVM phases; different keys, different chains):**
T-4.4 with/before T-4.3; repo housekeeping (Task 12 K-1, D3) is NOT a
prerequisite — waiting for it only extends the window in which any repo
holder can act with the old literals (C11.1-05 rule carried forward).

## 5. Disposition options (owner decisions — NONE executed)

| Object | Option set | Default proposal |
|---|---|---|
| Superseded mint | **S-5** revoke both authorities · S-6 transfer both to multisig · S-7 retire formally (S-5 + annotation; ATA burn/close NOT proposed — unnecessary for a dead devnet artifact) | **S-5 + T-4.6 annotation** |
| Current mint | **S-1** transfer authority to multisig · **S-2** revoke (freezes supply at u64-max — only after a replacement exists) · **S-3** leave pending (single-key chokepoint stays; DbFjz custody attestation becomes the ONLY control — record acceptance) · **S-4** redeploy conformant mint at approved decimals (requires DEC-3 + full deploy plan + authority-to-multisig) | **S-1 or S-3 pending SOL-DEC-1** |
| 4saT wallet | evacuate SOL (T-4.4) | evacuate |
| DbFjz custody | owner attestation CKPT-2; if S-3 chosen, its custody attestation is the standing control on the whole current mint | attestation required |

## 6. Honest failure-mode summary

(a) SetAuthority with the wrong authority-type byte → tx fails, no state
change (retry); (b) transfer to an unverified multisig → **unrecoverable**
(the §3 verification gate exists for this); (c) revocation → **permanent**
(S-2/S-5 are consciously-accepted one-way doors — each acknowledged in D8);
(d) the exposed key signing session is itself a live-handling event —
owner-controlled only, never this repo/AI environment; (e) devnet rate-limits
may require retries — failures are UNVERIFIED, never negative.

## 7. Approvals required (D8 extracts)

CKPT-2 (DbFjz custody attestation) · CKPT-7 (revocation + evacuation
acknowledgement for T-4.3/4.4/4.5) · CKPT-8 (Squads identity, if S-1/S-6) ·
SOL-DEC-1 (current-mint disposition) · **DEC-3 (decimals — ECONOMIC approval;
an option, not automatic)**. **No Solana transaction may be signed, broadcast,
or executed under Task 12. Release status: NOT ACCEPTED.**
