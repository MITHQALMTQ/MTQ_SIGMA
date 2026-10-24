// MTQΣ — Architecture Section (Blueprint v2.0 · Chapter 26 + Appendices A–E)
//
// Final Declarations & Architecture Summary:
//   §26.1  The final declaration (11 restated bullets + bold close)
//   §26.2  Four weight states (W^Prior ≠ W^Target ≠ W^Smooth ≠ W^Execution)
//   §26.3.2 Two-engine hierarchy (COO-approved) — native visual, not a <pre> blob
//   App C  Worked examples C.1–C.5 (scenario / math / outcome)
//   §26.6  Locked concepts vs must-be-quantitatively-validated
//   App B  Deployment checklist Phases 0–5 (reference sequence)
//   App A  Glossary — ~24 load-bearing symbols & terms
//   App E  Source lineage map + §1.8 consolidation order + §1.7 status declaration
//
// All content is STATIC and faithful to the blueprint v2.0 extraction; no
// fabricated live data. The only dynamic input is the pilot snapshot, used
// in one clearly-labelled live cross-reference with "—" fallback.
//
// Props: { onNavigate, snapshot }.

"use client";

import { ArrowDown, ArrowRight, Lock, FlaskConical, ListChecks, BookMarked, GitBranch } from "lucide-react";
import { Panel, Reveal, Pill, GlowDot, SectionHeading } from "@/components/mtq/primitives";
import { MONAD_TESTNET } from "@/lib/mtq/contracts";
import type { SectionId } from "@/components/mtq/Navigation";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

/* ============================================================
   §26.1 — The final declaration (faithful restatement, Ch refs)
   ============================================================ */
const DECLARATION_POINTS: { text: string; ref: string }[] = [
  { text: "The adaptive reference index — a methodology-defined, chain-linked basket of eligible currencies and gold — defines the reference value.", ref: "Ch 3 · Ch 9" },
  { text: "The Reserve NAV collateralizes the token.", ref: "Ch 14" },
  { text: "Minting is priced against the reference index, breaking the 1:1 USD peg.", ref: "Ch 19" },
  { text: "Redemption is priced against NAV and releases the full proportional basket.", ref: "Ch 19" },
  { text: "The weighting layer (MASE) computes live targets through a constrained, robust, multi-model ensemble.", ref: "Ch 5–7" },
  { text: "The execution layer (MARP) uses dynamic cost-benefit optimization with liquidity-aware sizing.", ref: "Ch 10–11" },
  { text: "The Buffer has three distinct layers (BASE, STRESS, EMERGENCY) with smooth ramping.", ref: "Ch 16" },
  { text: "The Oracle Architecture uses three independent sources with timestamp, confidence and deviation checks.", ref: "Ch 17" },
  { text: "The Geopolitical Eject system uses staged liquidation (10% → 25% → 50% → 100%) with a reintegration score.", ref: "Ch 21" },
  { text: "The Risk State Machine has six states (NORMAL, CAUTION, STRESS, DEFENSIVE, EMERGENCY, RECOVERY) with deterministic transitions.", ref: "Ch 18" },
  { text: "All 76 points of the independent monetary audit have been reconciled in the v1.2 lineage, and the v2.0 modification program closes the architectural gaps identified in the COO review.", ref: "§26.6.3" },
];

/* §26.8.2 — Final honest status declaration (testnet edition) */
const HONEST_STATUS_ROWS: { aspect: string; status: string }[] = [
  { aspect: "Production-Ready?", status: "NO — deployed only on testnet (Arc, Monad, Solana Devnet; Appendix D)" },
  { aspect: "Oracles", status: "MOCKED — all price feeds are simulated for testnet" },
  { aspect: "Assets", status: "MOCKED — all ERC-20 assets are testnet mocks (except native USDC on Arc)" },
  { aspect: "Live Weights (v2.0)", status: "VALIDATION-STAGE — genesis snapshot equals the strategic prior; all subsequent targets are research outputs" },
  { aspect: "Mainnet Deployment", status: "NOT PLANNED — pending the 11 validation gates (§25.5)" },
];

/* ============================================================
   §26.2 — Four weight states
   ============================================================ */
const FOUR_STATES: { key: string; sup: string; name: string; def: string }[] = [
  { key: "Prior", sup: "Prior", name: "Strategic Prior", def: "Long-term starting preference — a soft stabilizing anchor, never a target to be hit." },
  { key: "Target", sup: "Target", name: "Target", def: "Current mathematical optimum, before constitutional constraints are applied." },
  { key: "Smooth", sup: "Smooth", name: "Smoothed", def: "Risk-controlled transition toward the constrained target, paced by the stress-adaptive smoothing rule." },
  { key: "Execution", sup: "Execution", name: "Execution", def: "Actual trade decision after cost, liquidity and reserve testing by MARP." },
];

/* §26.3.2 — hierarchy node labels (Reference Index branch) */
const REFERENCE_BRANCH: { label: string; chips?: string[] }[] = [
  { label: "Constituency Engine" },
  { label: "Eligible Universe" },
  { label: "MASE", chips: ["Institutional", "Stability", "Purchasing Power"] },
  { label: "Robust Ensemble" },
  { label: "Constraint Projection" },
  { label: "Dynamic Bounds" },
  { label: "Smoothing" },
  { label: "Daily Target" },
];

/* ============================================================
   Appendix C — Worked examples (faithful numbers)
   ============================================================ */
