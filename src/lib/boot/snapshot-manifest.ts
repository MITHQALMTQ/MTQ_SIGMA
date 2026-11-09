// MTQΣ — Snapshot manifest & publication core (V31 TURN 2A — incident 19
// root-cause fix, Phase 5).
//
// WHY (incident 19, 2026-11-09 02:18:12.717Z): the write-behind loop kept the
// git-TRACKED dump `backups/db-snapshots/latest-chain.sql` perpetually dirty
// (the designed steady state of task42), and the platform agent-loop wrapper
// auto-commits every dirty tracked file at every agent-turn end (request-UUID
// subjects, unpushed). The result: uncontrolled recurring Git drift of
// snapshot-only commits that the bootstrap's strict HEAD==origin assertion
// then blocked with exit 13 on every fire.
//
// WHAT THIS MODULE DOES (all node builtins — importable from the Next.js
// server AND plain bun scripts AND dependency-free test sandboxes):
//   • CANONICAL_GENESIS — single source for the chain identity constant.
//   • parseDumpTipText() / dumpComplete() / dumpGenesisOk() — structural
//     integrity checks for v2 dump payloads (parse, completeness, identity).
//   • sha256Text() — cryptographic content hash.
//   • buildManifest() / validateManifestAgainst() — the verifiable snapshot
//     manifest (source DB, timestamp, height, genesis, sha256, version).
//   • publishCandidates() — ATOMIC publication of validated dump payloads
//     into the tracked recovery files + manifest (tmp+rename, never a torn
//     state, never a regression — forward-only enforced).
//   • commitAndPushSnapshots() — git add of EXACTLY the three snapshot paths
//     (never a broad sweep of unrelated dirty files), commit, push.
//
// PERSISTENCE MODEL (after this fix):
//   backups/db-snapshots/.staging/latest-*.sql   — untracked, refreshed by the
//     60s write-behind loops (atomic tmp+rename). Git never sees these.
//   backups/db-snapshots/latest-*.sql + manifest.json — the PUBLISHED recovery
//     source of record, changed ONLY by validated atomic publication.
//   Retention: git history of the published files (snapshots are never
//     deleted; older states remain reachable in history); mtq-sigma-backups/
//     selfheal-archive/ holds casualty copies from every restore.
//
// Git source-code synchronization is INDEPENDENT of snapshot persistence:
// publication commits carry only the three snapshot paths; source pushes are
// untouched. An accepted Git state never authorizes database restoration by
// itself — recovery keeps its own fail-closed forward-only authorization in
// src/lib/db-ops.ts (selfHealDatabases) and scripts/db-selfheal.ts.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ROOT override (tests + isolated regression sandboxes drive this module
// against temporary repositories; production derivation is the module
// location). Mirrors src/lib/boot/git-drift.ts.
export const SNAPSHOT_ROOT =
  process.env.MTQ_SIGMA_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// ─── canonical constants ─────────────────────────────────────────────────────

/** Canonical MTQΣ Sovereign Devnet genesis identity. Mirrors the constant
 *  historically embedded in scripts/plane5-bootstrap.sh §3.10. A dump whose
 *  payload does not carry this genesis is not the canonical chain. */
export const CANONICAL_GENESIS = "gen_3baf0dba552b527da4e9f6cedae44d04d0a40f7d";

export const SNAP_DIR = join(SNAPSHOT_ROOT, "backups", "db-snapshots");
export const MANIFEST_PATH = join(SNAP_DIR, "manifest.json");
export const STAGING_DIR = join(SNAP_DIR, ".staging");

/** Tracked (published) recovery sources of record. */
export const CHAIN_DUMP_PUBLISHED = join(SNAP_DIR, "latest-chain.sql");
export const CUSTOM_DUMP_PUBLISHED = join(SNAP_DIR, "latest-custom.sql");
/** Untracked write-behind staging (gitignored via /backups/db-snapshots/*). */
export const CHAIN_DUMP_STAGED = join(STAGING_DIR, "latest-chain.sql");
export const CUSTOM_DUMP_STAGED = join(STAGING_DIR, "latest-custom.sql");

