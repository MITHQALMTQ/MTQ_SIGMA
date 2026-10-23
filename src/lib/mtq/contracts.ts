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
    { name: "Reserve Vault", symbol: "Reserve.sol", address: "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177", note: "code verified present 2026-10-19 (5,703 bytes); same hex also recorded as Robinhood Takaful (different chain)" },
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
    { name: "Oracle", symbol: "Oracle.sol", address: "0xFd2B8d176bf059287638Db30D02C6651dA02861e", note: "code verified present 2026-10-19 (2,601 bytes); ABI unpublished — feed contents unverified; Arc USDC/USD = 1.0 by construction (native gas, Ext-3 A.4); same hex recorded as Robinhood MockUSDC (different chain)" },
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


// Robinhood Chain Testnet — Chain ID 46630 (deployed 2026-09-05)
export const ROBINHOOD_TESTNET: ChainInfo = {
  id: "robinhood",
  chainId: 46630,
  label: "Robinhood Chain Testnet",
  network: "Robinhood Chain Testnet",
  rpcUrl: "https://rpc.testnet.chain.robinhood.com/rpc",
  explorer: "https://explorer.testnet.chain.robinhood.com",
  explorerAddrBase: "https://explorer.testnet.chain.robinhood.com/address/",
  explorerTxBase: "https://explorer.testnet.chain.robinhood.com/tx/",
  nativeCurrency: "ETH",
  wallet: DEPLOYER_WALLET,
  isEvm: true,
  contracts: [
    { name: "MTQΣ Token (AccessControl + Pausable)", symbol: "MTQToken.sol", address: "0xAF5B85658d074e071BbF392395a2ddA9B644C5A5", canonical: true, note: "name()='MTQΣ' • symbol='MTQ' • decimals=18 • ADMIN+MINTER+PAUSER on deployer • not paused • genesis 1,000,000 MTQ" },
    { name: "Governance", symbol: "Governance.sol", address: "0x80FF03DAD374E1f2f5C110F355B7a448Aa732B56" },
    { name: "Safe (Multi-Sig, 4/7)", symbol: "Safe.sol", address: "0xa3CE28A10854B375272D528EeC4295D6bcd75691" },
    { name: "Algorithm Engine", symbol: "AlgorithmEngine.sol", address: "0x8C012fC945a2EEa9Fd25aCC8aCeadF180BDc9244" },
    { name: "Reserve Vault", symbol: "ReserveVault.sol", address: "0x5929cBEb7d308b974B9F3Ff5272fD27813967d6e" },
    { name: "Mint", symbol: "MintContract.sol", address: "0xeF3290d060249D05685617F8954F2B64d7A6D084", note: "Holds MINTER_ROLE on MTQ • funded 1,100,000 USDC" },
    { name: "Redeem", symbol: "RedeemContract.sol", address: "0x3aCE703dc20c95381D425fceBbAC3AFA0B8Dac44" },
    { name: "Oracle", symbol: "Oracle.sol", address: "0x02D9531A3ce1f47B38E4EA00b84a62d5C4fB6A9F" },
    { name: "Takaful", symbol: "Takaful.sol", address: "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177" },
    { name: "MockUSDC (pilot collateral)", symbol: "MockUSDC.sol", address: "0xFd2B8d176bf059287638Db30D02C6651dA02861e" },
  ],
};

// === Base (Coinbase L2) — Chain ID 8453 (mainnet) ===
export const BASE_MAINNET: ChainInfo = {
  id: "base", chainId: 8453, label: "Base (Coinbase L2)", network: "Base",
  rpcUrl: "https://mainnet.base.org", explorer: "https://basescan.org",
  explorerAddrBase: "https://basescan.org/address/", explorerTxBase: "https://basescan.org/tx/",
  nativeCurrency: "ETH", wallet: DEPLOYER_WALLET, isEvm: true,
  contracts: [{ name: "MTQΣ Token (pending deploy)", symbol: "MTQSigmaV2.sol", address: "0x0000000000000000000000000000000000000000", note: "Deploy V3 on Base per competitive analysis R3." }],
};

// === Arbitrum One — Chain ID 42161 (mainnet) ===
export const ARBITRUM_ONE: ChainInfo = {
  id: "arbitrum", chainId: 42161, label: "Arbitrum One", network: "Arbitrum One",
  rpcUrl: "https://arb1.arbitrum.io/rpc", explorer: "https://arbiscan.io",
  explorerAddrBase: "https://arbiscan.io/address/", explorerTxBase: "https://arbiscan.io/tx/",
  nativeCurrency: "ETH", wallet: DEPLOYER_WALLET, isEvm: true,
  contracts: [{ name: "MTQΣ Token (pending deploy)", symbol: "MTQSigmaV2.sol", address: "0x0000000000000000000000000000000000000000", note: "Deploy V3 on Arbitrum per competitive analysis R3." }],
};

export const ALL_CHAINS: ChainInfo[] = [MONAD_TESTNET, ARC_TESTNET, ROBINHOOD_TESTNET, SOLANA_DEVNET, BASE_MAINNET, ARBITRUM_ONE];

