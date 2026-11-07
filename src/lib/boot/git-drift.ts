// MTQΣ — Boot-time git-drift guard (Task 60 — root-cause remediation round 3).
//
// WHY (incident #8, 2026-11-07 ~15:20Z): the sandbox re-image restored .git to
// a MID-SESSION snapshot (an amended task46) while origin/main had advanced 26
// commits (tasks 47–59 — every readability/live-number fix). The prior
// hardening closed the DB-regression surface (task42/44 self-heal — worked
// perfectly today) and the working-tree-deletion surface (task47
// source-integrity heal — worked perfectly today), but NOTHING detected that
// local HEAD ITSELF was stale: the dev server booted the old code and served
// it happily until a human noticed. That was the last unprotected surface of
// the recurring re-image incident class.
//
// WHAT THIS MODULE DOES (fail-safe; destructive only under PROOF):
//   classifyGitDrift()  — fetch origin (throttled, timeout) + three-way
//                         classification of local HEAD vs origin/main.
//   guardGitDrift()     — the actuator:
//     SYNCED / AHEAD-ONLY → no-op (ahead-only logs a push reminder).
//     BEHIND (fast-forwardable) + clean tracked tree
//         → git merge --ff-only origin/main  (untracked/gitignored files —
//           i.e. the LIVE DATABASES — are never touched by definition).
//     DIVERGED (ahead AND behind — the amend-drift signature of incident #8)
//         → auto-realign ONLY under CONTENT-SUBSUMPTION PROOF: every path on
//           the local side of the three-dot diff is either
//           (a) derivable/evidence (backups/db-snapshots/**, upload/**),
//           (b) locally DELETED while origin still has it (the exact
//               "upload route deleted 5×" class — origin wins), or
//           (c) locally modified/added but the LOCAL BLOB is an ancestor
//               state of that path inside origin/main's history (local merely
//               holds an older snapshot of work origin already evolved).
//           Any genuinely NEW local code (blob never seen upstream) → BLOCK.
//           Proof holds → archive (git bundle + full file copies + manifest
//           to mtq-sigma-backups/selfheal-archive/gitdrift-<ts>/) →
//           git reset --hard origin/main (forward-only realignment).
//     Dirty tracked tree / fetch impossible to classify → BLOCK (loud).
//
//   Post-realign housekeeping (both paths): if package.json / bun.lock /
//   prisma/schema.prisma changed across the realign, best-effort
//   `bun install` + `prisma generate` so the runtime never boots against a
//   stale dependency/client layer (incident #8 manually needed exactly this).
//
// DELIBERATE DELETIONS / INTENTIONAL DIVERGENCE are respected, never fought:
//   the sentinel db/ALLOW-GIT-REALIGN (line 1 = expiry epoch-ms, line 2 =
//   reason; gitignored, same philosophy as ALLOW-GENESIS-RESET and
//   ALLOW-FILE-DELETIONS) stands the guard down.
//
// Dependency policy: node builtins ONLY (importable from the Next.js server
// AND plain bun scripts; mirrors src/lib/boot/source-integrity.ts).

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const GIT_DIR = join(ROOT, ".git");
export const DRIFT_SENTINEL_PATH = join(ROOT, "db", "ALLOW-GIT-REALIGN");
export const DRIFT_STATE_PATH = join("/tmp", "mtq-git-drift-state.json");
export const REALIGN_MARKER_PATH = join("/tmp", "mtq-git-realign.flag");

/** Paths whose local-side changes are always safe to drop (live-derivable
 * dumps and owner evidence screenshots — recoverable from the live DB or
 * preserved in the pre-realign archive). */
const DERIVABLE_PREFIXES = ["backups/db-snapshots/", "upload/"];

/** Minimum seconds between network fetches (the guard may be called every
 * 60s by two loops; fetch is throttled so the sandbox stays a polite client). */
const FETCH_THROTTLE_S = 300;
const FETCH_TIMEOUT_MS = 30_000;

// ─── sentinel (intentional-divergence opt-out) ──────────────────────────────

export interface DriftSentinelInfo {
  active: boolean;
  expiresAt: number | null;
  reason: string;
}

