/**
 * NUL-safe blob comparison of upload/ trees between two commits.
 * Demonstrates the v27 fix class: -z output parsed as NUL-separated bytes
 * (never word-split, never C-quoted). Read-only.
 * Usage: bun scripts/v27-reverify/compare-upload-blobs.ts <commitA> <commitB>
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error("usage: compare-upload-blobs.ts <commitA> <commitB>");
  process.exit(2);
}

function lsTree(commit: string): Map<string, string> {
  const out = execFileSync(
    "git",
    ["-c", "core.quotepath=off", "ls-tree", "-r", "-z", commit, "--", "upload/"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  const map = new Map<string, string>();
  for (const rec of out.split("\0").filter(Boolean)) {
    // format: "<mode> <type> <sha>\t<path>"
    const tab = rec.indexOf("\t");
    const meta = rec.slice(0, tab).split(" ");
    map.set(rec.slice(tab + 1), meta[2]);
  }
  return map;
}

const A = lsTree(a);
const B = lsTree(b);
const rows: Array<{ path: string; a: string; b: string; verdict: string }> = [];
const allPaths = new Set([...A.keys(), ...B.keys()]);
for (const p of [...allPaths].sort()) {
  const ba = A.get(p) ?? null;
  const bb = B.get(p) ?? null;
  const verdict = ba && bb ? (ba === bb ? "IDENTICAL" : "DIFFERS") : ba ? "A-ONLY" : "B-ONLY";
  rows.push({ path: p, a: ba?.slice(0, 12) ?? "null", b: bb?.slice(0, 12) ?? "null", verdict });
}
const identical = rows.filter((r) => r.verdict === "IDENTICAL").length;
const nonAscii = rows.filter((r) => /[^\x20-\x7e]/.test(r.path)).length;
const summary = {
  commitA: a,
  commitB: b,
  generatedAt: new Date().toISOString(),
  totalPaths: rows.length,
  identical,
  differs: rows.filter((r) => r.verdict === "DIFFERS").length,
  aOnly: rows.filter((r) => r.verdict === "A-ONLY").length,
  bOnly: rows.filter((r) => r.verdict === "B-ONLY").length,
  nonAsciiPaths: nonAscii,
  rows,
};
console.log(JSON.stringify(summary, null, 2));
writeFileSync(
  "audit-work/v27-critical-recovery/reverify-vault/measurements/upload-blob-comparison.json",
  JSON.stringify(summary, null, 2) + "\n"
);
console.log(`written: audit-work/v27-critical-recovery/reverify-vault/measurements/upload-blob-comparison.json`);
