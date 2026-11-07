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
// Live data: GET /api/succession (candidate universe + live basket weights) AND
// GET /api/constituency — polled every 60s with last-good retention (TASK-39):
// the M8-3a machinery snapshot PLUS the live §4 scoring dossier (per-input
// feed statuses, index-leg witnesses, source reachability), the D-13.11/D-13.14
// parameter approval ledger, and the MTQSigmaV4 contract-layer status +
// shadow-mode demonstration. Everything else is faithful static blueprint
// reference content.
//
// Props: { onNavigate, snapshot } — shared section contract.

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import { ADMISSIBILITY_ENVELOPES } from "@/lib/mtq/blueprint";
import {
  Landmark,
  Database,
  Globe2,
  Shuffle,
  Scale,
  ShieldAlert,
  RefreshCw,
  Gauge,
  Stamp,
  FileCode2,
} from "lucide-react";

/* ---------- /api/succession GET shape (sibling contract) ---------- */
// F-51-2 (Task-51 audit): the live-weights bar below scaled to a hardcoded
// 0.35 while every other weight bar on the platform scales to the
// constitutional envelope maximum (Task-45 F-45-1 convention — never
// hardcode the scale). 0.35 > the 0.32 envelope cap meant no saturation,
// but the SAME weight rendered different widths on different tabs. Derived,
// constitutionally grounded, cross-surface consistent.
const ENVELOPE_BAR_MAX = Math.max(
  ...Object.values(ADMISSIBILITY_ENVELOPES).map((e) => e.upper),
);

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

/* ---------- /api/constituency GET shape — TASK-39 additions ----------
   The three new payload sections surfaced by this section: the live §4
   scoring dossier (feeds.ts), the §13 parameter approval ledger
   (approvals.ts) and the MTQSigmaV4 contract-layer status + shadow-mode
   demonstration (Task-13). Shapes mirror the route handler verbatim. */

// The nine §4 scoring inputs, in canonical dossier order (the API's
// components[].inputs object keys).
const SCORING_INPUT_KEYS = [
  "liquidity",
  "dataQuality",
  "convertibility",
  "jurisdictionalRestrictions",
  "currencyControl",
  "benchmarkAvailability",
  "volatility",
  "diversification",
  "geopoliticalExposure",
] as const;

type ScoringInputKey = (typeof SCORING_INPUT_KEYS)[number];

// Short board labels — match the hard-gate vocabulary (L/QD/CV/JR/BA).
const SCORING_INPUT_LABELS: Record<ScoringInputKey, string> = {
  liquidity: "L",
  dataQuality: "QD",
  convertibility: "CV",
  jurisdictionalRestrictions: "JR",
  currencyControl: "CC",
  benchmarkAvailability: "BA",
  volatility: "V",
  diversification: "D",
  geopoliticalExposure: "GE",
};

// Dot color per per-input feed status (TASK-39 feeds.ts vocabulary).
// emerald = live · gold = published official statistics / operator-serviced
// upload of a gated official source · amber = live with a caveat (proxy /
// declared / mixed) · rose = fixture fallback · neutral = construction.
// String-keyed so unknown future statuses degrade to neutral.
const FEED_STATUS_DOT: Record<string, "emerald" | "gold" | "amber" | "rose" | "neutral"> = {
  LIVE: "emerald",
  "LIVE-AUTOMATED": "emerald",
  "LIVE-PROXY": "amber",
  "LIVE-UPLOADED": "gold", // Task-42: operator-serviced ingestion of a gated official source — distinct from automated live
  "PUBLISHED-OFFICIAL": "gold",
  "DECLARED-ESTIMATE": "amber",
  "FIXTURE-FALLBACK": "rose",
  CONSTRUCTION: "neutral",
  MIXED: "amber",
};

// Same vocabulary in Pill form (input-feed matrix table).
const FEED_STATUS_TONE: Record<string, "emerald" | "gold" | "amber" | "rose" | "muted"> = {
  LIVE: "emerald",
  "LIVE-AUTOMATED": "emerald",
  "LIVE-PROXY": "amber",
  "LIVE-UPLOADED": "gold", // Task-42 operator-serviced ingestion (gated official source, digest-bound)
  "PUBLISHED-OFFICIAL": "gold",
  "DECLARED-ESTIMATE": "amber",
  "FIXTURE-FALLBACK": "rose",
  CONSTRUCTION: "muted",
  MIXED: "amber",
};

interface ScoringHardGateDto {
  gate: string;
  value: number;
  threshold: number;
  comparator: string;
  passed: boolean;
}

interface ScoringComponentDto {
  id: string;
  code: string;
  name: string;
  componentType: string;
  inputs: Record<ScoringInputKey, number>;
  inputStatus: Record<string, string>;
  inputDetail: Record<string, string>;
  composite: number;
  hardGates: ScoringHardGateDto[];
  hardGatesAllPass: boolean;
  failedGates: string[];
  notes: string[];
}

interface ScoringLegFamilyDto {
  family: string;
  source: string;
  priceUsd: number;
  asOf: string;
  live: boolean;
}

interface ScoringLegWitnessDto {
  legId: string;
  componentCode: string;
  families: ScoringLegFamilyDto[];
  familiesLive: number;
  maxPairwiseDivergencePct: number;
  preconditionMet: boolean;
}

interface ScoringDossierDto {
  builtAt: string;
  cacheAgeSec: number;
  parametersDigestNote: string;
  inputFeedMatrix: {
    input: string;
    tier: 1 | 2 | 3;
    status: string;
    source: string;
    detail: string;
  }[];
  components: ScoringComponentDto[];
  legWitnesses: ScoringLegWitnessDto[];
  precondition: {
    required: string;
    legsTotal: number;
    legsMet: number;
    met: boolean;
    note: string;
  };
  sourceReachability: {
    source: string;
    url: string;
    reachable: boolean;
    detail: string;
  }[];
  findings: string[];
  residualLimits: string[];
}

interface ApprovalLedgerEntryDto {
  decisionId: string;
  title: string;
  scope: string;
  status: string;
  authority: string;
  approvedAt: string;
  channel: string;
  traceId: string;
  directiveVerbatim: string;
  parameterDigest: string;
  digestNote: string;
  covers: string[];
  residualOpens: string[];
  calibrationNotes: string[];
}

interface ApprovalsDto {
  summary: {
    parameterClass: string;
    ledgerCount: number;
    allPilotApproved: boolean;
    digest: string;
    digestValid: boolean;
    productionGateC: string;
    note: string;
  };
  ledger: ApprovalLedgerEntryDto[];
}

interface ShadowCaseScenarioDto {
  code: string;
  status: string;
  weightBp: number;
}

