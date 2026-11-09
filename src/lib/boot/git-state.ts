// MTQΣ — Shared Git branch-state classification (V31 TURN 2A — incident 19
// root-cause fix, Phase 3).
//
// WHY: two guards held contradictory policies for the SAME Git state. The
// drift guard (src/lib/boot/git-drift.ts, case "ahead-only") treats a local
// branch ahead of origin/main as benign (action "none", exit 0 — "not a
// regression"), while the external bootstrap (scripts/plane5-bootstrap.sh
// §3.8) asserted strict HEAD == origin/main and blocked with exit 13 — and
// the heartbeat writer held a third copy of the same equality check. A
// validated forward-only database snapshot must not be rejected merely
// because its commit has not yet been pushed; an unverified source-code
// commit must never be accepted merely because the local branch is ahead.
//
// THE EIGHT STATES (V31 TURN 2A §3):
//   EXACT_MATCH          local HEAD == origin/main.
//   SAFE_SNAPSHOT_AHEAD  verified descendant of origin/main; EVERY commit in
//                        the ahead range touches ONLY explicitly allowlisted
//                        operational snapshot/evidence paths; every snapshot
//                        passes independent integrity checks (tip parse,
//                        canonical genesis, transaction completeness,
//                        forward-only height/row progression) and the HEAD
//                        state carries a manifest whose cryptographic hashes
//                        match the committed payloads.
//   SOURCE_CODE_AHEAD    one or more ahead commits touch application source,
//                        deployment configuration, security controls, scripts,
//                        or any other non-approved path (or delete an
//                        approved one).
//   BEHIND               local branch is behind origin/main.
//   DIVERGED             neither side is an ancestor of the other.
//   REMOTE_UNAVAILABLE   the remote cannot be verified.
//   SNAPSHOT_INVALID     a snapshot in the ahead range (or the HEAD-state
//                        manifest) fails integrity, ancestry, genesis,
//                        completeness, forward-only, or hash verification.
//   AUTHORITY_UNVERIFIED the database recovery authority cannot be established
//                        (intentional-reset sentinel active, or the
//                        recovery-critical heal tooling is absent at HEAD).
//
// No ambiguous state may silently become SAFE_SNAPSHOT_AHEAD: every check
// must pass explicitly, and every failed check lands in `reasons`.
//
// SAFETY SEPARATION: this classification gates BOOTSTRAP ONLY. It never
// authorizes database restoration — recovery keeps its own fail-closed
// forward-only authorization (selfHealDatabases / db-selfheal.ts), and an
// accepted Git state is merely a precondition for that machinery to run.
//
// Dependency policy: node builtins ONLY (mirror of git-drift.ts) — importable
// from the Next.js server, plain bun scripts, and dependency-free test
// sandboxes. All path-listing reads are NUL-delimited (-z) and all
// path-bearing git invocations go through argv (execFileSync, no shell) —
// the incident #10 quoting lessons apply here verbatim.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_GENESIS,
  CUSTOM_DUMP_REL,
  CHAIN_DUMP_REL,
  MANIFEST_REL,
  dumpComplete,
  dumpGenesisOk,
  parseDumpTipText,
  sha256Text,
  CUSTOM_PRUNE_TOLERANCE_RATIO,
  type SnapshotManifest,
} from "./snapshot-manifest";

export const GIT_STATE_ROOT =
  process.env.MTQ_SIGMA_ROOT ?? resolve(dirname_(fileURLToPath(import.meta.url)), "..", "..", "..");

function dirname_(p: string): string {
  return resolve(p, "..");
}

export type GitBranchState =
  | "EXACT_MATCH"
  | "SAFE_SNAPSHOT_AHEAD"
  | "SOURCE_CODE_AHEAD"
  | "BEHIND"
  | "DIVERGED"
  | "REMOTE_UNAVAILABLE"
  | "SNAPSHOT_INVALID"
  | "AUTHORITY_UNVERIFIED"
  | "CLASSIFY_ERROR";

// ─── approved operational paths (explicit — never a broad wildcard) ──────────

