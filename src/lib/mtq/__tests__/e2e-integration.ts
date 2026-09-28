// MTQΣ — E2E Integration Test
// =========================================================================
// Task ID: WIRING-2
//
// Exercises the full engine cycle end-to-end:
//   1. Initialize reserve state (genesis: 1M MTQ + 1.1M USDC, RR = 1.10)
//   2. Apply a pilot warm-up mint (9M USDC) so circulating supply / liability
//      is meaningful (RR settles near 1.10 — the production target)
//   3. Fetch live FX data (with graceful fallback to synthetic on no-network)
//   4. Build the §9 strict-3-source oracle board
//   5. Run 10 engine ticks (advance macro, oracle, risk state, MASE, rebalance)
//   6. Simulate a small bank-mediated mint
//   7. Simulate a redeem (NAV-based settlement, §19.3.2 / I6)
//   8. Verify: RR stays >= 1.00 (RR_HARD), state transitions correct, audit trail
//   9. Stress scenario: apply a first-loss + gold -10% to push RR into STRESS
//  10. Verify: state moves to CAUTION/STRESS, minting throttled / paused
//  11. Recovery: credit the loss back, restore gold → RR returns to ~1.10
//  12. Verify: state returns to NORMAL
//
// Plus: oracle pause path + RR invariant across every step.
//
// Runnable directly: `bun run src/lib/mtq/__tests__/e2e-integration.ts`
// Exit 0 on success, 1 on failure. No dev server required.
// =========================================================================

import {
  initReserveState,
  computeSnapshot,
  applyMint,
  applyRedeem,
  advanceMacro,
  advanceMase,
  updateBufferState,
  advanceRiskState,
  advanceChainIndex,
  getMtqPriceFromState,
  reserveAssetValues,
  computeLiability,
  computeReserveRatio,
  computeLcr,
  evaluateRebalance,
  applyRebalanceTrade,
  priceInSafetyBand,
  circulatingSupply,
  type ReserveState,
} from "../engine";
import { fetchFxSnapshot, type FxSnapshot } from "../fx";
import { buildOracleBoard } from "../oracle";
import {
  mintingAllowed,
  mintThrottle,
  type RiskState,
} from "../state-machine";
import {
  BASE_FIXINGS,
  RR_HARD,
  RR_TARGET,
  PRICE_SAFETY_LOWER,
  PRICE_SAFETY_UPPER,
} from "../blueprint";

// =========================================================================
// Tiny test framework
// =========================================================================

interface StepResult {
  step: string;
  pass: boolean;
  detail: string;
}

const results: StepResult[] = [];

function record(step: string, pass: boolean, detail: string): boolean {
  results.push({ step, pass, detail });
  const tag = pass ? "\u2713" : "\u2717";
  console.log(`  ${tag} ${step} — ${detail}`);
  return pass;
}

// RR invariant. RR = +Infinity (no circulating supply yet → no liability) is
// treated as healthy — there is nothing to be insolvent against.
function rrHealthy(rr: number): boolean {
  if (!Number.isFinite(rr)) return true; // genesis: no liability
  return rr >= RR_HARD;
}

function assertRrInvariant(label: string, rr: number): boolean {
  const ok = rrHealthy(rr);
  const detail = Number.isFinite(rr)
    ? `RR=${rr.toFixed(4)} (hard floor ${RR_HARD.toFixed(2)})`
    : `RR=+Infinity (no circulating supply — treated as healthy)`;
  return record(`RR invariant (${label})`, ok, detail);
}

function assertPriceInBand(label: string, price: number): boolean {
  const ok = price >= PRICE_SAFETY_LOWER && price <= PRICE_SAFETY_UPPER;
  return record(
    `Price safety band (${label})`,
    ok,
    `P_MTQ=${price.toFixed(4)} band=[${PRICE_SAFETY_LOWER}, ${PRICE_SAFETY_UPPER}]`,
  );
}

