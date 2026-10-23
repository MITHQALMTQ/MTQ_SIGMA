// MTQΣ — Constituency Succession Engine (§3.3 eligibility · §21.5 eject · §9.2 continuity)
//
// Answers the governance-critical question: "what happens when a currency
// loses its power?" — end-to-end, on the LIVE chain-linked index:
//
//   1. DECAY      The failing component's price collapses (e.g. a −40%
//                 devaluation). The chain-linked index tracks EVERY tick of
//                 the loss — I_t falls by exactly W_ejected × Δprice. Nothing
//                 is hidden, nothing is smoothed over. (Honesty: Invariant I10.)
//   2. DEPEG      The reserve token breaches its liquidity-scaled peg band
//                 (§21.5.2). Out-of-band hours accumulate; the staged eject
//                 ladder (§21.5.3: 10% → 25% → 50% → 100%) begins liquidating
//                 the reserve sleeve of the failing currency into the
//                 survivors, pace-capped by MARP turnover rules.
//   3. EJECT      At stage 4 (issuer freeze / full collapse / RR < 1.02) the
//                 component is removed from the reference basket. Its weight
//                 is renormalized across the survivors via the chain-link
//                 divisor — ZERO artificial index return at the moment of
//                 removal (the real loss already accrued in step 1).
//   4. SUCCESSION A candidate currency from the expandable universe (§3.3 —
//                 the methodology is fixed, the constituency is adaptive;
//                 Invariant I3) is admitted through governance (Risk Council
//                 4/7 + 24h timelock, §22.4) into the vacated slot with a
//                 governed seed weight. Again ZERO artificial return: the
//                 slot is re-priced at the successor's live admission quote
//                 through the same divisor mechanism. From that moment the
//                 unit tracks the successor's purchasing power.
//   5. REINTEGRATION The ejected currency can only return as a FRESH
//                 candidate through §21.5.4's reverse ladder (score ≥ 0.80/
//                 0.85/0.90 sustained 24/48/72h) — never by discretion.
//
// All simulation functions are PURE: they operate on a clone of the live
// chain-index state and never mutate pilot state. The reserve-flow plan uses
// the live per-MTQ holdings for concrete numbers.

import {
  advanceIndex,
  commitWeights,
  renormalizeExcluding,
  replaceComponent,
  type ChainIndexState,
} from "./chain-index";
import { EJECT_STAGES, PEG_BANDS } from "./blueprint";

// --- §3.3 Candidate Universe (validation-stage; admission is governed) -------
// Expandable by governance. Seed weight = the envelope mid of the candidate's
// provisional admissibility band (Risk Council sets the actual seed within it
// at admission). frankfurterKey resolves the live USD quote from the same ECB
// feed the engine already uses (base=USD returns every ECB rate).
export interface SuccessionCandidate {
  code: string;
  name: string;
  seedWeight: number;
  envelope: { lower: number; upper: number };
  frankfurterKey: string;
  note: string;
}

export const CANDIDATE_UNIVERSE: SuccessionCandidate[] = [
  { code: "SGD", name: "Singapore Dollar", seedWeight: 0.05, envelope: { lower: 0.03, upper: 0.07 }, frankfurterKey: "SGD", note: "Deep FX market, AAA sovereign, MAS-regulated stablecoin issuer landscape." },
  { code: "AUD", name: "Australian Dollar", seedWeight: 0.05, envelope: { lower: 0.03, upper: 0.07 }, frankfurterKey: "AUD", note: "Commodity-linked diversifier; one of the most-traded APAC currencies." },
  { code: "CAD", name: "Canadian Dollar", seedWeight: 0.05, envelope: { lower: 0.03, upper: 0.07 }, frankfurterKey: "CAD", note: "G10 oil-linked currency; deep liquidity, strong rule-of-law profile." },
  { code: "KRW", name: "South Korean Won", seedWeight: 0.04, envelope: { lower: 0.02, upper: 0.06 }, frankfurterKey: "KRW", note: "Large economy; on-chain issuer depth is thinner — wider envelope band." },
  { code: "SEK", name: "Swedish Krona", seedWeight: 0.04, envelope: { lower: 0.02, upper: 0.06 }, frankfurterKey: "SEK", note: "EU-adjacent G10; diversifies the EUR block without duplicating it." },
  { code: "NOK", name: "Norwegian Krone", seedWeight: 0.03, envelope: { lower: 0.02, upper: 0.05 }, frankfurterKey: "NOK", note: "Sovereign-wealth-fund anchor; smaller FX depth — lower envelope." },
];

