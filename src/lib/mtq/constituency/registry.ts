// ============================================================================
// MTQΣ — Dynamic currency-constituency engine — the COMPONENT REGISTRY (spec §2)
// ============================================================================
// Task M8-3a (2026-10-23, owner-delegated): the registry-based basket-membership
// model that replaces the "constituency is STATIC" design gap
// (RESULTS.md §2.2 item 1 — currency.ts:5-23 static union; the display union
// is KEPT for display/FX typing, membership is THIS registry).
//
// Provenance: Map-keyed stable-string-ID registry model ported from the
//   validated prototype (audit-work/task13/evidence/dynamic-replacement/
//   constituency-lifecycle.ts:439-460, 552-579 — the MANDATE-007 §3 6-member-
//   universe probe proved there are NO fixed-size arrays, NO slot positions,
//   and NO identifier reuse anywhere in the shared paths).
//
// REGISTRY INVARIANTS (spec §2 + validation doc §6 "no silent position
//   assignment, no currency-identifier reuse"):
//   * keyed by STABLE STRING IDs in a Map — membership can grow and shrink at
//     runtime; the count is never a compile-time constant;
//   * registryId (uint) and stable ID are NEVER recycled or reused — the
//     register() path hard-throws on any reuse (prototype: "component IDs are
//     never recycled", constituency-lifecycle.ts:555);
//   * T1 (nomination → CANDIDATE, spec §3) is the register() path: a nomination
//     REQUIRES a provenance dossier reference (spec §3 T1 evidence row).
//
// DEFAULT STATE = THE 7-COMPONENT GENESIS SET (byte-identical to today):
//   USD/EUR/JPY/GBP/CNY/CHF/Gold at the current STRATEGIC_PRIOR weights
//   (27/20/9/8/5/5/26 → 2700/2000/900/800/500/500/2600 bp), with the FIXED
//   blueprint arrays as the DEFAULT GENESIS DATA: envelopes from
//   ADMISSIBILITY_ENVELOPES (blueprint.ts:78-86), velocity classes from
//   MAX_VELOCITY (blueprint.ts:241-244), base fixings from BASE_FIXINGS
//   (blueprint.ts:55-62), prior weights from STRATEGIC_PRIOR
//   (blueprint.ts:22-30). Out-of-the-box engine behavior is therefore
//   unchanged; NO governance directive has ever been applied ⇒ NO transition
//   has run (quiescent by default — the machinery exists but never fires
//   without evidence-checked directives).
//
// CLIENT-BUNDLE SAFETY: this module is deliberately free of node:crypto and
//   of the lifecycle engine — it is importable from client components via
//   chain-index.ts. Digests (registry content version) live in
//   serialization.ts / engine.ts (server/test only).
//
// ALL parameters referenced here are UNAPPROVED DRAFT (spec §13); envelope and
// velocity values are the CARRIED CONSTITUTIONAL blueprint defaults (§5.2:
// "current values as starting point" — D-13.11/constitutional, OPEN).
// ============================================================================

import {
  ADMISSIBILITY_ENVELOPES,
  BASE_FIXINGS,
  MAX_VELOCITY,
  STRATEGIC_PRIOR,
} from "../blueprint";
import type { LifecycleState } from "./types";

/** Component type (spec §2 registry schema). GPP_LEG exists in the schema for
 *  the D-13.13 Option-A case; no such record is registered today. */
export type ComponentType = "FIAT" | "COMMODITY_XAU" | "GPP_LEG";

/** One registry record (spec §2 field groups: identity / pricing / weights /
 *  lifecycle / governance). Per-component values default to the FIXED
 *  blueprint genesis arrays (the registry-era replacement of the fixed
 *  uint256[7] envelope/velocity lookups — spec §5.2). */
