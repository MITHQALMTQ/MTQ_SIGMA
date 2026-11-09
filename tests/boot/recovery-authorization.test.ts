// V31 TURN 3 — §10 regression battery: central recovery authorization.
// The fail-closed decision matrix — F-1 (refused-note control flow), F-2
// (missing manifest), zero-height hazard, forward-only direction, staged
// vs published authority, cross-database generation consistency.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { authorizeRecovery, type AuthorizationInput } from "../../src/lib/boot/recovery-authorization";
import { buildManifest } from "../../src/lib/boot/snapshot-manifest";
import type { ChainProbeResult, CustomProbeResult, DbProbeStatus } from "../../src/lib/boot/db-probe";

const GENESIS = "gen_3baf0dba552b527da4e9f6cedae44d04d0a40f7d";
const CHAIN_ID = "mtq-devnet-1";

function chainDump(height: number, rows: number): string {
  return [
    `-- MTQΣ logical backup (format v2) fixture @ 2026-11-09T00:00:00Z`,
    `-- Restore: executeMultiple() this file into an EMPTY sqlite file`,
    `-- MTQ-DUMP-TIP rows=${rows} height=${height} tables=2 [blocks:${height} meta:1]`,
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

const chainProbe = (status: DbProbeStatus, height?: number): ChainProbeResult =>
  ({ status, height, blocks: height ?? 0, genesis: GENESIS }) as ChainProbeResult;
const customProbe = (status: DbProbeStatus, rows?: number): CustomProbeResult =>
  ({ status, rows, tables: 1 }) as CustomProbeResult;

const SANDBOX = mkdtempSync(join(tmpdir(), "mtq-authz-"));
const MANIFEST_PATH = join(SANDBOX, "manifest.json");

const CHAIN_H100 = chainDump(100, 102); // 100 blocks + 2 meta rows... rows=102
const CUSTOM_500 = customDump(500);

beforeAll(() => {
  const m = buildManifest(CHAIN_H100, CUSTOM_500, 1);
  if (!m) throw new Error("fixture manifest build failed");
  writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2));
});

function input(over: Partial<AuthorizationInput> = {}): AuthorizationInput {
  return {
    root: SANDBOX,
    remoteOk: true,
    gitState: "EXACT_MATCH",
    chainProbe: chainProbe("DATABASE_MISSING"),
    customProbe: customProbe("DATABASE_MISSING"),
    sentinelActive: false,
    published: { chainText: CHAIN_H100, customText: CUSTOM_500, manifestPath: MANIFEST_PATH },
    staged: null,
    ...over,
  };
}

describe("recovery-authorization — preconditions & stand-down", () => {
  test("SENTINEL_ACTIVE stands down before anything else", () => {
    const d = authorizeRecovery(input({ sentinelActive: true }));
    expect(d.authorized).toBe(false);
    expect(d.refusal).toBe("SENTINEL_ACTIVE");
  });

  test("REPOSITORY_IDENTITY_UNVERIFIED when the origin remote is not canonical", () => {
    const d = authorizeRecovery(input({ remoteOk: false }));
    expect(d.refusal).toBe("REPOSITORY_IDENTITY_UNVERIFIED");
  });

  test("RUNTIME_SOURCE_UNVERIFIED for any non-proceed git state (necessary ≠ sufficient)", () => {
    for (const state of ["SOURCE_CODE_AHEAD", "DIVERGED", "SNAPSHOT_INVALID", "BEHIND"]) {
      const d = authorizeRecovery(input({ gitState: state }));
      expect(d.refusal).toBe("RUNTIME_SOURCE_UNVERIFIED");
    }
  });
});

