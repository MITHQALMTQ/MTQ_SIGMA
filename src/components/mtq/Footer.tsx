// MTQΣ — Footer (sticky, mt-auto)
// Brand lockup: emblem + wordmark + tagline + Sharia line + brand principles
// row + 3 testnet explorer links + deployer wallet.

"use client";

import Image from "next/image";
import { ALL_CHAINS, DEPLOYER_WALLET } from "@/lib/mtq/contracts";
import { BRAND_VOICE, BRAND_ASSETS } from "@/lib/mtq/brand";
import { BrandPrinciples } from "./primitives";
import { shortAddr } from "./format";

export function Footer() {
  return (
    <footer
      className="mt-auto border-t border-white/[0.06] bg-transparent/95 backdrop-blur"
      role="contentinfo"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-mtqs-gold/30 to-transparent" />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Brand lockup */}
          <div className="flex items-start gap-3">
            <div className="relative h-10 w-10 shrink-0 mtqs-glow rounded-md overflow-hidden">
              <Image
                src={BRAND_ASSETS.emblem}
                alt="MTQΣ emblem — the Σ-ingot mark ringed by five currency dots"
                fill
                sizes="40px"
                className="object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="mtqs-display mtqs-gold-text text-base font-semibold leading-none">
                MTQΣ
              </div>
              <div className="mt-1 text-[0.7rem] text-white/55 leading-relaxed">
                {BRAND_VOICE.tagline} · Σ-v1.2 · Closed-Loop Monetary Architecture
              </div>
              <BrandPrinciples className="mt-2" />
            </div>
          </div>

          {/* Honest disclaimers */}
          <div className="text-[0.7rem] text-white/55 leading-relaxed space-y-1.5">
            <div className="text-mtqs-emerald/85">{BRAND_VOICE.designConstraint}</div>
            <div>{BRAND_VOICE.statusDeclaration}.</div>
            <div className="text-white/55">
              Deployer wallet:{" "}
              <span className="font-mono text-mtqs-gold/85">
                {shortAddr(DEPLOYER_WALLET, 8, 6)}
              </span>
            </div>
          </div>

          {/* Testnet links */}
          <div className="flex flex-col gap-1.5">
            <div className="text-[0.65rem] uppercase tracking-[0.22em] text-white/55">
              Testnet explorers
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_CHAINS.map((c) => (
                <a
                  key={c.id}
                  href={c.explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] px-2.5 py-1 text-[0.7rem] text-mtqs-gold hover:border-mtqs-gold/40 hover:bg-mtqs-gold/5 transition"
                >
                  {c.label} ↗
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-2 text-[0.65rem] text-white/55/60">
          <div>© MTQΣ Protocol · Global Purchasing Power Unit · Candidate for public testing</div>
          <div className="font-mono">Built on Next.js 16 · Real-time engine in-process · 4s poll</div>
        </div>
      </div>
    </footer>
  );
}
