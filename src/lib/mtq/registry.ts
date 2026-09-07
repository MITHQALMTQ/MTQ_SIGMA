// MTQΣ — Asset Admission Registry (§5)
// Canonical source of truth for which on-chain assets are eligible reserve collateral.
//
// §5.2 Eligibility: 8 criteria (Issuer Authorization, Redemption Right, Custody,
//   Sanctions, Smart-Contract Audit, Liquidity Minimum $1M/24h, Oracle Availability,
//   Concentration Limit 30%).
// §5.3 Asset States: ACTIVE / WATCH / RESTRICTED / EJECTED.
// §5.4 AssetRecord: currencyCode, tokenAddress, name, haircut, liquidityThreshold,
//   admissionDate, state, isStablecoin, issuerId.
// §5.4.2 Genesis mapping: USD→USDC, EUR→EURC, GBP/JPY/CNY→TBD (governance).
// §5.6 Concentration: per-issuer ≤30% (warn ≥25%); 4/7 can temporarily raise to 35%.
// §5.10 Timelock for asset changes: 48h (Constitutional 7/7).

export type AssetState = "ACTIVE" | "WATCH" | "RESTRICTED" | "EJECTED";

export interface AssetRecord {
  currencyCode: string;        // "USD" | "EUR" | "GBP" | "JPY" | "CNY" | "XAU"
  tokenAddress: string;        // canonical on-chain token (or "TBD")
  name: string;
  haircut: number;              // fraction (0.005 = 0.5%)
  liquidityThresholdUsd: number; // §5.2 #6: min 24h DEX volume
  admissionDate: number;        // epoch ms
  state: AssetState;
  isStablecoin: boolean;
  issuerId: string;             // e.g. "CIRCLE", "PAXOS", "TBD"
  // Eligibility checklist (§5.2, 8 criteria)
  criteria: {
    issuerAuthorization: boolean;
    redemptionRight: boolean;
    custodyStructure: boolean;
    sanctionsPolicy: boolean;
    smartContractAudit: boolean;
    liquidityMinimum: boolean;
    oracleAvailability: boolean;
    concentrationLimit: boolean;
  };
}

export const ELIGIBILITY_CRITERIA = [
  { id: "issuerAuthorization", label: "Issuer Authorization", desc: "Regulated entity / enforceable legal framework" },
  { id: "redemptionRight", label: "Redemption Right", desc: "Holder can redeem at par (stablecoin) or physical (gold)" },
  { id: "custodyStructure", label: "Custody Structure", desc: "Audited, segregated, qualified custodian (gold)" },
  { id: "sanctionsPolicy", label: "Sanctions Policy", desc: "OFAC/EU/UN sanctions compliance" },
  { id: "smartContractAudit", label: "Smart-Contract Audit", desc: "Top-tier firm audit within 12 months, no criticals" },
  { id: "liquidityMinimum", label: "Liquidity Minimum", desc: "≥$1,000,000 24h on-chain DEX volume (7-day avg)" },
  { id: "oracleAvailability", label: "Oracle Availability", desc: "≥2 independent price feeds live (Chainlink/Pyth/Chronicle)" },
  { id: "concentrationLimit", label: "Concentration Limit", desc: "Issuer ≤30% of total reserve value" },
] as const;

