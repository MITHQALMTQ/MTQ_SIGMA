// ============================================================================
//  MITHQAL — Bank Default & Resolution Framework (Blueprint v25.3 §48)
//  ----------------------------------------------------------------------------
//  Module ID:   v25.2-bank-default-resolution-1.0
//  Section:     §48
//  Source file: `src/lib/bank-default-resolution.ts`
//
//  The §48 framework specifies what happens to MTQ — and to MTQ holders —
//  when a participating MTQ-issuing bank weakens, defaults, becomes
//  insolvent, enters resolution, or exits the MITHQAL system.
//
//  Controlling principle (Invariant #3 of the MITHQAL architecture):
//    "MITHQAL is NOT the financial guarantor."
//
//  8-state lifecycle:
//    ACTIVE → RESTRICTED → LIQUIDITY_STRESS → SUSPENDED → DEFAULT →
//    INSOLVENT → RESOLUTION → EXIT
//
//  11 contractual questions answered per state (§17.7):
//    Q1  Who is the obligor?
//    Q2  What is the holder's claim?
//    Q3  What is the claim priority?
//    Q4  What happens to existing MTQ?
//    Q5  Can it continue transferring?
//    Q6  Can it redeem?
//    Q7  Who absorbs losses?
//    Q8  What happens to backing?
//    Q9  What does the resolution authority control?
//    Q10 How is reconciliation performed?
//    Q11 What happens on exit?
//
//  Resolution waterfall (§17.7 Q7): custodian takes over backing → MTQ
//  holders redeemed from custodian → bank expelled.
//
//  Honest state (§74): SPECIFIED, NOT CONTRACTED. APPROVED FOR
//  INSTITUTIONAL ENGAGEMENT (banks, regulators, resolution authorities).
//  NOT PRODUCTION-AUTHORIZED. `bankDefaultContractValidated = false`.
// ============================================================================

export const BANK_DEFAULT_MODULE_ID = "v25.2-bank-default-resolution-1.0" as const;
export const BANK_DEFAULT_SECTION = 48 as const;

/** Invariant #3 — MITHQAL is NOT the financial guarantor. */
export const PRINCIPLE = "MITHQAL is NOT the financial guarantor" as const;

// ----------------------------------------------------------------------------
// §17.1 — MITHQAL's role (what it does / does NOT do)
// ----------------------------------------------------------------------------

export const MITHQAL_OPERATES: readonly string[] = [
  "Operates the protocol (mint / verify / authorize / record / reconcile).",
  "Verifies backing (Protected Backing Cell ≥ on-chain MTQ supply at 130% target).",
  "Applies constitutional rules (composition, concentration, currency lifecycle, finality).",
  "Calculates issuance capacity (DMCE inputs + bank's verified capacity).",
  "Authorizes issuance (signs the on-chain mint authorization).",
  "Reconciles (continuous S_bank vs. Protected Backing Cell reconciliation).",
  "Monitors systemic risk (13-dimension §52 systemic exposure engine).",
] as const;

export const MITHQAL_DOES_NOT: readonly string[] = [
  "Does NOT guarantee the solvency of participating banks.",
  "Does NOT indemnify holders against bank default.",
  "Does NOT step into the shoes of a bank's resolution authority.",
  "Does NOT hold the Protected Backing Cell (bank custody or qualified custodian).",
  "Does NOT absorb losses.",
  "Does NOT halt on-chain transfers (chain neutrality is absolute).",
  "Does NOT print money to make holders whole.",
  "Does NOT act as a deposit insurer.",
  "Does NOT act as a lender of last resort.",
  "Does NOT represent that the framework is contracted.",
] as const;

// ----------------------------------------------------------------------------
// §17.2 — The 8-state lifecycle
// ----------------------------------------------------------------------------

export type BankLifecycleState =
  | "ACTIVE"
  | "RESTRICTED"
  | "LIQUIDITY_STRESS"
  | "SUSPENDED"
  | "DEFAULT"
  | "INSOLVENT"
  | "RESOLUTION"
  | "EXIT";

export const BANK_LIFECYCLE_STATES: BankLifecycleState[] = [
  "ACTIVE",
  "RESTRICTED",
  "LIQUIDITY_STRESS",
  "SUSPENDED",
  "DEFAULT",
  "INSOLVENT",
  "RESOLUTION",
  "EXIT",
];

