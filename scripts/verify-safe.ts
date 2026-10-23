/**
 * OD-35 / T-87 — GENESIS RESERVE SAFE ON-CHAIN VERIFICATION (LIVE, READ-ONLY)
 * Target : 0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0 (genesis.ts GENESIS_RESERVE_SAFE)
 * Chains : Monad Testnet (chainId 10143, https://testnet-rpc.monad.xyz)
 *          Arc Testnet   (chainId 5042002, https://rpc.testnet.arc.io)
 *
 * Method : READ-ONLY `eth_chainId` / `eth_blockNumber` / `eth_getCode` / `eth_call`
 *          via ethers v6 JsonRpcProvider. NO transactions are sent, NO private
 *          keys are read, NOTHING is signed, NO state is changed. Every read is
 *          individually retried (up to 3 attempts, linear backoff) and every
 *          failure is recorded verbatim — a failure is itself evidence.
 *
 * Verdict: VERIFIED 4/7        — code exists AND getThreshold()==4 AND getOwners().length==7
 *          CRITICAL FINDING    — code exists but threshold/owner count differ, or Safe reads revert
 *          NOT DEPLOYED / WRONG ADDRESS — eth_getCode returned empty (0x) for the Safe
 *          INCONCLUSIVE        — RPC unreachable / chainId mismatch / code read failed
 *
 * Output : audit-work/v5/safe-verification.json (machine) + stdout (human summary)
 * Run    : bun run scripts/verify-safe.ts   (from repo root)
 */
import { ethers } from "ethers";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ─────────────────────────────── constants ────────────────────────────────

const SAFE_ADDRESS = "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0";
// lowercase form for all RPC params (avoids any EIP-55 checksum quibbles in recorded addresses)
const SAFE = SAFE_ADDRESS.toLowerCase();
const SENTINEL_MODULES = "0x0000000000000000000000000000000000000001";
const MODULES_PAGE_SIZE = 10;
const EXPECTED_THRESHOLD = 4n;
const EXPECTED_OWNERS_COUNT = 7;

// keccak256("guard_manager.guard.address") — storage slot holding the Safe guard
// (Safe v1.3.0/v1.4.1 store the guard at this explicit slot and expose NO public getter,
// so both guard()/getGuard() selectors reverting is expected; the slot read is authoritative).
const GUARD_STORAGE_SLOT = ethers.id("guard_manager.guard.address");

const SAFE_ABI = [
  "function getThreshold() view returns (uint256)",
  "function getOwners() view returns (address[])",
  "function VERSION() view returns (string)",
  "function nonce() view returns (uint256)",
  "function getModulesPaginated(address start, uint256 pageSize) view returns (address[] array, address next)",
  "function getGuard() view returns (address)",
  "function guard() view returns (address)",
];

const ERC20_ABI = [
  "function totalSupply() view returns (uint256)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
];

const SAFE_READ_SPECS: Array<{ fn: string; args: unknown[]; label: string }> = [
  { fn: "getThreshold", args: [], label: "getThreshold()" },
  { fn: "getOwners", args: [], label: "getOwners()" },
  { fn: "VERSION", args: [], label: "VERSION()" },
  { fn: "nonce", args: [], label: "nonce()" },
  {
    fn: "getModulesPaginated",
    args: [SENTINEL_MODULES, MODULES_PAGE_SIZE],
    label: `getModulesPaginated(start=SENTINEL ${SENTINEL_MODULES}, pageSize=${MODULES_PAGE_SIZE})`,
  },
  { fn: "getGuard", args: [], label: "getGuard()" },
  { fn: "guard", args: [], label: "guard() [Safe v1.3 storage-variable getter]" },
];

const ERC20_READ_FNS = ["totalSupply", "symbol", "name", "decimals"] as const;

// ─────────────────────────── probe address lists ──────────────────────────

interface ProbeSpec {
  address: string; // verbatim as recorded in the repo
  label: string;
  recordedIn: string;
  kind: "token-candidate" | "recorded-contract" | "recorded-safe-claim";
}

