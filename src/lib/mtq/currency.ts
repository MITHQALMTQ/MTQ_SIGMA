// MTQΣ — Multi-Currency Utilities
// 7 currencies: USD / EUR / GBP / JPY / CNY / CHF / XAU (Gold troy oz)
// Live FX conversion from the engine's FxSnapshot.

export type CurrencyCode = "USD" | "EUR" | "GBP" | "JPY" | "CNY" | "CHF" | "XAU";

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  decimals: number;
  fxKey: keyof import("@/lib/mtq/fx").FxSnapshot | null;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  USD: { code: "USD", symbol: "$", name: "US Dollar", decimals: 2, fxKey: null },
  EUR: { code: "EUR", symbol: "€", name: "Euro", decimals: 2, fxKey: "EUR_USD" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", decimals: 2, fxKey: "GBP_USD" },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", decimals: 0, fxKey: "JPY_USD" },
  CNY: { code: "CNY", symbol: "¥", name: "Chinese Yuan", decimals: 2, fxKey: "CNY_USD" },
  CHF: { code: "CHF", symbol: "₣", name: "Swiss Franc", decimals: 2, fxKey: "CHF_USD" },
  XAU: { code: "XAU", symbol: "oz", name: "Gold (troy oz)", decimals: 4, fxKey: "XAU_USD" },
};

type FxLike = { EUR_USD: number; GBP_USD: number; JPY_USD: number; CNY_USD: number; CHF_USD: number; XAU_USD: number };

export function convertFromUsd(usdAmount: number, currency: CurrencyCode, fx: FxLike): number {
  if (currency === "USD") return usdAmount;
  const info = CURRENCIES[currency];
  if (!info.fxKey) return usdAmount;
  const rate = (fx as Record<string, number>)[info.fxKey];
  if (!rate || rate <= 0) return usdAmount;
  return usdAmount / rate;
}

export function formatCurrency(usdAmount: number, currency: CurrencyCode, fx: FxLike): string {
  const info = CURRENCIES[currency];
  const converted = convertFromUsd(usdAmount, currency, fx);
  if (currency === "XAU") return `${converted.toFixed(info.decimals)} ${info.symbol}`;
  if (currency === "JPY") return `${info.symbol}${Math.round(converted).toLocaleString()}`;
  return `${info.symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: info.decimals, maximumFractionDigits: info.decimals })}`;
}

export function formatCurrencyCompact(usdAmount: number, currency: CurrencyCode, fx: FxLike): string {
  const info = CURRENCIES[currency];
  const converted = convertFromUsd(usdAmount, currency, fx);
  const abs = Math.abs(converted);
  if (currency === "XAU") return `${converted.toFixed(2)} oz`;
  if (abs >= 1_000_000) return `${info.symbol}${(converted / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${info.symbol}${(converted / 1_000).toFixed(1)}K`;
  return formatCurrency(usdAmount, currency, fx);
}

export function loadStoredCurrency(): CurrencyCode {
  if (typeof window === "undefined") return "USD";
  const stored = localStorage.getItem("mtqs:display-currency");
  if (stored && stored in CURRENCIES) return stored as CurrencyCode;
  return "USD";
}

export function storeCurrency(c: CurrencyCode): void {
  if (typeof window !== "undefined") localStorage.setItem("mtqs:display-currency", c);
}
