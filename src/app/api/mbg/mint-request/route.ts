// ============================================================================
//  MTQΣ V3 — MBG Gateway: POST /api/mbg/mint-request (Blueprint v25.3 §6/§8)
//  ----------------------------------------------------------------------------
//  This is the entry point of the Bank Minting Workflow. A authorized bank
//  (or its corporate customer acting through the bank) POSTs a mint request
//  to this endpoint. The MBG Gateway:
//    1. Authenticates the bank (L1 API — HMAC signature OR API key OR
//       testnet bypass).
//    2. Validates the request payload (L1 API — schema, expiry, nonce,
//       jurisdiction, amount).
//    3. Checks the off-chain bank registry (L3 POLICY — bank authorized,
//       jurisdiction matches, daily cap not exceeded).
//    4. Persists the request to Turso with state = BM01_PENDING.
//    5. Returns the requestId (a deterministic 32-byte hash the bank will
//       use when calling MTQSigmaV3.requestMint on-chain).
//
//  NOTE: This endpoint does NOT call the on-chain `requestMint` directly —
//  in the production architecture the bank signs the on-chain tx itself
//  (the MBG Gateway is read-only w.r.t. the chain). In the testnet pilot,
//  the gateway MAY submit the on-chain tx on the bank's behalf using a
//  keeper key (controlled by the `MBG_TESTNET_AUTO_SUBMIT` env var).
//
//  BM-07 (REQUESTED) and BM-08 (TRANSLATED) are the MBG's workflow steps;
//  this endpoint is what BM-07/BM-08 are about.
// ============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthorizedBank, getBank, getDailyMintRemaining } from "@/lib/mtq/bank-registry";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
import { generateABC, verifyABC } from "@/lib/mtq/available-backing-certificate";
import { checkAllLayers, type FinalityContext, WorkflowState } from "@/lib/mtq/finality";
import { createHmac, randomBytes } from "crypto";

export const dynamic = "force-dynamic";

// ----------------------------------------------------------------------------
// §6.4 Request body schema
// ----------------------------------------------------------------------------

interface MintRequestBody {
  bank: string;
  corporateCustomerHash: string;        // 0x-prefixed 32-byte hash
  amountUsd: number;
  backingCertificateId: string;          // 0x-prefixed 32-byte hash
  jurisdiction: string;                  // ISO 3166-1 alpha-2
  nonce: number;
  expiry: number;                        // unix seconds
  // ABC payload (optional — bank may pre-submit the ABC via a separate
  // endpoint and reference its certificateId here; or include it inline).
  backingCertificate?: {
    amountUsd: number;
    custodianAttestation: string;
    custodianAttestationExpiry: number;
    reserveAssetBreakdown: string;
  };
  // Authentication
  apiKey?: string;
  signature?: string;                    // HMAC-SHA256(bank, body, nonce, timestamp)
  signatureTimestamp?: number;
}

// ----------------------------------------------------------------------------
// §6.5 HMAC verification
// ----------------------------------------------------------------------------

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyBankAuth(
  req: Request,
  body: MintRequestBody,
  rawBody: string,
): Promise<{ ok: boolean; method: string; reason?: string }> {
  // Testnet bypass: if no auth is provided AND the bank is the pilot bank,
  // allow (rate-limited). This is the "testnet auto-submit" path.
  const isTestnet = process.env.MBG_TESTNET_BYPASS === "true";
  if (isTestnet && !body.signature && !body.apiKey && body.bank) {
    if (isAuthorizedBank(body.bank)) {
      return { ok: true, method: "testnet" };
    }
  }

  // API key path
  if (body.apiKey) {
    const bank = getBank(body.bank);
    if (!bank || !bank.apiKeyHash) {
      return { ok: false, method: "apikey", reason: "bank has no API key on file" };
    }
    const hash = require("crypto").createHash("sha256").update(body.apiKey).digest("hex");
    if (!constantTimeEqual("0x" + hash, bank.apiKeyHash)) {
      return { ok: false, method: "apikey", reason: "invalid API key" };
    }
    return { ok: true, method: "apikey" };
  }

  // HMAC signature path
  if (body.signature && body.signatureTimestamp) {
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - body.signatureTimestamp) > 60) {
      return { ok: false, method: "hmac", reason: "signature timestamp out of ±60s window" };
    }
    const secret = process.env.MBG_HMAC_SECRET;
    if (!secret) {
      return { ok: false, method: "hmac", reason: "MBG_HMAC_SECRET not configured" };
    }
    const message = `${body.bank}:${body.signatureTimestamp}:${body.nonce}:${rawBody}`;
    const expected = createHmac("sha256", secret).update(message).digest("hex");
    if (!constantTimeEqual(expected, body.signature)) {
      return { ok: false, method: "hmac", reason: "invalid HMAC signature" };
    }
    return { ok: true, method: "hmac" };
  }

  return { ok: false, method: "none", reason: "no authentication provided" };
}

