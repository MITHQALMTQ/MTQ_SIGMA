// MTQΣ — Database self-heal CLI (Task 42 root-cause remediation).
//
// Invoked automatically by dev-watchdog.sh before every `next dev` start,
// and by src/lib/chain/node.ts at node boot (in-process). Also runnable by
// hand:
//
//   bun run scripts/db-selfheal.ts
//     Forward-only heal: restores db/{chain,custom}.db from the git-tracked
//     cloud dumps whenever the dumps are strictly ahead. Archives regressed
//     files to mtq-sigma-backups/selfheal-archive/. Exit 0 = ok/healed,
//     exit 1 = a restore was needed but FAILED (do not boot on torn state).
//
//   bun run scripts/db-selfheal.ts --allow-reset "reason" [--hours 24]
//     Writes the intentional-reset sentinel (db/ALLOW-GENESIS-RESET) so the
//     auto-heal stands down while you deliberately run a genesis-scale
//     chain. Record the reset in worklog.md (the session-open battery
//     expects an acknowledged intentional reset).
//     Remove the file (or let it expire) to re-arm auto-heal.

import { selfHealDatabases, writeSentinel } from "../src/lib/db-ops";

const args = process.argv.slice(2);

if (args[0] === "--allow-reset") {
  const hoursIdx = args.indexOf("--hours");
  const hours = hoursIdx >= 0 ? Number(args[hoursIdx + 1]) : 24;
  const reason = args
    .slice(1)
    .filter((a, i) => !(hoursIdx >= 0 && (i === hoursIdx - 1 || i === hoursIdx)))
    .join(" ")
    .trim() || "intentional reset (unspecified reason)";
  if (!Number.isFinite(hours) || hours <= 0 || hours > 168) {
    console.error("[selfheal] --hours must be in (0, 168]");
    process.exit(1);
  }
  writeSentinel(hours, reason);
  console.log(`[selfheal] sentinel written: db/ALLOW-GENESIS-RESET (expires in ${hours}h) — auto-heal suppressed.`);
  console.log("[selfheal] REMINDER: record this intentional reset in worklog.md (session-open battery gate).");
  process.exit(0);
}

const report = await selfHealDatabases();
console.log(JSON.stringify(report, null, 2));

if (report.error) {
  console.error("[selfheal] FAIL — a restore was needed but failed; NOT booting on torn state:");
  console.error(`           ${report.error}`);
  console.error("           The git-tracked dumps and the selfheal-archive/ copies are intact.");
  process.exit(1);
}
if (report.healed) {
  console.log("[selfheal] databases restored from the git-tracked cloud layer (forward-only; archives kept).");
} else {
  console.log("[selfheal] OK — live databases at/ahead of the cloud dumps; no heal required.");
}
process.exit(0);
