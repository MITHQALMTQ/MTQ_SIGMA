// MTQΣ — Task 10: Critical-Finding Containment evidence module (READ-ONLY, 2026-10-22).
// TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN.
// Source of truth: audit-work/task10/ (D1–D8 deliverables + evidence/*.json).
// ALL facts below come from read-only probes + offline forensics. ZERO transactions
// were sent; NO key material is reproduced here (redacted fingerprints only).
// No gate advanced; overall status: NOT ACCEPTED.

export const TASK10_META = {
  title: "Critical-Finding Containment",
  banner: "TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN",
  probedAt: "2026-10-22 05:48–06:45 UTC",
  monadBlock: "73,167,496",
  arcBlock: "68,475,006",
  robinhoodBlock: "140,564,404 (RPC ALIVE — R-15 'dead RPC' claim corrected)",
  evidencePath: "audit-work/task10/",
  methods: "offline key forensics (derived-address verification, repo+git census) + read-only eth_call/eth_getCode/eth_getStorageAt + Solana getAccountInfo/getTokenSupply/getTokenAccountsByOwner/getSignaturesForAddress/getTransaction + 4byte.directory selector lookup",
  transactionCount: 0,
  overall: "NOT ACCEPTED",
} as const;

// ---------- D1: key-exposure incident (redacted) ----------
export interface ExposedKeyRow {
  id: string;
  kind: string;
  fingerprint: string; // first-6…last-4 + length only — NEVER the literal
  derivesTo: string;
  controls: string;
  copies: string;
  window: string;
  status: string;
}

export const TASK10_KEY_INCIDENT: ExposedKeyRow[] = [
  {
    id: "C-045-a",
    kind: "EVM secp256k1 private key (0x + 64 hex)",
    fingerprint: "0xdbe1…62d6 (66 chars)",
    derivesTo: "0x3C3932F865892EFabE45892f453f81B64f6c8d8c — verified by local derivation, NOT by trusting the host script's own comment",
    controls: "DEFAULT_ADMIN + MINTER + PAUSER on both MTQ tokens; DEFAULT_ADMIN on all 7 AccessControl modules on BOTH chains; sole owner+signer of BOTH Genesis Safes (1/1, nonce 0); ~100% of both chains' token supply (309.949 Monad + 999 Arc); native balances; deployed the entire Arc estate (creation txs 2026-08-07)",
    copies: "scripts/verify-key-and-audit-roles.ts:5 · worklog.md:4648 (a prior audit agent quoted it) · ALL 24 git commits (from baseline fb6bb6c 2026-10-19) · formerly upload/private_key.txt (now ABSENT on disk; never git-tracked)",
    window: "in active use since ≥ 2026-08-07 (Arc deployment session); literal written to repo scripts ~2026-10-18 09:33Z (file mtimes); in git since 2026-10-19 00:09Z",
    status: "REAL — live-privileged. TREAT AS COMPROMISED (posture), pending owner-approved rotation",
  },
  {
    id: "C-045-b",
    kind: "Solana ed25519 secret key (64-byte hex = seed‖pubkey, well-formed)",
    fingerprint: "58c19e…eb60 (128 hex chars)",
    derivesTo: "4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d (verified: seed-derivation matches embedded pubkey)",
    controls: "mint authority AND freeze authority of the superseded-but-live SPL mint 2EaK5c…RLSf3gY (can mint unlimited old-generation tokens and freeze its accounts); holds that mint's ENTIRE supply (4.477988020393345024); holds 4.983686 SOL (drainable with this key). Does NOT control the current mint GAGRdrY6 (authority DbFjz…QhXb3, whose key was NOT found in the repo)",
    copies: "scripts/verify-hex-key.ts:5 · solana-create-fresh.ts:12 · solana-create-umi.ts:8 · solana-create-with-metadata.ts:11 · solana-set-metadata.ts:7 · solana-set-metadata-v2.ts:21 · ALL 24 git commits",
    window: "wallet active 2026-09-06 16:15–17:22Z (branding txs); literals in git since 2026-10-19",
    status: "REAL — live-privileged (old-generation mint + funded wallet). TREAT AS COMPROMISED (posture), pending owner-approved rotation",
  },
];

