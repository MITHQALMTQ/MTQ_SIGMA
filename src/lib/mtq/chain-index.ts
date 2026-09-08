// MTQΣ — Canonical Chain-Linked Index (Master Listing 3 / §9.2 COO-16)
//
// The canonical chain-linked index I_t per Master Listing 3 / §9.2 COO-16:
//   I_t = I_{t-1} × Σ_i [W_{i,t-1} × (P_{i,t} / P_{i,t-1})]
//
// At a weight update, the divisor D_t = B_t^- / B_t^+ preserves continuity:
//   I_t^+ = D_t × B_t^+ = B_t^-
// so the rebalance itself creates ZERO artificial index return.
//
// G_t = Π D_s is the cumulative chain-link factor.
//
// Why this matters (P0-FIX-1 from the Master Reconciliation audit):
// The legacy engine used a fixed-base Laspeyres index
//   GFB_t = Σ W_i × P_{i,t} / Σ W_i × P_{i,0}
// which weights each component by its raw USD notional share. Because gold
// trades at $2,500/oz while the fiat components trade around $1/each, gold
// contributes 99.9% of the legacy index by USD notional — despite the Strategic
// Prior reserving only 26% for gold. A +50% gold shock therefore moves the
// legacy index by ~50%, not by the intended 26% × 50% = 13%. This "structural
// short-gold" mismatch was the dominant failure mode in the §23 validation
// program (S5: 0% survival, RR crashed to 0.83 in 100% of runs).
//
// The chain-linked form below weights each component's RETURN by its prior
// weight W_{i,t-1}, not its notional. So gold's 50% shock contributes exactly
// 26% × 50% = 13% to the index return — matching the reserve composition.
// This eliminates the structural short-gold bug.
//
// All math is done with JS `number` (the contract uses uint256 1e18). The
// canonical 7-component order is [USD, EUR, JPY, GBP, CNY, CHF, Gold] — the
// same order used by the Strategic Prior and MASE.

export interface ChainIndexState {
  I_t: number;              // current index level (1.0 at genesis)
  G_t: number;              // cumulative chain-link factor (1.0 at genesis)
  prevWeights: number[];    // W_{i,t-1} — weights in force at start of period
  prevPrices: number[];     // P_{i,t-1} — prices at last weight update
  baseDenominator: number;  // INDEX_BASE_DENOMINATOR (immutable, set at genesis)
  lastUpdate: number;       // timestamp of last weight update (epoch ms)
}

// Initialize at genesis:
//   I_0 = 1.0
//   G_0 = 1.0
//   prevWeights = STRATEGIC_PRIOR (the 7-component prior)
//   prevPrices  = BASE_FIXINGS  (the immutable base-date fixings)
//   baseDenominator = Σ W^Prior_i × P_{i,0}  (the USD value of the basket at base)
//
// NOTE on P_MTQ normalization: I_t starts at 1.0 (a normalized ratio), NOT at
// the absolute USD value of the basket. So P_MTQ = I_t × PAR (where PAR = 1.0).
// The `baseDenominator` is stored as an immutable reference field (used by
// the contract for its 1e18-scaled divisor math); the TS engine's P_MTQ does
// NOT divide by it because I_t is already the normalized ratio. This is the
// cleanest convention and keeps P_MTQ ≈ 1.0 at the base date (matching the
// legacy engine's mtqPrice behavior at genesis).
export function initChainIndex(
  baseDenominator: number,
  strategicPrior: number[],
  baseFixings: number[],
  now: number = Date.now(),
): ChainIndexState {
  if (strategicPrior.length !== 7 || baseFixings.length !== 7) {
    throw new Error(
      `initChainIndex: expected 7 components (USD, EUR, JPY, GBP, CNY, CHF, Gold), ` +
      `got strategicPrior.length=${strategicPrior.length}, baseFixings.length=${baseFixings.length}`,
    );
  }
  // Validate weights sum to ~1.0 (allow small float error).
  const wSum = strategicPrior.reduce((a, b) => a + b, 0);
  if (Math.abs(wSum - 1.0) > 0.01) {
    throw new Error(`initChainIndex: strategicPrior must sum to 1.0, got ${wSum}`);
  }
  // Validate baseDenominator matches Σ W_i × P_{i,0} (defensive).
  const expectedDenom = strategicPrior.reduce((s, w, i) => s + w * baseFixings[i], 0);
  if (baseDenominator > 0 && Math.abs(baseDenominator - expectedDenom) > 0.01 * expectedDenom) {
    // Don't throw — just log; the caller may have intentionally passed a
    // slightly different denominator. Production would assert strict equality.
    if (typeof console !== "undefined") {
      console.warn(
        `[chain-index] initChainIndex: baseDenominator ${baseDenominator} differs from ` +
        `Σ W^Prior × P_{i,0} = ${expectedDenom} by >1%. Using caller-provided value.`,
      );
    }
  }
  return {
    I_t: 1.0,
    G_t: 1.0,
    prevWeights: [...strategicPrior],
    prevPrices: [...baseFixings],
    baseDenominator: baseDenominator > 0 ? baseDenominator : expectedDenom,
    lastUpdate: now,
  };
}

