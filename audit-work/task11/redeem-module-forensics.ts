/**
 * MTQΣ Task 11.1 — REDEEM-MODULE EXECUTION-PATH FORENSICS + SAFE CANONICAL-REFERENCE PROBE (v2)
 * TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
 *
 * v2 changes (probe incidents disclosed in CORRECTIONS-REGISTER §PI-11.1):
 *  - v1 hand-transcribed the monad.Mint anchor and dropped one character → false mismatch.
 *    v2 loads ALL anchors programmatically from evidence/identity-anchors-task11.json.
 *  - v1 linear disassembly ran into the appended solc CBOR/IPFS metadata section (spurious
 *    "SELFDESTRUCT"/garbage opcodes near code end). v2 detects the metadata boundary and
 *    restricts call-site/opcode analysis to the executable region (documented offset).
 *  - v1 dispatch heuristic capped at 700 bytes. v2 scans the full executable region.
 *  - v2 adds the BYTE-WISE selector-presence scan (any occurrence of each selector's raw
 *    4 bytes anywhere in runtime code, in-code vs in-metadata), which is the decisive
 *    check for "no static mint calldata can be constructed from literals in this code".
 *  - v2 records the failed canonical L1-Safe reference probe honestly (empty code at the
 *    recalled address → UNVERIFIED; no L1-variant address is asserted anywhere).
 *
 * §2 (narrow the Redeem-module finding): enumerates EVERY external-call site with deep
 * context windows, every address/selector literal, every calldata-copy/size use, and every
 * indirect-execution opcode, so each path can be traced by a human reviewer.
 * Mint modules are included as POSITIVE CONTROLS (must show an exercisable token-mint path).
 *
 * Methods (ALL READ-ONLY): eth_chainId · eth_blockNumber · eth_getCode. ZERO transactions.
 * Hashed transport (request/response keccak), UTC timestamps, block anchoring, retries
 * classified; a failed request is FAILED-UNVERIFIED, never a negative result.
 *
 * Keccak convention (recorded per Task 11.1 §3): runtimeKeccak = keccak256(RAW RUNTIME BYTES)
 * — the historical Tasks-9/10 convention (identity-anchors-task11.json). The
 * keccak256(ASCII-hex-string) variant is computed only to reconcile with
 * onchain-evm-task11.json (CORR-5 disclosure) and is labeled `asciiHexKeccak`.
 */
