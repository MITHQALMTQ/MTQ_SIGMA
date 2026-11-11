# Solana Key-Compromise Containment Readiness — C-045-b Separate Incident Track (P0-01 Solana)

**Document ID:** SEC-P0-SOLCR-001 · **Version:** 1.0 · **Prepared:** 2026-11-11T13:45Z (UTC) · **Workstream:** D
**Branch:** security/phase-0-review-prep @ fc9ad97 (docs-only; ancestry unchanged) · **Author role:** implementer AI-agent lineage (evidence preparer — NOT an independent auditor)
**Release classification:** TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED

> **Standing independence limitation:** prepared inside the assessed environment by the implementer's own agent lineage; all network/chain results herein are implementer-side and require independent reproduction per the reviewer handoff package (SEC-P0-HANDOFF-001). No secret value is reproduced anywhere — fingerprints, status codes, counts, and public object identifiers only.

---

## 0. Framing, incident separation, and prohibitions

| Framing element | Rule (in force for this document and this session) |
|---|---|
| Compromised material | Historical **C-045-b** secret material (Solana key family) is treated as **compromised** per the owner declaration of 2026-10-24 and SEC-P0-ADDENDUM-001 §5/§6 — regardless of storage location or deletion state. Storage is not revocation. |
| Incident separation | The Solana matter is a **SEPARATE key-compromise incident** from the EVM (C-045-a) incident: distinct key family, distinct chain, distinct exposure set, distinct rotation package (D-5, not D-4). It runs an **independent containment track** and requires **independent verification** — no EVM-side result is imported as evidence here, and no Solana-side result may be used to claim EVM containment. A "migrated" EVM estate with a live operative Solana superseded-mint authority is **not** a contained rotation (ADDENDUM-001 §7.3 item 4). |
| Exposure basis | Per SEC-P0-ADDENDUM-001 §5 (superseding SECHIST-001 §6.3): C-045-b is **demonstrated anonymously retrievable by direct object address** at known historical commits (§2.2 R03–R09), in addition to every local clone/image carrying the September tags. Historical dissemination since push remains **UNRESOLVED**. |
| Prohibitions (absolute, this session and all future implementer-side sessions) | **No signing. No transfer. No revoke. No mint. No burn. No freeze. No modification of ANY Solana account. No key derivation in ANY AI environment.** No loading of the C-045-b or DbFjz authority material by any repository tooling. Every SetAuthority / transfer / evacuation step referenced in this document is a **proposed owner-executed Phase-1 action** per audit-work/task12/D5 — nothing herein was executed, signed, or broadcast. |

Adjacent disclosure context (registered, not actionable here): the **2026-11-11 owner-message credential disclosure event (values redacted)** contains no Solana key material; its relationship to the repository's embedded push token is UNKNOWN pending owner comparison (briefing §1/§8; tracked in SEC-P0-DECISIONS-001).

---

## 1. Evidence summary [HISTORICAL — SEC-P0-SECHIST-001 + SEC-P0-ADDENDUM-001 §6]

### 1.1 Where C-045-b material historically lived (7 blobs, one root commit)

| # | Path at the September lineage | Class | Intro commit | Anonymous retrievability test (ADDENDUM-001 §2.2, 2026-11-11T11:38–12:41Z) |
|---|---|---|---|---|
| 1 | `scripts/solana-create-fresh.ts` | C-045-b 128-hex literal ×1 | `2da73fd6542ff22962ba27d62f1593fdad1834fa` | R04 → HTTP **200**, pattern-count **1** |
| 2 | `scripts/solana-create-umi.ts` | C-045-b 128-hex ×1 | `2da73fd65…` | R05 → **200** / **1** |
| 3 | `scripts/solana-create-with-metadata.ts` | C-045-b 128-hex ×1 | `2da73fd65…` | R06 → **200** / **1** |
| 4 | `scripts/solana-set-metadata.ts` | C-045-b 128-hex ×1 | `2da73fd65…` | R07 → **200** / **1** |
| 5 | `scripts/solana-set-metadata-v2.ts` | C-045-b 128-hex ×1 | `2da73fd65…` | R08 → **200** / **1** |
| 6 | `scripts/verify-hex-key.ts` | C-045-b 128-hex ×1 | `2da73fd65…` | R03 → **200** / **1** |
| 7 | `scripts/verify-sol-key2.ts` | C-045-b **base58 form** (88-char export) ×1 | `2da73fd65…` | R09 → **200** / **1** |

