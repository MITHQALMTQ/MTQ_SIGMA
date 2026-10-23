// ============================================================================
//  MTQΣ V3 — Bank Registry (Blueprint v25.3 §6)
//  ----------------------------------------------------------------------------
//  Off-chain canonical record of authorized mint banks. This is the
//  TypeScript mirror of the on-chain `bankRegistry` mapping in
//  MTQSigmaV3.sol. It is used by:
//    • the MBG Gateway (`/api/mbg/mint-request`) to authenticate inbound mint
//      requests and check the per-bank daily mint cap BEFORE the request hits
//      the chain (fail-fast);
//    • the dashboard / status page to render the authorized-bank list;
//    • the policy engine (`finality.ts`) L3 layer to assert bank eligibility.
//
//  On-chain authorization is the source of truth — this off-chain registry is
//  a convenience cache. The MBG Gateway MUST always re-verify with the chain
//  (or with a signed Constitutional-Council authorization proof) before
//  translating a request into an on-chain `requestMint` call.
//
//  Pilot banks below are placeholders. Production banks must be authorized by
//  the 7/7 Constitutional Council multi-sig via `authorizeBank(...)` on
//  MTQSigmaV3.sol.
// ============================================================================

export interface Bank {
  /** EVM address (EIP-55 checksummed). */
  address: string;
  /** Human-readable bank name (e.g. "Pilot Bank A"). */
  name: string;
  /** ISO 3166-1 alpha-2 jurisdiction code (e.g. "US", "AE", "SA"). */
  jurisdiction: string;
  /** Whether the bank is currently authorized to call `requestMint`. */
  isAuthorized: boolean;
  /** Per-day mint cap in USD (1 USD = 1, no decimals here — matches the
   *  on-chain 1e18 scale after multiplication). */
  dailyMintCap: number;
  /** Per-day mint used in USD (resets UTC midnight). */
  dailyMintUsed: number;
  /** Unix epoch (ms) when the bank was authorized. */
  authorizedAt: number;
  /** Optional HMAC API key used by the MBG Gateway to authenticate the bank's
   *  HTTP requests. NEVER log or render this to the client. */
  apiKeyHash?: string;
}

// ----------------------------------------------------------------------------
// §6.2 Testnet pilot banks
// ----------------------------------------------------------------------------
//
//  These are placeholder addresses for the testnet pilot — they will be
//  replaced with real bank addresses once the 7/7 Constitutional Council
//  authorizes each bank on-chain via `MTQSigmaV3.authorizeBank(...)`.
//
//  The default address `0x71C7656EC7ab88b098defB751B7401B5f6d8976F` is the
//  well-known Hardhat/Foundry default account #1 (used in many tutorials).
//  It is NOT a real bank — it's a deterministic dev key safe to publish.
// ----------------------------------------------------------------------------

export const PILOT_BANK_A_ADDRESS = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";

export const BANK_REGISTRY: Bank[] = [
  {
    address: PILOT_BANK_A_ADDRESS,
    name: "Pilot Bank A",
    jurisdiction: "US",
    isAuthorized: true,
    dailyMintCap: 1_000_000,
    dailyMintUsed: 0,
    authorizedAt: Date.now(),
  },
  // Add additional pilot banks here as they're authorized on-chain.
];

// ----------------------------------------------------------------------------
// §6.3 Lookup helpers
// ----------------------------------------------------------------------------

/** Returns true iff `address` corresponds to an authorized bank. */
export function isAuthorizedBank(address: string): boolean {
  const bank = getBank(address);
  return !!bank && bank.isAuthorized;
}

/** Returns the Bank record for `address`, or `undefined` if not registered. */
export function getBank(address: string): Bank | undefined {
  if (!address) return undefined;
  const lower = address.toLowerCase();
  return BANK_REGISTRY.find((b) => b.address.toLowerCase() === lower);
}

/** Returns all authorized banks (snapshot copy). */
export function getAuthorizedBanks(): Bank[] {
  return BANK_REGISTRY.filter((b) => b.isAuthorized).map((b) => ({ ...b }));
}

/**
 * Returns the per-bank daily mint cap remaining in USD. Resets are computed
 * against UTC midnight (matches the on-chain `_rollDailyCap` logic).
 */
export function getDailyMintRemaining(address: string): number {
  const bank = getBank(address);
  if (!bank || !bank.isAuthorized) return 0;
  return Math.max(0, bank.dailyMintCap - bank.dailyMintUsed);
}

/** Register or update a bank (admin only — used by the dashboard's bank-admin
 *  UI; in production this is also persisted to Turso). */
export function upsertBank(bank: Bank): Bank {
  const idx = BANK_REGISTRY.findIndex(
    (b) => b.address.toLowerCase() === bank.address.toLowerCase(),
  );
  if (idx >= 0) {
    BANK_REGISTRY[idx] = { ...bank };
    return BANK_REGISTRY[idx];
  }
  BANK_REGISTRY.push(bank);
  return bank;
}

/** Mark a bank as revoked (soft delete — keeps the historical record). */
export function revokeBank(address: string): boolean {
  const bank = getBank(address);
  if (!bank) return false;
  bank.isAuthorized = false;
  return true;
}
