// MTQΣ — AccessControl role registry (Task 8-e, owner directive 2026-10-21).
//
// The protocol owner's reference ("check for reference") pins THREE role hashes
// and ONE expected account. This module carries them verbatim, plus the
// authoritative READ-ONLY verification evidence captured this session
// (audit-work/v9-roles/role-matrix-authoritative.json — individual eth_call,
// no transactions, §1 VERIFICATION-ONLY).
//
// Honest-status rule: the evidence snapshot below is displayed as "last
// verified"; the /api/roles route re-verifies LIVE. A failed live check is
// never fabricated over — it degrades to this snapshot with an explicit
// UNVERIFIED-live marker.

export const DEPLOYER_WALLET = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
export const SAFE_ADDRESS = "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0";
export const GOVERNANCE_ADDRESS = "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66";

/** Owner-pinned role hashes (verbatim from the owner's reference table). */
export const MTQ_ROLE_HASHES = {
  DEFAULT_ADMIN_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000",
  MINTER_ROLE: "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
  PAUSER_ROLE: "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a",
} as const;

export type RoleKey = keyof typeof MTQ_ROLE_HASHES;
export const ROLE_KEYS: RoleKey[] = ["DEFAULT_ADMIN_ROLE", "MINTER_ROLE", "PAUSER_ROLE"];

/** Owner's expected-query set — "Click Query → Should return true" ×3. */
export const OWNER_ROLE_QUERIES: {
  label: string;
  role: RoleKey;
  roleHash: string;
  account: string;
  expected: true;
}[] = ROLE_KEYS.map((role) => ({
  label: `${role} — MTQ.sol, deployer account`,
  role,
  roleHash: MTQ_ROLE_HASHES[role],
  account: DEPLOYER_WALLET,
  expected: true,
}));

export type RoleVerdict = "true" | "false" | "REVERT" | "UNREACHABLE";

export interface RoleRowEvidence {
  contract: string;
  address: string;
  deployer: Record<RoleKey, RoleVerdict>;
  /** MTQ token only: Safe / Governance as candidate role holders */
  holders?: {
    safe: Partial<Record<RoleKey, RoleVerdict>>;
    governance: Partial<Record<RoleKey, RoleVerdict>>;
  };
  paused?: RoleVerdict;
}

export interface ChainRoleEvidence {
  id: "monad" | "arc";
  name: string;
  chainId: number;
  block: number;
  probedAt: string;
  rows: RoleRowEvidence[];
}

/** Authoritative snapshot — captured 2026-10-21, individual eth_call (READ-ONLY).
 *  Evidence: audit-work/v9-roles/role-matrix-authoritative.json + ROLE-VERIFICATION.md */
