# MTQΣ Years-Ahead Ecosystem Roadmap & Transparent Audit

**Document**: ECOSYSTEM-ROADMAP-YEARS-AHEAD.md (Task-43 deliverable)
**Author role**: combined COO + CTO + crypto-economics / blockchain / ecosystem expert mandate (owner directive 2026-11-05)
**Status**: STRATEGIC REGISTER — decision-support for the owner. Nothing in this document silently changes the platform; every item carries a classification and a gate.
**Classification vocabulary**: `IMPLEMENTABLE-NOW` (code-implementable at devnet/pilot scale, honest by construction) · `OWNER-GATED` (requires owner decision/credentials/ratification before any code) · `PRODUCTION-PATH` (requires the multi-host production network, not this single-process reference) · `RESEARCH-TRACK` (documented research direction — implementing a pretend version would violate the no-fake-features rule, so none is implemented).

---

## 0. Executive summary (COO voice)

MTQΣ's competitive position is not "another stablecoin" — it is an **institutional audit-first monetary-lab platform**: a purchasing-power-stable unit backed by a transparent FX+gold basket, with a sovereign reference devnet (genuine signed BFT rounds, on-chain governance with constitutional separation, dynamic validator membership, an on-chain fail-closed multi-family oracle, time-locked unbonding, SSE-live telemetry), a 33+ endpoint public API surface, and a decade of honest-status discipline that no competitor publishes. The platform's moat is **verified honesty under adversarial audit** — the one asset that cannot be forked.

The strategy that stays years ahead of every competitor is a three-layer flywheel:

1. **Prove mechanisms at reference scale NOW** (devnet demonstrates: BFT voting, V4 dynamic membership, fail-closed oracle consensus, unbonding economics, governance timelocks) — competitors' devnets demo token transfers; ours demos *monetary governance machinery*.
2. **Make every economic invention dual-gated** (owner ratification + on-chain vote, default OFF) — this is what regulators will read as institutional discipline, and what separates us from the 2017–2023 class of overclaiming DeFi.
3. **Publish the residual register openly** (what is NOT done, per input, per gate) — competitors hide their gaps; we publish ours with digests. This document is itself that discipline.

The single most important COO recommendation: **do not chase feature count; chase verifiable institutional-grade trust surfaces**. Every roadmap item below is filtered through that lens.

---

## 1. Current honest position (audit snapshot, verified this session)

**Integrity state (verified 2026-11-05, Task-43 pre-flight)**:
- Git: Tasks 29–42 all committed and present; `origin/main` = task42 `b648935`. One sandbox snapshot-regression incident detected and forensically remediated: the task42-built `/api/constituency/upload` route was lost from the working tree and captured by a platform auto-commit (`094c4e0`); restored byte-exact and E2E-re-verified (`verify-upload-path.ts` PASS). The disk-only backup layer (`mtq-sigma-backups/`) was wiped by the same event — a fresh hardened backup (git bundle + both DBs + SHA-256 manifest) was taken and the incident manifest is now git-tracked in two locations.
- Databases: `db/custom.db` (pilot monetary engine, 11 tables) and `db/chain.db` (sovereign devnet ledger, 11 tables) both `integrity_check: ok`, live, rows advancing. **No cloud database is wired in this environment** (only `DATABASE_URL`, local file) — the off-box third copy remains an owner action (Turso credentials object-storage replication after each task).

**Standing honest residuals (owner-side, unchanged by code)**:
1. Gate-C production ratification (lifecycle parameters D-13.11/D-13.14 are PILOT-APPROVED; production OPEN) — including the recorded L-gate calibration finding (θ=0.10 what-if tool now exists as decision support).
2. V4 Solidity registry contract: source-implemented, compiled, invariant-verified — **UNDEPLOYED** (Gate-C/Task-12-gated authority chain).
3. Production §17.10 three-family ON-CHAIN oracle (EVM adapters) — UNMET; the devnet reference module (Task-43) demonstrates the aggregation machinery only.
4. Network Economics Specification: DRAFT register D-NE-1..D-NE-10 all OPEN; block-reward engine implemented but DEFAULT OFF (dual-gate activation).
5. External validation gates: fatwa, counsel, penetration test, regulator engagement — all external, all open.
6. `FRED_API_KEY` unprovisioned (honest 503 degradation stands; no-key CSV fallback probed unreachable from this sandbox — negative finding recorded).
7. `MTQ_UPLOAD_TOKEN` unprovisioned (AREAER operator-upload path exists, fail-closed 403 until serviced).
8. Multi-host CometBFT production network (the single-process reference is honest about its co-located engines).

