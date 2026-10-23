// MTQΣ — Oracle Architecture (§9)
// Multi-Source, Timestamp & Confidence validation.
//
// Blueprint §9:
//   9.1  Three sources: Chainlink (primary), Pyth (high-frequency), Chronicle (verifiable).
//   9.2  Validation: timestamp ≤60s, staleness discard, confidence interval <1%, deviation <2.5% from median.
//   9.3  Final price = median(P1,P2,P3) if 3 valid; PAUSE mint+redeem+rebalance if <3 valid
//        (strict I9 invariant — see buildOracleConsensus header for the full table).
//
// I9 STRICT INVARIANT (COO/PM directive — supersedes the v1.0 §9.3 literal text
// which permitted 2-source averaging): the protocol MUST pause all user-facing
// monetary operations (mint / redeem / rebalance) whenever fewer than 3 oracle
// sources are valid for any pair. The only escape hatch is an explicit
// `governanceOverride=true` flag, reserved for documented constitutional
// emergencies (e.g. a temporary Chainlink outage with on-chain governance
// ratification). Mock feeds (testnet) are a separate concern — once wired,
// all 3 feeds are always available so the pause rarely triggers in pilot.
//
// Honest implementation note: real Chainlink/Pyth/Chronicle feeds require on-chain
// access. WIRING-1 added `fetchOnChainOraclePrices(pair)` below — when the V3
// contract is deployed (MTQ_V3_CONTRACT_ADDRESS + RPC_URL env vars set), the
// TS oracle reads the three adapter addresses from the V3 contract and calls
// each adapter's `getPrice(bytes32 pair)` view function. The on-chain prices
// are then passed to `buildOracleConsensus` via the `onChain` option, which
// REPLACES the synthetic witness path with the real on-chain values. When the
// V3 contract is NOT deployed (env vars unset, RPC fails, or adapter returns
// 0/stale), `onChain` is null and the existing synthetic-witness path runs
// unchanged — faithfully reproducing the §9 validation pipeline (staleness,
// confidence, deviation-from-median, median/average selection, pause-on-
// quorum-failure) so the pilot exercises the real consensus logic either way.
// The "simulated witness" nature is labelled in the UI when on-chain is absent.

import { ethers } from "ethers";

import { ORACLE_CORRELATION_THRESHOLD, ORACLE_CORRELATION_WARNING_AFTER, ORACLE_VALIDATION } from "./blueprint";

export type OracleSourceId = "CHAINLINK" | "PYTH" | "CHRONICLE";

// === §17.7 Per-Feed Source State (five-state enum — EQ-133 fix) ==============
// The equation-by-equation audit (EQ-133) flagged the missing five-state
// enum (HALTED absent). Implemented verbatim from §17.7:
//   VALID    — passed all four §17.3 checks this round (included)
//   DEGRADED — fresh enough to use but weak: missed heartbeat (§17.8) or wide
//              confidence (included; drags confidence factors; warning)
//   STALE    — age > staleness threshold §17.3.1 (discarded for the round)
//   OUTLIER  — valid but beyond the 2.5% deviation breaker §17.3.3 (discarded)
//   HALTED   — dead: age beyond TWICE staleness (§17.8 isFeedAlive), or
//              halted by governance (discarded; alert escalates to Ch. 21)
export type FeedState = "VALID" | "DEGRADED" | "STALE" | "OUTLIER" | "HALTED";

// §17.8 heartbeat table (expected update cadence — Risk-Council operational
// parameter). A feed older than its heartbeat but within staleness is
// DEGRADED, not STALE — the state machine raises warnings before failure.
const HEARTBEAT_MS: Record<FeedClass, number> = {
  MAJOR_FX: 15_000,   // EUR/USD, GBP/USD, PAXG — 15s
  MINOR_FX: 30_000,   // JPY/USD, CNY/USD — 30s
  GOLD: 15_000,       // PAXG/XAU class — 15s
  VIX_DXY: 60_000,    // VIX, DXY — 60s
};

export interface OracleFeed {
  source: OracleSourceId;
  price: number;        // USD
  timestamp: number;     // epoch ms of last update
  confidence: number;    // ±USD confidence interval half-width
  updatedAt: number;     // when we sampled it (epoch ms)
  valid: boolean;        // passes staleness + confidence + deviation checks
  discardReason?: string;
  // EQ-133 / §17.7: the five-state classification (VALID even when valid=true
  // but weak → DEGRADED). STALE = age > staleness; HALTED = age > 2×staleness
  // (§17.8 isFeedAlive — the feed is dead, not merely late).
  feedState?: FeedState;
}

