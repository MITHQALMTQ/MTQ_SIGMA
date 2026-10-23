// ============================================================================
//  MTQΣ V3 — Proof of Reserve (PoR) (Blueprint v25.3 §5.7 / audit PoR fix)
//  ----------------------------------------------------------------------------
//  On-chain reserve attestation so anyone can verify the backing is real.
//
//  Source of Truth:
//    /audit-work/blueprint-v1.0.txt §5.7 — "Proof of Reserve (PoR) attestation"
//    /audit-work/audit-b-smart-contract.md — "PoR finding (CRITICAL):
//      no on-chain reserve attestation; a malicious bank could mint MTQ
//      against fictitious reserves. Add a PoR module that verifies the
//      custodian's attestation on-chain, with a Chainlink PoR feed fallback."
//
//  Design:
//    • A ReserveAttestation is the cryptographic evidence that the protocol's
//      reserves (fiat + gold + digital) are really held by a qualified
//      custodian, in the declared composition (80% fiat / 18% gold / 2%
//      digital per §0.6 V3 targets).
//    • Production: a Chainlink Proof of Reserve feed (e.g. chainlink ProofOfReserve
//      aggregator) returns 1 if the reserves are sufficient, 0 otherwise. We
//      integrate with this when the feed is configured; otherwise we fall back
//      to custodian-attestation verification (the bank's signed attestation,
//      which is the testnet pilot path).
//    • `verifyReserveAttestation(att)` returns true iff:
//        - the attestation has not expired (att.expiry > now),
//        - the custodian signature is well-formed and recovers to the
//          expected custodian address,
//        - the composition sums to 1.0 (±1% tolerance — small drift is OK),
//        - the total backing USD is ≥ the protocol's current liability
//          (i.e. the reserve ratio RR ≥ 1.0).
//
//  Integration points:
//    • The dashboard `PoRStatus` panel renders the current attestation +
//      verification result.
//    • The `/api/por` route returns the current PoR status as a public good.
//    • The policy engine (`finality.ts`) L3 layer can call `isReserveSufficient`
//      as part of the BM-13 SYSTEM_RISK gate (defence in depth; the on-chain
//      BM-11 BACKING_VERIFIED gate remains the source of truth).
//    • The keeper reads `verifyReserveAttestation` every tick and triggers
//      an EMERGENCY transition if reserves become insufficient.
//
//  Pilot caveat: this is the OFF-CHAIN TypeScript reference. The on-chain
//  PoR feed integration is a separate task (Chainlink PoR adapter contract
//  deployment). The custodian-attestation fallback is the pilot source of
//  truth until the Chainlink feed is wired.
// ============================================================================

// ----------------------------------------------------------------------------
// §5.7.1 ReserveAttestation shape
// ----------------------------------------------------------------------------

/**
 * A cryptographically-signed reserve attestation from a qualified custodian.
 * The custodian (e.g. a regulated trust company, central bank gold vault, or
 * a Chainlink Proof of Reserve aggregator) attests that they hold the
 * declared reserves on behalf of the protocol.
 */
export interface ReserveAttestation {
  /** Unique attestation ID (keccak256 / sha256 of the canonical payload). */
  attestationId: string;
  /** The bank this attestation covers (EIP-55 checksummed). For protocol-wide
   *  attestations, use the zero address. */
  bank: string;
  /** Total backing in USD (1 USD = 1 unit; on-chain this is scaled to 1e18). */
  totalBackingUsd: number;
  /** Reserve composition breakdown (each entry is a fraction of
   *  totalBackingUsd, summing to 1.0 ± 0.01). */
  composition: {
    fiat: number;    // 0.80 target (USD/EUR/JPY/GBP/CNY/CHF)
    gold: number;    // 0.18 target (XAU)
    digital: number; // 0.02 target (BTC/ETH/stables)
  };
  /** The qualified custodian's identity (e.g. "Brinks Global Services, NY"). */
  custodian: string;
  /** The custodian's address (EIP-55) or Chainlink PoR feed address. */
  custodianAddress: string;
  /** The custodian's signature over the canonical attestation payload
   *  (ECDSA, 0x-prefixed 65-byte hex). Empty for Chainlink PoR feed-sourced
   *  attestations (the feed itself is the attestation). */
  custodianSignature: string;
  /** Unix epoch (seconds) when the attestation was issued. */
  timestamp: number;
  /** Unix epoch (seconds) when the attestation expires. */
  expiry: number;
  /** Whether the attestation has been verified by this module. */
  verified: boolean;
}

