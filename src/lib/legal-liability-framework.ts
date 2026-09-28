// ============================================================================
//  MITHQAL — Legal Liability Framework (Blueprint v25.3 §49)
//  ----------------------------------------------------------------------------
//  Module ID:   v25.2-legal-liability-framework-1.0
//  Section:     §49
//  Source file: `src/lib/legal-liability-framework.ts`
//
//  The §49 framework models the legal / economic liability characterization
//  of the MTQ instrument across jurisdictions. It is the LEGAL-CHARACTERIZATION
//  companion to the §V25.2 reserve mathematical specification.
//
//  Controlling principle:
//    "NEVER INVENT LEGAL CLASSIFICATIONS."
//
//  Honest state (§74):
//    LEGAL_MODEL_DESIGNED:         true
//    LEGAL_REGISTRY_IMPLEMENTED:   true
//    LEGAL_OPINIONS_OBTAINED:      false
//    VALIDATED_JURISDICTIONS:      0
//
//  13 dimensions of liability; 8 seeded jurisdictions (US, EU/EEA, UK, CH,
//  SG, AE, SA, JP). Every jurisdiction is JURISDICTION_PENDING. MITHQAL's
//  role is NEVER guarantor.
// ============================================================================

export const LEGAL_LIABILITY_MODULE_ID = "v25.2-legal-liability-framework-1.0" as const;
export const LEGAL_LIABILITY_SECTION = 49 as const;

/** The single most important rule of §49. */
export const LEGAL_LIABILITY_PRINCIPLE =
  "NEVER INVENT LEGAL CLASSIFICATIONS." as const;

/** Disclaimer appended to every speculative seeded field. */
export const SPECULATIVE_NOTE =
  "PENDING OPINION — speculative engineering triage, not legal advice." as const;

// ----------------------------------------------------------------------------
// §18.2 — Honest state (§74)
// ----------------------------------------------------------------------------

export interface LegalLiabilityHonestState {
  LEGAL_MODEL_DESIGNED: true;
  LEGAL_REGISTRY_IMPLEMENTED: true;
  LEGAL_OPINIONS_OBTAINED: false;
  VALIDATED_JURISDICTIONS: 0;
}

export function legalLiabilityHonestState(): LegalLiabilityHonestState {
  return {
    LEGAL_MODEL_DESIGNED: true,
    LEGAL_REGISTRY_IMPLEMENTED: true,
    LEGAL_OPINIONS_OBTAINED: false,
    VALIDATED_JURISDICTIONS: 0,
  };
}

export const LEGAL_LIABILITY_HONEST_STATE = legalLiabilityHonestState();

// ----------------------------------------------------------------------------
// §18.3 — Legal classification lifecycle (one-way, evidence-gated)
// ----------------------------------------------------------------------------

export type LegalClassification =
  | "JURISDICTION_PENDING"      // default for every newly seeded jurisdiction
  | "LEGAL_OPINION_OBTAINED"    // external legal opinion registered
  | "VALIDATED";                // external validation evidence registered (TERMINAL)

// ----------------------------------------------------------------------------
// §18.4 — The 13 legal / economic liability dimensions
// ----------------------------------------------------------------------------

export type LegalLiabilityDimension =
  | "jurisdiction"
  | "legalNature"
  | "obligor"
  | "holderRights"
  | "redemption"
  | "settlementFinality"
  | "creditorTreatment"
  | "insolvencyTreatment"
  | "transferability"
  | "pledgeability"
  | "governingLaw"
  | "disputeResolution"
  | "licensingClassification";

export const LEGAL_LIABILITY_DIMENSIONS: ReadonlyArray<LegalLiabilityDimension> = [
  "jurisdiction",
  "legalNature",
  "obligor",
  "holderRights",
  "redemption",
  "settlementFinality",
  "creditorTreatment",
  "insolvencyTreatment",
  "transferability",
  "pledgeability",
  "governingLaw",
  "disputeResolution",
  "licensingClassification",
];

// ----------------------------------------------------------------------------
// §18.3 — Legal opinion + validation evidence schemas
// ----------------------------------------------------------------------------

export interface LegalOpinion {
  issuer: string;        // law firm or regulator that issued the opinion
  date: string;          // ISO-8601 date the opinion was issued
  artifact: string;      // stable identifier / URL / hash for the opinion document
  dimensions: Partial<Record<LegalLiabilityDimension, string>>;
  notes: string;
}

export interface ValidationEvidence {
  validator: string;     // external validator identity (regulator / auditor / counsel)
  date: string;          // ISO-8601 date validation was completed
  artifact: string;      // stable identifier / URL / hash for the validation document
  notes: string;
}

// ----------------------------------------------------------------------------
// §18.5 — Jurisdiction registry entry (8 seeded jurisdictions)
// ----------------------------------------------------------------------------

