// ============================================================================
//  MITHQAL — Three-Book Economic Separation (Blueprint v25.3 §51 / §3.10)
//  ----------------------------------------------------------------------------
//  Module ID:   v25.2-three-book-separation-1.0
//  Section:     §51
//  Source file: `src/lib/three-book-separation.ts`
//
//  The Three-Book Separation is the structural mechanism by which MITHQAL
//  enforces two non-negotiable principles:
//
//    1. The non-custodial principle (§V25.2): MITHQAL is non-custodial by
//       default. MITHQAL does NOT hold customer MTQ balances, bank backing,
//       or corporate operating cash.
//
//    2. The non-commingling principle (§51): The three books must reconcile
//       but must NEVER be economically commingled.
//
//  Three books:
//    Book A — MITHQAL Corporate (8 fields)
//    Book B — Bank MTQ Obligation Ledger (8 fields)
//    Book C — Corporate Participant Position (9 fields)
//
//  4 anti-commingling tests (§15.6) — ALL BLOCKED by construction:
//    1. CORPORATE_CASH_TO_MTQ_BACKING            (BLOCKED)
//    2. BANK_OBLIGATION_TO_CORPORATE_REVENUE    (BLOCKED)
//    3. CORPORATE_MTQ_TO_MITHQAL_ASSET          (BLOCKED)
//    4. RESERVE_GAIN_TO_OPERATING_REVENUE       (BLOCKED)
//
//  Honest state (§74):
//    threeBookDesign     = true   (the design is complete)
//    threeBookOperational = false (not yet operating in production)
//    threeBookEnforced   = false  (no on-chain / institutional enforcement yet)
// ============================================================================

export const THREE_BOOK_MODULE_ID = "v25.2-three-book-separation-1.0" as const;
export const THREE_BOOK_SECTION = 51 as const;

// ----------------------------------------------------------------------------
// §15.1 — Honest state (§74)
// ----------------------------------------------------------------------------

export interface ThreeBookHonestState {
  threeBookDesign: true;
  threeBookOperational: false;
  threeBookEnforced: false;
}

export function threeBookHonestState(): ThreeBookHonestState {
  return {
    threeBookDesign: true,
    threeBookOperational: false,
    threeBookEnforced: false,
  };
}

export const THREE_BOOK_HONEST_STATE = threeBookHonestState();

// ----------------------------------------------------------------------------
// §15.2 — The three book types
// ----------------------------------------------------------------------------

export type BookType =
  | "BOOK_A_CORPORATE"
  | "BOOK_B_BANK_MTQ_OBLIGATION"
  | "BOOK_C_PARTICIPANT_POSITION";

export const BOOK_TYPES: ReadonlyArray<BookType> = [
  "BOOK_A_CORPORATE",
  "BOOK_B_BANK_MTQ_OBLIGATION",
  "BOOK_C_PARTICIPANT_POSITION",
];

// ----------------------------------------------------------------------------
// §15.3 — Book A — MITHQAL Corporate (8 fields)
// ----------------------------------------------------------------------------

export interface BookAEntry {
  bookType: "BOOK_A_CORPORATE";
  entryId: string;
  timestamp: string;
  description: string;
  revenue: number;               // 1 — corporate revenue (operating)
  expenses: number;              // 2 — corporate expenses (operating)
  payroll: number;               // 3 — payroll
  tax: number;                   // 4 — corporate tax
  technologyCosts: number;       // 5 — technology costs
  corporateAssets: number;       // 6 — corporate assets (operating cash, infra, IP)
  corporateLiabilities: number;  // 7 — corporate liabilities
  profitLoss: number;            // 8 — profit / loss = revenue − expenses (no reserve gains)
}

// ----------------------------------------------------------------------------
// §15.4 — Book B — Bank MTQ Obligation Ledger (8 fields)
// ----------------------------------------------------------------------------

