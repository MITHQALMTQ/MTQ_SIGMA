// MTQΣ — Git-drift guard quoting regression tests (v27 critical recovery).
//
// Incident #10 root cause: `git diff --name-only` C-quotes paths carrying
// non-ASCII bytes (11 owner screenshots with U+202F NARROW NO-BREAK SPACE),
// the quoted pseudo-path then bypassed the upload/ derivable-prefix fast-path
// and failed every rev-parse blob lookup → false unique-content → permanent
// BLOCK. These tests build REAL diverged repositories (local file:// origin)
// whose local-only commits carry filename torture fixtures, import the ACTUAL
// guard implementation (byte-copied into each fixture so ROOT resolves to the
// fixture), and assert every classification + safety behavior.
//
// Run: bun test tests/git-drift-quoting.test.ts

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const LIB_SRC = resolve(import.meta.dir, "../src/lib/boot/git-drift.ts");

// The ACTUAL 11 paths that blocked the real repository (U+202F = \u202F
// between the time and AM/PM — the exact bytes git C-quoted as \342\200\257).
export const REAL_BLOCKED_PATHS: string[] = [
  "upload/Screenshot 2026-11-07 at 1.31.21\u202FAM.png",
  "upload/Screenshot 2026-11-07 at 1.48.21\u202FAM.png",
  "upload/Screenshot 2026-11-07 at 1.52.29\u202FAM.png",
  "upload/Screenshot 2026-11-07 at 1.53.15\u202FAM.png",
  "upload/Screenshot 2026-11-07 at 1.53.38\u202FAM.png",
  "upload/Screenshot 2026-11-07 at 1.54.10\u202FAM.png",
  "upload/Screenshot 2026-11-07 at 1.55.08\u202FAM.png",
  "upload/Screenshot 2026-11-07 at 1.56.01\u202FAM.png",
  "upload/Screenshot 2026-11-07 at 1.58.14\u202FAM.png",
  "upload/Screenshot 2026-11-07 at 12.48.20\u202FPM.png",
  "upload/Screenshot 2026-11-07 at 4.23.48\u202FPM.png",
];

// Filename torture fixtures: spaces, parens, quotes, unicode, U+202F, tab,
// newline, $, backticks, long names — every class that corrupts under shell
// interpolation or C-quoting.
const TORTURE_PATHS: string[] = [
  "upload/file with plain spaces.png",
  "upload/file(with parens).png",
  'upload/file"double quoted".png',
  "upload/file'single quoted.png",
  "upload/файл-юникод-תמונה.png",
  "upload/narrow\u202Fno-break\u202Fspace.png",
  "upload/tab\tcharacter.png",
  "upload/newline\ncharacter.png",
  "upload/dollar$sign expand.png",
  "upload/back`tick`subshell.png",
  `upload/${"L".repeat(180)}-longname.png`,
];

const CONTENT = (p: string) => `evidence-bytes:${p}:${p.length}\n`;
const LEGACY_V0 = "legacy v0 — ancient state (only in origin history)\n";
const LEGACY_V1 = "legacy v1 — base state (merge-base)\n";
const LEGACY_V2 = "legacy v2 — origin advanced\n";