export interface ComponentRegistryEntry {
  /** Stable uint registry identifier — NEVER recycled, never reused. */
  registryId: number;
  /** Stable string component ID — the Map key, the tie-break input (spec §5.3
   *  ascending-lexicographic order), and the identity that never points at a
   *  different component. */
  id: string;
  displayCode: string;
  name: string;
  componentType: ComponentType;
  /** Bridge to the FIXED 7-label MASE domain (mase.ts:10-11). Genesis members
   *  carry their historical optimizer label; a post-genesis admission carries
   *  null until the MASE domain change (spec §6 item 1 / RESULTS §2.3 Phase 2
   *  — GATED, not done in M8-3a; see mase.ts registryMaseDomain). */
  maseLabel: string | null;
  status: LifecycleState;
  /** Approved [w_min, w_max] envelope — applies to ACTIVE components only
   *  (spec §5.2; excluded ⇒ exactly 0, spec §5.4 — exclusion wins over any
   *  floor). */
  envelope: { min: number; max: number };
  /** Velocity class Δ_i (per accepted update) — REGISTRY DATA carried from
   *  blueprint MAX_VELOCITY. The lifecycle engine currently enforces the
   *  single §13 draft Δ (parameters.ts VELOCITY_PER_PERIOD_DRAFT —
   *  PROTOTYPE-CHOICE carried from the validated prototype); per-component
   *  enforcement is a D-13.14 decision that remains OPEN. */
  velocityPerPeriod: number;
  /** P_{i,0} — the immutable base fixing (USD price per unit at the base
   *  date; XAU = USD per troy ounce). Carried from blueprint BASE_FIXINGS. */
  baseFixing: number;
  /** Genesis weight in bp (the STRATEGIC_PRIOR share × 10000). */
  genesisWeightBp: number;
  /** T1/T9 evidence: the provenance dossier reference (required for any
   *  non-genesis registration; genesis records carry the pilot-basket ref). */
  dossierRef: string | null;
}

/** Genesis-set dossier reference (the pilot basket's published methodology:
 * blueprint STRATEGIC_PRIOR/ADMISSIBILITY_ENVELOPES — Master Blueprint v1.0). */
export const GENESIS_DOSSIER_REF = "GENESIS-PILOT-BASKET-v1.0 (blueprint.ts STRATEGIC_PRIOR/ADMISSIBILITY_ENVELOPES/BASE_FIXINGS/MAX_VELOCITY)";

/** Map-keyed registry — no fixed-size arrays, no slot positions, no ID reuse.
 *  Prototype model: constituency-lifecycle.ts:552-579. */
export class ComponentRegistry {
  private readonly byId = new Map<string, ComponentRegistryEntry>();
  private readonly usedRegistryIds = new Set<number>();

  constructor(entries: ComponentRegistryEntry[] = []) {
    for (const e of entries) this.register(e);
  }