Supporting records [HISTORICAL, cited]: SECHIST-001 §3 — real key material = 23 blobs (16 C-045-a + 6 C-045-b hex + 1 C-045-b base58), all reachable from the two LOCAL September tags (`backup-2026-09-22`, `backup-stable-2026-09-26`), none reachable from any currently-pushed ref; ADDENDUM-001 §2.6 — a single anonymous `git -c credential.helper= fetch --depth=1 … 2da73fd6542ff…` delivered 12 key-material blobs including the C-045-b set; §2.4 — the retrieval SHAs are themselves published in pushed evidence documents (self-documenting exposure chain). The three committed tool-transcripts (`tool-results/read_1788722996398…txt` etc.) each also contain a base58-shaped string alongside the C-045-a literal [HISTORICAL, SECHIST-001 §3 / ADDENDUM-001 §6]. Four-way required wording (ADDENDUM-001 §5): current-refs clean **CONFIRMED** / retrievability-by-SHA **CONFIRMED** / anonymous access **CONFIRMED from sandbox vantage — independent reviewer reproduction REQUIRED** / historical dissemination **UNRESOLVED**.

### 1.2 The superseded-mint narrative [HISTORICAL]

| Element | Record |
|---|---|
| First-generation (superseded) MTQ SPL mint | `2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY`, decimals 18 — the "OD-35-era" canonical record; reported live with `mintAuthority` = the C-045-b public address as early as the 2026-10-19 era probes (worklog.md:3466) and re-read 2026-10-22 (task10/task11/task12 evidence). |
| Supersession | The canonical registry (`CANONICAL_MTQ_ADDRESSES.solana`) was reconciled from the superseded record to the owner's current mint `GAGRdrY6…` (worklog.md:7345); the old generation was **preserved for provenance, never deleted** (worklog.md:7357, worklog.md:9053 registry-disposition record; audit-work/task12/D6 §"SUPERSEDED"). |
| Current mint | `GAGRdrY6…` created 2026-08-10T12:06:06Z, feePayer `DbFjzWcD…QhXb3` (task10 evidence `onchain-solana.json` mintCreationTx; 3 transactions ever on the mint at the 2026-10-22 census). |
| Superseded-mint holdings [HISTORICAL] | Entire supply 4,477,988,020,393,345,024 raw (4.477988020393345024 whole) in the C-045-b associated token account; wallet native balance 4.98368596 SOL; 5 branding transactions 2026-09-06 (worklog.md:7788/7812; task10 `onchain-solana.json`; task12 `fresh-anchors-task12.json` @ slot 513,885,476). |
| Standing discipline | Per ADDENDUM-001 §6: the superseded mint authority is **NOT** to be called currently privileged until a fresh independent chain read confirms what remains operative; the "4.98 SOL / drainable by any repo holder" statements are task-11-era reads to be **re-established, not assumed**. |

### 1.3 Standing status items carried into this document

| Item | Status |
|---|---|
| "4.98 SOL" figure | [HISTORICAL] until checked against a fresh block — **now re-checked at fresh slot 521118239 (2026-11-11, this session, implementer-side; §3.2)**: 4,983,685,960 lamports = 4.98368596 SOL, unchanged from the 2026-10-22 reads. Independent reproduction REMAINS REQUIRED. |
| Superseded-mint privileged label | Withheld. The implementer-side fresh read (§3.2, slot 521117591) shows both authorities set to the C-045-b public address — operative under the §5 operative-status rule — but the **privileged/authoritative label is only granted by independent verification** (S-2 discipline preserved; extended, not contradicted). |
| CKPT-2 custody attestation | **PENDING** — a key-ceremony record for the current mint authority (fingerprint `DbFjz…`, full address in §2) must be generated **outside this repository/sandbox/any AI environment**. Historical census: the DbFjz authority material was **NOT found in the repo** (worklog.md:7782 [HISTORICAL]) — absence from the repo is not custody evidence; only the attestation is. |

### 1.4 Historical probe anchors (the prior reads this document re-checks) [HISTORICAL]

