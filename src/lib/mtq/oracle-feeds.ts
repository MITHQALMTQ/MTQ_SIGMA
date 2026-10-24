// ============================================================================
// MTQΣ — OD-34 Per-Chain On-Chain Oracle Feed CONFIGURATION Registry (Ext-3 A.4)
// ============================================================================
// SCOPE SPLIT (read before editing):
//   • src/lib/mtq/oracle.ts  — the RUNTIME 3-source consensus ENGINE (§9.2/§9.3
//     validation pipeline, §17.7 five-state feed machine, §17.8 heartbeat +
//     2×-staleness HALTED, §17.9 1.5%×3 correlation warning). It computes
//     prices at tick time and is NOT modified by this module.
//   • THIS FILE              — the machine-readable CONFIGURATION registry that
//     Ext-3 A.4 / OD-34 demands: which pairs exist, which source families are
//     REQUIRED per pair (§17.10, three INDEPENDENT families), which families
//     are ACTUALLY wired in the pilot shadow mode, which on-chain adapter
//     families are COMPILED, and which protocol-owner Oracle.sol deployments
//     exist per chain — every row labelled honestly (implemented / unverified /
//     deferred-G7 / policy-pending). No price computation, no engine logic,
//     no duplicated constants: staleness/confidence/deviation bounds are
//     IMPORTED from blueprint.ts (ORACLE_VALIDATION, §17.3.1–§17.3.3) and
//     every address is IMPORTED from contracts.ts. Ext-3 Part C: "The
//     developer must not do: ... Invent MASE, Mint/Redeem, Genesis, or Oracle
//     addresses."
//
// Mandate traceability:
//   Ext-3 A.4  "Oracle addresses and feed configuration per chain is missing
//              (Gate 2 blocker)" — the verbatim gap this registry answers.
//   OD-34      "Confirm oracle source addresses and feed configuration for
//              Monad Testnet and Arc Testnet. If real feeds are unavailable,
//              confirm the mock oracle strategy is acceptable for Gate 2
//              shadow mode." (Owner: Smart-contract lead + Risk Council.
//              Blocks: Gate 2.)
//   C-039      "Oracle addresses not specified" → resolved by OD-34.
//   T-86       "Oracle feed configuration — configured feeds read correctly;
//              staleness/confidence/deviation checks applied; mock oracles
//              behave as expected for Gate 2." (T-86's runtime checks live in
//              oracle.ts + the canonical suite; this registry is the
//              configuration surface they read.)
//   Blueprint §17.10 — three independent source families per pair; families
//              must not all derive from the same underlying market; per-pair
//              addresses needed for EUR/USD, GBP/USD, JPY/USD, CNY/USD,
//              CHF/USD, PAXG/XAU, VIX, DXY; staleness 60s major FX + gold,
//              120s minor FX + VIX + DXY.
//   Blueprint §17.3.1–§17.3.3 — per-class staleness/confidence bounds and the
//              2.5% deviation breaker (imported below — never re-declared).
//   Blueprint §17.7–§17.9 — five-state feed enum (VALID/DEGRADED/STALE/
//              OUTLIER/HALTED), §17.8 heartbeat + isFeedAlive, §17.9
//              correlation warning — RUNTIME behavior owned by oracle.ts;
//              this registry cites them but implements none of them.
//   Blueprint §9.7.4 — USD is the unit of account, price 1.0 by construction
//              (basis for the USDC/USD construct treatment).
//
// HONEST POSTURE (label discipline — no production-readiness claims):
//   • On-chain adapters (contracts/adapters/*.sol) are COMPILED but NOT
//     deployed by us; no provider feed address is configured anywhere here.
//   • The two protocol-owner Oracle.sol deployments (Monad + Arc) have an
//     UNPUBLISHED ABI — whether they serve real or mock feeds is UNVERIFIED (the exact
//     Ext-3 A.4 question); codeStatus stays "existence-unverified" until the
//     orchestrator folds in the parallel eth_getCode probe JSON.
//   • The pilot's Gate 2 shadow mode prices from OFF-CHAIN families
//     (Frankfurter ECB, gold-api.com, FRED/Yahoo) — Ext-3 A.4 accepts the
//     mock-oracle strategy for Gate 2; §17.10 three-independent-family
//     compliance is NOT met in the pilot.
//   • Solana devnet is deferred-G7 (Pyth + Jupiter fallback per Ext-3 A.4).
// ============================================================================

import {
  ORACLE_CORRELATION_THRESHOLD,
  ORACLE_CORRELATION_WARNING_AFTER,
  ORACLE_VALIDATION,
} from "./blueprint";
import type { FeedClass } from "./oracle";
import {
  ARC_TESTNET,
  DEPLOYER_WALLET,
  MONAD_TESTNET,
  SOLANA_DEVNET,
} from "./contracts";
import type { ChainInfo, ContractEntry } from "./contracts";

// ---------------------------------------------------------------------------
// §17.3 constants — IMPORTED from blueprint.ts (ms stored there → seconds here)
// ---------------------------------------------------------------------------

/** §17.3.1 staleness threshold for a feed class, in SECONDS (blueprint stores ms). */
const stalenessSecondsFor = (feedClass: FeedClass): number =>
  ORACLE_VALIDATION.STALENESS_MS[feedClass] / 1000;

/** §17.3.2 confidence full-width ceiling for a feed class (fraction of price). */
const confidenceMaxPctFor = (feedClass: FeedClass): number =>
  ORACLE_VALIDATION.CONFIDENCE_MAX_PCT[feedClass];

// ---------------------------------------------------------------------------
// §17.10 required source families (shared by the eight §17.10-listed pairs)
// ---------------------------------------------------------------------------

/**
 * §17.10 / §9.1: three INDEPENDENT source families are required per pair —
 * "not all derived from same underlying market". These are the families the
 * Master Blueprint names as the consensus set (§9.1: Chainlink primary,
 * Pyth high-frequency, Chronicle verifiable). Required ≠ wired: the honest
 * wiring status per family lives in `onChainAdapterFamilies` / `pilotFamilies`.
 */
export interface RequiredSourceFamily {
  family: string;
  role: string;
  independence: string;
  status: "required-§17.10" | "candidate-policy-pending";
}

const SECTION_17_10_REQUIRED_FAMILIES: RequiredSourceFamily[] = [
  {
    family: "Chainlink",
    role: "primary aggregated decentralized oracle network (§9.1 primary)",
    independence: "independent oracle-node-network family",
    status: "required-§17.10",
  },
  {
    family: "Pyth",
    role: "high-frequency pull-based oracle (§9.1)",
    independence: "independent publisher/attestor family",
    status: "required-§17.10",
  },
  {
    family: "Chronicle",
    role: "verifiable oracle with on-chain proof (§9.1)",
    independence: "independent attestor family",
    status: "required-§17.10",
  },
];

