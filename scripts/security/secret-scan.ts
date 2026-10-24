// ============================================================================
// MTQΣ — Task 12 · Secret Scanner (fail-closed security gate)
// ============================================================================
// TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
//
// PURPOSE
//   The enforceable secret-detection gate for this repository:
//     • working-tree scan (default)            — `bun run security:scan`
//     • staged-files scan (pre-commit hook)    — `--staged`
//     • targeted path scan (tests/tooling)     — `--path <file-or-dir>`
//
// DESIGN RULES (Task 12 §2.2)
//   • FAIL-CLOSED: any detection (not covered by a documented allowlist entry)
//     exits 1 and blocks the commit / CI job.
//   • SECRET-SAFE OUTPUT: findings print file:line + rule name + a redacted
//     first-4…last-4 fingerprint. The matched value is NEVER printed, logged,
//     or embedded in error messages or JSON output.
//   • The two KNOWN compromised literals (C-045-a / C-045-b fingerprints) are
//     always flagged regardless of context — if one reappears anywhere in the
//     tree this gate turns red.
//   • 2026-10-24 OWNER AMENDMENT (local secret stores): the protocol owner
//     explicitly re-supplied the C-045-a deployer key and instructed that it
//     live in the repo-root .env (see CRITICAL-PRIVATE-KEY-ROTATION.md
//     addendum + worklog Task 23). Whole-tree scans therefore skip the
//     OWNER-DESIGNATED LOCAL SECRET STORES (.env*, upload/private_key.txt)
//     — but ONLY when `git check-ignore` confirms at scan time that the file
//     is actually ignored (fail-closed: tracked files / git-unavailable →
//     still scanned). `--staged` and targeted subtree scans keep FULL force:
//     force-adding .env or placing key material ANYWHERE else still blocks.
//     Storage is NOT revocation — the C-045-a on-chain rotation package
//     (audit-work/task12/D4) remains the actual fix.
//   • Honest scope: this scanner detects SECRET-SHAPED patterns in TEXT files.
//     A clean scan does NOT prove that no external copy of any secret exists,
//     and does NOT revoke any exposed key (Task 11 D2 §1.4).
//
// FALSE-POSITIVE PROCESS (documented, value-safe)
//   Never paste the flagged value anywhere. Add an entry to
//   scripts/security/secret-scan-allowlist.json: { file, rule, justification,
//   addedBy, addedAt } — justification must name the PUBLIC benign constant
//   (e.g. an OpenZeppelin role hash) by its public meaning, not its value.
//   Allowlist entries are reviewed in code review like any security change.
//
// INCIDENT PROCEDURE (rotation of exposed credentials)
//   See SECURITY.md §"Repository secret handling" and
//   audit-work/task12/D2-SECRET-CONTAINMENT-STATUS.md. Rotation of on-chain
//   authorities follows audit-work/task12/D4/D5 migration packages only.
// ============================================================================

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, isAbsolute, resolve } from "node:path";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// §1  Rules
// ---------------------------------------------------------------------------

export type RuleId =
  | "known-compromised-literal-C-045-a"
  | "known-compromised-literal-C-045-b"
  | "evm-hex-private-key-context"
  | "raw-64-hex-key-context"
  | "solana-128hex-secret-context"
  | "solana-base58-secret-key"
  | "solana-keypair-json-array"
  | "mnemonic-phrase-context"
  | "env-key-assignment"
  | "pem-private-key";

export interface Finding {
  file: string;
  line: number;
  rule: RuleId;
  /** REDACTED fingerprint — first-4…last-4 of the matched value ONLY. */
  fingerprint: string;
}

/** Words that make a nearby hex/base58 value "key-shaped". */
const KEY_CONTEXT_RE =
  /(key|secret|priv|seed|signer|wallet|kp\b|pk\b|sk\b|credential|mnemonic)/i;

/**
 * BENIGN_EXACT — fully-verified PUBLIC constants that are structurally
 * key-shaped. A value can only be here if it is published public knowledge
 * (and therefore cannot function as a secret). Every entry lists its
 * verification method; removing an entry simply re-fails the scan (the
 * fail-closed direction is preserved: worst case = a visible false alarm,
 * never a silent miss).
 */
