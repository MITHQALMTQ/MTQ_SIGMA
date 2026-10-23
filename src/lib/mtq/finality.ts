// ============================================================================
//  MTQΣ V3 — 7-Layer Settlement Finality (Blueprint v25.3 §8)
//  ----------------------------------------------------------------------------
//  MITHQAL mints are NEVER settled on a single check. They must pass through
//  seven independent finality layers, each of which is independently
//  auditable. Skipping any layer is a critical protocol violation.
//
//  Layer map:
//    L1 API             Request validation, authentication, idempotency,
//                       timestamp, expiry, replay protection. Enforced by
//                       the MBG Gateway (`/api/mbg/mint-request`).
//    L2 WORKFLOW        16-step BM-01..BM-16 state machine. Enforced by
//                       `MTQSigmaV3.advanceWorkflow()` (sequential transitions
//                       only; no skipping BM-02..BM-15).
//    L3 POLICY          Constitutional rules + DMCE + concentration +
//                       eligibility + jurisdiction. Enforced by the keeper
//                       off-chain AND re-checked on-chain at BM-09..BM-14.
//    L4 AUTHORIZATION   MITHQAL Monetary Control signed authorization. Enforced
//                       by the `onlyMonetaryControl` modifier on the BM-15
//                       transition (`MONETARY_CONTROL_ROLE`).
//    L5 LEDGER          PENDING → AUTHORIZED → FINALIZED → MINTED state
//                       machine. Enforced by the `MintRequest.state` field
//                       (must be BM15_AUTHORIZED when `executeMint` is called,
//                       must transition atomically to BM16_MINTED).
//    L6 DATABASE        ACID transaction (finality-proof + mint atomic).
//                       Enforced by the single-transaction atomicity of
//                       `executeMint` (all state changes + the ERC-20 mint
//                       happen in one tx; any revert undoes all of them).
//    L7 CONTRACT        On-chain finality gate (keeper signature). Enforced by
//                       `onlyKeeper` on `executeMint` — the keeper's
//                       `msg.sender` IS the on-chain finality proof.
// ============================================================================

import type { AvailableBackingCertificate } from "./available-backing-certificate";
import { verifyABC, abcBackedAmount } from "./available-backing-certificate";
import { isAuthorizedBank, getBank, getDailyMintRemaining } from "./bank-registry";

// ----------------------------------------------------------------------------
// §8.1 Layer descriptors (canonical names)
// ----------------------------------------------------------------------------

export const FINALITY_LAYERS = {
  L1_API:
    "Request validation, auth, idempotency, timestamp, expiry, replay protection",
  L2_WORKFLOW: "16-step BM-01..BM-16 state machine",
  L3_POLICY:
    "Constitutional rules + DMCE + concentration + eligibility + jurisdiction",
  L4_AUTHORIZATION: "MITHQAL Monetary Control signed authorization",
  L5_LEDGER: "PENDING → AUTHORIZED → FINALIZED → MINTED state machine",
  L6_DATABASE: "ACID transaction (finality-proof + mint atomic)",
  L7_CONTRACT: "On-chain finality gate (keeper signature)",
} as const;

export type FinalityLayerId = keyof typeof FINALITY_LAYERS;

export interface LayerCheck {
  layer: FinalityLayerId;
  passed: boolean;
  reason: string;
}

// ----------------------------------------------------------------------------
// §8.2 On-chain workflow state mirror (must match MTQSigmaV3.sol)
// ----------------------------------------------------------------------------

export enum WorkflowState {
  NONE = "NONE",
  BM01_PENDING = "BM01_PENDING",
  BM02_RECEIVED = "BM02_RECEIVED",
  BM03_KYC = "BM03_KYC",
  BM04_AML = "BM04_AML",
  BM05_BACKING = "BM05_BACKING",
  BM06_EVIDENCE = "BM06_EVIDENCE",
  BM07_REQUESTED = "BM07_REQUESTED",
  BM08_TRANSLATED = "BM08_TRANSLATED",
  BM09_ELIGIBLE = "BM09_ELIGIBLE",
  BM10_JURISDICTION = "BM10_JURISDICTION",
  BM11_BACKING_VERIFIED = "BM11_BACKING_VERIFIED",
  BM12_BANK_RISK = "BM12_BANK_RISK",
  BM13_SYSTEM_RISK = "BM13_SYSTEM_RISK",
  BM14_DMCE = "BM14_DMCE",
  BM15_AUTHORIZED = "BM15_AUTHORIZED",
  BM16_MINTED = "BM16_MINTED",
  REJECTED = "REJECTED",
}

