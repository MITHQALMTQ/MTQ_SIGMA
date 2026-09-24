// MTQΣ — Historical FX + Gold + Macro data fetcher (Layer 6 backtest input)
// =========================================================================
// Task ID:    LAYER6-BACKTEST
// Agent:      general-purpose
//
// Purpose:
//   Fetches 10 years of daily historical data from three free APIs:
//     - FRED (Federal Reserve Economic Data) — VIX, DXY, 10Y Treasury yield.
//       Requires FRED_API_KEY (set in .env.local).
//       NOTE: FRED's London Gold AM fix series (GOLDAMGBD228NLBM) was
//       discontinued in 2024. We try it first for forward compatibility
//       (in case FRED re-publishes), then fall back to Yahoo Finance.
//     - Yahoo Finance — GC=F (COMEX gold futures, continuous front-month)
//       as a free proxy for spot gold (XAU/USD). No key required. Server-
//       side fetches need a User-Agent header (same convention as fx.ts's
//       Yahoo ^VIX fetch).
//     - Frankfurter (free, no key, ECB reference rates) — EUR/USD, GBP/USD,
//       JPY/USD, CNY/USD, CHF/USD.
//
//   The merge step joins on date (Frankfurter trading days) and forward-fills
//   gold/VIX/DXY/treasury for non-overlapping publication schedules.
//
//   All rates are returned in the engine's convention: USD per 1 unit of
//   foreign currency (e.g. EUR_USD = 1.08 means 1 EUR = $1.08). Frankfurter
//   returns the inverse (1 USD = X foreign); we invert on ingest.
//
// API docs:
//   - FRED:        https://fred.stlouisfed.org/docs/api/fred/series_observations.html
//   - Yahoo chart: https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}
//   - Frankfurter: https://www.frankfurter.app/docs/
//
// Free-tier limits:
//   - FRED:        120 requests/minute (no card required)
//   - Yahoo:       unofficial, ~10-20 req/minute soft limit
//   - Frankfurter: no key, ~10-20 requests/minute soft limit
//
// To use:
//   import { fetchHistoricalData } from "./historical-data";
//   const data = await fetchHistoricalData(2015, 2025);

import { FRED_SERIES } from "./fred";

export interface HistoricalDataPoint {
  date: string;       // YYYY-MM-DD (Frankfurter trading day)
  eurUsd: number;     // USD per 1 EUR
  gbpUsd: number;     // USD per 1 GBP
  jpyUsd: number;     // USD per 1 JPY
  cnyUsd: number;     // USD per 1 CNY
  chfUsd: number;     // USD per 1 CHF
  xauUsd: number;     // USD per 1 troy oz gold (London AM fix)
  vix: number;        // CBOE VIX close
  dxy: number;        // Fed Nominal Broad Dollar Index (DXY-equivalent)
  treasury10y: number; // 10Y Treasury constant maturity yield (%)
}

export interface FredObservation {
  date: string;       // YYYY-MM-DD
  value: number;
}

export interface FrankfurterDay {
  date: string;
  rates: Record<string, number>; // 1 USD = rates.CUR foreign units
}

// =========================================================================
// FRED historical time-series fetch
// =========================================================================

const FRED_BASE = "https://api.stlouisfed.org/fred";

/**
 * Fetch a FRED series over [startDate, endDate] (inclusive). Returns the
 * observations sorted ascending by date, with invalid ("." sentinel) values
 * filtered out. Throws on HTTP/network errors; the caller should catch.
 *
 * API: /fred/series/observations?series_id=...&observation_start=...&observation_end=...
 *
 * Free tier: 120 req/min — we issue at most 4 calls per backtest (VIX, DXY,
 * Gold, Treasury10Y), so we are nowhere near the limit.
 */
export async function fetchFredHistory(
  seriesId: string,
  startDate: string,
  endDate: string,
): Promise<FredObservation[]> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    throw new Error("FRED_API_KEY not set (expected in .env.local for Layer 6 backtest)");
  }

  const url = new URL(`${FRED_BASE}/series/observations`);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("observation_start", startDate);
  url.searchParams.set("observation_end", endDate);
  url.searchParams.set("sort_order", "asc");
  // limit: 10000 is well above what 10 years of daily data needs (~3650 obs).
  url.searchParams.set("limit", "10000");

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`FRED HTTP ${res.status} for ${seriesId}: ${body.slice(0, 200)}`);
    }
    const data = await res.json() as { observations?: Array<{ date: string; value: string }> };
    const obs = (data.observations || [])
      .filter((o) => o && typeof o.value === "string" && o.value !== ".")
      .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
      .filter((o) => Number.isFinite(o.value));
    return obs;
  } finally {
    clearTimeout(t);
  }
}