| Prior anchor | When | Read | Recorded values relevant here |
|---|---|---|---|
| Slot 513,799,137 (epoch 1189 era) | 2026-10-22T06:48Z | task10 `audit-work/task10/evidence/onchain-solana.json` | both mint authorities; A-4 balance 4.98 SOL-class; A-5 ATA full supply |
| Slot 513,824,771 / epoch 1189 | 2026-10-22 (task-11 probe, worklog.md:7812) | `verify-solana.ts` jsonParsed | both mints "UNCHANGED"; A-4 = 4.98368596 SOL; A-3 = 9.99500752 SOL; two disclosed probe incidents PI-1/PI-2 (honesty record) |
| Slot 513,885,476 / epoch 1189 | 2026-10-22T12:32Z | task12 `audit-work/task12/evidence/fresh-anchors-task12.json` (response-hashed) | both mints identical to task-11; A-4 4.98368596 SOL; A-3 9.99500752 SOL |
| v9-task9 inventory | 2026-10-21T21:37Z | `audit-work/v9-task9/evidence/solana-inventory.json` | mintAuthorityOption SET / freezeAuthorityOption NONE (raw-parse); A-3 wallet token accounts count 1 |

Fresh-session comparison (§3): every cell re-read at slots 521,117,590–521,119,239 (2026-11-11) is **identical to all four anchors above** — no state movement attributable to any party across 2026-10-21 → 2026-11-11 (implementer-side; independent reproduction REQUIRED).

---

## 2. Address extraction from prior evidence (read-only — nothing derived, nothing invented)

All identifiers below are **public on-chain addresses** recovered verbatim from frozen prior evidence. The C-045-b public address was **recovered from the record**, never derived in this environment (derivation is prohibited, §0). Every row cites its exact source.

| # | Address (public identifier) | Role | Recovered from (exact citations) | Status |
|---|---|---|---|---|
| A-1 | `GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4` | **Current MTQ SPL mint** | worklog.md:16, :7345, :7788, :9054; `src/lib/mtq/contracts.ts:132` (`CANONICAL_MTQ_ADDRESSES.solana.address`, authoritative tree); `REFERENCE.md:117`; `audit-work/v9-task9/TASK9-AUTHORIZATION-AUDIT.md:52` | [HISTORICAL — recovered] |
| A-2 | `2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY` | **Superseded MTQ SPL mint** | worklog.md:3466 (with authority recorded), :7345, :7788; `scripts/verify-hex-key.ts:31`; `scripts/verify-key-and-audit-roles.ts:116`; `docs/DEPLOYMENT-RECORD.md:204`; `audit-work/task12/D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md:32`; `audit-work/task13/cross-chain-supply-and-authority-review.md:87` | [HISTORICAL — recovered] |
| A-3 | `DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3` | **Current-mint mint authority** (fingerprint `DbFjz…QhXb3` in prose records) | `audit-work/task10/evidence/onchain-solana.json:10` (also :78/:80 as mintCreationTx feePayer); `audit-work/task12/evidence/fresh-anchors-task12.json:103`; `audit-work/v9-task9/evidence/solana-inventory.json:11` | [HISTORICAL — recovered] |
| A-4 | `4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d` | **C-045-b public address**; superseded-mint mint **and** freeze authority | `docs/security/CRITICAL-PRIVATE-KEY-ROTATION.md:17` (public "Derives to" column, fingerprint `58c19e…eb60` / base58 `2mvV…j13V`); worklog.md:3466, :7782; `audit-work/task13/cross-chain-supply-and-authority-review.md:87`; `audit-work/task10/evidence/onchain-solana.json:23`/:28; `audit-work/task12/evidence/fresh-anchors-task12.json:110`/:111 | [HISTORICAL — recovered; recorded in evidence, NOT derived here] |
| A-5 | `BLwtDcSnRTZ5MAehLiQXhyRk35VtQ9Y3WknhdMuBsX33` | C-045-b associated token account on the superseded mint (historically held 100% of its supply) | `audit-work/task10/evidence/onchain-solana.json:99` (`"ata"` field) | [HISTORICAL — recovered] |
| A-6 | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` | SPL Token program (owner program of both mints; needed for getTokenAccountsByOwner params) | `audit-work/task10/evidence/onchain-solana.json:7`/:20/:84; `audit-work/v9-task9/evidence/solana-inventory.json:7` | [HISTORICAL — recovered] |
| A-7 | *(current-mint ATA of A-3 — historically holds 100% of the u64-max supply)* | Token account | **NOT recorded in prior evidence** (`audit-work/v9-task9/evidence/solana-inventory.json:35–44` records the account's mint/owner/amount but not its address) | **EXTERNAL EVIDENCE REQUIRED** — recover via fresh `getTokenLargestAccounts` (A-1) or owner-side `getTokenAccountsByOwner` (A-3, A-6); not invented here. Presently blocked by RPC rate-limit (§3.4). |
| A-8 | `SMPLecH531NA7dL1u4b2uJkg7who9g2mFxpM18i4rL` | Squads **candidate** multisig program ID (proposed D-5 destination) | `scripts/set-solana-multisig.mjs:16` (retired fail-closed stub); probed NULL on devnet AND mainnet (Task 11) | [UNVERIFIED — candidate identity only; nothing asserted; owner must take the program ID from official Squads documentation and verify live (CKPT-8)] |

Baseline-branch sources explicitly searched and yielding **no** Solana mint addresses (negative sourcing, honestly recorded): `critical-asset-inventory.md` (A4 row names C-045-b class only) and `wallet-and-signing-assessment.md` (EVM-focused; no Solana addresses) — both read at `security/phase-0-baseline` via read-only `git show`; ADDENDUM-001 §6 (checklist without addresses). The address record therefore rests on worklog.md + tracked registry/audit evidence above.

---

## 3. Fresh implementer-side devnet reads (executed 2026-11-11, this session — **NOT independent verification**)

### 3.1 Session anchors [VERIFIED-FACT — implementer-side]

| Anchor | Value |
|---|---|
| RPC endpoint | `https://api.devnet.solana.com` (public, anonymous; no auth headers, no cookies, no credentials — none exist for this endpoint) |
| Reported API version | solana-core/apiVersion **4.4.0** (all responses) |
| `getSlot` BEFORE | **521117590** (commitment confirmed) @ 2026-11-11T13:28:48Z |
| `getSlot` AFTER | **521119239** (commitment confirmed) @ 2026-11-11T13:35:26Z |
| Read window | 2026-11-11T13:28:48Z – 13:35:26Z (rate-limit backoffs included) |
| Methods used | `getSlot`, `getAccountInfo` (jsonParsed), `getTokenSupply`, `getTokenLargestAccounts` (attempted), `getBalance` — read-only only; nothing else |

