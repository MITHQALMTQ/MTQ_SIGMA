// MTQΣ — Central recovery authorization (V31 TURN 3 — Fix R-2, §3.2/§3.3/§3.4).
//
// WHY: before TURN 3 the restore decision was duplicated and re-derived at
// every call site (selfHealDatabases' two per-database branches, the staged/
// published source picker, the watchdog, the in-process node boot). Three
// proven defects fell out of that duplication:
//   • F-1 (refused-note control flow): a source noted UNUSABLE
//     ("recovery from it refused (fail-closed)" was only LOGGED) still had a
//     parsed tip, so the restore branch executed with it anyway.
//   • F-2 (missing manifest): a missing manifest.json SKIPPED published-dump
//     verification entirely — an unverified dump was accepted by default.
//   • §3.1 (zero-height): an unreadable live database was read as height 0,
//     making "unknown" look like "behind" and auto-authorizing restoration.
//
// WHAT: ONE shared decision implementation. Every startup, watchdog, snapshot
// restoration and self-healing path consumes the SAME decision object. The
// decision validates (§3.2 list, in order):
//   repository identity → runtime source state → live database probes →
//   recovery source authority (manifest/hash/completeness/genesis) →
//   recovery direction → cross-database generation consistency.
//
// FAIL-CLOSED RULES (immutable):
//   • A higher snapshot height alone does NOT authorize replacement.
//   • A Git classification alone does NOT authorize database replacement
//     (it is a necessary precondition, never sufficient).
//   • A database read error alone does NOT authorize restoration.
//   • MANIFEST_MISSING / MANIFEST_INVALID → the PUBLISHED source is REFUSED.
//     (§3.4: a missing manifest must never bypass verification. A structurally
//     validated STAGED write-behind dump may still authorize recovery when it
//     is at/ahead of the published layer AND the live database is missing or
//     provably behind — the staged copy is the running system's own state,
//     structurally verified here, never an unverified external dump.)
//   • An UNREADABLE / BUSY / INTEGRITY-FAILED / IDENTITY-MISMATCHED live
//     database blocks automatic restoration entirely (its true state is
//     unknown — operator adjudication). DATABASE_MISSING permits exactly one
//     controlled path: a fully verified source with nothing to lose.
//   • Refusal is terminal: callers may not re-derive or bypass it (§3.3).

import {
  dumpComplete,
  dumpGenesisOk,
  parseDumpTipText,
  readManifestFile,
  validateManifestAgainst,
  type SnapshotManifest,
  CANONICAL_GENESIS,
} from "./snapshot-manifest";
import type { ChainProbeResult, CustomProbeResult, DbProbeStatus } from "./db-probe";

// ─── decision model ──────────────────────────────────────────────────────────

export type RecoveryRefusal =
  | "SENTINEL_ACTIVE"
  | "REPOSITORY_IDENTITY_UNVERIFIED"
  | "RUNTIME_SOURCE_UNVERIFIED"
  | "LIVE_DB_UNREADABLE"
  | "LIVE_DB_BUSY"
  | "LIVE_DB_INTEGRITY_FAILURE"
  | "LIVE_DB_IDENTITY_MISMATCH"
  | "LIVE_DB_SCHEMA_UNSUPPORTED"
  | "PUBLISHED_SOURCE_MANIFEST_MISSING"
  | "PUBLISHED_SOURCE_MANIFEST_INVALID"
  | "PUBLISHED_SOURCE_UNUSABLE"
  | "STAGED_SOURCE_UNUSABLE"
  | "NO_VERIFIED_RECOVERY_SOURCE"
  | "NO_RESTORE_NEEDED"
  | "CUSTOM_LIVE_MATERIALLY_AHEAD";

export interface RecoverySourceFacts {
  origin: "published" | "staged";
  chainText: string;
  customText: string;
  chainHeight: number;
  customRows: number;
  manifestVersion: number | null;
}

export interface RecoveryDecision {
  /** true ONLY when a controlled RESTORE_GENERATION is authorized. */
  authorized: boolean;
  action: "RESTORE_GENERATION" | "NONE" | "BLOCKED";
  refusal?: RecoveryRefusal;
  source?: RecoverySourceFacts;
  /** The live height the decision compared against — null when unknown. */
  liveChainHeight: number | null;
  /** Controlled-path marker: live database was MISSING (nothing to lose). */
  controlledRecovery: boolean;
  reasons: string[];
  /** Every check performed, with its verdict — the durable audit record. */
  checks: { check: string; verdict: "PASS" | "FAIL" | "SKIP"; detail: string }[];
}

