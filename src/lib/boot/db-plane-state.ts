// MTQΣ — Plane-5 database-plane state classifier (V31 TURN 3 — Fix R-4, §6).
//
// WHY (TURN 2B forensic defect F-3): Plane 5's monitor NEVER probed the
// database — the h20333→h3941 regression hid behind a fresh OK heartbeat for
// ~3h. And every probe that DID run collapsed its failures into a generic
// ALERT (or worse: an unreadable database read as height 0, §3.1). §6
// requires FOURTEEN DISTINCT observable states so an operator reading the
// alert knows WHAT failed without re-running the forensics:
//
//   DB-side (this classifier): HEALTHY · STALE_IMAGE · DATABASE_UNREADABLE ·
//     DATABASE_IDENTITY_MISMATCH · DATABASE_REGRESSION · RECOVERY_IN_PROGRESS ·
//     RECOVERY_FAILED · DATABASE_RECOVERED
//   Infra-side (plane5-run.sh assembles these around the DB state):
//     BOOTSTRAP_BLOCKED · SERVER_UNAVAILABLE · WATCHDOG_UNAVAILABLE ·
//     ROUTE_FAILURE · LOCK_CONTENTION · SCHEDULER_REJECTED
//
// NOTHING collapses into a generic ALERT. The classifier is PURE (inputs in,
// one state out) so scripts/plane5-db-verify.ts (both plane5-run.sh modes),
// scripts/plane5-backstop-heartbeat.ts and the regression harness all
// consume the SAME implementation.
//
// Classification precedence (first match wins):
//   1. RECOVERY_FAILED        — journal tail is PREPARE_FAILED/VALIDATION_FAILED
//                               (a sanctioned recovery attempt failed), OR an
//                               ACTIVATING entry unresolved >30min (the boot-time
//                               reconciler should have completed it).
//   2. RECOVERY_IN_PROGRESS   — journal tail PREPARE/VALIDATED/ACTIVATING within
//                               the last 30min without a terminal entry.
//   3. DATABASE_UNREADABLE    — live chain probe BUSY/UNREADABLE/SCHEMA_UNSUPPORTED/
//                               INTEGRITY_FAILURE, or the custom probe unreadable
//                               (the pair is unusable; true state unknown).
//   4. DATABASE_IDENTITY_MISMATCH — non-canonical genesis.
//   5. STALE_IMAGE            — live tip BELOW the active-generation pointer AND
//                               the serving restore (meta.selfheal_at) is NEWER
//                               than the pointer's activation: a restore OUTSIDE
//                               the generation contract replaced the databases
//                               after the last sanctioned activation — the exact
//                               Incident-22 stale-image signature.
//   6. DATABASE_REGRESSION    — live tip below the pointer (no foreign-restore
//                               marker), or the chain/custom database MISSING, or
//                               the live tip materially behind the committed
//                               recovery layer, or the custom side materially
//                               behind its committed layer (wipe signature).
//   7. DATABASE_RECOVERED     — journal tail ACTIVATED/RECONCILED_COMPLETE within
//                               30min AND live at/ahead of the pointer (the
//                               recovery SUCCEEDED — surfaced so operators see
//                               it, then decays to HEALTHY).
//   8. HEALTHY                — everything verified.
//
// NOTE on boot_mode="self-healed": the marker survives INSIDE sanctioned
// generation restores (the dump carries it), so it is evidence, never a
// verdict — the verdict is always tip-vs-pointer geometry.

import type { ChainProbeResult, CustomProbeResult, DbProbeStatus } from "./db-probe";

export type DbPlaneState =
  | "HEALTHY"
  | "STALE_IMAGE"
  | "DATABASE_UNREADABLE"
  | "DATABASE_IDENTITY_MISMATCH"
  | "DATABASE_REGRESSION"
  | "RECOVERY_IN_PROGRESS"
  | "RECOVERY_FAILED"
  | "DATABASE_RECOVERED";

/** How the overall heartbeat result should treat the state. */
export type DbPlaneSeverity = "ok" | "alert" | "transient";

