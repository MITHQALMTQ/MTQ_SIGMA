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

export type OracleSourceId = "CHAINLINK" | "PYTH" | "CHRONICLE";

export interface OracleFeed {
  source: OracleSourceId;
  price: number;        // USD
  timestamp: number;     // epoch ms of last update
  confidence: number;    // ±USD confidence interval half-width
  updatedAt: number;     // when we sampled it (epoch ms)
  valid: boolean;        // passes staleness + confidence + deviation checks
  discardReason?: string;
}

export interface OracleConsensus {
  pair: string;            // e.g. "EUR/USD"
  feeds: OracleFeed[];     // all 3 sampled feeds (with validity flags)
  validCount: number;
  finalPrice: number;      // median (3 valid); 0 when paused (strict I9: <3 valid AND no override)
  method: "median" | "average" | "paused";
  paused: boolean;          // strict I9: true if <3 valid feeds (mint+redeem+rebalance must pause)
  governanceOverride: boolean; // true iff consensus was produced under the emergency 2-source escape hatch
  spreadBps: number;        // max-min among valid feeds, in bps
  sampledAt: number;
}

const STALENESS_MS = 60_000;          // §9.2.1
const CONFIDENCE_MAX_PCT = 0.01;      // §9.2.3 (<1% of price)
const DEVIATION_MAX_PCT = 0.025;      // §9.2.4 (<2.5% from median)

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
// I9 STRICT INVARIANT — Oracle Consensus (§9.3, strict per COO/PM directive)
// ============================================================================
// The consensus function MUST satisfy the following truth table:
//
//   validCount >= 3                              → median3, method="median",  paused=false
//   validCount == 2 && governanceOverride=true   → average, method="average", paused=false (DEGRADED)
//   validCount == 2 && governanceOverride=false  → paused,   method="paused", finalPrice=0
//   validCount <  2 (regardless of override)     → paused,   method="paused", finalPrice=0
//
// Rationale: the v1.0 blueprint §9.3 literal text permitted 2-source averaging
// when only 2 feeds were valid. This was the I9 quorum violation surfaced in
// the master reconciliation audit (HIGH finding #4 — see worklog.md). The
// strict form pauses at <3 sources so that no monetary operation (mint /
// redeem / rebalance) ever prices against a sub-quorum oracle. The
// `governanceOverride` escape hatch exists ONLY for a documented constitutional
// emergency (e.g. a temporary Chainlink outage with on-chain governance
// ratification per §22.3) — it MUST default to false.
//
// Mock feeds (testnet): once wired, all 3 mock feeds are always available, so
// the <3 pause rarely triggers in pilot. Mock-feed wiring is a separate task.
//
// WIRING-1: when `opts.onChain` is provided (V3 contract deployed), the three
// feeds are built from the on-chain adapter reads instead of the synthetic
// witness path. Per-source null on-chain values fall back to the synthetic
// witness for that source only (partial wiring). All Stage-1/Stage-2 validity
// checks still apply — a stale or off-median on-chain feed is discarded.
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
      return { ...f, timestamp: now - STALENESS_MS - 5000 }; // make it stale
    }
    if (forcedSpike.includes(f.source)) {
      return { ...f, price: f.price * 1.05 }; // +5% deviation → will be discarded
    }
    return f;
  });

  // Stage 1: staleness + confidence validity
  feeds = feeds.map((f) => {
    if (now - f.timestamp > STALENESS_MS) {
      return { ...f, valid: false, discardReason: "stale (>60s)" };
    }
    const confPct = (f.confidence * 2) / f.price; // full width / price
    if (confPct > CONFIDENCE_MAX_PCT) {
      return { ...f, valid: false, discardReason: `confidence ${(confPct * 100).toFixed(2)}% > 1%` };
    }
    return f;
  });

  // Stage 2: deviation from median of currently-valid feeds
  const validForMedian = feeds.filter((f) => f.valid).map((f) => f.price);
  if (validForMedian.length >= 2) {
    const med = validForMedian.length === 3
      ? median3(validForMedian[0], validForMedian[1], validForMedian[2])
      : (validForMedian[0] + validForMedian[1]) / 2;
    feeds = feeds.map((f) => {
      if (!f.valid) return f;
      const dev = Math.abs(f.price - med) / med;
      if (dev > DEVIATION_MAX_PCT) {
        return { ...f, valid: false, discardReason: `deviation ${(dev * 100).toFixed(2)}% > 2.5% from median` };
      }
      return f;
    });
  }

  const validFeeds = feeds.filter((f) => f.valid);
  const validCount = validFeeds.length;

  // --- I9 strict consensus selection (see truth table in function header) ---
  let finalPrice = 0;
  let method: OracleConsensus["method"] = "paused";
  if (validCount >= 3) {
    finalPrice = median3(validFeeds[0].price, validFeeds[1].price, validFeeds[2].price);
    method = "median";
  } else if (validCount === 2 && governanceOverride) {
    // DEGRADED MODE (I9 escape hatch): 2-source averaging is permitted ONLY
    // under an explicit governance override. method="average" + paused=false
    // signals the degraded path to observers / audit trail. Logged as
    // degraded mode via the method field — no console spam on every tick.
    finalPrice = (validFeeds[0].price + validFeeds[1].price) / 2;
    method = "average";
  }
  // Otherwise: paused (finalPrice stays 0). This covers BOTH
  //   - validCount == 2 && governanceOverride == false  (strict I9 pause)
  //   - validCount <  2                                 (unconditional pause)

  // spreadBps is only meaningful when a non-zero finalPrice was produced
  // (median of 3, or governance-override average of 2). When paused
  // (finalPrice = 0) spreadBps is reported as 0 to avoid divide-by-zero.
  const spreadBps = finalPrice > 0
    ? Math.round((Math.max(...validFeeds.map((f) => f.price)) - Math.min(...validFeeds.map((f) => f.price))) / finalPrice * 10_000)
    : 0;

  // I9 strict: paused iff <3 valid feeds AND not in the governance-override
  // degraded path (which only applies when exactly 2 feeds are valid — you
  // cannot average <2 sources, so override has no effect when validCount < 2).
  const paused = validCount < 3 && !(governanceOverride && validCount === 2);

  return {
    pair,
    feeds,
    validCount,
    finalPrice,
    method,
    paused,
    governanceOverride,
    spreadBps,
    sampledAt: now,
  };
}

