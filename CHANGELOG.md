# MTQΣ Changelog

## v2.7 (2026-09-07) — Backup, Harden, Restore
- Full backup to /tmp (832K, 147 files)
- Restored files lost in sandbox reset (MtqEcosystem.sol, monte-carlo.ts, API routes)
- Git committed all work (commits 6d9eaeb, 105f1fe)
- 10 API endpoints all return 200
- Monte Carlo: 10,300 runs, 100% survival, PASS
- On-chain invariants: 28/28 PASS (3 EVM chains × 7 invariants + 7 fuzz tests)

## v2.6 (2026-09-07) — On-chain invariant + fuzz tests
- Built on-chain invariant + fuzz test harness (scripts/onchain-tests.ts)
- 7 fuzz tests (10k runs each) + 21 on-chain invariant checks = 28/28 PASS
- Caught + fixed FUZZ-3 conservation assertion bug

## v2.5 (2026-09-06) — Monte Carlo + stress tests + audit
- Built Monte Carlo engine (src/lib/mtq/monte-carlo.ts)
- 8 stress test suites: baseline, Monte Carlo, depression, hyperinflation, depeg cascade, oracle failure, liquidity crisis, black swan
- 10,300 total simulations, 100% survival rate, PASS verdict

## v2.4 (2026-09-06) — Investor-ready
- Live on-chain verification API (/api/onchain/<chain>)
- Aggregate status API (/api/status)
- Trial export API (/api/trials/export?format=csv|json)
- Investor / Pitch / Security UI sections

## v2.3 (2026-09-06) — Full ecosystem + branded MTQΣ
- Full MITHQAL ecosystem deployed on all 3 EVM chains
- On-chain name="MTQΣ" (with the Σ character)
- AccessControl roles wired (MINTER on Mint, PAUSER on Safe)
- Solana fresh mint with Metaplex metadata name="MTQΣ"
- Fixed mint blocker (MockUSDC MaxUint256 overflow)

## v2.2 (2026-09-05) — Blueprint engine v2
- §9 Oracle architecture, §5 Asset Registry, §11.3 Reintegration
- §13.2 Treasury Sweep, §8.5 First-Loss Waterfall, §3.6 PriceUpdated events
- §12.2 vs §3.4.2 contradiction reconciled (§3.4.2 canonical)
- §5.6 concentration breach fixed (all 3 issuers ≤ 25%)

## v2.1 (2026-09-05) — Initial pilot
- MTQΣ Monetary Observatory single-page app
- Live GFB Index, reserve composition, macro engine, rebalancing
- Mint/redeem simulators, contract registry, trial log
- Brand system (logo, emblem, hero, pattern, colors, typography)