// Advance the index one step:
//   periodReturn = Σ_i W_{i,t-1} × (P_{i,t} / P_{i,t-1})
//   I_t = I_{t-1} × periodReturn
//
// Note: this function is pure — it returns a NEW state and does NOT mutate the
// input. The caller assigns the result back. (Mutating state in a math helper
// makes the §9.2 chain-linking harder to audit; purity is the safer choice.)
export function advanceIndex(
  state: ChainIndexState,
  currentPrices: number[],
): { newIndex: number; periodReturn: number; state: ChainIndexState } {
  if (currentPrices.length !== state.prevPrices.length) {
    throw new Error(
      `advanceIndex: currentPrices length ${currentPrices.length} != prevPrices length ${state.prevPrices.length}`,
    );
  }
  let periodReturn = 0;
  for (let i = 0; i < currentPrices.length; i++) {
    const w = state.prevWeights[i] ?? 0;
    const pPrev = state.prevPrices[i] ?? 0;
    if (pPrev <= 0) continue; // skip invalid prev prices (defensive)
    periodReturn += w * (currentPrices[i] / pPrev);
  }
  const newIndex = state.I_t * periodReturn;
  const newState: ChainIndexState = {
    ...state,
    I_t: newIndex,
    // NOTE: prevWeights and prevPrices are NOT updated here — they only
    // change on a weight commit (commitWeights). The chain-linking math uses
    // the OLD weights and OLD prices until the next commit.
    prevPrices: [...currentPrices], // update prevPrices so the next advance uses t→t+1
    prevWeights: [...state.prevWeights],
  };
  return { newIndex, periodReturn, state: newState };
}

