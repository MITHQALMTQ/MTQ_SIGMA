// MTQΣ — Live FX & Macro Signal Fetcher
// Free, no-API-key sources. Cached in-memory for 60s. Graceful fallbacks.
//
// Sources:
//  - FX (EUR/GBP/JPY/CNY/CHF vs USD): Frankfurter API (ECB reference rates)
//      https://api.frankfurter.dev/v1/latest?base=USD  (primary)
//      https://api.frankfurter.app/v1/latest?base=USD  (fallback)
//  - Gold (XAU/USD): gold-api.com (free, no key)
//      https://api.gold-api.com/price/XAU
//  - VIX: Yahoo Finance ^VIX (free, no key, server-side fetch with User-Agent)
//      https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX
//      https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX
//      (falls back to a seeded stochastic walk if Yahoo rate-limits or fails)
//  - DXY: no free no-key REST API found. SIMULATED honestly as a "pilot macro
//      signal" via a seeded Ornstein-Uhlenbeck stochastic walk (deterministic
//      per UTC day so all fetches within the same day return the same value —
//      reproducibility for the §23 validation program). Clearly labelled in
//      the UI as "simulated pilot macro signals" so we never misrepresent it.
//
// Audit finding F-CHF-01 (Master Reconciliation): the legacy fallback
// CHF_USD = 0.88 understated CHF by ~28%. The Master Blueprint v1.0 specifies
// BASE_CHF_USD = 1.13. The fallback default is fixed to 1.13 to match Master.

import {
  VIX_MAX,
  VIX_MIN,
  DXY_MAX,
  DXY_MIN,
} from "./blueprint";

export interface FxSnapshot {
  EUR_USD: number;
  GBP_USD: number;
  JPY_USD: number;
  CNY_USD: number;
  CHF_USD: number; // NEW v1.0 — CHF is now a first-class index component (5% prior)
  XAU_USD: number;
  VIX: number;
  DXY: number;
  fetchedAt: number;
  source: string;
  degraded: boolean;
  // FX-HARDEN: how many of the 8 signals (EUR/GBP/JPY/CNY/CHF/XAU/VIX/DXY) are
  // live in this snapshot. Max 8 (all live). The UI can show "live, fetched Xs
  // ago" using fetchedAt + liveCount. Optional for backward compat with internal
  // mock constructors (audit-stress, tests).
  liveCount?: number;
  // LIVE-DXY-RESOLVE: per-signal liveness flags so the engine's tick loop can
  // decide whether to apply stepMacroSignals (only step simulated signals, never
  // overwrite live values with a stochastic walk). If liveVix/liveDxy are true,
  // the VIX/DXY values are from Yahoo Finance and must NOT be stepped.
  liveVix?: boolean;
  liveDxy?: boolean;
}

const DEFAULTS: Omit<FxSnapshot, "fetchedAt" | "source" | "degraded" | "liveCount"> = {
  // Plausible late-2025 values (only used if all live sources fail).
  EUR_USD: 1.08,
  GBP_USD: 1.27,
  JPY_USD: 0.0066,
  CNY_USD: 0.139,
  // Matches Master Listing 1 BASE_CHF_USD = 1.13 (was 0.88 in legacy v1.2 —
  // fixed per audit finding F-CHF-01; the Swiss franc is stronger than 0.88
  // USD per CHF, and the Master Blueprint v1.0 fixes this at 1.13).
  CHF_USD: 1.13,
  // Updated to late-2025 level; was 2650 (stale 2024 number). The live gold-api
  // feed usually returns ~$4,358/oz; this default only kicks in if it fails.
  XAU_USD: 4358,
  VIX: 19,   // historical mean (seeded walk usually replaces this)
  DXY: 104,  // historical mean (seeded walk usually replaces this)
};

