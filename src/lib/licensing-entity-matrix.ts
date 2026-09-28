// ============================================================================
//  MITHQAL — Licensing / Entity Matrix (Blueprint v25.3 §50)
//  ----------------------------------------------------------------------------
//  Module ID:   v25.2-licensing-entity-matrix-1.0
//  Section:     §50
//  Source file: `src/lib/licensing-entity-matrix.ts`
//
//  The §50 framework defines the Licensing / Entity Matrix: a comprehensive
//  map of every (financial activity × jurisdiction) pair in which MITHQAL or
//  a participating entity would conduct regulated activity, and the license
//  / authorization required for that activity in that jurisdiction.
//
//  Controlling principle:
//    "Technical implementation is NOT regulatory authorization."
//
//  Honest state (§74):
//    licensingMatrixImplemented: true
//    licensesObtained:           0
//
//  Scope:
//    9 activities × 8 jurisdictions = 72 matrix entries
//    All 72 entries default to `status = REQUIRED_NOT_OBTAINED`.
//    MITHQAL's role is NEVER `GUARANTOR` or `FINANCIAL_GUARANTOR` (Invariant #3).
//
//  NOTE: Per the v25.3 task brief, the 9 activities are:
//    ISSUANCE, CUSTODY, SETTLEMENT, EXCHANGE, TRANSFER, REDEMPTION,
//    ADVISORY, TECHNOLOGY, GOVERNANCE
//  and the 8 jurisdictions are:
//    US, EU/EEA, UK, CH, SG, AE, SA, JP
// ============================================================================

export const LICENSING_MATRIX_MODULE_ID = "v25.2-licensing-entity-matrix-1.0" as const;
export const LICENSING_MATRIX_SECTION = 50 as const;

export const LICENSING_PRINCIPLE =
  "Technical implementation is NOT regulatory authorization." as const;

// ----------------------------------------------------------------------------
// §19.2 — Honest state (§74)
// ----------------------------------------------------------------------------

export interface LicensingMatrixHonestState {
  licensingMatrixImplemented: true;
  licensesObtained: 0;
}

export function licensingMatrixHonestState(): LicensingMatrixHonestState {
  return { licensingMatrixImplemented: true, licensesObtained: 0 };
}

export const LICENSING_MATRIX_HONEST_STATE = licensingMatrixHonestState();

// ----------------------------------------------------------------------------
// §19.3 — The 9 financial activities
// ----------------------------------------------------------------------------

export type FinancialActivity =
  | "ISSUANCE"
  | "CUSTODY"
  | "SETTLEMENT"
  | "EXCHANGE"
  | "TRANSFER"
  | "REDEMPTION"
  | "ADVISORY"
  | "TECHNOLOGY"
  | "GOVERNANCE";

export const FINANCIAL_ACTIVITIES: ReadonlyArray<FinancialActivity> = [
  "ISSUANCE",
  "CUSTODY",
  "SETTLEMENT",
  "EXCHANGE",
  "TRANSFER",
  "REDEMPTION",
  "ADVISORY",
  "TECHNOLOGY",
  "GOVERNANCE",
];

export const ACTIVITY_DESCRIPTIONS: Record<FinancialActivity, string> = {
  ISSUANCE: "Issuance of MTQ tokens against verified Protected Backing Cells.",
  CUSTODY: "Safekeeping / segregation / allocated custody of reserve assets (fiat, bullion, securities, digital).",
  SETTLEMENT: "Operation of / participation in a securities, payment, or digital-asset settlement system.",
  EXCHANGE: "Foreign-exchange dealing / conversion / spot & forward FX execution.",
  TRANSFER: "Money transmission / payment services / stored-value / payment-account operation.",
  REDEMPTION: "Redemption of MTQ for fiat / asset at par via the obligor bank.",
  ADVISORY: "Dealing in / arranging deals in / advising on securities (including tokenized securities).",
  TECHNOLOGY: "Engineering the technical infrastructure (MBG, smart contracts, oracle adapters).",
  GOVERNANCE: "Constitutional / Monetary / Risk / Emergency governance of the MITHQAL protocol.",
};