interface ShadowCaseDto {
  caseId: string;
  title: string;
  description: string;
  scenario: ShadowCaseScenarioDto[];
  expected: "PASS" | "FAIL";
  result: {
    passed: boolean;
    violations: { rule: number; error: string; detail: string }[];
    sumBp: number;
    checked: {
      submissionCount: number;
      activeCovered: number;
      activeTotal: number;
    };
  };
  verified: boolean;
}

interface ContractLayerV4Dto {
  status: {
    name: string;
    sourcePath: string;
    designPlanPath: string;
    designPlanStatus: string;
    compileArtifact: string;
    compiler: string;
    compileSettings: string;
    deployedBytecodeBytes: number;
    eip170: string;
    deterministicRepro: string;
    deployed: boolean;
    deploymentPosture: string;
    staticLayerClosed: string;
    reproductionCommand: string;
  };
  shadowDemonstration: {
    cases: ShadowCaseDto[];
    summary: string;
    allVerified: boolean;
  };
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
  // TASK-39 payload sections (always present in the extended route response).
  scoringDossier: ScoringDossierDto;
  approvals: ApprovalsDto;
  contractLayerV4: ContractLayerV4Dto;
  honestLimits: {
    line: string;
    parameterClass: string;
    scoringFeedDisclosure: string;
    contractLayer: string;
  };
}

/* ---------- TASK-39: constituency API client poll interval ----------
   The dossier's server-side cache is 10 min; a 60s client poll shows an
   advancing cacheAge + fresh leg witnesses at reasonable cost. */
const CONSTITUENCY_POLL_MS = 60_000;

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
    <code className="block font-mono text-[0.78rem] sm:text-[0.85rem] text-mtqs-gold bg-[#F7FAF8] border border-[#E3EAE6] rounded-md px-4 py-3 overflow-x-auto whitespace-nowrap">
      {children}
    </code>
  );
}

/* ============================================================
   TASK-39 panel building blocks (all presentational, this file only)
   ============================================================ */

// ISO instant → compact local clock "HH:MM:SS" (dossier freshness).
function fmtClock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString("en-GB", { hour12: false });
}

// asOf → published dates as-is (YYYY-MM-DD); live timestamps "MM-DD HH:MM".
function fmtAsOf(asOf: string): string {
  if (!asOf) return "—";
  if (!asOf.includes("T")) return asOf;
  const d = new Date(asOf);
  if (Number.isNaN(d.getTime())) return asOf;
  return `${d.toLocaleDateString("en-GB", { month: "2-digit", day: "2-digit" })} ${d.toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit" })}`;
}

// Comparator glyph for hard-gate chips (observed-vs-threshold display).
function cmpGlyph(c: string): string {
  return c === ">=" ? "≥" : c === "<=" ? "≤" : c === "==" ? "=" : c === "!=" ? "≠" : c;
}

/* ---------- FeedStatusDot — tiny dot + sr-only status text ---------- */
function FeedStatusDot({ status }: { status: string }) {
  const color = FEED_STATUS_DOT[status] ?? "neutral";
  return (
    <span className="relative inline-flex h-1.5 w-1.5 shrink-0" title={status}>
      {color === "neutral" ? (
        <span className="h-full w-full rounded-full bg-[#9AA9A3]" />
      ) : (
        <GlowDot color={color} size="h-1.5 w-1.5" />
      )}
      <span className="sr-only">{status}</span>
    </span>
  );
}

