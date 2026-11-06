// MTQΣ — Boot-time source-file integrity guard (Task 47 root-cause remediation).
//
// WHY (recurring incident class, five occurrences 2026-10 → 2026-11-06):
// the sandbox is periodically RE-IMAGED, and the re-image deletes working-tree
// files — most notably src/app/api/constituency/upload/route.ts, deleted FIVE
// times (tasks 39/42/43a/44 + 2026-11-06 evening session). Each time the loss
// was caught only by the manual session-open battery or a human eye — a
// reactive gate, not a closed loop. The deletion is always UNSTAGED (nobody
// committed it); git-tracked truth in HEAD survives untouched.
//
// THIS MODULE closes the loop at boot AND every 60s in-process: any UNSTAGED
// deletion of a HEAD-tracked file is auto-restored via `git restore`, loudly
// logged. Deliberate deletions are respected, never fought:
//   - STAGED deletions (`git rm`) are never touched — staging is explicit
//     intent; commit it and the guard stands down forever for that file.
//   - COMMITTED deletions are invisible to this guard by construction.
//   - The sentinel db/ALLOW-FILE-DELETIONS (line 1 = expiry epoch-ms,
//     line 2 = reason; gitignored, same philosophy as db/ALLOW-GENESIS-RESET)
//     stands the guard down for intentional UNCOMMITTED deletions.
//
// Dependency policy: node builtins ONLY (importable from the Next.js server
// AND plain bun scripts; mirrors src/lib/db-ops.ts).

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const GIT_DIR = join(ROOT, ".git");
export const FILE_SENTINEL_PATH = join(ROOT, "db", "ALLOW-FILE-DELETIONS");

// ─── sentinel (intentional-deletion opt-out) ─────────────────────────────────

export interface FileSentinelInfo {
  active: boolean;
  expiresAt: number | null;
  reason: string;
}

/** Mirrors db-ops sentinelActive() for the file-deletion opt-out. */
export function fileDeletionSentinelActive(): FileSentinelInfo {
  const none: FileSentinelInfo = { active: false, expiresAt: null, reason: "" };
  try {
    if (!existsSync(FILE_SENTINEL_PATH)) return none;
    const text = readFileSync(FILE_SENTINEL_PATH, "utf8").trim();
    const nl = text.indexOf("\n");
    const first = nl === -1 ? text : text.slice(0, nl);
    const reason = nl === -1 ? "" : text.slice(nl + 1).trim();
    const exp = Number(first);
    if (!Number.isFinite(exp) || exp <= 0) return none;
    return { active: exp > Date.now(), expiresAt: exp, reason };
  } catch {
    return none;
  }
}

export function writeFileSentinel(hours: number, reason: string): void {
  mkdirSync(dirname(FILE_SENTINEL_PATH), { recursive: true });
  const exp = Date.now() + Math.round(hours * 3600_000);
  writeFileSync(FILE_SENTINEL_PATH, `${exp}\n${reason}\n`);
}

// ─── unstaged-deletion detection ─────────────────────────────────────────────

/**
 * List UNSTAGED deletions of HEAD-tracked files. Porcelain v1 with -z
 * (NUL-separated, no path quoting/mangling) and --no-renames (a rename is
 * reported as its D+N parts — only the D part matters here, and restoring a
 * file that was deliberately moved-then-committed is impossible anyway
 * because committed state is what we restore TO).
 *
 * Signature restored: X = ' ' (nothing staged) AND Y = 'D' (worktree delete).
 * Staged deletions (X = 'D') are explicit intent — never touched.
 */
export function listUnstagedDeletions(): string[] {
  if (!existsSync(GIT_DIR)) return []; // production/standalone — no repo, no guard
  try {
    const out = execSync("git status --porcelain -z --no-renames", {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    const deletions: string[] = [];
    // With -z, records are NUL-separated: "XY <path>\0". (Rename records would
    // carry a second NUL-separated path field, but --no-renames disables them.)
    for (const rec of out.split("\0")) {
      if (rec.length < 3) continue;
      const x = rec[0];
      const y = rec[1];
      const path = rec.slice(3);
      if (x === " " && y === "D" && path.length > 0) deletions.push(path);
    }
    return deletions;
  } catch {
    return [];
  }
}

// ─── restore ─────────────────────────────────────────────────────────────────

export interface SourceIntegrityReport {
  action: "none" | "restored" | "sentinel" | "partial" | "error";
  restored: string[];
  failed: string[];
  note?: string;
}

/**
 * Restore every unstaged deletion of a HEAD-tracked file, byte-exact from
 * HEAD. Never modifies staged or committed state. Loud on every action —
 * silent resurrection would be as dangerous as silent deletion.
 */
export function restoreDeletedTrackedFiles(opts: { log?: (s: string) => void } = {}): SourceIntegrityReport {
  const log = opts.log ?? ((s: string) => console.log(s));
  const report: SourceIntegrityReport = { action: "none", restored: [], failed: [] };

  if (!existsSync(GIT_DIR)) {
    report.note = "no .git — production/standalone boot; guard inactive";
    return report;
  }

  const sentinel = fileDeletionSentinelActive();
  if (sentinel.active) {
    report.action = "sentinel";
    report.note = `intentional deletions acknowledged (reason: ${sentinel.reason || "n/a"})`;
    log(`[source-integrity] sentinel active — standing down (${sentinel.reason || "n/a"})`);
    return report;
  }

  const deletions = listUnstagedDeletions();
  if (deletions.length === 0) return report;

  log(`[source-integrity] ${deletions.length} unstaged deletion(s) of HEAD-tracked files — RESTORING from git:`);
  for (const p of deletions) {
    try {
      execSync(`git restore -- ${JSON.stringify(p)}`, { cwd: ROOT, stdio: "pipe" });
      report.restored.push(p);
      log(`[source-integrity]   restored: ${p}`);
    } catch (e) {
      report.failed.push(p);
      log(`[source-integrity]   FAILED to restore: ${p} (${e instanceof Error ? e.message : String(e)})`);
    }
  }

  report.action =
    report.failed.length === 0 ? "restored" : report.restored.length > 0 ? "partial" : "error";
  if (report.failed.length > 0) {
    log(
      "[source-integrity] manual recovery needed for: " +
        report.failed.join(", ") +
        " (git restore -- <path> by hand; if deletion was INTENTIONAL: commit it, or " +
        "bun run scripts/source-integrity-heal.ts --allow-deletions \"reason\")",
    );
  }
  return report;
}