/** The lifecycle is forward-only by default; this array records that order. */
export const BANK_LIFECYCLE_ORDER: ReadonlyArray<BankLifecycleState> = BANK_LIFECYCLE_STATES;

// ----------------------------------------------------------------------------
// §17.2.2 — Signal priority (highest first)
// ----------------------------------------------------------------------------

export type BankLifecycleSignal =
  | "exitCompleted"
  | "resolutionTriggered"
  | "insolvencyDeclared"
  | "defaultDeclared"
  | "regulatoryAction"
  | "liquidityStress"
  | "capitalAdequacyBreach";

export const SIGNAL_PRIORITY: ReadonlyArray<BankLifecycleSignal> = [
  "exitCompleted",
  "resolutionTriggered",
  "insolvencyDeclared",
  "defaultDeclared",
  "regulatoryAction",
  "liquidityStress",
  "capitalAdequacyBreach",
];

export const SIGNAL_TO_STATE: Record<BankLifecycleSignal, BankLifecycleState> = {
  exitCompleted: "EXIT",
  resolutionTriggered: "RESOLUTION",
  insolvencyDeclared: "INSOLVENT",
  defaultDeclared: "DEFAULT",
  regulatoryAction: "SUSPENDED",
  liquidityStress: "LIQUIDITY_STRESS",
  capitalAdequacyBreach: "RESTRICTED",
};

export const STATE_TO_SIGNAL: Record<BankLifecycleState, BankLifecycleSignal> = {
  ACTIVE: "capitalAdequacyBreach", // sentinel — ACTIVE is the initial state, no signal
  RESTRICTED: "capitalAdequacyBreach",
  LIQUIDITY_STRESS: "liquidityStress",
  SUSPENDED: "regulatoryAction",
  DEFAULT: "defaultDeclared",
  INSOLVENT: "insolvencyDeclared",
  RESOLUTION: "resolutionTriggered",
  EXIT: "exitCompleted",
};

function stateIndex(s: BankLifecycleState): number {
  return BANK_LIFECYCLE_STATES.indexOf(s);
}

/**
 * Apply one or more simultaneously-observed signals to the bank's current
 * state. The most-severe signal wins — but ONLY if its target state is
 * strictly further along the lifecycle than the current state (the engine
 * models forward transitions only; recovery requires explicit regulatory
 * action and is out of scope).
 */
export function applySignals(
  current: BankLifecycleState,
  signals: BankLifecycleSignal[],
): BankLifecycleState {
  let result = current;
  const curIdx = stateIndex(current);
  for (const sig of SIGNAL_PRIORITY) {
    if (!signals.includes(sig)) continue;
    const target = SIGNAL_TO_STATE[sig];
    const tgtIdx = stateIndex(target);
    if (tgtIdx > curIdx && tgtIdx > stateIndex(result)) {
      result = target;
    }
  }
  return result;
}

// ----------------------------------------------------------------------------
// §17.2.3 — Nine behavioral dimensions per state
// ----------------------------------------------------------------------------

export interface BankStateBehavior {
  newIssuance: string;
  existingTransfer: string;
  redemption: string;
  backingStatus: string;
  liquidity: string;
  customerTreatment: string;
  receivingBankTreatment: string;
  reconciliation: string;
  resolutionProcedure: string;
}

