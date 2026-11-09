// MTQΣ — Snapshot publisher CLI (V31 TURN 2A — incident 19 root-cause fix,
// Phase 5).
//
// THE CONTROLLED PUBLICATION PATH. Before this fix, the write-behind loop
// dirtied the git-TRACKED dump files continuously and the platform agent-loop
// wrapper swept them into unpushed commits of arbitrary shape (no manifest,
// no hash, no validation) — the recurring Git drift of incident 19. Now the
// write-behind refreshes UNTRACKED staging files (src/lib/db-ops.ts), and
// THIS script is the only writer of the tracked recovery files:
//
//   1. SAFETY GATE — run the shared branch-state classification
//      (src/lib/boot/git-state.ts). Publication is allowed only from
//      EXACT_MATCH or SAFE_SNAPSHOT_AHEAD (or, for --repair, from
//      SNAPSHOT_INVALID where every ahead path is already approved — the
//      transition geometry where a platform sweep advanced a dump without a
//      manifest). SOURCE_CODE_AHEAD / BEHIND / DIVERGED / REMOTE_UNAVAILABLE
//      / AUTHORITY_UNVERIFIED never publish: no commit is created and no
//      push happens from an unadjudicated tree.
//   2. VALIDATE — the candidate dumps must parse (v2 tip), carry the
//      canonical genesis (chain), be transaction-complete (a partial dump is
//      never eligible), and be FORWARD-ONLY vs the published state (a newer
//      validated database state is never overwritten by an older one).
//   3. PUBLISH ATOMICALLY — tmp+rename of both payloads + a freshly built
//      manifest carrying sha256 content hashes, heights, rows, genesis,
//      source DB identity, timestamp, and an incremented version.
//   4. COMMIT + PUSH — git add of EXACTLY the three snapshot paths (never a
//      broad sweep), commit, push origin HEAD:main. Push failure is
//      non-fatal: the publication commit remains a SAFE_SNAPSHOT_AHEAD
//      state that the next bootstrap accepts and the next execution pushes.
//
// Usage:
//   bun run scripts/snapshot-publish.ts [--threshold] [--repair] [--adopt]
//
//   (default)  publish whatever valid staged dumps exist (used by the hourly
//              backstop after its bootstrap passed).
//   --threshold  publish only when the staged dump is ≥ PUBLISH_CHAIN_DELTA
//              blocks (or ≥ PUBLISH_CUSTOM_DELTA rows) past the published
//              one — used by the 60s loops (watchdog subloop + in-process
//              tick) so git stays out of real-time replication while
//              bounding snapshot staleness.
//   --repair   publish from the WORKING-TREE tracked payloads (with staged
//              winning when strictly newer) — the sanctioned transition
//              repair when a platform turn-end sweep advanced a dump without
//              a manifest and the classifier returned SNAPSHOT_INVALID.
//   --adopt    synonym of --repair retained for operator ergonomics.
//
// Dependency policy: node builtins ONLY (runs in isolated test sandboxes).

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyGitState } from "../src/lib/boot/git-state";
import {
  CHAIN_DUMP_PUBLISHED,
  CUSTOM_DUMP_PUBLISHED,
  publicationDue,
  publishStagedToTracked,
  publishWorktreeRepair,
  commitAndPushSnapshots,
} from "../src/lib/boot/snapshot-manifest";

// dirname FIRST, then ".." — resolving the module URL directly against ".."
// treats the FILE as a directory and yields <repo>/scripts (the V31-T2A
// transition caught this live: the fs phase published correctly while the
// git phase looked for <repo>/scripts/backups/… and found 0/3 files).
const ROOT = process.env.MTQ_SIGMA_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const threshold = args.includes("--threshold");
const repair = args.includes("--repair") || args.includes("--adopt");

// ── 1. safety gate ───────────────────────────────────────────────────────────
const state = classifyGitState({ fetch: true });
const gateOk =
  state.state === "EXACT_MATCH" ||
  state.state === "SAFE_SNAPSHOT_AHEAD" ||
  (repair && state.state === "SNAPSHOT_INVALID");

if (!gateOk) {
  console.error(
    `[snapshot-publish] REFUSED — git state ${state.state} is not publishable ` +
      `(publication never runs from an unadjudicated tree; reasons: ${state.reasons.slice(0, 3).join(" | ") || "n/a"})`,
  );
  console.log(
    JSON.stringify({
      published: false,
      pushed: false,
      state: state.state,
      detail: `refused: git state ${state.state}`,
    }),
  );
  process.exit(1);
}

// ── 2/3. threshold check + validated atomic publication ─────────────────────
let report;
if (repair) {
  if (!existsSync(CHAIN_DUMP_PUBLISHED) || !existsSync(CUSTOM_DUMP_PUBLISHED)) {
    console.error("[snapshot-publish] --repair impossible: published payloads missing on disk");
    console.log(JSON.stringify({ published: false, pushed: false, state: state.state, detail: "repair impossible" }));
    process.exit(1);
  }
  report = publishWorktreeRepair();
} else {
  if (threshold) {
    const due = publicationDue();
    if (!due.due) {
      console.log(
        JSON.stringify({
          published: false,
          pushed: false,
          state: state.state,
          detail: `threshold not reached: ${due.detail}`,
        }),
      );
      process.exit(0);
    }
    console.error(`[snapshot-publish] threshold reached: ${due.detail}`);
  }
  report = publishStagedToTracked();
}

if (!report.published && !repair) {
  console.error(`[snapshot-publish] no publication: ${report.detail}${report.reasons.length ? ` (${report.reasons.join("; ")})` : ""}`);
  console.log(
    JSON.stringify({
      published: false,
      pushed: false,
      state: state.state,
      detail: report.detail,
      reasons: report.reasons,
    }),
  );
  process.exit(0);
}
// In repair mode the git phase runs even when the fs phase reported
// already-published — an untracked-but-valid on-disk publication state (e.g. a
// previous run whose commit step failed) must still reach git. The commit
// itself no-ops cleanly when the published state already equals HEAD.

// ── 4. commit + push (exactly the three snapshot paths) ─────────────────────
const label = `snapshot-publish: chain h${report.chainHeight ?? "-"} · custom ${report.customRows ?? "-"} rows · manifest v${report.version ?? "?"} [V31-T2A]`;
const gitResult = commitAndPushSnapshots(ROOT, label);

console.error(
  `[snapshot-publish] ${report.detail} — ${gitResult.detail}`,
);
console.log(
  JSON.stringify({
    published: true,
    pushed: gitResult.pushed,
    commit: gitResult.commit ?? null,
    state: state.state,
    chainHeight: report.chainHeight ?? null,
    customRows: report.customRows ?? null,
    manifestVersion: report.version ?? null,
    detail: `${report.detail}; ${gitResult.detail}`,
    manifestPath: "backups/db-snapshots/manifest.json",
  }),
);
// Exit 0 in BOTH push outcomes: a created-but-unpushed publication commit is
// a SAFE_SNAPSHOT_AHEAD state that the next bootstrap accepts and the next
// execution pushes — never an error condition.
process.exit(0);