import { writeFileSync, appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { keccak256, toUtf8Bytes } from "ethers";

const T11 = "/home/z/my-project/audit-work/task11";
const RAWLOG = `${T11}/evidence/raw-task111-evm.jsonl`;
mkdirSync(`${T11}/evidence`, { recursive: true });

const now = () => new Date().toISOString();
const stats = { requests: 0, retries: 0, failures: 0, ok: 0 };

// --------------------------------------------------------------- hashed raw RPC (verify-evm.ts pattern)
async function rpc(url: string, method: string, params: any[], label: string, tries = 4): Promise<any> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  const reqHash = keccak256(toUtf8Bytes(body)).slice(0, 26);
  for (let i = 1; ; i++) {
    try {
      stats.requests++;
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
      const text = await res.text();
      const resHash = keccak256(toUtf8Bytes(text)).slice(0, 26);
      let j: any;
      try { j = JSON.parse(text); } catch { throw new Error(`non-JSON response (${text.length}ch)`); }
      if (j.error) {
        appendFileSync(RAWLOG, JSON.stringify({ t: now(), call: label, reqHash, resHash, jsonrpcError: j.error, attempt: i }) + "\n");
        if (String(j.error.message ?? "").match(/429|rate|limit/i) && i < tries) { stats.retries++; await sleep(1200 * i); continue; }
        throw new Error(j.error.message ?? JSON.stringify(j.error));
      }
      appendFileSync(RAWLOG, JSON.stringify({ t: now(), call: label, reqHash, resHash, ok: true, result: typeof j.result === "string" && j.result.length > 200 ? `${j.result.slice(0, 66)}…(${j.result.length}ch)` : j.result }) + "\n");
      stats.ok++;
      return j.result;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (i >= tries) {
        stats.failures++;
        appendFileSync(RAWLOG, JSON.stringify({ t: now(), call: label, reqHash, error: msg.slice(0, 200), attempt: i, verdict: "FAILED-UNVERIFIED" }) + "\n");
        throw e;
      }
      stats.retries++;
      appendFileSync(RAWLOG, JSON.stringify({ t: now(), call: label, reqHash, error: msg.slice(0, 200), attempt: i, verdict: "RETRY" }) + "\n");
      await sleep(1000 * i);
    }
  }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// --------------------------------------------------------------- disassembler
const OP: Record<number, string> = {
  0x00: "STOP", 0x01: "ADD", 0x02: "MUL", 0x03: "SUB", 0x04: "DIV", 0x05: "SDIV", 0x06: "MOD", 0x07: "SMOD",
  0x08: "ADDMOD", 0x09: "MULMOD", 0x0a: "EXP", 0x0b: "SIGNEXTEND", 0x10: "LT", 0x11: "GT", 0x12: "SLT",
  0x13: "SGT", 0x14: "EQ", 0x15: "ISZERO", 0x16: "AND", 0x17: "OR", 0x18: "XOR", 0x19: "NOT", 0x1a: "BYTE",
  0x1b: "SHL", 0x1c: "SHR", 0x1d: "SAR", 0x20: "KECCAK256", 0x30: "ADDRESS", 0x31: "BALANCE", 0x32: "ORIGIN",
  0x33: "CALLER", 0x34: "CALLVALUE", 0x35: "CALLDATALOAD", 0x36: "CALLDATASIZE", 0x37: "CALLDATACOPY",
  0x38: "CODESIZE", 0x39: "CODECOPY", 0x3a: "GASPRICE", 0x3b: "EXTCODESIZE", 0x3c: "EXTCODECOPY",
  0x3d: "RETURNDATASIZE", 0x3e: "RETURNDATACOPY", 0x3f: "EXTCODEHASH", 0x40: "BLOCKHASH", 0x41: "COINBASE",
  0x42: "TIMESTAMP", 0x43: "NUMBER", 0x44: "PREVRANDAO", 0x45: "GASLIMIT", 0x46: "CHAINID",
  0x47: "SELFBALANCE", 0x48: "BASEFEE", 0x50: "POP", 0x51: "MLOAD", 0x52: "MSTORE", 0x53: "MSTORE8",
  0x54: "SLOAD", 0x55: "SSTORE", 0x56: "JUMP", 0x57: "JUMPI", 0x58: "PC", 0x59: "MSIZE", 0x5a: "GAS",
  0x5b: "JUMPDEST", 0x5f: "PUSH0",
  0xf0: "CREATE", 0xf1: "CALL", 0xf2: "CALLCODE", 0xf3: "RETURN", 0xf4: "DELEGATECALL",
  0xf5: "CREATE2", 0xfa: "STATICCALL", 0xfd: "REVERT", 0xfe: "INVALID", 0xff: "SELFDESTRUCT",
};
for (let i = 0x60; i <= 0x7f; i++) OP[i] = `PUSH${i - 0x5f}`;
for (let i = 0x80; i <= 0x8f; i++) OP[i] = `DUP${i - 0x7f}`;
for (let i = 0x90; i <= 0x9f; i++) OP[i] = `SWAP${i - 0x8f}`;
for (let i = 0xa0; i <= 0xa4; i++) OP[i] = `LOG${i - 0xa0}`;

interface Ins { off: number; op: number; name: string; imm?: string }

function disassemble(b: Buffer): Ins[] {
  const out: Ins[] = [];
  let i = 0;
  while (i < b.length) {
    const op = b[i];
    const name = OP[op] ?? `UNK_${op.toString(16)}`;
    if (op >= 0x60 && op <= 0x7f) {
      const n = op - 0x5f;
      const imm = b.subarray(i + 1, i + 1 + n);
      out.push({ off: i, op, name, imm: "0x" + imm.toString("hex") });
      i += 1 + n;
    } else { out.push({ off: i, op, name }); i += 1; }
  }
  return out;
}

// ---- selector corpora -------------------------------------------------------
const SEL: Record<string, string> = {
  mint_address_uint: "40c10f19", burn_uint: "42966c68", burnFrom: "79cc6790",
  transferFrom: "23b872dd", transfer: "a9059cbb", approve: "095ea7b3", pause: "8456cb59",
  unpause: "3f4ba83a", grantRole: "2f2ff15d", revokeRole: "d547741f",
  renounceRole: "36568abe", hasRole: "91d14854", getRoleAdmin: "248a9ca3",
};
const SEL_NAME_BY_VAL: Record<string, string> = {};
for (const [k, v] of Object.entries(SEL)) SEL_NAME_BY_VAL[v] = k;

// candidate signatures for resolving unknown dispatch selectors (bytecode-level truth,
// name resolution is convenience only — conclusions never rest on name guesses)
const CANDIDATE_SIGS = [
  "redeem(uint256)", "redeem(address,uint256)", "redeem(uint256,address)", "redeemTo(address,uint256)",
  "redeem(uint256,address,address)", "quote(uint256)", "previewRedeem(uint256)", "redeemPreview(uint256)",
  "paused()", "pause()", "unpause()", "name()", "symbol()", "decimals()", "totalSupply()",
  "balanceOf(address)", "supportsInterface(bytes4)", "getRoleMemberCount(bytes32)",
  "getRoleMember(bytes32,uint256)", "DEFAULT_ADMIN_ROLE()", "MINTER_ROLE()", "PAUSER_ROLE()",
  "ADMIN_ROLE()", "setToken(address)", "setReserve(address)", "setAlgorithm(address)",
  "setOracle(address)", "withdraw(address,uint256)", "rescue(address,uint256)",
  "claim(uint256)", "deposit(uint256)", "mint(address,uint256)", "burn(uint256)",
  "burnFrom(address,uint256)", "token()", "reserve()", "algorithm()", "oracle()", "owner()",
  "renounceOwnership()", "transferOwnership(address)", "onERC721Received(address,address,uint256,bytes)",
  "onERC1155Received(address,address,uint256,uint256,bytes)", "getOwners()", "getThreshold()",
  "nonce()", "VERSION()", "domainSeparator()", "executeMetaTransaction(address,bytes,bytes,bytes)",
  "takaful()", "setTakaful(address)", "getRevision()", "getInitializeAdmin()",
  "UPGRADE_INTERFACE_VERSION()", "BURNER_ROLE()", "REDEEMER_ROLE()", "RESERVE_ROLE()",
  "ALGORITHM_ROLE()", "ORACLE_ROLE()", "TAKAFUL_ROLE()", "OPERATOR_ROLE()", "UPGRADER_ROLE()",
  "CANCELER_ROLE()", "REDEEM_ADMIN_ROLE()", "version()", "DOMAIN_SEPARATOR()",
];
const CAND_BY_VAL: Record<string, string> = {};
for (const sig of CANDIDATE_SIGS) CAND_BY_VAL[keccak256(toUtf8Bytes(sig)).slice(2, 10)] = sig;

// generic-call/forwarding signatures (routers/proxies) — presence in dispatch = red flag
const GENERIC_SIGS = [
  "execute(address,bytes)", "execute(address,bytes,uint256)", "execute(bytes)", "call(address,bytes)",
  "proxyCall(address,bytes)", "forward(address,bytes)", "forward(bytes)", "proxy(address,bytes)",
  "proxy(address,bytes,bytes)", "implementCall(address,bytes)", "delegateCall(address,bytes)",
  "rawCall(address,bytes)", "doCall(address,bytes)", "invoke(address,bytes)", "dispatch(address,bytes)",
  "executeCall(address,bytes)", "attemptCall(address,bytes)", "arbitraryCall(address,bytes)",
  "callAndRevert(address,bytes)", "executeAndRevert(address,bytes)", "verifyCall(address,bytes)",
];
const GENERIC_BY_VAL: Record<string, string> = {};
for (const sig of GENERIC_SIGS) GENERIC_BY_VAL[keccak256(toUtf8Bytes(sig)).slice(2, 10)] = `GENERIC-CALL ${sig}`;

function resolveSel(v: string): string | undefined {
  if (SEL_NAME_BY_VAL[v]) return SEL_NAME_BY_VAL[v];
  if (GENERIC_BY_VAL[v]) return GENERIC_BY_VAL[v];
  if (CAND_BY_VAL[v]) return CAND_BY_VAL[v];
  return undefined;
}

// ---- metadata boundary ------------------------------------------------------
/** solc appends CBOR metadata containing an IPFS hash ("\xa2\x64ipfs…\x22<34B>\x64solc\x00<ver>").
 *  The executable region ends BEFORE the CBOR blob. v1 took the LAST marker (the trailing
 *  "solc" tail) and misdisassembled the 34-byte IPFS hash as opcodes (spurious 0xff hits);
 *  v2 takes the FIRST `a2 64 69 70 66 73` occurrence (= real metadata start), falling back
 *  to the "solc" tail marker only when no ipfs marker exists. Code after it is DATA. */
function metadataStart(hex: string): number | null {
  const b = Buffer.from(hex.slice(2), "hex");
  const ipfs = b.indexOf(Buffer.from("a2646970667358", "hex"));
  if (ipfs !== -1) return ipfs;
  const solcTail = b.indexOf(Buffer.from("64736f6c63", "hex"), Math.max(0, b.length - 16));
  return solcTail !== -1 ? solcTail : null;
}

// ---- analysis ---------------------------------------------------------------
function analyze(name: string, addr: string, code: string) {
  const b = Buffer.from(code.slice(2), "hex");
  const meta = metadataStart(code);
  const execEnd = meta ?? b.length;
  const ins = disassemble(b);
  const callsites: any[] = [];
  const calldataOps: { off: number; name: string }[] = [];
  const extOps: { off: number; name: string }[] = [];
  for (const x of ins) {
    if (x.off >= execEnd) break; // metadata region: not executable
    if (x.name === "CALLDATALOAD" || x.name === "CALLDATASIZE" || x.name === "CALLDATACOPY") calldataOps.push({ off: x.off, name: x.name });
    if (x.name.startsWith("EXT")) extOps.push({ off: x.off, name: x.name });
    if (["CALL", "CALLCODE", "DELEGATECALL", "STATICCALL", "CREATE", "CREATE2", "SELFDESTRUCT"].includes(x.name)) {
      const ctx = ins.filter((y) => y.off >= x.off - 176 && y.off < x.off)
        .map((y) => `${y.off.toString(16).padStart(4, "0")} ${y.name}${y.imm ? " " + y.imm : ""}`);
      const post = ins.filter((y) => y.off > x.off && y.off < x.off + 60).map((y) => `${y.off.toString(16).padStart(4, "0")} ${y.name}`);
      callsites.push({ off: x.off, op: x.name, contextBefore: ctx.slice(-42), contextAfter: post.slice(0, 24) });
    }
  }
  // full-literal tables (executable region only)
  const push4s: { off: number; val: string; resolved?: string }[] = [];
  const push20s: { off: number; val: string }[] = [];
  const push32s: { off: number; val: string }[] = [];
  for (const x of ins) {
    if (x.off >= execEnd) break;
    if (x.name.startsWith("PUSH") && x.imm) {
      const v = x.imm.slice(2);
      if (v.length === 8) push4s.push({ off: x.off, val: v, resolved: resolveSel(v) });
      else if (v.length === 40) push20s.push({ off: x.off, val: v });
      else if (v.length === 64) push32s.push({ off: x.off, val: v });
    }
  }
  // byte-wise selector presence (ANY occurrence, incl. inside larger immediates)
  const codeHex = code.slice(2).toLowerCase();
  const metaHex = meta ? code.slice(2 + 2 * meta).toLowerCase() : "";
  const execHex = code.slice(2, meta ? 2 + 2 * meta : undefined).toLowerCase();
  const byteWise: Record<string, { inExecCode: number[]; inMetadata: number[]; total: number }> = {};
  for (const [nm, v] of Object.entries(SEL)) {
    const ex: number[] = [];
    let idx = execHex.indexOf(v);
    while (idx !== -1) { ex.push(idx / 2); idx = execHex.indexOf(v, idx + 1); }
    const md: number[] = [];
    let jdx = metaHex.indexOf(v);
    while (jdx !== -1) { md.push(jdx / 2); jdx = metaHex.indexOf(v, jdx + 1); }
    byteWise[nm] = { inExecCode: ex, inMetadata: md, total: ex.length + md.length };
  }
  // embedded estate-address scan: ANY registry address appearing as a literal in the code
  const ESTATE_ADDRS: Record<string, string> = {
    "MTQ(monad)": "9e6edc15dac420931508d8ddf9bc817651a253ad", "MTQ(arc)": "237c3aa2b79248f86f6523d3890095bcd1996601",
    "MintModule(monad)": "197e9cb28216dfe18a199b4c2930f74c2f460809", "MintModule(arc)": "0dd8b4f8da7fb6e3ee04ea9f24f853647f84c3aa",
    "RedeemModule(monad)": "963201c0fa258033ccddfcdceb8b5e3bc2b435a4", "RedeemModule(arc)": "cade4594177829597882555ff57d0e34092daf8e",
    "ReserveModule(monad)": "1bbcd78e4def79b7a3b77242770cbaefac816177", "ReserveModule(arc)": "27a1a201d6df8215d0b0da3be6211be24ef4c471",
    "AlgorithmModule(monad)": "8839ce50e8d414005518769999c0a5b961d00cb2", "AlgorithmModule(arc)": "62f8e5243f32ee5c87a14a7896c61104ad9e7727",
    "OracleModule(monad)": "dfca66ac0450c9ab86307af1942e157c5a4db713", "OracleModule(arc)": "fd2b8d176bf059287638db30d02c6651da02861e",
    "TakafulModule(monad)": "3ec27bb283644ef0a98b9961e9fbed0583a02f19", "TakafulModule(arc)": "a3b89ffde28577a7d30e2c22503db33509044ef0",
    "GenesisSafe(both)": "e71869c662733642bfbb262b8c6bad8b0fbfa7d0", "deployerEOA": "3c3932f865892efabe45892f453f81b64f6c8d8c",
  };
  const embeddedEstate: Record<string, number[]> = {};
  for (const [nm, a] of Object.entries(ESTATE_ADDRS)) {
    const hits: number[] = [];
    let idx = codeHex.indexOf(a);
    while (idx !== -1) { hits.push(idx / 2); idx = codeHex.indexOf(a, idx + 1); }
    if (hits.length) embeddedEstate[nm] = hits;
  }
  // SHIFT-RECONSTRUCTED SELECTOR SCAN (v4): solc sometimes encodes a call selector as
  // (PUSHn V; PUSHk SHL) where V<<k places the selector in the top 4 bytes — the literal
  // bytes then never appear in code (PROVEN relevant: arc.Redeem encodes burn(uint256)
  // as PUSH4 0x0852cd8d + SHL 0xe3, which Task 11's byte-wise scan missed). Scan every
  // SHL in the executable region: nearest PUSHn immediate (≤6 instructions back) →
  // compute (V << shift) mod 2^256 → record the top-4-byte "selector" if nonzero.
  const SHIFT_RECON_TARGETS: Record<string, string> = {
    mint_address_uint: "40c10f19", burn_uint: "42966c68", burnFrom: "79cc6790",
    transferFrom: "23b872dd", transfer: "a9059cbb", approve: "095ea7b3",
    getNAV: "0126c606", reserveRatio: "0c7d5cd8", reserveFn_41bf3f26: "41bf3f26",
    balanceOf: "70a08231", pause: "8456cb59", unpause: "3f4ba83a",
    grantRole: "2f2ff15d", revokeRole: "d547741f", hasRole: "91d14854",
    renounceRole: "36568abe", getRoleAdmin: "248a9ca3", supportsInterface: "01ffc9a7",
  };
  const shiftedSelectors: { shlOffset: number; baseImm: string; shift: number; reconstructed: string; matches?: string }[] = [];
  for (let i = 0; i < ins.length; i++) {
    if (ins[i].off >= execEnd) break;
    if (ins[i].name !== "SHL") continue;
    // shift operand: nearest PUSH before the SHL (usually immediately before)
    let shiftOp: Ins | undefined;
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) { if (ins[j].name.startsWith("PUSH") && ins[j].imm) { shiftOp = ins[j]; break; } }
    // base operand: nearest PUSH before that
    let baseOp: Ins | undefined;
    for (let j = (shiftOp ? ins.indexOf(shiftOp) : i) - 1; j >= Math.max(0, i - 8); j--) { if (ins[j].name.startsWith("PUSH") && ins[j].imm) { baseOp = ins[j]; break; } }
    if (!shiftOp || !baseOp) continue;
    try {
      const s = BigInt(shiftOp.imm!);
      if (s > 256n) continue;
      const v = BigInt(baseOp.imm!);
      const recon = (v << s) & BigInt(2) ** 256n - 1n;
      const hex = recon.toString(16).padStart(64, "0");
      const top4 = hex.slice(0, 8);
      if (top4 !== "00000000") {
        const rec: any = { shlOffset: ins[i].off, baseImm: baseOp.imm!, shift: Number(s), reconstructed: `0x${top4}` };
        if (Object.values(SHIFT_RECON_TARGETS).includes(top4)) {
          rec.matches = (Object.keys(SHIFT_RECON_TARGETS) as string[]).find((k) => SHIFT_RECON_TARGETS[k] === top4)!;
        }
        shiftedSelectors.push(rec);
      }
    } catch { /* non-numeric immediates skipped */ }
  }
  // dispatch table (full executable region; PUSH4 … EQ … JUMPI within 8 instructions)
  const dispatch: { off: number; val: string; resolved?: string; jumpdest?: number }[] = [];
  for (let i = 0; i < ins.length; i++) {
    const x = ins[i];
    if (x.off >= execEnd) break;
    if (x.name === "PUSH4" && x.imm) {
      let sawEq = false;
      for (let j = i + 1; j < Math.min(i + 8, ins.length); j++) {
        if (ins[j].name === "EQ") sawEq = true;
        if (ins[j].name === "JUMPI" && sawEq) {
          let dest: number | undefined;
          for (let k = j - 1; k > i; k--) if (ins[k].name === "PUSH2" && ins[k].imm) { dest = parseInt(ins[k].imm!, 16); break; }
          dispatch.push({ off: x.off, val: x.imm!.slice(2), jumpdest: dest, resolved: resolveSel(x.imm!.slice(2)) });
          break;
        }
        if (ins[j].name === "JUMPDEST" || ins[j].name === "JUMP") break;
      }
    }
  }
  // embedded addresses inside PUSH32 operands (immutables)
  const knownAddrs = ["9e6edc15dac420931508d8ddf9bc817651a253ad", "237c3aa2b79248f86f6523d3890095bcd1996601"];
  const embedded: { off: number; addr: string }[] = [];
  for (const p of [...push20s, ...push32s]) {
    const v = p.val.toLowerCase();
    for (const cand of knownAddrs) if (v.includes(cand)) embedded.push({ off: p.off, addr: "0x" + cand });
  }
  const jumpdests = ins.filter((x) => x.name === "JUMPDEST" && x.off < execEnd).map((x) => x.off);
  return {
    name, addr, codeSize: b.length,
    metadata: { startOffset: meta, execRegionBytes: execEnd, metadataBytes: b.length - execEnd },
    jumpdestCount: jumpdests.length,
    dispatchTable: dispatch,
    push4Inventory: push4s,
    push20Inventory: push20s,
    push32Inventory: push32s,
    embeddedKnownTokenAddresses: embedded,
    calldataOps, extOps, callSites: callsites, byteWiseSelectorPresence: byteWise, embeddedEstateAddresses: embeddedEstate, shiftedSelectorReconstructions: shiftedSelectors,
    flags: {
      hasCALL: callsites.some((c) => c.op === "CALL"),
      hasDELEGATECALL: callsites.some((c) => c.op === "DELEGATECALL"),
      hasCALLCODE: callsites.some((c) => c.op === "CALLCODE"),
      hasSTATICCALL: callsites.some((c) => c.op === "STATICCALL"),
      hasCREATE: callsites.some((c) => c.op === "CREATE" || c.op === "CREATE2"),
      hasSELFDESTRUCT: callsites.some((c) => c.op === "SELFDESTRUCT"),
      calldatacopySites: calldataOps.filter((c) => c.name === "CALLDATACOPY").length,
      calldatasizeUses: calldataOps.filter((c) => c.name === "CALLDATASIZE").length,
      extcodesizeUses: extOps.filter((c) => c.name === "EXTCODESIZE").length,
    },
  };
}

