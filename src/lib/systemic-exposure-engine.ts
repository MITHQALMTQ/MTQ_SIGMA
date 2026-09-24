// ============================================================================
//  MITHQAL — Systemic Exposure Engine (Blueprint v25.3 §52)
//  ----------------------------------------------------------------------------
//  Module ID:   v25.2-systemic-exposure-engine-1.0
//  Section:     §52
//  Source file: `src/lib/systemic-exposure-engine.ts`
//
//  The §52 framework implements the System-Wide Exposure & Concentration
//  Engine. It provides:
//    1. A 13-dimension concentration measurement framework.
//    2. The two pivotal systemic-risk questions (Question A: individual-limit;
//       Question B: system-wide-growth).
//    3. A `SystemicExposureSnapshot` — a cross-dimensional view of all
//       institutional exposures.
//    4. A per-bank `BankVsSystemWideResult` answering Questions A & B.
//    5. A reference input bundle for the §3 DMCE engine.
//
//  Honest state (§74):
//    systemicRiskEngineDesigned:       true
//    systemicRiskEngineImplemented:    true
//    systemicRiskMonitoringLive:       false   // NO live institutional feeds
//    systemicRiskProductionValidated:  false   // NO production deployment
//
//  The engine is a DESIGN-TIME systemic exposure measurement engine. It
//  operates on declarative bank / custodian / provider / asset inputs
//  (currently SIMULATED reference data). It does NOT poll live bank
//  balances, live custodian holdings, or live oracle feeds.
// ============================================================================

export const SYSTEMIC_EXPOSURE_MODULE_ID = "v25.2-systemic-exposure-engine-1.0" as const;
export const SYSTEMIC_EXPOSURE_SECTION = 52 as const;

// ----------------------------------------------------------------------------
// §20.1 — Honest state (§74)
// ----------------------------------------------------------------------------

export interface SystemicExposureHonestState {
  systemicRiskEngineDesigned: true;
  systemicRiskEngineImplemented: true;
  systemicRiskMonitoringLive: false;
  systemicRiskProductionValidated: false;
}

export function systemicExposureHonestState(): SystemicExposureHonestState {
  return {
    systemicRiskEngineDesigned: true,
    systemicRiskEngineImplemented: true,
    systemicRiskMonitoringLive: false,
    systemicRiskProductionValidated: false,
  };
}

export const SYSTEMIC_EXPOSURE_HONEST_STATE = systemicExposureHonestState();

// ----------------------------------------------------------------------------
// §20.2 — The 13 concentration dimensions
// ----------------------------------------------------------------------------

export type ConcentrationDimension =
  | "bank"
  | "banking-group"
  | "country"
  | "currency"
  | "custodian"
  | "correspondent"
  | "settlement-rail"
  | "liquidity-provider"
  | "stablecoin-issuer"
  | "technology-provider"
  | "geopolitical-correlation"
  | "operational-correlation"
  | "bank-exposure";

export const ALL_DIMENSIONS: ReadonlyArray<ConcentrationDimension> = [
  "bank",                            // 1
  "banking-group",                   // 2
  "country",                         // 3
  "currency",                        // 4
  "custodian",                       // 5
  "correspondent",                   // 6
  "settlement-rail",                 // 7
  "liquidity-provider",              // 8
  "stablecoin-issuer",               // 9
  "technology-provider",             // 10
  "geopolitical-correlation",        // 11
  "operational-correlation",         // 12
  "bank-exposure",                   // 13 (§76 — also a distinct dimension)
];

// ----------------------------------------------------------------------------
// §20.3 — Concentration limits (§76)
// ----------------------------------------------------------------------------

