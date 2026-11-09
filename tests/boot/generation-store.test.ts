// V31 TURN 3 — §10 regression battery: staged-generation store lifecycle.
// Isolated-import safety, full validation gating, crash-safe activation,
// interrupted-activation reconciliation, foreign-write detection.
// Every test runs against a THROWAWAY temp root — the operational paths are
// never touched.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  activateGeneration,
  detectForeignWrite,
  journalRead,
  prepareGeneration,
  readPointer,
  reconcileActivation,
  validateGeneration,
  GENERATIONS_DIR,
  POINTER_FILE,
} from "../../src/lib/boot/generation-store";

const GENESIS = "gen_3baf0dba552b527da4e9f6cedae44d04d0a40f7d";
const CHAIN_ID = "mtq-devnet-1";

function chainDump(height: number): string {
  return [
    `-- MTQΣ logical backup (format v2) fixture @ 2026-11-09T00:00:00Z`,
    `-- Restore: executeMultiple() this file into an EMPTY sqlite file`,
    `-- MTQ-DUMP-TIP rows=${height + 1} height=${height} tables=2 [blocks:${height} meta:1]`,
    `PRAGMA foreign_keys=OFF;`,
    `BEGIN TRANSACTION;`,
    `CREATE TABLE blocks (height INTEGER PRIMARY KEY, header TEXT, hash TEXT);`,
    `CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);`,
    ...Array.from({ length: height }, (_, i) => {
      const h = i + 1;
      const prev = h === 1 ? "" : `hash_${h - 1}`;
      return `INSERT INTO blocks VALUES(${h}, '{"prev_hash":"${prev}","chain_id":"${CHAIN_ID}"}', 'hash_${h}');`;
    }),
    `INSERT INTO meta VALUES('genesis_hash','${GENESIS}');`,
    `COMMIT;`,
    ``,
  ].join("\n");
}

function customDump(rows: number): string {
  return [
    `-- MTQΣ logical backup (format v2) fixture @ 2026-11-09T00:00:00Z`,
    `-- Restore: executeMultiple() this file into an EMPTY sqlite file`,
    `-- MTQ-DUMP-TIP rows=${rows} height=- tables=1 [telemetry:${rows}]`,
    `PRAGMA foreign_keys=OFF;`,
    `BEGIN TRANSACTION;`,
    `CREATE TABLE telemetry (id INTEGER PRIMARY KEY, v TEXT);`,
    ...Array.from({ length: rows }, (_, i) => `INSERT INTO telemetry VALUES(${i + 1}, 'x');`),
    `COMMIT;`,
    ``,
  ].join("\n");
}

const ROOT = mkdtempSync(join(tmpdir(), "mtq-genstore-"));
const CHAIN = chainDump(6);
const CUSTOM = customDump(9);

function prepareInput(over: Record<string, unknown> = {}) {
  return {
    root: ROOT,
    chainDumpSql: CHAIN,
    customDumpSql: CUSTOM,
    sourceOrigin: "published" as const,
    manifestVersion: 1,
    chainSha256: null,
    customSha256: null,
    ...over,
  };
}

beforeAll(() => {
  // operational-path placeholders so activation has something to archive
  writeFileSync(join(ROOT, "db-chain-placeholder.txt"), "x");
});
afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe("generation-store — journal & pointer primitives", () => {
  test("readPointer returns null when no pointer exists", () => {
    expect(readPointer(ROOT)).toBe(null);
  });

  test("prepareGeneration REFUSES a dump with an unparseable tip line — no directory created", async () => {
    await expect(prepareGeneration(prepareInput({ chainDumpSql: "no tip line here" }))).rejects.toThrow("tip line unparseable");
    const gens = join(ROOT, GENERATIONS_DIR);
    const entries = existsSync(gens) ? (await import("node:fs")).readdirSync(gens) : [];
    expect(entries.filter((e) => e.startsWith("gen-")).length).toBe(0);
  });
});