export const STATE_BEHAVIOR: Record<BankLifecycleState, BankStateBehavior> = {
  ACTIVE: {
    newIssuance: "ALLOWED — issue up to verified capacity, backed 1:1+ at 130% strategic target.",
    existingTransfer: "ALLOWED — on-chain MTQ transfers freely between wallets and banks.",
    redemption: "ALLOWED — normal redemption queue at PAR.",
    backingStatus: "FULLY_BACKED — cell holds ≥ 100% of MTQ liability (target 130%).",
    liquidity: "ADEQUATE — LCR ≥ 1.0, redemption buffer ≥ 2% of reserves.",
    customerTreatment: "Normal banking services — deposit, transfer, redeem.",
    receivingBankTreatment: "Accept incoming MTQ without restriction.",
    reconciliation: "Daily reconciliation per the bank-onboarding spec.",
    resolutionProcedure: "None — preventive monitoring only.",
  },
  RESTRICTED: {
    newIssuance: "CONDITIONAL — issuance throttled to ≤ 40% of verified capacity.",
    existingTransfer: "ALLOWED — chain neutrality preserved.",
    redemption: "ALLOWED — redemptions continue normally at par.",
    backingStatus: "FULLY_BACKED — cell unaffected by capital-side weakness.",
    liquidity: "ADEQUATE — LCR ≥ 1.0 maintained.",
    customerTreatment: "Normal banking services; capital weakness not yet impacting customers.",
    receivingBankTreatment: "Accept incoming MTQ; enhanced monitoring on originating bank.",
    reconciliation: "Twice-daily reconciliation.",
    resolutionProcedure: "Corrective-action plan monitored; no resolution tool active.",
  },
  LIQUIDITY_STRESS: {
    newIssuance: "SUSPENDED — LCR < 1.0; no new issuance.",
    existingTransfer: "ALLOWED — chain neutrality preserved.",
    redemption: "THROTTLED — redemption queue active; redemption-continuity state = STRESS.",
    backingStatus: "FULLY_BACKED — cell unaffected.",
    liquidity: "STRESSED — LCR < 1.0.",
    customerTreatment: "Redemption queue; communications expected.",
    receivingBankTreatment: "Accept incoming MTQ; cross-bank reconciliation activated.",
    reconciliation: "Hourly reconciliation.",
    resolutionProcedure: "Liquidity-support plan monitored; no resolution tool active yet.",
  },
  SUSPENDED: {
    newIssuance: "BLOCKED — regulatory action; bank gateway frozen at source.",
    existingTransfer: "ALLOWED — on-chain MTQ transfers freely (chain neutrality absolute).",
    redemption: "BLOCKED at this bank; holders may transfer to another participating bank.",
    backingStatus: "PRESERVED — Protected Backing Cell locked.",
    liquidity: "FROZEN — bank operations frozen.",
    customerTreatment: "Bank gateway suspended; holders may migrate via on-chain transfer.",
    receivingBankTreatment: "Receiving banks accept migrating holders via cross-bank protocol.",
    reconciliation: "Full snapshot reconciliation.",
    resolutionProcedure: "Regulator-led; MITHQAL provides data, not direction.",
  },
  DEFAULT: {
    newIssuance: "BLOCKED — bank has defaulted on payment obligations.",
    existingTransfer: "ALLOWED — on-chain MTQ transfers freely.",
    redemption: "BLOCKED at this bank; cross-bank redemption via PBC available.",
    backingStatus: "LEGALLY SEQUESTERED — cell segregated from bank's general estate.",
    liquidity: "DEFAULT — bank in payment default.",
    customerTreatment: "Holders may transfer MTQ to a healthy bank and redeem there.",
    receivingBankTreatment: "Receiving banks redeem migrating holders against the PBC.",
    reconciliation: "Forensic reconciliation per forensic-rr-reconciliation.ts.",
    resolutionProcedure: "Pre-resolution; resolution authority preparing tools.",
  },
  INSOLVENT: {
    newIssuance: "BLOCKED — bankruptcy declared.",
    existingTransfer: "ALLOWED — on-chain MTQ transfers freely.",
    redemption: "BLOCKED at this bank; cross-bank redemption continues against PBC.",
    backingStatus: "SEQUESTERED — cell returned to MTQ holders preferentially.",
    liquidity: "INSOLVENT — liabilities exceed assets.",
    customerTreatment: "Holders file claim against PBC + residual claim on bank estate.",
    receivingBankTreatment: "Receiving banks continue to redeem migrating holders.",
    reconciliation: "Insolvency-led, court-supervised reconciliation.",
    resolutionProcedure: "Resolution authority selects resolution tool.",
  },
  RESOLUTION: {
    newIssuance: "BLOCKED — resolution in progress.",
    existingTransfer: "ALLOWED — on-chain MTQ transfers freely.",
    redemption: "BLOCKED at this bank; cross-bank redemption via PBC continues.",
    backingStatus: "TRANSFERRED — cell transferred to bridge bank / purchaser.",
    liquidity: "RESOLUTION — bank under resolution authority control.",
    customerTreatment: "Holders redeem via cross-bank protocol against transferred cell.",
    receivingBankTreatment: "Receiving banks redeem against transferred cell.",
    reconciliation: "Resolution-authority-led reconciliation.",
    resolutionProcedure: "Bail-in / sale / bridge bank / wind-down active.",
  },
  EXIT: {
    newIssuance: "BLOCKED — bank wound down / exited MITHQAL system.",
    existingTransfer: "ALLOWED — on-chain MTQ continues to circulate.",
    redemption: "COMPLETED — all redemptions completed prior to exit.",
    backingStatus: "RETURNED — cell returned / distributed / wound down.",
    liquidity: "EXITED — bank no longer participates.",
    customerTreatment: "Holders migrated to other participating banks.",
    receivingBankTreatment: "MTQ originally issued by this bank continues to circulate.",
    reconciliation: "Final reconciliation completed.",
    resolutionProcedure: "Bank expelled from MITHQAL system.",
  },
};

