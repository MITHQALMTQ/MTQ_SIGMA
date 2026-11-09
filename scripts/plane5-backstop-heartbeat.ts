// plane5 backstop v3.1 (job 514615) — step 6 heartbeat writer.
// Measures all planes fresh, verifies clock consistency, writes /tmp + durable copy.
// Tracked in git as of 2026-11-08 (re-images repeatedly wiped the untracked copy).
import { Database } from "bun:sqlite";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyGitState } from "../src/lib/boot/git-state";
import { parseDumpTipText } from "../src/lib/boot/snapshot-manifest";

// V31 RC-7 (incident 17): canonical root from MODULE LOCATION — never a
// hardcoded absolute path and never process.cwd() (the standalone server
// chdirs at boot). The writer is a scheduled component: it must always
// measure and write the CANONICAL databases and telemetry paths.
const REPO_ROOT = process.env.MTQ_SIGMA_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");

const sh = (cmd: string, args: string[]) => {
  const t = Date.now();
  const out = execFileSync(cmd, args, { encoding: "utf8", cwd: REPO_ROOT, timeout: 15000 }).trim();
  console.error(`[step] ${cmd} ${args[0]} ${Date.now() - t}ms`);
  return out;
};

const shBig = (cmd: string, args: string[]) => {
  for (let i = 0; ; i++) {
    try {
      return execFileSync(cmd, args, { encoding: "utf8", cwd: REPO_ROOT, timeout: 30000, maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      if (i >= 2) throw e;
    }
  }
};

// ── fresh measurements ──────────────────────────────────────────────
const chain = new Database(join(REPO_ROOT, "db", "chain.db"), { readonly: true });
const { h: liveTip, n: nBlocks } = chain.query("SELECT MAX(height) h, COUNT(*) n FROM blocks").get() as any;
const integrityChain = (chain.query("PRAGMA integrity_check").get() as any).integrity_check;
const bootMode = (chain.query("SELECT value FROM meta WHERE key='boot_mode'").get() as any)?.value;
chain.close();

const custom = new Database(join(REPO_ROOT, "db", "custom.db"), { readonly: true });
let customRows = 0;
for (const r of custom.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'").all() as any[])
  customRows += (custom.query(`SELECT COUNT(*) n FROM [${r.name}]`).get() as any).n;
const integrityCustom = (custom.query("PRAGMA integrity_check").get() as any).integrity_check;
custom.close();

const server = sh("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "-m", "5", "http://localhost:3000/"]);
const route = sh("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "-X", "POST", "-m", "5", "http://localhost:3000/api/constituency/upload"]);
// V31 RC-4 (2026-11-09): the watchdog v4 boot-chain owner must be measured
// fresh here — a heartbeat may never claim OK while the watchdog is missing.
const watchdog = sh("bash", ["-c", "ps ax -o cmd= | grep -F 'dev-watchdog.sh' | grep -vF grep | head -1 | wc -l"]).trim() === "1";
const originSha = sh("git", ["rev-parse", "origin/main"]);
const headSha = sh("git", ["rev-parse", "HEAD"]);
// V31 TURN 2A (incident 19 root-cause fix): the git plane NO LONGER asserts
// strict headSha === originSha — the third copy of the contradictory equality
// check (bootstrap §3.8 was the first, the drift guard's ahead-only exemption
// the second). The SHARED branch-state classification decides: a verified
// SAFE_SNAPSHOT_AHEAD (approved snapshot/evidence files only, validated
// forward-only, HEAD manifest hash-verified) is a healthy git plane; any
// other non-EXACT state is not. The classifier fetches nothing here (the
// wrapper/bootstrapped fire already fetched seconds ago).
let git = "BLOCKED";
let gitState = "CLASSIFY_ERROR";
try {
  const report = classifyGitState({ fetch: false, root: REPO_ROOT });
  gitState = report.state;
  git = report.state === "EXACT_MATCH" || report.state === "SAFE_SNAPSHOT_AHEAD" ? "OK" : "BLOCKED";
} catch (e) {
  console.error(`[heartbeat] git-state classification failed: ${e}`);
}
// The freshest ON-DISK dump state is the STAGED write-behind copy (V31 TURN
// 2A persistence model); fall back to the published tracked file.
const diskTipOf = (): number => {
  for (const p of ["backups/db-snapshots/.staging/latest-chain.sql", "backups/db-snapshots/latest-chain.sql"]) {
    try {
      const text = readFileSync(join(REPO_ROOT, p), "utf8").slice(0, 4096);
      const t = parseDumpTipText(text);
      if (t) return t.height ?? -1;
    } catch { /* next source */ }
  }
  return -1;
};
const diskTip = diskTipOf();
// V31 RC-6 (2026-11-09): an unparseable snapshot (tip < 0) means recovery-source
// health is UNKNOWN — it must degrade the db plane, never read as healthy.
const tipOf = (line: string) => { const m = line.match(/height=(\d+)/); return m ? Number(m[1]) : -1; };
const committedTipLine = (shBig("git", ["show", "origin/main:backups/db-snapshots/latest-chain.sql"]).split("\n")[2] ?? "");
const committedTip = tipOf(committedTipLine);
const snapshotParseOk = diskTip >= 0 && committedTip >= 0;
const unbackedAhead = Math.max(0, liveTip - committedTip);
const recoveryDeficit = Math.max(0, committedTip - liveTip);
const floorsOk = integrityChain === "ok" && integrityCustom === "ok" && liveTip >= 500 && customRows >= 4000
  && bootMode !== "re-seeded";
const dbOk = floorsOk && snapshotParseOk && recoveryDeficit <= 60 && unbackedAhead <= 2000;
const db = dbOk ? "OK" : (!floorsOk || !snapshotParseOk || recoveryDeficit > 10000 ? "ALERT" : "RECOVERY_REQUIRED");
// V31 RC-4: overall OK requires EVERY operational plane including the watchdog.
const result = git === "OK" && db === "OK" && server === "200" && route === "403" && watchdog ? "OK" : (db === "ALERT" ? "ALERT" : "BLOCKED");

// ── clocks from the same source, verified before writing ───────────
const tsMs = Date.now();
const tsIso = new Date(tsMs).toISOString(); // .XXXZ == +%FT%T.%3NZ
const roundTrip = Date.parse(tsIso);
if (roundTrip !== tsMs) {
  console.error(`CLOCK MISMATCH tsIso=${tsIso} tsMs=${tsMs} roundTrip=${roundTrip} — NOT writing`);
  process.exit(1);
}
const nextDueMs = tsMs + 3_600_000; // hourly backstop cadence since v30 (job fired :17:48 hourly)

const hb = {
  tsIso, tsMs, nextDueMs,
  planes: { git, db, server, route, watchdog: watchdog ? "alive" : "missing", snapshotParseOk, unbackedAhead, recoveryDeficit },
  chainTip: liveTip, customRows, originSha, headSha, gitState, result,
};
writeFileSync("/tmp/plane5-heartbeat.json", JSON.stringify(hb, null, 2) + "\n");
if (git === "OK") writeFileSync(join(REPO_ROOT, "backups", "plane5", "heartbeat.json"), JSON.stringify(hb, null, 2) + "\n");
console.log(JSON.stringify({ ...hb, nBlocks, integrityChain, integrityCustom, bootMode, diskTip, committedTip, durableWritten: git === "OK" }, null, 1));