/** Snapshot payloads + manifest: the ONLY database-snapshot paths an ahead
 *  commit may touch. File-level explicitness is deliberate (V31 TURN 2A
 *  restriction #3: no broad wildcard exception for database snapshots). */
const APPROVED_SNAPSHOT_PATHS: readonly string[] = [
  CHAIN_DUMP_REL,
  CUSTOM_DUMP_REL,
  MANIFEST_REL,
];

/** Plane-5 operational telemetry evidence (never read by the application at
 *  runtime; re-derivable by the next plane-5 execution). */
const APPROVED_EVIDENCE_PATHS: readonly string[] = [
  "backups/plane5/execution-ledger.jsonl",
  "backups/plane5/execution-ledger.archive.jsonl",
  "backups/plane5/heartbeat.json",
  "backups/plane5/monitor-state.json",
  "backups/plane5/alerts.log",
  "worklog.md",
];

/** Audit/evidence report trees (documentation produced by verification
 *  turns; never imported or executed by the application). */
const APPROVED_EVIDENCE_PREFIXES: readonly string[] = ["audit-work/", "evidence/"];

export function isApprovedAheadPath(path: string): boolean {
  if (APPROVED_SNAPSHOT_PATHS.includes(path)) return true;
  if (APPROVED_EVIDENCE_PATHS.includes(path)) return true;
  return APPROVED_EVIDENCE_PREFIXES.some((pfx) => path.startsWith(pfx));
}

// ─── report shape ────────────────────────────────────────────────────────────

export interface AheadCommitInfo {
  sha: string;
  subject: string;
  files: Array<{ status: string; path: string }>;
  snapshotOnly: boolean;
  chainHeight?: number | null;
  customRows?: number | null;
}

export interface GitStateReport {
  state: GitBranchState;
  head: string;
  origin: string;
  mergeBase: string | null;
  aheadCount: number;
  behindCount: number;
  aheadCommits: AheadCommitInfo[];
  reasons: string[];
  fetchedNow: boolean;
  checkedAtIso: string;
  manifest?: {
    present: boolean;
    version?: number;
    chainShaOk?: boolean;
    customShaOk?: boolean;
    genesisOk?: boolean;
  };
  authority?: {
    selfhealCliPresent: boolean;
    dbOpsLibPresent: boolean;
    resetSentinelActive: boolean;
  };
  note?: string;
}

// ─── git plumbing (argv-only, NUL-delimited) ─────────────────────────────────

const GIT_TIMEOUT_MS = 60_000;
const BLOB_MAX = 192 * 1024 * 1024; // published chain dumps reach ~36 MB

function gitRaw(root: string, args: string[]): string | null {
  try {
    const out = execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: BLOB_MAX,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return out;
  } catch {
    return null;
  }
}

function git(root: string, args: string[]): string | null {
  const out = gitRaw(root, args);
  return out === null ? null : out.trim();
}

/** Blob text at a revision (null when the path does not exist at that rev). */
function blobText(root: string, rev: string, path: string): string | null {
  const out = gitRaw(root, ["show", `${rev}:${path}`]);
  // `git show` on a missing path exits non-zero on stderr → null.
  return out;
}

function pathExistsAt(root: string, rev: string, path: string): boolean {
  return gitRaw(root, ["cat-file", "-e", `${rev}:${path}`]) !== null;
}

/** NUL-delimited changed paths of a commit vs its first parent. */
function commitChanges(root: string, sha: string): Array<{ status: string; path: string }> {
  const out = gitRaw(root, ["diff-tree", "--no-commit-id", "--name-status", "-r", "-z", "--no-renames", sha]);
  if (out === null) return [{ status: "?", path: "" }]; // unparseable → treat as unknown/blocked
  const recs: Array<{ status: string; path: string }> = [];
  const parts = out.split("\0").filter(Boolean);
  for (let i = 0; i + 1 < parts.length; i += 2) {
    recs.push({ status: parts[i], path: parts[i + 1] });
  }
  // Odd trailing fragment (should not happen with -z) → unknown record.
  if (parts.length % 2 === 1) recs.push({ status: "?", path: parts[parts.length - 1] });
  return recs;
}

