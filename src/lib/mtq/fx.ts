// MTQΣ — Live FX & Macro Signal Fetcher
// Free, no-API-key sources. Cached in-memory for 60s. Graceful fallbacks.
//
// Sources:
//  - FX (EUR/GBP/JPY/CNY vs USD): Frankfurter API (ECB reference rates)
//      https://api.frankfurter.dev/v1/latest?base=USD  (primary)
//      https://api.frankfurter.app/v1/latest?base=USD (fallback)
//  - Gold (XAU/USD): gold-api.com (free, no key)
//      https://api.gold-api.com/price/XAU
//  - VIX / DXY: no free no-key REST API. These are SIMULATED honestly as
//    "pilot macro signals" via a seeded stochastic walk in the feed service.
//    This is labelled clearly in the UI so we never misrepresent them.

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
}

const DEFAULTS: Omit<FxSnapshot, "fetchedAt" | "source" | "degraded"> = {
  // Plausible late-2025 values (only used if all live sources fail)
  EUR_USD: 1.08,
  GBP_USD: 1.27,
  JPY_USD: 0.0066,
  CNY_USD: 0.139,
  CHF_USD: 0.88, // ~0.88 USD per CHF (matches BASE_FIXINGS.CHF_USD in blueprint v1.0)
  XAU_USD: 2650,
  VIX: 18.5,
  DXY: 104.2,
};

let cache: FxSnapshot | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60_000;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

async function fetchFrankfurter(): Promise<Partial<FxSnapshot>> {
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
        return { EUR_USD, GBP_USD, JPY_USD, CNY_USD, ...(CHF_USD ? { CHF_USD } : {}) };
      }
    } catch {
      // try next
    }
  }
  return {};
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

export async function fetchFxSnapshot(force = false): Promise<FxSnapshot> {
  const now = Date.now();
  if (cache && !force && now - cacheTime < CACHE_TTL_MS) {
    return cache;
  }

  const degraded = false;
  const fx = await fetchFrankfurter();
  const gold = await fetchGold();

  // Macro signals (VIX/DXY) are carried by the feed service via stochastic walk;
  // here we just keep the last known or default. The feed service mutates these.
  const VIX = cache?.VIX ?? DEFAULTS.VIX;
  const DXY = cache?.DXY ?? DEFAULTS.DXY;

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
    source: fx.EUR_USD && gold ? "Live (Frankfurter ECB + gold-api)" : "Cached / fallback",
    degraded,
  };

  cache = snapshot;
  cacheTime = now;
  return snapshot;
}

// Used by the feed service to push macro-signal updates (stochastic walk).
export function updateMacroSignals(vix: number, dxy: number): void {
  if (cache) {
    cache.VIX = clamp(vix, VIX_MIN, VIX_MAX);
    cache.DXY = clamp(dxy, DXY_MIN, DXY_MAX);
    cacheTime = Date.now();
  }
}