const MONAD_PROBES: ProbeSpec[] = [
  {
    address: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD",
    label: "MTQ candidate A",
    recordedIn: "contracts.ts MONAD_TESTNET 'MTQ Token' (user-recorded deployment; also scripts/monad-read.ts)",
    kind: "token-candidate",
  },
  {
    address: "0x0Ac20360234b4C988a19586CBe55733e18A5982f",
    label: "MTQ candidate B",
    recordedIn: "contracts.ts CANONICAL_MTQ_ADDRESSES.monad + Monad-Testnet-Ecosystem.json 'MTQToken'",
    kind: "token-candidate",
  },
  {
    address: "0x5D9564C27111EA65Da3228a79833F0FF129bfd4a",
    label: "MTQSigma (deployment JSON)",
    recordedIn: "contracts/deployments/Monad-Testnet.json 'MTQSigma'",
    kind: "token-candidate",
  },
  {
    address: "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713",
    label: "Oracle (contracts.ts)",
    recordedIn: "contracts.ts MONAD_TESTNET 'Oracle'; NOTE: same address recorded as 'Safe' in Arc-Testnet-Ecosystem.json",
    kind: "recorded-contract",
  },
  {
    address: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66",
    label: "Governance (contracts.ts)",
    recordedIn: "contracts.ts MONAD_TESTNET 'Governance'; NOTE: identical address also recorded for Arc 'Governance'",
    kind: "recorded-contract",
  },
  {
    address: "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177",
    label: "Reserve (contracts.ts)",
    recordedIn: "contracts.ts MONAD_TESTNET 'Reserve Vault'; NOTE: same address also recorded as Robinhood 'Takaful' in contracts.ts",
    kind: "recorded-contract",
  },
  {
    address: "0x197e9CB28216dfe18a199b4c2930F74C2F460809",
    label: "Mint (contracts.ts)",
    recordedIn: "contracts.ts MONAD_TESTNET 'Mint'",
    kind: "recorded-contract",
  },
  {
    address: "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4",
    label: "Redeem (contracts.ts)",
    recordedIn: "contracts.ts MONAD_TESTNET 'Redeem'",
    kind: "recorded-contract",
  },
  {
    address: "0x8839ce50e8D414005518769999c0A5b961D00CB2",
    label: "Algorithm (contracts.ts)",
    recordedIn: "contracts.ts MONAD_TESTNET 'Algorithm Engine'",
    kind: "recorded-contract",
  },
  {
    address: "0x74353601354c0b71df5B16Fe1B28c7F0831dd316",
    label: "Safe claim (Ecosystem JSON) [EXTRA]",
    recordedIn: "Monad-Testnet-Ecosystem.json 'Safe' — conflicts with genesis.ts Safe 0xE718…A7D0",
    kind: "recorded-safe-claim",
  },
];

const ARC_PROBES: ProbeSpec[] = [
  {
    address: "0x237c3Aa2B79248f86f6523D3890095BCd1996601",
    label: "MTQ candidate A",
    recordedIn: "contracts.ts ARC_TESTNET 'MTQ Token' (user-recorded deployment)",
    kind: "token-candidate",
  },
  {
    address: "0x24203404B9b971C907e8Ced96106Fa74380d9897",
    label: "MTQ candidate B",
    recordedIn: "contracts.ts CANONICAL_MTQ_ADDRESSES.arc + Arc-Testnet-Ecosystem.json 'MTQToken'",
    kind: "token-candidate",
  },
  {
    address: "0x826b82F79FD6c5347cDC568B1d0A7918128B63c1",
    label: "MTQSigma (deployment JSON)",
    recordedIn: "contracts/deployments/Arc-Testnet.json 'MTQSigma'",
    kind: "token-candidate",
  },
  {
    address: "0xFd2B8d176bf059287638Db30D02C6651dA02861e",
    label: "Oracle (contracts.ts)",
    recordedIn: "contracts.ts ARC_TESTNET 'Oracle'; NOTE: same address also recorded as Robinhood 'MockUSDC' in contracts.ts",
    kind: "recorded-contract",
  },
  {
    address: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66",
    label: "Governance (contracts.ts)",
    recordedIn: "contracts.ts ARC_TESTNET 'Governance'; NOTE: identical to the Monad 'Governance' address (suspected copy/paste)",
    kind: "recorded-contract",
  },
  {
    address: "0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471",
    label: "Reserve (contracts.ts)",
    recordedIn: "contracts.ts ARC_TESTNET 'Reserve Vault'",
    kind: "recorded-contract",
  },
  {
    address: "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa",
    label: "Mint (contracts.ts)",
    recordedIn: "contracts.ts ARC_TESTNET 'Mint'",
    kind: "recorded-contract",
  },
  {
    address: "0xcAde4594177829597882555Ff57d0e34092daF8e",
    label: "Redeem (contracts.ts)",
    recordedIn: "contracts.ts ARC_TESTNET 'Redeem'",
    kind: "recorded-contract",
  },
  {
    address: "0x62f8E5243f32eE5C87a14A7896C61104aD9e7727",
    label: "Algorithm (contracts.ts)",
    recordedIn: "contracts.ts ARC_TESTNET 'Algorithm Engine'",
    kind: "recorded-contract",
  },
  {
    address: "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713",
    label: "Safe claim (Ecosystem JSON) [EXTRA]",
    recordedIn: "Arc-Testnet-Ecosystem.json 'Safe' — NOTE: same address recorded as Monad 'Oracle' in contracts.ts",
    kind: "recorded-safe-claim",
  },
];

interface ChainConfig {
  key: string;
  name: string;
  rpc: string;
  chainId: number;
  probes: ProbeSpec[];
}

const CHAINS: ChainConfig[] = [
  {
    key: "monad",
    name: "Monad Testnet",
    rpc: "https://testnet-rpc.monad.xyz",
    chainId: 10143,
    probes: MONAD_PROBES,
  },
  {
    key: "arc",
    name: "Arc Testnet",
    rpc: "https://rpc.testnet.arc.io",
    chainId: 5042002,
    probes: ARC_PROBES,
  },
];

