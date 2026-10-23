// ============================================================================
// MTQΣ — Task 12 §2.2 · Secret-scanner REGRESSION TEST
// ============================================================================
// Proves the security gate:
//   1. BLOCKS known secret-bearing patterns (seeded SYNTHETIC values — no real
//      key material is used or produced; every seed is derived from a public
//      label by hashing, so it is deterministic, reproducible, and public).
//   2. NEVER prints the seeded value (redaction proof — asserted on captured
//      CLI output).
//   3. PASSES a clean directory (fail-closed, not fail-everything).
//   4. Flags the KNOWN compromised literal SHAPES regardless of context (the
//      middle bytes below are synthetic — the values are NOT the real keys).
//
// Run:  bun test scripts/security/secret-scan.test.ts
// ============================================================================

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { scanText, scanPath, type Finding } from "./secret-scan.ts";

// ---------------------------------------------------------------------------
// §1  Synthetic seed material (all PUBLIC BY CONSTRUCTION — hash-derived)
// ---------------------------------------------------------------------------

/** Deterministic 64-hex from a public label — a synthetic "EVM key literal". */
function syntheticHex64(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

const SEED_EVM = "0x" + syntheticHex64("MTQ-TASK12-REGRESSION-EVM-SEED-v1");
const SEED_ENV = "0x" + syntheticHex64("MTQ-TASK12-REGRESSION-ENV-SEED-v1");
// 64-byte Solana keypair JSON (synthetic, deterministic)
const SEED_KP_JSON = JSON.stringify(
  Array.from({ length: 64 }, (_, i) => (i * 7 + 13) % 256),
);
// Synthetic base58 secret: encode 64 deterministic bytes (sha512-derived) in base58.
const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function syntheticBase58Secret(label: string): string {
  const bytes = Array.from(createHash("sha512").update(label).digest().slice(0, 64));
  const digits: number[] = [0];
  for (const b of bytes) {
    let carry = b;
    for (let j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = "";
  for (let i = digits.length - 1; i >= 0; i--) out += B58_ALPHABET[digits[i]];
  return out;
}
const SEED_B58 = syntheticBase58Secret("MTQ-TASK12-REGRESSION-SOL-SEED-v1");
// Classic all-zero BIP39 test mnemonic — PUBLIC test vector.
const SEED_MNEMONIC = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
// KNOWN-literal SHAPES with SYNTHETIC middle bytes (NOT the real keys — the
// middles are hash-derived from public labels; lengths are exact to the
// published fingerprints: 66 chars total for A, 128 hex total for B).
const SEED_KNOWN_A_SHAPE = "0xdbe1" + syntheticHex64("MTQ-TASK12-REGRESSION-KNOWN-A-MIDDLE").slice(0, 56) + "62d6";
const SEED_KNOWN_B_SHAPE = "58c19e" + (syntheticHex64("MTQ-TASK12-REGRESSION-KNOWN-B-MIDDLE-1") + syntheticHex64("MTQ-TASK12-REGRESSION-KNOWN-B-MIDDLE-2")).slice(0, 118) + "eb60";

let tmpDir: string;

beforeAll(() => {
  // Seeds live in the OS temp dir — OUTSIDE the repository — so the
  // worktree-baseline test below scans a clean tree.
  tmpDir = mkdtempSync(join(tmpdir(), "mtq-secret-scan-regression-"));
  // 1. EVM-style literal with key context
  writeFileSync(join(tmpDir, "seed-evm.ts"), `const privateKey = "${SEED_EVM}"; // SYNTHETIC REGRESSION SEED — not a real key\n`);
  // 2. Solana keypair JSON array
  writeFileSync(join(tmpDir, "seed-keypair.json"), `{"secretKey": ${SEED_KP_JSON}}\n`);
  // 3. env-style assignment
  writeFileSync(join(tmpDir, ".env"), `DEPLOYER_PRIVATE_KEY=${SEED_ENV}\n`);
  // 4. base58 secret with key context
  writeFileSync(join(tmpDir, "seed-b58.ts"), `const secretKey = "${SEED_B58}"; // SYNTHETIC REGRESSION SEED\n`);
  // 5. mnemonic
  writeFileSync(join(tmpDir, "seed-mnemonic.txt"), `mnemonic: "${SEED_MNEMONIC}"\n`);
  // 6. known-literal shapes (context-free detection required)
  writeFileSync(join(tmpDir, "seed-known-shapes.txt"), `random prose with no key words at all ${SEED_KNOWN_A_SHAPE} and ${SEED_KNOWN_B_SHAPE} inline\n`);
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// §2  Core-function assertions
// ---------------------------------------------------------------------------

describe("secret-scanner core rules", () => {
  test("flags EVM hex literal in key context", () => {
    const hits = scanText(`const privateKey = "${SEED_EVM}";`, false);
    expect(hits.some(h => h.rule === "evm-hex-private-key-context")).toBe(true);
  });

  test("does not flag public OZ role constants (BENIGN_EXACT)", () => {
    const text = `const ROLE_MINTER = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";`;
    const hits = scanText(text, false);
    expect(hits.length).toBe(0);
  });

  test("flags Solana keypair JSON array", () => {
    const hits = scanText(`const kp = ${SEED_KP_JSON};`, false);
    expect(hits.some(h => h.rule === "solana-keypair-json-array")).toBe(true);
  });

  test("flags base58 64-byte secret in key context", () => {
    const hits = scanText(`const secretKey = "${SEED_B58}";`, false);
    expect(hits.some(h => h.rule === "solana-base58-secret-key")).toBe(true);
  });

  test("does NOT flag Solana transaction signatures (context-gated)", () => {
    // A 64-byte base58 SIGNATURE under a "sig" field must NOT be flagged.
    const hits = scanText(`{"sig": "${SEED_B58}", "err": null}`, false);
    expect(hits.some(h => h.rule === "solana-base58-secret-key")).toBe(false);
  });

  test("flags env-file key assignment", () => {
    const hits = scanText(`DEPLOYER_PRIVATE_KEY=${SEED_ENV}\n`, true);
    expect(hits.some(h => h.rule === "env-key-assignment")).toBe(true);
  });

  test("does NOT flag obvious env placeholders", () => {
    const hits = scanText(`DEPLOYER_PRIVATE_KEY=0xyour_testnet_deployer_private_key_here\n`, true);
    expect(hits.filter(h => h.rule === "env-key-assignment").length).toBe(0);
  });

  test("flags mnemonic phrase", () => {
    const hits = scanText(`mnemonic: "${SEED_MNEMONIC}"`, false);
    expect(hits.some(h => h.rule === "mnemonic-phrase-context")).toBe(true);
  });

  test("ALWAYS flags the known compromised literal SHAPES, even with no key context (synthetic middles — not the real keys)", () => {
    const hits = scanText(`random prose with no key words at all ${SEED_KNOWN_A_SHAPE} and ${SEED_KNOWN_B_SHAPE} inline`, false);
    expect(hits.some(h => h.rule === "known-compromised-literal-C-045-a")).toBe(true);
    expect(hits.some(h => h.rule === "known-compromised-literal-C-045-b")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §3  Path-driver + CLI assertions (gate blocks; output redacted)
// ---------------------------------------------------------------------------

describe("secret-scanner gate", () => {
  test("scanPath BLOCKS the seeded directory with the expected rules", () => {
    const result = scanPath(process.cwd(), tmpDir);
    const rules = new Set(result.findings.map(f => f.rule));
    expect(rules.has("evm-hex-private-key-context")).toBe(true);
    expect(rules.has("solana-keypair-json-array")).toBe(true);
    expect(rules.has("env-key-assignment")).toBe(true);
    expect(rules.has("solana-base58-secret-key")).toBe(true);
    expect(rules.has("mnemonic-phrase-context")).toBe(true);
    expect(rules.has("known-compromised-literal-C-045-a")).toBe(true);
    expect(rules.has("known-compromised-literal-C-045-b")).toBe(true);
  });

  test("CLI exits 1 on the seeded dir and NEVER prints the seeded values", async () => {
    const proc = Bun.spawn(["bun", "run", join(import.meta.dir, "secret-scan.ts"), "--path", tmpDir], {
      stdout: "pipe", stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    expect(exitCode).toBe(1); // the gate BLOCKS
    // Redaction proof: none of the seeded values may appear in the output
    for (const v of [SEED_EVM, SEED_ENV, SEED_B58, SEED_KP_JSON, SEED_MNEMONIC, SEED_KNOWN_A_SHAPE, SEED_KNOWN_B_SHAPE]) {
      expect(stdout.includes(v)).toBe(false);
    }
    // The output must still be actionable (path + rule shown, redacted fingerprint only)
    expect(stdout.includes("[secret-scan] FAIL")).toBe(true);
    expect(stdout.includes("seed-evm.ts")).toBe(true);
    expect(stdout.includes("evm-hex-private-key-context")).toBe(true);
  });

  test("the REPOSITORY worktree currently PASSES the gate (post-purge baseline)", () => {
    // Run from the repo root — this is the same command CI runs.
    const result = scanPath(process.cwd(), process.cwd());
    expect(result.findings.filter(f =>
      f.rule !== "known-compromised-literal-C-045-a" &&
      f.rule !== "known-compromised-literal-C-045-b",
    ).length).toBe(0);
    // And the known literals must NOT be present anywhere in the tree
    expect(result.findings.length).toBe(0);
  });
});