// ----------------------------------------------------------------------------
// §17.7 — The 11 contractual questions
// ----------------------------------------------------------------------------

export type ContractualQuestionId =
  | "Q1_OBLIGOR"
  | "Q2_HOLDER_CLAIM"
  | "Q3_CLAIM_PRIORITY"
  | "Q4_EXISTING_MTQ"
  | "Q5_TRANSFERABILITY"
  | "Q6_REDEMPTION"
  | "Q7_LOSS_ABSORPTION"
  | "Q8_BACKING_TREATMENT"
  | "Q9_RESOLUTION_AUTHORITY"
  | "Q10_RECONCILIATION"
  | "Q11_EXIT";

export interface ContractualQuestion {
  id: ContractualQuestionId;
  question: string;
  principle: string;
}

export const CONTRACTUAL_QUESTIONS: ReadonlyArray<ContractualQuestion> = [
  {
    id: "Q1_OBLIGOR",
    question: "Who is the obligor?",
    principle: "The issuing bank — not MITHQAL — is the obligor.",
  },
  {
    id: "Q2_HOLDER_CLAIM",
    question: "What is the holder's claim?",
    principle: "Claim against the PBC + residual claim against the bank's estate.",
  },
  {
    id: "Q3_CLAIM_PRIORITY",
    question: "What is the claim priority?",
    principle: "Preferential to extent of PBC; unsecured for shortfall.",
  },
  {
    id: "Q4_EXISTING_MTQ",
    question: "What happens to existing MTQ?",
    principle: "Chain neutrality — MTQ supply survives bank failure.",
  },
  {
    id: "Q5_TRANSFERABILITY",
    question: "Can it continue transferring?",
    principle: "Chain neutrality is absolute — on-chain transfers never halted.",
  },
  {
    id: "Q6_REDEMPTION",
    question: "Can it redeem?",
    principle: "MITHQAL never guarantees redemption; provides reconciliation that makes it possible.",
  },
  {
    id: "Q7_LOSS_ABSORPTION",
    question: "Who absorbs losses?",
    principle: "PBC → bank equity → subordinated debt → general creditors → deposit insurer. MITHQAL absorbs ZERO.",
  },
  {
    id: "Q8_BACKING_TREATMENT",
    question: "What happens to backing?",
    principle: "PBC is customer property, not MITHQAL assets, not bank general assets.",
  },
  {
    id: "Q9_RESOLUTION_AUTHORITY",
    question: "What does the resolution authority control?",
    principle: "Resolution authority is sovereign; MITHQAL is protocol.",
  },
  {
    id: "Q10_RECONCILIATION",
    question: "How is reconciliation performed?",
    principle: "Honest reconciliation — shortfalls disclosed, not covered.",
  },
  {
    id: "Q11_EXIT",
    question: "What happens on exit?",
    principle: "Bank expelled from MITHQAL; MTQ originally issued continues to circulate.",
  },
];

