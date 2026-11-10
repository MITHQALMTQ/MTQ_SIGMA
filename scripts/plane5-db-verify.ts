// MTQΣ — Plane-5 database-plane verifier CLI (V31 TURN 3 — Fix R-4, §6).
//
// Read-only verification of the ACTUAL database layer with the 14-state
// taxonomy (DB-side states from src/lib/boot/db-plane-state.ts). Consumed by
// scripts/plane5-run.sh in BOTH modes:
//   • backstop — plane 2 (replaces the collapsed OK/RECOVERY_REQUIRED/ALERT
//     probe, which also CRASHED outright on a missing database file);
//   • monitor — the F-3 fix: the monitor now probes the actual DB instead of
//     trusting the heartbeat's self-report (the h20333→h3941 regression hid
//     behind a fresh OK heartbeat for ~3h).
//
// ALWAYS exit 0 with a JSON verdict on stdout (observation may conclude
// "unhealthy"; only an internal verifier failure yields state
// DATABASE_UNREADABLE + ok:false — fail-closed: inability to verify is never
// reported as health). Every probe is read-only; nothing remediates here.
//
// Usage: bun run scripts/plane5-db-verify.ts [--root PATH]

import { createClient } from "@libsql/client";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { probeChainDatabase, probeCustomDatabase } from "../src/lib/boot/db-probe";
import { readPointer, journalRead, POINTER_FILE } from "../src/lib/boot/generation-store";
import { classifyDbPlane, type DbPlaneClassification } from "../src/lib/boot/db-plane-state";

const args = process.argv.slice(2);
let ROOT = process.env.MTQ_SIGMA_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--root" && args[i + 1]) ROOT = resolve(args[i + 1]);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function gitShow(path: string): string | null {
  try {
    return execSync(`git show ${path}`, { cwd: ROOT, encoding: "utf8", timeout: 30_000, maxBuffer: 128 * 1024 * 1024 });
  } catch {
    return null;
  }
}

function parseDumpTip(text: string | null): { rows: number; height: number | null } | null {
  if (!text) return null;
  const m = text.match(/^-- MTQ-DUMP-TIP rows=(\d+) height=(\d+|-) /m);
  if (!m) return null;
  return { rows: Number(m[1]), height: m[2] === "-" ? null : Number(m[2]) };
}

function headTip(path: string): { rows: number; height: number | null } | null {
  try {
    return parseDumpTip(execSync(`git show HEAD:${path}`, { cwd: ROOT, encoding: "utf8", timeout: 30_000, maxBuffer: 128 * 1024 * 1024 }));
  } catch {
    return null;
  }
}

function diskTip(): { tip: { rows: number; height: number | null } | null; source: string } {
  const staged = join(ROOT, "backups/db-snapshots/.staging/latest-chain.sql");
  const published = join(ROOT, "backups/db-snapshots/latest-chain.sql");
  for (const [p, label] of [[staged, "staged"], [published, "published"]] as const) {
    if (existsSync(p)) {
      try {
        return { tip: parseDumpTip(readFileSync(p, "utf8").slice(0, 4096)), source: label };
      } catch {
        return { tip: null, source: label };
      }
    }
  }
  return { tip: null, source: "none" };
}

/** Read db/chain.db meta markers (boot_mode, selfheal_at) — evidence only. */
async function readChainMeta(): Promise<{ bootMode: string | null; selfhealAt: string | null }> {
  const p = join(ROOT, "db/chain.db");
  if (!existsSync(p)) return { bootMode: null, selfhealAt: null };
  let c;
  try {
    c = createClient({ url: `file:${p}` });
    const meta = dict(await c.execute("SELECT key, value FROM meta"));
    return { bootMode: meta.boot_mode ?? null, selfhealAt: meta.selfheal_at ?? null };
  } catch {
    return { bootMode: null, selfhealAt: null };
  } finally {
    try { c?.close(); } catch { /* best-effort */ }
  }
}

function dict(rs: { rows: Array<Record<string, unknown>> }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rs.rows) {
    const vals = Object.values(row);
    if (vals.length >= 2) out[String(vals[0])] = String(vals[1]);
  }
  return out;
}

// ── verification ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const chainProbe = await probeChainDatabase(join(ROOT, "db/chain.db"));
  const customProbe = await probeCustomDatabase(join(ROOT, "db/custom.db"));
  const meta = await readChainMeta();

  const pointerRaw = readPointer(ROOT);
  const pointer = pointerRaw
    ? { chainTip: pointerRaw.chainTip, activatedAt: pointerRaw.activatedAt }
    : null;

  const journal = journalRead(ROOT);
  const journalTail = journal.length
    ? { phase: journal[journal.length - 1].phase, ts: journal[journal.length - 1].ts }
    : null;

  const committedChain = parseDumpTip(gitShow("origin/main:backups/db-snapshots/latest-chain.sql"));
  const committedCustom = parseDumpTip(gitShow("origin/main:backups/db-snapshots/latest-custom.sql"));
  const published = headTip("backups/db-snapshots/latest-chain.sql");
  const disk = diskTip();

  const liveTip = chainProbe.status === "DATABASE_HEALTHY" ? (chainProbe.height ?? null) : null;
  const unbackedAhead = liveTip !== null && committedChain?.height !== null
    ? Math.max(0, liveTip - (committedChain!.height ?? 0))
    : null;
  const recoveryDeficit = liveTip !== null && committedChain?.height !== null
    ? Math.max(0, (committedChain!.height ?? 0) - liveTip)
    : null;

  const cls: DbPlaneClassification = classifyDbPlane({
    chainProbe,
    customProbe,
    bootMode: meta.bootMode,
    selfhealAt: meta.selfhealAt,
    pointer,
    journalTail,
    committedTip: committedChain?.height ?? null,
    committedCustomRows: committedCustom?.rows ?? null,
  });

  const verdict = {
    ok: cls.state === "HEALTHY" || cls.state === "DATABASE_RECOVERED",
    state: cls.state,
    severity: cls.severity,
    detail: cls.detail,
    chainStatus: chainProbe.status,
    customStatus: customProbe.status,
    liveTip,
    nBlocks: chainProbe.blocks ?? null,
    customRows: customProbe.rows ?? null,
    genesis: chainProbe.genesis ?? null,
    bootMode: meta.bootMode,
    selfhealAt: meta.selfhealAt,
    pointer: pointerRaw,
    pointerFile: POINTER_FILE,
    journalTail,
    journalEntries: journal.length,
    diskTip: disk.tip?.height ?? null,
    diskSource: disk.source,
    publishedTip: published?.height ?? null,
    committedTip: committedChain?.height ?? null,
    committedCustomRows: committedCustom?.rows ?? null,
    unbackedAhead,
    recoveryDeficit,
    snapshotParseOk: disk.tip !== null && committedChain !== null,
    root: ROOT,
    verifiedAt: new Date().toISOString(),
  };
  console.log(JSON.stringify(verdict, null, 1));
}

main().catch((e) => {
  // Fail-closed: an internal verifier failure is NEVER health.
  console.log(JSON.stringify({
    ok: false,
    state: "DATABASE_UNREADABLE",
    severity: "alert",
    detail: `verifier internal failure: ${e instanceof Error ? e.message : String(e)}`,
    root: ROOT,
    verifiedAt: new Date().toISOString(),
  }, null, 1));
});