interface Fixture {
  root: string;
  work: string;
  originDir: string;
  lib: typeof import("../src/lib/boot/git-drift");
  originSha: () => string;
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** Reset the guard's /tmp fetch-throttle state so fixture fetches always run. */
function resetThrottle(): void {
  writeFileSync("/tmp/mtq-git-drift-state.json", JSON.stringify({ lastFetchAt: 0, lastFetchOk: false, lastOrigin: "" }));
}

function buildFixture(opts: { uniqueFile?: boolean } = {}): Fixture {
  const root = mkdtempSync(join(tmpdir(), "gdq-"));
  const originDir = join(root, "origin.git");
  const work = join(root, "work");
  git(root, ["init", "--bare", "-b", "main", "origin.git"]);
  git(root, ["init", "-b", "main", "work"]);
  git(work, ["config", "user.email", "gdq@example.com"]);
  git(work, ["config", "user.name", "GDQ"]);

  // ── Shared history: ancient → base (merge-base will be BASE) ──
  mkdirSync(join(work, "src/lib"), { recursive: true });
  mkdirSync(join(work, "src/extra"), { recursive: true });
  mkdirSync(join(work, "backups/db-snapshots"), { recursive: true });
  mkdirSync(join(work, "upload"), { recursive: true });
  writeFileSync(join(work, "README.md"), "base\n");
  writeFileSync(join(work, "src/extra/kept.ts"), "kept at base and by origin; deleted locally\n");
  writeFileSync(join(work, "backups/db-snapshots/latest-chain.sql"), "-- MTQ-DUMP-TIP base\n");
  writeFileSync(join(work, "backups/db-snapshots/latest-custom.sql"), "-- MTQ-DUMP-TIP base\n");
  writeFileSync(join(work, "upload/keeper-base.png"), "base screenshot\n");
  git(work, ["remote", "add", "origin", originDir]);
  writeFileSync(join(work, "src/lib/legacy.ts"), LEGACY_V0); // ancient state — only in shared history
  git(work, ["add", "-A"]);
  git(work, ["commit", "-m", "ancient"]);
  git(work, ["push", "-q", "origin", "main"]);
  writeFileSync(join(work, "src/lib/legacy.ts"), LEGACY_V1); // base state — the merge-base
  git(work, ["add", "-A"]);
  git(work, ["commit", "-m", "base"]);
  git(work, ["push", "-q", "origin", "main"]);

  // ── ORIGIN advances (the "34 commits" stand-in) ──
  writeFileSync(join(work, "src/lib/legacy.ts"), LEGACY_V2); // origin evolves past v1
  writeFileSync(join(work, "README.md"), "origin advanced\n");
  git(work, ["add", "-A"]);
  git(work, ["commit", "-m", "origin advance"]);
  git(work, ["push", "-q", "origin", "main"]);
  const originAdvanceSha = git(work, ["rev-parse", "HEAD"]);

  // ── LOCAL rewinds to base and makes its own commit (the diverged line) ──
  git(work, ["reset", "--hard", "HEAD~1"]);
  for (const p of [...TORTURE_PATHS, ...REAL_BLOCKED_PATHS]) {
    const abs = join(work, p);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, CONTENT(p));
  }
  writeFileSync(join(work, "src/lib/legacy.ts"), LEGACY_V0); // ancestor blob: v0 exists in origin history
  writeFileSync(join(work, "backups/db-snapshots/latest-chain.sql"), "-- MTQ-DUMP-TIP local-line write-behind\n");
  rmSync(join(work, "src/extra/kept.ts")); // deleted locally while origin has it
  if (opts.uniqueFile) {
    writeFileSync(join(work, "src/lib/genuinely-new.ts"), "never seen upstream — must BLOCK\n");
  }
  git(work, ["add", "-A"]);
  git(work, ["commit", "-m", "local-only line with torture filenames"]);

  // ── import the ACTUAL guard implementation rooted at the fixture ──
  mkdirSync(join(work, "src/lib/boot"), { recursive: true });
  copyFileSync(LIB_SRC, join(work, "src/lib/boot/git-drift.ts"));
  const lib = require(join(work, "src/lib/boot/git-drift.ts")) as typeof import("../src/lib/boot/git-drift");
  return {
    root,
    work,
    originDir,
    lib,
    originSha: () => git(work, ["rev-parse", "origin/main"]),
    // keep reference so linters don't drop it; used in diagnostics
    ...(originAdvanceSha ? {} : {}),
  } as Fixture;
}

const cleanup: string[] = [];

