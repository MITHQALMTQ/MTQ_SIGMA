// ============================================================================
//  MTQΣ V3 — MBG Status: GET /api/mbg/status/[requestId]
//  ----------------------------------------------------------------------------
//  Returns the current workflow state of a mint request. The source of truth
//  on-chain is `MTQSigmaV3.mintRequests[requestId]`; this endpoint reads the
//  off-chain Turso mirror (populated by `/api/mbg/mint-request`) and surfaces
//  the workflow state + the 7-layer finality checks.
//
//  If the request is not in the off-chain DB but exists on-chain (rare — only
//  if the bank submitted on-chain without going through the MBG Gateway),
//  this endpoint returns a 404 with a hint to query the chain directly.
// ============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
import {
  checkAllLayers,
  type FinalityContext,
  WorkflowState,
} from "@/lib/mtq/finality";
import { getBank } from "@/lib/mtq/bank-registry";

export const dynamic = "force-dynamic";

// 16-step workflow descriptor (Blueprint v25.3 §8). Order matches the on-chain
// enum MTQSigmaV3.WorkflowState.
const WORKFLOW_STEPS: { id: string; label: string; description: string }[] = [
  { id: "BM01_PENDING", label: "BM-01 PENDING", description: "Bank submits requestMint()" },
  { id: "BM02_RECEIVED", label: "BM-02 RECEIVED", description: "MBG gateway ack (API auth + schema OK)" },
  { id: "BM03_KYC", label: "BM-03 KYC", description: "KYC passed (off-chain evidence)" },
  { id: "BM04_AML", label: "BM-04 AML", description: "AML / sanctions passed" },
  { id: "BM05_BACKING", label: "BM-05 BACKING", description: "ABC submitted & in registry" },
  { id: "BM06_EVIDENCE", label: "BM-06 EVIDENCE", description: "ABC verified (custodian attestation valid)" },
  { id: "BM07_REQUESTED", label: "BM-07 REQUESTED", description: "MBG has translated request to on-chain" },
  { id: "BM08_TRANSLATED", label: "BM-08 TRANSLATED", description: "Request payload validated against policy" },
  { id: "BM09_ELIGIBLE", label: "BM-09 ELIGIBLE", description: "Bank + jurisdiction eligible" },
  { id: "BM10_JURISDICTION", label: "BM-10 JURISDICTION", description: "Jurisdiction checks (sanctions / exchange control)" },
  { id: "BM11_BACKING_VERIFIED", label: "BM-11 BACKING_VERIFIED", description: "Backing ≥ mint amount" },
  { id: "BM12_BANK_RISK", label: "BM-12 BANK_RISK", description: "Bank-level risk (cap, concentration, credit)" },
  { id: "BM13_SYSTEM_RISK", label: "BM-13 SYSTEM_RISK", description: "System-level risk (RR/LCR/state machine)" },
  { id: "BM14_DMCE", label: "BM-14 DMCE", description: "Daily Mint Cap / Concentration / Exposure" },
  { id: "BM15_AUTHORIZED", label: "BM-15 AUTHORIZED", description: "MITHQAL Monetary Control authorization (L4)" },
  { id: "BM16_MINTED", label: "BM-16 MINTED", description: "executeMint() final atomic write (L6+L7)" },
];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "simulate");
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded", retryAfter: rl.resetAt },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  const { requestId: requestIdParam } = await params;
  // Validate the requestId format (0x-prefixed 32-byte hash).
  if (!requestIdParam || !/^0x[a-fA-F0-9]{64}$/.test(requestIdParam)) {
    return NextResponse.json(
      { ok: false, error: "requestId must be 0x-prefixed 32-byte hash" },
      { status: 400 },
    );
  }

  // ---- Read from the off-chain Turso mirror ----
  let row: any = null;
  try {
    row = await db.mbzMintRequest.findUnique({
      where: { requestId: requestIdParam },
    });
  } catch (dbErr) {
    console.error("MBG status DB read failed (non-fatal):", (dbErr as Error).message?.slice(0, 80));
    return NextResponse.json(
      { ok: false, error: "DB unavailable; query on-chain MTQSigmaV3.mintRequests(requestId) directly" },
      { status: 503 },
    );
  }

  if (!row) {
    return NextResponse.json(
      {
        ok: false,
        error: "requestId not found in off-chain mirror",
        hint: "If the bank submitted on-chain without the MBG Gateway, query MTQSigmaV3.mintRequests(requestId) directly on-chain.",
      },
      { status: 404 },
    );
  }

  // ---- Build the finality context for the 7-layer check ----
  const stateEnum = parseWorkflowState(row.state);
  const ctx: FinalityContext = {
    request: {
      requestId: row.requestId,
      bank: row.bank,
      corporateCustomerHash: row.corporateCustomerHash,
      amountUsd: row.amountUsd,
      backingCertificateId: row.backingCertificateId,
      jurisdiction: row.jurisdiction,
      nonce: Number(row.nonce),
      expiry: Number(row.expiry),
      state: stateEnum,
      createdAt: row.createdAt.getTime(),
      authorizedAt: row.authorizedAt ? Number(row.authorizedAt) : 0,
      mintedAt: row.mintedAt ? Number(row.mintedAt) : 0,
      mintedAmount: row.mintedAmount ?? 0,
    },
    protocolState: "NORMAL", // pilot: assume NORMAL; production: query on-chain currentState
    reserveRatio: 1.30,      // pilot: assume target; production: query on-chain getReserveRatio()
    lcr: 1.00,
    oracleHealthy: true,
  };
  const layerChecks = checkAllLayers(ctx);

  // ---- Compute workflow progress percentage ----
  const stepIdx = WORKFLOW_STEPS.findIndex((s) => s.id === row.state);
  const progress = stepIdx >= 0 ? Math.round(((stepIdx + 1) / 16) * 100) : 0;

  // ---- Build the workflow trail ----
  const trail = WORKFLOW_STEPS.map((s, i) => ({
    ...s,
    reached: i <= stepIdx,
    isCurrent: i === stepIdx,
  }));

  const bank = getBank(row.bank);

  return NextResponse.json(
    {
      ok: true,
      requestId: row.requestId,
      bank: row.bank,
      bankName: bank?.name ?? null,
      jurisdiction: row.jurisdiction,
      amountUsd: row.amountUsd,
      backingCertificateId: row.backingCertificateId,
      nonce: Number(row.nonce),
      expiry: Number(row.expiry),
      state: row.state,
      stateLabel: WORKFLOW_STEPS.find((s) => s.id === row.state)?.label ?? row.state,
      rejectReason: row.rejectReason,
      progress,
      trail,
      finality: {
        canMint: layerChecks.every((c) => c.passed),
        layers: layerChecks,
      },
      ledger: {
        createdAt: row.createdAt,
        authorizedAt: row.authorizedAt ? Number(row.authorizedAt) : null,
        mintedAt: row.mintedAt ? Number(row.mintedAt) : null,
        mintedAmount: row.mintedAmount ?? null,
      },
      audit: {
        apiAuthMethod: row.apiAuthMethod,
        apiRemoteIp: row.apiRemoteIp,
        apiUserAgent: row.apiUserAgent,
      },
    },
    {
      status: 200,
      headers: { "X-RateLimit-Remaining": String(rl.remaining) },
    },
  );
}

function parseWorkflowState(s: string): WorkflowState {
  if ((WorkflowState as any)[s]) return (WorkflowState as any)[s] as WorkflowState;
  return WorkflowState.NONE;
}