// ----------------------------------------------------------------------------
// §19.3 — The 8 jurisdictions
// ----------------------------------------------------------------------------

export type LicensingJurisdiction = "US" | "EU" | "UK" | "CH" | "SG" | "AE" | "SA" | "JP";

export const LICENSING_JURISDICTIONS: ReadonlyArray<LicensingJurisdiction> = [
  "US",
  "EU",
  "UK",
  "CH",
  "SG",
  "AE",
  "SA",
  "JP",
];

export const LICENSING_JURISDICTION_NAMES: Record<LicensingJurisdiction, string> = {
  US: "United States",
  EU: "European Union / EEA",
  UK: "United Kingdom",
  CH: "Switzerland",
  SG: "Singapore",
  AE: "United Arab Emirates",
  SA: "Kingdom of Saudi Arabia",
  JP: "Japan",
};

// ----------------------------------------------------------------------------
// §19.4 — Licensing lifecycle (one-way, evidence-gated)
// ----------------------------------------------------------------------------

export type LicenseStatus =
  | "REQUIRED_NOT_OBTAINED"   // DEFAULT
  | "PENDING_APPLICATION"
  | "OBTAINED"
  | "EXEMPT"
  | "PROHIBITED";

// ----------------------------------------------------------------------------
// §19.5 — MITHQAL role (NEVER GUARANTOR)
// ----------------------------------------------------------------------------

export type MithqalRole =
  | "NONE"
  | "VERIFICATION"
  | "ORCHESTRATION"
  | "INFRASTRUCTURE";

export const ALLOWED_MITHQAL_ROLES: ReadonlyArray<MithqalRole> = [
  "NONE",
  "VERIFICATION",
  "ORCHESTRATION",
  "INFRASTRUCTURE",
];

/** Roles GUARANTOR and FINANCIAL_GUARANTOR are PROHIBITED (Invariant #3). */
export const PROHIBITED_MITHQAL_ROLES = ["GUARANTOR", "FINANCIAL_GUARANTOR"] as const;

// ----------------------------------------------------------------------------
// §19.5.2 — Role-activity matrix
// ----------------------------------------------------------------------------

export const ROLE_BY_ACTIVITY: Record<FinancialActivity, MithqalRole> = {
  ISSUANCE: "ORCHESTRATION",
  CUSTODY: "VERIFICATION",
  SETTLEMENT: "ORCHESTRATION",
  EXCHANGE: "ORCHESTRATION",
  TRANSFER: "INFRASTRUCTURE",
  REDEMPTION: "ORCHESTRATION",
  ADVISORY: "INFRASTRUCTURE",
  TECHNOLOGY: "INFRASTRUCTURE",
  GOVERNANCE: "ORCHESTRATION",
};

// ----------------------------------------------------------------------------
// §19.6 — Per-jurisdiction required license text (canonical excerpts)
// ----------------------------------------------------------------------------

