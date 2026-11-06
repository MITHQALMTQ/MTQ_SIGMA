// MTQΣ — Source-integrity heal CLI (Task 47 root-cause remediation).
//
// Invoked automatically by dev-watchdog.sh before every `next dev` start, and
// by src/instrumentation.ts at server boot (in-process) + every 60s. Also
// runnable by hand:
//
//   bun run scripts/source-integrity-heal.ts
//     Restore every unstaged deletion of a HEAD-tracked file (byte-exact
//     `git restore`). Exit 0 = ok/restored, exit 1 = a restore FAILED.
//
//   bun run scripts/source-integrity-heal.ts --allow-deletions "reason" [--hours 6]
//     Writes the db/ALLOW-FILE-DELETIONS sentinel so the guard stands down
//     while you deliberately keep uncommitted deletions in the tree.
//     Remove the file (or let it expire) to re-arm.

import { fileDeletionSentinelActive, restoreDeletedTrackedFiles, writeFileSentinel } from "../src/lib/boot/source-integrity";

const args = process.argv.slice(2);

if (args[0] === "--allow-deletions") {
  const hoursIdx = args.indexOf("--hours");
  const hours = hoursIdx >= 0 ? Number(args[hoursIdx + 1]) : 6;
  const reason =
    args
      .slice(1)
      .filter((a, i) => !(hoursIdx >= 0 && (i === hoursIdx - 1 || i === hoursIdx)))
      .join(" ")
      .trim() || "intentional deletions (unspecified reason)";
  if (!Number.isFinite(hours) || hours <= 0 || hours > 168) {
    console.error("[source-integrity] --hours must be in (0, 168]");
    process.exit(1);
  }
  writeFileSentinel(hours, reason);
  console.log(`[source-integrity] sentinel written: db/ALLOW-FILE-DELETIONS (expires in ${hours}h) — guard suppressed.`);
  process.exit(0);
}

const sentinel = fileDeletionSentinelActive();
if (sentinel.active) {
  console.log(`[source-integrity] sentinel active (${sentinel.reason || "n/a"}) — standing down.`);
  process.exit(0);
}

const report = restoreDeletedTrackedFiles();

if (report.action === "error" || (report.failed.length > 0 && report.restored.length === 0)) {
  console.error("[source-integrity] FAIL — deletions detected but restore failed:");
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
if (report.restored.length > 0) {
  console.log(`[source-integrity] restored ${report.restored.length} deleted tracked file(s) from HEAD (forward-only).`);
  for (const p of report.restored) console.log(`  restored: ${p}`);
} else {
  console.log("[source-integrity] OK — no unstaged deletions of tracked files.");
}
process.exit(0);