### 3.2 Results [VERIFIED-FACT — implementer-side fresh read; independent reproduction REQUIRED]

| # | Read | Fresh result (per-response `context.slot`) | Interpretation |
|---|---|---|---|
| F-1 | `getAccountInfo` A-1 current mint (jsonParsed) | mintAuthority `DbFjzWcD…QhXb3` (Option **SET**); freezeAuthority `null` (Option **NONE**); decimals **18**; supply **18446744073709551615** raw; lamports 1,461,600; owner program A-6; space 82 — @ slot **521117590** | Current-mint authority unchanged from every historical read; **no freeze authority exists on the current mint** (never set). |
| F-2 | `getAccountInfo` A-2 superseded mint (jsonParsed) | mintAuthority `4saTect…cA1d` (Option **SET**); freezeAuthority `4saTect…cA1d` (Option **SET**); decimals **18**; supply **4477988020393345024** raw; lamports 1,066,800; owner program A-6; space 82 — @ slot **521117591** | Both superseded-mint authorities remain set to the C-045-b public address ⇒ **operative** under the §5 operative-status rule (any non-null old-authority read = operative). |
| F-3 | `getTokenSupply` A-1 | amount **18446744073709551615**, uiAmountString **18.446744073709551615**, decimals 18 — @ slot **521117624** | Supply equals 2^64−1: the current mint is **supply-saturated** (u64 ceiling; no further minting possible on this mint as configured). |
| F-4 | `getTokenSupply` A-2 | amount **4477988020393345024**, uiAmountString **4.477988020393345024**, decimals 18 — @ slot **521117625** | Matches every historical read; unchanged. |
| F-5 | `getBalance` A-4 (C-045-b public address) | **4,983,685,960 lamports = 4.98368596 SOL** — @ slot **521118239** (confirmed) | The historical "4.98 SOL" figure **re-checked at a fresh slot: unchanged**. Evacuation urgency (D5 §1.2 "drainable by any repo holder") stands. |
| F-6 | `getBalance` A-3 (current mint authority) | **9,995,007,520 lamports = 9.99500752 SOL** — @ slot **521118323** (confirmed) | Matches the 2026-10-22 read (9.99500752 SOL); unchanged. |