/** Repository-relative forms (used in git pathspecs and allowlists). */
export const CHAIN_DUMP_REL = "backups/db-snapshots/latest-chain.sql";
export const CUSTOM_DUMP_REL = "backups/db-snapshots/latest-custom.sql";
export const MANIFEST_REL = "backups/db-snapshots/manifest.json";

/** Threshold-gated autonomous publication (watchdog subloop + in-process
 *  tick): publish when the staged chain dump is this far past the published
 *  one (~600 blocks ≈ 50–80 min — bounded staleness even when every
 *  scheduler fire is rejected, without turning git into real-time DB
 *  replication). The hourly backstop publishes below this threshold too. */
export const PUBLISH_CHAIN_DELTA = 600;
export const PUBLISH_CUSTOM_DELTA = 4000;

/** Custom-dump row regression tolerance — mirrors PRUNE_TOLERANCE_RATIO in
 *  src/lib/db-ops.ts (the audit-trail retention prune legitimately deletes
 *  rows; a material deficit is the wipe signature). */
export const CUSTOM_PRUNE_TOLERANCE_RATIO = 0.9;

// ─── dump structural integrity ───────────────────────────────────────────────

export interface DumpTipText {
  v2: boolean;
  rows: number;
  height: number | null;
  tables: number | null;
}

/** Parse the machine-readable tip of a v2 dump payload (text form). Returns
 *  null when no v2 tip line is present (legacy v1 / non-dump text). */
export function parseDumpTipText(text: string): DumpTipText | null {
  const m = text.match(/^-- MTQ-DUMP-TIP rows=(\d+) height=(\d+|-) tables=(\d+)/m);
  if (!m) return null;
  return { v2: true, rows: Number(m[1]), height: m[2] === "-" ? null : Number(m[2]), tables: Number(m[3]) };
}

/** A dump payload is COMPLETE when it carries a transaction wrapper and the
 *  COMMIT trailer — a torn/partial dump (interrupted write, truncated sweep)
 *  never satisfies this and must never be eligible for recovery or
 *  publication. */
export function dumpComplete(text: string): boolean {
  return text.includes("BEGIN TRANSACTION;") && text.trimEnd().endsWith("COMMIT;");
}

/** Chain identity: the canonical genesis must appear in the payload itself. */
export function dumpGenesisOk(text: string): boolean {
  return text.includes(CANONICAL_GENESIS);
}

export function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// ─── manifest ────────────────────────────────────────────────────────────────

export interface SnapshotManifestEntry {
  path: string;
  sourceDb: string;
  sha256: string;
  bytes: number;
  height?: number;
  rows: number;
  tables?: number;
  genesis?: string;
  dumpFormat: number;
}

export interface SnapshotManifest {
  version: number;
  format: number;
  generatedAt: string;
  source: { repo: string; environment: string };
  chain: SnapshotManifestEntry;
  custom: SnapshotManifestEntry;
}

const REPO_IDENTITY = "MITHQALMTQ/MTQ_SIGMA";
const ENVIRONMENT = "testnet-shadow";

function entryFor(
  kind: "chain" | "custom",
  relPath: string,
  text: string,
  tip: DumpTipText,
): SnapshotManifestEntry {
  const entry: SnapshotManifestEntry = {
    path: relPath,
    sourceDb: kind === "chain" ? "db/chain.db" : "db/custom.db",
    sha256: sha256Text(text),
    bytes: Buffer.byteLength(text, "utf8"),
    rows: tip.rows,
    tables: tip.tables ?? undefined,
    dumpFormat: 2,
  };
  if (kind === "chain") {
    entry.height = tip.height ?? undefined;
    entry.genesis = CANONICAL_GENESIS;
  }
  return entry;
}

/** Build a manifest describing the given dump payloads. `version` is the
 *  publication counter — callers pass previous+1 (never a regression). */
