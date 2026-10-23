# MTQΣ — TASK 12 · D9: INDEPENDENT VERIFICATION PLAN

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

Scope for the independent reviewer (a party that did not author this remediation).
Everything below is performed READ-ONLY; failures are UNVERIFIED — never
negative results; every probe is block/slot-anchored with request/response
hashing. The reviewer's report precedes ANY "contained/rotated/revoked"
language anywhere (Task 11.1 rule, carried).

---

## 1. Post-EXECUTION on-chain verification (after the D4/D5 packages run — not before)

From Task 11 D8 (carried, updated to the Task 12 anchors):

| # | Check | Expected (only after approved execution) |
|---|---|---|
| V-1 | Fresh role matrices (both MTQ tokens × 3 roles × holders) | deployer cells **FALSE ×15** (the T-3.6/3.7 outcome); Safe-B cells TRUE; Mint-module MINTER per OPS-DEC-1; Monad Redeem-module MINTER **FALSE** (T-3.1) |
| V-2 | Old Genesis Safes: roles on tokens | all revoked (T-3.2/T-3.3); safe dossiers unchanged otherwise |
| V-3 | Safe-B dossiers per chain | owners==⟨OWNER-1..7⟩, threshold==4, nonce>0 (quorum proof happened), v1.4.1, singleton slot == canonical anchor |
| V-4 | Deployer balances | per the T-3.8 decision (0 if evacuated); destinations hold the declared amounts |
| V-5 | Module admin cells (both chains ×6) | deployer FALSE, Safe-B TRUE |
| V-6 | Solana: superseded mint | mintAuthority==None, freezeAuthority==None; 4saT SOL ≈ fee dust; sig count frozen after the final tx |
| V-7 | Solana: current mint | authority per SOL-DEC-1 outcome (multisig / None / unchanged-with-acceptance) |
| V-8 | Module-side custom role cells (E-15/E-16): Monad Redeem module custom `ADMIN_ROLE (0xa4980720…1775)` + redeem-role `(0xf65a18a7…7fdc)` membership | probed and recorded (closes the Task 11.1 open cells) |
| V-9 | Governor pair | NO interaction expected; sources published? record status (N-01) |

## 2. Post-EXECUTION repository verification

| # | Check |
|---|---|
| R-1 | Fresh clone from the REWRITTEN history (post D3): `bun run security:scan` PASS; per-commit fingerprint-anchored sweep (values via stdin/program logic only — the PI-3 lesson) → zero occurrences of every encoding |
| R-2 | Redaction markers present where the literals were (worklog notice; retired stubs; verifier rewrites) — and git history rewritten WITHOUT losing the forensic originals (owner-side bundle from D3 §3 step 1) |
| R-3 | Pre-commit hook active in the reviewer's clone (`git config core.hooksPath .githooks`); a synthetic seeded file REJECTED on commit; redacted output confirmed |
| R-4 | CI (once a remote exists + OWNER-ATT-1): secret-scan job runs FIRST and blocks a deliberately-seeded branch (reviewer seeds a synthetic secret on a scratch branch, observes the gate reject, deletes the branch) |
| R-5 | `bun run typecheck` / `bun run lint` / `bun test` / canonical-invariants — reviewer re-runs and records honestly |

## 3. Task 12 control review (executable NOW — before any migration)

| # | Review item | What the reviewer does |
|---|---|---|
| C-1 | Scanner efficacy | Read `scripts/security/secret-scan.ts` rules; attempt an evasive benign-looking secret (e.g. hex in an unusual container) on a scratch branch; decide whether the ruleset is adequate or needs new rules (context-gated base58 is a documented tradeoff — signatures vs secrets) |
| C-2 | Allowlist audit | Every entry in `secret-scan-allowlist.json`: justification true? verification basis sound? (11 entries; the two known-literal rules must remain unsuppressible — verified by code + test) |
| C-3 | Release-control red-team | Attempt to reach any chain-facing action WITHOUT a valid authorization file (alternate endpoints, malformed/partial files, env tricks); confirm default-deny everywhere; verify no code path turns a build/test/session signal into a grant |
| C-4 | Keeper guard integrity | Re-review `mini-services/keeper/index.ts`: the guard is the first step of `runTick`; `POST /tick` has no bypass; `/health` releaseControls block matches module output; confirm the running process behavior matches the code (restart + probe) |
| C-5 | Address-book validator | Confirm the tooling surfaces (never deletes) the contamination facts; confirm zero APPROVED-CANONICAL classifications; confirm `ok=false` is reported honestly |
| C-6 | Evidence-chain audit | `evidence/redaction-report-task12.json` sha256 chain vs the recorded transcripts; `evidence/fresh-anchors-task12.json` response hashes re-computed against fresh probes (same block if unadvanced, or re-anchored) |
| C-7 | Base58 census correction | Re-verify independently that no base58-encoded secret remains (the Task 10/11 census missed one — assume other encodings may exist: check keypair-JSON, base64, mnemonic variants) |
| C-8 | Transcript discipline | Confirm no Task 12 tool output printed a secret value (outputs are redacted by design — spot-check the session records) |

## 4. Reviewer's independence requirements

- Not the author of this package; not a signer of ⟨OWNER-1..7⟩ / multisig
  members; reports to the Security Lead + Owner.
- Read-only chain access only; own RPC identity; block/slot anchors recorded.
- Findings reported BEFORE any gate language changes; an UNVERIFIED item is
  reported as UNVERIFIED, never as PASS.

**No part of this plan authorizes execution. Release status: NOT ACCEPTED.**