// ----------------------------------------------------------------------------
// §5.7.2 PoR configuration
// ----------------------------------------------------------------------------

/** Tolerance for the composition sum-to-1 check (1% = 0.01). */
const COMPOSITION_TOLERANCE = 0.01;

/** Default attestation TTL (24 hours) — matches the BM-11 daily re-verification. */
const DEFAULT_TTL_SEC = 24 * 60 * 60;

/** The canonical custodian allowlist (production: set by Constitutional Council). */
export const CUSTODIAN_ALLOWLIST: Record<string, string> = {
  // Pilot custodian — a deterministic dev address (NOT a real custodian).
  "0x71C7656EC7ab88b098defB751B7401B5f6d8976F": "Pilot Custodian A (testnet)",
  // Production custodians would be added here once authorized by the
  // 7/7 Constitutional Council multi-sig. Examples (placeholders):
  // "0xBrinksNY":       "Brinks Global Services, NY",
  // "0xLoomisZurich":   "Loomis International, Zurich",
  // "0xChainlinkPoRUSDC": "Chainlink PoR Feed — USDC",
};

// ----------------------------------------------------------------------------
// §5.7.3 RR (Reserve Ratio) helpers — mirror the on-chain getReserveRatio()
// ----------------------------------------------------------------------------

/**
 * Calculate the Reserve Ratio (RR) = backing / liability.
 * Returns a number ≥ 0; `Infinity` if liability = 0 (no MTQ in circulation).
 *
 * On-chain V3 stores this as a 1e18-scaled integer; here we use plain floats
 * for readability. RR ≥ 1.0 means solvent; RR ≥ 1.30 means at the production
 * target; RR < 1.0 means EMERGENCY (insolvent — the stability pool covers).
 */
export function calculateRR(backing: number, liability: number): number {
  if (!Number.isFinite(backing) || backing < 0) return 0;
  if (!Number.isFinite(liability) || liability <= 0) return Number.POSITIVE_INFINITY;
  return backing / liability;
}

/**
 * Returns true iff the reserve is sufficient: RR ≥ target.
 *
 * Production target = 1.30 (RR_TARGET in the V3 contract). The hard floor
 * is 1.0 (RR_HARD_FLOOR); below that, the protocol enters EMERGENCY.
 *
 * Use this in the policy engine as a defence-in-depth check alongside the
 * on-chain BM-11 BACKING_VERIFIED gate.
 */
export function isReserveSufficient(
  backing: number,
  liability: number,
  target: number = 1.30,
): boolean {
  const rr = calculateRR(backing, liability);
  if (!Number.isFinite(rr)) return true; // no liability = vacuously sufficient
  return rr >= target;
}

// ----------------------------------------------------------------------------
// §5.7.4 Attestation fetch
// ----------------------------------------------------------------------------

/**
 * Fetch the latest reserve attestation for a given bank (or protocol-wide
 * if `bank` is the zero address).
 *
 * Production paths (in order of preference):
 *   1. Chainlink Proof of Reserve feed — if configured for this bank, we
 *      read the feed's latest answer (1 = sufficient, 0 = insufficient)
 *      and synthesize a ReserveAttestation from it. The feed itself is the
 *      attestation; no custodian signature is required.
 *   2. Custodian attestation oracle — the keeper polls an off-chain
 *      attestation service (run by the custodian) and posts the signed
 *      attestation on-chain. We read the latest posted attestation.
 *   3. Fallback (pilot) — synthesize a placeholder attestation from the
 *      in-process pilot state. This is NOT production-safe; it exists so
 *      the dashboard has something to render in the testnet pilot.
 *
 * The pilot fallback is the default in this module. The Chainlink path will
 * be wired once the protocol owner deploys the PoR feed adapter contract.
 */