export interface DbPlaneInput {
  chainProbe: ChainProbeResult;
  customProbe: CustomProbeResult;
  /** db/chain.db meta markers (evidence only — see header note). */
  bootMode?: string | null;
  selfhealAt?: string | null;
  /** db/active-generation.json (null when absent). */
  pointer: { chainTip: number; activatedAt: string } | null;
  /** Last recovery-journal entry (null when absent). */
  journalTail: { phase: string; ts: string } | null;
  /** Tip of the chain dump committed at origin/main (null = unparseable). */
  committedTip: number | null;
  /** Rows of the custom dump committed at origin/main (null = unparseable). */
  committedCustomRows: number | null;
  now?: Date;
}

export interface DbPlaneClassification {
  state: DbPlaneState;
  severity: DbPlaneSeverity;
  detail: string;
}

const RECOVERY_WINDOW_MS = 30 * 60_000;
/** Custom-side material-deficit floor — mirrors db-ops customBehindDump
 *  (CUSTOM_MIN_ROWS=4000, PRUNE_TOLERANCE_RATIO=0.90: legitimate retention
 *  prune churn is sub-10%; a real wipe leaves a stub far below the line). */
const CUSTOM_MIN_ROWS = 4000;
const CUSTOM_TOLERANCE = 0.90;

function tsAgeMs(ts: string | undefined | null, now: Date): number | null {
  if (!ts) return null;
  const t = Date.parse(ts);
  return Number.isFinite(t) ? now.getTime() - t : null;
}

