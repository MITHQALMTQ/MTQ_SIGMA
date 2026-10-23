# MTQΣ — TASK 11.1 · CORRECTIONS REGISTER (evidence-integrity review of the Task 11 package)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**
**Overall status: NOT ACCEPTED** (unchanged — see §G at the end of this register)

Task 11.1 is a **read-only review and documentation-correction task**. It corrected
contradictions, unsupported conclusions, incomplete evidence references, and overstatements
in the completed Task 11 package **before owner authorization of any remediation**. No
transaction was sent, no role or authority changed, no asset moved, no source-control
history was rewritten, no key material was newly processed, and **no release gate was
advanced** — documentation corrections, typechecking, linting, and UI tests do not advance
gates (§7 of the tasking).

**Version control:** every pre-correction file is preserved byte-identical in
`versions/task11-v1/` (sha256 manifest below). Raw evidence artifacts from Task 11 were not
modified. Task 11.1 added new evidence (`evidence/redeem-module-forensics-task111.json`,
`evidence/raw-task111-evm.jsonl`, five full disassembly listings) and one new read-only
script (`redeem-module-forensics.ts`). All Task 11.1 corrections are marked in the edited
documents with traceable inline markers `[C11.1-nn]` that resolve to entries in this
register.

---

## 0. Marker conventions and evidence conventions

- **Correction IDs:** `[C11.1-nn]` — the entries in §A below.
- **Task 11.1 probe incidents:** `PI-11.1-a…e` — the entries in §B below (incidents of this
  review session's own tooling, disclosed and preserved, mirroring the Task 11 practice of
  PI-1…PI-4).
- **Keccak convention (recorded per Task 11.1 §3 and binding for all identity claims):**
  the authoritative identity hash of any runtime bytecode is
  **`keccak256(raw runtime BYTES)`** — the historical Tasks-9/10 convention, used by
  `evidence/identity-anchors-task11.json` and all Task 11.1 evidence.
  ⚠ **Field-name collision, documented:** the `runtimeKeccak` fields inside
  `evidence/onchain-evm-task11.json` use `keccak256(ASCII hex STRING)` — the CORR-5
  convention disclosure from Task 11. Two evidence files therefore carry the same field
  name with **different conventions**; always reconcile via the address + code size + the
  bytes-convention anchor. Task 11.1's forensics evidence records both hashes per contract
  (`runtimeKeccak` = bytes convention; `asciiHexKeccak` = the legacy string convention,
  labeled).
- **Raw-log note:** `raw-task11-evm.jsonl` / `raw-task111-evm.jsonl` truncate large results
  (`eth_getCode`) to the first 66 characters + length for log size. The full code is
  reproducible from the chain and verifiable against the recorded bytes-convention
  anchors; the disassembly listings in `evidence/` are the readable artifacts.
- **Fresh Task 11.1 anchors (all read-only; hashed transport):** Monad testnet block
  **73,216,883** · Arc testnet block **68,504,186** · Ethereum mainnet (ground truth)
  block **26,247,495**. Solana cells were **not re-probed in 11.1**; Solana statements
  retain their Task 11 anchor (devnet slot 513,824,771, epoch 1189) and are marked
  accordingly.

---

## A. Corrections

### C11.1-01 — Resolve the "zero key material published" contradiction (§1 of the tasking)

**Where it appears:** `README.md` line 7 ("…zero key material published (fingerprint-redacted
only)"); adjacent package-scoped statements in `TASK11-FINAL-REPORT.md` (§ "All artifacts are
free of private-key material") and `D1-INCIDENT-STATUS.md` §1 ("No key material, and no
fragment beyond a redacted fingerprint, appears in this package").

**The contradiction:** the package simultaneously acknowledges that an EVM private-key
literal was emitted into the Task 11 AI-session transcript (PI-3, disclosed in D1 §5 / D2
§1.1 / D2 §5.5) and asserts "zero key material published." Both are true only under
precise channel-scoping, which the original wording did not provide. "Published" without a
channel qualifier is an overstatement: a session transcript **is** a disclosure surface.

**Corrected disclosure record (the five channels, each with its own status):**