export type JurisdictionCode = "US" | "EU" | "UK" | "CH" | "SG" | "AE" | "SA" | "JP";

export interface JurisdictionEntry {
  code: JurisdictionCode;
  name: string;
  regulator: string;
  classification: LegalClassification;
  /** 13-dimension opinion text (seeded from public regulatory materials; PENDING OPINION). */
  dimensions: Record<LegalLiabilityDimension, string>;
  opinion: LegalOpinion | null;
  validation: ValidationEvidence | null;
}

export const JURISDICTION_NAMES: Record<JurisdictionCode, string> = {
  US: "United States",
  EU: "European Union / EEA",
  UK: "United Kingdom",
  CH: "Switzerland",
  SG: "Singapore",
  AE: "United Arab Emirates",
  SA: "Kingdom of Saudi Arabia",
  JP: "Japan",
};

export const JURISDICTION_REGULATORS: Record<JurisdictionCode, string> = {
  US: "FinCEN, SEC, CFTC, NYDFS",
  EU: "EBA, ESMA, ECB SSM",
  UK: "FCA, PRA, Bank of England",
  CH: "FINMA",
  SG: "MAS",
  AE: "CBUAE, VARA, ADGM, DIFC",
  SA: "SAMA, CMA",
  JP: "FSA, Bank of Japan",
};

// ----------------------------------------------------------------------------
// §18.5 — Seeded speculative dimension text (8 jurisdictions × 13 dimensions)
//
// All seeded text is the engineering team's reading of PUBLIC regulatory
// materials for triage only; it is NOT legal advice and MUST NOT be presented
// as a definitive classification. Every seeded value is suffixed with the
// SPECULATIVE_NOTE disclaimer.
// ----------------------------------------------------------------------------

function speculative(text: string): string {
  return `${text} ${SPECULATIVE_NOTE}`;
}

