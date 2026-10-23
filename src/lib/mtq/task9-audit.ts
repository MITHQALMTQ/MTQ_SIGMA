// MTQΣ — Task 9: Authorization Audit evidence module (READ-ONLY audit, 2026-10-21).
// TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN.
// Source of truth: audit-work/v9-task9/TASK9-AUTHORIZATION-AUDIT.md + evidence/*.json.
// All facts below were produced by read-only RPC/explorer probes; nothing is claimed
// beyond the captured evidence. Unverifiable items are labeled UNVERIFIED.

export const TASK9_META = {
  title: "Authorization Audit",
  banner: "TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN",
  probedAt: "2026-10-21 21:36–22:30 UTC",
  monadBlock: "73,066,261",
  arcBlock: "68,414,779",
  evidencePath: "audit-work/v9-task9/",
  methods: "read-only eth_call / eth_getCode / eth_getStorageAt / eth_getLogs / eth_getBalance / eth_getTransactionReceipt + Solana getAccountInfo family + Blockscout public API",
  transactionCount: 0,
  recommendation: "NOT ACCEPTED",
  recommendationNote:
    "Evidence-based. Software status is reported separately from release status below; no software result advances a release gate. Conditional-acceptance path: R-01 key purge/rotation → R-02 Safe 4/7 → R-03 canonical declaration → R-04 custody transfer → size remediation + source publication → full §23 program + independent reviews → committee gate run. Every step is an on-chain change that requires an approved transaction plan; none was executed under §1.",
} as const;

// ---------- G.1 inventory ----------
export interface InventoryRow {
  chain: "Monad Testnet (10143)" | "Arc Testnet (5042002)" | "Solana Devnet";
  name: string;
  address: string;
  size: string;
  keccak: string;
  deploy: string;
  creator: string;
  verdict: "VERIFIED" | "UNVERIFIED" | "ANOMALY";
  note?: string;
}

