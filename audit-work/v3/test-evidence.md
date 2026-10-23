# Test Suite Evidence — MTQΣ Equation-by-Equation Audit (audit-work/v3)

Collected by orchestrator (Task 2-a substitute — the dedicated agent timed out; evidence gathered directly).
Date: 2026-10-19 (Africa/Cairo) · Repo state: single-commit `fb6bb6c` + this session's one-line type fix in succession.ts.

## Summary table

| Suite | Command | Checks | Result | Exit |
|---|---|---|---|---|
| Canonical invariants (7-layer) | `bun src/lib/mtq/__tests__/canonical-invariants.ts` | 159 | **ALL PASSED** (P0-1..P0-4 proofs re-confirmed) | 0 |
| E2E integration | `bun src/lib/mtq/__tests__/e2e-integration.ts` | 26 | **26/26 PASS** (mint→advance→redeem, stress, recovery, oracle-pause; RR invariant held) | 0 |
| Stress re-run (§23) | `bun src/lib/mtq/__tests__/stress-rerun.ts` | 11 scenarios | **11/11 PASS** (S5 survival 100%, 0%→100% P0-IMPL fix confirmed) | 0 |
| Historical backtest (Layer 6, §23) | `bun src/lib/mtq/__tests__/historical-backtest.ts` | 5 invariants / 2562 trading days (2014-12-31→2024-12-31) | **PASS all 5** — INV-1 RR≥1.00 (min 1.0775); INV-2 P_MTQ∈[0.50,2.00] 100%; INV-3 no EMERGENCY>48h (0 days); INV-4 oracle ≥3-src ≥99% (100%); INV-5 divergence check 0 failing ticks | 0 |
| Audit retention | `bun src/lib/mtq/__tests__/audit-retention-test.ts` | 10,000-row cap + prune + cleanup | **PASS** (pruned 6213 synthetic rows, cleaned 5787, live state restored) | 0 |
| State-machine self-test | via audit-verify.ts | 17 | **17/17 PASS** | 0 |
| Chain-index self-test | `bun -e import(...runSelfTest())` | chain-link + succession continuity | **PASS** — I_t=1.13 after gold+50%; unchanged after weight commits; CNY −40% → 0.98; swap bit-identical; SGD slot live | 0 |
| Numerical evidence | `bun audit-work/v2/audit-verify.ts` | index recompute, mint/redeem, App. C | **PASS** — see live values below | 0 |
| C.4 cost-gate regression | `bun audit-work/v2/c4-check.ts` | Appendix C §C.4 | **EXACT** — B $1,200 < C $1,700 → Trade=0 (re-verified live by Task 2-g) | 0 |
| TypeScript | `bun run typecheck` | — | **PASS after 1-line type fix** (pre-existing TS2322 at succession.ts:524 — `findCandidate` returns `SuccessionCandidate | undefined`, return field declared `| null`; fixed by `?? null` at line 227; type-only, no behavior change) | 0 |
| ESLint | `bun run lint` | — | **0 errors / 0 warnings** | 0 |

## Live numerical evidence (audit-verify.ts, this session)

- I_t = **1.195907**; independent recompute from contributions Σ = 19.591% → match ✓; commitWeights(gold 26→29%) divisor D_t = 0.896631, I_t unchanged ✓
- Contributions: EUR +1.442 / JPY −0.500 / GBP +0.535 / CNY +0.341 / CHF +0.370 / Gold +17.402 / USD 0.000 (%)
- Genesis NAV (haircut) $1,113,314.23; MINT 250 USDC → fee $0.25, net $249.75, P=1.000000 at genesis-basis → 249.7500 MTQ (fewer tokens at index > 1 — §19.6.1 doctrine visible); REDEEM 100 MTQ → gross $445,870.50, fee 15 bps, net $445,201.70, 7 pro-rata legs at actual holdings (USDC/USDP/USDT 26.5%, EURC 21.0%, JPY₿ 8.3%, GBP₿ 8.3%, CNY₿ 5.2%, CHF₿ 5.3%, PAXG+XAUT 25.3%)
- Appendix C regressions (ad-hoc script): C.1 ✓ (D 0.3% < θ 0.75% → Trade=0), C.2 ✓ both (doc β=0.40 → −0.96pp; pilot β=0.50 → −1.20pp), C.4-style ✓ (negative-net rejected), C.5 ✓ (29.2% ∈ 20–32% Gold envelope)

## Historical backtest detail (Layer 6)

- Chain-linked I_t: min 0.943170 / max 1.202656 / mean 1.058436 / final 1.159738; NAV: min $1,020,980 / max $1,416,931 / final $1,363,267
- Laspeyres divergence: mean 1.14%, final 7.23% (chain-linking materially different from fixed-quantity — expected)
- 6-state distribution: NORMAL 626d, CAUTION 1936d, STRESS/DEFENSIVE/EMERGENCY/RECOVERY 0d (worst: CAUTION)
- **Data mode: DEGRADED** — FRED_API_KEY unset ⇒ VIX/DXY/Treasury use seeded defaults (documented in output); FX from Frankfurter 2562d; gold 2514d (Yahoo GC=F). Not a full-fidelity Layer-6 run — acceptable pilot evidence, NOT §23 production validation.
- ⚠ Reporting wording bug: INV-5 label says "divergence < 5%" but prints max 8.2219% with 0 failing ticks — the check's actual predicate differs from its label; fix the label or the check.