// ─── authority (fail-closed recovery authorization prerequisites) ────────────

interface AuthorityCheck {
  selfhealCliPresent: boolean;
  dbOpsLibPresent: boolean;
  resetSentinelActive: boolean;
}

function checkAuthority(root: string, head: string): AuthorityCheck {
  const selfhealCliPresent = pathExistsAt(root, head, "scripts/db-selfheal.ts");
  const dbOpsLibPresent = pathExistsAt(root, head, "src/lib/db-ops.ts");
  let resetSentinelActive = false;
  try {
    const sentinelPath = join(root, "db", "ALLOW-GENESIS-RESET");
    if (existsSync(sentinelPath)) {
      const first = readFileSync(sentinelPath, "utf8").trim().split("\n")[0] ?? "";
      const exp = Number(first);
      resetSentinelActive = Number.isFinite(exp) && exp > Date.now();
    }
  } catch {
    resetSentinelActive = false;
  }
  return { selfhealCliPresent, dbOpsLibPresent, resetSentinelActive };
}

// ─── classification ──────────────────────────────────────────────────────────

export interface ClassifyOptions {
  /** Perform `git fetch origin --prune` before classifying (default true). */
  fetch?: boolean;
  /** Root override (defaults to MTQ_SIGMA_ROOT / module-derived root). */
  root?: string;
}