export function findCandidate(code: string): SuccessionCandidate | undefined {
  return CANDIDATE_UNIVERSE.find((c) => c.code === code);
}

// --- Types -------------------------------------------------------------------

export interface LabeledWeight {
  component: string;
  weight: number;
  envelope: { lower: number; upper: number } | null; // null = not applicable (Gold/USD anchors, successors use candidate envelope)
  inEnvelope: boolean | null;
}

export interface SuccessionStep {
  t: number; // simulated hour
  phase: "baseline" | "decay" | "depeg" | "ladder" | "eject" | "succession" | "post";
  label: string;
  iLevel: number;
  ejectedPriceUsd: number;
  depegHours: number;
  ejectStage: number; // 0..4 (§21.5.3)
  note: string;
  divisor?: number;
}

export interface SuccessionLadderStage {
  stage: number;
  sellPct: number; // share of the ejected sleeve sold at this stage (incremental)
  triggerHour: number;
  priceUsd: number; // the failing currency's price when the stage fires
  proceedsUsdPerMtq: number;
}

export interface SuccessionSimulation {
  ok: boolean;
  error?: string;
  ejected: string;
  shockPct: number; // positive number, e.g. 40 = −40%
  successor: SuccessionCandidate | null;
  successorPriceUsd: number | null;
  baseline: {
    iLevel: number;
    gFactor: number;
    weights: LabeledWeight[];
  };
  timeline: SuccessionStep[];
  after: {
    iLevel: number;
    gFactor: number;
    weights: LabeledWeight[];
    weightSum: number;
  };
  continuity: {
    iBeforeSwap: number;
    iAfterSwap: number;
    artificialReturnPct: number; // must be 0 — the succession itself is free
    accruedLossPct: number;      // the honest loss tracked during decay
    pass: boolean;
  };
  successorSanity: {
    movePct: number;          // simulated post-admission move in the successor (+10%)
    expectedIndexMovePct: number; // seedWeight × movePct
    actualIndexMovePct: number;
    pass: boolean;
  } | null;
  ejectedFromBasket: boolean; // false = depeg never confirmed (monitor path)
  reserveFlow: {
    ejectedHoldingNativePerMtq: number;
    initialExposureUsdPerMtq: number;
    ladder: SuccessionLadderStage[];
    realizedUsdPerMtq: number;
    finalMarkUsdPerMtq: number;
    savedByActingUsdPerMtq: number; // realized − finalMark (the ladder's value)
    reallocation: { component: string; usdPerMtq: number; sharePct: number }[];
  } | null;
  reintegrationNote: string;
}

// --- Helpers -----------------------------------------------------------------

const ENVELOPE_BY_LABEL: Record<string, { lower: number; upper: number }> = {
  USD: { lower: 0.23, upper: 0.32 },
  EUR: { lower: 0.17, upper: 0.24 },
  JPY: { lower: 0.07, upper: 0.12 },
  GBP: { lower: 0.06, upper: 0.11 },
  CNY: { lower: 0.03, upper: 0.07 },
  CHF: { lower: 0.03, upper: 0.07 },
};

// §21.5.2 liquidity-scaled peg bands; CHF (new in v1.0) takes the ±1% class.
function bandFor(code: string): { lower: number; upper: number } {
  switch (code) {
    case "USD": return PEG_BANDS.USDC;
    case "EUR": return PEG_BANDS.EURC;
    case "GBP": return PEG_BANDS.GBP;
    case "JPY": return PEG_BANDS.JPY;
    case "CNY": return PEG_BANDS.CNY;
    default: return { lower: 0.99, upper: 1.01 }; // CHF and any minor sleeve
  }
}

function labeled(weights: number[], labels: string[], successorCode: string | null, successorSlot: number | null): LabeledWeight[] {
  return weights.map((w, i) => {
    const label = labels[i];
    const env =
      successorCode && i === successorSlot
        ? findCandidate(successorCode)?.envelope ?? null
        : ENVELOPE_BY_LABEL[label] ?? null;
    return {
      component: label,
      weight: w,
      envelope: env,
      inEnvelope: env ? w >= env.lower - 1e-9 && w <= env.upper + 1e-9 : null,
    };
  });
}