function seedDimensions(
  code: JurisdictionCode,
): Record<LegalLiabilityDimension, string> {
  const obligor = speculative(
    "Obligor is the issuing bank within the Protected Backing Cell, not MITHQAL. MITHQAL performs verification / governance only.",
  );
  const holderRights = speculative(
    "Holder is expected to hold a contractual claim on the earmarked backing, enforceable against the obligor bank, not against MITHQAL.",
  );
  const transferability = speculative(
    "Transferability expected to be restricted to KYC / AML-vetted institutional counterparties.",
  );
  const insolvency = speculative(
    "On obligor insolvency, holder expected to be an unsecured creditor unless backing is segregated / earmarked under applicable law.",
  );
  const pledgeability = speculative(
    "Pledgeability expected to require obligor consent and perfection under applicable law.",
  );
  const governingLaw = speculative(
    `Governing law expected to be ${JURISDICTION_NAMES[code]} (or the obligor bank's home jurisdiction).`,
  );
  const disputeResolution = speculative(
    `Disputes expected to be submitted to ${JURISDICTION_NAMES[code]} courts or arbitration.`,
  );

  const perJurisdiction: Record<JurisdictionCode, Partial<Record<LegalLiabilityDimension, string>>> = {
    US: {
      legalNature: speculative("Likely stored-value / settlement instrument (not a deposit, not a security)."),
      redemption: speculative("Redemption in fiat at PAR expected via the obligor bank; physical-bullion redemption subject to custody / bank terms."),
      settlementFinality: speculative("Settlement finality expected to follow the underlying rail (FedNow / wire / stablecoin) and chain finality."),
      creditorTreatment: speculative("Holder expected to rank as an unsecured creditor of the obligor absent a perfected security interest / segregation."),
      licensingClassification: speculative("FinCEN MSB registration, state MTL coverage, and NYDFS BitLicense where applicable."),
    },
    EU: {
      legalNature: speculative("Asset-referenced token (ART) under MiCA Reg. (EU) 2023/1114."),
      redemption: speculative("Redemption in fiat at PAR expected via the obligor bank; MiCA redemption timelines apply."),
      settlementFinality: speculative("CSDR / T+1 for cash legs and chain finality for token legs."),
      creditorTreatment: speculative("Holder expected to rank ahead of ordinary unsecured creditors to the extent of the segregated reserve under MiCA art.48."),
      licensingClassification: speculative("EBA-authorized ART issuer authorization (MiCA Title III) and CASP authorization where applicable."),
    },
    UK: {
      legalNature: speculative("Likely electronic money / payment token under FCA guidance (post-UK MiCA carve-out)."),
      redemption: speculative("Redemption at par expected via the obligor bank under FCA e-money rules."),
      settlementFinality: speculative("Follows the underlying rail (Faster Payments / CHAPS) and chain finality."),
      creditorTreatment: speculative("Holder expected to rank ahead of general creditors to extent of safeguarded funds under FCA CASS / e-money rules."),
      licensingClassification: speculative("FCA EMI or API authorization (PSRs 2017) and cryptoasset registration (MLRs 2017)."),
    },
    CH: {
      legalNature: speculative("Likely qualified digital payment token under FINMA guidance."),
      redemption: speculative("Redemption at par expected via the obligor bank."),
      settlementFinality: speculative("Follows SIC / Swiss RTGS and chain finality."),
      creditorTreatment: speculative("Holder benefits from segregation under art. 37a Swiss Banking Act (segregation of client assets)."),
      licensingClassification: speculative("FINMA FinTech license or bank license for digital payment tokens."),
    },
    SG: {
      legalNature: speculative("Single-currency stablecoin (SCS) under MAS SCS framework, or DPT under PSA."),
      redemption: speculative("MAS SCS framework's 5-business-day redemption expectation applies."),
      settlementFinality: speculative("Follows MAS FAST / PayNow and chain finality."),
      creditorTreatment: speculative("Holder expected to rank ahead of general creditors to extent of segregated reserve."),
      licensingClassification: speculative("MAS SCS issuer approval and/or DPT license under the PSA."),
    },
    AE: {
      legalNature: speculative("Likely payment token / stored value under CBUAE RPB and VARA rulebook."),
      redemption: speculative("Redemption at par expected via the obligor bank."),
      settlementFinality: speculative("Follows Aani / UAE FT and chain finality."),
      creditorTreatment: speculative("Holder expected to rank ahead of general creditors to extent of segregated reserve."),
      licensingClassification: speculative("CBUAE SVF License, or VARA VASP License (or ADGM / DIFC equivalent)."),
    },
    SA: {
      legalNature: speculative("Likely digital payment asset under SAMA / CMA crypto-asset activities rules."),
      redemption: speculative("Redemption at par expected via the obligor bank."),
      settlementFinality: speculative("Follows SARIE / mBridge and chain finality."),
      creditorTreatment: speculative("Holder expected to rank ahead of general creditors to extent of segregated reserve."),
      licensingClassification: speculative("SAMA PSP License and/or CMA Crypto-Asset Activities Authorization."),
    },
    JP: {
      legalNature: speculative("Likely 'electronic payment instrument' or stablecoin trust under the PSA / Trust Business Act (2023 revisions)."),
      redemption: speculative("Redemption at par expected via the obligor bank / trust."),
      settlementFinality: speculative("Follows BOJ-NET / Zengin and chain finality."),
      creditorTreatment: speculative("Holder expected to benefit from PSA trust rules (segregation of customer assets)."),
      licensingClassification: speculative("FSA electronic payment instrument registration or trust-company license; bank-issued stablecoin under Banking Act."),
    },
  };

  const seed = perJurisdiction[code];
  return {
    jurisdiction: `${code} — ${JURISDICTION_NAMES[code]} (${JURISDICTION_REGULATORS[code]})`,
    legalNature: seed.legalNature ?? speculative("PENDING OPINION."),
    obligor,
    holderRights,
    redemption: seed.redemption ?? speculative("Redemption at par expected via the obligor bank."),
    settlementFinality: seed.settlementFinality ?? speculative("Follows the underlying rail and chain finality."),
    creditorTreatment: seed.creditorTreatment ?? speculative("Holder expected to rank as an unsecured creditor absent perfected security interest."),
    insolvencyTreatment: seed.insolvencyTreatment ?? insolvency,
    transferability,
    pledgeability: pledgeability,
    governingLaw,
    disputeResolution,
    licensingClassification: seed.licensingClassification ?? speculative("PENDING OPINION."),
  };
}

// ----------------------------------------------------------------------------
// §18.5 — Build the registry: 8 jurisdictions, all JURISDICTION_PENDING
// ----------------------------------------------------------------------------

function buildJurisdictionRegistry(): JurisdictionEntry[] {
  const codes: JurisdictionCode[] = ["US", "EU", "UK", "CH", "SG", "AE", "SA", "JP"];
  return codes.map((code) => ({
    code,
    name: JURISDICTION_NAMES[code],
    regulator: JURISDICTION_REGULATORS[code],
    classification: "JURISDICTION_PENDING" as const,
    dimensions: seedDimensions(code),
    opinion: null,
    validation: null,
  }));
}

export const JURISDICTION_REGISTRY: JurisdictionEntry[] = buildJurisdictionRegistry();

// ----------------------------------------------------------------------------
// §18.3.2 — registerLegalOpinion (evidence-gated)
// ----------------------------------------------------------------------------

export interface OpinionRegistrationResult {
  ok: boolean;
  reason: string;
  entry: JurisdictionEntry;
}