export function classifyGitState(opts: ClassifyOptions = {}): GitStateReport {
  const root = resolve(opts.root ?? GIT_STATE_ROOT);
  const nowIso = new Date().toISOString();
  const base: GitStateReport = {
    state: "CLASSIFY_ERROR",
    head: "",
    origin: "",
    mergeBase: null,
    aheadCount: 0,
    behindCount: 0,
    aheadCommits: [],
    reasons: [],
    fetchedNow: false,
    checkedAtIso: nowIso,
  };

  if (!existsSync(join(root, ".git"))) {
    return { ...base, state: "CLASSIFY_ERROR", note: "no .git at root — cannot classify" };
  }
  const remotes = git(root, ["remote"]);
  if (!remotes || !remotes.split("\n").includes("origin")) {
    return { ...base, state: "REMOTE_UNAVAILABLE", note: "no origin remote — the remote cannot be verified" };
  }

  let fetchedNow = false;
  if (opts.fetch !== false) {
    fetchedNow = gitRaw(root, ["fetch", "origin", "--prune", "--quiet"]) !== null;
    if (!fetchedNow) {
      return {
        ...base,
        state: "REMOTE_UNAVAILABLE",
        fetchedNow,
        note: "git fetch origin failed — the remote cannot be verified; no automatic recovery",
      };
    }
  }

  const origin = git(root, ["rev-parse", "--verify", "origin/main"]);
  if (!origin) {
    return { ...base, state: "REMOTE_UNAVAILABLE", note: "origin/main ref not resolvable — remote unverifiable" };
  }
  const head = git(root, ["rev-parse", "HEAD"]);
  if (!head) {
    return { ...base, origin, state: "CLASSIFY_ERROR", note: "rev-parse HEAD failed" };
  }

  // ── topology ───────────────────────────────────────────────────────────
  if (head === origin) {
    // EXACT_MATCH still requires a verifiable snapshot + authority — no
    // ambiguous state may silently pass.
    const authority = checkAuthority(root, head);
    const manifestCheck = headManifestCheck(root, head);
    const reasons: string[] = [];
    if (!authority.selfhealCliPresent) reasons.push("scripts/db-selfheal.ts absent at HEAD — recovery authority unverifiable");
    if (!authority.dbOpsLibPresent) reasons.push("src/lib/db-ops.ts absent at HEAD — recovery authority unverifiable");
    if (authority.resetSentinelActive) reasons.push("db/ALLOW-GENESIS-RESET sentinel active — recovery explicitly blocked (intentional reset)");
    reasons.push(...manifestCheck.reasons);
    if (authority.resetSentinelActive || !authority.selfhealCliPresent || !authority.dbOpsLibPresent) {
      return { ...base, head, origin, mergeBase: head, state: "AUTHORITY_UNVERIFIED", authority, manifest: manifestCheck.summary, reasons, fetchedNow };
    }
    if (!manifestCheck.ok) {
      return { ...base, head, origin, mergeBase: head, state: "SNAPSHOT_INVALID", authority, manifest: manifestCheck.summary, reasons, fetchedNow };
    }
    return {
      ...base,
      head,
      origin,
      mergeBase: head,
      state: "EXACT_MATCH",
      authority,
      manifest: manifestCheck.summary,
      reasons,
      fetchedNow,
    };
  }

  const mergeBase = git(root, ["merge-base", head, origin]);
  if (!mergeBase) {
    return { ...base, head, origin, state: "DIVERGED", note: "no common ancestor — unrelated histories", fetchedNow };
  }

  const aheadList = (git(root, ["rev-list", "--reverse", `${origin}..${head}`]) ?? "").split("\n").filter(Boolean);
  const behindCount = Number(git(root, ["rev-list", "--count", `${head}..${origin}`]) ?? 0);

  if (aheadList.length === 0 && behindCount > 0) {
    return { ...base, head, origin, mergeBase, behindCount, state: "BEHIND", fetchedNow };
  }
  if (aheadList.length > 0 && behindCount > 0) {
    return { ...base, head, origin, mergeBase, aheadCount: aheadList.length, behindCount, state: "DIVERGED", fetchedNow };
  }
  if (aheadList.length === 0) {
    // head != origin, no ahead, no behind — impossible unless refs moved
    // between calls; classify conservatively.
    return { ...base, head, origin, mergeBase, state: "CLASSIFY_ERROR", note: "inconsistent topology (refs moved mid-classification)", fetchedNow };
  }

  // ── ahead-only: validate EVERY commit in the range ─────────────────────
  const reasons: string[] = [];
  let sourceAhead = false;
  let snapshotInvalid = false;
  const aheadCommits: AheadCommitInfo[] = [];

  // Baseline snapshot state at origin/main (the reference for forward-only).
  const originChainTip = (() => {
    const text = blobText(root, origin, CHAIN_DUMP_REL);
    return text === null ? null : parseDumpTipText(text);
  })();
  const originCustomTip = (() => {
    const text = blobText(root, origin, CUSTOM_DUMP_REL);
    return text === null ? null : parseDumpTipText(text);
  })();

  let prevChainHeight: number | null = originChainTip?.height ?? null;
  let prevCustomRows: number | null = originCustomTip?.rows ?? null;

  for (const sha of aheadList) {
    const subject = git(root, ["log", "-1", "--format=%s", sha]) ?? "";
    const files = commitChanges(root, sha);
    const info: AheadCommitInfo = { sha, subject, files, snapshotOnly: true };

    for (const { status, path } of files) {
      if (path === "") continue; // placeholder from unparseable output
      if (status === "?") {
        sourceAhead = true;
        reasons.push(`${sha.slice(0, 8)}: unparseable change record — treated as unapproved`);
        continue;
      }
      if (!isApprovedAheadPath(path)) {
        sourceAhead = true;
        reasons.push(`${sha.slice(0, 8)}: non-approved path '${path}' (${status})`);
        info.snapshotOnly = false;
        continue;
      }
      if (status !== "A" && status !== "M") {
        sourceAhead = true;
        reasons.push(`${sha.slice(0, 8)}: approved path '${path}' has status '${status}' (only A/M permitted — deletions are refused)`);
        info.snapshotOnly = false;
      }
    }

    // Snapshot payload validation for THIS commit.
    const chainText = blobText(root, sha, CHAIN_DUMP_REL);
    if (chainText !== null) {
      const tip = parseDumpTipText(chainText);
      if (!tip) {
        snapshotInvalid = true;
        reasons.push(`${sha.slice(0, 8)}: chain dump at this commit has no v2 tip line`);
      } else {
        info.chainHeight = tip.height;
        if (!dumpGenesisOk(chainText)) {
          snapshotInvalid = true;
          reasons.push(`${sha.slice(0, 8)}: chain dump lacks the canonical genesis`);
        }
        if (!dumpComplete(chainText)) {
          snapshotInvalid = true;
          reasons.push(`${sha.slice(0, 8)}: chain dump INCOMPLETE (no BEGIN/COMMIT wrapper — partial dump)`);
        }
        if (prevChainHeight !== null && (tip.height ?? 0) < prevChainHeight) {
          snapshotInvalid = true;
          reasons.push(`${sha.slice(0, 8)}: chain height h${tip.height} REGRESSES previous h${prevChainHeight} (forward-only violated)`);
        }
        prevChainHeight = tip.height ?? prevChainHeight;
      }
    }
    const customText = blobText(root, sha, CUSTOM_DUMP_REL);
    if (customText !== null) {
      const tip = parseDumpTipText(customText);
      if (!tip) {
        snapshotInvalid = true;
        reasons.push(`${sha.slice(0, 8)}: custom dump at this commit has no v2 tip line`);
      } else {
        info.customRows = tip.rows;
        if (!dumpComplete(customText)) {
          snapshotInvalid = true;
          reasons.push(`${sha.slice(0, 8)}: custom dump INCOMPLETE (no BEGIN/COMMIT wrapper — partial dump)`);
        }
        if (prevCustomRows !== null) {
          const floor = Math.floor(prevCustomRows * CUSTOM_PRUNE_TOLERANCE_RATIO);
          if (tip.rows < floor) {
            snapshotInvalid = true;
            reasons.push(`${sha.slice(0, 8)}: custom rows ${tip.rows} materially regress previous ${prevCustomRows} (below prune tolerance ${floor})`);
          }
        }
        prevCustomRows = tip.rows;
      }
    }
    aheadCommits.push(info);
  }

  // ── authority + HEAD-state manifest ────────────────────────────────────
  const authority = checkAuthority(root, head);
  if (!authority.selfhealCliPresent) reasons.push("scripts/db-selfheal.ts absent at HEAD — recovery authority unverifiable");
  if (!authority.dbOpsLibPresent) reasons.push("src/lib/db-ops.ts absent at HEAD — recovery authority unverifiable");
  if (authority.resetSentinelActive) reasons.push("db/ALLOW-GENESIS-RESET sentinel active — recovery explicitly blocked (intentional reset)");

  const manifestCheck = headManifestCheck(root, head, origin);
  reasons.push(...manifestCheck.reasons);

  // ── state precedence: paths → authority → snapshot content ────────────
  if (sourceAhead) {
    return { ...base, head, origin, mergeBase, aheadCount: aheadList.length, aheadCommits, state: "SOURCE_CODE_AHEAD", authority, manifest: manifestCheck.summary, reasons, fetchedNow };
  }
  if (!authority.selfhealCliPresent || !authority.dbOpsLibPresent || authority.resetSentinelActive) {
    return { ...base, head, origin, mergeBase, aheadCount: aheadList.length, aheadCommits, state: "AUTHORITY_UNVERIFIED", authority, manifest: manifestCheck.summary, reasons, fetchedNow };
  }
  if (snapshotInvalid || !manifestCheck.ok) {
    return { ...base, head, origin, mergeBase, aheadCount: aheadList.length, aheadCommits, state: "SNAPSHOT_INVALID", authority, manifest: manifestCheck.summary, reasons, fetchedNow };
  }

  return {
    ...base,
    head,
    origin,
    mergeBase,
    aheadCount: aheadList.length,
    aheadCommits,
    state: "SAFE_SNAPSHOT_AHEAD",
    authority,
    manifest: manifestCheck.summary,
    reasons,
    fetchedNow,
    note: `${aheadList.length} ahead commit(s), all approved operational snapshot/evidence files; snapshots validated forward-only; HEAD manifest verified`,
  };
}