describe("recovery-authorization — live-probe refusals (never height zero)", () => {
  test("LIVE_DB_BUSY refuses automatic restoration", () => {
    const d = authorizeRecovery(input({ chainProbe: chainProbe("DATABASE_BUSY", undefined) }));
    expect(d.refusal).toBe("LIVE_DB_BUSY");
    expect(d.liveChainHeight).toBe(null);
  });

  test("LIVE_DB_INTEGRITY_FAILURE refuses", () => {
    const d = authorizeRecovery(input({ chainProbe: chainProbe("DATABASE_INTEGRITY_FAILURE") }));
    expect(d.refusal).toBe("LIVE_DB_INTEGRITY_FAILURE");
  });

  test("LIVE_DB_IDENTITY_MISMATCH refuses", () => {
    const d = authorizeRecovery(input({ chainProbe: chainProbe("DATABASE_IDENTITY_MISMATCH", 10) }));
    expect(d.refusal).toBe("LIVE_DB_IDENTITY_MISMATCH");
  });

  test("LIVE_DB_SCHEMA_UNSUPPORTED on the CHAIN side maps to its own refusal (taxonomy accuracy)", () => {
    const d = authorizeRecovery(input({ chainProbe: chainProbe("DATABASE_SCHEMA_UNSUPPORTED") }));
    expect(d.refusal).toBe("LIVE_DB_SCHEMA_UNSUPPORTED");
  });

  test("LIVE_DB_UNREADABLE refuses (the zero-height hazard is closed)", () => {
    const d = authorizeRecovery(input({ chainProbe: chainProbe("DATABASE_UNREADABLE") }));
    expect(d.refusal).toBe("LIVE_DB_UNREADABLE");
    expect(d.liveChainHeight).toBe(null);
  });

  test("a healthy chain but unreadable custom refuses (pair unusable)", () => {
    const d = authorizeRecovery(input({
      chainProbe: chainProbe("DATABASE_HEALTHY", 50),
      customProbe: customProbe("DATABASE_UNREADABLE"),
    }));
    expect(d.authorized).toBe(false);
    expect(["LIVE_DB_UNREADABLE", "LIVE_DB_SCHEMA_UNSUPPORTED"]).toContain(d.refusal ?? "");
  });
});

describe("recovery-authorization — source authority (the manifest gate)", () => {
  test("PUBLISHED_SOURCE_MANIFEST_MISSING refuses even with payloads present (F-2 closed)", () => {
    const d = authorizeRecovery(input({ published: { chainText: CHAIN_H100, customText: CUSTOM_500, manifestPath: join(SANDBOX, "absent.json") } }));
    expect(d.authorized).toBe(false);
    expect(d.refusal).toBe("PUBLISHED_SOURCE_MANIFEST_MISSING");
  });

  test("PUBLISHED_SOURCE_MANIFEST_INVALID on a content-hash mismatch", () => {
    writeFileSync(join(SANDBOX, "bad.json"), JSON.stringify({ ...buildManifest(CHAIN_H100, CUSTOM_500, 1)!, chain: { ...buildManifest(CHAIN_H100, CUSTOM_500, 1)!.chain, sha256: "deadbeef" } }));
    const d = authorizeRecovery(input({ published: { chainText: CHAIN_H100, customText: CUSTOM_500, manifestPath: join(SANDBOX, "bad.json") } }));
    expect(d.refusal).toBe("PUBLISHED_SOURCE_MANIFEST_INVALID");
  });

  test("PUBLISHED_SOURCE_MANIFEST_INVALID when the dump is incomplete (no COMMIT wrapper — belt: the manifest gate catches structure)", () => {
    const torn = CHAIN_H100.replace("COMMIT;", "");
    const m = buildManifest(torn, CUSTOM_500, 1);
    writeFileSync(join(SANDBOX, "torn.json"), JSON.stringify(m));
    const d = authorizeRecovery(input({ published: { chainText: torn, customText: CUSTOM_500, manifestPath: join(SANDBOX, "torn.json") } }));
    expect(d.refusal).toBe("PUBLISHED_SOURCE_MANIFEST_INVALID");
  });

  test("PUBLISHED_SOURCE_MANIFEST_INVALID when the chain dump lost the canonical genesis (manifest cross-check)", () => {
    const wrong = chainDump(100, 102).replace(GENESIS, "gen_not_canonical");
    const m = buildManifest(wrong, CUSTOM_500, 1);
    writeFileSync(join(SANDBOX, "wrong.json"), JSON.stringify(m));
    const d = authorizeRecovery(input({ published: { chainText: wrong, customText: CUSTOM_500, manifestPath: join(SANDBOX, "wrong.json") } }));
    expect(d.refusal).toBe("PUBLISHED_SOURCE_MANIFEST_INVALID");
  });

  test("a structurally valid STAGED dump authorizes when the published layer is unverifiable (manifest missing)", () => {
    const d = authorizeRecovery(input({
      published: { chainText: CHAIN_H100, customText: CUSTOM_500, manifestPath: join(SANDBOX, "absent.json") },
      staged: { chainText: chainDump(100, 102), customText: customDump(500) },
    }));
    expect(d.authorized).toBe(true);
    expect(d.action).toBe("RESTORE_GENERATION");
    expect(d.source?.origin).toBe("staged");
  });

  test("a staged dump BEHIND the published layer is refused as stale debris (recorded as a FAIL check; published remains the source)", () => {
    const d = authorizeRecovery(input({
      chainProbe: chainProbe("DATABASE_HEALTHY", 100),
      customProbe: customProbe("DATABASE_HEALTHY", 480),
      staged: { chainText: chainDump(50, 52), customText: customDump(500) },
    }));
    expect(d.action).toBe("NONE");
    expect(d.refusal).toBe("NO_RESTORE_NEEDED");
    const stagedCheck = d.checks.find((c) => c.check === "staged source");
    expect(stagedCheck?.verdict).toBe("FAIL");
    expect(stagedCheck?.detail).toContain("BEHIND published");
  });

  test("NO_VERIFIED_RECOVERY_SOURCE when no payloads exist at all", () => {
    const d = authorizeRecovery(input({ published: null, staged: null }));
    expect(d.refusal).toBe("NO_VERIFIED_RECOVERY_SOURCE");
  });
});