Option-field note: in `jsonParsed` encoding the Option state is expressed as `null` ⇔ `NONE` and an address ⇔ `SET`; byte-level Option verification (raw encoding, offset 4/36) is provided for the reviewer in §4.1.

### 3.3 Implementer-side analysis derived from F-1…F-6 (pending independent verification)

| Observation | Basis | Consequence |
|---|---|---|
| Superseded mint can still mint | F-2: mintAuthority Option SET to A-4; supply 4.477988020393345024×10^18 raw < u64 max | Exposed-authority mint capability remains, bounded by the u64 raw ceiling: remaining headroom = 18,446,744,073,709,551,615 − 4,477,988,020,393,345,024 = **13,968,756,053,316,206,591 raw ≈ 13.97 whole tokens** at 18 decimals (plus burn-to-reheadroom paths). "Unlimited minting" is therefore u64-bounded on this mint — still fully operative. |
| Superseded mint can still freeze | F-2: freezeAuthority Option SET to A-4 | Any account of the old mint can be frozen by any C-045-b material holder. |
| Current mint cannot mint further | F-1/F-3: supply already at 2^64−1 | Current-mint residual exposure concentrates on (a) the DbFjz **custody** question (CKPT-2) and (b) the native SOL balance F-6 — not on future minting. |
| Current mint cannot freeze | F-1: freezeAuthority Option NONE | No freeze capability exists on the current mint. |
| Native balances unchanged | F-5/F-6 vs task10/task12 anchors (slots 513,799,137 / 513,824,771 / 513,885,476) | No movement attributable to any party between 2026-10-22 and 2026-11-11 (expected: none; any movement would be an incident per the §5.3 watch posture). Implementer-side only. |

### 3.4 Failed / UNVERIFIED reads (honest record — a failed query is UNVERIFIED, never a negative result)

| Read | Outcome | Disposition |
|---|---|---|
| `getTokenLargestAccounts` A-1 | JSON-RPC error **429** ("Too many requests for a specific RPC call") on 4 spaced attempts (13:29Z–13:35Z; backoffs 25 s/20 s/60 s/90 s/120 s) | **[UNVERIFIED]** — rate-limit artifact of the public devnet endpoint, **not** an absence of accounts. Retained as reviewer checklist item (V-4); the A-7 current-mint ATA address stays **EXTERNAL EVIDENCE REQUIRED**. |

---

## 4. Owner/reviewer verification package (full §5 list — exact reproduction commands, expected evidence, blank result column)

### 4.1 Reproduction command templates (independent network path, unauthenticated)

```bash
# 0) Slot anchors before/after every battery (commitment-confirmed):
curl -s -m 12 -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getSlot","params":[{"commitment":"confirmed"}]}' \
  https://api.devnet.solana.com

# 1) Mint account state (authority Option fields via jsonParsed; null=NONE, address=SET):
curl -s -m 12 -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["<MINTADDR>",{"encoding":"jsonParsed"}]}' \
  https://api.devnet.solana.com
#    byte-level Option check (raw base64, offsets 4 / 36 of the 82-byte account):
curl -s -m 12 -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["<MINTADDR>",{"encoding":"base64"}]}' \
  https://api.devnet.solana.com

# 2) Supply:
curl -s -m 12 -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getTokenSupply","params":["<MINTADDR>"]}' \
  https://api.devnet.solana.com

# 3) Holdings concentration (retry on 429; backoff ≥60 s between calls):
curl -s -m 12 -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getTokenLargestAccounts","params":["<MINTADDR>"]}' \
  https://api.devnet.solana.com

# 4) Native SOL balance:
curl -s -m 12 -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["<ADDR>",{"commitment":"confirmed"}]}' \
  https://api.devnet.solana.com

# 5) Authority-held token accounts (delegation/permission sweep):
curl -s -m 12 -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getTokenAccountsByOwner","params":["<ADDR>",{"programId":"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"},{"encoding":"jsonParsed"}]}' \
  https://api.devnet.solana.com

# solana CLI equivalents (owner machine, devnet cluster):
#   solana --url devnet account <ADDR> --output json          # account/owner-program/lamports
#   spl-token --url devnet display <MINTADDR>                  # mint authority, freeze authority, supply
#   spl-token --url devnet accounts --mint <MINTADDR>          # token accounts + owners + amounts
#   solana --url devnet balance <ADDR>                         # native SOL
# Explorer (independent visual confirmation): https://explorer.solana.com/address/<ADDR>?cluster=devnet
```