export const TASK10_KEY_CENSUS = [
  { surface: "Working tree (2,412 files scanned, binaries included via byte-scan)", result: "2 EVM-literal copies (script + worklog:4648) · 6 Solana-literal files — NO other key material (no base58 secrets, no keypair JSON arrays, .env holds only DATABASE_URL)" },
  { surface: "Git history (all 24 commits × both literals)", result: "BOTH literals present in EVERY commit since the 2026-10-19 baseline squash — history rewrite required for purge (PLAN ONLY, owner approval required)" },
  { surface: "db/custom.db + dev.log (byte-level exact-literal scan)", result: "NO hits — keys never leaked into app database or dev server logs" },
  { surface: ".env / .env.example", result: "no key values (DATABASE_URL file path only; example holds dummies)" },
  { surface: "upload/private_key.txt", result: "ABSENT from disk now; NEVER git-tracked (.gitignore:56) — deletion time UNVERIFIED" },
  { surface: "DbFjz…QhXb3 key (current Solana mint authority)", result: "NOT found in repo census — set-solana-multisig.mjs expects it via env var on the owner's machine (census is a repo conclusion, stated with its method)" },
  { surface: "Pre-baseline exposure", result: "UNVERIFIABLE — git history begins 2026-10-19 (squashed); key was already in active use in Aug–Sep 2026" },
];

// ---------- corrections register (evidence-preserving) ----------
export const TASK10_CORRECTIONS = [
  {
    id: "CORR-1",
    prior: "Task 9 G.2: 'No Mint.sol/Redeem.sol/Reserve.sol holds MINTER_ROLE on either MTQ token — architecture NOT WIRED'",
    truth: "Task 9's OWN raw evidence (monad-inventory.json + raw.jsonl 21:37:26Z) recorded Mint.sol MINTER = TRUE on both chains; Monad Redeem.sol also TRUE. Task 10 re-probe (2026-10-22 06:07Z) confirms all cells identical. NO state change occurred — the Task 9 prose misread its own inventory.",
    action: "Corrected in task9-audit.ts surfaces with CORRECTION notes; N-02 remediation re-scoped to GOVERNANCE wiring + Monad Redeem mint-authority anomaly",
  },
  {
    id: "CORR-2",
    prior: "R-15 / worklog: 'Robinhood Chain RPC dead' (all Robinhood claims UNVERIFIED)",
    truth: "Task 10 probe: rpc.testnet.chain.robinhood.com/rpc ALIVE at block 140,564,404 (chainId 0xb626 = 46630). New evidence: MTQToken 0xAF5B…C5A5 is byte-identical to the gen-B twins (keccak 0x31496b92…); MTQSigma 0xA3B8…44EF0 is byte-identical to Monad gen-A (0xa7331051…) — and the SAME hex hosts Arc's CURRENT Takaful; the 'Safe' 0xa3CE…5691 is a 3,321 B contract that REVERTS on getThreshold/getOwners/nonce — NOT a genuine Safe (fake-Safe row now on a third chain)",
    action: "Recorded; RH rows added to the canonical address-book proposal as provenance generation",
  },
  {
    id: "CORR-3",
    prior: "C-046 (candidate-C genesis self-custodied) — 1M holder of gen-A tokens unlocated",
    truth: "Located 2026-10-22: gen-A on BOTH chains and Arc gen-C hold their OWN 1,000,000 MTQ genesis (balanceOf(token itself) = 1e24 raw), owner = deployer EOA (Ownable, no AccessControl) — matching contracts/MTQSigma.sol 'genesisReserve = address(this)'. No ecosystem contract holds any gen-A balance.",
    action: "C-046 evidence completed for gen-A/C families; still open for the canonical decision",
  },
  {
    id: "CORR-4",
    prior: "Solana supply field 'at u64 ceiling — not a meaningful supply' (Task 9, raw value preserved)",
    truth: "Internally CONSISTENT, not corrupt: DbFjz's single token account holds EXACTLY the full 2⁶⁴−1 raw supply → a deliberate mintTo(u64::MAX) on 2026-08-10 (feePayer DbFjz, 3 txs ever, none failed). At 18 decimals the field equals 18.446744073709551615 MTQ — the mandate's 1,000,000 MTQ (10²⁴ raw) is PHYSICALLY UNREPRESENTABLE in a u64 supply at 18 decimals (ceiling ≈ 18.4467 whole tokens)",
    action: "Structural non-conformance recorded: the deployed Solana mint can never represent the mandated supply at decimals=18; the planned 'fresh mint' (10B × 10¹⁸ = 10²⁸ raw) would REVERT on-chain",
  },
];