// ----------------------------------------------------------------------------
// §8.3 Mint request (off-chain mirror of MTQSigmaV3.MintRequest)
// ----------------------------------------------------------------------------

export interface MintRequestInput {
  requestId: string;
  bank: string;
  corporateCustomerHash: string;
  amountUsd: number;
  backingCertificateId: string;
  jurisdiction: string;
  nonce: number;
  expiry: number; // unix seconds
  /** Workflow state as reported by the on-chain `mintRequests[requestId].state`. */
  state: WorkflowState;
  createdAt: number;
  authorizedAt: number;
  mintedAt: number;
  mintedAmount: number;
}

export interface FinalityContext {
  request: MintRequestInput;
  /** Verified ABC for this request's backingCertificateId (if known). */
  certificate?: AvailableBackingCertificate;
  /** All verified ABCs for the bank (for sum-of-backing computation). */
  bankCertificates?: AvailableBackingCertificate[];
  /** Protocol risk state (NORMAL/CAUTION/STRESS/DEFENSIVE/EMERGENCY/RECOVERY). */
  protocolState?: string;
  /** System RR (reserve ratio, 1.30 = 130%). `undefined` if unknown. */
  reserveRatio?: number;
  /** System LCR. */
  lcr?: number;
  /** Whether the on-chain oracle consensus is healthy (strict 3-source quorum). */
  oracleHealthy?: boolean;
  /** Per-bank outstanding MTQ (for concentration check). */
  bankMintedTotal?: number;
  /** Total MTQ supply. */
  totalSupply?: number;
  /** DMCE single-bank concentration cap (fraction, e.g. 0.05 = 5%). */
  dmceBankConcentrationCap?: number;
  /** MTQ price (USD per MTQ, 1e18 scale → divide by 1e18 to get float). */
  mtqPrice?: number;
}

// ----------------------------------------------------------------------------
// §8.4 The 7-layer check
// ----------------------------------------------------------------------------

/**
 * Run all 7 finality layers against `ctx`. Returns one `LayerCheck` per layer,
 * in order L1..L7. A layer is `passed: false` if any of its checks fails;
 * the `reason` field explains the first failure.
 *
 * NOTE: this is the OFF-CHAIN mirror of the on-chain finality gate. It is used
 * by the MBG Gateway and dashboard to surface to operators which layer
 * blocked a mint. The ON-CHAIN gate in `MTQSigmaV3.executeMint` is the
 * authoritative source of truth — even if this function returns all-passed,
 * the on-chain gate can still revert (e.g. if a keeper signature is missing
 * or the oracle went stale between the off-chain check and the on-chain tx).
 */