export const CONCENTRATION_LIMITS = {
  // Currency (§76) — preferred 15%, hard 20%
  preferredCurrencyExposure: 0.15,
  hardCurrencyExposure: 0.20,
  // Bank (§76) — preferred 10-15% (upper bound adopted), hard 20%
  preferredBankExposure: 0.15,
  hardBankExposure: 0.20,
  // Custodian (§76) — preferred 15%, hard 20%
  preferredCustodianExposure: 0.15,
  hardCustodianExposure: 0.20,
  // Country (§76) — preferred 20%, hard 25%
  preferredCountryExposure: 0.20,
  hardCountryExposure: 0.25,
  // Banking group — preferred 15%, hard 20%
  preferredBankingGroupExposure: 0.15,
  hardBankingGroupExposure: 0.20,
  // Correspondent — preferred 15%, hard 20%
  preferredCorrespondentExposure: 0.15,
  hardCorrespondentExposure: 0.20,
  // Settlement rail — preferred 25%, hard 35%
  preferredSettlementRailExposure: 0.25,
  hardSettlementRailExposure: 0.35,
  // Liquidity provider — preferred 20%, hard 30%
  preferredLiquidityProviderExposure: 0.20,
  hardLiquidityProviderExposure: 0.30,
  // Stablecoin issuer — preferred 10%, hard 15%
  preferredStablecoinIssuerExposure: 0.10,
  hardStablecoinIssuerExposure: 0.15,
  // Technology provider — preferred 15%, hard 20%
  preferredTechnologyProviderExposure: 0.15,
  hardTechnologyProviderExposure: 0.20,
  // Geopolitical correlation block — preferred 30%, hard 40%
  preferredGeopoliticalCorrelationExposure: 0.30,
  hardGeopoliticalCorrelationExposure: 0.40,
  // Operational correlation block — preferred 30%, hard 40%
  preferredOperationalCorrelationExposure: 0.30,
  hardOperationalCorrelationExposure: 0.40,
  // Bank-exposure dimension (§76) — preferred 10-15% (upper bound), hard 20%
  preferredBankExposureDimension: 0.15,
  hardBankExposureDimension: 0.20,
} as const;

export interface DimensionLimits {
  preferred: number;
  hard: number;
}

export function limitsForDimension(d: ConcentrationDimension): DimensionLimits {
  switch (d) {
    case "bank": return { preferred: CONCENTRATION_LIMITS.preferredBankExposure, hard: CONCENTRATION_LIMITS.hardBankExposure };
    case "banking-group": return { preferred: CONCENTRATION_LIMITS.preferredBankingGroupExposure, hard: CONCENTRATION_LIMITS.hardBankingGroupExposure };
    case "country": return { preferred: CONCENTRATION_LIMITS.preferredCountryExposure, hard: CONCENTRATION_LIMITS.hardCountryExposure };
    case "currency": return { preferred: CONCENTRATION_LIMITS.preferredCurrencyExposure, hard: CONCENTRATION_LIMITS.hardCurrencyExposure };
    case "custodian": return { preferred: CONCENTRATION_LIMITS.preferredCustodianExposure, hard: CONCENTRATION_LIMITS.hardCustodianExposure };
    case "correspondent": return { preferred: CONCENTRATION_LIMITS.preferredCorrespondentExposure, hard: CONCENTRATION_LIMITS.hardCorrespondentExposure };
    case "settlement-rail": return { preferred: CONCENTRATION_LIMITS.preferredSettlementRailExposure, hard: CONCENTRATION_LIMITS.hardSettlementRailExposure };
    case "liquidity-provider": return { preferred: CONCENTRATION_LIMITS.preferredLiquidityProviderExposure, hard: CONCENTRATION_LIMITS.hardLiquidityProviderExposure };
    case "stablecoin-issuer": return { preferred: CONCENTRATION_LIMITS.preferredStablecoinIssuerExposure, hard: CONCENTRATION_LIMITS.hardStablecoinIssuerExposure };
    case "technology-provider": return { preferred: CONCENTRATION_LIMITS.preferredTechnologyProviderExposure, hard: CONCENTRATION_LIMITS.hardTechnologyProviderExposure };
    case "geopolitical-correlation": return { preferred: CONCENTRATION_LIMITS.preferredGeopoliticalCorrelationExposure, hard: CONCENTRATION_LIMITS.hardGeopoliticalCorrelationExposure };
    case "operational-correlation": return { preferred: CONCENTRATION_LIMITS.preferredOperationalCorrelationExposure, hard: CONCENTRATION_LIMITS.hardOperationalCorrelationExposure };
    case "bank-exposure": return { preferred: CONCENTRATION_LIMITS.preferredBankExposureDimension, hard: CONCENTRATION_LIMITS.hardBankExposureDimension };
  }
}