// ─── HEAD-state manifest verification ────────────────────────────────────────

interface HeadManifestCheck {
  ok: boolean;
  reasons: string[];
  summary: { present: boolean; version?: number; chainShaOk?: boolean; customShaOk?: boolean; genesisOk?: boolean };
}

function headManifestCheck(root: string, head: string, origin?: string): HeadManifestCheck {
  const summary: HeadManifestCheck["summary"] = { present: false };
  const reasons: string[] = [];
  const manifestText = blobText(root, head, MANIFEST_REL);
  if (manifestText === null) {
    reasons.push(`manifest missing at HEAD (${MANIFEST_REL}) — the published snapshot is not independently verifiable`);
    return { ok: false, reasons, summary };
  }
  let manifest: Partial<SnapshotManifest> | null = null;
  try {
    manifest = JSON.parse(manifestText) as Partial<SnapshotManifest>;
  } catch {
    reasons.push("manifest at HEAD is not valid JSON");
    return { ok: false, reasons, summary: { present: true } };
  }
  summary.present = true;
  summary.version = manifest?.version;

  const chainText = blobText(root, head, CHAIN_DUMP_REL);
  const customText = blobText(root, head, CUSTOM_DUMP_REL);
  if (chainText === null) {
    reasons.push(`chain dump payload missing at HEAD (${CHAIN_DUMP_REL})`);
  } else {
    const expected = manifest?.chain?.sha256;
    const actual = sha256Text(chainText);
    summary.chainShaOk = expected === actual;
    if (expected !== actual) {
      reasons.push(`HEAD manifest chain.sha256 mismatch — committed dump is NOT the manifest-described content (expected ${String(expected)?.slice(0, 12)}…, actual ${actual.slice(0, 12)}…)`);
    }
    if (manifest?.chain?.height !== undefined) {
      const tip = parseDumpTipText(chainText);
      if (!tip || tip.height !== manifest.chain.height) {
        reasons.push(`HEAD manifest chain.height ${String(manifest.chain.height)} != committed dump tip ${String(tip?.height)}`);
      }
    }
    if (!dumpGenesisOk(chainText)) {
      summary.genesisOk = false;
      reasons.push("committed chain dump at HEAD does not contain the canonical genesis");
    } else {
      summary.genesisOk = true;
    }
    if (manifest?.chain?.genesis !== undefined && manifest.chain.genesis !== CANONICAL_GENESIS) {
      reasons.push("HEAD manifest chain.genesis is not the canonical genesis identity");
    }
  }
  if (customText === null) {
    reasons.push(`custom dump payload missing at HEAD (${CUSTOM_DUMP_REL})`);
  } else {
    const expected = manifest?.custom?.sha256;
    const actual = sha256Text(customText);
    summary.customShaOk = expected === actual;
    if (expected !== actual) {
      reasons.push(`HEAD manifest custom.sha256 mismatch — committed dump is NOT the manifest-described content`);
    }
  }
  if (typeof manifest?.version !== "number" || manifest.version < 1) {
    reasons.push(`HEAD manifest.version invalid (${String(manifest?.version)})`);
  }
  // Snapshot version progression vs the origin baseline.
  if (origin) {
    const originManifestText = blobText(root, origin, MANIFEST_REL);
    if (originManifestText !== null) {
      try {
        const originVersion = (JSON.parse(originManifestText) as Partial<SnapshotManifest>).version;
        if (typeof originVersion === "number" && typeof manifest?.version === "number" && manifest.version < originVersion) {
          reasons.push(`manifest.version ${manifest.version} REGRESSES origin's ${originVersion} (snapshot version progression violated)`);
        }
      } catch {
        reasons.push("origin baseline manifest is not valid JSON (cannot verify version progression)");
      }
    }
  }
  return { ok: reasons.length === 0, reasons, summary };
}

/** Exit code for the CLI / bash consumers:
 *  0 = proceed (EXACT_MATCH | SAFE_SNAPSHOT_AHEAD); 10..16 = blocked. */
export function gitStateExitCode(state: GitBranchState): number {
  switch (state) {
    case "EXACT_MATCH":
    case "SAFE_SNAPSHOT_AHEAD":
      return 0;
    case "SOURCE_CODE_AHEAD":
      return 10;
    case "BEHIND":
      return 11;
    case "DIVERGED":
      return 12;
    case "REMOTE_UNAVAILABLE":
      return 13;
    case "SNAPSHOT_INVALID":
      return 14;
    case "AUTHORITY_UNVERIFIED":
      return 15;
    default:
      return 16;
  }
}