/** Per-state answer for each contractual question (canonical prose). */
export const QUESTION_ANSWERS: Record<BankLifecycleState, Record<ContractualQuestionId, string>> = {
  ACTIVE: {
    Q1_OBLIGOR: "The issuing bank.",
    Q2_HOLDER_CLAIM: "Claim on the PBC at par via the issuing bank.",
    Q3_CLAIM_PRIORITY: "Preferential to extent of PBC; unsecured for shortfall (none expected).",
    Q4_EXISTING_MTQ: "MTQ is valid; fully backed by the cell.",
    Q5_TRANSFERABILITY: "YES — on-chain transfers proceed normally.",
    Q6_REDEMPTION: "YES — normal redemption queue at par.",
    Q7_LOSS_ABSORPTION: "Cell covers 100%+ of liability; no losses expected.",
    Q8_BACKING_TREATMENT: "Cell fully funded, earmarked, segregated.",
    Q9_RESOLUTION_AUTHORITY: "No resolution active; regulator supervises only.",
    Q10_RECONCILIATION: "Daily reconciliation of S_bank vs. PBC.",
    Q11_EXIT: "Not applicable.",
  },
  RESTRICTED: {
    Q1_OBLIGOR: "The issuing bank (capital-side weakness does not change obligor).",
    Q2_HOLDER_CLAIM: "Claim on the PBC at par — unchanged.",
    Q3_CLAIM_PRIORITY: "Preferential to extent of PBC.",
    Q4_EXISTING_MTQ: "MTQ remains valid; cell unaffected.",
    Q5_TRANSFERABILITY: "YES — chain neutrality preserved.",
    Q6_REDEMPTION: "YES — redemptions continue at par.",
    Q7_LOSS_ABSORPTION: "Cell covers liability; bank equity absorbs capital-side weakness.",
    Q8_BACKING_TREATMENT: "Cell preserved; bank-side capital weakness does not touch the cell.",
    Q9_RESOLUTION_AUTHORITY: "Regulator notified; corrective-action plan monitored.",
    Q10_RECONCILIATION: "Twice-daily reconciliation.",
    Q11_EXIT: "Not applicable.",
  },
  LIQUIDITY_STRESS: {
    Q1_OBLIGOR: "The issuing bank.",
    Q2_HOLDER_CLAIM: "Claim on the PBC at par; redemption queue active.",
    Q3_CLAIM_PRIORITY: "Preferential to extent of PBC.",
    Q4_EXISTING_MTQ: "MTQ remains valid.",
    Q5_TRANSFERABILITY: "YES — chain neutrality preserved.",
    Q6_REDEMPTION: "THROTTLED — redemption-continuity state = STRESS.",
    Q7_LOSS_ABSORPTION: "Cell covers liability; liquidity-side stress on bank general balance sheet.",
    Q8_BACKING_TREATMENT: "Cell preserved.",
    Q9_RESOLUTION_AUTHORITY: "Regulator monitoring; liquidity-support plan active.",
    Q10_RECONCILIATION: "Hourly reconciliation.",
    Q11_EXIT: "Not applicable.",
  },
  SUSPENDED: {
    Q1_OBLIGOR: "The issuing bank (still the obligor; gateway suspended).",
    Q2_HOLDER_CLAIM: "Claim on the PBC; holders may transfer MTQ to a healthy bank.",
    Q3_CLAIM_PRIORITY: "Preferential to extent of PBC.",
    Q4_EXISTING_MTQ: "MTQ remains valid; on-chain transfers continue.",
    Q5_TRANSFERABILITY: "YES — chain neutrality absolute.",
    Q6_REDEMPTION: "BLOCKED at this bank; cross-bank redemption available.",
    Q7_LOSS_ABSORPTION: "Cell preserved; bank general creditors absorb bank-side losses.",
    Q8_BACKING_TREATMENT: "Cell preserved and locked.",
    Q9_RESOLUTION_AUTHORITY: "Regulator-directed; MITHQAL provides data, not direction.",
    Q10_RECONCILIATION: "Full snapshot reconciliation.",
    Q11_EXIT: "Not applicable.",
  },
  DEFAULT: {
    Q1_OBLIGOR: "The issuing bank (in payment default).",
    Q2_HOLDER_CLAIM: "Claim on the PBC + residual claim on bank estate in resolution.",
    Q3_CLAIM_PRIORITY: "Preferential to extent of PBC; unsecured for any shortfall.",
    Q4_EXISTING_MTQ: "MTQ remains valid; chain neutrality preserved.",
    Q5_TRANSFERABILITY: "YES — chain neutrality absolute.",
    Q6_REDEMPTION: "BLOCKED at this bank; cross-bank redemption via PBC available.",
    Q7_LOSS_ABSORPTION: "Cell → bank equity → subordinated debt → general creditors → deposit insurer. MITHQAL absorbs ZERO.",
    Q8_BACKING_TREATMENT: "Cell legally sequestered from bank's general estate.",
    Q9_RESOLUTION_AUTHORITY: "Resolution authority preparing tools; MITHQAL provides forensic reconciliation.",
    Q10_RECONCILIATION: "Forensic reconciliation per forensic-rr-reconciliation.ts.",
    Q11_EXIT: "Not applicable yet.",
  },
  INSOLVENT: {
    Q1_OBLIGOR: "The issuing bank (bankruptcy declared).",
    Q2_HOLDER_CLAIM: "Claim on the PBC + residual unsecured claim on bank estate.",
    Q3_CLAIM_PRIORITY: "Preferential to extent of PBC; unsecured for shortfall.",
    Q4_EXISTING_MTQ: "MTQ remains valid.",
    Q5_TRANSFERABILITY: "YES — chain neutrality absolute.",
    Q6_REDEMPTION: "BLOCKED at this bank; cross-bank redemption via PBC continues.",
    Q7_LOSS_ABSORPTION: "Cell → bank equity → subordinated debt → general creditors → deposit insurer.",
    Q8_BACKING_TREATMENT: "Cell sequestered; returned to MTQ holders preferentially.",
    Q9_RESOLUTION_AUTHORITY: "Resolution authority selects tool (bail-in / sale / bridge / wind-down).",
    Q10_RECONCILIATION: "Insolvency-led, court-supervised reconciliation.",
    Q11_EXIT: "Not applicable yet.",
  },
  RESOLUTION: {
    Q1_OBLIGOR: "Successor entity (bridge bank / purchaser) per resolution authority.",
    Q2_HOLDER_CLAIM: "Claim on the transferred PBC at par.",
    Q3_CLAIM_PRIORITY: "Preferential to extent of transferred PBC.",
    Q4_EXISTING_MTQ: "MTQ remains valid.",
    Q5_TRANSFERABILITY: "YES — chain neutrality absolute.",
    Q6_REDEMPTION: "Cross-bank redemption against transferred PBC continues.",
    Q7_LOSS_ABSORPTION: "Cell → bank equity → subordinated debt → general creditors → deposit insurer.",
    Q8_BACKING_TREATMENT: "Cell transferred to bridge bank / purchaser (still earmarked for holders).",
    Q9_RESOLUTION_AUTHORITY: "Resolution authority directs; MITHQAL tracks cell across transition.",
    Q10_RECONCILIATION: "Resolution-authority-led reconciliation.",
    Q11_EXIT: "Pending — exit follows successful resolution.",
  },
  EXIT: {
    Q1_OBLIGOR: "No further obligor (bank exited).",
    Q2_HOLDER_CLAIM: "All holder claims resolved prior to exit.",
    Q3_CLAIM_PRIORITY: "Resolved — all PBC claims satisfied.",
    Q4_EXISTING_MTQ: "MTQ originally issued by this bank continues to circulate.",
    Q5_TRANSFERABILITY: "YES — chain neutrality absolute.",
    Q6_REDEMPTION: "All redemptions completed.",
    Q7_LOSS_ABSORPTION: "Final loss allocation completed.",
    Q8_BACKING_TREATMENT: "Cell returned / distributed / wound down.",
    Q9_RESOLUTION_AUTHORITY: "Resolution complete.",
    Q10_RECONCILIATION: "Final reconciliation completed.",
    Q11_EXIT: "Bank expelled from MITHQAL system.",
  },
};