export function buildManifest(chainText: string, customText: string, version: number): SnapshotManifest | null {
  const chainTip = parseDumpTipText(chainText);
  const customTip = parseDumpTipText(customText);
  if (!chainTip || !customTip) return null;
  return {
    version,
    format: 1,
    generatedAt: new Date().toISOString(),
    source: { repo: REPO_IDENTITY, environment: ENVIRONMENT },
    chain: entryFor("chain", CHAIN_DUMP_REL, chainText, chainTip),
    custom: entryFor("custom", CUSTOM_DUMP_REL, customText, customTip),
  };
}

export interface ManifestValidation {
  ok: boolean;
  reasons: string[];
}

/** Verify that a manifest describes EXACTLY the given dump payloads:
 *  cryptographic hash, byte length, height, rows, genesis identity, source
 *  database identity. This is the "independently verifiable snapshot" gate. */
export function validateManifestAgainst(
  manifest: unknown,
  chainText: string | null,
  customText: string | null,
): ManifestValidation {
  const reasons: string[] = [];
  const m = manifest as Partial<SnapshotManifest> | null;
  if (!m || typeof m !== "object") return { ok: false, reasons: ["manifest is not an object"] };
  if (typeof m.version !== "number" || !Number.isFinite(m.version) || m.version < 1) {
    reasons.push(`manifest.version invalid (${String(m.version)})`);
  }
  if (typeof m.generatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(m.generatedAt)) {
    reasons.push("manifest.generatedAt missing/invalid");
  }
  if (!m.source || m.source.repo !== REPO_IDENTITY) {
    reasons.push(`manifest.source.repo '${String(m.source?.repo)}' != '${REPO_IDENTITY}'`);
  }
  for (const kind of ["chain", "custom"] as const) {
    const e = m[kind] as Partial<SnapshotManifestEntry> | undefined;
    const text = kind === "chain" ? chainText : customText;
    if (!e || typeof e !== "object") {
      reasons.push(`manifest.${kind} entry missing`);
      continue;
    }
    if (e.sourceDb !== (kind === "chain" ? "db/chain.db" : "db/custom.db")) {
      reasons.push(`manifest.${kind}.sourceDb '${String(e.sourceDb)}' is not the canonical database`);
    }
    if (text === null) {
      reasons.push(`manifest.${kind} present but the ${kind} dump payload is missing`);
      continue;
    }
    if (typeof e.sha256 !== "string" || e.sha256 !== sha256Text(text)) {
      reasons.push(`manifest.${kind}.sha256 mismatch (content hash verification FAILED)`);
    }
    const tip = parseDumpTipText(text);
    if (!tip) {
      reasons.push(`manifest.${kind}: dump payload has no v2 tip line`);
      continue;
    }
    if (e.rows !== tip.rows) reasons.push(`manifest.${kind}.rows ${String(e.rows)} != dump tip ${tip.rows}`);
    if (kind === "chain") {
      if (e.height !== tip.height) {
        reasons.push(`manifest.chain.height ${String(e.height)} != dump tip ${String(tip.height)}`);
      }
      if (e.genesis !== CANONICAL_GENESIS) {
        reasons.push("manifest.chain.genesis is not the canonical genesis identity");
      }
      if (!dumpGenesisOk(text)) {
        reasons.push("chain dump payload does not contain the canonical genesis");
      }
    }
    if (typeof e.bytes === "number" && e.bytes !== Buffer.byteLength(text, "utf8")) {
      reasons.push(`manifest.${kind}.bytes mismatch`);
    }
    if (!dumpComplete(text)) {
      reasons.push(`${kind} dump payload is INCOMPLETE (no BEGIN/COMMIT transaction wrapper)`);
    }
  }
  return { ok: reasons.length === 0, reasons };
}

export function readManifestFile(path: string): SnapshotManifest | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as SnapshotManifest;
  } catch {
    return null;
  }
}

/** Atomic manifest write (tmp + rename — a concurrent reader never sees a
 *  torn manifest). */
export function writeManifestAtomic(manifest: SnapshotManifest, path = MANIFEST_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(manifest, null, 2) + "\n");
  renameSync(tmp, path);
}