  /** Register a component (spec §3 T1 = nomination → CANDIDATE; spec §2
   *  uniqueness invariants). Throws on ANY identifier reuse — registry IDs are
   *  never recycled (prototype: constituency-lifecycle.ts:555). A non-genesis
   *  nomination REQUIRES a provenance dossier (spec §3 T1 evidence row). */
  register(entry: ComponentRegistryEntry): void {
    if (this.byId.has(entry.id)) {
      throw new Error(`ComponentRegistry: stable ID ${entry.id} is already registered — component IDs are never reused`);
    }
    if (this.usedRegistryIds.has(entry.registryId)) {
      throw new Error(`ComponentRegistry: registryId ${entry.registryId} reused — component IDs are never recycled`);
    }
    if (entry.dossierRef == null) {
      throw new Error(`ComponentRegistry: registration of ${entry.id} requires a provenance dossier reference (spec §3 T1 evidence row)`);
    }
    if (entry.envelope.min < 0 || entry.envelope.max <= 0 || entry.envelope.min > entry.envelope.max) {
      throw new Error(`ComponentRegistry: invalid envelope for ${entry.id}: [${entry.envelope.min}, ${entry.envelope.max}]`);
    }
    this.usedRegistryIds.add(entry.registryId);
    this.byId.set(entry.id, { ...entry, envelope: { ...entry.envelope } });
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  /** Strict lookup — throws on unknown ID (fail-closed; no silent default). */
  get(id: string): ComponentRegistryEntry {
    const e = this.byId.get(id);
    if (!e) throw new Error(`ComponentRegistry: unknown component ${id}`);
    return e;
  }

  tryGet(id: string): ComponentRegistryEntry | undefined {
    return this.byId.get(id);
  }

  /** All stable IDs, ascending (deterministic ordering — also the §5.3
   *  tie-break order). */
  ids(): string[] {
    return [...this.byId.keys()].sort();
  }

  /** Snapshot of all records, sorted by stable ID (registry version input). */
  entries(): ComponentRegistryEntry[] {
    return this.ids().map((id) => ({ ...this.get(id), envelope: { ...this.get(id).envelope } }));
  }

  /** Components whose current lifecycle state is ACTIVE (spec §3: ACTIVE =
   *  the optimization domain; ELIGIBLE is a queue state, not in the basket). */
  activeIds(): string[] {
    return this.ids().filter((id) => this.get(id).status === "ACTIVE");
  }

  /** States that may hold weight > 0 (spec §3 state matrix: ACTIVE, WATCH,
   *  RETIRING — decaying — and EMERGENCY-SUSPENDED frozen at the suspension
   *  value; all others are exactly 0). */
  weightBearingIds(): string[] {
    return this.ids().filter((id) => {
      const s = this.get(id).status;
      return s === "ACTIVE" || s === "WATCH" || s === "RETIRING" || s === "EMERGENCY-SUSPENDED";
    });
  }

  statusOf(id: string): LifecycleState {
    return this.get(id).status;
  }

  countByStatus(state: LifecycleState): number {
    return this.ids().filter((id) => this.get(id).status === state).length;
  }

  /** Governance-only status update path. The lifecycle engine records every
   *  transition in its append-only ledger (engine.ts TransitionRecord); this
   *  low-level mutator exists so a committed run can be reflected in the
   *  registry — it is NOT a rule engine and must never be used to bypass the
   *  evidence-checked transitions. */
  applyStatus(id: string, status: LifecycleState): void {
    this.get(id); // fail-closed on unknown ID
    this.byId.set(id, { ...this.get(id), status });
  }

  size(): number {
    return this.byId.size;
  }
}

// ---------------------------------------------------------------------------
// The default genesis universe — THE 7-COMPONENT PILOT BASKET.
// The FIXED blueprint arrays are the DEFAULT GENESIS DATA (gap item 5 of
// RESULTS.md §2.2: registry-driven lookups with blueprint.ts:22-30 / 55-62 /
// 78-96 / 241-244 as the carried defaults):
//   * prior weight → STRATEGIC_PRIOR (27/20/9/8/5/5/26 → bp below);
//   * envelope → ADMISSIBILITY_ENVELOPES (23-32 / 17-24 / 7-12 / 6-11 / 3-7 /
//     3-7 / 20-32 percent);
//   * velocity → MAX_VELOCITY (0.50 / 0.50 / 0.30 / 0.30 / 0.20 / 0.20 / 0.50
//     percent per accepted update);
//   * base fixing → BASE_FIXINGS (1.0 / 1.05 / 0.0067 / 1.25 / 0.14 / 1.13 /
//     2500 — USD per unit, XAU per troy ounce).
// Stable IDs use the validated prototype's CCY-<code> scheme (the ascending-
// lexicographic tie-break input, spec §5.3).
// ---------------------------------------------------------------------------
function bpOf(fraction: number): number {
  return Math.round(fraction * 10000);
}

export const GENESIS_REGISTRY_ENTRIES: ComponentRegistryEntry[] = [
  {
    registryId: 1,
    id: "CCY-USD",
    displayCode: "USD",
    name: "US Dollar",
    componentType: "FIAT",
    maseLabel: "USD",
    status: "ACTIVE",
    envelope: { min: ADMISSIBILITY_ENVELOPES.USD.lower, max: ADMISSIBILITY_ENVELOPES.USD.upper },
    velocityPerPeriod: MAX_VELOCITY.USD,
    baseFixing: 1.0,
    genesisWeightBp: bpOf(STRATEGIC_PRIOR.USD),
    dossierRef: GENESIS_DOSSIER_REF,
  },
  {
    registryId: 2,
    id: "CCY-EUR",
    displayCode: "EUR",
    name: "Euro",
    componentType: "FIAT",
    maseLabel: "EUR",
    status: "ACTIVE",
    envelope: { min: ADMISSIBILITY_ENVELOPES.EUR.lower, max: ADMISSIBILITY_ENVELOPES.EUR.upper },
    velocityPerPeriod: MAX_VELOCITY.EUR,
    baseFixing: BASE_FIXINGS.EUR_USD,
    genesisWeightBp: bpOf(STRATEGIC_PRIOR.EUR),
    dossierRef: GENESIS_DOSSIER_REF,
  },
  {
    registryId: 3,
    id: "CCY-JPY",
    displayCode: "JPY",
    name: "Japanese Yen",
    componentType: "FIAT",
    maseLabel: "JPY",
    status: "ACTIVE",
    envelope: { min: ADMISSIBILITY_ENVELOPES.JPY.lower, max: ADMISSIBILITY_ENVELOPES.JPY.upper },
    velocityPerPeriod: MAX_VELOCITY.JPY,
    baseFixing: BASE_FIXINGS.JPY_USD,
    genesisWeightBp: bpOf(STRATEGIC_PRIOR.JPY),
    dossierRef: GENESIS_DOSSIER_REF,
  },
  {
    registryId: 4,
    id: "CCY-GBP",
    displayCode: "GBP",
    name: "British Pound",
    componentType: "FIAT",
    maseLabel: "GBP",
    status: "ACTIVE",
    envelope: { min: ADMISSIBILITY_ENVELOPES.GBP.lower, max: ADMISSIBILITY_ENVELOPES.GBP.upper },
    velocityPerPeriod: MAX_VELOCITY.GBP,
    baseFixing: BASE_FIXINGS.GBP_USD,
    genesisWeightBp: bpOf(STRATEGIC_PRIOR.GBP),
    dossierRef: GENESIS_DOSSIER_REF,
  },
  {
    registryId: 5,
    id: "CCY-CNY",
    displayCode: "CNY",
    name: "Chinese Yuan",
    componentType: "FIAT",
    maseLabel: "CNY",
    status: "ACTIVE",
    envelope: { min: ADMISSIBILITY_ENVELOPES.CNY.lower, max: ADMISSIBILITY_ENVELOPES.CNY.upper },
    velocityPerPeriod: MAX_VELOCITY.CNY,
    baseFixing: BASE_FIXINGS.CNY_USD,
    genesisWeightBp: bpOf(STRATEGIC_PRIOR.CNY),
    dossierRef: GENESIS_DOSSIER_REF,
  },
  {
    registryId: 6,
    id: "CCY-CHF",
    displayCode: "CHF",
    name: "Swiss Franc",
    componentType: "FIAT",
    maseLabel: "CHF",
    status: "ACTIVE",
    envelope: { min: ADMISSIBILITY_ENVELOPES.CHF.lower, max: ADMISSIBILITY_ENVELOPES.CHF.upper },
    velocityPerPeriod: MAX_VELOCITY.CHF,
    baseFixing: BASE_FIXINGS.CHF_USD,
    genesisWeightBp: bpOf(STRATEGIC_PRIOR.CHF),
    dossierRef: GENESIS_DOSSIER_REF,
  },
  {
    registryId: 7,
    id: "CCY-XAU",
    displayCode: "XAU",
    name: "Gold (troy oz)",
    componentType: "COMMODITY_XAU",
    maseLabel: "Gold",
    status: "ACTIVE",
    envelope: { min: ADMISSIBILITY_ENVELOPES.Gold.lower, max: ADMISSIBILITY_ENVELOPES.Gold.upper },
    velocityPerPeriod: MAX_VELOCITY.Gold,
    baseFixing: BASE_FIXINGS.XAU_USD,
    genesisWeightBp: bpOf(STRATEGIC_PRIOR.Gold),
    dossierRef: GENESIS_DOSSIER_REF,
  },
];

/** Fresh registry instance initialized to the genesis 7 (pure data — no
 *  transitions, no directives, no ledger). */
export function createGenesisConstituencyRegistry(): ComponentRegistry {
  return new ComponentRegistry(GENESIS_REGISTRY_ENTRIES);
}

/** The default production registry — THE module-level engine state.
 *  QUIESCENT BY DEFAULT: initialized to the 7-component genesis set; NO
 *  governance directive has ever been applied, so NO transition has run and
 *  every member holds its genesis weight. Out-of-the-box engine behavior is
 *  byte-identical to the pre-M8-3a fixed-7 engine. */
export const DEFAULT_REGISTRY: ComponentRegistry = createGenesisConstituencyRegistry();

/** ACTIVE membership count of the default registry — 7 for the genesis set.
 *  chain-index.ts initChainIndex uses this as its default expected length
 *  (registry-membership-length validation replacing the fixed `!== 7` throw —
 *  M8-3a gap item 2). */
export function defaultActiveBasketCount(): number {
  return DEFAULT_REGISTRY.activeIds().length;
}

/** Default genesis weights in bp, keyed by stable ID (2700/2000/900/800/500/
 *  500/2600 — sums to exactly 10000). */
export function defaultGenesisWeightsBp(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of DEFAULT_REGISTRY.entries()) out[e.id] = e.genesisWeightBp;
  return out;
}