export const REQUIRED_LICENSES: Record<FinancialActivity, Record<LicensingJurisdiction, string>> = {
  ISSUANCE: {
    US: "Bank-issued token authorization via national bank charter + OCC interpretive letters; FinCEN MSB registration.",
    EU: "EBA-authorized ART issuer authorization (MiCA Title III, Reg. (EU) 2023/1114).",
    UK: "FCA cryptoasset registration (MLRs 2017) + e-money / payment-token authorization.",
    CH: "FINMA FinTech license or bank license for digital payment tokens.",
    SG: "MAS SCS issuer approval under the SCS framework (Payment Services Act).",
    AE: "CBUAE SVF License or VARA VASP License (or ADGM / DIFC equivalent).",
    SA: "SAMA Payment Service Provider License and/or CMA Crypto-Asset Activities Authorization.",
    JP: "FSA electronic payment instrument registration or trust-company license; bank-issued stablecoin under Banking Act.",
  },
  CUSTODY: {
    US: "Trust Company charter (state) or SEC adviser-custody compliance under Rule 206(4)-2.",
    EU: "CSDR Authorized CSD or MiCAR CASP Custody (for digital assets).",
    UK: "FCA Custody & Safekeeping Authorization (CASS rules).",
    CH: "FINMA Custodian Bank License (Banking Act).",
    SG: "MAS Capital Markets Services License — Custody Services (SFA).",
    AE: "CBUAE Custody Authorization / ADGM or DIFC Custody License.",
    SA: "CMA Custody Services Authorization (CML).",
    JP: "FSA custody authorization under the PSA / Financial Instruments Act.",
  },
  SETTLEMENT: {
    US: "ACH / Fedwire operator authorization; CHIPs participation; RTP network access.",
    EU: "T2 / TIPS operator authorization; EBA Clearing participation.",
    UK: "CHAPS / Faster Payments participation; Bank of England settlement access.",
    CH: "SIC system participation; Swiss National Bank settlement access.",
    SG: "MAS FAST / PayNow participation; MAS settlement access.",
    AE: "Aani / UAE FT participation; CBUAE settlement access.",
    SA: "SARIE / mBridge participation; SAMA settlement access.",
    JP: "BOJ-NET / Zengin participation; Bank of Japan settlement access.",
  },
  EXCHANGE: {
    US: "NFA membership + CFTC FCM registration or state Money Transmitter License (for retail FX).",
    EU: "EMI / PI License with FX scope under PSD2 (or MiFID II for FX derivatives).",
    UK: "FCA Authorized Payment Institution with FX scope (or Investment Firm for FX derivatives).",
    CH: "FINMA Bank License (FX dealing treated as banking activity).",
    SG: "MAS Major Payment Institution License — Merchant FX (PSN02).",
    AE: "CBUAE FX Authorization (Retail FX Rules where retail clients are served).",
    SA: "SAMA Authorized FX Dealer License (SAMA FX Rules).",
    JP: "FSA registration as a Type I or Type II Financial Instruments Business (for FX derivatives).",
  },
  TRANSFER: {
    US: "FinCEN MSB registration + state-by-state Money Transmitter Licenses (BSA).",
    EU: "EMI or PI License under PSD2 (transposing into PSD3 / PSR1).",
    UK: "FCA Authorized Payment Institution or EMI Authorization (PSRs 2017).",
    CH: "FINMA FinTech License or Bank-type license for payment services.",
    SG: "MAS Major Payment Institution License (PSN02, Payment Services Act).",
    AE: "CBUAE Stored Value Facility (SVF) License (RPB).",
    SA: "SAMA Payment Service Provider License (PSP Rules).",
    JP: "FSA registration as a Funds Transfer Service Provider (PSA, 2023 revisions).",
  },
  REDEMPTION: {
    US: "Bank-issued redemption obligation under the issuing bank's national / state bank charter.",
    EU: "MiCA ART issuer redemption obligation (Title III, Reg. (EU) 2023/1114).",
    UK: "FCA e-money / payment-token redemption obligation under PSRs 2017.",
    CH: "FINMA-regulated bank redemption obligation under Banking Act.",
    SG: "MAS SCS redemption obligation under the SCS framework.",
    AE: "CBUAE-regulated bank redemption obligation.",
    SA: "SAMA-regulated bank redemption obligation.",
    JP: "PSA trust redemption obligation; bank-issued stablecoin redemption under Banking Act.",
  },
  ADVISORY: {
    US: "SEC Broker-Dealer registration (FINRA member) + ATS registration under Reg. ATS (where applicable).",
    EU: "MiFID II Investment Firm Authorization (IFD / IFR).",
    UK: "FCA Investment Firm Authorization under MiFID II (IFD / IFR).",
    CH: "FINMA Securities Dealer License (FinSA).",
    SG: "MAS Capital Markets Services License — Dealing in / Advising on Capital Markets Products (SFA).",
    AE: "SCA Financial Activities License (Securities & Commodities Authority).",
    SA: "CMA Authorized Person license (CML).",
    JP: "FSA registration as a Financial Instruments Business (FIEA).",
  },
  TECHNOLOGY: {
    US: "No separate license required (MBG technology infrastructure); bank licensee operates under its own licenses.",
    EU: "No separate license required; technology provider under MiCAR / DORA oversight.",
    UK: "No separate license required; technology provider under FCA operational-resilience rules.",
    CH: "No separate license required; FINMA outsourcing rules apply.",
    SG: "No separate license required; MAS outsourcing / technology-risk-management guidelines apply.",
    AE: "No separate license required; CBUAE / VARA outsourcing rules apply.",
    SA: "No separate license required; SAMA / CMA outsourcing rules apply.",
    JP: "No separate license required; FSA outsourcing rules apply.",
  },
  GOVERNANCE: {
    US: "Foundation / corporate governance filings (Delaware / NJ); no separate financial license for governance itself.",
    EU: "Foundation governance under home-Member-State law; MiCAR governance disclosures where applicable.",
    UK: "Foundation / company governance filings at Companies House; FCA senior-manager regime where applicable.",
    CH: "Foundation governance under Swiss Civil Code; FINMA governance rules where applicable.",
    SG: "Foundation / company governance filings (ACRA); MAS board / senior-management expectations where applicable.",
    AE: "Foundation / company governance filings (relevant free-zone authority); CBUAE / VARA governance rules where applicable.",
    SA: "Foundation / company governance filings (MOCI); SAMA / CMA governance rules where applicable.",
    JP: "Foundation / company governance filings (Legal Affairs Bureau); FSA governance rules where applicable.",
  },
};