// Eject-stage ladder per updatePegHealth (§21.5.3): >12h → 1, >24h → 2, >48h → 3,
// >96h or price < 0.9 of pre-crisis par → 4 (full liquidation). Used by the
// exact-trigger planner above.
function stageFor(hoursOutOfBand: number, priceRatio: number): number {
  if (hoursOutOfBand > 96 || priceRatio < 0.9) return 4;
  if (hoursOutOfBand > 48) return 3;
  if (hoursOutOfBand > 24) return 2;
  if (hoursOutOfBand > 12) return 1;
  return 0;
}
void stageFor; // (documented ladder logic — planner inlines the exact hours)

// --- The Simulation ----------------------------------------------------------

export interface SuccessionArgs {
  liveIndex: ChainIndexState;      // cloned live chain index (NOT mutated)
  componentLabels: string[];       // ["USD","EUR","JPY","GBP","CNY","CHF","Gold"]
  ejected: string;                 // label of the failing component (≠ Gold)
  shockPct: number;                // e.g. 40 → price falls to (1−0.40)×P0
  successor?: string | null;       // candidate code or null (eject-only)
  successorPriceUsd?: number | null; // live admission quote (required if successor)
  ejectedHoldingNativePerMtq?: number | null; // for the reserve-flow plan
}

const SIM_HOURS = 120; // 5-day crisis window