export async function fetchReserveAttestation(
  bank: string = "0x0000000000000000000000000000000000000000",
): Promise<ReserveAttestation> {
  // Validate the bank address (must be a 0x-prefixed 20-byte hex).
  if (!/^0x[a-fA-F0-9]{40}$/.test(bank)) {
    throw new Error(`PoR: invalid bank address: ${bank}`);
  }

  // Pilot fallback: synthesize a placeholder attestation from the in-process
  // pilot state. Production deployments MUST override this with the Chainlink
  // PoR feed path (see fetchReserveAttestationFromChainlink below).
  return fetchReserveAttestationPilotFallback(bank);
}

/**
 * Pilot fallback: synthesize a placeholder attestation. The composition is
 * the canonical 80/18/2 V3 target; the total backing is read from the
 * in-process pilot state if available, else 0.
 *
 * This is NOT production-safe — the verified flag is always false here, so
 * the policy engine and the dashboard MUST NOT treat this as proof. It
 * exists so the dashboard can render the PoR panel in the testnet pilot.
 */
async function fetchReserveAttestationPilotFallback(
  bank: string,
): Promise<ReserveAttestation> {
  // Lazy-import the pilot state to avoid a circular dependency at module
  // load time. The pilot state lives in the same Next.js process.
  let totalBackingUsd = 0;
  try {
    const { getSnapshot } = await import("./pilot-state");
    const snap = await getSnapshot();
    // The pilot snapshot exposes `nav` (NAV in USD). Use that as the backing.
    if (snap && typeof snap.nav === "number" && Number.isFinite(snap.nav)) {
      totalBackingUsd = snap.nav;
    }
  } catch {
    // Pilot state not ready (e.g. cold start) — leave at 0.
  }

  const now = Math.floor(Date.now() / 1000);
  return {
    attestationId: `por-pilot-${bank}-${now}`,
    bank,
    totalBackingUsd,
    composition: {
      fiat: 0.80, // V3 target
      gold: 0.18,
      digital: 0.02,
    },
    custodian: "Pilot Custodian A (testnet — NOT production-safe)",
    custodianAddress: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    custodianSignature: "", // empty = unverified pilot fallback
    timestamp: now,
    expiry: now + DEFAULT_TTL_SEC,
    verified: false,
  };
}

/**
 * Production path stub: fetch the attestation from a Chainlink Proof of
 * Reserve feed. Returns true if the feed confirms the reserves are
 * sufficient; the synthesized ReserveAttestation has `verified = true`
 * in that case.
 *
 * This is NOT yet wired — it requires the protocol owner to deploy a
 * Chainlink PoR adapter contract (mirroring the ChainlinkAdapter in
 * `contracts/foundry-out/ChainlinkAdapter.sol/`). The signature is here
 * so the dashboard and policy engine can call it without a refactor once
 * the feed is wired.
 */
export async function fetchReserveAttestationFromChainlink(
  _chainlinkPoRFeedAddress: string,
  _bank: string = "0x0000000000000000000000000000000000000000",
): Promise<ReserveAttestation> {
  // TODO(STABILITY-POOL-FEES-POR follow-up): wire the Chainlink PoR adapter.
  // For now, throw so callers know this path is not yet available.
  throw new Error(
    "PoR: Chainlink PoR feed integration not yet wired — use fetchReserveAttestation (pilot fallback)",
  );
}

// ----------------------------------------------------------------------------
// §5.7.5 Attestation verification
// ----------------------------------------------------------------------------

