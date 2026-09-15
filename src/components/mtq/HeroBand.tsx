"use client";

import * as React from "react";
import Image from "next/image";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import { fmtFixed, fmtRatio, rrColor } from "./format";

export function HeroBand({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10">
      <div className="relative h-[260px] w-full sm:h-[320px] lg:h-[360px]">
        <Image
          src="/mtqs-hero.png"
          alt="MTQΣ emblem — global purchasing power unit"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* gradient overlays for legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0f0e] via-[#0b0f0e]/85 to-[#0b0f0e]/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f0e] via-transparent to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-8 lg:p-10">
          <div className="max-w-3xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-300">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Closed-Loop Monetary Architecture
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-amber-50 drop-shadow sm:text-4xl lg:text-5xl">
              MTQΣ — <span className="mtqs-gold-text">The Global Purchasing Power Unit</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-amber-50/80 sm:text-base">
              &ldquo;The GFB Index defines what one MTQΣ is intended to represent. The reserve
              portfolio exists to collateralize that obligation.&rdquo;
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3 max-w-xl">
              <HeroStat
                label="GFB Index"
                value={snapshot ? fmtFixed(snapshot.gfbIndex, 4) : "—"}
                sub="normalised = 1.00 @ 2026-01-01"
              />
              <HeroStat
                label="MTQ Price (USD)"
                value={snapshot ? "$" + fmtFixed(snapshot.mtqPrice, 4) : "—"}
                sub={snapshot?.priceInBand ? "in safety band 0.50–2.00" : "CIRCUIT BREAKER"}
                danger={!snapshot?.priceInBand}
              />
              <HeroStat
                label="Reserve Ratio"
                value={snapshot ? fmtRatio(snapshot.reserveRatio) : "—"}
                sub="target ≥ 110%"
                valueClass={snapshot ? rrColor(snapshot.reserveRatio) : ""}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({
  label,
  value,
  sub,
  danger,
  valueClass,
}: {
  label: string;
  value: string;
  sub: string;
  danger?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0b0f0e]/70 px-3 py-2.5 backdrop-blur-sm">
      <div className="text-[10px] uppercase tracking-[0.14em] text-amber-200/80">{label}</div>
      <div
        className={`mt-0.5 font-mono text-lg font-semibold tabular-nums sm:text-xl ${
          danger ? "text-rose-300" : valueClass ?? "text-amber-200"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-amber-50/60">{sub}</div>
    </div>
  );
}
