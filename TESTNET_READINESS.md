# MTQΣ Testnet Readiness Gate

**Status: NOT YET CERTIFIED FOR PUBLIC TESTNET USE.** This checklist is a release gate, not evidence that a gate has passed. The repository describes the system as a pilot and explicitly says production is not authorized.

## Scope and release rule

- Preserve the MTQΣ Global Purchasing Power Unit architecture and its documented basket/index rules. MTQΣ is not USD-pegged.
- Permit only explicitly configured test networks and test assets. Never point a test build at production RPCs, production treasury addresses, or real collateral.
- No production minting, redemption, reserve trading, or user-fund custody is authorized by this checklist.
- Do not label any chain integration, oracle, reserve ratio, contract verification, or deployment as live unless a fresh, reproducible check proves it.

## Gate 0 — Credential incident containment

Credentials were pasted into an external chat on 2026-10-24. Treat the affected GitHub, Vercel, Turso, and Neon credentials as compromised.

- [ ] Revoke/rotate each exposed credential at its issuing provider.
- [ ] Review GitHub audit/security logs, Vercel deployments and project settings, and database access logs from the earliest plausible exposure.
- [ ] Check repository history, CI logs, deployment logs, preview builds, source maps, and client bundles for credential leakage.
- [ ] Replace credentials only through provider-managed environment settings or GitHub Actions Secrets; never commit them.
- [ ] Verify least-privilege scopes and remove credentials that are not required.
- [ ] Run `bun run security:scan` and inspect findings without copying secret values into reports.

A repository scan cannot revoke a token or establish that no external copy exists.

## Gate 1 — Reproducible build and static checks

Run from a clean checkout using the lockfile and a supported Bun version:

```bash
bun install --frozen-lockfile
bun run security:scan
bun run security:tests
bun run check:no-neon
bun run typecheck
bun run lint
bun test
bun run build
```

- [ ] All mandatory checks pass; no mandatory check is silently marked advisory.
- [ ] Review and document every skipped, flaky, or quarantined test.
- [ ] Verify the Vercel build uses the same install/build commands and environment contract.
- [ ] Confirm no API route exposes private configuration, signing keys, provider tokens, or stack traces.

## Gate 2 — Monetary engine and oracle

- [ ] Verify the canonical blueprint version, basket constituents/quantities, base fixings, index normalization, and purchasing-power calculation against the authoritative specification.
- [ ] Confirm reference-index weights are not incorrectly treated as reserve weights.
- [ ] Confirm settlement currencies are not silently added to the reserve basket.
- [ ] Reject missing, stale, outlier, future-dated, or insufficiently independent oracle observations.
- [ ] Exercise degraded-oracle, disagreement, market-closure, low-liquidity, and chain/RPC outage states.
- [ ] Verify mint/redeem pricing, fees, rounding, decimals, caps, pause behavior, and risk-state transitions against independent reference calculations.
- [ ] Keep the dashboard's simulated/sample values visibly distinct from verified live observations.

## Gate 3 — Rebalancing and reserve safety

- [ ] Use executable bid/ask quotes, not mid-market marks, for trade simulation.
- [ ] Include spread, slippage, market impact, venue/pool fees, bridge/network costs, settlement costs, quote age, volatility and liquidity margins.
- [ ] Calculate net benefit after all costs; reject/defer uneconomic or stale quotes and re-evaluate residual deviations after partial fills.
- [ ] Enforce bounded trade sizes, daily limits, allowlists, circuit breakers, pause authority and idempotent execution.
- [ ] Confirm no automated strategy can bypass authorization controls or execute against production endpoints.
- [ ] Test reserve accounting and coverage under price shocks, delayed settlement, failed transactions and redemption stress. Do not infer actual collateral from a dashboard ratio.

## Gate 4 — Smart contracts and chain configuration

For each configured chain, independently record chain ID, RPC source, explorer, deployment transaction, deployed bytecode hash, verified source, constructor/init parameters, owner/admin roles, pause authority, token decimals, and oracle configuration.

- [ ] Compare configured addresses with fresh chain reads; do not rely on comments or old audit artifacts alone.
- [ ] Verify deployed bytecode is present and matches the intended build.
- [ ] Run unit, fuzz, invariant, access-control, reentrancy, arithmetic, and failure-path tests.
- [ ] Verify chain ID at runtime before signing or sending any transaction.
- [ ] Use a test wallet with minimal testnet gas only; do not request or store a seed phrase in the web app.
- [ ] Confirm any bridge, multisig, timelock, or external dependency is either tested end-to-end or clearly disabled.
- [ ] Publish deployment evidence and known limitations; do not claim an external audit unless a real report exists.

## Gate 5 — Application, APIs, and data stores

- [ ] Test every API route for authentication/authorization, input validation, rate limiting, error handling and correct HTTP status codes.
- [ ] Verify API routes enforce server-side authorization; UI-only hiding is not access control.
- [ ] Test CORS, CSRF where applicable, security headers, cache behavior, and sensitive-response redaction.
- [ ] Verify the actual database adapter and schema in each environment. The current Prisma schema declares SQLite; do not assume the provided Turso/Neon resources are active or wired.
- [ ] Test migrations, backups, restore, concurrent writes, timeouts, connection exhaustion and graceful degradation.
- [ ] Ensure no public endpoint can write arbitrary pilot data, forge oracle samples, alter contract registry values, or trigger signing.
- [ ] Verify Vercel preview and production environment variables are separated and that preview builds cannot access privileged resources.

## Gate 6 — Testnet end-to-end acceptance

- [ ] Connect a fresh test wallet and verify correct chain/network detection.
- [ ] Read token balance, supply, index/oracle status and contract metadata from the chain; label data with source, block number and observation time.
- [ ] Complete a test-only mint/redeem cycle if the deployed contracts and test collateral genuinely support it; verify balances and emitted events against receipts.
- [ ] Exercise rejected transactions, user rejection, wrong network, RPC outage, stale oracle, insufficient gas, pause state and duplicate submission.
- [ ] Reconcile on-chain receipts with the application audit trail and database records.
- [ ] Verify explorer links and transaction status are based on actual transaction hashes.
- [ ] Confirm all simulated paths are visibly labeled and cannot be mistaken for completed on-chain transactions.

## Required release evidence

Attach a dated report containing the commit SHA, dependency/runtime versions, command outputs, test counts, chain IDs, verified contract addresses and bytecode hashes, transaction hashes for test flows, oracle provenance/freshness results, database adapter/migration evidence, and unresolved findings with owners.

## Release decision

A release may be called **testnet-ready** only after the required gates pass and evidence is reviewed. A successful build alone is insufficient. Production authorization, legal/regulatory review, independent security audit, reserve/custody validation and any required Sharia review are separate decisions and are not granted here.