export const ROLE_EVIDENCE: ChainRoleEvidence[] = [
  {
    id: "monad",
    name: "Monad Testnet",
    chainId: 10143,
    block: 73037271,
    probedAt: "2026-10-21T19:11:26Z",
    rows: [
      {
        contract: "MTQ.sol",
        address: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD",
        deployer: { DEFAULT_ADMIN_ROLE: "true", MINTER_ROLE: "true", PAUSER_ROLE: "true" },
        holders: {
          safe: { DEFAULT_ADMIN_ROLE: "true", MINTER_ROLE: "true", PAUSER_ROLE: "true" },
          governance: { DEFAULT_ADMIN_ROLE: "false", MINTER_ROLE: "false", PAUSER_ROLE: "false" },
        },
        paused: "false",
      },
      {
        contract: "Governance.sol",
        address: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66",
        deployer: { DEFAULT_ADMIN_ROLE: "REVERT", MINTER_ROLE: "REVERT", PAUSER_ROLE: "REVERT" },
      },
      {
        contract: "Safe (Multi-Sig)",
        address: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0",
        deployer: { DEFAULT_ADMIN_ROLE: "REVERT", MINTER_ROLE: "REVERT", PAUSER_ROLE: "REVERT" },
      },
      {
        contract: "Algorithm.sol",
        address: "0x8839ce50e8D414005518769999c0A5b961D00CB2",
        deployer: { DEFAULT_ADMIN_ROLE: "true", MINTER_ROLE: "false", PAUSER_ROLE: "false" },
      },
      {
        contract: "Reserve.sol",
        address: "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177",
        deployer: { DEFAULT_ADMIN_ROLE: "true", MINTER_ROLE: "true", PAUSER_ROLE: "false" },
      },
      {
        contract: "Mint.sol",
        address: "0x197e9CB28216dfe18a199b4c2930F74C2F460809",
        deployer: { DEFAULT_ADMIN_ROLE: "true", MINTER_ROLE: "true", PAUSER_ROLE: "false" },
      },
      {
        contract: "Redeem.sol",
        address: "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4",
        deployer: { DEFAULT_ADMIN_ROLE: "true", MINTER_ROLE: "false", PAUSER_ROLE: "false" },
      },
      {
        contract: "Oracle.sol",
        address: "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713",
        deployer: { DEFAULT_ADMIN_ROLE: "true", MINTER_ROLE: "false", PAUSER_ROLE: "false" },
      },
      {
        contract: "Takaful.sol",
        address: "0x3eC27BB283644eF0A98B9961E9FBED0583a02f19",
        deployer: { DEFAULT_ADMIN_ROLE: "true", MINTER_ROLE: "false", PAUSER_ROLE: "false" },
      },
    ],
  },
  {
    id: "arc",
    name: "Arc Testnet",
    chainId: 5042002,
    block: 68397451,
    probedAt: "2026-10-21T19:11:33Z",
    rows: [
      {
        contract: "MTQ.sol",
        address: "0x237c3Aa2B79248f86f6523D3890095BCd1996601",
        deployer: { DEFAULT_ADMIN_ROLE: "true", MINTER_ROLE: "true", PAUSER_ROLE: "true" },
        holders: {
          safe: { DEFAULT_ADMIN_ROLE: "false", MINTER_ROLE: "false", PAUSER_ROLE: "true" },
          governance: { DEFAULT_ADMIN_ROLE: "false", MINTER_ROLE: "false", PAUSER_ROLE: "false" },
        },
        paused: "false",
      },
      {
        contract: "Governance.sol",
        address: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66",
        deployer: { DEFAULT_ADMIN_ROLE: "REVERT", MINTER_ROLE: "REVERT", PAUSER_ROLE: "REVERT" },
      },
      {
        contract: "Safe (Multi-Sig)",
        address: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0",
        deployer: { DEFAULT_ADMIN_ROLE: "REVERT", MINTER_ROLE: "REVERT", PAUSER_ROLE: "REVERT" },
      },
      {
        contract: "Algorithm.sol",
        address: "0x62f8E5243f32eE5C87a14A7896C61104aD9e7727",
        deployer: { DEFAULT_ADMIN_ROLE: "true", MINTER_ROLE: "false", PAUSER_ROLE: "false" },
      },
      {
        contract: "Reserve.sol",
        address: "0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471",
        deployer: { DEFAULT_ADMIN_ROLE: "true", MINTER_ROLE: "false", PAUSER_ROLE: "false" },
      },
      {
        contract: "Mint.sol",
        address: "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa",
        deployer: { DEFAULT_ADMIN_ROLE: "true", MINTER_ROLE: "true", PAUSER_ROLE: "false" },
      },
      {
        contract: "Redeem.sol",
        address: "0xcAde4594177829597882555Ff57d0e34092daF8e",
        deployer: { DEFAULT_ADMIN_ROLE: "true", MINTER_ROLE: "false", PAUSER_ROLE: "false" },
      },
      {
        contract: "Oracle.sol",
        address: "0xFd2B8d176bf059287638Db30D02C6651dA02861e",
        deployer: { DEFAULT_ADMIN_ROLE: "true", MINTER_ROLE: "false", PAUSER_ROLE: "false" },
      },
      {
        contract: "Takaful.sol",
        address: "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0",
        deployer: { DEFAULT_ADMIN_ROLE: "true", MINTER_ROLE: "false", PAUSER_ROLE: "false" },
      },
    ],
  },
];

