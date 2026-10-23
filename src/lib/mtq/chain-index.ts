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
// === v2.0 §9.3 / COO-17 — PINNED DIVISOR BASIS (BASE-RELATIVE) ===============
// Blueprint v2.0 §9.3 (L3672–3733) leaves the valuation basis of B_t^± open
// ("raw USD values of the two compositions, or base-relative aggregates
// against the genesis fixings") and pins it as COO-17 deliverable (ii).
// Listing 3 (§9.8, L4163–4662) and the deployed-source reference
// MTQSigmaV3.sol commitWeights (L1384–1407) PIN THE BASE-RELATIVE basis:
//
//   rel_i  = P_{i,t} / P_{i,0}                (price relative vs genesis fixings)
//   B_t^-  = Σ W_{i,t-1} × rel_i              (old composition, valued at base)
//   B_t^+  = Σ W_{i,t}   × rel_i              (new composition, valued at base)
//   D_t    = B_t^- / B_t^+ ;  G_t = G_{t-1} × D_t   (Listing 3 chainLinkDivisor)
//
// D_t is RECORDED-NOT-APPLIED: under the §9.2 recursion the level is already
// continuous; multiplying D_t into I_t as well would double-count (Listing 3
// updateIndex comment: "RECORDED and published, NOT multiplied into
// indexValue — ... The cumulative divisor exists for the NAV-form
// reconciliation (§9.1, COO-17)"). Every applied D_t is published with its
// B^± pair (§9.3: the ChainLinkAdjusted event payload); this module keeps
// the equivalent per-update record series (bounded, see MAX_DIVISOR_HISTORY).
//
// BASIS SWITCH (disclosed, not silent): the TS commitWeights/replaceComponent
// previously valued B^± in RAW USD (Σ W_i × P_{i,t}). That basis is SUPERSEDED
// — evidence preserved in git history + audit records; both bases deliver the
// same zero-artificial-return guarantee, but they produce DIFFERENT numeric
// D_t/G_t series for the same history, so the published G_t series now
// follows the v2.0/V3 convention. Each record carries its basis label.
//
// === §9.1 / COO-17 — getNavForm reconciliation hook ==========================
// The §9.1 aggregate form NAV_t = G_t × Σ_i W_{i,t} (P_{i,t}/P_{i,0}) and the
// §9.2 recursion are different mathematical objects (v2.0 L3606–3609); the
// reconciliation lands in G_t. getNavForm() below returns the full §9.1
// component set so COO-17 reconciliation is executable from the app: the raw
// value aggregate (Listing 3 getNavForm()), the implied normalization factor
// G_t = I_t / NAV_t (Listing 3 @dev note), the recorded cumulative Π D_t, and
// the residual between the two G senses.
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
//
// M8-3a: the constituency registry import below is CLIENT-SAFE (pure data —
// no node:crypto anywhere in constituency/registry.ts) because this module is
// imported by client components (TransparencySection.tsx).
import { defaultActiveBasketCount } from "./constituency/registry";

// === v2.0 §9.3 / COO-17 — divisor publication types ========================
/** Valuation basis of B_t^±. PINNED to "base-relative" per Listing 3 (§9.8)
 *  and MTQSigmaV3.sol commitWeights L1384–1407. The "raw-usd" basis is the
 *  superseded pre-v2.0 TS convention (evidence preserved; disclosed in
 *  honest-status D-chainlink-divisor) — kept in the union so historical
 *  records can carry their true basis label. */
export type DivisorBasis = "base-relative" | "raw-usd";

/** The pinned basis (COO-17 deliverable (ii)). */
export const DIVISOR_BASIS: DivisorBasis = "base-relative";

/** The superseded pre-v2.0 TS basis — NEVER used for new records; exists so
 *  the switch is documented in code, not erased. */
export const SUPERSEDED_DIVISOR_BASIS: DivisorBasis = "raw-usd";

/** Bounded per-update divisor series: the last MAX_DIVISOR_HISTORY applied
 *  D_t records are retained (§9.3 publication obligation; the bound is
 *  itself disclosed — see divisorCommitCount for the full count). */
export const MAX_DIVISOR_HISTORY = 50;

/** One applied chain-link adjustment — the TS equivalent of the on-chain
 *  ChainLinkAdjusted(D, bMinus, bPlus, timestamp) event (Listing 3 / V3
 *  L508). B^± are BASE-RELATIVE aggregates: Σ W × (P_{i,t}/P_{i,0}). The
 *  "carry-forward" kind is a PILOT-ONLY bookkeeping record: when a live
 *  in-memory state predates the basis pinning, its pre-switch accumulated G
 *  (computed under the SUPERSEDED raw-USD basis) is carried as ONE labeled
 *  factor instead of being silently dropped or silently re-based — the
 *  pre-switch era has no per-update records (the superseded implementation
 *  kept none), so B^± are null on that record. */
export interface ChainLinkRecord {
  /** epoch ms of the commit */
  at: number;
  /** D_t = B_t^- / B_t^+ (recorded-not-applied — see commitWeights). For a
   *  carry-forward record: the carried cumulative factor itself. */
  D: number;
  /** B_t^- = Σ W_{i,t-1} × (P_{i,t}/P_{i,0}); null on carry-forward records
   *  (no B^± pair exists for a summarized pre-switch segment). */
  bMinus: number | null;
  /** B_t^+ = Σ W_{i,t} × (P_{i,t}/P_{i,0}); null on carry-forward records. */
  bPlus: number | null;
  /** basis this record was computed under (per-record — honest history): the
   *  pinned "base-relative" for new records; "raw-usd" ONLY on carry-forward
   *  records summarizing the superseded pre-switch era. */
  basis: DivisorBasis;
  /** weight-commit (§9.3 rebalance) | succession (§3.3/§21.5 swap)
   *  | carry-forward (pilot-only pre-switch G summary) */
  kind: "weight-commit" | "succession" | "carry-forward";
}

