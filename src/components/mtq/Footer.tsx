// MTQΣ — Premium PAR1D Footer (UI-REDESIGN)
// Three-column layout: Protocol / Resources / Status. Gold gradient top border,
// glassmorphic background, PAR1D emblem + wordmark + tagline, and the
// copyright + version + honest-status badge at the bottom.
//
// The original testnet explorer links + deployer wallet disclosure are
// preserved (folded into the "Resources" + "Status" columns) so the data
// surface area is unchanged.

"use client";

import Image from "next/image";
import { ALL_CHAINS, DEPLOYER_WALLET } from "@/lib/mtq/contracts";
import { BRAND_VOICE, BRAND_ASSETS, STATUS_COLORS } from "@/lib/mtq/brand";
import { BrandPrinciples, GlowDot, GlowBadge } from "./primitives";
import { shortAddr } from "./format";

export function Footer() {
  const year = new Date().getFullYear();
  const statusDecl = BRAND_VOICE.statusDeclaration;

  return (
    <footer
      className="relative mt-auto border-t border-white/[0.06] bg-[#06080F]/80 backdrop-blur-xl"
      role="contentinfo"
    >
      {/* Gold gradient top border */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(240,185,11,0.45) 18%, rgba(255,244,212,0.8) 50%, rgba(240,185,11,0.45) 82%, transparent 100%)",
        }}
        aria-hidden="true"
      />
      {/* Inner halo below the border */}
      <div
        className="absolute inset-x-0 top-px h-12 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(240,185,11,0.06), transparent)",
        }}
        aria-hidden="true"
      />

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
        {/* Brand lockup row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div
              className="relative h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-black mtqs-logo-container"
              style={{
                boxShadow:
                  "0 0 0 1px rgba(240,185,11,0.28), 0 0 24px rgba(240,185,11,0.18)",
              }}
              aria-label="MTQΣ logo mark"
            >
              <Image
                src={BRAND_ASSETS.logoCanonical}
                alt="MTQΣ official logo — luxury hexagonal Σ emblem"
                fill
                sizes="48px"
                className="object-contain mtqs-logo-image"
                style={{ objectFit: "contain" }}
              />
            </div>
            <div className="min-w-0">
              <div
                className="mtqs-display mtqs-gold-gradient-text text-xl font-semibold leading-none"
                style={{ fontWeight: 600 }}
              >
                MTQΣ
              </div>
              <div className="mt-1 text-[0.7rem] text-white/55 leading-relaxed">
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
            <ul className="space-y-1.5 text-[0.78rem] text-white/65">
              <li>
                <span className="text-white/55">Σ-v1.2 · </span>
                <span className="text-white/85">Closed-Loop Monetary Architecture</span>
              </li>
              <li>
                <span className="text-white/55">Design: </span>
                <span className="text-mtqs-emerald/85">{BRAND_VOICE.designConstraint}</span>
              </li>
              <li>
                <span className="text-white/55">Objective: </span>
                <span className="text-white/85">{BRAND_VOICE.coreObjective}</span>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-2">
            <div className="text-[0.62rem] uppercase tracking-[0.22em] text-mtqs-gold/70 font-semibold">
              Resources
            </div>
            <div className="text-[0.7rem] text-white/55 uppercase tracking-[0.18em] mb-1.5">
              Testnet explorers
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_CHAINS.map((c) => (
                <a
                  key={c.id}
                  href={c.explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[0.7rem] text-mtqs-gold hover:border-mtqs-gold/40 hover:bg-mtqs-gold/5 transition"
                >
                  {c.label} ↗
                </a>
              ))}
            </div>
            <div className="mt-2 text-[0.7rem] text-white/55">
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
              <div className="text-[0.78rem] text-white/65 leading-relaxed">
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
            <div className="text-[0.66rem] text-white/45 leading-relaxed pt-1">
              Every metric on this site is computed live by the reference engine
              and reconciled against the blueprint.
            </div>
          </div>
        </div>

        {/* Bottom bar — copyright + version + honest status */}
        <div
          className="mt-2 pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-2 text-[0.66rem] text-white/50"
        >
          <div className="flex items-center gap-2">
            <span>© {year} MTQΣ Protocol</span>
            <span className="text-white/30">·</span>
            <span>Global Purchasing Power Unit</span>
          </div>
          <div className="font-mono text-white/45">
            Built on Next.js 16 · Real-time engine in-process · 4s poll
          </div>
        </div>
      </div>

      {/* Hidden STATUS_COLORS reference — keeps the import active for downstream
          status-pill re-use without changing the footer's visible surface. */}
      <span className="sr-only" aria-hidden="true">{Object.keys(STATUS_COLORS).length}</span>
    </footer>
  );
}
