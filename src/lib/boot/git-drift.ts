// MTQΣ — Boot-time git-drift guard (Task 60 — root-cause remediation round 3;
// quoting defect fixed in v27 critical recovery — incident #10).
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
// WHY round 2 (incident #10, 2026-11-08): the guard itself was defeated by
// git's default PATH QUOTING. `git diff --name-only` C-quotes any path with
// non-ASCII bytes (the 11 owner screenshots carry U+202F NARROW NO-BREAK
// SPACE: "upload/Screenshot …\342\200\257AM.png"). The quoted string then
// (a) bypassed the upload/ derivable-prefix fast-path, and (b) failed every
// rev-parse blob lookup (that literal quoted name does not exist in the
// tree) — so 11 existing evidence screenshots were misclassified as
// UNIQUE-CONTENT and the guard BLOCKED forever on a geometry it was designed
// to realign. The permanent fix: ALL path-listing reads are NUL-delimited
// (-z, literal bytes, never quoted), and ALL path-bearing git invocations
// go through argv (execFileSync, no shell) so spaces, quotes, tabs,
// newlines, $, backticks, and every Unicode codepoint survive verbatim.
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
//           (a) derivable/evidence (backups/db-snapshots/**, upload/**,
//               backups/plane5/** — the re-derivable telemetry heartbeat),
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

import { execSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ROOT override (v27 critical-recovery): tests drive the guard against
// temporary repositories by exporting MTQ_SIGMA_ROOT; production derivation
// (script location) is unchanged and remains the default. The override never
// widens what the guard may touch — it only retargets WHICH repo it inspects.
const ROOT = process.env.MTQ_SIGMA_ROOT
  ? resolve(process.env.MTQ_SIGMA_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const GIT_DIR = join(ROOT, ".git");
export const DRIFT_SENTINEL_PATH = join(ROOT, "db", "ALLOW-GIT-REALIGN");
export const DRIFT_STATE_PATH = join("/tmp", "mtq-git-drift-state.json");
export const REALIGN_MARKER_PATH = join("/tmp", "mtq-git-realign.flag");

/** Paths whose local-side changes are always safe to drop (live-derivable
 * dumps, owner evidence screenshots, and the plane-5 telemetry heartbeat —
 * all recoverable from the live DB or re-created by the next plane-5 run,
 * and preserved in the pre-realign archive regardless). */
const DERIVABLE_PREFIXES = ["backups/db-snapshots/", "upload/", "backups/plane5/"];

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

/**
 * Shell-string git helper — SAFE ONLY for commands whose every argument is a
 * literal we control (refs/SHAs/flags). NEVER pass a PATH through this: the
 * shell would mangle quotes/spaces/$/backticks and git would C-quote
 * non-ASCII output (the incident-#10 class). Path-bearing commands MUST use
 * gitArgs() below.
 */
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

/**
 * Argv-safe git invocation: NO shell — paths travel as literal argv bytes and
 * survive spaces, double/single quotes, tabs, newlines, $, backticks, and
 * every Unicode codepoint (U+202F included) verbatim. This is the ONLY
 * sanctioned way to hand git a path. Output is raw (no trim) — trim only
 * SHA/ref outputs, never path lists.
 */
function gitArgs(args: string[], opts: { timeout?: number } = {}): string | null {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: opts.timeout ?? 20_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

function gitArgsOk(args: string[], opts: { timeout?: number } = {}): boolean {
  return gitArgs(args, opts) !== null;
}

/**
 * Porcelain v1 (-z) records MUST NOT be trimmed: an unstaged record is
 * `"XY path"` with X = ' ' — a leading space that is PART OF THE DATA.
 * .trim() would shift every field left by one (status codes misread, paths
 * lose their first character — the write-behind regex would never match and
 * every unstaged modification would misclassify). Note: -z porcelain output
 * is NUL-delimited and NEVER path-quoted (literal bytes) — the incident-#10
 * quoting hazard does not apply here. Mirrors the no-trim read in
 * src/lib/boot/source-integrity.ts listUnstagedDeletions().
 */
function gitRaw(args: string, opts: { timeout?: number } = {}): string | null {
  try {
    return execSync(`git ${args}`, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: opts.timeout ?? 20_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
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

/** Paths whose UNSTAGED MODIFICATIONS never block a realign: the cloud-sync
 *  write-behind loop (task42/47) keeps latest-*.sql perpetually modified in
 *  the working tree between commits — that is the DESIGNED steady state, not
 *  mid-work edits. Their on-disk bytes are archived before any destructive
 *  step and re-derived from the live DB by the next sync tick (≤60s); a
 *  realign may safely reset them to origin's version. STAGED changes to these
 *  paths still block (staging is explicit intent). */
const WRITE_BEHIND_DUMP_RE = /^backups\/db-snapshots\/latest-[a-z]+\.sql$/;

/** Unstaged write-behind dump modifications currently in the tree (to archive
 *  + discard before a fast-forward merge; reset --hard discards them itself). */
function writeBehindDirtyDumps(): string[] {
  const out = gitRaw("status --porcelain -z --no-renames -uno");
  if (out === null) return [];
  const paths: string[] = [];
  for (const rec of out.split("\0")) {
    if (rec.length < 3) continue;
    const x = rec[0];
    const y = rec[1];
    const path = rec.slice(3);
    if (x === " " && y === "M" && WRITE_BEHIND_DUMP_RE.test(path)) paths.push(path);
  }
  return paths;
}

/** True when tracked files have staged OR unstaged modifications/deletions
 *  (untracked files — like fresh screenshots — never block a realign).
 *  EXCEPTION: unstaged modifications of the write-behind dump files are the
 *  cloud-sync loop's designed steady state and do NOT block (see
 *  WRITE_BEHIND_DUMP_RE) — without this exception the perpetual dump refresh
 *  would BLOCK every auto-realign and defeat the guard entirely. */
function trackedTreeDirty(): boolean {
  const out = gitRaw("status --porcelain -z --no-renames -uno");
  if (out === null) return true; // cannot determine → treat as dirty (safe)
  for (const rec of out.split("\0")) {
    if (rec.length < 3) continue;
    const x = rec[0];
    const y = rec[1];
    const path = rec.slice(3);
    if (x === " " && y === "M" && WRITE_BEHIND_DUMP_RE.test(path)) continue; // designed steady state
    return true;
  }
  return false;
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

/**
 * Paths changed on the LOCAL side since the merge-base (three-dot diff).
 *
 * v27 FIX (incident-#10 class): the previous implementation read the diff
 * line-oriented WITHOUT -z, so git's default C-quoting mangled every path
 * containing non-ASCII bytes (e.g. U+202F NARROW NO-BREAK SPACE in the owner
 * screenshots): the quoted form ("upload/…\342\200\257AM.png") was treated as
 * a literal filename — it bypassed the DERIVABLE_PREFIXES fast-path (leading
 * double-quote) AND failed rev-parse blob lookups — flipping 11 derivable
 * evidence files into false "unique-content" blockers and BLOCKING every
 * realign of the amended-task46 geometry (incidents #9 and #10).
 *
 * Fix: NUL-delimited output (-z) is parsed as NUL-separated bytes.
 * `git diff -z` NEVER quotes paths, so every entry is the true filesystem
 * name — spaces, tabs, newlines, quotes, parentheses, Unicode and U+202F
 * all round-trip exactly. --no-renames is preserved so each NUL record is
 * exactly one path (no paired old/new names). core.quotepath=off is
 * belt-and-suspenders. Every other filename reader in this module
 * (writeBehindDirtyDumps, trackedTreeDirty) already used porcelain -z and
 * was verified quote-free.
 */
export function localSideChangedPaths(status: GitDriftStatus): string[] {
  if (!status.mergeBase) return [];
  const out = gitArgs([
    "-c", "core.quotepath=off",
    "diff", "--name-only", "-z", "--no-renames",
    `${status.origin}...${status.head}`,
  ]);
  if (out === null || out === "") return [];
  return out.split("\0").filter(Boolean);
}

/**
 * PROOF that a diverged local line carries no unique content:
 * every local-side changed path is derivable/evidence, deleted-locally-
 * while-origin-has-it, or holds a blob that already exists somewhere in
 * origin/main's history of that path (an ancestor state origin evolved
 * past — exactly the amend-drift signature of incident #8).
 *
 * All blob/path lookups go through argv (gitArgs) — a path containing
 * quotes, $, or backticks would corrupt under shell interpolation, and a
 * C-quoted pseudo-path would simply not resolve.
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
    const localBlob = gitArgs(["rev-parse", `${status.head}:${p}`])?.trim() ?? null;
    const originBlob = gitArgs(["rev-parse", `${status.origin}:${p}`])?.trim() ?? null;
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
      const hist = gitArgs(["rev-list", status.origin, "--", p]);
      let subsumed = false;
      if (hist) {
        for (const c of hist.split("\n").filter(Boolean)) {
          const b = gitArgs(["rev-parse", `${c}:${p}`])?.trim() ?? null;
          if (b !== null && b === localBlob) {
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
    gitArgsOk(["bundle", "create", bundle, "--all"]);
    // 2. Byte copies of every local-side changed path (git-independent recovery) —
    //    PLUS the write-behind dump files' current on-disk bytes (their unstaged
    //    modifications are the freshest data snapshot; reset --hard/checkout
    //    discards them, so the archive keeps the only copy).
    //    Paths are literal (from -z reads) — join() handles every byte safely.
    const filesDir = join(dir, "files");
    const archivePaths = new Set<string>((subsumption?.paths ?? []).map((x) => x.path));
    for (const p of writeBehindDirtyDumps()) archivePaths.add(p);
    for (const p of archivePaths) {
      const src = join(ROOT, p);
      if (!existsSync(src)) continue; // deleted-locally paths have no file to copy
      const dest = join(filesDir, p);
      mkdirSync(dirname(dest), { recursive: true });
      if (statSync(src).isFile()) copyFileSync(src, dest);
    }
    // 3. Manifest.
    const dirtyDumps = writeBehindDirtyDumps();
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
      `## write-behind dump snapshots archived (unstaged cloud-sync refresh)`,
      ...(dirtyDumps.length === 0 ? ["(none)"] : dirtyDumps),
      ``,
      `## recovery`,
      `git clone local-line.bundle <dir>   # full pre-realign history`,
      `files/                              # byte copies of every changed path (+ freshest dump bytes)`,
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
    const a = gitArgs(["rev-parse", `${oldHead}:${f}`])?.trim() ?? null;
    const b = gitArgs(["rev-parse", `${newHead}:${f}`])?.trim() ?? null;
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
      // The write-behind dump files carry unstaged modifications (the cloud-sync
      // steady state): archive their fresher bytes FIRST, then discard the
      // modification so the FF merge cannot be refused over it.
      const dirtyDumps = writeBehindDirtyDumps();
      const archiveDirFF = archiveDrift(status, null, log) ?? undefined;
      for (const p of dirtyDumps) {
        // Discard the unstaged dump modification so the FF merge cannot be
        // refused over it; the next cloud-sync tick (≤60s) re-dumps from the
        // LIVE DB (the source of truth, untouched by any realign).
        gitArgsOk(["checkout", "--", p]);
      }
      if (!gitOk(`merge --ff-only ${status.origin}`)) {
        log("[git-drift] BLOCKED: fast-forward merge failed (run by hand: git merge --ff-only origin/main).");
        return { action: "blocked", status, note: "ff merge failed" };
      }
      if (runtimeRefresh) refreshRuntimeLayer(status.head, status.origin, log);
      else log("[git-drift] runtime-layer refresh SKIPPED (in-process call) — reboot will pick up dependency changes.");
      writeFileSync(REALIGN_MARKER_PATH, `${new Date().toISOString()} ff ${status.head} ${status.origin}\n`);
      log(`[git-drift] FAST-FORWARDED to origin/main ${status.origin.slice(0, 12)} — server restart advised (marker written).`);
      return { action: "fast-forwarded", status, archiveDir: archiveDirFF };
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
