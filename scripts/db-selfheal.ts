// MTQΣ — Database self-heal CLI (Task 42 root-cause remediation; V31 TURN 3
// exit-code contract).
//
// Invoked automatically by dev-watchdog.sh before every `next dev` start,
// and by src/lib/chain/node.ts at node boot (in-process). Also runnable by
// hand:
//
//   bun run scripts/db-selfheal.ts
//     Central recovery decision (src/lib/boot/recovery-authorization.ts) +
//     staged-generation restore (src/lib/boot/generation-store.ts).
//     Exit 0 = ok / no restore needed / fresh environment / sentinel;
//     exit 1 = a restore was AUTHORIZED but FAILED (torn/impossible — do not
//               boot on it);
//     exit 2 = recovery REFUSED fail-closed (unverified source / unreadable
//               live DB / manifest missing …) — the databases are untouched
//               and operator adjudication is required; the application must
//               NOT start (V31 TURN 3 §2.3: a rejected startup leaves the
//               database untouched and exposes a blocked/degraded status).
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
  console.error("[selfheal] FAIL — an authorized restore failed; NOT booting on torn state:");
  console.error(`           ${report.error}`);
  console.error("           The git-tracked dumps and every immutable generation remain intact.");
  process.exit(1);
}
if (report.chain.action === "refused" || report.custom.action === "refused") {
  console.error("[selfheal] RECOVERY REFUSED (fail-closed) — databases untouched, operator adjudication required:");
  console.error(`           ${report.chain.note ?? "n/a"}`);
  process.exit(2);
}
if (report.healed) {
  console.log("[selfheal] databases RESTORED as one validated generation (forward-only; casualty archive kept).");
} else {
  console.log("[selfheal] OK — live databases at/ahead of every verified recovery source; no restore required.");
}
process.exit(0);
