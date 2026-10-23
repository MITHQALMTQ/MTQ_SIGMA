// MTQΣ — Genesis Event Reference Implementation (Master Blueprint §20.1)
// =============================================================================
// Implements Ext-3 A.3 / OD-33: the seven-step Genesis event with the
// SEVEN-component basket (USD 27% / EUR 20% / JPY 9% / GBP 8% / CNY 5% /
// CHF 5% / Gold 26%) and the base-fixings verification.
//
// FIDELITY NOTE (Ext-3 A.3): the audit correctly identified that the
// historical genesis code was written for the five-currency GFB basket.
// verifyGFBBase() is hereby SUPERSEDED by verifyIndexBase(), which checks
// ALL SEVEN base fixings (USD, EUR, JPY, GBP, CNY, CHF, Gold) before the
// base denominator is frozen.
//
// The engine's initReserveState() (engine.ts) remains the state constructor;
// this module formalizes the SEQUENCE as an auditable, replayable event log
// with the exact events the blueprint requires:
//   GenesisVerification(denominator, all fixings)  — step 4
//   GenesisCompleted                               — step 7
//
// HONEST STATUS: reference implementation for the Pilot Command Center.
// The on-chain genesis of the deployed MTQSigma contracts was NOT performed
// through this module; on-chain re-verification is OD-33/OD-36 evidence.

import { STRATEGIC_PRIOR } from "./blueprint";

/** Genesis Reserve Safe — ON-CHAIN VERIFIED 2026-10-19 (OD-35/T-87, Task 3-a):
 *  a genuine Safe v1.4.1 proxy on BOTH chains, but threshold = 1 with a single
 *  owner (the deployer EOA 0x3C39…8d8c), nonce = 0, zero modules, guard =
 *  address(0) — i.e. 1/1 deployer-controlled, NOT the mandated 4/7. This is a
 *  CRITICAL security finding (Gate 5 blocked); reconfigure to 4/7 signers and
 *  re-run scripts/verify-safe.ts for the VERIFIED 4/7 milestone. Evidence:
 *  audit-work/v5/SAFE-VERIFICATION.md + safe-verification.json
 *  (Monad block 72,421,819 / Arc block 68,031,046). */
export const GENESIS_RESERVE_SAFE = "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0" as const;

/** §20.1 step 1 — the protocol deposits 1,100,000 USDC (10% above the
 *  1,000,000 MTQ to be minted, so genesis RR = 1.10). */
export const GENESIS_DEPOSIT_USDC = 1_100_000;
/** §20.1 step 5 — 1,000,000 MTQ minted to the Genesis Reserve Safe. */
export const GENESIS_MINT_MTQ = 1_000_000;
/** §20.1 step 3 — the chain-linked index starts at exactly 1.0000. */
export const INDEX_BASE_DENOMINATOR = 1.0;

/** The seven base fixings frozen at genesis (P_i,0). USD is the base unit
 *  (1.0). The remaining fixings are the market rates observed at the genesis
 *  block; the engine's BASE_FIXINGS (blueprint.ts / chain-index.ts) carries
 *  the deployed pilot values. */
export interface IndexBaseFixings {
  USD: number;
  EUR: number;
  JPY: number;
  GBP: number;
  CNY: number;
  CHF: number;
  XAU: number; // gold price reference unit (USD per troy oz at base date)
}

export interface GenesisStepLog {
  step: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  name: string;
  detail: string;
  event?: string;
}

export interface GenesisResult {
  ok: boolean;
  steps: GenesisStepLog[];
  basketAllocations: { component: string; weightPct: number; usdAmount: number }[];
  indexBaseDenominator: number;
  genesisVerificationEvent: {
    denominator: number;
    fixings: IndexBaseFixings;
  } | null;
  genesisCompletedEvent: { mtqMinted: number; safe: string } | null;
  reason?: string;
}

/** verifyIndexBase() — SUPERSEDES the audit-flagged verifyGFBBase(): checks
 *  ALL SEVEN base fixings are present, positive, and finite before the base
 *  denominator may be frozen at 1.0000. */
export function verifyIndexBase(fixings: IndexBaseFixings): { ok: boolean; reason?: string } {
  const entries: [keyof IndexBaseFixings, number][] = [
    ["USD", fixings.USD], ["EUR", fixings.EUR], ["JPY", fixings.JPY],
    ["GBP", fixings.GBP], ["CNY", fixings.CNY], ["CHF", fixings.CHF],
    ["XAU", fixings.XAU],
  ];
  for (const [name, value] of entries) {
    if (value == null || !Number.isFinite(value) || value <= 0) {
      return { ok: false, reason: `verifyIndexBase: fixing ${name} is ${value} — must be a positive finite number (OD-33; supersedes verifyGFBBase)` };
    }
  }
  return { ok: true };
}