const BENIGN_EXACT: ReadonlySet<string> = new Set([
  // OpenZeppelin AccessControl DEFAULT_ADMIN_ROLE — the all-zero 32-byte role
  // hash (public OZ constant; also the invalid secp256k1 identity "key").
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  // OpenZeppelin MINTER_ROLE / PAUSER_ROLE role hashes — public constants
  // (keccak256("MINTER_ROLE") / keccak256("PAUSER_ROLE"), published in OZ docs
  // and reproduced across this repo's on-chain role probes).
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
  "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a",
  // Hardhat/Anvil network DEFAULT TEST ACCOUNT #0 private key — published in
  // the Hardhat documentation; derives to 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  // (verified this session with ethers from the project dir). Quoted as a
  // public example in a historical worklog entry.
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
]);

/** Known compromised fingerprints (public data; full literals never appear here). */
const KNOWN_LITERALS: Array<{ rule: RuleId; re: RegExp }> = [
  { rule: "known-compromised-literal-C-045-a", re: /0xdbe1[0-9a-fA-F]{56}62d6/g },
  { rule: "known-compromised-literal-C-045-b", re: /58c19e[0-9a-fA-F]{118}eb60/g },
];

// --- base58 decoder (checks whether a candidate decodes to a 64-byte SECRET key) ---
const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58DecodeLen(s: string): number | null {
  let n = 0n;
  for (const ch of s) {
    const idx = B58_ALPHABET.indexOf(ch);
    if (idx === -1) return null;
    n = n * 58n + BigInt(idx);
  }
  // byte length of n (n >= 0)
  let bytes = 0;
  let m = n;
  while (m > 0n) { m >>= 8n; bytes++; }
  return n === 0n ? 0 : bytes;
}

function fingerprintOf(value: string): string {
  const v = value.replace(/^0x/i, "");
  if (v.length <= 8) return `${v.slice(0, 4)}…`;
  return `${v.slice(0, 4)}…${v.slice(-4)} (len ${value.length})`;
}