---

## 2. Competitive moat analysis (what wins, and for how long)

| Competitor class | Their ceiling | Where MTQΣ is structurally ahead |
| --- | --- | --- |
| Fiat-backed stablecoins (USDT/USDC class) | Opacity of reserves & attestation cadence; single-admin oracle; no monetary governance surface | Verifiable per-input feed provenance (§5.6 50/50 issuer split, live PAXG/XAUT market prices per token), digest-bound approval ledgers, fail-closed aggregation ON-CHAIN |
| Gold tokens (PAXG/XAUT class) | Off-chain PDF attestations; single-issuer custody risk | Basket-level purchasing-power target with on-chain price-event provenance; operator-serviced ingestion with sha256 digests; multi-family oracle machinery |
| Algorithmic/"hybrid" stablecoins (DAI/USDe class) | Governance captures monetary policy; oracle monocultures | **Constitutional separation IN CODE** — network governance cannot touch MTQ monetary territory (monetary-guard enforced at submission); oracle-parameter governance stays in the monetary track |
| L1 ecosystems with native stablecoins | Economic parameters set by foundation fiat, retro-fitted governance | Every economic invention dual-gated & default-OFF with published ratification registers; unbonding/rewards machinery specified *before* activation |
| "Audit-theater" platforms | One-time Big-4 letter, then drift | Standing 16-stage audit discipline with 10 deliverables, per-task evidence packs, honest-status everywhere, *this register* |

**Defensible lead estimate**: the honest-status + dual-gate + constitutional-separation stack is 3–5 years of institutional habit to replicate, because it is culture, not code. The reference-devnet machinery (BFT + V4 membership + oracle consensus + timelocks) is 1–2 years of focused engineering to replicate. Neither is forkable from this repo without also forking the discipline.

---

## 3. Years-Ahead Register (D-YA-1 .. D-YA-12)

Each item: recommendation → why it outcompetes → architecture sketch → classification → status/next action.

### D-YA-1 — On-chain multi-family oracle consensus (§17.10 reference) — ✅ IMPLEMENTED THIS TASK
- **Why it wins**: most stablecoin devnets have *no* on-chain price logic or a single-admin feed; a fail-closed median-of-family-medians with ≥2-family publication gate is Byzantine-robust *machinery* that regulators can read as a circuit-breaker design, not a promise.
- **Implemented**: `oracle_observe` tx type (validator-keyed, ACTIVE-only, one-per-block per observer/family/symbol), per-family median → cross-family median-of-medians, gates (≥2 families, ≤200 bp spread, ≤6-block freshness ≈30 s at production single-writer cadence), fail-closed retention on degradation, full event provenance, state-root commitment, `GET /api/chain/oracle`, NOC panel, smoke leg with positive+negative controls. Fault model documented in source (per-family <n/2 Byzantine; cross-family <f/2 colluded families).
- **Next**: production = Chainlink/Pyth/Chronicle EVM adapters via WIRING-1 (Gate-C). `PRODUCTION-PATH` beyond the reference.
- **Honest line**: reference devnet only; no automatic market feeds; operator-submitted test values.

### D-YA-2 — Deterministic on-chain proof-of-reserve attestations — `IMPLEMENTABLE-NOW` (next increment)
- **Recommendation**: publish a per-cadence merkle root of the custody inventory (the §5.6 sleeves) as a signed devnet tx; explorer renders root→leaf inclusion proofs against the existing custody inventory probe tooling.
- **Why it wins**: PAXG publishes monthly PDFs; an on-chain cadence with verifiable inclusion proofs is mechanically auditable by ANY third party without trusting the attester's website.
- **Sketch**: `reserve_attest` validator tx {cadence_root, inventory_digest} + explorer proof view; reuses `scripts/verify-custody-inventory.ts` discipline; publication preconditions wired to the §14 separation checks.
- **Gate**: no economic semantics — pure transparency surface → implementable without ratification (display layer must label cadence as devnet-paced).