// ─── staged write-behind readers ─────────────────────────────────────────────

export function readStagedIfValid(kind: "chain" | "custom"): { path: string; text: string; tip: DumpTipText } | null {
  const path = kind === "chain" ? CHAIN_DUMP_STAGED : CUSTOM_DUMP_STAGED;
  try {
    if (!existsSync(path)) return null;
    const text = readFileSync(path, "utf8");
    const tip = parseDumpTipText(text);
    if (!tip || !dumpComplete(text)) return null;
    if (kind === "chain" && !dumpGenesisOk(text)) return null;
    return { path, text, tip };
  } catch {
    return null;
  }
}

/** Cheap tip-only peek (no full-text validation) used for threshold gating. */
function tipOnly(path: string): { height: number | null; rows: number | null } {
  try {
    const text = readFileSync(path, "utf8").slice(0, 4096);
    const tip = parseDumpTipText(text);
    return { height: tip?.height ?? null, rows: tip?.rows ?? null };
  } catch {
    return { height: null, rows: null };
  }
}

export function stagedChainHeight(): number | null {
  return tipOnly(CHAIN_DUMP_STAGED).height;
}

export function publishedChainHeight(): number | null {
  return tipOnly(CHAIN_DUMP_PUBLISHED).height;
}

export function publishedCustomRows(): number | null {
  return tipOnly(CUSTOM_DUMP_PUBLISHED).rows;
}

export function stagedCustomRows(): number | null {
  return tipOnly(CUSTOM_DUMP_STAGED).rows;
}

// ─── publication (fs part) ───────────────────────────────────────────────────

export interface PublishReport {
  published: boolean;
  detail: string;
  reasons: string[];
  chainHeight?: number;
  customRows?: number;
  version?: number;
}

function fileText(path: string): string | null {
  try {
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  } catch {
    return null;
  }
}

function forwardOk(
  kind: "chain" | "custom",
  candidate: DumpTipText,
  published: DumpTipText | null,
): boolean {
  if (!published) return true;
  if (kind === "chain") {
    return (candidate.height ?? 0) >= (published.height ?? 0);
  }
  const floor = Math.floor((published.rows ?? 0) * CUSTOM_PRUNE_TOLERANCE_RATIO);
  return candidate.rows >= floor;
}

/**
 * Validate + atomically publish the given dump payloads into the tracked
 * recovery files, together with a freshly built manifest
 * (version = previous + 1 — snapshot version progression).
 *
 * NEVER regresses: a candidate behind the currently published dump is
 * refused (a newer validated database state is never overwritten by an
 * older one). NEVER tears: every file lands via tmp+rename.
 * Structural gates: v2 tip parse, transaction completeness, canonical
 * genesis (chain), source identity via the manifest.
 */