| # | Channel | Finding | Status | Incident-control actions (status) |
|---|---|---|---|---|
| 1 | **Deliverable files + evidence artifacts of Tasks 10/11/11.1** | No key material beyond redacted fingerprints; census runs byte-verified the evidence files contain no literal | **VERIFIED** (clean) | maintain redaction discipline (in force); Task 11.1 artifacts contain no key material **by construction** (this session never processed literals) |
| 2 | **AI-session transcript(s)** | The EVM literal **was emitted once into the Task 11 session transcript** (PI-3: a failing `execFileSync` printed argv containing the literal). Prior sessions that produced/quoted the worklog plaintext are outside this sandbox's auditability (D2 §5.5) | **CONFIRMED DISCLOSURE — an exposure surface, not a clean surface** | tooling fixed (patterns via stdin — applied); transcript **access control, retention, and incident review are OWNER-SIDE actions** (below); **no attempt made to purge or alter transcript evidence** (forensic-preservation mandate) |
| 3 | **Repository worktree** | EVM literal in 2 files (`scripts/verify-key-and-audit-roles.ts`, and a plaintext quote inside `worklog.md`); Solana literal in 6 script files | **CONFIRMED** (C-045) | purge T-0.1/T-0.2 **NOT EXECUTED** (awaiting CKPT-0) |
| 4 | **Reachable Git history** | **25/25 commits** contain both literals | **CONFIRMED** | history rewrite T-0.3 **NOT EXECUTED** (awaiting CKPT-0/7 approvals) |
| 5 | **Remote repositories, CI logs, artifacts, backups, caches, external clones, session-storage retention** | No local git remote is configured — which does **not** imply no remote copies exist; CI/backup/Turso surfaces unobservable from this sandbox; transcript retention outside our control | **UNVERIFIED / UNRESOLVED** — assign to owner attestation (CKPT-1) + independent inspection | credential rotation T-0.4 conditional on CKPT-1 attestation — **NOT EXECUTED**; on-chain rotation **NOT EXECUTED** (awaiting D7) |

**Required explicit statement (added where corrected):** repository cleanup — file purge,
history rewrite, credential rotation — **does not revoke an exposed private key**. A
secp256k1/ed25519 key is self-authenticating data; deleting copies changes nothing about
what a holder can sign (D2 §1.4). The only robust containment is **on-chain rotation**
(D3/D5 for EVM, D4/D5 for Solana), executed after the D7 approvals and proven by D8.

**Transcript-disclosure treatment (per §1 of the tasking):** treated as a **security
disclosure**, not an administrative note. Applicable controls, honestly assigned:
- *Session access control* — access to the session store is controlled by the platform/
  owner, not by this audit; **UNVERIFIED** who else can read it.
- *Retention* — unknown policy; **UNVERIFIED**; treated as indefinite.
- *Incident review* — this register + D1 §5/D2 constitute the disclosure record; the
  owner's security review must include the session-storage surface in scope.
- **Prohibition honored:** the key was **not** reproduced, re-derived, or newly processed
  in Task 11.1 merely to reconfirm the incident; the evidence record is preserved; no
  destructive cleanup was performed. The Task 11.1 session also did **not** re-run the
  literal-derivation census (no new processing of key material); the last census remains
  Task 11's.

**Edits applied:** `README.md` (line 7 rewritten, channel-scoped), `TASK11-FINAL-REPORT.md`
(final note rewritten with the five-channel record), `D1-INCIDENT-STATUS.md` §1 note
(scope-qualified), `D2-EXPOSURE-SURFACE.md` §1.1 row cross-referenced.

---

### C11.1-02 — Narrow the Redeem-module finding to the evidence (§2 of the tasking)