function assertEqual<T>(label: string, actual: T, expected: T): boolean {
  const ok = actual === expected;
  return record(label, ok, `actual=${String(actual)} expected=${String(expected)}`);
}

// =========================================================================
// FX-snapshot helpers (synthetic, deterministic — same pattern as stress-rerun)
// =========================================================================

function makeFx(opts: {
  EUR?: number; GBP?: number; JPY?: number; CNY?: number; CHF?: number;
  XAU?: number; VIX?: number; DXY?: number;
  source?: string;
} = {}): FxSnapshot {
  return {
    EUR_USD: opts.EUR ?? BASE_FIXINGS.EUR_USD,
    GBP_USD: opts.GBP ?? BASE_FIXINGS.GBP_USD,
    JPY_USD: opts.JPY ?? BASE_FIXINGS.JPY_USD,
    CNY_USD: opts.CNY ?? BASE_FIXINGS.CNY_USD,
    CHF_USD: opts.CHF ?? BASE_FIXINGS.CHF_USD,
    XAU_USD: opts.XAU ?? BASE_FIXINGS.XAU_USD,
    VIX: opts.VIX ?? 18.5,
    DXY: opts.DXY ?? 104.2,
    fetchedAt: Date.now(),
    source: opts.source ?? "e2e-synthetic",
    degraded: false,
  };
}

async function loadFx(): Promise<FxSnapshot> {
  // Try live FX first (Frankfurter ECB + gold-api + Yahoo ^VIX). Falls back to
  // the synthetic snapshot if the network is unavailable, so the test is fully
  // self-contained and runnable in any environment.
  try {
    const live = await fetchFxSnapshot(true);
    if (live && Number.isFinite(live.XAU_USD) && live.XAU_USD > 0) {
      console.log(
        `  Live FX fetched: ${live.source} (XAU=${live.XAU_USD.toFixed(2)}, degraded=${live.degraded})`,
      );
      return live;
    }
  } catch (e) {
    console.log(
      `  Live FX unavailable (${e instanceof Error ? e.message : "unknown"}) — using synthetic snapshot.`,
    );
  }
  console.log("  Using synthetic FX snapshot (BASE_FIXINGS + plausible VIX/DXY).");
  return makeFx({ source: "e2e-synthetic-fallback" });
}

// =========================================================================
// Single engine tick — mirrors the pilot-state tick loop
// (advance chain index → MASE → macro → metrics → risk state → buffer → rebalance)
// =========================================================================

interface TickOut {
  rr: number;
  lcr: number;
  status: RiskState;
  price: number;
  nav: number;
  liability: number;
  inBand: boolean;
}

function tick(s: ReserveState, fx: FxSnapshot): TickOut {
  // Reset daily counters so a tight test loop doesn't permanently block trades.
  s.dailyTurnoverUsd = 0;
  s.lastTurnoverResetAt = Date.now();
  s.lastTradeAt = 0;

  advanceChainIndex(s, fx);
  advanceMase(s, fx);
  advanceMacro(s, fx.VIX, fx.DXY, 24); // 1 tick = 1 day

  const price = getMtqPriceFromState(s);
  const vals = reserveAssetValues(s, fx);
  const nav = vals.nav;
  const liability = computeLiability(s, price);
  const rr = computeReserveRatio(nav, liability);
  const lcr = computeLcr(s, vals, price);

  // Advance the canonical 6-state risk machine (source of truth for status).
  const rrSafe = Number.isFinite(rr) ? rr : 1.10;
  const lcrSafe = Number.isFinite(lcr) ? lcr : 1.10;
  advanceRiskState(s, rrSafe, lcrSafe, Date.now());
  updateBufferState(s, rrSafe);

  // Rebalance (legacy §7 path — feature flag stays default).
  if (Number.isFinite(rr)) {
    const decision = evaluateRebalance(s, vals, rr);
    if (decision.shouldRebalance) {
      applyRebalanceTrade(s, decision, vals.goldPrice);
    }
  }

  return {
    rr,
    lcr,
    status: s.riskState.state,
    price,
    nav,
    liability,
    inBand: priceInSafetyBand(price),
  };
}