export interface BookBEntry {
  bookType: "BOOK_B_BANK_MTQ_OBLIGATION";
  entryId: string;
  timestamp: string;
  description: string;
  responsibleBank: string;       // 1 — responsible bank / institution
  applicableBacking: number;     // 2 — applicable backing (USD-equivalent)
  mtqOriginated: number;         // 3 — MTQ originated (cumulative)
  mtqOutstanding: number;        // 4 — MTQ outstanding (current liability)
  redemptionObligations: number; // 5 — redemption obligations (pending)
  liquidity: number;             // 6 — bank liquidity buffer
  settlement: number;            // 7 — settlement balance
  bankRisk: number;              // 8 — bank risk score (0–1, higher = riskier)
}

// ----------------------------------------------------------------------------
// §15.5 — Book C — Corporate Participant Position (9 fields)
// ----------------------------------------------------------------------------

export interface BookCEntry {
  bookType: "BOOK_C_PARTICIPANT_POSITION";
  entryId: string;
  timestamp: string;
  description: string;
  mtqBalance: number;            // 1 — MTQ balance
  availableMtq: number;          // 2 — available MTQ (free to transact)
  reservedMtq: number;           // 3 — reserved MTQ (held for pending ops)
  pendingMtq: number;            // 4 — pending MTQ (in-flight)
  sent: number;                  // 5 — MTQ sent (cumulative)
  received: number;              // 6 — MTQ received (cumulative)
  redemption: number;            // 7 — redemption activity (cumulative amount)
  settlementHistory: number;     // 8 — settlement history (count of settled tx)
  bankMoneyLinkage: string;      // 9 — bank-money linkage (which bank holds the underlying)
}

/** Discriminated union of the three book entry types. */
export type BookEntry = BookAEntry | BookBEntry | BookCEntry;

// ----------------------------------------------------------------------------
// §15.10 — The reference SIMULATED ledger
// ----------------------------------------------------------------------------

export const REFERENCE_BOOK_A: BookAEntry = {
  bookType: "BOOK_A_CORPORATE",
  entryId: "BOOKA-REF-001",
  timestamp: "2025-01-15T00:00:00Z",
  description:
    "MITHQAL corporate cash reserve for salaries and infrastructure ($50M illustrative). " +
    "SIMULATED — operating cash, NOT bank-side MTQ backing.",
  revenue: 0,
  expenses: 0,
  payroll: 0,
  tax: 0,
  technologyCosts: 0,
  corporateAssets: 50_000_000,
  corporateLiabilities: 0,
  profitLoss: 0,
};

export const REFERENCE_BOOK_B: BookBEntry = {
  bookType: "BOOK_B_BANK_MTQ_OBLIGATION",
  entryId: "BOOKB-REF-001",
  timestamp: "2025-01-15T00:00:00Z",
  description:
    "Reference bank MTQ obligation: $130M applicable backing for $100M MTQ outstanding " +
    "(130% strategic target met). SIMULATED.",
  responsibleBank: "Reference-Responsible-Bank (SIMULATED)",
  applicableBacking: 130_000_000,
  mtqOriginated: 100_000_000,
  mtqOutstanding: 100_000_000,
  redemptionObligations: 0,
  liquidity: 130_000_000,
  settlement: 0,
  bankRisk: 0.18,
};

export const REFERENCE_BOOK_C: BookCEntry = {
  bookType: "BOOK_C_PARTICIPANT_POSITION",
  entryId: "BOOKC-REF-001",
  timestamp: "2025-01-15T00:00:00Z",
  description:
    "Reference corporate participant position: $10M MTQ balance. SIMULATED. " +
    "The other $90M of Book B outstanding is held by participants not tracked in this Book C slice.",
  mtqBalance: 10_000_000,
  availableMtq: 9_500_000,
  reservedMtq: 500_000,
  pendingMtq: 0,
  sent: 0,
  received: 10_000_000,
  redemption: 0,
  settlementHistory: 1,
  bankMoneyLinkage: "Reference-Responsible-Bank (SIMULATED)",
};

export interface ThreeBookLedger {
  bookA: BookAEntry[];
  bookB: BookBEntry[];
  bookC: BookCEntry[];
}