// === MTQΣ V2 — v1.0 Master Blueprint on-chain implementation ===
// Source: contracts/MTQSigmaV2.sol (~1057 lines, Solidity ^0.8.20, compiles clean
// with solcjs 0.8.36 + optimizer runs=200 → 22,627 bytes, deployable on Mainnet).
// Honest status mask: 0x7FF (all 11 v1.0 bits set — see getHonestStatus() in the contract).
// STATUS: SOURCE_READY_PENDING_DEPLOY — the protocol owner needs to run
// scripts/deploy.ts with the new source path + optimizer enabled. Sandbox cannot deploy.
export const MTQSIGMA_V2: {
  status: "SOURCE_READY_PENDING_DEPLOY";
  contract: "MTQSigmaV2";
  sourceFile: string;
  chainId: number;
  honestStatusMask: string;
  expectedAddress: null;
  deployTx: null;
  deployedAt: null;
  features: string[];
} = {
  status: "SOURCE_READY_PENDING_DEPLOY",
  contract: "MTQSigmaV2",
  sourceFile: "contracts/MTQSigmaV2.sol",
  chainId: 5042002,
  honestStatusMask: "0x7FF",
  expectedAddress: null,
  deployTx: null,
  deployedAt: null,
  features: [
    "§2  7-component Strategic Prior (USD/EUR/JPY/GBP/CNY/CHF/Gold) — Gold + CHF first-class",
    "§3  Chain-linked GFB_BASE_DENOMINATOR (immutable, computed once)",
    "§3  Reference Value + safety band 0.50-2.00 + circulating supply + liability",
    "§5  Asset Admission Registry adapter interface",
    "§8.1 On-chain MASE weight registry (target/smoothed/execution [7])",
    "§8.1 Per-component admissibility envelopes (enforced on commit — reverts on breach)",
    "§9  Multi-source oracle adapter (Chainlink/Pyth/Chronicle) with §9.2 validation + §9.3 consensus",
    "§10 MARP keeper-executed rebalancing (RebalanceTrade[] with direction lock + turnover cap)",
    "§12 Mint/Redeem priced against GFB (§3.4.2 canonical), status-throttled",
    "§14.1 Risk state machine (5 states) — KEEPER_ROLE hook",
    "§14.2 DAO/multi-sig governance with 48h timelock (queueChange/executeChange/cancelChange)",
    "§25 getHonestStatus() returns (0x7FF, 1, 1, 'v1.0 Master Blueprint on-chain...')",
  ],
};

export function getChain(id: string): ChainInfo | undefined {
  return ALL_CHAINS.find((c) => c.id === id);
}

export function buildExplorerAddressUrl(chain: ChainInfo, address: string): string {
  if (chain.explorerAddrBase) return chain.explorerAddrBase + address;
  return chain.explorer;
}

// === SOURCE OF TRUTH: canonical MTQΣ token address per chain ===
// UPDATED this session per the protocol owner's authoritative "WHAT YOU HAVE
// NOW" deployment summary (verbatim, all three networks):
//   Monad Testnet 10143  MTQ.sol 0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD
//   Arc Testnet 5042002   MTQ.sol 0x237c3Aa2B79248f86f6523D3890095BCd1996601
//   Solana devnet        Mint    GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4 (MTQ, 18 decimals)
//   Deployer wallet 0x3C3932F865892EFabE45892f453f81B64f6c8d8c (Monad + Arc)
//   Solana wallet   DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3
// These now match the per-chain contract arrays above (MTQ Token rows).
//
// SUPERSEDED (evidence preserved — do not delete): the previous canonical
// generation (monad 0x0Ac20360…A5982f, arc 0x24203404…d9897, solana
// 2EaK5cQt…f3gY) was live-verified read-only during the OD-35 cycle (see
// worklog + audit-work/v5). It no longer matches the owner's current
// deployment summary and is retained here for provenance only.
export const CANONICAL_MTQ_ADDRESSES: Record<string, { chain: string; chainId: number | string; address: string; name: string; symbol: string; decimals: number; explorer: string; note?: string }> = {
  monad:     { chain: "Monad Testnet",            chainId: 10143,   address: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", name: "MITHQAL", symbol: "MTQ", decimals: 18, explorer: "https://testnet.monadscan.com/address/0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", note: "name()/symbol()/totalSupply() verified read-only this session — on-chain name is MITHQAL (310.949 MTQ supply)" },
  arc:       { chain: "Arc Testnet",              chainId: 5042002, address: "0x237c3Aa2B79248f86f6523D3890095BCd1996601", name: "MITHQAL", symbol: "MTQ", decimals: 18, explorer: "https://testnet.arcscan.app/address/0x237c3Aa2B79248f86f6523D3890095BCd1996601", note: "name()/symbol()/totalSupply() verified read-only this session — on-chain name is MITHQAL (1,000 MTQ supply)" },
  robinhood: { chain: "Robinhood Chain Testnet",  chainId: 46630,   address: "0xAF5B85658d074e071BbF392395a2ddA9B644C5A5", name: "MTQΣ", symbol: "MTQ", decimals: 18, explorer: "https://explorer.testnet.chain.robinhood.com/address/0xAF5B85658d074e071BbF392395a2ddA9B644C5A5", note: "not in the owner's current summary; prior OD-35-era verified generation retained" },
  solana:    { chain: "Solana Devnet",            chainId: "devnet", address: "GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4", name: "MTQ (SPL)", symbol: "MTQ", decimals: 18, explorer: "https://explorer.solana.com/address/GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4", note: "SPL mint verified live this session (decimals 18, authority DbFjzW…); owner-specified endpoint: tokens.solana.com; SPL name lives off-chain — not claimed" },
};

// Superseded canonical generation (OD-35-era live reads) — provenance only.
export const SUPERSEDED_CANONICAL_MTQ = {
  monad:  "0x0Ac20360234b4C988a19586CBe55733e18A5982f",
  arc:    "0x24203404B9b971C907e8Ced96106Fa74380d9897",
  solana: "2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY",
} as const;