### D-YA-3 — Emergency-state circuit breaker wired to oracle degradation — `IMPLEMENTABLE-NOW` (follow-on)
- **Recommendation**: when the oracle layer enters DEGRADED_SPREAD/STALE for a basket-relevant symbol, an honest emergency banner + (in simulation) mint/redeem pause proposal auto-queues behind the governance timelock — mirroring spec §17.7 (LKG values, redemption AVAILABLE) at the network layer.
- **Why it wins**: the 2023 USDC depeg cascade showed pause-semantics confusion is fatal; ours would be *specified, dual-gated, and demoed live* before mainnet.

### D-YA-4 — ZK reserve proofs (zkTLS attestation of exchange/custody accounts) — `RESEARCH-TRACK`
- **Recommendation**: research register only. zkTLS (re.Proof-style) attestations of custody account balances → on-chain verified nullifier roots.
- **Why honest labeling matters**: no zk circuit exists here; implementing a mock would be fake-feature theater. We publish the direction and the preconditions (audited circuits, witness availability, operator key ceremony) instead.
- **Estimated horizon**: 2–4 years to institutional-grade; early mover advantage is real but ONLY with audited circuits.

### D-YA-5 — Account-abstraction & session keys for institutional UX — `RESEARCH-TRACK` (EIP-4337 on production path)
- **Recommendation**: session-key delegated observation relays (validator operators submit oracle txs under policy-bounded burner keys) — the devnet wallet already proves keygen/import/sign flows; AA adds policy enforcement without custody transfer.
- **Why it wins**: operators today must hot-key validators to submit observations; session keys bound by policy (symbol whitelist, value bounds, expiry) make the relay role delegable — the difference between a demo and an operations model.

### D-YA-6 — Cross-chain canonical supply coordination (lockbox + domain committees) — `PRODUCTION-PATH`
- **Recommendation**: the three-book separation maps naturally to a canonical-supply lockbox with per-domain (EVM/Solana/devnet) emission windows; task13's cross-chain review already specifies the authority graph.
- **Next action**: owner decision on canonical domain ordering (the D-13 series), then the migration package ordering (Task-12 D4/D5 already authored).

### D-YA-7 — MEV-resistant issuance (batch-auction mint/redeem windows) — `RESEARCH-TRACK`
- **Recommendation**: replace first-come mint ordering with discrete transparent batch auctions at production scale; the issuance state machine (Task-13) already models the instrument registry and settlement legs the auction would clear.
- **Why it wins**: stablecoin primary-market MEV is an unpriced competitor weakness; an auctioned primary market with published clearing prices is an institutional first.

### D-YA-8 — Policy-rate corridor instrument (MARP/MASE governance) — `OWNER-GATED`
- **Recommendation**: the marp.ts corridor and MASE engine already compute the policy surface; publishing a *timelocked, digest-bound* policy-rate adjustment path (monetary track, NOT network governance) would make MTQΣ the first basket-stablecoin with a transparent monetary-policy reaction function.
- **Gate**: this is MTQ monetary governance territory — every parameter movement must go through the approval-ledger discipline (D-13 class) with owner signature; nothing here is network-votable, by constitutional design.

### D-YA-9 — Compliance-by-construction issuance gate — `IMPLEMENTABLE-NOW` (wiring exists; verify + surface)
- **Recommendation**: the sanctions screen and licensing matrix exist as libs; surface them as a pre-issuance *gate condition* in the issuance state machine UI (already partially wired via authorization.ts) and record gate outcomes in the audit trail.
- **Why it wins**: "compliance as a protocol precondition" beats "compliance as a policy PDF" — and it is honestly achievable at pilot scale.