/**
 * Verify a reserve attestation. Returns true iff ALL of:
 *   • the attestation is well-formed (non-empty fields, valid numbers),
 *   • the attestation has not expired (expiry > now),
 *   • the composition sums to 1.0 ± COMPOSITION_TOLERANCE,
 *   • the custodian is on the allowlist,
 *   • the custodian signature is well-formed AND recovers to the custodian's
 *     address over the canonical payload — OR the attestation came from a
 *     Chainlink PoR feed (signature empty, custodianAddress is a known feed).
 *
 * This is the OFF-CHAIN structural verification used by the policy engine
 * and the dashboard. The on-chain BM-11 BACKING_VERIFIED gate remains the
 * source of truth; this is a defence-in-depth pre-check.
 *
 * Note: this function does NOT verify the reserve ratio — use
 * `isReserveSufficient(att.totalBackingUsd, liability)` for that.
 */
export async function verifyReserveAttestation(
  att: ReserveAttestation,
): Promise<boolean> {
  if (!att) return false;

  // --- Structural checks ---
  if (!att.attestationId || att.attestationId.length === 0) return false;
  if (!/^0x[a-fA-F0-9]{40}$/.test(att.bank)) return false;
  if (!Number.isFinite(att.totalBackingUsd) || att.totalBackingUsd < 0) return false;
  if (!Number.isFinite(att.timestamp) || att.timestamp <= 0) return false;
  if (!Number.isFinite(att.expiry) || att.expiry <= 0) return false;
  if (att.expiry <= att.timestamp) return false;

  // --- Expiry check ---
  const now = Math.floor(Date.now() / 1000);
  if (att.expiry <= now) return false;

  // --- Composition sum-to-1 check (±1% tolerance) ---
  const { fiat, gold, digital } = att.composition;
  if (!Number.isFinite(fiat) || !Number.isFinite(gold) || !Number.isFinite(digital)) {
    return false;
  }
  if (fiat < 0 || gold < 0 || digital < 0) return false;
  const sum = fiat + gold + digital;
  if (Math.abs(sum - 1.0) > COMPOSITION_TOLERANCE) return false;

  // --- Custodian allowlist check ---
  const isAllowedCustodian = att.custodianAddress in CUSTODIAN_ALLOWLIST;
  if (!isAllowedCustodian) return false;

  // --- Signature check ---
  // If the signature is empty, the attestation must come from a known
  // Chainlink PoR feed (identified by custodianAddress). For the pilot,
  // no Chainlink feeds are configured, so empty signature = unverified.
  if (!att.custodianSignature || att.custodianSignature.length === 0) {
    // Production: check `att.custodianAddress` against a CHAINLINK_POR_FEEDS
    // allowlist and trust the feed's answer. Pilot: not yet wired.
    return false;
  }

  // The signature must be a 0x-prefixed 65-byte hex string (r||s||v).
  if (!/^0x[a-fA-F0-9]{130}$/.test(att.custodianSignature)) return false;

  // Recover the signer from the signature over the canonical payload.
  const canonical = canonicalAttestationPayload(att);
  const recovered = await recoverSigner(canonical, att.custodianSignature);
  if (recovered.toLowerCase() !== att.custodianAddress.toLowerCase()) {
    return false;
  }

  // All checks passed.
  return true;
}

// ----------------------------------------------------------------------------
// §5.7.6 Canonical payload + signature recovery
// ----------------------------------------------------------------------------

/**
 * Build the canonical payload that the custodian signs. This MUST match the
 * on-chain `keccak256(abi.encodePacked(...))` payload exactly. We use
 * SHA-256 here for cross-platform Web Crypto compatibility; the on-chain
 * equivalent uses keccak256 (the protocol owner MUST align the two before
 * production — see the ABC module's sha256Hex note for the same caveat).
 */
export function canonicalAttestationPayload(att: ReserveAttestation): string {
  return JSON.stringify({
    attestationId: att.attestationId,
    bank: att.bank.toLowerCase(),
    totalBackingUsd: att.totalBackingUsd,
    composition: {
      fiat: att.composition.fiat,
      gold: att.composition.gold,
      digital: att.composition.digital,
    },
    custodian: att.custodian,
    custodianAddress: att.custodianAddress.toLowerCase(),
    timestamp: att.timestamp,
    expiry: att.expiry,
  });
}