/** Honest findings preserved verbatim — never silently "fixed". */
export const ROLE_FINDINGS: { level: "verified" | "anomaly" | "critical-note"; text: string }[] = [
  {
    level: "verified",
    text: "Owner reference CONFIRMED on both chains: MTQ.sol hasRole(DEFAULT_ADMIN_ROLE / MINTER_ROLE / PAUSER_ROLE, 0x3C3932F8…c8d8c) returns TRUE live (Monad block 73,037,271 · Arc block 68,397,451). Neither MTQ token is paused (paused() = false).",
  },
  {
    level: "anomaly",
    text: "REVERT anomaly preserved: Governance.sol and the Safe proxy do not expose OpenZeppelin hasRole — every role query reverts on both chains (they are not AccessControl contracts; verified stable across batch + individual + live probes). Two earlier Monad 'REVERT' readings (Oracle ADMIN, Redeem PAUSER) were corrected after direct re-verification: they were transient RPC errors misclassified as reverts — Oracle ADMIN = TRUE, Redeem PAUSER = false (correction appended to ROLE-VERIFICATION.md; raw probe files preserved as-is).",
  },
  {
    level: "critical-note",
    text: "Genesis Safe holds ADMIN + MINTER + PAUSER on the Monad MTQ token but only PAUSER on the Arc MTQ token (cross-chain asymmetry). Per the OD-35 on-chain verification (audit-work/v5/SAFE-VERIFICATION.md), that Safe is 1/1 deployer-controlled (threshold=1, sole owner = deployer EOA), NOT the mandated 4/7 — so effective control of all three roles currently rests with a single key.",
  },
  {
    level: "verified",
    text: "Deployer holds DEFAULT_ADMIN_ROLE on every contract on both chains (all 7 AccessControl contracts per chain: MTQ, Algorithm, Reserve, Mint, Redeem, Oracle, Takaful — all live-verified TRUE), and MINTER_ROLE on MTQ + Mint.sol (both chains) + Reserve.sol (Monad only).",
  },
];

/** Owner-provided operations reference (verbatim intent, shell-formatted).
 *  SHADOW MODE: this app NEVER executes any of these — display only. */
export const OWNER_CAST_REFERENCE: { op: string; command: string; note?: string }[] = [
  { op: "View Contract", command: "https://testnet.monadscan.com/address/0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", note: "Explorer link (Monad MTQ.sol)" },
  { op: "Check Role", command: 'cast call --rpc-url $RPC $CONTRACT "hasRole(bytes32,address)(bool)" $ROLE $ACCOUNT', note: "Read-only view call — the ONLY one this app also performs" },
  { op: "Check Balance", command: 'cast call --rpc-url $RPC $CONTRACT "balanceOf(address)(uint256)" $ADDRESS', note: "Read-only view call" },
  { op: "Mint MTQ", command: 'cast send --rpc-url $RPC --private-key $PK $CONTRACT "mint(address,uint256)" $TO $AMOUNT', note: "STATE-CHANGING — owner-operated only" },
  { op: "Transfer Tokens", command: 'cast send --rpc-url $RPC --private-key $PK $CONTRACT "transfer(address,uint256)" $TO $AMOUNT', note: "STATE-CHANGING — owner-operated only" },
  { op: "Pause Contract", command: 'cast send --rpc-url $RPC --private-key $PK $CONTRACT "pause()"', note: "STATE-CHANGING — owner-operated only" },
  { op: "Unpause Contract", command: 'cast send --rpc-url $RPC --private-key $PK $CONTRACT "unpause()"', note: "STATE-CHANGING — owner-operated only" },
];
