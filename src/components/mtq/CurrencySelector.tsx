"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CurrencyCode } from "@/lib/mtq/currency";

// MTQΣ — Currency Provider + Selector
// React Context for the user's display currency preference.
// Persisted to localStorage so it survives page reloads.

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "USD",
  setCurrency: () => {},
});

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");

  useEffect(() => {
    const stored = localStorage.getItem("mtqs:display-currency");
    if (stored && ["USD", "EUR", "GBP", "JPY", "CNY", "CHF", "XAU"].includes(stored)) {
      setCurrencyState(stored as CurrencyCode);
    }
  }, []);

  const setCurrency = (c: CurrencyCode) => {
    setCurrencyState(c);
    localStorage.setItem("mtqs:display-currency", c);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  USD: "$ USD",
  EUR: "€ EUR",
  GBP: "£ GBP",
  JPY: "¥ JPY",
  CNY: "¥ CNY",
  CHF: "₣ CHF",
  XAU: "oz Gold",
};

export function CurrencySelector({ value, onChange }: { value: CurrencyCode; onChange: (c: CurrencyCode) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as CurrencyCode)}>
      <SelectTrigger className="w-[90px] h-8 text-xs mtqs-glass border-white/[0.06]" aria-label="Display currency">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(CURRENCY_LABELS) as CurrencyCode[]).map((code) => (
          <SelectItem key={code} value={code}>
            {CURRENCY_LABELS[code]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CurrencySymbolBadge({ currency }: { currency: CurrencyCode }) {
  const symbols: Record<CurrencyCode, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", CHF: "₣", XAU: "oz" };
  return <span className="text-mtqs-gold text-xs font-mono">{symbols[currency]}</span>;
}