const WORKED_EXAMPLES: { id: string; title: string; tag: string; scenario: string; math: string[]; outcome: string }[] = [
  {
    id: "C.1",
    title: "Normal Operating Day (No-Trade Zone)",
    tag: "no-trade zone",
    scenario: "MASE completes its daily calculation and posts a USD target of 28.2%, while the actual USD weight in the basket is 28.5%. Calm regime; the USD no-trade zone half-width is θ_USD = 1.0%.",
    math: [
      "D = |W_USD^Target − W_USD^Actual| = |28.2% − 28.5%| = 0.3%",
      "D = 0.3% < θ_USD = 1.0%  ⇒  Trade = 0",
    ],
    outcome:
      "No trade is executed. The deviation is recorded in the decision log with the trigger evaluation and the null trade; the actual weight carries forward. Daily calculation does not mean daily trading (I11).",
  },
  {
    id: "C.2",
    title: "Moderate Deviation (Partial Rebalancing)",
    tag: "partial rebalance",
    scenario: "MASE posts a gold target of 27.0% while the actual gold weight has drifted to 29.4% (gold appreciated against the currency components). θ_Gold = 2.0%; partial-rebalance coefficient β = 0.40.",
    math: [
      "D = |27.0% − 29.4%| = 2.4% > θ_Gold = 2.0%  ⇒  trigger",
      "Trade = β·(W^Target − W^Actual) = 0.40 × (27.0% − 29.4%) = −0.96pp sold from gold",
      "Post-trade actual = 28.44% → residual deviation 1.44% (back inside the band)",
    ],
    outcome:
      "Only a fraction of the deviation is corrected per trigger. If the deviation persists, consecutive daily triggers walk the basket toward the target in ~40% steps, each sized to remain liquidity-friendly.",
  },
  {
    id: "C.3",
    title: "Natural-Flow Rebalancing",
    tag: "natural flow",
    scenario: "A currency component is underweight and requires +1.5% of portfolio allocation. Before any external trade, the natural-flow test finds incoming mints and redemptions that can be directed into the component, contributing +0.9%.",
    math: ["TradeNeeded = 1.5% − 0.9% = 0.6% external"],
    outcome:
      "Only 0.6% requires external execution. Directed flows do the rebalancing work at zero marginal execution cost; the residual then passes through the same cost-benefit gate as Example C.4.",
  },
  {
    id: "C.4",
    title: "Cost-Gate Rejection",
    tag: "gate rejects",
    scenario: "A component is technically outside its preferred target, so a trade is eligible by the no-trade-zone test. The estimated benefit of the correction is B = 0.12% of portfolio value; the expected execution cost is C = 0.17%.",
    math: ["B − C = 0.12% − 0.17% = −0.05% < 0  ⇒  Trade = 0"],
    outcome:
      "The net value of the trade is negative, so the system refuses the value-destructive correction and carries the deviation, re-testing daily. Overrides are deliberate: a risk trigger can justify a solvency-protecting trade on risk grounds, and the emergency path supersedes normal gating entirely.",
  },
  {
    id: "C.5",
    title: "Gold Adaptive Shift",
    tag: "adaptive shift",
    scenario: "The strategic prior for gold is W_Gold^Prior = 26%. On a given review MASE calculates a gold target of 29.2% — purchasing-power protection improved, diversification improved, crisis probability increased, and the marginal risk contribution of the additional gold remained acceptable.",
    math: [
      "W_Gold^Target = 29.2% ≠ W_Gold^Prior = 26%",
      "Gold admissibility envelope 20–32% (§8.1): 29.2% is admissible",
      "The StrategicDrift penalty (§7.1) already priced the 3.2-point departure inside the objective",
    ],
    outcome:
      "The live target becomes 29.2%, not 26%. The executed path then runs through smoothing (§8.4) and the MARP gates of C.1–C.4 — fixed methodology, adaptive composition (§26.5.2).",
  },
];

/* ============================================================
   §26.6 — Locked concepts (33) vs not locked (14) — carried in full
   ============================================================ */
const LOCKED_CONCEPTS: string[] = [
  "MTQΣ is the project identity.",
  "Gold is an explicit reference-basket component.",
  "Gold is not merely a weighting multiplier.",
  "Gold reference allocation and gold reserve allocation are separate.",
  "Currency selection and currency weighting are separate.",
  "USD/EUR/JPY/GBP/CNY/CHF are the initial core candidate universe.",
  "CAD/AUD/SGD and other currencies remain eligible candidates.",
  "Strategic percentages are priors, not fixed live weights.",
  "MASE is the adaptive weighting engine.",
  "Multiple optimizers are combined.",
  "Robust covariance is used.",
  "CVaR is included.",
  "Purchasing-power stability is included.",
  "Regime analysis is included.",
  "Hard constraints exist.",
  "Strategic priors are soft anchors.",
  "Turnover is penalized.",
  "Rebalancing is cost-aware.",
  "Daily calculation does not mean daily trading.",
  "No-trade zones are used.",
  "Bands can adapt.",
  "Partial rebalancing is preferred.",
  "Natural cash flow is preferred.",
  "Reserve and index management are separate.",
  "Multi-source gold valuation is required.",
  "Tokenized gold is an eligible instrument, not the definition of gold.",
  "No artificial price support.",
  "No discretionary buybacks.",
  "Crisis controls protect system integrity rather than market price.",
  "Backtests must be rebuilt for MTQΣ.",
  "Walk-forward and out-of-sample validation are mandatory.",
  "Model robustness matters more than maximum historical return.",
  "Every live weight must be reproducible from published data and rules.",
];

const NOT_LOCKED: string[] = [
  "Exact final currency weights.",
  "Exact final gold weight.",
  "Exact gold corridor.",
  "Exact currency corridors.",
  "Exact MASE model coefficients.",
  "Exact ensemble coefficients.",
  "Exact no-trade thresholds.",
  "Exact smoothing factor.",
  "Exact partial-rebalance coefficient.",
  "Exact turnover penalty.",
  "Exact crisis thresholds.",
  "Exact reserve gold allocation.",
  "Exact reserve liquidity buffer.",
  "Exact review frequency where data quality suggests an alternative.",
];

/* ============================================================
   Appendix B — Deployment checklist (reference sequence)
   ============================================================ */