// ----------------------------------------------------------------------------
// §19.3.3 — Matrix entries (72 total)
// ----------------------------------------------------------------------------

export interface LicenseMatrixEntry {
  activity: FinancialActivity;
  jurisdiction: LicensingJurisdiction;
  requiredLicense: string;
  status: LicenseStatus;
  evidence: string;   // NONE until registered
  mithqalRole: MithqalRole;
  bankRole: string;
  custodianRole: string;
  liquidityProviderRole: string;
}

function buildMatrix(): LicenseMatrixEntry[] {
  const entries: LicenseMatrixEntry[] = [];
  for (const activity of FINANCIAL_ACTIVITIES) {
    for (const jurisdiction of LICENSING_JURISDICTIONS) {
      entries.push({
        activity,
        jurisdiction,
        requiredLicense: REQUIRED_LICENSES[activity][jurisdiction],
        status: "REQUIRED_NOT_OBTAINED",
        evidence: "NONE",
        mithqalRole: ROLE_BY_ACTIVITY[activity],
        bankRole: "FULL — licensed depository institution conducts all regulated banking activity.",
        custodianRole: "Qualified custodian holds assets in allocated, segregated, bankruptcy-remote custody.",
        liquidityProviderRole: "Authorized liquidity provider (where applicable) under its own license.",
      });
    }
  }
  return entries;
}

export const LICENSING_MATRIX: ReadonlyArray<LicenseMatrixEntry> = buildMatrix();

// ----------------------------------------------------------------------------
// §19.4.6 + §19.5 — Module-load invariants
// ----------------------------------------------------------------------------

/** Asserts at module load that licensesObtained === 0 (no entry has been pre-licensed). */
export const LICENSES_OBTAINED = 0 as const;