// ----------------------------------------------------------------------------
// §20.2 — Exposure bucket + status classification
// ----------------------------------------------------------------------------

export type ExposureStatus = "within" | "near-breach" | "breach" | "unknown";

export interface ExposureBucketMetadata {
  parentGroup?: string;
  jurisdiction?: string;
  entityId?: string;
  note?: string;
}

export interface ExposureBucket {
  dimension: ConcentrationDimension;
  value: string;          // the bucket identifier (e.g., bank ID, country code)
  exposureAmount: number; // USD notional
  exposurePct: number;    // fraction of totalExposure
  preferred: number;
  hard: number;
  status: ExposureStatus;
  metadata?: ExposureBucketMetadata;
}

export function classifyStatus(exposurePct: number, preferred: number, hard: number): ExposureStatus {
  if (exposurePct > hard + 1e-9) return "breach";
  if (exposurePct > preferred + 1e-9) return "near-breach";
  return "within";
}

// ----------------------------------------------------------------------------
// §20.8 — Input types (banks / assets / custodians / providers)
// ----------------------------------------------------------------------------

export interface SystemicBankInput {
  bankId: string;
  bankName: string;
  bankingGroup: string;
  country: string;
  currency?: string;
  exposureAmount: number;
  growthDeltaPct: number;          // percentage points period-over-period
  individualLimitPct?: number;     // optional override; defaults to hard bank cap
  correspondent?: string;
  settlementRail?: string;
  liquidityProvider?: string;
  geopoliticalCorrelation?: "low" | "medium" | "high";
  operationalCorrelation?: "low" | "medium" | "high";
}

export interface SystemicAssetInput {
  assetId: string;
  currency: string;
  exposureAmount: number;
  stablecoinIssuer?: string;
}

export interface SystemicCustodianInput {
  custodianId: string;
  custodianName: string;
  parentGroup?: string;
  jurisdiction?: string;
  technologyProvider?: string;
  exposureAmount: number;
  growthDeltaPct?: number;
}

export interface SystemicProviderInput {
  providerId: string;
  providerName: string;
  exposureAmount: number;
}

export interface SystemicExposureInputs {
  banks: SystemicBankInput[];
  assets: SystemicAssetInput[];
  custodians: SystemicCustodianInput[];
  providers: SystemicProviderInput[];
}

// ----------------------------------------------------------------------------
// §20.8 — Snapshot structure
// ----------------------------------------------------------------------------

export interface SystemicExposureSnapshot {
  timestamp: string;
  dimensions: Record<ConcentrationDimension, ExposureBucket[]>;
  totalExposure: number;
  constraintsMet: boolean;
  violations: ExposureBucket[];
  nearBreaches: ExposureBucket[];
  concentrationScore: number; // 0–1 HHI-averaged
}

// ----------------------------------------------------------------------------
// §20.2 — Aggregation helper (build buckets from items)
// ----------------------------------------------------------------------------

interface AggItem {
  value: string;
  amount: number;
  metadata?: ExposureBucketMetadata;
}

function aggregate(items: AggItem[]): Map<string, { amount: number; metadata?: ExposureBucketMetadata }> {
  const m = new Map<string, { amount: number; metadata?: ExposureBucketMetadata }>();
  for (const it of items) {
    const existing = m.get(it.value);
    if (existing) existing.amount += it.amount;
    else m.set(it.value, { amount: it.amount, metadata: it.metadata });
  }
  return m;
}

function buildBuckets(
  dimension: ConcentrationDimension,
  items: AggItem[],
  totalExposure: number,
): ExposureBucket[] {
  const agg = aggregate(items);
  const { preferred, hard } = limitsForDimension(dimension);
  const buckets: ExposureBucket[] = [];
  for (const [value, { amount, metadata }] of agg.entries()) {
    const exposurePct = totalExposure > 0 ? amount / totalExposure : 0;
    buckets.push({
      dimension,
      value,
      exposureAmount: amount,
      exposurePct,
      preferred,
      hard,
      status: classifyStatus(exposurePct, preferred, hard),
      metadata,
    });
  }
  return buckets.sort((a, b) => b.exposurePct - a.exposurePct);
}