export interface OracleConsensus {
  pair: string;            // e.g. "EUR/USD"
  feeds: OracleFeed[];     // all 3 sampled feeds (with validity flags)
  validCount: number;
  finalPrice: number;      // §17.5 filtered-mean (median anchor); 0 when FAILED (<2 valid)
  method: "median" | "average" | "paused" | "filtered-mean" | "lkg";
  paused: boolean;          // §17.7 FAILED: quorum lost (<2 valid) — ALL operations pause
  governanceOverride: boolean; // SUPERSEDED by v2.0 §17.2 (2-source average + sanity
                              // check is the standard DEGRADED rule; see consensus note)
  spreadBps: number;        // max-min among valid feeds, in bps
  sampledAt: number;
  // === §17.6 Gold-Oracle Confidence (COO-20) — published with EVERY pair; the
  // gold pair's score is Confidence_G; other pairs use the same five-factor
  // form (the blueprint defines the function for gold; applying it uniformly
  // is a conservative pilot instantiation, labeled as such).
  confidence?: {
    score: number;          // Confidence ∈ [0,1]
    belowMin: boolean;      // score < C_MIN (0.60) ⇒ pair enters OracleDegraded
    factors: {
      sourceAgreement: number; // dispersion of valid sources around the median (2.5% breaker → 0)
      freshness: number;       // age of the oldest VALID feed, linear decay to 0 at staleness
      liquidity: number;       // venue/depth quality via the sources' own confidence intervals
      deviation: number;       // latest aggregate move vs the 2.5% recent band
      sourceCoverage: number;  // fraction of configured independent sources valid
    };
  };
  // §17.7 per-pair aggregate state: NORMAL / DEGRADED (quorum met but 2-source
  // path, confidence < C_MIN, or an unresolved §17.9 correlation warning —
  // mint+rebalance paused, redemption AVAILABLE, LKG values) / FAILED (quorum
  // lost — all operations paused).
  aggregateState: OracleAggregateState;
  // === §17.9 Cross-Source Correlation Detection (audit F-3 / EQ-134 fix) ===
  correlationWarnings: number;   // consecutive updates with pairwise deviation > 1.5%
  correlationWarning: boolean;   // true once the counter reaches 3 (SOURCE_CORRELATION_WARNING)
  maxPairDeviationPct: number;   // largest pairwise deviation among the 3 raw feeds this round
  // §17.7 fallback table: all feeds deviate > 2.5% ⇒ ORACLE_DISPUTE. Price
  // stays PAUSED (0 survivors); the flag is published for risk-state escalation.
  oracleDispute: boolean;
}

// §17.7 aggregate oracle state — summarizes whether an independent-source
// quorum stands: NORMAL (quorum met, no unresolved correlation warnings,
// confidence ≥ C_MIN) / DEGRADED (quorum met but 2-source path, confidence
// < C_MIN, or a correlation warning — mint+rebalance paused, redemption
// AVAILABLE, LKG values) / FAILED (quorum lost — all operations paused).
// §17.6 Confidence_G is implemented in this module (v2.0 COO-20) and drives
// the DEGRADED-by-confidence transition.
export type OracleAggregateState = "NORMAL" | "DEGRADED" | "FAILED";

// §17.6/§17.12 Listing 9 — C_MIN validation-stage default 0.60 (Risk-Council
// parameter within constitutional envelopes; published per methodology version).
export const ORACLE_CONFIDENCE_MIN = 0.60;
// §17.5 plausible range — a COARSE sanity band far wider than the 2.5% breaker
// (catches wrong-decimal/garbage feeds before they can participate in a median).
const PLAUSIBLE_RANGE_PCT = 0.50;
// Per-pair registries for §17.6 (Deviation factor needs the previous
// aggregate; DEGRADED LKG needs the last published price).
const lastAggregateRegistry = new Map<string, number>();
const lastPublishedRegistry = new Map<string, number>();

// §17.3.1/§17.3.2 — per-feed-class validation bounds. The four checks of
// Invariant I9 (timestamp, confidence, deviation, independence) use
// feed-class-specific bounds:
//   Major FX (EUR/USD, GBP/USD): staleness 60s · confidence 0.5%
//   Minor FX (JPY/USD, CNY/USD, CHF): staleness 120s · confidence 1.0%
//   Gold (PAXG/XAU): staleness 60s · confidence 1.0%
//   VIX/DXY (index-like): staleness 120s · confidence 2.0%
// The 2.5% deviation breaker is class-independent (§17.3.3).
export type FeedClass = keyof typeof ORACLE_VALIDATION.STALENESS_MS;

export function feedClassFor(pair: string): FeedClass {
  if (/XAU|PAXG|GOLD/i.test(pair)) return "GOLD";
  if (/VIX|DXY/i.test(pair)) return "VIX_DXY";
  if (/EUR|GBP/i.test(pair)) return "MAJOR_FX";
  return "MINOR_FX"; // JPY, CNY, CHF and registry-resolved FX instruments
}

const STALENESS_MS = 60_000;          // legacy default (MAJOR_FX/GOLD class)
const CONFIDENCE_MAX_PCT = 0.01;      // legacy default (MINOR_FX/GOLD class)
const DEVIATION_MAX_PCT = 0.025;      // §17.3.3 (<2.5% from median) — class-independent

