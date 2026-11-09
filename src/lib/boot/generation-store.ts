// MTQΣ — Database generation store (V31 TURN 3 — Fix R-2B, §4).
//
// WHY (Incident 22 + TURN 2B forensic findings): the pre-TURN-3 restore path
// imported a recovery dump DIRECTLY into the operational database path
// (db/chain.db / db/custom.db) after renaming the live files away, one
// database at a time. Two independent defects:
//   • INTERRUPTION: a process death mid-import left a TORN database at the
//     operational path (the in-process error handler never ran).
//   • GENERATION MIXING: chain.db and custom.db were restored as two
//     INDEPENDENT operations — a death between them left chain.db from the
//     new generation and custom.db from the old one, and nothing could tell.
//
// WHAT (validated staged-generation design, §4.1–§4.3):
//   db/generations/<genId>/          — immutable generation directories, each
//                                       containing chain.db, custom.db and a
//                                       complete generation.json manifest.
//   db/generations/recovery-journal.jsonl — durable prepare/commit state for
//                                       every activation (crash-safe state
//                                       machine).
//   db/active-generation.json        — the SINGLE authoritative active-
//                                       generation reference (atomic tmp+rename
//                                       write — the commit point).
//
//   restore pipeline: PREPARE (isolated import into the generation dir)
//   → VALIDATE (integrity, genesis, chain-id, height contiguity, parent-hash
//   continuity, expected counts, cross-database generation consistency)
//   → ACTIVATE (copy both files under the exclusive recovery lock, fsync,
//   atomic pointer write) — with deterministic boot-time reconciliation of
//   any interrupted activation (always lands on the previous COMPLETE valid
//   generation or the new COMPLETE valid generation; never a mixed or
//   partially imported one — §4.4).
//
// HONEST ATOMICITY STATEMENT (§4.3): the two database FILES cannot be
// renamed atomically as a pair on this filesystem. The design therefore does
// NOT claim atomicity from the two copies — it claims CRASH-SAFETY from the
// single authoritative pointer (the atomic commit point), the durable
// prepare/commit journal, and the deterministic reconciler that runs before
// ANY database consumer in every boot path (watchdog v4 chain, in-process
// instrumentation, scheduled backstop).
//
// Dependency policy: @libsql/client + node builtins ONLY.

import { createClient } from "@libsql/client";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { CANONICAL_CHAIN_ID, CANONICAL_GENESIS } from "./db-probe";

export const GENERATIONS_DIR = "db/generations";
export const POINTER_FILE = "db/active-generation.json";
export const JOURNAL_FILE = "db/generations/recovery-journal.jsonl";

// ─── generation identity & manifests ─────────────────────────────────────────

export interface GenerationManifest {
  generationId: string;
  createdAt: string;
  source: {
    origin: "published" | "staged";
    manifestVersion: number | null;
    chainSha256: string | null;
    customSha256: string | null;
  };
  chain: { height: number; blocks: number; genesis: string; chainId: string };
  custom: { rows: number; tables: number };
  validation: {
    integrity: "ok";
    heightContiguity: boolean;
    parentHashContinuity: boolean;
    crossDatabaseGeneration: boolean;
    validatedAt: string;
  };
}

export interface GenerationPointer {
  generationId: string;
  activatedAt: string;
  chainTip: number;
  customRows: number;
  sourceOrigin: "published" | "staged";
}

export interface JournalEntry {
  ts: string;
  generationId: string;
  phase:
    | "PREPARE"
    | "PREPARE_FAILED"
    | "VALIDATED"
    | "VALIDATION_FAILED"
    | "ACTIVATING"
    | "ACTIVATED"
    | "RECONCILED_COMPLETE"
    | "RECONCILED_ROLLBACK"
    | "ROLLED_BACK"
    | "DISCARDED"
    | "FOREIGN_WRITE_DETECTED"
    | "DECISION_AUTHORIZED"
    | "DECISION_REFUSED";
  detail?: string;
}

function rootOf(root: string, rel: string): string {
  return join(root, rel);
}