describe("generation-store — prepare → validate → activate (the sanctioned pipeline)", () => {
  test("prepareGeneration imports into an ISOLATED dir and journals PREPARE; the id records the TRUE tip", async () => {
    const prepared = await prepareGeneration(prepareInput());
    expect(prepared.expectHeight).toBe(6);
    expect(prepared.expectCustomRows).toBe(9);
    expect(prepared.generationId).toContain("-h6-");
    expect(existsSync(join(prepared.dir, "chain.db"))).toBe(true);
    expect(existsSync(join(prepared.dir, "custom.db"))).toBe(true);
    const journal = journalRead(ROOT);
    expect(journal.some((e) => e.phase === "PREPARE" && e.generationId === prepared.generationId)).toBe(true);
    // operational paths untouched by PREPARE
    expect(existsSync(join(ROOT, "db/chain.db"))).toBe(false);
  });

  test("validateGeneration PASSes a correct generation and writes its manifest", async () => {
    const prepared = await prepareGeneration(prepareInput());
    const v = await validateGeneration(ROOT, prepared, "published", 1);
    expect(v.ok).toBe(true);
    expect(v.manifest?.chain.height).toBe(6);
    expect(v.manifest?.custom.rows).toBe(9);
    expect(existsSync(join(prepared.dir, "generation.json"))).toBe(true);
    expect(journalRead(ROOT).some((e) => e.phase === "VALIDATED" && e.generationId === prepared.generationId)).toBe(true);
  });

  test("validateGeneration FAILS a generation whose dump lies about its height (contiguity check) and DISCARDS the dir", async () => {
    const lying = chainDump(6).replace("height=6", "height=9");
    const prepared = await prepareGeneration(prepareInput({ chainDumpSql: lying }));
    const v = await validateGeneration(ROOT, prepared, "published", 1);
    expect(v.ok).toBe(false);
    expect(v.reasons.some((r) => r.includes("contiguity"))).toBe(true);
    expect(existsSync(prepared.dir)).toBe(false); // discarded — never reaches activation
    expect(journalRead(ROOT).some((e) => e.phase === "VALIDATION_FAILED")).toBe(true);
  });

  test("activateGeneration archives casualties, copies BOTH files, and commits the pointer atomically", async () => {
    const prepared = await prepareGeneration(prepareInput());
    await validateGeneration(ROOT, prepared, "published", 1);
    const activation = await activateGeneration(ROOT, prepared, "published");
    expect(activation.activated).toBe(true);
    expect(activation.chainTip).toBe(6);
    const pointer = readPointer(ROOT);
    expect(pointer?.generationId).toBe(prepared.generationId);
    expect(pointer?.chainTip).toBe(6);
    expect(pointer?.customRows).toBe(9);
    expect(pointer?.sourceOrigin).toBe("published");
    // both operational files exist and came from the generation dir
    expect(existsSync(join(ROOT, "db/chain.db"))).toBe(true);
    expect(existsSync(join(ROOT, "db/custom.db"))).toBe(true);
    // a casualty archive was kept for the pre-activation state
    const gens = (await import("node:fs")).readdirSync(join(ROOT, GENERATIONS_DIR));
    expect(gens.some((e) => e.startsWith("casualty-"))).toBe(true);
    const journal = journalRead(ROOT);
    expect(journal.some((e) => e.phase === "ACTIVATING")).toBe(true);
    expect(journal.some((e) => e.phase === "ACTIVATED" && e.generationId === prepared.generationId)).toBe(true);
  });
});

describe("generation-store — interrupted-activation reconciliation (§4.4)", () => {
  test("reconcileActivation is a no-op with a clean journal", () => {
    const r = reconcileActivation(ROOT);
    expect(r.reconciled).toBe(false);
    expect(r.outcome).toBe("none");
  });

  test("an interrupted ACTIVATING with a COMPLETE generation dir completes the activation deterministically", async () => {
    // Build a validated-but-never-activated generation, then fake an
    // ACTIVATING journal entry (the death point between steps 1 and 5).
    const prepared = await prepareGeneration(prepareInput());
    await validateGeneration(ROOT, prepared, "published", 1);
    const { journalAppend } = await import("../../src/lib/boot/generation-store");
    journalAppend(ROOT, { ts: new Date().toISOString(), generationId: prepared.generationId, phase: "ACTIVATING", detail: "simulated interruption" });

    const r = reconcileActivation(ROOT);
    expect(r.reconciled).toBe(true);
    expect(r.outcome).toBe("completed-activation");
    expect(readPointer(ROOT)?.generationId).toBe(prepared.generationId);
    // the operational pair was re-derived from the immutable generation dir
    expect(existsSync(join(ROOT, "db/chain.db"))).toBe(true);
    expect(journalRead(ROOT).some((e) => e.phase === "RECONCILED_COMPLETE")).toBe(true);
  });

  test("an interrupted ACTIVATING with an UNUSABLE dir rolls back to the prior pointer generation", async () => {
    // prior pointer generation (complete) + a doomed generation whose dir vanishes
    const prior = await prepareGeneration(prepareInput());
    await validateGeneration(ROOT, prior, "published", 1);
    await activateGeneration(ROOT, prior, "published");
    const { journalAppend } = await import("../../src/lib/boot/generation-store");
    journalAppend(ROOT, { ts: new Date().toISOString(), generationId: "gen-doomed", phase: "ACTIVATING", detail: "simulated interruption" });
    // no gen-doomed dir exists
    const r = reconcileActivation(ROOT);
    expect(r.reconciled).toBe(true);
    expect(r.outcome).toBe("rolled-back");
    expect(readPointer(ROOT)?.generationId).toBe(prior.generationId);
    expect(journalRead(ROOT).some((e) => e.phase === "RECONCILED_ROLLBACK")).toBe(true);
  });

  test("detectForeignWrite flags live-below-pointer (the Incident-22 signature aid)", () => {
    const fw = detectForeignWrite(ROOT, 3, "self-healed");
    expect(fw.foreign).toBe(true);
    expect(fw.detail).toContain("h3");
    const ok = detectForeignWrite(ROOT, 7, "resume");
    expect(ok.foreign).toBe(false);
  });

  test("pointer file is exactly the canonical path (single authoritative reference)", () => {
    expect(POINTER_FILE).toBe("db/active-generation.json");
    expect(GENERATIONS_DIR).toBe("db/generations");
  });
});