// ----------------------------------------------------------------------------
// §20.6 — Systemic concentration score (HHI averaged across 13 dimensions)
// ----------------------------------------------------------------------------

export function computeSystemicConcentrationScore(
  snapshot: Pick<SystemicExposureSnapshot, "dimensions">,
): number {
  let sum = 0;
  let dimCount = 0;
  for (const d of ALL_DIMENSIONS) {
    const buckets = snapshot.dimensions[d];
    if (!buckets || buckets.length === 0) continue;
    let hhi = 0;
    for (const b of buckets) hhi += b.exposurePct * b.exposurePct;
    sum += hhi;
    dimCount++;
  }
  return dimCount === 0 ? 0 : sum / dimCount;
}

// ----------------------------------------------------------------------------
// §20.8 — evaluateSystemicExposure (the canonical entry point)
// ----------------------------------------------------------------------------

export function evaluateSystemicExposure(
  inputs: SystemicExposureInputs,
): SystemicExposureSnapshot {
  const bankTotal = inputs.banks.reduce((s, b) => s + b.exposureAmount, 0);
  const assetTotal = inputs.assets.reduce((s, a) => s + a.exposureAmount, 0);
  const custodianTotal = inputs.custodians.reduce((s, c) => s + c.exposureAmount, 0);
  const providerTotal = inputs.providers.reduce((s, p) => s + p.exposureAmount, 0);
  const totalExposure = Math.max(bankTotal, assetTotal, custodianTotal, providerTotal, 1);

  const dimensions = {} as Record<ConcentrationDimension, ExposureBucket[]>;

  // Dim 1 — bank
  dimensions["bank"] = buildBuckets(
    "bank",
    inputs.banks.map((b) => ({
      value: b.bankId,
      amount: b.exposureAmount,
      metadata: { parentGroup: b.bankingGroup, jurisdiction: b.country, entityId: b.bankId, note: b.bankName },
    })),
    totalExposure,
  );

  // Dim 2 — banking-group
  dimensions["banking-group"] = buildBuckets(
    "banking-group",
    inputs.banks.map((b) => ({
      value: b.bankingGroup,
      amount: b.exposureAmount,
      metadata: { parentGroup: b.bankingGroup },
    })),
    totalExposure,
  );

  // Dim 3 — country
  dimensions["country"] = buildBuckets(
    "country",
    inputs.banks.map((b) => ({
      value: b.country,
      amount: b.exposureAmount,
      metadata: { jurisdiction: b.country },
    })),
    totalExposure,
  );

  // Dim 4 — currency
  dimensions["currency"] = buildBuckets(
    "currency",
    inputs.assets.map((a) => ({ value: a.currency, amount: a.exposureAmount })),
    totalExposure,
  );

  // Dim 5 — custodian
  dimensions["custodian"] = buildBuckets(
    "custodian",
    inputs.custodians.map((c) => ({
      value: c.custodianId,
      amount: c.exposureAmount,
      metadata: {
        parentGroup: c.parentGroup,
        jurisdiction: c.jurisdiction,
        entityId: c.custodianId,
        note: c.custodianName,
      },
    })),
    totalExposure,
  );

  // Dim 6 — correspondent
  dimensions["correspondent"] = buildBuckets(
    "correspondent",
    inputs.banks
      .filter((b) => !!b.correspondent)
      .map((b) => ({
        value: b.correspondent!,
        amount: b.exposureAmount,
        metadata: { parentGroup: b.bankingGroup },
      })),
    totalExposure,
  );

  // Dim 7 — settlement-rail
  dimensions["settlement-rail"] = buildBuckets(
    "settlement-rail",
    inputs.banks
      .filter((b) => !!b.settlementRail)
      .map((b) => ({ value: b.settlementRail!, amount: b.exposureAmount })),
    totalExposure,
  );

  // Dim 8 — liquidity-provider
  dimensions["liquidity-provider"] = buildBuckets(
    "liquidity-provider",
    inputs.banks
      .filter((b) => !!b.liquidityProvider)
      .map((b) => ({ value: b.liquidityProvider!, amount: b.exposureAmount })),
    totalExposure,
  );

  // Dim 9 — stablecoin-issuer
  dimensions["stablecoin-issuer"] = buildBuckets(
    "stablecoin-issuer",
    inputs.assets
      .filter((a) => !!a.stablecoinIssuer)
      .map((a) => ({ value: a.stablecoinIssuer!, amount: a.exposureAmount })),
    totalExposure,
  );

  // Dim 10 — technology-provider
  dimensions["technology-provider"] = buildBuckets(
    "technology-provider",
    inputs.custodians
      .filter((c) => !!c.technologyProvider)
      .map((c) => ({
        value: c.technologyProvider!,
        amount: c.exposureAmount,
        metadata: { parentGroup: c.parentGroup, jurisdiction: c.jurisdiction },
      })),
    totalExposure,
  );

  // Dim 11 — geopolitical-correlation
  dimensions["geopolitical-correlation"] = buildBuckets(
    "geopolitical-correlation",
    inputs.banks.map((b) => ({
      value: "geo-" + (b.geopoliticalCorrelation ?? "low"),
      amount: b.exposureAmount,
    })),
    totalExposure,
  );

  // Dim 12 — operational-correlation
  dimensions["operational-correlation"] = buildBuckets(
    "operational-correlation",
    inputs.banks.map((b) => ({
      value: "op-" + (b.operationalCorrelation ?? "low"),
      amount: b.exposureAmount,
    })),
    totalExposure,
  );

  // Dim 13 — bank-exposure (§76 — same data as dim 1, surfaced separately)
  dimensions["bank-exposure"] = buildBuckets(
    "bank-exposure",
    inputs.banks.map((b) => ({
      value: b.bankId,
      amount: b.exposureAmount,
      metadata: { note: "§76 bank-exposure dimension (preferred 10-15%, hard 20%)" },
    })),
    totalExposure,
  );

  // Collect violations + near-breaches across all dimensions.
  const violations: ExposureBucket[] = [];
  const nearBreaches: ExposureBucket[] = [];
  for (const d of ALL_DIMENSIONS) {
    for (const b of dimensions[d]) {
      if (b.status === "breach") violations.push(b);
      else if (b.status === "near-breach") nearBreaches.push(b);
    }
  }

  const snapshot: SystemicExposureSnapshot = {
    timestamp: new Date().toISOString(),
    dimensions,
    totalExposure,
    constraintsMet: violations.length === 0,
    violations,
    nearBreaches,
    concentrationScore: 0,
  };
  snapshot.concentrationScore = computeSystemicConcentrationScore(snapshot);
  return snapshot;
}