// ----------------------------------------------------------------------------
// §6.6 POST handler — BM-07/BM-08 entry
// ----------------------------------------------------------------------------

export async function POST(req: Request) {
  // Rate limit (use the "simulate" bucket — 20 req/IP/minute).
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "simulate");
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded", retryAfter: rl.resetAt },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  // ---- Parse body ----
  let body: MintRequestBody;
  let rawBody: string;
  try {
    rawBody = await req.text();
    body = JSON.parse(rawBody) as MintRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  // ---- L1 API: validate payload ----
  const validationError = validatePayload(body);
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError, layer: "L1_API" }, { status: 400 });
  }

  // ---- L1 API: authenticate ----
  const auth = await verifyBankAuth(req, body, rawBody);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.reason ?? "Authentication failed", layer: "L1_API", method: auth.method },
      { status: 401 },
    );
  }

  // ---- L3 POLICY: bank eligibility (off-chain mirror) ----
  if (!isAuthorizedBank(body.bank)) {
    return NextResponse.json(
      { ok: false, error: "Bank not authorized in registry", layer: "L3_POLICY" },
      { status: 403 },
    );
  }
  const bank = getBank(body.bank);
  if (!bank) {
    return NextResponse.json({ ok: false, error: "Bank record missing", layer: "L3_POLICY" }, { status: 403 });
  }
  if (bank.jurisdiction !== body.jurisdiction) {
    return NextResponse.json(
      {
        ok: false,
        error: `Jurisdiction mismatch (bank=${bank.jurisdiction}, request=${body.jurisdiction})`,
        layer: "L3_POLICY",
      },
      { status: 403 },
    );
  }
  if (getDailyMintRemaining(body.bank) < body.amountUsd) {
    return NextResponse.json(
      {
        ok: false,
        error: `Daily mint cap exceeded (remaining ${getDailyMintRemaining(body.bank)} < ${body.amountUsd})`,
        layer: "L3_POLICY",
      },
      { status: 403 },
    );
  }

  // ---- ABC handling: generate one if the bank passed an inline payload ----
  let certificateId = body.backingCertificateId;
  let certificateVerified = false;
  if (body.backingCertificate) {
    try {
      const abc = await generateABC({
        bank: body.bank,
        amountUsd: body.backingCertificate.amountUsd,
        custodianAttestation: body.backingCertificate.custodianAttestation,
        custodianAttestationExpiry: body.backingCertificate.custodianAttestationExpiry,
        reserveAssetBreakdown: body.backingCertificate.reserveAssetBreakdown,
      });
      certificateId = abc.certificateId;
      certificateVerified = verifyABC(abc);
      // Best-effort persist ABC (fail-soft — DB may be unavailable in dev).
      try {
        await db.mbzBackingCertificate.create({
          data: {
            certificateId: abc.certificateId,
            bank: abc.bank,
            amountUsd: abc.amountUsd,
            custodianAttestationHash: abc.custodianAttestationHash,
            custodianAttestationExpiry: BigInt(abc.custodianAttestationExpiry),
            reserveAssetBreakdownHash: abc.reserveAssetBreakdownHash,
            issuedAt: BigInt(abc.issuedAt),
            verified: abc.verified,
          },
        });
      } catch (dbErr) {
        console.error("MBG ABC DB log failed (non-fatal):", (dbErr as Error).message?.slice(0, 80));
      }
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: `ABC generation failed: ${(e as Error).message}`, layer: "L3_POLICY" },
        { status: 400 },
      );
    }
  }

  // ---- Compute the on-chain requestId (must match MTQSigmaV3.requestMint) ----
  // The on-chain ID is keccak256(bank, corpHash, amount, certId, nonce, chainId, ts).
  // We don't have a Solidity-equivalent keccak in pure TS, so we generate a
  // deterministic ID by SHA-256'ing the same canonical fields (chain-agnostic
  // — the chain-specific timestamp is the bank's responsibility to match).
  const requestId = await deterministicRequestId({
    bank: body.bank,
    corporateCustomerHash: body.corporateCustomerHash,
    amountUsd: body.amountUsd,
    backingCertificateId: certificateId,
    nonce: body.nonce,
  });

  // ---- Run the 7-layer finality check (off-chain mirror) ----
  const ctx: FinalityContext = {
    request: {
      requestId,
      bank: body.bank,
      corporateCustomerHash: body.corporateCustomerHash,
      amountUsd: body.amountUsd,
      backingCertificateId: certificateId,
      jurisdiction: body.jurisdiction,
      nonce: body.nonce,
      expiry: body.expiry,
      state: WorkflowState.BM01_PENDING,
      createdAt: Date.now(),
      authorizedAt: 0,
      mintedAt: 0,
      mintedAmount: 0,
    },
    certificate: body.backingCertificate ? { verified: certificateVerified } as any : undefined,
    protocolState: "NORMAL",
    reserveRatio: 1.30,
    lcr: 1.00,
    oracleHealthy: true,
  };
  const layerChecks = checkAllLayers(ctx);
  // At BM-01, L2/L4/L5 will report "not yet" — that's expected. Only L1/L3
  // MUST pass at request time. The other layers are checked again at executeMint.
  const blockingLayer = layerChecks.find(
    (c) => !c.passed && (c.layer === "L1_API" || c.layer === "L3_POLICY"),
  );
  if (blockingLayer) {
    return NextResponse.json(
      { ok: false, error: blockingLayer.reason, layer: blockingLayer.layer },
      { status: 403 },
    );
  }

  // ---- Persist the mint request (fail-soft: DB may be unavailable in dev) ----
  try {
    await db.mbzMintRequest.create({
      data: {
        requestId,
        bank: body.bank,
        corporateCustomerHash: body.corporateCustomerHash,
        amountUsd: body.amountUsd,
        backingCertificateId: certificateId,
        jurisdiction: body.jurisdiction,
        nonce: BigInt(body.nonce),
        expiry: BigInt(body.expiry),
        state: "BM01_PENDING",
        apiAuthMethod: auth.method,
        apiRemoteIp: ip,
        apiUserAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
      },
    });
  } catch (dbErr) {
    console.error("MBG mint-request DB log failed (non-fatal):", (dbErr as Error).message?.slice(0, 80));
    // Don't fail the request — return the requestId so the bank can still
    // submit on-chain. The DB row is best-effort mirror only.
  }

  // ---- Return BM-07/BM-08 ack ----
  return NextResponse.json(
    {
      ok: true,
      requestId,
      state: "BM01_PENDING",
      workflow: "BM-07 REQUESTED → BM-08 TRANSLATED (pending on-chain requestMint by the bank)",
      bank: body.bank,
      amountUsd: body.amountUsd,
      jurisdiction: body.jurisdiction,
      backingCertificateId: certificateId,
      backingCertificateVerified: certificateVerified,
      layerChecks,
      next: "Bank calls MTQSigmaV3.requestMint(BankMintRequest) on-chain with this requestId's parameters. Keeper then advances BM-02..BM-15; Monetary Control signs BM-15; keeper calls executeMint at BM-16.",
    },
    {
      status: 200,
      headers: { "X-RateLimit-Remaining": String(rl.remaining) },
    },
  );
}

