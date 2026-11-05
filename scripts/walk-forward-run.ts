// MTQΣ — §23.3/§23.4 walk-forward + purged K-fold CV runner (Task 42-C).
//
// Executes the pilot-scale program (src/lib/mtq/walk-forward.ts — pure,
// deterministic, no network) and writes the committed-evidence JSON to
// src/lib/mtq/walk-forward-results.json, then prints the aggregate record to
// stdout for the worklog.
//
// Invoke:   bun run scripts/walk-forward-run.ts
//
// Honesty notes (documented in the artifact itself):
//   - The program THROWS if any mechanical leakage check fails (train/test
//     index-set intersection must be empty in every fold of both programs).
//   - Numbers are descriptive statistics of ONE deterministic simulated
//     exercise — no pass/fail verdict is emitted anywhere.
//   - generatedAt/runtimeMs are wall-clock metadata; every portfolio number
//     is a deterministic function of the fixed seeds.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { runWalkForwardProgram, WF_METRIC_KEYS } from "../src/lib/mtq/walk-forward";

const OUT_PATH = join(import.meta.dir, "..", "src", "lib", "mtq", "walk-forward-results.json");

const results = runWalkForwardProgram();
writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const num = (x: number) => x.toFixed(4);

console.log(`✓ ${results.program}`);
console.log(`  output: ${OUT_PATH}`);
console.log(`  runtime: ${results.runtimeMs}ms · leakage verified: ${results.leakageCheck.verified} (${results.leakageCheck.purgeDays}d purge / ${results.leakageCheck.embargoDays}d embargo)`);
for (const [label, prog] of [
  ["§23.3 walk-forward (8 folds)", results.walkForward],
  ["§23.4 purged K-fold (K=5)", results.purgedKfold],
] as const) {
  const a = prog.aggregate;
  console.log(`  ${label} — ${a.folds} folds · ${a.oosDaysScored} OOS days scored`);
  for (const key of WF_METRIC_KEYS) {
    console.log(
      `    ${key.padEnd(20)} mean ${num(a.mean[key])} · median ${num(a.median[key])}`,
    );
  }
  console.log(`    oosVol vs EW vol (means): ${pct(a.mean.oosVolAnnualized)} vs ${pct(a.mean.benchmarkEwVol)}`);
}
console.log(`  disclosure: ${results.disclosure.slice(0, 120)}…`);