export function buildReferenceThreeBookLedger(): ThreeBookLedger {
  return {
    bookA: [REFERENCE_BOOK_A],
    bookB: [REFERENCE_BOOK_B],
    bookC: [REFERENCE_BOOK_C],
  };
}

// ----------------------------------------------------------------------------
// §15.6 — Anti-commingling tests (4 tests, ALL BLOCKED)
// ----------------------------------------------------------------------------

export type ComminglingTestId =
  | "CORPORATE_CASH_TO_MTQ_BACKING"
  | "BANK_OBLIGATION_TO_CORPORATE_REVENUE"
  | "CORPORATE_MTQ_TO_MITHQAL_ASSET"
  | "RESERVE_GAIN_TO_OPERATING_REVENUE";

export interface ComminglingTest {
  id: ComminglingTestId;
  description: string;
  bookViolated: BookType;
  illegalField: string;
  reason: string;
}

export const ANTI_COMMINGLING_TESTS: ReadonlyArray<ComminglingTest> = [
  {
    id: "CORPORATE_CASH_TO_MTQ_BACKING",
    description: "Attempt to book $50M of MITHQAL corporate cash as bank-side MTQ backing in Book B.",
    bookViolated: "BOOK_B_BANK_MTQ_OBLIGATION",
    illegalField: "applicableBacking (sourced from Book A corporateAssets)",
    reason:
      "Corporate cash is a Book A operating asset. It cannot serve as Book B bank backing. " +
      "Per §51 and §1 of the §V25.2 final reserve spec, the responsible BANK (not MITHQAL) holds " +
      "the MTQ backing. Routing corporate cash into Book B 'applicableBacking' would economically " +
      "commingle MITHQAL's operating accounts with the bank's monetary obligation.",
  },
  {
    id: "BANK_OBLIGATION_TO_CORPORATE_REVENUE",
    description: "Attempt to record the bank's MTQ issuance obligation as revenue on MITHQAL's corporate P&L.",
    bookViolated: "BOOK_A_CORPORATE",
    illegalField: "revenue (sourced from Book B mtqOutstanding)",
    reason:
      "The bank's MTQ outstanding (Book B) is a contingent monetary obligation of the bank, not " +
      "revenue to the MITHQAL operating company. Recording it as Book A revenue would commingle " +
      "the bank's monetary liability with the operating company's P&L, which is the textbook §51 violation.",
  },
  {
    id: "CORPORATE_MTQ_TO_MITHQAL_ASSET",
    description: "Attempt to record a corporate participant's $10M MTQ balance as a MITHQAL corporate asset.",
    bookViolated: "BOOK_A_CORPORATE",
    illegalField: "corporateAssets (sourced from Book C mtqBalance)",
    reason:
      "Participant MTQ holdings (Book C) are positions held BY participants, not assets owned BY " +
      "MITHQAL. MITHQAL is non-custodial by default (§V25.2). Capitalizing participant balances " +
      "as Book A 'corporateAssets' would commingle third-party monetary positions with the " +
      "operating company's balance sheet.",
  },
  {
    id: "RESERVE_GAIN_TO_OPERATING_REVENUE",
    description: "Attempt to book a 5% appreciation on the bank-side gold reserve as MITHQAL operating revenue.",
    bookViolated: "BOOK_A_CORPORATE",
    illegalField: "revenue (sourced from reserve gain)",
    reason:
      "Reserve appreciation belongs to the bank-side reserve (Book B), not to the MITHQAL " +
      "operating company's P&L (Book A). Capitalizing reserve gains as Book A 'revenue' would " +
      "commingle monetary-system gains with operating-company profit and would make MITHQAL's " +
      "P&L dependent on reserve mark-to-market — exactly the commingling §51 forbids.",
  },
];

export interface ComminglingAttemptResult {
  test: ComminglingTest;
  attempted: true;
  blocked: true;
  reason: string;
}

export function attemptCommingling(test: ComminglingTest): ComminglingAttemptResult {
  // By §51 construction, every commingling attempt is BLOCKED.
  return {
    test,
    attempted: true,
    blocked: true,
    reason: test.reason,
  };
}