// ----------------------------------------------------------------------------
// §20.4 — Bank-vs-system-wide assessment (Questions A & B)
// ----------------------------------------------------------------------------

export interface BankVsSystemWideResult {
  bankId: string;
  bankName: string;
  individualLimitOk: boolean;
  individualExposurePct: number;
  individualLimit: number;
  systemWideConcentrationOk: boolean;
  growthCreatesExcessConcentration: boolean;
  projectedExposurePct: number;
  projectedSystemConcentrationScore: number;
  details: string;
  recommendation: string;
}

export function assessBankVsSystemWide(
  bank: SystemicBankInput,
  snapshot: SystemicExposureSnapshot,
): BankVsSystemWideResult {
  const bankBucket =
    snapshot.dimensions["bank"].find((b) => b.value === bank.bankId) ??
    snapshot.dimensions["bank-exposure"].find((b) => b.value === bank.bankId);
  const individualExposurePct = bankBucket?.exposurePct ?? 0;
  const individualLimit = bank.individualLimitPct ?? CONCENTRATION_LIMITS.hardBankExposure;
  const preferredLimit = CONCENTRATION_LIMITS.preferredBankExposure;
  const individualLimitOk = individualExposurePct <= individualLimit + 1e-9;

  const growthDeltaFraction = bank.growthDeltaPct / 100;
  const projectedExposurePct = individualExposurePct + growthDeltaFraction;
  const wouldBreachHard = projectedExposurePct > individualLimit + 1e-9;
  const wouldBreachPreferred = projectedExposurePct > preferredLimit + 1e-9;
  const violationsForBank = snapshot.violations.filter((v) => v.value === bank.bankId);

  // Projected concentration score — recompute HHI with the bank's projected exposure.
  // (Approximation: scale the bank's current contribution up by (projected/current).)
  const currentScore = snapshot.concentrationScore;
  const projectedSystemConcentrationScore = individualExposurePct > 0
    ? Math.min(1, currentScore + (projectedExposurePct * projectedExposurePct - individualExposurePct * individualExposurePct))
    : currentScore;

  const growthCreatesExcessConcentration =
    wouldBreachHard || wouldBreachPreferred || violationsForBank.length > 0;

  let recommendation: string;
  if (!individualLimitOk) {
    recommendation = "REDUCE exposure to bank immediately — individual hard limit already breached.";
  } else if (wouldBreachHard) {
    recommendation = "HOLD growth — projected exposure would breach the system-wide hard cap.";
  } else if (wouldBreachPreferred) {
    recommendation = "MONITOR growth — projected exposure would exceed the preferred system-wide cap.";
  } else if (violationsForBank.length > 0) {
    recommendation = "REMEDIATE existing system-wide violations attributed to this bank / group before expanding exposure.";
  } else {
    recommendation = "Within limits; continue routine systemic monitoring.";
  }

  return {
    bankId: bank.bankId,
    bankName: bank.bankName,
    individualLimitOk,
    individualExposurePct,
    individualLimit,
    systemWideConcentrationOk: !growthCreatesExcessConcentration,
    growthCreatesExcessConcentration,
    projectedExposurePct,
    projectedSystemConcentrationScore,
    details:
      `individual=${(individualExposurePct * 100).toFixed(2)}% (limit ${(individualLimit * 100).toFixed(0)}%); ` +
      `projected=${(projectedExposurePct * 100).toFixed(2)}%; ` +
      `systemViolations=${violationsForBank.length}; score=${currentScore.toFixed(3)} → ${projectedSystemConcentrationScore.toFixed(3)}.`,
    recommendation,
  };
}

