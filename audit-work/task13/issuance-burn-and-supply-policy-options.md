# MTQΣ — Issuance, Burn & Supply-Policy Options (MANDATE-006 §16.6)

**Document ID:** MTQSIGMA-T13-SUPPLY-OPTS · **Date:** 22 October 2026
**Mandate:** MTQSIGMA-COO-MANDATE-006 §9 (Supply, issuance, burning, and accounting integrity) · §8.2 (Redemption as an explicit policy decision, alternatives for owner review) · §7.7 (reconciliation with the no-automatic-minting policy) · §16.6
**Companion specifications:** `issuance-burn-and-market-mechanism-spec.md` (deliverable 7 — the operation-by-operation mechanism spec, PROPOSED) · `payment-instrument-registry-and-settlement-spec.md` §14.6 (the D-13.27 alternatives from the payment side) · `economic-model-options.md` + `d13.3-d13.7-owner-decision-brief.md` (model + Gate-B wording). This document presents the **options and open decisions**; it selects nothing.
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**

---

## 1. The operations, defined independently (MANDATE-006 §9)

The mandate requires these operations to be specified **independently** — each with: authorization and permissions · amount calculation and fees · source of valuation · supply and balance invariants · replay prevention and idempotency · concurrent-request behavior · accounting entries and event records · failed-operation recovery · reconciliation and audit requirements.

| Operation | Mechanism-spec coverage (deliverable 7) | Current implementation status |
|---|---|---|
| Payment-funded primary issuance | §2.3 (issuance under the approved supply policy) + §2.7 | `SPECIFIED` (PROPOSED); `NOT IMPLEMENTED` for v3.0; deployed v1.2 = permissionless-with-USDC at admin-set prices (divergent legacy) |
| Secondary-market purchases and sales | §2.2 | `SPECIFIED` (PROPOSED); no project-operated market exists (D-13.21 OPEN) |
| Transfers | §2.6 | `SPECIFIED`; token transfers exist in the legacy deployed pilot only |
| Burning | §2.4 (self-burn vs redemption-burn vs policy-burn taxonomy, D-13.20) | `SPECIFIED` (PROPOSED); legacy Redeem contract escrows instead of burning (recorded divergence) |
| Redemption (if approved) | §2.5 (ONLY if a real, enforceable facility exists) | `SPECIFIED` conditionally — **no facility exists; none may be implied** (D-13.7 OPEN) |
| Refunds and failed transactions | §2.8 | `SPECIFIED` (PROPOSED) |
| Cross-chain transfers or representations | §2.6 + `cross-chain-supply-and-authority-review.md` | `SPECIFIED` (PROPOSED); **no cross-chain model exists today** (D-13.10 OPEN) |

**Per-operation field check (the nine mandated definitions):** deliverable 7 §2 gives each operation its own authorization/math/accounting/events/replay/idempotency/failure-recovery/reconciliation/limits treatment — coverage confirmed during reconciliation; the per-field × per-operation matrix is maintained there and is not duplicated here.

## 2. The cross-operation integrity rules (MANDATE-006 §9, verbatim effect)

1. **A reference-index rebalance must not automatically mint or burn tokens** unless an explicit, approved monetary rule requires it. (Under the candidate M1+M4 architecture, rebalancing is purely an index/methodology event — D-13.6 proposed wording clause (ii).)
2. **Payment volume must not automatically change basket weights** (separation invariant, `payment-instrument-registry-and-settlement-spec.md` §2; test-of-absence T-PAY-01 / V3M-SUP-2).
3. **Cross-chain representations must not create duplicate economic supply.** The canonical supply model and its invariants must be explicit — that model does not exist today and is decision **D-13.10** (single canonical supply / per-chain limits / lock-and-mint / burn-and-mint; each with adversarial duplicate-supply proofs required before any implementation).
4. **No live supply-policy change and no deployed-authority change is implemented by this mandate** — all of §1–§3 remain proposals; the deployed v1.2 estate is untouched pending D-13.22 and the Task 12 chain.

## 3. Supply-policy options (Gate B — D-13.6, OPEN; exact proposed wording in the Gate-B brief)

| Option | Properties | Dependencies / consequences |
|---|---|---|
| **(a) Fixed maximum supply with governed issuance** (proposed wording exists; **all numbers deferred**) | Predictable, auditable supply; no payment-coupled or rebalance-coupled minting; issuance only via defined authority + caps + timelocks + disclosure; numbers (cap, genesis allocation, schedule, authority config) = separate approval | Simplest credible story for a floating asset; wrong cap correctable only by visible governance act |
| **(b) Rule-governed elastic supply** | Governance-voted tranches; flexible | More complex to validate and defend; requires its own validation program |
| **(c) Authorized-issuer limits (caps + timelocks)** | Hybrid retaining issuer discretion under governance | Requires careful authority design (the legacy `MINTER_ROLE` is declared-but-unenforced — a live defect in any V2 descendant) |
| **(d) Supply undefined** | — | **Not viable:** issuance capacity is undefined once reserve mechanics are removed (PBC→ABC→DMCE was the only mechanism computing it) |

