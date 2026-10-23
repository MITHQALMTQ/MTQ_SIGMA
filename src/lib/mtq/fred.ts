// MTQΣ — FRED (Federal Reserve Economic Data) API client
//
// FRED provides free economic time series: VIX, DXY, Treasury yields,
// inflation breakevens, gold (London PM fix), CPI, GDP, etc.
//
// Used as:
//   1. A supplementary oracle source for VIX + DXY (alongside Yahoo Finance)
//   2. The macro dashboard's "official" economic data feed
//   3. A cross-check for the §6 adaptive macro engine
//
// API docs: https://fred.stlouisfed.org/docs/api/fred/
// Free tier: 120 requests/minute, no credit card.

export interface FredObservation {
  date: string;       // YYYY-MM-DD
  value: number | null;
  realtimeStart: string;
  realtimeEnd: string;
}

export interface FredSeries {
  seriesId: string;
  title: string;
  units: string;
  frequency: string;
  observations: FredObservation[];
  latestValue: number | null;
  latestDate: string | null;
}

// Canonical FRED series IDs used by the MTQΣ protocol.
// These are the "constitutional" economic inputs for the §6 macro engine.
export const FRED_SERIES = {
  VIX: "VIXCLS",                    // CBOE Volatility Index (VIX) — daily close
  DXY: "DTWEXBGS",                  // Nominal Broad U.S. Dollar Index (DXY equivalent)
  GOLD_LONDON: "GOLDAMGBD228NLBM",  // London Bullion Market Gold Price (AM fix, USD/oz)
  TREASURY_10Y: "DGS10",            // 10-Year Treasury Constant Maturity Rate
  TREASURY_2Y: "DGS2",              // 2-Year Treasury Constant Maturity Rate
  TREASURY_3M: "DGS3MO",            // 3-Month Treasury Constant Maturity Rate
  BREAKEVEN_10Y: "T10YIE",          // 10-Year Breakeven Inflation Rate
  CPI: "CPIAUCSL",                  // Consumer Price Index: All Items
  FED_FUNDS: "FEDFUNDS",            // Effective Federal Funds Rate
  UNEMPLOYMENT: "UNRATE",           // Civilian Unemployment Rate
} as const;

export type FredSeriesId = keyof typeof FRED_SERIES;

const FRED_BASE = "https://api.stlouisfed.org/fred";

/**
 * Fetch the latest observations for a FRED series.
 * Returns the most recent `limit` observations (default 5).
 */
export async function fetchFredSeries(
  seriesId: string,
  limit = 5,
): Promise<FredSeries> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    throw new Error("FRED_API_KEY not set");
  }

  const url = new URL(`${FRED_BASE}/series/observations`);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("observation_start", new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));

  const res = await fetch(url.toString(), {
    headers: { "Accept": "application/json" },
    next: { revalidate: 300 }, // cache 5 min
  });

  if (!res.ok) {
    throw new Error(`FRED API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const observations: FredObservation[] = (data.observations || [])
    .filter((o: any) => o.value !== ".")
    .map((o: any) => ({
      date: o.date,
      value: parseFloat(o.value),
      realtimeStart: o.realtime_start,
      realtimeEnd: o.realtime_end,
    }));

  const latest = observations[0] || null;

  // Fetch series metadata
  const metaUrl = new URL(`${FRED_BASE}/series`);
  metaUrl.searchParams.set("series_id", seriesId);
  metaUrl.searchParams.set("api_key", apiKey);
  metaUrl.searchParams.set("file_type", "json");
  const metaRes = await fetch(metaUrl.toString(), { next: { revalidate: 3600 } });
  const metaData = metaRes.ok ? await metaRes.json() : {};
  const seriesMeta = metaData.seriess?.[0] || {};

  return {
    seriesId,
    title: seriesMeta.title || seriesId,
    units: seriesMeta.units || "",
    frequency: seriesMeta.frequency || "",
    observations,
    latestValue: latest?.value ?? null,
    latestDate: latest?.date ?? null,
  };
}

/**
 * Fetch the latest value for multiple FRED series in parallel.
 * Returns a map of seriesId → FredSeries.
 */
export async function fetchFredBatch(
  seriesIds: string[],
  limit = 5,
): Promise<Record<string, FredSeries>> {
  const entries = await Promise.all(
    seriesIds.map(async (id) => {
      try {
        const series = await fetchFredSeries(id, limit);
        return [id, series] as const;
      } catch (e) {
        return [id, {
          seriesId: id,
          title: id,
          units: "",
          frequency: "",
          observations: [],
          latestValue: null,
          latestDate: null,
        }] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Get the latest VIX and DXY from FRED.
 * Used as a supplementary oracle source for the §6 macro engine.
 */
export async function fetchFredMacroSignals(): Promise<{
  vix: number | null;
  dxy: number | null;
  gold: number | null;
  treasury10y: number | null;
  treasury2y: number | null;
  breakeven10y: number | null;
  source: string;
  fetchedAt: number;
}> {
  const batch = await fetchFredBatch([
    FRED_SERIES.VIX,
    FRED_SERIES.DXY,
    FRED_SERIES.GOLD_LONDON,
    FRED_SERIES.TREASURY_10Y,
    FRED_SERIES.TREASURY_2Y,
    FRED_SERIES.BREAKEVEN_10Y,
  ], 1);

  return {
    vix: batch[FRED_SERIES.VIX]?.latestValue ?? null,
    dxy: batch[FRED_SERIES.DXY]?.latestValue ?? null,
    gold: batch[FRED_SERIES.GOLD_LONDON]?.latestValue ?? null,
    treasury10y: batch[FRED_SERIES.TREASURY_10Y]?.latestValue ?? null,
    treasury2y: batch[FRED_SERIES.TREASURY_2Y]?.latestValue ?? null,
    breakeven10y: batch[FRED_SERIES.BREAKEVEN_10Y]?.latestValue ?? null,
    source: "FRED (Federal Reserve Economic Data)",
    fetchedAt: Date.now(),
  };
}
