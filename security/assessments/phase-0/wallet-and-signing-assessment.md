# Phase 0 — Wallet & Signing Assessment

## 1. What actually exists (classification)

| Capability | Reality | Evidence |
|---|---|---|
| Production wallet backend / custody tiers (hot/warm/cold) | **NOT PRESENT** (no custody arrangement exists to assess — §7 precondition satisfied: assessment before design) | full-repo census |
| MPC / HSM / threshold signing | **NOT PRESENT** | — |
| Transaction-policy engine (independent validation of canonical tx) | **NOT PRESENT** (F-0-P1-01 — the app engine itself mutates on unauth POSTs; no decoding/validation boundary, no recipient allowlists, no aggregate limits at an authorization layer) | §6 requirements vs code |
| Devnet tx signing (ed25519) | EXISTING/VERIFIED — mempool verifies real signatures + nonce window + fee floor | mempool.ts:29-50 |
| Devnet faucet signing | EXISTING/VERIFIED — deterministic PUBLIC key, disclosed INSECURE-BY-DESIGN, rate-bounded | genesis.ts:5-8; node.ts:321-356 |
| Browser wallets | EXISTING/VERIFIED — seeds in localStorage (user-held, devnet-only value) | wallet-store.ts:4-14 |
| On-chain EOA signing (the estate's only privileged signer) | EXISTING/VERIFIED — deployer EOA 0x3C39…c8d8c; **key recoverable from git history (C-045-a)** — F-0-P0-01 | roles.ts; commits 2e684d9/2da73fd |
| Keeper signing (design) | PROTOTYPE — onlyKeeper function set (advanceIndex/commitWeights/…; cannot mint/pause per README), hot `KEEPER_PRIVATE_KEY`, RETIRED-LOCALLY, observe-only (key unset, release-controls guard fail-closed) | keeper README:6-35; index.ts:23-29 |
| EIP-7702 / account abstraction | **NOT APPLICABLE** — network layer (testnets in use) verified EVM but no AA/7702 usage anywhere in runtime code or contracts; §8 forbids introducing it speculatively | contracts + deps census |

## 2. Signing authority concentration test (§7 "test whether a compromised signer can…")

Applied to the only privileged signer (deployer EOA): sign a malicious transaction — YES (mint/pause/vault); alter a recipient — YES (setReserveVault); increase its own limits — YES (owner sets FX/state); change policy — YES; add another signer — YES (Safe threshold/owner with sole 1/1 ownership); disable monitoring — n/a (monitoring off-chain, but evidence rewrite possible via AP-02); access another security domain — YES (it is also the CI-secret story, F-0-P1-04). **The §7 test fails on every line.**

## 3. Custody design preconditions (for Phase 3, not implemented now)

- Treasury custody does not exist today: the on-chain estate holds testnet tokens; no production treasury, no real-value flows (§0.3). Tier design (hot/warm/cold), threshold parameters, and vendor selection are **deferred to the threat-model-informed Phase 3 design** per §7 rule ("do not select an MPC/HSM vendor before completing the threat assessment" — this document completes that precondition).
- Non-negotiable constraints from THIS baseline for any future custody: (a) no single identity may hold unrestricted signing (currently violated absolutely); (b) signer must not change its own policy without independent authorization (violated: owner-is-signer); (c) correlated-compromise analysis mandatory (Safe 1/1 + repo-history key = one effective compromise); (d) emergency signing suspension + tested revocation while normal services are down (T-30/T-31 in the §15 program).

## 4. Verdict

Wallet/signing security today = "simulated cryptography, real single point". The ed25519 devnet layer is genuine but value-less by design; the only authority-bearing signer is a compromised-class key that already leaked into history. Phase 3's transaction-authorization architecture (independent policy engine, tiered custody, threshold signing, revocation drills) is fully specified as proposed work in `security-phase-plan.md` §Phase 3.
