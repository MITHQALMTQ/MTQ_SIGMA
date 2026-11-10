// MTQΣ — Git-drift guard CLI (Task 60 root-cause remediation round 3).
//
// Invoked automatically by dev-watchdog.sh (v4) before every `next dev` start
// AND in its supervision loop; by src/instrumentation.ts at server boot
// (in-process) + every 60s; and by scripts/session-open-battery.sh [8/8].
// Also runnable by hand:
//
//   bun run scripts/git-drift-guard.ts
//     Fetch (throttled 5 min), classify local HEAD vs origin/main, and heal:
//       behind + clean tree   → git merge --ff-only origin/main   (exit 42)
//       diverged + PROVEN content-subsumption → archive + reset
//                               --hard origin/main                (exit 42)
//       synced / ahead-only   → no-op                             (exit 0)
//       unique local content  → BLOCKED, loud                     (exit 1)
//     The LIVE DATABASES (gitignored) are never touched. Exit 42 = HEAD moved
//     → caller should restart the dev server through the full heal path.
//
//   bun run scripts/git-drift-guard.ts --status
//     Classification only — never fetches? no: forces a fresh fetch and
//     prints the three-way verdict + local-side path classification. NO
//     actions, always exit 0. The battery's audit plane.
//
//   bun run scripts/git-drift-guard.ts --allow-drift "reason" [--hours 6]
//     Writes the db/ALLOW-GIT-REALIGN sentinel so the guard stands down while
//     you deliberately keep a diverged local line. Remove the file (or let it
//     expire) to re-arm.

import {
  classifyGitDrift,
  gitDriftSentinelActive,
  guardGitDrift,
  localSideChangedPaths,
  proveSubsumption,
  writeDriftSentinel,
} from "../src/lib/boot/git-drift";

const args = process.argv.slice(2);

if (args[0] === "--allow-drift") {
  const hoursIdx = args.indexOf("--hours");
  const hours = hoursIdx >= 0 ? Number(args[hoursIdx + 1]) : 6;
  const reason =
    args
      .slice(1)
      .filter((a, i) => !(hoursIdx >= 0 && (i === hoursIdx - 1 || i === hoursIdx)))
      .join(" ")
      .trim() || "intentional divergence (unspecified reason)";
  if (!Number.isFinite(hours) || hours <= 0 || hours > 168) {
    console.error("[git-drift] --hours must be in (0, 168]");
    process.exit(1);
  }
  writeDriftSentinel(hours, reason);
  console.log(`[git-drift] sentinel written: db/ALLOW-GIT-REALIGN (expires in ${hours}h) — guard suppressed.`);
  process.exit(0);
}

if (args[0] === "--status") {
  const sentinel = gitDriftSentinelActive();
  if (sentinel.active) console.log(`[git-drift] sentinel active (${sentinel.reason || "n/a"})`);
  const status = classifyGitDrift({ forceFetch: true });
  console.log(`[git-drift] classification: ${status.klass} (head ${status.head.slice(0, 12)} · origin ${status.origin.slice(0, 12)} · fetchedNow=${status.fetchedNow})`);
  if (status.note) console.log(`  note: ${status.note}`);
  if (status.klass === "diverged") {
    const sub = proveSubsumption(status);
    console.log(`  local-side changed paths (${sub.paths.length}):`);
    for (const p of sub.paths) console.log(`    ${p.verdict.padEnd(20)} ${p.path}`);
    console.log(`  subsumption safe: ${sub.safe}`);
  }
  if (status.klass === "behind") {
    console.log(`  local-side changed paths (${localSideChangedPaths(status).length}) — fast-forward path, provably lossless`);
  }
  process.exit(0);
}

// Default: the guard actuator.
const report = guardGitDrift();

// When THIS call moved HEAD (42) and the watchdog is alive, kill the :3000
// listener — the watchdog's `wait` returns and it reboots the server through
// the FULL heal path on the new code. Mirrors scripts/db-cloud-sync.ts
// exactly: never kill the only server without a supervisor to restart it.
if (report.action === "fast-forwarded" || report.action === "realigned") {
  const { execSync } = await import("node:child_process");
  const { existsSync, readFileSync } = await import("node:fs");
  const isWatchdogAlive = (): boolean => {
    try {
      if (!existsSync("/tmp/mtq-watchdog.pid")) return false;
      const pid = Number(readFileSync("/tmp/mtq-watchdog.pid", "utf8").trim());
      if (!Number.isFinite(pid) || pid <= 0) return false;
      return readFileSync(`/proc/${pid}/cmdline`, "utf8").includes("dev-watchdog");
    } catch {
      return false;
    }
  };
  if (!isWatchdogAlive()) {
    console.log(
      "[git-drift] watchdog NOT running — NOT killing the server (no supervisor to restart it). " +
        "HEAD is realigned; restart by hand for the new code: ( setsid bash dev-watchdog.sh >> /tmp/watchdog-launch.log 2>&1 & )",
    );
  } else {
    let pid: number | null = null;
    try {
      const out = execSync("ss -ltnp 2>/dev/null || true", { encoding: "utf8" });
      const m = out.match(/:3000\s.*?pid=(\d+)/);
      if (m) {
        const p = Number(m[1]);
        const cmdline = (() => {
          try {
            return readFileSync(`/proc/${p}/cmdline`, "utf8");
          } catch {
            return "";
          }
        })();
        if (cmdline.includes("next")) pid = p; // refuse to kill a non-next listener
      }
    } catch {
      /* no listener */
    }
    if (pid) {
      console.log(`[git-drift] killing dev server pid ${pid} — watchdog will reboot on the realigned code.`);
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* already gone */
      }
    } else {
      console.log("[git-drift] no :3000 listener found — next boot compiles the realigned code.");
    }
  }
}

switch (report.action) {
  case "fast-forwarded":
  case "realigned":
    process.exit(42); // HEAD moved — caller restarts the server
  case "blocked":
    process.exit(1);
  default:
    process.exit(0);
}