export function publishCandidates(chainText: string, customText: string): PublishReport {
  const reasons: string[] = [];
  const publishedChainText = fileText(CHAIN_DUMP_PUBLISHED);
  const publishedCustomText = fileText(CUSTOM_DUMP_PUBLISHED);
  const publishedChainTip = publishedChainText ? parseDumpTipText(publishedChainText) : null;
  const publishedCustomTip = publishedCustomText ? parseDumpTipText(publishedCustomText) : null;
  const prevManifest = readManifestFile(MANIFEST_PATH);

  const chainTip = parseDumpTipText(chainText);
  const customTip = parseDumpTipText(customText);
  if (!chainTip || !customTip) {
    return { published: false, detail: "candidate dump unparseable (no v2 tip)", reasons: ["candidate unparseable"] };
  }
  if (!dumpComplete(chainText) || !dumpComplete(customText)) {
    reasons.push("candidate dump incomplete (partial/interrupted) — refused");
    return { published: false, detail: "candidate incomplete", reasons };
  }
  if (!dumpGenesisOk(chainText)) {
    reasons.push("candidate chain dump lacks the canonical genesis — refused");
    return { published: false, detail: "candidate genesis missing", reasons };
  }
  if (!forwardOk("chain", chainTip, publishedChainTip)) {
    reasons.push(`chain candidate h${chainTip.height ?? 0} would REGRESS published h${publishedChainTip?.height ?? 0} — refused`);
    return { published: false, detail: "chain regression refused", reasons };
  }
  if (!forwardOk("custom", customTip, publishedCustomTip)) {
    reasons.push(`custom candidate ${customTip.rows} rows would materially regress published ${publishedCustomTip?.rows ?? 0} — refused`);
    return { published: false, detail: "custom regression refused", reasons };
  }

  const alreadyPublished =
    chainText === publishedChainText &&
    customText === publishedCustomText &&
    prevManifest !== null &&
    validateManifestAgainst(prevManifest, publishedChainText, publishedCustomText).ok;
  if (alreadyPublished) {
    return { published: false, detail: "already published (candidates == published, manifest valid)", reasons };
  }

  const version = (prevManifest?.version ?? 0) + 1;
  const manifest = buildManifest(chainText, customText, version);
  if (!manifest) {
    return { published: false, detail: "manifest build failed", reasons: ["buildManifest returned null"] };
  }
  const check = validateManifestAgainst(manifest, chainText, customText);
  if (!check.ok) return { published: false, detail: "self-validation failed", reasons: check.reasons };

  // Atomic publication: tmp+rename for each payload, then the manifest.
  mkdirSync(SNAP_DIR, { recursive: true });
  const chainTmp = `${CHAIN_DUMP_PUBLISHED}.publish-tmp`;
  const customTmp = `${CUSTOM_DUMP_PUBLISHED}.publish-tmp`;
  writeFileSync(chainTmp, chainText);
  writeFileSync(customTmp, customText);
  renameSync(chainTmp, CHAIN_DUMP_PUBLISHED);
  renameSync(customTmp, CUSTOM_DUMP_PUBLISHED);
  writeManifestAtomic(manifest);

  return {
    published: true,
    detail: `published chain h${chainTip.height ?? "-"} (${chainTip.rows} rows) · custom ${customTip.rows} rows · manifest v${version}`,
    reasons,
    chainHeight: chainTip.height ?? undefined,
    customRows: customTip.rows,
    version,
  };
}

/**
 * Normal publication: candidates are the STAGED write-behind dumps (falling
 * back to the currently published payload for a side with no valid staged
 * dump). No-op when nothing new is staged.
 */
export function publishStagedToTracked(): PublishReport {
  const stagedChain = readStagedIfValid("chain");
  const stagedCustom = readStagedIfValid("custom");
  if (!stagedChain && !stagedCustom) {
    return { published: false, detail: "nothing to publish (no valid staged dumps)", reasons: [] };
  }
  const chainText = stagedChain?.text ?? fileText(CHAIN_DUMP_PUBLISHED);
  const customText = stagedCustom?.text ?? fileText(CUSTOM_DUMP_PUBLISHED);
  if (chainText === null || customText === null) {
    return { published: false, detail: "cannot publish: one published payload missing and not staged", reasons: ["payload missing"] };
  }
  return publishCandidates(chainText, customText);
}

/**
 * Repair publication (transition geometry): candidates are the WORKING-TREE
 * tracked payloads themselves — whatever the platform turn-end sweep or a
 * legacy write-behind left there — validated structurally before the
 * manifest catches up. Staged dumps win when they are valid AND strictly
 * newer than the working-tree payload (by tip comparison); the chosen pair
 * must still be forward-only vs the published state.
 */
