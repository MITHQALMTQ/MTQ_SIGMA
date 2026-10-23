# MTQΣ — MANDATE-007 §4 · Task 2-b — Issuance State Machine Prototype: Evidence Record

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED. Production authorization: FALSE.**
Everything recorded here is **NON-PRODUCTION PROTOTYPE evidence** produced in a sandbox with zero on-chain
actions, zero network calls, zero key handling, and zero changes outside
`audit-work/task13/evidence/issuance-state-machine/` (+ the append-only worklog). "Issued" tokens in this
prototype are **LEDGER RECORDS ONLY — no token contract is involved, no chain action occurs, none is simulated
as an on-chain act.**

---

## SPECIFIED

**Mandate being implemented (MANDATE-007 §4, excerpt):** "Implement or prototype the issuance state machine in
a non-production environment. Use a clearly identified approved test instrument for the stablecoin pathway.
Demonstrate payment authenticity, settlement verification, pricing, fee calculation, authorization, supply
controls, replay protection, issuance, and reconciliation. Test duplicate, delayed, failed, reversed,
unauthorized, and invalid payments. Build the CBDC adapter interface and test it with labeled simulated
messages until an actual authorized interface is available. Report the CBDC as SIMULATED / NOT CONNECTED
unless an end-to-end integration is verified. Do not claim either pathway is operational outside the evidence
demonstrated."

**Controlling spec (all cites below refer to `audit-work/task13/payment-instrument-registry-and-settlement-spec.md`,
STATUS: PROPOSED v1 — NOT APPROVED, NOT IMPLEMENTED):**

| Requirement | Spec cite |
|---|---|
| Separation invariant: payment volume never determines eligibility/weights | §2 (MANDATE-004 §7 verbatim); test T-PAY-01; prototype analog SEP-01 |
| Registry data model: per-instrument-INSTANCE rows (code + network + contract identity, never a ticker alone) | §3 |
| Per-type policy: approved stablecoins / CBDCs only where authorized access + technical interfaces exist | §4 |
| Registry lifecycle states, suspension triggers, notice, honesty-state discipline (SIMULATED/NOT_CONNECTED one-way) | §5, §5.3 |
| Quote generation: conversion source, expiry (hard-reject), spread disclosure, fee line items, rounding, signed + replay-protected | §6.1 |
| Per-rail settlement finality: stablecoin N-confirmations + issuer sanity; CBDC = the authorized interface's own finality signal (absent interface ⇒ no quotes) | §6.2 |
| Refunds & failed transactions: same idempotency key, refund state machine, no fee retained on failure | §6.3 |
| Idempotency keys: duplicate submission returns the original result — never a second execution | §6.4 |
| Three-way reconciliation (initiator vs acquirer vs token ledger) + exception queue | §6.5 |
| Exception taxonomy: CONFIRMATION_TIMEOUT / REORG_ROLLBACK / FINALITY_EVIDENCE_GAP / RECONCILE_MISMATCH / ISSUER_EVENT / DUPLICATE_KEY_COLLISION / PARTIAL_SETTLEMENT | §6.6 |
| Stablecoin-registry field coverage + per-instance identity rule (approval on one network ≠ approval of the same name elsewhere) | §14.2 rules (a)/(b) |
| CBDC adapter: nine §7.4 concern areas as a required annex of any admission dossier; real-adapter gate = verified authorized interface + recorded end-to-end test | §14.3 |
| 12-step minting-workflow state machine + hard rules (payment notification alone never triggers unauthorized issuance; failed/unverified payments never create tokens; replays never double-mint) | §14.4 |
| Pricing general form: MTQΣ issued = net accepted payment value in the approved quote unit ÷ approved MTQΣ issuance quote (illustrative, NOT approved policy) | §14.5 |
| D-13.27 (OPEN): ALT-1 window / ALT-2 approval-per-issuance / ALT-3 rule-bound program / ALT-4 hybrid + periodic attestation; common invariants under every alternative; NO selection | §14.6 |
| Cross-operation integrity rules (no rebalance-minting, no payment-weights, no cross-chain duplicate supply, no live policy change) | `issuance-burn-and-supply-policy-options.md` §2 |
| Issuance operation fields: authorization/amount/valuation/supply invariants/replay/idempotency/accounting/events/failure-recovery/reconciliation/limits | `issuance-burn-and-market-mechanism-spec.md` §2.3 |

---

## IMPLEMENTED

**All files are NON-PRODUCTION PROTOTYPES under `audit-work/task13/evidence/issuance-state-machine/`. Nothing
under `src/`, `contracts/`, or any other existing file was modified.**

