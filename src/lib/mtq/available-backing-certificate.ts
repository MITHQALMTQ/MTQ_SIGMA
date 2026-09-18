// ============================================================================
//  MTQΣ V3 — AvailableBackingCertificate (ABC) (Blueprint v25.3 §7)
//  ----------------------------------------------------------------------------
//  An AvailableBackingCertificate (ABC) is the cryptographic evidence that a
//  bank has the backing assets to support a mint of `amountUsd` MTQ. The
//  certificate is issued by a qualified custodian (e.g. a regulated trust
//  company or central bank gold vault) and submitted on-chain by the bank.
//
//  MITHQAL NEVER takes custody of the underlying — the contract only verifies
//  the custodian's attestation. The bank remains the legal owner of the
//  reserves; MITHQAL mints MTQ against the verified evidence.
//
//  Lifecycle:
//    1. Bank's custodian issues an attestation (off-chain): a signed payload
//       containing { bank, amountUsd, reserveComposition, expiry }.
//    2. Bank generates an ABC from the attestation via `generateABC()`.
//    3. Bank submits the ABC on-chain via `submitBackingCertificate()`.
//    4. Keeper verifies the custodian attestation (production: via oracle;
//       testnet: auto-verify via `verifyABC()`) and calls on-chain
//       `verifyBackingCertificate(certId)`.
//    5. The mint request's BM-06 (EVIDENCE) and BM-11 (BACKING_VERIFIED)
//       workflow steps check that the certificate is verified and that the
//       verified backing pool ≥ the mint amount.
//
//  This module is the TypeScript reference implementation used by:
//    • the MBG Gateway to generate ABCs from custodian attestations;
//    • the policy engine (`finality.ts`) L3 layer to assert backing evidence;
//    • the dashboard to render each bank's verified backing pool.
// ============================================================================

export interface AvailableBackingCertificate {
  /** Unique certificate ID (keccak256 of the canonical attestation payload). */
  certificateId: string;
  /** Bank address (EIP-55 checksummed). */
  bank: string;
  /** USD amount this certificate backs (1 USD = 1 unit; on-chain this is
   *  scaled to 1e18). */
  amountUsd: number;
  /** SHA-256 hash of the custodian's signed attestation (off-chain payload). */
  custodianAttestationHash: string;
  /** Unix epoch (seconds) when the custodian attestation expires. */
  custodianAttestationExpiry: number;
  /** SHA-256 hash of the reserve asset breakdown (e.g. "80% US T-bills, 18%
   *  gold LBMA, 2% USDC") — auditable composition commitment. */
  reserveAssetBreakdownHash: string;
  /** Unix epoch (seconds) when the certificate was issued. */
  issuedAt: number;
  /** Whether the keeper has verified the custodian attestation. */
  verified: boolean;
}

// ----------------------------------------------------------------------------
// §7.2 ABC generation parameters
// ----------------------------------------------------------------------------

export interface GenerateABCParams {
  bank: string;
  amountUsd: number;
  /** The custodian's signed attestation payload (JSON, JWS, or raw bytes). */
  custodianAttestation: string;
  /** Attestation expiry (unix seconds). Must be in the future. */
  custodianAttestationExpiry: number;
  /** Reserve composition breakdown (human-readable, e.g.
   *  "80% US T-bills, 18% gold LBMA, 2% USDC"). */
  reserveAssetBreakdown: string;
  /** Optional override for the issuedAt timestamp (defaults to now). */
  issuedAt?: number;
}

// ----------------------------------------------------------------------------
// §7.3 Hash helpers (browser & Node compatible)
// ----------------------------------------------------------------------------

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  // Use the Web Crypto API (available in Node ≥ 15 with --experimental-global-webcrypto,
  // and natively in Node ≥ 19, all modern browsers, Bun, Deno, Vercel Edge).
  const digest = await crypto.subtle.digest("SHA-256", data);
  return "0x" + Buffer.from(new Uint8Array(digest)).toString("hex");
}

/** Returns true iff `s` looks like a 0x-prefixed hex string. */
function isHex(s: string): boolean {
  return /^0x[0-9a-fA-F]*$/.test(s);
}

// ----------------------------------------------------------------------------
// §7.4 ABC generation
// ----------------------------------------------------------------------------

/**
 * Generate an AvailableBackingCertificate from a custodian attestation.
 *
 * The certificate ID is the keccak256-equivalent (we use SHA-256 here for
 * cross-platform Web Crypto compatibility; on-chain the certificate ID is
 * whatever the bank passed in, so any 32-byte hash works). The custodian
 * attestation hash and reserve breakdown hash are SHA-256 of the respective
 * payloads.
 *
 * Throws if any parameter is invalid (amount ≤ 0, expiry in the past, etc.).
 */