/* ---------- One component row of the live Q_i board ---------- */
function ScoringComponentRow({ c }: { c: ScoringComponentDto }) {
  return (
    <article className="rounded-xl border border-[#E3EAE6] bg-[#F7FAF8] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 mb-2.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-sm font-semibold text-mtqs-gold">{c.code}</span>
          <span className="text-[0.68rem] text-[#33544C]">{c.name}</span>
          <span className="font-mono text-[0.6rem] uppercase tracking-wider text-[#5B6E68]">
            {c.componentType}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <MiniBar
            value={c.composite}
            max={1}
            colorClass={c.hardGatesAllPass ? "bg-mtqs-emerald/70" : "bg-mtqs-amber/70"}
            className="w-20 sm:w-24"
          />
          <span
            className="font-mono text-[0.95rem] font-bold text-[#0E1F1B] tabular-nums"
            title={`composite Q_i = ${c.composite.toFixed(6)}`}
          >
            {c.composite.toFixed(3)}
          </span>
        </div>
      </div>

      {/* The 9 scoring inputs — 3×3 on mobile, one row from lg up */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1.5">
        {SCORING_INPUT_KEYS.map((k) => {
          const raw = c.inputs[k];
          const v = Number.isFinite(raw) ? raw : 0;
          const status = c.inputStatus[k] || "CONSTRUCTION";
          const detail = c.inputDetail[k] || "";
          return (
            <div
              key={k}
              className="min-w-0 rounded-md border border-[#E3EAE6] bg-[#FAFCFA] px-1.5 py-1"
              title={`${k} (${SCORING_INPUT_LABELS[k]}) = ${v.toFixed(4)} · ${status}${detail ? ` — ${detail}` : ""}`}
            >
              <div className="flex items-center gap-1">
                <FeedStatusDot status={status} />
                <span className="font-mono text-[0.6rem] uppercase tracking-wider text-[#5B6E68]">
                  {SCORING_INPUT_LABELS[k]}
                </span>
              </div>
              <span className="font-mono text-[0.74rem] text-[#0E1F1B] tabular-nums">
                {v.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Hard gates — pass ticks emerald; fails rose with observed vs threshold */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        <span className="mr-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[#5B6E68]">
          hard gates
        </span>
        {c.hardGates.map((g) =>
          g.passed ? (
            <span
              key={g.gate}
              title={`${g.gate} gate: ${g.value.toFixed(3)} ${cmpGlyph(g.comparator)} ${g.threshold} — PASS`}
              className="inline-flex items-center rounded-full border border-mtqs-emerald/30 bg-mtqs-emerald/10 px-2 py-0.5 font-mono text-[0.6rem] font-medium text-mtqs-emerald"
            >
              ✓ {g.gate}
            </span>
          ) : (
            <span
              key={g.gate}
              title={`${g.gate} gate: observed ${g.value.toFixed(3)} vs required ${g.comparator} ${g.threshold} — FAIL`}
              className="inline-flex items-center rounded-full border border-mtqs-rose/30 bg-mtqs-rose/10 px-2 py-0.5 font-mono text-[0.6rem] font-medium text-mtqs-rose"
            >
              ✗ {g.gate} {g.value.toFixed(2)}{cmpGlyph(g.comparator)}{g.threshold.toFixed(2)}
            </span>
          )
        )}
      </div>
      {c.notes.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {c.notes.map((n, i) => (
            <li key={i} className="text-[0.62rem] text-mtqs-amber leading-relaxed">— {n}</li>
          ))}
        </ul>
      ) : null}

      {/* Expandable per-input provenance (keyboard-reachable <details>) */}
      <details className="mt-2.5">
        <summary className="cursor-pointer select-none text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68] hover:text-mtqs-gold">
          input provenance detail
        </summary>
        <dl className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5">
          {SCORING_INPUT_KEYS.map((k) => (
            <div key={k} className="flex gap-2 min-w-0">
              <dt className="w-7 shrink-0 pt-0.5 font-mono text-[0.6rem] text-mtqs-gold">
                {SCORING_INPUT_LABELS[k]}
              </dt>
              <dd className="min-w-0 text-[0.6rem] leading-relaxed text-[#5B6E68]">
                <span className="font-mono text-[0.6rem] text-[#5B6E68]">
                  {c.inputStatus[k] || "—"}
                </span>{" "}
                — {c.inputDetail[k] || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </article>
  );
}

/* ---------- Index-leg witness table (compact monospace) ---------- */
function LegWitnessTable({ witnesses }: { witnesses: ScoringLegWitnessDto[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-[#E3EAE6] mtqs-scroll">
      <table className="w-full text-[0.68rem] font-mono">
        <thead className="bg-[#F7FAF8] text-[#5B6E68]">
          <tr>
            <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Leg</th>
            <th className="px-3 py-2 text-left font-medium">Witness families — price USD · as-of</th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Live</th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Max div</th>
            <th className="whitespace-nowrap px-3 py-2 text-left font-medium">≥2-family</th>
          </tr>
        </thead>
        <tbody>
          {witnesses.map((w) => (
            <tr key={w.legId} className="border-t border-[#E3EAE6]">
              <td className="whitespace-nowrap px-3 py-2.5 align-top font-semibold text-mtqs-gold">
                {w.legId}
              </td>
              <td className="px-3 py-2.5 align-top">
                <ul className="space-y-1">
                  {w.families.map((f) => (
                    <li
                      key={f.family}
                      className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                      title={`${f.source} · ${f.asOf}`}
                    >
                      <FeedStatusDot status={f.live ? "LIVE" : "CONSTRUCTION"} />
                      <span className="text-[#33544C]">{f.family}</span>
                      <span className="tabular-nums text-[#0E1F1B]">{f.priceUsd.toFixed(4)}</span>
                      <span className="tabular-nums text-[0.6rem] text-[#5B6E68]">
                        {fmtAsOf(f.asOf)}
                      </span>
                    </li>
                  ))}
                </ul>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-[#5B6E68]">
                {w.familiesLive}/{w.families.length}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-[#33544C]">
                {w.maxPairwiseDivergencePct.toFixed(3)}%
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 align-top">
                {w.preconditionMet ? (
                  <Pill tone="emerald">MET</Pill>
                ) : (
                  <Pill tone="rose">UNMET</Pill>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Input feed matrix (9-row provenance/status table) ---------- */
function InputFeedMatrixTable({
  matrix,
}: {
  matrix: ScoringDossierDto["inputFeedMatrix"];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-[#E3EAE6] mtqs-scroll">
      <table className="w-full text-[0.7rem]">
        <thead className="bg-[#F7FAF8] text-[#5B6E68]">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Input</th>
            <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Tier</th>
            <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Feed status</th>
            <th className="px-3 py-2 text-left font-medium">Source</th>
          </tr>
        </thead>
        <tbody>
          {matrix.map((r) => (
            <tr key={r.input} className="border-t border-[#E3EAE6]" title={r.detail}>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-mtqs-gold">{r.input}</td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-[#5B6E68]">tier {r.tier}</td>
              <td className="whitespace-nowrap px-3 py-2">
                <Pill tone={FEED_STATUS_TONE[r.status] ?? "muted"}>{r.status}</Pill>
              </td>
              <td className="px-3 py-2 leading-snug text-[#5B6E68]">{r.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Source reachability list (last dossier build) ---------- */
function SourceReachabilityList({
  sources,
}: {
  sources: ScoringDossierDto["sourceReachability"];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {sources.map((s) => (
        <div
          key={s.source}
          className="flex items-start gap-2 rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-2.5 py-2"
          title={s.url}
        >
          <span className="mt-1 inline-flex shrink-0">
            <GlowDot color={s.reachable ? "emerald" : "rose"} size="h-1.5 w-1.5" />
            <span className="sr-only">{s.reachable ? "reachable" : "unreachable"}</span>
          </span>
          <div className="min-w-0">
            <div className="text-[0.66rem] font-medium leading-tight text-[#33544C]">{s.source}</div>
            <div className="text-[0.6rem] leading-snug text-[#5B6E68]">{s.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- One D-13.11/D-13.14 decision card ---------- */
function ApprovalCard({ entry }: { entry: ApprovalLedgerEntryDto }) {
  return (
    <article className="rounded-xl border border-[#E3EAE6] bg-[#F7FAF8] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-[0.82rem] font-semibold text-mtqs-gold">
            {entry.decisionId}
          </span>
          <span className="text-[0.7rem] leading-snug text-[#33544C]">{entry.title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Pill tone="emerald">{entry.status}</Pill>
          <Pill tone="muted">{entry.scope}</Pill>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.6rem] text-[#5B6E68]">
        <span>{entry.authority}</span>
        <span>approved {entry.approvedAt.slice(0, 10)}</span>
        <span className="min-w-0" title={entry.channel}>
          channel:{" "}
          <span className="inline-block max-w-[15rem] truncate align-bottom">{entry.channel}</span>
        </span>
        <span>trace {entry.traceId}</span>
        <span
          className="min-w-0"
          title={`${entry.parameterDigest} — ${entry.digestNote}`}
        >
          digest {entry.parameterDigest.slice(0, 12)}…
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h5 className="mb-1.5 text-[0.6rem] uppercase tracking-[0.18em] text-[#5B6E68]">
            Covers (pilot scope)
          </h5>
          <ul className="space-y-1">
            {entry.covers.map((cv, i) => (
              <li key={i} className="flex gap-1.5 text-[0.64rem] leading-relaxed text-[#33544C]">
                <span className="text-mtqs-emerald" aria-hidden="true">·</span>
                <span>{cv}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h5 className="mb-1.5 text-[0.6rem] uppercase tracking-[0.18em] text-mtqs-amber">
            Residual opens (stay with Gate-C)
          </h5>
          <ul className="space-y-1">
            {entry.residualOpens.map((ro, i) => (
              <li key={i} className="flex gap-1.5 text-[0.64rem] leading-relaxed text-amber-700">
                <span className="text-mtqs-amber" aria-hidden="true">▸</span>
                <span>{ro}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {entry.calibrationNotes.length > 0 ? (
        <div className="mt-3 rounded-md border border-mtqs-amber/25 bg-mtqs-amber/[0.06] p-3">
          <h5 className="mb-1.5 text-[0.6rem] uppercase tracking-[0.18em] text-mtqs-amber">
            Calibration notes
          </h5>
          <ul className="space-y-1.5">
            {entry.calibrationNotes.map((cn, i) => (
              <li key={i} className="text-[0.64rem] leading-relaxed text-amber-700">
                {cn}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className="mt-3">
        <summary className="cursor-pointer select-none text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68] hover:text-mtqs-gold">
          directive verbatim ({entry.directiveVerbatim.length} chars)
        </summary>
        <blockquote className="mt-2 border-l-2 border-mtqs-gold/40 pl-3 text-[0.64rem] italic leading-relaxed text-[#5B6E68]">
          {entry.directiveVerbatim}
        </blockquote>
      </details>
    </article>
  );
}

/* ---------- TASK-42 — D-13.11 calibration decision-support explorer ----------
 * Interactive what-if for the recorded L-gate calibration finding (feeds.ts
 * finding: against the PUBLISHED BIS 2022 shares, the draft L ≥ 0.30 gate
 * fails 4/7 genesis members under the spec §4.1 share/max-share
 * normalization). Pure client-side arithmetic over PUBLISHED constants +
 * the live dossier's observed liquidity values — the engine's actual gates
 * are NEVER touched by this tool; it exists to help the owner adjudicate
 * the D-13.11 calibration input with eyes open. */
const CAL_BIS_2022_SHARE_PCT: Record<string, number> = {
  USD: 88.5,
  EUR: 30.5,
  JPY: 16.7,
  GBP: 12.9,
  CNY: 7.0,
  CHF: 5.2,
};
const CAL_MAX_SHARE_PCT = 88.5; // spec §4.1 “max_share: universe max” = USD
const CAL_XAU_NOTE =
  "XAU has no BIS-triennial row by source design — the gold leg's liquidity is the declared LBMA-based estimate (0.35), shown for completeness but NOT part of the BIS-shares calibration finding.";

function CalibrationExplorer({ components }: { components: ScoringComponentDto[] }) {
  const [theta, setTheta] = useState(0.3); // draft D-13.11 pilot-approved gate
  const [mode, setMode] = useState<"normalized" | "raw">("normalized");
  // Engine's actual threshold + observed values from the live dossier
  const lGate = components[0]?.hardGates?.find((g) => g.gate === "L");
  const engineThreshold = lGate?.threshold ?? 0.3;
  const rows = components
    .filter((c) => ["USD", "EUR", "JPY", "GBP", "CHF", "CNY", "XAU"].includes(c.code))
    .map((c) => {
      const sharePct = CAL_BIS_2022_SHARE_PCT[c.code]; // undefined for XAU (by design)
      const normalized = sharePct != null ? sharePct / CAL_MAX_SHARE_PCT : c.inputs.liquidity; // §4.1 form
      const raw = sharePct != null ? sharePct / 100 : c.inputs.liquidity;
      const value = mode === "normalized" ? normalized : raw;
      return { code: c.code, sharePct, normalized, raw, value, passes: value >= theta, isXau: c.code === "XAU" };
    });
  const passCount = rows.filter((r) => r.passes && !r.isXau).length;
  const fiatCount = rows.filter((r) => !r.isXau).length;
  return (
    <article className="rounded-xl border border-[#E3EAE6] bg-[#F7FAF8] p-4">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[0.78rem] font-semibold text-[#0E1F1B]">L-gate threshold explorer (what-if)</h4>
        <span className="font-mono text-[0.6rem] text-[#5B6E68]">
          engine gate today: L ≥ {engineThreshold.toFixed(2)} (§4.1 normalized)
        </span>
      </div>
      <p className="mb-3 text-[0.64rem] leading-relaxed text-[#5B6E68]">
        Drag θ to see how the published BIS 2022 turnover shares clear or fail the L hard gate under the two
        candidate normalizations — the calibration question the owner holds open under D-13.11. This tool
        changes NOTHING in the engine: the pilot-approved gate ({engineThreshold.toFixed(2)}, digest-bound in
        the approval ledger above) keeps running; the finding stays recorded, never silently re-normalized.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-[0.66rem] text-[#33544C]">
          <span className="font-mono">θ = {theta.toFixed(3)}</span>
          <input
            type="range"
            min={0.05}
            max={0.5}
            step={0.005}
            value={theta}
            onChange={(e) => setTheta(Number(e.target.value))}
            className="h-1.5 w-44 cursor-pointer accent-mtqs-gold"
            aria-label="L-gate threshold theta"
          />
        </label>
        <div className="flex overflow-hidden rounded-md border border-[#E3EAE6] text-[0.6rem] font-medium" role="group" aria-label="normalization mode">
          {(["normalized", "raw"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 transition-colors ${
                mode === m ? "bg-[#0E1F1B] text-white" : "bg-[#FAFCFA] text-[#5B6E68] hover:bg-[#Eef4f0]"
              }`}
            >
              {m === "normalized" ? "share / max-share (§4.1)" : "raw share of 100%"}
            </button>
          ))}
        </div>
        <span className="font-mono text-[0.62rem] tabular-nums text-[#33544C]">
          {passCount}/{fiatCount} fiat members pass{rows.some((r) => r.isXau) ? " (XAU excluded — no BIS row)" : ""}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-[0.64rem]">
          <thead>
            <tr className="border-b border-[#E3EAE6] text-left text-[0.6rem] uppercase tracking-[0.14em] text-[#5B6E68]">
              <th className="py-1.5 pr-3 font-medium">member</th>
              <th className="py-1.5 pr-3 font-medium text-right">BIS share</th>
              <th className="py-1.5 pr-3 font-medium text-right">L (§4.1 norm)</th>
              <th className="py-1.5 pr-3 font-medium text-right">raw share</th>
              <th className="py-1.5 font-medium text-right">vs θ</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {rows.map((r) => (
              <tr key={r.code} className="border-b border-[#Eef4f0] last:border-b-0">
                <td className="py-1.5 pr-3 font-semibold text-[#0E1F1B]">{r.code}</td>
                <td className="py-1.5 pr-3 text-right text-[#5B6E68]">{r.isXau ? "—" : `${r.sharePct!.toFixed(1)}%`}</td>
                <td className="py-1.5 pr-3 text-right text-[#33544C]">{r.normalized.toFixed(3)}</td>
                <td className="py-1.5 pr-3 text-right text-[#5B6E68]">{r.raw.toFixed(3)}</td>
                <td className={`py-1.5 text-right font-semibold ${r.passes ? "text-mtqs-emerald" : "text-mtqs-rose"}`}>
                  {r.passes ? "PASS" : "FAIL"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2.5 text-[0.6rem] leading-relaxed text-[#5B6E68]">
        {CAL_XAU_NOTE} Published shares: BIS Triennial 2022 (instrument share of global FX turnover, two-sided of 200%;
        bis.org/statistics/rpfx22_fx.htm). Observed dossier values (not shown here) additionally carry feed statuses.
      </p>
    </article>
  );
}

/* ---------- One V4 shadow-demonstration case card ---------- */
function ShadowCaseCard({ c }: { c: ShadowCaseDto }) {
  const expectsPass = c.expected === "PASS";
  return (
    <article className="rounded-xl border border-[#E3EAE6] bg-[#F7FAF8] p-3.5">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[0.6rem] font-semibold ${
              expectsPass
                ? "border-mtqs-emerald/30 bg-mtqs-emerald/10 text-mtqs-emerald"
                : "border-mtqs-rose/30 bg-mtqs-rose/10 text-mtqs-rose"
            }`}
          >
            CASE {c.caseId} · expects {c.expected}
          </span>
          <span
            className={`font-mono text-[0.6rem] font-medium ${
              c.verified ? "text-mtqs-emerald" : "text-mtqs-rose"
            }`}
          >
            {c.verified ? "✓ verified" : "✗ verification mismatch"}
          </span>
        </div>
        <span className="font-mono text-[0.62rem] tabular-nums text-[#5B6E68]">
          Σ {c.result.sumBp.toLocaleString("en-US")} bp
        </span>
      </div>
      <h4 className="mb-1 text-[0.74rem] font-semibold leading-snug text-[#0E1F1B]">{c.title}</h4>
      <p className="mb-2.5 text-[0.64rem] leading-relaxed text-[#5B6E68]">{c.description}</p>

      {/* Scenario chips — code · status · weightBp */}
      <div className="flex flex-wrap gap-1.5">
        {c.scenario.map((s) => (
          <span
            key={`${s.code}-${s.status}`}
            title={`${s.code} — ${s.status} — ${s.weightBp.toLocaleString("en-US")} bp`}
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[0.6rem] ${
              s.status === "ACTIVE"
                ? "border-[#E3EAE6] bg-[#FAFCFA] text-[#33544C]"
                : "border-mtqs-amber/30 bg-mtqs-amber/[0.08] text-mtqs-amber"
            }`}
          >
            <span className="font-semibold">{s.code}</span>
            <span className="text-[#5B6E68]">{s.status === "ACTIVE" ? "ACT" : s.status.slice(0, 3)}</span>
            <span className="tabular-nums">{s.weightBp.toLocaleString("en-US")}bp</span>
          </span>
        ))}
      </div>

      {/* Violations (FAIL-expected cases) */}
      {c.result.violations.length > 0 ? (
        <ul className="mt-2.5 space-y-1">
          {c.result.violations.map((v, i) => (
            <li
              key={i}
              className="rounded-md border border-mtqs-rose/25 bg-mtqs-rose/[0.06] px-2.5 py-1.5"
            >
              <span className="font-mono text-[0.6rem] font-semibold text-mtqs-rose">
                rule {v.rule} · {v.error}
              </span>
              <span className="mt-0.5 block font-mono text-[0.6rem] leading-relaxed text-[#5B6E68]">
                {v.detail}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2.5 font-mono text-[0.6rem] text-mtqs-emerald">
          no violations — submission accepted
        </p>
      )}
      <p className="mt-2 font-mono text-[0.6rem] tabular-nums text-[#5B6E68]">
        submissions {c.result.checked.submissionCount} · active covered{" "}
        {c.result.checked.activeCovered}/{c.result.checked.activeTotal}
      </p>
    </article>
  );
}

/* ---------- Compact rose note when a TASK-39 payload is unavailable ---------- */
function DossierUnavailable({ label, error }: { label: string; error: string | null }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
      <div className="mb-1 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-rose-600" aria-hidden="true" />
        <span className="text-[0.78rem] font-semibold text-rose-700">{label} unavailable</span>
      </div>
      <p className="text-[0.7rem] text-rose-600">
        /api/constituency did not respond{error ? ` (${error})` : ""}. Nothing is fabricated —
        the blueprint reference above remains the specification.
      </p>
    </div>
  );
}

/* ---------- Key-fact cell for the V4 status grid ---------- */
function FactCell({
  label,
  title,
  oneLine = false,
  children,
}: {
  label: string;
  title?: string;
  oneLine?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`min-w-0 rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-3 py-2 ${oneLine ? "overflow-hidden" : ""}`}
      title={title}
    >
      <div className="mb-1 text-[0.6rem] uppercase tracking-[0.2em] text-[#5B6E68]">{label}</div>
      <div
        className={`font-mono text-[0.64rem] leading-snug text-[#33544C] ${
          oneLine ? "truncate whitespace-nowrap" : "break-words"
        }`}
      >
        {children}
      </div>
    </div>
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
  // M8-3a machinery surfacing (Task M8-3c-b) + TASK-39 payload sections — the
  // QUIESCENT dynamic-membership engine state, the live scoring dossier, the
  // approval ledger and the V4 contract layer, all from /api/constituency
  // (read-only; no transition is ever run).
  const [machinery, setMachinery] = useState<ConstituencyMachineryDto | null>(null);
  const [machineryError, setMachineryError] = useState<string | null>(null);
  // TASK-39 polling: 60s client poll (the server caches the dossier for 10 min —
  // the poll shows advancing cacheAge + fresh leg witnesses at reasonable cost).
  // Last-good retention: a failed refresh keeps serving the previous snapshot,
  // flagged stale, instead of blanking the panels.
  const [machineryStale, setMachineryStale] = useState(false);
  const machineryMountedRef = useRef(true);

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

  // M8-3a machinery + TASK-39 dossier fetch — canonical polling pattern
  // (PilotCommandCenter): fetch on mount, setInterval POLL_MS with a
  // document.hidden skip, immediate refresh on visibilitychange→visible,
  // mounted-ref guard, last-good retention on failure.
  const fetchMachinery = useCallback(async () => {
    // PERF: skip polling while the tab is hidden — the dossier's server-side
    // cache keeps building, so data is never lost, just not re-fetched.
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const res = await fetch("/api/constituency", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const dto = (await res.json()) as ConstituencyMachineryDto;
      if (!machineryMountedRef.current) return;
      setMachinery(dto);
      setMachineryError(null);
      setMachineryStale(false);
    } catch (e) {
      if (machineryMountedRef.current) {
        setMachineryError(e instanceof Error ? e.message : String(e));
        setMachineryStale(true);
      }
    }
  }, []);

  useEffect(() => {
    machineryMountedRef.current = true;
    fetchMachinery();
    const id = setInterval(fetchMachinery, CONSTITUENCY_POLL_MS);
    // Refresh immediately when the tab becomes visible again (the dossier may
    // be up to POLL_MS × N stale after a hidden period).
    const onVisible = () => {
      if (!document.hidden) fetchMachinery();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      machineryMountedRef.current = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchMachinery]);

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
            <Landmark className="h-5 w-5 text-mtqs-gold mt-0.5 shrink-0" aria-hidden="true" />
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
                active basket only if <span className="font-mono text-mtqs-gold">Q_i ≥ Q_min</span>.
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
                <Scale className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
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
              <p className="text-[0.7rem] text-[#5B6E68] mt-3">
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
                <Scale className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
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
              <p className="text-[0.7rem] text-[#5B6E68] mt-3">
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

      {/* ============ TASK-39 — §4 live scoring dossier (the centerpiece) ============ */}
      <section
        id="constituency-scoring-live"
        aria-labelledby="constituency-scoring-live-h"
        className="scroll-mt-32"
      >
        <SectionHeading
          eyebrow="§4.2 · live dossier · task-39"
          title="Eligibility Scoring — LIVE"
          className="mb-0"
          right={
            machinery ? (
              <Pill tone={machineryStale ? "amber" : "emerald"}>
                <GlowDot color={machineryStale ? "amber" : "emerald"} size="h-1.5 w-1.5" />
                {machineryStale ? "last-good snapshot" : "live-fed · per-input statuses"}
              </Pill>
            ) : (
              <Pill tone="muted">loading dossier…</Pill>
            )
          }
        />
        <Reveal>
          <Panel className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
              <h3
                id="constituency-scoring-live-h"
                className="text-sm font-semibold text-[#0E1F1B]"
              >
                Live Q_i board — every input feed-statused, every leg multi-family witnessed
              </h3>
            </div>
            <p className="text-[0.72rem] text-[#5B6E68] leading-relaxed mb-4">
              The board below is computed by the TASK-39 live dossier: each of the nine inputs
              carries a per-feed provenance status, each index leg is witnessed by at least two
              independent source families, and the hard gates (L / QD / CV / JR / BA) are evaluated
              against the D-13.11 pilot-approved draft minima. Scores are TESTNET-PILOT shadow-mode
              measurements — no T2 confirmation is certifiable while the honest residuals below
              stand.
            </p>

            {machineryError && !machinery ? (
              <DossierUnavailable label="Scoring dossier" error={machineryError} />
            ) : !machinery ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-36 rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                {/* Header row — precondition chip + dossier freshness */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Pill
                    tone={machinery.scoringDossier.precondition.met ? "emerald" : "amber"}
                  >
                    <GlowDot
                      color={machinery.scoringDossier.precondition.met ? "emerald" : "amber"}
                      size="h-1.5 w-1.5"
                    />
                    ≥2-family precondition:{" "}
                    {machinery.scoringDossier.precondition.met ? "MET" : "UNMET"}{" "}
                    {machinery.scoringDossier.precondition.legsMet}/
                    {machinery.scoringDossier.precondition.legsTotal}
                  </Pill>
                  <Pill tone={machineryStale ? "amber" : "emerald"}>
                    <GlowDot color={machineryStale ? "amber" : "emerald"} size="h-1.5 w-1.5" />
                    built {fmtClock(machinery.scoringDossier.builtAt)} · cache{" "}
                    {machinery.scoringDossier.cacheAgeSec}s · {machineryStale ? "stale" : "live"}
                  </Pill>
                  <Pill tone="muted">
                    {machinery.scoringDossier.components.length} components ·{" "}
                    {machinery.scoringDossier.inputFeedMatrix.length} inputs · 5 hard gates
                  </Pill>
                </div>
                <p
                  className="text-[0.6rem] text-[#5B6E68] leading-relaxed mb-1"
                  title={machinery.scoringDossier.precondition.required}
                >
                  {machinery.scoringDossier.precondition.note}
                </p>
                <p className="text-[0.6rem] text-[#5B6E68] leading-relaxed mb-4">
                  {machinery.scoringDossier.parametersDigestNote}
                </p>

                {/* Last-good retention strip (stale while serving previous snapshot) */}
                {machineryStale && machineryError ? (
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                    <ShieldAlert
                      className="h-3.5 w-3.5 shrink-0 text-rose-600"
                      aria-hidden="true"
                    />
                    <span className="text-[0.66rem] leading-snug text-rose-600">
                      Last /api/constituency refresh failed ({machineryError}) — serving the
                      previously fetched dossier. Leg witnesses and feed statuses may be stale.
                    </span>
                  </div>
                ) : null}

                {/* The 7-component board */}
                <div className="space-y-2.5">
                  {machinery.scoringDossier.components.map((c) => (
                    <ScoringComponentRow key={c.id} c={c} />
                  ))}
                </div>

                {/* Calibration findings (honest flags — amber) */}
                {machinery.scoringDossier.findings.length > 0 ? (
                  <div className="mt-4 rounded-lg border border-mtqs-amber/25 bg-mtqs-amber/[0.06] p-4">
                    <h4 className="mb-2 text-[0.66rem] uppercase tracking-[0.18em] text-mtqs-amber">
                      Calibration findings
                    </h4>
                    <ul className="space-y-1.5">
                      {machinery.scoringDossier.findings.map((f, i) => (
                        <li key={i} className="text-[0.66rem] leading-relaxed text-amber-700">
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Honest residuals — always visible (honesty discipline) */}
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4">
                  <h4 className="mb-2 text-[0.66rem] uppercase tracking-[0.18em] text-rose-700">
                    Honest residuals
                  </h4>
                  <ul className="space-y-1.5">
                    {machinery.scoringDossier.residualLimits.map((r, i) => (
                      <li key={i} className="text-[0.66rem] leading-relaxed text-rose-600">
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Index-leg witness layer */}
                <div className="mt-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Globe2 className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
                    <h4 className="text-[0.78rem] font-semibold text-[#0E1F1B]">
                      Index-leg witness layer — ≥2 independent source families per leg
                    </h4>
                  </div>
                  <LegWitnessTable witnesses={machinery.scoringDossier.legWitnesses} />
                  <p className="mt-2 text-[0.6rem] text-[#5B6E68] leading-relaxed">
                    {machinery.scoringDossier.precondition.required} — met at the pilot&apos;s
                    off-chain witness layer; §17.10&apos;s three-family ON-CHAIN requirement
                    remains a separate, still-open production gate.
                  </p>
                </div>

                {/* Input feed matrix */}
                <div className="mt-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Database className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
                    <h4 className="text-[0.78rem] font-semibold text-[#0E1F1B]">
                      Input feed matrix — provenance &amp; tier
                    </h4>
                  </div>
                  <InputFeedMatrixTable matrix={machinery.scoringDossier.inputFeedMatrix} />
                </div>

                {/* Source reachability */}
                <div className="mt-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Globe2 className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
                    <h4 className="text-[0.78rem] font-semibold text-[#0E1F1B]">
                      Source reachability (last dossier build)
                    </h4>
                  </div>
                  <SourceReachabilityList sources={machinery.scoringDossier.sourceReachability} />
                </div>
              </>
            )}
          </Panel>
        </Reveal>
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
                <Database className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
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
                <Globe2 className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
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
              <p className="text-[0.68rem] text-[#5B6E68] leading-relaxed">
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
                          <span className="text-[0.6rem] uppercase tracking-[0.18em] text-[#5B6E68]">
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
                        <div className="flex justify-between mt-1 text-[0.6rem] font-mono text-[#5B6E68]">
                          <span>lower {(c.envelope.lower * 100).toFixed(0)}%</span>
                          <span>envelope ±{(band * 50).toFixed(1)}pp</span>
                          <span>upper {(c.envelope.upper * 100).toFixed(0)}%</span>
                        </div>
                        <p className="text-[0.62rem] text-[#5B6E68] mt-2 leading-relaxed">{c.note}</p>
                        <div className="mt-2 pt-2 border-t border-[#E3EAE6] flex items-center justify-between">
                          <span className="text-[0.6rem] uppercase tracking-wider text-[#5B6E68]">
                            live USD quote
                          </span>
                          <span className="font-mono text-[0.66rem] text-[#5B6E68]">
                            {quote != null ? `$${quote.toFixed(4)}` : "—"}
                          </span>
                        </div>
                        <div className="text-[0.625rem] text-[#5B6E68] mt-0.5 font-mono">
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
                      <span className="text-[0.6rem] font-mono text-[#5B6E68]">
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
                                    <MiniBar value={w} max={ENVELOPE_BAR_MAX} colorClass="bg-mtqs-gold/60" />
                                  ) : (
                                    <span className="text-[#5B6E68]">—</span>
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
                    <p className="text-[0.7rem] text-[#5B6E68]">
                      Live weights unavailable from the engine (genesis state) — shown as &ldquo;—&rdquo;.
                      The strategic prior (§3.2) is published on the Reference tab.
                    </p>
                  )}
                  <p className="text-[0.6rem] text-[#5B6E68] mt-2">
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
                <RefreshCw className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
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
                <Shuffle className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
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
            <p className="text-[0.7rem] text-[#5B6E68] mt-3">
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
            <Pill tone={machineryStale ? "rose" : "amber"}>
              <GlowDot color={machineryStale ? "rose" : "amber"} size="h-1.5 w-1.5" />
              IMPLEMENTED · QUIESCENT{machineryStale ? " · STALE" : ""}
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
              <code className="font-mono text-[0.7rem] text-mtqs-gold">src/lib/mtq/constituency/</code>: a
              Map-keyed component registry (stable string IDs, never recycled), the T1–T9 lifecycle machinery with
              evidence-checked governance directives, and the glide/weight pipeline. The machinery replaces the
              “constituency is static” design gap — membership can grow and shrink at runtime — while the ACTIVE
              basket remains byte-identical to the fixed 7-component engine until a governed directive fires.
            </p>

            {/* Module banner — rendered verbatim from the API (TASK-39: the
                parameters clause is now PILOT-APPROVED, owner directive 2026-11-03) */}
            {machinery ? (
              <div className="rounded-lg border border-mtqs-amber/25 bg-mtqs-amber/[0.06] px-4 py-2.5 mb-4 text-center">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] leading-relaxed text-mtqs-amber">
                  {machinery.banner}
                </p>
              </div>
            ) : null}

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

            {machineryError && !machinery ? (
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
                  <Database className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
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
                      <span className="text-[#5B6E68] font-normal"> · {e.id}</span>
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
                <p className="text-[0.62rem] text-[#5B6E68] mt-2 leading-relaxed">
                  Dossier: {machinery.genesisRegistry.dossierRef}. Registry IDs and stable string IDs are never
                  recycled or reused; registration of any non-genesis component requires a provenance dossier
                  reference (spec §3 T1 evidence row). No GPP_LEG record is registered today.
                </p>

                {/* Lifecycle legend */}
                <div className="mt-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <RefreshCw className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
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
                            <span className="text-[#5B6E68] text-[0.6rem]" aria-hidden="true">
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
                    <Shuffle className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
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
                  <p className="text-[0.62rem] text-[#5B6E68] mt-2 leading-relaxed">
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

                {/* Honest limits — TASK-39 wording rendered verbatim from the API
                    (live feeds implemented · parameters PILOT-APPROVED · V4
                    contract layer implemented at source, undeployed) */}
                <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      <h4 className="text-[0.76rem] font-semibold text-rose-700 mb-1">Honest limits of this machinery</h4>
                      <p className="text-[0.7rem] text-rose-600 leading-relaxed">
                        {machinery.honestLimits.line}
                      </p>
                      <p className="text-[0.64rem] text-[#5B6E68] mt-2 leading-relaxed">
                        {machinery.honestLimits.parameterClass}
                      </p>
                      <p className="text-[0.64rem] text-[#5B6E68] mt-2 leading-relaxed">
                        <span className="font-semibold text-[#5B6E68]">Scoring feeds:</span>{" "}
                        {machinery.honestLimits.scoringFeedDisclosure}
                      </p>
                      <p className="text-[0.64rem] text-[#5B6E68] mt-2 leading-relaxed">
                        <span className="font-semibold text-[#5B6E68]">Contract layer:</span>{" "}
                        {machinery.honestLimits.contractLayer}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </Panel>
        </Reveal>
      </section>

      {/* ============ TASK-39 — §13 parameter approval ledger ============ */}
      <section
        id="constituency-approvals"
        aria-labelledby="constituency-approvals-h"
        className="scroll-mt-32"
      >
        <SectionHeading
          eyebrow="§13 · parameter registry · task-39"
          title="Parameter Approvals — D-13.11 / D-13.14"
          className="mb-0"
          right={
            machinery ? (
              <Pill tone={machinery.approvals.summary.allPilotApproved ? "emerald" : "amber"}>
                <GlowDot
                  color={machinery.approvals.summary.allPilotApproved ? "emerald" : "amber"}
                  size="h-1.5 w-1.5"
                />
                {machinery.approvals.summary.allPilotApproved ? "ALL PILOT-APPROVED" : "LEDGER INCOMPLETE"}
              </Pill>
            ) : (
              <Pill tone="muted">loading ledger…</Pill>
            )
          }
        />
        <Reveal>
          <Panel className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Stamp className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
              <h3 id="constituency-approvals-h" className="text-sm font-semibold text-[#0E1F1B]">
                Owner-directive approval ledger — TESTNET-PILOT scope only
              </h3>
            </div>
            <p className="text-[0.72rem] text-[#5B6E68] leading-relaxed mb-4">
              The §13 lifecycle parameters exercised by the machinery and the scoring dossier above
              are no longer unapproved drafts: two owner directives (2026-11-03) approve them for
              TESTNET-PILOT shadow operation, each recorded with the verbatim directive text, a
              parameter digest binding the approval to the exact canonical parameter block, and the
              residual opens that stay with Gate-C. This ledger never records production
              ratification.
            </p>

            {machineryError && !machinery ? (
              <DossierUnavailable label="Approval ledger" error={machineryError} />
            ) : !machinery ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-44 rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                {/* Summary chips — Gate-C production is always amber, never green */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Pill tone="emerald">
                    <GlowDot color="emerald" size="h-1.5 w-1.5" />
                    PILOT-APPROVED
                  </Pill>
                  <span
                    className="inline-flex"
                    title={machinery.approvals.summary.digest}
                  >
                    <Pill
                      tone={machinery.approvals.summary.digestValid ? "gold" : "rose"}
                      className="font-mono"
                    >
                      digest {machinery.approvals.summary.digest.slice(0, 12)}…
                      <span className="sr-only">
                        {" "}
                        {machinery.approvals.summary.digestValid ? "valid" : "INVALID"}
                      </span>
                    </Pill>
                  </span>
                  <Pill tone="muted">ledger {machinery.approvals.summary.ledgerCount}</Pill>
                  <Pill tone="amber">Gate-C production: {machinery.approvals.summary.productionGateC}</Pill>
                </div>
                <p className="text-[0.64rem] text-[#5B6E68] leading-relaxed mb-4">
                  {machinery.approvals.summary.note}
                </p>

                <div className="space-y-3">
                  {machinery.approvals.ledger.map((e) => (
                    <ApprovalCard key={e.decisionId} entry={e} />
                  ))}
                </div>

                {/* TASK-42 — D-13.11 calibration decision support (client-side
                    what-if over published constants; engine gates untouched) */}
                {machinery.scoringDossier?.components?.length ? (
                  <div className="mt-4">
                    <CalibrationExplorer components={machinery.scoringDossier.components} />
                  </div>
                ) : null}
              </>
            )}
          </Panel>
        </Reveal>
      </section>

      {/* ============ TASK-39 — MTQSigmaV4 contract layer + shadow demonstration ============ */}
      <section
        id="constituency-contract-v4"
        aria-labelledby="constituency-contract-v4-h"
        className="scroll-mt-32"
      >
        <SectionHeading
          eyebrow="task-13 · v4 · dynamic membership"
          title="Contract Layer — MTQSigmaV4"
          className="mb-0"
          right={
            machinery ? (
              <Pill tone="amber">
                <GlowDot color="amber" size="h-1.5 w-1.5" />
                IMPLEMENTED (source) · UNDEPLOYED
              </Pill>
            ) : (
              <Pill tone="muted">loading…</Pill>
            )
          }
        />
        <Reveal>
          <Panel className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <FileCode2 className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
              <h3 id="constituency-contract-v4-h" className="text-sm font-semibold text-[#0E1F1B]">
                Registry-based dynamic membership — compiled, deterministic, Gate-C-gated
              </h3>
            </div>

            {machineryError && !machinery ? (
              <DossierUnavailable label="Contract-layer status" error={machineryError} />
            ) : !machinery ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-md" />
                ))}
              </div>
            ) : (
              <>
                <p className="text-[0.72rem] text-[#5B6E68] leading-relaxed mb-4">
                  {machinery.contractLayerV4.status.name} — the V4 contract closes the V2/V3
                  STATIC-layer findings at the source level and compiles deterministically, but it
                  is UNDEPLOYED: testnet deployment is Gate-C / Task-12-gated, and the deployed
                  v1.2 pilot estate is a different economic family and stays untouched. The shadow
                  demonstration below exercises the V4 semantics through the TS reference
                  validator.
                </p>

                {/* Key facts grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
                  <FactCell
                    label="Source"
                    title={machinery.contractLayerV4.status.compileArtifact}
                  >
                    {machinery.contractLayerV4.status.sourcePath}
                  </FactCell>
                  <FactCell label="Compiler">
                    {machinery.contractLayerV4.status.compiler}
                  </FactCell>
                  <FactCell label="Compile settings">
                    {machinery.contractLayerV4.status.compileSettings}
                  </FactCell>
                  <FactCell label="Deployed bytecode">
                    <span className="tabular-nums">
                      {machinery.contractLayerV4.status.deployedBytecodeBytes.toLocaleString("en-US")} B
                    </span>
                  </FactCell>
                  <FactCell label="EIP-170 verdict">
                    <span className="text-mtqs-emerald">
                      {machinery.contractLayerV4.status.eip170}
                    </span>
                  </FactCell>
                  <FactCell
                    label="Design plan"
                    title={machinery.contractLayerV4.status.designPlanPath}
                  >
                    {machinery.contractLayerV4.status.designPlanStatus}
                  </FactCell>
                  <FactCell label="Deterministic repro">
                    {machinery.contractLayerV4.status.deterministicRepro}
                  </FactCell>
                  <FactCell label="Deployment posture">
                    <span className="text-mtqs-amber">
                      {machinery.contractLayerV4.status.deploymentPosture}
                    </span>
                  </FactCell>
                  <FactCell
                    label="Reproduction command"
                    title={machinery.contractLayerV4.status.reproductionCommand}
                    oneLine
                  >
                    {machinery.contractLayerV4.status.reproductionCommand}
                  </FactCell>
                </div>

                {/* STATIC-layer findings closed at source */}
                <div className="rounded-lg border border-mtqs-emerald/25 bg-mtqs-emerald/[0.05] p-3.5 mb-2">
                  <p className="text-[0.66rem] leading-relaxed text-[#33544C]">
                    <span className="font-semibold text-mtqs-emerald">
                      STATIC-layer findings closed at source:{" "}
                    </span>
                    {machinery.contractLayerV4.status.staticLayerClosed}
                  </p>
                </div>

                {/* Shadow demonstration — 4 cases */}
                <div className="mt-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Scale className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
                    <h4 className="text-[0.78rem] font-semibold text-[#0E1F1B]">
                      Shadow-mode demonstration — V4 semantics, reference validator
                    </h4>
                    <Pill
                      tone={machinery.contractLayerV4.shadowDemonstration.allVerified ? "emerald" : "rose"}
                    >
                      {machinery.contractLayerV4.shadowDemonstration.allVerified
                        ? `${machinery.contractLayerV4.shadowDemonstration.cases.length}/${machinery.contractLayerV4.shadowDemonstration.cases.length} verified`
                        : "verification mismatch"}
                    </Pill>
                  </div>
                  <p className="text-[0.66rem] text-[#5B6E68] leading-relaxed mb-3">
                    {machinery.contractLayerV4.shadowDemonstration.summary}
                  </p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {machinery.contractLayerV4.shadowDemonstration.cases.map((c) => (
                      <ShadowCaseCard key={c.caseId} c={c} />
                    ))}
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