let cache: FxSnapshot | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60_000;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// --- Seeded stochastic walk (VIX/DXY simulation) -------------------------
// Honest simulation: no free no-key REST API exists for DXY, and Yahoo
// Finance's ^VIX endpoint can rate-limit. When the live source is unavailable
// (or for DXY always), we generate a deterministic mean-reverting Ornstein–
// Uhlenbeck walk seeded by the UTC day. All fetches within the same UTC day
// return the same value — reproducibility for the §23 validation program.
//
//   v_{t+1} = μ + (v_t − μ) × (1 − θ) + σ × N(0,1)
//
// PRNG: mulberry32 (deterministic, fast, good enough for a simulation).
// Normal: Box–Muller transform.

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function standardNormal(rng: () => number): number {
  // Box–Muller transform (1 normal costs 2 uniforms)
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
}

function simulatedOuWalk(
  now: number,
  mean: number,
  sigma: number,
  theta: number,
  seedSalt: number,
  lo: number,
  hi: number,
): number {
  // Deterministic seed from the UTC day + a per-signal salt (so VIX and DXY
  // are decorrelated). All fetches within the same UTC day return the same
  // value — reproducibility for the §23 validation program.
  const day = Math.floor(now / 86_400_000); // UTC day index
  const rng = mulberry32((day * 2654435761 + seedSalt) >>> 0);
  // Simulate 30 days forward from the mean; return the last value.
  let v = mean;
  for (let i = 0; i < 30; i++) {
    v = mean + (v - mean) * (1 - theta) + sigma * standardNormal(rng);
  }
  return clamp(v, lo, hi);
}

function simulatedVix(now: number): number {
  // VIX ~ OU(μ=19, σ=2, θ=0.1), bounds [10, 80] per blueprint
  return simulatedOuWalk(now, 19, 2, 0.1, 0x9e3779b9, VIX_MIN, VIX_MAX);
}

function simulatedDxy(now: number): number {
  // DXY ~ OU(μ=104, σ=2, θ=0.1), bounds [80, 120] per blueprint
  // (no free no-key REST API found — honest simulation)
  return simulatedOuWalk(now, 104, 2, 0.1, 0x85ebca77, DXY_MIN, DXY_MAX);
}

// --- Live sources ---------------------------------------------------------

async function fetchFrankfurter(): Promise<{ fx: Partial<FxSnapshot>; raw?: Record<string, number> }> {
  const urls = [
    "https://api.frankfurter.dev/v1/latest?base=USD",
    "https://api.frankfurter.app/v1/latest?base=USD",
  ];
  for (const url of urls) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const data = await res.json();
      const r = data?.rates;
      if (!r) continue;
      // Frankfurter returns USD -> target rates (i.e., 1 USD = r.EUR euros).
      // We need USD per 1 unit of currency: FX_EUR/USD = 1 / r.EUR
      const EUR_USD = r.EUR ? 1 / Number(r.EUR) : undefined;
      const GBP_USD = r.GBP ? 1 / Number(r.GBP) : undefined;
      const JPY_USD = r.JPY ? 1 / Number(r.JPY) : undefined;
      const CNY_USD = r.CNY ? 1 / Number(r.CNY) : undefined;
      // NEW v1.0: CHF added as a first-class index component. ECB/Frankfurter
      // publishes CHF reference rates — Swiss franc is in the ECB's reference
      // currency list. We invert the same way (USD per 1 CHF = 1 / r.CHF).
      const CHF_USD = r.CHF ? 1 / Number(r.CHF) : undefined;
      if (EUR_USD && GBP_USD && JPY_USD && CNY_USD) {
        // CHF is optional — fall back to cache/default if the feed omits it.
        const fx: Partial<FxSnapshot> = { EUR_USD, GBP_USD, JPY_USD, CNY_USD, ...(CHF_USD ? { CHF_USD } : {}) };
        // Return the raw rates map for the DXY self-calc fallback (needs CAD + SEK + CHF).
        return { fx, raw: r as Record<string, number> };
      }
    } catch {
      // try next
    }
  }
  return { fx: {} };
}

async function fetchGold(): Promise<number | undefined> {
  const urls = [
    "https://api.gold-api.com/price/XAU",
    "https://api.metalpriceapi.com/v1/latest?api_key=demo&base=USD&symbols=XAU",
  ];
  for (const url of urls) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const data = await res.json();
      const price = data?.price ?? data?.rates?.XAU;
      if (price && Number(price) > 0) return Number(price);
    } catch {
      // try next
    }
  }
  return undefined;
}