export function checkAllLayers(ctx: FinalityContext): LayerCheck[] {
  const checks: LayerCheck[] = [];
  const req = ctx.request;

  // ---- L1 API ----
  {
    let passed = true;
    let reason = "OK";
    if (!req.requestId || req.requestId.length === 0) {
      passed = false;
      reason = "missing requestId";
    } else if (!req.bank || !/^0x[a-fA-F0-9]{40}$/.test(req.bank)) {
      passed = false;
      reason = "invalid bank address";
    } else if (!Number.isFinite(req.amountUsd) || req.amountUsd <= 0) {
      passed = false;
      reason = "amountUsd must be > 0";
    } else if (!Number.isFinite(req.expiry) || req.expiry <= Math.floor(Date.now() / 1000)) {
      passed = false;
      reason = "request expired";
    } else if (!Number.isFinite(req.nonce) || req.nonce < 0) {
      passed = false;
      reason = "invalid nonce";
    } else if (!req.jurisdiction || req.jurisdiction.length !== 2) {
      passed = false;
      reason = "jurisdiction must be ISO 3166-1 alpha-2";
    } else if (!req.backingCertificateId || req.backingCertificateId.length === 0) {
      passed = false;
      reason = "missing backingCertificateId";
    }
    checks.push({ layer: "L1_API", passed, reason });
  }

  // ---- L2 WORKFLOW ----
  {
    let passed = true;
    let reason = "OK";
    // Workflow must be at BM15_AUTHORIZED to be mint-eligible.
    if (req.state !== WorkflowState.BM15_AUTHORIZED) {
      passed = false;
      reason = `workflow state is ${req.state}, must be BM15_AUTHORIZED`;
    }
    checks.push({ layer: "L2_WORKFLOW", passed, reason });
  }

  // ---- L3 POLICY ----
  {
    let passed = true;
    let reason = "OK";
    if (!isAuthorizedBank(req.bank)) {
      passed = false;
      reason = "bank not authorized in registry";
    } else {
      const bank = getBank(req.bank);
      if (!bank) {
        passed = false;
        reason = "bank record missing";
      } else if (bank.jurisdiction !== req.jurisdiction) {
        passed = false;
        reason = `jurisdiction mismatch (bank=${bank.jurisdiction}, request=${req.jurisdiction})`;
      } else if (getDailyMintRemaining(req.bank) < req.amountUsd) {
        passed = false;
        reason = `daily mint cap exceeded (remaining ${getDailyMintRemaining(req.bank)} < ${req.amountUsd})`;
      } else if (ctx.bankCertificates) {
        const verifiedSum = ctx.bankCertificates
          .filter((c) => c.verified && verifyABC(c))
          .reduce((s, c) => s + abcBackedAmount(c), 0);
        if (verifiedSum < req.amountUsd) {
          passed = false;
          reason = `verified backing ${verifiedSum} < mint amount ${req.amountUsd}`;
        }
      }
    }
    checks.push({ layer: "L3_POLICY", passed, reason });
  }

  // ---- L4 AUTHORIZATION ----
  {
    let passed = true;
    let reason = "OK";
    // The on-chain authorizedAt timestamp is the proof that the
    // MONETARY_CONTROL_ROLE signer signed off on the BM-15 transition.
    if (!req.authorizedAt || req.authorizedAt === 0) {
      passed = false;
      reason = "not authorized (authorizedAt = 0)";
    }
    checks.push({ layer: "L4_AUTHORIZATION", passed, reason });
  }

  // ---- L5 LEDGER ----
  {
    let passed = true;
    let reason = "OK";
    if (req.state === WorkflowState.BM16_MINTED) {
      passed = false;
      reason = "already minted (BM16_MINTED)";
    } else if (req.state === WorkflowState.REJECTED) {
      passed = false;
      reason = "request rejected";
    } else if (req.mintedAt !== 0 || req.mintedAmount !== 0) {
      passed = false;
      reason = "ledger already credited (mintedAt/mintedAmount non-zero)";
    }
    checks.push({ layer: "L5_LEDGER", passed, reason });
  }

  // ---- L6 DATABASE ----
  {
    // The atomicity of the on-chain single-tx write is the L6 guarantee.
    // Off-chain we can only assert that the request is not in a partial state.
    let passed = true;
    let reason = "OK";
    if (req.state === WorkflowState.BM16_MINTED && req.mintedAmount === 0) {
      passed = false;
      reason = "inconsistent state: BM16_MINTED but mintedAmount=0";
    }
    checks.push({ layer: "L6_DATABASE", passed, reason });
  }

  // ---- L7 CONTRACT ----
  {
    // The keeper signature is enforced on-chain by `onlyKeeper`. Off-chain we
    // can only assert that the system is in a mint-able risk state and the
    // oracle is healthy — both preconditions for the keeper to sign.
    let passed = true;
    let reason = "OK";
    const state = ctx.protocolState ?? "NORMAL";
    const mintableStates = ["NORMAL", "CAUTION", "RECOVERY"];
    if (!mintableStates.includes(state)) {
      passed = false;
      reason = `protocol state ${state} does not permit minting`;
    } else if (ctx.oracleHealthy === false) {
      passed = false;
      reason = "oracle consensus not healthy (strict 3-source quorum failed)";
    }
    checks.push({ layer: "L7_CONTRACT", passed, reason });
  }

  return checks;
}

// ----------------------------------------------------------------------------
// §8.5 canMint — strict AND across all 7 layers
// ----------------------------------------------------------------------------

/**
 * Returns `true` iff ALL 7 finality layers pass. ANY single failure → false.
 * This is the authoritative off-chain answer to "can this mint land?".
 *
 * Note: this is a NECESSARY but not SUFFICIENT condition — the on-chain
 * `executeMint` may still revert (e.g. race condition: oracle went stale
 * between this check and the tx landing). The on-chain gate is the source
 * of truth.
 */
export function canMint(ctx: FinalityContext): boolean {
  return checkAllLayers(ctx).every((c) => c.passed);
}

/**
 * Returns the first failing layer (or `null` if all pass). Useful for
 * surfacing the blocking reason to the dashboard operator.
 */
export function firstFailingLayer(ctx: FinalityContext): LayerCheck | null {
  return checkAllLayers(ctx).find((c) => !c.passed) ?? null;
}