export interface AuthorizationInput {
  root: string;
  /** git remote get-url origin contains the canonical repo identity. */
  remoteOk: boolean;
  /** Shared branch-state classification (EXACT_MATCH / SAFE_SNAPSHOT_AHEAD
   *  proceed; anything else is an unverified runtime source). */
  gitState: string;
  chainProbe: ChainProbeResult;
  customProbe: CustomProbeResult;
  sentinelActive: boolean;
  /** Published dump payloads + manifest (read by the caller from the tracked
   *  recovery layer). Manifest verification happens HERE, never by trust. */
  published: { chainText: string | null; customText: string | null; manifestPath: string } | null;
  /** Staged write-behind dump payloads (untracked). */
  staged: { chainText: string | null; customText: string | null } | null;
  /** Prune tolerance for custom row comparisons (live may be legitimately a
   *  few rows below the dump; a material deficit is the wipe signature). */
  customPruneToleranceRatio?: number;
}

const PRUNE_TOLERANCE_DEFAULT = 0.90;

// ─── the decision (single implementation, consumed everywhere) ───────────────

/**
 * Decide — fail-closed — whether a controlled generation restoration is
 * authorized. Callers MUST consume this decision verbatim; a refusal may not
 * be re-evaluated locally (§3.3 — refusal is immutable and centrally
 * enforced).
 */
