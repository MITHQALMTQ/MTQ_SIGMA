// MTQΣ — Cloud-layer sync + live regression guard (Task 42 root-cause remediation).
//
// Runs as a 60s loop under dev-watchdog.sh. Three jobs:
//
//  1. WRITE-BEHIND REFRESH — regenerate the UNTRACKED STAGING dumps
//     (backups/db-snapshots/.staging/latest-*.sql — V31 TURN 2A: never the
//     git-tracked published files; those are written only by the validated
//     atomic publisher scripts/snapshot-publish.ts) once the live DBs have
//     moved SYNC_CHAIN_DELTA blocks / SYNC_CUSTOM_DELTA rows past the best
//     dump. This bounds the worst-case re-image loss window to minutes. A
//     dump is NEVER regenerated when the live DB is behind it (that would
//     overwrite the recovery source of record with a wiped state — see
//     db-ops.ts).
//
//  2. MID-RUN REGRESSION GUARD — if the live DB is materially behind the
//     best dump on disk (file deleted under the running server → SQLite
//     writes into a ghost inode, or the server re-seeded a fresh chain), the
//     server is SIGTERM'd so the watchdog restarts it and the boot-time
//     self-heal restores. F-47-2: "behind" uses customBehindDump
//     (prune-tolerant — sub-10% deficits from the audit-trail retention
//     prune are NOT a wipe; this script's naive rows<damp comparison caused
//     incident #8's 60s kill loop). Only fires when the watchdog itself is
//     alive (verified via pid + cmdline) — never kill the only server
//     without a supervisor to restart it. Suppressed entirely while the
//     intentional-reset sentinel is fresh.
//
//  3. THRESHOLD PUBLICATION (V31 TURN 2A, incident 19 fix) — when the staged
//     dump is ≥ PUBLISH_CHAIN_DELTA blocks past the published one, spawn the
//     validated publisher ONCE (scripts/snapshot-publish.ts --threshold).
//     Bounded git staleness even when every scheduler fire is rejected,
//     WITHOUT turning git into real-time DB replication: the publisher
//     classifies the git state first and never publishes from an
//     unadjudicated tree.
//
// Log: /tmp/db-cloud-sync.log (owner: dev-watchdog.sh).

import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CHAIN_DB,
  CHAIN_DUMP,
  CHAIN_DUMP_STAGING,
  CUSTOM_DB,
  CUSTOM_DUMP,
  CUSTOM_DUMP_STAGING,
  cloudSyncRefresh,
  customBehindDump,
  probeChainHeight,
  probeCustomRows,
  readDumpTip,
  sentinelActive,
  type DumpTip,
} from "../src/lib/db-ops";
import { publicationDue } from "../src/lib/boot/snapshot-manifest";

const WATCHDOG_PID_FILE = "/tmp/mtq-watchdog.pid";
const REPO_ROOT = process.env.MTQ_SIGMA_ROOT ?? join(import.meta.dir, "..");

function bestTip(staged: DumpTip | null, published: DumpTip | null): DumpTip | null {
  if (!staged) return published;
  if (!published) return staged;
  const key = (t: DumpTip) => (t.height ?? 0) * 1_000_000_000 + t.rows;
  return key(staged) >= key(published) ? staged : published;
}

function findServerPid(): number | null {
  try {
    const out = execSync("ss -ltnp 2>/dev/null || true", { encoding: "utf8" });
    const m = out.match(/:3000\s.*?pid=(\d+)/);
    if (!m) return null;
    const pid = Number(m[1]);
    const cmdline = (() => {
      try { return readFileSync(`/proc/${pid}/cmdline`, "utf8"); } catch { return ""; }
    })();
    if (!cmdline.includes("next")) return null; // refuse to kill a non-next listener
    return pid;
  } catch {
    return null;
  }
}