### 4.2 Verification matrix (reviewer executes; each row = one §5 required item; result column intentionally blank)

| # | §5 item | Exact read(s) (§4.1 template + params) | Expected evidence | Reviewer result (slot + value + endpoint identity) |
|---|---|---|---|---|
| V-1 | Current mint authority (S-1) | `getAccountInfo` jsonParsed on A-1; CLI `spl-token display`; explorer | address + Option state + slot + RPC identity; implementer-side reference value F-1 (`DbFjzWcD…QhXb3`, SET) | *(blank)* |
| V-2 | Superseded mint authority (S-2) | `getAccountInfo` jsonParsed on A-2; CLI/explorer as above | address + Option state + slot. **Mapping to the C-045-b public key is performed ONLY in an owner-controlled outside-AI session** (derivation prohibited here; comparison against A-4 as recorded in evidence is owner-side) | *(blank)* |
| V-3 | Freeze authority, both mints (S-3) | `getAccountInfo` jsonParsed on A-1 and A-2 (`.freezeAuthority` / Option) | addresses + Option states + slot; reference F-1 (NONE) / F-2 (SET→A-4) | *(blank)* |
| V-4 | Token-account owner (S-4) | `getTokenLargestAccounts` on A-1 and A-2 (retry 429s); `getAccountInfo` jsonParsed per returned account → `.owner`; CLI `spl-token accounts --mint` | per-account owner map + slot; expected historical shape: A-5 holds 100% of A-2 supply; A-7 (address unknown) holds 100% of A-1 supply | *(blank — implementer attempt rate-limited, §3.4)* |
| V-5 | Mint address & decimals | `getAccountInfo` on A-1/A-2 → decimals; cross-check the tracked registry (`src/lib/mtq/contracts.ts:132` vs A-1) and A-2 records (§2) | decimals 18/18 + registry/chain identity match | *(blank)* |
| V-6 | Supply & associated token balances | `getTokenSupply` A-1/A-2; `getTokenLargestAccounts` per V-4; ATA amounts (V-4 owners) | F-3/F-4 reference values + per-account amounts + slot | *(blank)* |
| V-7 | Native SOL balance — re-verify the historical "4.98 SOL" (S-5) | `getBalance` on A-4, A-3 (and any authority the reviewer independently recovers); CLI `solana balance` | lamports + slot; reference F-5 (4.98368596 SOL) / F-6 (9.99500752 SOL) | *(blank)* |
| V-8 | Relevant account ownership | `getAccountInfo` on A-1/A-2 (owner program = A-6 Token program), A-3/A-4 (System program `111…111`), A-5 (Token program) | owner-program map per account + slot | *(blank)* |
| V-9 | Whether ANY exposed authority remains operative | V-1+V-2+V-3 combined, annotated per the **operative-status rule**: an authority is retired ONLY where the Option field reads null OR shows a transferred-away address; **any non-null old-authority read = operative** | annotated authority matrix; implementer-side reference: F-2 both authorities operative on A-2; F-1 none on A-1 | *(blank)* |
| V-10 | Current authority custody (CKPT-2, S-8) | not an RPC read — **owner-generated custody attestation** (key-ceremony record, participants, storage tier) produced **outside repo/sandbox/any AI environment** | attestation artifact + ceremony record | *(blank — PENDING, §5.1)* |
| V-11 | Outstanding delegation / program permissions (S-6) | `getTokenAccountsByOwner` (programId A-6) for each authority address (A-3, A-4, and owner-recovered others); inspect each token account's `delegate`, `isFrozen`, `delegatedAmount`; check delegated/locked accounts | holdings inventory + delegation flags + slot | *(blank)* |
| V-12 | Can the superseded mint still create assets or freeze accounts | V-2 + V-3 + F-4 arithmetic: operative mint authority + supply headroom (u64 ceiling ⇒ ≈13.97 whole tokens max at 18 decimals) ; operative freeze authority | explicit yes/no per capability with slot anchors | *(blank — implementer-side answer: YES to both, §3.3)* |