// ----------------------------------------------------------------------------
// §17.7 Q7 — Loss-absorption waterfall
// ----------------------------------------------------------------------------

export const LOSS_ABSORPTION_WATERFALL: ReadonlyArray<string> = [
  "1. Protected Backing Cell — earmarked customer property (first loss for MTQ holders is zero IF cell is fully backed).",
  "2. Bank equity / shareholders.",
  "3. Bank subordinated debt.",
  "4. Bank general creditors pro rata.",
  "5. Bank deposit insurer / resolution fund (where applicable — note: MTQ is NOT a deposit).",
] as const;

/** MITHQAL absorbs ZERO losses — exported as a literal constant. */
export const MITHQAL_LOSS_ABSORPTION = 0 as const;

// ----------------------------------------------------------------------------
// §17.7 — Resolution waterfall (custodian takes over → holders redeemed → bank expelled)
// ----------------------------------------------------------------------------

export interface ResolutionWaterfallStep {
  order: number;
  step: string;
  responsible: string;
}

export const RESOLUTION_WATERFALL: ReadonlyArray<ResolutionWaterfallStep> = [
  { order: 1, step: "Custodian takes over backing (PBC transferred to bridge / successor).", responsible: "Resolution authority + qualified custodian" },
  { order: 2, step: "MTQ holders redeemed from custodian (preferential claim on PBC).", responsible: "Successor / bridge bank" },
  { order: 3, step: "Bank expelled from MITHQAL system (final reconciliation).", responsible: "MITHQAL protocol" },
] as const;