// ---------- fresh state anchors (stability re-verification) ----------
export const TASK10_FRESH_ANCHORS = [
  { item: "Monad MTQ supply / holders", task9: "310.949 = deployer 309.94899999999999999997 + dead 1.000000000000000003", task10: "IDENTICAL (block 73,167,496) — no movement" },
  { item: "Arc MTQ supply / holders", task9: "1,000 = deployer 999 − 3 wei… + dead 1.000000000000000003", task10: "IDENTICAL (block 68,475,006) — no movement" },
  { item: "Safe configuration (both chains)", task9: "threshold 1 · owners [deployer] · nonce 0 · v1.4.1 · singleton 0x29fcB43b…", task10: "IDENTICAL — nonce still 0 (never executed anything)" },
  { item: "Deployer role set", task9: "ADMIN+MINTER+PAUSER both tokens; ADMIN on all 7 modules ×2 chains", task10: "IDENTICAL (all re-probed individually)" },
  { item: "Module → token wiring", task9: "inventory: Mint MINTER TRUE ×2 chains; Monad Redeem TRUE", task10: "IDENTICAL — plus Task 10 selector proof: Mint modules expose mint(address,uint256)" },
  { item: "paused() / EIP-1967 slots / caps", task9: "paused false; no proxy slots; no cap()", task10: "IDENTICAL — still no EIP-170 cap function on either token (uncapped minting)" },
  { item: "Solana mint", task9: "decimals 18 · supply u64-max · mintAuthority DbFjz · no freeze authority", task10: "IDENTICAL (fresh getAccountInfo 2026-10-22 06:31Z)" },
  { item: "Governance bytecode divergence", task9: "same address 0xE35a…Bd66, Monad 25,819 B vs Arc 13,129 B", task10: "CONFIRMED + explained: same deployer EOA at the same nonce on both chains yields the same ADDRESS; different initcode (two different OZ-Governor builds — 50 vs 74 selectors) yields DIFFERENT code. Two distinct contracts share one address-book row." },
] as const;

// ---------- D5: supply / genesis reconciliation (mandate vs reality) ----------
export const TASK10_SUPPLY_RECONCILIATION = [
  { chain: "Mandate §20.1", intended: "1,000,000 MTQ minted TO THE GENESIS RESERVE SAFE + 1,100,000 USDC deposited (RR = 1.10) + canonical genesis Transfer events", actual: "NOT PERFORMED on any chain", gap: "100% of the mandate unmet by the live estate" },
  { chain: "Monad 10143 (current MITHQAL)", intended: "1,000,000 → Safe", actual: "310.949 total (0.031% of mandate) · Safe holds 0 · deployer holds 309.949 · genesis was constructor-set, NO Transfer events", gap: "supply 0.031% of mandate; custody 100% single-key; no USDC deposit (deployer native 0.224 MON)" },
  { chain: "Arc 5042002 (current MITHQAL)", intended: "1,000,000 → Safe", actual: "1,000 total (0.1% of mandate) · Safe holds 0 · deployer holds 999 − 3 wei · single historical burn tx", gap: "supply 0.1% of mandate; custody 100% single-key; native balance ≈ 19.03 (not 1.1M USDC)" },
  { chain: "Solana devnet (current GAGRdrY6)", intended: "monetary-policy-conformant supply", actual: "u64-max raw = 18.446744073709551615 MTQ (ceiling value, single holder DbFjz) · decimals 18", gap: "mandated 1M MTQ is u64-UNREPRESENTABLE at 18 decimals (max ≈ 18.45 whole tokens); the mint cannot conform as configured" },
  { chain: "Superseded generations (gen-A/B/C + Robinhood)", intended: "—", actual: "gen-A self-custodies its own 1M (×2 chains) · Arc gen-C self-custodies 1M · gen-B holds ≈1.000000000002M nearly all in deployer · RH MTQToken ≈ 1,001,000", gap: "4+ live 'MTQ' supplies across generations; canonical decision (C-041) still OPEN" },
] as const;