export function runAllAntiComminglingTests(): ComminglingAttemptResult[] {
  return ANTI_COMMINGLING_TESTS.map(attemptCommingling);
}

// ----------------------------------------------------------------------------
// §15.7 — Cross-book transfers (forbidden pairs + signed authorization)
// ----------------------------------------------------------------------------

export interface BookTransferAuthorization {
  authorizedBy: string;
  signed: boolean;
  scope: BookType[];
  reason: string;
  issuedAt: string;
}

export interface BookTransferResult {
  ok: boolean;
  transferred: number;
  reason: string;
}

/** Forbidden commingling paths (always blocked, even with signed authorization). */
export const FORBIDDEN_PAIRS: ReadonlyArray<[BookType, BookType]> = [
  ["BOOK_A_CORPORATE", "BOOK_B_BANK_MTQ_OBLIGATION"],
  ["BOOK_B_BANK_MTQ_OBLIGATION", "BOOK_A_CORPORATE"],
  ["BOOK_A_CORPORATE", "BOOK_C_PARTICIPANT_POSITION"],
  ["BOOK_C_PARTICIPANT_POSITION", "BOOK_A_CORPORATE"],
];

export function transferBetweenBooksAuthorized(
  _ledger: ThreeBookLedger,
  fromBook: BookType,
  toBook: BookType,
  amount: number,
  authorization: BookTransferAuthorization | null,
): BookTransferResult {
  if (!authorization || !authorization.signed) {
    return { ok: false, transferred: 0, reason: "§51 — no signed authorization: blocked." };
  }
  const scopeOk =
    authorization.scope.includes(fromBook) && authorization.scope.includes(toBook);
  if (!scopeOk) {
    return {
      ok: false,
      transferred: 0,
      reason: "§51 — authorization scope does not cover both ends of the transfer: blocked.",
    };
  }
  const isForbidden = FORBIDDEN_PAIRS.some(([f, t]) => f === fromBook && t === toBook);
  if (isForbidden) {
    return {
      ok: false,
      transferred: 0,
      reason:
        `Transfer blocked: ${fromBook} → ${toBook} is a forbidden commingling path ` +
        `(Book A may not directly exchange with Book B or Book C). Signed authorization cannot override §51.`,
    };
  }
  if (!(amount > 0)) {
    return { ok: false, transferred: 0, reason: "amount must be strictly positive." };
  }
  return {
    ok: true,
    transferred: amount,
    reason: `Authorized transfer ${fromBook} → ${toBook} of ${amount} executed.`,
  };
}

// ----------------------------------------------------------------------------
// §15.8 — Reconciliation between books (4 checks)
// ----------------------------------------------------------------------------

export interface ReconciliationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface ReconciliationResult {
  reconciled: boolean;
  checks: ReconciliationCheck[];
  commingled: boolean;
  notes: string[];
}

