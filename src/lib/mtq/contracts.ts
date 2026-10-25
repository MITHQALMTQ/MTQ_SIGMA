// MTQΣ — Deployed Contract Registry
// Deployed by 0x3C3932F865892EFabE45892f453f81B64f6c8d8c
// These are real testnet deployments provided by the protocol owner
// (authoritative "WHAT YOU HAVE NOW" summary, restated this session).
// Re-verified READ-ONLY from this sandbox this session (eth_getCode /
// eth_call / getAccountInfo — no transactions, no state changes):
// all 9 Monad contracts, all 9 Arc contracts code-present; MTQ token
// name()="MITHQAL", symbol()="MTQ" on both chains; Solana mint live,
// decimals 18, mintAuthority = owner wallet DbFjzW…QhXb3.
// Evidence: audit-work/v8-cinematic/what-you-have-now-probe.json
//
// REGISTRY CLEANUP (2026-10-24, owner directive "check all contracts…
// delete what is not used, keep what is being used"): this registry now
// contains EXACTLY the owner's current deployment set — Monad Testnet (10143,
// 9 contracts) + Arc Testnet (5042002, 9 contracts) + Solana devnet (1 SPL
// mint). REMOVED per that directive: the Robinhood Chain Testnet (46630)
// suite, the Base/Arbitrum pending-deploy placeholders, the superseded
// canonical generation map, and the MTQSigmaV2 status blob (the upgrade path
// remains documented in UPGRADEABILITY.md + the retained
// contracts/deployments/MTQSigmaV2-PENDING.json). Historical evidence about
// the removed rows is preserved in the audit registers (task9-audit.ts,
// task10-containment.ts, mandate-register.ts, evidence_package.ts),
// audit-work/, and git history — this is an owner-authorized registry
// disposition, not a falsification of the recorded findings.

export interface ContractEntry {
  name: string;
  symbol: string;
  address: string;
  explorer?: string;
  note?: string;
  canonical?: boolean;
}

export interface ChainInfo {
  id: string; // slug
  chainId: number | string;
  label: string;
  network: string;
  rpcUrl: string;
  explorer: string;
  explorerTxBase?: string;
  explorerAddrBase?: string;
  nativeCurrency: string;
  wallet: string; // deployer wallet
  isEvm: boolean;
  contracts: ContractEntry[];
}

export const DEPLOYER_WALLET = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";