/** A registered-set genesis component: display label + fractional weight
 *  (M8-3a — genesis over a REGISTERED SET, the registry-era replacement of
 *  the fixed 7-entry literal prior; see constituency/registry.ts
 *  genesisComponentsFromRegistry, which produces this payload from the
 *  registry's ACTIVE membership). */
export interface RegisteredGenesisComponent {
  label: string;
  weight: number;
}

/** Options for executeGenesisSequence (M8-3a). Omitted ⇒ the LITERAL
 *  seven-component strategic-prior default, byte-identical to the pre-M8-3a
 *  behavior. */
export interface GenesisSequenceOptions {
  /** Genesis over a registered set: the ACTIVE membership of a constituency
   *  registry snapshot (constituency/registry.ts). The set must be non-empty,
   *  labels unique, every weight ≥ 0 and finite, and Σ weights = 1 within the
   *  1e-9 tolerance (the same tolerance the literal genesis check uses). The
   *  default registry's ACTIVE set (7 members at the STRATEGIC_PRIOR weights)
   *  reproduces the literal default exactly. */
  registeredSet?: RegisteredGenesisComponent[];
}

/** The §20.1 seven-step genesis sequence (Ext-3 A.3 / OD-33 / T-85).
 *
 *   1. Transfer 1,100,000 USDC from deployer to the contract.
 *   2. Atomically swap the deposit into the seven-component basket per the
 *      strategic prior (27/20/9/8/5/5/26).
 *   3. Compute and store INDEX_BASE_DENOMINATOR = 1.0000 (from the seven
 *      base fixings).
 *   4. Emit GenesisVerification with the denominator and all fixings.
 *   5. Mint 1,000,000 MTQ to the Genesis Reserve Safe.
 *   6. Recompute the reserve state.
 *   7. Set genesisComplete = true; emit GenesisCompleted.
 *
 * M8-3a (2026-10-23, owner-delegated): step 2 additionally supports GENESIS
 * OVER A REGISTERED SET (options.registeredSet — the ACTIVE membership of a
 * constituency-registry snapshot, e.g. after evidence-checked lifecycle
 * transitions). The LITERAL seven-component default is kept EXACTLY as-is:
 * with no options the allocations, validation, and step-log text are
 * byte-identical to the pre-M8-3a sequence.
 */
