# MTQΣ — The Global Purchasing Power Unit

A closed-loop monetary architecture pilot — GFB Index (5-currency basket), gold-collateralized reserve at 110%, mint/redeem priced against the index. Deployed on 4 testnets (Monad, Arc, Robinhood, Solana).

## Quick start
```bash
bun install
bun run db:push    # SQLite schema
bun run dev        # http://localhost:3000
```

## Structure
- `src/lib/mtq/` — blueprint engine, Monte Carlo tests, brand system, contract registry
- `src/app/api/` — 10 API endpoints (metrics, oracle, registry, contracts, status, onchain, tests, trials, trials/export, simulate)
- `src/components/mtq/` — 22 UI components (dashboard, contracts, simulators, audit)
- `contracts/` — Solidity contracts (MtqEcosystem.sol, MTQSigma.sol)
- `scripts/` — deploy, test, audit scripts
- `prisma/` — SQLite schema (PilotTrial, MetricSample)

## Testnet deployments
See `src/lib/mtq/contracts.ts` → `CANONICAL_MTQ_ADDRESSES` for the source of truth.

## Tests
```bash
bun run scripts/run-tests.ts        # Monte Carlo + stress (10,300 runs)
bun run scripts/onchain-tests.ts    # on-chain invariants + fuzz (28 tests)
```

## Status
**Candidate for public testing — NOT production-authorized.**
Designed for Sharia review (independent fatwa required).