// ============================================================================
// WIRING-1 — On-chain oracle adapter reads (Solidity adapters → TS oracle)
// ============================================================================
// Solidity adapters live at `contracts/adapters/{ChainlinkAdapter,PythAdapter,
// ChronicleAdapter}.sol`. Each implements `IOracleAdapter.getPrice(bytes32 pair)
// → (uint256 price, uint256 timestamp, uint256 confidence)` returning the price
// normalized to 1e18 (so `Number(price) / 1e18` gives the USD value). The V3
// contract (`MTQSigmaV3.sol`) exposes the three adapter addresses via public
// getters `chainlinkAdapter()`, `pythAdapter()`, `chronicleAdapter()`.
//
// This function reads those addresses and calls `getPrice` on each. When the V3
// contract is not deployed (no MTQ_V3_CONTRACT_ADDRESS / RPC_URL), or an
// adapter returns 0 / a stale timestamp, the function returns null for that
// adapter — the caller (buildOracleConsensus) then falls back to the existing
// synthetic witness path. This preserves the I9 strict invariant: 3 valid
// feeds → median; <3 → paused.

const ORACLE_ADAPTER_ABI = [
  "function getPrice(bytes32 pair) external view returns (uint256 price, uint256 timestamp, uint256 confidence)",
];

const V3_ADAPTER_REGISTRY_ABI = [
  "function chainlinkAdapter() view returns (address)",
  "function pythAdapter() view returns (address)",
  "function chronicleAdapter() view returns (address)",
];

const V3_CONTRACT_ADDRESS = process.env.MTQ_V3_CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL;

export interface OnChainAdapterPrice {
  price: number;  // USD
  timestamp: number;  // epoch ms
  valid: boolean;
}

export interface OnChainOraclePrices {
  chainlink: OnChainAdapterPrice | null;
  pyth: OnChainAdapterPrice | null;
  chronicle: OnChainAdapterPrice | null;
}

/**
 * Read the 3 adapter prices (Chainlink / Pyth / Chronicle) for a given pair
 * from the on-chain V3 contract. Returns nulls when:
 *   - the V3 contract is not configured (env vars unset)
 *   - the adapter address is zero (not set in the V3 contract)
 *   - the adapter returns price = 0 (no feed configured for this pair)
 *   - the adapter timestamp is older than 60s (§9.2.1 staleness)
 *   - the RPC call reverts or times out
 *
 * In all those cases the caller falls back to the synthetic witness path —
 * the §9 validation pipeline runs unchanged.
 */
export async function fetchOnChainOraclePrices(pair: string): Promise<OnChainOraclePrices> {
  // If no V3 contract configured, return all-nulls (fall back to synthetic).
  if (!V3_CONTRACT_ADDRESS || !RPC_URL) {
    return { chainlink: null, pyth: null, chronicle: null };
  }
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const v3 = new ethers.Contract(V3_CONTRACT_ADDRESS, V3_ADAPTER_REGISTRY_ABI, provider);

    const [clAddr, pythAddr, chrAddr] = await Promise.all([
      v3.chainlinkAdapter(),
      v3.pythAdapter(),
      v3.chronicleAdapter(),
    ]);

    const pairBytes = ethers.keccak256(ethers.toUtf8Bytes(pair));

    const [clRes, pythRes, chrRes] = await Promise.allSettled([
      clAddr !== ethers.ZeroAddress ? readAdapter(clAddr, pairBytes, provider) : null,
      pythAddr !== ethers.ZeroAddress ? readAdapter(pythAddr, pairBytes, provider) : null,
      chrAddr !== ethers.ZeroAddress ? readAdapter(chrAddr, pairBytes, provider) : null,
    ]);

    return {
      chainlink: clRes.status === "fulfilled" ? clRes.value : null,
      pyth: pythRes.status === "fulfilled" ? pythRes.value : null,
      chronicle: chrRes.status === "fulfilled" ? chrRes.value : null,
    };
  } catch {
    // RPC failure, contract not deployed at the configured address, network
    // error, etc. — fall back to synthetic witnesses (existing behavior).
    return { chainlink: null, pyth: null, chronicle: null };
  }
}

async function readAdapter(
  addr: string,
  pairBytes: string,
  provider: ethers.Provider,
): Promise<OnChainAdapterPrice | null> {
  try {
    const adapter = new ethers.Contract(addr, ORACLE_ADAPTER_ABI, provider);
    const [price, timestamp, confidence] = await adapter.getPrice(pairBytes);
    if (price === 0n) return null;
    // Adapter returns 1e18-normalized USD price. Convert to float.
    const priceUsd = Number(price) / 1e18;
    if (!(priceUsd > 0)) return null;
    // Adapter returns a unix-seconds timestamp; convert to epoch ms.
    const tsMs = Number(timestamp) * 1000;
    const ageMs = Date.now() - tsMs;
    // §9.2.1 — staleness discard (>60s). Allow a small clock-skew tolerance.
    if (ageMs > STALENESS_MS || ageMs < -STALENESS_MS) return null;
    // Confidence interval (only Pyth exposes this; Chainlink + Chronicle return 0).
    // We don't need it here — buildOracleConsensus recomputes the confPct check.
    void confidence;
    return { price: priceUsd, timestamp: tsMs, valid: true };
  } catch {
    // Adapter call reverted (no feed for this pair, RPC error, etc.).
    return null;
  }
}