// Yahoo Finance ^VIX — free, no API key. Returns regularMarketPrice from the
// chart endpoint. Yahoo rate-limits unauthenticated server-side requests,
// so we mirror between query1/query2 and send a User-Agent header (server-
// side fetches without one are rejected with "Edge: Too Many Requests").
// Returns undefined if both endpoints fail or return an implausible value.
async function fetchLiveVix(): Promise<number | undefined> {
  const urls = [
    "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1d",
    "https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1d",
  ];
  for (const url of urls) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { "User-Agent": "Mozilla/5.0 (MTQ-Pilot/1.0)" },
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) continue;
      // Prefer regularMarketPrice; fall back to chartPreviousClose (the
      // previous session's close, useful if the market is closed).
      const vix =
        typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice :
        typeof meta.chartPreviousClose === "number" ? meta.chartPreviousClose :
        undefined;
      // Sanity check: VIX has historically been in [9, 90]. Reject anything
      // outside [1, 200] as a parsing error.
      if (vix !== undefined && vix > 1 && vix < 200) return vix;
    } catch {
      // try next
    }
  }
  return undefined;
}

// --- Live DXY (ICE US Dollar Index) ---
// Primary: Yahoo Finance ^DX-Y.NYB (the ICE US Dollar Index futures ticker).
//   Returns the canonical DXY the financial world references.
// Fallback: Frankfurter self-calc using the official geometric weighted formula
//   DXY = 50.14348112 × EURUSD^-0.576 × USDJPY^0.136 × GBPUSD^-0.119
//                          × USDCAD^0.091 × USDSEK^0.042 × USDCHF^0.036
//   Requires CAD + SEK + CHF from Frankfurter (which it provides).
// Last resort: seeded OU walk (simulatedDxy) — honest fallback, clearly labeled.
async function fetchLiveDxy(frankfurterRates?: Record<string, number>): Promise<number | undefined> {
  // Primary: Yahoo Finance DX-Y.NYB
  const yahooUrls = [
    "https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&range=1d",
    "https://query2.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&range=1d",
  ];
  for (const url of yahooUrls) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { "User-Agent": "Mozilla/5.0 (MTQ-Pilot/1.0)" },
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) continue;
      const dxy =
        typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice :
        typeof meta.chartPreviousClose === "number" ? meta.chartPreviousClose :
        undefined;
      // DXY has historically been in [70, 130]. Reject anything outside [50, 150].
      if (dxy !== undefined && dxy > 50 && dxy < 150) return dxy;
    } catch {
      // try next
    }
  }
  // Fallback: Frankfurter self-calc using the official DXY formula.
  // Frankfurter returns USD->target rates (e.g., 1 USD = r.EUR euros).
  // The DXY formula uses the inverse (USD per 1 unit of currency) for EUR/GBP,
  // and the direct rate (foreign per 1 USD) for JPY/CAD/SEK/CHF.
  if (frankfurterRates) {
    try {
      const r = frankfurterRates;
      if (r.EUR && r.JPY && r.GBP && r.CAD && r.SEK && r.CHF) {
        const eurusd = 1 / Number(r.EUR);  // USD per 1 EUR
        const usdjpy = Number(r.JPY);       // JPY per 1 USD
        const gbpusd = 1 / Number(r.GBP);   // USD per 1 GBP
        const usdcad = Number(r.CAD);       // CAD per 1 USD
        const usdsek = Number(r.SEK);       // SEK per 1 USD
        const usdchf = Number(r.CHF);       // CHF per 1 USD
        const dxy =
          50.14348112 *
          Math.pow(eurusd, -0.576) *
          Math.pow(usdjpy, 0.136) *
          Math.pow(gbpusd, -0.119) *
          Math.pow(usdcad, 0.091) *
          Math.pow(usdsek, 0.042) *
          Math.pow(usdchf, 0.036);
        if (dxy > 50 && dxy < 150) return dxy;
      }
    } catch {
      // fall through to last resort
    }
  }
  return undefined;
}

