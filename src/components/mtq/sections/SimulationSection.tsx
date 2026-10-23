// MTQΣ — Simulation Lab Section (labs)
// Dedicated page for the "simulation" nav tab. Composes:
//   1. The Constituency Succession Lab (§3.3 / §21.5 / §9.2) — decay →
//      depeg detection → staged liquidation ladder → ejection → governed
//      successor admission, run against the LIVE index + LIVE per-MTQ
//      holdings on a server-side state-clone.
//   2. The staged eject ladder + reintegration score panel (§21.5.3/§21.5.4).
//   3. A pointer to the full §23 stress matrix (S1–S11) on the Validation tab.
//   4. An honest "what these simulations prove — and what they do NOT" panel
//      (pure functions · state-clone · zero pilot mutation; NOT the Ch 23
//      production research program; §25.5 gates not passed; §23.1 negative
//      rule: prior-architecture figures are NOT evidence for MTQΣ).
//
// Honest-status tone: TESTNET ONLY · SHADOW MODE ENFORCED · RESERVE TRADING
// NOT AUTHORIZED — simulated pilot engine, no on-chain broadcast, no real
// value, no pilot-state mutation.
//
// Props: { onNavigate, snapshot }.

"use client";

import {
  Microscope,
  ShieldAlert,
  FlaskConical,
  Scale,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Panel,
  Reveal,
  Pill,
  GlowDot,
  SectionHeading,
} from "@/components/mtq/primitives";
import { TruthBanner } from "@/components/mtq/TruthBanner";
import { Block } from "@/components/mtq/status-tone";
import { SuccessionLab } from "@/components/mtq/SuccessionLab";
import { EjectReintegration } from "@/components/mtq/EjectReintegration";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import type { SectionId } from "@/components/mtq/Navigation";

/* ---------- Block wrapper lives in the shared status-tone module. ---------- */

/* ---------- Honest scope of the labs ---------- */
const LABS_PROVE = [
  "Pure functions on a state-clone: every lab operates on a server-side clone of the pilot engine state — the live pilot state is never mutated by a lab run.",
  "Live inputs, not synthetic: the succession lab runs against the live chain-linked index and the live per-MTQ reserve holdings, with zero artificial index return.",
  "Deterministic mechanics: the staged liquidation ladder (10% → 25% → 50% → 100%), the 5% pause rule, and the reintegration score are pure functions of declared inputs — same inputs, same outputs, every run.",
  "Gold cannot be ejected: it is the constitutional anchor (invariants I3/I12) — the labs enforce the same boundary the production module would.",
  "Fail-closed is observable: guards, thresholds and stage pauses surface as explicit reverts or holds, never as silent continuations.",
];

const LABS_DO_NOT = [
  "These labs are NOT the production research program of Chapter 23. That program — the §23.2 backtest (2010 → present), §23.3 walk-forward validation, §23.4 leakage control, §23.5 Monte Carlo, §23.6 parameter perturbation and the §23.8–23.11 adversarial suites — is a production precondition, executed on versioned, published data and independently reproduced.",
  "The §25.5 validation gates are NOT passed: none of the eleven gates (smart-contract audit, independent model validation, sharia certification, legal opinion, public testnet with 100+ simulated users, penetration testing, institutional review, liquidity bootstrapping, …) has been passed — mainnet deployment is not authorized.",
  "§23.1 negative rule — prior-architecture figures are NOT evidence for MTQΣ: the old engine's statistics (~5.21% annualized volatility, −4.1% maximum drawdown) were produced by a fixed-quantity basket with a fixed gold percentage and a single-AMM gold price — none of v2.0's live machinery. Until the §23.12 gates pass, any performance figure for MTQΣ must be labelled a prior or an illustrative projection, never a measured property of the system.",
  "Every number these labs display describes the simulated pilot engine only. No figure here is a measured property of a live monetary system.",
];