const DEPLOYMENT_PHASES: { phase: string; title: string; items: string[]; note?: string }[] = [
  {
    phase: "Phase 0",
    title: "Environment & Prerequisites",
    items: [
      "Foundry installed (forge / cast); RPC endpoints configured for Arc, Monad and Solana Devnet (Appendix D).",
      "Deployer key secured; the onlyDeployer modifier protects the genesis function.",
      "Governance modifiers (onlyConstitutionalCouncil, onlyMultiSig) implemented via the governance contracts of Chapter 22.",
      "Mock ERC-20 assets and mock oracle feeds prepared (Appendix D.3); native USDC on Arc identified.",
      "Genesis deposit funded in testnet assets (Chapter 20); sweep threshold configured.",
      "The honest-status contract (Listing 15) compiled and ready to deploy alongside the core contracts.",
    ],
  },
  {
    phase: "Phase 1",
    title: "Roles & Addresses",
    items: [
      "dao — monetary-parameter authority (Chapter 22).",
      "riskCouncil — 4/7 Multi-Sig; approves MASE submitters and risk parameters.",
      "emergencyCouncil — 4/7 Multi-Sig; emergency controls.",
      "constitutionalCouncil — 7/7 Multi-Sig; envelopes, gates and constitutional changes.",
      "genesisReserveAddress = the recorded (reported 4/7) Safe on Arc and Monad testnet.",
      "coldTreasury = same as the Genesis Reserve on testnet; a separate address on mainnet.",
      "keeper = deployer or a dedicated bot address (MASE submission, sweeps).",
    ],
    note: "On Solana Devnet the EVM-style genesis reserve address is not applicable; use the chain-native equivalent mechanism and record it in the deployment documentation.",
  },
  {
    phase: "Phase 2",
    title: "Oracle Configuration",
    items: [
      "Deploy the OracleFeed mapping with Chainlink, Pyth and Chronicle addresses per asset pair (EUR/USD, GBP/USD, JPY/USD, CNY/USD (CNH), PAXG, VIX, DXY).",
      "stalenessThreshold = 60 seconds; confidence bound < 1%; deviation bound < 2.5% (invariant I9).",
      "Set minPrice / maxPrice sanity bounds per feed.",
      "Enable the canonical gold price quorum of independent sources (Chapter 17).",
      "On devnet, point every feed at its mock oracle and verify the heartbeat.",
    ],
  },
  {
    phase: "Phase 3",
    title: "Contract Deployment & Genesis",
    items: [
      "Ensure verifyGFBBase() is included in the reference-index contract.",
      "Call genesis() with the genesis deposit; confirm the initial supply is minted to the Genesis Reserve and circulating supply is zero (Chapter 20).",
      "Call _emitGenesisVerification() at the end of genesis() — mandatory on testnets so the event is present in the logs (Appendix D.2).",
      "After deployment, call verifyGFBBase() to confirm the denominator is consistent with the hard-coded base fixings.",
      "Record the emitted GenesisVerification event in the deployment documentation for the audit trail.",
      "Confirm the treasury sweep threshold ($10,000) and the Cold Treasury destination (Chapter 20).",
    ],
  },
  {
    phase: "Phase 4",
    title: "Weight Registry Initialization",
    items: [
      "Set live weights to the strategic prior: [0.27, 0.20, 0.09, 0.08, 0.05, 0.05, 0.26] × 1e18, summing to exactly 1e18.",
      "methodologyVersion = keccak256 of the v2.0 methodology document hash; dataVersion = hash of the genesis data snapshot.",
      "Load the admissibility envelopes LOWER_BOUND / UPPER_BOUND and the velocity limits MAX_VELOCITY as validation-stage values (§8.1, §8.3).",
      "Confirm setEnvelopes() is guarded by onlyConstitutionalCouncil with the 90-day timelock.",
      "Approve the MASE submitter address via the Risk Council; record the approval.",
    ],
  },
  {
    phase: "Phase 5",
    title: "Post-Deployment Verification",
    items: [
      "Confirm getHonestStatus() returns the adaptive-methodology status string (Listing 15).",
      "Confirm isProductionAuthorized() returns false and all gates read as not passed.",
      "Record all deployment events (GenesisVerification, WeightsAccepted or initialization, gate state) in the deployment documentation and publish via the Chapter 24 layer.",
    ],
    note: "isProductionAuthorized() must return false on every testnet deployment.",
  },
];

/* ============================================================
   Appendix A — Glossary (~24 load-bearing entries)
   ============================================================ */
const GLOSSARY: { term: string; def: string }[] = [
  { term: "PAR", def: "The unit of account for MTQΣ; PAR = 1.00 basket-unit, immutable (§2.5)." },
  { term: "W_t", def: "Live weight vector of the reference basket at time t; produced by the full MASE/MARP pipeline and published daily (Ch 24)." },
  { term: "W^Prior", def: "Strategic prior vector (USD 27 · EUR 20 · JPY 9 · GBP 8 · CNY 5 · CHF 5 · Gold 26 %); a soft anchor, deviation-penalized (§3.2)." },
  { term: "W^Target", def: "Current mathematical optimum before constitutional constraints are applied (Ch 7)." },
  { term: "W^Smooth", def: "Risk-controlled transition toward the constrained target, paced by stress-adaptive smoothing (§8.4)." },
  { term: "W^Execution", def: "Actual trade decision after cost, liquidity and reserve testing by MARP (Ch 10–11)." },
  { term: "I_t (GFB reference index)", def: "USD value of the chain-linked reference index; normalized to 1.00 at genesis (Ch 9)." },
  { term: "P_MTQ,t", def: "Mint price of MTQΣ against the adaptive index: MTQ_minted = X_net / P_MTQ,t (Ch 19)." },
  { term: "NAV_t", def: "Net asset value of the reserve — V_net,t = Σ_j Q_j · P_j · (1 − H_j), net of haircuts; collateralizes the token (Ch 14)." },
  { term: "RR_t", def: "Reserve ratio V_net,t / L_t; target 1.10, stress floor 1.05, hard floor 1.00." },
  { term: "LCR_t", def: "Liquidity coverage ratio: liquid assets over stress-redemption demand; target ≥ 1.00 (Ch 13)." },
  { term: "Q_i", def: "Composite currency eligibility score of the Constituency Engine (six positive, two negative components) (§4.2)." },
  { term: "θ_i,t", def: "No-trade zone half-width (band) for component i — the primary anti-churn mechanism (Ch 10)." },
  { term: "β", def: "Partial-rebalance coefficient: executed size = β · (target − actual); C.2 uses β = 0.40 (Ch 10)." },
  { term: "ρ_t", def: "Stress-adaptive smoothing factor: W^Smooth = ρ_t·W_{t−1} + (1 − ρ_t)·W^Constrained (§8.4)." },
  { term: "α_m / η", def: "Adaptive ensemble coefficient of candidate model m (softmax over performance-stability scores), bounded by softmax temperature η (§7.6)." },
  { term: "MASE", def: "Layer 2 adaptive weighting engine (the stability engine): computes how much weight each eligible component receives (Ch 5–7)." },
  { term: "MARP", def: "Layer 3 execution engine: decides when, whether and how rebalancing trades execute — cost-aware, risk-aware, liquidity-aware (Ch 10–11)." },
  { term: "COFER", def: "IMF Currency Composition of Official Foreign Exchange Reserves; the primary reserve-relevance input (§4.3.1)." },
  { term: "BIS", def: "Bank for International Settlements; its Triennial Survey supplies FX turnover shares (§4.3.2)." },
  { term: "Hysteresis", def: "Entry/exit threshold dead band (Q_entry > Q_exit) that prevents constituency oscillation (§4.7)." },
  { term: "Embargo", def: "Leakage control (§23.4): deletes a block of training observations immediately after the test window; h_embargo ≥ the longest autocorrelation (default 30-day horizon)." },
  { term: "Divisor / chain-link (G_t)", def: "Cumulative chain-link normalization factor that splices index history across weight or universe revisions; base fixings never change (Ch 9)." },
  { term: "Dynamic buffer", def: "Three layers — BASE (62.5% gold), STRESS (85%), EMERGENCY (100%) — with 24-hour ramping and a first-loss waterfall (Ch 16)." },
  { term: "Eject ladder", def: "Staged liquidation 10% → 25% → 50% → 100% minimizing market impact; re-admission requires reintegration score R ≥ 0.80 (Ch 21)." },
];