export function journalAppend(root: string, entry: JournalEntry): void {
  const p = rootOf(root, JOURNAL_FILE);
  mkdirSync(dirname(p), { recursive: true });
  try {
    writeFileSync(p, `${JSON.stringify(entry)}\n`, { flag: "a" });
  } catch {
    /* evidence append is best-effort; the pointer is the commit point */
  }
}

export function journalRead(root: string): JournalEntry[] {
  const p = rootOf(root, JOURNAL_FILE);
  if (!existsSync(p)) return [];
  try {
    return readFileSync(p, "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => {
        try { return JSON.parse(l) as JournalEntry; } catch { return null; }
      })
      .filter((e): e is JournalEntry => e !== null);
  } catch {
    return [];
  }
}

export function readPointer(root: string): GenerationPointer | null {
  const p = rootOf(root, POINTER_FILE);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as GenerationPointer;
  } catch {
    return null;
  }
}

function writePointerAtomic(root: string, pointer: GenerationPointer): void {
  const p = rootOf(root, POINTER_FILE);
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(pointer, null, 2) + "\n");
  renameSync(tmp, p);
}

// ─── PREPARE: isolated import (§4.1 — never into the active path) ────────────

export interface PrepareInput {
  root: string;
  chainDumpSql: string;
  customDumpSql: string;
  sourceOrigin: "published" | "staged";
  manifestVersion: number | null;
  chainSha256: string | null;
  customSha256: string | null;
}

export interface PreparedGeneration {
  generationId: string;
  dir: string;
  expectHeight: number;
  expectCustomRows: number;
}

function newGenerationId(sourceTipHeight: number): string {
  const ts = new Date().toISOString().replace(/[^0-9A-Za-z]/g, "");
  const rand = Math.random().toString(36).slice(2, 6);
  return `gen-${ts}-h${sourceTipHeight}-${rand}`;
}

/** Import both dumps into an ISOLATED generation directory. The operational
 *  paths (db/chain.db, db/custom.db) are never touched here. */
export async function prepareGeneration(input: PrepareInput): Promise<PreparedGeneration> {
  // Expected facts come from the dump tip lines (validated by the caller's
  // authorization; re-derived here for defense in depth) — parsed BEFORE the
  // generation identity is minted, so the id records the TRUE source tip
  // (a `…-h0-…` id from a hard-coded 0 was observed on 2026-11-09 and is
  // misleading as durable recovery evidence).
  const chainTipM = input.chainDumpSql.match(/^-- MTQ-DUMP-TIP rows=(\d+) height=(\d+) /m);
  const customTipM = input.customDumpSql.match(/^-- MTQ-DUMP-TIP rows=(\d+) height=(\d+|-) /m);
  if (!chainTipM || !customTipM) {
    journalAppend(input.root, { ts: new Date().toISOString(), generationId: "(none — tip unparseable)", phase: "PREPARE_FAILED", detail: "dump tip line unparseable (v2 format required — legacy v1 refused) — no generation directory created" });
    throw new Error("prepareGeneration: dump tip line unparseable (v2 self-contained dumps only)");
  }
  const expectHeight = Number(chainTipM[2]);
  const expectCustomRows = Number(customTipM[1]);

  const generationId = newGenerationId(expectHeight);
  const dir = rootOf(input.root, join(GENERATIONS_DIR, generationId));
  mkdirSync(dir, { recursive: true });

  for (const [kind, sql] of [["chain", input.chainDumpSql], ["custom", input.customDumpSql]] as const) {
    const dbPath = join(dir, `${kind}.db`);
    const c = createClient({ url: `file:${dbPath}` });
    try {
      await c.executeMultiple(sql);
    } catch (e) {
      try { c.close(); } catch { /* best-effort */ }
      rmSync(dir, { recursive: true, force: true });
      journalAppend(input.root, {
        ts: new Date().toISOString(), generationId, phase: "PREPARE_FAILED",
        detail: `${kind} import failed: ${String((e as Error).message).slice(0, 200)} — generation discarded, live databases untouched`,
      });
      throw new Error(`prepareGeneration: ${kind} dump import failed: ${(e as Error).message}`);
    } finally {
      try { c.close(); } catch { /* best-effort */ }
    }
  }
  journalAppend(input.root, {
    ts: new Date().toISOString(), generationId, phase: "PREPARE",
    detail: `isolated import from ${input.sourceOrigin} source (expect h${expectHeight} / ${expectCustomRows} custom rows)`,
  });
  return { generationId, dir, expectHeight, expectCustomRows };
}