export async function fetchFxSnapshot(force = false): Promise<FxSnapshot> {
  const now = Date.now();
  if (cache && !force && now - cacheTime < CACHE_TTL_MS) {
    return cache;
  }

  const { fx, raw } = await fetchFrankfurter();
  const gold = await fetchGold();
  const liveVix = await fetchLiveVix();
  const liveDxy = await fetchLiveDxy(raw);

  // VIX: live (Yahoo) → simulated seeded walk → DEFAULTS (last resort)
  const VIX = liveVix ?? simulatedVix(now);
  // DXY: live (Yahoo DX-Y.NYB) → Frankfurter self-calc (official formula) → simulated seeded walk
  const DXY = liveDxy ?? simulatedDxy(now);

  // Count of live signals (max 8 — all of EUR/GBP/JPY/CNY/CHF/XAU/VIX/DXY can be live).
  const liveCount =
    (fx.EUR_USD ? 1 : 0) +
    (fx.GBP_USD ? 1 : 0) +
    (fx.JPY_USD ? 1 : 0) +
    (fx.CNY_USD ? 1 : 0) +
    (fx.CHF_USD ? 1 : 0) +
    (gold ? 1 : 0) +
    (liveVix ? 1 : 0) +
    (liveDxy ? 1 : 0);

  // Source string — honestly labels which signals are live vs simulated.
  const liveBits: string[] = [];
  if (fx.EUR_USD && fx.GBP_USD && fx.JPY_USD && fx.CNY_USD) liveBits.push("Frankfurter ECB");
  if (gold) liveBits.push("gold-api");
  if (liveVix) liveBits.push("Yahoo ^VIX");
  if (liveDxy) liveBits.push("Yahoo DX-Y.NYB (or Frankfurter self-calc)");
  const simBits: string[] = [];
  if (!liveVix) simBits.push("VIX");
  if (!liveDxy) simBits.push("DXY");
  const source =
    (liveBits.length > 0
      ? `Live (${liveBits.join(" + ")})`
      : "Cached / fallback") + (simBits.length > 0 ? ` + simulated ${simBits.join("/")}` : "");

  const snapshot: FxSnapshot = {
    EUR_USD: fx.EUR_USD ?? cache?.EUR_USD ?? DEFAULTS.EUR_USD,
    GBP_USD: fx.GBP_USD ?? cache?.GBP_USD ?? DEFAULTS.GBP_USD,
    JPY_USD: fx.JPY_USD ?? cache?.JPY_USD ?? DEFAULTS.JPY_USD,
    CNY_USD: fx.CNY_USD ?? cache?.CNY_USD ?? DEFAULTS.CNY_USD,
    CHF_USD: fx.CHF_USD ?? cache?.CHF_USD ?? DEFAULTS.CHF_USD,
    XAU_USD: gold ?? cache?.XAU_USD ?? DEFAULTS.XAU_USD,
    VIX: clamp(VIX, VIX_MIN, VIX_MAX),
    DXY: clamp(DXY, DXY_MIN, DXY_MAX),
    fetchedAt: now,
    source,
    degraded: false, // simulation is intentional, not a degradation
    liveCount,
    // Per-signal liveness flags so the engine's tick loop can decide whether
    // to apply stepMacroSignals (only step simulated signals, never overwrite
    // live Yahoo values with a stochastic walk).
    liveVix: !!liveVix,
    liveDxy: !!liveDxy,
  };

  cache = snapshot;
  cacheTime = now;
  return snapshot;
}

// Used by the feed service to push macro-signal updates (legacy stochastic
// walk). NOTE: as of the FX-HARDEN task, the canonical VIX/DXY values are
// produced by `fetchFxSnapshot` itself (live Yahoo ^VIX when available, else
// a deterministic seeded OU walk). This function is retained for backward
// compatibility but is NOT called by the new flow — the feed service mutates
// its own local fx copy via `stepMacroSignals` from engine.ts.
export function updateMacroSignals(vix: number, dxy: number): void {
  if (cache) {
    cache.VIX = clamp(vix, VIX_MIN, VIX_MAX);
    cache.DXY = clamp(dxy, DXY_MIN, DXY_MAX);
    cacheTime = Date.now();
  }
}