// ───────────────────────────── types ─────────────────────────────────────

interface ReadRecord {
  label: string;
  method?: string;
  fn?: string;
  selector?: string | null;
  calldata?: string | null;
  ok: boolean; // RPC call returned data (and ABI-decoded cleanly)
  raw?: string | null; // raw return hex (kept even when ABI decode fails)
  decoded?: unknown;
  error?: string | null;
  attempts: number;
}

interface CodeInfo {
  ok: boolean;
  exists: boolean;
  byteLength: number | null;
  codePrefix: string | null;
  error?: string | null;
  attempts: number;
}

interface ProbeResult {
  address: string;
  label: string;
  recordedIn: string;
  kind: ProbeSpec["kind"];
  code: CodeInfo;
  erc20?: Record<string, ReadRecord> & { skipped?: string; totalSupplyFormatted?: string };
  safeReads?: Record<string, ReadRecord>;
}

interface SafeFindings {
  codeBytes: number | null;
  threshold: string | null;
  ownersCount: number | null;
  owners: string[] | null;
  version: string | null;
  nonce: string | null;
  modulesCount: number | null;
  modules: string[] | null;
  modulesNext: string | null;
  guardMethod: string | null; // which of getGuard()/guard()/storage-slot read produced the guard address
  guardAddress: string | null;
  guardIsZero: boolean | null;
  singleton: string | null; // proxy storage slot 0
  singletonCodeBytes: number | null;
}

/** full-precision fixed-point formatter for ERC-20 supplies (integer division would lose fractions) */
function fmtFixed(raw: string, dec: number): string {
  if (dec <= 0) return raw;
  let s = raw.padStart(dec + 1, "0");
  const intPart = s.slice(0, s.length - dec);
  const frac = s.slice(s.length - dec).replace(/0+$/, "");
  return frac ? `${intPart}.${frac}` : intPart;
}

interface ChainResult {
  key: string;
  name: string;
  rpc: string;
  expectedChainId: number;
  expectedChainIdHex: string;
  actualChainIdHex: string | null;
  actualChainId: number | null;
  chainIdMatch: boolean | null;
  blockNumberHex: string | null;
  blockNumber: number | null;
  rpcUnreachable: boolean;
  rpcError: string | null;
  safeAddress: string;
  safeReads: Record<string, ReadRecord>;
  safeFindings: SafeFindings;
  codeProbes: ProbeResult[];
  liveTokenCandidates: string[];
  verdict: string;
  verdictDetail: string;
}

// ─────────────────────────── ethers plumbing ──────────────────────────────

const safeIface = new ethers.Interface(SAFE_ABI);
const erc20Iface = new ethers.Interface(ERC20_ABI);

const SELECTORS: Record<string, string> = {};
for (const fn of ["getThreshold", "getOwners", "VERSION", "nonce", "getModulesPaginated", "getGuard", "guard"]) {
  SELECTORS[fn] = safeIface.getFunction(fn)!.selector;
}
for (const fn of ERC20_READ_FNS) {
  SELECTORS[fn] = erc20Iface.getFunction(fn)!.selector;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    const anyE = e as unknown as { shortMessage?: string; info?: { error?: { message?: string } } };
    const parts = [e.message];
    if (anyE.shortMessage && anyE.shortMessage !== e.message) parts.push(`short: ${anyE.shortMessage}`);
    const rpcMsg = anyE.info?.error?.message;
    if (rpcMsg) parts.push(`rpc: ${rpcMsg}`);
    return parts.join(" | ").slice(0, 600);
  }
  return String(e).slice(0, 600);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface RetryOutcome<T> {
  value?: T;
  error?: string;
  attempts: number;
}