function isWatchdogAlive(): boolean {
  try {
    if (!existsSync(WATCHDOG_PID_FILE)) return false;
    const pid = Number(readFileSync(WATCHDOG_PID_FILE, "utf8").trim());
    if (!Number.isFinite(pid) || pid <= 0) return false;
    const cmdline = readFileSync(`/proc/${pid}/cmdline`, "utf8");
    return cmdline.includes("dev-watchdog");
  } catch {
    return false;
  }
}

function killServer(pid: number): boolean {
  try { process.kill(pid, "SIGTERM"); } catch { return false; }
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try { process.kill(pid, 0); } catch { return true; } // ESRCH — gone
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ }
  return true;
}

// 1) write-behind refresh (staging — never the tracked published files)
const sync = await cloudSyncRefresh({ log: (s) => console.log(s) });
console.log(
  `[cloud-sync] chain: ${sync.chain.detail} · custom: ${sync.custom.detail}` +
    `${sync.chain.refreshed || sync.custom.refreshed ? " · STAGED WRITE-BEHIND REFRESHED" : ""}`,
);

// 1b) threshold publication (V31 TURN 2A) — fire-and-forget, never fatal.
try {
  const due = publicationDue();
  if (due.due) {
    console.log(`[cloud-sync] publication threshold: ${due.detail}`);
    const { execFile } = await import("node:child_process");
    execFile(
      "bun",
      ["run", "scripts/snapshot-publish.ts", "--threshold"],
      { cwd: REPO_ROOT, timeout: 120_000 },
      (err, stdout) => {
        if (err) console.log(`[cloud-sync] threshold publisher exited: ${String(err).split("\n")[0]}`);
        const line = String(stdout).trim().split("\n").pop() ?? "";
        if (line) console.log(`[cloud-sync] threshold publisher: ${line}`);
      },
    );
  }
} catch (e) {
  console.log(`[cloud-sync] publication check failed (non-fatal): ${e}`);
}

// 2) mid-run regression guard
const sentinel = sentinelActive();
if (sentinel.active) {
  console.log(`[cloud-sync] sentinel active (reason: ${sentinel.reason || "n/a"}) — regression guard suppressed.`);
} else {
  const cp = await probeChainHeight(CHAIN_DB);
  const ct = bestTip(readDumpTip(CHAIN_DUMP_STAGING), readDumpTip(CHAIN_DUMP));
  const xp = await probeCustomRows(CUSTOM_DB);
  const xt = bestTip(readDumpTip(CUSTOM_DUMP_STAGING), readDumpTip(CUSTOM_DUMP));
  const chainBehind = !!ct && (ct.height ?? 0) > (cp.ok ? cp.height : 0);
  const customBehind = !!xt && customBehindDump(xp.ok ? xp.rows : 0, xt.rows);
  if (chainBehind || customBehind) {
    console.log(
      `[cloud-sync] REGRESSION: chain ${cp.ok ? `h${cp.height}` : cp.reason} vs best dump h${ct?.height ?? "-"} · ` +
        `custom ${xp.ok ? `${xp.rows} rows` : xp.reason} vs best dump ${xt?.rows ?? "-"} rows`,
    );
    if (!isWatchdogAlive()) {
      console.log(
        "[cloud-sync] watchdog NOT running — NOT killing the server (no supervisor to restart it). " +
          "Recover with: bash scripts/session-open-battery.sh then bun run scripts/db-selfheal.ts, " +
          "and relaunch the watchdog: ( setsid bash dev-watchdog.sh >> /tmp/watchdog-launch.log 2>&1 & )",
      );
    } else {
      const pid = findServerPid();
      if (pid) {
        console.log(`[cloud-sync] killing dev server pid ${pid} — watchdog will reboot through boot-time self-heal.`);
        killServer(pid);
      } else {
        console.log("[cloud-sync] no :3000 listener found — nothing to kill; self-heal will run at next boot.");
      }
    }
  }
}

// log hygiene: truncate once past 2 MB
try {
  if (existsSync("/tmp/db-cloud-sync.log") && statSync("/tmp/db-cloud-sync.log").size > 2_000_000) {
    execSync("truncate -s 0 /tmp/db-cloud-sync.log");
  }
} catch { /* best-effort */ }