export interface ChainIndexState {
  I_t: number;              // current index level (1.0 at genesis)
  G_t: number;              // cumulative chain-link factor (1.0 at genesis) = Π D_s
  prevWeights: number[];    // W_{i,t-1} — weights in force at start of period
  prevPrices: number[];     // P_{i,t-1} — prices at last weight update
  baseDenominator: number;  // INDEX_BASE_DENOMINATOR (immutable, set at genesis)
  lastUpdate: number;       // timestamp of last weight update (epoch ms)
  // === COO-17 (v2.0 §9.1/§9.3) — base-relative divisor machinery ============
  /** P_{i,0} — the immutable per-slot genesis base fixings (§3.4) that anchor
   *  the base-relative B^± basis. Snapshotted once at initChainIndex and NEVER
   *  rewritten. OPTIONAL/NULLABLE only for backward compatibility with states
   *  created (or round-tripped through the snapshot) before the basis pinning
   *  (HMR-stale stores) — callers heal it from the genesis BASE_FIXINGS
   *  (engine commitChainIndexWeights does exactly that). */
  basePrices?: number[] | null;
  /** Bounded per-update D_t/B^± record series (§9.3), newest last. */
  divisorHistory?: ChainLinkRecord[];
  /** Total D_t applications since genesis — audits the bounded window
   *  (retained records ≤ this count ⇒ older records were dropped). */
  divisorCommitCount?: number;
  /** Basis the recorded series was computed under (pinned at init). */
  divisorBasis?: DivisorBasis;
}

/** Append `rec` to the bounded per-update series (drops the OLDEST record
 *  when the window is full — the bound is disclosed via divisorCommitCount). */
function appendDivisorRecord(
  hist: ChainLinkRecord[] | undefined,
  rec: ChainLinkRecord,
): ChainLinkRecord[] {
  const cur = hist ?? [];
  const out =
    cur.length >= MAX_DIVISOR_HISTORY
      ? cur.slice(cur.length - MAX_DIVISOR_HISTORY + 1)
      : [...cur];
  out.push(rec);
  return out;
}

/** Resolve the base fixings P_{i,0} for the base-relative divisor math.
 *  Warns (never silently) when a pre-pinning state lacks them. */
function resolveBasePrices(state: ChainIndexState): number[] {
  if (state.basePrices && state.basePrices.length === state.prevPrices.length) {
    return state.basePrices;
  }
  if (typeof console !== "undefined") {
    console.warn(
      "[chain-index] state carries no basePrices (P_{i,0}) — it predates the " +
        "COO-17 base-relative basis pinning. Falling back to prevPrices (WRONG " +
        "anchor after the first commit); the caller should heal the state " +
        "from the genesis BASE_FIXINGS (engine commitChainIndexWeights does).",
    );
  }
  return state.prevPrices;
}

