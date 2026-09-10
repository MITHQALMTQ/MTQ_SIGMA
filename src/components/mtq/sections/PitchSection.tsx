// MTQΣ — Pitch Section
// 6 panels: Problem · Solution · Market · Business Model · Traction · The Ask.
// Props: { onNavigate }.

"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Sparkles,
  Globe2,
  Briefcase,
  Activity,
  HandCoins,
  ArrowRight,
} from "lucide-react";
import { Panel, Reveal, Pill, GlowDot, SectionHeading } from "@/components/mtq/primitives";
import { BRAND_VOICE } from "@/lib/mtq/brand";
import { CANONICAL_MTQ_ADDRESSES } from "@/lib/mtq/contracts";
import type { SectionId } from "@/components/mtq/Navigation";

const PANELS = [
  {
    icon: AlertTriangle,
    eyebrow: "01 · Problem",
    title: "Stablecoins drift. Gold is illiquid. CBDCs are sovereign.",
    body: [
      "Existing stablecoins peg to a single fiat currency, exposing holders to that currency's inflation and political risk. Algorithmic stables have repeatedly depegged and collapsed.",
      "Tokenized gold is liquid only within its issuer's rails. CBDCs are sovereign instruments, programmable by the issuing state — not a neutral unit of global purchasing power.",
      "There is no on-chain unit that is collateralized, multi-currency, oracle-priced, and governed by a transparent constitution.",
    ],
    tone: "rose" as const,
  },
  {
    icon: Sparkles,
    eyebrow: "02 · Solution",
    title: "MTQΣ — a collateralized Global Purchasing Power Unit.",
    body: [
      "The Adaptive Reference Basket is a chain-linked reference of seven components (USD 27% · EUR 20% · JPY 9% · GBP 8% · CNY 5% · CHF 5% · Gold 26%). One MTQΣ is intended to represent that basket's purchasing power.",
      "An audited reserve portfolio (stablecoins + tokenized gold) collateralizes every MTQΣ at a 110% Reserve Ratio target. Mint and redeem flows arbitrage back to the reference value.",
      "A 6-state risk machine, a 4-tier governance hierarchy, staged geopolitical eject, and a dynamic buffer protect the reference value under stress. Every parameter is published and timelocked.",
    ],
    tone: "emerald" as const,
  },
  {
    icon: Globe2,
    eyebrow: "03 · Market",
    title: "A neutral unit for global settlement, savings, and reserves.",
    body: [
      "Stablecoin supply crossed $200B in 2025; institutional demand for a collateralized, multi-currency unit is unmet. Tokenized gold sits at ~$1.2B — fragmented and single-issuer.",
      "Cross-border payments, treasury reserves for DAOs, and Sharia-compliant savings each need a unit that is asset-backed, interest-free, and non-speculative.",
      "MTQΣ is designed for Sharia review (interest-free, asset-backed, non-speculative), opening a market segment largely unaddressed by existing stablecoins.",
    ],
    tone: "gold" as const,
  },
  {
    icon: Briefcase,
    eyebrow: "04 · Business Model",
    title: "Mint + redeem fees + protocol-owned reserve yield.",
    body: [
      "Mint fee 0.10% (§3.4). Redeem fee 0.15% (§3.4). Fees accrue to the protocol treasury.",
      "The reserve portfolio holds yield-bearing stablecoins + tokenized gold. Net yield (post-haircut) accrues to the protocol, not to MTQΣ holders (MTQΣ is non-yield-bearing by design).",
      "Treasury sweep (§13.2) moves surplus hot-wallet balance to a 4/7 Multi-Sig cold treasury above a $10K threshold, separating operational flow from long-term reserves.",
    ],
    tone: "gold" as const,
  },
  {
    icon: Activity,
    eyebrow: "05 · Traction",
    title: "Live on 4 testnets · 10,300 Monte Carlo runs · audit trail in SQLite.",
    body: [
      `Canonical MTQΣ deployed across ${Object.keys(CANONICAL_MTQ_ADDRESSES).length} testnets (Monad, Arc, Robinhood, Solana). Every chain has verified bytecode + role assignments.`,
      "10,300 Monte Carlo survival runs across 8 stress suites (Baseline, Monte Carlo, Depression, Hyperinflation, Depeg Cascade, Oracle Failure, Liquidity Crisis, Black Swan). Audit verdict: PASS.",
      "Live pilot: every mint/redeem is logged to SQLite with full input/output, Reference Index, Reference Value, NAV (USD reporting), RR, LCR, and pass/fail reason — full audit trail via /api/trials/export.",
    ],
    tone: "emerald" as const,
  },
  {
    icon: HandCoins,
    eyebrow: "06 · The Ask",
    title: "Independent Sharia review + institutional pilot partners.",
    body: [
      "We are seeking (1) an independent Sharia review board to certify the design as interest-free, asset-backed, and non-speculative — closing the F4 informational finding honestly.",
      "(2) Institutional pilot partners to deploy reserve collateral under the §5 registry criteria (issuer authorization, redemption right, custody, sanctions, audit, liquidity, oracle, concentration).",
      "(3) Security auditors for the on-chain contracts (currently live on testnet — see the Security section). The protocol is candidate for public testing, not production-authorized.",
    ],
    tone: "amber" as const,
  },
];