## Live service health

- Next.js :3000 `/api/health` → `{"status":"healthy","engine":true,"db":true,"version":"v3-source-ready"}`, uptime ≈ 98 min
- Keeper :3040 `/health` → healthy, tickCount 1471
- mtq-feed :3003 → listening
- dev.log tail: clean (only /api/metrics + /api/health 200s); no runtime/hydration errors

## Spec regression-checklist coverage map (eq-by-eq-spec lines 2778–2846)

| Checklist item | Coverage |
|---|---|
| Genesis = exactly 1.0000, 7 components, immutable fixings, event + off-chain verifier agree | **COVERED** — canonical 1.1; chain-index runSelfTest; audit-verify recompute; D3 restart-invariant. Genesis *event emission* is engine-internal (no on-chain genesis gate — TS pilot). |
| Weight vectors sum to 1, non-negative, within bounds | **COVERED** — canonical 2.1 (envelopes), initChainIndex sum validation, mase projection tests |
| Accepted updates pass velocity limits; smoothing + stress flag | **PARTIAL** — velocity enforced in code (mase.ts applyVelocityCaps) but **no dedicated test**; ρ ladder 0.50/0.75 only indirect via e2e |
| Identical inputs ⇒ identical W^Target/W^Constrained/W^Smooth | **COVERED (pilot-grade)** — compute-engine SHA-256 + --verify-only + --fixed-input; D3 restart-invariant; hash covers weights only |
| No index jump from rebalance/constituency change; B⁻/B⁺/D_t/G_t continuity | **COVERED** — canonical 1.2; runSelfTest; succession bit-identical swap (1e-12) |
| Attribution reconciles; costs separately visible | **GAP** — EQ-072..075 not implemented in engine; UI ReferenceChart uses synthetic data; audit-verify does an ad-hoc attribution sum |
| Oracle truth-table 3/2/1/0, quorum, stale, confidence, deviation, correlated, degraded, recovery | **PARTIAL** — canonical 5.x covers pause/stale/outlier/confidence; **correlated-feed counter absent (EQ-134 gap)**; §17.5 filtered-mean absent (median used); degraded-mode = pause only |
| Gold reference independent of own AMM; reserve uses min(ref, executable) | **COVERED** — no MTQ-native AMM anywhere; engine.ts:578-581 min-rule reserve-only, index path raw (verified independent) |
| V_net haircuts; RR, L, LCR, stress demand, per-token NAV definitions | **COVERED** — canonical "NAV < gross"; RR/LCR identities; 25% stress demand; navPerMtq distinct symbol. Drift: historical-backtest navFromHoldings omits gold min-rule (+0.13%) |
| Mint test X_net=X(1−F), minted=X_net/P, no peg | **COVERED** — canonical Economic layer; audit-verify live mint; I5 no-peg invariant |
| Redemption: unambiguous NAV, state fee once, slippage guards, per-asset release + rounding | **PARTIAL** — NAV symbol + fee-once + pro-rata legs **COVERED** (canonical + audit-verify); **slippage guards minOut/τ_user/deadline NOT implemented (EQ-146/147 gap)** |
| MARP: no-trade, trigger, partial, natural-flow, cost-gate, turnover, pool cap, direction lock, emergency override, thin-liquidity deferral | **PARTIAL** — no-trade/partial/cost-gate/turnover/pool-cap **COVERED** (canonical 2.6 + c4-check + stress); **natural-flow netting C.3 ABSENT; direction lock + thin-liquidity deferral not evidenced** |
| Buffer: BASE/STRESS/EMERGENCY ratios, 24h ramp, hysteresis, waterfall order | **COVERED** — canonical buffer rows (62.5/85/100, ramp both directions, EMERGENCY immediate); waterfall order tested |
| De-peg: exact cumulative 10/+15/+25/remainder; issuer-freeze + RR overrides | **PARTIAL** — cumulative-of-original ladders **verified in succession drill + self-test**; **RR-coupled triggers + 5% pause unwired; issuer-freeze override unimplemented** |
| Stress validation all scenarios + CoverageRatio_s per scenario | **PARTIAL (pilot form)** — audit-stress 11 scenarios + stress-rerun 11/11 (survival/minRR per scenario, not literal CoverageRatio_s); S10 combined shock minRR 1.1426 |
| Public status / production-authorization reflects gates; testnet not production-authorized | **COVERED** — honest-status §25.5 all 11 gates NOT CONDUCTED; platform-wide NOT PRODUCTION-AUTHORIZED enforced |
| RG-01..RG-15 owner/decision/tests/versioned resolution | **NOT MET** — this audit provides the decision records; governance owners + versioned resolutions pending (see master report §RG) |