export function authorizeRecovery(input: AuthorizationInput): RecoveryDecision {
  const checks: RecoveryDecision["checks"] = [];
  const reasons: string[] = [];
  const tol = input.customPruneToleranceRatio ?? PRUNE_TOLERANCE_DEFAULT;
  const liveHeight =
    input.chainProbe.status === "DATABASE_HEALTHY" ? (input.chainProbe.height ?? null) : null;

  const refuse = (refusal: RecoveryRefusal): RecoveryDecision => ({
    authorized: false,
    action: refusal === "NO_RESTORE_NEEDED" ? "NONE" : "BLOCKED",
    refusal,
    liveChainHeight: liveHeight,
    controlledRecovery: false,
    reasons,
    checks,
  });

  // 1. Sentinel (intentional reset stands down).
  if (input.sentinelActive) {
    checks.push({ check: "intentional-reset sentinel", verdict: "SKIP", detail: "active — recovery stands down" });
    return refuse("SENTINEL_ACTIVE");
  }
  checks.push({ check: "intentional-reset sentinel", verdict: "PASS", detail: "inactive" });

  // 2. Repository identity.
  if (!input.remoteOk) {
    checks.push({ check: "repository identity", verdict: "FAIL", detail: "origin remote is not the canonical MITHQALMTQ/MTQ_SIGMA" });
    return refuse("REPOSITORY_IDENTITY_UNVERIFIED");
  }
  checks.push({ check: "repository identity", verdict: "PASS", detail: "MITHQALMTQ/MTQ_SIGMA" });

  // 3. Runtime source state (NECESSARY condition — never sufficient).
  if (input.gitState !== "EXACT_MATCH" && input.gitState !== "SAFE_SNAPSHOT_AHEAD") {
    checks.push({ check: "runtime source state", verdict: "FAIL", detail: `git state ${input.gitState} — the running source is not a verified proceed state` });
    return refuse("RUNTIME_SOURCE_UNVERIFIED");
  }
  checks.push({ check: "runtime source state", verdict: "PASS", detail: `${input.gitState} (precondition only — never sufficient)` });

  // 4. Live database probes — explicit outcomes, never height zero.
  const chainStatus: DbProbeStatus = input.chainProbe.status;
  if (chainStatus !== "DATABASE_HEALTHY" && chainStatus !== "DATABASE_MISSING") {
    checks.push({ check: "live chain probe", verdict: "FAIL", detail: `${chainStatus}: ${input.chainProbe.detail ?? "n/a"} — automatic restoration blocked (true state unknown)` });
    return refuse(
      chainStatus === "DATABASE_BUSY" ? "LIVE_DB_BUSY"
        : chainStatus === "DATABASE_INTEGRITY_FAILURE" ? "LIVE_DB_INTEGRITY_FAILURE"
        : chainStatus === "DATABASE_IDENTITY_MISMATCH" ? "LIVE_DB_IDENTITY_MISMATCH"
        : "LIVE_DB_UNREADABLE",
    );
  }
  checks.push({
    check: "live chain probe",
    verdict: "PASS",
    detail: chainStatus === "DATABASE_MISSING" ? "DATABASE_MISSING (controlled path eligible)" : `DATABASE_HEALTHY h${liveHeight}`,
  });
  const customStatus: DbProbeStatus = input.customProbe.status;
  if (customStatus !== "DATABASE_HEALTHY" && customStatus !== "DATABASE_MISSING") {
    checks.push({ check: "live custom probe", verdict: "FAIL", detail: `${customStatus}: ${input.customProbe.detail ?? "n/a"} — automatic restoration blocked` });
    return refuse(
      customStatus === "DATABASE_BUSY" ? "LIVE_DB_BUSY"
        : customStatus === "DATABASE_INTEGRITY_FAILURE" ? "LIVE_DB_INTEGRITY_FAILURE"
        : customStatus === "DATABASE_SCHEMA_UNSUPPORTED" ? "LIVE_DB_SCHEMA_UNSUPPORTED"
        : "LIVE_DB_UNREADABLE",
    );
  }
  const liveCustomRows = customStatus === "DATABASE_HEALTHY" ? (input.customProbe.rows ?? 0) : null;
  checks.push({
    check: "live custom probe",
    verdict: "PASS",
    detail: customStatus === "DATABASE_MISSING" ? "DATABASE_MISSING (controlled path eligible)" : `DATABASE_HEALTHY ${liveCustomRows} rows`,
  });

  // 5. Recovery source authority (§3.4 — the manifest gate).
  let publishedFacts: RecoverySourceFacts | null = null;
  let publishedRefusal: RecoveryRefusal | null = null;
  if (input.published && (input.published.chainText !== null || input.published.customText !== null)) {
    const manifest = readManifestFile(input.published.manifestPath);
    if (!manifest) {
      publishedRefusal = "PUBLISHED_SOURCE_MANIFEST_MISSING";
      checks.push({ check: "published manifest", verdict: "FAIL", detail: "manifest.json missing — published dump verification CANNOT be skipped (§3.4 fail-closed)" });
    } else {
      const v = validateManifestAgainst(manifest, input.published.chainText, input.published.customText);
      if (!v.ok) {
        publishedRefusal = "PUBLISHED_SOURCE_MANIFEST_INVALID";
        checks.push({ check: "published manifest", verdict: "FAIL", detail: `verification FAILED: ${v.reasons.slice(0, 2).join("; ")}` });
      }
    }
    if (!publishedRefusal && input.published.chainText !== null && input.published.customText !== null) {
      const chainTip = parseDumpTipText(input.published.chainText);
      const customTip = parseDumpTipText(input.published.customText);
      if (!chainTip || !customTip || !dumpComplete(input.published.chainText) || !dumpComplete(input.published.customText) || !dumpGenesisOk(input.published.chainText)) {
        publishedRefusal = "PUBLISHED_SOURCE_UNUSABLE";
        checks.push({ check: "published dump structure", verdict: "FAIL", detail: "tip parse / completeness / genesis check failed" });
      } else {
        publishedFacts = {
          origin: "published",
          chainText: input.published.chainText,
          customText: input.published.customText,
          chainHeight: chainTip.height ?? 0,
          customRows: customTip.rows,
          manifestVersion: (manifest as SnapshotManifest).version ?? null,
        };
        checks.push({ check: "published source authority", verdict: "PASS", detail: `manifest v${publishedFacts.manifestVersion} verified · h${publishedFacts.chainHeight} · ${publishedFacts.customRows} custom rows` });
      }
    }
  } else {
    checks.push({ check: "published source", verdict: "SKIP", detail: "no published payload on disk" });
  }

  let stagedFacts: RecoverySourceFacts | null = null;
  if (input.staged && input.staged.chainText !== null && input.staged.customText !== null) {
    const chainTip = parseDumpTipText(input.staged.chainText);
    const customTip = parseDumpTipText(input.staged.customText);
    const structural =
      !!chainTip && !!customTip &&
      dumpComplete(input.staged.chainText) && dumpComplete(input.staged.customText) &&
      dumpGenesisOk(input.staged.chainText);
    if (structural) {
      stagedFacts = {
        origin: "staged",
        chainText: input.staged.chainText,
        customText: input.staged.customText,
        chainHeight: chainTip!.height ?? 0,
        customRows: customTip!.rows,
        manifestVersion: null,
      };
      // A staged source must never be BEHIND the published layer (the
      // write-behind contract) — behind means stale transient debris.
      if (publishedFacts && stagedFacts.chainHeight < publishedFacts.chainHeight) {
        checks.push({ check: "staged source", verdict: "FAIL", detail: `staged h${stagedFacts.chainHeight} BEHIND published h${publishedFacts.chainHeight} — stale transient debris, refused` });
        stagedFacts = null;
      } else if (publishedRefusal === "PUBLISHED_SOURCE_MANIFEST_MISSING" || publishedRefusal === "PUBLISHED_SOURCE_MANIFEST_INVALID") {
        checks.push({ check: "staged source", verdict: "PASS", detail: `structurally valid staged dump (h${stagedFacts.chainHeight}) usable with an unverifiable published layer — decision basis recorded` });
      } else {
        checks.push({ check: "staged source", verdict: "PASS", detail: `structurally valid · h${stagedFacts.chainHeight} · ${stagedFacts.customRows} custom rows` });
      }
    } else {
      checks.push({ check: "staged source", verdict: "FAIL", detail: "staged dump structurally invalid (parse/completeness/genesis)" });
    }
  } else {
    checks.push({ check: "staged source", verdict: "SKIP", detail: "no staged payload on disk" });
  }

  if (!publishedFacts && !stagedFacts) {
    if (publishedRefusal) {
      reasons.push(`published source refused: ${publishedRefusal}`);
      return refuse(publishedRefusal);
    }
    checks.push({ check: "recovery source", verdict: "FAIL", detail: "no verified recovery source exists" });
    return refuse("NO_VERIFIED_RECOVERY_SOURCE");
  }

  // Source of record: the AHEAD-most verified source (staged may legitimately
  // be ahead of published — it is the freshest write-behind state).
  let source: RecoverySourceFacts;
  if (publishedFacts && stagedFacts) {
    source = stagedFacts.chainHeight >= publishedFacts.chainHeight ? stagedFacts : publishedFacts;
  } else {
    source = (publishedFacts ?? stagedFacts)!;
  }

  // 6. Recovery direction — strictly forward-only vs the live state.
  if (liveHeight !== null && source.chainHeight <= liveHeight) {
    checks.push({ check: "recovery direction", verdict: "PASS", detail: `live h${liveHeight} at/ahead of source h${source.chainHeight} — nothing to restore` });
    // When the CHAIN is at/ahead, the custom side is checked only for a
    // material deficit (prune-tolerant) — a small churn never restores.
    const customBehind =
      liveCustomRows !== null && liveCustomRows < Math.floor(source.customRows * tol);
    if (customBehind) {
      // Chain at/ahead but custom materially behind: a generation swap would
      // REPLACE the live chain — refused unless the chain side is missing.
      checks.push({ check: "custom generation consistency", verdict: "FAIL", detail: `live custom ${liveCustomRows} materially behind source ${source.customRows}, but live chain h${liveHeight} at/ahead — a swap would regress the chain; operator adjudication` });
      reasons.push("custom materially behind while chain at/ahead — mixed-generation hazard refuses automatic swap");
      return refuse("CUSTOM_LIVE_MATERIALLY_AHEAD");
    }
    return { ...refuse("NO_RESTORE_NEEDED"), action: "NONE" };
  }
  const controlled = liveHeight === null;
  checks.push({
    check: "recovery direction",
    verdict: "PASS",
    detail: controlled
      ? "live chain DATABASE_MISSING — controlled recovery (nothing to lose)"
      : `source h${source.chainHeight} strictly ahead of live h${liveHeight} — forward-only`,
  });

  // 7. Cross-database generation consistency: a generation swap replaces the
  //    PAIR. Restoring must not materially regress the live custom side.
  if (liveCustomRows !== null && liveCustomRows > Math.ceil(source.customRows * (1 + (1 - tol)))) {
    checks.push({ check: "custom generation consistency", verdict: "FAIL", detail: `live custom ${liveCustomRows} materially AHEAD of source ${source.customRows} — a generation swap would destroy live custom data; operator adjudication` });
    reasons.push("live custom materially ahead of the recovery source — generation swap refused");
    return refuse("CUSTOM_LIVE_MATERIALLY_AHEAD");
  }
  checks.push({ check: "custom generation consistency", verdict: "PASS", detail: `source custom ${source.customRows} vs live ${liveCustomRows ?? "missing"} — no material live-side loss` });

  // 8. Genesis identity of the source (belt — manifest verification and the
  //    generation validation re-check this independently).
  if (!dumpGenesisOk(source.chainText) || !source.chainText.includes(CANONICAL_GENESIS)) {
    checks.push({ check: "source genesis identity", verdict: "FAIL", detail: "source does not carry the canonical genesis" });
    return refuse(source.origin === "published" ? "PUBLISHED_SOURCE_UNUSABLE" : "STAGED_SOURCE_UNUSABLE");
  }
  checks.push({ check: "source genesis identity", verdict: "PASS", detail: CANONICAL_GENESIS.slice(0, 18) + "…" });

  reasons.push(
    `RESTORE_GENERATION authorized: ${source.origin} source h${source.chainHeight}` +
    (controlled ? " (controlled path — live missing)" : ` over live h${liveHeight}`),
  );
  return {
    authorized: true,
    action: "RESTORE_GENERATION",
    source,
    liveChainHeight: liveHeight,
    controlledRecovery: controlled,
    reasons,
    checks,
  };
}
