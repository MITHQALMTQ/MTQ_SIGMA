// MTQΣ — Currency Constituency Engine Section (Blueprint v2.0 · Chapter 4)
//
// Layer 1 of the three-layer architecture: the engine that maintains the
// eligible currency universe and independently decides which currencies
// qualify for the active basket — an algorithmic property with hysteresis
// (§4.1), scored by the 8-component Q_i model (§4.2), fed by IMF COFER and
// the BIS Triennial Survey as INPUTS — never weights (§4.3), with governed
// transitions (§4.6), a two-threshold dead band (§4.7) and constitutional
// non-decisions (§4.4). Gold exposure is to the gold price reference unit,
// not to any token (§4.8).
//
// Live data: GET /api/succession (candidate universe + live basket weights).
// Everything else is faithful static blueprint reference content.
//
// Props: { onNavigate, snapshot } — shared section contract.

"use client";

import { useEffect, useState } from "react";
import {
  Panel,
  Reveal,
  Pill,
  GlowDot,
  SectionHeading,
  MiniBar,
  Skeleton,
} from "@/components/mtq/primitives";
import type { SectionId } from "@/components/mtq/Navigation";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import {
  Landmark,
  Database,
  Globe2,
  Shuffle,
  Scale,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";

/* ---------- /api/succession GET shape (sibling contract) ---------- */
interface SuccessionCandidateDto {
  code: string;
  name: string;
  seedWeight: number;
  envelope: { lower: number; upper: number };
  frankfurterKey: string;
  note: string;
}

interface SuccessionGetDto {
  universe: SuccessionCandidateDto[];
  quotes: { quotes: Record<string, number>; live: boolean; source: string };
  basket: string[];
  ejectedOptions: string[];
  live: {
    iLevel: number;
    weights: Record<string, number> | null;
    holdingsPerMtq: Record<string, number> | null;
    basis: string | null;
  };
}

/* ---------- /api/constituency GET shape (M8-3a machinery surfacing) ---------- */
interface MachineryGenesisEntryDto {
  registryId: number;
  id: string;
  code: string;
  name: string;
  componentType: string;
  maseLabel: string | null;
  lifecycleState: string;
  genesisWeightBp: number;
  envelope: { minPct: number; maxPct: number };
  velocityPerPeriodPct: number;
  baseFixingUsd: number;
  dossierRef: string;
}

interface MachineryTransitionDto {
  id: string;
  name: string;
  kind: "rule-driven" | "governance directive";
}

interface ConstituencyMachineryDto {
  banner: string;
  module: string;
  quiescent: {
    disclosure: string;
    activeBasketCount: number;
    transitionsEverRun: number;
    directivesEverApplied: number;
  };
  genesisRegistry: {
    dossierRef: string;
    genesisWeightSumBp: number;
    entries: MachineryGenesisEntryDto[];
    weightsBp: Record<string, number>;
  };
  lifecycleLegend: { state: string; role: string }[];
  transitions: MachineryTransitionDto[];
  honestLimits: {
    line: string;
    parameterClass: string;
    scoringFeedDisclosure: string;
    contractLayer: string;
  };
}

/* ---------- §4.2 The eight Q_i components (blueprint table, verbatim) ---------- */
const QI_COMPONENTS: {
  component: string;
  symbol: string;
  sign: "positive" | "negative";
  property: string;
}[] = [
  {
    component: "Reserve relevance",
    symbol: "R_i",
    sign: "positive",
    property:
      "Share and persistence of currency i in global official reserves (IMF COFER).",
  },
  {
    component: "Trade / payment relevance",
    symbol: "T_i",
    sign: "positive",
    property:
      "International trade invoicing, payment usage and cross-border settlement volume.",
  },
  {
    component: "Market liquidity",
    symbol: "L_i",
    sign: "positive",
    property:
      "FX turnover, market depth, bid-ask spread quality, settlement availability.",
  },
  {
    component: "Stability characteristics",
    symbol: "S_i",
    sign: "positive",
    property:
      "Multi-horizon volatility and purchasing-power stability (Section 5.1).",
  },
  {
    component: "Diversification contribution",
    symbol: "D_i",
    sign: "positive",
    property: "Marginal risk reduction contributed to the basket portfolio.",
  },
  {
    component: "Convertibility / depth",
    symbol: "C_i",
    sign: "positive",
    property:
      "Convertibility, market depth and transferability of the currency.",
  },
  {
    component: "Geopolitical concentration risk",
    symbol: "G_i",
    sign: "negative",
    property:
      "Concentration of issuing jurisdiction in sanctions, freeze or conflict exposure.",
  },
  {
    component: "Capital-control / transferability risk",
    symbol: "X_i",
    sign: "negative",
    property: "Risk of capital controls or transferability restrictions.",
  },
];

/* ---------- §4.3.2 BIS Triennial Survey 2025 turnover shares ---------- */
const BIS_2025_SHARES: { code: string; sharePct: number }[] = [
  { code: "USD", sharePct: 89.2 },
  { code: "EUR", sharePct: 28.9 },
  { code: "JPY", sharePct: 16.8 },
  { code: "GBP", sharePct: 10.2 },
  { code: "CNY", sharePct: 8.5 },
  { code: "CHF", sharePct: 6.4 },
];

/* ---------- §4.4 Cases A–D (blueprint table, verbatim) ---------- */
const NON_DECISION_CASES: { c: string; outcome: string; meaning: string }[] = [
  {
    c: "A",
    outcome: "Q_GBP > Q_CHF",
    meaning: "Sterling outranks the franc on the composite score.",
  },
  {
    c: "B",
    outcome: "Q_CHF > Q_GBP",
    meaning: "The franc outranks sterling on the composite score.",
  },
  {
    c: "C",
    outcome: "Both GBP and CHF exceed Q_min",
    meaning: "Both currencies earn inclusion.",
  },
  {
    c: "D",
    outcome: "A monitored candidate (CAD/AUD/SGD/…) exceeds Q_min",
    meaning: "A new currency qualifies for admission via the transition rules of Section 4.6.",
  },
];

/* ---------- Shared bordered table shell (DocsSection pattern) ---------- */
function BorderedTable({
  headers,
  rows,
}: {
  headers: React.ReactNode[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[#E3EAE6]">
      <div className="max-h-96 overflow-y-auto mtqs-scroll">
        <table className="w-full text-[0.74rem]">
          <thead className="bg-[#F7FAF8] text-[#5B6E68] sticky top-0">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="text-left px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className={`border-t border-[#E3EAE6] ${ri % 2 ? "bg-[#F7FAF8]" : ""}`}
              >
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2.5 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Formula line styling ---------- */
function Formula({ children }: { children: React.ReactNode }) {
  return (
    <code className="block font-mono text-[0.78rem] sm:text-[0.85rem] text-mtqs-gold-light bg-[#F7FAF8] border border-[#E3EAE6] rounded-md px-4 py-3 overflow-x-auto whitespace-nowrap">
      {children}
    </code>
  );
}

export function ConstituencySection({
  onNavigate: _onNavigate,
  snapshot,
}: {
  onNavigate: (id: SectionId) => void;
  snapshot: MetricsSnapshot | null;
}) {
  const [data, setData] = useState<SuccessionGetDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  // M8-3a machinery surfacing (Task M8-3c-b) — the QUIESCENT dynamic-membership
  // engine state from /api/constituency (read-only; no transition is ever run).
  const [machinery, setMachinery] = useState<ConstituencyMachineryDto | null>(null);
  const [machineryError, setMachineryError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/succession", { cache: "no-store" });
        if (!res.ok) {
          if (mounted) setError(`HTTP ${res.status}`);
          return;
        }
        const dto = (await res.json()) as SuccessionGetDto;
        if (mounted) {
          setData(dto);
          setError(null);
        }
      } catch (e) {
        if (mounted) setError(String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const basket = data?.basket ?? ["USD", "EUR", "JPY", "GBP", "CNY", "CHF", "Gold"];

  // M8-3a machinery fetch — separate lightweight GET (append-only addition, Task M8-3c-b).
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/constituency", { cache: "no-store" });
        if (!res.ok) {
          if (mounted) setMachineryError(`HTTP ${res.status}`);
          return;
        }
        const dto = (await res.json()) as ConstituencyMachineryDto;
        if (mounted) {
          setMachinery(dto);
          setMachineryError(null);
        }
      } catch (e) {
        if (mounted) setMachineryError(String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-10">
      {/* ============ §4 — header ============ */}
      <SectionHeading
        eyebrow="§4 · layer 1"
        title="Currency Constituency Engine"
        className="mb-0"
        right={
          <Pill tone="gold">
            <GlowDot color="gold" size="h-1.5 w-1.5" />
            adaptive membership · hysteresis-gated
          </Pill>
        }
      />

      {/* Purpose strip — §4.1 */}
      <Reveal>
        <Panel className="p-5">
          <div className="flex items-start gap-3">
            <Landmark className="h-5 w-5 text-mtqs-gold/80 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[0.82rem] text-[#5B6E68] leading-relaxed">
              The Constituency Engine is Layer 1 of the three-layer architecture (§2.2). MTQΣ
              maintains an eligible universe and <span className="text-[#0E1F1B]">independently decides</span> which
              currencies qualify for the active basket. Membership is an algorithmic property with
              hysteresis, so the system can admit a rising currency or retire a deteriorating one
              without discretionary intervention and without thrashing at the boundary. The engine
              is evaluated on the strategic review cadence (quarterly by default, §10.10) and on
              structural-change events. On this pilot, admission remains governed — the universe
              below is validation-stage; no membership change has ever been executed.
            </p>
          </div>
        </Panel>
      </Reveal>

      {/* ============ §4.2 — the eligibility score ============ */}
      <section id="constituency-score" aria-labelledby="constituency-score-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§4.2 · eligibility scoring"
          title="The Eligibility Score Q_i"
          className="mb-0"
          right={<Pill tone="gold">8 components · 6 positive · 2 negative</Pill>}
        />
        <div className="space-y-4">
          <Reveal>
            <Panel className="p-5">
              <p id="constituency-score-h" className="text-[0.78rem] text-[#5B6E68] mb-3">
                For every candidate currency i, the engine computes a composite eligibility score
                from six positive and two negative components. A currency becomes eligible for the
                active basket only if <span className="font-mono text-mtqs-gold-light">Q_i ≥ Q_min</span>.
              </p>
              <Formula>
                Q_i = a_R·R_i + a_T·T_i + a_L·L_i + a_S·S_i + a_D·D_i + a_C·C_i − a_G·G_i − a_X·X_i
              </Formula>
              <div className="mt-4">
                <BorderedTable
                  headers={["Component", "Symbol", "Sign", "Measured property"]}
                  rows={QI_COMPONENTS.map((c) => [
                    <span key="c" className="text-[#0E1F1B]">{c.component}</span>,
                    <span key="s" className="font-mono text-mtqs-gold">{c.symbol}</span>,
                    <span key="sign">
                      {c.sign === "positive" ? (
                        <Pill tone="emerald">+ positive</Pill>
                      ) : (
                        <Pill tone="rose">− negative</Pill>
                      )}
                    </span>,
                    <span key="p" className="text-[#5B6E68]">{c.property}</span>,
                  ])}
                />
              </div>
            </Panel>
          </Reveal>
          <Reveal delay={0.05}>
            <Panel className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Scale className="h-4 w-4 text-mtqs-gold/70" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0E1F1B]">Score normalization — §4.2.1</h3>
              </div>
              <p className="text-[0.78rem] text-[#5B6E68] mb-3">
                Raw components are measured in different units (reserve shares in percent, turnover
                in trillions, volatility in annualized decimal), so Q_i is normalized before
                threshold comparison — otherwise datasets with different units silently distort the
                score [COO-1]. Default: min–max across the candidate universe; a percentile or
                rank transformation is an approved bounded alternative for heavy-tailed
                distributions or small universes. Whichever transform is selected becomes part of
                the published methodology version (§24.1).
              </p>
              <Formula>Q̃_i = (Q_i − Q_min) / (Q_max − Q_min)</Formula>
              <p className="text-[0.7rem] text-[#7A8C86] mt-3">
                The coefficients a_k and the threshold Q_min are methodology parameters — fixed per
                published methodology version; any change requires Risk Council approval through
                the parameter-registry process (§22.3). The coefficients are themselves subject to
                methodology validation (§23.6), and the entire scoring table is published with each
                weight publication (§24.3) so eligibility decisions remain reproducible.
              </p>
            </Panel>
          </Reveal>
          {/* §4.5 — structural score construction (Task 8-int: was missing from the
              section; v2.0 L2381–2401 verbatim formulas + the a_k validation loop) */}
          <Reveal delay={0.1}>
            <Panel className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Scale className="h-4 w-4 text-mtqs-gold/70" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0E1F1B]">Structural score construction — §4.5</h3>
              </div>
              <p className="text-[0.78rem] text-[#5B6E68] mb-3">
                Every input is normalized before aggregation [MS §8]. The default transform is the
                z-score, where μ_k and σ_k are the cross-sectional mean and standard deviation of
                input k across the candidate universe:
              </p>
              <Formula>z_i,k = (x_i,k − μ_k) / σ_k</Formula>
              <p className="text-[0.78rem] text-[#5B6E68] mt-3 mb-3">
                A bounded percentile or rank transform is substituted when distributional stability
                is preferred — when an input is heavy-tailed or the universe is small enough that a
                single outlier would dominate the z-score. The composite structural score is then:
              </p>
              <Formula>S_i^Structural = ∑_k a_k · z_i,k</Formula>
              <p className="text-[0.7rem] text-[#7A8C86] mt-3">
                The aggregation weights a_k are themselves subject to methodology validation: the
                sensitivity of the final basket to each a_k is tested by parameter perturbation
                (§23.6), and unstable coefficients are re-derived or the input is re-transformed.
                This closes the loop — the constituency engine is as auditable as the weighting
                engine, because every intermediate score is published with the weights (§24.3).
                Pilot honesty: the Q_i model is validation-stage (spec-plus-live-COFER inputs);
                membership changes have never been executed.
              </p>
            </Panel>
          </Reveal>
        </div>
      </section>

      {/* ============ §4.3 — institutional data sources ============ */}
      <section id="constituency-sources" aria-labelledby="constituency-sources-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§4.3 · institutional data"
          title="Institutional Data Sources"
          className="mb-0"
          right={
            <Pill tone="amber">
              <GlowDot color="amber" size="h-1.5 w-1.5" />
              inputs — never weights
            </Pill>
          }
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Reveal>
            <Panel className="p-5 h-full">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0E1F1B]">IMF COFER — reserve relevance (R_i)</h3>
              </div>
              <p className="text-[0.76rem] text-[#5B6E68] leading-relaxed" id="constituency-sources-h">
                The Currency Composition of Official Foreign Exchange Reserves (COFER) is the
                primary reserve-relevance input. It currently identifies{" "}
                <span className="font-mono text-[#0E1F1B]">USD, EUR, CNY, JPY, GBP, AUD, CAD, CHF</span>{" "}
                as reported reserve currencies, while explicitly excluding monetary gold from the
                foreign-exchange-reserve classification. Two implications follow: gold&apos;s reserve
                role is measured by supplementary sources (central-bank gold statistics) rather than
                COFER, and any currency absent from COFER carries a structurally reduced R_i until
                reporting begins. COFER is updated quarterly, which sets the natural cadence for
                reserve-relevance refreshes.
              </p>
            </Panel>
          </Reveal>
          <Reveal delay={0.05}>
            <Panel className="p-5 h-full">
              <div className="flex items-center gap-2 mb-2">
                <Globe2 className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0E1F1B]">
                  BIS Triennial Survey 2025 — liquidity &amp; trade (L_i, T_i)
                </h3>
              </div>
              <ul className="space-y-2 mb-3">
                {BIS_2025_SHARES.map((s) => (
                  <li key={s.code} className="flex items-center gap-2">
                    <span className="w-10 text-[0.68rem] font-mono text-[#5B6E68]">{s.code}</span>
                    <MiniBar
                      value={s.sharePct}
                      max={100}
                      colorClass="bg-mtqs-gold/70"
                      className="flex-1"
                    />
                    <span className="w-12 text-right font-mono text-[0.68rem] text-[#5B6E68]">
                      {s.sharePct.toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[0.68rem] text-[#7A8C86] leading-relaxed">
                Share of one side of FX turnovers. CHF became the sixth-most-traded currency while
                sterling&apos;s share declined. Because the survey is triennial, interim estimates are
                interpolated from higher-frequency turnover oracles where available, and
                methodology versions record which interpolation was used.
              </p>
            </Panel>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <div className="mt-4 rounded-lg border border-mtqs-amber/25 bg-mtqs-amber/[0.06] p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-4 w-4 text-mtqs-amber mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-[0.74rem] text-amber-700 leading-relaxed">
                <span className="font-semibold text-mtqs-amber">These figures are INPUTS, never weights.</span>{" "}
                COFER and BIS turnover shares feed R_i, L_i and T_i through the scoring model of
                §4.2 — the published weight of any currency is set by the MASE pipeline (§24.5),
                never copied from a survey share. Data-source governance: eligible providers are
                approved by governance (§22.4); if an institutional source changes its methodology,
                the change is handled as a structural input revision with a new DataVersion (§24.2)
                — never as a silent recalibration.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============ live candidate universe (fetched) ============ */}
      <section id="constituency-universe" aria-labelledby="constituency-universe-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§3.3 / §4 · live state"
          title="Live Candidate Universe &amp; Basket"
          className="mb-0"
          right={
            data ? (
              <Pill tone={data.quotes.live ? "emerald" : "amber"}>
                <GlowDot color={data.quotes.live ? "emerald" : "amber"} size="h-1.5 w-1.5" />
                {data.quotes.live ? "live ECB/Frankfurter quotes" : "fixture fallback quotes"}
              </Pill>
            ) : (
              <Pill tone="muted">loading…</Pill>
            )
          }
        />
        <Reveal>
          <Panel className="p-5">
            <h3 id="constituency-universe-h" className="text-sm font-semibold text-[#0E1F1B] mb-1">
              Monitored succession candidates (§3.3 — validation-stage universe)
            </h3>
            <p className="text-[0.72rem] text-[#5B6E68] mb-4">
              Seed weight = the envelope mid of the candidate&apos;s provisional admissibility band;
              the Risk Council sets the actual seed within the band at admission. Admission is
              governed — no candidate has been admitted on this pilot.
            </p>

            {error ? (
              <div className="p-4 rounded-lg border border-rose-200 bg-rose-50">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="h-4 w-4 text-rose-600" aria-hidden="true" />
                  <span className="text-[0.8rem] font-semibold text-rose-700">
                    Candidate universe unavailable
                  </span>
                </div>
                <p className="text-[0.72rem] text-rose-600">
                  /api/succession did not respond ({error}). Live admission state is not fabricated —
                  the blueprint reference on this page remains the specification. Retry from the
                  Succession Lab, or check /api/health.
                </p>
              </div>
            ) : !data ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.universe.map((c) => {
                    const quote = data.quotes.quotes[c.code];
                    const band = c.envelope.upper - c.envelope.lower;
                    const seedPct = (c.envelope.lower + c.envelope.upper) / 2;
                    return (
                      <div
                        key={c.code}
                        className="p-3.5 rounded-xl border border-[#E3EAE6] bg-[#F7FAF8]"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono text-sm font-semibold text-mtqs-gold">{c.code}</span>
                          <span className="text-[0.66rem] text-[#5B6E68] text-right">{c.name}</span>
                        </div>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-[0.55rem] uppercase tracking-[0.18em] text-[#7A8C86]">
                            seed weight
                          </span>
                          <span className="font-mono text-[0.78rem] text-[#0E1F1B]">
                            {(c.seedWeight * 100).toFixed(1)}%
                          </span>
                        </div>
                        <MiniBar
                          value={c.seedWeight}
                          min={c.envelope.lower}
                          max={c.envelope.upper}
                          colorClass="bg-mtqs-gold/70"
                        />
                        <div className="flex justify-between mt-1 text-[0.55rem] font-mono text-[#7A8C86]">
                          <span>lower {(c.envelope.lower * 100).toFixed(0)}%</span>
                          <span>envelope ±{(band * 50).toFixed(1)}pp</span>
                          <span>upper {(c.envelope.upper * 100).toFixed(0)}%</span>
                        </div>
                        <p className="text-[0.62rem] text-[#7A8C86] mt-2 leading-relaxed">{c.note}</p>
                        <div className="mt-2 pt-2 border-t border-[#E3EAE6] flex items-center justify-between">
                          <span className="text-[0.55rem] uppercase tracking-wider text-[#7A8C86]">
                            live USD quote
                          </span>
                          <span className="font-mono text-[0.66rem] text-[#5B6E68]">
                            {quote != null ? `$${quote.toFixed(4)}` : "—"}
                          </span>
                        </div>
                        <div className="text-[0.5rem] text-[#9AA9A3] mt-0.5 font-mono">
                          seed = band mid {(seedPct * 100).toFixed(1)}% · governed admission
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Live basket weights */}
                <div className="mt-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h4 className="text-[0.72rem] uppercase tracking-[0.2em] text-[#5B6E68]">
                      Live basket weights (smoothed state)
                    </h4>
                    <Pill tone="emerald">
                      <GlowDot color="emerald" size="h-1.5 w-1.5" />
                      I_t {data.live.iLevel.toFixed(6)}
                    </Pill>
                    {data.live.basis && (
                      <span className="text-[0.55rem] font-mono text-[#7A8C86]">
                        holdings basis: {data.live.basis}
                      </span>
                    )}
                  </div>
                  {data.live.weights ? (
                    <div className="overflow-hidden rounded-md border border-[#E3EAE6]">
                      <table className="w-full text-[0.72rem]">
                        <thead className="bg-[#F7FAF8] text-[#5B6E68]">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">Component</th>
                            <th className="text-left px-3 py-2 font-medium w-1/2">Smoothed weight</th>
                            <th className="text-right px-3 py-2 font-medium">Weight</th>
                          </tr>
                        </thead>
                        <tbody>
                          {basket.map((b) => {
                            const w = data.live.weights?.[b];
                            return (
                              <tr key={b} className="border-t border-[#E3EAE6]">
                                <td className="px-3 py-2 font-mono text-mtqs-gold">{b}</td>
                                <td className="px-3 py-2">
                                  {w != null ? (
                                    <MiniBar value={w} max={0.35} colorClass="bg-mtqs-gold/60" />
                                  ) : (
                                    <span className="text-[#7A8C86]">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-[#33544C]">
                                  {w != null ? `${(w * 100).toFixed(2)}%` : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-[0.7rem] text-[#7A8C86]">
                      Live weights unavailable from the engine (genesis state) — shown as &ldquo;—&rdquo;.
                      The strategic prior (§3.2) is published on the Reference tab.
                    </p>
                  )}
                  <p className="text-[0.6rem] text-[#7A8C86] mt-2">
                    Source: /api/succession · the engine&apos;s live smoothed weights over the canonical
                    7-component basket. Gold is the constitutional anchor (I3) and is never subject
                    to constituency retirement.
                  </p>
                </div>
              </>
            )}
          </Panel>
        </Reveal>
      </section>

      {/* ============ §4.6 / §4.7 — transitions & hysteresis ============ */}
      <section id="constituency-transitions" aria-labelledby="constituency-transitions-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§4.6 / §4.7 · anti-thrash machinery"
          title="Transitions &amp; Hysteresis"
          className="mb-0"
          right={<Pill tone="emerald">3 independent anti-oscillation defenses</Pill>}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Reveal>
            <Panel className="p-5 h-full">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 text-mtqs-gold/70" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0E1F1B]">Gradual transitions — §4.6</h3>
              </div>
              <p className="text-[0.76rem] text-[#5B6E68] mb-3" id="constituency-transitions-h">
                A currency is never added or removed instantaneously [MS §44]. For an entering
                currency j, the weight ramps over a transition window:
              </p>
              <Formula>W_j,t = r_t · W_j,target</Formula>
              <ul className="mt-3 space-y-1.5 text-[0.72rem] text-[#5B6E68]">
                <li>
                  <span className="text-mtqs-gold font-mono">r_t = t/T</span> — linear ramp is the default.
                </li>
                <li>
                  Window length T is adjusted for the entering component&apos;s liquidity and prevailing
                  market conditions — replacing the old fixed 30-day rule — and may not be shortened
                  below a constitutional minimum.
                </li>
                <li>
                  The ramp feeds through the same MARP execution gates as any other weight change:{" "}
                  <span className="text-[#0E1F1B]">
                    a transition is a sequence of justified partial corrections, not a block trade.
                  </span>
                </li>
              </ul>
            </Panel>
          </Reveal>
          <Reveal delay={0.05}>
            <Panel className="p-5 h-full">
              <div className="flex items-center gap-2 mb-2">
                <Shuffle className="h-4 w-4 text-mtqs-gold/70" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0E1F1B]">Two-threshold dead band — §4.7</h3>
              </div>
              <div className="space-y-2 mb-3">
                <Formula>entry: Q_i &gt; Q_entry</Formula>
                <Formula>exit: Q_i &lt; Q_exit</Formula>
                <Formula>with Q_entry &gt; Q_exit (dead band)</Formula>
              </div>
              <p className="text-[0.72rem] text-[#5B6E68] leading-relaxed">
                A currency that has just entered must see its score fall below the{" "}
                <span className="text-[#0E1F1B]">lower exit threshold</span> before retirement can
                begin; a currency that has exited must exceed the{" "}
                <span className="text-[#0E1F1B]">higher entry threshold</span> before re-admission.
                The dead-band width is a Risk-Council parameter bounded by a constitutional minimum,
                and both thresholds are published. Hysteresis composes with the rebalancing
                direction lock (§11.5) and the smoothing rule (§8.4) to give the basket{" "}
                <span className="text-mtqs-gold">three independent anti-oscillation defenses</span>,
                each operating at a different timescale.
              </p>
            </Panel>
          </Reveal>
        </div>
      </section>

      {/* ============ §4.4 — non-decisions are constitutional ============ */}
      <section id="constituency-cases" aria-labelledby="constituency-cases-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§4.4 · constitutional neutrality"
          title="Non-Decisions Are Constitutional"
          className="mb-0"
          right={<Pill tone="gold">cases A–D · no pre-bias</Pill>}
        />
        <Reveal>
          <Panel className="p-5">
            <p className="text-[0.78rem] text-[#5B6E68] mb-3" id="constituency-cases-h">
              The initial serious universe is{" "}
              <span className="font-mono text-[#0E1F1B]">USD, EUR, JPY, CNY, GBP, CHF</span>, with{" "}
              <span className="font-mono text-[#0E1F1B]">CAD, AUD, SGD</span> and other liquid
              currencies as monitored candidates [MS §7]. Two explicit non-decisions are
              constitutional: <span className="text-[#0E1F1B]">GBP is not automatically removed, and CHF is not
              automatically guaranteed admission.</span> The mathematical process must be able to produce
              any of the following outcomes, and the architecture must not pre-bias any of them:
            </p>
            <BorderedTable
              headers={["Case", "Outcome", "Meaning"]}
              rows={NON_DECISION_CASES.map((c) => [
                <span key="c" className="font-mono font-semibold text-mtqs-gold">{c.c}</span>,
                <span key="o" className="font-mono text-[#0E1F1B]">{c.outcome}</span>,
                <span key="m" className="text-[#5B6E68]">{c.meaning}</span>,
              ])}
            />
            <p className="text-[0.7rem] text-[#7A8C86] mt-3">
              The same neutrality applies to the incumbent six: eligibility is{" "}
              <span className="text-[#0E1F1B]">re-tested on every review</span>, and a currency whose Q_i
              falls below the exit threshold enters the retirement path (§4.6) with the same gradual
              transitions and the same anti-oscillation hysteresis as any other component.
            </p>
          </Panel>
        </Reveal>
      </section>

      {/* ============ §4.8 — SGTX-G note ============ */}
      <section id="constituency-sgtxg" aria-labelledby="constituency-sgtxg-h" className="scroll-mt-32">
        <Reveal>
          <Panel className="p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-4 w-4 text-mtqs-amber mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h3 id="constituency-sgtxg-h" className="text-sm font-semibold text-[#0E1F1B] mb-1">
                  SGTX-G is not inherited automatically — §4.8
                </h3>
                <p className="text-[0.74rem] text-[#5B6E68] leading-relaxed">
                  Because this project is MTQΣ, any physical-gold token must be designed under
                  MTQΣ&apos;s own legal and monetary architecture [MS §57]. The earlier SGTX-G concept
                  (a 1-gram physical-gold representation) is historical design input only. Concretely:{" "}
                  <span className="text-[#0E1F1B]">
                    gold exposure in the reference basket is to the gold price reference unit (§17.4),
                    not to any specific token
                  </span>{" "}
                  — the reserve implementation of gold chooses among eligible instruments (PAXG, XAUT,
                  physical bullion, or a future MTQ-native instrument) under the Chapter 15
                  eligibility framework. This decoupling is what allows the canonical gold price to be
                  source-independent (Chapter 17).
                </p>
              </div>
            </div>
          </Panel>
        </Reveal>
      </section>

      {/* ============ M8-3a — Dynamic-Membership Machinery (IMPLEMENTED, QUIESCENT) ============ */}
      <section id="constituency-machinery" aria-labelledby="constituency-machinery-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§2/§3 · M8-3a · registry-based membership"
          title="Dynamic-Membership Machinery"
          className="mb-0"
          right={
            <Pill tone="amber">
              <GlowDot color="amber" size="h-1.5 w-1.5" />
              IMPLEMENTED · QUIESCENT
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-5">
            <h3 id="constituency-machinery-h" className="text-sm font-semibold text-[#0E1F1B] mb-1">
              Registry-based basket membership — implemented in the production engine, never fired
            </h3>
            <p className="text-[0.76rem] text-[#5B6E68] leading-relaxed mb-4">
              Task M8-3a promoted the dynamic-membership reference layer into{" "}
              <code className="font-mono text-[0.7rem] text-mtqs-gold-light">src/lib/mtq/constituency/</code>: a
              Map-keyed component registry (stable string IDs, never recycled), the T1–T9 lifecycle machinery with
              evidence-checked governance directives, and the glide/weight pipeline. The machinery replaces the
              “constituency is static” design gap — membership can grow and shrink at runtime — while the ACTIVE
              basket remains byte-identical to the fixed 7-component engine until a governed directive fires.
            </p>

            {/* QUIESCENT disclosure */}
            <div className="rounded-lg border border-mtqs-amber/25 bg-mtqs-amber/[0.06] p-4 mb-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-4 w-4 text-mtqs-amber mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-[0.74rem] text-amber-700 leading-relaxed">
                  <span className="font-semibold text-mtqs-amber">QUIESCENT — {machinery?.quiescent.disclosure ??
                    "NO transition has ever run — the ACTIVE basket remains the 7-component genesis set at strategic-prior weights; transitions fire only on governance directives with valid rule evidence, and none exists."}</span>
                </p>
              </div>
            </div>

            {machineryError ? (
              <div className="p-4 rounded-lg border border-rose-200 bg-rose-50">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="h-4 w-4 text-rose-600" aria-hidden="true" />
                  <span className="text-[0.8rem] font-semibold text-rose-700">Machinery snapshot unavailable</span>
                </div>
                <p className="text-[0.72rem] text-rose-600">
                  /api/constituency did not respond ({machineryError}). Nothing is fabricated — the registry
                  reference above remains the specification.
                </p>
              </div>
            ) : !machinery ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            ) : (
              <>
                {/* The 7 genesis registry entries */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Database className="h-4 w-4 text-mtqs-gold/70" aria-hidden="true" />
                  <h4 className="text-[0.78rem] font-semibold text-[#0E1F1B]">
                    DEFAULT_REGISTRY — the genesis 7 ({machinery.genesisRegistry.genesisWeightSumBp.toLocaleString("en-US")} bp = 100.00%)
                  </h4>
                  <Pill tone="emerald">
                    <GlowDot color="emerald" size="h-1.5 w-1.5" />
                    {machinery.quiescent.activeBasketCount} ACTIVE
                  </Pill>
                </div>
                <BorderedTable
                  headers={["Component", "Type", "Genesis weight", "Envelope", "Lifecycle state"]}
                  rows={machinery.genesisRegistry.entries.map((e) => [
                    <span key="c" className="font-mono font-semibold text-mtqs-gold">
                      {e.code}
                      <span className="text-[#7A8C86] font-normal"> · {e.id}</span>
                    </span>,
                    <span key="t" className="text-[#5B6E68] font-mono text-[0.68rem]">{e.componentType}</span>,
                    <span key="w" className="inline-flex flex-col gap-1 min-w-[7.5rem]">
                      <span className="font-mono text-[#0E1F1B]">{e.genesisWeightBp.toLocaleString("en-US")} bp</span>
                      <MiniBar
                        value={e.genesisWeightBp}
                        max={3000}
                        colorClass="bg-mtqs-gold/70"
                        className="w-28"
                        height="h-1"
                      />
                    </span>,
                    <span key="e" className="font-mono text-[0.66rem] text-[#5B6E68]">
                      {e.envelope.minPct.toFixed(0)}–{e.envelope.maxPct.toFixed(0)}%
                    </span>,
                    <Pill key="s" tone={e.lifecycleState === "ACTIVE" ? "emerald" : "muted"}>{e.lifecycleState}</Pill>,
                  ])}
                />
                <p className="text-[0.62rem] text-[#7A8C86] mt-2 leading-relaxed">
                  Dossier: {machinery.genesisRegistry.dossierRef}. Registry IDs and stable string IDs are never
                  recycled or reused; registration of any non-genesis component requires a provenance dossier
                  reference (spec §3 T1 evidence row). No GPP_LEG record is registered today.
                </p>

                {/* Lifecycle legend */}
                <div className="mt-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <RefreshCw className="h-4 w-4 text-mtqs-gold/70" aria-hidden="true" />
                    <h4 className="text-[0.78rem] font-semibold text-[#0E1F1B]">Lifecycle states (spec §3)</h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {machinery.lifecycleLegend
                      .filter((l) => l.state !== "EMERGENCY-SUSPENDED")
                      .map((l, i, arr) => (
                        <span key={l.state} className="flex items-center gap-1.5">
                          <span
                            title={l.role}
                            className={`rounded-md border px-1.5 py-0.5 font-mono text-[0.62rem] ${
                              l.state === "ACTIVE"
                                ? "border-mtqs-emerald/40 bg-mtqs-emerald/10 text-mtqs-emerald"
                                : "border-[#E3EAE6] bg-[#F7FAF8] text-[#5B6E68]"
                            }`}
                          >
                            {l.state}
                          </span>
                          {i < arr.length - 1 ? (
                            <span className="text-[#9AA9A3] text-[0.6rem]" aria-hidden="true">
                              →
                            </span>
                          ) : null}
                        </span>
                      ))}
                  </div>
                  <p className="text-[0.66rem] text-[#5B6E68] leading-relaxed">
                    <span className="font-mono text-mtqs-amber">EMERGENCY-SUSPENDED</span> is a distinct OVERLAY
                    path (T7 — immediate freeze + fail-closed leg-pin), not a normal-retirement state. ELIGIBLE is a
                    queue state — admission is not yet weight-bearing. Weight-bearing states: ACTIVE, WATCH,
                    RETIRING (decaying) and EMERGENCY-SUSPENDED (frozen at the suspension value); all others hold
                    exactly 0.
                  </p>
                </div>

                {/* T1–T9 directive list */}
                <div className="mt-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Shuffle className="h-4 w-4 text-mtqs-gold/70" aria-hidden="true" />
                    <h4 className="text-[0.78rem] font-semibold text-[#0E1F1B]">
                      The T1–T9 transition & directive vocabulary
                    </h4>
                    <Pill tone="muted">directives evidence-checked · rejections recorded</Pill>
                  </div>
                  <BorderedTable
                    headers={["ID", "Transition / directive", "Kind"]}
                    rows={machinery.transitions.map((t) => [
                      <span key="id" className="font-mono font-semibold text-mtqs-gold">{t.id}</span>,
                      <span key="n" className="text-[#5B6E68]">{t.name}</span>,
                      <Pill key="k" tone={t.kind === "governance directive" ? "gold" : "muted"}>
                        {t.kind}
                      </Pill>,
                    ])}
                  />
                  <p className="text-[0.62rem] text-[#7A8C86] mt-2 leading-relaxed">
                    Governance directives (T3/T5/T7/T8/T9) are evidence-checked: the engine ENFORCES their rule
                    preconditions (a completed T2 record for T3; a completed exit window for T5; documented cause
                    for T7; fast-track window for T8; a fresh dossier for T9) and REJECTS directives whose
                    preconditions are not met — every rejection is recorded. Rule-driven transitions (T1/T2/T4/T4R/T6
                    and T2-EXPIRY) fire from score evidence only. Transitions ever run:{" "}
                    <span className="font-mono text-[#5B6E68]">{machinery.quiescent.transitionsEverRun}</span> ·
                    directives ever applied:{" "}
                    <span className="font-mono text-[#5B6E68]">{machinery.quiescent.directivesEverApplied}</span>.
                  </p>
                </div>

                {/* Honest limits */}
                <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      <h4 className="text-[0.76rem] font-semibold text-rose-700 mb-1">Honest limits of this machinery</h4>
                      <p className="text-[0.7rem] text-rose-600 leading-relaxed">
                        {machinery.honestLimits.line}
                      </p>
                      <p className="text-[0.64rem] text-[#7A8C86] mt-2 leading-relaxed">
                        {machinery.honestLimits.parameterClass} Scoring feeds: {machinery.honestLimits.scoringFeedDisclosure}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </Panel>
        </Reveal>
      </section>
    </div>
  );
}