export function classifyDbPlane(input: DbPlaneInput): DbPlaneClassification {
  const now = input.now ?? new Date();
  const liveTip =
    input.chainProbe.status === "DATABASE_HEALTHY" ? (input.chainProbe.height ?? null) : null;
  const liveCustomRows =
    input.customProbe.status === "DATABASE_HEALTHY" ? (input.customProbe.rows ?? null) : null;
  const tail = input.journalTail;
  const tailAge = tail ? tsAgeMs(tail.ts, now) : null;

  // 1. RECOVERY_FAILED — a sanctioned attempt failed, or an activation has
  //    been unresolved far beyond any legitimate import window.
  if (tail && (tail.phase === "PREPARE_FAILED" || tail.phase === "VALIDATION_FAILED")) {
    return {
      state: "RECOVERY_FAILED",
      severity: "alert",
      detail: `recovery journal tail ${tail.phase} at ${tail.ts} — the sanctioned recovery attempt failed; databases untouched`,
    };
  }
  if (tail && tail.phase === "ACTIVATING" && tailAge !== null && tailAge > RECOVERY_WINDOW_MS) {
    return {
      state: "RECOVERY_FAILED",
      severity: "alert",
      detail: `unresolved ACTIVATING since ${tail.ts} (${Math.round(tailAge / 60000)}min) — the boot-time reconciler did not complete it; operator adjudication`,
    };
  }

  // 2. RECOVERY_IN_PROGRESS — an activation pipeline is mid-flight (fresh,
  //    within the window). A large chain-dump import legitimately takes
  //    minutes; observation, not alarm.
  if (
    tail &&
    (tail.phase === "PREPARE" || tail.phase === "VALIDATED" || tail.phase === "ACTIVATING") &&
    tailAge !== null &&
    tailAge <= RECOVERY_WINDOW_MS
  ) {
    return {
      state: "RECOVERY_IN_PROGRESS",
      severity: "transient",
      detail: `recovery journal tail ${tail.phase} at ${tail.ts} — generation pipeline mid-flight`,
    };
  }

  // 3. DATABASE_UNREADABLE — the live pair is not verifiable (true state
  //    unknown — never height zero, never silently healthy).
  const unreadableChain: DbProbeStatus[] = [
    "DATABASE_BUSY",
    "DATABASE_UNREADABLE",
    "DATABASE_SCHEMA_UNSUPPORTED",
    "DATABASE_INTEGRITY_FAILURE",
  ];
  if (unreadableChain.includes(input.chainProbe.status)) {
    return {
      state: "DATABASE_UNREADABLE",
      severity: "alert",
      detail: `live chain probe ${input.chainProbe.status}: ${input.chainProbe.detail ?? "n/a"} — true state unknown`,
    };
  }
  if (input.customProbe.status !== "DATABASE_HEALTHY" && input.customProbe.status !== "DATABASE_MISSING") {
    return {
      state: "DATABASE_UNREADABLE",
      severity: "alert",
      detail: `live custom probe ${input.customProbe.status}: ${input.customProbe.detail ?? "n/a"} — the pair is unusable`,
    };
  }

  // 4. DATABASE_IDENTITY_MISMATCH — non-canonical genesis.
  if (input.chainProbe.status === "DATABASE_IDENTITY_MISMATCH") {
    return {
      state: "DATABASE_IDENTITY_MISMATCH",
      severity: "alert",
      detail: `live chain genesis ${(input.chainProbe.genesis ?? "?").slice(0, 24)}… is not the canonical identity (h${input.chainProbe.height ?? "?"})`,
    };
  }

  // 5/6. Regression family — live tip below the last activated generation,
  //      a missing database, or a material deficit vs the committed layer.
  if (liveTip !== null && input.pointer && liveTip < input.pointer.chainTip) {
    const foreignRestore =
      input.bootMode === "self-healed" &&
      !!input.selfhealAt &&
      tsAgeMs(input.pointer.activatedAt, now) !== null &&
      Date.parse(input.selfhealAt) > Date.parse(input.pointer.activatedAt);
    if (foreignRestore) {
      return {
        state: "STALE_IMAGE",
        severity: "alert",
        detail:
          `live h${liveTip} < active generation ${input.pointer.chainTip} (activated ${input.pointer.activatedAt}) ` +
          `· boot_mode=self-healed · selfheal_at=${input.selfhealAt} NEWER than the activation — a restore OUTSIDE the generation contract (stale platform image signature, Incident 22)`,
      };
    }
    return {
      state: "DATABASE_REGRESSION",
      severity: "alert",
      detail: `live h${liveTip} < active generation tip h${input.pointer.chainTip} (activated ${input.pointer.activatedAt}) — the live database regressed below the last activated generation`,
    };
  }
  if (input.chainProbe.status === "DATABASE_MISSING") {
    return {
      state: "DATABASE_REGRESSION",
      severity: "alert",
      detail: "live chain database MISSING (wipe signature) — recovery source of record is the committed layer",
    };
  }
  if (liveTip !== null && input.committedTip !== null && input.committedTip - liveTip > 60) {
    return {
      state: "DATABASE_REGRESSION",
      severity: "alert",
      detail: `live h${liveTip} materially behind committed layer h${input.committedTip} (deficit ${input.committedTip - liveTip})`,
    };
  }
  if (
    liveCustomRows !== null &&
    input.committedCustomRows !== null &&
    liveCustomRows <
      Math.max(CUSTOM_MIN_ROWS, Math.floor(input.committedCustomRows * CUSTOM_TOLERANCE))
  ) {
    return {
      state: "DATABASE_REGRESSION",
      severity: "alert",
      detail: `live custom ${liveCustomRows} rows materially behind committed ${input.committedCustomRows} (wipe signature)`,
    };
  }

  // 7. DATABASE_RECOVERED — a sanctioned activation completed recently and
  //    the live state is at/ahead of it. Surfaced explicitly (§6), decays to
  //    HEALTHY after the window.
  if (
    tail &&
    (tail.phase === "ACTIVATED" || tail.phase === "RECONCILED_COMPLETE") &&
    tailAge !== null &&
    tailAge <= RECOVERY_WINDOW_MS &&
    liveTip !== null &&
    (!input.pointer || liveTip >= input.pointer.chainTip)
  ) {
    return {
      state: "DATABASE_RECOVERED",
      severity: "ok",
      detail: `generation activated at ${tail.ts} (h${liveTip}) — sanctioned recovery completed within the last ${Math.round(tailAge / 60000)}min`,
    };
  }

  // 8. HEALTHY.
  return {
    state: "HEALTHY",
    severity: "ok",
    detail: `live h${liveTip ?? "?"} · ${liveCustomRows ?? "?"} custom rows · probes healthy · at/ahead of every verified reference`,
  };
}
