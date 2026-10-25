// MTQΣ — Premium PAR1D Footer (UI-REDESIGN)
// Three-column layout: Protocol / Resources / Status. Gold gradient top border,
// glassmorphic background, PAR1D emblem + wordmark + tagline, and the
// copyright + version + honest-status badge at the bottom.
//
// The original testnet explorer links + deployer wallet disclosure are
// preserved (folded into the "Resources" + "Status" columns) so the data
// surface area is unchanged.

"use client";

import { ALL_CHAINS, DEPLOYER_WALLET } from "@/lib/mtq/contracts";
import { BRAND_VOICE } from "@/lib/mtq/brand";
import { BrandMark } from "@/components/landing/BrandMark";
import { BrandPrinciples, GlowDot, GlowBadge } from "./primitives";
import { shortAddr } from "./format";

export function Footer() {
  const year = new Date().getFullYear();
  const statusDecl = BRAND_VOICE.statusDeclaration;

  return (
    <footer
      className="relative mt-auto border-t border-[#E3EAE6] bg-white"
      role="contentinfo"
    >

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
        {/* Brand lockup row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-6 border-b border-[#E3EAE6]">
          <div className="flex items-center gap-3">
            <span className="shrink-0" role="img" aria-label="MTQΣ logo mark">
              <BrandMark size={44} />
            </span>
            <div className="min-w-0">
              <div
                className="mtqs-display mtqs-gold-gradient-text text-xl font-semibold leading-none"
                style={{ fontWeight: 600 }}
              >
                MTQΣ
              </div>
              <div className="mt-1 text-[0.7rem] text-[#5B6E68] leading-relaxed">
                {BRAND_VOICE.tagline}
              </div>
            </div>
          </div>
          <div className="sm:ml-auto">
            <BrandPrinciples />
          </div>
        </div>

        {/* Three columns: Protocol / Resources / Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
          {/* Protocol */}
          <div className="space-y-2">
            <div className="text-[0.62rem] uppercase tracking-[0.22em] text-mtqs-gold/70 font-semibold">
              Protocol
            </div>
            <ul className="space-y-1.5 text-[0.78rem] text-[#33544C]">
              <li>
                <span className="text-[#5B6E68]">Σ-v1.2 · </span>
                <span className="text-[#0E1F1B]">Closed-Loop Monetary Architecture</span>
              </li>
              <li>
                <span className="text-[#5B6E68]">Design: </span>
                <span className="text-mtqs-emerald/85">{BRAND_VOICE.designConstraint}</span>
              </li>
              <li>
                <span className="text-[#5B6E68]">Objective: </span>
                <span className="text-[#0E1F1B]">{BRAND_VOICE.coreObjective}</span>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-2">
            <div className="text-[0.62rem] uppercase tracking-[0.22em] text-mtqs-gold/70 font-semibold">
              Resources
            </div>
            <div className="text-[0.7rem] text-[#5B6E68] uppercase tracking-[0.18em] mb-1.5">
              Network explorers
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_CHAINS.map((c) => (
                <a
                  key={c.id}
                  href={c.explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#DCE5E0] bg-white px-2.5 py-1 text-[0.7rem] text-mtqs-gold hover:border-[#0D9488] hover:bg-[#E7F4F1] transition"
                >
                  {c.label} ↗
                </a>
              ))}
            </div>
            <div className="mt-2 text-[0.62rem] text-[#7A8C86]">
              3 testnets live (Monad · Arc · Solana devnet) — TESTNET-ONLY pilot; mainnet
              deployment not authorized. (Robinhood Chain + Base/Arbitrum placeholders removed
              from the registry 2026-10-24 per the owner's directive.)
            </div>
            <div className="mt-2 text-[0.7rem] text-[#5B6E68]">
              Deployer wallet:{" "}
              <span className="font-mono text-mtqs-gold/85">
                {shortAddr(DEPLOYER_WALLET, 8, 6)}
              </span>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <div className="text-[0.62rem] uppercase tracking-[0.22em] text-mtqs-gold/70 font-semibold">
              Status
            </div>
            <div className="flex items-start gap-2">
              <GlowDot color="amber" size="h-2 w-2 mt-1" />
              <div className="text-[0.78rem] text-[#33544C] leading-relaxed">
                {statusDecl}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <GlowBadge variant="gold">
                <GlowDot color="gold" size="h-1.5 w-1.5" />
                Σ-v1.2
              </GlowBadge>
              <GlowBadge variant="emerald">
                <GlowDot color="emerald" size="h-1.5 w-1.5" />
                candidate · testnet
              </GlowBadge>
            </div>
            <div className="text-[0.66rem] text-[#7A8C86] leading-relaxed pt-1">
              Core metrics are computed live by the reference engine and reconciled against
              the blueprint; illustrative and synthetic panels are labeled as such.
            </div>
          </div>
        </div>

        {/* Bottom bar — copyright + version + honest status */}
        <div
          className="mt-2 pt-4 border-t border-[#E3EAE6] flex flex-col sm:flex-row items-center justify-between gap-2 text-[0.66rem] text-[#5B6E68]"
        >
          <div className="flex items-center gap-2">
            <span>© {year} MTQΣ Protocol</span>
            <span className="text-[#9AA9A3]">·</span>
            <span>Global Digital Asset</span>
          </div>
          <div className="font-mono text-[#7A8C86]">
            Built on Next.js 16 · Real-time engine in-process · 4s poll
          </div>
        </div>
      </div>

    </footer>
  );
}