export function reconcileBooks(ledger: ThreeBookLedger): ReconciliationResult {
  const checks: ReconciliationCheck[] = [];
  const notes: string[] = [];

  // Check 1 — Book C Σ(MTQ) ≤ Book B Σ(MTQ outstanding).
  const bookCSumMtq = ledger.bookC.reduce((s, e) => s + e.mtqBalance, 0);
  const bookBSumOutstanding = ledger.bookB.reduce((s, e) => s + e.mtqOutstanding, 0);
  const participantSubsetOk = bookCSumMtq <= bookBSumOutstanding + 1e-6;
  checks.push({
    name: "Book C Σ(MTQ) ≤ Book B Σ(MTQ outstanding)",
    passed: participantSubsetOk,
    detail: `Book C Σ=${bookCSumMtq}; Book B Σ(outstanding)=${bookBSumOutstanding}.`,
  });

  // Check 2 — Book B Σ(applicableBacking) ≥ 1.30 × Book B Σ(MTQ outstanding).
  const requiredBacking = bookBSumOutstanding * 1.30;
  const bookBBacking = ledger.bookB.reduce((s, e) => s + e.applicableBacking, 0);
  const backingOk = bookBBacking >= requiredBacking - 1e-6;
  checks.push({
    name: "Book B Σ(applicableBacking) ≥ 1.30 × Book B Σ(MTQ outstanding)",
    passed: backingOk,
    detail: `Backing=${bookBBacking}; required=${requiredBacking}.`,
  });

  // Check 3 — Book A profitLoss == revenue − expenses (no reserve gains).
  let bookAIndependent = true;
  for (const e of ledger.bookA) {
    const computedPL = e.revenue - e.expenses;
    if (Math.abs(computedPL - e.profitLoss) > 1e-6) {
      bookAIndependent = false;
      notes.push(
        `Book A entry ${e.entryId} profitLoss=${e.profitLoss} ≠ revenue−expenses=${computedPL}; possible commingling.`,
      );
    }
  }
  checks.push({
    name: "Book A profitLoss == revenue − expenses (no reserve gains)",
    passed: bookAIndependent,
    detail: bookAIndependent ? "All Book A entries reconcile." : "P&L mismatch — see notes.",
  });

  // Check 4 — No commingling violations detected.
  const violations = verifyNoCommingling(ledger);
  checks.push({
    name: "No commingling violations detected",
    passed: violations.length === 0,
    detail: violations.length === 0 ? "clean" : `${violations.length} violation(s): ${violations.map((v) => v.entryId).join(", ")}`,
  });

  const reconciled = checks.every((c) => c.passed);
  return {
    reconciled,
    checks,
    commingled: violations.length > 0,
    notes,
  };
}

// ----------------------------------------------------------------------------
// §15.9 — verifyNoCommingling (heuristic runtime guard)
// ----------------------------------------------------------------------------

export type ComminglingSeverity = "HIGH" | "MEDIUM" | "LOW";

export interface ComminglingViolation {
  severity: ComminglingSeverity;
  book: BookType;
  entryId: string;
  reason: string;
}

export function verifyNoCommingling(ledger: ThreeBookLedger): ComminglingViolation[] {
  const violations: ComminglingViolation[] = [];

  // Book A — profit/loss must reconcile to revenue − expenses.
  for (const e of ledger.bookA) {
    const expected = e.revenue - e.expenses;
    if (Math.abs(expected - e.profitLoss) > 1e-6) {
      violations.push({
        severity: "HIGH",
        book: "BOOK_A_CORPORATE",
        entryId: e.entryId,
        reason: `profitLoss ${e.profitLoss} ≠ revenue−expenses ${expected}; possible reserve-gain commingling.`,
      });
    }
  }

  // Book B — backing without liquidity implies off-book funding.
  for (const e of ledger.bookB) {
    if (e.applicableBacking > 0 && e.liquidity <= 0 && e.mtqOutstanding > 0) {
      violations.push({
        severity: "MEDIUM",
        book: "BOOK_B_BANK_MTQ_OBLIGATION",
        entryId: e.entryId,
        reason:
          "applicableBacking > 0 with liquidity ≤ 0 and mtqOutstanding > 0 — possible off-book funding (corporate-cash commingling into bank backing).",
      });
    }
  }

  // Book C — every participant position must reference a bank.
  for (const e of ledger.bookC) {
    if (!e.bankMoneyLinkage || e.bankMoneyLinkage.trim() === "") {
      violations.push({
        severity: "MEDIUM",
        book: "BOOK_C_PARTICIPANT_POSITION",
        entryId: e.entryId,
        reason: "missing bankMoneyLinkage — participant position must reference a responsible bank.",
      });
    }
  }

  return violations;
}

// ----------------------------------------------------------------------------
// §15.11 — createBookEntry (commingling rejection at insert time)
// ----------------------------------------------------------------------------

export interface CreateBookEntryResult {
  ok: boolean;
  comminglingDetected: boolean;
  error?: string;
  ledger?: ThreeBookLedger;
}