// =========================================================================
// Yahoo Finance historical gold fetch (FRED fallback for spot gold)
// =========================================================================

/**
 * Fetch historical daily gold prices from Yahoo Finance's GC=F (COMEX gold
 * futures, continuous front-month) as a free proxy for spot XAU/USD.
 *
 * Used as a fallback because FRED's London Gold AM fix series
 * (GOLDAMGBD228NLBM) was discontinued in 2024.
 *
 * Yahoo chart endpoint:
 *   https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&period1=...&period2=...
 *
 * Returns the daily CLOSE price indexed by YYYY-MM-DD. Null closes (holidays
 * where the futures didn't trade) are forward-filled by the merge step.
 *
 * Throws on HTTP/network errors; the caller should catch.
 */
export async function fetchYahooGoldHistory(
  startDate: string,
  endDate: string,
): Promise<FredObservation[]> {
  // Convert YYYY-MM-DD → Unix seconds (UTC).
  const period1 = Math.floor(Date.parse(`${startDate}T00:00:00Z`) / 1000);
  const period2 = Math.floor(Date.parse(`${endDate}T00:00:00Z`) / 1000);
  if (!Number.isFinite(period1) || !Number.isFinite(period2)) {
    throw new Error(`fetchYahooGoldHistory: bad date range ${startDate}..${endDate}`);
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&period1=${period1}&period2=${period2}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (MTQ-Pilot/1.0)", // required by Yahoo
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Yahoo HTTP ${res.status} for GC=F: ${body.slice(0, 200)}`);
    }
    const data = await res.json() as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            quote?: Array<{ close?: (number | null)[] }>;
          };
        }>;
        error?: { code?: string; description?: string };
      };
    };
    const result = data?.chart?.result?.[0];
    if (!result) {
      const err = data?.chart?.error;
      throw new Error(`Yahoo chart error: ${err?.code ?? "unknown"} — ${err?.description ?? ""}`);
    }
    const ts = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const obs: FredObservation[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      if (typeof c === "number" && Number.isFinite(c) && c > 0) {
        // Yahoo timestamps are UTC seconds; format as YYYY-MM-DD UTC.
        const d = new Date(ts[i] * 1000);
        const date = d.toISOString().slice(0, 10);
        obs.push({ date, value: c });
      }
    }
    // Sort ascending and dedupe by date (Yahoo occasionally returns duplicate timestamps).
    obs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return obs;
  } finally {
    clearTimeout(t);
  }
}

// =========================================================================
// Frankfurter historical time-series fetch
// =========================================================================

/**
 * Fetch Frankfurter's daily reference rates for the [startDate, endDate] range.
 * Frankfurter returns 1 USD = X foreign units for each requested target currency.
 * We return the raw rates map; the merge step in fetchHistoricalData inverts to
 * USD-per-1-foreign for the engine's convention.
 *
 * Two endpoints are tried in order:
 *   1. https://api.frankfurter.app/{start}..{end}?from=USD&to=EUR,GBP,JPY,CNY,CHF
 *      (newer "from" parameter convention)
 *   2. https://api.frankfurter.dev/v1/{start}..{end}?base=USD&symbols=EUR,GBP,JPY,CNY,CHF
 *      (dev mirror with the older "base" convention — kept as fallback)
 *
 * Frankfurter covers 1999-01-04 onward (ECB reference rates history). No API
 * key required. Throws if both endpoints fail.
 */
export async function fetchFrankfurterHistory(
  startDate: string,
  endDate: string,
): Promise<FrankfurterDay[]> {
  const targets = "EUR,GBP,JPY,CNY,CHF";
  const urls = [
    `https://api.frankfurter.app/${startDate}..${endDate}?from=USD&to=${targets}`,
    `https://api.frankfurter.dev/v1/${startDate}..${endDate}?base=USD&symbols=${targets}`,
  ];

  let lastErr: unknown = null;
  for (const url of urls) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 60_000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) {
        lastErr = new Error(`Frankfurter HTTP ${res.status} for ${url}`);
        continue;
      }
      const data = await res.json() as {
        amount?: number;
        base?: string;
        start_date?: string;
        end_date?: string;
        rates?: Record<string, Record<string, number>>;
      };
      if (!data.rates || typeof data.rates !== "object") {
        lastErr = new Error(`Frankfurter response missing 'rates' for ${url}`);
        continue;
      }
      const days: FrankfurterDay[] = Object.entries(data.rates)
        .map(([date, r]) => ({ date, rates: r as Record<string, number> }))
        .filter((d) =>
          Number.isFinite(d.rates?.EUR) &&
          Number.isFinite(d.rates?.GBP) &&
          Number.isFinite(d.rates?.JPY) &&
          Number.isFinite(d.rates?.CNY) &&
          Number.isFinite(d.rates?.CHF),
        )
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      if (days.length > 0) return days;
      lastErr = new Error(`Frankfurter returned 0 valid days for ${url}`);
    } catch (e) {
      lastErr = e;
      // try next endpoint
    }
  }
  throw new Error(
    `All Frankfurter endpoints failed for ${startDate}..${endDate}: ` +
    (lastErr instanceof Error ? lastErr.message : String(lastErr)),
  );
}