Recording discipline for every row: slot anchor before/after, RPC endpoint identity, timestamp; a failed query is UNVERIFIED, never a negative result; no signing of any kind during verification.

---

## 5. Containment readiness

### 5.1 Prerequisites (all OPEN — none satisfied at document time)

| # | Prerequisite | Why it gates containment | Status |
|---|---|---|---|
| PR-1 | **CKPT-2 custody attestation** for the current mint authority (A-3, fingerprint `DbFjz…`) | Without it, the current mint's single-key authority is an UNVERIFIED custody object — the only control on an u64-saturated mint and its native balance; must be generated **outside the repo/sandbox/any AI environment** | **PENDING** (owner action) |
| PR-2 | **Fresh independent authority matrix** | The §5 operative-status determination must rest on independently reproduced reads (V-1…V-9, V-12), not on implementer-side results (§3) | **PENDING** (reviewer) |
| PR-3 | **Owner decision on superseded-mint neutralization** (D-5 disposition: S-5 revoke both authorities · S-6 transfer to a verified multisig · S-7 formal retirement + annotation) and current-mint disposition (SOL-DEC-1) | Any revoke / SetAuthority / transfer transaction is an **owner-authorized Phase-1 action — NOT performed here, NOT authorized by this document**; sequencing per D-5 §4 (T-4.4 evacuation with/before T-4.3; CKPT-7; CKPT-8 Squads identity) | **PENDING** (owner decision register, SEC-P0-DECISIONS-001) |

### 5.2 Explicit no-action list (enforced this session — verified against the command log)

No signing; no transfer; no revoke/SetAuthority; no mint; no burn; no freeze; no creation or modification of ANY Solana account; no key derivation in any AI environment; no loading of C-045-b or DbFjz authority material by any tooling; no use of the retired `set-solana-multisig.mjs` (fail-closed stub); no Squads program assertions (candidate NULL-probed); no state-mutating RPC method invoked; no application live routes. Only the six read-only RPC methods of §3.1 were used, and only anonymously.

### 5.3 ADDENDUM-001 §6 S-1…S-8 — cross-reference (extended, not contradicted)

| ADDENDUM item | This document's extension | Status after this session |
|---|---|---|
| S-1 current mint authority | Fresh implementer-side read F-1 (§3.2) recorded with slot anchor; reproduction command V-1 | Implementer-side value recorded; **independent reproduction REQUIRED** |
| S-2 superseded mint authority (do NOT assert privileged) | Fresh implementer-side read F-2 recorded; privileged label still withheld pending independent confirmation; owner-side mapping discipline restated in V-2 | Same — recorded, not asserted |
| S-3 freeze authority both mints | F-1/F-2 + V-3 + byte-level raw-encoding command | Same |
| S-4 token-account ownership | Attempted; 429 ×4 → UNVERIFIED (§3.4); A-7 left EXTERNAL EVIDENCE REQUIRED; V-4 command set | **OPEN** |
| S-5 native SOL balance / re-verify 4.98 SOL | F-5/F-6 — figure re-checked at slot 521118239 (4.98368596 SOL, unchanged); V-7 | Implementer-side re-check done; independent reproduction REQUIRED |
| S-6 associated asset exposure / delegation | V-11 (getTokenAccountsByOwner per authority address) — not run this session (rate-limit discipline; read left to reviewer/owner) | **OPEN** |
| S-7 any old authority operative | F-1/F-2 + V-9 + §3.3 matrix | Implementer-side answer recorded (operative on A-2); independent confirmation REQUIRED |
| S-8 current authority custody (CKPT-2) | PR-1 restated with the outside-AI generation requirement | **PENDING** |

### 5.4 Open owner decisions fed by this document (decision register SEC-P0-DECISIONS-001)