export function SimulationSection({
  onNavigate,
  snapshot,
}: {
  onNavigate: (id: SectionId) => void;
  snapshot: MetricsSnapshot | null;
}) {
  return (
    <div className="space-y-10">
      {/* Page heading + scope pill */}
      <SectionHeading
        eyebrow="labs · simulation"
        title="Simulation Lab"
        className="mb-0"
        right={
          <Pill tone="emerald">
            <GlowDot color="emerald" size="h-1.5 w-1.5" />
            pure functions · state-clone · zero pilot mutation
          </Pill>
        }
      />

      {/* Amber truth banner (shared component) */}
      <Reveal>
        <TruthBanner>
          <p className="text-[0.75rem] text-amber-100/90 leading-relaxed">
            Every lab on this page runs the <strong className="text-amber-100">simulated pilot
            engine</strong> on a state-clone — no on-chain broadcast, no real value, no mutation of
            pilot state. The labs exercise real blueprint mechanics (§3.3, §9.2, §21.5) against live
            pilot data; they are not the Chapter 23 validation program and they pass no §25.5 gate.
          </p>
        </TruthBanner>
      </Reveal>

      {/* Constituency succession lab */}
      <Block
        id="sim-succession"
        icon={Microscope}
        title="Constituency succession — §3.3 / §21.5 / §9.2"
        sub="Interactive drill: what happens when a currency loses its power? decay → depeg detection → staged liquidation ladder → ejection → governed successor admission — run against the live chain-linked index and the live per-MTQ reserve holdings, with zero artificial index return. Gold cannot be ejected (constitutional anchor, I3/I12)."
      >
        <Reveal>
          <Panel className="p-4 sm:p-5">
            <SuccessionLab />
          </Panel>
        </Reveal>
      </Block>

      {/* Staged eject ladder + reintegration score — the machinery is rendered
          once here via the live-wired EjectReintegration component (ladder
          summary + per-currency rows + the §11.3/§21.5.4 formula and weights,
          sourced from REINTEGRATION_WEIGHTS / EJECT_STAGES constants). The
          former duplicated inline formula copy was removed (Task 14-b C3). */}
      <Block
        id="sim-eject"
        icon={ShieldAlert}
        title="Staged eject ladder + reintegration score — §21.5.3/§21.5.4"
        sub="Per-currency peg health, depeg hours and the four-stage liquidation ladder (10% → 25% → 50% → 100%, cumulative, constitutional shape), with the anti-gaming reintegration score that governs the way back in — re-entry begins only at R_score ≥ 0.80, staged 25% → 50% → 100%."
      >
        <Reveal>
          <Panel className="p-4 sm:p-5 space-y-4">
            <EjectReintegration snapshot={snapshot} />
          </Panel>
        </Reveal>
      </Block>

      {/* §23 — Monte Carlo & stress suites pointer */}
      <Block
        id="sim-stress"
        icon={FlaskConical}
        title="Monte Carlo &amp; stress suites — §23"
        sub="The heavier machinery lives on the Validation tab."
      >
        <Reveal>
          <Panel className="p-4 sm:p-5">
            <p className="text-[0.75rem] text-white/55 leading-relaxed">
              The full §23 stress matrix — scenarios <span className="font-mono text-mtqs-gold-light">S1–S11</span>:
              Monte Carlo runs (S1–S4, 2,000 paths per scenario), reserve stress episodes (S5–S10) and
              the parameter perturbation study (S11), all measured through the reserve stress equation —
              runs on the <strong className="text-white/85">Validation</strong> tab, backed by the
              audit-stress engine and its dedicated API. This lab page keeps the two §21.5 drills; the
              research-grade suites belong with the validation evidence they feed.
            </p>
            <button
              type="button"
              onClick={() => onNavigate("validation")}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[0.75rem] font-medium text-white/80 hover:bg-white/5 hover:text-white transition"
            >
              Open Validation &amp; Research
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </Panel>
        </Reveal>
      </Block>

      {/* What these simulations prove — and what they do NOT */}
      <Block
        id="sim-honesty"
        icon={Scale}
        title="What these simulations prove — and what they do NOT"
        sub="The honest boundary of this lab page, per §23.1 and §25.5."
      >
        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* PROVE */}
            <Panel className="p-4 sm:p-5 h-full">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-mtqs-emerald" aria-hidden="true" />
                <span className="text-[0.82rem] font-semibold text-white/90">What they prove</span>
                <Pill tone="emerald" className="ml-auto">about the labs</Pill>
              </div>
              <ul className="space-y-2.5 max-h-96 overflow-y-auto mtqs-scroll pr-1">
                {LABS_PROVE.map((item) => (
                  <li key={item} className="flex gap-2 text-[0.72rem] text-white/60 leading-relaxed">
                    <CheckCircle2 className="h-3.5 w-3.5 text-mtqs-emerald/70 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            {/* DO NOT */}
            <Panel className="p-4 sm:p-5 h-full">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="h-4 w-4 text-mtqs-rose" aria-hidden="true" />
                <span className="text-[0.82rem] font-semibold text-white/90">What they do NOT</span>
                <Pill tone="rose" className="ml-auto">scope limits</Pill>
              </div>
              <ul className="space-y-2.5 max-h-96 overflow-y-auto mtqs-scroll pr-1">
                {LABS_DO_NOT.map((item) => (
                  <li key={item} className="flex gap-2 text-[0.72rem] text-white/60 leading-relaxed">
                    <XCircle className="h-3.5 w-3.5 text-mtqs-rose/70 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 rounded-md border border-mtqs-amber/25 bg-mtqs-amber/[0.04] px-3 py-2.5">
                <code className="font-mono text-[0.7rem] text-mtqs-amber">
                  {"Perf(old architecture) not⇒ Perf(MTQΣ)   — §23.1"}
                </code>
                <p className="mt-1.5 text-[0.65rem] text-amber-100/75 leading-relaxed">
                  The negative rule that opens the validation methodology: historical figures produced
                  under the prior architecture must not be presented as evidence for MTQΣ — and neither
                  may anything this lab page displays.
                </p>
              </div>
            </Panel>
          </div>
        </Reveal>
      </Block>
    </div>
  );
}