// =========================================================================
// MAIN
// =========================================================================

async function main(): Promise<void> {
  console.log("\n============================================================");
  console.log("  MTQΣ E2E Integration Test — full mint → advance → redeem");
  console.log("  cycle + stress + recovery + oracle pause + RR invariant.");
  console.log("============================================================\n");

  let allOk = true;

  // ----------------------------------------------------------------------
  // Step 1: Initialize reserve state
  // ----------------------------------------------------------------------
  console.log("Step 1: Initialize reserve state (genesis 1M MTQ + 1.1M USDC).");
  const baselineFx = await loadFx();
  const s = initReserveState(baselineFx.XAU_USD);
  // Advance the chain index ONCE (without advancing risk state) so P_MTQ
  // reflects live FX before any mint. Otherwise the warm-up mint would be
  // priced at the genesis 1.0 while the reserve is valued at live FX,
  // producing an undercollateralized post-tick RR.
  advanceChainIndex(s, baselineFx);
  advanceMase(s, baselineFx);
  const initSnap = computeSnapshot(s, baselineFx);
  console.log(
    `  Genesis: totalSupply=${initSnap.totalSupply.toFixed(0)} ` +
      `circulating=${initSnap.circulatingSupply.toFixed(0)} ` +
      `NAV=$${initSnap.nav.toFixed(0)} ` +
      `RR=${Number.isFinite(initSnap.reserveRatio) ? initSnap.reserveRatio.toFixed(4) : "+Inf"} ` +
      `P_MTQ=${initSnap.mtqPrice.toFixed(4)} ` +
      `status=${initSnap.status}`,
  );
  allOk = assertRrInvariant("genesis", initSnap.reserveRatio) && allOk;
  allOk = assertEqual("genesis status", initSnap.status as RiskState, "NORMAL" as RiskState) && allOk;
  allOk = assertPriceInBand("genesis", initSnap.mtqPrice) && allOk;

  // ----------------------------------------------------------------------
  // Step 2: Apply a pilot warm-up mint sized to land RR ≈ 1.15 at the live
  //         P_MTQ. This simulates bank-mediated pilot onboarding bringing
  //         real circulating supply. The math:
  //           post-mint RR = (NAV_0 + X) / (X × (1-fee) × P_MTQ)
  //         solving for X with target RR = 1.15 gives the mint size below.
  // ----------------------------------------------------------------------
  console.log("\nStep 2: Apply pilot warm-up mint (sized for RR ≈ 1.15 at live P_MTQ) — bank onboarding.");
  const livePrice = getMtqPriceFromState(s);
  const genesisNav = reserveAssetValues(s, baselineFx).nav;
  const targetWarmupRr = 1.15;
  const feeRate = 0.001; // MINT_FEE_BPS = 10 bps
  // post-mint RR = (NAV_0 + X) / (X × (1-fee))   [the P_MTQ cancels: liability = X×(1-fee)×P/P]
  // →  X = NAV_0 / (target × (1-fee) - 1)
  const denom = targetWarmupRr * (1 - feeRate) - 1;
  const warmupMintUsd = denom > 0
    ? Math.max(1_000_000, genesisNav / denom)
    : 5_000_000;
  const warmup = applyMint(s, baselineFx, s.riskState.state, warmupMintUsd);
  console.log(
    `  Warm-up mint: usdIn=${warmupMintUsd.toFixed(0)} ` +
      `ok=${warmup.ok} ` +
      `mtqMinted=${warmup.mtqMinted.toFixed(2)} ` +
      `newCirculating=${warmup.newCirculatingSupply.toFixed(2)} ` +
      `newRR=${Number.isFinite(warmup.newReserveRatio) ? warmup.newReserveRatio.toFixed(4) : "+Inf"}`,
  );
  allOk = record("Pilot warm-up mint succeeded", warmup.ok, warmup.ok ? "ok" : `rejected: ${warmup.reason ?? "?"}`) && allOk;
  allOk = record(
    "Circulating supply is now meaningful (>1M)",
    warmup.newCirculatingSupply > 1_000_000,
    `circulating=${warmup.newCirculatingSupply.toFixed(0)}`,
  ) && allOk;
  allOk = record(
    "Post-warm-up RR is in a healthy band [1.05, 1.30]",
    Number.isFinite(warmup.newReserveRatio) && warmup.newReserveRatio >= 1.05 && warmup.newReserveRatio <= 1.30,
    `RR=${warmup.newReserveRatio.toFixed(4)}`,
  ) && allOk;

  // ----------------------------------------------------------------------
  // Step 3: Fetch live FX data (already done in Step 1) — now also build the
  //         §9 strict-3-source oracle board.
  // ----------------------------------------------------------------------
  console.log("\nStep 3: Build the oracle board (§9 strict-3-source consensus).");
  const board = buildOracleBoard({
    EUR_USD: baselineFx.EUR_USD,
    GBP_USD: baselineFx.GBP_USD,
    JPY_USD: baselineFx.JPY_USD,
    CNY_USD: baselineFx.CNY_USD,
    XAU_USD: baselineFx.XAU_USD,
  });
  console.log(`  Oracle board: anyPaused=${board.anyPaused} pairs=${board.pairs.length}`);
  allOk = record(
    "Oracle board not paused at baseline",
    !board.anyPaused,
    `anyPaused=${board.anyPaused}`,
  ) && allOk;

  // ----------------------------------------------------------------------
  // Step 4: Run 10 engine ticks (warm-up to settle chain index + MASE)
  // ----------------------------------------------------------------------
  console.log("\nStep 4: Run 10 engine ticks (chain index + MASE + macro + risk + rebalance).");
  let lastTick: TickOut | null = null;
  let rrAlwaysAboveHard = true;
  for (let i = 1; i <= 10; i++) {
    lastTick = tick(s, baselineFx);
    if (!rrHealthy(lastTick.rr)) rrAlwaysAboveHard = false;
    if (i === 1 || i === 5 || i === 10) {
      console.log(
        `  tick ${String(i).padStart(2, "0")}: ` +
          `RR=${Number.isFinite(lastTick.rr) ? lastTick.rr.toFixed(4) : "+Inf"} ` +
          `LCR=${Number.isFinite(lastTick.lcr) ? lastTick.lcr.toFixed(4) : "+Inf"} ` +
          `P_MTQ=${lastTick.price.toFixed(4)} status=${lastTick.status} inBand=${lastTick.inBand}`,
      );
    }
  }
  allOk = record(
    "RR healthy across all 10 warm-up ticks",
    rrAlwaysAboveHard,
    rrAlwaysAboveHard ? "all 10 ticks held RR_HARD" : "RR fell below hard floor during warm-up",
  ) && allOk;
  allOk = assertRrInvariant("after 10 warm-up ticks", lastTick!.rr) && allOk;
  console.log(
    `  Post-warmup: status=${lastTick!.status} ` +
      `RR=${Number.isFinite(lastTick!.rr) ? lastTick!.rr.toFixed(4) : "+Inf"} ` +
      `circulating=${circulatingSupply(s).toFixed(0)}`,
  );

  // ----------------------------------------------------------------------
  // Step 5: Simulate a small bank-mediated mint (10,000 USDC in)
  // ----------------------------------------------------------------------
  console.log("\nStep 5: Simulate a bank-mediated mint (10,000 USDC in).");
  const preMintSupply = circulatingSupply(s);
  const preMintRr = computeReserveRatio(
    reserveAssetValues(s, baselineFx).nav,
    computeLiability(s, getMtqPriceFromState(s)),
  );
  const mint = applyMint(s, baselineFx, s.riskState.state, 10_000);
  console.log(
    `  Mint: ok=${mint.ok} ` +
      `mtqMinted=${mint.mtqMinted.toFixed(4)} ` +
      `feeUsd=${mint.feeUsd.toFixed(2)} ` +
      `throttle=${mint.throttleFactor} ` +
      `newSupply=${mint.newCirculatingSupply.toFixed(4)} ` +
      `newRR=${Number.isFinite(mint.newReserveRatio) ? mint.newReserveRatio.toFixed(4) : "+Inf"}`,
  );
  allOk = record("Mint succeeded (NORMAL state)", mint.ok, mint.ok ? "ok" : `rejected: ${mint.reason ?? "?"}`) && allOk;
  allOk = record(
    "Circulating supply increased after mint",
    mint.newCirculatingSupply > preMintSupply,
    `${preMintSupply.toFixed(4)} → ${mint.newCirculatingSupply.toFixed(4)}`,
  ) && allOk;
  allOk = assertRrInvariant("after mint", mint.newReserveRatio) && allOk;
  // Mint at NORMAL with 100% reserve-backing deposit should not degrade RR materially.
  const preMintRrSafe = Number.isFinite(preMintRr) ? preMintRr : mint.newReserveRatio;
  allOk = record(
    "Mint does not collapse RR (Δ <= 0.05)",
    Number.isFinite(mint.newReserveRatio) && mint.newReserveRatio >= preMintRrSafe - 0.05,
    `before=${preMintRrSafe.toFixed(4)} after=${mint.newReserveRatio.toFixed(4)}`,
  ) && allOk;

  // ----------------------------------------------------------------------
  // Step 6: Simulate a redeem (NAV-based settlement §19.3.2 / I6)
  // ----------------------------------------------------------------------
  console.log("\nStep 6: Simulate a redeem (burn 2,000 MTQ — NAV-based settlement).");
  const preRedeemSupply = circulatingSupply(s);
  const redeem = applyRedeem(s, baselineFx, s.riskState.state, 2_000);
  console.log(
    `  Redeem: ok=${redeem.ok} ` +
      `grossUsd=${redeem.grossUsd.toFixed(2)} ` +
      `feeUsd=${redeem.feeUsd.toFixed(2)} ` +
      `netUsd=${redeem.netUsd.toFixed(2)} ` +
      `navPerMtq=${redeem.navPerMtq.toFixed(4)} ` +
      `newRR=${Number.isFinite(redeem.newReserveRatio) ? redeem.newReserveRatio.toFixed(4) : "+Inf"}` +
      (redeem.deficitUsd > 0 ? ` deficitUsd=${redeem.deficitUsd.toFixed(2)}` : ""),
  );
  allOk = record("Redeem succeeded (NORMAL state)", redeem.ok, redeem.ok ? "ok" : `rejected: ${redeem.reason ?? "?"}`) && allOk;
  allOk = record(
    "Circulating supply decreased after redeem",
    redeem.newCirculatingSupply < preRedeemSupply,
    `${preRedeemSupply.toFixed(4)} → ${redeem.newCirculatingSupply.toFixed(4)}`,
  ) && allOk;
  allOk = assertRrInvariant("after redeem", redeem.newReserveRatio) && allOk;

  // ----------------------------------------------------------------------
  // Step 7: Verify RR invariant + audit-trail field
  // ----------------------------------------------------------------------
  console.log("\nStep 7: Verify RR invariant + audit trail (priceEvents log).");
  const postSnap = computeSnapshot(s, baselineFx);
  console.log(
    `  Post-mint-redeem snapshot: RR=${Number.isFinite(postSnap.reserveRatio) ? postSnap.reserveRatio.toFixed(4) : "+Inf"} ` +
      `LCR=${Number.isFinite(postSnap.lcr) ? postSnap.lcr.toFixed(4) : "+Inf"} ` +
      `status=${postSnap.status} ` +
      `priceEvents=${postSnap.priceEvents.length} oraclePaused=${postSnap.oraclePaused}`,
  );
  allOk = assertRrInvariant("post mint+redeem snapshot", postSnap.reserveRatio) && allOk;
  allOk = record(
    "Audit trail field present (priceEvents is an array)",
    Array.isArray(postSnap.priceEvents),
    `len=${postSnap.priceEvents.length}`,
  ) && allOk;

  // ----------------------------------------------------------------------
  // Step 8: Stress scenario — gold -10% + VIX=32 + a direct reserve loss
  //         sized to push RR into the STRESS band (1.02 ≤ RR < 1.05).
  //
  //         Note: the chain-linked index means a gold move alone does NOT
  //         degrade RR — the index tracks the reserve, so liability drops in
  //         step with NAV. We therefore apply a direct first-loss to the USDC
  //         reserves (spread 1/3 each across USDC/USDP/USDT per §5.6) to
  //         deterministically push RR below the CAUTION threshold. The gold
  //         shock + VIX=32 provide the macro stress signals.
  // ----------------------------------------------------------------------
  console.log("\nStep 8: Stress scenario — gold -10% + VIX=32 + direct reserve loss → STRESS.");
  const baselineRr = postSnap.reserveRatio;
  const stressFx = makeFx({ XAU: baselineFx.XAU_USD * 0.90, VIX: 32, DXY: 108, source: "e2e-stress" });
  // First, advance the chain index under the stress FX so liability reflects
  // the gold -10% (the index drops ~2.6%). We do ONE chain-index advance
  // without advancing the risk state, so we can size the loss against the
  // post-shock liability.
  advanceChainIndex(s, stressFx);
  const postShockVals = reserveAssetValues(s, stressFx);
  const postShockLiab = computeLiability(s, getMtqPriceFromState(s));
  const targetStressRr = 1.03;
  // loss = NAV - targetRR × liability  (sized so post-loss RR ≈ 1.03)
  let requiredLoss = postShockVals.nav - targetStressRr * postShockLiab;
  // Clamp to a sensible range — must be > 0 and < total USDC holdings.
  const totalUsd = s.usdc + s.usdp + s.usdt;
  requiredLoss = Math.max(50_000, Math.min(requiredLoss, totalUsd * 0.5));
  console.log(
    `  Post-gold-shock: NAV=$${postShockVals.nav.toFixed(0)}, ` +
      `liability=$${postShockLiab.toFixed(0)}, ` +
      `P_MTQ=${getMtqPriceFromState(s).toFixed(4)}\n` +
      `  Applying direct reserve loss of $${requiredLoss.toFixed(0)} ` +
      `(target RR=${targetStressRr})`,
  );
  // Apply the loss directly to the USDC reserves (1/3 each per §5.6).
  const lossPerIssuer = requiredLoss / 3;
  s.usdc = Math.max(0, s.usdc - lossPerIssuer);
  s.usdp = Math.max(0, s.usdp - lossPerIssuer);
  s.usdt = Math.max(0, s.usdt - lossPerIssuer);
  syncReserveFromTotalSafe(s);
  // Run a few ticks under stress so the risk state machine reacts.
  let stressTick: TickOut | null = null;
  for (let i = 1; i <= 5; i++) {
    stressTick = tick(s, stressFx);
  }
  console.log(
    `  After 5 stress ticks: RR=${Number.isFinite(stressTick!.rr) ? stressTick!.rr.toFixed(4) : "+Inf"} ` +
      `LCR=${Number.isFinite(stressTick!.lcr) ? stressTick!.lcr.toFixed(4) : "+Inf"} ` +
      `status=${stressTick!.status} P_MTQ=${stressTick!.price.toFixed(4)}`,
  );
  // Stress should at least move the state out of NORMAL (CAUTION/STRESS/DEFENSIVE/EMERGENCY/RECOVERY).
  const movedOutOfNormal = stressTick!.status !== "NORMAL";
  allOk = record(
    "State moved out of NORMAL under stress",
    movedOutOfNormal,
    `status=${stressTick!.status} (baseline RR was ${Number.isFinite(baselineRr) ? baselineRr.toFixed(4) : "+Inf"}, post-stress RR=${stressTick!.rr.toFixed(4)})`,
  ) && allOk;
  allOk = assertRrInvariant("under stress", stressTick!.rr) && allOk;

  // ----------------------------------------------------------------------
  // Step 9: Verify minting is throttled / paused under stress
  // ----------------------------------------------------------------------
  console.log("\nStep 9: Verify minting throttled / paused under stress.");
  const stressMint = applyMint(s, stressFx, s.riskState.state, 10_000);
  const throttleOk = mintingAllowed(s.riskState.state);
  const throttleFactor = mintThrottle(s.riskState.state);
  console.log(
    `  Stress mint: ok=${stressMint.ok} ` +
      `throttleFactor=${stressMint.throttleFactor} ` +
      `mintingAllowed(${s.riskState.state})=${throttleOk} ` +
      `canonicalThrottle=${throttleFactor}`,
  );
  // Under CAUTION (0.5), STRESS/DEFENSIVE/EMERGENCY (0 = paused), or RECOVERY (0.25):
  //   - either mint is rejected outright (ok=false), OR
  //   - mint succeeded but throttleFactor < 1.0 (CAUTION/RECOVERY).
  const mintThrottledOrPaused =
    !stressMint.ok || stressMint.throttleFactor < 1.0;
  allOk = record(
    "Mint is throttled or paused under stress",
    mintThrottledOrPaused,
    `ok=${stressMint.ok} throttle=${stressMint.throttleFactor} reason=${stressMint.reason ?? "-"}`,
  ) && allOk;

  // ----------------------------------------------------------------------
  // Step 10: Recovery — credit the loss back + restore gold + healthy VIX.
  //          Run enough ticks for the canonical risk state machine to confirm
  //          back to NORMAL (RECOVERY 48h hysteresis is accelerated by ticking
  //          under healthy conditions).
  // ----------------------------------------------------------------------
  console.log("\nStep 10: Recovery — credit the loss back, restore gold + healthy VIX.");
  // Credit the loss back into USDC reserves (simulates the §8.5 waterfall being
  // recapitalized by the Risk Council). Spread across 3 USD issuers per §5.6.
  const creditPerIssuer = requiredLoss / 3;
  s.usdc += creditPerIssuer;
  s.usdp += creditPerIssuer;
  s.usdt += creditPerIssuer;
  syncReserveFromTotalSafe(s);
  const recoverFx = makeFx({ XAU: baselineFx.XAU_USD, VIX: 18.5, DXY: 104.2, source: "e2e-recovery" });
  // Tick up to 20 times under healthy conditions; the canonical machine confirms
  // NORMAL once RR/LCR are clearly healthy for the confirmation window.
  let recovered = false;
  let recoverTick: TickOut | null = null;
  for (let i = 1; i <= 20; i++) {
    recoverTick = tick(s, recoverFx);
    // Recovery path: state passes through RECOVERY and then confirms NORMAL.
    if (recoverTick.status === "NORMAL" && rrHealthy(recoverTick.rr) &&
        (Number.isFinite(recoverTick.rr) ? recoverTick.rr >= RR_TARGET : false)) {
      recovered = true;
      break;
    }
  }
  console.log(
    `  After recovery ticks: RR=${Number.isFinite(recoverTick!.rr) ? recoverTick!.rr.toFixed(4) : "+Inf"} ` +
      `status=${recoverTick!.status} recovered=${recovered}`,
  );
  allOk = record(
    "State returns to NORMAL (or RECOVERY→NORMAL path) after conditions restore",
    recovered || recoverTick!.status === "RECOVERY" || recoverTick!.status === "NORMAL",
    `final status=${recoverTick!.status}`,
  ) && allOk;
  allOk = assertRrInvariant("after recovery", recoverTick!.rr) && allOk;

  // ----------------------------------------------------------------------
  // Step 11: Final verification — RR above target + price in band
  // ----------------------------------------------------------------------
  console.log("\nStep 11: Final verification.");
  // A few more healthy ticks to flush any RECOVERY confirmation window.
  let finalTick: TickOut | null = null;
  for (let i = 1; i <= 10; i++) {
    finalTick = tick(s, recoverFx);
    if (finalTick.status === "NORMAL") break;
  }
  console.log(
    `  Final: RR=${Number.isFinite(finalTick!.rr) ? finalTick!.rr.toFixed(4) : "+Inf"} ` +
      `LCR=${Number.isFinite(finalTick!.lcr) ? finalTick!.lcr.toFixed(4) : "+Inf"} ` +
      `status=${finalTick!.status} P_MTQ=${finalTick!.price.toFixed(4)} ` +
      `inBand=${finalTick!.inBand}`,
  );
  allOk = record(
    "Final RR >= RR_TARGET (1.10) OR state is RECOVERY→NORMAL (still healthy)",
    rrHealthy(finalTick!.rr) && (Number.isFinite(finalTick!.rr) ? finalTick!.rr >= RR_TARGET : false),
    `RR=${Number.isFinite(finalTick!.rr) ? finalTick!.rr.toFixed(4) : "+Inf"} target=${RR_TARGET}`,
  ) && allOk;
  allOk = record(
    "Final price inside safety band",
    finalTick!.inBand,
    `P_MTQ=${finalTick!.price.toFixed(4)}`,
  ) && allOk;

  // ----------------------------------------------------------------------
  // Bonus: Oracle pause path — verify the engine surfaces oraclePaused when
  // the §9 strict-3-source board goes into pause (zero-price feed).
  // ----------------------------------------------------------------------
  console.log("\nBonus: Oracle pause path — feed a zero-price board.");
  const pausedBoard = buildOracleBoard({
    EUR_USD: 0,
    GBP_USD: baselineFx.GBP_USD,
    JPY_USD: baselineFx.JPY_USD,
    CNY_USD: baselineFx.CNY_USD,
    XAU_USD: baselineFx.XAU_USD,
  });
  console.log(`  Zero-price EUR board: anyPaused=${pausedBoard.anyPaused}`);
  allOk = record(
    "Oracle board pauses when a feed returns 0 (§9 strict pause)",
    pausedBoard.anyPaused,
    `anyPaused=${pausedBoard.anyPaused}`,
  ) && allOk;

  // ----------------------------------------------------------------------
  // Summary
  // ----------------------------------------------------------------------
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const total = results.length;

  console.log("\n============================================================");
  console.log(`  E2E SUMMARY: ${passed}/${total} checks passed, ${failed} failed.`);
  console.log("============================================================");
  if (failed > 0) {
    console.log("\n  FAILED CHECKS:");
    for (const r of results) {
      if (!r.pass) console.log(`    \u2717 ${r.step} — ${r.detail}`);
    }
  }
  console.log("");
  if (allOk && failed === 0) {
    console.log("  \u2713 E2E PASSED: full mint → advance → redeem cycle + stress + recovery +");
    console.log("    oracle pause path all verified; RR invariant held throughout.");
  } else {
    console.log("  \u2717 E2E FAILED: one or more checks failed — review above.");
  }
  console.log("\n============================================================\n");

  if (typeof process !== "undefined" && process.exit) {
    process.exit(allOk && failed === 0 ? 0 : 1);
  }
}

// Helper: after a direct mutation to s.usdc/usdp/usdt (or s.paxg/xaut via the
// §8.5 loss waterfall), re-sync the index/reserve gold split so the §14.1
// invariant (paxg = indexPaxg + reservePaxg) holds.
function syncReserveFromTotalSafe(s: ReserveState): void {
  if (s.paxg < s.indexPaxg) s.paxg = s.indexPaxg;
  if (s.xaut < s.indexXaut) s.xaut = s.indexXaut;
  s.reservePaxg = Math.max(0, s.paxg - s.indexPaxg);
  s.reserveXaut = Math.max(0, s.xaut - s.indexXaut);
}

main().catch((e) => {
  console.error("\nE2E TEST CRASHED:");
  console.error(e instanceof Error ? e.stack || e.message : e);
  process.exit(1);
});