export function simulateSuccession(args: SuccessionArgs): SuccessionSimulation {
  const { liveIndex, componentLabels, ejected, shockPct } = args;
  const successorCode = args.successor ?? null;
  const successorPriceUsd = args.successorPriceUsd ?? null;

  // --- Validation -------------------------------------------------------------
  const slot = componentLabels.indexOf(ejected);
  if (slot < 0) {
    return invalid(ejected, shockPct, successorCode, successorPriceUsd, `Unknown component "${ejected}" — the live basket is [${componentLabels.join(", ")}].`);
  }
  if (ejected === "Gold") {
    return invalid(ejected, shockPct, successorCode, successorPriceUsd, "Gold is the constitutional anchor (I3/I12, §13.3) — it cannot be ejected from the reference basket. Simulate a fiat component failure instead.");
  }
  if (!(shockPct > 0 && shockPct < 100)) {
    return invalid(ejected, shockPct, successorCode, successorPriceUsd, "shockPct must be in (0, 100).");
  }
  const successor = successorCode ? findCandidate(successorCode) ?? null : null;
  if (successorCode && !successor) {
    return invalid(ejected, shockPct, successorCode, successorPriceUsd, `Unknown successor candidate "${successorCode}".`);
  }
  if (successor && !(successorPriceUsd && successorPriceUsd > 0)) {
    return invalid(ejected, shockPct, successorCode, successorPriceUsd, `A live admission quote for ${successor.code} is required (oracle-validated, §17.3).`);
  }

  // --- Baseline ---------------------------------------------------------------
  // Clone the live state; the simulation advances this copy only.
  const sim: ChainIndexState = {
    ...liveIndex,
    prevWeights: [...liveIndex.prevWeights],
    prevPrices: [...liveIndex.prevPrices],
  };
  const labels = [...componentLabels];
  const p0 = sim.prevPrices[slot];
  const w0 = sim.prevWeights[slot];
  const iBaseline = sim.I_t;
  const baselineWeights = labeled(sim.prevWeights, labels, null, null);

  const band = bandFor(ejected);
  // The failing currency's USD quote decays linearly over SIM_HOURS.
  const priceAt = (hour: number) => p0 * (1 - (shockPct / 100) * (hour / SIM_HOURS));

  const timeline: SuccessionStep[] = [];
  timeline.push({
    t: 0,
    phase: "baseline",
    label: `${ejected} at par — basket intact`,
    iLevel: sim.I_t,
    ejectedPriceUsd: p0,
    depegHours: 0,
    ejectStage: 0,
    note: `Live basket: ${ejected} holds a ${(w0 * 100).toFixed(1)}% index weight and ${args.ejectedHoldingNativePerMtq != null ? "a live reserve sleeve" : "a reserve sleeve"}. Its USD quote is ${p0.toPrecision(4)}. All envelopes satisfied.`,
  });

  // --- Phase 1–2: decay + depeg detection + staged ladder ---------------------
  // Checkpoints every 12h — the §21.5.2 detection window granularity. Stage
  // triggers are computed at EXACT hours (engine-faithful): stages 1–3 fire on
  // cumulative out-of-band hours (12/24/48); stage 4 fires on >96h OR price
  // < 90% of pre-crisis par — whichever comes first (updatePegHealth logic),
  // and supersedes any stage that would fire later.
  const checkpoints = [12, 24, 36, 48, 72, 96, 120];
  const bandBreachHour = (() => {
    // The peg band is relative to the component's par. Find the first hour
    // where the quote breaches the band.
    for (let h = 0; h <= SIM_HOURS; h += 1) {
      if (priceAt(h) / p0 < band.lower) return h;
    }
    return SIM_HOURS + 1; // never breached within the window
  })();
  // Hour at which the quote crosses 90% of par (stage-4 price condition).
  const collapseHour = SIM_HOURS * 0.1 / (shockPct / 100);
  const stageHourThresholds = [12, 24, 48, 96]; // cumulative out-of-band hours per stage
  const stage4Trig = Math.min(bandBreachHour + 96, collapseHour);

  const ejectedHolding = args.ejectedHoldingNativePerMtq ?? null;
  const ladder: SuccessionLadderStage[] = [];
  let prevCum = 0;
  const pushStage = (s: number, trig: number) => {
    const incremental = EJECT_STAGES[s - 1].sellPct - prevCum;
    const price = priceAt(trig);
    ladder.push({
      stage: s,
      sellPct: incremental,
      triggerHour: Math.round(trig),
      priceUsd: price,
      proceedsUsdPerMtq: ejectedHolding != null ? ejectedHolding * incremental * price : 0,
    });
    prevCum = EJECT_STAGES[s - 1].sellPct;
  };
  for (let s = 1; s <= 3; s++) {
    const trig = bandBreachHour + stageHourThresholds[s - 1];
    if (trig < stage4Trig && trig <= SIM_HOURS) pushStage(s, trig);
  }
  if (stage4Trig <= SIM_HOURS) pushStage(4, stage4Trig);
  const lastStage = ladder.length ? ladder[ladder.length - 1].stage : 0;
  const ejectHour = lastStage >= 4 ? stage4Trig : SIM_HOURS;

  // Advance the index through the decay window (the honest loss accrues in
  // I_t at exactly W×Δprice per step — chain-linked, geometrically).
  const stageAt = (h: number) => {
    let st = 0;
    for (const l of ladder) if (l.triggerHour <= h) st = l.stage;
    return st;
  };
  for (const h of checkpoints) {
    if (h > ejectHour) break;
    const price = priceAt(h);
    const outOfBand = h >= bandBreachHour;
    const depegH = outOfBand ? Math.max(0, Math.round(h - bandBreachHour)) : 0;
    const stage = stageAt(h);
    const prices = [...sim.prevPrices];
    prices[slot] = price;
    const adv = advanceIndex(sim, prices);
    sim.I_t = adv.newIndex;
    sim.prevPrices = adv.state.prevPrices;
    sim.prevWeights = adv.state.prevWeights;

    const phase: SuccessionStep["phase"] = depegH > 0 ? (stage > 0 ? "ladder" : "depeg") : "decay";
    timeline.push({
      t: h,
      phase,
      label:
        stage >= 4 ? `${ejected} fully collapsed — stage 4 reached`
        : stage > 0 ? `Eject ladder stage ${stage} firing (${EJECT_STAGES[stage - 1].condition})`
        : depegH > 0 ? `${ejected} outside its ±${((1 - band.lower) * 100).toFixed(1)}% band — depeg clock running (${depegH}h)`
        : `${ejected} decaying — still inside its peg band`,
      iLevel: sim.I_t,
      ejectedPriceUsd: price,
      depegHours: depegH,
      ejectStage: stage,
      note:
        stage >= 4 ? "Issuer freeze / full collapse confirmed. The component is ejected from the reference basket and the remaining sleeve is liquidated into the survivors."
        : stage > 0 ? `Staged liquidation: ${(EJECT_STAGES[stage - 1].sellPct * 100).toFixed(0)}% cumulative of the ${ejected} reserve sleeve sold; proceeds reallocate per MASE weights. MARP turnover caps still apply (§12.3).`
        : depegH > 0 ? "Oracle quorum confirms the deviation (I9). The 12-hour confirmation window for stage 1 is running."
        : "Loss accrues in the chain-linked index at exactly W×Δprice — no hiding, no smoothing (I10).",
    });
  }
  // Final advance to the ejection moment (frozen price = last valid quote).
  if (lastStage >= 4) {
    const price = priceAt(ejectHour);
    const prices = [...sim.prevPrices];
    prices[slot] = price;
    const adv = advanceIndex(sim, prices);
    sim.I_t = adv.newIndex;
    sim.prevPrices = adv.state.prevPrices;
    sim.prevWeights = adv.state.prevWeights;
  }
  const depegHoursAtEject = Math.max(0, Math.round(ejectHour - bandBreachHour));

  // --- Phase 3: ejection — ONLY if the §21.5.3 ladder reached stage 4 --------
  // If the depeg never confirmed (small shock), the honest path is: NO ejection.
  // MASE simply downweights the weakening component within its envelope, and
  // the staged ladder stands down when the price recovers into band.
  if (lastStage < 4) {
    const afterWeightsMonitor = labeled(sim.prevWeights, labels, null, null);
    const monitorAccrued = Math.abs(((iBaseline - sim.I_t) / iBaseline) * 100);
    timeline.push({
      t: SIM_HOURS,
      phase: "post",
      label: `${ejected} degraded but NOT ejected — eject conditions unmet`,
      iLevel: sim.I_t,
      ejectedPriceUsd: sim.prevPrices[slot],
      depegHours: depegHoursAtEject,
      ejectStage: lastStage,
      note: `Ejection requires a confirmed depeg: >12h out-of-band for stage 1 … issuer-freeze/full-collapse (<90% of pre-crisis par) for stage 4. At −${shockPct.toFixed(1)}% over ${SIM_HOURS}h the ladder reached stage ${lastStage}. The component stays in the basket; MASE downweights it within its admissibility envelope and the ladder unwinds if the price recovers (timer decays at 2× in-band, §21.5.3).`,
    });
    return {
      ok: true,
      ejected,
      shockPct,
      successor: null,
      successorPriceUsd: null,
      baseline: { iLevel: iBaseline, gFactor: liveIndex.G_t, weights: baselineWeights },
      timeline,
      after: {
        iLevel: sim.I_t,
        gFactor: sim.G_t,
        weights: afterWeightsMonitor,
        weightSum: sim.prevWeights.reduce((a, b) => a + b, 0),
      },
      continuity: {
        iBeforeSwap: sim.I_t,
        iAfterSwap: sim.I_t,
        artificialReturnPct: 0,
        accruedLossPct: monitorAccrued,
        pass: true,
      },
      successorSanity: null,
      ejectedFromBasket: false,
      reserveFlow: null,
      reintegrationNote: `No ejection occurred — reintegration ladder not applicable. The staged ladder${lastStage > 0 ? ` (reached stage ${lastStage})` : ""} reverses as the peg-health timer decays.`,
    };
  }

  const iBeforeSwap = sim.I_t;
  const frozenPrice = sim.prevPrices[slot]; // last valid quote at ejection
  // Survivors absorb the vacated weight proportionally (eject-only posture).
  const renorm = renormalizeExcluding(sim.prevWeights, slot);
  const postEjectPrices = [...sim.prevPrices];
  postEjectPrices[slot] = 0; // ejected sleeve fully liquidated — slot carries no price
  // commitWeights with the ejected slot at price 0 makes B^- and B^+ both
  // exclude the slot naturally (0 × anything), so the divisor is exactly the
  // renormalization ratio and I_t is preserved.
  const ejectCommit = commitWeights(sim, renorm, postEjectPrices, Date.now());
  sim.I_t = ejectCommit.state.I_t; // unchanged
  sim.G_t = ejectCommit.newG;
  sim.prevWeights = ejectCommit.state.prevWeights;
  sim.prevPrices = ejectCommit.state.prevPrices;

  timeline.push({
    t: Math.round(ejectHour),
    phase: "eject",
    label: `${ejected} EJECTED — weight redistributed`,
    iLevel: sim.I_t,
    ejectedPriceUsd: frozenPrice,
    depegHours: depegHoursAtEject,
    ejectStage: 4,
    divisor: ejectCommit.divisor,
    note: `Registry: ${ejected} → EJECTED (§4). The vacated ${(w0 * 100).toFixed(1)}% weight is absorbed by the survivors via the chain-link divisor D=${ejectCommit.divisor.toPrecision(6)} — ZERO artificial return at removal. The loss that already accrued stays in the index (honest).`,
  });

  // --- Phase 4: succession (governed successor admission) ----------------------
  let successorSlot: number | null = null;
  if (successor && successorPriceUsd) {
    const admissionPrices = [...sim.prevPrices];
    admissionPrices[slot] = frozenPrice; // slot priced at the frozen quote for B^-
    const succ = replaceComponent(sim, slot, successorPriceUsd, successor.seedWeight, admissionPrices, Date.now());
    sim.I_t = succ.state.I_t; // unchanged — zero artificial return on admission
    sim.G_t = succ.newG;
    sim.prevWeights = succ.state.prevWeights;
    sim.prevPrices = succ.state.prevPrices;
    labels[slot] = successor.code; // the slot now IS the successor
    successorSlot = slot;

    timeline.push({
      t: Math.round(ejectHour),
      phase: "succession",
      label: `${successor.code} ADMITTED — takes the vacated slot`,
      iLevel: sim.I_t,
      ejectedPriceUsd: frozenPrice,
      depegHours: depegHoursAtEject,
      ejectStage: 4,
      divisor: succ.divisor,
      note: `Governance: Risk Council 4/7 + 24h timelock (§22.4). ${successor.code} enters at a governed ${(successor.seedWeight * 100).toFixed(1)}% seed weight (envelope ${(successor.seedWeight >= successor.envelope.lower ? "within" : "OUTSIDE")} ${(successor.envelope.lower * 100).toFixed(0)}–${(successor.envelope.upper * 100).toFixed(0)}%), priced at its live admission quote ${successorPriceUsd.toPrecision(4)}. Divisor D=${succ.divisor.toPrecision(6)} — the unit does not jump. MASE velocity caps (§8.3) pace any further drift.`,
    });
  }

  // --- Phase 5: post-succession verification -----------------------------------
  const postWeights = [...sim.prevWeights];
  const iPost = sim.I_t;

  // Successor sanity check: a +10% move in the successor must move the index
  // by EXACTLY seedWeight × 10% (the slot tracks the successor from admission).
  let successorSanity: SuccessionSimulation["successorSanity"] = null;
  if (successor && successorSlot != null) {
    const sanityPrices = [...sim.prevPrices];
    sanityPrices[successorSlot] = sanityPrices[successorSlot] * 1.10;
    const sanityAdv = advanceIndex(sim, sanityPrices);
    const expectedMove = successor.seedWeight * 0.10 * 100;
    const actualMove = ((sanityAdv.newIndex - sim.I_t) / sim.I_t) * 100;
    successorSanity = {
      movePct: 10,
      expectedIndexMovePct: expectedMove,
      actualIndexMovePct: actualMove,
      pass: Math.abs(actualMove - expectedMove) < 1e-9,
    };
  }

  timeline.push({
    t: Math.round(ejectHour) + 1,
    phase: "post",
    label: successor ? `${successor.code} slot is live — unit tracks the new basket` : "Basket runs without a successor (5 components + Gold)",
    iLevel: iPost,
    ejectedPriceUsd: frozenPrice,
    depegHours: depegHoursAtEject,
    ejectStage: 4,
    note: successor
      ? `Sanity check: a ±10% move in ${successor.code} now moves P_MTQ by exactly ${(successor.seedWeight * 10).toFixed(2)}%. Envelope compliance re-asserts through MASE over subsequent updates (velocity-capped). ${ejected} can only return via the §21.5.4 reverse ladder (score ≥0.80 sustained 24h → 25% repurchase, ≥0.85/48h → 50%, ≥0.90/72h → 100%).`
      : `The 5 surviving components + Gold carry the unit. A successor may be admitted later through the same governed path. ${ejected} re-entry only via §21.5.4 reverse ladder.`,
  });

  const afterWeights = labeled(postWeights, labels, successorCode, successorSlot);
  const weightSum = postWeights.reduce((a, b) => a + b, 0);
  const artificialReturnPct = Math.abs((sim.I_t - iBeforeSwap) / iBeforeSwap) * 100;
  const accruedLossPct = ((iBaseline - iBeforeSwap) / iBaseline) * 100;

  // --- Reserve-flow plan (concrete per-MTQ numbers from live holdings) ---------
  let reserveFlow: SuccessionSimulation["reserveFlow"] = null;
  if (ejectedHolding != null && ejectedHolding > 0) {
    const initialExposure = ejectedHolding * p0;
    const realized = ladder.reduce((a, s) => a + s.proceedsUsdPerMtq, 0);
    // The contrast case: doing NOTHING and holding the sleeve to the full
    // decay (the ladder's whole point is to avoid this).
    const finalMark = ejectedHolding * priceAt(SIM_HOURS);
    const reallocation = postWeights.map((w, i) => ({
      component: labels[i],
      usdPerMtq: realized * w,
      sharePct: w * 100,
    })).filter((r) => r.usdPerMtq > 0);
    reserveFlow = {
      ejectedHoldingNativePerMtq: ejectedHolding,
      initialExposureUsdPerMtq: initialExposure,
      ladder,
      realizedUsdPerMtq: realized,
      finalMarkUsdPerMtq: finalMark,
      savedByActingUsdPerMtq: realized - finalMark,
      reallocation,
    };
  }

  return {
    ok: true,
    ejected,
    shockPct,
    successor,
    successorPriceUsd,
    baseline: {
      iLevel: iBaseline,
      gFactor: liveIndex.G_t,
      weights: baselineWeights,
    },
    timeline,
    after: {
      iLevel: sim.I_t,
      gFactor: sim.G_t,
      weights: afterWeights,
      weightSum,
    },
    continuity: {
      iBeforeSwap,
      iAfterSwap: sim.I_t,
      artificialReturnPct,
      accruedLossPct: Math.abs(accruedLossPct),
      pass: artificialReturnPct < 1e-9 && Math.abs(weightSum - 1) < 1e-9,
    },
    successorSanity,
    ejectedFromBasket: true,
    reserveFlow,
    reintegrationNote: `§21.5.4 reverse ladder for ${ejected}: reintegration score R = 0.40×time-in-band + 0.25×liquidity-depth + 0.20×oracle-agreement + 0.15×(1−volatility); ≥0.80 sustained 24h → repurchase 25% of the pre-eject sleeve; ≥0.85 sustained 48h → 50%; ≥0.90 sustained 72h → 100%. Re-admission to the BASKET is a separate, fresh candidacy — never automatic.`,
  };
}

