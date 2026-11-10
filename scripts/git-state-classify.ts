// MTQΣ — Git branch-state classifier CLI (V31 TURN 2A — incident 19
// root-cause fix, Phase 3/4).
//
// The single shared classification consumed by BOTH gates:
//   • scripts/plane5-bootstrap.sh §3.8 (replacing the contradictory strict
//     HEAD == origin/main assertion that produced the exit-13 loop), and
//   • scripts/plane5-run.sh / scripts/plane5-backstop-heartbeat.ts (the git
//     plane verdict), and
//   • scripts/snapshot-publish.ts (the publication safety gate).
//
// Usage:
//   bun run scripts/git-state-classify.ts [--no-fetch] [--json]
//
// Output: ONE JSON object (the full GitStateReport) on stdout.
// Exit codes: 0 EXACT_MATCH | SAFE_SNAPSHOT_AHEAD (proceed)
//            10 SOURCE_CODE_AHEAD · 11 BEHIND · 12 DIVERGED ·
//            13 REMOTE_UNAVAILABLE · 14 SNAPSHOT_INVALID ·
//            15 AUTHORITY_UNVERIFIED · 16 CLASSIFY_ERROR (all BLOCKED)
//
// --no-fetch: trust the caller's already-fetched origin/main ref (the
// bootstrap fetches in §3.2 before invoking this) — no network of its own.
//
// Dependency policy: node builtins ONLY (runs in dependency-free isolated
// regression sandboxes — see tests/plane5-git-state-regression.sh).

import { classifyGitState, gitStateExitCode } from "../src/lib/boot/git-state";

const args = process.argv.slice(2);
const noFetch = args.includes("--no-fetch");

const report = classifyGitState({ fetch: !noFetch });

// Always emit a single-line JSON report on stdout — machine consumers (the
// bootstrap, the wrapper, the publisher) parse stdout regardless; the --json
// flag is accepted for documented compatibility.
console.log(JSON.stringify(report));

if (report.state !== "EXACT_MATCH" && report.state !== "SAFE_SNAPSHOT_AHEAD") {
  for (const r of report.reasons.slice(0, 12)) console.error(`[git-state] ${r}`);
  if (report.note) console.error(`[git-state] ${report.note}`);
}

process.exit(gitStateExitCode(report.state));