describe("git-drift guard — quoting/subsumption regression (incident #10)", () => {
  let fx: Fixture;

  beforeAll(() => {
    fx = buildFixture();
    cleanup.push(fx.root);
  });

  afterAll(() => {
    for (const root of cleanup) {
      try {
        rmSync(root, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    }
  });

  test("classifies the fixture as diverged", () => {
    resetThrottle();
    const status = fx.lib.classifyGitDrift({ forceFetch: true });
    expect(status.klass).toBe("diverged");
    expect(status.localOnly.length).toBe(1);
    expect(status.behindCount).toBe(1);
  });

  test("localSideChangedPaths returns LITERAL paths — no C-quoting, no newline-mangling, complete coverage", () => {
    resetThrottle();
    const status = fx.lib.classifyGitDrift({ forceFetch: true });
    const paths = fx.lib.localSideChangedPaths(status);
    // every torture + real blocked path round-trips EXACTLY
    for (const p of [...TORTURE_PATHS, ...REAL_BLOCKED_PATHS]) {
      expect(paths).toContain(p);
    }
    // no quoted pseudo-paths anywhere (the incident-#10 signature)
    for (const p of paths) {
      expect(p.startsWith('"')).toBe(false);
      expect(p.includes("\\342")).toBe(false);
      expect(p.includes("\\240")).toBe(false);
    }
    // complete coverage — the guard cannot silently ignore a changed file
    const truth = git(fx.work, ["-c", "core.quotepath=off", "diff", "--name-only", "-z", "--no-renames", "origin/main...HEAD"])
      .split("\0")
      .filter(Boolean);
    expect(new Set(paths)).toEqual(new Set(truth));
  });

  test("the 11 real blocked screenshot paths classify as DERIVABLE (not unique-content)", () => {
    resetThrottle();
    const status = fx.lib.classifyGitDrift({ forceFetch: true });
    const sub = fx.lib.proveSubsumption(status);
    const verdicts = new Map(sub.paths.map((x) => [x.path, x.verdict] as const));
    for (const p of REAL_BLOCKED_PATHS) {
      expect(verdicts.get(p)).toBe("derivable");
    }
    for (const p of TORTURE_PATHS) {
      expect(verdicts.get(p)).toBe("derivable");
    }
  });

  test("deleted-origin-wins and ancestor-blob rules still work", () => {
    resetThrottle();
    const status = fx.lib.classifyGitDrift({ forceFetch: true });
    const verdicts = new Map(fx.lib.proveSubsumption(status).paths.map((x) => [x.path, x.verdict] as const));
    expect(verdicts.get("src/extra/kept.ts")).toBe("deleted-origin-wins");
    expect(verdicts.get("src/lib/legacy.ts")).toBe("ancestor-blob");
    expect(verdicts.get("backups/db-snapshots/latest-chain.sql")).toBe("derivable");
  });

  test("subsumption is SAFE for the previously-blocked geometry → guard REALIGNS (action, not manufactured exit code)", () => {
    resetThrottle();
    const logs: string[] = [];
    const report = fx.lib.guardGitDrift({ runtimeRefresh: false, log: (s) => logs.push(s) });
    expect(report.action).toBe("realigned");
    expect(report.subsumption?.safe).toBe(true);
    expect(report.subsumption?.blockers).toEqual([]);
    // forward-only alignment to origin
    expect(git(fx.work, ["rev-parse", "HEAD"])).toBe(fx.originSha());
    // tracked tree clean after realignment (untracked archive/ + lib copy are
    // legitimate artifacts; -uno is the guard's own cleanliness criterion)
    expect(git(fx.work, ["status", "--porcelain", "-uno"]).trim()).toBe("");
    // the actuator's decision path logged the archive step
    expect(logs.some((l) => l.includes("archived local line"))).toBe(true);
  });

  test("pre-realign archive preserved every torture/screenshot byte (vault-before-reset)", () => {
    const archRoot = join(fx.work, "mtq-sigma-backups/selfheal-archive");
    const dirs = readdirSync(archRoot).filter((d) => d.startsWith("gitdrift-"));
    expect(dirs.length).toBeGreaterThan(0);
    const dir = join(archRoot, dirs[dirs.length - 1]);
    expect(existsSync(join(dir, "local-line.bundle"))).toBe(true);
    for (const p of [...TORTURE_PATHS.slice(0, 4), ...REAL_BLOCKED_PATHS.slice(0, 4)]) {
      const archived = join(dir, "files", p);
      expect(existsSync(archived)).toBe(true);
      expect(readFileSync(archived, "utf8")).toBe(CONTENT(p));
    }
  });

  test("genuine unique-content still BLOCKS (protection not weakened)", () => {
    const fxB = buildFixture({ uniqueFile: true });
    cleanup.push(fxB.root);
    resetThrottle();
    const report = fxB.lib.guardGitDrift({ runtimeRefresh: false, log: () => {} });
    expect(report.action).toBe("blocked");
    expect(report.subsumption?.safe).toBe(false);
    expect(report.subsumption?.blockers).toContain("src/lib/genuinely-new.ts");
    // nothing moved
    expect(git(fxB.work, ["rev-parse", "HEAD"])).not.toBe(fxB.originSha());
    expect(existsSync(join(fxB.work, "src/lib/genuinely-new.ts"))).toBe(true);
  });

  test("write-behind dump modification never blocks a realign AND its fresher bytes are archived", () => {
    const fxC = buildFixture();
    cleanup.push(fxC.root);
    const fresher = "-- MTQ-DUMP-TIP rows=9999 height=99999 (unstaged write-behind refresh)\n";
    writeFileSync(join(fxC.work, "backups/db-snapshots/latest-chain.sql"), fresher);
    resetThrottle();
    const report = fxC.lib.guardGitDrift({ runtimeRefresh: false, log: () => {} });
    expect(report.action).toBe("realigned");
    expect(git(fxC.work, ["rev-parse", "HEAD"])).toBe(fxC.originSha());
    // freshest dump bytes preserved in the archive before reset discarded them
    const archRoot = join(fxC.work, "mtq-sigma-backups/selfheal-archive");
    const dirs = readdirSync(archRoot).filter((d) => d.startsWith("gitdrift-"));
    const dir = join(archRoot, dirs[dirs.length - 1]);
    expect(readFileSync(join(dir, "files/backups/db-snapshots/latest-chain.sql"), "utf8")).toBe(fresher);
  });

  test("STAGED changes still block (explicit intent respected)", () => {
    const fxD = buildFixture();
    cleanup.push(fxD.root);
    writeFileSync(join(fxD.work, "README.md"), "staged edit\n");
    git(fxD.work, ["add", "README.md"]);
    resetThrottle();
    const report = fxD.lib.guardGitDrift({ runtimeRefresh: false, log: () => {} });
    expect(report.action).toBe("blocked");
    expect(report.note).toBe("dirty tree");
  });
});