/* ============================================================
   Appendix E — Source lineage map
   ============================================================ */
const LINEAGE_ROWS: { section: string; source: string; content: string }[] = [
  { section: "Ch 1–2", source: "BP §1; MS §1–3, §90, §97; COO-1", content: "Introduction, document control, core variables, constitutional separation, three-layer architecture, four-state distinction, invariants, weight registry (Listing 1)." },
  { section: "Ch 3–4", source: "MS §2–11, §44–45; BP §2.1", content: "Adaptive reference basket, strategic prior, gold as first-class component, genesis weights; Constituency Engine, eligibility scoring, COFER/BIS inputs, transitions, hysteresis." },
  { section: "Ch 5–7", source: "MS §12–30; BP §6; COO-3…COO-13", content: "MASE input signals, regime detection, covariance and risk models, candidate optimizers, composite objective, ensemble architecture, MASE registry (Listing 2)." },
  { section: "Ch 8", source: "MS §31–34; COO-12", content: "Robust constraints, admissibility envelopes, velocity limits, adaptive bands, stress-adaptive smoothing." },
  { section: "Ch 9", source: "MS §73–78; BP §2–3.3; COO-16…COO-18", content: "Index valuation, chain-linking, price and liability computation." },
  { section: "Ch 10", source: "MS §35–43, §66–67; COO-14…COO-15", content: "Rebalancing philosophy, no-trade zones, partial rebalancing, natural-flow preference." },
  { section: "Ch 11", source: "BP §7; MS", content: "MARP execution engine, cost-benefit objective, direction lock, execution contract." },
  { section: "Ch 12", source: "BP §10; MS §65", content: "Execution and slippage bounds." },
  { section: "Ch 13", source: "MS §46–52, §61; BP §4.3; COO-19", content: "Reserve architecture: coverage, liquidity, custody, gold reserve allocation." },
  { section: "Ch 14", source: "MS §58–63; BP §4", content: "Reserve NAV, haircuts, reserve ratio, liquidity coverage ratio." },
  { section: "Ch 15", source: "BP §5; MS §62–63", content: "Asset Admission Registry: eligibility criteria and asset states." },
  { section: "Ch 16", source: "BP §8", content: "Dynamic buffer, three layers, ramping, first-loss waterfall." },
  { section: "Ch 17", source: "MS §53–56; BP §9; COO-20", content: "Oracle architecture, multi-source validation, canonical gold price." },
  { section: "Ch 18", source: "MS §64; BP §3", content: "Risk state machine and deterministic transitions." },
  { section: "Ch 19", source: "BP §12", content: "Minting and redemption pricing." },
  { section: "Ch 20", source: "BP §13", content: "Genesis event, accounting, treasury sweep." },
  { section: "Ch 21", source: "BP §11, §14.1–14.3", content: "Geopolitical eject, staged liquidation, reintegration score." },
  { section: "Ch 22", source: "MS §90–91; BP §14.4–14.5", content: "Governance separation, four-layer councils, parameter registry." },
  { section: "Ch 23", source: "MS §79–89; COO-21…COO-25", content: "Validation and research program: backtests, walk-forward, perturbation, robustness." },
  { section: "Ch 24", source: "MS §92–96; COO-26", content: "Deterministic reproducibility, data versioning, weight publication, decision log, final live-weight equation." },
  { section: "Ch 25", source: "BP §15", content: "Claims and honest status: supported/unsupported claims, status table, validation gates, messaging guide, Listing 15." },
  { section: "Ch 26", source: "MS §97–103; BP §16; COO-27/28", content: "Final declaration, four-state restatement, conceptual flows, strategic basket statement, COO-approved principles, locked/not-locked status, one-sentence definition, specification summary, source of truth." },
  { section: "App A", source: "Compiled", content: "Glossary of symbols and terms from all chapters." },
  { section: "App B", source: "BP §13.7.4, §2.6.4", content: "Developer deployment checklist: roles, oracles, genesis, weight registry, verification." },
  { section: "App C", source: "MS §68–72", content: "Five worked examples: no-trade, partial rebalance, natural flow, cost-gate, gold adaptive shift." },
  { section: "App D", source: "BP §2.6.3, §9.5, §15.7, §16.4", content: "Testnet chains, manual genesis verification, mocks, oracle addresses, honest status, verification sequence." },
  { section: "App E", source: "Compiled", content: "This lineage map." },
];

/* §1.8 — Binding consolidation order (faithful summary) */
const CONSOLIDATION_ORDER: string[] = [
  "Applicable law and binding regulatory requirements.",
  "Explicit, documented governance decisions and approved risk limits.",
  "The approved MTQΣ monetary-reference and reserve-governance specification.",
  "The corrected implementation semantics in the 2026-10-19 mandate and Extensions 1–3.",
  "Earlier drafts and implementation notes.",
  "Existing deployed code — last when it conflicts with an approved requirement.",
];

/* ============================================================
   Small presentational helpers (local to this section)
   ============================================================ */

