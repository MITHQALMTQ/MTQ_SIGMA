// MTQΣ — Oracle Architecture (§9)
// Multi-Source, Timestamp & Confidence validation.
//
// Blueprint §9:
//   9.1  Three sources: Chainlink (primary), Pyth (high-frequency), Chronicle (verifiable).
//   9.2  Validation: timestamp ≤60s, staleness discard, confidence interval <1%, deviation <2.5% from median.
//   9.3  Final price = median(P1,P2,P3) if 3 valid; average if 2 valid; PAUSE mint+rebalance if <2.
//
// Honest implementation note: real Chainlink/Pyth/Chronicle feeds require on-chain
// access we don't have in this pilot. We therefore model the three feeds as:
//   - a live "reference" price (Frankfurter ECB / gold-api for gold), used as the
//     Chainlink-equivalent primary;
//   - two synthetic "witness" feeds derived with small independent noise + their
//     own timestamps and confidence intervals, representing Pyth and Chronicle.
// This faithfully reproduces the §9 validation pipeline (staleness, confidence,
// deviation-from-median, median/average selection, pause-on-quorum-failure) so
// the pilot exercises the real consensus logic. The "simulated witness" nature
// is labelled in the UI.

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
  finalPrice: number;      // median (3) or average (2); 0 if <2 valid → paused
  method: "median" | "average" | "paused";
  paused: boolean;          // true if <2 valid feeds → mint+rebalance must pause
  spreadBps: number;        // max-min among valid feeds, in bps
  sampledAt: number;
}

const STALENESS_MS = 60_000;          // §9.2.1
const CONFIDENCE_MAX_PCT = 0.01;      // §9.2.3 (<1% of price)
const DEVIATION_MAX_PCT = 0.025;      // §9.2.4 (<2.5% from median)

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

export function buildOracleConsensus(
  pair: string,
  referencePrice: number,
  opts?: { now?: number; forcedStale?: OracleSourceId[]; forcedSpike?: OracleSourceId[] },
): OracleConsensus {
  const now = opts?.now ?? Date.now();
  const forcedStale = opts?.forcedStale ?? [];
  const forcedSpike = opts?.forcedSpike ?? [];

  // Three feeds: Chainlink = reference (near-zero lag, tight conf),
  // Pyth + Chronicle = synthetic witnesses with independent noise + lags.
  const chainlink: OracleFeed = {
    source: "CHAINLINK",
    price: referencePrice,
    timestamp: now - 200,
    confidence: referencePrice * 0.0005,
    updatedAt: now,
    valid: true,
  };
  const pyth = witness(referencePrice, 6, "PYTH", now, 1500);
  const chronicle = witness(referencePrice, 10, "CHRONICLE", now, 3500);

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

  let finalPrice = 0;
  let method: OracleConsensus["method"] = "paused";
  if (validCount >= 3) {
    finalPrice = median3(validFeeds[0].price, validFeeds[1].price, validFeeds[2].price);
    method = "median";
  } else if (validCount === 2) {
    finalPrice = (validFeeds[0].price + validFeeds[1].price) / 2;
    method = "average";
  }
  // validCount < 2 → paused (finalPrice stays 0)

  const spreadBps = validCount >= 2
    ? Math.round((Math.max(...validFeeds.map((f) => f.price)) - Math.min(...validFeeds.map((f) => f.price))) / finalPrice * 10_000)
    : 0;

  return {
    pair,
    feeds,
    validCount,
    finalPrice,
    method,
    paused: validCount < 2,
    spreadBps,
    sampledAt: now,
  };
}

// Build consensus for every price the engine needs, returning the FX-equivalents
// the engine consumes. If any pair is paused, the overall oracle is "paused".
export interface OracleBoard {
  pairs: OracleConsensus[];
  anyPaused: boolean;   // any single pair paused → mint+rebalance paused
  sampledAt: number;
}

export function buildOracleBoard(refs: {
  EUR_USD: number; GBP_USD: number; JPY_USD: number; CNY_USD: number; XAU_USD: number;
}): OracleBoard {
  const pairs = [
    buildOracleConsensus("EUR/USD", refs.EUR_USD),
    buildOracleConsensus("GBP/USD", refs.GBP_USD),
    buildOracleConsensus("JPY/USD", refs.JPY_USD),
    buildOracleConsensus("CNY/USD", refs.CNY_USD),
    buildOracleConsensus("XAU/USD", refs.XAU_USD),
  ];
  return {
    pairs,
    anyPaused: pairs.some((p) => p.paused),
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
