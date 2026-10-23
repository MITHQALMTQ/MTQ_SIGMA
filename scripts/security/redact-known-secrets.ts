// ============================================================================
// MTQΣ — Task 12 K-1 · Known-Secret Redaction Tool (C-045-a / C-045-b)
// ============================================================================
// TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
//
// PURPOSE
//   Remove the two KNOWN compromised key literals (incident C-045-a EVM deployer
//   key; incident C-045-b Solana 4saT key) from the ACTIVE working tree, without
//   any secret value ever being printed, logged, or echoed.
//
// DISCIPLINE (per audit-work/task11 D2 + Task 12 §2.1):
//   - Patterns are FINGERPRINT-ANCHORED (first-6…last-4 as published in the
//     Task 10/11 incident reports). The full literal is NEVER present in this
//     file and is NEVER emitted by this tool.
//   - Output contains ONLY: file paths, per-rule match counts, and sha256
//     digests before/after. A redaction marker carries the fingerprint, which
//     is public.
//   - worklog.md gets an IN-PLACE REDACTION NOTICE (never silent deletion of
//     log history — the surrounding sentence is preserved).
//   - Files under tool-results/ that contain a literal are DELETED: they are
//     tool-cache duplicates of preserved originals (worklog.md, keeper source),
//     not forensic evidence; deleting them prevents new unprotected copies.
//   - Git history is NOT touched by this tool (25/25 commits retain the
//     literals until the separately-approved history rewrite — see
//     audit-work/task12/D3-GIT-HISTORY-REMEDIATION-PLAN.md).
//   - Dry-run by default. --execute applies changes. --json emits a
//     machine-readable report (preserved as evidence).
//
// USAGE
//   bun run scripts/security/redact-known-secrets.ts            # dry-run sweep
//   bun run scripts/security/redact-known-secrets.ts --execute  # apply redactions
// ============================================================================

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, relative } from "node:path";

// ---------------------------------------------------------------------------
// §1  Known incident fingerprints (PUBLIC data — from Task 10 D1 / Task 11 D2)
// ---------------------------------------------------------------------------

interface KnownSecret {
  incidentId: string;       // public incident identifier
  fingerprint: string;      // public first-6…last-4 fingerprint
  /** Byte-length-anchored regex. A match == the literal; the literal itself never appears here. */
  pattern: RegExp;
  /** Marker substituted for each occurrence (fingerprint only). */
  marker: string;
}

export const KNOWN_SECRETS: KnownSecret[] = [
  {
    incidentId: "C-045-a",
    fingerprint: "0xdbe1…62d6 (66 chars)",
    // 0x + 64 hex = 66 chars; anchored dbe1…62d6 per the published fingerprint.
    pattern: /0xdbe1[0-9a-fA-F]{56}62d6/g,
    marker: "[REDACTED-2026-10-23-C-045a-EVM-PRIVATE-KEY:fingerprint 0xdbe1…62d6 — see audit-work/task12/D2-SECRET-CONTAINMENT-STATUS.md]",
  },
  {
    incidentId: "C-045-b",
    fingerprint: "58c19e…eb60 (128 hex chars)",
    // 128 hex = seed‖pubkey; anchored 58c19e…eb60 per the published fingerprint.
    pattern: /58c19e[0-9a-fA-F]{118}eb60/g,
    marker: "[REDACTED-2026-10-23-C-045b-SOLANA-SECRET-KEY:fingerprint 58c19e…eb60 — see audit-work/task12/D2-SECRET-CONTAINMENT-STATUS.md]",
  },
];

// ---------------------------------------------------------------------------
// §1b  Base58 form of C-045-b (found by the Task 12 scanner; missed by the
//      Task 10/11 census). A standard Solana keypair export is seed‖pubkey —
//      the embedded pubkey IS the wallet address. We match ANY 80–90-char
//      base58 string whose embedded last-32 bytes equal the PUBLIC address
//      4saT…cA1d. No secret value appears anywhere in this logic.
// ---------------------------------------------------------------------------