// ---------------------------------------------------------------------------
// On-chain adapter families (compiled, NOT deployed by us)
// ---------------------------------------------------------------------------

/**
 * One compiled on-chain adapter family for a pair. The three Solidity
 * adapters (contracts/adapters/{Chainlink,Pyth,Chronicle}Adapter.sol) each
 * implement IOracleAdapter.getPrice(bytes32) → (price, timestamp, confidence)
 * normalized to 1e18. `providerFeedAddress` is NULL by design: OD-34 forbids
 * inventing oracle addresses, and which provider feeds exist on Monad/Arc
 * testnets is UNVERIFIED (Ext-3 A.4 asks verbatim: "Chainlink?
 * Pyth? Neither? Custom?").
 */
export interface OnChainAdapterFamily {
  family: "Chainlink" | "Pyth" | "Chronicle";
  adapterSource: string;
  status: "compiled-not-deployed";
  providerFeedAddress: null;
  availability: string;
}

const ADAPTER_AVAILABILITY_COMMON =
  "compiled in contracts/adapters (IOracleAdapter.getPrice(bytes32), 1e18-normalized); NO instance deployed by us on any chain and NO provider feed address configured — provider presence on Monad/Arc testnets is UNVERIFIED (Ext-3 A.4: 'Chainlink? Pyth? Neither? Custom?')";