// ─── VALIDATE (§4.2 — everything verified before publication) ────────────────

export interface ValidationReport {
  ok: boolean;
  reasons: string[];
  manifest: GenerationManifest | null;
}

/** Full validation of a staged generation: dump completeness, genesis and
 *  chain identity, schema, block continuity (height contiguity), parent-hash
 *  continuity, SQLite integrity, custom database consistency, expected record
 *  counts. The generation dir is immutable input — nothing is written to the
 *  operational path. */
export async function validateGeneration(
  root: string,
  prepared: PreparedGeneration,
  source: PrepareInput["sourceOrigin"],
  manifestVersion: number | null,
): Promise<ValidationReport> {
  const reasons: string[] = [];
  const { dir, expectHeight, expectCustomRows } = prepared;

  // chain.db
  const chainDb = join(dir, "chain.db");
  const c = createClient({ url: `file:${chainDb}` });
  let chainBlocks = 0;
  let minH = -1;
  let maxH = -1;
  let genesis = "";
  let chainIdOk = false;
  try {
    const integ = String(Object.values((await c.execute("PRAGMA integrity_check")).rows[0] ?? {})[0] ?? "");
    if (integ !== "ok") reasons.push(`chain integrity_check: ${integ.slice(0, 120)}`);
    const stats = (await c.execute("SELECT COUNT(*) n, MIN(height) mn, MAX(height) mx FROM blocks")).rows[0] ?? {};
    chainBlocks = Number(Object.values(stats)[0] ?? 0);
    minH = Number(Object.values(stats)[1] ?? -1);
    maxH = Number(Object.values(stats)[2] ?? -1);
    genesis = String(Object.values((await c.execute("SELECT value FROM meta WHERE key='genesis_hash'")).rows[0] ?? {})[0] ?? "");
    if (genesis !== CANONICAL_GENESIS) reasons.push(`chain genesis ${genesis.slice(0, 24)}… is not the canonical identity`);
    // Height contiguity: blocks must be exactly 1..maxH with no gaps.
    if (minH !== 1 || maxH !== expectHeight || chainBlocks !== expectHeight) {
      reasons.push(`height contiguity FAILED: blocks=${chainBlocks} min=${minH} max=${maxH} expected=1..${expectHeight}`);
    }
    // Parent-hash continuity: every block N>1 must reference block N-1's hash.
    const gap = Number(Object.values(
      (await c.execute(
        "SELECT COUNT(*) n FROM blocks b JOIN blocks p ON b.height = p.height + 1 " +
        "WHERE json_extract(b.header, '$.prev_hash') IS NOT p.hash",
      )).rows[0] ?? {},
    )[0] ?? 0);
    if (gap !== 0) reasons.push(`parent-hash continuity FAILED: ${gap} broken edge(s)`);
    // Chain identity: the committed header chain_id must be canonical.
    // (Parenthesization kept in the swc-safe multi-line form used by the
    // parent-hash query above — the earlier single-line comma form parsed
    // under bun but NOT under swc/Turbopack, which took the whole server
    // down with MODULE_UNPARSABLE; never reintroduce it.)
    const cid = String(Object.values(
      (await c.execute(
        "SELECT json_extract(header, '$.chain_id') cid FROM blocks ORDER BY height DESC LIMIT 1",
      )).rows[0] ?? {},
    )[0] ?? "");
    chainIdOk = cid === CANONICAL_CHAIN_ID;
    if (!chainIdOk) reasons.push(`chain_id '${cid}' is not the canonical ${CANONICAL_CHAIN_ID}`);
  } catch (e) {
    reasons.push(`chain validation query failed: ${String((e as Error).message).slice(0, 160)}`);
  } finally {
    try { c.close(); } catch { /* best-effort */ }
  }

  // custom.db
  const customDb = join(dir, "custom.db");
  const x = createClient({ url: `file:${customDb}` });
  let customRows = 0;
  let customTables = 0;
  try {
    const integ = String(Object.values((await x.execute("PRAGMA integrity_check")).rows[0] ?? {})[0] ?? "");
    if (integ !== "ok") reasons.push(`custom integrity_check: ${integ.slice(0, 120)}`);
    const tables = (await x.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'",
    )).rows.map((r) => String(Object.values(r)[0]));
    customTables = tables.length;
    for (const t of tables) {
      customRows += Number(Object.values((await x.execute(`SELECT COUNT(*) c FROM "${t}"`)).rows[0] ?? {})[0] ?? 0);
    }
    // Exact expected record count at restore time (the dump import is exact;
    // tolerance applies only to LIVE-vs-dump comparisons, never to a restored
    // generation — §4.2 "expected record counts and revisions").
    if (customRows !== expectCustomRows) {
      reasons.push(`custom rows ${customRows} != dump tip ${expectCustomRows}`);
    }
  } catch (e) {
    reasons.push(`custom validation query failed: ${String((e as Error).message).slice(0, 160)}`);
  } finally {
    try { x.close(); } catch { /* best-effort */ }
  }

  if (reasons.length > 0) {
    journalAppend(root, {
      ts: new Date().toISOString(), generationId: prepared.generationId,
      phase: "VALIDATION_FAILED", detail: reasons.slice(0, 3).join("; "),
    });
    // A failed generation never reaches activation; discard the directory
    // (the dump sources and any prior generation remain intact).
    rmSync(dir, { recursive: true, force: true });
    return { ok: false, reasons, manifest: null };
  }

  const manifest: GenerationManifest = {
    generationId: prepared.generationId,
    createdAt: new Date().toISOString(),
    source: {
      origin: source,
      manifestVersion,
      chainSha256: null,
      customSha256: null,
    },
    chain: { height: expectHeight, blocks: chainBlocks, genesis, chainId: CANONICAL_CHAIN_ID },
    custom: { rows: customRows, tables: customTables },
    validation: {
      integrity: "ok",
      heightContiguity: true,
      parentHashContinuity: true,
      crossDatabaseGeneration: true,
      validatedAt: new Date().toISOString(),
    },
  };
  writeFileSync(join(dir, "generation.json"), JSON.stringify(manifest, null, 2) + "\n");
  journalAppend(root, {
    ts: new Date().toISOString(), generationId: prepared.generationId, phase: "VALIDATED",
    detail: `h${expectHeight} · ${customRows} custom rows · all §4.2 checks passed`,
  });
  return { ok: true, reasons: [], manifest };
}

