/**
 * MTQΣ Task 10 — C-045 KEY-EXPOSURE FORENSICS (READ-ONLY, OFFLINE)
 * TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS
 *
 * Constraints honored:
 *  - NEVER prints, logs, or writes any secret literal (only redacted fingerprints
 *    first4…last4 + length, and DERIVED PUBLIC addresses).
 *  - Read-only: inspects files + local git history. Sends NO network request.
 */
import { readFileSync, statSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, extname } from "node:path";
import { createPrivateKey, createPublicKey } from "node:crypto";
import { ethers } from "ethers";

const ROOT = "/home/z/my-project";
const EV = (p: string) => join(ROOT, p);
const now = new Date().toISOString();
const redact = (s: string) =>
  s
    .replace(/0x[0-9a-fA-F]{64}/g, "0x[REDACTED-64HEX]")
    .replace(/[0-9a-fA-F]{128}/g, "[REDACTED-128HEX]");

interface Hit {
  file: string; line?: number; kind: string;
  fingerprint?: string; length?: number; context?: string; keyName?: string;
}
const out: any = { generatedAt: now, task: "task10-c045-forensics", hits: [] as Hit[], notes: [] as string[] };
const hit = (h: Hit) => out.hits.push(h);
const note = (s: string) => out.notes.push(s);

