# MTQΣ Production Readiness Gate

**Assessment date:** 2026-10-24  
**Decision:** **BLOCKED — TESTNET / SHADOW MODE ONLY**  
**Production authorization:** **NOT GRANTED**  
**Scope:** Repository-level release review; this is not an independent smart-contract audit, legal opinion, reserve attestation, or proof that every live service was reachable.

## Executive decision

Do not enable production minting, redemption, reserve trades, token distribution, or privileged on-chain administration on the evidence currently available. The repository itself records unresolved authority-key compromise, a V3 contract cluster excluded from the Foundry build due to compile and EIP-170 bytecode-size problems, unprotected `main`, and CI controls that are not yet strong enough to serve as the complete production release gate.

The existing fail-closed release controls should remain in force. Green web deployment status, passing application tests, a working dashboard, or a successful synchronization must never be treated as production authorization.

## Verified release blockers

| Priority | Finding | Evidence in the current repository | Required exit evidence |
|---|---|---|---|
| **P0** | On-chain authority-key incident remains unresolved. | `CRITICAL-PRIVATE-KEY-ROTATION.md` says the EVM deployer and Solana authority are to be treated as compromised; authority migration packages and owner approvals remain outstanding. The document also says historical copies may remain. | Owner-approved migration, source/destination authority matrix, proof old authorities can no longer perform privileged actions, balance/asset disposition evidence, and independent verification. Repository cleanup alone does not revoke a key. |
| **P0** | The V3 smart-contract cluster is excluded from the Foundry build. | `contracts/foundry.toml` documents skipped V3 source/tests/adapters and `MtqEcosystem.sol`; it cites V3 compile errors and estimated runtime code above the EIP-170 24,576-byte limit. | Fix the source and architecture, compile the exact intended release artifacts, prove deployed runtime bytecode fits chain limits, run unit/fuzz/invariant tests, verify deployed source/bytecode, and obtain an independent contract audit. Do not treat skipped tests as passing tests. |
| **P0** | Production authorization is expressly withheld. | `README.md`, `SECURITY.md`, `CRITICAL-PRIVATE-KEY-ROTATION.md`, and `src/lib/mtq/release-controls.ts` state testnet/shadow-only posture and fail-closed authorization. | Complete all eight separate release controls with owner-authored evidence and independent review. Do not weaken the guard to make a status page green. |
| **P1** | `main` is unprotected. | GitHub repository metadata reports `main` as unprotected at assessment time. | Require PR review and all release checks; restrict bypass/admin exceptions; require stale-review dismissal and protect production environment/deployment permissions. Recheck settings after the change. |
| **P1** | CI has advisory lint and a reduced test battery. | `.github/workflows/ci.yml` sets ESLint to `continue-on-error: true`. The workflow comments say the deep `canonical-invariants.ts` suite is not part of the normal fast CI battery due to runner resource limits. | Make lint a release requirement after baseline defects are remediated; run the deep invariant/stress suite on suitably provisioned scheduled and pre-release runners; retain actionable artifact logs and make release checks required. Add reproducible production-build and contract-artifact verification to the protected release path. |
| **P1** | Public vulnerability disclosure details are placeholders. | `SECURITY.md` uses a `.example` contact address, has no published PGP fingerprint, and describes the bounty as proposed/pending approval. | Publish and test a monitored security contact, publish verified PGP details if offered, approve or remove proposed bounty language, and define real response ownership before announcing a public security program. |
| **P1** | Provider credentials require a fresh exposure review. | `.env.example` identifies multiple database, deployment, AI-provider and keeper credentials; the incident procedure in `SECURITY.md` says that deleting a copy does not revoke a credential. | Rotate every credential disclosed outside the approved secret manager; invalidate the old credentials; review provider audit logs; verify least-privilege scopes; keep replacement values exclusively in provider secret stores. Never commit replacement values. |
| **P2** | One public API error response exposed the underlying exception string. | `src/app/api/metrics/route.ts` previously returned `String(error)` to callers. This branch removes that detail and adds no-store response headers. | Review other public API handlers for raw exception messages, sensitive payloads, cache policy, authentication, request validation, rate limiting, and audit logging. |

## Monetary and reserve controls

Before any live financial activity, independent reviewers must verify the actual deployed implementation against the approved MTQΣ specification, including:

- The purchasing-power index and reserve basket are distinct from settlement currencies; MTQΣ must not silently become USD-pegged.
- Reserve eligibility, valuation sources, custody evidence, liquidity haircuts, liabilities, encumbrances, and reconciliation are independently evidenced. An internal ratio or dashboard is not equivalent to proof of reserves.
- Mint/redeem price calculations, rounding, decimals, precision loss, caps, fees, and state transitions have property-based/invariant coverage.
- Oracle code validates source identity, timestamps, freshness, outliers, quorum, decimal normalization, stale/failure behavior, and chain-specific decimal differences.
- Rebalancing uses executable bid/ask quotes, route-specific fees, slippage/market-impact estimates, quote-age limits, volatility/liquidity margins, minimum net benefit, expiry, and rejection/defer behavior. Mid-market/reference rates are not executable prices.
- Any keeper signing and transaction submission stays disabled until explicit authorized controls are satisfied. Secrets or signing keys must not be available to untrusted build steps or the public web runtime.

## Required release sequence

1. **Contain credentials:** rotate/revoke exposed GitHub, Vercel, database, oracle, webhook, and keeper credentials as applicable; check audit logs and old token usage. Keep new values out of source control, issues, pull requests, and chat.
2. **Complete authority migration:** execute the owner-approved EVM/Solana migration packages in an owner-controlled environment; verify the new multisig/authority, thresholds, signers, recovery path, and removal of old privileges.
3. **Repair and audit contracts:** remediate V3 compile/code-size issues; define the canonical release artifact; deploy only to testnets first; verify source and runtime bytecode; complete independent security review and remediation.
4. **Harden repository governance:** protect `main`, require independent PR review, require secret scan/typecheck/lint/tests/build/contract checks, and restrict production deployment to a protected environment with explicit approvers.
5. **Prove runtime operations:** demonstrate separated preview/production configuration, production database least privilege, tested backups and restore, monitoring/alerting, incident response, rate limiting, authorization on write operations, idempotency/replay protection, and dependency/security review.
6. **Complete legal and economic approvals:** obtain jurisdiction-specific legal/licensing analysis, approved consumer disclosures and redemption terms, reserve/custody arrangements, governance sign-off, independent economic validation, and an independent Sharia review if the platform makes Sharia-compliance claims.
7. **Record authorization without bypasses:** grant each release control only from an owner-approved evidence record; independently verify the complete set before authorizing a live pilot or production operations.

## Evidence limitations

GitHub returned a successful Vercel status check for the latest commit, but that alone does not establish application security, contract correctness, key containment, reserve solvency, or legal readiness. The assessment environment could not independently fetch the public Vercel page, and no direct Vercel/Turso/Neon administrative connection was available here to rotate secrets, inspect provider audit logs, or prove database backup restoration. Those items remain unverified rather than assumed successful.

## Current release verdict

**NOT PRODUCTION-AUTHORIZED.** Keep the fail-closed gates, testnet-only configuration, and shadow mode. Do not represent MTQΣ as production-ready until every P0 item and required release gate has independently verified evidence.
