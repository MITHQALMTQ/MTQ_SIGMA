// MTQΣ — Runtime dependency preflight (V31 TURN 3 — Fix R-1 §2.3, in-repo).
//
// WHY (Incident 22 fourth recurrence, 2026-11-09T14:51Z): platform re-
// provisioning realigns the git tree to origin/main but leaves the runtime
// layer (node_modules) in the stale image's dependency state — observed
// live: next@16.4.5 sources + @next/swc 16.1.3 binary + missing vendored
// meriyah → `next dev` dies at next.config.ts load ("Cannot find module
// '../../../meriyah/dist/meriyah2.js'", "Mismatching @next/swc version,
// detected: 16.1.3 while Next.js is on 16.4.5") BEFORE any repository guard
// can act, and the watchdog crash-loops through it.
//
// WHAT: a bounded, read-only consistency check between package.json and the
// installed runtime layer. Runs (a) in dev-watchdog.sh BEFORE every
// `next dev` start (mismatch → bun install --frozen-lockfile → re-check →
// still mismatched → DO NOT start: honest blocked status), and (b) in
// scripts/plane5-bootstrap.sh §3.11 (mismatch → bootstrap exit 16 → the
// wrapper repairs the runtime layer once and retries once).
//
// Exit codes: 0 = consistent; 3 = mismatch (JSON detail on stdout).
// Dependency policy: node builtins ONLY (no semver dependency — the version
// comparison handles the ^/~ ranges the manifest actually uses).

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.MTQ_SIGMA_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface Issue {
  check: string;
  expected: string;
  actual: string;
}

function readPkgVersion(p: string): string | null {
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, p), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
}

/** Major.minor of a semver string (patch drift is tolerated; a major/minor
 *  drift is the ABI-incompatible class that crashes the dev server). */
function majorMinor(v: string): string {
  const m = v.replace(/^[^0-9]*/, "").match(/^(\d+)\.(\d+)/);
  return m ? `${m[1]}.${m[2]}` : "?";
}

const issues: Issue[] = [];

// 1. next: installed version must satisfy the manifest's declared range
//    (major.minor equality).
try {
  const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const declared: string | undefined = manifest?.dependencies?.next;
  const installed = readPkgVersion("node_modules/next/package.json");
  if (!declared) {
    issues.push({ check: "package.json dependencies.next", expected: "declared", actual: "missing" });
  } else if (!installed) {
    issues.push({ check: "node_modules/next", expected: declared, actual: "NOT INSTALLED" });
  } else if (majorMinor(declared) !== majorMinor(installed)) {
    issues.push({ check: "node_modules/next version", expected: `${majorMinor(declared)}.x`, actual: installed });
  }
} catch {
  issues.push({ check: "package.json", expected: "readable", actual: "unreadable" });
}

// 2. @next/swc platform binary: must match the INSTALLED next version exactly
//    (the observed crash class: 16.1.3 binary under 16.4.5 next).
const nextInstalled = readPkgVersion("node_modules/next/package.json");
if (nextInstalled) {
  const swcCandidates = [
    "node_modules/@next/swc-linux-x64-gnu/package.json",
    "node_modules/@next/swc-linux-x64-musl/package.json",
  ];
  let swcChecked = false;
  for (const c of swcCandidates) {
    if (!existsSync(join(ROOT, c))) continue;
    swcChecked = true;
    const swcV = readPkgVersion(c);
    if (swcV && swcV !== nextInstalled) {
      issues.push({ check: c.replace("node_modules/", ""), expected: nextInstalled, actual: swcV });
    }
  }
  if (!swcChecked && existsSync(join(ROOT, "node_modules/@next"))) {
    issues.push({ check: "@next/swc platform binary", expected: nextInstalled, actual: "NO PLATFORM BINARY (none of linux-x64-gnu/musl)" });
  }
}

// 3. Vendored meriyah: @sentry/server-utils' code-transformer requires
//    node_modules/meriyah/dist/meriyah2.js at next.config.ts transpile time
//    (the exact MODULE_NOT_FOUND of the 14:56Z crash).
if (!existsSync(join(ROOT, "node_modules/meriyah/dist/meriyah2.js"))) {
  issues.push({
    check: "node_modules/meriyah/dist/meriyah2.js",
    expected: "present (vendored @sentry code-transformer dependency)",
    actual: existsSync(join(ROOT, "node_modules/@sentry")) ? "MISSING while @sentry is installed" : "missing (@sentry absent — informational)",
  });
}

// 4. next CLI entrypoint.
if (!existsSync(join(ROOT, "node_modules/.bin/next"))) {
  issues.push({ check: "node_modules/.bin/next", expected: "present", actual: "missing" });
}

// Informational only (never blocks): prisma client generation state.
const prismaInfo = existsSync(join(ROOT, "node_modules/.prisma/client/index.js"))
  ? "generated"
  : "not-generated (postinstall prisma generate pending — informational)";

const ok = issues.filter((i) => !i.actual.startsWith("missing (@sentry absent")).length === 0;
const detail = ok
  ? `runtime layer consistent (next ${nextInstalled ?? "?"} · swc match · meriyah present · ${prismaInfo})`
  : `runtime layer MISMATCH: ${issues.map((i) => `${i.check}: expected ${i.expected}, actual ${i.actual}`).join("; ")}`;

console.log(JSON.stringify({ ok, issues, prisma: prismaInfo, detail, root: ROOT }, null, 1));
if (!ok) {
  console.error(`[runtime-preflight] FAIL — ${detail}`);
  console.error("[runtime-preflight] repair: bun install --frozen-lockfile (then re-run); do NOT start next dev on a mismatched runtime.");
  process.exit(3);
}
console.error(`[runtime-preflight] OK — ${detail}`);
process.exit(0);