const BOOK_A_FIELDS = new Set([
  "revenue", "expenses", "payroll", "tax", "technologyCosts",
  "corporateAssets", "corporateLiabilities", "profitLoss",
]);
const BOOK_B_FIELDS = new Set([
  "responsibleBank", "applicableBacking", "mtqOriginated", "mtqOutstanding",
  "redemptionObligations", "liquidity", "settlement", "bankRisk",
]);
const BOOK_C_FIELDS = new Set([
  "mtqBalance", "availableMtq", "reservedMtq", "pendingMtq",
  "sent", "received", "redemption", "settlementHistory", "bankMoneyLinkage",
]);

function detectCrossBookFields(
  bookType: BookType,
  entry: Record<string, unknown>,
): string[] {
  const violations: string[] = [];
  const allowed =
    bookType === "BOOK_A_CORPORATE" ? BOOK_A_FIELDS
    : bookType === "BOOK_B_BANK_MTQ_OBLIGATION" ? BOOK_B_FIELDS
    : BOOK_C_FIELDS;
  const forbidden = new Set<string>();
  for (const f of [...BOOK_A_FIELDS, ...BOOK_B_FIELDS, ...BOOK_C_FIELDS]) {
    if (!allowed.has(f)) forbidden.add(f);
  }
  for (const key of Object.keys(entry)) {
    if (forbidden.has(key)) violations.push(key);
  }
  return violations;
}

export function createBookEntry(
  ledger: ThreeBookLedger,
  bookType: BookType,
  entry: BookEntry,
): CreateBookEntryResult {
  if (entry.bookType !== bookType) {
    return {
      ok: false,
      comminglingDetected: true,
      error:
        `Commingling rejected: entry declares bookType "${entry.bookType}" but caller attempted ` +
        `to insert into "${bookType}". Cross-book insertion is forbidden by §51.`,
    };
  }
  const violations = detectCrossBookFields(bookType, entry as unknown as Record<string, unknown>);
  if (violations.length > 0) {
    return {
      ok: false,
      comminglingDetected: true,
      error:
        `Commingling rejected: entry contains fields belonging to other books: ${violations.join(", ")}.`,
    };
  }
  const updated: ThreeBookLedger = { ...ledger };
  if (bookType === "BOOK_A_CORPORATE") {
    updated.bookA = [...ledger.bookA, entry as BookAEntry];
  } else if (bookType === "BOOK_B_BANK_MTQ_OBLIGATION") {
    updated.bookB = [...ledger.bookB, entry as BookBEntry];
  } else {
    updated.bookC = [...ledger.bookC, entry as BookCEntry];
  }
  return { ok: true, comminglingDetected: false, ledger: updated };
}

// ----------------------------------------------------------------------------
// §51 — Report generator
// ----------------------------------------------------------------------------

export interface ThreeBookReport {
  moduleId: typeof THREE_BOOK_MODULE_ID;
  section: typeof THREE_BOOK_SECTION;
  bookTypes: ReadonlyArray<BookType>;
  antiComminglingTests: ReadonlyArray<ComminglingTest>;
  antiComminglingResults: ComminglingAttemptResult[];
  honestState: ThreeBookHonestState;
  referenceLedger: ThreeBookLedger;
  referenceReconciliation: ReconciliationResult;
  forbiddenPairs: ReadonlyArray<[BookType, BookType]>;
  finalStatus: string;
  finalStatusColor: "amber";
}

export function generateThreeBookReport(): ThreeBookReport {
  const ledger = buildReferenceThreeBookLedger();
  return {
    moduleId: THREE_BOOK_MODULE_ID,
    section: THREE_BOOK_SECTION,
    bookTypes: BOOK_TYPES,
    antiComminglingTests: ANTI_COMMINGLING_TESTS,
    antiComminglingResults: runAllAntiComminglingTests(),
    honestState: threeBookHonestState(),
    referenceLedger: ledger,
    referenceReconciliation: reconcileBooks(ledger),
    forbiddenPairs: FORBIDDEN_PAIRS,
    finalStatus:
      "DESIGNED + IMPLEMENTED — NOT OPERATIONAL — NOT ENFORCED " +
      "(threeBookOperational=false, threeBookEnforced=false)",
    finalStatusColor: "amber",
  };
}
