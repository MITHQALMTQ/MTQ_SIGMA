// MTQΣ — git-drift guard filename regression tests (v27 critical recovery).
//
// Regression target: localSideChangedPaths() read `git diff --name-only`
// line-oriented WITHOUT -z, so git C-quoted every non-ASCII path
// (U+202F NARROW NO-BREAK SPACE in the 11 owner screenshots) and the guard
// treated the quoted representation as a literal filename — bypassing the
// upload/ derivable-prefix fast-path and failing blob lookups — flipping 11
// derivable evidence files into false "unique-content" blockers. That false
// BLOCK stopped every realign of the amended-task46 geometry (incidents #9
// and #10).
//
// These tests build real temporary git repositories (bare origin + work
// clone) containing hostile filenames, then drive the REAL library inside
// child processes (fresh module registry + MTQ_SIGMA_ROOT per scenario), so
// the production ROOT derivation, git plumbing, and classification all run
// exactly as they do in the watchdog/scheduler.
//
// Run: bun test tests/git-drift-guard-filenames.test.ts

import { describe, test, expect } from "bun:test";
import { execSync, execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LIB = "src/lib/boot/git-drift";

// The 11 real screenshot paths that were falsely classified as unique
// content by the quoting defect (from local-only commit 9fe4058).
const REAL_BLOCKED_SCREENSHOTS = [
  "upload/Screenshot 2026-11-07 at 1.31.21\u202fAM.png",
  "upload/Screenshot 2026-11-07 at 1.48.21\u202fAM.png",
  "upload/Screenshot 2026-11-07 at 1.52.29\u202fAM.png",
  "upload/Screenshot 2026-11-07 at 1.53.15\u202fAM.png",
  "upload/Screenshot 2026-11-07 at 1.53.38\u202fAM.png",
  "upload/Screenshot 2026-11-07 at 1.54.10\u202fAM.png",
  "upload/Screenshot 2026-11-07 at 1.55.08\u202fAM.png",
  "upload/Screenshot 2026-11-07 at 1.56.01\u202fAM.png",
  "upload/Screenshot 2026-11-07 at 1.58.14\u202fAM.png",
  "upload/Screenshot 2026-11-07 at 12.48.20\u202fPM.png",
  "upload/Screenshot 2026-11-07 at 4.23.48\u202fPM.png",
];

function sh(cmd: string, cwd?: string): string {
  return execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** git with argv-array args — no shell, so arbitrary bytes in pathspecs round-trip. */
function gitA(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** Build a diverged fixture: bare origin + clone with hostile-named files.
 *  mode "safe"    — every local-side path is derivable/subsumable/deleted-origin-wins.
 *  mode "unique"  — additionally carries a genuinely-unique local code file.
 *  mode "ancestor"— the modified code file holds an OLDER origin version (ancestor-blob).
 *  Returns the work-clone path. */
function makeFixture(mode: "safe" | "unique" | "ancestor"): string {
  const base = mkdtempSync(join(tmpdir(), "mtq-drift-fixture-"));
  const origin = join(base, "origin.git");
  const work = join(base, "work");
  sh(`git init --bare -q ${JSON.stringify(origin)}`);
  sh(`git clone -q ${JSON.stringify(origin)} ${JSON.stringify(work)}`);
  sh("git config user.email t@t && git config user.name t", work);

  // ── origin commit A: base with route + code v1 ──
  mkdirSync(join(work, "src/app/api/upload"), { recursive: true });
  mkdirSync(join(work, "src/lib"), { recursive: true });
  mkdirSync(join(work, "backups/db-snapshots"), { recursive: true });
  writeFileSync(join(work, "src/app/api/upload/route.ts"), "export const v1 = 'route-v1';\n");
  writeFileSync(join(work, "src/lib/code.ts"), "export const code = 'v1';\n");
  writeFileSync(join(work, "backups/db-snapshots/latest-chain.sql"), "-- dump base\n");
  sh("git add -A && git commit -qm base", work);
  sh("git push -q origin HEAD:main", work);

  // ── origin commit B (code v2) and commit C (code v3): a 3-version origin
  //    history so the ancestor-blob scenario has an OLDER origin state to
  //    match against ──
  writeFileSync(join(work, "src/lib/code.ts"), "export const code = 'v2-origin';\n");
  sh("git add -A && git commit -qm origin-v2 && git push -q origin HEAD:main", work);
  writeFileSync(join(work, "src/lib/code.ts"), "export const code = 'v3-origin';\n");
  sh("git add -A && git commit -qm origin-v3 && git push -q origin HEAD:main", work);

  // ── local line: reset to origin commit B (so origin/main advanced to C),
  //    then build the local-only amend ──
  sh(`git reset -q --hard HEAD~1`, work); // work HEAD = commit B; origin/main = commit C
  const hostile = [
    "upload/file with spaces.png",
    "upload/paren(thesis)&'quote'.png",
    "upload/unicode-é中.png",
    ...REAL_BLOCKED_SCREENSHOTS,
  ];
  for (const f of hostile) {
    const p = join(work, f);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, `bytes-of:${f}\n`);
  }
  // newline + tab + long names (git tracks them; add via argv-array — no
  // shell, so embedded newline/tab bytes reach git exactly)
  const weird = "upload/newline\ntab\tname.png";
  writeFileSync(join(work, weird), "weird\n");
  const long = "upload/" + "l".repeat(180) + ".png";
  writeFileSync(join(work, long), "long\n");
  gitA(work, ["add", "--", weird, long]);

  // dump divergence: write-behind steady state (unstaged later; committed here
  // so the LOCAL COMMIT carries it — matches the real 9fe4058 geometry)
  writeFileSync(join(work, "backups/db-snapshots/latest-chain.sql"), "-- dump LOCAL-fresher\n");
  // route deleted locally while origin still has it (the 8× deletion class)
  rmSync(join(work, "src/app/api/upload/route.ts"));

  if (mode === "ancestor") {
    // local code.ts holds the OLDER origin v1 (origin evolved v2→v3 past it)
    // → differs from merge-base B's v2 → appears in the three-dot diff →
    // blob matches origin commit A's version → ancestor-blob subsumption
    writeFileSync(join(work, "src/lib/code.ts"), "export const code = 'v1';\n");
  }
  // safe/unique: leave code.ts at merge-base B's content — absent from the
  // three-dot diff (nothing to prove either way)
  if (mode === "unique") {
    writeFileSync(join(work, "src/unique-local-code.ts"), "export const onlyLocal = true;\n");
  }
  sh("git add -A && git commit -qm local-amend", work);
  return work;
}

/** Run a driver in a child process so MTQ_SIGMA_ROOT + module registry are fresh. */
function drive(fixtureRoot: string, code: string): any {
  const driver = `
    process.env.MTQ_SIGMA_ROOT = ${JSON.stringify(fixtureRoot)};
    import(${JSON.stringify(join(process.cwd(), LIB) + ".ts")}).then(async (g) => {
      const out = await (${code})(g);
      process.stdout.write("\\n__RESULT__" + JSON.stringify(out));
    });
  `;
  const tmpDriver = join(tmpdir(), `mtq-driver-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(tmpDriver, driver);
  try {
    const r = spawnSync("bun", ["run", tmpDriver], { encoding: "utf8", timeout: 120_000 });
    const idx = (r.stdout ?? "").lastIndexOf("__RESULT__");
    if (idx < 0) throw new Error(`driver failed: ${r.stderr}\n${r.stdout}`);
    return JSON.parse((r.stdout ?? "").slice(idx + 10));
  } finally {
    rmSync(tmpDriver, { force: true });
  }
}

describe("git-drift guard filename handling (v27 regression)", () => {
  test("hostile + real screenshot filenames resolve as TRUE paths with correct verdicts", () => {
    const work = makeFixture("safe");
    const res = drive(work, `(g) => {
      const st = g.classifyGitDrift({ forceFetch: true });
      const paths = g.localSideChangedPaths(st);
      const sub = g.proveSubsumption(st);
      return { klass: st.klass, paths, verdicts: sub.paths.map(p => [p.path, p.verdict]), safe: sub.safe };
    }`);
    expect(res.klass).toBe("diverged");
    // every returned path is the TRUE filesystem name — no C-quoting artifacts
    for (const p of res.paths) {
      expect(p.startsWith('"')).toBe(false);
      // deleted-locally paths (the route) are legitimately absent on disk
      if (p !== "src/app/api/upload/route.ts") {
        expect(existsSync(join(work, p))).toBe(true);
      }
    }
    const verdictOf = (name: string) => res.verdicts.find(([p]) => p === name)?.[1];
    // all 11 real screenshots + hostile names → derivable (upload/ prefix)
    for (const s of REAL_BLOCKED_SCREENSHOTS) expect(verdictOf(s)).toBe("derivable");
    expect(verdictOf("upload/file with spaces.png")).toBe("derivable");
    expect(verdictOf("upload/paren(thesis)&'quote'.png")).toBe("derivable");
    expect(verdictOf("upload/unicode-é中.png")).toBe("derivable");
    expect(verdictOf("upload/newline\ntab\tname.png")).toBe("derivable");
    expect(verdictOf("upload/" + "l".repeat(180) + ".png")).toBe("derivable");
    // route deleted locally while origin has it → deleted-origin-wins
    expect(verdictOf("src/app/api/upload/route.ts")).toBe("deleted-origin-wins");
    // dump inside the commit → derivable prefix
    expect(verdictOf("backups/db-snapshots/latest-chain.sql")).toBe("derivable");
    // subsumption SAFE (previously false because of the quoting artifact)
    expect(res.safe).toBe(true);
  });

  test("genuine unique content is still protected (safety not weakened)", () => {
    const work = makeFixture("unique");
    const res = drive(work, `(g) => {
      const st = g.classifyGitDrift({ forceFetch: true });
      const sub = g.proveSubsumption(st);
      return { safe: sub.safe, blockers: sub.blockers };
    }`);
    expect(res.safe).toBe(false);
    expect(res.blockers).toContain("src/unique-local-code.ts");
  });

  test("ancestor-blob subsumption: local older-version code file is subsumed, not unique", () => {
    const work = makeFixture("ancestor");
    const res = drive(work, `(g) => {
      const st = g.classifyGitDrift({ forceFetch: true });
      const sub = g.proveSubsumption(st);
      const v = sub.paths.find(p => p.path === "src/lib/code.ts");
      return { verdict: v?.verdict, safe: sub.safe };
    }`);
    expect(res.verdict).toBe("ancestor-blob");
    expect(res.safe).toBe(true);
  });

  test("staged changes still BLOCK the realign (staged intent respected)", () => {
    const work = makeFixture("safe");
    writeFileSync(join(work, "staged-intent.txt"), "operator staged this\n");
    sh("git add staged-intent.txt", work);
    const res = drive(work, `(g) => {
      const rep = g.guardGitDrift();
      return { action: rep.action, note: rep.note };
    }`);
    expect(res.action).toBe("blocked");
    expect(res.note).toBe("dirty tree");
    // staged file survived the blocked guard — still in the index, nothing reset
    const staged = sh("git diff --cached --name-only", work).trim();
    expect(staged).toBe("staged-intent.txt");
  });

  test("full realign: dump fresher bytes archived, HEAD forward-only to origin, untracked untouched", () => {
    const work = makeFixture("safe");
    // write-behind steady state: UNSTAGED dump mod (fresher than committed)
    writeFileSync(join(work, "backups/db-snapshots/latest-chain.sql"), "-- dump LIVE-fresher-than-commit\n");
    // untracked evidence file (never blocks, must survive)
    writeFileSync(join(work, "upload/untracked-evidence.png"), "untracked\n");
    const res = drive(work, `(g) => {
      const rep = g.guardGitDrift();
      return { action: rep.action, archiveDir: rep.archiveDir };
    }`);
    expect(res.action).toBe("realigned");
    const newHead = sh("git rev-parse HEAD", work).trim();
    const origin = sh("git rev-parse origin/main", work).trim();
    expect(newHead).toBe(origin); // forward-only realignment
    // archive holds the fresher dump bytes + manifest
    expect(existsSync(join(res.archiveDir, "MANIFEST.txt"))).toBe(true);
    expect(existsSync(join(res.archiveDir, "files/backups/db-snapshots/latest-chain.sql"))).toBe(true);
    expect(readFileSync(join(res.archiveDir, "files/backups/db-snapshots/latest-chain.sql"), "utf8"))
      .toContain("LIVE-fresher-than-commit");
    // untracked evidence survived the realign untouched
    expect(readFileSync(join(work, "upload/untracked-evidence.png"), "utf8")).toBe("untracked\n");
    // (fixture cleanup omitted: temp dirs live under /tmp and are reclaimed)
  });
});