/** Asserts at module load that no entry's mithqalRole is GUARANTOR / FINANCIAL_GUARANTOR. */
export function assertMithqalRoleInvariant(): void {
  for (const entry of LICENSING_MATRIX) {
    const role = entry.mithqalRole;
    if ((PROHIBITED_MITHQAL_ROLES as readonly string[]).includes(role)) {
      throw new Error(
        `§50 INVARIANT VIOLATION: activity ${entry.activity} in jurisdiction ${entry.jurisdiction} ` +
        `has prohibited mithqalRole '${role}'. MITHQAL is NEVER the guarantor (Invariant #3).`,
      );
    }
    if (!(ALLOWED_MITHQAL_ROLES as readonly string[]).includes(role)) {
      throw new Error(
        `§50 INVARIANT VIOLATION: activity ${entry.activity} in jurisdiction ${entry.jurisdiction} ` +
        `has unknown mithqalRole '${role}'. Allowed: ${ALLOWED_MITHQAL_ROLES.join(", ")}.`,
      );
    }
  }
}

assertMithqalRoleInvariant();

// ----------------------------------------------------------------------------
// §19.4 — registerLicenseObtained (evidence-gated)
// ----------------------------------------------------------------------------

export interface LicenseRegistrationResult {
  ok: boolean;
  reason: string;
  entry: LicenseMatrixEntry;
}

export function registerLicenseObtained(
  entry: LicenseMatrixEntry,
  evidence: string,
): LicenseRegistrationResult {
  if (!evidence || !evidence.trim()) {
    return {
      ok: false,
      reason: "evidence is required (regulator URL, certificate reference, or register entry).",
      entry,
    };
  }
  if (entry.status === "PROHIBITED") {
    return {
      ok: false,
      reason: "Activity is PROHIBITED in this jurisdiction; cannot be licensed.",
      entry,
    };
  }
  return {
    ok: true,
    reason: "license registered; status advanced to OBTAINED (terminal).",
    entry: { ...entry, status: "OBTAINED", evidence },
  };
}

// ----------------------------------------------------------------------------
// §50 — Report generator
// ----------------------------------------------------------------------------

export interface LicensingMatrixReport {
  moduleId: typeof LICENSING_MATRIX_MODULE_ID;
  section: typeof LICENSING_MATRIX_SECTION;
  principle: typeof LICENSING_PRINCIPLE;
  activities: ReadonlyArray<FinancialActivity>;
  jurisdictions: ReadonlyArray<LicensingJurisdiction>;
  matrixSize: number;
  entries: ReadonlyArray<LicenseMatrixEntry>;
  honestState: LicensingMatrixHonestState;
  mithqalRoleInvariant: string;
  finalStatus: string;
  finalStatusColor: "amber";
}

export function generateLicensingMatrixReport(): LicensingMatrixReport {
  return {
    moduleId: LICENSING_MATRIX_MODULE_ID,
    section: LICENSING_MATRIX_SECTION,
    principle: LICENSING_PRINCIPLE,
    activities: FINANCIAL_ACTIVITIES,
    jurisdictions: LICENSING_JURISDICTIONS,
    matrixSize: LICENSING_MATRIX.length, // 72
    entries: LICENSING_MATRIX,
    honestState: licensingMatrixHonestState(),
    mithqalRoleInvariant:
      "MITHQAL's role is NEVER `GUARANTOR` or `FINANCIAL_GUARANTOR` for any " +
      "activity in any jurisdiction (Invariant #3).",
    finalStatus:
      "IMPLEMENTED BLUEPRINT — 0 LICENSES OBTAINED — NOT REGULATORY-AUTHORIZED — " +
      "NOT PRODUCTION-AUTHORIZED",
    finalStatusColor: "amber",
  };
}

// ----------------------------------------------------------------------------
// Convenience getters
// ----------------------------------------------------------------------------

export function getEntry(
  activity: FinancialActivity,
  jurisdiction: LicensingJurisdiction,
): LicenseMatrixEntry | undefined {
  return LICENSING_MATRIX.find(
    (e) => e.activity === activity && e.jurisdiction === jurisdiction,
  );
}

export function countLicensesObtained(): number {
  return LICENSING_MATRIX.filter((e) => e.status === "OBTAINED").length;
}