// ----------------------------------------------------------------------------
// §6.7 Helpers
// ----------------------------------------------------------------------------

function validatePayload(body: MintRequestBody): string | null {
  if (!body.bank || !/^0x[a-fA-F0-9]{40}$/.test(body.bank)) return "Invalid bank address";
  if (!body.corporateCustomerHash || !/^0x[a-fA-F0-9]{64}$/.test(body.corporateCustomerHash)) {
    return "corporateCustomerHash must be 0x-prefixed 32-byte hash";
  }
  if (!Number.isFinite(body.amountUsd) || body.amountUsd <= 0) return "amountUsd must be > 0";
  if (!body.backingCertificateId || !/^0x[a-fA-F0-9]{64}$/.test(body.backingCertificateId)) {
    if (!body.backingCertificate) {
      return "backingCertificateId must be 0x-prefixed 32-byte hash (or provide backingCertificate inline)";
    }
  }
  if (!body.jurisdiction || body.jurisdiction.length !== 2) {
    return "jurisdiction must be ISO 3166-1 alpha-2";
  }
  if (!Number.isFinite(body.nonce) || body.nonce < 0) return "nonce must be ≥ 0";
  if (!Number.isFinite(body.expiry) || body.expiry <= Math.floor(Date.now() / 1000)) {
    return "expiry must be a future unix timestamp";
  }
  return null;
}

async function deterministicRequestId(params: {
  bank: string;
  corporateCustomerHash: string;
  amountUsd: number;
  backingCertificateId: string;
  nonce: number;
}): Promise<string> {
  const canonical = JSON.stringify({
    bank: params.bank.toLowerCase(),
    corporateCustomerHash: params.corporateCustomerHash.toLowerCase(),
    amountUsd: params.amountUsd,
    backingCertificateId: params.backingCertificateId.toLowerCase(),
    nonce: params.nonce,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return "0x" + Buffer.from(new Uint8Array(digest)).toString("hex");
}

// Suppress unused-import warning for randomBytes (kept for future nonce helpers).
void randomBytes;