**Where it appears:** `D1-INCIDENT-STATUS.md` §5 CORR-6 ("DORMANT — **no code path can
exercise it**"; "the role exists but cannot be exercised"); `D3-EVM-ROTATION-PLAN.md` §2
("it has **no code path that can call the token's mint**"; "No caller can make Redeem
mint… so it can never grow one"); `D9` gate-2 evidence string ("Redeem-module MINTER
**proven DORMANT by full-bytecode scan**"); `README.md` headline 3 ("RESOLVED
function-level: DORMANT"); `TASK11-FINAL-REPORT.md` §1.6 and §3 CORR-6.

**Why the original wording was inadequate (exactly as the tasking suspected):** Task 11's
evidentiary basis was (a) the literal 4-byte sequence `0x40c10f19` absent from the runtime
bytecode and (b) no proxy pattern. Selector-literal absence does **not** by itself
exclude: dynamically constructed calldata, caller-calldata forwarding, generic-call
entry points, delegatecall into other code, and privileged intermediaries. Task 11.1
**proved this methodology gap is real, not hypothetical:** the **Arc Redeem module
encodes its `burn(uint256)` selector as `PUSH4 0x0852cd8d; PUSH1 0xe3; SHL`**
(0x0852cd8d ≪ 227 = 0x42966c68…) — the literal bytes `42966c68` **never appear
contiguously in the Arc bytecode**, which is why Task 11 wrongly recorded "Arc Redeem =
transferFrom only" (a functional claim its own byte-scan method could not support).

**What Task 11.1 did (all read-only, fresh, block-anchored):** full linear disassembly of
both Redeem modules and both Mint modules (positive controls), with the solc metadata
region bounded and marked; **enumeration of every external-call site**; per-site tracing
of target derivation and calldata construction; live reads of the Redeem modules'
storage slots 0–2; dispatch-table extraction of the Redeem/Reserve/Algorithm/MTQ-token
contracts; a **shift-reconstructed selector scan** (every `SHL` in the executable region);
and a byte-wise selector scan for reference. Evidence:
`evidence/redeem-module-forensics-task111.json` + five disassembly listings + hashed raw
log. Anchors reproduced exactly (Monad block 73,216,883 / Arc block 68,504,186 — all four
module code hashes + both token hashes byte-identical to `identity-anchors-task11.json`).

**The corrected, evidence-scoped finding (replaces all categorical wordings):**

> **Monad Redeem module** (`0x9632…35a4`, 6,170 B, bytes-keccak `0x8e8538e5…017c`,
> anchor-reproduced): the deployed runtime code contains **exactly six external-call
> sites** —
> 1. `STATICCALL token.balanceOf(msg.sender)` — selector `0x70a08231` (literal), target
>    = immutable embedded MTQ constant;
> 2. `STATICCALL Algorithm.getNAV()` — selector `0x0126c606` (literal), target = stored
>    slot 2 (live value = the recorded Algorithm module `0x8839…0CB2`);
> 3. `CALL token.transferFrom(msg.sender, Redeem, amount)` — selector `0x23b872dd`
>    (literal), target = immutable embedded token;
> 4. `CALL token.burn(amount)` — selector `0x42966c68` (literal), target = immutable
>    embedded token;
> 5. `CALL Reserve.0x41bf3f26(msg.sender, amount)` — selector literal, target = stored
>    slot 1 (live value = the recorded Reserve module `0x1bbC…6177`);
> 6. `STATICCALL Reserve.reserveRatio()` — selector `0x0c7d5cd8` (literal), target =
>    stored slot 1.
> In this bytecode there is **no CALLDATACOPY** (hence no caller-calldata forwarding is
> constructible), **no DELEGATECALL/CALLCODE**, **no CREATE/CREATE2**, **no SELFDESTRUCT**
> (executable region), and **no mint selector in any encoding** — literal *or*
> shift-reconstructed (automated scan: zero candidates reconstruct `0x40c10f19`; the same
> scan correctly finds Arc Mint's real mint site, proving the scanner works). The token
> receives only `balanceOf/transferFrom/burn` calldata from this module — none of which
> can mint, because `mint(address,uint256)` is a distinct token function gated by
> MINTER_ROLE. The stored references are mutable only through `setReserve/setAlgorithm`,
> which are gated by the **module-side custom `ADMIN_ROLE` (`0xa4980720…1775`)** — and
> even a re-pointed reference would only ever receive the three fixed non-mint selectors,
> none of which appear in either MTQ token's dispatch (checked fresh: both tokens' dispatch
> tables contain none of `0126c606/41bf3f26/0c7d5cd8`), so no re-pointing path can make
> this module mint. One level of indirection is also closed: the live stored targets are
> the recorded **Algorithm** (zero external-call sites in its own bytecode — terminal) and
> **Reserve** (two STATICCALL-only sites — views; no state-changing call; no mint selector
> anywhere in it) modules, and neither holds token-side roles. The module's code contains
> no reference to any other MINTER holder (no Mint-module/Safe/deployer address embedded —
> embedded-address scan covers the full registry).
>
> **Conclusion, scoped:** *for the deployed runtime bytecode at the recorded code hash and
> block, no direct or indirect execution path in the module's own code — including via
> its mutable stored references and one level of indirection to the current targets — can
> exercise the token-side MINTER_ROLE held by the Monad Redeem module.* This is an
> **affirmative bytecode-level proof with complete call-site enumeration**, strictly
> stronger than Task 11's selector-absence inference; it is **not** UNRESOLVED (the path
> question is decidable and was decided by enumeration), and it is **not** a claim about
> anything beyond the inspected code at the recorded block (the code at this address
> cannot be replaced by the module itself: no proxy pattern, no SELFDESTRUCT, no CREATE).

**What remains OPEN (per §2's instruction):**
- **The unexplained role grant itself** — why the Monad Redeem module holds token-side
  MINTER_ROLE remains unexplained (hypothesis: a symmetric deployment script granted it to
  both "operations" modules on Monad; **unproven without source — N-01**). The privilege
  stays an **open hygiene finding** until governance explicitly approves its disposition
  (planned revoke at T-3.1, executed by Safe-B, unchanged).
- **Two module-side role-membership cells were never probed** (Tasks 9–11 probed only
  DEFAULT_ADMIN/MINTER/PAUSER): the custom module `ADMIN_ROLE` (`0xa4980720…1775`, gates
  `setReserve/setAlgorithm`) and the redeem-side role (`0xf65a18a7…7fdc`, gates
  `redeem(uint256)`), both chains. Their membership is **UNVERIFIED**. These are proposed
  as new D8 verification cells (E-15/E-16, added to D8 with a marker). Note: even if
  held by unknown parties, neither cell creates a mint path (see the scoped conclusion);
  they matter for correct authority bookkeeping, not for the mint question.
- **Arc Redeem corrected:** Task 11's "Arc Redeem = transferFrom only (no burn)" is
  **corrected** — Arc Redeem calls `burn(uint256)` with a shift-encoded selector
  (`0x0852cd8d ≪ 227`), plus `transferFrom` (literal), `balanceOf` (literal),
  `Algorithm.getNAV()` (`0x936303 ≪ 0xe1`), `Reserve.0x41bf3f26` (`0x20df9f93 ≪ 0xe1`),
  `Reserve.reserveRatio()` (`0x018fab9b ≪ 0xe7`). Arc Redeem holds **no token-side
  roles** (fresh role matrix), so the correction is a matter of record accuracy, not
  exposure. The Monad/Arc "cross-chain build divergence" note is re-attributed: the
  divergence is largely a **compiler-encoding artifact**, not a functional divergence.

**Edits applied:** `D1` §5 CORR-6 (narrowed wording + cross-ref), `D3` §2 (rewritten
around the call-graph table + open cells), `D9` gate-2 evidence string, `README` headline
3, `TASK11-FINAL-REPORT` §1.6/§3, `D8` (new cells E-15/E-16).

---

### C11.1-03 — Safe identity-report precision (§3 of the tasking)

**Where it appears:** `TASK11-FINAL-REPORT.md` §1.5 ("**proxy and singleton
byte-identical to mainnet canonical v1.4.1**"); `D9` gate-2 ("Safe infrastructure
byte-proven GENUINE (proxy + singleton byte-identical to mainnet canonical v1.4.1…)");
`D3` M-10; `README` headline 2; `D1` §5 PI-4.

**Problems corrected:** (a) the phrase could be read as implying the 171-byte proxy runtime
and the 24,421-byte singleton runtime are byte-identical *to each other* — they never
were; (b) "byte-identical to mainnet canonical v1.4.1" was only **performed** for the
singleton — the proxy was compared Monad-vs-Arc, never against a mainnet-anchored
canonical SafeProxy reference; (c) "canonical v1.4.1" is ambiguous because the canonical
v1.4.1 family includes both a **SafeL2** singleton (the estate's `0x29fcB43b…C762`) and
an L1-variant singleton — the docs must name which; (d) the keccak-convention collision
(§0 above) had to be recorded.

**Corrected per-artifact documentation (each artifact documented independently):**

| Artifact | Address | Runtime size | Bytes-keccak (raw-byte convention) | Canonical counterpart | Independent match status |
|---|---|---|---|---|---|
| Safe **proxy**, Monad instance | `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0` | 171 B | `0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c` | canonical SafeProxy v1.4.1 runtime | proxy Monad == proxy Arc (**VERIFIED** cross-chain); **comparison against a canonical SafeProxy reference was NOT performed → that specific match is UNVERIFIED** (not claimed anymore) |
| Safe **proxy**, Arc instance | same address (cross-chain address reuse — itself a recorded anomaly) | 171 B | identical to Monad instance | same | same |
| **Singleton** (both chains) | `0x29fcB43b46531bCa003DdC8fCb67FFE91900C762` | 24,421 B | `0xb1f926978a0f44a2c0ec8fe822418ae969bd8c3f18d61e5103100339894f81ff` | **canonical SafeL2 v1.4.1 singleton**, same address, Ethereum mainnet | **MATCH VERIFIED** — Monad = Arc = Ethereum mainnet @ the same address (Task 11 fetch + **fresh Task 11.1 re-confirmation at mainnet block 26,247,495**, hashed transport) |
| Canonical reference, L1-variant Safe v1.4.1 singleton | recalled address `0x41675C09…fB71` | — | — | — | probe returned **EMPTY code** from the public mainnet endpoint → **UNVERIFIED from this sandbox; no address or hash for the L1 variant is asserted anywhere** in this package |

**Explicit statements added:** the proxy runtime and the singleton runtime are different
artifacts and are **not** byte-identical to each other; each "match" verdict above is
artifact-specific. **Genuine Safe bytecode does not establish safe governance and does
not eliminate the compromised-owner risk:** both Genesis Safes are 1-of-1 owned solely by
the exposed deployer EOA (`getOwners() == [0x3C39…d8c]`, `getThreshold() == 1`, fresh),
nonce 0, zero balances, guard/fallback storage slots zero (storage-read; the canonical
SafeL2 v1.4.1 build dispatches no `getGuard()/getFallbackHandler()` getters — PI-4 was a
method artifact), and the recorded `getModules()` return `["", 0x…01]` is the
pagination-sentinel shape of an **empty** module set. The same raw-byte keccak-256
convention is used throughout identity claims and is recorded in the evidence
documentation (§0).

**Edits applied:** `TASK11-FINAL-REPORT.md` §1.5, `D9` gate-2, `D1` §5 PI-4, `D3` M-10,
`README` headline 2.

---

### C11.1-04 — Scope and evidence-language tightening (§4 of the tasking)

**Allowances.** Task 11 wording: "allowances **all zero**… no hidden pull-permissions; no
pre-approvals" (final report §1.4; D9 gate 2; README headline 2; D1 §6). **Corrected to:**
"**all 36 queried** deployer⇄estate allowance cells returned zero **at the recorded
blocks (73,193,262 / 68,490,282), for the queried (owner, spender) pairs, via the standard
`allowance(address,address)` method**. Other asset/spender combinations were **not
queried** and are **UNVERIFIED** — the zero result must not be extrapolated to every
possible asset or approval." "No hidden pull-permissions" is scoped to the queried cells.

**State stability.** "On-chain state is cell-for-cell identical to Task 10 — no unknown
activity occurred between audits" (final report §1.10; D1 §3; README headline 2).
**Corrected to:** "identical **at the recorded block anchors, for every probed method and
queried address/cell** — no drift was observed in any probed cell; the probes do not
observe unprobed surfaces and cannot exclude activity that leaves no trace in the probed
cells." Stability is evidence of *absence of observed drift*, not of safety (D1 §3
interpretation note retained).

**Remote surfaces.** README headline 1 said "**no remote detectable**." **Corrected to:**
"**no git remote is configured on this machine — remote existence UNVERIFIED**" (the
absence of a local remote is not evidence about remote copies; D2 §5's UNRESOLVED
assignment and the CKPT-1 attestation path are the operative controls).

**CI/CD.** "6 CI/CD workflows inventoried" (D1 §1; D2 §1.3) — **scoped to:** "inventoried
**by file pattern**; secret **values** were never read; workflow **execution** is
unobservable from this sandbox → all CI/CD conclusions remain UNRESOLVED pending owner
attestation (CKPT-1)".

**Solana.** Solana on-chain statements (mint authorities, supplies, ATAs, wallet balances)
carry the Task 11 slot anchor (513,824,771 / epoch 1189, confirmed commitment) — wording
now consistently says "**at the recorded slot**, for the queried mints/accounts and
methods." No Solana data was re-probed in Task 11.1 (none of the corrections required it).

**Source/build identity.** No source-level reasoning is treated as authoritative
anywhere in this package: all 18 deployed contracts remain without established source
identity (D1 §4; N-01), and the §2 conclusions rest **solely on bytecode**. D6's gen-A
note "matches local `contracts/MTQSigma.sol` semantics" is explicitly labeled a
**non-authoritative source-level observation** (explorer verification absent).

**Failure preservation.** Failed requests, retries, and revert classifications remain
preserved in the raw logs (Task 11: 477 EVM requests / 83 retries / 26 classified
reverts; Solana 13 + FAILED-UNVERIFIED entries PI-1/PI-2; Task 11.1: 23 fresh EVM/mainnet
requests, 0 failures, all hashed in `raw-task111-evm.jsonl`). A failed or missing query
is **UNVERIFIED**, never a negative result — unchanged and re-affirmed.

**Edits applied:** `TASK11-FINAL-REPORT.md` §1.2/§1.4/§1.10, `D1` §1 note + §4 rows,
`README` headlines, `D9` gate-2 string, `D6` §1.2 label.

---

### C11.1-05 — Remediation-sequencing correction (§5 of the tasking)

**Where it appears:** `D5-TRANSACTION-REGISTER.md` Phase-0 header ("**prerequisites for
everything**"); T-4.3 dependency ("T-0.x done (so no fresh copies spread)"); T-1.1
("T-0.x recommended first").

**Problem:** presenting repo housekeeping as a **prerequisite for everything** risks
exactly the failure mode §5 forbids: the estate remaining dependent on the compromised
keys longer than necessary **because source-control housekeeping is treated as
containment**. Housekeeping does not reduce on-chain authority exposure at all — the
exposed keys' privileges are identical before and after any purge/rewrite. Conversely,
the plan's grant-before-revoke core (destination provisioning → verification → grants →
revokes, T-1.4 hard gate, T-3.6/T-3.7 last) is correct and unchanged.

**Corrected sequencing semantics (taxonomy added to D5):**

| Step class | Steps | What it actually does | What it does NOT do |
|---|---|---|---|
| **Source-control & credential housekeeping** | T-0.1, T-0.2 (purge), T-0.3 (history rewrite), T-0.4 (credential rotation, conditional on CKPT-1) | stops **ongoing spread** of the literals and protects *future* material | does **not** revoke either key; does not change any on-chain privilege; is **not containment** of the current compromise |
| **New-governance establishment** | T-1.1 (7 signers), T-1.2/T-1.3 (Safe-B deploys), T-1.4 (quorum proof — **hard gate**), T-4.1 (Squads provisioning, conditional) | creates and **verifies** the destination authority that will hold privileges after rotation | does not reduce the exposed keys' power until Phase 2/3 actually execute |
| **Exposure-reducing (the only true de-exposure)** | Phase 2 grants (opens the unavoidable handover window, disclosed) → Phase 3 revokes (T-3.1…T-3.5, then **T-3.6/T-3.7 LAST**) → T-3.8 evacuation; Solana T-4.3/T-4.4/T-4.5 | removes the compromised keys' on-chain authority and drains value they can reach | cannot be done before the destination is verified (else the estate is orphaned) |

**Specific edits:** (a) D5 Phase-0 header reclassified to "**recommended-first parallel
hygiene track — reduces ongoing spread; does NOT gate Phases 1–4**; the only hard
prerequisites for chain actions are the D7 checkpoints and the T-1.4-style destination
verification"; (b) **T-4.3 dependency corrected:** "repo housekeeping is **not** a
prerequisite for the Solana revocations/evacuation — waiting for it extends the window
during which any repo holder can mint/freeze the old mint and drain the SOL; proceeding
promptly after CKPT-7 approval is the recommended default (owner may still sequence
differently as a risk-tolerance decision, recorded as such)"; (c) T-1.1 "recommended
first" softened to "may proceed in parallel; no dependency on repo state"; (d) both
forbidden failure modes restated on D5: *don't treat housekeeping as containment*
(delays rotation) and *never revoke the only working administrative path before the
destination authority is verified* (T-1.4 → grants → last-revokes invariant — unchanged);
(e) reaffirmed: the current 1/1 Safes are **not** assumed sufficient (OD-35 stands); the
Squads program identity and any destination configuration are **not** assumed valid
until owner-verified and probe-verified (D4 §3.5 / T-4.1 gates unchanged); the **Solana
authority decision (SOL-DEC-1) and the decimals decision (DEC-3/ECON-DEC-3) remain
pending** their economic and governance approvals — nothing in this register advances
them.

---

## B. Task 11.1 probe incidents (this session's own tooling — disclosed, preserved)

| ID | Incident | Disposition |
|---|---|---|
| **PI-11.1-a** | v1 of the forensics probe **hand-transcribed** the Monad Mint-module anchor and dropped one character, producing a false "anchor mismatch" that briefly looked like **code drift**. | Fixed by **loading all anchors programmatically from `identity-anchors-task11.json`** (no hand-typed hashes remain in the probe). Re-run with corrected constants: **all anchors reproduced exactly — deployed code UNCHANGED** (no drift; the mismatch was the probe's own transcription defect). Disclosed here and in the evidence JSON header. |
| **PI-11.1-b** | v1's linear disassembly ran into the appended solc CBOR/IPFS metadata, misreading data bytes as opcodes (spurious "SELFDESTRUCT" near code end on two modules). | v2+ detects and marks the **metadata boundary** (first `a2 64 i p f s` occurrence) and restricts call-site/opcode analysis to the executable region; disassembly listings record the boundary offset. No conclusion was drawn from the misread bytes (they were excluded before any trace). |
| **PI-11.1-c** | v1's dispatch-table heuristic capped at 700 bytes (would miss later dispatch entries) and resolved fewer names. | v2+ scans the full executable region; unresolved dispatch entries are recorded **by value** with no name guessed (d13d1fc4, d73792a9, 2d11c58a, 14e048ba — present in the module family; no name resolution exists for them in this package and none is needed for the §2 conclusion, which rests on call-site enumeration, not names). |
| **PI-11.1-d** | **Task 11 evidence-methodology limitation discovered and corrected:** byte-wise selector scans can miss shift-reconstructed selectors — Arc Redeem's `burn(uint256)` (selector `0x42966c68` encoded as `PUSH4 0x0852cd8d; SHL 0xe3`) is absent as literal bytes and was mis-recorded by Task 11 as "transferFrom only." | Task 11.1's conclusions rest on **per-call-site selector tracing** plus an automated shift-reconstruction scan; the Arc burn call is now recorded (C11.1-02); Task 11's Monad conclusion **survives with an upgraded evidentiary basis**. This incident is also why C11.1-02 does not rely on Task 11's byte-scan as proof of anything on Arc. |
| **PI-11.1-e** | The recalled address for the canonical **L1-variant** Safe v1.4.1 singleton returned **EMPTY code** from the public mainnet endpoint. | Recorded as **UNVERIFIED** (the recall itself is unconfirmed from this sandbox); preserved in the raw log; **no L1-variant address or hash is asserted anywhere**; the operative canonical comparison (SafeL2 v1.4.1 @ `0x29fcB43b…C762`, mainnet) is live, recorded, and reproduced fresh (C11.1-03). |

---

## C. New verification cells proposed for D8 (added to D8 with markers — not executed)

- **E-15 (both chains):** `hasRole(0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775, x)` on the
  Redeem module — enumerate/attest membership of the **module-side custom ADMIN_ROLE**
  that gates `setReserve/setAlgorithm` (never probed by Tasks 9–11; UNVERIFIED).
- **E-16 (both chains):** same for the **redeem-side role**
  `0xf65a18a7fc1e205f382482ab099efa145b9dcdeb4e6b508f0e02d9660f027fdc` that gates
  `redeem(uint256)` (UNVERIFIED).
- **E-17:** re-run `redeem-module-forensics.ts` post-remediation: all call-site
  enumerations and anchors must reproduce byte-exactly (code identity must be unchanged
  by the rotation — no redeployment side-effects).

These cells close the two unprobed membership questions without creating any new claim
that they affect the mint-path conclusion (they do not — see C11.1-02's scoped proof).

---

## D. Preserved-versions manifest (sha256 first-16, `versions/task11-v1/`)

```
8fb947f1c2cb41da  D1-INCIDENT-STATUS.md        1df6a904a468d47d  D2-EXPOSURE-SURFACE.md
1f1de06201e1e54a  D3-EVM-ROTATION-PLAN.md      9023be5671cc8808  D4-SOLANA-AUTHORITY-PLAN.md
7862ea74bd92e836  D5-TRANSACTION-REGISTER.md  d31ef31574042d6f  D6-CANONICAL-ARCHITECTURE-DECISIONS.md
2bf42d7ac06dca7d  D7-APPROVAL-AND-DEPENDENCY-MATRIX.md
803322870380832f  D8-POST-REMEDIATION-VERIFICATION.md
b904587ec0a15831  D9-TASK11-RELEASE-GATES.md
bbef54b3cde4ea1e  README.md                   6b232d566d374139  TASK11-FINAL-REPORT.md
```

The `versions/task11-v1/` directory holds the complete pre-correction package (11 files,
manifest above; full digests reproducible via `sha256sum versions/task11-v1/*.md`).
Raw evidence (`evidence/*` except the new Task 11.1 files), all Task 11 scripts, and the
worklog were left untouched. Prior corrections (CORR-1…CORR-6, PI-1…PI-4) are preserved
verbatim inside the originals and re-affirmed, not re-labeled.

---

## E. What Task 11.1 did NOT change

- **No finding was downgraded:** C-041–C-049, OD-35, the 20-PASS/9-FAIL/1-UNVERIFIED
  validation verdicts, and every D9 rejection stand exactly as before.
- **No gate advanced:** all 7 release indicators keep their statuses (D9); Task 11.1 was
  a documentation/evidence correction task — by the tasking's §7, typechecking, linting,
  UI tests, and documentation corrections **cannot** advance any gate.
- **No plans were re-ordered structurally:** the grant-before-revoke architecture, the
  T-1.4 hard gate, the last-revokes invariant, the D7 checkpoint map, and the D8 suite
  are unchanged; only the Phase-0/T-4.3 dependency semantics were corrected (C11.1-05).
- **No key material was processed, printed, derived, or re-confirmed**; no on-chain
  state was touched (23 read-only RPC requests + mainnet ground-truth reads, all
  hashed); no Solana probe was re-run.

## F. Files edited with traceable markers

| File | Markers applied |
|---|---|
| `README.md` | C11.1-01, -02, -03, -04 |
| `TASK11-FINAL-REPORT.md` | C11.1-01, -02, -03, -04, -05 |
| `D1-INCIDENT-STATUS.md` | C11.1-01, -02, -03, -04 |
| `D2-EXPOSURE-SURFACE.md` | C11.1-01 (cross-reference) |
| `D3-EVM-ROTATION-PLAN.md` | C11.1-02, -03 |
| `D5-TRANSACTION-REGISTER.md` | C11.1-05 |
| `D8-POST-REMEDIATION-VERIFICATION.md` | C11.1-02 (cells E-15/16/17) |
| `D9-TASK11-RELEASE-GATES.md` | C11.1-02, -03, -04; ledger additions PI-11.1-a…e |
| `D6-CANONICAL-ARCHITECTURE-DECISIONS.md` | C11.1-04 (source-identity label) |

New files: this register · `TASK11-1-FINAL-REVIEW.md` · `OPEN-RISK-AND-APPROVAL-MATRIX.md`
· `evidence/redeem-module-forensics-task111.json` · `evidence/raw-task111-evm.jsonl` ·
five `evidence/redeem-module-disassembly-*.txt` listings · `redeem-module-forensics.ts`.

## G. Register verdict

The Task 11 package's conclusions **survive review**, with three corrections of substance
(C11.1-01 disclosure precision, C11.1-02 re-founded Redeem finding + Arc burn correction,
C11.1-03 Safe per-artifact precision) and two scope-tightening corrections (C11.1-04,
C11.1-05). Nothing in this register authorizes execution of any kind. The package is
returned for human security and governance review with the standing posture:
**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN ·
NOT ACCEPTED.**