export function gitDriftSentinelActive(): DriftSentinelInfo {
  const none: DriftSentinelInfo = { active: false, expiresAt: null, reason: "" };
  try {
    if (!existsSync(DRIFT_SENTINEL_PATH)) return none;
    const text = readFileSync(DRIFT_SENTINEL_PATH, "utf8").trim();
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

export function writeDriftSentinel(hours: number, reason: string): void {
  mkdirSync(dirname(DRIFT_SENTINEL_PATH), { recursive: true });
  const exp = Date.now() + Math.round(hours * 3600_000);
  writeFileSync(DRIFT_SENTINEL_PATH, `${exp}\n${reason}\n`);
}

// ─── git plumbing (all failures caught → caller decides) ────────────────────

function git(args: string, opts: { timeout?: number } = {}): string | null {
  try {
    return execSync(`git ${args}`, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: opts.timeout ?? 20_000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function gitOk(args: string, opts: { timeout?: number } = {}): boolean {
  try {
    execSync(`git ${args}`, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: opts.timeout ?? 60_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

/** True when tracked files have staged OR unstaged modifications/deletions
 *  (untracked files — like fresh screenshots — never block a realign). */
function trackedTreeDirty(): boolean {
  const out = git("status --porcelain -z --no-renames -uno");
  if (out === null) return true; // cannot determine → treat as dirty (safe)
  return out.length > 0;
}

// ─── classification ─────────────────────────────────────────────────────────

export type DriftClass = "no-repo" | "no-remote" | "synced" | "ahead-only" | "behind" | "diverged" | "unknown";

export interface GitDriftStatus {
  klass: DriftClass;
  head: string;
  origin: string;
  mergeBase: string | null;
  localOnly: string[]; // commits on local side since merge-base
  behindCount: number;
  fetchedNow: boolean; // true when THIS call performed the network fetch
  note?: string;
}

interface DriftState {
  lastFetchAt: number;
  lastFetchOk: boolean;
  lastOrigin: string;
}

function readState(): DriftState {
  try {
    const s = JSON.parse(readFileSync(DRIFT_STATE_PATH, "utf8")) as DriftState;
    return { lastFetchAt: s.lastFetchAt ?? 0, lastFetchOk: s.lastFetchOk ?? false, lastOrigin: s.lastOrigin ?? "" };
  } catch {
    return { lastFetchAt: 0, lastFetchOk: false, lastOrigin: "" };
  }
}

function writeState(s: DriftState): void {
  try {
    writeFileSync(DRIFT_STATE_PATH, JSON.stringify(s));
  } catch {
    /* /tmp unwritable → throttling degrades to fetch-every-call; acceptable */
  }
}

export function classifyGitDrift(opts: { forceFetch?: boolean } = {}): GitDriftStatus {
  const unknown: GitDriftStatus = { klass: "unknown", head: "", origin: "", mergeBase: null, localOnly: [], behindCount: 0, fetchedNow: false };
  if (!existsSync(GIT_DIR)) return { ...unknown, klass: "no-repo", note: "no .git — production/standalone boot; guard inactive" };

  const remotes = git("remote");
  if (!remotes || !remotes.split("\n").includes("origin")) {
    return { ...unknown, klass: "no-remote", note: "no origin remote; guard inactive" };
  }

  // Throttled fetch (force via env/arg for the CLI + battery planes).
  const st = readState();
  const force = opts.forceFetch === true || process.env.MTQ_GIT_DRIFT_FORCE === "1";
  const due = Date.now() - st.lastFetchAt >= FETCH_THROTTLE_S * 1000;
  let fetchedNow = false;
  if (force || due) {
    // --prune keeps origin/main honest about deleted upstream branches.
    fetchedNow = gitOk("fetch origin --prune --quiet", { timeout: FETCH_TIMEOUT_MS });
    writeState({ lastFetchAt: Date.now(), lastFetchOk: fetchedNow, lastOrigin: st.lastOrigin });
    if (!fetchedNow && !gitOk("rev-parse --verify --quiet origin/main")) {
      return { ...unknown, klass: "unknown", note: "fetch failed and no cached origin/main ref — cannot classify" };
    }
  }

  const head = git("rev-parse HEAD");
  const origin = git("rev-parse origin/main");
  if (!head || !origin) return { ...unknown, note: "rev-parse failed" };
  if (head === origin) return { klass: "synced", head, origin, mergeBase: head, localOnly: [], behindCount: 0, fetchedNow };

  const mb = git(`merge-base ${head} ${origin}`);
  if (!mb) {
    return { klass: "diverged", head, origin, mergeBase: null, localOnly: [], behindCount: 0, fetchedNow, note: "no common ancestor — unrelated histories" };
  }

  const localOnly = git(`rev-list --reverse ${origin}..${head}`)?.split("\n").filter(Boolean) ?? [];
  const behindCount = Number(git(`rev-list --count ${head}..${origin}`) ?? 0);

  if (localOnly.length === 0 && behindCount > 0) return { klass: "behind", head, origin, mergeBase: mb, localOnly, behindCount, fetchedNow };
  if (localOnly.length > 0 && behindCount === 0) return { klass: "ahead-only", head, origin, mergeBase: mb, localOnly, behindCount, fetchedNow };
  return { klass: "diverged", head, origin, mergeBase: mb, localOnly, behindCount, fetchedNow };
}

// ─── content-subsumption proof (DIVERGED auto-realign gate) ─────────────────

export interface SubsumptionReport {
  safe: boolean;
  paths: Array<{ path: string; verdict: "derivable" | "deleted-origin-wins" | "ancestor-blob" | "unique-content" | "unknown" }>;
  blockers: string[];
}

/** Paths changed on the LOCAL side since the merge-base (three-dot diff). */
export function localSideChangedPaths(status: GitDriftStatus): string[] {
  if (!status.mergeBase) return [];
  const out = git(`diff --name-only --no-renames ${status.origin}...${status.head}`);
  if (out === null || out === "") return [];
  return out.split("\n").filter(Boolean);
}

/**
 * PROOF that a diverged local line carries no unique content:
 * every local-side changed path is derivable/evidence, deleted-locally-
 * while-origin-has-it, or holds a blob that already exists somewhere in
 * origin/main's history of that path (an ancestor state origin evolved
 * past — exactly the amend-drift signature of incident #8).
 */
export function proveSubsumption(status: GitDriftStatus): SubsumptionReport {
  const report: SubsumptionReport = { safe: true, paths: [], blockers: [] };
  const paths = localSideChangedPaths(status);
  for (const p of paths) {
    const derivable = DERIVABLE_PREFIXES.some((pre) => p.startsWith(pre));
    if (derivable) {
      report.paths.push({ path: p, verdict: "derivable" });
      continue;
    }
    const localBlob = git(`rev-parse ${status.head}:${JSON.stringify(p)}`);
    const originBlob = git(`rev-parse ${status.origin}:${JSON.stringify(p)}`);
    if (localBlob === null && originBlob !== null) {
      // Deleted locally, alive upstream → the 5× upload-route class.
      report.paths.push({ path: p, verdict: "deleted-origin-wins" });
      continue;
    }
    if (localBlob !== null && originBlob !== null && localBlob === originBlob) {
      report.paths.push({ path: p, verdict: "ancestor-blob" }); // identical → trivially subsumed
      continue;
    }
    if (localBlob !== null) {
      // Modified/added locally: subsumed iff this exact blob appears anywhere
      // in origin/main's history of the path (local is an old snapshot).
      const hist = git(`rev-list ${status.origin} -- ${JSON.stringify(p)}`);
      let subsumed = false;
      if (hist) {
        for (const c of hist.split("\n").filter(Boolean)) {
          const b = git(`rev-parse ${c}:${JSON.stringify(p)}`);
          if (b === localBlob) {
            subsumed = true;
            break;
          }
        }
      }
      if (subsumed) {
        report.paths.push({ path: p, verdict: "ancestor-blob" });
        continue;
      }
    }
    report.paths.push({ path: p, verdict: "unique-content" });
    report.blockers.push(p);
    report.safe = false;
  }
  return report;
}

// ─── archive (evidence preservation before any destructive realign) ─────────

function archiveDrift(status: GitDriftStatus, subsumption: SubsumptionReport | null, log: (s: string) => void): string | null {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "T").slice(0, 19) + "Z";
    const dir = join(ROOT, "mtq-sigma-backups", "selfheal-archive", `gitdrift-${ts}`);
    mkdirSync(dir, { recursive: true });
    // 1. Full bundle of the local line (complete history incl. local-only commits).
    const bundle = join(dir, "local-line.bundle");
    gitOk(`bundle create ${JSON.stringify(bundle)} --all`);
    // 2. Byte copies of every local-side changed path (git-independent recovery).
    const filesDir = join(dir, "files");
    for (const { path: p } of subsumption?.paths ?? []) {
      const src = join(ROOT, p);
      if (!existsSync(src)) continue; // deleted-locally paths have no file to copy
      const dest = join(filesDir, p);
      mkdirSync(dirname(dest), { recursive: true });
      if (statSync(src).isFile()) copyFileSync(src, dest);
    }
    // 3. Manifest.
    const manifest = [
      `# git-drift realignment archive (task60)`,
      `archivedAt: ${new Date().toISOString()}`,
      `localHead: ${status.head}`,
      `originMain: ${status.origin}`,
      `classification: ${status.klass} (localOnly=${status.localOnly.length}, behind=${status.behindCount})`,
      `subsumptionSafe: ${subsumption?.safe ?? "n/a (fast-forward path)"}`,
      ``,
      `## local-only commits`,
      ...(status.localOnly.length === 0 ? ["(none — fast-forward realignment)"] : status.localOnly),
      ``,
      `## local-side changed paths`,
      ...(subsumption?.paths.map((x) => `${x.verdict.padEnd(20)} ${x.path}`) ?? ["(n/a)"]),
      ``,
      `## recovery`,
      `git clone local-line.bundle <dir>   # full pre-realign history`,
      `files/                              # byte copies of every changed path`,
    ].join("\n");
    writeFileSync(join(dir, "MANIFEST.txt"), manifest);
    log(`[git-drift] archived local line → ${dir}`);
    return dir;
  } catch (e) {
    log(`[git-drift] WARNING: archive step failed (${e instanceof Error ? e.message : String(e)})`);
    return null;
  }
}

// ─── post-realign housekeeping ──────────────────────────────────────────────

/** Runtime layer must match the new HEAD: dependencies + Prisma client. */
function refreshRuntimeLayer(oldHead: string, newHead: string, log: (s: string) => void): void {
  const runtimeFiles = ["package.json", "bun.lock", "prisma/schema.prisma"];
  let changed = false;
  for (const f of runtimeFiles) {
    const a = git(`rev-parse ${oldHead}:${JSON.stringify(f)}`);
    const b = git(`rev-parse ${newHead}:${JSON.stringify(f)}`);
    if (a !== b) {
      changed = true;
      log(`[git-drift] runtime layer changed across realign: ${f}`);
    }
  }
  if (!changed) return;
  log("[git-drift] refreshing runtime layer (bun install + prisma generate) ...");
  try {
    execSync("bun install", { cwd: ROOT, encoding: "utf8", timeout: 240_000, stdio: ["ignore", "pipe", "pipe"] });
    log("[git-drift] bun install OK");
  } catch (e) {
    log(`[git-drift] bun install FAILED (server may still boot on compatible deps): ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    execSync("bunx prisma generate", { cwd: ROOT, encoding: "utf8", timeout: 120_000, stdio: ["ignore", "pipe", "pipe"] });
    log("[git-drift] prisma generate OK");
  } catch (e) {
    log(`[git-drift] prisma generate FAILED: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─── the actuator ───────────────────────────────────────────────────────────

export type DriftGuardAction = "none" | "sentinel" | "fast-forwarded" | "realigned" | "blocked";

export interface GitDriftGuardReport {
  action: DriftGuardAction;
  status: GitDriftStatus;
  subsumption?: SubsumptionReport;
  archiveDir?: string;
  note?: string;
}

/**
 * Guard entry point. NEVER throws — every failure degrades to "blocked" or
 * "none" with a note. The caller decides what to do with exit semantics:
 * the CLI maps realigned→42 (restart advised), blocked→1.
 *
 * opts.runtimeRefresh (default true): run `bun install` + `prisma generate`
 * when the runtime layer changed across the realign. The IN-PROCESS caller
 * (instrumentation.ts) passes false — swapping node_modules under a running
 * server is the watchdog's job at its clean reboot, not the server's own.
 */
export function guardGitDrift(
  opts: { log?: (s: string) => void; runtimeRefresh?: boolean } = {},
): GitDriftGuardReport {
  const log = opts.log ?? ((s: string) => console.log(s));
  const runtimeRefresh = opts.runtimeRefresh !== false;

  const sentinel = gitDriftSentinelActive();
  if (sentinel.active) {
    const status = classifyGitDrift();
    log(`[git-drift] sentinel active (${sentinel.reason || "n/a"}) — standing down.`);
    return { action: "sentinel", status, note: `intentional divergence acknowledged (${sentinel.reason || "n/a"})` };
  }

  const status = classifyGitDrift();

  switch (status.klass) {
    case "no-repo":
    case "no-remote":
      return { action: "none", status };

    case "synced":
      log(`[git-drift] OK — local == origin/main == ${status.head.slice(0, 12)}.`);
      return { action: "none", status };

    case "ahead-only": {
      log(
        `[git-drift] local is AHEAD of origin/main by ${status.localOnly.length} commit(s) — not a regression; ` +
          `PUSH so the cloud layer holds this work (re-images wipe unpushed commits): git push origin HEAD:main`,
      );
      return { action: "none", status };
    }

    case "behind": {
      log(
        `[git-drift] STALE HEAD: local ${status.head.slice(0, 12)} is BEHIND origin/main ${status.origin.slice(0, 12)} ` +
          `by ${status.behindCount} commit(s) — the re-image regression class (incident #8).`,
      );
      if (trackedTreeDirty()) {
        log("[git-drift] BLOCKED: tracked working tree is dirty — commit/stash first, then re-run. Never auto-merge over local edits.");
        return { action: "blocked", status, note: "dirty tree" };
      }
      // Fast-forward only: provably lossless (local has zero local-only commits).
      if (!gitOk(`merge --ff-only ${status.origin}`)) {
        log("[git-drift] BLOCKED: fast-forward merge failed (run by hand: git merge --ff-only origin/main).");
        return { action: "blocked", status, note: "ff merge failed" };
      }
      archiveDrift(status, null, log); // evidence-only (no local-only commits to lose)
      if (runtimeRefresh) refreshRuntimeLayer(status.head, status.origin, log);
      else log("[git-drift] runtime-layer refresh SKIPPED (in-process call) — reboot will pick up dependency changes.");
      writeFileSync(REALIGN_MARKER_PATH, `${new Date().toISOString()} ff ${status.head} ${status.origin}\n`);
      log(`[git-drift] FAST-FORWARDED to origin/main ${status.origin.slice(0, 12)} — server restart advised (marker written).`);
      return { action: "fast-forwarded", status };
    }

    case "diverged": {
      log(
        `[git-drift] DIVERGED: local ${status.head.slice(0, 12)} (local-only ${status.localOnly.length}) vs ` +
          `origin/main ${status.origin.slice(0, 12)} (behind ${status.behindCount}) — the amend-drift signature (incident #8).`,
      );
      if (trackedTreeDirty()) {
        log("[git-drift] BLOCKED: tracked working tree is dirty — commit/stash first, then re-run.");
        return { action: "blocked", status, note: "dirty tree" };
      }
      const subsumption = proveSubsumption(status);
      if (!subsumption.safe) {
        log("[git-drift] BLOCKED: local line carries UNIQUE content never seen on origin — refusing to auto-realign.");
        for (const b of subsumption.blockers) log(`[git-drift]   unique: ${b}`);
        log(
          "[git-drift] human decision required: forward-only merge (git merge origin/main --no-ff --no-commit, task49 pattern) " +
            "or push the local line first. Intentional divergence: bun run scripts/git-drift-guard.ts --allow-drift \"reason\"",
        );
        return { action: "blocked", status, subsumption, note: "unique local content" };
      }
      const archiveDir = archiveDrift(status, subsumption, log) ?? undefined;
      if (!gitOk(`reset --hard ${status.origin}`)) {
        log("[git-drift] BLOCKED: reset failed after proven-safe classification (run by hand: git reset --hard origin/main).");
        return { action: "blocked", status, subsumption, note: "reset failed" };
      }
      if (runtimeRefresh) refreshRuntimeLayer(status.head, status.origin, log);
      else log("[git-drift] runtime-layer refresh SKIPPED (in-process call) — reboot will pick up dependency changes.");
      writeFileSync(REALIGN_MARKER_PATH, `${new Date().toISOString()} realign ${status.head} ${status.origin}\n`);
      log(
        `[git-drift] REALIGNED to origin/main ${status.origin.slice(0, 12)} (content-subsumption proven; ` +
          `local line archived${archiveDir ? " → " + archiveDir : ""}) — server restart advised (marker written).`,
      );
      return { action: "realigned", status, subsumption, archiveDir };
    }

    default:
      log(`[git-drift] cannot classify (${status.note ?? status.klass}) — standing down WITHOUT action.`);
      return { action: "none", status, note: status.note };
  }
}