| File | Contents |
|---|---|
| `instrument-registry.ts` | NON-PRODUCTION PROTOTYPE of spec §3–§5: per-instance rows; **the ONE APPROVED TEST instrument** (see identity below); a second PROPOSED instance of the SAME code on a different network (per-instance identity rule); a REVOKED row; two CBDC rows born `SIMULATED / NOT CONNECTED`; PROPOSED/RESTRICTED/SUSPENDED/REVOKED analog transition table with fail-closed honesty gates (NOT_CONNECTED admission blocked; reinstatement requires the 48h observation period); depeg band classifier (spec §4 bands, values D-13.19 UNAPPROVED); notice records; test-of-absence helper for weighting telemetry fields |
| `issuance-state-machine.ts` | The spec §14.4 12-step workflow as an EXPLICIT state machine (21 states incl. 9 terminal failure states mapped to the spec §6.6 taxonomy; every transition validated against an explicit table); spec §6.1 quotes (id, expiry, spread disclosure, fee line items, rounding, synthetic replay-protected tag); §6.2 per-rail finality (stablecoin: N=3 confirmations AND issuer sanity — balance receipt alone is never finality; CBDC: the simulated interface's own finality signal, SIMULATION MODE only); §6.3 refund state machine (PENDING_REFUND → REFUNDED, same idempotency key, no fee retained on failure); §6.4 idempotency-key + payment-txId + request-id registries (three replay layers); §6.5 three-book reconciliation as a REAL pure check (C1–C4); §6.6 exception queue; INV-A..INV-E machine-level invariants (INV-A hard-guarded inside the transition itself + a TEST-ONLY bypass-attempt harness mirroring the finality-before-mint §84 bypass-route vocabulary); D-13.27 ALT-1..ALT-4 adapter stubs (default ALT-2 FOR TESTING ONLY); four OPEN TODO-decision constants; step-12 audit publication of every transition with reason codes |
| `cbdc-adapter.ts` | `CbdcAdapter` interface with the NINE spec §14.3/§7.4 concern areas as documented members (issuing authority & jurisdiction; eligible participating institutions; permissioning/account requirements; authorized technical interface; payment initiation/verification/settlement-status queries; transaction identifiers & duplicate prevention; finality/failure/reversal/dispute/timeout semantics; privacy & audit; reconciliation interface) + `SimulatedCbdcAdapter` producing messages that ALL carry `simulation: true` and the marker "SIMULATED — NOT CONNECTED" with txId, status (INITIATED/VERIFIED/SETTLED/FAILED/REVERSED/TIMEOUT) and finality-at timestamp; `CBDC_ADAPTER_STATUS = "SIMULATED / NOT CONNECTED"`; honest integration-limitations record; real-adapter gate = FALSE on all three axes |
| `run-issuance-e2e.ts` | Standalone end-to-end runner (123 assertions, stable ids, printed observed values): REG-01..04, ISS-01..10, AUTH-01..03 (+AUTH-00), CBDC-01..04, SEP-01, INV-01..05. Writes `results-issuance-e2e.json`, appends `run-log.txt`, exits 0 only if ALL pass. Not a `*.test.ts` file (bun-test suite untouched) |

**Approved test instrument identity (stablecoin pathway — the ONLY instrument evidenced):**

- instrumentId `TEST-STBL-001`, code **TEST-USDC-X**, network `TEST-CHAIN-1 (SYNTHETIC)`, contract identity
  `0xTESTUSDCX0000NOTAREALCONTRACT` (deliberately NON-HEX so it cannot be confused with a real address),
  issuer `TEST-ISSUER (SYNTHETIC)`, jurisdiction `TEST-JURISDICTION`, decimals 6, state **APPROVED**
  (honesty overlay SIMULATED), confirmation policy = 3 confirmations + issuer sanity check (spec §6.2),
  valuation basis = 1.000000 TU per unit via a SYNTHETIC-ORACLE-BOARD stand-in (never assumed), depeg bands
  per spec §4 (values UNAPPROVED, D-13.19), fee class TEST-FLAT-10BPS (ILLUSTRATIVE — D-13.8 OPEN).
- Second instance row `TEST-STBL-002` = SAME code on `TEST-CHAIN-2 (SYNTHETIC)`, state PROPOSED — demonstrating
  the per-instance identity rule (same name on another network is NOT auto-approved; enforced at quote time and
  asserted by REG-02 + ISS-07-04).
- CBDC rows `TEST-CBDC-001/002`: status **SIMULATED / NOT CONNECTED**; structurally inadmissible in this
  prototype (no verified authorized interface + no end-to-end test exist — asserted by REG-01 and CBDC-01-01).

**D-13.27 relationship (exactly as mandated):** the COMMON INVARIANTS under every alternative are implemented
as machine-level invariants and asserted (INV-A payment-alone-never-mints; INV-B failed/unverified never mint;
INV-C no double-mint; INV-D reversal-after-issuance fail-closed; INV-E decisions stay open). All four
alternatives exist as pluggable adapter stubs and are EXERCISED in tests (AUTH-01: ALT-1 window;
AUTH-02: ALT-3 rule-bound incl. per-tx rule cap + circuit breaker; AUTH-03: ALT-4 attestation freshness;
ALT-2 approval-per-issuance is the default exercised by every default-machine test). **NO ALTERNATIVE IS
SELECTED — D-13.27 REMAINS OPEN**; the ALT-2 default exists FOR TESTING ONLY and is labeled as such in the
module constants and in every authorization record.

**Open implementation decisions (encoded as TODO-decision constants, asserted by INV-05):**

| Decision | Status | Spec refs |
|---|---|---|
| DEC-SETTLEMENT-TIMING (when must finality arrive; held-vs-refunded handling) | OPEN | D-13.27; spec §6.1, §6.3, §6.6 CONFIRMATION_TIMEOUT |
| DEC-REVERSAL-SEMANTICS (what a post-issuance reversal means: re-mint? claw-back? adjudication?) | OPEN | D-13.27; spec §6.3, §6.5, §6.6 RECONCILE_MISMATCH, §14.4 step 12 |
| DEC-FAILURE-RECOVERY (auto-refund timing, retry policy, compensation authority) | OPEN | D-13.27; spec §6.3, §6.6; issuance-burn-and-market-mechanism-spec.md §2.8 |
| DEC-ISSUANCE-TRANSACTION-BOUNDARIES (atomicity across settlement/issuance systems) | OPEN | D-13.27; spec §14.4 hard rules, §6.6; finality-before-mint L6 (vocabulary reference) |

Additional OPEN items demonstrated and labeled in-code (not decided): the EMERGENCY-depeg fail-closed
interpretation (ISS-07-11; D-13.19), the ILLUSTRATIVE fee rate 0.10% flat (D-13.8), the ILLUSTRATIVE quote
2.000000 TU/token and 15-minute TTL (spec §14.5/D-13.19), and the ILLUSTRATIVE supply caps (D-13.6 numbers
deferred).

---

## TESTED

- **Runs (fresh, from the repository root, `bun 1.3.14`; all four recorded in `run-log.txt`):**
  - RUN 1 — 2026-10-22T22:17:54Z UTC — command: `bun run audit-work/task13/evidence/issuance-state-machine/run-issuance-e2e.ts` — **123 PASS / 0 FAIL — exit code 0**
  - RUN 2 — 2026-10-22T22:17:58Z UTC — same command — **123 PASS / 0 FAIL — exit code 0**
  - RUN 3 (verification re-run) — 2026-10-22T22:23:22Z UTC — same command — **123 PASS / 0 FAIL — exit code 0** (actual process exit code observed: 0)
  - RUN 4 (verification re-run) — 2026-10-22T22:23:28Z UTC — same command — **123 PASS / 0 FAIL — exit code 0** (actual process exit code observed: 0)
  - All four runs' assertion outcomes are byte-identical (deterministic: fixed simulated clocks, no wall-clock inputs to the machine, BigInt-exact money math). `results-issuance-e2e.json` holds the latest run's full per-assertion record; the per-assertion table below is unchanged across all runs.
- **Nothing was weakened to obtain these results.** During development, 17 assertion-side and machine-side defects were found and FIXED (not deleted): step-result `ok` semantics for terminal-failure transitions; a missing AUTHORIZED→SUPPLY_CAP_EXCEEDED table entry; a refund-queue gate; the f1 in-flight clock ordering; two reason-code string comparisons; a duplicated assertion id; a CBDC-02 double-initiation harness bug. Every mandated behavior is asserted positively.
- **Environment verification battery (fresh, after RUN 3/RUN 4, 2026-10-22T22:2x UTC):** `bun run lint` PASS (exit 0) · `bun test` **37 pass / 0 fail** (exit 0 — no file named `*.test.ts` was created; the prototype runner is not part of the bun-test suite) · `bun run security:scan` PASS — worktree 2,242 files, 14 suppressed (allowlist untouched), **0 findings** (a targeted scan of this evidence directory also PASSES; no 64-char hex literals exist anywhere in these files; the scanner allowlist was NOT touched) · `bun run check:no-neon` PASS (45 routes, unaffected).
- **Typecheck honesty note:** `bun run typecheck` currently reports 23 pre-existing errors, ALL in `audit-work/task13/evidence/dynamic-replacement/*` (a PARALLEL task's new files — `constituency-lifecycle.ts` 19, `make-inputs.ts` 1, `run-dynamic-replacement-e2e.ts` 3; count grew from 20 to 23 as that parallel task continued adding files — none of them are this task's). Those files are outside this task's permitted write scope and were NOT touched. This task's files introduce **zero** typecheck errors (re-verified by fresh per-file census after the verification runs: `issuance-state-machine/*` errors = 0).

**Per-assertion table (123 assertions — from the recorded run):**

| ID | Assertion | Result | Observed |
|---|---|---|---|
| REG-01 | CBDC row admission BLOCKED while NOT CONNECTED (spec §5.3/§4: verified interface + end-to-end test required — neither exists) | PASS | reasonCode=ADMISSION_BLOCKED_NOT_CONNECTED — spec §5.3/§4: a NOT_CONNECTED row may become APPROVED only via… |
| REG-02 | same code on another network (TEST-STBL-002) is NOT auto-approved by TEST-STBL-001 (per-instance identity, spec §14.2 rule (a)) | PASS | state=PROPOSED, version=1 |
| REG-03 | reinstatement BLOCKED without the 48h observation period (spec §5 analog; PROPOSED 48h mirrors V3 RECOVERY_CONFIRMATION_PERIOD, UNDEPLOYED) | PASS | reasonCode=REINSTATEMENT_BLOCKED_OBSERVATION_PERIOD — 24h < PROPOSED 48h (spec §5; V3 RECOVERY_CONFIRMATION… |
| REG-04 | registry row schema carries NO weighting/eligibility/basket telemetry fields (spec §2 structural separation) | PASS | offendingKeys=[] |
| ISS-01-01 | supply before issuance | PASS | 0.000000 |
| ISS-01-02 | quote record carries quote id, price basis, expiry, quote-unit conversion, spread disclosure, fee line item (spec §6.1) | PASS | quote QUOTE-ISS-01-R1: gross 10000.000000 TEST-USDC-X → 10000.000000 TU @ conversion 1.000000; issuance quo… |
| ISS-01-03 | final state RECONCILED (steps 1..11 complete) | PASS | RECONCILED |
| ISS-01-04 | fee = 0.10% of gross 10000.000000 TU (EXACT integer math; ILLUSTRATIVE — D-13.8 OPEN) | PASS | 10.000000 |
| ISS-01-05 | net = gross − fee (step 8) | PASS | 9990.000000 |
| ISS-01-06 | issued = net ÷ quote = 9990.000000 / 2.000000 (spec §14.5 general form; quote policy ILLUSTRATIVE) | PASS | 4995.000000 |
| ISS-01-07 | idempotent mint record created (nonce, idempotency key, LEDGER-RECORD-ONLY label) | PASS | mintId=MINT-ISS-01-R1, nonce=1, idemKey=IDK-ISS-01-R1, label=LEDGER RECORD ONLY — NO ON-CHAIN ACTION (non-p… |
| ISS-01-08 | supply after issuance (before → after: 0.000000 → 4995.000000) | PASS | 4995.000000 |
| ISS-01-09 | tranche consumption after issuance | PASS | 4995.000000 |
| ISS-01-10 | fee ledger total (fees booked, not retained on failures) | PASS | 10.000000 |
| ISS-01-11 | audit log records the §14.4 step sequence in order (steps 1+3, 2, 4, 4a, 4b, 5, 7, 6+8, 9, 9b, 10, 11; step 12 = this publication) | PASS | REQUEST_CREATED,QUOTED,PAYMENT_OBSERVED,PAYMENT_AUTHENTIC,SETTLEMENT_FINAL,INSTRUMENT_CHECKED,FEES_CALCULAT… |
| ISS-01-12 | audit publication carries a synthetic publication tag (TEST-TAG-<16 hex>, never a 64-char literal) + every entry has a reason code | PASS | publicationTag=TEST-TAG-149fe74e4adabc10, entries=13 |
| ISS-01-13 | three-book equality holds after the happy path (C1–C4 all PASS) | PASS | ["C1_TOKEN_BOOK_EQUALS_TOTAL_SUPPLY=PASS","C2_ISSUANCE_BOOK_LINKS_TOKEN_BOOK_1TO1=PASS","C3_VALUE_CONSERVAT… |
| ISS-01-14 | machine-level invariants hold after the happy path | PASS | assertInvariants() passed |
| ISS-02-01 | first issuance completes (RECONCILED) and mints 4995.000000 | PASS | 4995.000000 |
| ISS-02-02 | second submission under the SAME idempotency key → DUPLICATE terminal; original result returned, never a second execution (spec §6.4) | PASS | state=DUPLICATE, duplicateOf=ISS-02-R1, reason=DUPLICATE_KEY_COLLISION — same idempotency key with a DIFFER… |
| ISS-02-03 | same payment txId under a new key → DUPLICATE terminal (DUPLICATE_PAYMENT_TX); never a second execution | PASS | submission=REQUEST_CREATED; observe=DUPLICATE (DUPLICATE_PAYMENT_TX) |
| ISS-02-04 | supply UNCHANGED after duplicate attempts (no double mint) | PASS | 4995.000000 |
| ISS-02-05 | exactly ONE mint record exists | PASS | 1 |
| ISS-02-06 | machine-level invariants hold (INV-C: replays never double-mint) | PASS | assertInvariants() passed |
| ISS-03-01 | late settlement → EXPIRED_QUOTE terminal; NO issuance at a stale quote (spec §6.1 hard-reject; §6.6 CONFIRMATION_TIMEOUT analog) | PASS | state=EXPIRED_QUOTE, reason=QUOTE_EXPIRED_BEFORE_FINALITY |
| ISS-03-02 | payment HELD_IN_REFUND_QUEUE (held-or-refunded choice LABELED; DEC-SETTLEMENT-TIMING OPEN per D-13.27/spec §6.3) with the SAME idempotency key | PASS | refunds=["RFND-ISS-03-R1:PENDING_REFUND:key=IDK-ISS-03-R1"] |
| ISS-03-03 | refund state machine completes PENDING_REFUND → REFUNDED (spec §6.3) | PASS | processed=1 |
| ISS-03-04 | retry FORBIDDEN on the same idempotency key (spec §6.6 CONFIRMATION_TIMEOUT) → DUPLICATE | PASS | state=DUPLICATE, reason=DUPLICATE_KEY_COLLISION — same idempotency key with a DIFFERENT payload: second sub… |
| ISS-03-05 | supply UNCHANGED (no mint on a stale quote) | PASS | 0.000000 |
| ISS-03-06 | settlement-timing is encoded as an OPEN decision (DEC-SETTLEMENT-TIMING references D-13.27 + spec §6.1/§6.3/§6.6) | PASS | D-13.27/spec §6.1 (quote expiry — hard-rejected after expiry)/spec §6.6 CONFIRMATION_TIMEOUT/spec §6.3 |
| ISS-04-01 | FAILED settlement → PAYMENT_FAILED terminal; a failed payment NEVER mints (spec §14.4 hard rules) | PASS | state=PAYMENT_FAILED, reason=SETTLEMENT_STATUS_FAILED |
| ISS-04-02 | issuance attempt on a failed payment → transition REJECTED by the state machine (cannot skip to ISSUED) | PASS | reason=TRANSITION_REJECTED_PAYMENT_FAILED_TO_ISSUED |
| ISS-04-03 | supply UNCHANGED | PASS | 0.000000 |
| ISS-04-04 | NO fee retained on a failed transaction (fee ledger 0.000000; spec §6.3 PROPOSED D-13.8) | PASS | 0.000000 |
| ISS-04-05 | auto-refund queued with the same idempotency key (spec §6.3) | PASS | refunds=1, reason=PAYMENT_FAILED |
| ISS-05-01 | (a) reversal BEFORE issuance → PAYMENT_REVERSED terminal; NO mint; refund queued | PASS | state=PAYMENT_REVERSED, refunds=1 |
| ISS-05-02 | (a) supply UNCHANGED | PASS | 0.000000 |
| ISS-05-03 | (b) second issuance completes first (RECONCILED; 4995.000000 minted) | PASS | 4995.000000 |
| ISS-05-04 | (b) reversal AFTER issuance → RECONCILIATION_BREAK (spec §6.5/§6.6) — pipeline SUSPENDED, NO silent re-mint, NO silent write-off | PASS | state=RECONCILIATION_BREAK, pipelineSuspended=true, reasons=["REVERSAL_AFTER_ISSUANCE:ISS-05-R2"] |
| ISS-05-05 | (b) mint record PRESERVED after the reversal (no silent write-off) | PASS | mintId=MINT-ISS-05-R2, amount=4995.000000 (still on the token book) |
| ISS-05-06 | (b) supply unchanged by the reversal event (no re-mint) | PASS | 4995.000000 |
| ISS-05-07 | (b) OPEN exception queued with taxonomy REVERSAL_AFTER_ISSUANCE | PASS | exceptions=["EXC-ISS-05-R2-REVPOST:REVERSAL_AFTER_ISSUANCE:OPEN"] |
| ISS-05-08 | (b) pipeline SUSPENDED blocks NEW requests fail-closed while the exception is OPEN | PASS | reason=PIPELINE_SUSPENDED_FAIL_CLOSED |
| ISS-05-09 | (b) reversal semantics encoded as an OPEN decision (DEC-REVERSAL-SEMANTICS references D-13.27 + spec §6.3/§6.5/§6.6) | PASS | true |
| ISS-06-01 | payment fully settled + net accepted, but NO authorization record exists after payment processing (a payment event alone can NEVER create one) | PASS | state=NET_ACCEPTED, settlementFinal=true, hasAuthorization=false |
| ISS-06-03 | direct issue() attempt from NET_ACCEPTED → transition REJECTED (explicit table; no skipping authorization) | PASS | reason=TRANSITION_REJECTED_NET_ACCEPTED_TO_ISSUED |
| ISS-06-02 | authorize() without an approval record → UNAUTHORIZED terminal (NO_AUTHORIZATION_RECORD; ALT-2 default FOR TESTING ONLY) | PASS | state=UNAUTHORIZED, reason=NO_AUTHORIZATION_RECORD — a payment event alone can NEVER create one (ALT-2, D-1… |
| ISS-06-04 | bypass-attempt harness (table skipped) → machine INVARIANT THROWS: no ISSUED without settlement finality + authorization record (INV-A hard guard) | PASS | threw=true, message=INV-A: bypass attempt blocked — no settlement finality + explicit authorization record … |
| ISS-06-05 | supply UNCHANGED | PASS | 0.000000 |
| ISS-06-06 | no ISSUED transition exists anywhere in the audit log for this request | PASS | ISSUED-transitions for ISS-06-R1: 0 |
| ISS-06-07 | a second bypass probe (unknown request) is trivially blocked (harness is fail-safe) | PASS | threw=true |
| ISS-07-01 | (a) instrument NOT in registry → INVALID_INSTRUMENT at quote (per-instance lookup, never a ticker alone) | PASS | state=INVALID_INSTRUMENT, reason=INSTRUMENT_NOT_IN_REGISTRY |
| ISS-07-02 | (a) supply UNCHANGED | PASS | 0.000000 |
| ISS-07-03 | (b) REVOKED instrument (TEST-USDC-Y) → INVALID_INSTRUMENT; quoting refused | PASS | state=INVALID_INSTRUMENT, reason=INSTRUMENT_REVOKED |
| ISS-07-04 | (c) same code on TEST-CHAIN-2 (PROPOSED instance) → INVALID_INSTRUMENT (per-instance identity, spec §14.2 rule (a)) | PASS | state=INVALID_INSTRUMENT, reason=INSTRUMENT_NOT_APPROVED_PER_INSTANCE_IDENTITY |
| ISS-07-05 | (d) failed authenticity tag → INVALID_PAYMENT (AUTH_TAG_MISMATCH); synthetic scheme documented: production requires real per-rail signature verification | PASS | state=INVALID_PAYMENT, reason=AUTH_TAG_MISMATCH |
| ISS-07-06 | (e) settled amount ≠ quoted amount → INVALID_PAYMENT (SETTLED_AMOUNT_QUOTE_MISMATCH; spec §6.6 PARTIAL_SETTLEMENT analog) | PASS | state=INVALID_PAYMENT, reason=SETTLED_AMOUNT_QUOTE_MISMATCH |
| ISS-07-07 | (e) difference HELD in the exception queue and DISCLOSED — no silent write-off | PASS | exceptions=["EXC-ISS-07e-R1-PARTIAL:PARTIAL_SETTLEMENT"] |
| ISS-07-08 | (e) supply UNCHANGED | PASS | 0.000000 |
| ISS-07-09 | (f1) depeg SUSPEND band at settlement time moves the registry row to SUSPENDED (spec §4/§5) AND the in-flight settlement COMPLETES under its existing quote (spec §4 in-flight rule) | PASS | settlement=SETTLEMENT_FINAL, check=INSTRUMENT_CHECKED, rowState=SUSPENDED, instance=RECONCILED, disclosure=… |
| ISS-07-10 | (f1) NEW quotes are REFUSED while the instrument is SUSPENDED (spec §4) | PASS | quote attempt: INVALID_INSTRUMENT (INSTRUMENT_SUSPENDED_NO_QUOTES) |
| ISS-07-11 | (f2) depeg EMERGENCY band at settlement time → INVALID_INSTRUMENT (DEPEG_EMERGENCY_FAIL_CLOSED — PROPOSED interpretation, decision OPEN) | PASS | settlement=SETTLEMENT_FINAL, checkState=INVALID_INSTRUMENT, reason=DEPEG_EMERGENCY_FAIL_CLOSED |
| ISS-07-12 | (f2) supply UNCHANGED (fail-closed) | PASS | 0.000000 |
| ISS-08-01 | (a) tranche cap exceeded → SUPPLY_CAP_EXCEEDED (TRANCHE_CAP_EXCEEDED); prospective 499500.499500 > tranche 400000.000000 | PASS | state=SUPPLY_CAP_EXCEEDED, reason=TRANCHE_CAP_EXCEEDED |
| ISS-08-02 | (a) supply UNCHANGED (no issuance past a cap) | PASS | 0.000000 |
| ISS-08-03 | (b) per-transaction cap exceeded → SUPPLY_CAP_EXCEEDED (PER_TX_CAP_EXCEEDED); prospective 500499.999000 > per-tx 500000.000000 | PASS | state=SUPPLY_CAP_EXCEEDED, reason=PER_TX_CAP_EXCEEDED |
| ISS-08-04 | (c) first issuance OK under a 5,000.000000-token global max | PASS | 4995.000000 |
| ISS-08-05 | (c) global max supply respected → SUPPLY_CAP_EXCEEDED (GLOBAL_MAX_SUPPLY_EXCEEDED) | PASS | state=SUPPLY_CAP_EXCEEDED, reason=GLOBAL_MAX_SUPPLY_EXCEEDED |
| ISS-08-06 | (c) supply unchanged by the capped attempt (still 4995.000000 ≤ 5000.000000) | PASS | 4995.000000 |
| ISS-08-07 | (c) authorization PRECEDED the supply check (§14.4 step 9 before 9b): the failed instance passed through AUTHORIZED | PASS | AUTHORIZED transition logged before SUPPLY_CAP_EXCEEDED for ISS-08c-R2 |
| ISS-09-01 | replay of a completed request id DETECTED → original result returned, NO second execution (spec §6.4) | PASS | replayDetected=true, created=false, originalOutcomeRef=ISS-09-R1 |
| ISS-09-02 | replayed request cannot continue: quote and new-payment observation both REJECTED on the completed instance | PASS | generateQuote=STEP_REJECTED_STATE_RECONCILED; observePayment=STEP_REJECTED_STATE_RECONCILED |
| ISS-09-03 | instance count UNCHANGED (replay created no new pipeline instance) | PASS | 1 |
| ISS-09-04 | supply UNCHANGED after the replay attempt | PASS | 4995.000000 |
| ISS-09-05 | exactly ONE mint record | PASS | 1 |
| ISS-10-01 | (a) three-book equality after the happy path (payment book = issuance book = token book + fee ledger) | PASS | ["C1_TOKEN_BOOK_EQUALS_TOTAL_SUPPLY=PASS","C2_ISSUANCE_BOOK_LINKS_TOKEN_BOOK_1TO1=PASS","C3_VALUE_CONSERVAT… |
| ISS-10-02 | (a) book totals agree (token Σ = total supply = issued; fee ledger = fee line item) | PASS | {"paymentBookSettledCount":"1","issuanceRecordCount":"1","tokenBookSum":"4995.000000","totalSupply":"4995.0… |
| ISS-10-03 | (b) forced ledger break (payment book net altered by 0.000001) is DETECTED — C3 value-conservation check FAILS | PASS | ["C1_TOKEN_BOOK_EQUALS_TOTAL_SUPPLY=PASS","C2_ISSUANCE_BOOK_LINKS_TOKEN_BOOK_1TO1=PASS","C3_VALUE_CONSERVAT… |
| ISS-10-04 | (b) machine reconcile() routes the break to RECONCILIATION_BREAK + pipeline SUSPENDED + exception queued (fail-closed) | PASS | state=RECONCILIATION_BREAK, suspended=true, exceptions=1 |
| ISS-10-05 | (b) mint record PRESERVED (no silent write-off) | PASS | 4995.000000 |
| AUTH-01-01 | ALT-1: payment settled OUTSIDE any authorized window → UNAUTHORIZED (NO_ACTIVE_ISSUANCE_WINDOW); payments outside a window NEVER mint | PASS | state=UNAUTHORIZED, reason=NO_ACTIVE_ISSUANCE_WINDOW — payments outside any authorized window NEVER mint (A… |
| AUTH-01-02 | ALT-1: payment settled INSIDE an authorized window → AUTHORIZED with window scope evidence; issuance completes to RECONCILED | PASS | final=RECONCILED, scope=explicit authorization record AUTH-AUTH-01-R2 created under model ALT-1 (scope: win… |
| AUTH-01-03 | ALT-1: window tranche consumed by the in-window issuance (governed act recorded, NOT a payment event) | PASS | consumed recorded |
| AUTH-02-01 | ALT-3: NO bound rule exists → UNAUTHORIZED (NO_BOUND_RULE) | PASS | state=UNAUTHORIZED, reason=NO_BOUND_RULE — no pre-authorized program exists ⇒ no authorization (ALT-3) |
| AUTH-02-02 | ALT-3: issuance EXCEEDING the bound rule's per-transaction cap → UNAUTHORIZED (PER_TX_RULE_CAP_EXCEEDED — fail-closed rule caps precede issuance) | PASS | state=UNAUTHORIZED, reason=PER_TX_RULE_CAP_EXCEEDED (ALT-3, fail-closed) |
| AUTH-02-03 | ALT-3: a small issuance within the rule caps → AUTHORIZED (fail-closed caps respected) | PASS | state=AUTHORIZED, reason=ISSUANCE_AUTHORIZED |
| AUTH-02-04 | ALT-3: rule-bound issuance reaches RECONCILED (4.999500 tokens) | PASS | state=RECONCILED |
| AUTH-02-05 | ALT-3: circuit breaker ARMED → UNAUTHORIZED (fail-closed) | PASS | state=UNAUTHORIZED, reason=CIRCUIT_BREAKER_ARMED — fail-closed (ALT-3) |
| AUTH-03-01 | ALT-4: NO attestation → UNAUTHORIZED (NO_ATTESTATION) | PASS | state=UNAUTHORIZED, reason=NO_ATTESTATION — hybrid program requires a fresh attestation (ALT-4) |
| AUTH-03-02 | ALT-4: FRESH matching attestation → AUTHORIZED; issuance completes | PASS | state=AUTHORIZED, reason=ISSUANCE_AUTHORIZED |
| AUTH-03-03 | ALT-4: hybrid issuance reaches RECONCILED | PASS | state=RECONCILED |
| AUTH-03-04 | ALT-4: STALE attestation → UNAUTHORIZED (STALE_ATTESTATION) — issuance suspension pending fresh attestation | PASS | state=UNAUTHORIZED, reason=STALE_ATTESTATION — issuance suspended pending fresh governance attestation (ALT-4) |
| AUTH-00 | D-13.27 framing: NO alternative is selected; status string is explicit; all four stubs exist | PASS | OPEN — NO ALTERNATIVE IS SELECTED. ALT-1 (authorized-issuance window) · ALT-2 (a |
| CBDC-01-01 | (a) normal path: CBDC quotes REFUSED while NOT CONNECTED (spec §6.2 absent interface ⇒ no quotes; spec §4 admission requires a verified authorized interface + end-to-end test — NEITHER EXISTS) | PASS | state=INVALID_INSTRUMENT, reason=CBDC_NOT_CONNECTED_NO_QUOTES |
| CBDC-01-02 | (b) adapter status asserted | PASS | SIMULATED / NOT CONNECTED |
| CBDC-01-03 | (b) adapter status is the literal SIMULATED / NOT CONNECTED | PASS | SIMULATED / NOT CONNECTED |
| CBDC-01-04 | (b) every simulated message carries simulation:true + the SIMULATED — NOT CONNECTED marker | PASS | simulation=true, marker=SIMULATED — NOT CONNECTED, status=INITIATED |
| CBDC-01-05 | (b) SIMULATION-MODE quote generated for the simulated CBDC descriptor (labeled) | PASS | state=QUOTED |
| CBDC-01-06 | (b) VERIFIED message labeled | PASS | status=VERIFIED, simulation=true |
| CBDC-01-07 | (b) SETTLED message carries txId + status + finality-at timestamp (§7.4 concern 7 simulated finality signal) | PASS | txId=CBDC-SIM-TX-001, status=SETTLED, finalityAtMs=0 |
| CBDC-01-08 | (b) machine accepts the simulated interface's finality signal IN SIMULATION MODE ONLY | PASS | state=SETTLEMENT_FINAL, reason=SETTLEMENT_FINALITY_CONFIRMED |
| CBDC-01-09 | (b) simulated messages drive the SAME machine end-to-end to RECONCILED (gross 5000.000000 → fee 5.000000 → net 4995.000000 → issued 2497.500000) | PASS | issued=2497.500000, state=RECONCILED |
| CBDC-01-10 | (b) registry UNCHANGED by the simulation run: the CBDC row is still PROPOSED / NOT_CONNECTED (the demo is NOT an integration and admits nothing) | PASS | registry snapshot byte-identical: true |
| CBDC-01-11 | (b) real-adapter gate (spec §14.3) UNMET: no authorized interface verified, no end-to-end integration test, no admission-dossier annex | PASS | {"authorizedInterfaceVerified":false,"endToEndIntegrationTested":false,"admissionDossierAnnexExists":false,… |
| CBDC-02-01 | duplicate txId initiation PREVENTED at the adapter (§7.4 concern 6: duplicatePrevented flag + FAILED status) | PASS | duplicatePrevented=true, status=FAILED, reason=DUPLICATE_TX_ID_PREVENTED (§7.4 concern 6) |
| CBDC-02-02 | duplicate txId PREVENTED at the machine: second request observing the same txId → DUPLICATE terminal; no double mint | PASS | state=DUPLICATE, reason=DUPLICATE_PAYMENT_TX |
| CBDC-02-03 | supply UNCHANGED by the duplicate (exactly one 2497.500000 mint) | PASS | 2497.500000 |
| CBDC-03-01 | REVERSED simulated message handled to the correct terminal state: PAYMENT_REVERSED (pre-issuance); no mint | PASS | state=PAYMENT_REVERSED, reason=REVERSAL_BEFORE_ISSUANCE |
| CBDC-03-02 | supply UNCHANGED after the reversal | PASS | 0.000000 |
| CBDC-04-01 | TIMEOUT simulated message handled to the correct terminal state: PAYMENT_FAILED with CONFIRMATION_TIMEOUT taxonomy; refund queued | PASS | state=PAYMENT_FAILED, taxonomy=CONFIRMATION_TIMEOUT |
| CBDC-04-02 | retry on the same idempotency key after TIMEOUT → DUPLICATE (retry forbidden, spec §6.6 CONFIRMATION_TIMEOUT) | PASS | state=DUPLICATE, reason=DUPLICATE_KEY_COLLISION — same idempotency key with a DIFFERENT payload: second sub… |
| CBDC-04-03 | supply UNCHANGED after the timeout | PASS | 0.000000 |
| CBDC-04-04 | adapter honesty record documents all nine §7.4 concerns + six honest limitations | PASS | 9 concerns / 6 limitations |
| SEP-01-01 | basket/constituency state object byte-identical before vs after several issuances (payment volume never enters weights/eligibility) | PASS | {"methodologyVersion":"TEST-SNAPSHOT-V1","constituency":["USD","EUR","JPY","GOLD"],"weightsPct":{"USD":40,"… |
| SEP-01-02 | all three issuances reached RECONCILED (the basket stayed untouched while issuance volume varied 25×) | PASS | RECONCILED,RECONCILED,RECONCILED |
| SEP-01-03 | registry honesty snapshot unchanged by payment volume (no auto-disable, no auto-approve, no weight telemetry) | PASS | {"label":"NON-PRODUCTION PROTOTYPE of payment-instrument-registry-and-settlement-spec.md §3–§5 (spec STATUS… |
| SEP-01-04 | issuance event log contains NO basket/weight/eligibility fields (structural test-of-absence at the data level) | PASS | suspicious tokens present: false |
| SEP-01-05 | three issuances completed; supply = 499.500000 + 12487.500000 + 3746.250000 | PASS | 16733.250000 |
| INV-01 | INV-A: no ISSUED/RECONCILED/RECONCILIATION_BREAK instance exists without settlement finality + an explicit authorization record (payment alone NEVER mints) | PASS | assertInvariants() passed on all 29 machines |
| INV-02 | INV-B: failed/unverified payments never mint; every minted issuance carries a real authorization record at the book level | PASS | failure-terminal transitions observed: 28; total mint records: 16; book-level authorization sweep passed |
| INV-03 | INV-C: replays never double-mint — supply equals Σ mint records on every un-suspended machine (suspended machines carry OPEN exceptions instead) | PASS | all 29 machines swept |
| INV-04 | INV-D: reversal-after-issuance / forced-break machines are SUSPENDED with reasons + OPEN exceptions; mint records preserved (no silent re-mint, no silent write-off) | PASS | suspended machines: ["M-ISS-05:REVERSAL_AFTER_ISSUANCE:ISS-05-R2","M-ISS-10b:RECONCILIATION_BREAK:ISS-10b-R1"] |
| INV-05 | INV-E: all four OPEN implementation decisions encoded (settlement timing, reversal semantics, failure recovery, issuance transaction boundaries) | PASS | DEC-SETTLEMENT-TIMING:open=true, DEC-REVERSAL-SEMANTICS:open=true, DEC-FAILURE-RECOVERY:open=true, DEC-ISSU… |


---

## Honest status

- **Both pathways are NON-PRODUCTION PROTOTYPES. Neither is operational.**
- **Stablecoin pathway:** evidenced ONLY against the synthetic APPROVED TEST instrument TEST-USDC-X with a
  deterministic simulated settlement rail and a clearly-labeled synthetic in-process authenticity scheme.
  No real stablecoin, issuer, network, oracle, or bank rail is integrated, tested, or claimed. Production
  authenticity requires real per-rail signature verification (spec §6.2) — none exists here.
- **CBDC pathway: `SIMULATED / NOT CONNECTED`.** No issuing authority, no authorized technical interface, no
  institutional connection, no end-to-end integration exists; the spec §14.3 admission-dossier annex does not
  exist for any CBDC; the real-adapter gate is unmet on all axes. The simulated adapter exists ONLY so the
  state machine can be exercised with labeled simulated messages until an actual authorized interface is
  available (mandate verbatim). The CBDC demonstration did NOT admit, connect, or change the status of any
  registry row (asserted byte-identical before/after).
- **D-13.27 REMAINS OPEN** — no authorization-model alternative is selected by this prototype, its tests, or
  this record. D-13.6/D-13.8/D-13.19 parameters remain unapproved; every number is ILLUSTRATIVE.
- **No gate advanced; no release control granted; production authorization FALSE; NOT ACCEPTED.**
- Nothing in this record claims capability beyond the assertions above, and nothing here is acceptance
  evidence (tests/typecheck/docs never advance gates — standing rule).

*TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED*