// ---------- D7: transaction-free containment + remediation (ALL AWAITING APPROVAL) ----------
export interface ContainmentRow { id: string; step: string; kind: "REPO" | "ON-CHAIN (PLAN ONLY)" | "OWNER ACTION"; risk: string; approval: string }

export const TASK10_CONTAINMENT_PLAN: ContainmentRow[] = [
  { id: "K-1", step: "Purge BOTH key literals from the working tree (scripts ×7, worklog line 4648 → append-only redaction note, never delete history silently)", kind: "REPO", risk: "loss of audit trail if done silently — append corrections instead", approval: "Project owner" },
  { id: "K-2", step: "Rewrite git history to strip the literals from all 24 commits (filter-repo/BFG) + rotate ALL remote tokens/credentials that ever saw the repo", kind: "REPO", risk: "history rewrite invalidates existing clones; requires coordinated re-clone", approval: "Project owner + security lead" },
  { id: "K-3", step: "Rotate the EVM deployer key: fund a NEW key, then execute the R-02 Safe 4/7 reconfiguration and role transfers from it; finally renounce the exposed key's roles (SEQUENCE MATTERS — never leave the estate admin-less)", kind: "ON-CHAIN (PLAN ONLY)", risk: "mis-sequencing can brick the estate; every step is a transaction plan awaiting written approval", approval: "Owner + constituted committee (OD-3)" },
  { id: "K-4", step: "Rotate the Solana 4saT key: move the 4.98 SOL + old-mint holdings to a fresh wallet; revoke/settle mint+freeze authority of 2EaK5c (revoke or Squads multisig per set-solana-multisig.mjs draft)", kind: "ON-CHAIN (PLAN ONLY)", risk: "old mint stays mintable by the exposed key until authority is revoked", approval: "Owner" },
  { id: "K-5", step: "DbFjz key hygiene: confirm it was never in any artifact the census could not reach (remote DB/backups are UNVERIFIED); keep it env-var-only per set-solana-multisig.mjs", kind: "OWNER ACTION", risk: "unverified remote surfaces", approval: "Owner" },
  { id: "K-6", step: "Solana redeploy decision: current mint cannot represent mandated supply at 18 decimals — choose decimals ≤ 9 (or Token-2022 with off-chain indexing) BEFORE any 'fresh mint' (the 10B×10¹⁸ plan in solana-create-fresh.ts would REVERT)", kind: "ON-CHAIN (PLAN ONLY)", risk: "another non-conformant mint if executed as written", approval: "Owner + committee" },
  { id: "K-7", step: "Adopt the proposed canonical address book (D2): owner-declared current set + superseded/provenance rows (gen-A/B/C, Robinhood, fake-Safe rows marked) — NO auto-selection; formal C-041 decision reserved for governance", kind: "REPO", risk: "none (documentation); requires human sign-off to become authoritative", approval: "Governance (C-041)" },
] as const;

// ---------- D8: release gates (unchanged statuses; updated evidence) ----------
export const TASK10_RELEASE_GATES = [
  { n: 1, name: "Build & automated tests", status: "PARTIAL (software only)", changed: false },
  { n: 2, name: "Contract & architecture verification", status: "FAIL", changed: false, note: "evidence UPDATED (two-key exposure confirmed live-privileged; wiring corrected to PARTIALLY WIRED; RH chain probed; 4+ generations reconciled) — status unchanged" },
  { n: 3, name: "Economic & quantitative validation", status: "NOT PERFORMED", changed: false },
  { n: 4, name: "Governance approval", status: "NOT GRANTED", changed: false },
  { n: 5, name: "Independent security / legal / Sharia review", status: "ABSENT", changed: false },
  { n: 6, name: "Live-pilot authorization", status: "NOT AUTHORIZED", changed: false },
  { n: 7, name: "Production authorization", status: "NOT AUTHORIZED", changed: false },
] as const;

export const TASK10_FINAL = {
  overall: "NOT ACCEPTED",
  note: "Task 10 adds NO gate advancement. The key-exposure incident (C-045-a/b) makes containment (K-1/K-2) the blocking P0 path; all on-chain steps remain transaction plans awaiting explicit human approval. Shadow mode stays enforced; economic eligibility stays disabled.",
} as const;