// ----------------------------------------------------------------------------
// §20.5 — Enhanced DMCE input bundle (reference, not recomputation)
// ----------------------------------------------------------------------------

export interface EnhancedDMCEInput {
  bankId: string;
  bankName: string;
  bankExposurePct: number;
  bankGrowthDelta: number;
  bankHardLimit: number;
  bankPreferredLimit: number;
  systemConcentrationScore: number;
  systemWideViolations: number;
  systemWideNearBreaches: number;
  correlatedDimensions: Array<{
    dimension: ConcentrationDimension;
    entityId: string;
    exposurePct: number;
  }>;
  note: string;
}

export function buildEnhancedDMCEInput(
  bank: SystemicBankInput,
  snapshot: SystemicExposureSnapshot,
): EnhancedDMCEInput {
  const bankBucket = snapshot.dimensions["bank"].find((b) => b.value === bank.bankId);
  const correlated: EnhancedDMCEInput["correlatedDimensions"] = [];
  for (const d of ALL_DIMENSIONS) {
    if (d === "bank" || d === "bank-exposure") continue;
    for (const b of snapshot.dimensions[d]) {
      if (
        b.metadata?.entityId === bank.bankId ||
        b.metadata?.parentGroup === bank.bankingGroup ||
        b.metadata?.jurisdiction === bank.country
      ) {
        correlated.push({ dimension: d, entityId: b.value, exposurePct: b.exposurePct });
      }
    }
  }
  return {
    bankId: bank.bankId,
    bankName: bank.bankName,
    bankExposurePct: bankBucket?.exposurePct ?? 0,
    bankGrowthDelta: bank.growthDeltaPct,
    bankHardLimit: bank.individualLimitPct ?? CONCENTRATION_LIMITS.hardBankExposure,
    bankPreferredLimit: CONCENTRATION_LIMITS.preferredBankExposure,
    systemConcentrationScore: snapshot.concentrationScore,
    systemWideViolations: snapshot.violations.length,
    systemWideNearBreaches: snapshot.nearBreaches.length,
    correlatedDimensions: correlated,
    note: "REFERENCE input for §3 DMCE — does NOT recompute DMCE itself (owned by mtq-final-reserve-spec.ts).",
  };
}