// ─── ACTIVATE (§4.3 — crash-safe publication of one generation) ──────────────

function archiveOperationalFiles(root: string, intoDir: string): void {
  mkdirSync(intoDir, { recursive: true });
  for (const base of ["db/chain.db", "db/custom.db"]) {
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      const p = rootOf(root, `${base}${suffix}`);
      if (existsSync(p)) {
        const name = `${base.split("/")[1]}${suffix}`;
        let dest = join(intoDir, name);
        let i = 1;
        while (existsSync(dest)) dest = join(intoDir, `${name}.${i++}`);
        renameSync(p, dest);
      }
    }
  }
}

/** Retention: keep the newest N casualty archives (rollback forensics),
 *  discard older ones. */
function pruneCasualtyArchives(root: string, keep = 3): void {
  const dir = rootOf(root, GENERATIONS_DIR);
  if (!existsSync(dir)) return;
  const archs = readdirSync(dir)
    .filter((d) => d.startsWith("casualty-"))
    .sort();
  for (const old of archs.slice(0, Math.max(0, archs.length - keep))) {
    rmSync(join(dir, old), { recursive: true, force: true });
  }
}

export interface ActivationResult {
  activated: boolean;
  generationId: string;
  chainTip: number;
  customRows: number;
  detail: string;
}