// === §9.4 Contribution Mathematics + §9.5 Attribution Engine ================
// EQ-072..EQ-075 (equation-by-equation audit): previously absent from the
// engine while the UI chart used synthetic data. Implemented verbatim from
// the blueprint:
//
//   Contribution_i = W_{i,t-1} × (P_{i,t} / P_{i,t-1} − 1)        (§9.4)
//   R_MTQ,t        = Σ_i Contribution_i                            (§9.4 — exact
//                    by construction: the divisor D_t guarantees the
//                    compositional change contributes exactly zero)
//
//   Movement effect   = Σ contributions — the market's contribution with
//                        weights held at start-of-period values (§9.5)
//   Allocation effect = Σ_i (W_{i,t-1} − W^Prior_i) × (r_i − 1) — the value
//                        added/subtracted by the weight choice measured
//                        against the strategic-prior baseline (§9.5)
//   Rebalancing effect= 0 on the INDEX side by divisor design (§9.3): a
//                        nonzero rebalancing effect in the published
//                        attribution reflects realized execution behavior,
//                        not index arithmetic (§9.5)
//   Cost effect       = realized execution friction of the period (fees +
//                        slippage + gas + impact — the §10.8 Cost_i
//                        decomposition), fed in by the engine (§9.5)
export interface IndexAttribution {
  /** Per-component §9.4 contributions, canonical order
   *  [USD, EUR, JPY, GBP, CNY, CHF, Gold]. Σ = indexReturn exactly. */
  contributions: number[];
  /** Period return R_MTQ,t = Σ W_{i,t-1} × (P_{i,t}/P_{i,t-1}) — the level
   *  multiplier. indexReturnPct = R − 1. */
  periodReturn: number;
  indexReturnPct: number;
  /** §9.5 effect separation (index-side arithmetic; costEffect is fed from
   *  the engine's realized execution ledger). */
  movementEffectPct: number;
  allocationEffectPct: number;
  /** Always 0 in the index arithmetic — the divisor neutralizes composition
   *  (§9.3); published so auditors can verify the invariant every period. */
  rebalancingEffectPct: number;
  /** Realized execution friction (USD) over the attribution window —
   *  populated by the engine from its trade ledger (§10.8 Cost_i). */
  costEffectUsd: number;
  sampledAt: number;
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
//
// M8-3a (2026-10-23, owner-delegated) — REGISTRY-MEMBERSHIP-LENGTH VALIDATION
// replaces the former fixed-`!== 7` literal throw (the documented design gap,
// audit-work/task13/evidence/dynamic-replacement/RESULTS.md §2.2 item 3). The
// expected component count now comes from the constituency component registry
// (src/lib/mtq/constituency/registry.ts — the Map-keyed stable-ID registry
// whose ACTIVE set IS the basket membership), so an arbitrary registered-set
// length is admissible when the caller declares it. DEFAULT BEHAVIOR IS
// BYTE-IDENTICAL to the pre-M8-3a engine: the default registry initializes to
// the 7-component genesis set (USD/EUR/JPY/GBP/CNY/CHF/Gold), so the default
// expected length is 7 and every existing call site (7 prior + 7 fixings)
// passes exactly as before. The count is a REGISTRY property, never a
// compile-time constant — membership can grow/shrink only through the
// evidence-checked lifecycle transitions in constituency/engine.ts (no
// governance directive ⇒ no membership change).
export interface InitChainIndexOptions {
  /** Registry-membership validation: the number of ACTIVE basket components
   *  the vectors are expected to carry. Default: the ACTIVE count of the
   *  default constituency registry (7 for the genesis set). Pass an explicit
   *  count when initializing over a non-default registered set (e.g. a
   *  registry snapshot with a different ACTIVE membership after lifecycle
   *  transitions). */
  expectedActiveCount?: number;
}
export function initChainIndex(
  baseDenominator: number,
  strategicPrior: number[],
  baseFixings: number[],
  now: number = Date.now(),
  options: InitChainIndexOptions = {},
): ChainIndexState {
  const expectedComponents = options.expectedActiveCount ?? defaultActiveBasketCount();
  if (strategicPrior.length !== expectedComponents || baseFixings.length !== expectedComponents) {
    throw new Error(
      `initChainIndex: expected ${expectedComponents} components (the ACTIVE membership count of the ` +
      `constituency registry${options.expectedActiveCount == null ? " — 7 for the default genesis set USD, EUR, JPY, GBP, CNY, CHF, Gold" : ""}), ` +
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
    // COO-17: snapshot the immutable P_{i,0} (at genesis prevPrices ARE the
    // base fixings) + open the bounded per-update divisor ledger.
    basePrices: [...baseFixings],
    divisorHistory: [],
    divisorCommitCount: 0,
    divisorBasis: DIVISOR_BASIS,
  };
}

// Advance the index one step:
//   periodReturn = Σ_i W_{i,t-1} × (P_{i,t} / P_{i,t-1})
//   I_t = I_{t-1} × periodReturn
//
// EQ-072..073 (§9.4): the result now carries the per-component contributions
//   Contribution_i = W_{i,t-1} × (P_{i,t}/P_{i,t-1} − 1)
// which sum EXACTLY to (periodReturn − 1) by construction — the additivity
// property the §9.5 attribution engine depends on.
//
// Note: this function is pure — it returns a NEW state and does NOT mutate the
// input. The caller assigns the result back. (Mutating state in a math helper
// makes the §9.2 chain-linking harder to audit; purity is the safer choice.)
export function advanceIndex(
  state: ChainIndexState,
  currentPrices: number[],
): { newIndex: number; periodReturn: number; contributions: number[]; state: ChainIndexState } {
  if (currentPrices.length !== state.prevPrices.length) {
    throw new Error(
      `advanceIndex: currentPrices length ${currentPrices.length} != prevPrices length ${state.prevPrices.length}`,
    );
  }
  let periodReturn = 0;
  const contributions: number[] = new Array(currentPrices.length).fill(0);
  for (let i = 0; i < currentPrices.length; i++) {
    const w = state.prevWeights[i] ?? 0;
    const pPrev = state.prevPrices[i] ?? 0;
    if (pPrev <= 0) continue; // skip invalid prev prices (defensive)
    const rel = currentPrices[i] / pPrev;
    periodReturn += w * rel;
    contributions[i] = w * (rel - 1); // §9.4 Contribution_i
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
  return { newIndex, periodReturn, contributions, state: newState };
}

/** §9.5 Attribution — build the full effect decomposition for the period
 *  [prevPrices → currentPrices] from the index state alone (pure; no
 *  mutation). `costEffectUsd` is the realized execution friction over the
 *  window (the engine owns that ledger and passes it in; 0 when unknown).
 *  `priorWeights` is the strategic-prior baseline for the allocation effect
 *  (defaults to the state's base prior = prevWeights at genesis). */
export function computeAttribution(
  state: ChainIndexState,
  currentPrices: number[],
  opts?: { costEffectUsd?: number; priorWeights?: number[]; now?: number },
): IndexAttribution {
  if (currentPrices.length !== state.prevPrices.length) {
    throw new Error(
      `computeAttribution: currentPrices length ${currentPrices.length} != prevPrices length ${state.prevPrices.length}`,
    );
  }
  const prior = opts?.priorWeights ?? state.prevWeights;
  let periodReturn = 0;
  const contributions: number[] = new Array(currentPrices.length).fill(0);
  let allocationEffect = 0;
  for (let i = 0; i < currentPrices.length; i++) {
    const w = state.prevWeights[i] ?? 0;
    const pPrev = state.prevPrices[i] ?? 0;
    if (pPrev <= 0) continue;
    const rel = currentPrices[i] / pPrev;
    periodReturn += w * rel;
    contributions[i] = w * (rel - 1);                 // §9.4
    allocationEffect += (w - (prior[i] ?? 0)) * (rel - 1); // §9.5 vs prior baseline
  }
  return {
    contributions,
    periodReturn,
    indexReturnPct: periodReturn - 1,
    movementEffectPct: periodReturn - 1, // Σ contributions (§9.5)
    allocationEffectPct: allocationEffect,
    rebalancingEffectPct: 0,             // divisor-neutralized by design (§9.3)
    costEffectUsd: opts?.costEffectUsd ?? 0,
    sampledAt: opts?.now ?? Date.now(),
  };
}

// Apply a weight update (rebalance). Computes the chain-link divisor D_t that
// preserves index continuity, records it, then updates G_t, prevWeights, and
// prevPrices — EXACTLY the Listing 3 (§9.8) / MTQSigmaV3.sol commitWeights
// (L1384–1407) convention:
//
// 1. rel_i  = P_{i,t} / P_{i,0}      (BASE-RELATIVE price relative — the
//                                     pinned basis, COO-17 deliverable (ii))
// 2. B_t^-  = Σ W_{i,t-1} × rel_i    (old composition, valued against base)
// 3. B_t^+  = Σ W_{i,t}   × rel_i    (new composition, valued against base)
// 4. D_t    = B_t^- / B_t^+
// 5. G_t    = G_{t-1} × D_t          (cumulative — Listing 3 chainLinkDivisor)
// 6. I_t    = I_{t-1}  (UNCHANGED — D_t is RECORDED-NOT-APPLIED: under the §9.2
//                      recursion the level is already continuous; applying D_t
//                      here as well would double-count the adjustment)
// 7. prevWeights = newWeights, prevPrices = currentPrices
//
// Zero-artificial-return: I_t^+ = D_t × B_t^+ = B_t^- by construction, and the
// published level never moves in this function. Both B^± are valued at the
// same post-move prices, so D_t isolates the pure compositional change (§9.3).
//
// BASIS SWITCH (COO-17, disclosed): B^± were previously RAW-USD aggregates
// (Σ W_i × P_{i,t}); that superseded basis yields a different numeric D_t/G_t
// series for the same history. The pinned v2.0/V3 basis is base-relative; the
// superseded basis is preserved as SUPERSEDED_DIVISOR_BASIS and disclosed in
// honest-status (never silently erased).
//
// Per Listing 3/V3, a record is emitted ONLY when a weight actually changed
// (ChainLinkAdjusted fires on change — a D=1 no-op commit publishes nothing).
export function commitWeights(
  state: ChainIndexState,
  newWeights: number[],
  currentPrices: number[],
  now: number = Date.now(),
): {
  divisor: number;
  newG: number;
  /** B_t^- = Σ W_{i,t-1} × (P_{i,t}/P_{i,0}) — base-relative (§9.3) */
  bMinus: number;
  /** B_t^+ = Σ W_{i,t} × (P_{i,t}/P_{i,0}) — base-relative (§9.3) */
  bPlus: number;
  /** true when any weight actually changed (Listing 3 `changed` flag) */
  changed: boolean;
  /** the published per-update record (null on no-op / degenerate commits) */
  record: ChainLinkRecord | null;
  state: ChainIndexState;
} {
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
  const base = resolveBasePrices(state);
  let bMinus = 0; // B_t^- = Σ W_{i,t-1} × (P_{i,t}/P_{i,0})
  let bPlus = 0;  // B_t^+ = Σ W_{i,t}   × (P_{i,t}/P_{i,0})
  let changed = false;
  for (let i = 0; i < currentPrices.length; i++) {
    const b0 = base[i] ?? 0;
    if (!(b0 > 0)) {
      // Defensive (impossible with genesis fixings): skip rather than divide
      // by 0 — advanceIndex uses the same defensive skip for bad prev prices.
      continue;
    }
    const rel = (currentPrices[i] ?? 0) / b0; // P_{i,t} / P_{i,0} (Listing 3 rel)
    bMinus += (state.prevWeights[i] ?? 0) * rel;
    bPlus  += (newWeights[i] ?? 0)       * rel;
    if (newWeights[i] !== state.prevWeights[i]) changed = true;
  }
  // Divisor D_t = B_t^- / B_t^+. Guard against divide-by-zero (V3 reverts
  // Err57 here; the TS pilot records no divisor and keeps continuity).
  const divisor = bPlus > 0 ? bMinus / bPlus : 1.0;
  const newG = state.G_t * divisor;
  const record: ChainLinkRecord | null =
    changed && bPlus > 0
      ? { at: now, D: divisor, bMinus, bPlus, basis: DIVISOR_BASIS, kind: "weight-commit" }
      : null;
  const newState: ChainIndexState = {
    ...state,
    // I_t stays the SAME — D_t is recorded-not-applied (Listing 3: the
    // recursion level is already continuous; the cumulative divisor exists
    // for the §9.1/COO-17 NAV-form reconciliation).
    I_t: state.I_t,
    G_t: newG,
    prevWeights: [...newWeights],
    prevPrices: [...currentPrices],
    // P_{i,0} immutable — carried forward, never rewritten.
    basePrices: base,
    divisorHistory: record
      ? appendDivisorRecord(state.divisorHistory, record)
      : state.divisorHistory ?? [],
    divisorCommitCount: (state.divisorCommitCount ?? 0) + (record ? 1 : 0),
    divisorBasis: DIVISOR_BASIS,
    lastUpdate: now,
  };
  return { divisor, newG, bMinus, bPlus, changed, record, state: newState };
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

// === §3.3 / §21.5 — Constituency Succession ================================
// When a component loses eligibility (depeg, issuer freeze, sanctions, loss
// of convertibility) it is EJECTED from the reference basket, and — after
// governance — a successor currency from the candidate universe can take its
// place. Both the removal AND the admission must create ZERO artificial index
// return: holders' purchasing power must not jump because the constituency
// changed. The chain-link divisor achieves exactly this — under the SAME
// base-relative basis pinned for weight commits (Listing 3/V3; see the
// commitWeights header). Successor-slot convention (TS-pinned extension —
// neither Listing 3 nor V3 implements succession, so this convention is
// disclosed rather than claimed as spec-verbatim): the per-slot base fixing
// P_{0,slot} is IMMUTABLE (§3.4 "immutable base-date fixings"), so the
// successor's relative is quoted against the SLOT's original genesis fixing
// — re-anchoring the slot at the admission price would be a methodology-
// version event (§24.2), not a recalibration:
//
//   rel_i = P_{i,t} / P_{0,i}           (base-relative; ejected slot at its
//                                        LAST VALID / frozen price ⇒ rel = frozen/P_0)
//   rel_succ = successorPrice / P_{0,slot}  (successor vs the slot's fixing)
//   B^- = Σ W_prev_i × rel_i            (old composition)
//   B^+ = Σ W_new_i × rel'_i            (new composition; slot re-priced at the
//                                        successor's ADMISSION quote)
//   D   = B^- / B^+ ;  G ×= D ;  I_t UNCHANGED (recorded-not-applied)
//
// The ejected component's real loss has ALREADY accrued in I_t while its
// price was falling (the index tracked every decline up to the freeze). The
// succession step itself contributes zero — the unit is continuous across
// the constituency change, and from that moment the slot's returns track the
// successor's price.
//
// The successor's SEED weight is a governed parameter (§22 — Risk Council
// within the candidate's admissibility envelope). Remaining components are
// rescaled proportionally so weights still sum to 1:
//   W_new_i = W_prev_i / (1 − W_ejected) × (1 − W_successor)   (i ≠ slot)
//   W_new_slot = W_successor

/** Renormalize a weight vector after excluding `slot` (its weight is dropped
 *  and the remainder is rescaled to sum to exactly 1). Pure — returns a new
 *  array. Used for the ejection-only path (no successor yet): the surviving
 *  components absorb the ejected weight proportionally. */
export function renormalizeExcluding(weights: number[], slot: number): number[] {
  const out = [...weights];
  out[slot] = 0;
  const rest = out.reduce((a, b) => a + b, 0);
  if (rest <= 0) return out;
  for (let i = 0; i < out.length; i++) {
    if (i === slot) continue;
    out[i] = out[i] / rest; // rescale survivors to sum to exactly 1
  }
  return out;
}

/** Atomic constituency succession: the ejected component at `slot` is replaced
 *  by a successor currency quoted at `successorPrice` with governed seed
 *  weight `successorWeight`. Zero artificial return — I_t is unchanged by the
 *  swap itself (the real loss accrued earlier, while the price fell). */
export function replaceComponent(
  state: ChainIndexState,
  slot: number,
  successorPrice: number,
  successorWeight: number,
  currentPrices: number[],
  now: number = Date.now(),
): { divisor: number; newG: number; newWeights: number[]; record: ChainLinkRecord | null; state: ChainIndexState } {
  if (slot < 0 || slot >= state.prevWeights.length) {
    throw new Error(`replaceComponent: slot ${slot} out of range (0..${state.prevWeights.length - 1})`);
  }
  if (currentPrices.length !== state.prevPrices.length) {
    throw new Error(
      `replaceComponent: currentPrices length ${currentPrices.length} != prevPrices length ${state.prevPrices.length}`,
    );
  }
  if (!(successorPrice > 0)) {
    throw new Error(`replaceComponent: successorPrice must be > 0 (got ${successorPrice}) — admit only with a live oracle quote`);
  }
  if (successorWeight < 0 || successorWeight >= 1) {
    throw new Error(`replaceComponent: successorWeight must be in [0,1) (got ${successorWeight})`);
  }
  const ejectedWeight = state.prevWeights[slot] ?? 0;
  const restWeight = 1 - ejectedWeight;
  // Rescale the surviving components into the (1 − successorWeight) share.
  const newWeights = [...state.prevWeights];
  if (restWeight > 0) {
    for (let i = 0; i < newWeights.length; i++) {
      if (i === slot) continue;
      newWeights[i] = (state.prevWeights[i] / restWeight) * (1 - successorWeight);
    }
  }
  newWeights[slot] = successorWeight;

  // Base-relative basis (pinned — see the succession header above). The
  // ejected slot keeps its frozen price in currentPrices; the successor slot
  // is quoted against the SAME per-slot genesis fixing P_{0,slot}.
  const base = resolveBasePrices(state);
  const relOf = (price: number, i: number): number => {
    const b0 = base[i] ?? 0;
    return b0 > 0 ? price / b0 : 0; // P_{i,t} / P_{0,i}
  };
  // B^- : old weights × base-relative prices (ejected at its frozen price)
  let bMinus = 0;
  for (let i = 0; i < currentPrices.length; i++) {
    bMinus += (state.prevWeights[i] ?? 0) * relOf(currentPrices[i] ?? 0, i);
  }
  // B^+ : new weights × base-relative prices with the slot re-priced at the
  // successor quote (still against the slot's own genesis fixing).
  const successorPrices = [...currentPrices];
  successorPrices[slot] = successorPrice;
  let bPlus = 0;
  for (let i = 0; i < successorPrices.length; i++) {
    bPlus += newWeights[i] * relOf(successorPrices[i] ?? 0, i);
  }
  const divisor = bPlus > 0 ? bMinus / bPlus : 1.0;
  const newG = state.G_t * divisor;
  // §9.3: every applied D_t is published — a succession swap is a divisor
  // event too (kind: "succession"), recorded on the same bounded ledger.
  const record: ChainLinkRecord | null =
    bPlus > 0
      ? { at: now, D: divisor, bMinus, bPlus, basis: DIVISOR_BASIS, kind: "succession" }
      : null;
  const newState: ChainIndexState = {
    ...state,
    // I_t UNCHANGED — zero artificial return across the succession (D_t is
    // recorded-not-applied, exactly like a weight commit).
    I_t: state.I_t,
    G_t: newG,
    prevWeights: newWeights,
    prevPrices: successorPrices,
    basePrices: base, // P_{i,0} immutable — the slot fixing is NOT re-anchored
    divisorHistory: record
      ? appendDivisorRecord(state.divisorHistory, record)
      : state.divisorHistory ?? [],
    divisorCommitCount: (state.divisorCommitCount ?? 0) + (record ? 1 : 0),
    divisorBasis: DIVISOR_BASIS,
    lastUpdate: now,
  };
  return { divisor, newG, newWeights, record, state: newState };
}

// === §9.1 / COO-17 — getNavForm: the NAV-equation reconciliation hook =======
// TS equivalent of Listing 3's getNavForm() view (§9.8 L4444–4459) — extended to
// return the FULL §9.1 NAV equation component set so the COO-17 reconciliation
// is executable from the app:
//
//   §9.1:  NAV_t = G_t × Σ_i W_{i,t} × (P_{i,t} / P_{i,0})
//
// Listing 3's getNavForm() returns the Σ term (the raw value aggregate with
// the COMMITTED chain weights and current prices); its @dev note pins the
// normalization factor as G_t = I_t / NAV_t. §9.3 pins the recorded G_t as
// the cumulative product of the D_t factors. These two G senses coincide only
// when no compounding has occurred since the last weight change — v2.0
// L3606–3609: "the aggregate form and the chain-linked recursion are
// different mathematical objects that must be made to produce one published
// I_t, and the divisor mechanism G_t is precisely where that reconciliation
// lives." This hook returns BOTH G senses plus their residual, so the panel
// can publish the reconciliation instead of assuming it.

/** One §9.1 equation term per component. */
export interface NavFormComponentTerm {
  /** canonical slot (0=USD … 6=Gold) */
  index: number;
  /** W_{i,t} — the committed chain weight in force */
  weight: number;
  /** P_{i,t} / P_{i,0} — base-relative price relative */
  relative: number;
  /** W_{i,t} × (P_{i,t}/P_{i,0}) — the component's §9.1 term */
  term: number;
}

/** The full §9.1 NAV-equation component set (COO-17 reconciliation hook). */
export interface NavFormResult {
  /** Basis the recorded divisor series is computed under (pinned). */
  basis: DivisorBasis;
  /** False when the state predates basis pinning and carries no P_{i,0}
   *  (the Σ term then uses prevPrices as the anchor — WRONG after the first
   *  commit; callers should heal the state and re-run). */
  baseFixingsAvailable: boolean;
  /** NAV_t^raw = Σ_i W_{i,t} × (P_{i,t}/P_{i,0}) — the Listing 3 getNavForm()
   *  value aggregate with committed weights + current prices. */
  navRaw: number;
  /** §9.1 NAV_t = G_t^implied × NAV_t^raw — by construction identical to the
   *  published chain-linked level I_t (the equation closes). */
  navReconciled: number;
  /** G_t^implied = I_t / NAV_t^raw — the §9.1 normalization factor implied by
   *  the published recursion level (Listing 3 getNavForm @dev note). */
  gImplied: number;
  /** G_t^recorded = Π D_s — the cumulative chain-link divisor (§9.3 pinned
   *  functional form; = state.G_t). */
  gRecorded: number;
  /** gImplied − gRecorded — the part of the normalization factor NOT explained
   *  by the recorded chain-link history: the compounding difference between
   *  the §9.2 recursion (weighted arithmetic mean of relatives) and the §9.1
   *  value aggregate (ratio of aggregates). PUBLISHED, never absorbed. */
  gResidual: number;
  /** §9.1 aggregate evaluated with the RECORDED G (gRecorded × navRaw) —
 *  differs from I_t by navReconciled − navWithRecordedG = the same residual. */
  navWithRecordedG: number;
  /** I_t — the published chain-linked level (§9.2 recursion, authoritative). */
  indexLevel: number;
  /** W_{i,t} — the committed chain weights used (canonical order). */
  weights: number[];
  /** P_{i,t} / P_{i,0} per component (canonical order). */
  relatives: number[];
  /** Per-component §9.1 terms (canonical order; Σ terms = navRaw). */
  terms: NavFormComponentTerm[];
  /** Latest applied D_t record (null before the first change). */
  latestRecord: ChainLinkRecord | null;
  /** Bounded per-update D_t/B^± series (newest last). */
  history: ChainLinkRecord[];
  /** Retained records vs total D_t applications since genesis. */
  totalDivisorCommits: number;
  /** True when older records were dropped by MAX_DIVISOR_HISTORY. */
  historyTruncated: boolean;
  /** |navReconciled − indexLevel| — the §9.1 equation closure residual. */
  identityResidual: number;
  /** True when identityResidual ≤ tolerance (the §9.1 equation closes). */
  identityCloses: boolean;
  sampledAt: number;
}

/** §9.1 / COO-17 reconciliation hook. Pure — no mutation. Uses the COMMITTED
 *  chain weights (state.prevWeights — the Listing 3 `lastWeights` equivalent)
 *  and the caller-supplied current prices. The on-chain V3 contract does NOT
 *  expose a getNavForm view (adding one would require a contract change,
 *  forbidden under §1 VERIFICATION-ONLY) — this is the APP-LAYER hook over
 *  the shadow-mode chain-link history. */
export function getNavForm(
  state: ChainIndexState,
  currentPrices: number[],
  opts?: { now?: number; tolerance?: number },
): NavFormResult {
  if (currentPrices.length !== state.prevWeights.length) {
    throw new Error(
      `getNavForm: currentPrices length ${currentPrices.length} != prevWeights length ${state.prevWeights.length}`,
    );
  }
  const baseFixingsAvailable = !!(
    state.basePrices &&
    state.basePrices.length === currentPrices.length
  );
  // Never warn here (render-loop safe): a missing anchor is REPORTED via
  // baseFixingsAvailable, and the fallback anchor is prevPrices.
  const base = baseFixingsAvailable ? (state.basePrices as number[]) : state.prevPrices;
  const weights = state.prevWeights; // W_{i,t} — committed chain weights
  const relatives: number[] = [];
  const terms: NavFormComponentTerm[] = [];
  let navRaw = 0;
  for (let i = 0; i < currentPrices.length; i++) {
    const b0 = base[i] ?? 0;
    const rel = b0 > 0 ? (currentPrices[i] ?? 0) / b0 : 0;
    const w = weights[i] ?? 0;
    const term = w * rel;
    relatives.push(rel);
    terms.push({ index: i, weight: w, relative: rel, term });
    navRaw += term;
  }
  const indexLevel = state.I_t;
  const gImplied = navRaw > 0 ? indexLevel / navRaw : Number.NaN;
  const gRecorded = state.G_t;
  const navReconciled = gImplied * navRaw; // = I_t by construction
  const history = state.divisorHistory ?? [];
  const totalDivisorCommits = state.divisorCommitCount ?? history.length;
  const tolerance = opts?.tolerance ?? 1e-9;
  const identityResidual = Math.abs(navReconciled - indexLevel);
  return {
    basis: state.divisorBasis ?? DIVISOR_BASIS,
    baseFixingsAvailable,
    navRaw,
    navReconciled,
    gImplied,
    gRecorded,
    gResidual: gImplied - gRecorded,
    navWithRecordedG: gRecorded * navRaw,
    indexLevel,
    weights: [...weights],
    relatives,
    terms,
    latestRecord: history.length > 0 ? history[history.length - 1] : null,
    history: [...history],
    totalDivisorCommits,
    historyTruncated: history.length < totalDivisorCommits,
    identityResidual,
    identityCloses:
      Number.isFinite(identityResidual) && identityResidual <= tolerance,
    sampledAt: opts?.now ?? Date.now(),
  };
}

/** §9.3 internal-consistency check for the recorded divisor ledger: the
 *  cumulative G_t must equal the product of the RETAINED D_t records
 *  (G_t = G_{t-1} × D_t per Listing 3). Verifiable exactly while the full
 *  history is retained; when the bounded window has dropped records the
 *  check is NOT verifiable from the window alone (consistent = null) — the
 *  UI must disclose that instead of claiming a pass. */
export function verifyDivisorLedger(
  state: ChainIndexState,
  tolerance = 1e-9,
): {
  /** G_t as carried on the state (cumulative). */
  recordedG: number;
  /** Π over the RETAINED records. */
  recomputedG: number;
  /** Retained record count. */
  records: number;
  /** Total D_t applications since genesis. */
  totalCommits: number;
  /** False when the bounded window dropped older records. */
  fullHistoryRetained: boolean;
  /** true = verified; null = NOT verifiable (truncated window). */
  consistent: boolean | null;
} {
  const hist = state.divisorHistory ?? [];
  const total = state.divisorCommitCount ?? hist.length;
  let recomputedG = 1;
  for (const r of hist) recomputedG *= r.D;
  const fullHistoryRetained = hist.length === total;
  const consistent = fullHistoryRetained
    ? Math.abs(recomputedG - state.G_t) <= tolerance
    : null;
  return {
    recordedG: state.G_t,
    recomputedG,
    records: hist.length,
    totalCommits: total,
    fullHistoryRetained,
    consistent,
  };
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
//   - commitWeights with the SAME weights → divisor = 1.0, NO record (Listing 3
//     fires ChainLinkAdjusted only on change), I_t unchanged = 1.13
//   - This proves the rebalance creates zero artificial return.
//
// COO-17 base-relative checks (v2.0 §9.3 / Listing 3 / V3 L1384–1407):
//   - a CHANGED commit records D_t/B^± on the bounded ledger with basis
//     'base-relative', and D_t equals B^-/B^+ computed as Σ W × (P_t/P_0)
//     — NOT the superseded raw-USD Σ W × P_t;
//   - the recorded G_t equals Π D_t over the ledger (verifyDivisorLedger);
//   - getNavForm closes the §9.1 equation (G^implied × Σ = I_t) and exposes
//     the residual between G^implied and the recorded Π D_t.
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
  // Listing 3: a no-op commit publishes NOTHING (no ChainLinkAdjusted record).
  if (commit.record !== null || (commit.state.divisorHistory?.length ?? 0) !== 0) {
    return { pass: false, reason: "commitWeights recorded a no-op commit — Listing 3 emits ChainLinkAdjusted only on change" };
  }
  // Now commit DIFFERENT weights (e.g. gold up to 0.29, USD down to 0.24) → divisor != 1
  // but I_t must stay 1.13.
  const newWeights = [0.24, 0.20, 0.09, 0.08, 0.05, 0.05, 0.29]; // sum = 1.00
  const commit2 = commitWeights(state, newWeights, shockPrices, 2);
  if (Math.abs(commit2.state.I_t - 1.13) > 1e-9) {
    return { pass: false, reason: `commit2 I_t ${commit2.state.I_t}, expected 1.13 (zero artificial return)` };
  }
  // === COO-17: the divisor must be BASE-RELATIVE (Listing 3 / V3) ============
  // rel = P_t/P_0 → [1,1,1,1,1,1, 3750/2500=1.5]; B^± = Σ W × rel.
  const expRel = shockPrices.map((p, i) => p / baseFix[i]);
  let expBMinus = 0;
  let expBPlus = 0;
  let rawBMinus = 0; // superseded basis (Σ W × P_t) — for the distinction check
  let rawBPlus = 0;
  for (let i = 0; i < 7; i++) {
    expBMinus += prior[i] * expRel[i];
    expBPlus += newWeights[i] * expRel[i];
    rawBMinus += prior[i] * shockPrices[i];
    rawBPlus += newWeights[i] * shockPrices[i];
  }
  if (Math.abs(commit2.bMinus - expBMinus) > 1e-12 || Math.abs(commit2.bPlus - expBPlus) > 1e-12) {
    return { pass: false, reason: `commit2 B^± (${commit2.bMinus}, ${commit2.bPlus}) not base-relative (expected ${expBMinus}, ${expBPlus})` };
  }
  if (Math.abs(commit2.divisor - expBMinus / expBPlus) > 1e-12) {
    return { pass: false, reason: `commit2 divisor ${commit2.divisor} != base-relative B^-/B^+ ${expBMinus / expBPlus}` };
  }
  const rawDivisor = rawBMinus / rawBPlus;
  if (Math.abs(commit2.divisor - rawDivisor) < 1e-6) {
    return { pass: false, reason: `commit2 divisor matches the SUPERSEDED raw-USD basis (${rawDivisor}) — the basis switch did not take effect` };
  }
  if (!commit2.record || commit2.record.basis !== "base-relative" || commit2.record.kind !== "weight-commit") {
    return { pass: false, reason: "commit2 did not publish a base-relative weight-commit record" };
  }
  if (commit2.record.at !== 2 || Math.abs(commit2.record.D - commit2.divisor) > 1e-15) {
    return { pass: false, reason: "commit2 record fields (at/D) are wrong" };
  }
  // Recorded G_t must equal Π D_t over the ledger (G_t = G_{t-1} × D_t).
  const ledger = verifyDivisorLedger(commit2.state);
  if (ledger.consistent !== true) {
    return { pass: false, reason: `divisor ledger inconsistent: recorded G=${ledger.recordedG}, Π D=${ledger.recomputedG}, full=${ledger.fullHistoryRetained}` };
  }
  // getNavForm must close the §9.1 equation and expose the residual.
  const nav = getNavForm(commit2.state, shockPrices);
  if (!nav.baseFixingsAvailable) {
    return { pass: false, reason: "getNavForm: base fixings P_{i,0} missing on a freshly-initialized state" };
  }
  if (Math.abs(nav.navRaw - expBPlus) > 1e-12) {
    return { pass: false, reason: `getNavForm Σ term ${nav.navRaw} != Σ W_new × rel ${expBPlus}` };
  }
  if (!nav.identityCloses || Math.abs(nav.navReconciled - 1.13) > 1e-9) {
    return { pass: false, reason: `§9.1 equation does not close: NAV=${nav.navReconciled} vs I_t=${nav.indexLevel} (residual ${nav.identityResidual})` };
  }
  if (Math.abs(nav.gImplied - 1.13 / expBPlus) > 1e-12) {
    return { pass: false, reason: `getNavForm G^implied ${nav.gImplied} != I_t/NAV ${1.13 / expBPlus}` };
  }
  if (Math.abs(nav.gResidual - (nav.gImplied - nav.gRecorded)) > 1e-15) {
    return { pass: false, reason: "getNavForm residual bookkeeping is wrong" };
  }

  // === Constituency Succession self-test (§3.3 / §21.5) =====================
  // Scenario: CNY (slot 4) collapses −40% (0.14 → 0.084), then depeg is
  // confirmed and it is ejected; SGD (priced 0.74 USD) takes the slot with a
  // governed 5% seed weight. Requirements:
  //   1. the loss accrues in I_t while the price falls (honest tracking);
  //   2. ejection + succession contribute ZERO artificial return (I_t
  //      identical immediately before and after the swap);
  //   3. renormalizeExcluding sums to exactly 1;
  //   4. the successor's weight is exactly the seed and survivors are rescaled.
  let s2 = initChainIndex(denom, prior, baseFix, 0);
  // Step 1 — CNY −40% shock.
  const cnyShock = [...baseFix];
  cnyShock[4] = 0.084;
  const adv1 = advanceIndex(s2, cnyShock);
  s2 = adv1.state;
  const expectedI = 1 + prior[4] * (0.084 / 0.14 - 1); // 1 − 0.05×0.4 = 0.980
  if (Math.abs(adv1.newIndex - expectedI) > 1e-9) {
    return { pass: false, reason: `succession: shock gave ${adv1.newIndex}, expected ${expectedI} (loss must accrue)` };
  }
  // Step 2 — eject CNY, admit SGD at 0.74 USD/SGD with 5% seed weight.
  const succ = replaceComponent(s2, 4, 0.74, 0.05, cnyShock, 3);
  if (Math.abs(succ.state.I_t - adv1.newIndex) > 1e-12) {
    return { pass: false, reason: `succession: I_t changed across swap (${adv1.newIndex} → ${succ.state.I_t}) — must be zero artificial return` };
  }
  // COO-17: the succession swap is a published divisor event on the ledger.
  if (!succ.record || succ.record.kind !== "succession" || succ.record.basis !== "base-relative") {
    return { pass: false, reason: "succession: swap did not publish a base-relative succession record" };
  }
  if (Math.abs(succ.record.D - succ.divisor) > 1e-15) {
    return { pass: false, reason: "succession: record D != returned divisor" };
  }
  const wSum = succ.newWeights.reduce((a, b) => a + b, 0);
  if (Math.abs(wSum - 1) > 1e-12) {
    return { pass: false, reason: `succession: weights sum ${wSum}, expected 1.0` };
  }
  if (Math.abs(succ.newWeights[4] - 0.05) > 1e-12) {
    return { pass: false, reason: `succession: successor weight ${succ.newWeights[4]}, expected 0.05` };
  }
  const renorm = renormalizeExcluding(prior, 4);
  if (Math.abs(renorm.reduce((a, b) => a + b, 0) - 1) > 1e-12 || renorm[4] !== 0) {
    return { pass: false, reason: "succession: renormalizeExcluding must sum to 1 with slot at 0" };
  }
  // Step 3 — post-succession: a +10% SGD move moves the index by exactly
  // 5% × 10% = 0.5% (the slot now tracks the successor).
  const postPrices = [...succ.state.prevPrices];
  postPrices[4] = 0.74 * 1.1;
  const adv2 = advanceIndex(succ.state, postPrices);
  const expected2 = succ.state.I_t * (1 + 0.05 * 0.1);
  if (Math.abs(adv2.newIndex - expected2) > 1e-12) {
    return { pass: false, reason: `succession: post-swap return ${adv2.newIndex}, expected ${expected2}` };
  }
  return { pass: true, reason: `chain-linking self-test PASS: I_t=1.13 after gold+50%, unchanged after weight commits; divisor basis base-relative (Listing 3/V3), G_t=Π D_t verified, §9.1 getNavForm closes (residual ${(getNavForm(commit2.state, shockPrices).identityResidual).toExponential(2)}); succession zero-artificial-return verified (CNY −40% → ${adv1.newIndex.toFixed(6)}, swap unchanged, SGD slot live)` };
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