// ----------------------------------------------------------------------------
// §20.9 — SIMULATED reference snapshot
// ----------------------------------------------------------------------------

export function buildReferenceSystemicSnapshot(): SystemicExposureSnapshot {
  const banks: SystemicBankInput[] = [
    { bankId: "BANK-001", bankName: "Northern Anchor Bank", bankingGroup: "Mithqal-North-Africa-Group", country: "AE", currency: "USD", exposureAmount: 25_000_000, growthDeltaPct: 3.0, correspondent: "SWIFT-1", settlementRail: "CIPS", liquidityProvider: "LP-1", geopoliticalCorrelation: "medium", operationalCorrelation: "low" },
    { bankId: "BANK-002", bankName: "Sovereign Trust Bank", bankingGroup: "Sovereign-Asia-Group", country: "SA", currency: "SAR", exposureAmount: 18_000_000, growthDeltaPct: 6.0, correspondent: "SWIFT-2", settlementRail: "SARIE", liquidityProvider: "LP-2", geopoliticalCorrelation: "low", operationalCorrelation: "medium" },
    { bankId: "BANK-003", bankName: "Euro Reserve Custody", bankingGroup: "Euro-Reserve-Group", country: "CH", currency: "EUR", exposureAmount: 32_000_000, growthDeltaPct: 1.0, correspondent: "SWIFT-3", settlementRail: "TARGET2", liquidityProvider: "LP-3", geopoliticalCorrelation: "low", operationalCorrelation: "low" },
    { bankId: "BANK-004", bankName: "Pacific Bridge Bank", bankingGroup: "Pacific-Finance-Group", country: "SG", currency: "SGD", exposureAmount: 25_000_000, growthDeltaPct: 2.0, correspondent: "SWIFT-4", settlementRail: "MAS-FAST", liquidityProvider: "LP-1", geopoliticalCorrelation: "medium", operationalCorrelation: "medium" },
  ];
  const assets: SystemicAssetInput[] = [
    { assetId: "USD-CASH", currency: "USD", exposureAmount: 60_000_000 },
    { assetId: "EUR-CASH", currency: "EUR", exposureAmount: 32_000_000 },
    { assetId: "SAR-CASH", currency: "SAR", exposureAmount: 18_000_000 },
    { assetId: "SGD-CASH", currency: "SGD", exposureAmount: 25_000_000 },
    { assetId: "USDC-1", currency: "USD", exposureAmount: 5_000_000, stablecoinIssuer: "USDC-ISSUER" },
  ];
  const custodians: SystemicCustodianInput[] = [
    { custodianId: "CUST-A", custodianName: "Northern Custody Trust", parentGroup: "NC-Trust-Group", jurisdiction: "AE", technologyProvider: "TECH-1", exposureAmount: 48_000_000, growthDeltaPct: 2.0 },
    { custodianId: "CUST-B", custodianName: "Sovereign Custody Corp", parentGroup: "SC-Corp-Group", jurisdiction: "SA", technologyProvider: "TECH-2", exposureAmount: 35_000_000, growthDeltaPct: 4.0 },
    { custodianId: "CUST-C", custodianName: "Euro Vault AG", parentGroup: "EV-AG-Group", jurisdiction: "CH", technologyProvider: "TECH-1", exposureAmount: 32_000_000, growthDeltaPct: 1.0 },
  ];
  const providers: SystemicProviderInput[] = [
    { providerId: "TECH-1", providerName: "CustodyTech-A", exposureAmount: 80_000_000 },
    { providerId: "TECH-2", providerName: "CustodyTech-B", exposureAmount: 35_000_000 },
  ];
  return evaluateSystemicExposure({ banks, assets, custodians, providers });
}

// ----------------------------------------------------------------------------
// §52 — Report generator
// ----------------------------------------------------------------------------