/** The three compiled adapter families; `pairNote` appends per-pair honesty. */
function compiledAdapterFamilies(pairNote?: string): OnChainAdapterFamily[] {
  const append = pairNote ? ` ${pairNote}` : "";
  return [
    {
      family: "Chainlink",
      adapterSource: "contracts/adapters/ChainlinkAdapter.sol",
      status: "compiled-not-deployed",
      providerFeedAddress: null,
      availability: `${ADAPTER_AVAILABILITY_COMMON}${append}`,
    },
    {
      family: "Pyth",
      adapterSource: "contracts/adapters/PythAdapter.sol",
      status: "compiled-not-deployed",
      providerFeedAddress: null,
      availability: `${ADAPTER_AVAILABILITY_COMMON}${append}`,
    },
    {
      family: "Chronicle",
      adapterSource: "contracts/adapters/ChronicleAdapter.sol",
      status: "compiled-not-deployed",
      providerFeedAddress: null,
      availability: `${ADAPTER_AVAILABILITY_COMMON}${append}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Pilot families (actually wired for the Gate 2 shadow mode)
// ---------------------------------------------------------------------------

/** Honest wiring status of one pilot source family (fx.ts / fred.ts upstreams). */
export type PilotFamilyStatus =
  | "wired-live"
  | "wired-live-api-key-gated"
  | "simulated-fallback"
  | "construct-by-construction"
  | "not-wired"
  // Task-16 / 16b-011: the feed is wired and reachable but its data cannot
  // be trusted in unit terms — every observation is rejected by the sanity
  // bound and the labeled fallback constant is what actually feeds the engine.
  | "wired-unverified-rejected-by-sanity-bound";

export interface PilotFamily {
  family: string;
  upstream: string;
  role: string;
  status: PilotFamilyStatus;
}

// ---------------------------------------------------------------------------
// PerPairFeedConfig
// ---------------------------------------------------------------------------

/** Asset-class label for a feed pair (Ext-3 A.4 / §17.10 taxonomy). */
export type OracleAssetClass =
  | "fx-major" // EUR/USD, GBP/USD — §17.3.1 major FX (60s)
  | "fx-minor" // JPY/USD, CNY/USD, CHF/USD — §17.3.1 minor FX (120s)
  | "gold" // PAXG/XAU — §17.3.1 gold class (60s)
  | "volatility" // VIX
  | "index" // DXY
  | "stablecoin-construct"; // USDC/USD — special construct pair (Ext-3 A.4 Arc note)

/** Honest aggregate wiring status of a pair in the pilot (label discipline). */
export type PilotFeedStatus =
  | "off-chain-family-only" // single live off-chain upstream; consensus runs as synthetic witnesses (§17.10 3-family independence NOT met)
  | "off-chain-official-with-simulated-fallback" // official macro source primary + honest simulated last resort
  | "construct-arc-issuer-unwired-elsewhere"; // USDC/USD: 1.0 by construction on Arc; issuer oracle NOT wired on other chains

/**
 * OD-34 / Ext-3 A.4 / Blueprint §17.10 — per-pair feed CONFIGURATION.
 *
 * `pairId` MUST match the runtime ids of the consensus engine (oracle.ts):
 * the six board pairs ("EUR/USD", "GBP/USD", "JPY/USD", "CNY/USD",
 * "CHF/USD", "XAU/USD") run through buildOracleBoard / buildOracleConsensus;
 * VIX, DXY and USDC/USD are registry-only rows (macro signals / construct).
 * `stalenessSeconds` / `confidenceMaxPct` are DERIVED from the imported
 * ORACLE_VALIDATION table (blueprint §17.3.1/§17.3.2) via `feedClass` —
 * never re-invented here.
 */
export interface PerPairFeedConfig {
  /** Runtime pair id, aligned with oracle.ts board ids (e.g. "EUR/USD", "XAU/USD"). */
  pairId: string;
  /** §17.10 mandate-list id when it differs from the runtime id (Ext-3 A.4 lists "PAXG/XAU"). */
  mandateId?: string;
  displayName: string;
  assetClass: OracleAssetClass;
  /** Blueprint §17.3.1 feed class binding this pair to ORACLE_VALIDATION bounds (null = no class — construct pairs). */
  feedClass: FeedClass | null;
  /** §17.3.1 staleness threshold in seconds, derived from ORACLE_VALIDATION.STALENESS_MS (null = construct, no class). */
  stalenessSeconds: number | null;
  /** §17.3.2 confidence full-width ceiling, imported from ORACLE_VALIDATION (null = construct). */
  confidenceMaxPct: number | null;
  /** §17.3.3 deviation-from-median breaker (fraction), imported from ORACLE_VALIDATION.DEVIATION_MAX_PCT. */
  deviationMaxPct: number;
  /** True iff the pair runs through oracle.ts's runtime 6-pair consensus board (I9). */
  runtimeBoardPair: boolean;
  /** §17.10: ≥3 INDEPENDENT source families required for this pair. */
  requiredSourceFamilies: RequiredSourceFamily[];
  /** Families ACTUALLY wired in the pilot shadow mode, with names + honest status (may be < required — Gate 2 accepts). */
  pilotFamilies: PilotFamily[];
  /** On-chain adapter families compiled for this pair (contracts/adapters/) — NOT deployed by us. */
  onChainAdapterFamilies: OnChainAdapterFamily[];
  /** Honest aggregate wiring status (label discipline). */
  feedStatus: PilotFeedStatus;
  /** Honest one-line OD-34 determination (Ext-3 Part H step 9: "what feeds does each deployed Oracle.sol use? Mock or real?"). */
  honestDetermination: string;
}

// ---------------------------------------------------------------------------
// FEED_PAIRS — the eight §17.10 pairs + the USDC/USD construct
// ---------------------------------------------------------------------------

const FRANKFURTER_ROLE =
  "sole real price upstream for this pair in the pilot; the three labeled consensus feeds (CHAINLINK/PYTH/CHRONICLE) run as SYNTHETIC WITNESSES over it (honest-status disclosure D-oracle-witnesses). ECB reference rates publish ~daily (≈16:00 CET), so the 60s/120s staleness classes are exercised against the witness path, not the upstream's real publication cadence — disclosed.";

const OFF_CHAIN_DETERMINATION_TAIL =
  "§17.10 on-chain 3-independent-family compliance NOT met in the pilot; adapter deployment + provider feed address for this pair PENDING OD-34 (Smart-contract lead + Risk Council).";

export const FEED_PAIRS: PerPairFeedConfig[] = [
  {
    pairId: "EUR/USD",
    displayName: "Euro / US Dollar",
    assetClass: "fx-major",
    feedClass: "MAJOR_FX",
    stalenessSeconds: stalenessSecondsFor("MAJOR_FX"),
    confidenceMaxPct: confidenceMaxPctFor("MAJOR_FX"),
    deviationMaxPct: ORACLE_VALIDATION.DEVIATION_MAX_PCT,
    runtimeBoardPair: true,
    requiredSourceFamilies: SECTION_17_10_REQUIRED_FAMILIES,
    pilotFamilies: [
      {
        family: "Frankfurter — ECB euro foreign-exchange reference rates",
        upstream: "https://api.frankfurter.dev/v1/latest?base=USD (+ .app fallback)",
        role: FRANKFURTER_ROLE,
        status: "wired-live",
      },
    ],
    onChainAdapterFamilies: compiledAdapterFamilies(),
    feedStatus: "off-chain-family-only",
    honestDetermination: `PILOT (Gate 2 shadow, Ext-3 A.4-accepted): one live off-chain family (Frankfurter ECB) + 3-source synthetic-witness consensus in oracle.ts; ${OFF_CHAIN_DETERMINATION_TAIL}`,
  },
  {
    pairId: "GBP/USD",
    displayName: "Pound Sterling / US Dollar",
    assetClass: "fx-major",
    feedClass: "MAJOR_FX",
    stalenessSeconds: stalenessSecondsFor("MAJOR_FX"),
    confidenceMaxPct: confidenceMaxPctFor("MAJOR_FX"),
    deviationMaxPct: ORACLE_VALIDATION.DEVIATION_MAX_PCT,
    runtimeBoardPair: true,
    requiredSourceFamilies: SECTION_17_10_REQUIRED_FAMILIES,
    pilotFamilies: [
      {
        family: "Frankfurter — ECB euro foreign-exchange reference rates",
        upstream: "https://api.frankfurter.dev/v1/latest?base=USD (+ .app fallback)",
        role: FRANKFURTER_ROLE,
        status: "wired-live",
      },
    ],
    onChainAdapterFamilies: compiledAdapterFamilies(),
    feedStatus: "off-chain-family-only",
    honestDetermination: `PILOT (Gate 2 shadow, Ext-3 A.4-accepted): one live off-chain family (Frankfurter ECB) + 3-source synthetic-witness consensus in oracle.ts; ${OFF_CHAIN_DETERMINATION_TAIL}`,
  },
  {
    pairId: "JPY/USD",
    displayName: "Japanese Yen / US Dollar",
    assetClass: "fx-minor",
    feedClass: "MINOR_FX",
    stalenessSeconds: stalenessSecondsFor("MINOR_FX"),
    confidenceMaxPct: confidenceMaxPctFor("MINOR_FX"),
    deviationMaxPct: ORACLE_VALIDATION.DEVIATION_MAX_PCT,
    runtimeBoardPair: true,
    requiredSourceFamilies: SECTION_17_10_REQUIRED_FAMILIES,
    pilotFamilies: [
      {
        family: "Frankfurter — ECB euro foreign-exchange reference rates",
        upstream: "https://api.frankfurter.dev/v1/latest?base=USD (+ .app fallback)",
        role: `${FRANKFURTER_ROLE} Upstream quotes USD/JPY; fx.ts inverts to the per-unit-USD JPY/USD form the engine consumes.`,
        status: "wired-live",
      },
    ],
    onChainAdapterFamilies: compiledAdapterFamilies(),
    feedStatus: "off-chain-family-only",
    honestDetermination: `PILOT (Gate 2 shadow, Ext-3 A.4-accepted): one live off-chain family (Frankfurter ECB, USD/JPY inverted by fx.ts) + 3-source synthetic-witness consensus in oracle.ts; ${OFF_CHAIN_DETERMINATION_TAIL}`,
  },
  {
    pairId: "CNY/USD",
    displayName: "Chinese Yuan / US Dollar",
    assetClass: "fx-minor",
    feedClass: "MINOR_FX",
    stalenessSeconds: stalenessSecondsFor("MINOR_FX"),
    confidenceMaxPct: confidenceMaxPctFor("MINOR_FX"),
    deviationMaxPct: ORACLE_VALIDATION.DEVIATION_MAX_PCT,
    runtimeBoardPair: true,
    requiredSourceFamilies: SECTION_17_10_REQUIRED_FAMILIES,
    pilotFamilies: [
      {
        family: "Frankfurter — ECB euro foreign-exchange reference rates",
        upstream: "https://api.frankfurter.dev/v1/latest?base=USD (+ .app fallback)",
        role: FRANKFURTER_ROLE,
        status: "wired-live",
      },
    ],
    onChainAdapterFamilies: compiledAdapterFamilies(),
    feedStatus: "off-chain-family-only",
    honestDetermination: `PILOT (Gate 2 shadow, Ext-3 A.4-accepted): one live off-chain family (Frankfurter ECB) + 3-source synthetic-witness consensus in oracle.ts; ${OFF_CHAIN_DETERMINATION_TAIL}`,
  },
  {
    pairId: "CHF/USD",
    displayName: "Swiss Franc / US Dollar",
    assetClass: "fx-minor",
    feedClass: "MINOR_FX",
    stalenessSeconds: stalenessSecondsFor("MINOR_FX"),
    confidenceMaxPct: confidenceMaxPctFor("MINOR_FX"),
    deviationMaxPct: ORACLE_VALIDATION.DEVIATION_MAX_PCT,
    runtimeBoardPair: true,
    requiredSourceFamilies: SECTION_17_10_REQUIRED_FAMILIES,
    pilotFamilies: [
      {
        family: "Frankfurter — ECB euro foreign-exchange reference rates",
        upstream: "https://api.frankfurter.dev/v1/latest?base=USD (+ .app fallback)",
        role: FRANKFURTER_ROLE,
        status: "wired-live",
      },
    ],
    onChainAdapterFamilies: compiledAdapterFamilies(),
    feedStatus: "off-chain-family-only",
    honestDetermination: `PILOT (Gate 2 shadow, Ext-3 A.4-accepted): one live off-chain family (Frankfurter ECB) + 3-source synthetic-witness consensus in oracle.ts (CHF is a first-class board leg per audit fix D2 / I9); ${OFF_CHAIN_DETERMINATION_TAIL}`,
  },
  {
    pairId: "XAU/USD",
    mandateId: "PAXG/XAU",
    displayName: "PAXG / Gold (XAU) — canonical gold price",
    assetClass: "gold",
    feedClass: "GOLD",
    stalenessSeconds: stalenessSecondsFor("GOLD"),
    confidenceMaxPct: confidenceMaxPctFor("GOLD"),
    deviationMaxPct: ORACLE_VALIDATION.DEVIATION_MAX_PCT,
    runtimeBoardPair: true,
    requiredSourceFamilies: SECTION_17_10_REQUIRED_FAMILIES,
    pilotFamilies: [
      {
        family: "gold-api.com — XAU spot price",
        upstream: "https://api.gold-api.com/price/XAU",
        role: "sole real price upstream for the gold board leg ('XAU/USD' runtime id; §17.10 calls the pair 'PAXG/XAU'); consensus runs synthetic witnesses over it (D-oracle-witnesses).",
        status: "wired-live",
      },
      {
        family: "Yahoo Finance — PAXG-USD 24h traded volume",
        upstream: "https://query1/query2.finance.yahoo.com/v8/finance/chart/PAXG-USD",
        role: "auxiliary §11.4 pool-depth feed only (EQ-093) — NOT a price family for this pair. Task-16 finding 16b-011: the upstream's regularMarketVolume unit is UNVERIFIABLE for this instrument (measured 180.2M × ~$4,001/oz ≈ $721B 24h notional — impossible vs total tokenized-gold market cap ≪ $1B), so the fx.ts sanity bound (>$10k, <$10B on volume×price) rejects every observation and the LABELED $4M fallback constant (POOL_DEPTH_FALLBACK_USD) is what actually feeds §11.4. Conservative by design: rejection never fabricates depth.",
        status: "wired-unverified-rejected-by-sanity-bound",
      },
    ],
    onChainAdapterFamilies: compiledAdapterFamilies(),
    feedStatus: "off-chain-family-only",
    honestDetermination: `PILOT (Gate 2 shadow, Ext-3 A.4-accepted): one live off-chain price family (gold-api.com XAU spot; Yahoo PAXG volume feeds pool depth only) + synthetic-witness consensus in oracle.ts; ${OFF_CHAIN_DETERMINATION_TAIL}`,
  },
  {
    pairId: "VIX",
    displayName: "CBOE Volatility Index (VIX)",
    assetClass: "volatility",
    feedClass: "VIX_DXY",
    stalenessSeconds: stalenessSecondsFor("VIX_DXY"),
    confidenceMaxPct: confidenceMaxPctFor("VIX_DXY"),
    deviationMaxPct: ORACLE_VALIDATION.DEVIATION_MAX_PCT,
    runtimeBoardPair: false,
    requiredSourceFamilies: SECTION_17_10_REQUIRED_FAMILIES,
    pilotFamilies: [
      {
        family: "FRED — VIXCLS (CBOE VIX daily close)",
        upstream: "fred.ts (FRED_API_KEY-gated; Federal Reserve Economic Data)",
        role: "AUTHORITATIVE primary macro source; daily frequency, ~1 business day lag.",
        status: "wired-live-api-key-gated",
      },
      {
        family: "Yahoo Finance — ^VIX",
        upstream: "https://query1/query2.finance.yahoo.com/v8/finance/chart/%5EVIX",
        role: "live fallback when FRED is unavailable.",
        status: "wired-live",
      },
      {
        family: "Seeded Ornstein–Uhlenbeck walk",
        upstream: "fx.ts simulatedVix — deterministic per UTC day",
        role: "honest SIMULATED last resort, clearly labeled in the UI as a pilot macro signal.",
        status: "simulated-fallback",
      },
    ],
    onChainAdapterFamilies: compiledAdapterFamilies(
      "Additionally: no known on-chain VIX feed exists on either EVM testnet — the §17.10 per-pair on-chain address for VIX must come from the OD-34 confirmation, not from this registry (nothing invented).",
    ),
    feedStatus: "off-chain-official-with-simulated-fallback",
    honestDetermination:
      "PILOT: off-chain macro signal — FRED VIXCLS (official, daily-lag) primary, Yahoo ^VIX fallback, seeded OU-walk simulated last resort (fx.ts); NOT a runtime consensus-board pair — consumed by the §5 volatility proxy and regime classifier (disclosure D-regime-classifier: VIX 15/22/30 hard thresholds are a labeled PILOT APPROXIMATION); §17.10 on-chain feed config recorded here, but on-chain VIX feed availability is UNVERIFIED / plausibly absent.",
  },
  {
    pairId: "DXY",
    displayName: "ICE US Dollar Index (DXY)",
    assetClass: "index",
    feedClass: "VIX_DXY",
    stalenessSeconds: stalenessSecondsFor("VIX_DXY"),
    confidenceMaxPct: confidenceMaxPctFor("VIX_DXY"),
    deviationMaxPct: ORACLE_VALIDATION.DEVIATION_MAX_PCT,
    runtimeBoardPair: false,
    requiredSourceFamilies: SECTION_17_10_REQUIRED_FAMILIES,
    pilotFamilies: [
      {
        family: "FRED — DTWEXBGS (Fed Nominal Broad US Dollar Index)",
        upstream: "fred.ts (FRED_API_KEY-gated)",
        role: "AUTHORITATIVE primary macro source; daily frequency, ~1 business day lag.",
        status: "wired-live-api-key-gated",
      },
      {
        family: "Yahoo Finance — ^DX-Y.NYB (ICE US Dollar Index)",
        upstream: "https://query1/query2.finance.yahoo.com/v8/finance/chart/DX-Y.NYB",
        role: "live fallback — the canonical ICE DXY ticker.",
        status: "wired-live",
      },
      {
        family: "Frankfurter ECB self-calc — official DXY geometric formula",
        upstream: "50.14348112 × EURUSD^-0.576 × USDJPY^0.136 × GBPUSD^-0.119 × USDCAD^0.091 × USDSEK^0.042 × USDCHF^0.036",
        role: "secondary fallback computed from ECB rates (needs CAD/SEK/CHF from Frankfurter).",
        status: "wired-live",
      },
      {
        family: "Seeded Ornstein–Uhlenbeck walk",
        upstream: "fx.ts simulatedDxy — deterministic per UTC day",
        role: "honest SIMULATED last resort, clearly labeled in the UI as a pilot macro signal.",
        status: "simulated-fallback",
      },
    ],
    onChainAdapterFamilies: compiledAdapterFamilies(
      "Additionally: no known on-chain DXY feed exists on either EVM testnet — the §17.10 per-pair on-chain address for DXY must come from the OD-34 confirmation, not from this registry (nothing invented).",
    ),
    feedStatus: "off-chain-official-with-simulated-fallback",
    honestDetermination:
      "PILOT: off-chain macro signal — FRED DTWEXBGS (official, daily-lag) primary, Yahoo ^DX-Y.NYB fallback, Frankfurter ECB geometric self-calc, seeded OU-walk simulated last resort (fx.ts); NOT a runtime consensus-board pair — consumed by the regime classifier (D-regime-classifier: DXY 88/115 hard thresholds are a labeled PILOT APPROXIMATION); on-chain DXY feed availability is UNVERIFIED / plausibly absent.",
  },
  {
    // Ext-3 A.4 (Arc): "Arc uses USDC as native gas — the 'USDC/USD' price is
    // 1.0 by construction, but the fiat and gold feeds must still come from
    // somewhere." This row records that construct honestly; on Monad the
    // pair must come from the USDC issuer oracle family, which the pilot
    // does NOT wire (USDC enters bookkeeping at 1.0 — the USD leg is the
    // unit of account per §9.7.4).
    pairId: "USDC/USD",
    displayName: "USDC / US Dollar (stablecoin construct)",
    assetClass: "stablecoin-construct",
    feedClass: null,
    stalenessSeconds: null,
    confidenceMaxPct: null,
    deviationMaxPct: ORACLE_VALIDATION.DEVIATION_MAX_PCT,
    runtimeBoardPair: false,
    requiredSourceFamilies: [
      {
        family: "USDC issuer (Circle) oracle family",
        role: "issuer attestation / issuer-published price — the family Ext-3 A.4 points to for USDC/USD on chains where USDC is NOT the native gas token",
        independence: "issuer-family source",
        status: "candidate-policy-pending",
      },
      {
        family: "independent aggregator feed (e.g. a Chainlink-style USDC/USD aggregation)",
        role: "second independent family toward §17.10's ≥3-family spirit",
        independence: "aggregator-family source",
        status: "candidate-policy-pending",
      },
      {
        family: "on-chain DEX/TWAP market oracle",
        role: "third independent family toward §17.10's ≥3-family spirit",
        independence: "market-family source",
        status: "candidate-policy-pending",
      },
    ],
    pilotFamilies: [
      {
        family: "Arc native-gas construct",
        upstream: "Arc Testnet native currency = USDC, 18 decimals (contracts.ts ARC_TESTNET.nativeCurrency)",
        role: "USDC/USD = 1.0 BY CONSTRUCTION on Arc per Ext-3 A.4 — a construct, not an oracle read.",
        status: "construct-by-construction",
      },
      {
        family: "USDC issuer (Circle) oracle family",
        upstream: "none wired in the pilot",
        role: "the family USDC/USD must come from on Monad (any non-Arc chain) per Ext-3 A.4 — NOT wired.",
        status: "not-wired",
      },
      {
        family: "Unit-of-account assumption (USD leg, §9.7.4)",
        upstream: "oracle.ts board note: 'USD is the unit of account — price 1.0 by construction'",
        role: "pilot treats USD (and USDC bookkeeping) at 1.0 — disclosed pilot substitution.",
        status: "construct-by-construction",
      },
    ],
    onChainAdapterFamilies: compiledAdapterFamilies(
      "For this pair an adapter would read an issuer-oracle-derived USDC/USD feed on Monad; on Arc NO oracle read is required (1.0 by construction, Ext-3 A.4); no feed address configured anywhere.",
    ),
    feedStatus: "construct-arc-issuer-unwired-elsewhere",
    honestDetermination:
      "USDC/USD is NOT an oracle-read pair: on Arc it is 1.0 BY CONSTRUCTION (USDC is Arc's native gas token, 18 decimals, Ext-3 A.4); on Monad it must come from the USDC issuer (Circle) oracle family, which is NOT wired in the pilot — USDC enters bookkeeping at 1.0 (§9.7.4 unit-of-account). The ≥3-family extension for this pair is POLICY-PENDING (§17.10 lists 8 pairs; the extension belongs to the OD-34 owners).",
  },
];

/** Look up one pair's OD-34 feed configuration by runtime pair id. */
export function getFeedPair(pairId: string): PerPairFeedConfig | undefined {
  return FEED_PAIRS.find((p) => p.pairId === pairId);
}

// ---------------------------------------------------------------------------
// PerChainOracleDeployment — protocol-owner on-chain Oracle.sol registry
// ---------------------------------------------------------------------------

/**
 * eth_getCode probe outcome for the protocol-owner Oracle.sol address.
 * FOLD-IN COMPLETE (2026-10-19, orchestrator): Monad + Arc are "verified-present"
 * from the live probes in audit-work/v5/safe-verification.json (Task 3-a:
 * non-empty bytecode at Monad block 72,421,819 — 5,273 bytes; Arc block
 * 68,031,046 — 2,601 bytes). (2026-10-24 owner-directed cleanup: the Robinhood
 * oracle row was REMOVED from this registry along with the chain — its
 * historical "existence-unverified" record is preserved in git history and
 * the audit registers.) Do NOT hand-edit further without new probe JSON.
 */
export type OnChainCodeStatus =
  | "verified-present"
  | "verified-absent"
  | "existence-unverified"
  | "unreachable";

/** ABI publication status of the protocol-owner Oracle.sol. */
export type OracleAbiStatus =
  | "not published by protocol owner"
  | "not applicable — no protocol-owner on-chain oracle (Gate 7 external feeds)";

/** Gate posture of the chain's on-chain oracle integration. */
export type ChainGateStatus = "Gate-2-configured" | "deferred-G7";

/** Gate 7 planned external oracle family (Solana only — Ext-3 A.4). */
export interface PlannedGate7Family {
  family: string;
  role: string;
  status: "deferred-G7";
}

/**
 * OD-34 / Ext-3 A.4 — one chain's on-chain oracle deployment row.
 * Addresses are IMPORTED from contracts.ts (never copied as literals where an
 * import can express them); the honest feedDetermination label answers
 * Ext-3 Part H step 9 ("what feeds does each deployed Oracle.sol use? Mock or
 * real?") with the only defensible answer today: UNVERIFIED.
 */
export interface PerChainOracleDeployment {
  /** contracts.ts chain slug ("monad" | "arc" | "solana"). */
  id: string;
  /** Human chain label, imported from contracts.ts. */
  label: string;
  /** EIP-155 chain id (number) or network tag ("devnet" for Solana). */
  chainId: number | string;
  /** Protocol-owner Oracle.sol address (imported from contracts.ts), or null when none exists (Solana). */
  onChainOracle: string | null;
  /** Contract file symbol from contracts.ts (e.g. "Oracle.sol"), or null. */
  oracleContract: string | null;
  /** Deployer wallet (contracts.ts DEPLOYER_WALLET — the protocol owner's deployer), or null for Solana. */
  deployedBy: string | null;
  codeStatus: OnChainCodeStatus;
  abiStatus: OracleAbiStatus;
  /** Honest Ext-3 A.4 real-vs-mock determination (shared verbatim label below). */
  feedDetermination: string;
  /** Pilot staleness enforcement (off-chain engine; classes imported from blueprint). */
  pilotStalenessEnforcement: string;
  gateStatus: ChainGateStatus;
  /** Gate 7 planned families (present on the Solana entry only). */
  plannedFamilies?: PlannedGate7Family[];
  note: string;
}

/** Verbatim Ext-3 A.4 honest determination for every protocol-owner Oracle.sol. */
const UNVERIFIED_FEED_DETERMINATION =
  "on-chain feed contents UNVERIFIED — protocol-owner Oracle.sol ABI not published; real-vs-mock determination pending; mock strategy ACCEPTED for Gate 2 shadow mode per Ext-3 A.4";

/** Pilot staleness enforcement sentence (values derived from ORACLE_VALIDATION, §17.3.1). */
const PILOT_STALENESS_ENFORCEMENT =
  `off-chain engine (src/lib/mtq/oracle.ts, ORACLE_VALIDATION §17.3.1 per feed class): ` +
  `${ORACLE_VALIDATION.STALENESS_MS.MAJOR_FX / 1000}s major FX / ${ORACLE_VALIDATION.STALENESS_MS.GOLD / 1000}s gold / ` +
  `${ORACLE_VALIDATION.STALENESS_MS.MINOR_FX / 1000}s minor FX / ${ORACLE_VALIDATION.STALENESS_MS.VIX_DXY / 1000}s VIX+DXY ` +
  `(§17.8 heartbeat + 2×-staleness HALTED also enforced by the engine); on-chain staleness enforcement inside protocol-owner Oracle.sol UNVERIFIED (ABI not published)`;

/** No staleness enforcement exists for the deferred Solana path. */
const G7_STALENESS_ENFORCEMENT =
  "none — no Solana oracle path exists in the pilot (deferred-G7); Gate 7 will re-derive classes from the same ORACLE_VALIDATION table";

/**
 * Extract the protocol-owner Oracle entry from a contracts.ts ChainInfo.
 * Fails fast rather than emitting a phantom OD-34 row — addresses must never
 * be invented (Ext-3 Part C prohibition).
 */
function oracleEntryFor(chain: ChainInfo): ContractEntry {
  const entry = chain.contracts.find((c) => c.name === "Oracle");
  if (!entry) {
    throw new Error(
      `[oracle-feeds] contracts.ts records no Oracle entry for chain "${chain.id}" — refusing to fabricate an OD-34 oracle address row.`,
    );
  }
  return entry;
}

// --- Monad Testnet (chainId 10143) — Ext-3 A.4 / OD-34 -----------------------
const MONAD_ORACLE_ENTRY = oracleEntryFor(MONAD_TESTNET);

/** OD-34 row for the protocol-owner Oracle.sol on Monad Testnet (10143). */
export const MONAD_ORACLE_DEPLOYMENT: PerChainOracleDeployment = {
  id: MONAD_TESTNET.id,
  label: MONAD_TESTNET.label,
  chainId: MONAD_TESTNET.chainId,
  onChainOracle: MONAD_ORACLE_ENTRY.address,
  oracleContract: MONAD_ORACLE_ENTRY.symbol,
  deployedBy: DEPLOYER_WALLET,
  codeStatus: "verified-present",
  abiStatus: "not published by protocol owner",
  feedDetermination: UNVERIFIED_FEED_DETERMINATION,
  pilotStalenessEnforcement: PILOT_STALENESS_ENFORCEMENT,
  gateStatus: "Gate-2-configured",
  note:
    "Ext-3 A.4 asks verbatim which price feeds exist on Monad ('Chainlink? Pyth? Neither? Custom?') — UNANSWERED/UNVERIFIED; no provider feed address is configured for any pair on this chain. " +
    "CODE PRESENCE VERIFIED 2026-10-19 (read-only eth_getCode, audit-work/v5/safe-verification.json): non-empty bytecode, 5,273 bytes at block 72,421,819 via https://testnet-rpc.monad.xyz — existence ≠ feed contents; ABI still unpublished. " +
    "contracts.ts rpcUrl corrected by the orchestrator to https://testnet-rpc.monad.xyz (the recorded https://testnet-rpc.monadvision.com is dead).",
};

// --- Arc Testnet (chainId 5042002) — Ext-3 A.4 / OD-34 ------------------------
const ARC_ORACLE_ENTRY = oracleEntryFor(ARC_TESTNET);

/** OD-34 row for the protocol-owner Oracle.sol on Arc Testnet (5042002). */
export const ARC_ORACLE_DEPLOYMENT: PerChainOracleDeployment = {
  id: ARC_TESTNET.id,
  label: ARC_TESTNET.label,
  chainId: ARC_TESTNET.chainId,
  onChainOracle: ARC_ORACLE_ENTRY.address,
  oracleContract: ARC_ORACLE_ENTRY.symbol,
  deployedBy: DEPLOYER_WALLET,
  codeStatus: "verified-present",
  abiStatus: "not published by protocol owner",
  feedDetermination: UNVERIFIED_FEED_DETERMINATION,
  pilotStalenessEnforcement: PILOT_STALENESS_ENFORCEMENT,
  gateStatus: "Gate-2-configured",
  note:
    "Arc uses USDC as native gas — USDC/USD = 1.0 BY CONSTRUCTION here (Ext-3 A.4), but the fiat and gold feeds must still come from somewhere: pilot source = off-chain families (Frankfurter/gold-api/FRED-Yahoo), on-chain contents UNVERIFIED. " +
    "CODE PRESENCE VERIFIED 2026-10-19 (read-only eth_getCode, audit-work/v5/safe-verification.json): non-empty bytecode, 2,601 bytes at block 68,031,046 via https://rpc.testnet.arc.io — existence ≠ feed contents; ABI still unpublished. " +
    "Address-book contamination was flagged historically (the same hex appeared as Robinhood MockUSDC in a superseded registry row — C-042; see SAFE-VERIFICATION.md §4). " +
    "nativeCurrency per contracts.ts: 'USDC (18 decimals)'.",
};

// --- Solana Devnet — deferred to Gate 7 (Ext-3 A.4) --------------------------

/**
 * Ext-3 A.4 (Solana Devnet, for Gate 7): "Pyth devnet feeds are available for
 * FX and gold. Jupiter price API available as fallback. Deferred to Gate 7."
 * No protocol-owner Oracle.sol exists on Solana (contracts.ts records only the
 * SPL token); nothing is wired or verified — status "deferred-G7".
 */
export const SOLANA_GATE7: PerChainOracleDeployment = {
  id: SOLANA_DEVNET.id,
  label: SOLANA_DEVNET.label,
  chainId: SOLANA_DEVNET.chainId,
  onChainOracle: null,
  oracleContract: null,
  deployedBy: null,
  codeStatus: "existence-unverified",
  abiStatus: "not applicable — no protocol-owner on-chain oracle (Gate 7 external feeds)",
  feedDetermination:
    "deferred-G7: Pyth devnet feeds (FX + gold) primary + Jupiter price API fallback per Ext-3 A.4; NOTHING wired or verified in the pilot. codeStatus is vacuously 'existence-unverified' — there is no protocol-owner Oracle contract to probe on Solana.",
  pilotStalenessEnforcement: G7_STALENESS_ENFORCEMENT,
  gateStatus: "deferred-G7",
  plannedFamilies: [
    {
      family: "Pyth (Solana devnet)",
      role: "primary — devnet feeds exist for FX and gold (Ext-3 A.4)",
      status: "deferred-G7",
    },
    {
      family: "Jupiter price API",
      role: "fallback (Ext-3 A.4)",
      status: "deferred-G7",
    },
  ],
  note: "Solana devnet is a Gate 7 multichain deliverable (Ext-3 Part I: 'Deferred by design (portfolio optimization, multichain, yield strategy, Solana) — these are Gate 5 or Gate 7 items').",
};

/**
 * OD-34 per-chain on-chain oracle deployment registry: the two
 * protocol-owner EVM Oracle.sol deployments (Monad 10143 / Arc 5042002,
 * addresses imported from contracts.ts) plus the deferred-G7 Solana devnet
 * entry. (2026-10-24 owner-directed cleanup: the Robinhood row was removed
 * with the chain; its historical record is preserved in git history.)
 */
export const CHAIN_ORACLE_DEPLOYMENTS: PerChainOracleDeployment[] = [
  MONAD_ORACLE_DEPLOYMENT,
  ARC_ORACLE_DEPLOYMENT,
  SOLANA_GATE7,
];

// ---------------------------------------------------------------------------
// getOracleFeedSummary — compact OD-34 object for API/UI consumption
// ---------------------------------------------------------------------------

/** Compact per-pair row of the OD-34 summary. */
export interface OracleFeedSummaryPairRow {
  pairId: string;
  displayName: string;
  assetClass: OracleAssetClass;
  feedClass: FeedClass | null;
  stalenessSeconds: number | null;
  requiredFamilies: number;
  pilotFamilies: number;
  onChainAdapters: number;
  runtimeBoardPair: boolean;
  feedStatus: PilotFeedStatus;
}

/** Compact per-chain row of the OD-34 summary. */
export interface OracleFeedSummaryChainRow {
  id: string;
  label: string;
  chainId: number | string;
  onChainOracle: string | null;
  deployedBy: string | null;
  codeStatus: OnChainCodeStatus;
  abiStatus: OracleAbiStatus;
  gateStatus: ChainGateStatus;
}

/** One §17.3.1/§17.3.2 staleness-class row of the OD-34 summary table. */
export interface StalenessClassRow {
  feedClass: FeedClass | null;
  stalenessSeconds: number | null;
  confidenceMaxPct: number | null;
  pairs: string[];
  note?: string;
}

/** Compact OD-34 / Ext-3 A.4 summary for API/UI consumption (orchestrator wires the route). */
export interface OracleFeedSummary {
  od: "OD-34";
  conflict: "C-039";
  test: "T-86";
  gate: "Gate 2";
  specRefs: string[];
  counts: {
    pairs: number;
    section1710Pairs: number;
    constructPairs: number;
    runtimeConsensusBoardPairs: number;
    requiredIndependentFamiliesPerPair: number;
    onChainAdapterFamiliesPerPair: number;
    chains: number;
    protocolOwnerEvmOracleDeployments: number;
  };
  pairs: OracleFeedSummaryPairRow[];
  stalenessTable: StalenessClassRow[];
  validation: {
    deviationBreakerPct: number;
    correlationThresholdPct: number;
    correlationWarningAfterUpdates: number;
    heartbeatNote: string;
  };
  chains: OracleFeedSummaryChainRow[];
  limitations: string[];
}

/**
 * OD-34 (Ext-3 A.4) — compact machine-readable summary of the per-chain
 * oracle feed configuration: counts, the §17.3.1 staleness table (imported
 * values), per-chain on-chain oracle rows, and the honest limitations list.
 * Deterministic (no timestamps / randomness) so API responses are diffable
 * and §23-style reproducibility is preserved.
 */
export function getOracleFeedSummary(): OracleFeedSummary {
  const sectionPairs = FEED_PAIRS.filter((p) => p.assetClass !== "stablecoin-construct");
  const boardPairs = FEED_PAIRS.filter((p) => p.runtimeBoardPair);
  const evmOracleChains = CHAIN_ORACLE_DEPLOYMENTS.filter((c) => c.onChainOracle !== null);

  // Group the §17.3.1/§17.3.2 classes actually used by FEED_PAIRS (in registry
  // order), then append the null-class construct row (USDC/USD) explicitly.
  const classRows: StalenessClassRow[] = [];
  for (const pair of FEED_PAIRS) {
    if (pair.feedClass === null) continue;
    let row = classRows.find((r) => r.feedClass === pair.feedClass);
    if (!row) {
      row = {
        feedClass: pair.feedClass,
        stalenessSeconds: stalenessSecondsFor(pair.feedClass),
        confidenceMaxPct: confidenceMaxPctFor(pair.feedClass),
        pairs: [],
      };
      classRows.push(row);
    }
    row.pairs.push(pair.pairId);
  }
  const constructPairs = FEED_PAIRS.filter((p) => p.feedClass === null).map((p) => p.pairId);
  if (constructPairs.length > 0) {
    classRows.push({
      feedClass: null,
      stalenessSeconds: null,
      confidenceMaxPct: null,
      pairs: constructPairs,
      note:
        "USDC/USD has no §17.3.1 feed class — on Arc it is 1.0 by construction (native gas, Ext-3 A.4); issuer-oracle staleness policy on other chains is PENDING (OD-34 owners: Smart-contract lead + Risk Council).",
    });
  }

  return {
    od: "OD-34",
    conflict: "C-039",
    test: "T-86",
    gate: "Gate 2",
    specRefs: [
      "Ext-3 A.4 (oracle addresses and feed configuration per chain)",
      "Blueprint §17.10 (three independent source families; per-pair list)",
      "Blueprint §17.3.1–§17.3.3 (staleness/confidence/deviation bounds)",
      "Blueprint §17.7–§17.9 (five-state machine, heartbeat/HALTED, correlation warning — runtime in oracle.ts)",
      "Blueprint §9.1–§9.3 (three-source consensus — runtime in oracle.ts)",
      "Blueprint §9.7.4 (USD unit of account, 1.0 by construction)",
    ],
    counts: {
      pairs: FEED_PAIRS.length,
      section1710Pairs: sectionPairs.length,
      constructPairs: FEED_PAIRS.length - sectionPairs.length,
      runtimeConsensusBoardPairs: boardPairs.length,
      requiredIndependentFamiliesPerPair: Math.min(
        ...FEED_PAIRS.map((p) => p.requiredSourceFamilies.length),
      ),
      onChainAdapterFamiliesPerPair: Math.min(
        ...FEED_PAIRS.map((p) => p.onChainAdapterFamilies.length),
      ),
      chains: CHAIN_ORACLE_DEPLOYMENTS.length,
      protocolOwnerEvmOracleDeployments: evmOracleChains.length,
    },
    pairs: FEED_PAIRS.map((p) => ({
      pairId: p.pairId,
      displayName: p.displayName,
      assetClass: p.assetClass,
      feedClass: p.feedClass,
      stalenessSeconds: p.stalenessSeconds,
      requiredFamilies: p.requiredSourceFamilies.length,
      pilotFamilies: p.pilotFamilies.length,
      onChainAdapters: p.onChainAdapterFamilies.length,
      runtimeBoardPair: p.runtimeBoardPair,
      feedStatus: p.feedStatus,
    })),
    stalenessTable: classRows,
    validation: {
      deviationBreakerPct: ORACLE_VALIDATION.DEVIATION_MAX_PCT,
      correlationThresholdPct: ORACLE_CORRELATION_THRESHOLD,
      correlationWarningAfterUpdates: ORACLE_CORRELATION_WARNING_AFTER,
      heartbeatNote:
        "§17.8 heartbeat table (15s major/gold, 30s minor, 60s VIX/DXY) and the §17.7 five-state machine live in oracle.ts (HEARTBEAT_MS) — deliberately NOT duplicated in this configuration registry.",
    },
    chains: CHAIN_ORACLE_DEPLOYMENTS.map((c) => ({
      id: c.id,
      label: c.label,
      chainId: c.chainId,
      onChainOracle: c.onChainOracle,
      deployedBy: c.deployedBy,
      codeStatus: c.codeStatus,
      abiStatus: c.abiStatus,
      gateStatus: c.gateStatus,
    })),
    limitations: [
      "On-chain adapter families (Chainlink/Pyth/Chronicle, contracts/adapters/*.sol) are COMPILED but NOT deployed by us — no adapter instance exists at any address on any chain, and every providerFeedAddress in this registry is null pending OD-34 confirmation.",
      "The two Oracle.sol deployments (Monad 10143 / Arc 5042002) belong to the PROTOCOL OWNER and the ABI is NOT PUBLISHED — whether they serve real or mock feeds is UNVERIFIED (Ext-3 A.4's exact question). codeStatus FOLD-IN (2026-10-19, audit-work/v5/safe-verification.json): Monad + Arc VERIFIED-PRESENT (non-empty bytecode 5,273 B / 2,601 B at blocks 72,421,819 / 68,031,046). Existence ≠ feed contents.",
      "Arc: USDC is the native gas currency (18 decimals, contracts.ts), so USDC/USD = 1.0 BY CONSTRUCTION per Ext-3 A.4 — a construct, not an oracle read; on Monad the pair must come from the USDC issuer (Circle) oracle family, which is NOT wired in the pilot (USDC enters bookkeeping at 1.0).",
      "Solana devnet is DEFERRED-G7: Pyth devnet feeds (FX + gold) primary + Jupiter price API fallback per Ext-3 A.4 — nothing wired, nothing verified.",
      "The pilot's Gate 2 shadow mode prices all pairs from OFF-CHAIN families (Frankfurter ECB, gold-api.com, FRED/Yahoo macro) with oracle.ts running the 3-source consensus as SYNTHETIC WITNESSES over a single upstream per FX/gold pair — §17.10's 3-INDEPENDENT-family requirement is NOT met in the pilot; Ext-3 A.4 accepts the mock-oracle strategy for Gate 2 shadow mode.",
      "Which price feeds exist on Monad/Arc testnets (Ext-3 A.4: 'Chainlink? Pyth? Neither? Custom?') is UNANSWERED — no provider feed id is configured for any pair on any chain in this registry (oracle addresses are never invented).",
      "VIX and DXY have no known on-chain feeds on either EVM testnet and are not part of the runtime 6-pair consensus board — consumed as macro signals (fx.ts: FRED official daily-lag primary, Yahoo fallback, honest simulated OU-walk last resort).",
      "The ≥3-family extension for USDC/USD is POLICY-PENDING: Blueprint §17.10 lists 8 pairs and is silent on stablecoin constructs; the extension belongs to the OD-34 owners (Smart-contract lead + Risk Council).",
    ],
  };
}