// ---------- 1. Extract the two literals (into memory only) ----------
const vkSrc = readFileSync(EV("scripts/verify-key-and-audit-roles.ts"), "utf8");
const hex64s = [...vkSrc.matchAll(/0x[0-9a-fA-F]{64}/g)].map(m => m[0]);
const KNOWN = {
  admin: "0x" + "0".repeat(64),
  minter: "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
  pauser: "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a",
};
const candidates = hex64s.filter(h => h.toLowerCase() !== KNOWN.admin && h.toLowerCase() !== KNOWN.minter && h.toLowerCase() !== KNOWN.pauser);
if (candidates.length === 0) { console.error("FATAL: no key candidate found in verify-key-and-audit-roles.ts"); process.exit(1); }
const EVM_LIT = candidates[0];
const fp = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)} (len=${s.length})`;

const vhSrc = readFileSync(EV("scripts/verify-hex-key.ts"), "utf8");
const hex128 = vhSrc.match(/const\s+HEX\s*=\s*"([0-9a-fA-F]{128})"/);
const SOL_LIT = hex128 ? hex128[1] : null;
if (!SOL_LIT) note("verify-hex-key.ts: 128-hex literal not found by regex — inspect manually");

out.literals = {
  evm: { fingerprint: fp(EVM_LIT), file: "scripts/verify-key-and-audit-roles.ts", lineHint: 5 },
  sol: SOL_LIT ? { fingerprint: fp(SOL_LIT), file: "scripts/verify-hex-key.ts", lineHint: 5 } : null,
};

// ---------- 2. Classify + derive ----------
const bytes = Buffer.from(EVM_LIT.slice(2), "hex");
const isZero = bytes.every(b => b === 0);
const isRepeated = new Set(bytes).size === 1;
let evmDerived: string | null = null, evmValid = false;
try { const w = new ethers.Wallet(EVM_LIT as any); evmDerived = w.address; evmValid = true; } catch (e: any) { note(`EVM literal not a valid secp256k1 key: ${e.message?.slice(0, 60)}`); }
const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
out.evmAnalysis = {
  byteLength: bytes.length, allZero: isZero, singleRepeatedByte: isRepeated,
  validSecp256k1: evmValid, derivedAddress: evmDerived,
  matchesDeployer: evmDerived ? evmDerived.toLowerCase() === DEPLOYER.toLowerCase() : null,
  classification: isZero || isRepeated ? "PLACEHOLDER-PATTERN"
    : evmDerived?.toLowerCase() === DEPLOYER.toLowerCase() ? "REAL — derives to live privileged deployer EOA"
    : evmValid ? "VALID-KEY-OTHER-ACCOUNT" : "INVALID",
};

// Solana: 64 bytes = 32-byte seed || 32-byte pubkey (Keypair.fromSecretKey layout)
function b58decode(s: string): Buffer {
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const m: number[] = [0];
  for (const c of s) {
    const val = A.indexOf(c); if (val < 0) throw new Error("bad b58 char");
    let carry = val;
    for (let i = 0; i < m.length; i++) { carry += m[i] * 58; m[i] = carry & 0xff; carry >>= 8; }
    while (carry > 0) { m.push(carry & 0xff); carry >>= 8; }
  }
  for (const c of s.slice(0, s.length - 1)) { if (c !== "1") break; m.push(0); }
  return Buffer.from(m.reverse());
}
let solAnalysis: any = null;
if (SOL_LIT) {
  const sb = Buffer.from(SOL_LIT, "hex");
  try {
    const seed = sb.subarray(0, 32), embeddedPub = sb.subarray(32, 64);
    const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]);
    const priv = createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
    const spki = createPublicKey(priv).export({ format: "der", type: "spki" } as any) as Buffer;
    const derivedPub = spki.subarray(spki.length - 32);
    const consistent = derivedPub.equals(embeddedPub);
    let b58 = ""; b58 = b58;
    const encode = (b: Buffer) => { const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"; let n: bigint = 0n; for (const x of b) n = n * 256n + BigInt(x); let s = ""; while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; } for (const x of b) { if (x !== 0) break; s = "1" + s; } return s; };
    const derivedB58 = encode(derivedPub);
    const STATED_WALLET = "4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d";
    const STATED_AUTH = "DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3";
    solAnalysis = {
      byteLength: sb.length, seedEmbeddedPubkeyConsistent: consistent,
      derivedPublicKeyBase58: derivedB58,
      matchesStatedWallet_4saT: derivedB58 === STATED_WALLET,
      matchesMintAuthority_DbFjz: derivedB58 === STATED_AUTH,
      classification: consistent && (derivedB58 === STATED_AUTH || derivedB58 === STATED_WALLET)
        ? "REAL — well-formed Solana keypair for a stated privileged wallet"
        : consistent ? "WELL-FORMED-KEYPAIR-UNKNOWN-ACCOUNT" : "MALFORMED (embedded pubkey ≠ seed-derived pubkey)",
    };
  } catch (e: any) { solAnalysis = { error: e.message?.slice(0, 100) }; }
}
out.solAnalysis = solAnalysis;

// ---------- 3. Working-tree census ----------
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", ".turbo", "coverage"]);
const TEXT_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".txt", ".sol", ".toml", ".yml", ".yaml", ".sh", ".html", ".css", ".example", ".prisma", ".sql", ".py"]);
function* walk(dir: string, depth = 0): Generator<string> {
  if (depth > 6) return;
  let ents: any[];
  try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (e.name.startsWith(".") && dir === ROOT && e.name !== ".env" && e.name !== ".env.example" && e.name !== ".gitignore") continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p, depth + 1);
    else if (e.isFile()) yield p;
  }
}
const files = [...walk(ROOT)];
note(`census scanned ${files.length} files (excl. node_modules/.git/.next)`);

const evmBuf = Buffer.from(EVM_LIT.slice(2), "hex");           // also match without 0x
const evmBuf0x = Buffer.from(EVM_LIT, "utf8");
const solBuf = Buffer.from(SOL_LIT ?? "", "utf8");

for (const f of files) {
  let st; try { st = statSync(f); } catch { continue; }
  if (st.size > 60 * 1024 * 1024) { note(`skip large file ${f} (${st.size} B)`); continue; }
  const raw = readFileSync(f);
  const hasEvm = raw.indexOf(evmBuf0x) >= 0 || raw.indexOf(evmBuf) >= 0;
  const hasSol = SOL_LIT ? raw.indexOf(solBuf) >= 0 : false;
  const rel = f.replace(ROOT + "/", "");
  if (hasEvm) hit({ file: rel, kind: "EXACT-EVM-KEY-LITERAL" });
  if (hasSol) hit({ file: rel, kind: "EXACT-SOL-KEY-LITERAL" });
  const isText = TEXT_EXT.has(extname(f).toLowerCase()) || f.endsWith(".env") || rel.startsWith(".env") || f.endsWith("Caddyfile");
  if (!isText) continue;
  if (st.size > 8 * 1024 * 1024) { // large text (dev.log, raw.jsonl): binary-safe substring scan only
    const s = raw.toString("latin1");
    if (s.includes(EVM_LIT.slice(2))) hit({ file: rel, kind: "EXACT-EVM-KEY-LITERAL (large-file scan)" });
    if (SOL_LIT && s.includes(SOL_LIT)) hit({ file: rel, kind: "EXACT-SOL-KEY-LITERAL (large-file scan)" });
    continue;
  }
  const src = raw.toString("utf8");
  const lines = src.split("\n");
  // generic hex64 scan
  const seen = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) {
    const ms = [...lines[i].matchAll(/0x[0-9a-fA-F]{64}/g)];
    for (const m of ms) {
      const v = m[0].toLowerCase();
      if (v === EVM_LIT.toLowerCase()) { hit({ file: rel, line: i + 1, kind: "EXACT-EVM-KEY-LITERAL" }); continue; }
      if (v === KNOWN.admin || v === KNOWN.minter || v === KNOWN.pauser) { seen.set("rolehash", (seen.get("rolehash") ?? 0) + 1); continue; }
      seen.set("other64", (seen.get("other64") ?? 0) + 1);
      if ((seen.get("other64") ?? 0) <= 3) hit({ file: rel, line: i + 1, kind: "OTHER-HEX64", fingerprint: fp(m[0]), context: redact(lines[i].trim().slice(0, 90)) });
    }
    const m128 = [...lines[i].matchAll(/[0-9a-fA-F]{128}/g)];
    for (const m of m128) {
      if (SOL_LIT && m[0].toLowerCase() === SOL_LIT.toLowerCase()) { hit({ file: rel, line: i + 1, kind: "EXACT-SOL-KEY-LITERAL" }); continue; }
      hit({ file: rel, line: i + 1, kind: "OTHER-HEX128", fingerprint: fp(m[0]), context: redact(lines[i].trim().slice(0, 90)) });
    }
    // base58 long strings (Solana secret keys ~87-88 chars)
    for (const m of [...lines[i].matchAll(/\b[1-9A-HJ-NP-Za-km-z]{80,95}\b/g)]) {
      hit({ file: rel, line: i + 1, kind: "BASE58-LONG-STRING", fingerprint: fp(m[0]), context: redact(lines[i].trim().slice(0, 90)) });
    }
    // Solana keypair JSON array (64 numbers)
    if (/\[\s*(\d+\s*,\s*){60,}\d+\s*\]/.test(lines[i])) hit({ file: rel, line: i + 1, kind: "KEYPAIR-JSON-ARRAY-LOOKALIKE", context: redact(lines[i].trim().slice(0, 60)) });
  }
  if (seen.get("rolehash")) note(`${rel}: ${seen.get("rolehash")} known public role-hash constants (not secrets)`);
}

// ---------- 4. .env files (key names + fingerprints only) ----------
for (const envf of [".env", ".env.example"]) {
  if (!existsSync(EV(envf))) continue;
  const src = readFileSync(EV(envf), "utf8");
  const entries: any[] = [];
  src.split("\n").forEach((l, i) => {
    const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!m) return;
    const val = m[2].trim().replace(/^["']|["']$/g, "");
    const cls = /^0x[0-9a-fA-F]{64}$/i.test(val) ? "hex64-value" : /^[0-9a-fA-F]{128}$/.test(val) ? "hex128-value" : val.length === 0 ? "empty" : "opaque";
    entries.push({ line: i + 1, keyName: m[1], valueClass: cls, valueFingerprint: cls === "empty" ? "(empty)" : fp(val) });
    if (/^0x[0-9a-fA-F]{64}$/i.test(val)) {
      if (val.toLowerCase() === EVM_LIT.toLowerCase()) hit({ file: envf, line: i + 1, kind: "EXACT-EVM-KEY-LITERAL", keyName: m[1] });
      else hit({ file: envf, line: i + 1, kind: "OTHER-HEX64-IN-ENV", keyName: m[1], fingerprint: fp(val) });
    }
  });
  out[envf] = entries;
}

// ---------- 5. Git history census ----------
const git = (...a: string[]) => { try { return execFileSync("git", ["-C", ROOT, ...a], { encoding: "utf8", timeout: 30000 }); } catch (e: any) { return e.stdout ?? ""; } };
out.git = { head: git("rev-parse", "HEAD").trim(), commitCount: git("rev-list", "--all", "--count").trim() };
const commits = git("log", "--all", "--format=%H|%ad|%s", "--date=iso").trim().split("\n").map(l => { const [h, ...r] = l.split("|"); return { h, date: r[0], s: r.slice(1).join("|") }; });
const hist: any[] = [];
for (const c of commits) {
  const filesEvm = git("grep", "-I", "-F", "-l", EVM_LIT, c.h).trim().split("\n").filter(Boolean);
  const filesSol = SOL_LIT ? git("grep", "-I", "-F", "-l", SOL_LIT, c.h).trim().split("\n").filter(Boolean) : [];
  if (filesEvm.length || filesSol.length) hist.push({ commit: c.h.slice(0, 10), date: c.date.slice(0, 19), evmIn: filesEvm, solIn: filesSol });
}
out.gitHistoryCensus = hist;
const firstEvm = hist.find(h => h.evmIn.length);
const firstSol = hist.find(h => h.solIn.length);
out.gitExposureWindow = {
  evmFirstSeenCommit: firstEvm ? { commit: firstEvm.commit, date: firstEvm.date } : null,
  solFirstSeenCommit: firstSol ? { commit: firstSol.commit, date: firstSol.date } : null,
  lastCommit: { commit: commits[0].h.slice(0, 10), date: commits[0].date.slice(0, 19) },
  repoHistoryStart: { commit: commits[commits.length - 1].h.slice(0, 10), date: commits[commits.length - 1].date.slice(0, 19), subject: commits[commits.length - 1].s.slice(0, 120) },
  limitation: "git history begins 2026-10-19 (squashed baseline). Any pre-baseline exposure (Aug-Sep 2026 deployment era) is UNVERIFIABLE from git; treat exposure window lower-bound only.",
};
// host scripts history
for (const f of ["scripts/verify-key-and-audit-roles.ts", "scripts/verify-hex-key.ts", "CRITICAL-PRIVATE-KEY-ROTATION.md", "upload/private_key.txt"]) {
  const logg = git("log", "--follow", "--format=%h|%ad|%s", "--date=iso", "--", f).trim();
  out.git[`file:${f}`] = logg ? logg.split("\n").map(l => { const [h, ...r] = l.split("|"); return `${h} ${r[0].slice(0, 19)} ${r.slice(1).join("|").slice(0, 80)}`; }) : "NEVER-TRACKED-IN-GIT";
}
out.gitignoreRules = (() => { try { return readFileSync(EV(".gitignore"), "utf8").split("\n").filter(l => /private|key|secret|env/i.test(l)); } catch { return []; } })();

// on-disk mtimes of host scripts (timeline)
for (const f of ["scripts/verify-key-and-audit-roles.ts", "scripts/verify-hex-key.ts", "CRITICAL-PRIVATE-KEY-ROTATION.md", "ROLE_ROTATION.md"]) {
  try { out.diskMtimes ??= {}; out.diskMtimes[f] = statSync(EV(f)).mtime.toISOString(); } catch {}
}
try { statSync(EV("upload/private_key.txt")); out.uploadPrivateKeyTxt = "EXISTS-ON-DISK"; } catch { out.uploadPrivateKeyTxt = "ABSENT (referenced by CRITICAL-PRIVATE-KEY-ROTATION.md as the original exposure site)"; }

// ---------- 6. write evidence ----------
const evidencePath = EV("audit-work/task10/evidence/key-incident-forensics.json");
// final redaction pass on the serialized object
const serialized = JSON.stringify(out, null, 2);
const safe = redact(serialized);
// belt & suspenders: never let the literal itself survive
const final = safe.split(EVM_LIT).join("0x[REDACTED-64HEX]").split(EVM_LIT.slice(2)).join("[REDACTED-64HEX]").split(SOL_LIT ?? "___none___").join("[REDACTED-128HEX]");
// (shallow re-parse to keep valid JSON semantics of redaction strings)
writeFileSync(evidencePath, final);
console.log(`evidence → audit-work/task10/evidence/key-incident-forensics.json (${final.length} B)`);

// ---------- 7. redacted summary ----------
console.log(`
=== C-045 FORENSICS SUMMARY (redacted) — generated ${now} ===
EVM literal @ scripts/verify-key-and-audit-roles.ts  ${out.literals.evm.fingerprint}
  validSecp256k1=${out.evmAnalysis.validSecp256k1} allZero=${out.evmAnalysis.allZero} repeatedByte=${out.evmAnalysis.singleRepeatedByte}
  derivedAddress=${out.evmAnalysis.derivedAddress}  matchesDeployer=${out.evmAnalysis.matchesDeployer}
  classification=${out.evmAnalysis.classification}
SOL literal @ scripts/verify-hex-key.ts  ${out.literals.sol?.fingerprint ?? "n/a"}
  ${JSON.stringify(solAnalysis)}
Git exposure window: EVM first seen ${JSON.stringify(out.gitExposureWindow.evmFirstSeenCommit)}; SOL first seen ${JSON.stringify(out.gitExposureWindow.solFirstSeenCommit)}; repo history starts ${out.gitExposureWindow.repoHistoryStart.date} (squashed).
upload/private_key.txt: ${out.uploadPrivateKeyTxt}
Exact-literal hits in working tree / git / env / db / logs:
${out.hits.filter(h => h.kind.startsWith("EXACT")).map(h => `  - ${h.kind}: ${h.file}${h.line ? ":" + h.line : ""}`).join("\n") || "  (none beyond the two host scripts)"}
Other-notable hits (first 25):
${out.hits.filter(h => !h.kind.startsWith("EXACT")).slice(0, 25).map(h => `  - [${h.kind}] ${h.file}${h.line ? ":" + h.line : ""} ${h.fingerprint ?? ""} ${h.keyName ? "key=" + h.keyName : ""} ${h.context ? "| " + h.context : ""}`).join("\n") || "  (none)"}
`);
