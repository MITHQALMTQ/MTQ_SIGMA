// MTQΣ — Explicit database probe outcomes (V31 TURN 3 — Fix R-2, §3.1).
//
// WHY: the pre-TURN-3 probe contract collapsed every failure into
// `{ ok: false, reason: "missing" | "unreadable" }` and the self-heal then
// computed `liveChainH = chainProbe.ok ? chainProbe.height : 0` — a FAILED
// database read was silently interpreted as a VALID HEIGHT OF ZERO, which
// authorized "forward-only" restoration over a database whose real state was
// UNKNOWN (Incident 22 defect class; TURN 2B forensic report F-1 family).
//
// WHAT: every probe now returns one of eight EXPLICIT outcomes. Only
// DATABASE_HEALTHY carries a usable chain height / row count. Every other
// outcome must block automatic restoration unless a separately verified
// recovery authorization (src/lib/boot/recovery-authorization.ts) explicitly
// permits a controlled recovery path.
//
// Dependency policy: @libsql/client + node builtins ONLY (importable from the
// Next.js server AND plain bun scripts AND isolated test sandboxes).

import { createClient } from "@libsql/client";
import { existsSync } from "node:fs";

/** Canonical MTQΣ Sovereign Devnet genesis identity (mirrors
 * src/lib/boot/snapshot-manifest.ts CANONICAL_GENESIS — single identity
 * contract for every consumer). */
export const CANONICAL_GENESIS = "gen_3baf0dba552b527da4e9f6cedae44d04d0a40f7d";

/** Canonical chain ID (mirrors src/lib/chain/shared.ts CHAIN_ID). */
export const CANONICAL_CHAIN_ID = "mtq-devnet-1";

// ─── probe outcome taxonomy (V31 TURN 3 §3.1) ────────────────────────────────

export type DbProbeStatus =
  | "DATABASE_HEALTHY"
  | "DATABASE_BUSY"
  | "DATABASE_UNREADABLE"
  | "DATABASE_MISSING"
  | "DATABASE_IDENTITY_MISMATCH"
  | "DATABASE_INTEGRITY_FAILURE"
  | "DATABASE_SCHEMA_UNSUPPORTED"
  | "DATABASE_AUTHORITY_UNVERIFIED";

export interface ChainProbeResult {
  status: DbProbeStatus;
  /** Usable ONLY when status === "DATABASE_HEALTHY". */
  height?: number;
  blocks?: number;
  genesis?: string;
  detail?: string;
}

export interface CustomProbeResult {
  status: DbProbeStatus;
  /** Usable ONLY when status === "DATABASE_HEALTHY". */
  rows?: number;
  tables?: number;
  detail?: string;
}

/** True only for a valid, fully verified probe. */
export function probeUsable(status: DbProbeStatus): boolean {
  return status === "DATABASE_HEALTHY";
}

function classifyOpenError(e: unknown): { status: DbProbeStatus; detail: string } {
  const msg = String((e as Error)?.message ?? e);
  if (/busy|locked/i.test(msg)) return { status: "DATABASE_BUSY", detail: msg.slice(0, 200) };
  if (/not a database|malformed|corrupt/i.test(msg)) {
    return { status: "DATABASE_INTEGRITY_FAILURE", detail: msg.slice(0, 200) };
  }
  return { status: "DATABASE_UNREADABLE", detail: msg.slice(0, 200) };
}

// ─── chain database probe ────────────────────────────────────────────────────

/**
 * Probe db/chain.db (or any SQLite chain database) with EXPLICIT outcomes.
 * A usable height is returned only for DATABASE_HEALTHY — an unreadable,
 * busy, corrupt, schema-broken or identity-mismatched database NEVER
 * degenerates to height 0.
 */
export async function probeChainDatabase(dbPath: string): Promise<ChainProbeResult> {
  if (!existsSync(dbPath)) {
    return { status: "DATABASE_MISSING", detail: `${dbPath} does not exist` };
  }
  let c;
  try {
    c = createClient({ url: `file:${dbPath}` });
  } catch (e) {
    const { status, detail } = classifyOpenError(e);
    return { status, detail };
  }
  try {
    // Schema support: the chain database must carry the blocks/meta tables.
    const tables = new Set(
      (await c.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map(
        (r) => String(Object.values(r)[0]),
      ),
    );
    if (!tables.has("blocks") || !tables.has("meta")) {
      return { status: "DATABASE_SCHEMA_UNSUPPORTED", detail: `tables present: ${[...tables].slice(0, 8).join(",")}` };
    }
    const integ = String(
      Object.values((await c.execute("PRAGMA integrity_check")).rows[0] ?? {})[0] ?? "",
    );
    if (integ !== "ok") {
      return { status: "DATABASE_INTEGRITY_FAILURE", detail: `integrity_check: ${integ.slice(0, 200)}` };
    }
    const tipRow = (await c.execute("SELECT COALESCE(MAX(height), 0) AS h, COUNT(*) AS n FROM blocks")).rows[0] ?? {};
    const height = Number(Object.values(tipRow)[0] ?? 0);
    const blocks = Number(Object.values(tipRow)[1] ?? 0);
    // Identity: the persisted genesis hash must be the canonical one.
    const genesis = String(
      Object.values((await c.execute("SELECT value FROM meta WHERE key='genesis_hash'")).rows[0] ?? {})[0] ?? "",
    );
    if (height > 0 && genesis && genesis !== CANONICAL_GENESIS) {
      return { status: "DATABASE_IDENTITY_MISMATCH", height, blocks, genesis, detail: `genesis ${genesis.slice(0, 24)}… != canonical` };
    }
    return { status: "DATABASE_HEALTHY", height, blocks, genesis: genesis || undefined };
  } catch (e) {
    const { status, detail } = classifyOpenError(e);
    return { status, detail };
  } finally {
    try { c.close(); } catch { /* best-effort */ }
  }
}

// ─── custom database probe ───────────────────────────────────────────────────

/**
 * Probe db/custom.db (or any SQLite custom/telemetry database) with EXPLICIT
 * outcomes. Rows are usable only for DATABASE_HEALTHY.
 */
export async function probeCustomDatabase(dbPath: string): Promise<CustomProbeResult> {
  if (!existsSync(dbPath)) {
    return { status: "DATABASE_MISSING", detail: `${dbPath} does not exist` };
  }
  let c;
  try {
    c = createClient({ url: `file:${dbPath}` });
  } catch (e) {
    const { status, detail } = classifyOpenError(e);
    return { status, detail };
  }
  try {
    const tables = (await c.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'",
    )).rows.map((r) => String(Object.values(r)[0]));
    if (tables.length === 0) {
      return { status: "DATABASE_SCHEMA_UNSUPPORTED", detail: "no application tables present" };
    }
    const integ = String(
      Object.values((await c.execute("PRAGMA integrity_check")).rows[0] ?? {})[0] ?? "",
    );
    if (integ !== "ok") {
      return { status: "DATABASE_INTEGRITY_FAILURE", detail: `integrity_check: ${integ.slice(0, 200)}` };
    }
    let rows = 0;
    for (const t of tables) {
      rows += Number(Object.values((await c.execute(`SELECT COUNT(*) c FROM "${t}"`)).rows[0] ?? {})[0] ?? 0);
    }
    return { status: "DATABASE_HEALTHY", rows, tables: tables.length };
  } catch (e) {
    const { status, detail } = classifyOpenError(e);
    return { status, detail };
  } finally {
    try { c.close(); } catch { /* best-effort */ }
  }
}