| Decision | Inputs now available | Owner choices (D-5 §5 disposition table) |
|---|---|---|
| Superseded-mint neutralization | F-2 (both authorities operative), F-4 supply, §3.3 headroom analysis, A-5 holdings record | S-5 revoke · S-6 multisig transfer · S-7 retire+annotate (default proposal: S-5 + T-4.6) |
| Current-mint disposition (SOL-DEC-1) | F-1 (authority SET, freeze NONE), F-3 (supply u64-saturated — cannot mint further), F-6 (9.995 SOL) | S-1 transfer to multisig · S-2 revoke · S-3 leave pending (custody attestation becomes the standing control) · S-4 redeploy conformant mint (requires DEC-3 decimals decision) |
| 4saT native balance evacuation (T-4.4) | F-5 (4.98368596 SOL, unchanged) | evacuate to probe-verified destination — owner-controlled session only |
| Decimals / supply representation (DEC-3) | D-5 §2 u64 ceiling table (18 decimals structurally non-conformant with the 1M mandate) | economic authority decision; no silent selection |

### 5.5 Interim monitoring posture (owner-side, extends management plan §5.3 to the Solana track)

| Watch object | Expected | Any movement means |
|---|---|---|
| A-4 (C-045-b public address) — native SOL + token accounts + transaction signatures | none (treat-as-compromised holders are the only possible actors) | active incident — immediate owner response |
| A-2 (superseded mint) — authority fields + supply + ATA set | none | active incident (unauthorized mint/freeze/transfer attempt) |
| A-3 (current mint authority) — native SOL + token accounts | none until CKPT-2/SOL-DEC-1 | custody anomaly — immediate CKPT-2 escalation |

Out-of-band alerting (explorer watch / RPC polling outside this environment); the sandbox performs no monitoring and asserts none.

---

## 6. Limitations (honest)

1. Implementer-side reads (§3) come from the assessed environment's own agent lineage over one public RPC endpoint from the sandbox vantage — **not independent verification**; every value requires reproduction per SEC-P0-HANDOFF-001 (independent network path, unauthenticated client).
2. `getTokenLargestAccounts` was rate-limited (429) throughout — S-4 / V-4 and the A-7 address remain open; no negative claim is made from a failed query.
3. The C-045-b **public** address (A-4) is used only as recorded in prior evidence; no derivation of any public address from secret material occurred in any AI environment, and none may occur.
4. This document cannot and does not verify DbFjz custody (CKPT-2), Squads program identity (CKPT-8), historical dissemination of the September-lineage objects, or GitHub-side credential scope — all owner-side/EXTERNAL.
5. Authority-state claims are anchored to slots 521117590–521119239 (2026-11-11); devnet state can change at any time; the operative-status matrix must be re-anchored at verification time.
6. Self-assessment limitation (standing, management plan §19): implementer ≠ assessor is NOT satisfied for anything herein.

```
PHASE 0 — INDEPENDENT REVIEW PREPARATION (SOLANA TRACK)
P0-01 SOLANA KEY COMPROMISE — SEPARATE INCIDENT — OWNER CONTAINMENT REQUIRED
F-0-P0-01 (C-045-b) — OPEN · CKPT-2 PENDING · INDEPENDENT VERIFICATION REQUIRED
PHASE 1 — NOT AUTHORIZED
TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED
```

No compromised key is claimed revoked; no authority is claimed transferred; no Solana account was touched. Every containment action remains an owner-authorized Phase-1 step.

---

## 7. Companion documents (this branch; referenced by exact ID)

`p0-evidence-preservation-register.md` (SEC-P0-EVIDENCE-001, A) · `public-object-exposure-review-package.md` (SEC-P0-EXPOSURE-001, B) · `evm-key-compromise-containment-readiness.md` (SEC-P0-EVMCR-001, C — the SEPARATE EVM incident track) · **this document** (SEC-P0-SOLCR-001, D) · `api-authorization-independent-review-package.md` (SEC-P0-APIREV-001, E) · `boot-chain-source-integrity-review.md` (SEC-P0-BOOT-001, F) · `platform-identity-and-recovery-separation.md` (SEC-P0-IDENT-001, G) · `independent-security-reviewer-handoff.md` (SEC-P0-HANDOFF-001, H) · `owner-p0-decision-register.md` (SEC-P0-DECISIONS-001, I) · `p0-containment-readiness-executive-report.md` (SEC-P0-EXEC-001, J). Prior evidence extended here: `public-object-exposure-and-review-addendum.md` (SEC-P0-ADDENDUM-001, §6 S-1…S-8) · `secret-history-assessment.md` (SEC-P0-SECHIST-001, §3) · management plan (SEC-P0-MGMT-001, §5) · rotation package `audit-work/task12/D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md` · `docs/security/CRITICAL-PRIVATE-KEY-ROTATION.md`.