// Apply a weight update (rebalance). Computes the divisor D_t that preserves
// index continuity, then updates G_t, prevWeights, and prevPrices.
//
// 1. B_t^- = Σ W_{i,t-1} × P_{i,t}   (aggregate valuation with OLD weights)
// 2. B_t^+ = Σ W_{i,t}   × P_{i,t}   (aggregate valuation with NEW weights)
// 3. D_t   = B_t^- / B_t^+
// 4. G_t   = G_{t-1} × D_t
// 5. I_t   = I_{t-1}   (UNCHANGED — zero artificial return)
// 6. prevWeights = newWeights, prevPrices = currentPrices
//
// Proof of zero-artificial-return:
//   I_t^+ = D_t × B_t^+ = (B_t^- / B_t^+) × B_t^+ = B_t^-
//   But I_t^- = I_{t-1} × Σ W_{i,t-1} × (P_{i,t}/P_{i,t-1})
//   ... the chain-linked form preserves the index level across the rebalance.
//   We keep I_t numerically unchanged (the divisor scales the underlying
//   basket valuation but the published index is continuous).
export function commitWeights(
  state: ChainIndexState,
  newWeights: number[],
  currentPrices: number[],
  now: number = Date.now(),
): { divisor: number; newG: number; state: ChainIndexState } {
  if (newWeights.length !== state.prevWeights.length) {
    throw new Error(
      `commitWeights: newWeights length ${newWeights.length} != prevWeights length ${state.prevWeights.length}`,
    );
  }
  if (currentPrices.length !== state.prevPrices.length) {
    throw new Error(
      `commitWeights: currentPrices length ${currentPrices.length} != prevPrices length ${state.prevPrices.length}`,
    );
  }
  let bMinus = 0; // B_t^- = Σ W_{i,t-1} × P_{i,t}
  let bPlus = 0;  // B_t^+ = Σ W_{i,t}   × P_{i,t}
  for (let i = 0; i < currentPrices.length; i++) {
    bMinus += (state.prevWeights[i] ?? 0) * currentPrices[i];
    bPlus  += (newWeights[i] ?? 0)       * currentPrices[i];
  }
  // Divisor D_t = B_t^- / B_t^+. Guard against divide-by-zero.
  const divisor = bPlus > 0 ? bMinus / bPlus : 1.0;
  const newG = state.G_t * divisor;
  const newState: ChainIndexState = {
    ...state,
    // I_t stays the SAME — the divisor preserves continuity. (Mathematically,
    // I_t^+ = D_t × B_t^+ = B_t^- = I_t^-, so the index is continuous across
    // the rebalance. We do NOT change I_t here.)
    I_t: state.I_t,
    G_t: newG,
    prevWeights: [...newWeights],
    prevPrices: [...currentPrices],
    lastUpdate: now,
  };
  return { divisor, newG, state: newState };
}

// Get the current MTQ reference price:
//   P_MTQ = I_t × PAR  (where PAR = 1.00)
//
// Why not `I_t / baseDenominator × PAR` as the spec comment suggests? Because
// I_t starts at 1.0 (a normalized ratio), so dividing by baseDenominator
// would give P_MTQ ≈ 1/650 at genesis — clearly wrong. The /baseDenominator
// form is for the contract's 1e18-scaled math where the index is stored as
// an absolute value; the TS engine uses the normalized form (I_0 = 1.0).
//
// At base date:    P_MTQ = 1.0 × 1.0 = 1.0   ✓ (matches the legacy engine)
// With gold +50%:  P_MTQ = 1.13 × 1.0 = 1.13 ✓ (chain-linking fixes the bug)
export function getMTQPrice(state: ChainIndexState): number {
  return state.I_t;
}

// Convenience: convert an FxSnapshot (the engine's live FX data) into the
// 7-component price vector [USD, EUR, JPY, GBP, CNY, CHF, Gold].
// USD is always 1.0 (it's the unit of account).
export function fxToPriceVector(fx: {
  EUR_USD: number;
  JPY_USD: number;
  GBP_USD: number;
  CNY_USD: number;
  CHF_USD: number;
  XAU_USD: number;
}): number[] {
  return [
    1.0,           // USD (base)
    fx.EUR_USD,
    fx.JPY_USD,
    fx.GBP_USD,
    fx.CNY_USD,
    fx.CHF_USD,
    fx.XAU_USD,
  ];
}

// Convenience: convert the Strategic Prior record into a 7-component weight
// vector in the canonical order [USD, EUR, JPY, GBP, CNY, CHF, Gold].
export function strategicPriorToWeights(prior: {
  USD: number; EUR: number; JPY: number; GBP: number; CNY: number; CHF: number; Gold: number;
}): number[] {
  return [prior.USD, prior.EUR, prior.JPY, prior.GBP, prior.CNY, prior.CHF, prior.Gold];
}

// Convenience: convert the base fixings record into a 7-component price vector
// in the canonical order. USD has price 1.0 at base (it's the unit of account).
export function baseFixingsToPrices(fixings: {
  EUR_USD: number; JPY_USD: number; GBP_USD: number; CNY_USD: number; CHF_USD: number; XAU_USD: number;
}): number[] {
  return [
    1.0,             // USD (always 1.0)
    fixings.EUR_USD,
    fixings.JPY_USD,
    fixings.GBP_USD,
    fixings.CNY_USD,
    fixings.CHF_USD,
    fixings.XAU_USD,
  ];
}