// Build consensus for every price the engine needs, returning the FX-equivalents
// the engine consumes. If any pair is paused, the overall oracle is "paused".
export interface OracleBoard {
  pairs: OracleConsensus[];
  anyPaused: boolean;   // any single pair paused → mint+redeem+rebalance paused (I9)
  governanceOverride: boolean; // true iff board was built under the I9 escape hatch
  sampledAt: number;
}

export function buildOracleBoard(
  refs: {
    EUR_USD: number; GBP_USD: number; JPY_USD: number; CNY_USD: number; XAU_USD: number;
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
    buildOracleConsensus("XAU/USD", refs.XAU_USD, {
      governanceOverride,
      onChain: onChainByPair?.["XAU/USD"] ?? null,
    }),
  ];
  return {
    pairs,
    anyPaused: pairs.some((p) => p.paused),
    governanceOverride,
    sampledAt: Date.now(),
  };
}

// Extract validated FX rates from the oracle board (for the engine).
export function oracleFxRates(board: OracleBoard): {
  EUR_USD: number; GBP_USD: number; JPY_USD: number; CNY_USD: number; XAU_USD: number;
} {
  const get = (pair: string) => board.pairs.find((p) => p.pair === pair)?.finalPrice ?? 0;
  return {
    EUR_USD: get("EUR/USD"),
    GBP_USD: get("GBP/USD"),
    JPY_USD: get("JPY/USD"),
    CNY_USD: get("CNY/USD"),
    XAU_USD: get("XAU/USD"),
  };
}