export async function generateABC(params: GenerateABCParams): Promise<AvailableBackingCertificate> {
  if (!params.bank || !/^0x[a-fA-F0-9]{40}$/.test(params.bank)) {
    throw new Error("ABC: invalid bank address");
  }
  if (!Number.isFinite(params.amountUsd) || params.amountUsd <= 0) {
    throw new Error("ABC: amountUsd must be > 0");
  }
  if (!Number.isFinite(params.custodianAttestationExpiry) || params.custodianAttestationExpiry <= Math.floor(Date.now() / 1000)) {
    throw new Error("ABC: custodianAttestationExpiry must be in the future");
  }
  if (!params.custodianAttestation || params.custodianAttestation.length === 0) {
    throw new Error("ABC: custodianAttestation required");
  }
  if (!params.reserveAssetBreakdown || params.reserveAssetBreakdown.length === 0) {
    throw new Error("ABC: reserveAssetBreakdown required");
  }

  const issuedAt = params.issuedAt ?? Math.floor(Date.now() / 1000);

  const [custodianHash, breakdownHash, certId] = await Promise.all([
    sha256Hex(params.custodianAttestation),
    sha256Hex(params.reserveAssetBreakdown),
    sha256Hex(
      JSON.stringify({
        bank: params.bank.toLowerCase(),
        amountUsd: params.amountUsd,
        custodianAttestation: params.custodianAttestation,
        custodianAttestationExpiry: params.custodianAttestationExpiry,
        reserveAssetBreakdown: params.reserveAssetBreakdown,
        issuedAt,
      }),
    ),
  ]);

  return {
    certificateId: certId,
    bank: params.bank,
    amountUsd: params.amountUsd,
    custodianAttestationHash: custodianHash,
    custodianAttestationExpiry: params.custodianAttestationExpiry,
    reserveAssetBreakdownHash: breakdownHash,
    issuedAt,
    verified: false,
  };
}

// ----------------------------------------------------------------------------
// §7.5 ABC verification (off-chain)
// ----------------------------------------------------------------------------

/**
 * Verify an ABC's structural and temporal integrity. Returns `true` iff:
 *   • the certificateId is a valid 0x-prefixed 32-byte hash,
 *   • the bank address is a valid EIP-55 address,
 *   • the amount is positive,
 *   • the attestation hashes are valid 0x-prefixed hashes,
 *   • the attestation has not expired.
 *
 * This is the OFF-CHAIN structural verification used by the policy engine.
 * On-chain, the keeper calls `verifyBackingCertificate(certId)` which marks
 * the certificate as verified in the contract's `backingCertificates` mapping
 * and credits the bank's verified-backing pool. The on-chain path is the
 * source of truth — this function only asserts the certificate is well-formed
 * and not expired.
 */
export function verifyABC(cert: AvailableBackingCertificate): boolean {
  if (!cert) return false;
  if (!isHex(cert.certificateId) || cert.certificateId.length !== 66) return false; // 0x + 64 hex
  if (!/^0x[a-fA-F0-9]{40}$/.test(cert.bank)) return false;
  if (!Number.isFinite(cert.amountUsd) || cert.amountUsd <= 0) return false;
  if (!isHex(cert.custodianAttestationHash) || cert.custodianAttestationHash.length !== 66) return false;
  if (!isHex(cert.reserveAssetBreakdownHash) || cert.reserveAssetBreakdownHash.length !== 66) return false;
  if (!Number.isFinite(cert.custodianAttestationExpiry)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (cert.custodianAttestationExpiry <= nowSec) return false;
  if (!Number.isFinite(cert.issuedAt) || cert.issuedAt > nowSec + 60) return false;
  return true;
}

/**
 * Returns the USD amount this certificate backs. If `verified` is false,
 * returns 0 — only verified certificates contribute to the backing pool.
 */
export function abcBackedAmount(cert: AvailableBackingCertificate): number {
  if (!cert || !cert.verified) return 0;
  if (!verifyABC(cert)) return 0;
  return cert.amountUsd;
}

/**
 * Sums the verified backing across multiple certificates for a single bank.
 * Used by the policy engine to assert the bank's verified pool ≥ mint amount
 * (BM-11 BACKING_VERIFIED).
 */
export function sumVerifiedBacking(certs: AvailableBackingCertificate[], bankAddress: string): number {
  const bank = bankAddress.toLowerCase();
  return certs
    .filter((c) => c.bank.toLowerCase() === bank)
    .reduce((sum, c) => sum + abcBackedAmount(c), 0);
}