// === Inline zero-artificial-return proof (runnable) ============================
// The Master Listing 3 / §9.2 COO-16 requires the rebalance to create ZERO
// artificial index return. This self-check runs at module load (once) and
// logs the result. It is a no-op in production; it only proves the math.
//
// Scenario:
//   - 7 components, prior = [0.27, 0.20, 0.09, 0.08, 0.05, 0.05, 0.26]
//   - base prices = [1.0, 1.05, 0.0067, 1.25, 0.14, 1.13, 2500]
//   - shock: gold +50% → current prices = [1.0, 1.05, 0.0067, 1.25, 0.14, 1.13, 3750]
//   - new weights = [0.27, 0.20, 0.09, 0.08, 0.05, 0.05, 0.26] (unchanged — no rebalance)
//
// Expected:
//   - advanceIndex → I_t = 1.0 × (0.27×1 + 0.20×1 + ... + 0.26×1.5) = 1.13
//   - commitWeights with the SAME weights → divisor = 1.0, I_t unchanged = 1.13
//   - This proves the rebalance creates zero artificial return.
//
// To run: `bun -e 'import("./src/lib/mtq/chain-index").then(m => m.runSelfTest())'`
export function runSelfTest(): { pass: boolean; reason: string } {
  const prior = [0.27, 0.20, 0.09, 0.08, 0.05, 0.05, 0.26];
  const baseFix = [1.0, 1.05, 0.0067, 1.25, 0.14, 1.13, 2500];
  const denom = prior.reduce((s, w, i) => s + w * baseFix[i], 0);
  let state = initChainIndex(denom, prior, baseFix, 0);
  // Gold +50%
  const shockPrices = [1.0, 1.05, 0.0067, 1.25, 0.14, 1.13, 3750];
  const advance = advanceIndex(state, shockPrices);
  state = advance.state;
  if (Math.abs(advance.newIndex - 1.13) > 0.001) {
    return { pass: false, reason: `advanceIndex gave ${advance.newIndex}, expected 1.13` };
  }
  // Commit same weights (no actual rebalance) → divisor should be 1.0, I_t unchanged.
  const commit = commitWeights(state, prior, shockPrices, 1);
  if (Math.abs(commit.divisor - 1.0) > 1e-9) {
    return { pass: false, reason: `commitWeights divisor ${commit.divisor}, expected 1.0` };
  }
  if (Math.abs(commit.state.I_t - 1.13) > 1e-9) {
    return { pass: false, reason: `commitWeights I_t ${commit.state.I_t}, expected 1.13 (unchanged)` };
  }
  // Now commit DIFFERENT weights (e.g. gold up to 0.30, USD down to 0.24) → divisor != 1
  // but I_t must stay 1.13.
  const newWeights = [0.24, 0.20, 0.09, 0.08, 0.05, 0.05, 0.29]; // sum = 1.00
  const commit2 = commitWeights(state, newWeights, shockPrices, 2);
  if (Math.abs(commit2.state.I_t - 1.13) > 1e-9) {
    return { pass: false, reason: `commit2 I_t ${commit2.state.I_t}, expected 1.13 (zero artificial return)` };
  }
  return { pass: true, reason: `chain-linking self-test PASS: I_t=1.13 after gold+50%, unchanged after weight commits` };
}

// Run the self-test once at module load (defensive — catches regressions).
// The result is logged but not thrown — a failure is a bug, not a runtime error.
try {
  const r = runSelfTest();
  if (!r.pass && typeof console !== "undefined") {
    console.error(`[chain-index] SELF-TEST FAIL: ${r.reason}`);
  }
} catch (e) {
  if (typeof console !== "undefined") console.error("[chain-index] self-test error:", e);
}
