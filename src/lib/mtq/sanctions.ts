// MTQΣ — Wallet Sanctions Screening (B10 scaffold)
//
// Per MAINNET-AUDIT-REPORT B10: every mainnet mint/redeem from a sanctioned
// jurisdiction is a felony (US IEEPA, EU Council Regulation, UK SAMLA).
// This module provides wallet-level screening against OFAC SDN, EU
// Consolidated, UN Security Council, and HMT lists.
//
// STATUS: SCAFFOLD — production deployment requires integration with
// TRM Labs or Chainalysis KYT (paid services, ~$2K-$10K/month).
//
// INTEGRATION PLAN:
//   1. Sign up for TRM Labs (https://trmlabs.com) or Chainalysis KYT
//   2. Get API key → add to .env.local as TRM_API_KEY or CHAINALYSIS_API_KEY
//   3. Call screenWallet() before every mint/redeem in the API routes
//   4. Block (HTTP 403) if the wallet is on any sanctions list
//   5. Log all screening results for compliance audit trail
//   6. Re-screen periodically (wallets can be added to lists retroactively)
//
// FREE ALTERNATIVE for testnet: the US Treasury OFAC SDN list is publicly
// downloadable as a text file. A basic wallet-address screening against
// the SDN list is implemented below as a fallback.

export interface SanctionsScreeningResult {
  wallet: string;
  isSanctioned: boolean;
  source: string;
  checkedAt: string;
  matchedLists: string[];
  riskScore: number; // 0-100, 0 = clean, 100 = sanctioned
  rawResponse?: unknown;
}

// OFAC SDN list download URL (free, public, updated daily)
const OFAC_SDN_URL = "https://www.treasury.gov/ofac/downloads/sdn.csv";

// In-memory cache of sanctioned addresses (refreshed daily)
let sanctionedAddressesCache: Set<string> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Load the OFAC SDN list into an in-memory cache.
 * The SDN list is a large CSV; we extract only the cryptocurrency addresses
 * (columns with digital currency addresses).
 * For production, use TRM Labs or Chainalysis KYT instead.
 */
async function loadOfacSdnCache(): Promise<Set<string>> {
  if (sanctionedAddressesCache && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return sanctionedAddressesCache;
  }
  try {
    const res = await fetch(OFAC_SDN_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`OFAC SDN HTTP ${res.status}`);
    const text = await res.text();
    const addresses = new Set<string>();
    // SDN CSV: each row has columns, digital currency addresses are in
    // column 12+ (varies). We scan for 0x-prefixed and base58 addresses.
    for (const line of text.split("\n")) {
      // Match EVM addresses (0x + 40 hex chars)
      const evmMatch = line.match(/0x[a-fA-F0-9]{40}/g);
      if (evmMatch) {
        for (const addr of evmMatch) {
          addresses.add(addr.toLowerCase());
        }
      }
      // Match base58 addresses (Bitcoin/TRON/etc — roughly 30-44 chars)
      // This is a heuristic — for production use a proper screening service
      const b58Match = line.match(/\b[1-9A-HJ-NP-Za-km-z]{30,44}\b/g);
      if (b58Match) {
        for (const addr of b58Match) {
          addresses.add(addr);
        }
      }
    }
    sanctionedAddressesCache = addresses;
    cacheLoadedAt = Date.now();
    console.log(`[sanctions] OFAC SDN cache loaded: ${addresses.size} addresses`);
    return addresses;
  } catch (e) {
    console.error("[sanctions] Failed to load OFAC SDN cache:", e);
    // Fail open for testnet (DO NOT fail open for mainnet — fail closed)
    return new Set();
  }
}

/**
 * Screen a wallet address against sanctions lists.
 *
 * PRODUCTION: replace this with a TRM Labs or Chainalysis KYT API call.
 * The free OFAC SDN list check below is a testnet-grade fallback only.
 *
 * @param wallet - The wallet address to screen (EVM 0x... or Solana base58)
 * @returns SanctionsScreeningResult
 */
export async function screenWallet(wallet: string): Promise<SanctionsScreeningResult> {
  const checkedAt = new Date().toISOString();
  const normalizedWallet = wallet.toLowerCase().trim();

  // PRODUCTION PATH: use TRM Labs if API key is set
  const trmKey = process.env.TRM_API_KEY;
  if (trmKey) {
    // TODO: implement TRM Labs API call
    // POST https://api.trmlabs.com/public/v1/supported-chains/...
    // For now, fall through to OFAC fallback
  }

  // PRODUCTION PATH: use Chainalysis KYT if API key is set
  const chainalysisKey = process.env.CHAINALYSIS_API_KEY;
  if (chainalysisKey) {
    // TODO: implement Chainalysis KYT API call
    // GET https://public.chainalysis.com/api/kyt/v1/users/{address}/summary
    // For now, fall through to OFAC fallback
  }

  // FALLBACK: free OFAC SDN list check (testnet only)
  const sanctioned = await loadOfacSdnCache();
  const isSanctioned = sanctioned.has(normalizedWallet);

  return {
    wallet,
    isSanctioned,
    source: isSanctioned
      ? "OFAC SDN list (free fallback — use TRM Labs/Chainalysis for mainnet)"
      : "OFAC SDN list (free fallback) — clear",
    checkedAt,
    matchedLists: isSanctioned ? ["OFAC SDN"] : [],
    riskScore: isSanctioned ? 100 : 0,
  };
}

/**
 * Middleware-style guard: blocks the request if the wallet is sanctioned.
 * Use in API routes before processing mint/redeem.
 *
 * @param wallet - The wallet address to screen
 * @returns null if clean, or an error response object if sanctioned
 */
export async function sanctionsGuard(
  wallet: string | undefined,
): Promise<{ blocked: true; reason: string; result: SanctionsScreeningResult } | { blocked: false }> {
  if (!wallet || wallet.trim() === "") {
    // No wallet provided — allow for read-only operations
    return { blocked: false };
  }

  const result = await screenWallet(wallet);
  if (result.isSanctioned) {
    return {
      blocked: true,
      reason: `Wallet ${wallet} is on the ${result.matchedLists.join(", ")} sanctions list. Transaction blocked.`,
      result,
    };
  }
  return { blocked: false };
}