## 4. Payment-funded primary issuance vs no-automatic-minting — the reconciliation (§7.7 → **D-13.27 — REVISION 2, 2026-10-23: ADOPTED (DELEGATED) — PENDING OWNER RATIFICATION**; full adoption record with rationale: `payment-instrument-registry-and-settlement-spec.md` §14.6; the MANDATE-007 §2 revision text is preserved below)

*(Revision-1 text, 2026-10-22, preserved — its "still-open core" and "no alternative is selected here" framing is superseded by the REVISION 2 adoption paragraph below:)*

The mandate requires payment-funded issuance to be **a controlled, authorized operation — not uncontrolled minting whenever funds arrive** — and requires the developer to present precise alternatives instead of silently choosing. **MANDATE-007 §1/§2 (2026-10-22) correction:** the owner's requirement for stablecoin- and eligible-CBDC-funded primary issuance is now recorded as **established product direction** — the D-13.6 no-automatic-minting wording is an authorization safeguard governing the payment→issuance edge, not a prohibition of payment-funded issuance; the still-open core of D-13.27 is the authorization model plus the open implementation details (settlement timing, reversal semantics, failure recovery, issuance transaction boundaries). The four alternatives (ALT-1 authorized-issuance-window · ALT-2 approval-per-issuance · ALT-3 rule-bound programmatic issuance · ALT-4 hybrid with periodic attestation), their consistency with the D-13.6 wording, invariants, and update obligations are specified in full in the **revised** `payment-instrument-registry-and-settlement-spec.md` §14.6 (including the proposed 8-stage controlled issuance process: explicit issuance request → payment verification → settlement-finality checks → applicable authorization → approved pricing → fees → supply controls → reconciliation). **From the supply-operations side, the same decision binds:** under every alternative, issuance remains within the approved supply policy, the cap (if adopted), authorized permissions, and all validation controls; supply-limit checks are an explicit state-machine step (payment spec §14.4 step 9); and the D-13.6 wording and the supply spec must be updated together in the same decision record. No alternative is selected here. **Non-production prototype (MANDATE-007 §4):** the common invariants + 8-stage process are implemented as a state-machine prototype with ALT-1..4 pluggable stubs at `evidence/issuance-state-machine/` (123/123 assertions × 2 fresh runs, exit 0) — prototype evidence only; not a production implementation and not an approval.