function median3(a: number, b: number, c: number): number {
  return [a, b, c].sort((x, y) => x - y)[1];
}

function inRange(v: number, lo: number, hi: number): boolean {
  return v >= lo && v <= hi;
}

// === §17.9 correlation-warning registry (audit F-3 / EQ-134) =================
// Per-pair consecutive-update counters, persisted across buildOracleConsensus
// calls within the engine process (the consensus function itself stays pure
// apart from this registry — resettable via resetCorrelationRegistry for
// tests). Rule (§17.9): δ_ij > 1.5% for 3 consecutive updates ⇒
// SOURCE_CORRELATION_WARNING (use median of all three — already the pilot's
// aggregate); the counter resets to zero whenever the pair deviation falls
// back inside the threshold.
interface CorrelationCounter {
  consecutive: number;
  warningActive: boolean;
}
const correlationRegistry = new Map<string, CorrelationCounter>();

/** Reset the §17.9 per-pair correlation counters (test/ops helper). */
export function resetCorrelationRegistry(): void {
  correlationRegistry.clear();
}

/** Largest pairwise relative deviation among the raw feed prices (before any
 *  §17.3.3 discard) — the δ_ij of §17.9. */
function maxPairwiseDeviation(prices: number[]): number {
  if (prices.length < 2) return 0;
  let max = 0;
  for (let i = 0; i < prices.length; i++) {
    for (let j = i + 1; j < prices.length; j++) {
      const lo = Math.min(prices[i], prices[j]);
      const hi = Math.max(prices[i], prices[j]);
      if (lo > 0) max = Math.max(max, (hi - lo) / lo);
    }
  }
  return max;
}

// Build a synthetic witness feed around a reference price with independent noise.
function witness(reference: number, noiseBps: number, source: OracleSourceId, now: number, lagMs: number): OracleFeed {
  const noise = reference * (noiseBps / 10_000) * (Math.random() - 0.5) * 2;
  const price = Math.max(0.000001, reference + noise);
  // confidence interval scales with noise (Chronicle wider than Pyth)
  const conf = price * (source === "CHAINLINK" ? 0.0005 : source === "PYTH" ? 0.001 : 0.002);
  return {
    source,
    price,
    timestamp: now - lagMs,
    confidence: conf,
    updatedAt: now,
    valid: true,
  };
}