// =========================================================================
// Merge: Frankfurter FX + FRED macro/gold → unified HistoricalDataPoint[]
// =========================================================================

/**
 * Fetch and merge 10 years (or any range) of historical FX + gold + macro data.
 *
 * Strategy:
 *   1. Fetch all 4 FRED series + Frankfurter in parallel.
 *   2. If FRED fails entirely (no API key, rate limit, network), still return
 *      the Frankfurter-only series with gold/macro forward-filled from the
 *      BASE_FIXINGS defaults — so the backtest can run with degraded data
 *      rather than crash. The caller can inspect the returned `degraded`
 *      flag on the result wrapper to detect this.
 *   3. Merge on Frankfurter trading days (ECB business days). For each day,
 *      look up FRED gold/VIX/DXY/treasury; if missing (different publication
 *      schedule), forward-fill from the most recent prior FRED observation.
 *
 * Returns:
 *   - points:  the merged HistoricalDataPoint[] sorted ascending by date
 *   - sources: which sources contributed (for the audit log)
 *   - degraded: true if any source was missing (forward-filled from defaults)
 */
export async function fetchHistoricalData(
  startYear: number,
  endYear: number,
): Promise<{
  points: HistoricalDataPoint[];
  sources: {
    frankfurter: number;
    fredVix: number;
    fredDxy: number;
    fredGold: number;
    fredTreasury: number;
  };
  degraded: boolean;
  degradedReasons: string[];
}> {
  const startDate = `${startYear}-01-01`;
  const endDate = `${endYear}-01-01`;

  console.log(`[historical-data] Fetching ${startYear}-${endYear} from FRED + Yahoo + Frankfurter…`);

  // Fire all 6 fetches in parallel. Each FRED fetch has its own catch — a
  // failure degrades the backtest but doesn't crash it.
  const [vixObs, dxyObs, fredGoldObs, treasuryObs, yahooGoldObs, frankfurterDays] = await Promise.all([
    fetchFredHistory(FRED_SERIES.VIX, startDate, endDate).catch((e: unknown) => {
      console.warn(`[historical-data] VIX fetch failed:`, (e as Error).message);
      return [] as FredObservation[];
    }),
    fetchFredHistory(FRED_SERIES.DXY, startDate, endDate).catch((e: unknown) => {
      console.warn(`[historical-data] DXY fetch failed:`, (e as Error).message);
      return [] as FredObservation[];
    }),
    fetchFredHistory(FRED_SERIES.GOLD_LONDON, startDate, endDate).catch((e: unknown) => {
      // Expected — FRED discontinued GOLDAMGBD228NLBM in 2024. We have a
      // Yahoo Finance fallback. Don't log a warning (expected failure).
      return [] as FredObservation[];
    }),
    fetchFredHistory(FRED_SERIES.TREASURY_10Y, startDate, endDate).catch((e: unknown) => {
      console.warn(`[historical-data] Treasury fetch failed:`, (e as Error).message);
      return [] as FredObservation[];
    }),
    // Yahoo Finance gold fallback (free, no key) — used when FRED's London
    // Gold AM fix series is unavailable.
    fetchYahooGoldHistory(startDate, endDate).catch((e: unknown) => {
      console.warn(`[historical-data] Yahoo gold fetch failed:`, (e as Error).message);
      return [] as FredObservation[];
    }),
    fetchFrankfurterHistory(startDate, endDate).catch((e: unknown) => {
      console.warn(`[historical-data] Frankfurter fetch failed:`, (e as Error).message);
      return [] as FrankfurterDay[];
    }),
  ]);

  // Prefer FRED gold (London AM fix) when available; fall back to Yahoo gold
  // futures (GC=F) as a spot-gold proxy. If both fail, the constant default
  // is used (degraded).
  let goldObs: FredObservation[] = fredGoldObs;
  let goldSource = "FRED (London AM fix)";
  if (goldObs.length === 0 && yahooGoldObs.length > 0) {
    goldObs = yahooGoldObs;
    goldSource = "Yahoo Finance (GC=F gold futures — FRED London Gold AM fix discontinued)";
  }

  console.log(
    `[historical-data] Fetched: VIX=${vixObs.length}, DXY=${dxyObs.length}, ` +
    `Gold=${goldObs.length} [${goldSource}], Treasury=${treasuryObs.length}, ` +
    `Frankfurter=${frankfurterDays.length}`,
  );

  const degradedReasons: string[] = [];
  if (vixObs.length === 0) degradedReasons.push("VIX: FRED returned no observations (using seeded default)");
  if (dxyObs.length === 0) degradedReasons.push("DXY: FRED returned no observations (using seeded default)");
  if (goldObs.length === 0) degradedReasons.push("Gold: both FRED and Yahoo returned no observations (using BASE_FIXINGS default)");
  if (treasuryObs.length === 0) degradedReasons.push("Treasury: FRED returned no observations (using default)");
  if (frankfurterDays.length === 0) {
    degradedReasons.push("Frankfurter: returned no FX days — backtest cannot run without FX data");
  }

  // Index FRED/Yahoo data by date for O(1) lookup.
  const vixMap = new Map(vixObs.map((o) => [o.date, o.value]));
  const dxyMap = new Map(dxyObs.map((o) => [o.date, o.value]));
  const goldMap = new Map(goldObs.map((o) => [o.date, o.value]));
  const treasuryMap = new Map(treasuryObs.map((o) => [o.date, o.value]));

  // Defaults for forward-fill (only used if data sources returned no data at all).
  let lastVix = 18.5;
  let lastDxy = 104.2;
  let lastGold = 2500;
  let lastTreasury = 2.5;

  // Seed forward-fill with the first observation from each source (if available)
  // so we don't use the static defaults when actual data exists.
  if (vixObs.length > 0) lastVix = vixObs[0].value;
  if (dxyObs.length > 0) lastDxy = dxyObs[0].value;
  if (goldObs.length > 0) lastGold = goldObs[0].value;
  if (treasuryObs.length > 0) lastTreasury = treasuryObs[0].value;

  const points: HistoricalDataPoint[] = [];
  for (const f of frankfurterDays) {
    // Look up FRED/Yahoo data for this exact date; forward-fill if missing.
    const v = vixMap.get(f.date);
    if (v !== undefined) lastVix = v;
    const d = dxyMap.get(f.date);
    if (d !== undefined) lastDxy = d;
    const g = goldMap.get(f.date);
    if (g !== undefined) lastGold = g;
    const tr = treasuryMap.get(f.date);
    if (tr !== undefined) lastTreasury = tr;

    // Frankfurter convention: 1 USD = rates.EUR euros.
    // Engine convention:     EUR_USD = USD per 1 EUR = 1 / rates.EUR.
    const eurUsd = f.rates.EUR ? 1 / f.rates.EUR : 0;
    const gbpUsd = f.rates.GBP ? 1 / f.rates.GBP : 0;
    const jpyUsd = f.rates.JPY ? 1 / f.rates.JPY : 0;
    const cnyUsd = f.rates.CNY ? 1 / f.rates.CNY : 0;
    const chfUsd = f.rates.CHF ? 1 / f.rates.CHF : 0;

    // Sanity: reject any row with non-positive FX (parse error).
    if (!(eurUsd > 0) || !(gbpUsd > 0) || !(jpyUsd > 0) || !(cnyUsd > 0) || !(chfUsd > 0) || !(lastGold > 0)) {
      continue;
    }

    points.push({
      date: f.date,
      eurUsd,
      gbpUsd,
      jpyUsd,
      cnyUsd,
      chfUsd,
      xauUsd: lastGold,
      vix: lastVix,
      dxy: lastDxy,
      treasury10y: lastTreasury,
    });
  }

  return {
    points,
    sources: {
      frankfurter: frankfurterDays.length,
      fredVix: vixObs.length,
      fredDxy: dxyObs.length,
      fredGold: goldObs.length,
      fredTreasury: treasuryObs.length,
    },
    degraded: degradedReasons.length > 0,
    degradedReasons,
  };
}