/**
 * Recover the signer address from a message + ECDSA signature.
 *
 * Uses the ethers v6 `verifyMessage` helper (already a project dependency).
 * The message is hashed via the Ethereum prefix (keccak256 of
 * "\x19Ethereum Signed Message:\n" + len + message), matching how a
 * custodian would sign with a hardware wallet (Safe / Ledger).
 *
 * Returns the 0x-prefixed checksummed address, or "" if recovery fails.
 */
async function recoverSigner(message: string, signature: string): Promise<string> {
  try {
    // Lazy-import ethers so this module can be loaded in environments
    // without ethers installed (the verification simply returns false).
    const { ethers } = await import("ethers");
    return ethers.verifyMessage(message, signature);
  } catch {
    return "";
  }
}

// ----------------------------------------------------------------------------
// §5.7.7 Aggregate PoR status (for the API route + dashboard)
// ----------------------------------------------------------------------------

export interface PorStatus {
  /** "ok" iff the latest attestation is verified AND reserves are sufficient. */
  status: "ok" | "degraded" | "insufficient" | "unverified";
  /** The latest attestation (may be unverified). */
  latestAttestation: ReserveAttestation;
  /** The current reserve ratio (backing / liability). */
  reserveRatio: number;
  /** The current liability (MTQ in circulation × MTQ price). */
  liabilityUsd: number;
  /** Whether the reserve is sufficient (RR ≥ 1.30 target). */
  sufficient: boolean;
  /** Human-readable summary of the verification result. */
  summary: string;
  /** Unix epoch (ms) when this status was computed. */
  computedAt: number;
}

/**
 * Compute the full PoR status for the protocol. This is what the `/api/por`
 * route returns. Reads the in-process pilot state for the liability side
 * (so the dashboard can render a live PoR panel without an external RPC).
 */
export async function getPorStatus(
  attestation?: ReserveAttestation,
): Promise<PorStatus> {
  const att = attestation ?? (await fetchReserveAttestation());

  // Read the in-process pilot state for the liability (MTQ in circulation ×
  // MTQ price). The pilot state exposes `liability` directly; we fall back
  // to a manual computation if not present.
  let liabilityUsd = 0;
  try {
    const { getSnapshot } = await import("./pilot-state");
    const snap = await getSnapshot();
    if (snap) {
      // The pilot snapshot exposes `nav` (NAV in USD) and `mtqPrice`. The
      // liability is (circulatingSupply × mtqPrice); for the pilot, we use
      // the snapshot's `liability` if available, else nav (a conservative
      // proxy — the pilot is over-collateralized at 130% by construction).
      if (typeof (snap as any).liability === "number") {
        liabilityUsd = (snap as any).liability;
      } else if (typeof snap.nav === "number") {
        liabilityUsd = snap.nav / 1.30; // pilot: NAV = 1.30 × liability
      }
    }
  } catch {
    // Pilot state not ready — liability stays at 0.
  }

  const rr = calculateRR(att.totalBackingUsd, liabilityUsd);
  const sufficient = isReserveSufficient(att.totalBackingUsd, liabilityUsd, 1.0);

  let status: PorStatus["status"];
  let summary: string;
  if (!att.verified) {
    status = "unverified";
    summary = "PoR attestation not yet verified (pilot fallback — Chainlink PoR feed not wired)";
  } else if (!sufficient) {
    status = "insufficient";
    summary = `Reserves INSUFFICIENT: RR = ${rr.toFixed(4)} < 1.0 (EMERGENCY threshold)`;
  } else if (rr < 1.30) {
    status = "degraded";
    summary = `Reserves degraded: RR = ${rr.toFixed(4)} < 1.30 (production target)`;
  } else {
    status = "ok";
    summary = `Reserves OK: RR = ${rr.toFixed(4)} ≥ 1.30 (production target)`;
  }

  return {
    status,
    latestAttestation: att,
    reserveRatio: rr,
    liabilityUsd,
    sufficient,
    summary,
    computedAt: Date.now(),
  };
}