function invalid(ejected: string, shockPct: number, successor: string | null, successorPriceUsd: number | null, error: string): SuccessionSimulation {
  return {
    ok: false,
    error,
    ejected,
    shockPct,
    successor: successor ? findCandidate(successor) ?? null : null,
    successorPriceUsd,
    baseline: { iLevel: 0, gFactor: 1, weights: [] },
    timeline: [],
    after: { iLevel: 0, gFactor: 1, weights: [], weightSum: 0 },
    continuity: { iBeforeSwap: 0, iAfterSwap: 0, artificialReturnPct: 0, accruedLossPct: 0, pass: false },
    successorSanity: null,
    ejectedFromBasket: false,
    reserveFlow: null,
    reintegrationNote: "",
  };
}

// --- Live FX for candidates (same ECB feed as the engine) ----------------------

/** Fetch live USD quotes for the candidate universe from Frankfurter (ECB).
 *  Returns { code: usdQuote } — e.g. { SGD: 0.74, AUD: 0.66 }. Falls back to
 *  documented fixture estimates when the feed is unavailable (clearly marked
 *  in the response via `live: false`). */
export const CANDIDATE_FIXTURE_QUOTES: Record<string, number> = {
  SGD: 0.74, AUD: 0.66, CAD: 0.73, KRW: 0.00073, SEK: 0.095, NOK: 0.092,
};

export async function fetchCandidateQuotes(): Promise<{ quotes: Record<string, number>; live: boolean; source: string }> {
  const urls = [
    "https://api.frankfurter.dev/v1/latest?base=USD",
    "https://api.frankfurter.app/v1/latest?base=USD",
  ];
  for (const url of urls) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const data = await res.json();
      const r = data?.rates;
      if (!r) continue;
      const quotes: Record<string, number> = {};
      for (const c of CANDIDATE_UNIVERSE) {
        const perUsd = r[c.frankfurterKey];
        if (perUsd && Number(perUsd) > 0) quotes[c.code] = 1 / Number(perUsd); // Frankfurter: USD→SGD; we need USD per SGD
      }
      if (Object.keys(quotes).length > 0) {
        return { quotes, live: true, source: "ECB/Frankfurter" };
      }
    } catch {
      // try next URL
    }
  }
  return { quotes: { ...CANDIDATE_FIXTURE_QUOTES }, live: false, source: "fixture (ECB feed unavailable — pilot fallback)" };
}