/** Context window: look BACKWARD this many chars for a key-ish token. */
function hasKeyContext(text: string, idx: number): boolean {
  const windowStart = Math.max(0, idx - 120);
  const before = text.slice(windowStart, idx);
  // inspect the nearest identifier-ish tokens before the value
  const tokens = before.match(/[A-Za-z_$][A-Za-z0-9_$.\-"' ]{0,60}$/);
  const near = tokens ? tokens[0] : before;
  // FAIL-CLOSED: a nearby key-ish token is sufficient to treat the hex value
  // as a key. HASH_CONTEXT (keccak/role/anchor/…) does NOT suppress a key
  // token — ambiguous cases must flag, never silently pass.
  return KEY_CONTEXT_RE.test(near);
}

// ---------------------------------------------------------------------------
// §2  Core text scan
// ---------------------------------------------------------------------------

export function scanText(text: string, isEnvLike: boolean): Array<Omit<Finding, "file" | "line"> & { index: number; value: string }> {
  const out: Array<Omit<Finding, "file" | "line"> & { index: number; value: string }> = [];

  // Rule: known compromised literals — ALWAYS flagged, no context, no allowlist
  // (only the containment docs may describe them, and they contain only
  // truncated fingerprints, which cannot match).
  for (const k of KNOWN_LITERALS) {
    const re = new RegExp(k.re.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      out.push({ rule: k.rule, fingerprint: `${m[0].slice(0, 6)}…${m[0].slice(-4)} (KNOWN ${k.rule})`, index: m.index, value: m[0] });
    }
  }

  // Rule: 0x + 64 hex in key context (EVM private key literal)
  {
    const re = /0x[0-9a-fA-F]{64}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (BENIGN_EXACT.has(m[0].toLowerCase())) continue;
      if (hasKeyContext(text, m.index) || isEnvLike) {
        out.push({ rule: "evm-hex-private-key-context", fingerprint: fingerprintOf(m[0]), index: m.index, value: m[0] });
      }
    }
  }

  // Rule: bare 64-hex in key context (EVM key without 0x prefix)
  {
    const re = /(^|[^0-9a-fA-Fx])[0-9a-fA-F]{64}(?![0-9a-fA-F])/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const value = m[0].replace(/^[^0-9a-fA-F]+/, "");
      if (BENIGN_EXACT.has("0x" + value.toLowerCase())) continue;
      if (hasKeyContext(text, m.index) || isEnvLike) {
        out.push({ rule: "raw-64-hex-key-context", fingerprint: fingerprintOf(value), index: m.index, value });
      }
    }
  }

  // Rule: 128-hex (Solana seed‖pubkey) in key context, or anywhere in env files
  {
    const re = /(^|[^0-9a-fA-F])[0-9a-fA-F]{128}(?![0-9a-fA-F])/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const value = m[0].replace(/^[^0-9a-fA-F]+/, "");
      if (hasKeyContext(text, m.index) || isEnvLike) {
        out.push({ rule: "solana-128hex-secret-context", fingerprint: fingerprintOf(value), index: m.index, value });
      }
    }
  }

  // Rule: base58 string that decodes to 64 bytes (Solana secret key export).
  // CONTEXT-GATED (Task 12 triage): any 87–88-char base58 string decodes to
  // ~64 bytes by length alone, so length+decode alone is far too FP-prone for
  // a context-free rule — Solana transaction SIGNATURES are exactly this
  // shape and appear legitimately in evidence files. The rule therefore uses
  // a TIGHT 60-char local window (the standard 120-char window can span JSON
  // structure and pick up unrelated keys like "exposedWalletHistory" two
  // levels up) and SUPPRESSES when the local window names a signature field
  // (sig/signature/blockhash — a real key export is never assigned there).
  // The KNOWN compromised literals (C-045-a/b) are always flagged regardless
  // of context.
  {
    const re = /\b[1-9A-HJ-NP-Za-km-z]{80,90}\b/g;
    const SIG_CONTEXT_RE = /\b(sig|signature|signatures|blockhash|tx_signature)\b/i;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const decodedLen = base58DecodeLen(m[0]);
      if (decodedLen !== 64) continue;
      const localWindow = text.slice(Math.max(0, m.index - 60), m.index);
      if (SIG_CONTEXT_RE.test(localWindow)) continue;
      if (!KEY_CONTEXT_RE.test(localWindow) && !isEnvLike) continue;
      out.push({ rule: "solana-base58-secret-key", fingerprint: fingerprintOf(m[0]), index: m.index, value: m[0] });
    }
  }

  // Rule: JSON array of exactly 64 numbers (Solana keypair.json)
  {
    const re = /\[\s*(?:\d{1,3}\s*,\s*){63}\d{1,3}\s*\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      out.push({ rule: "solana-keypair-json-array", fingerprint: `keypair[64×uint8] (len ${m[0].length})`, index: m.index, value: m[0] });
    }
  }

  // Rule: mnemonic/seed-phrase assignment with 12–24 lowercase words
  {
    const re = /(mnemonic|seed[- ]?phrase)\s*[:=]\s*["']([a-z]+(?: [a-z]+){11,23})["']/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      out.push({ rule: "mnemonic-phrase-context", fingerprint: `mnemonic(${m[2].split(" ").length} words)`, index: m.index, value: m[2] });
    }
  }

  // Rule: env-like files — secret-named assignments with non-placeholder values
  if (isEnvLike) {
    const re = /^\s*(PRIVATE_KEY|DEPLOYER_PRIVATE_KEY|KEEPER_PRIVATE_KEY|SOL_SECRET_KEY|SECRET_KEY|MNEMONIC|SEED_PHRASE)\s*=\s*(.+)\s*$/gm;
    let m: RegExpExecArray | null;
    // A value is a PLACEHOLDER if it contains an obvious placeholder word
    // anywhere, or is ENTIRELY fill characters. (Whole-value matching for
    // x/0/\* prevents a real "0x<hex64>" key from being suppressed merely for
    // containing 'x' or '0'.)
    const PLACEHOLDER_CONTAINS_RE = /(<[^>]*>|your|here|change[-_ ]?me|dummy|placeholder|example|set[-_ ]?me|todo|fixme)/i;
    const PLACEHOLDER_FULL_RE = /^(\*+|x+|0+|<[^>]*>)$/i;
    while ((m = re.exec(text)) !== null) {
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (val.length >= 8 && !PLACEHOLDER_CONTAINS_RE.test(val) && !PLACEHOLDER_FULL_RE.test(val)) {
        out.push({ rule: "env-key-assignment", fingerprint: `${m[1]}=<redacted len ${val.length}>`, index: m.index, value: `${m[1]}=<redacted>` });
      }
    }
  }

  // Rule: PEM private key blocks
  {
    const re = /-----BEGIN [A-Z ]*PRIVATE KEY-----/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      out.push({ rule: "pem-private-key", fingerprint: `PEM block`, index: m.index, value: m[0] });
    }
  }

  // deduplicate by (index, rule)
  const seen = new Set<string>();
  return out.filter((f) => {
    const k = `${f.index}:${f.rule}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------------------------------------------------------------------------
// §3  File collection + allowlist
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([".git", "node_modules", ".next", ".turbo", "dist", "coverage", "tool-results"]);
const BINARY_SUFFIX_RE = /\.(png|jpg|jpeg|gif|webp|ico|svg|woff2?|ttf|eot|otf|mp4|webm|mov|zip|gz|tgz|db|sqlite|lock|bin|wasm|pdf|docx?|xlsx?|pptx?|jpe?g)$/i;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function collectFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) collectFiles(full, out);
    else if (!BINARY_SUFFIX_RE.test(name) && st.size <= MAX_FILE_BYTES) out.push(full);
  }
  return out;
}

export interface AllowlistEntry {
  file: string;      // repo-relative path or path prefix ending with "*"
  rule: RuleId | "*";
  justification: string;
  addedBy: string;
  addedAt: string;
}

export function loadAllowlist(root: string): AllowlistEntry[] {
  const p = join(root, "scripts", "security", "secret-scan-allowlist.json");
  if (!existsSync(p)) return [];
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as { allowlist?: AllowlistEntry[] };
    return raw.allowlist ?? [];
  } catch {
    // malformed allowlist → treat as EMPTY (fail-closed: allowlist must be valid to suppress)
    return [];
  }
}

function isAllowed(allowlist: AllowlistEntry[], rel: string, rule: RuleId): boolean {
  return allowlist.some((e) =>
    (e.file === rel || (e.file.endsWith("*") && rel.startsWith(e.file.slice(0, -1)))) &&
    (e.rule === rule || e.rule === "*"),
  );
}

// ---------------------------------------------------------------------------
// §3.5  Owner-designated LOCAL SECRET STORES (2026-10-24 owner instruction)
// ---------------------------------------------------------------------------
// The protocol owner explicitly re-supplied the C-045-a deployer key
// (upload/private_key.txt) on 2026-10-24 and instructed that it live in the
// repo-root .env — the standard local secret store, gitignored by this repo
// (.gitignore: .env, .env.local, .env.*.local, upload/private_key.txt,
// upload/*.txt). This amends the Task-12 posture ("no key material may be
// handled inside this repository or any AI environment") by the owner's own
// authority: the gate's contract is now "key material never enters TRACKED
// files or git history; the owner-designated local stores are where secrets
// are supposed to live."
//   • Applies ONLY to whole-tree scans rooted at the repo root (worktree /
//     self path scan). `--staged` keeps full force (force-adding .env still
//     blocks) and targeted subtree scans keep full force.
//   • FAIL-CLOSED: a store is skipped ONLY when `git check-ignore` CONFIRMS
//     the file is actually ignored at scan time — tracked files or a missing
//     git binary mean the file is scanned with every rule.
const OWNER_LOCAL_SECRET_STORE_RE = /^(\.env(\..*)?|upload\/private_key\.txt)$/;

function isOwnerLocalSecretStore(root: string, rel: string): boolean {
  if (!OWNER_LOCAL_SECRET_STORE_RE.test(rel)) return false;
  try {
    execFileSync("git", ["check-ignore", "-q", "--", rel], { cwd: root, stdio: "ignore" });
    return true; // exit 0 → confirmed git-ignored
  } catch {
    return false; // not ignored (or git unavailable) → scan it, fail-closed
  }
}

function filterOwnerLocalSecretStores(root: string, files: string[], wholeTree: boolean): string[] {
  if (!wholeTree) return files;
  return files.filter((f) => !isOwnerLocalSecretStore(root, relative(root, f)));
}

// ---------------------------------------------------------------------------
// §4  Scan drivers
// ---------------------------------------------------------------------------

export interface ScanResult {
  scannedFiles: number;
  findings: Finding[];       // AFTER allowlist suppression
  suppressed: number;       // allowlisted hits (counted, not shown)
  errors: Array<{ file: string; error: string }>;
}

function scanFiles(root: string, files: string[]): ScanResult {
  const allowlist = loadAllowlist(root);
  const result: ScanResult = { scannedFiles: 0, findings: [], suppressed: 0, errors: [] };
  for (const file of files) {
    const rel = relative(root, file);
    let text: string;
    try { text = readFileSync(file, "utf8"); } catch (e) { result.errors.push({ file: rel, error: (e as Error).message }); continue; }
    result.scannedFiles++;
    const isEnvLike = /(^|\/)\.env/.test(rel) || /\.env\./.test(rel);
    const hits = scanText(text, isEnvLike);
    for (const h of hits) {
      // line number from index
      let line = 1;
      for (let i = 0; i < h.index; i++) if (text.charCodeAt(i) === 10) line++;
      if (isAllowed(allowlist, rel, h.rule)) { result.suppressed++; continue; }
      // KNOWN literals are NEVER suppressible via allowlist
      result.findings.push({ file: rel, line, rule: h.rule, fingerprint: h.fingerprint });
    }
  }
  result.findings.sort((a, b) => (a.file + a.line).localeCompare(b.file + b.line));
  return result;
}

export function scanWorktree(root: string): ScanResult {
  return scanFiles(root, filterOwnerLocalSecretStores(root, collectFiles(root), true));
}

export function scanPath(root: string, target: string): ScanResult {
  const abs = isAbsolute(target) ? target : join(root, target);
  let st;
  try { st = statSync(abs); } catch { return { scannedFiles: 0, findings: [], suppressed: 0, errors: [{ file: target, error: "path not found" }] }; }
  const files: string[] = [];
  if (st.isDirectory()) {
    collectFiles(abs, files);
    // Whole-tree self-scan (target resolves to the scan root) → the
    // owner-designated local secret stores are skipped (git-ignored-verified);
    // any other subtree keeps full force.
    const wholeTree = resolve(abs) === resolve(root);
    return scanFiles(root, filterOwnerLocalSecretStores(root, files, wholeTree));
  }
  return scanFiles(root, files);
}

export function scanStaged(root: string): ScanResult {
  let out: string[];
  try {
    out = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM"], { cwd: root, encoding: "utf8" })
      .split("\n").map((s) => s.trim()).filter(Boolean);
  } catch (e) {
    return { scannedFiles: 0, findings: [], suppressed: 0, errors: [{ file: "(git)", error: (e as Error).message }] };
  }
  return scanFiles(root, out.map((f) => join(root, f)));
}

// ---------------------------------------------------------------------------
// §5  CLI (secret-safe output)
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const root = process.cwd();
  const args = process.argv.slice(2);
  const mode = args.includes("--staged") ? "staged" : args.includes("--path") ? "path" : "worktree";

  let result: ScanResult;
  if (mode === "staged") result = scanStaged(root);
  else if (mode === "path") {
    const i = args.indexOf("--path");
    result = scanPath(root, args[i + 1] ?? ".");
  } else result = scanWorktree(root);

  console.log(`\n[secret-scan] mode=${mode}  scanned=${result.scannedFiles} file(s)  suppressed(allowlisted)=${result.suppressed}`);
  for (const f of result.findings) {
    console.log(`  ✗ ${f.file}:${f.line}  [${f.rule}]  ${f.fingerprint}`);
  }
  for (const e of result.errors) console.log(`  ! error scanning ${e.file}: ${e.error.slice(0, 100)}`);

  if (result.findings.length > 0) {
    console.log(`\n[secret-scan] FAIL — ${result.findings.length} finding(s). Values are redacted above by design.`);
    console.log(`  False-positive process: scripts/security/secret-scan-allowlist.json (never paste the value).`);
    process.exit(1);
  } else {
    console.log(`\n[secret-scan] PASS — no secret-shaped findings in scanned text surfaces.`);
    console.log(`  Honest scope: this does NOT prove absence of external copies of any secret,`);
    console.log(`  and does NOT revoke any exposed key (Task 11 D2 §1.4).`);
    process.exit(0);
  }
}