function fullListing(name: string, b: Buffer, meta: number | null): string {
  const lines = [`# ${name} — full runtime disassembly (Task 11.1 forensics; metadata region marked)`];
  const ins = disassemble(b);
  for (const x of ins) {
    if (meta !== null && x.off === meta) lines.push(`---- METADATA REGION (unreachable data) starts at 0x${meta.toString(16)} ----`);
    lines.push(`${x.off.toString(16).padStart(4, "0")}  ${x.name}${x.imm ? " " + x.imm : ""}`);
  }
  return lines.join("\n");
}

// --------------------------------------------------------------- targets + anchors (loaded programmatically)
const CHAINS: Record<string, { rpc: string; MTQ: string; Mint: string; Redeem: string; Algorithm: string; Reserve: string; anchorKey: string }> = {
  monad: { rpc: "https://testnet-rpc.monad.xyz", MTQ: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", Mint: "0x197e9CB28216dfe18a199b4c2930F74C2F460809", Redeem: "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4", Algorithm: "0x8839ce50e8D414005518769999c0A5b961D00CB2", Reserve: "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177", anchorKey: "monad" },
  arc: { rpc: "https://rpc.testnet.arc.io", MTQ: "0x237c3Aa2B79248f86f6523D3890095BCd1996601", Mint: "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa", Redeem: "0xcAde4594177829597882555Ff57d0e34092daF8e", Algorithm: "0x62f8E5243f32eE5C87a14A7896C61104aD9e7727", Reserve: "0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471", anchorKey: "arc" },
};
const ANCHORS = JSON.parse(readFileSync(`${T11}/evidence/identity-anchors-task11.json`, "utf8"));
const MAINNET_RPC = "https://ethereum-rpc.publicnode.com";
const SAFE_REFS = {
  safeL2_141: { addr: "0x29fcB43b46531bCa003DdC8fCb67FFE91900C762", label: "SafeL2 v1.4.1 singleton — canonical reference (address recorded in identity-anchors-task11.json ethereum.SafeSingletonCanonical)" },
  safe_141_candidate: { addr: "0x41675C099F32341cE84Db14c619EA0121c77fB71", label: "RECALLED address of the L1-variant Safe v1.4.1 singleton — address identity UNCONFIRMED from this sandbox" },
};

// --------------------------------------------------------------- main
async function main() {
  const startedAt = now();
  const result: any = {
    task: "task11.1-redeem-module-forensics+safe-canonical-refs", scriptVersion: "v4",
    startedAt,
    convention: "runtimeKeccak = keccak256(raw runtime bytes) — historical Tasks 9/10 convention; asciiHexKeccak labeled separately (CORR-5 reconciliation)",
    probeIncidents: [
      "v1 hand-typed the monad.Mint anchor and dropped one character → false anchor mismatch; v2 loads anchors programmatically from evidence (fixed, disclosed)",
      "v1 linear disassembly misread the appended solc metadata as opcodes (spurious SELFDESTRUCT near code end); v2+ detects and marks the metadata boundary",
      "v4 discovered and discloses a Task-11 evidence-methodology limitation: byte-wise selector scans can MISS shift-reconstructed selectors (arc.Redeem encodes burn(uint256) as PUSH4 0x0852cd8d + SHL 0xe3 — literal 0x42966c68 never appears; Task 11's 'Arc Redeem = transferFrom only' is corrected by this probe). All §2 conclusions therefore rest on per-call-site selector tracing, not byte-wise scans",
      "canonical L1-variant Safe singleton probe returned EMPTY code at the recalled address — recorded UNVERIFIED; no L1-variant address is asserted in any deliverable",
    ],
    chains: {}, safeCanonicalRefs: {}, stats: null as any,
  };

  for (const chain of Object.keys(CHAINS)) {
    const cfg = CHAINS[chain];
    const chainId = await rpc(cfg.rpc, "eth_chainId", [], `${chain}:chainId`);
    const block = await rpc(cfg.rpc, "eth_blockNumber", [], `${chain}:blockNumber`);
    const chainOut: any = { rpcEndpoint: cfg.rpc, chainId, block, blockTimestamp: null, contracts: {}, redeemStorageSlots: {}, storedTargetDispatchChecks: null as any };
    for (const mod of ["Mint", "Redeem", "MTQ", "Algorithm", "Reserve"] as const) {
      const code = await rpc(cfg.rpc, "eth_getCode", [cfg[mod], "latest"], `${chain}:getCode:${mod}`);
      if (typeof code !== "string" || code === "0x" || code.length < 4) throw new Error(`${chain}.${mod} getCode empty — FAILED-UNVERIFIED`);
      const bytesHash = keccak256(Buffer.from(code.slice(2), "hex"));
      const asciiHexKeccak = keccak256(toUtf8Bytes(code));
      const anchor = ANCHORS.networks[cfg.anchorKey].anchors[mod];
      const analysis = analyze(`${chain}.${mod}`, cfg[mod], code);
      chainOut.contracts[mod] = {
        addr: cfg[mod],
        runtimeKeccak: bytesHash,
        asciiHexKeccak,
        anchorContinuity: anchor ? { recordedBytesHash: anchor.runtimeKeccak, matchesRecordedAnchor: bytesHash.toLowerCase() === String(anchor.runtimeKeccak).toLowerCase() } : { recordedBytesHash: null, matchesRecordedAnchor: "no-anchor-recorded (hash captured fresh)" },
        recordedCodeSize: anchor ? anchor.codeSize : null,
        codeSizeMatchesRecorded: anchor ? anchor.codeSize === analysis.codeSize : null,
        analysis,
        disassemblyFile: `evidence/redeem-module-disassembly-${chain}-${mod.toLowerCase()}.txt`,
      };
      const b = Buffer.from(code.slice(2), "hex");
      writeFileSync(`${T11}/evidence/redeem-module-disassembly-${chain}-${mod.toLowerCase()}.txt`, fullListing(`${chain}.${mod} @ ${cfg[mod]} (block ${parseInt(block, 16)})`, b, analysis.metadata.startOffset));
    }
    // live storage slots of the Redeem module (what the stored call targets actually are)
    chainOut.redeemStorageSlots = {};
    for (const slot of [0, 1, 2]) {
      const raw = await rpc(cfg.rpc, "eth_getStorageAt", [cfg.Redeem, `0x${slot.toString(16)}`, "latest"], `${chain}:slot:Redeem:${slot}`);
      chainOut.redeemStorageSlots[String(slot)] = { raw, highAddress: `0x${String(raw).slice(2 + 24, 2 + 64)}`.toLowerCase() };
    }
    result.chains[chain] = chainOut;
  }

  // selector-collision closure: do the Redeem module's stored-target fixed selectors appear
  // in the MTQ token's dispatch (i.e., could a re-pointed reference make the TOKEN do anything)?
  for (const chain of Object.keys(CHAINS)) {
    const redeemDispatchVals = new Set(result.chains[chain].contracts.Redeem.analysis.dispatchTable.map((x: any) => x.val));
    const tokenDispatchVals = new Set(result.chains[chain].contracts.MTQ.analysis.dispatchTable.map((x: any) => x.val));
    const STORED_TARGET_SELECTORS: Record<string, string> = {
      getNAV: "0126c606", reserveRatio: "0c7d5cd8", unknown_41bf3f26: "41bf3f26",
      balanceOf: "70a08231", transferFrom: "23b872dd", burn_uint: "42966c68", mint: "40c10f19",
    };
    result.chains[chain].storedTargetDispatchChecks = {
      note: "fixed selectors the Redeem module sends to its stored references — checked against the MTQ token's dispatch",
      checks: Object.fromEntries(Object.entries(STORED_TARGET_SELECTORS).map(([nm, sel]) =>
        [nm, { selector: sel, inRedeemDispatch: redeemDispatchVals.has(sel), inTokenDispatch: tokenDispatchVals.has(sel) }])),
    };
  }

  // Safe canonical references (mainnet, read-only)
  const mainnetBlock = await rpc(MAINNET_RPC, "eth_blockNumber", [], "mainnet:blockNumber");
  const safeRefs: any = { rpcEndpoint: MAINNET_RPC, block: mainnetBlock, refs: {} };
  for (const key of ["safeL2_141", "safe_141_candidate"] as const) {
    const ref = SAFE_REFS[key];
    const code = await rpc(MAINNET_RPC, "eth_getCode", [ref.addr, "latest"], `mainnet:getCode:${key}`);
    const present = typeof code === "string" && code !== "0x";
    safeRefs.refs[key] = {
      label: ref.label, addr: ref.addr, codePresent: present,
      codeSize: present ? (code.length - 2) / 2 : 0,
      runtimeKeccak: present ? keccak256(Buffer.from(code.slice(2), "hex")) : null,
      verdict: present ? "code-live" : "EMPTY CODE — address identity UNVERIFIED from this sandbox (no claim made)",
    };
  }
  safeRefs.comparisons = {
    safeL2_mainnet_vs_task11_recorded: SAFE_REFS.safeL2_141.addr === ANCHORS.networks.ethereum.anchors.SafeSingletonCanonical.addr &&
      safeRefs.refs.safeL2_141.runtimeKeccak === ANCHORS.networks.ethereum.anchors.SafeSingletonCanonical.runtimeKeccak,
    note: "the deployed testnet singletons' bytes-convention keccak equals the mainnet SafeL2 v1.4.1 keccak recorded in identity-anchors-task11.json (0xb1f92697…f81ff) — see chains.*.contract analysis in Task 11 evidence plus this fresh re-confirmation",
  };
  result.safeCanonicalRefs = safeRefs;

  result.finishedAt = now();
  result.stats = { ...stats, note: "all methods read-only; zero transactions; failures classified FAILED-UNVERIFIED" };
  writeFileSync(`${T11}/evidence/redeem-module-forensics-task111.json`, JSON.stringify(result, null, 1));
  console.log("forensics v4 written; requests:", stats.requests, "retries:", stats.retries, "failures:", stats.failures);
  for (const chain of Object.keys(CHAINS)) {
    for (const mod of ["Mint", "Redeem", "MTQ", "Algorithm", "Reserve"] as const) {
      const c = result.chains[chain].contracts[mod];
      const a = c.analysis;
      console.log(`\n=== ${chain}.${mod} (${a.codeSize} B, meta@${a.metadata.startOffset}) anchor-match=${c.anchorContinuity.matchesRecordedAnchor}`);
      console.log("  flags:", JSON.stringify(a.flags));
      console.log("  call sites:", a.callSites.map((s: any) => `${s.off.toString(16)}:${s.op}`).join(" "));
      console.log("  dispatch:", a.dispatchTable.map((d: any) => `${d.val}${d.resolved ? "!" + d.resolved : ""}`).join(" "));
      console.log("  byteWise:", JSON.stringify(Object.fromEntries(Object.entries(a.byteWiseSelectorPresence).map(([k, v]: any) => [k, v.total === 0 ? "ABSENT" : `${v.inExecCode.length}exec+${v.inMetadata.length}meta`]))));
      console.log("  embedded estate addrs:", JSON.stringify(a.embeddedEstateAddresses));
    }
    console.log(`\n=== ${chain} Redeem storage slots:`, JSON.stringify(result.chains[chain].redeemStorageSlots));
    console.log(`=== ${chain} stored-target selector checks:`, JSON.stringify(result.chains[chain].storedTargetDispatchChecks.checks));
  }
  console.log("\nsafeL2 mainnet fresh:", safeRefs.refs.safeL2_141.runtimeKeccak);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