**REVISION 2 — 2026-10-23 (delegated adoption; executive team under the owner delegation recorded in `owner-directive-2026-10-23-delegated-execution.md` §1–§2; full record with rationale in `payment-instrument-registry-and-settlement-spec.md` §14.6 REVISION 2).** The authorization model is adopted as **ALT-4 — hybrid + periodic attestation**: rule-bound programmatic issuance is permitted ONLY inside explicitly owner-authorized issuance programs (each program = a signed authorization record defining instrument(s), caps, windows, and rules; every ISSUED transition still requires an applicable authorization record — the payment-alone-never-mints invariant INV-A preserved unconditionally), combined with periodic independent attestation (periodic three-book reconciliation attested by the authorized attester; attestation failure suspends the pipeline fail-closed). **The D-13.6 exception clause is recorded verbatim in the same decision record:** "Programmatic issuance under ALT-4 is the single authorized exception to the payment-alone-never-mints rule ONLY within the exact envelope of a recorded, unrevoked authorization program; anything outside that envelope remains unauthorized." Adopted with it — **settlement timing: finality-before-issuance** (issuance only after settlement finality per the instrument registry's finality classes; finality after quote expiry → EXPIRED_QUOTE, held-or-refunded per §6.3); **reversal semantics:** pre-issuance reversal → the request cancels (no mint; terminal CANCELLED); post-issuance → RECONCILIATION_BREAK + pipeline SUSPENDED + fail-closed authorized remediation (three-book C1–C4 verified; no automatic re-mint/re-burn/adjustment); **failure recovery: fail-closed** (no partial states, no retry-without-record, no silent healing); **issuance transaction boundaries: one request = one payment = one authorization record = one mint record** (atomic, idempotent by request ID; no split mints); **D-13.8 fees / §14.5 quote policy: FORM adopted, VALUES remain UNAPPROVED economic parameters** (illustrative default 0.10%; D-13.8 production value remains OPEN). Each decision is labeled **ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION** — implementation direction only, NOT production economic authorization. From the supply-operations side the same bindings stand: issuance remains within the approved supply policy, the cap (if adopted), authorized permissions, and all validation controls; the D-13.6 record and this document were updated together with the adoption record. The production implementation of ALT-4 is a separate task gated on ratification + Gate B/E closures + the Task 12 authority chain + RELEASE-GRANTS; the prototype's ALT-2 default FOR TESTING ONLY label is immutable historical evidence. **Remains OPEN:** owner ratification; D-13.8 production fee value; §14.5 quote-derivation policy publication; CBDC admission dossiers; all production/economic authorizations.

## 5. Holder rights and redemption — alternatives for owner review (MANDATE-006 §8.2; D-13.7, OPEN)

Per the mandate, MTQΣ must not imply holders can exchange it for a basket, gold, stablecoins, or a fixed value unless the relevant legal, financial, and operational mechanism is specifically defined and approved. The alternatives, each with holder rights / issuer obligations / capital needs / failure conditions / legal questions / effect on the no-conventional-reserve objective (full treatments in `d13.3-d13.7-owner-decision-brief.md` §2 and `economic-model-options.md` §6–§8):

| Alternative | Holder rights | Issuer obligations | Capital needs | Failure conditions | No-reserve objective effect |
|---|---|---|---|---|---|
| **(a) No redemption promise** (proposed wording exists) | None — market exit only | None beyond honest publication | Index-publication funding only | Misrepresentation risk if any interface implies redeemability | Fully consistent — the advisory recommendation |
| **(b) Explicitly defined index-linked obligation** (M2 family) | Contractual cash-settlement claim vs obligor's hedge book | Enforceable terms, hedge book, disclosure | Obligor entity capital + licenses (do not exist) | Obligor insolvency/performance failure | Contradicts — obligor capital is a reserve by another name unless redesigned |
| **(c) Enforceable redemption facility** (M3 family) | Right to redeem at reference value | Real assets, custody, liquidity, counterparties, enforceable terms | Facility assets + run-sized stress capital | Facility runs → haircuts/suspension → holders | Directly contradicts — a conventional reserve returns |
| **(d) Another credible alternative** | As defined | As defined | As defined | As defined | To be assessed on proposal |

**Do not mark D-13.3 through D-13.7 approved until the owner explicitly selects the monetary definition, architecture family, stability objective, supply policy, and redemption policy** (MANDATE-006 §8.2). The deployed legacy estate must not be read as providing any of (a)–(d): the v1.2 pilot's redeem path pays from vault balances of test tokens — a testnet artifact, not a facility.

## 6. Honest status

| Item | Specified | Implemented | Tested | Owner-approved |
|---|---|---|---|---|
| Independent operation matrix (7 operations × 9 fields) | YES (deliverable 7) | NO (v3.0); legacy pilot diverges | NO | NO — Gates B/E open |
| No-rebalance-minting / no-payment-weights invariants | YES (as design rules + planned negative tests) | NO (nothing to implement yet) | NO (planned V3M-SUP-2) | NO |
| Cross-chain canonical supply model | NO — options only (D-13.10) | NO | NO | NO |
| Supply policy | YES (options + proposed wording) | NO | NO | NO — D-13.6 OPEN |
| Redemption policy | YES (alternatives + proposed wording) | NO — no facility exists | NO | NO — D-13.7 OPEN |
| Payment-issuance reconciliation | YES (D-13.27 REVISION 2, 2026-10-23: authorization model ALT-4 + the four sub-decisions **ADOPTED (DELEGATED) — PENDING OWNER RATIFICATION**; 8-stage controlled process unchanged and controlling; full record: payment spec §14.6 REVISION 2) | NON-PRODUCTION PROTOTYPE (evidence/issuance-state-machine/; production NO — the ALT-4 production implementation is a separate gated task; the prototype's ALT-2 default FOR TESTING ONLY label is immutable historical evidence) | PROTOTYPE E2E 123/123 × 2 fresh runs (evidence dir) | NO — adoption is delegated only, **PENDING OWNER RATIFICATION**; no gate advanced |
| Fee schedule + §14.5 quote policy (D-13.8 / payment spec §14.5) | YES — **FORM adopted (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION**: fee = a named policy parameter with recorded illustrative default 0.10%; quote = method-approved internal derivation + validity window | NO (no production fee machinery exists; the 0.10% figure exists only as the labeled ILLUSTRATIVE default + prototype exercise) | NO (prototype ISS-01 fee math only — ILLUSTRATIVE) | NO — **D-13.8 production VALUE remains OPEN**; no economic parameter production-approved |

**Standing rule:** no live supply-policy change, no deployed-authority change, no mint/burn/transfer anywhere in this mandate — implementation is gated on Gate B/E closures + the Task 12 authority chain + RELEASE-GRANTS.

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**
