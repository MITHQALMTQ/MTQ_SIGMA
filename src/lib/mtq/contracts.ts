// MTQΣ — Deployed Contract Registry
// Deployed by 0x3C3932F865892EFabE45892f453f81B64f6c8d8c
// These are real testnet deployments provided by the protocol owner.
// Verified verbatim from the user's deployment summary.

export interface ContractEntry {
  name: string;
  symbol: string;
  address: string;
  explorer?: string;
  note?: string;
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
export const MONAD_TESTNET: ChainInfo = {
  id: "monad",
  chainId: 10143,
  label: "Monad Testnet",
  network: "Monad Testnet",
  rpcUrl: "https://testnet-rpc.monadvision.com",
  explorer: "https://testnet.monadexplorer.com",
  explorerAddrBase: "https://testnet.monadexplorer.com/address/",
  explorerTxBase: "https://testnet.monadexplorer.com/tx/",
  nativeCurrency: "MON",
  wallet: DEPLOYER_WALLET,
  isEvm: true,
  contracts: [
    { name: "MTQ Token", symbol: "MTQ.sol", address: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD" },
    { name: "Governance", symbol: "Governance.sol", address: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66" },
    { name: "Safe (Multi-Sig)", symbol: "Safe.sol", address: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0" },
    { name: "Algorithm Engine", symbol: "Algorithm.sol", address: "0x8839ce50e8D414005518769999c0A5b961D00CB2" },
    { name: "Reserve Vault", symbol: "Reserve.sol", address: "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177" },
    { name: "Mint", symbol: "Mint.sol", address: "0x197e9CB28216dfe18a199b4c2930F74C2F460809" },
    { name: "Redeem", symbol: "Redeem.sol", address: "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4" },
    { name: "Oracle", symbol: "Oracle.sol", address: "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713" },
    { name: "Takaful", symbol: "Takaful.sol", address: "0x3eC27BB283644eF0A98B9961E9FBED0583a02f19" },
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
    { name: "MTQ Token", symbol: "MTQ.sol", address: "0x237c3Aa2B79248f86f6523D3890095BCd1996601" },
    { name: "Governance", symbol: "Governance.sol", address: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66" },
    { name: "Safe (Multi-Sig)", symbol: "Safe.sol", address: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0" },
    { name: "Algorithm Engine", symbol: "Algorithm.sol", address: "0x62f8E5243f32eE5C87a14A7896C61104aD9e7727" },
    { name: "Reserve Vault", symbol: "Reserve.sol", address: "0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471" },
    { name: "Mint", symbol: "Mint.sol", address: "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa" },
    { name: "Redeem", symbol: "Redeem.sol", address: "0xcAde4594177829597882555Ff57d0e34092daF8e" },
    { name: "Oracle", symbol: "Oracle.sol", address: "0xFd2B8d176bf059287638Db30D02C6651dA02861e" },
    { name: "Takaful", symbol: "Takaful.sol", address: "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0" },
  ],
};

// Solana devnet
export const SOLANA_DEVNET: ChainInfo = {
  id: "solana",
  chainId: "devnet",
  label: "Solana Devnet",
  network: "Solana Devnet",
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
      note: "Decimals: 18 • Token testing balance: ~18.44 (10 billion cap)",
    },
  ],
};

// Arc Testnet — Pilot v2 (freshly deployed from this build, 2026-09-05)
// Faithful minimal-but-complete on-chain implementation of the blueprint:
//   §2 GFB Index, §3 MTQ price + safety band + circulating supply,
//   §12 Mint/Redeem priced against GFB (§3.4.2 canonical), §14.1 risk state,
//   §13.1 Genesis event, §3.6 PriceUpdated events.
// Deployed via scripts/deploy.ts (solc 0.8.36 + ethers v6). Live mint+redeem verified.
export const ARC_PILOT_V2: ChainInfo = {
  id: "arc-pilot-v2",
  chainId: 5042002,
  label: "Arc Testnet — Pilot v2 (Fresh Deploy)",
  network: "Arc Testnet",
  rpcUrl: "https://rpc.testnet.arc.io",
  explorer: "https://testnet.arcscan.app",
  explorerAddrBase: "https://testnet.arcscan.app/address/",
  explorerTxBase: "https://testnet.arcscan.app/tx/",
  nativeCurrency: "USDC (18 decimals)",
  wallet: DEPLOYER_WALLET,
  isEvm: true,
  contracts: [
    { name: "MTQΣ Token (Pilot v2)", symbol: "MTQSigma.sol", address: "0x826b82F79FD6c5347cDC568B1d0A7918128B63c1", note: "Fresh deploy 2026-09-05. GFB-index pricing, §3.4.2 canonical redeem. Live mint+redeem verified." },
    { name: "MockUSDC (Pilot collateral)", symbol: "MockUSDC.sol", address: "0x334D14E7E39e1f02a60fc1169CdF7b0BEDE30dEb", note: "Pilot collateral token (6 dec, free-mint). Genesis reserve funded with 1,100,000 USDC." },
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
export const ALL_CHAINS: ChainInfo[] = [MONAD_TESTNET, ARC_TESTNET, ROBINHOOD_TESTNET, SOLANA_DEVNET];

export function getChain(id: string): ChainInfo | undefined {
  return ALL_CHAINS.find((c) => c.id === id);
}

export function buildExplorerAddressUrl(chain: ChainInfo, address: string): string {
  if (chain.explorerAddrBase) return chain.explorerAddrBase + address;
  return chain.explorer;
}

// === SOURCE OF TRUTH: canonical MTQΣ token address per chain ===
export const CANONICAL_MTQ_ADDRESSES: Record<string, { chain: string; chainId: number | string; address: string; name: string; symbol: string; decimals: number; explorer: string }> = {
  monad:     { chain: "Monad Testnet",            chainId: 10143,   address: "0x0Ac20360234b4C988a19586CBe55733e18A5982f", name: "MTQΣ", symbol: "MTQ", decimals: 18, explorer: "https://testnet.monadscan.com/address/0x0Ac20360234b4C988a19586CBe55733e18A5982f" },
  arc:       { chain: "Arc Testnet",              chainId: 5042002, address: "0x24203404B9b971C907e8Ced96106Fa74380d9897", name: "MTQΣ", symbol: "MTQ", decimals: 18, explorer: "https://testnet.arcscan.app/address/0x24203404B9b971C907e8Ced96106Fa74380d9897" },
  robinhood: { chain: "Robinhood Chain Testnet",  chainId: 46630,   address: "0xAF5B85658d074e071BbF392395a2ddA9B644C5A5", name: "MTQΣ", symbol: "MTQ", decimals: 18, explorer: "https://explorer.testnet.chain.robinhood.com/address/0xAF5B85658d074e071BbF392395a2ddA9B644C5A5" },
  solana:    { chain: "Solana Devnet",            chainId: "devnet", address: "2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY", name: "MTQΣ", symbol: "MTQ", decimals: 18, explorer: "https://explorer.solana.com/address/2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY" },
};