describe("recovery-authorization — direction & generation consistency", () => {
  test("NO_RESTORE_NEEDED when live chain is at/ahead of the best source", () => {
    const d = authorizeRecovery(input({
      chainProbe: chainProbe("DATABASE_HEALTHY", 120),
      customProbe: customProbe("DATABASE_HEALTHY", 480),
    }));
    expect(d.action).toBe("NONE");
    expect(d.refusal).toBe("NO_RESTORE_NEEDED");
    expect(d.authorized).toBe(false);
  });

  test("CUSTOM_LIVE_MATERIALLY_AHEAD: live custom far ahead of source while the chain is behind — a swap would destroy live custom data", () => {
    const d = authorizeRecovery(input({
      chainProbe: chainProbe("DATABASE_HEALTHY", 40),
      customProbe: customProbe("DATABASE_HEALTHY", 5000),
    }));
    expect(d.refusal).toBe("CUSTOM_LIVE_MATERIALLY_AHEAD");
    expect(d.authorized).toBe(false);
  });

  test("CUSTOM_LIVE_MATERIALLY_AHEAD: chain missing but live custom far ahead — nothing to destroy", () => {
    const d = authorizeRecovery(input({
      chainProbe: chainProbe("DATABASE_MISSING"),
      customProbe: customProbe("DATABASE_HEALTHY", 5000),
    }));
    expect(d.refusal).toBe("CUSTOM_LIVE_MATERIALLY_AHEAD");
  });

  test("RESTORE_GENERATION authorized: verified published source strictly ahead of live (forward-only)", () => {
    const d = authorizeRecovery(input({
      chainProbe: chainProbe("DATABASE_HEALTHY", 40),
      customProbe: customProbe("DATABASE_HEALTHY", 200),
    }));
    expect(d.authorized).toBe(true);
    expect(d.action).toBe("RESTORE_GENERATION");
    expect(d.source?.origin).toBe("published");
    expect(d.source?.chainHeight).toBe(100);
    expect(d.controlledRecovery).toBe(false);
    expect(d.checks.every((c) => c.verdict !== "FAIL")).toBe(true);
  });

  test("controlled recovery: DATABASE_MISSING live chain, nothing to lose", () => {
    const d = authorizeRecovery(input());
    expect(d.authorized).toBe(true);
    expect(d.controlledRecovery).toBe(true);
  });

  test("source of record: staged AHEAD of published wins (freshest write-behind state)", () => {
    const d = authorizeRecovery(input({
      chainProbe: chainProbe("DATABASE_HEALTHY", 90),
      customProbe: customProbe("DATABASE_HEALTHY", 300),
      staged: { chainText: chainDump(150, 152), customText: customDump(520) },
    }));
    expect(d.authorized).toBe(true);
    expect(d.source?.origin).toBe("staged");
    expect(d.source?.chainHeight).toBe(150);
  });

  test("refusal is terminal: the decision object records the failing check verbatim", () => {
    const d = authorizeRecovery(input({ chainProbe: chainProbe("DATABASE_BUSY") }));
    const failing = d.checks.find((c) => c.verdict === "FAIL");
    expect(failing?.check).toBe("live chain probe");
    expect(failing?.detail).toContain("DATABASE_BUSY");
  });
});

afterAll(() => {
  rmSync(SANDBOX, { recursive: true, force: true });
});
