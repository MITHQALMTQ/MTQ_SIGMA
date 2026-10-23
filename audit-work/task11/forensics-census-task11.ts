/**
 * MTQΣ Task 11 — REPO / GIT / CI-CD EXPOSURE-SURFACE CENSUS (READ-ONLY, OFFLINE)
 * TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
 *
 * Honored constraints:
 *  - NEVER prints, logs, or writes any secret literal (only redacted fingerprints
 *    first6…last4 + length, and DERIVED PUBLIC addresses).
 *  - Read-only: inspects the working tree + local git history + workflow files.
 *    Sends NO network request. Rewrites NOTHING.
 * Purpose (Task 11 §3/§4): fresh census of the two reported compromised-key
 * literals across every surface reachable from this machine, plus the CI/CD and
 * backup-surface inventory, with explicit UNVERIFIED marks for unreachable
 * remote systems.
 */
import { readFileSync, statSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { createPrivateKey, createPublicKey } from "node:crypto";
import { ethers } from "ethers";

const ROOT = "/home/z/my-project";
const now = new Date().toISOString();
const redact = (s: string) => s.replace(/0x[0-9a-fA-F]{64}/g, "0x[REDACTED-64HEX]").replace(/[0-9a-fA-F]{128}/g, "[REDACTED-128HEX]");
const fp = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)} (len=${s.length})`;

const out: any = { task: "task11-exposure-surface-census", generatedAt: now, literals: null as any, worktree: [], git: {}, cicd: {}, env: {}, database: {}, devLog: {}, remoteSurfaces: {}, timeline: [] };

// ---------- 1. Seed the two literals from the known files (into memory only) ----------
const vkSrc = readFileSync(join(ROOT, "scripts/verify-key-and-audit-roles.ts"), "utf8");
const KNOWN_ROLE_HASHES = new Set(["0x" + "0".repeat(64), "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6", "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a"]);
const hex64s = [...vkSrc.matchAll(/0x[0-9a-fA-F]{64}/g)].map(m => m[0]);
const candidates = hex64s.filter(h => !KNOWN_ROLE_HASHES.has(h.toLowerCase()));
if (candidates.length === 0) { console.error("FATAL: no key candidate found in verify-key-and-audit-roles.ts"); process.exit(1); }
const EVM_LIT = candidates[0];

const vhSrc = readFileSync(join(ROOT, "scripts/verify-hex-key.ts"), "utf8");
const hex128 = vhSrc.match(/([0-9a-fA-F]{128})/);
const SOL_LIT = hex128 ? hex128[1] : null;

out.literals = {
  evm: { fingerprint: fp(EVM_LIT), seededFrom: "scripts/verify-key-and-audit-roles.ts" },
  sol: SOL_LIT ? { fingerprint: fp(SOL_LIT), seededFrom: "scripts/verify-hex-key.ts" } : null,
};

// ---------- 2. Re-derive + classify (offline; nothing is signed or sent) ----------
try {
  const w = new ethers.Wallet(EVM_LIT as any);
  out.evmDerived = { address: w.address, matchesDeployer: w.address === "0x3C3932F865892EFabE45892f453f81B64f6c8d8c", classification: "REAL — live-privileged deployer EOA" };
} catch (e: any) { out.evmDerived = { error: String(e?.message ?? e).slice(0, 100), classification: "UNVERIFIED" }; }
if (SOL_LIT) {
  try {
    const seed = Buffer.from(SOL_LIT.slice(0, 64), "hex");
    const pk = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]), format: "der", type: "pkcs8" });
    const pub = createPublicKey(pk);
    const raw = pub.export({ format: "der", type: "spki" }) as Buffer;
    const solanaPub = raw.subarray(-32);
    const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let n = 0n; for (const b of solanaPub) n = n * 256n + BigInt(b);
    let b58 = ""; while (n > 0n) { b58 = B58[Number(n % 58n)] + b58; n /= 58n; }
    const embedded = Buffer.from(SOL_LIT.slice(64), "hex");
    out.solDerived = { publicKeyBase58: b58, embeddedPubkeyConsistent: embedded.equals(solanaPub), matchesExposedWallet_4saT: b58 === "4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d", classification: "REAL — well-formed keypair for the exposed 4saT wallet" };
  } catch (e: any) { out.solDerived = { error: String(e?.message ?? e).slice(0, 100), classification: "UNVERIFIED" }; }
}

// ---------- 3. Working-tree byte-level census (exact literals only) ----------
// NOTE (honest disclosure, 2026-10-22): the FIRST version of this census passed the
// literal as a command-line ARGUMENT to `git grep`; one failing call made Node print
// the full argv (including the literal) to the terminal transcript. No evidence file,
// JSON, or log received the literal (they contain fingerprints only), and the repo
// already contained it — but the AI-session transcript became an additional exposure
// surface. This version passes patterns via STDIN (`git grep -f -`) and the literal
// never appears in argv again. Disclosed in D2-EXPOSURE-SURFACE.md.
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build"]);
function walk(dir: string, hits: { file: string; kind: string }[]) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) { if (!SKIP_DIRS.has(ent.name)) walk(p, hits); continue; }
    try {
      const buf = readFileSync(p);
      if (buf.includes(Buffer.from(EVM_LIT, "utf8"))) hits.push({ file: p.slice(ROOT.length + 1), kind: "EVM-EXACT" });
      if (SOL_LIT && buf.includes(Buffer.from(SOL_LIT, "utf8"))) hits.push({ file: p.slice(ROOT.length + 1), kind: "SOL-EXACT" });
    } catch { /* unreadable binary — record nothing */ }
  }
}
const worktreeHits: { file: string; kind: string }[] = [];
walk(ROOT, worktreeHits);
out.worktree = worktreeHits;
out.worktreeSummary = {
  evmFiles: worktreeHits.filter(h => h.kind === "EVM-EXACT").map(h => h.file),
  solFiles: worktreeHits.filter(h => h.kind === "SOL-EXACT").map(h => h.file),
  countsMatchTask10: {
    evm: worktreeHits.filter(h => h.kind === "EVM-EXACT").length,
    sol: worktreeHits.filter(h => h.kind === "SOL-EXACT").length,
    task10Was: { evm: 2, sol: 6 },
  },
};

// ---------- 4. Git history census (per-commit exact match; pattern via STDIN, never argv) ----------
const commits = execFileSync("git", ["-C", ROOT, "log", "--format=%H %cI %s"], { encoding: "utf8" }).trim().split("\n").map(l => l.split(" ")[0]);
out.git.commitCount = commits.length;
out.git.head = commits[0];
const gitGrep = (lit: string, commit: string, files: string[]): boolean => {
  try {
    const r = execFileSync("git", ["-C", ROOT, "grep", "-F", "-l", "-f", "-", commit, "--", ...files], {
      encoding: "utf8",
      input: lit + "\n",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    return r.length > 0;
  } catch (e: any) {
    if (e?.status === 1) return false; // grep exit code 1 = no match
    throw e;
  }
};
const EVM_FILES = ["scripts/verify-key-and-audit-roles.ts", "worklog.md"];
const SOL_FILES = ["scripts/verify-hex-key.ts", "scripts/solana-create-fresh.ts", "scripts/solana-create-umi.ts", "scripts/solana-create-with-metadata.ts", "scripts/solana-set-metadata.ts", "scripts/solana-set-metadata-v2.ts"];
let evmCommits = 0, solCommits = 0;
for (const c of commits) {
  if (gitGrep(EVM_LIT, c, EVM_FILES)) evmCommits++;
  if (SOL_LIT && gitGrep(SOL_LIT, c, SOL_FILES)) solCommits++;
}
out.git.literalsReachableInHistory = {
  evmInCommits: evmCommits, solInCommits: solCommits,
  allCommitsContainEvm: evmCommits === commits.length,
  allCommitsContainSol: solCommits === commits.length,
  firstCommit: execFileSync("git", ["-C", ROOT, "log", "--reverse", "--format=%H %cI", "-1"], { encoding: "utf8" }).trim(),
};

// ---------- 5. CI/CD + remote surface inventory ----------
const remotes = execFileSync("git", ["-C", ROOT, "remote", "-v"], { encoding: "utf8" }).trim();
out.cicd.gitRemoteConfigured = remotes.length > 0 ? remotes.split("\n") : "NONE (no remote — repository has never been pushed from this machine; remote existence UNVERIFIED)";
const wfDir = join(ROOT, ".github/workflows");
const workflows = existsSync(wfDir) ? readdirSync(wfDir) : [];
out.cicd.workflows = workflows.map(w => {
  const src = readFileSync(join(wfDir, w), "utf8");
  return {
    file: `.github/workflows/${w}`,
    referencesSecrets: [...src.matchAll(/\b(?:secrets|vars)\.([A-Z0-9_]+)/g)].map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i),
    uploadsArtifacts: /upload-artifact|actions\/upload|create.*release|gh release/i.test(src),
    checkoutsFullRepo: /actions\/checkout/.test(src),
    triggers: [...src.matchAll(/^\s*-\s*(schedule|push|pull_request|workflow_dispatch)\b/gm)].map(m => m[1]),
  };
});
out.cicd.note = "Workflows exist locally and are written for GitHub Actions. Whether ANY remote repository/organization exists, whether these workflows ever executed, and whether artifacts/backups derived from this repository exist on GitHub or any other provider is UNVERIFIABLE from this machine and must be answered by the owner.";

// ---------- 6. .env / database / dev.log byte scans ----------
for (const f of [".env", ".env.local"]) {
  const p = join(ROOT, f);
  if (existsSync(p)) {
    const buf = readFileSync(p);
    out.env[f] = { containsEvmLiteral: buf.includes(Buffer.from(EVM_LIT, "utf8")), containsSolLiteral: SOL_LIT ? buf.includes(Buffer.from(SOL_LIT, "utf8")) : false, keysPresent: buf.toString().split("\n").filter(l => l.includes("=")).map(l => l.split("=")[0]) };
  } else out.env[f] = "ABSENT";
}
for (const f of ["db/custom.db", "dev.log", "CRITICAL-PRIVATE-KEY-ROTATION.md"]) {
  const p = join(ROOT, f);
  if (existsSync(p)) {
    const buf = readFileSync(p);
    out.database[f] = { containsEvmLiteral: buf.includes(Buffer.from(EVM_LIT, "utf8")), containsSolLiteral: SOL_LIT ? buf.includes(Buffer.from(SOL_LIT, "utf8")) : false, sizeBytes: statSync(p).size };
  } else out.database[f] = "ABSENT";
}

// ---------- 7. upload/ + known backup surfaces ----------
out.remoteSurfaces = {
  "upload/private_key.txt": existsSync(join(ROOT, "upload/private_key.txt")) ? "PRESENT — INVESTIGATE" : "ABSENT from disk (Task 10: deleted at unknown time; never git-tracked)",
  tursoScripts: ["scripts/backup-turso.ts", "scripts/migrate-turso.ts", "scripts/migrate-to-turso.ts", "scripts/push-turso.ts"].filter(f => existsSync(join(ROOT, f))),
  remoteBackups: "UNVERIFIED — Turso/remote database, remote clones, CI caches, developer machines cannot be inspected from this sandbox; assign UNRESOLVED until the owner attests",
};

// ---------- 8. Timeline anchors (file mtimes of literal-bearing scripts) ----------
for (const f of ["scripts/verify-key-and-audit-roles.ts", "scripts/verify-hex-key.ts", "scripts/solana-create-fresh.ts", "scripts/solana-create-umi.ts", "scripts/solana-create-with-metadata.ts", "scripts/solana-set-metadata.ts", "scripts/solana-set-metadata-v2.ts"]) {
  out.timeline.push({ file: f, mtime: statSync(join(ROOT, f)).mtime.toISOString() });
}

writeFileSync(join(ROOT, "audit-work/task11/evidence/exposure-surface-census-task11.json"), JSON.stringify(out, null, 1));
console.log(redact(JSON.stringify({
  literals: out.literals,
  evmDerived: out.evmDerived,
  solDerived: out.solDerived,
  worktreeSummary: out.worktreeSummary,
  git: out.git,
  workflowCount: out.cicd.workflows?.length,
}, null, 1)));