const TONE_DOT: Record<string, "emerald" | "gold" | "rose" | "amber"> = {
  emerald: "emerald",
  gold: "gold",
  rose: "rose",
  amber: "amber",
};

export function PitchSection({ onNavigate: _onNavigate }: { onNavigate: (id: SectionId) => void }) {
  return (
    <div className="space-y-12">
      <SectionHeading
        eyebrow="the ask · 6 panels"
        title="Pitch Deck — Closed-Loop Monetary Architecture"
        right={
          <Pill tone="gold">
            <GlowDot color="gold" size="h-1.5 w-1.5" />
            v1.2 · FINAL
          </Pill>
        }
      />

      {/* Intro */}
      <Reveal>
        <Panel className="p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-mtqs-gold/80 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[0.82rem] text-white/55 leading-relaxed">
              {BRAND_VOICE.coreObjective} {BRAND_VOICE.designConstraint}. {BRAND_VOICE.statusDeclaration}.
              The six panels below are the full investor pitch — Problem, Solution, Market, Business
              Model, Traction, and The Ask — written in the brand voice: honest, sovereign,
              collateralized, calm.
            </p>
          </div>
        </Panel>
      </Reveal>

      {/* 6 panels in a 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {PANELS.map((p, i) => {
          const Icon = p.icon;
          const dotColor = TONE_DOT[p.tone];
          return (
            <Reveal key={p.eyebrow} delay={(i % 2) * 0.05}>
              <Panel className="p-5 sm:p-6 h-full flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`inline-flex items-center justify-center rounded-md border p-2 ${
                      p.tone === "rose"
                        ? "border-mtqs-rose/25 bg-mtqs-rose/10"
                        : p.tone === "emerald"
                        ? "border-mtqs-emerald/25 bg-mtqs-emerald/10"
                        : p.tone === "amber"
                        ? "border-mtqs-amber/25 bg-mtqs-amber/10"
                        : "border-mtqs-gold/25 bg-mtqs-gold/10"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        p.tone === "rose"
                          ? "text-mtqs-rose"
                          : p.tone === "emerald"
                          ? "text-mtqs-emerald"
                          : p.tone === "amber"
                          ? "text-mtqs-amber"
                          : "text-mtqs-gold-light"
                      }`}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">
                    {p.eyebrow}
                  </span>
                  <div className="ml-auto">
                    <GlowDot color={dotColor} size="h-2 w-2" />
                  </div>
                </div>
                <h3 className="mtqs-display text-xl sm:text-2xl font-semibold text-white leading-tight">
                  {p.title}
                </h3>
                <ul className="space-y-2 mt-1">
                  {p.body.map((line, j) => (
                    <motion.li
                      key={j}
                      initial={{ opacity: 0, x: -6 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: j * 0.04 }}
                      className="flex gap-2 text-[0.78rem] text-white/55 leading-relaxed"
                    >
                      <span className="text-mtqs-gold/70 shrink-0 mt-0.5">·</span>
                      <span>{line}</span>
                    </motion.li>
                  ))}
                </ul>
              </Panel>
            </Reveal>
          );
        })}
      </div>

      {/* Closing CTA */}
      <Reveal>
        <Panel variant="emerald" className="p-6 sm:p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <HandCoins className="h-5 w-5 text-mtqs-emerald" aria-hidden="true" />
            <h3 className="mtqs-display text-2xl font-semibold text-white">
              Read the full blueprint · verify on-chain
            </h3>
          </div>
          <p className="text-[0.82rem] text-white/55 leading-relaxed max-w-2xl mx-auto mb-5">
            The pitch above is a summary. The blueprint reference, live on-chain verification, and
            the 10,300-run Monte Carlo audit are all available on this site — start with the
            Investor Verification section.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => _onNavigate("investors")}
              className="inline-flex items-center gap-1.5 rounded-full border border-mtqs-gold/40 bg-mtqs-gold/10 px-5 py-2.5 text-sm font-medium text-mtqs-gold-light hover:bg-mtqs-gold/20 hover:border-mtqs-gold/60 transition"
            >
              Investor Verification
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => _onNavigate("docs")}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.03]/[0.04] px-5 py-2.5 text-sm font-medium text-white hover:border-mtqs-gold/30 hover:text-white transition"
            >
              Blueprint Docs
            </button>
            <button
              onClick={() => _onNavigate("tests")}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.03]/[0.04] px-5 py-2.5 text-sm font-medium text-white hover:border-mtqs-gold/30 hover:text-white transition"
            >
              Test Audit
            </button>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