export function registerLegalOpinion(
  entry: JurisdictionEntry,
  opinion: LegalOpinion,
): OpinionRegistrationResult {
  // VALIDATED is terminal — cannot be reset by a new opinion.
  if (entry.classification === "VALIDATED") {
    return {
      ok: false,
      reason: "VALIDATED is terminal — a validated jurisdiction cannot be reset by a new opinion.",
      entry,
    };
  }
  if (!opinion.issuer || !opinion.issuer.trim()) {
    return { ok: false, reason: "opinion.issuer is required", entry };
  }
  if (!opinion.date || !opinion.date.trim()) {
    return { ok: false, reason: "opinion.date is required", entry };
  }
  if (!opinion.artifact || !opinion.artifact.trim()) {
    return { ok: false, reason: "opinion.artifact is required", entry };
  }
  return {
    ok: true,
    reason: "legal opinion registered; classification advanced to LEGAL_OPINION_OBTAINED",
    entry: {
      ...entry,
      classification: "LEGAL_OPINION_OBTAINED",
      opinion,
      dimensions: { ...entry.dimensions, ...(opinion.dimensions ?? {}) },
    },
  };
}

// ----------------------------------------------------------------------------
// §18.3.3 — validateJurisdiction (evidence-gated, terminal)
// ----------------------------------------------------------------------------

export interface ValidationRegistrationResult {
  ok: boolean;
  reason: string;
  entry: JurisdictionEntry;
}

export function validateJurisdiction(
  entry: JurisdictionEntry,
  validation: ValidationEvidence,
): ValidationRegistrationResult {
  if (entry.classification !== "LEGAL_OPINION_OBTAINED") {
    return {
      ok: false,
      reason: "Validation requires the jurisdiction to first be LEGAL_OPINION_OBTAINED.",
      entry,
    };
  }
  if (!validation.validator || !validation.validator.trim()) {
    return { ok: false, reason: "validation.validator is required", entry };
  }
  if (!validation.date || !validation.date.trim()) {
    return { ok: false, reason: "validation.date is required", entry };
  }
  if (!validation.artifact || !validation.artifact.trim()) {
    return { ok: false, reason: "validation.artifact is required", entry };
  }
  return {
    ok: true,
    reason: "validation registered; classification advanced to VALIDATED (terminal)",
    entry: { ...entry, classification: "VALIDATED", validation },
  };
}

// ----------------------------------------------------------------------------
// §18 — MITHQAL's role is NEVER guarantor
// ----------------------------------------------------------------------------

export const MITHQAL_ROLE_NEVER_GUARANTOR =
  "MITHQAL's role is NEVER guarantor (per Invariant #3). The obligor is the issuing bank; MITHQAL performs verification and governance only.";

// ----------------------------------------------------------------------------
// §18 — Report generator
// ----------------------------------------------------------------------------

export interface LegalLiabilityReport {
  moduleId: typeof LEGAL_LIABILITY_MODULE_ID;
  section: typeof LEGAL_LIABILITY_SECTION;
  principle: typeof LEGAL_LIABILITY_PRINCIPLE;
  dimensions: ReadonlyArray<LegalLiabilityDimension>;
  jurisdictions: JurisdictionEntry[];
  honestState: LegalLiabilityHonestState;
  mithqalRole: string;
  finalStatus: string;
  finalStatusColor: "amber";
}

export function generateLegalLiabilityReport(): LegalLiabilityReport {
  return {
    moduleId: LEGAL_LIABILITY_MODULE_ID,
    section: LEGAL_LIABILITY_SECTION,
    principle: LEGAL_LIABILITY_PRINCIPLE,
    dimensions: LEGAL_LIABILITY_DIMENSIONS,
    jurisdictions: JURISDICTION_REGISTRY,
    honestState: legalLiabilityHonestState(),
    mithqalRole: MITHQAL_ROLE_NEVER_GUARANTOR,
    finalStatus:
      "LEGAL FRAMEWORK DESIGNED — ZERO JURISDICTIONS VALIDATED — " +
      "PENDING EXTERNAL LEGAL OPINIONS",
    finalStatusColor: "amber",
  };
}

// ----------------------------------------------------------------------------
// Convenience getters
// ----------------------------------------------------------------------------

export function getJurisdiction(code: JurisdictionCode): JurisdictionEntry | undefined {
  return JURISDICTION_REGISTRY.find((j) => j.code === code);
}

export function countValidatedJurisdictions(): number {
  return JURISDICTION_REGISTRY.filter((j) => j.classification === "VALIDATED").length;
}

export function countLegalOpinionsObtained(): number {
  return JURISDICTION_REGISTRY.filter((j) => j.classification === "LEGAL_OPINION_OBTAINED").length;
}