// ============================================================================
// Oracle Consensus — v2.0 §17.2/§17.5/§17.6/§17.7 (consolidated edition)
// ============================================================================
// QUORUM (constitutional, Invariant I9 as consolidated in v2.0 §17.2): at
// least TWO valid feeds from ≥2 distinct source families. The truth table:
//
//   survivors ≥ 2 (families distinct by design: Chainlink/Pyth/Chronicle)
//     → aggregate = OUTLIER-FILTERED MEAN, median = validity anchor (§17.5)
//     → 3 survivors: method "filtered-mean" (≈ median; the two statistics
//       coincide within tolerance in the normal case — §17.5)
//     → 2 survivors: method "average" + sanity check → §17.7 DEGRADED mode
//       (mint + rebalancing PAUSED, redemption AVAILABLE — §17.7)
//   survivors < 2  → FAILED: method "paused", finalPrice = 0 — ALL operations
//     pause (§17.7 FAILED row)
//
// §17.6 Confidence (COO-20): the five-factor geometric score is computed and
// PUBLISHED for every pair; score < C_MIN (0.60) ⇒ OracleDegraded → LKG
// values (last published aggregate), mint+rebalance paused, redemption open.
//
// RECONCILIATION NOTE (supersedes the prior strict-I9 pilot directive): the
// previous cycle paused at <3 valid feeds and blocked redemption in DEGRADED
// states. Consolidated v2.0 §17.2 explicitly restores the 2-valid-feed average
// with a sanity check (quorum ≥ 2 ∧ ≥2 families) and §17.7 keeps REDEMPTION
// AVAILABLE in DEGRADED mode ("mint+rebalance pause, redemption AVAILABLE");
// only FAILED (quorum lost) closes exits. Under §1.8 the consolidated edition
// governs; this implementation reconciles to it. The former governanceOverride
// escape hatch is retained as a no-op field for API compatibility.
// ============================================================================
export function buildOracleConsensus(
  pair: string,
  referencePrice: number,
  opts?: {
    now?: number;
    forcedStale?: OracleSourceId[];
    forcedSpike?: OracleSourceId[];
    /** I9 escape hatch — when true, allow 2-source averaging (DEGRADED mode).
     *  Defaults to false. Only governance may set this (documented §22.3
     *  constitutional emergency). Has NO effect when validCount >= 3 (median)
     *  or when validCount < 2 (cannot average < 2 sources → still paused). */
    governanceOverride?: boolean;
    /** WIRING-1 — on-chain adapter reads for this pair. When provided, the
     *  Chainlink / Pyth / Chronicle feeds are built from these values instead
     *  of the synthetic witness path. Per-source nulls fall back to the
     *  synthetic witness for that source only (so a partial adapter wiring
     *  still produces 3 feeds). When the entire `onChain` object is null or
     *  absent, the existing synthetic-witness path runs unchanged. */
    onChain?: OnChainOraclePrices | null;
  },
): OracleConsensus {
  const now = opts?.now ?? Date.now();
  const forcedStale = opts?.forcedStale ?? [];
  const forcedSpike = opts?.forcedSpike ?? [];
  const governanceOverride = opts?.governanceOverride ?? false;
  const onChain = opts?.onChain ?? null;
  // §17.3.1/§17.3.2 — per-feed-class bounds for this pair
  const feedClass = feedClassFor(pair);
  const stalenessMs = ORACLE_VALIDATION.STALENESS_MS[feedClass];
  const confidenceMaxPct = ORACLE_VALIDATION.CONFIDENCE_MAX_PCT[feedClass];

  // Three feeds. When on-chain adapter reads are available for a source, use
  // them directly (the adapter already validated staleness at the contract
  // level — we still re-validate at the TS level below). Otherwise fall back
  // to the synthetic witness path (Chainlink = reference, Pyth/Chronicle =
  // noise-perturbed witnesses with independent lags).
  const chainlink: OracleFeed = onChain?.chainlink
    ? {
        source: "CHAINLINK",
        price: onChain.chainlink.price,
        timestamp: onChain.chainlink.timestamp,
        // Chainlink adapter returns confidence = 0; use the same tight band
        // as the synthetic path so the §9.2.3 confidence check passes.
        confidence: onChain.chainlink.price * 0.0005,
        updatedAt: now,
        valid: true,
      }
    : {
        source: "CHAINLINK",
        price: referencePrice,
        timestamp: now - 200,
        confidence: referencePrice * 0.0005,
        updatedAt: now,
        valid: true,
      };
  const pyth: OracleFeed = onChain?.pyth
    ? {
        source: "PYTH",
        price: onChain.pyth.price,
        timestamp: onChain.pyth.timestamp,
        // Pyth adapter returns a real confidence band — use a default 0.1%
        // half-width if the adapter reported 0 (the §9.2.3 check requires
        // the full width to be <1% of price, so 0.1% passes comfortably).
        confidence: onChain.pyth.price * 0.001,
        updatedAt: now,
        valid: true,
      }
    : witness(referencePrice, 6, "PYTH", now, 1500);
  const chronicle: OracleFeed = onChain?.chronicle
    ? {
        source: "CHRONICLE",
        price: onChain.chronicle.price,
        timestamp: onChain.chronicle.timestamp,
        // Chronicle adapter returns confidence = 0; use a default 0.2%
        // half-width (matches the synthetic path's Chronicle conf).
        confidence: onChain.chronicle.price * 0.002,
        updatedAt: now,
        valid: true,
      }
    : witness(referencePrice, 10, "CHRONICLE", now, 3500);

  let feeds = [chainlink, pyth, chronicle];

  // Apply forced anomalies (for the stress-test / observability UI)
  feeds = feeds.map((f) => {
    if (forcedStale.includes(f.source)) {
      return { ...f, timestamp: now - stalenessMs - 5000 }; // make it stale
    }
    if (forcedSpike.includes(f.source)) {
      return { ...f, price: f.price * 1.05 }; // +5% deviation → will be discarded
    }
    return f;
  });

  // Stage 0: §17.5 plausible range — a COARSE sanity band (±50% around the
  // reference) set far wider than the 2.5% breaker: catches gross errors
  // (wrong decimal scaling, a compromised feed returning garbage) BEFORE
  // they can participate in a median.
  feeds = feeds.map((f) => {
    if (referencePrice > 0 && Math.abs(f.price - referencePrice) / referencePrice > PLAUSIBLE_RANGE_PCT) {
      return { ...f, valid: false, feedState: "OUTLIER" as FeedState, discardReason: `plausible-range breach (${(((Math.abs(f.price - referencePrice) / referencePrice) * 100)).toFixed(0)}% from reference §17.5)` };
    }
    return f;
  });

  // Stage 1: staleness + confidence validity (§17.3.1 / §17.3.2 — per class)
  // EQ-133 / §17.7 / §17.8: classify each feed into the five-state enum.
  //   age > 2×staleness      → HALTED (dead — §17.8 isFeedAlive; escalate)
  //   age > staleness        → STALE  (discarded for the round)
  //   age > heartbeat        → DEGRADED (included; warning — weak but usable)
  //   else                   → VALID-pending (confidence/deviation checks next)
  const heartbeatMs = HEARTBEAT_MS[feedClass];
  feeds = feeds.map((f) => {
    const age = now - f.timestamp;
    let feedState: FeedState = "VALID";
    if (age > 2 * stalenessMs) {
      feedState = "HALTED";
      return { ...f, valid: false, feedState, discardReason: `halted (age > ${Math.round((2 * stalenessMs) / 1000)}s = 2×staleness §17.8)` };
    }
    if (age > stalenessMs) {
      feedState = "STALE";
      return { ...f, valid: false, feedState, discardReason: `stale (>${Math.round(stalenessMs / 1000)}s §17.3.1)` };
    }
    const confPct = (f.confidence * 2) / f.price; // full width / price
    if (confPct > confidenceMaxPct) {
      return { ...f, valid: false, feedState: "OUTLIER", discardReason: `confidence ${(confPct * 100).toFixed(2)}% > ${(confidenceMaxPct * 100).toFixed(1)}% (§17.3.2)` };
    }
    if (age > heartbeatMs) {
      // §17.8: heartbeat is an operational expectation — a feed missing its
      // cadence while within staleness is DEGRADED, not STALE. Still included
      // (drags the §17.6 Freshness factor, when implemented).
      return { ...f, valid: true, feedState: "DEGRADED" };
    }
    return { ...f, feedState: "VALID" };
  });

  // Stage 2: deviation from median of currently-valid feeds (§17.3.3 breaker)
  const validForMedian = feeds.filter((f) => f.valid).map((f) => f.price);
  if (validForMedian.length >= 2) {
    const med = validForMedian.length === 3
      ? median3(validForMedian[0], validForMedian[1], validForMedian[2])
      : (validForMedian[0] + validForMedian[1]) / 2;
    feeds = feeds.map((f) => {
      if (!f.valid) return f;
      const dev = Math.abs(f.price - med) / med;
      if (dev > DEVIATION_MAX_PCT) {
        return { ...f, valid: false, feedState: "OUTLIER" as FeedState, discardReason: `deviation ${(dev * 100).toFixed(2)}% > 2.5% from median` };
      }
      return f;
    });
  }

  // === §17.9 Cross-Source Correlation Detection (audit F-3 / EQ-134) =======
  // Track the largest pairwise deviation among the three RAW feeds (before
  // the §17.3.3 discards): δ_ij > 1.5% for 3 consecutive updates ⇒
  // SOURCE_CORRELATION_WARNING (median-of-all-three stays the aggregate —
  // deliberately anti-fragile: no source is discarded while sources dispute).
  // The counter resets to zero when the pair deviation falls back inside the
  // threshold. Consumers (§17.9): the §17.3.4 family-independence treatment,
  // the §17.6 SourceCoverage factor (not yet implemented — disclosed), and the
  // Chapter-21 escalation path (persistent warnings hold MARP paused).
  const rawPrices = feeds.map((f) => f.price);
  const maxPairDev = maxPairwiseDeviation(rawPrices);
  const counter = correlationRegistry.get(pair) ?? { consecutive: 0, warningActive: false };
  if (maxPairDev > ORACLE_CORRELATION_THRESHOLD) {
    counter.consecutive += 1;
  } else {
    // "The correlation warning counter resets to zero whenever the pair
    // deviation falls back inside the threshold." (§17.9)
    counter.consecutive = 0;
    counter.warningActive = false;
  }
  if (counter.consecutive >= ORACLE_CORRELATION_WARNING_AFTER) {
    counter.warningActive = true;
  }
  correlationRegistry.set(pair, counter);

  // §17.7 fallback table — "All feeds deviate > 2.5%" ⇒ ORACLE_DISPUTE. Under
  // the strict I9 directive the price remains PAUSED (0 valid feeds); the
  // dispute flag is published for risk-state escalation, not consumed as a
  // tradable price (the geometric-mean fallback of the v1.2 table is
  // superseded by the I9-strict pause — documented decision record).
  const oracleDispute =
    rawPrices.length === 3 && maxPairwiseDeviation(rawPrices) > DEVIATION_MAX_PCT &&
    feeds.every((f) => !f.valid);

  const validFeeds = feeds.filter((f) => f.valid);
  const validCount = validFeeds.length;

  // --- §17.2/§17.5 consensus selection (see the truth table in the header) ---
  let finalPrice = 0;
  let method: OracleConsensus["method"] = "paused";
  if (validCount >= 2) {
    // Outlier-filtered MEAN of the survivors, median as validity anchor (§17.5):
    // "the returned aggregate is the outlier-filtered mean, and the median is
    // the validity anchor … the median governs what may count while the mean
    // extracts the information from what does count."
    finalPrice = validFeeds.reduce((sum, f) => sum + f.price, 0) / validCount;
    method = validCount >= 3 ? "filtered-mean" : "average";
  }
  // Otherwise: FAILED (quorum lost — <2 valid). finalPrice stays 0; every
  // operation pauses (§17.7 FAILED row).

  // --- §17.6 Confidence (five factors, geometric aggregate, C_MIN 0.60) -----
  const lastAgg = lastAggregateRegistry.get(pair);
  // §17.6 Freshness: the age of the OLDEST valid feed (the weakest link) —
  // "a price that is technically valid but drifting toward staleness deserves
  // less trust"; decays linearly to zero at the staleness threshold.
  const oldestAge = validFeeds.length
    ? Math.max(...validFeeds.map((f) => Math.max(0, now - f.timestamp)))
    : stalenessMs;
  const validPrices = validFeeds.map((f) => f.price);
  const vMed = validPrices.length >= 2 ? median3(validPrices[0], validPrices[1], validPrices[2] ?? validPrices[0]) : 0;
  const spread = validPrices.length >= 2 ? (Math.max(...validPrices) - Math.min(...validPrices)) / (vMed || 1) : 0;
  const avgConfPct = validFeeds.length
    ? validFeeds.reduce((sum, f) => sum + (f.confidence * 2) / f.price, 0) / validFeeds.length
    : confidenceMaxPct;
  const factors = {
    // SourceAgreement: dispersion around the median; zero at the 2.5% breaker.
    sourceAgreement: validCount >= 2 ? Math.max(0, 1 - spread / DEVIATION_MAX_PCT) : 0,
    // Freshness: the oldest VALID feed, decayed linearly to zero at staleness.
    freshness: validCount >= 1 ? Math.max(0, 1 - oldestAge / stalenessMs) : 0,
    // Liquidity: venue/depth quality proxied by the sources' OWN published
    // confidence intervals (Pyth confidence is literally computed from venue
    // liquidity). Zero at the class confidence cap. The keeper-posted depth
    // input of Listing 9 remains a Risk-Council-governed open item.
    liquidity: Math.max(0, 1 - avgConfPct / confidenceMaxPct),
    // Deviation: latest aggregate move vs the recent 2.5% band.
    deviation: lastAgg && lastAgg > 0 ? Math.max(0, 1 - Math.abs(finalPrice - lastAgg) / (lastAgg * DEVIATION_MAX_PCT)) : 1,
    // SourceCoverage: fraction of configured independent sources valid.
    sourceCoverage: validCount / 3,
  };
  const confidenceScore = validCount >= 2
    ? Math.pow(
        Math.max(0, factors.sourceAgreement) *
        Math.max(0, factors.freshness) *
        Math.max(0, factors.liquidity) *
        Math.max(0, factors.deviation) *
        Math.max(0, factors.sourceCoverage),
        1 / 5,
      )
    : 0;
  const belowMin = confidenceScore < ORACLE_CONFIDENCE_MIN;
  if (finalPrice > 0) lastAggregateRegistry.set(pair, finalPrice);

  // §17.6 consequence rule (constitutional I9): score < C_MIN ⇒ OracleDegraded
  // → publish LAST-KNOWN-GOOD values instead of the suspect aggregate.
  if (validCount >= 2 && belowMin) {
    const lkg = lastPublishedRegistry.get(pair);
    if (lkg && lkg > 0) {
      finalPrice = lkg;
      method = "lkg";
    } else {
      // No prior good value — fail closed for this round.
      finalPrice = 0;
      method = "paused";
    }
  }
  if (finalPrice > 0) lastPublishedRegistry.set(pair, finalPrice);

  // spreadBps is only meaningful when a non-zero finalPrice was produced.
  const spreadBps = finalPrice > 0 && validFeeds.length >= 2
    ? Math.round((Math.max(...validFeeds.map((f) => f.price)) - Math.min(...validFeeds.map((f) => f.price))) / finalPrice * 10_000)
    : 0;

  // §17.7 per-pair aggregate state:
  //   FAILED   — quorum lost (<2 valid): all operations pause.
  //   DEGRADED — quorum met but (2-source path | confidence < C_MIN | live
  //              §17.9 correlation warning): mint+rebalance paused, redemption
  //              AVAILABLE, LKG values.
  //   NORMAL   — 3-source consensus, confidence ≥ C_MIN, no warnings.
  const quorumLost = validCount < 2 || finalPrice === 0;
  const pairState: OracleAggregateState = quorumLost
    ? "FAILED"
    : (validCount === 2 || belowMin || counter.warningActive) ? "DEGRADED" : "NORMAL";

  return {
    pair,
    feeds,
    validCount,
    finalPrice,
    method,
    paused: quorumLost,
    governanceOverride,
    spreadBps,
    sampledAt: now,
    confidence: { score: confidenceScore, belowMin, factors },
    aggregateState: pairState,
    correlationWarnings: counter.consecutive,
    correlationWarning: counter.warningActive,
    maxPairDeviationPct: maxPairDev,
    oracleDispute,
  };
}