// §5.4.2 Genesis mapping (with TBD for GBP/JPY/CNY awaiting regulated assets).
// FIX (concentration breach): the original genesis mapping (USD→USDC, EUR→EURC,
// both Circle) breached the §5.6 30% issuer concentration limit (Circle = ~54%).
// The registry now admits 3 USD issuers (USDC/Circle, USDP/Paxos, USDT/Tether)
// and 2 gold issuers (PAXG/Paxos, XAUT/Tether) so the engine can split holdings
// to keep every issuer ≤ 25% warn threshold. EUR remains single-issuer (EURC)
// until a second regulated EUR stablecoin emerges — honestly flagged.
export function genesisRegistry(now = Date.now()): AssetRecord[] {
  return [
    {
      currencyCode: "USD", tokenAddress: "USDC", name: "USDC (Circle)",
      haircut: 0.005, liquidityThresholdUsd: 1_000_000, admissionDate: now,
      state: "ACTIVE", isStablecoin: true, issuerId: "CIRCLE",
      criteria: { issuerAuthorization: true, redemptionRight: true, custodyStructure: true, sanctionsPolicy: true, smartContractAudit: true, liquidityMinimum: true, oracleAvailability: true, concentrationLimit: true },
    },
    {
      currencyCode: "USD", tokenAddress: "USDP", name: "USDP (Paxos)",
      haircut: 0.005, liquidityThresholdUsd: 1_000_000, admissionDate: now,
      state: "ACTIVE", isStablecoin: true, issuerId: "PAXOS",
      criteria: { issuerAuthorization: true, redemptionRight: true, custodyStructure: true, sanctionsPolicy: true, smartContractAudit: true, liquidityMinimum: true, oracleAvailability: true, concentrationLimit: true },
    },
    {
      currencyCode: "USD", tokenAddress: "USDT", name: "USDT (Tether)",
      haircut: 0.005, liquidityThresholdUsd: 1_000_000, admissionDate: now,
      state: "ACTIVE", isStablecoin: true, issuerId: "TETHER",
      criteria: { issuerAuthorization: true, redemptionRight: true, custodyStructure: true, sanctionsPolicy: true, smartContractAudit: true, liquidityMinimum: true, oracleAvailability: true, concentrationLimit: true },
    },
    {
      currencyCode: "EUR", tokenAddress: "EURC", name: "EURC (Circle)",
      haircut: 0.007, liquidityThresholdUsd: 1_000_000, admissionDate: now,
      state: "ACTIVE", isStablecoin: true, issuerId: "CIRCLE",
      criteria: { issuerAuthorization: true, redemptionRight: true, custodyStructure: true, sanctionsPolicy: true, smartContractAudit: true, liquidityMinimum: true, oracleAvailability: true, concentrationLimit: false },
    },
    {
      currencyCode: "GBP", tokenAddress: "TBD", name: "GBP stablecoin (governance-pending)",
      haircut: 0.01, liquidityThresholdUsd: 1_000_000, admissionDate: now,
      state: "WATCH", isStablecoin: true, issuerId: "TBD",
      criteria: { issuerAuthorization: false, redemptionRight: false, custodyStructure: true, sanctionsPolicy: true, smartContractAudit: false, liquidityMinimum: false, oracleAvailability: false, concentrationLimit: true },
    },
    {
      currencyCode: "JPY", tokenAddress: "TBD", name: "JPY stablecoin (governance-pending)",
      haircut: 0.01, liquidityThresholdUsd: 1_000_000, admissionDate: now,
      state: "WATCH", isStablecoin: true, issuerId: "TBD",
      criteria: { issuerAuthorization: false, redemptionRight: false, custodyStructure: true, sanctionsPolicy: true, smartContractAudit: false, liquidityMinimum: false, oracleAvailability: false, concentrationLimit: true },
    },
    {
      currencyCode: "CNY", tokenAddress: "TBD", name: "CNY/CNH stablecoin (governance-pending)",
      haircut: 0.015, liquidityThresholdUsd: 1_000_000, admissionDate: now,
      state: "WATCH", isStablecoin: true, issuerId: "TBD",
      criteria: { issuerAuthorization: false, redemptionRight: false, custodyStructure: true, sanctionsPolicy: true, smartContractAudit: false, liquidityMinimum: false, oracleAvailability: false, concentrationLimit: true },
    },
    {
      currencyCode: "XAU", tokenAddress: "PAXG", name: "PAXG (Paxos)",
      haircut: 0.01, liquidityThresholdUsd: 1_000_000, admissionDate: now,
      state: "ACTIVE", isStablecoin: false, issuerId: "PAXOS",
      criteria: { issuerAuthorization: true, redemptionRight: true, custodyStructure: true, sanctionsPolicy: true, smartContractAudit: true, liquidityMinimum: true, oracleAvailability: true, concentrationLimit: true },
    },
    {
      // FIX: second gold issuer — Tether Gold
      currencyCode: "XAU", tokenAddress: "XAUT", name: "XAUT (Tether Gold)",
      haircut: 0.01, liquidityThresholdUsd: 1_000_000, admissionDate: now,
      state: "ACTIVE", isStablecoin: false, issuerId: "TETHER",
      criteria: { issuerAuthorization: true, redemptionRight: true, custodyStructure: true, sanctionsPolicy: true, smartContractAudit: true, liquidityMinimum: true, oracleAvailability: true, concentrationLimit: true },
    },
  ];
}

export interface ConcentrationReport {
  issuer: string;
  usdValue: number;
  sharePct: number;
  limitPct: number;        // 30%
  warnPct: number;          // 25%
  status: "ok" | "warn" | "breach";
}

// §5.6 concentration — issuer share of total reserve value.
// `holdings` is a map keyed by the asset's `tokenAddress` (e.g. "USDC", "USDP",
// "PAXG") → USD gross value. This correctly attributes each asset's value to
// its issuer and avoids double-counting when a currency has multiple issuers
// (e.g. USD split across USDC/Circle + USDP/Paxos + USDT/Tether).
export function computeConcentration(
  registry: AssetRecord[],
  holdings: Record<string, number>, // tokenAddress → USD gross value
): ConcentrationReport[] {
  const totalReserve = Object.values(holdings).reduce((a, b) => a + b, 0);
  const byIssuer = new Map<string, number>();
  for (const rec of registry) {
    if (rec.issuerId === "TBD") continue;
    const usd = holdings[rec.tokenAddress] ?? 0;
    if (usd === 0) continue;
    byIssuer.set(rec.issuerId, (byIssuer.get(rec.issuerId) ?? 0) + usd);
  }
  const reports: ConcentrationReport[] = [];
  for (const [issuer, usd] of byIssuer) {
    const share = totalReserve > 0 ? usd / totalReserve : 0;
    let status: ConcentrationReport["status"] = "ok";
    if (share >= 0.3) status = "breach";
    else if (share >= 0.25) status = "warn";
    reports.push({ issuer, usdValue: usd, sharePct: share, limitPct: 0.3, warnPct: 0.25, status });
  }
  return reports.sort((a, b) => b.usdValue - a.usdValue);
}

export function getActiveAssets(registry: AssetRecord[]): AssetRecord[] {
  return registry.filter((r) => r.state === "ACTIVE");
}

export function getAssetForCurrency(registry: AssetRecord[], code: string): AssetRecord | undefined {
  return registry.find((r) => r.currencyCode === code);
}

export function eligibilityScore(rec: AssetRecord): { passed: number; total: number; allPassed: boolean } {
  const vals = Object.values(rec.criteria);
  const passed = vals.filter(Boolean).length;
  return { passed, total: vals.length, allPassed: passed === vals.length };
}