/** Retry an RPC read up to 3 attempts with linear backoff + generous per-attempt timeout. */
async function withRetry<T>(label: string, fn: () => Promise<T>, timeoutMs = 30_000, attempts = 3, baseDelayMs = 800): Promise<RetryOutcome<T>> {
  let lastErr = "";
  for (let i = 1; i <= attempts; i++) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const value = await Promise.race([
        fn(),
        new Promise<never>((_, rej) => {
          timer = setTimeout(() => rej(new Error(`TIMEOUT after ${timeoutMs}ms`)), timeoutMs);
          (timer as unknown as { unref?: () => void })?.unref?.();
        }),
      ]);
      if (timer) clearTimeout(timer);
      return { value, attempts: i };
    } catch (e) {
      if (timer) clearTimeout(timer);
      lastErr = errMsg(e);
      if (i < attempts) {
        const delay = baseDelayMs * i;
        console.error(`    ↻ ${label}: attempt ${i}/${attempts} failed (${lastErr.slice(0, 180)}) — retrying in ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  return { error: lastErr, attempts };
}

function decodeResult(iface: ethers.Interface, fnName: string, raw: string): unknown {
  const result = iface.decodeFunctionResult(fnName, raw);
  switch (fnName) {
    case "getThreshold":
    case "nonce":
      return result[0].toString();
    case "getOwners":
      return Array.from(result[0] as unknown as Array<unknown>).map((a) => String(a));
    case "VERSION":
      return String(result[0]);
    case "getModulesPaginated":
      return {
        array: Array.from(result[0] as unknown as Array<unknown>).map((a) => String(a)),
        next: String(result[1]),
      };
    case "getGuard":
    case "guard":
      return String(result[0]);
    case "totalSupply":
      return result[0].toString();
    case "decimals":
      return Number(result[0]);
    case "symbol":
    case "name":
      return String(result[0]);
    default:
      return Array.from(result as unknown as Array<unknown>).map(String);
  }
}

/** eth_call a view function; record selector, calldata, raw return, decoded value, or the verbatim error. */
async function callFn(
  provider: ethers.JsonRpcProvider,
  iface: ethers.Interface,
  fnName: string,
  args: unknown[],
  to: string,
  label: string
): Promise<ReadRecord> {
  const rec: ReadRecord = {
    label,
    fn: fnName,
    selector: SELECTORS[fnName] ?? null,
    calldata: null,
    ok: false,
    raw: null,
    decoded: null,
    error: null,
    attempts: 0,
  };
  try {
    rec.calldata = iface.encodeFunctionData(fnName, args as never);
  } catch (e) {
    rec.error = `encode failed: ${errMsg(e)}`;
    return rec;
  }
  const outcome = await withRetry(label, () => provider.call({ to, data: rec.calldata as string }));
  rec.attempts = outcome.attempts;
  if (outcome.error) {
    rec.error = outcome.error;
    return rec;
  }
  const raw = outcome.value as string;
  rec.raw = raw;
  try {
    rec.decoded = decodeResult(iface, fnName, raw);
    rec.ok = true;
  } catch (e) {
    // RPC returned data but it does not ABI-decode — evidence of a non-conforming callee.
    rec.error = `ABI decode failed (non-standard return or not this interface): ${errMsg(e)}`;
  }
  return rec;
}

/** raw JSON-RPC send (eth_chainId / eth_blockNumber / eth_getCode) */
async function rawRpc(provider: ethers.JsonRpcProvider, method: string, params: unknown[], label: string): Promise<ReadRecord> {
  const rec: ReadRecord = { label, method, ok: false, raw: null, decoded: null, error: null, attempts: 0 };
  const outcome = await withRetry(label, () => provider.send(method, params));
  rec.attempts = outcome.attempts;
  if (outcome.error) {
    rec.error = outcome.error;
    return rec;
  }
  rec.raw = String(outcome.value);
  rec.ok = true;
  return rec;
}

/** eth_getCode existence probe — byte length + 68-byte identifying prefix (full hex omitted for brevity). */
async function probeCode(provider: ethers.JsonRpcProvider, address: string, label: string): Promise<CodeInfo> {
  const rec = await rawRpc(provider, "eth_getCode", [address.toLowerCase(), "latest"], `${label} eth_getCode`);
  if (!rec.ok) {
    return { ok: false, exists: false, byteLength: null, codePrefix: null, error: rec.error, attempts: rec.attempts };
  }
  const hex = rec.raw || "0x";
  const byteLength = hex.length <= 2 ? 0 : (hex.length - 2) / 2;
  return { ok: true, exists: byteLength > 0, byteLength, codePrefix: hex.slice(0, 138), error: null, attempts: rec.attempts };
}

// ───────────────────────────── per-chain run ──────────────────────────────

const LINE = "=".repeat(100);

async function runChain(cfg: ChainConfig, provider: ethers.JsonRpcProvider): Promise<ChainResult> {
  const result: ChainResult = {
    key: cfg.key,
    name: cfg.name,
    rpc: cfg.rpc,
    expectedChainId: cfg.chainId,
    expectedChainIdHex: ethers.toQuantity(cfg.chainId),
    actualChainIdHex: null,
    actualChainId: null,
    chainIdMatch: null,
    blockNumberHex: null,
    blockNumber: null,
    rpcUnreachable: false,
    rpcError: null,
    safeAddress: SAFE_ADDRESS,
    safeReads: {},
    safeFindings: {
      codeBytes: null,
      threshold: null,
      ownersCount: null,
      owners: null,
      version: null,
      nonce: null,
      modulesCount: null,
      modules: null,
      modulesNext: null,
      guardMethod: null,
      guardAddress: null,
      guardIsZero: null,
      singleton: null,
      singletonCodeBytes: null,
    },
    codeProbes: [],
    liveTokenCandidates: [],
    verdict: "",
    verdictDetail: "",
  };

  console.log(`\n${LINE}\n${cfg.name} — ${cfg.rpc}\n${LINE}`);

  // 1) chainId — assert loudly on mismatch
  const chainIdRec = await rawRpc(provider, "eth_chainId", [], "eth_chainId");
  if (!chainIdRec.ok) {
    result.rpcUnreachable = true;
    result.rpcError = `eth_chainId failed after retries: ${chainIdRec.error}`;
    console.error(`✗ eth_chainId FAILED — ${result.rpcError}`);
    result.verdict = "INCONCLUSIVE";
    result.verdictDetail = `RPC unreadable (${cfg.rpc}): ${result.rpcError}. No further reads attempted — all Safe/cod probes SKIPPED.`;
    return result;
  }
  const actualHex = String(chainIdRec.raw).toLowerCase();
  result.actualChainIdHex = actualHex;
  result.actualChainId = parseInt(actualHex, 16);
  result.chainIdMatch = actualHex === result.expectedChainIdHex.toLowerCase();
  console.log(
    `eth_chainId : ${actualHex} (${result.actualChainId}) — ${
      result.chainIdMatch ? `MATCH ✓ (expected ${result.expectedChainIdHex})` : `MISMATCH ✗ expected ${result.expectedChainIdHex} (${cfg.chainId})`
    }`
  );
  if (!result.chainIdMatch) {
    console.error(`!! CHAIN-ID MISMATCH on ${cfg.name}: expected ${result.expectedChainIdHex}, got ${actualHex}. Continuing to read (evidence), verdict will be INCONCLUSIVE.`);
    result.rpcError = `chainId mismatch: expected ${result.expectedChainIdHex}, got ${actualHex}`;
  }

  // 2) blockNumber
  const bnRec = await rawRpc(provider, "eth_blockNumber", [], "eth_blockNumber");
  if (!bnRec.ok) {
    result.rpcUnreachable = true;
    result.rpcError = `eth_blockNumber failed after retries: ${bnRec.error}`;
    console.error(`✗ eth_blockNumber FAILED — ${result.rpcError}`);
    result.verdict = "INCONCLUSIVE";
    result.verdictDetail = `RPC readable for eth_chainId but eth_blockNumber failed: ${result.rpcError}`;
    return result;
  }
  result.blockNumberHex = String(bnRec.raw);
  result.blockNumber = parseInt(result.blockNumberHex, 16);
  console.log(`eth_blockNumber : ${result.blockNumber} (${result.blockNumberHex}) — all reads below at/after this block`);

  // 3) Safe verification reads
  console.log(`\n-- SAFE VERIFICATION READS — ${SAFE_ADDRESS} --`);

  const safeCode = await probeCode(provider, SAFE, "GenesisReserveSafe eth_getCode");
  result.safeReads["eth_getCode"] = {
    label: "eth_getCode(GenesisReserveSafe)",
    method: "eth_getCode",
    ok: safeCode.ok,
    raw: safeCode.codePrefix,
    decoded: { exists: safeCode.exists, byteLength: safeCode.byteLength },
    error: safeCode.error,
    attempts: safeCode.attempts,
  };
  result.safeFindings.codeBytes = safeCode.byteLength;
  console.log(
    safeCode.ok
      ? `  eth_getCode            ${safeCode.exists ? `✓ CODE EXISTS — ${safeCode.byteLength} bytes (prefix ${safeCode.codePrefix?.slice(0, 26)}…)` : "✗ NO CODE (0 bytes) — CRITICAL: not a Safe on this chain"}`
      : `  eth_getCode            ✗ FAILED — ${safeCode.error}`
  );

  for (const spec of SAFE_READ_SPECS) {
    const rec = await callFn(provider, safeIface, spec.fn, spec.args, SAFE, spec.label);
    result.safeReads[spec.fn] = rec;
    const shown =
      rec.ok
        ? `✓ ${JSON.stringify(rec.decoded)}`
        : `✗ ${rec.error}${rec.raw && !rec.ok ? ` (raw return kept: ${rec.raw.slice(0, 40)}…)` : ""}`;
    console.log(`  ${spec.label.padEnd(62)} ${shown}`);
  }

  // findings roll-up
  const t = result.safeReads["getThreshold"];
  const o = result.safeReads["getOwners"];
  const v = result.safeReads["VERSION"];
  const n = result.safeReads["nonce"];
  const m = result.safeReads["getModulesPaginated"];
  if (t.ok && typeof t.decoded === "string") result.safeFindings.threshold = t.decoded;
  if (o.ok && Array.isArray(o.decoded)) {
    result.safeFindings.owners = o.decoded as string[];
    result.safeFindings.ownersCount = (o.decoded as string[]).length;
  }
  if (v.ok && typeof v.decoded === "string") result.safeFindings.version = v.decoded;
  if (n.ok && typeof n.decoded === "string") result.safeFindings.nonce = n.decoded;
  if (m.ok && m.decoded && typeof m.decoded === "object") {
    const md = m.decoded as { array: string[]; next: string };
    result.safeFindings.modules = md.array;
    result.safeFindings.modulesCount = md.array.length;
    result.safeFindings.modulesNext = md.next;
  }
  const g1 = result.safeReads["getGuard"];
  const g2 = result.safeReads["guard"];
  const g1Addr = g1.ok && typeof g1.decoded === "string" ? g1.decoded : null;
  const g2Addr = g2.ok && typeof g2.decoded === "string" ? g2.decoded : null;

  // EXTRA storage-level reads: Safe v1.4.1 exposes no public guard getter and the
  // GnosisSafeProxy keeps its singleton at storage slot 0. Read-only eth_getStorageAt.
  console.log(
    `  -- EXTRA storage reads (no public guard getter on v1.4.1; proxy singleton lives at slot 0) --`
  );
  const singletonRec = await rawRpc(provider, "eth_getStorageAt", [SAFE, "0x0", "latest"], "eth_getStorageAt(safe, slot 0 = singleton)");
  result.safeReads["eth_getStorageAt_singleton"] = singletonRec;
  let singletonAddr: string | null = null;
  if (singletonRec.ok) {
    try {
      singletonAddr = ethers.getAddress("0x" + String(singletonRec.raw).slice(-40));
      result.safeFindings.singleton = singletonAddr;
    } catch {
      /* malformed word recorded verbatim below */
    }
  }
  const guardSlotRec = await rawRpc(
    provider,
    "eth_getStorageAt",
    [SAFE, GUARD_STORAGE_SLOT, "latest"],
    `eth_getStorageAt(safe, GUARD_STORAGE_SLOT=${GUARD_STORAGE_SLOT})`
  );
  result.safeReads["eth_getStorageAt_guardSlot"] = guardSlotRec;
  let guardSlotAddr: string | null = null;
  if (guardSlotRec.ok) {
    try {
      guardSlotAddr = ethers.getAddress("0x" + String(guardSlotRec.raw).slice(-40));
    } catch {
      /* malformed word recorded verbatim below */
    }
  }
  if (singletonAddr) {
    const singletonCode = await probeCode(provider, singletonAddr, "Safe singleton eth_getCode");
    result.safeFindings.singletonCodeBytes = singletonCode.byteLength;
    result.safeReads["eth_getCode_singleton"] = {
      label: `eth_getCode(singleton ${singletonAddr})`,
      method: "eth_getCode",
      ok: singletonCode.ok,
      raw: singletonCode.codePrefix,
      decoded: { exists: singletonCode.exists, byteLength: singletonCode.byteLength },
      error: singletonCode.error,
      attempts: singletonCode.attempts,
    };
  }
  console.log(
    `  singleton (slot 0)      ${singletonAddr ? `✓ ${singletonAddr} (code ${result.safeFindings.singletonCodeBytes} bytes)` : `✗ ${singletonRec.error}`}`
  );
  console.log(
    `  guard storage slot      ${guardSlotAddr ? `✓ ${guardSlotAddr} ${guardSlotAddr === ethers.ZeroAddress ? "(address(0) — NO guard configured)" : ""}` : `✗ ${guardSlotRec.error}`}`
  );

  result.safeFindings.guardMethod =
    g1Addr && g2Addr
      ? "both getGuard() and guard()"
      : g1Addr
      ? "getGuard()"
      : g2Addr
      ? "guard()"
      : guardSlotAddr
      ? `eth_getStorageAt at GUARD_STORAGE_SLOT ${GUARD_STORAGE_SLOT} (both public getters revert on v1.4.1 — no public getter exists)`
      : "none";
  result.safeFindings.guardAddress = g1Addr ?? g2Addr ?? guardSlotAddr;
  result.safeFindings.guardIsZero =
    result.safeFindings.guardAddress != null ? result.safeFindings.guardAddress === ethers.ZeroAddress : null;

  // 4) Supplemental code-existence probes (address reconciliation)
  console.log(`\n-- SUPPLEMENTAL CODE-EXISTENCE PROBES (address reconciliation) — block ${result.blockNumber} --`);
  for (const probe of cfg.probes) {
    const code = await probeCode(provider, probe.address, probe.address);
    const pr: ProbeResult = {
      address: probe.address,
      label: probe.label,
      recordedIn: probe.recordedIn,
      kind: probe.kind,
      code,
    };
    console.log(
      `  ${probe.address}  [${probe.label}] — ${
        code.ok ? (code.exists ? `code exists, ${code.byteLength} bytes` : `NO CODE at block ${result.blockNumber} (0 bytes)`) : `eth_getCode FAILED: ${code.error}`
      }`
    );

    if (probe.kind === "token-candidate") {
      if (!code.exists) {
        pr.erc20 = { skipped: `no code at ${probe.address} at block ${result.blockNumber}` };
      } else {
        pr.erc20 = {};
        for (const fn of ERC20_READ_FNS) {
          const rec = await callFn(provider, erc20Iface, fn, [], probe.address, `${probe.label} ${fn}()`);
          pr.erc20[fn] = rec;
          console.log(`     ${fn.padEnd(12)} ${rec.ok ? `✓ ${JSON.stringify(rec.decoded)}` : `✗ ${rec.error}`}`);
        }
        const ts = pr.erc20.totalSupply;
        const dec = pr.erc20.decimals;
        if (ts.ok && dec.ok && typeof ts.decoded === "string" && typeof dec.decoded === "number") {
          try {
            pr.erc20.totalSupplyFormatted = `${fmtFixed(ts.decoded, dec.decoded)} (raw ${ts.decoded}, ${dec.decoded} decimals)`;
          } catch {
            /* formatting is cosmetic — raw values already recorded */
          }
        }
        const anyErc20Ok = Object.values(pr.erc20).some(
          (r) => r && typeof r === "object" && "ok" in (r as Record<string, unknown>) && (r as ReadRecord).ok
        );
        if (anyErc20Ok) {
          const sym = pr.erc20.symbol?.ok ? String(pr.erc20.symbol.decoded) : "?";
          const nm = pr.erc20.name?.ok ? String(pr.erc20.name.decoded) : "?";
          const supply = pr.erc20.totalSupplyFormatted ?? (pr.erc20.totalSupply?.ok ? `${pr.erc20.totalSupply.decoded} raw` : "?");
          result.liveTokenCandidates.push(`${probe.address} (${nm} / ${sym}, supply ${supply})`);
        }
      }
    }

    if (probe.kind === "recorded-safe-claim" && code.exists) {
      console.log(`     ↳ recorded as "Safe" in Ecosystem JSON — running Safe interface reads as EXTRA evidence:`);
      pr.safeReads = {};
      for (const spec of SAFE_READ_SPECS) {
        const rec = await callFn(provider, safeIface, spec.fn, spec.args, probe.address, `${probe.label} ${spec.label}`);
        pr.safeReads[spec.fn] = rec;
        console.log(`     ${spec.fn.padEnd(22)} ${rec.ok ? `✓ ${JSON.stringify(rec.decoded)}` : `✗ ${String(rec.error).slice(0, 120)}`}`);
      }
    }
    result.codeProbes.push(pr);
  }

  // 5) verdict
  computeVerdict(result);
  console.log(`\n  VERDICT: ${result.verdict}\n           ${result.verdictDetail}`);
  return result;
}

function computeVerdict(chain: ChainResult): void {
  if (chain.rpcUnreachable) {
    chain.verdict = "INCONCLUSIVE";
    chain.verdictDetail = `RPC unreachable/unusable (${chain.rpc}): ${chain.rpcError}`;
    return;
  }
  if (chain.chainIdMatch === false) {
    chain.verdict = "INCONCLUSIVE";
    chain.verdictDetail = `eth_chainId mismatch — expected ${chain.expectedChainIdHex} (${chain.expectedChainId}), got ${chain.actualChainIdHex} (${chain.actualChainId}); reads were taken against an unexpected chain.`;
    return;
  }
  const code = chain.safeReads["eth_getCode"];
  if (!code.ok) {
    chain.verdict = "INCONCLUSIVE";
    chain.verdictDetail = `eth_getCode failed: ${code.error}`;
    return;
  }
  if (!chain.safeFindings.codeBytes || chain.safeFindings.codeBytes === 0) {
    chain.verdict = "NOT DEPLOYED / WRONG ADDRESS";
    chain.verdictDetail = `CRITICAL FINDING: eth_getCode returned empty (0 bytes) for ${SAFE_ADDRESS} on ${chain.name} at block ${chain.blockNumber} — the Genesis Reserve Safe is NOT deployed at this address on this chain. The repo's "reported 4/7" claim cannot be reproduced on-chain.`;
    return;
  }
  const t = chain.safeFindings.threshold;
  const ownerCount = chain.safeFindings.ownersCount;
  if (t === null || ownerCount === null) {
    chain.verdict = "CRITICAL FINDING";
    chain.verdictDetail = `Code exists (${chain.safeFindings.codeBytes} bytes) but Safe interface reads FAILED — getThreshold(): ${
      chain.safeReads["getThreshold"].ok ? "ok" : chain.safeReads["getThreshold"].error
    }; getOwners(): ${chain.safeReads["getOwners"].ok ? "ok" : chain.safeReads["getOwners"].error}. The address does not behave as a Gnosis Safe.`;
    return;
  }
  const thresholdOk = BigInt(t) === EXPECTED_THRESHOLD;
  const ownersOk = ownerCount === EXPECTED_OWNERS_COUNT;
  if (thresholdOk && ownersOk) {
    chain.verdict = "VERIFIED 4/7";
    chain.verdictDetail = `threshold=${t}, owners=${ownerCount}, VERSION=${chain.safeFindings.version ?? "unreadable"}, nonce=${chain.safeFindings.nonce ?? "unreadable"}, guard=${chain.safeFindings.guardAddress ?? "unreadable"} (${chain.safeFindings.guardMethod}), singleton=${chain.safeFindings.singleton ?? "unreadable"} — matches the reported 4/7 configuration with live on-chain reads.`;
  } else {
    chain.verdict = "CRITICAL FINDING";
    chain.verdictDetail = `On-chain threshold=${t} (expected ${EXPECTED_THRESHOLD}), on-chain owner count=${ownerCount} (expected ${EXPECTED_OWNERS_COUNT}), VERSION=${chain.safeFindings.version ?? "unreadable"}, owners=${JSON.stringify(chain.safeFindings.owners)} — the reported 4/7 configuration is NOT what the chain says.`;
  }
}

// ─────────────────────────────── main ─────────────────────────────────────

async function main(): Promise<void> {
  console.log(LINE);
  console.log("OD-35 / T-87 — GENESIS RESERVE SAFE ON-CHAIN VERIFICATION (LIVE, READ-ONLY)");
  console.log(`Target Safe : ${SAFE_ADDRESS}`);
  console.log(`Expected    : threshold 4 of 7 owners (reported — to be VERIFIED by these reads)`);
  console.log(`Method      : read-only eth_call / eth_getCode — no transactions, no keys, no signing`);
  console.log(`Started     : ${new Date().toISOString()}`);
  console.log(LINE);
  console.log("Function selectors used (keccak256, computed by ethers v6 Interface):");
  for (const [fn, sel] of Object.entries(SELECTORS)) {
    console.log(`  ${fn.padEnd(22)} ${sel}`);
  }

  const results: Record<string, ChainResult> = {};
  for (const cfg of CHAINS) {
    const provider = new ethers.JsonRpcProvider(cfg.rpc, { chainId: cfg.chainId, name: cfg.key }, { staticNetwork: true, batchMaxCount: 1 });
    try {
      results[cfg.key] = await runChain(cfg, provider);
    } catch (e) {
      // Catastrophic per-chain failure — record it as evidence, keep going.
      console.error(`!! UNHANDLED FAILURE on ${cfg.name}: ${errMsg(e)}`);
      results[cfg.key] = {
        key: cfg.key,
        name: cfg.name,
        rpc: cfg.rpc,
        expectedChainId: cfg.chainId,
        expectedChainIdHex: ethers.toQuantity(cfg.chainId),
        actualChainIdHex: null,
        actualChainId: null,
        chainIdMatch: null,
        blockNumberHex: null,
        blockNumber: null,
        rpcUnreachable: true,
        rpcError: `unhandled exception: ${errMsg(e)}`,
        safeAddress: SAFE_ADDRESS,
        safeReads: {},
        safeFindings: {
          codeBytes: null,
          threshold: null,
          ownersCount: null,
          owners: null,
          version: null,
          nonce: null,
          modulesCount: null,
          modules: null,
          modulesNext: null,
          guardMethod: null,
          guardAddress: null,
          guardIsZero: null,
          singleton: null,
          singletonCodeBytes: null,
        },
        codeProbes: [],
        liveTokenCandidates: [],
        verdict: "INCONCLUSIVE",
        verdictDetail: `Unhandled exception during verification: ${errMsg(e)}`,
      };
    }
    try {
      (provider as unknown as { destroy?: () => void }).destroy?.();
    } catch {
      /* provider teardown is best-effort */
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    task: "OD-35 / T-87 — Genesis Reserve Safe on-chain verification (Ext-3)",
    script: "scripts/verify-safe.ts",
    method:
      "read-only eth_chainId / eth_blockNumber / eth_getCode / eth_call via ethers v6 JsonRpcProvider; NO transactions, NO private keys, NO signing, NO state changes; each read retried up to 3 attempts with linear backoff; failures recorded verbatim as evidence",
    safeAddress: SAFE_ADDRESS,
    expectedConfiguration: {
      threshold: "4",
      ownersCount: 7,
      source: "mandate-register.ts OD-35 (status VERIFICATION-PENDING: reported 4/7, reads not previously performed — reported ≠ verified)",
    },
    selectors: SELECTORS,
    chains: results,
  };

  const outDir = resolve(process.cwd(), "audit-work/v5");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "safe-verification.json");
  writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");

  console.log(`\n${LINE}\nFINAL SUMMARY\n${LINE}`);
  for (const cfg of CHAINS) {
    const r = results[cfg.key];
    console.log(`${r.name} (chainId ${r.actualChainIdHex ?? "?"} ${r.chainIdMatch === false ? "MISMATCH" : ""} @ block ${r.blockNumber ?? "?"}):`);
    console.log(`  Safe ${SAFE_ADDRESS} → ${r.verdict}`);
    console.log(`    ${r.verdictDetail}`);
    console.log(
      `  Live token candidates: ${r.liveTokenCandidates.length ? r.liveTokenCandidates.join(" | ") : "none of the probed candidates returned ERC-20 data"}`
    );
  }
  console.log(`\nMachine output: ${outPath}`);

  // Give piped stdout a moment, then exit deterministically (keep-alive sockets otherwise linger).
  await sleep(150);
  process.exit(0);
}

main().catch(async (e) => {
  console.error(`FATAL: ${errMsg(e)}`);
  // Even on a fatal path, leave an INCONCLUSIVE artifact behind if at all possible.
  try {
    const outDir = resolve(process.cwd(), "audit-work/v5");
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, "safe-verification.json");
    if (!existsSync(outPath)) {
      writeFileSync(
        outPath,
        JSON.stringify(
          { generatedAt: new Date().toISOString(), task: "OD-35 / T-87", script: "scripts/verify-safe.ts", fatal: errMsg(e), verdicts: { monad: "INCONCLUSIVE", arc: "INCONCLUSIVE" } },
          null,
          2
        ) + "\n"
      );
    }
  } catch {
    /* nothing more we can do */
  }
  process.exit(1);
});