### D-YA-10 — Decentralized sequencing / multi-host CometBFT — `PRODUCTION-PATH` (documented, NDD-1)
- Already decided: Cosmos SDK + CometBFT is the production path; the sandbox's process-reaping makes multi-host infeasible here (honest deviation record §2). No action at reference scale beyond keeping the state machine deterministic — which the state-root commitment enforces.

### D-YA-11 — Confidential institutional flows (shielded transfers) — `RESEARCH-TRACK`
- Direction only: nullifier-based shielded PMTQ transfers with compliance view keys. Precondition: audited ZK stack (shares D-YA-4's circuit dependency). No mock implementation permitted.

### D-YA-12 — "One console" institutional transparency terminal — `IMPLEMENTABLE-NOW` (continuous)
- **Recommendation**: keep pushing the NOC/Explorer/Validation surfaces toward Bloomberg-terminal-grade density with honest pills everywhere: SSE-live heights, per-input feed statuses, QC telemetry, unbonding countdowns, oracle family medians, evidence-package exports (trials/export + evidence-package already exist).
- **UI best-practices for THIS platform** (matching what already works): (a) every live number carries a provenance pill (LIVE / LIVE-UPLOADED / FIXTURE-FALLBACK / OFF); (b) every degradation is a visible amber/rose state, never a silent fallback; (c) mobile 390px clean is a standing gate; (d) WCAG-AA tone discipline; (e) empty states tell the truth ("no automatic feeds — observations arrive only via signed validator txs").

---

## 4. Best-practice architecture recommendations (standing)

1. **Fail-closed everywhere** (the oracle module this task is the template: gates retain last-good state and mark degradation visibly).
2. **Dual-gate economic activation** (owner ratification digest + on-chain vote; default OFF; NES-DRAFT is the pattern).
3. **Constitutional separation in code, not docs** (monetary-guard patterns reject network-gov intrusion at submission; keep the pattern list current with every new param surface).
4. **Forward-only change discipline** (code-version hot-upgrades for the reference node; git forward-only merges; snapshot-regression forensics on detection — this session's recovery is the worked example).
5. **Layer separation** (pilot Prisma store ∥ devnet raw-SQL ledger; oracle observations are network data, never monetary state).
6. **Backup durability rule** (bundles are disk-only and CAN be wiped by snapshot regressions — manifests must be git-tracked in two locations, and the off-box third copy is an owner action after every task).
7. **Verification battery as a gate, not a habit** (tsc · lint · secret-scan · check-no-neon · chain-smoke · verify-upload-path · browser E2E with zero console errors — every task, no exceptions).

---

## 5. Audit protocol (the honest-audit standing framework — point 6 of the directive)

Every task in this platform is audited under the same public contract:

- **Pre-flight**: git integrity vs last verified commit (`git diff <verified> HEAD --stat`), DB integrity_check on both stores, backup + SHA-256 manifest, session-open guard (this task caught the snapshot regression exactly this way).
- **During**: no silent error swallowing; FAILED receipts rendered visibly; honest-status strings verbatim in UI (spot-checked in browser E2E).
- **Post**: full battery + browser E2E at 1440×900 and 390×844 with zero console errors; worklog entry with evidence pointers; commit message = audit record; push only after green.
- **Standing rule**: every claim in this document is either verified in this session, or explicitly labeled with its gate. There is no third category.

---

## 6. This task's increment (Task-43 summary)

- Integrity: forensics + byte-exact forward recovery of the upload route; DB integrity ok ×2; hardened backup + dual-location tracked manifest.
- Implementation: D-YA-1 (on-chain multi-family oracle consensus) — chain layer (shared/store/state/mempool/node-v45/rpc), API route, NOC panel (subagent 2-b, tsc 0), devkit route table 10→11, smoke leg 7 with positive/negative controls, honest-status §17.10 update.
- This register: D-YA-1..D-YA-12 with classifications and gates.

**Queue proposal (owner decision, no code without it)**: D-YA-2 (on-chain PoR attestations) → D-YA-3 (circuit-breaker banner) → D-YA-9 (compliance gate surfacing) — all three are `IMPLEMENTABLE-NOW`, none requires economic ratification, each compounds the audit-first moat.