export const C045B_PUBLIC_ADDRESS = "4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d";
const BASE58_MARKER = "[REDACTED-2026-10-23-C-045b-SOLANA-SECRET-KEY-BASE58:fingerprint 2mvV…j13V — see audit-work/task12/D2-SECRET-CONTAINMENT-STATUS.md]";

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(s: string): Uint8Array | null {
  const bytes: number[] = [0];
  for (const ch of s) {
    const val = B58_ALPHABET.indexOf(ch);
    if (val === -1) return null;
    let carry = val;
    for (let i = 0; i < bytes.length; i++) { carry += bytes[i] * 58; bytes[i] = carry & 0xff; carry >>= 8; }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (const ch of s) { if (ch === "1") bytes.push(0); else break; }
  return Uint8Array.from(bytes.reverse());
}
function b58encode(bytes: Uint8Array): string {
  const digits: number[] = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = "";
  for (let i = 0; bytes[i] === 0 && i < bytes.length - 1; i++) out += "1";
  for (let i = digits.length - 1; i >= 0; i--) out += B58_ALPHABET[digits[i]];
  return out;
}

/** Returns redacted text if any base58 C-045-b secret was found, else null. Never prints values. */
function redactBase58C045b(text: string): { count: number; redacted: string } | null {
  const re = /\b[1-9A-HJ-NP-Za-km-z]{80,90}\b/g;
  let count = 0;
  let out: string | null = null;
  let m: RegExpExecArray | null;
  const matches: Array<{ value: string; index: number }> = [];
  while ((m = re.exec(text)) !== null) {
    const dec = b58decode(m[0]);
    if (!dec || dec.length !== 64) continue;
    if (b58encode(dec.slice(32)) !== C045B_PUBLIC_ADDRESS) continue;
    matches.push({ value: m[0], index: m.index });
    count++;
  }
  if (count === 0) return null;
  out = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    out = out!.slice(0, matches[i].index) + BASE58_MARKER + out!.slice(matches[i].index + matches[i].value.length);
  }
  return { count, redacted: out! };
}

// ---------------------------------------------------------------------------
// §2  Sweep configuration
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
// tool-cache directory (never forensic evidence; deleted if contaminated)
const TOOL_CACHE_DIR = join(ROOT, "tool-results");
// directories never entered (git objects stay intact — history remediation is
// a separate, owner-approved plan; node_modules/.next are build caches)
const SKIP_DIRS = new Set([
  ".git", "node_modules", ".next", ".turbo", "dist", "coverage",
]);

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** Recursively collect files under `dir`. */
function collectFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) collectFiles(full, out);
    else out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// §3  Scan + redact
// ---------------------------------------------------------------------------

export interface RedactionReport {
  ranAt: string;
  mode: "dry-run" | "execute";
  scannedFiles: number;
  findings: Array<{
    file: string;
    incidentId: string;
    occurrences: number;
    action: "in-place-redaction" | "delete-tool-cache-copy";
    sha256Before: string;
    sha256After: string | null; // null = dry-run or deleted
  }>;
  errors: Array<{ file: string; error: string }>;
}