export function executeGenesisSequence(fixings: IndexBaseFixings, options: GenesisSequenceOptions = {}): GenesisResult {
  const steps: GenesisStepLog[] = [];
  const fail = (reason: string): GenesisResult => ({
    ok: false, steps, basketAllocations: [], indexBaseDenominator: 0,
    genesisVerificationEvent: null, genesisCompletedEvent: null, reason,
  });

  // Step 1 — deposit.
  steps.push({
    step: 1, name: "Genesis deposit",
    detail: `Transfer ${GENESIS_DEPOSIT_USDC.toLocaleString("en-US")} USDC from the deployer to the reserve contract (10% above the ${GENESIS_MINT_MTQ.toLocaleString("en-US")} MTQ to be minted → genesis RR = 1.10).`,
  });

  // Step 2 — atomic basket swap.
  // M8-3a: default = the literal SEVEN-component strategic prior (unchanged);
  // options.registeredSet = genesis over a REGISTERED SET (registry ACTIVE
  // membership), validated against the same 1e-9 sum tolerance.
  const usingRegisteredSet = options.registeredSet != null;
  const priorComponents: { key: keyof typeof STRATEGIC_PRIOR; label: string }[] = [
    { key: "USD", label: "USD" }, { key: "EUR", label: "EUR" }, { key: "JPY", label: "JPY" },
    { key: "GBP", label: "GBP" }, { key: "CNY", label: "CNY" }, { key: "CHF", label: "CHF" },
    { key: "Gold", label: "Gold" },
  ];
  let basketAllocations: GenesisResult["basketAllocations"];
  if (usingRegisteredSet) {
    const set = options.registeredSet!;
    if (set.length === 0) {
      return fail("registeredSet is empty — genesis requires at least one ACTIVE component (registry-membership check).");
    }
    const seenLabels = new Set<string>();
    for (const c of set) {
      if (seenLabels.has(c.label)) {
        return fail(`registeredSet contains duplicate component label ${c.label} — registry identifiers are never reused.`);
      }
      seenLabels.add(c.label);
      if (!Number.isFinite(c.weight) || c.weight < 0) {
        return fail(`registeredSet component ${c.label} has invalid weight ${c.weight}.`);
      }
    }
    const registeredSum = set.reduce((a, c) => a + c.weight, 0);
    if (Math.abs(registeredSum - 1) > 1e-9) {
      return fail(`registeredSet weights sum to ${registeredSum}, not 1 — genesis aborts (registered-set basket check).`);
    }
    basketAllocations = set.map((c) => ({
      component: c.label,
      weightPct: c.weight * 100,
      usdAmount: GENESIS_DEPOSIT_USDC * c.weight,
    }));
  } else {
    const weightSum = priorComponents.reduce((a, c) => a + STRATEGIC_PRIOR[c.key], 0);
    if (Math.abs(weightSum - 1) > 1e-9) {
      return fail(`Strategic prior weights sum to ${weightSum}, not 1 — genesis aborts (seven-component basket check).`);
    }
    basketAllocations = priorComponents.map((c) => ({
      component: c.label,
      weightPct: STRATEGIC_PRIOR[c.key] * 100,
      usdAmount: GENESIS_DEPOSIT_USDC * STRATEGIC_PRIOR[c.key],
    }));
  }
  steps.push({
    step: 2, name: "Atomic basket swap",
    detail: usingRegisteredSet
      ? `Swap the deposit into the ${options.registeredSet!.length}-component basket per the REGISTERED SET (constituency registry ACTIVE membership): ${basketAllocations.map((b) => `${b.component} ${b.weightPct}%`).join(" · ")} (single atomic transaction — any leg failure reverts the whole swap).`
      : `Swap the deposit into the seven-component basket per the Strategic Prior: ${basketAllocations.map((b) => `${b.component} ${b.weightPct}%`).join(" · ")} (single atomic transaction — any leg failure reverts the whole swap).`,
  });

  // Step 3 — base denominator from the SEVEN base fixings (verifyIndexBase).
  const verified = verifyIndexBase(fixings);
  if (!verified.ok) return fail(verified.reason ?? "verifyIndexBase failed");
  steps.push({
    step: 3, name: "Freeze INDEX_BASE_DENOMINATOR",
    detail: `verifyIndexBase() checked all seven fixings (USD ${fixings.USD}, EUR ${fixings.EUR}, JPY ${fixings.JPY}, GBP ${fixings.GBP}, CNY ${fixings.CNY}, CHF ${fixings.CHF}, XAU ${fixings.XAU}) — INDEX_BASE_DENOMINATOR stored at ${INDEX_BASE_DENOMINATOR.toFixed(4)} (chain-linked index I_t/I_base starts at 1.0000; PAR = 1 basket-unit is a unit-of-account convention, NOT a $1 peg).`,
  });

  // Step 4 — GenesisVerification event.
  steps.push({
    step: 4, name: "Emit GenesisVerification",
    detail: `GenesisVerification(denominator=${INDEX_BASE_DENOMINATOR.toFixed(4)}, fixings=[all seven]) published with the base-fixings hash for independent recomputation.`,
    event: "GenesisVerification",
  });

  // Step 5 — mint to the Genesis Reserve Safe.
  steps.push({
    step: 5, name: "Mint genesis supply",
    detail: `Mint ${GENESIS_MINT_MTQ.toLocaleString("en-US")} MTQ to the Genesis Reserve Safe ${GENESIS_RESERVE_SAFE}. OD-35 ON-CHAIN VERIFICATION (2026-10-19): the Safe is v1.4.1 but 1/1 deployer-controlled (threshold=1, sole owner = deployer EOA, nonce 0, no modules/guard) — a CRITICAL finding; the mandated 4/7 configuration must be set before genesis funds are ever custodied there. Genesis supply is LOCKED: never counted in circulating supply, never used for profit or operations, only for emergency reserve replenishment.`,
  });

  // Step 6 — recompute reserve state.
  steps.push({
    step: 6, name: "Recompute reserve state",
    detail: `Recompute holdings, haircut NAV (= ${GENESIS_DEPOSIT_USDC.toLocaleString("en-US")} minus genesis haircuts), RR = 1.10 target, LCR, and persist the first Daily State Vector.`,
  });

  // Step 7 — genesisComplete + GenesisCompleted.
  steps.push({
    step: 7, name: "Seal genesis",
    detail: `genesisComplete = true; GenesisCompleted emitted. Subsequent index updates are chain-linked against the frozen base (no re-basing without 7/7 Constitutional Council + 90-day timelock).`,
    event: "GenesisCompleted",
  });

  return {
    ok: true,
    steps,
    basketAllocations,
    indexBaseDenominator: INDEX_BASE_DENOMINATOR,
    genesisVerificationEvent: { denominator: INDEX_BASE_DENOMINATOR, fixings },
    genesisCompletedEvent: { mtqMinted: GENESIS_MINT_MTQ, safe: GENESIS_RESERVE_SAFE },
  };
}
