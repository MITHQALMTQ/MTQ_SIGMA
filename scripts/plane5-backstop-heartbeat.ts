// plane5 backstop v3.1 (job 514615) — step 6 heartbeat writer.
// Measures all planes fresh, verifies clock consistency, writes /tmp + durable copy.
// Tracked in git as of 2026-11-08 (re-images repeatedly wiped the untracked copy).
import { Database } from "bun:sqlite";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const sh = (cmd: string, args: string[]) => {
  const t = Date.now();
  const out = execFileSync(cmd, args, { encoding: "utf8", cwd: "/home/z/my-project", timeout: 15000 }).trim();
  console.error(`[step] ${cmd} ${args[0]} ${Date.now() - t}ms`);
  return out;
};

const shBig = (cmd: string, args: string[]) => {
  for (let i = 0; ; i++) {
    try {
      return execFileSync(cmd, args, { encoding: "utf8", cwd: "/home/z/my-project", timeout: 30000, maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      if (i >= 2) throw e;
    }
  }
};

// ── fresh measurements ──────────────────────────────────────────────
const chain = new Database("db/chain.db", { readonly: true });
const { h: liveTip, n: nBlocks } = chain.query("SELECT MAX(height) h, COUNT(*) n FROM blocks").get() as any;
const integrityChain = (chain.query("PRAGMA integrity_check").get() as any).integrity_check;
const bootMode = (chain.query("SELECT value FROM meta WHERE key='boot_mode'").get() as any)?.value;
chain.close();

const custom = new Database("db/custom.db", { readonly: true });
let customRows = 0;
for (const r of custom.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'").all() as any[])
  customRows += (custom.query(`SELECT COUNT(*) n FROM [${r.name}]`).get() as any).n;
const integrityCustom = (custom.query("PRAGMA integrity_check").get() as any).integrity_check;
custom.close();

const server = sh("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "-m", "5", "http://localhost:3000/"]);
const route = sh("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "-X", "POST", "-m", "5", "http://localhost:3000/api/constituency/upload"]);
const originSha = sh("git", ["rev-parse", "origin/main"]);
const headSha = sh("git", ["rev-parse", "HEAD"]);
const diskTipLine = sh("sed", ["-n", "3p", "backups/db-snapshots/latest-chain.sql"]);
const committedTipLine = (shBig("git", ["show", "origin/main:backups/db-snapshots/latest-chain.sql"]).split("\n")[2] ?? "");
const diskTip = Number(diskTipLine.match(/height=(\d+)/)![1]);
const committedTip = Number(committedTipLine.match(/height=(\d+)/)![1]);
const unbackedAhead = Math.max(0, liveTip - committedTip);
const recoveryDeficit = Math.max(0, committedTip - liveTip);

const git = headSha === originSha ? "OK" : "BLOCKED";
const dbOk = integrityChain === "ok" && integrityCustom === "ok" && liveTip >= 500 && customRows >= 4000
  && bootMode !== "re-seeded" && recoveryDeficit <= 60;
const db = dbOk ? "OK" : (recoveryDeficit > 10000 ? "ALERT" : "RECOVERY_REQUIRED");
const result = git === "OK" && db === "OK" && server === "200" && route === "403" ? "OK" : (db === "ALERT" ? "ALERT" : "BLOCKED");

// ── clocks from the same source, verified before writing ───────────
const tsMs = Date.now();
const tsIso = new Date(tsMs).toISOString(); // .XXXZ == +%FT%T.%3NZ
const roundTrip = Date.parse(tsIso);
if (roundTrip !== tsMs) {
  console.error(`CLOCK MISMATCH tsIso=${tsIso} tsMs=${tsMs} roundTrip=${roundTrip} — NOT writing`);
  process.exit(1);
}
const nextDueMs = tsMs + 7_200_000; // 2h backstop cadence (convention of prior heartbeat)

const hb = {
  tsIso, tsMs, nextDueMs,
  planes: { git, db, server, route, unbackedAhead, recoveryDeficit },
  chainTip: liveTip, customRows, originSha, result,
};
writeFileSync("/tmp/plane5-heartbeat.json", JSON.stringify(hb, null, 2) + "\n");
if (git === "OK") writeFileSync("backups/plane5/heartbeat.json", JSON.stringify(hb, null, 2) + "\n");
console.log(JSON.stringify({ ...hb, nBlocks, integrityChain, integrityCustom, bootMode, diskTip, committedTip, durableWritten: git === "OK" }, null, 1));