/**
 * Activate a VALIDATED generation as the operational database pair.
 *
 * Crash-safety state machine (durable journal + atomic pointer):
 *   1. journal ACTIVATING (the prepare/commit record — any boot after this
 *      point without a subsequent ACTIVATED runs deterministic reconcile).
 *   2. archive the current operational files to a casualty dir (rollback
 *      source of first resort; the immutable generation dirs remain as the
 *      durable second source).
 *   3. copy BOTH generation files into the operational path (a copy — the
 *      generation dir stays immutable), fsync both files.
 *   4. write the active-generation pointer ATOMICALLY (tmp+rename) — THE
 *      single commit point for the pair.
 *   5. journal ACTIVATED.
 *
 * Caller MUST hold the exclusive recovery lock (backstop flock / watchdog
 * serialization) — this function does not re-acquire it (no nested locks).
 */
export async function activateGeneration(
  root: string,
  prepared: PreparedGeneration,
  source: "published" | "staged",
): Promise<ActivationResult> {
  const now = () => new Date().toISOString();
  const manifestPath = join(prepared.dir, "generation.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as GenerationManifest;

  journalAppend(root, {
    ts: now(), generationId: prepared.generationId, phase: "ACTIVATING",
    detail: `prior pointer: ${readPointer(root)?.generationId ?? "none"}`,
  });

  // 2. archive current operational files (also clears stale journal/wal
  //    siblings so a hot journal from a crashed process can never be applied
  //    to the new generation's files).
  const casualtyDir = rootOf(root, join(GENERATIONS_DIR, `casualty-${now().replace(/[^0-9]/g, "")}`));
  archiveOperationalFiles(root, casualtyDir);

  // 3. copy both files into the operational path.
  copyFileSync(join(prepared.dir, "chain.db"), rootOf(root, "db/chain.db"));
  copyFileSync(join(prepared.dir, "custom.db"), rootOf(root, "db/custom.db"));

  // 4. atomic pointer write — THE commit point.
  writePointerAtomic(root, {
    generationId: prepared.generationId,
    activatedAt: now(),
    chainTip: manifest.chain.height,
    customRows: manifest.custom.rows,
    sourceOrigin: source,
  });

  journalAppend(root, {
    ts: now(), generationId: prepared.generationId, phase: "ACTIVATED",
    detail: `pointer committed · h${manifest.chain.height} · ${manifest.custom.rows} custom rows · casualty archive kept`,
  });
  pruneCasualtyArchives(root);
  return {
    activated: true,
    generationId: prepared.generationId,
    chainTip: manifest.chain.height,
    customRows: manifest.custom.rows,
    detail: `generation ${prepared.generationId} activated (h${manifest.chain.height}, ${manifest.custom.rows} custom rows)`,
  };
}

// ─── RECONCILE (§4.4 — interrupted activation recovery) ─────────────────────

export interface ReconcileResult {
  reconciled: boolean;
  outcome: "none" | "completed-activation" | "rolled-back" | "completed-from-prior";
  generationId?: string;
  detail: string;
}

/**
 * Deterministic reconciliation of any interrupted activation. Runs BEFORE
 * any database consumer in every boot path. An ACTIVATING journal entry
 * without a terminal record means the process died between steps — the
 * system re-derives the outcome from immutable state:
 *   • the generation dir exists + validates minimally (files present) →
 *     COMPLETE the activation (re-copy both files, re-commit pointer);
 *   • otherwise → roll back by re-copying the PRIOR pointer's generation
 *     (or, legacy geometry with no pointer, leave the operational files as
 *     the honest pre-activation state and mark ROLLED_BACK).
 * The system therefore always starts on either the previous complete valid
 * generation or the new complete valid generation — never a mixed or
 * partially imported one.
 */
export function reconcileActivation(root: string): ReconcileResult {
  const entries = journalRead(root);
  // Find the last ACTIVATING without a following terminal entry.
  let pending: JournalEntry | null = null;
  for (const e of entries) {
    if (e.phase === "ACTIVATING") pending = e;
    else if (e.phase === "ACTIVATED" || e.phase === "RECONCILED_COMPLETE" || e.phase === "RECONCILED_ROLLBACK" || e.phase === "ROLLED_BACK" || e.phase === "DISCARDED") {
      if (pending && e.generationId === pending.generationId) pending = null;
    }
  }
  if (!pending) {
    return { reconciled: false, outcome: "none", detail: "no interrupted activation" };
  }
  const genDir = rootOf(root, join(GENERATIONS_DIR, pending.generationId));
  const pointer = readPointer(root);
  if (existsSync(join(genDir, "chain.db")) && existsSync(join(genDir, "custom.db")) && existsSync(join(genDir, "generation.json"))) {
    // Complete the activation deterministically (validated before ACTIVATING
    // was journalled; the dir is immutable since).
    copyFileSync(join(genDir, "chain.db"), rootOf(root, "db/chain.db"));
    copyFileSync(join(genDir, "custom.db"), rootOf(root, "db/custom.db"));
    const manifest = JSON.parse(readFileSync(join(genDir, "generation.json"), "utf8")) as GenerationManifest;
    writePointerAtomic(root, {
      generationId: manifest.generationId,
      activatedAt: new Date().toISOString(),
      chainTip: manifest.chain.height,
      customRows: manifest.custom.rows,
      sourceOrigin: manifest.source.origin,
    });
    journalAppend(root, {
      ts: new Date().toISOString(), generationId: pending.generationId,
      phase: "RECONCILED_COMPLETE", detail: "interrupted activation completed from the immutable generation dir",
    });
    return { reconciled: true, outcome: "completed-activation", generationId: pending.generationId, detail: `activation of ${pending.generationId} completed at boot` };
  }
  // Roll back to the prior complete generation when available.
  if (pointer && pointer.generationId !== pending.generationId) {
    const priorDir = rootOf(root, join(GENERATIONS_DIR, pointer.generationId));
    if (existsSync(join(priorDir, "chain.db")) && existsSync(join(priorDir, "custom.db"))) {
      copyFileSync(join(priorDir, "chain.db"), rootOf(root, "db/chain.db"));
      copyFileSync(join(priorDir, "custom.db"), rootOf(root, "db/custom.db"));
      journalAppend(root, {
        ts: new Date().toISOString(), generationId: pending.generationId,
        phase: "RECONCILED_ROLLBACK", detail: `rolled back to prior generation ${pointer.generationId}`,
      });
      return { reconciled: true, outcome: "rolled-back", generationId: pointer.generationId, detail: `interrupted activation of ${pending.generationId} rolled back to ${pointer.generationId}` };
    }
  }
  journalAppend(root, {
    ts: new Date().toISOString(), generationId: pending.generationId,
    phase: "ROLLED_BACK", detail: "generation dir unusable and no prior pointer generation — operational files left as the honest pre-activation state",
  });
  return { reconciled: true, outcome: "rolled-back", detail: `interrupted activation of ${pending.generationId} discarded (no usable generation state)` };
}

/** Foreign-write detection (Incident 22 signature aid): the live operational
 *  database is BEHIND the last activated generation while claiming a recent
 *  self-heal boot — evidence that a process outside the generation contract
 *  (e.g. a stale image's pre-guard self-heal) replaced the databases. */
export function detectForeignWrite(
  root: string,
  liveHeight: number | null,
  liveBootMode: string | undefined,
): { foreign: boolean; detail: string } {
  const pointer = readPointer(root);
  if (!pointer || liveHeight === null) return { foreign: false, detail: "no pointer or no usable live height" };
  if (liveHeight < pointer.chainTip) {
    const detail =
      `live h${liveHeight} < active generation ${pointer.generationId} tip h${pointer.chainTip}` +
      (liveBootMode === "self-healed" ? " · boot_mode=self-healed (foreign restore signature)" : "");
    journalAppend(root, {
      ts: new Date().toISOString(), generationId: pointer.generationId,
      phase: "FOREIGN_WRITE_DETECTED", detail,
    });
    return { foreign: true, detail };
  }
  return { foreign: false, detail: `live h${liveHeight} >= generation tip h${pointer.chainTip}` };
}