/** Genesis-over-registered-set payload for genesis.ts
 *  (executeGenesisSequence's registeredSet option): the ACTIVE members'
 *  display labels + fractional weights, ordered by stable ID. For the default
 *  registry this reproduces the literal 7-entry genesis exactly. */
export function genesisComponentsFromRegistry(
  registry: ComponentRegistry = DEFAULT_REGISTRY,
): Array<{ label: string; weight: number }> {
  return registry.activeIds().map((id) => {
    const e = registry.get(id);
    return { label: e.displayCode, weight: e.genesisWeightBp / 10000 };
  });
}

// ---------------------------------------------------------------------------
// Registry-driven lookups (RESULTS.md §2.2 gap item 5 — the registry-era
// replacement of the fixed per-component blueprint arrays; the fixed arrays
// remain the DEFAULT GENESIS DATA). All lookups are fail-closed on unknown
// IDs (no silent default weight, envelope, or velocity is ever invented).
// ---------------------------------------------------------------------------
export function lookupEnvelope(
  id: string,
  registry: ComponentRegistry = DEFAULT_REGISTRY,
): { min: number; max: number } {
  const e = registry.tryGet(id);
  if (!e) throw new Error(`lookupEnvelope: unknown component ${id} — envelope lookups are registry-driven, fail-closed`);
  return { ...e.envelope };
}

export function lookupVelocityPerPeriod(
  id: string,
  registry: ComponentRegistry = DEFAULT_REGISTRY,
): number {
  const e = registry.tryGet(id);
  if (!e) throw new Error(`lookupVelocityPerPeriod: unknown component ${id}`);
  return e.velocityPerPeriod;
}

export function lookupBaseFixing(
  id: string,
  registry: ComponentRegistry = DEFAULT_REGISTRY,
): number {
  const e = registry.tryGet(id);
  if (!e) throw new Error(`lookupBaseFixing: unknown component ${id}`);
  return e.baseFixing;
}

export function lookupGenesisWeightBp(
  id: string,
  registry: ComponentRegistry = DEFAULT_REGISTRY,
): number {
  const e = registry.tryGet(id);
  if (!e) throw new Error(`lookupGenesisWeightBp: unknown component ${id}`);
  return e.genesisWeightBp;
}