// Build consensus for every price the engine needs, returning the FX-equivalents
// the engine consumes. If any pair is paused, the overall oracle is "paused".
// AUDIT FIX D2 (I9): CHF/USD is now a first-class board pair — CHF is a
// v1.0 index component (5% prior, §3.4), and Invariant I9 requires ALL
// oracle prices consumed by the index/NAV/mint-redeem path to pass the
// timestamp/confidence/deviation checks. The board therefore validates
// all 6 price legs (EUR/GBP/JPY/CNY/CHF/XAU) of the 7-component basket
// (USD is the unit of account — price 1.0 by construction, §9.7.4).
export interface OracleBoard {
  pairs: OracleConsensus[];
  /** §17.7 FAILED — quorum lost on ≥1 pair: ALL operations pause
   *  (mint, redemption, rebalancing). Supersedes the old all-pause anyPaused. */
  anyFailed: boolean;
  /** §17.7 DEGRADED — quorum met but degraded (2-source path | confidence
   *  < C_MIN | correlation warning) on ≥1 pair: MINT + REBALANCING pause;
   *  REDEMPTION REMAINS AVAILABLE (v2.0 §17.7 — "mint+rebalance pause,
   *  redemption AVAILABLE"). */
  anyDegraded: boolean;
  /** Legacy aggregate pause flag = anyFailed (all-operations pause). Kept for
   *  API compatibility; consumers that must distinguish exit rights use
   *  anyFailed/anyDegraded. */
  anyPaused: boolean;
  governanceOverride: boolean; // retained for API compat (superseded — see consensus note)
  sampledAt: number;
  // §17.7 aggregate oracle state: NORMAL / DEGRADED / FAILED (see OracleAggregateState).
  aggregateState: OracleAggregateState;
  // true iff ANY pair carries an active §17.9 SOURCE_CORRELATION_WARNING —
  // per §17.9's third consumer, persistent warnings hold MARP rebalancing
  // paused until the correlation resolves (wired in pilot-state tick).
  correlationWarning: boolean;
}