export function runRedaction(execute: boolean): RedactionReport {
  const report: RedactionReport = {
    ranAt: new Date().toISOString(),
    mode: execute ? "execute" : "dry-run",
    scannedFiles: 0,
    findings: [],
    errors: [],
  };

  const files = collectFiles(ROOT);
  for (const file of files) {
    const rel = relative(ROOT, file);
    let buf: Buffer;
    try { buf = readFileSync(file); } catch (e) { report.errors.push({ file: rel, error: (e as Error).message }); continue; }
    report.scannedFiles++;

    // utf8 round-trip is safe for DETECTION even on binary files (worst case
    // the regex simply finds nothing); binaries never get written back because
    // only files whose bytes contain a fingerprint-anchored match are touched.
    let text = buf.toString("utf8");
    const shaBefore = sha256(buf);

    // Base58 form of C-045-b (embedded-pubkey match — public address only)
    const b58 = redactBase58C045b(text);
    if (b58) {
      text = b58.redacted;
      const inToolCache = file.startsWith(TOOL_CACHE_DIR + "/") || file.startsWith(TOOL_CACHE_DIR);
      const action: "in-place-redaction" | "delete-tool-cache-copy" =
        inToolCache ? "delete-tool-cache-copy" : "in-place-redaction";
      if (execute && action === "in-place-redaction") {
        try {
          writeFileSync(file, text, "utf8");
          report.findings.push({ file: rel, incidentId: "C-045-b (base58 form)", occurrences: b58.count, action, sha256Before: shaBefore, sha256After: sha256(readFileSync(file)) });
        } catch (e) {
          report.errors.push({ file: rel, error: `write failed: ${(e as Error).message}` });
        }
      } else if (execute && action === "delete-tool-cache-copy") {
        try { unlinkSync(file); report.findings.push({ file: rel, incidentId: "C-045-b (base58 form)", occurrences: b58.count, action, sha256Before: shaBefore, sha256After: null }); }
        catch (e) { report.errors.push({ file: rel, error: `delete failed: ${(e as Error).message}` }); }
      } else if (!execute) {
        report.findings.push({ file: rel, incidentId: "C-045-b (base58 form)", occurrences: b58.count, action, sha256Before: shaBefore, sha256After: null });
      }
    }

    for (const secret of KNOWN_SECRETS) {
      const re = new RegExp(secret.pattern.source, "g");
      const matches = text.match(re);
      if (!matches || matches.length === 0) continue;

      const inToolCache = file.startsWith(TOOL_CACHE_DIR + "/") || file.startsWith(TOOL_CACHE_DIR);
      const action: "in-place-redaction" | "delete-tool-cache-copy" =
        inToolCache ? "delete-tool-cache-copy" : "in-place-redaction";

      if (execute) {
        if (action === "delete-tool-cache-copy") {
          try {
            unlinkSync(file);
            report.findings.push({ file: rel, incidentId: secret.incidentId, occurrences: matches.length, action, sha256Before: shaBefore, sha256After: null });
          } catch (e) {
            report.errors.push({ file: rel, error: `delete failed: ${(e as Error).message}` });
          }
        } else {
          const redacted = text.replace(new RegExp(secret.pattern.source, "g"), secret.marker);
          try {
            writeFileSync(file, redacted, "utf8");
            const shaAfter = sha256(readFileSync(file));
            report.findings.push({ file: rel, incidentId: secret.incidentId, occurrences: matches.length, action, sha256Before: shaBefore, sha256After: shaAfter });
          } catch (e) {
            report.errors.push({ file: rel, error: `write failed: ${(e as Error).message}` });
          }
        }
      } else {
        report.findings.push({ file: rel, incidentId: secret.incidentId, occurrences: matches.length, action, sha256Before: shaBefore, sha256After: null });
      }
      // The matched value is never printed under ANY circumstance.
    }
  }

  return report;
}

// ---------------------------------------------------------------------------
// §4  CLI entry
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const execute = process.argv.includes("--execute");
  const asJson = process.argv.includes("--json");
  const report = runRedaction(execute);

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\n[redact-known-secrets] mode=${report.mode}  scanned=${report.scannedFiles} files`);
    if (report.findings.length === 0) {
      console.log("[redact-known-secrets] NO occurrences of the known C-045-a / C-045-b literals found in the working tree.");
    }
    for (const f of report.findings) {
      console.log(`  ${f.incidentId}: ${f.file} — ${f.occurrences} occurrence(s) → ${f.action}${execute ? "" : " (dry-run)"}`);
      console.log(`    sha256-before=${f.sha256Before}`);
      if (f.sha256After) console.log(`    sha256-after =${f.sha256After}`);
    }
    for (const e of report.errors) console.log(`  ERROR: ${e.file}: ${e.error}`);
    if (report.mode === "dry-run" && report.findings.length > 0) {
      console.log("\n[dry-run] re-run with --execute to apply.");
    }
    console.log(`\n[redact-known-secrets] NOTE: git history still contains both literals in all commits —`);
    console.log(`  history remediation is a separate owner-approved plan (audit-work/task12/D3-GIT-HISTORY-REMEDIATION-PLAN.md).`);
    console.log(`  Repository cleanup does NOT revoke the exposed keys (audit-work/task11/D2-EXPOSURE-SURFACE.md §1.4).\n`);
  }

  // Exit code 0 either way: this is a remediation tool, not a gate. The
  // *scanner* (secret-scan.ts) is the gate.
}