// Monad Testnet — Chain ID 10143
// RPC corrected 2026-10-19 (OD-35 tooling): the previously recorded
// https://testnet-rpc.monadvision.com is DEAD; the official RPC below matches
// contracts/deployments/Monad-Testnet.json and was used for the live
// OD-35 verification reads (block 72,421,819).
export const MONAD_TESTNET: ChainInfo = {
  id: "monad",
  chainId: 10143,
  label: "Monad Testnet",
  network: "Monad Testnet",
  rpcUrl: "https://testnet-rpc.monad.xyz",
  explorer: "https://testnet.monadscan.com",
  explorerAddrBase: "https://testnet.monadscan.com/address/",
  explorerTxBase: "https://testnet.monadscan.com/tx/",
  nativeCurrency: "MON",
  wallet: DEPLOYER_WALLET,
  isEvm: true,
  contracts: [
    { name: "MTQ Token", symbol: "MTQ.sol", address: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", note: "LIVE read this session: name()='MITHQAL', symbol()='MTQ', totalSupply=310.949 MTQ, code 6,681 B" },
    { name: "Governance", symbol: "Governance.sol", address: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66", note: "code verified present this session (25,819 B)" },
    { name: "Safe (Multi-Sig)", symbol: "Safe.sol", address: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0", note: "ON-CHAIN VERIFIED 2026-10-19 (OD-35): Safe v1.4.1 proxy, but threshold=1, sole owner = deployer EOA, nonce=0, no modules, no guard — 1/1 deployer-controlled, NOT the mandated 4/7. CRITICAL finding, Gate 5 blocked. Evidence: audit-work/v5/SAFE-VERIFICATION.md" },
    { name: "Algorithm Engine", symbol: "Algorithm.sol", address: "0x8839ce50e8D414005518769999c0A5b961D00CB2", note: "code verified present 2026-10-19 (2,546 bytes)" },
    { name: "Reserve Vault", symbol: "Reserve.sol", address: "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177", note: "code verified present 2026-10-19 (5,703 bytes); historical hex-collision with a superseded Robinhood-era record (C-042) — audit evidence retained in the registers" },
    { name: "Mint", symbol: "Mint.sol", address: "0x197e9CB28216dfe18a199b4c2930F74C2F460809", note: "code verified present 2026-10-19 (5,644 bytes)" },
    { name: "Redeem", symbol: "Redeem.sol", address: "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4", note: "code verified present 2026-10-19 (6,170 bytes)" },
    { name: "Oracle", symbol: "Oracle.sol", address: "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713", note: "code verified present 2026-10-19 (5,273 bytes); ABI unpublished — feed contents unverified; same hex recorded as Arc Ecosystem-JSON 'Safe' (NOT a Safe — 0/7 Safe reads succeed)" },
    { name: "Takaful", symbol: "Takaful.sol", address: "0x3eC27BB283644eF0A98B9961E9FBED0583a02f19", note: "code verified present this session (6,043 B)" },
  ],
};

// Arc Testnet — Chain ID 5042002
export const ARC_TESTNET: ChainInfo = {
  id: "arc",
  chainId: 5042002,
  label: "Arc Testnet",
  network: "Arc Testnet",
  rpcUrl: "https://rpc.testnet.arc.io",
  explorer: "https://testnet.arcscan.app",
  explorerAddrBase: "https://testnet.arcscan.app/address/",
  explorerTxBase: "https://testnet.arcscan.app/tx/",
  nativeCurrency: "USDC (18 decimals)",
  wallet: DEPLOYER_WALLET,
  isEvm: true,
  contracts: [
    { name: "MTQ Token", symbol: "MTQ.sol", address: "0x237c3Aa2B79248f86f6523D3890095BCd1996601", note: "LIVE read this session: name()='MITHQAL', symbol()='MTQ', totalSupply=1,000 MTQ, code 3,474 B" },
    { name: "Governance", symbol: "Governance.sol", address: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66", note: "code verified present this session (13,129 B)" },
    { name: "Safe (Multi-Sig)", symbol: "Safe.sol", address: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0", note: "ON-CHAIN VERIFIED 2026-10-19 (OD-35): identical to Monad — Safe v1.4.1 proxy, threshold=1, sole owner = deployer EOA, nonce=0, no modules, no guard — 1/1 deployer-controlled, NOT 4/7. CRITICAL finding, Gate 5 blocked. Evidence: audit-work/v5/SAFE-VERIFICATION.md" },
    { name: "Algorithm Engine", symbol: "Algorithm.sol", address: "0x62f8E5243f32eE5C87a14A7896C61104aD9e7727", note: "code verified present 2026-10-19 (1,237 bytes)" },
    { name: "Reserve Vault", symbol: "Reserve.sol", address: "0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471", note: "code verified present 2026-10-19 (2,897 bytes)" },
    { name: "Mint", symbol: "Mint.sol", address: "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa", note: "code verified present 2026-10-19 (2,847 bytes)" },
    { name: "Redeem", symbol: "Redeem.sol", address: "0xcAde4594177829597882555Ff57d0e34092daF8e", note: "code verified present 2026-10-19 (3,037 bytes)" },
    { name: "Oracle", symbol: "Oracle.sol", address: "0xFd2B8d176bf059287638Db30D02C6651dA02861e", note: "code verified present 2026-10-19 (2,601 bytes); ABI unpublished — feed contents unverified; Arc USDC/USD = 1.0 by construction (native gas, Ext-3 A.4); historical hex-collision with a superseded Robinhood-era MockUSDC record (C-042) — audit evidence retained" },
    { name: "Takaful", symbol: "Takaful.sol", address: "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0", note: "code verified present this session (3,033 B)" },
  ],
};

// Solana devnet
// Owner-specified endpoint label (verbatim from the "WHAT YOU HAVE NOW"
// deployment summary): "SOLANA devnet : tokens.solana.com". The operational
// RPC below (api.devnet.solana.com) is what the live read-only probe uses —
// both are surfaced per the display-as-provided rule.
export const SOLANA_DEVNET: ChainInfo = {
  id: "solana",
  chainId: "devnet",
  label: "Solana Devnet",
  network: "Solana Devnet · tokens.solana.com (owner-specified)",
  rpcUrl: "https://api.devnet.solana.com",
  explorer: "https://explorer.solana.com",
  explorerAddrBase: "https://explorer.solana.com/address/",
  explorerTxBase: "https://explorer.solana.com/tx/",
  nativeCurrency: "SOL",
  wallet: "DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3",
  isEvm: false,
  contracts: [
    {
      name: "MTQ SPL Token",
      symbol: "MTQ",
      address: "GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4",
      note: "Decimals: 18 • owner-specified devnet endpoint: tokens.solana.com (operational RPC for live reads: api.devnet.solana.com) • LIVE read this session: SPL mint initialized, mintAuthority = DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3 (owner wallet), supply ≈ 18.4467 MTQ • SPL token name is off-chain metadata — not claimed here",
    },
  ],
};


export const ALL_CHAINS: ChainInfo[] = [MONAD_TESTNET, ARC_TESTNET, SOLANA_DEVNET];
export function getChain(id: string): ChainInfo | undefined {
  return ALL_CHAINS.find((c) => c.id === id);
}

export function buildExplorerAddressUrl(chain: ChainInfo, address: string): string {
  if (chain.explorerAddrBase) return chain.explorerAddrBase + address;
  return chain.explorer;
}

// === SOURCE OF TRUTH: canonical MTQΣ token address per chain ===
// The protocol owner's authoritative "WHAT YOU HAVE NOW" deployment summary
// (verbatim, all three networks):
//   Monad Testnet 10143  MTQ.sol 0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD
//   Arc Testnet 5042002   MTQ.sol 0x237c3Aa2B79248f86f6523D3890095BCd1996601
//   Solana devnet        Mint    GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4 (MTQ, 18 decimals)
//   Deployer wallet 0x3C3932F865892EFabE45892f453f81B64f6c8d8c (Monad + Arc)
//   Solana wallet   DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3
// These now match the per-chain contract arrays above (MTQ Token rows).
//
// CLEANUP (2026-10-24, owner directive "delete what is not used"): the
// Robinhood Chain (46630) canonical entry and the prior OD-35-era superseded
// generation map (monad 0x0Ac20360…A5982f, arc 0x24203404…d9897, solana
// 2EaK5cQt…f3gY) were REMOVED from this registry per the owner's explicit
// instruction. Their live-read verification history remains in the worklog,
// audit-work/v5, and git history.
export const CANONICAL_MTQ_ADDRESSES: Record<string, { chain: string; chainId: number | string; address: string; name: string; symbol: string; decimals: number; explorer: string; note?: string }> = {
  monad:     { chain: "Monad Testnet",            chainId: 10143,   address: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", name: "MITHQAL", symbol: "MTQ", decimals: 18, explorer: "https://testnet.monadscan.com/address/0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", note: "name()/symbol()/totalSupply() verified read-only this session — on-chain name is MITHQAL (310.949 MTQ supply)" },
  arc:       { chain: "Arc Testnet",              chainId: 5042002, address: "0x237c3Aa2B79248f86f6523D3890095BCd1996601", name: "MITHQAL", symbol: "MTQ", decimals: 18, explorer: "https://testnet.arcscan.app/address/0x237c3Aa2B79248f86f6523D3890095BCd1996601", note: "name()/symbol()/totalSupply() verified read-only this session — on-chain name is MITHQAL (1,000 MTQ supply)" },
  solana:    { chain: "Solana Devnet",            chainId: "devnet", address: "GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4", name: "MTQ (SPL)", symbol: "MTQ", decimals: 18, explorer: "https://explorer.solana.com/address/GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4", note: "SPL mint verified live this session (decimals 18, authority DbFjzW…); owner-specified endpoint: tokens.solana.com; SPL name lives off-chain — not claimed" },
};