export function publishWorktreeRepair(): PublishReport {
  const stagedChain = readStagedIfValid("chain");
  const stagedCustom = readStagedIfValid("custom");
  const wtChain = fileText(CHAIN_DUMP_PUBLISHED);
  const wtCustom = fileText(CUSTOM_DUMP_PUBLISHED);
  if (wtChain === null && stagedChain === null) {
    return { published: false, detail: "repair impossible: no chain payload on disk", reasons: ["chain payload missing"] };
  }
  if (wtCustom === null && stagedCustom === null) {
    return { published: false, detail: "repair impossible: no custom payload on disk", reasons: ["custom payload missing"] };
  }
  const pickChain = (): string | null => {
    if (stagedChain && wtChain) {
      const st = stagedChain.tip.height ?? 0;
      const wt = parseDumpTipText(wtChain)?.height ?? 0;
      return st > wt ? stagedChain.text : wtChain;
    }
    return stagedChain?.text ?? wtChain;
  };
  const pickCustom = (): string | null => {
    if (stagedCustom && wtCustom) {
      return stagedCustom.tip.rows >= (parseDumpTipText(wtCustom)?.rows ?? 0) ? stagedCustom.text : wtCustom;
    }
    return stagedCustom?.text ?? wtCustom;
  };
  const chainText = pickChain();
  const customText = pickCustom();
  if (chainText === null || customText === null) {
    return { published: false, detail: "repair impossible: payload unreadable", reasons: ["payload unreadable"] };
  }
  return publishCandidates(chainText, customText);
}

// ─── publication (git part) ──────────────────────────────────────────────────

export interface GitPublishResult {
  committed: boolean;
  pushed: boolean;
  commit?: string;
  detail: string;
}

/**
 * Commit + push the published snapshot files — staging EXACTLY the three
 * snapshot paths (never a broad sweep; unrelated dirty tracked files are left
 * alone for their owners). Push failure is non-fatal: the publication commit
 * remains local as a SAFE_SNAPSHOT_AHEAD state that the next bootstrap
 * accepts and the next execution pushes.
 */
export function commitAndPushSnapshots(root: string, label: string): GitPublishResult {
  const git = (args: string[]): string => {
    try {
      return execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 60_000, maxBuffer: 16 * 1024 * 1024 }).trim();
    } catch (e) {
      throw new Error(`git ${args.join(" ")} failed: ${(e as Error).message.split("\n")[0]}`);
    }
  };
  try {
    const paths = [CHAIN_DUMP_REL, CUSTOM_DUMP_REL, MANIFEST_REL].filter((p) => existsSync(join(root, p)));
    if (paths.length < 3) {
      return { committed: false, pushed: false, detail: `snapshot files incomplete on disk (${paths.length}/3)` };
    }
    git(["add", "--", ...paths]);
    const staged = git(["diff", "--cached", "--name-only"]);
    if (!staged) return { committed: false, pushed: false, detail: "nothing to commit (published state == HEAD)" };
    git(["commit", "-m", label]);
    const commit = git(["rev-parse", "--short", "HEAD"]);
    try {
      git(["push", "origin", "HEAD:main"]);
      return { committed: true, pushed: true, commit, detail: `commit ${commit} pushed` };
    } catch {
      return { committed: true, pushed: false, commit, detail: `commit ${commit} created; push FAILED (safe snapshot-ahead; next execution pushes)` };
    }
  } catch (e) {
    return { committed: false, pushed: false, detail: (e as Error).message };
  }
}

/** True when the staged chain dump is far enough past the published one to
 *  justify an autonomous threshold publication (used by the 60s loops). */
export function publicationDue(): { due: boolean; detail: string } {
  const stagedH = stagedChainHeight();
  const publishedH = publishedChainHeight();
  if (stagedH === null) return { due: false, detail: "no staged chain dump" };
  if (publishedH === null) return { due: true, detail: "no published chain dump" };
  const delta = stagedH - publishedH;
  if (delta >= PUBLISH_CHAIN_DELTA) return { due: true, detail: `staged h${stagedH} is +${delta} past published h${publishedH} (≥${PUBLISH_CHAIN_DELTA})` };
  const sRows = stagedCustomRows();
  const pRows = publishedCustomRows();
  if (sRows !== null && pRows !== null && sRows - pRows >= PUBLISH_CUSTOM_DELTA) {
    return { due: true, detail: `staged custom ${sRows} rows is +${sRows - pRows} past published ${pRows} (≥${PUBLISH_CUSTOM_DELTA})` };
  }
  return { due: false, detail: `staged h${stagedH} vs published h${publishedH} (Δ${delta} < ${PUBLISH_CHAIN_DELTA})` };
}
