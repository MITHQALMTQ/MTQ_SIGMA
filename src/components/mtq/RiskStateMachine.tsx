// MTQΣ — Risk State Machine (§14.1) + Governance Hierarchy (§14.2)
// 6-state horizontal track with current state enlarged + §14.1 policy row.
// Governance 4-card hierarchy uses GOVERNANCE_TIERS from brand.ts (constitutional
// = gold, monetary = emerald, risk = amber, emergency = rose) with the matching
// glow box-shadow, plus the bespoke governance-crests.png asset above the cards.

"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Panel, Reveal, Pill, GlowDot } from "./primitives";
import { fmtRatio } from "./format";
import { RISK_STATE_MACHINE, GOVERNANCE_HIERARCHY, type ProtocolStatus } from "@/lib/mtq/blueprint";
import { GOVERNANCE_TIERS, STATUS_COLORS, BRAND_ASSETS } from "@/lib/mtq/brand";
import { Shield, Hourglass, Users, Zap, type LucideIcon } from "lucide-react";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

const STATUS_TONES: Record<ProtocolStatus, "emerald" | "amber" | "rose"> = {
  NORMAL: "emerald",
  CAUTION: "amber",
  STRESS: "amber",
  DEFENSIVE: "amber",
  EMERGENCY: "rose",
  RECOVERY: "emerald",
};

// Use the brand STATUS_COLORS for the state machine dots + active glow.
const STATUS_HEX: Record<ProtocolStatus, string> = {
  NORMAL: STATUS_COLORS.NORMAL.color,
  CAUTION: STATUS_COLORS.CAUTION.color,
  STRESS: STATUS_COLORS.STRESS.color,
  DEFENSIVE: STATUS_COLORS.DEFENSIVE.color,
  EMERGENCY: STATUS_COLORS.EMERGENCY.color,
  RECOVERY: STATUS_COLORS.RECOVERY.color,
};

// Map the GOVERNANCE_HIERARCHY entries to the brand GOVERNANCE_TIERS keys so
// each tier card carries the matching brand color + glow.
const TIER_KEY: ("constitutional" | "monetary" | "risk" | "emergency")[] = [
  "constitutional",
  "monetary",
  "risk",
  "emergency",
];

const TIER_ICON: LucideIcon[] = [Shield, Users, Hourglass, Zap];