/** One node in the §26.3.2 hierarchy flow. */
function FlowNode({
  label,
  chips,
  tone = "default",
  className = "",
}: {
  label: string;
  chips?: string[];
  tone?: "default" | "gold";
  className?: string;
}) {
  const cls =
    tone === "gold"
      ? "border-mtqs-gold/45 bg-mtqs-gold/[0.07] text-mtqs-gold-light mtqs-glow"
      : "border-white/[0.08] bg-white/[0.03] text-white/85";
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-center text-[0.72rem] font-medium tracking-wide ${cls} ${className}`}
    >
      {label}
      {chips && chips.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap justify-center gap-1">
          {chips.map((c) => (
            <span
              key={c}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[0.58rem] uppercase tracking-[0.14em] text-white/55"
            >
              {c}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Centered down-arrow connector between flow nodes. */
function FlowDown({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center py-0.5 ${className}`} aria-hidden="true">
      <ArrowDown className="h-3.5 w-3.5 text-mtqs-gold/50" />
    </div>
  );
}

/** A single checklist row (□ marker + text). */
function CheckRow({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-[0.7rem] leading-relaxed text-white/55">
      <span className="mt-[3px] inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-[2px] border border-white/25 text-[0.55rem] text-white/40" aria-hidden="true">
        □
      </span>
      <span>{text}</span>
    </li>
  );
}

/* ============================================================
   ArchitectureSection
   ============================================================ */