export interface SystemicExposureReport {
  moduleId: typeof SYSTEMIC_EXPOSURE_MODULE_ID;
  section: typeof SYSTEMIC_EXPOSURE_SECTION;
  dimensions: ReadonlyArray<ConcentrationDimension>;
  concentrationLimits: typeof CONCENTRATION_LIMITS;
  honestState: SystemicExposureHonestState;
  referenceSnapshot: SystemicExposureSnapshot;
  bankAssessments: BankVsSystemWideResult[];
  finalStatus: string;
  finalStatusColor: "amber";
}

export function generateSystemicExposureReport(): SystemicExposureReport {
  const snapshot = buildReferenceSystemicSnapshot();
  const bankInputs: SystemicBankInput[] = [
    { bankId: "BANK-001", bankName: "Northern Anchor Bank", bankingGroup: "Mithqal-North-Africa-Group", country: "AE", exposureAmount: 25_000_000, growthDeltaPct: 3.0 },
    { bankId: "BANK-002", bankName: "Sovereign Trust Bank", bankingGroup: "Sovereign-Asia-Group", country: "SA", exposureAmount: 18_000_000, growthDeltaPct: 6.0 },
    { bankId: "BANK-003", bankName: "Euro Reserve Custody", bankingGroup: "Euro-Reserve-Group", country: "CH", exposureAmount: 32_000_000, growthDeltaPct: 1.0 },
    { bankId: "BANK-004", bankName: "Pacific Bridge Bank", bankingGroup: "Pacific-Finance-Group", country: "SG", exposureAmount: 25_000_000, growthDeltaPct: 2.0 },
  ];
  return {
    moduleId: SYSTEMIC_EXPOSURE_MODULE_ID,
    section: SYSTEMIC_EXPOSURE_SECTION,
    dimensions: ALL_DIMENSIONS,
    concentrationLimits: CONCENTRATION_LIMITS,
    honestState: systemicExposureHonestState(),
    referenceSnapshot: snapshot,
    bankAssessments: bankInputs.map((b) => assessBankVsSystemWide(b, snapshot)),
    finalStatus:
      "APPROVED CANDIDATE FOR CONTROLLED TESTING — NOT PRODUCTION-AUTHORIZED " +
      "(systemicRiskMonitoringLive=false, systemicRiskProductionValidated=false)",
    finalStatusColor: "amber",
  };
}

// ----------------------------------------------------------------------------
// §20.7 — Correlated exposure detection
// ----------------------------------------------------------------------------

export interface CorrelatedExposurePair {
  dimensionA: ConcentrationDimension;
  dimensionB: ConcentrationDimension;
  bucketA: ExposureBucket;
  bucketB: ExposureBucket;
  combinedExposurePct: number;
  reason: string;
}

export function correlatedExposure(
  dimensionA: ConcentrationDimension,
  dimensionB: ConcentrationDimension,
  snapshot: SystemicExposureSnapshot,
): CorrelatedExposurePair[] {
  const pairs: CorrelatedExposurePair[] = [];
  const bucketsA = snapshot.dimensions[dimensionA] ?? [];
  const bucketsB = snapshot.dimensions[dimensionB] ?? [];
  for (const a of bucketsA) {
    for (const b of bucketsB) {
      const sameEntity = a.metadata?.entityId && b.metadata?.entityId && a.metadata.entityId === b.metadata.entityId;
      const sameGroup = a.metadata?.parentGroup && b.metadata?.parentGroup && a.metadata.parentGroup === b.metadata.parentGroup;
      const sameJurisdiction = a.metadata?.jurisdiction && b.metadata?.jurisdiction && a.metadata.jurisdiction === b.metadata.jurisdiction;
      if (sameEntity || sameGroup || sameJurisdiction) {
        pairs.push({
          dimensionA,
          dimensionB,
          bucketA: a,
          bucketB: b,
          combinedExposurePct: a.exposurePct + b.exposurePct,
          reason: sameEntity ? "same entityId" : sameGroup ? "same parentGroup" : "same jurisdiction",
        });
      }
    }
  }
  return pairs.sort((x, y) => y.combinedExposurePct - x.combinedExposurePct);
}