// ----------------------------------------------------------------------------
// §17 — Honest state (§74)
// ----------------------------------------------------------------------------

export interface BankDefaultHonestState {
  bankDefaultFrameworkSpecified: true;
  bankDefaultContractValidated: false;
  bankDefaultProductionAuthorized: false;
  mithqalIsGuarantor: false;
  liveBankContracts: 0;
}

export function bankDefaultHonestState(): BankDefaultHonestState {
  return {
    bankDefaultFrameworkSpecified: true,
    bankDefaultContractValidated: false,
    bankDefaultProductionAuthorized: false,
    mithqalIsGuarantor: false,
    liveBankContracts: 0,
  };
}

export const BANK_DEFAULT_HONEST_STATE = bankDefaultHonestState();

// ----------------------------------------------------------------------------
// §17 — Report generator
// ----------------------------------------------------------------------------

export interface BankDefaultReport {
  moduleId: typeof BANK_DEFAULT_MODULE_ID;
  section: typeof BANK_DEFAULT_SECTION;
  principle: typeof PRINCIPLE;
  lifecycleStates: ReadonlyArray<BankLifecycleState>;
  contractualQuestions: ReadonlyArray<ContractualQuestion>;
  resolutionWaterfall: ReadonlyArray<ResolutionWaterfallStep>;
  lossAbsorptionWaterfall: ReadonlyArray<string>;
  honestState: BankDefaultHonestState;
  finalStatus: string;
  finalStatusColor: "amber";
}

export function generateBankDefaultReport(): BankDefaultReport {
  return {
    moduleId: BANK_DEFAULT_MODULE_ID,
    section: BANK_DEFAULT_SECTION,
    principle: PRINCIPLE,
    lifecycleStates: BANK_LIFECYCLE_STATES,
    contractualQuestions: CONTRACTUAL_QUESTIONS,
    resolutionWaterfall: RESOLUTION_WATERFALL,
    lossAbsorptionWaterfall: LOSS_ABSORPTION_WATERFALL,
    honestState: bankDefaultHonestState(),
    finalStatus:
      "SPECIFIED, NOT CONTRACTED. APPROVED FOR INSTITUTIONAL ENGAGEMENT " +
      "(banks, regulators, resolution authorities). NOT PRODUCTION-AUTHORIZED.",
    finalStatusColor: "amber",
  };
}

// ----------------------------------------------------------------------------
// §17 — State-machine helpers
// ----------------------------------------------------------------------------

/** Returns true if a transition from `from` → `to` is a valid forward transition. */
export function canTransitionForward(
  from: BankLifecycleState,
  to: BankLifecycleState,
): boolean {
  return stateIndex(to) > stateIndex(from);
}

/** Returns the most-severe state among the inputs (highest lifecycle index). */
export function mostSevereState(...states: BankLifecycleState[]): BankLifecycleState {
  return states.reduce((acc, s) =>
    stateIndex(s) > stateIndex(acc) ? s : acc,
  );
}

/** Reconciliation cadence per state (per §17.13 Q10). */
export function reconciliationCadence(state: BankLifecycleState): string {
  switch (state) {
    case "ACTIVE": return "daily";
    case "RESTRICTED": return "twice-daily";
    case "LIQUIDITY_STRESS": return "hourly";
    case "SUSPENDED": return "full-snapshot";
    case "DEFAULT": return "forensic (forensic-rr-reconciliation.ts)";
    case "INSOLVENT": return "insolvency-led, court-supervised";
    case "RESOLUTION": return "resolution-authority-led";
    case "EXIT": return "final";
  }
}