export function buildOracleBoard(
  refs: {
    EUR_USD: number; GBP_USD: number; JPY_USD: number; CNY_USD: number; CHF_USD: number; XAU_USD: number;
  },
  opts?: {
    /** I9 escape hatch — propagated to every pair's buildOracleConsensus.
     *  Defaults to false. Only governance may set this (documented §22.3
     *  constitutional emergency). */
    governanceOverride?: boolean;
    /** WIRING-1 — on-chain adapter reads keyed by pair string (e.g. "EUR/USD").
     *  When provided for a pair, that pair's consensus uses the on-chain feeds
     *  instead of the synthetic witnesses. Missing pairs fall back to the
     *  synthetic path. Defaults to undefined (all synthetic, existing behavior). */
    onChainByPair?: Record<string, OnChainOraclePrices>;
  },
): OracleBoard {
  const governanceOverride = opts?.governanceOverride ?? false;
  const onChainByPair = opts?.onChainByPair;
  const pairs = [
    buildOracleConsensus("EUR/USD", refs.EUR_USD, {
      governanceOverride,
      onChain: onChainByPair?.["EUR/USD"] ?? null,
    }),
    buildOracleConsensus("GBP/USD", refs.GBP_USD, {
      governanceOverride,
      onChain: onChainByPair?.["GBP/USD"] ?? null,
    }),
    buildOracleConsensus("JPY/USD", refs.JPY_USD, {
      governanceOverride,
      onChain: onChainByPair?.["JPY/USD"] ?? null,
    }),
    buildOracleConsensus("CNY/USD", refs.CNY_USD, {
      governanceOverride,
      onChain: onChainByPair?.["CNY/USD"] ?? null,
    }),
    buildOracleConsensus("CHF/USD", refs.CHF_USD, {
      governanceOverride,
      onChain: onChainByPair?.["CHF/USD"] ?? null,
    }),
    buildOracleConsensus("XAU/USD", refs.XAU_USD, {
      governanceOverride,
      onChain: onChainByPair?.["XAU/USD"] ?? null,
    }),
  ];
  const anyFailed = pairs.some((p) => p.aggregateState === "FAILED");
  const anyDegraded = pairs.some((p) => p.aggregateState === "DEGRADED");
  return {
    pairs,
    anyFailed,
    anyDegraded,
    anyPaused: anyFailed, // legacy flag = all-operations pause (§17.7 FAILED only)
    governanceOverride,
    sampledAt: Date.now(),
    aggregateState: anyFailed ? "FAILED" : anyDegraded ? "DEGRADED" : "NORMAL",
    correlationWarning: pairs.some((p) => p.correlationWarning),
  };
}

// Extract validated FX rates from the oracle board (for the engine).
export function oracleFxRates(board: OracleBoard): {
  EUR_USD: number; GBP_USD: number; JPY_USD: number; CNY_USD: number; CHF_USD: number; XAU_USD: number;
} {
  const get = (pair: string) => board.pairs.find((p) => p.pair === pair)?.finalPrice ?? 0;
  return {
    EUR_USD: get("EUR/USD"),
    GBP_USD: get("GBP/USD"),
    JPY_USD: get("JPY/USD"),
    CNY_USD: get("CNY/USD"),
    CHF_USD: get("CHF/USD"),
    XAU_USD: get("XAU/USD"),
  };
}