export function ArchitectureSection({
  onNavigate: _onNavigate,
  snapshot,
}: {
  onNavigate: (id: SectionId) => void;
  snapshot: MetricsSnapshot | null;
}) {
  // Genesis Reserve Safe address — printed exactly as contracts.ts records it
  // (the "Safe (Multi-Sig)" entry on the Monad chain object; identical hex is
  // recorded on Arc). Never hardcoded.
  const genesisReserveSafe =
    MONAD_TESTNET.contracts.find((c) => c.name.startsWith("Safe"))?.address ?? "—";

  // One honest live cross-reference (four-state panel): the pilot's current
  // target vs observed gold weight — validation-stage values, "—" fallback.
  const liveTargetGold =
    snapshot && Number.isFinite(snapshot.targetGoldWeight)
      ? `${(snapshot.targetGoldWeight * 100).toFixed(2)}%`
      : "—";
  const liveObservedGold =
    snapshot && Number.isFinite(snapshot.observedGoldWeight)
      ? `${(snapshot.observedGoldWeight * 100).toFixed(2)}%`
      : "—";

  return (
    <div className="space-y-10">
      {/* ---------- Page heading + truth banners ---------- */}
      <div>
        <SectionHeading
          eyebrow="§26 · final architecture"
          title="Final Declarations & Architecture Summary"
          className="mb-4"
          right={
            <Pill tone="gold">
              <GlowDot color="gold" size="h-1.5 w-1.5" />
              v2.0 consolidated · 2026-10-19
            </Pill>
          }
        />
        <Reveal>
          <Panel className="border-mtqs-amber/25 bg-mtqs-amber/[0.04] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="amber">
                <GlowDot color="amber" size="h-1.5 w-1.5" />
                TESTNET ONLY
              </Pill>
              <Pill tone="amber">SHADOW MODE ENFORCED</Pill>
              <Pill tone="rose">RESERVE TRADING NOT AUTHORIZED</Pill>
              <p className="text-[0.68rem] leading-relaxed text-white/55">
                §1.7: testnet inspection, testnet-only corrected deployments, simulation and
                shadow-mode decision generation are authorized — production reserve trading is NOT.
              </p>
            </div>
          </Panel>
        </Reveal>
      </div>

      {/* ---------- §26.1 Final declaration ---------- */}
      <section id="arch-declaration" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§26.1 · the final declaration"
          title="The Final Declaration"
        />
        <Reveal>
          <Panel className="p-5 sm:p-6">
            <p className="mb-2 text-[0.78rem] leading-relaxed text-white/55">
              MTQΣ v2.0 is a closed-loop monetary architecture: every obligation the unit creates is
              defined, measured, collateralized, executed, verified and published inside one
              constitutionally governed loop. The declaration restates the whole architecture in
              one place — fixed-quantity references replaced by methodology references under
              invariant I3.
            </p>
            <p className="mb-4 text-[0.7rem] leading-relaxed text-mtqs-amber/80">
              v3.0 supersession note: the &ldquo;collateralized&rdquo; obligation above is v2.0
              doctrine, reproduced verbatim. Under the v3.0 no-conventional-reserve objective
              (Gate B, D-13.3–D-13.7 open) MTQΣ is issued against settled payment and references
              the published measuring service — it is NOT collateralized by a conventional
              reserve; the legacy v1/v2 pilot-ledger path is retained, labeled.
            </p>
            <ul className="space-y-2.5">
              {DECLARATION_POINTS.map((p) => (
                <li key={`${p.ref}·${DECLARATION_POINTS.indexOf(p)}`} className="flex items-start gap-2.5">
                  <GlowDot color="gold" size="h-1.5 w-1.5" className="mt-[7px] shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[0.78rem] leading-relaxed text-white/85">{p.text}</span>{" "}
                    <span className="ml-1 whitespace-nowrap font-mono text-[0.62rem] text-mtqs-gold/70">
                      [{p.ref}]
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-lg border border-mtqs-amber/30 bg-mtqs-amber/[0.05] p-4">
              <p className="text-[0.85rem] font-semibold text-amber-100">
                This is not yet production-authorized. It is a candidate for testnet validation.
              </p>
              <p className="mt-1.5 text-[0.75rem] leading-relaxed text-white/55">
                The reference methodology defines what one MTQΣ is intended to represent. The
                reserve portfolio exists to collateralize that obligation.
              </p>
            </div>
          </Panel>
        </Reveal>

        {/* §26.7 one-sentence definition */}
        <Reveal delay={0.05}>
          <Panel className="mt-4 border-mtqs-gold/25 bg-mtqs-gold/[0.04] p-5">
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">
              §26.7 · the final one-sentence definition
            </div>
            <p className="mtqs-display mt-2 text-base sm:text-lg font-medium leading-relaxed text-mtqs-gold-light">
              &ldquo;MTQΣ is a transparent, dynamically weighted, multi-currency-and-gold monetary
              reference architecture in which the live composition is continuously calculated by a
              constrained, robust, multi-model stability engine and changed only through cost-aware,
              risk-aware, liquidity-aware rebalancing rules.&rdquo;
            </p>
            <p className="mt-2 text-[0.68rem] text-white/55">
              Every clause is load-bearing and traceable. If a summary of MTQΣ ever contradicts
              this sentence, the summary is wrong — the definition governs.
            </p>
          </Panel>
        </Reveal>

        {/* §26.8.2 honest status strip */}
        <Reveal delay={0.1}>
          <Panel className="mt-4 p-5">
            <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">
                §26.8.2 · Final honest status declaration
              </div>
              <Pill tone="amber">
                <GlowDot color="amber" size="h-1.5 w-1.5" />
                candidate for public testing — NOT production-authorized
              </Pill>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
              {HONEST_STATUS_ROWS.map((r) => (
                <div
                  key={r.aspect}
                  className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5"
                >
                  <div className="text-[0.62rem] uppercase tracking-[0.14em] text-white/55">
                    {r.aspect}
                  </div>
                  <div className="mt-1 text-[0.68rem] font-medium text-amber-100">{r.status}</div>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>
      </section>

      {/* ---------- §26.3.2 Two-engine hierarchy ---------- */}
      <section id="arch-hierarchy" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§26.3.2 · coo-approved final architecture"
          title="The Two-Engine Hierarchy"
          right={
            <Pill tone="gold">
              <GitBranch className="h-3 w-3" aria-hidden="true" />
              merge at MARP
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-5 sm:p-6">
            {/* Root */}
            <div className="mx-auto max-w-[240px]">
              <FlowNode label="MTQ Σ" tone="gold" />
            </div>

            {/* Diverge to two branches */}
            <div className="hidden md:grid grid-cols-2 gap-4">
              <FlowDown />
              <FlowDown />
            </div>
            <div className="md:hidden">
              <FlowDown />
            </div>

            {/* Two branch columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* REFERENCE INDEX branch */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 sm:p-4">
                <div className="mb-3 text-center text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-mtqs-gold/80">
                  Reference Index
                </div>
                <div className="space-y-0.5">
                  {REFERENCE_BRANCH.map((n) => (
                    <div key={n.label}>
                      <FlowNode label={n.label} chips={n.chips} />
                      {n !== REFERENCE_BRANCH[REFERENCE_BRANCH.length - 1] ? <FlowDown /> : null}
                    </div>
                  ))}
                </div>
              </div>

              {/* RESERVE branch */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 sm:p-4">
                <div className="mb-3 text-center text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-mtqs-gold/80">
                  Reserve
                </div>
                <FlowNode label="Reserve Engine" />
                <FlowDown />
                <div className="space-y-1.5">
                  <FlowNode label="Coverage / Liquidity" />
                  <FlowNode label="Custody / Gold" />
                </div>
                <p className="mt-3 text-[0.62rem] leading-relaxed text-white/55">
                  Coverage, liquidity, custody and gold state feed the cash-flow, no-trade-zone and
                  risk-trigger inputs of MARP — execution is priced against reserve reality, not
                  against the index alone (§26.3.3).
                </p>
              </div>
            </div>

            {/* Converge to MARP */}
            <div className="hidden md:grid grid-cols-2 gap-4 mt-1">
              <FlowDown />
              <FlowDown />
            </div>
            <div className="md:hidden">
              <FlowDown />
            </div>
            <div className="mx-auto max-w-[280px]">
              <FlowNode label="MARP" tone="gold" />
            </div>

            {/* Fan-out: three decision inputs */}
            <div className="hidden md:grid grid-cols-3 gap-3 mt-1">
              <FlowDown />
              <FlowDown />
              <FlowDown />
            </div>
            <div className="md:hidden">
              <FlowDown />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <FlowNode label="Cash Flow" />
              <FlowNode label="No-Trade Zone" />
              <FlowNode label="Risk Trigger" />
            </div>

            {/* Re-merge into the shared downstream obligations */}
            <div className="hidden md:grid grid-cols-3 gap-3 mt-1">
              <FlowDown />
              <FlowDown />
              <FlowDown />
            </div>
            <div className="md:hidden">
              <FlowDown />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
              <FlowNode label="Cost-Benefit Gate" tone="gold" />
              <ArrowRight className="hidden sm:block h-3.5 w-3.5 text-mtqs-gold/50" aria-hidden="true" />
              <FlowNode label="Partial Execution" />
              <ArrowRight className="hidden sm:block h-3.5 w-3.5 text-mtqs-gold/50" aria-hidden="true" />
              <FlowNode label="Verification" />
              <ArrowRight className="hidden sm:block h-3.5 w-3.5 text-mtqs-gold/50" aria-hidden="true" />
              <FlowNode label="Audit / Publication" />
            </div>

            <p className="mt-5 text-[0.68rem] leading-relaxed text-white/55">
              §26.3.3 — the data-flow view (§26.3.1) and this hierarchy view are the same
              architecture from two angles: index mathematics and reserve economics run as parallel
              constitutional systems under one unit and converge only at MARP; downstream of MARP
              the cost-benefit gate, partial execution, verification, audit and publication are
              shared obligations of both engines.
            </p>
          </Panel>
        </Reveal>
      </section>

      {/* ---------- §26.2 Four weight states ---------- */}
      <section id="arch-weights" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§26.2 · the critical distinction"
          title="Four Weight States"
          right={
            <Pill tone="gold">
              <GlowDot color="gold" size="h-1.5 w-1.5" />
              the most load-bearing distinction
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-5 sm:p-6">
            <p className="mb-4 text-center font-mono text-sm sm:text-base text-mtqs-gold-light">
              W<sup>Prior</sup> ≠ W<sup>Target</sup> ≠ W<sup>Smooth</sup> ≠ W<sup>Execution</sup>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {FOUR_STATES.map((s) => (
                <div
                  key={s.key}
                  className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3.5"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[0.72rem] font-semibold text-white">{s.name}</span>
                    <span className="font-mono text-[0.66rem] text-mtqs-gold">
                      W<sup>{s.sup}</sup>
                    </span>
                  </div>
                  <p className="mt-2 text-[0.68rem] leading-relaxed text-white/55">{s.def}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[0.7rem] leading-relaxed text-white/55">
                  The published live weight W<sub>t</sub><sup>Live</sup> is the{" "}
                  <span className="text-white">Execution</span> state that has actually been
                  applied (§2.3; publication layer, Chapter 24). Every downstream system — index
                  valuation (Ch 9), execution (Ch 10–11), publication (Ch 24) — consumes exactly
                  one of these states; conflating them in any implementation is a specification
                  defect.
                </p>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">
                  Live pilot cross-reference (validation-stage)
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[0.72rem] text-mtqs-gold">
                  <span>
                    targetGoldWeight <span className="text-white">{liveTargetGold}</span>
                  </span>
                  <span>
                    observedGoldWeight <span className="text-white">{liveObservedGold}</span>
                  </span>
                </div>
                <p className="mt-1 text-[0.62rem] text-white/55">
                  From the pilot snapshot — the deployed pilot&rsquo;s simplified target/observed
                  pair; never quoted as a final optimal weight (§26.6.2).
                </p>
              </div>
            </div>
          </Panel>
        </Reveal>
      </section>

      {/* ---------- Appendix C worked examples ---------- */}
      <section id="arch-examples" className="scroll-mt-32">
        <SectionHeading
          eyebrow="appendix c · worked examples"
          title="Five Worked Examples — Scenario · Math · Outcome"
        />
        <Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {WORKED_EXAMPLES.map((ex) => (
              <Panel key={ex.id} className="p-4 flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-[0.66rem] text-mtqs-gold">{ex.id}</span>
                  <Pill tone="muted">{ex.tag}</Pill>
                </div>
                <h3 className="text-[0.8rem] font-semibold text-white leading-snug">{ex.title}</h3>
                <div className="mt-2.5 space-y-2 flex-1">
                  <div>
                    <div className="text-[0.58rem] uppercase tracking-[0.18em] text-white/55">
                      Scenario
                    </div>
                    <p className="text-[0.68rem] leading-relaxed text-white/55">{ex.scenario}</p>
                  </div>
                  <div>
                    <div className="text-[0.58rem] uppercase tracking-[0.18em] text-white/55">
                      Math
                    </div>
                    <div className="mt-1 space-y-1">
                      {ex.math.map((m) => (
                        <div
                          key={m}
                          className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1 font-mono text-[0.64rem] text-mtqs-gold-light break-words"
                        >
                          {m}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[0.58rem] uppercase tracking-[0.18em] text-white/55">
                      Decision outcome
                    </div>
                    <p className="text-[0.68rem] leading-relaxed text-white/55">{ex.outcome}</p>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------- §26.6 Locked vs must-be-validated ---------- */}
      <section id="arch-locked" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§26.6 · final architecture status"
          title="Locked vs Must-Be-Validated"
          right={
            <Pill tone="amber">
              <GlowDot color="amber" size="h-1.5 w-1.5" />
              conceptually complete · quantitatively unvalidated
            </Pill>
          }
        />
        <Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Panel className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-mtqs-emerald/80" aria-hidden="true" />
                <span className="text-[0.72rem] font-semibold text-white">
                  Locked concepts (constitutional)
                </span>
                <Pill tone="emerald">{LOCKED_CONCEPTS.length}</Pill>
              </div>
              <ol className="max-h-96 overflow-y-auto mtqs-scroll space-y-1.5 pr-2">
                {LOCKED_CONCEPTS.map((c, i) => (
                  <li key={c} className="flex items-start gap-2 text-[0.68rem] leading-relaxed text-white/55">
                    <span className="mt-px w-5 shrink-0 text-right font-mono text-[0.6rem] text-mtqs-emerald/70">
                      {i + 1}.
                    </span>
                    <span>{c}</span>
                  </li>
                ))}
              </ol>
            </Panel>
            <Panel className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <FlaskConical className="h-3.5 w-3.5 text-mtqs-amber/80" aria-hidden="true" />
                <span className="text-[0.72rem] font-semibold text-white">
                  Not locked — must be quantitatively validated
                </span>
                <Pill tone="amber">{NOT_LOCKED.length}</Pill>
              </div>
              <ol className="max-h-96 overflow-y-auto mtqs-scroll space-y-1.5 pr-2">
                {NOT_LOCKED.map((c, i) => (
                  <li key={c} className="flex items-start gap-2 text-[0.68rem] leading-relaxed text-white/55">
                    <span className="mt-px w-5 shrink-0 text-right font-mono text-[0.6rem] text-mtqs-amber/70">
                      {i + 1}.
                    </span>
                    <span>{c}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[0.64rem] leading-relaxed text-white/55">
                No numerical weighting percentage should be described as &ldquo;the final optimal
                weight&rdquo; until it survives the complete research program (Ch 23) and Gate 2 of
                the validation sequence (§25.5).
              </p>
            </Panel>
          </div>
        </Reveal>
      </section>

      {/* ---------- Appendix B deployment checklist ---------- */}
      <section id="arch-deployment" className="scroll-mt-32">
        <SectionHeading
          eyebrow="appendix b · deployment checklist"
          title="Deployment Checklist — Phases 0–5"
          right={
            <Pill tone="muted">
              <ListChecks className="h-3 w-3" aria-hidden="true" />
              reference sequence — pilot status tracked on the Security tab
            </Pill>
          }
        />
        <Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {DEPLOYMENT_PHASES.map((ph) => (
              <Panel
                key={ph.phase}
                className={`p-4 ${ph.phase === "Phase 5" ? "border-mtqs-rose/25" : ""}`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-[0.64rem] text-mtqs-gold">{ph.phase}</span>
                    <h3 className="text-[0.78rem] font-semibold text-white">{ph.title}</h3>
                  </div>
                  <Pill tone={ph.phase === "Phase 5" ? "rose" : "muted"}>
                    {ph.items.length} items
                  </Pill>
                </div>
                <ul className="space-y-1.5">
                  {ph.items.map((it) => (
                    <CheckRow key={it} text={it} />
                  ))}
                </ul>
                {ph.note ? (
                  <div
                    className={`mt-3 rounded-md border p-2.5 text-[0.64rem] leading-relaxed ${
                      ph.phase === "Phase 5"
                        ? "border-mtqs-rose/35 bg-mtqs-rose/[0.06] text-mtqs-rose"
                        : "border-white/[0.07] bg-white/[0.02] text-white/55"
                    }`}
                  >
                    {ph.note}
                  </div>
                ) : null}
                {ph.phase === "Phase 1" ? (
                  <p className="mt-2 text-[0.6rem] text-white/55">
                    Reported Genesis Reserve Safe (contracts.ts):{" "}
                    <span className="font-mono text-mtqs-gold/80">{genesisReserveSafe}</span>
                  </p>
                ) : null}
                {ph.phase === "Phase 5" ? (
                  <p className="mt-2 text-[0.6rem] text-white/55">
                    Foundry verification commands: see the Developers tab.
                  </p>
                ) : null}
              </Panel>
            ))}
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="mt-3 text-[0.66rem] leading-relaxed text-white/55">
            The checklist compiles the developer deployment sequence from the blueprint&rsquo;s
            genesis and deployment modules (BP §13.7.4; BP §2.6.4). It targets the testnet edition;
            every phase that differs on mainnet is governed by the validation gates of §25.5 and
            must not be executed before those gates pass. This is the reference sequence — the
            live pilot&rsquo;s actual gate status is tracked on the Security tab.
          </p>
        </Reveal>
      </section>

      {/* ---------- Appendix A glossary ---------- */}
      <section id="arch-glossary" className="scroll-mt-32">
        <SectionHeading
          eyebrow="appendix a · glossary"
          title="Symbols & Terms — The Load-Bearing Set"
          right={
            <Pill tone="muted">
              <BookMarked className="h-3 w-3" aria-hidden="true" />
              {GLOSSARY.length} of the full table
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-5">
            <div className="max-h-96 overflow-y-auto mtqs-scroll pr-2">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
                {GLOSSARY.map((g) => (
                  <div
                    key={g.term}
                    className="border-b border-white/[0.05] pb-2"
                  >
                    <dt className="font-mono text-[0.7rem] text-mtqs-gold">{g.term}</dt>
                    <dd className="mt-0.5 text-[0.66rem] leading-relaxed text-white/55">
                      {g.def}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Panel>
        </Reveal>
      </section>

      {/* ---------- Appendix E source lineage ---------- */}
      <section id="arch-lineage" className="scroll-mt-32">
        <SectionHeading
          eyebrow="appendix e · source lineage"
          title="Source Lineage Cross-Reference"
        />
        <Reveal>
          <Panel className="p-5">
            <p className="mb-3 text-[0.72rem] leading-relaxed text-white/55">
              The consolidated document is built from three sources: the{" "}
              <span className="text-white/85">Source of Truth Blueprint v1.2</span> (BP — 16
              sections, 80 solidity blocks), the{" "}
              <span className="text-white/85">Consolidated Final Modification Specification
              Baseline v1.0</span> (MS — 103 sections), and the{" "}
              <span className="text-white/85">COO Review</span> (COO-1…COO-28 plus the final
              conclusion). The map records, chapter by chapter, which source material each part
              carries.
            </p>
            <div className="overflow-hidden rounded-md border border-white/[0.06]">
              <div className="max-h-96 overflow-y-auto mtqs-scroll">
                <table className="w-full text-[0.66rem]">
                  <thead className="bg-white/[0.03] text-white/55 sticky top-0 backdrop-blur">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Master section</th>
                      <th className="text-left px-3 py-2 font-medium">Source</th>
                      <th className="text-left px-3 py-2 font-medium">Content carried</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LINEAGE_ROWS.map((r, i) => (
                      <tr
                        key={r.section}
                        className={`border-t border-white/[0.06] ${i % 2 ? "bg-white/[0.015]" : ""}`}
                      >
                        <td className="px-3 py-2 font-mono text-mtqs-gold whitespace-nowrap">
                          {r.section}
                        </td>
                        <td className="px-3 py-2 text-white/70 whitespace-nowrap">{r.source}</td>
                        <td className="px-3 py-2 text-white/55">{r.content}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>
        </Reveal>

        {/* §1.8 binding consolidation order */}
        <Reveal delay={0.05}>
          <Panel className="mt-4 p-5">
            <div className="mb-2 text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">
              §1.8 · Binding consolidation order &amp; source precedence
            </div>
            <ol className="space-y-1">
              {CONSOLIDATION_ORDER.map((o, i) => (
                <li key={o} className="flex items-start gap-2 text-[0.7rem] leading-relaxed text-white/55">
                  <span className="mt-px w-4 shrink-0 text-right font-mono text-[0.62rem] text-mtqs-gold/70">
                    {i + 1}.
                  </span>
                  <span>{o}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2.5 text-[0.66rem] leading-relaxed text-white/55">
              This is a hierarchy of authority, not a claim that source code already complies. The
              hierarchy does not authorize a developer to invent an objective function, conversion
              factor, monetary threshold, protection margin, asset admission exception, reserve
              rule, feed address, emergency action, or purchasing-power benchmark — each such
              choice must be traced to an approved governance decision or remain explicitly
              blocked.
            </p>
          </Panel>
        </Reveal>

        {/* §1.7 status declaration */}
        <Reveal delay={0.1}>
          <Panel className="mt-4 border-mtqs-amber/25 bg-mtqs-amber/[0.04] p-5">
            <div className="mb-2 text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-amber/80">
              §1.7 · Status declaration (binds every reader of this specification)
            </div>
            <p className="text-[0.72rem] leading-relaxed text-white/70">
              MTQΣ is a testnet-development and correction candidate. Testnet inspection,
              testnet-only corrected deployments, simulation, and shadow-mode decision generation
              are authorized within the boundaries of Appendix F.{" "}
              <span className="font-semibold text-amber-100">
                Production reserve trading is NOT authorized.
              </span>{" "}
              No live-asset pilot is authorized unless Gate 5 has been completed and a separate
              written authorization is issued; production reserve trading additionally requires
              Gate 6 and a separate governance decision; Solana production and consolidated
              multichain operation require Gate 7. All values described as validation-stage values
              remain non-final. Reported chain deployments, addresses, token decimals, Safe
              settings, and role assignments must be verified independently. A written
              specification, a successful compile, a testnet transaction, or a simulation does not
              prove that a correction is deployed or that production is safe.
            </p>
          </Panel>
        </Reveal>
      </section>
    </div>
  );
}