export function RiskStateMachine({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const current = snapshot?.status ?? "NORMAL";

  return (
    <div className="space-y-4">
      <Reveal>
        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground/90">Risk State Machine (§14.1)</div>
              <div className="text-[0.7rem] text-muted-foreground">6-state protocol posture · current: {current}</div>
            </div>
            <Pill tone={STATUS_TONES[current]}>
              <GlowDot color={STATUS_TONES[current] === "emerald" ? "emerald" : STATUS_TONES[current] === "rose" ? "rose" : "amber"} size="h-1.5 w-1.5" />
              {current}
            </Pill>
          </div>

          {/* 6-state horizontal track */}
          <div className="relative">
            <div className="absolute left-0 right-0 top-7 h-px bg-gradient-to-r from-mtqs-emerald/30 via-mtqs-amber/40 to-mtqs-rose/40" />
            <div className="relative grid grid-cols-5 gap-1">
              {RISK_STATE_MACHINE.map((s, i) => {
                const active = s.status === current;
                const hex = STATUS_HEX[s.status];
                return (
                  <motion.div
                    key={s.status}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="flex flex-col items-center text-center"
                  >
                    <div
                      className={`relative z-10 inline-flex items-center justify-center rounded-full border-2 transition-all ${
                        active ? "h-14 w-14" : "h-9 w-9"
                      }`}
                      style={{
                        borderColor: hex,
                        background: active ? `${hex}22` : "rgba(8,10,12,0.9)",
                        boxShadow: active ? `0 0 24px ${hex}55` : "none",
                      }}
                    >
                      {active && (
                        <motion.span
                          className="absolute inset-0 rounded-full"
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                          style={{ background: `${hex}30` }}
                        />
                      )}
                      <span
                        className="relative font-mono font-bold text-xs"
                        style={{ color: hex }}
                      >
                        {s.status === "NORMAL" ? "N" : s.status === "CAUTION" ? "C" : s.status === "DEFENSIVE" ? "D" : s.status === "EMERGENCY" ? "E" : "R"}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 text-[0.62rem] font-medium tracking-wide"
                      style={{ color: active ? hex : "rgba(255,255,255,0.55)" }}
                    >
                      {s.status}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </Panel>
      </Reveal>

      {/* Policy table */}
      <Reveal>
        <Panel className="p-5">
          <div className="mb-2 text-[0.625rem] uppercase tracking-[0.25em] text-muted-foreground">
            §14.1 Policy Matrix
          </div>
          <div className="overflow-x-auto mtqs-scroll">
            <table className="w-full text-[0.72rem] min-w-[640px]">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium">Status</th>
                  <th className="text-left py-2 px-3 font-medium">Minting</th>
                  <th className="text-left py-2 px-3 font-medium">Redemption</th>
                  <th className="text-left py-2 px-3 font-medium">Rebalancing</th>
                  <th className="text-right py-2 pl-3 font-medium">RR Target</th>
                </tr>
              </thead>
              <tbody>
                {RISK_STATE_MACHINE.map((p) => {
                  const active = p.status === current;
                  const hex = STATUS_HEX[p.status];
                  return (
                    <tr
                      key={p.status}
                      className={`border-b border-border ${active ? "bg-mtqs-gold/5" : ""}`}
                    >
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <GlowDot color={STATUS_TONES[p.status] === "emerald" ? "emerald" : STATUS_TONES[p.status] === "rose" ? "rose" : "amber"} size="h-1.5 w-1.5" />
                          <span className="font-mono font-semibold" style={{ color: hex }}>{p.status}</span>
                          {active && <Pill tone="gold">current</Pill>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-foreground">{p.minting}</td>
                      <td className="py-2.5 px-3 text-foreground">{p.redemption}</td>
                      <td className="py-2.5 px-3 text-foreground">{p.rebalancing}</td>
                      <td className="py-2.5 pl-3 text-right font-mono text-mtqs-gold">{fmtRatio(p.rrTarget)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </Reveal>

      {/* Governance Hierarchy — brand crests image + 4 tier cards with brand glows */}
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground/90">Governance Hierarchy (§14.2)</div>
              <div className="text-[0.7rem] text-muted-foreground">4-tier authority structure · crest glyphs below</div>
            </div>
          </div>

          {/* Brand governance crests image */}
          <div className="mb-4 flex justify-center">
            <div className="relative h-20 sm:h-24 w-full max-w-[640px] mtqs-glow rounded-md overflow-hidden">
              <Image
                src={BRAND_ASSETS.governanceCrests}
                alt="MTQΣ governance tier crests — Constitutional, Monetary, Risk, Emergency"
                fill
                sizes="(max-width: 768px) 100vw, 640px"
                className="object-contain opacity-90"
              />
            </div>
          </div>

          {/* Tier cards — brand GOVERNANCE_TIERS colors + matching glow */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {GOVERNANCE_HIERARCHY.map((g, i) => {
              const tierKey = TIER_KEY[i];
              const tier = GOVERNANCE_TIERS[tierKey];
              const Icon = TIER_ICON[i];
              return (
                <motion.div
                  key={g.scope}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                  className="rounded-lg border p-3"
                  style={{
                    borderColor: `${tier.color}40`,
                    background: `${tier.color}0a`,
                    boxShadow: tier.glow,
                  }}
                >
                  <Icon
                    className="h-5 w-5 mb-2"
                    style={{ color: tier.color }}
                  />
                  <div className="text-xs font-semibold text-foreground">{g.scope}</div>
                  <div className="mt-1.5 text-[0.7rem] text-muted-foreground">authority</div>
                  <div className="font-mono text-[0.78rem]" style={{ color: tier.color }}>
                    {g.authority}
                  </div>
                  <div className="mt-1.5 text-[0.7rem] text-muted-foreground">timelock</div>
                  <div className="font-mono text-[0.78rem]" style={{ color: tier.color }}>
                    {g.timelock}
                  </div>
                  <div className="mt-2 text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
                    {tier.label}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