export const TASK9_INVENTORY: InventoryRow[] = [
  { chain: "Monad Testnet (10143)", name: "MTQ.sol", address: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", size: "6,681 B", keccak: "0x9057c3e6…55bbb", deploy: "UNVERIFIED — deployed before the RPC state horizon (~63.47M); explorer bot-gated", creator: "UNVERIFIED (inferred deployer)", verdict: "UNVERIFIED", note: "MITHQAL / MTQ · 310.949 supply · not paused" },
  { chain: "Monad Testnet (10143)", name: "Governance.sol", address: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66", size: "25,819 B ⚠", keccak: "0xb0624cbd…6057a", deploy: "UNVERIFIED (same horizon)", creator: "UNVERIFIED", verdict: "ANOMALY", note: "EXCEEDS standard EIP-170 (24,576 B) — non-portable; DIFFERENT code from Arc at the same address; no AccessControl/Ownable surface" },
  { chain: "Monad Testnet (10143)", name: "Safe.sol", address: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0", size: "171 B (SafeProxy v1.4.1)", keccak: "0xd7d408eb…331fb4c — byte-identical to Arc", deploy: "UNVERIFIED", creator: "UNVERIFIED", verdict: "VERIFIED", note: "singleton 0x29fcB43b…C762 · 1/1 deployer · nonce 0 · no modules · no guard" },
  { chain: "Monad Testnet (10143)", name: "Algorithm.sol", address: "0x8839ce50e8D414005518769999c0A5b961D00CB2", size: "2,546 B", keccak: "0x20c147d7…320a", deploy: "UNVERIFIED", creator: "UNVERIFIED", verdict: "VERIFIED", note: "deployer = DEFAULT_ADMIN; no MINTER/PAUSER holders found" },
  { chain: "Monad Testnet (10143)", name: "Reserve.sol", address: "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177", size: "5,703 B", keccak: "0x04a7116d…4290", deploy: "UNVERIFIED", creator: "UNVERIFIED", verdict: "VERIFIED", note: "same hex recorded as Robinhood Takaful (contamination register preserved)" },
  { chain: "Monad Testnet (10143)", name: "Mint.sol", address: "0x197e9CB28216dfe18a199b4c2930F74C2F460809", size: "5,644 B", keccak: "0x2373495e…a9fb", deploy: "UNVERIFIED", creator: "UNVERIFIED", verdict: "VERIFIED", note: "CORRECTED 2026-10-22 (Task 10): HOLDS MINTER_ROLE on MTQ.sol — raw Task 9 evidence 2026-10-21 21:37:26Z returned TRUE (0x…01); the Task 9 report's 'not wired' claim was a report error. Re-verified TRUE 2026-10-22 06:07Z" },
  { chain: "Monad Testnet (10143)", name: "Redeem.sol", address: "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4", size: "6,170 B", keccak: "0x8e8538e5…017c", deploy: "UNVERIFIED", creator: "UNVERIFIED", verdict: "ANOMALY", note: "CORRECTED 2026-10-22 (Task 10): holds MINTER_ROLE on MTQ.sol (Monad only — Arc Redeem does not) — a redemption contract with token-mint authority is a design anomaly preserved for review" },
  { chain: "Monad Testnet (10143)", name: "Oracle.sol", address: "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713", size: "5,273 B", keccak: "0xf057e6e5…d2e7", deploy: "UNVERIFIED", creator: "UNVERIFIED", verdict: "UNVERIFIED", note: "ABI unpublished — feed contents UNVERIFIED (OD-34 OPEN); same hex hosts a 3,321 B non-Safe on Arc (C-042-1)" },
  { chain: "Monad Testnet (10143)", name: "Takaful.sol", address: "0x3eC27BB283644eF0A98B9961E9FBED0583a02f19", size: "6,043 B", keccak: "0xb28868f6…8e0", deploy: "UNVERIFIED", creator: "UNVERIFIED", verdict: "VERIFIED" },
  { chain: "Arc Testnet (5042002)", name: "MTQ.sol", address: "0x237c3Aa2B79248f86f6523D3890095BCd1996601", size: "3,474 B", keccak: "0x0183b25e…12fcf", deploy: "55,772,115 — 2026-08-07 12:03:14Z", creator: "deployer EOA (tx 0x3d17fd1a…ca16e)", verdict: "VERIFIED", note: "MITHQAL / MTQ · 1,000 supply · genesis balances set in constructor with ZERO Transfer events (non-standard genesis)" },
  { chain: "Arc Testnet (5042002)", name: "Governance.sol", address: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66", size: "13,129 B", keccak: "0x214a785c…4b82", deploy: "55,772,118 — 2026-08-07 12:03:16Z", creator: "deployer EOA (tx 0xe1da6f28…1a65)", verdict: "ANOMALY", note: "DIFFERENT implementation from Monad's at the same address — two contracts, one address-book row" },
  { chain: "Arc Testnet (5042002)", name: "Safe.sol", address: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0", size: "171 B (SafeProxy v1.4.1)", keccak: "0xd7d408eb…331fb4c — byte-identical to Monad", deploy: "55,875,156 — 2026-08-08 02:46:26Z", creator: "deployer EOA via SafeProxyFactory (tx 0x2ac55b3f…9436)", verdict: "VERIFIED", note: "1/1 deployer · nonce 0 · no modules (sentinel-paged) · no guard" },
  { chain: "Arc Testnet (5042002)", name: "Algorithm.sol", address: "0x62f8E5243f32eE5C87a14A7896C61104aD9e7727", size: "1,237 B", keccak: "0x0c0cd82d…31a5", deploy: "55,772,122 — 2026-08-07 12:03:18Z", creator: "deployer EOA (tx 0x4cf76018…ca6b)", verdict: "VERIFIED" },
  { chain: "Arc Testnet (5042002)", name: "Reserve.sol", address: "0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471", size: "2,897 B", keccak: "0x79e16139…d748", deploy: "55,774,558 — 2026-08-07 12:24:41Z", creator: "deployer EOA (tx 0x55cf7212…aaf9)", verdict: "VERIFIED" },
  { chain: "Arc Testnet (5042002)", name: "Mint.sol", address: "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa", size: "2,847 B", keccak: "0xe6346a6f…ced0", deploy: "55,775,391 — 2026-08-07 12:32:10Z", creator: "deployer EOA (tx 0xd656de83…d496)", verdict: "VERIFIED", note: "CORRECTED 2026-10-22 (Task 10): HOLDS MINTER_ROLE on MTQ.sol (Task 9 raw evidence + Task 10 re-probe TRUE) — the 'not wired' claim in the Task 9 report was a report error" },
  { chain: "Arc Testnet (5042002)", name: "Redeem.sol", address: "0xcAde4594177829597882555Ff57d0e34092daF8e", size: "3,037 B", keccak: "0x410c8d36…", deploy: "55,775,393 — 2026-08-07 12:32:11Z", creator: "deployer EOA (tx 0xe515b1ca…a298)", verdict: "VERIFIED" },
  { chain: "Arc Testnet (5042002)", name: "Oracle.sol", address: "0xFd2B8d176bf059287638Db30D02C6651dA02861e", size: "2,601 B", keccak: "0x0c14190d…deb6", deploy: "55,775,396 — 2026-08-07 12:32:13Z", creator: "deployer EOA (tx 0xb916460b…8a69)", verdict: "UNVERIFIED", note: "ABI unpublished — feeds UNVERIFIED; same hex recorded as Robinhood MockUSDC (C-042-4)" },
  { chain: "Arc Testnet (5042002)", name: "Takaful.sol", address: "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0", size: "3,033 B", keccak: "0xde0ba8da…", deploy: "55,775,399 — 2026-08-07 12:32:15Z", creator: "deployer EOA (tx 0xe1c81114…5b78)", verdict: "VERIFIED" },
  { chain: "Solana Devnet", name: "MTQ SPL Mint", address: "GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4", size: "Token program account", keccak: "—", deploy: "UNVERIFIED", creator: "mintAuthority = DbFjzW…QhXb3 (owner wallet, SET)", verdict: "ANOMALY", note: "decimals 18 (SPL anomaly) · supply field at u64 CEILING (2⁶⁴−1 raw) · no freeze authority · wallet holds 1 token account" },
];

// ---------- owner reference check ----------
export const TASK9_OWNER_REFERENCE = [
  { role: "DEFAULT_ADMIN_ROLE", hash: "0x0000…0000", monad: "TRUE", arc: "TRUE" },
  { role: "MINTER_ROLE", hash: "0x9f2df0…566a6", monad: "TRUE", arc: "TRUE" },
  { role: "PAUSER_ROLE", hash: "0x65d7a2…0d862a", monad: "TRUE", arc: "TRUE" },
] as const;

// ---------- G.2 authority matrix + graph ----------
export const TASK9_ROLE_FINDINGS = [
  { finding: "Owner reference (admin/minter/pauser × deployer on MTQ.sol)", detail: "TRUE ×3 on BOTH chains (individual eth_call; role hashes exactly the owner's reference). paused() = false both chains.", verdict: "CONFIRMED" },
  { finding: "Deployer DEFAULT_ADMIN on all 7 AccessControl contracts", detail: "MTQ, Algorithm, Reserve, Mint, Redeem, Oracle, Takaful — TRUE on both chains (14/14 probes).", verdict: "CONFIRMED" },
  { finding: "Role-admin wiring", detail: "getRoleAdmin(admin|minter|pauser) = DEFAULT_ADMIN_ROLE on every AC contract → the deployer can grant/revoke every role everywhere.", verdict: "SINGLE-KEY" },
  { finding: "AccessControlEnumerable", detail: "getRoleMemberCount reverts on all AC contracts → plain AccessControl; membership not on-chain enumerable.", verdict: "ABSENT" },
  { finding: "Governance.sol & Safe.sol hasRole", detail: "EVM revert on both chains for all roles/accounts; owner()/paused() also revert. Reproducibility re-checked ×2 rounds/chain — consistent. No AccessControl surface at all.", verdict: "REVERT*" },
  { finding: "Cross-chain Safe role asymmetry", detail: "Safe holds ADMIN+MINTER+PAUSER on Monad MTQ.sol but only PAUSER on Arc MTQ.sol (prior finding — re-confirmed by this session's matrix).", verdict: "ANOMALY" },
  { finding: "Architecture wiring — CORRECTED 2026-10-22", detail: "Mint.sol HOLDS MINTER_ROLE on the MTQ token on BOTH chains (raw Task 9 evidence + Task 10 re-probe both TRUE); Monad Redeem.sol also holds it (anomaly); Reserve.sol does not. The deployed Mint module CAN mint the deployed token — the Task 9 'NOT WIRED' verdict was a report error vs its own inventory; governance of minting remains single-key.", verdict: "PARTIALLY WIRED (report error corrected)" },
  { finding: "Proxies / upgradeability", detail: "No EIP-1967 slots set anywhere; only SafeProxy present (slot 0 = singleton). Fixes require NEW deployments — no in-place upgrade path.", verdict: "NO PROXIES" },
] as const;

export const TASK9_AUTHORITY_GRAPH = [
  { action: "Mint MTQ", enforcedBy: "MTQ.sol MINTER_ROLE", today: "Deployer EOA; Safe (Monad only); Mint.sol module (BOTH chains — MINTER_ROLE held, mint(address,uint256) selector present); Redeem.sol (Monad only — anomaly)", mandated: "Mint.sol via Safe-governed process — module wiring EXISTS, governance does not (single-key admin) — CORRECTED 2026-10-22", ok: false },
  { action: "Pause / unpause", enforcedBy: "MTQ.sol PAUSER_ROLE", today: "Deployer EOA; Safe (Monad: admin ⇒ can grant; Arc: pauser)", mandated: "Emergency committee — single-key reality", ok: false },
  { action: "Grant / revoke any role", enforcedBy: "DEFAULT_ADMIN (admin of all roles)", today: "Deployer EOA unilaterally, all 7 AC contracts, both chains", mandated: "4/7 Safe / committee — ABSENT", ok: false },
  { action: "Move Safe-held assets", enforcedBy: "Safe threshold", today: "1 signature (deployer EOA)", mandated: "4/7 — DISPROVED (OD-35, re-proven)", ok: false },
  { action: "Reconfigure Safe", enforcedBy: "Safe owner-management", today: "Deployer EOA (sole owner both chains)", mandated: "Constituted committee (OD-3)", ok: false },
  { action: "Solana mint", enforcedBy: "SPL mintAuthority", today: "Owner wallet DbFjzW…QhXb3 (single key)", mandated: "Multi-sig equivalent — ABSENT", ok: false },
  { action: "Oracle / Reserve internals", enforcedBy: "unknown — ABI unpublished", today: "UNESTABLISHABLE (sources unverified on explorers)", mandated: "§13/§17 module governance", ok: false },
  { action: "Upgrade contracts", enforcedBy: "n/a — no proxies", today: "Impossible in place; new deployments only", mandated: "V3 deploy plan (pending)", ok: true },
  { action: "Genesis supply custody", enforcedBy: "constructor + transfers", today: "Deployer EOA holds 99.9% on both chains; Safe holds 0; Safe nonce = 0", mandated: "1M to Genesis Reserve Safe — DISPROVED (C-043)", ok: false },
] as const;

// ---------- G.3 Safe dossier ----------
export const TASK9_SAFE_DOSSIER = [
  { probe: "getThreshold()", monad: "1", arc: "1", verdict: "CRITICAL", note: "mandated 4/7 — OD-35 preserved" },
  { probe: "getOwners()", monad: "[0x3C39…d8c8]", arc: "[0x3C39…d8c8]", verdict: "CRITICAL", note: "sole owner = deployer EOA" },
  { probe: "VERSION()", monad: "1.4.1", arc: "1.4.1", verdict: "VERIFIED", note: "genuine Gnosis SafeProxy" },
  { probe: "nonce()", monad: "0", arc: "0", verdict: "CRITICAL", note: "never executed anything, ever" },
  { probe: "getModulesPaginated(sentinel)", monad: "[] 0 modules", arc: "[] 0 modules", verdict: "VERIFIED", note: "prior GS105 was a paging-start artifact — resolved" },
  { probe: "guard slot keccak(\"guard_manager.guard.address\")", monad: "address(0)", arc: "address(0)", verdict: "VERIFIED", note: "no guard configured" },
  { probe: "Runtime code", monad: "171 B", arc: "171 B — byte-identical", verdict: "VERIFIED", note: "same proxy artifact deployed on both chains (separate instances)" },
  { probe: "Held assets (MTQ / native)", monad: "0 / 0", arc: "0 / 0", verdict: "CRITICAL", note: "zero custody on both chains" },
] as const;

// ---------- G.3b custody reconciliation ----------
export const TASK9_CUSTODY = [
  { chain: "Monad", supply: "310.949 MTQ", holders: "Deployer EOA 309.949 + dead address 0x…dEaD 1.000000000000000003", closes: true, note: "reconciles EXACTLY; the 3-wei dust question (D-6 #20) is located: a test burn" },
  { chain: "Arc", supply: "1,000 MTQ", holders: "Deployer EOA 999 + dead address 0x…dEaD 1.000000000000000003 (2-holder census, explorer-indexed)", closes: true, note: "single historical transfer: burn tx block 60,796,421 (2026-09-06 19:44:01Z); genesis balances were constructor-set with ZERO Transfer events" },
  { chain: "Both", supply: "—", holders: "Safe: 0 on both chains", closes: true, note: "C-043 preserved: mandated genesis-to-Safe custody DISPROVED for the live deployments" },
  { chain: "Both", supply: "—", holders: "Reserve funding: absent at current addresses", closes: true, note: "Arc native USDC: deployer 19.03, contracts 0; the 1.1M USDC mandate belongs to superseded generation-A addresses" },
] as const;

// ---------- G.4 duplicates ----------
export const TASK9_DUPLICATES = [
  { chain: "Monad", label: "current (MITHQAL)", address: "0x9e6E…53aD", status: "live · 6,681 B · 310.949 supply · owner-declared canonical" },
  { chain: "Monad", label: "gen-A (manifest 2026-09-06)", address: "0x5D95…fd4a", status: "live · 11,666 B · recorded creation tx — separate generation, not the registry token" },
  { chain: "Monad", label: "gen-B (OD-35-era, superseded)", address: "0x0Ac2…5982f", status: "live · 3,413 B · cross-chain-identical twin of Arc gen-B" },
  { chain: "Arc", label: "current (MITHQAL)", address: "0x237c…6601", status: "live · 3,474 B · 1,000 supply · deployed 2026-08-07 — the OLDEST of three Arc generations" },
  { chain: "Arc", label: "gen-A (manifest 2026-09-05)", address: "0x826b…63c1", status: "live · deployed 60,619,345 (recovered) — separate generation" },
  { chain: "Arc", label: "gen-B (OD-35-era, superseded)", address: "0x2420…d9897", status: "live · deployed 60,768,469 (recovered) · cross-chain-identical twin" },
] as const;

// ---------- G.5 requirement register (explicitly addressed) ----------
export interface ReqStatus { req: string; where: string; status: "IMPLEMENTED" | "PARTIAL" | "BLOCKED (missing spec/data)" | "AWAITING APPROVAL" | "FAILED" | "NOT PERFORMED" | "ABSENT" | "UNESTABLISHABLE" | "OPEN"; note: string }

export const TASK9_REQUIREMENTS: ReqStatus[] = [
  { req: "GPP CPI-basket feed (§6.8)", where: "mase.ts proxy + UI formula", status: "BLOCKED (missing spec/data)", note: "no GlobalCPI/Food/Energy/TradeGoods feed exists in the pilot; proxy labeled RG-07 everywhere; never claimed exact" },
  { req: "Executable E_j definition (§14.3)", where: "registry.ts all-eight-criteria", status: "BLOCKED (missing spec/data)", note: "v2.0 publishes no executable form; pass/fail standard operative; no numeric score invented" },
  { req: "κ / β / crisis coefficients (§10.5/§10.6/§11.6/§14.5)", where: "marp.ts mechanisms", status: "BLOCKED (missing spec/data)", note: "mechanisms live (κ scaffold κ=0, state-dependent β with β_min, crisis set); spec publishes no operative values — none invented" },
  { req: "Oracle feed identity (§17)", where: "Oracle.sol 5,273 B / 2,601 B", status: "UNESTABLISHABLE", note: "ABI unpublished; sources unverified on explorers; feeds UNVERIFIED (OD-34 OPEN); app shows MOCKED, disclosed" },
  { req: "Independent quantitative validation (§23 program)", where: "/api/validation S1–S11", status: "NOT PERFORMED", note: "walk-forward not executed; synthetic-data backtest only; 7 of 9 gold scenarios + coverage items disclosed as FAIL/pending — never greenwashed" },
  { req: "Contract-size remediation (EIP-170)", where: "V2/V3 sources", status: "OPEN", note: "V2 30,608 B / V3 38,921 B exceed 24,576 B; live Monad Governance 25,819 B is non-portable; D-4 options unexecuted (R-06)" },
  { req: "External reviews (security / Sharia / legal)", where: "—", status: "ABSENT", note: "none exists; no independent audit, Sharia approval, legal opinion, committee approval, custody remediation or production readiness is claimed anywhere" },
  { req: "Listing 15 on-chain honest-status contract (§25.7/App D.5)", where: "V2/V3 sources", status: "AWAITING APPROVAL", note: "neither source implements validationGates[11]; undeployable under §1; TS mirror carries the canonical status string and says so" },
  { req: "Canonical-token declaration (C-041)", where: "governance", status: "AWAITING APPROVAL", note: "3 live generations per chain; name conflict MITHQAL vs MTQΣ; decision reserved for constituted governance" },
];

export const TASK9_APP_LAYER_COUNTS = [
  { layer: "Blueprint v2.0 app-layer requirements (46-item audit)", counts: "14 CONFORMANT · 24 PARTIAL · 7 MISSING · 1 deliberate-N/A" },
  { layer: "Execution layer (ch10–16, 75 requirements, file:line)", counts: "P0s implemented & verified live; P1/P2s disclosed in worklog Task 7-b" },
  { layer: "Quant §5/§6 (Task 8-a)", counts: "exact forms implemented; data-window + stand-in disclosures live" },
  { layer: "T-01..T-88 mandate tests", counts: "88/88 reconciled with accepted-risk documentation (v5 register)" },
  { layer: "Automation gates (this cycle)", counts: "tsc 0 · eslint 0 · canonical-invariants 0 failures · GET / 200" },
] as const;

// ---------- G.6 reproducibility ----------
export const TASK9_REPRODUCIBILITY = [
  { item: "Scripts", detail: "bun audit-work/v9-task9/full-audit.ts {monad|arc|solana|local|duplicates-*} · deploy-recovery.ts · scan-resume.ts — every raw request/response in evidence/raw.jsonl (7,100+ entries, timestamped, retries recorded)" },
  { item: "Cross-validation", detail: "Arc deploy blocks recovered twice independently (RPC binary search ≡ Blockscout creation receipts, 9/9); supplies reconcile exactly on both chains; Safe probes reproduce OD-35 evidence" },
  { item: "Error classification", detail: "6,215 × Monad getLogs 100-block cap (infrastructure limit) · 224 × expected EVM reverts · 9 × pruned-state errors · 13 × rate-limit events (retried) · 2 × GS105 paging artifact (resolved via sentinel)" },
  { item: "Honest limits", detail: "Monad deploy records UNVERIFIED (pruned state + Cloudflare-gated explorer) · Monad full Transfer history infeasible on the public RPC (~730k calls) — sampled, disclosed · Arc census explorer-indexed + balanceOf cross-checked · no deployed source published for function-level verification (owner action required)" },
] as const;

// ---------- G.7 remediation ----------
export interface RemediationRow { id: string; item: string; priority: "P0" | "P1" | "P1/P2" | "P2"; depends: string; acceptance: string; onChain: boolean }

export const TASK9_REMEDIATION: RemediationRow[] = [
  { id: "R-01", item: "Purge committed private-key literal (scripts/verify-key-and-audit-roles.ts:5 — CONFIRMED STILL PRESENT at HEAD this session; presence recorded, never exposed) + rotate the deployer key", priority: "P0", depends: "none", acceptance: "secret-scan clean; new address recorded; rotation plan receipts", onChain: true },
  { id: "R-02", item: "Reconfigure the Genesis Safe(s) to genuine 4/7 (identical 171B proxy on both chains, separate instances)", priority: "P0", depends: "R-01", acceptance: "threshold=4, owners=7, re-probe VERIFIED", onChain: true },
  { id: "R-03", item: "Formal canonical-token declaration (C-041) incl. MITHQAL-vs-MTQΣ name conflict + 3-generation register", priority: "P0", depends: "R-01", acceptance: "signed decision recorded; address book single-sourced", onChain: false },
  { id: "R-04", item: "Genesis custody transfer/jettison per approved plan (supplies sit in deployer EOA; Safe holds 0; nonce 0)", priority: "P0", depends: "R-01–R-03", acceptance: "executed tx refs; custody probes re-run positive", onChain: true },
  { id: "R-06", item: "Contract-size remediation (V2/V3 over EIP-170; live Monad Governance 25,819 B non-portable)", priority: "P1", depends: "R-03", acceptance: "reproducible ≤24,576 B build + green Foundry run", onChain: false },
  { id: "N-01", item: "Publish & verify deployed-contract sources on both explorers (function-level verification is UNESTABLISHABLE today)", priority: "P1", depends: "none", acceptance: "explorer verified flags; privileged-function audit re-run", onChain: false },
  { id: "N-02", item: "CORRECTED 2026-10-22: Mint.sol already holds MINTER_ROLE on both MTQ tokens (wiring EXISTS); remaining gap is GOVERNANCE wiring — minting is still reachable by the single-key deployer/Safe; plus review the Monad Redeem.sol mint authority (anomaly)", priority: "P1", depends: "R-02/R-03", acceptance: "governance plan per approved transaction plan; Redeem anomaly dispositioned", onChain: true },
  { id: "N-03", item: "Fix address-book contamination (false Safe rows, chain-mis-associated rotation doc, dead RPC rows)", priority: "P1", depends: "R-03", acceptance: "R-15 diff merged", onChain: false },
  { id: "N-04", item: "Standardize genesis event semantics for any redeployed token (current genesis emits NO Transfer events)", priority: "P2", depends: "R-06", acceptance: "canonical genesis events on a future deployment", onChain: false },
  { id: "R-09+", item: "Shadow acceptance, full §23 program, remote/CI, docs hygiene — unchanged from D-5 register", priority: "P1/P2", depends: "per D-5", acceptance: "per D-5", onChain: false },
];

// ---------- G.8 / F: release-gate separation ----------
export interface ReleaseGate { n: number; name: string; status: string; statusKind: "ok" | "warn" | "fail" | "neutral"; evidence: string }

export const TASK9_RELEASE_GATES: ReleaseGate[] = [
  { n: 1, name: "Build & automated tests", status: "PARTIAL (software only)", statusKind: "warn", evidence: "tsc 0 · eslint 0 · canonical-invariants suite green · §23 stress items remain FAIL/pending as disclosed — software result, carries NO release authority" },
  { n: 2, name: "Contract & architecture verification", status: "FAIL", statusKind: "fail", evidence: "single-key control on both chains + Solana; TWO exposed key literals confirmed in repo/git (Task 10 C-045: EVM deployer key + Solana 4saT key — both live-privileged); Safes 1/1 deployer; genesis custody in deployer EOA; Mint-module wiring EXISTS but governance does not (corrected 2026-10-22); sources unpublished; Governance bytecodes differ per chain; Monad Governance oversized; non-event genesis; 3 live token generations" },
  { n: 3, name: "Economic & quantitative validation", status: "NOT PERFORMED", statusKind: "fail", evidence: "walk-forward not executed; 30-day coverage absent; oracle feeds unverified; synthetic data only — disclosed live in the Validation section" },
  { n: 4, name: "Governance approval", status: "NOT GRANTED", statusKind: "fail", evidence: "committee not constituted (OD-3); OD-1/OD-2 economic eligibility decisions OPEN" },
  { n: 5, name: "Independent security / legal / Sharia review", status: "ABSENT", statusKind: "fail", evidence: "no independent review exists; none is claimed" },
  { n: 6, name: "Live-pilot authorization", status: "NOT AUTHORIZED", statusKind: "fail", evidence: "economic eligibility disabled; shadow mode enforced at every execution boundary; keeper inert — correct posture until gates 2–5 pass" },
  { n: 7, name: "Production authorization", status: "NOT AUTHORIZED", statusKind: "fail", evidence: "G0–G7 all not-passed per mandate register; production claims forbidden by §25.1 posture, enforced app-wide" },
];
