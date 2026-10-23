// MTQΣ — MANDATE-007 §5 · Layer-8 consolidated proposed-diff extraction + verification
// =================================================================================
// PURPOSE (READ-ONLY ANALYSIS — modifies no canonical source):
//   1. Extract the six-failure proposed diffs VERBATIM from the D-13.26 evidence
//      pack (d13.26-layer8-evidence-pack.md §2–§6 ```diff blocks).
//   2. VERIFY against the current tree that every removed (`-`) and context (` `)
//      line of each proposed diff exists byte-for-byte in
//      src/lib/mtq/__tests__/canonical-invariants.ts — i.e. the proposed diffs
//      are EXACT for the current file, not drifted presentation.
//   3. Write the consolidated review artifact
//      layer8-d13-26-consolidated-proposed-diff-mandate007.md + a JSON record.
//
// This file applies NOTHING. The canonical suite stays byte-identical; verdict
// stays FAIL (85/91 focused · 237/243 full) pending D-13.26 owner/validator
// approval. Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED.
//
// Run: bun audit-work/task13/evidence/extract-and-verify-layer8-diffs.ts
// =================================================================================

import * as fs from "node:fs";
import * as path from "node:path";

const packPath = path.join(__dirname, "..", "d13.26-layer8-evidence-pack.md");
const canonicalPath = path.join(
  __dirname, "..", "..", "..", "src", "lib", "mtq", "__tests__", "canonical-invariants.ts"
);
const outMdPath = path.join(__dirname, "layer8-d13-26-consolidated-proposed-diff-mandate007.md");
const outJsonPath = path.join(__dirname, "layer8-d13-26-diff-verification-mandate007.json");

const pack = fs.readFileSync(packPath, "utf8");
const canonical = fs.readFileSync(canonicalPath, "utf8");
const canonicalLineSet = new Set(canonical.split("\n"));

// Finding labels in the order the ```diff blocks appear in the pack.
const BLOCK_FINDINGS = [
  {
    id: "F1",
    label: "Finding 1 — C.1 · §10.4 no-trade-band boundary (inclusive ≤)",
    anchor: "canonical-invariants.ts:1870-1872 (verified fresh this cycle)",
    source:
      'v2.0 §10.4 operative equation: "Trade_i = 0 if D_{i,t} ≤ θ_{i,t}" (pandoc 4296–4297); ' +
      '§10.3 Level 2: "Drift trigger: D_{i,t} > θ_{i,t}" (pandoc 4207). Code: marp.ts:692-700 inclusive.',
    direction: "More conservative (never trades at D = θ). Adds 1 new end-to-end sandwich assertion.",
  },
  {
    id: "F2",
    label: "Finding 2 — C.3 · §10.6 state-dependent trade sizing (β-form)",
    anchor: "canonical-invariants.ts:1929-1932 (verified fresh this cycle)",
    source:
      'v2.0 §10.6: "Trade_i = β_{i,t}(W_Target − W_Actual), 0 < β_{i,t} ≤ 1", ' +
      '"β_{i,t} = clip(β₀ + β₁·U_i − β₂·Î_i, β_min, 1)" (pandoc 4373–4391). Code: marp.ts:445-458.',
    direction: "Stronger (verifies the full β-form: U = 0.72, β = 0.86, Î = 0, residual-only sizing).",
  },
  {
    id: "F3",
    label: "Finding 3 — RG-10 · ε-boundary fixture (legacy worked-example vector)",
    anchor: "canonical-invariants.ts:1957-1964 (verified fresh this cycle)",
    source:
      'v2.0 §10.8/§12.8 + Listing 4: "BP\'s bare benefit > costTerm test is tightened to benefit > costTerm + ' +
      'BENEFIT_MARGIN… the skip reason string records the margin failure" (pandoc 5917–5921); ε = $10 is the ' +
      "OD-2 OPEN legacy candidate. Gate intact at marp.ts:735.",
    direction: "Identical intended nets (+$5 reject / +$15 pass) via documented positional overrides (marp.ts:713-736).",
  },
  {
    id: "F4+5",
    label: "Findings 4 & 5 — RG-10 · active-path rejection (reject branch + reason contract)",
    anchor: "canonical-invariants.ts:2110-2127 (verified fresh this cycle)",
    source:
      "§10.8/§12.8 + Listing 4 skip-reason contract; §11.7 canonical reason set. Reject branch intact at " +
      "engine.ts:1116-1118; the fixture premise (nav $18,000) made (0, ε] unreachable under the §12.7 cost model.",
    direction: "Recalibrated fixture only (nav $6,000, surplus $60 → net +$5.70 → REJECT). Case B label $29.40 → $60.58.",
  },
  {
    id: "F6",
    label: "Finding 6 — §21.5.3 · in-band timer (§21.5.2 reset-to-zero vs 2× decay)",
    anchor: "canonical-invariants.ts:2338-2351 (verified fresh this cycle)",
    source:
      'v2.0 §21.5.2: "the timer resets to zero the moment the price returns inside the band" (pandoc 13944–13947; ' +
      "Listing 13 \"timer reset on return\"). Code: engine.ts:1787-1793 reset; §21.5.3 pause gates advancement only.",
    direction: "More conservative detector (oscillation can never accumulate). Adds the 12h-boundary + oscillation suite.",
  },
];

// ---- extract ```diff blocks -------------------------------------------------
const packLines = pack.split("\n");
const blocks: string[][] = [];
let inBlock = false;
let cur: string[] = [];
for (const line of packLines) {
  const trimmed = line.trim();
  if (!inBlock && trimmed === "```diff") {
    inBlock = true;
    cur = [];
    continue;
  }
  if (inBlock && trimmed === "```") {
    blocks.push(cur);
    inBlock = false;
    continue;
  }
  if (inBlock) cur.push(line);
}
if (inBlock) {
  console.error("ERROR: unterminated ```diff block in the evidence pack.");
  process.exit(2);
}
if (blocks.length !== BLOCK_FINDINGS.length) {
  console.error(
    `ERROR: expected ${BLOCK_FINDINGS.length} \`\`\`diff blocks, found ${blocks.length}. Pack layout changed — investigate.`
  );
  process.exit(2);
}

// ---- verify removed + context lines against the current canonical file -------
interface BlockResult {
  id: string;
  label: string;
  anchor: string;
  removedChecked: number;
  removedVerified: number;
  contextChecked: number;
  contextVerified: number;
  addedLines: number;
  missing: string[];
}
const results: BlockResult[] = [];
const verifiedBlocks: { meta: (typeof BLOCK_FINDINGS)[number]; body: string[]; result: BlockResult }[] = [];

blocks.forEach((body, i) => {
  const meta = BLOCK_FINDINGS[i];
  const res: BlockResult = {
    id: meta.id,
    label: meta.label,
    anchor: meta.anchor,
    removedChecked: 0,
    removedVerified: 0,
    contextChecked: 0,
    contextVerified: 0,
    addedLines: 0,
    missing: [],
  };
  for (const raw of body) {
    if (raw.startsWith("+")) {
      res.addedLines += 1;
    } else if (raw.startsWith("-") && raw !== "---") {
      res.removedChecked += 1;
      const original = raw.slice(1); // strip the diff '-'
      if (canonicalLineSet.has(original)) res.removedVerified += 1;
      else res.missing.push(original);
    } else if (raw.startsWith(" ")) {
      res.contextChecked += 1;
      const original = raw.slice(1); // strip the diff context space
      if (canonicalLineSet.has(original)) res.contextVerified += 1;
      else res.missing.push(original);
    }
    // lines that are empty in the diff body (blank context) verify trivially
  }
  results.push(res);
  verifiedBlocks.push({ meta, body, result: res });
});

// ---- report -----------------------------------------------------------------
let allOk = true;
console.log("=== Layer-8 D-13.26 proposed-diff verification against the current tree ===");
console.log(`Pack: ${path.relative(process.cwd(), packPath)}`);
console.log(`Canonical file: ${path.relative(process.cwd(), canonicalPath)}`);
for (const r of results) {
  const ok = r.missing.length === 0;
  allOk = allOk && ok;
  console.log(
    `\n[${r.id}] ${ok ? "VERIFIED" : "DRIFT DETECTED"} — ${r.label}\n` +
      `  removed lines: ${r.removedVerified}/${r.removedChecked} verified · context lines: ` +
      `${r.contextVerified}/${r.contextChecked} verified · added lines: ${r.addedLines}\n` +
      `  anchor: ${r.anchor}`
  );
  for (const m of r.missing) {
    console.log(`  MISSING: ${JSON.stringify(m.slice(0, 120))}`);
  }
}
console.log(
  `\nVERDICT: ${allOk ? "ALL PROPOSED DIFFS ARE EXACT FOR THE CURRENT TREE" : "AT LEAST ONE DIFF DRIFTED FROM THE CURRENT TREE"}`
);
console.log("Nothing was applied. The canonical suite remains byte-identical; verdict stays FAIL pending D-13.26 approval.");

// ---- write the consolidated review artifact ----------------------------------
const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
let md = "";
md += `# MTQΣ — Layer-8 Six-Failure D-13.26 Consolidated Proposed Diff (MANDATE-007 §5 presentation)\n\n`;
md += `**Generated:** ${now} · by \`extract-and-verify-layer8-diffs.ts\` (verbatim extraction; no manual transcription)\n`;
md += `**Status: PROPOSED — NOT APPLIED.** Application requires owner/validator review and approval under the ` +
  `D-13.26 protocol (assertion re-pins citing the v2.0 authoritative text; no threshold or assertion logic ` +
  `weakened — three corrections strictly more conservative, one stronger form, two identical-intent).\n`;
md += `**Current honest verdict on the tree (fresh this cycle):** canonical --layers=8 → **85/91 pass, 6 fail, exit 1** ` +
  `(identical canonical six) · --layers=1,2,3,4,5,6,8 → **237/243, 6 fail, exit 1**. Logs: ` +
  `\`l8-focused-mandate007-2026-10-22.txt\`, \`l-deterministic-mandate007-2026-10-22.txt\`.\n`;
md += `**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**\n\n`;
md += `## Verification of exactness\n\nEvery removed (\`-\`) and context line of every block below was checked ` +
  `byte-for-byte against the current \`src/lib/mtq/__tests__/canonical-invariants.ts\`:\n\n`;
md += `| Block | Removed lines verified | Context lines verified | Added lines | Verdict |\n|---|---|---|---|---|\n`;
for (const r of results) {
  md += `| ${r.id} ${r.label.split("—")[0].trim()} | ${r.removedVerified}/${r.removedChecked} | ` +
    `${r.contextVerified}/${r.contextChecked} | ${r.addedLines} | ` +
    `${r.missing.length === 0 ? "EXACT FOR CURRENT TREE" : "DRIFT (" + r.missing.length + " missing)"} |\n`;
}
md += `\nEmpirical post-correction values were previously proven by \`l8-d13-26-fixture-verification.ts\` ` +
  `(MANDATE-005, Parts 1–5, JSON record beside it) — re-verifiable any cycle; zero source changes since.\n\n`;
md += `---\n\n`;
for (const { meta, body, result } of verifiedBlocks) {
  md += `## ${meta.id} — ${meta.label}\n\n`;
  md += `**Authoritative source:** ${meta.source}\n\n`;
  md += `**Anchor (current tree):** ${meta.anchor}\n\n`;
  md += `**Correction direction / no-weakening note:** ${meta.direction}\n\n`;
  md += `**Removed/context lines verified against the current tree: ${result.removedVerified}/${result.removedChecked} ` +
    `removed · ${result.contextVerified}/${result.contextChecked} context.**\n\n`;
  md += `**Proposed diff (VERBATIM from d13.26-layer8-evidence-pack.md; NOT APPLIED):**\n\n\`\`\`diff\n`;
  md += body.join("\n");
  md += `\n\`\`\`\n\n---\n\n`;
}
md += `## Post-approval procedure (MANDATE-007 §5)\n\n`;
md += `1. Owner/validator review of the six blocks above (D-13.26 gate; do-not-weaken table in the pack §11).\n`;
md += `2. On approval: apply the re-pins to \`canonical-invariants.ts\`, then run the focused Layer-8 suite and the ` +
  `complete applicable canonical suite (L1–6+8); expected per the pack: Layer 8 91→94 assertions, suite 250→253, ` +
  `0 fail. Any unexpected failure stops the gate and is reported honestly.\n`;
md += `3. Without approval: the tree verdict stays FAIL (237/243) and this artifact records exactly why.\n\n`;
md += `**Open items carried (unchanged):** OD-2 (ε $10 vs 1% benefit-margin — neither operative); β₁/β₂ Risk-Council ` +
  `publication (§11.10); §12.7 gas basis is a recorded accounting estimate (Appendix-F P0-3). Passing any corrected ` +
  `assertion is code-quality evidence only — not economic, legal, security, or release approval.\n`;
fs.writeFileSync(outMdPath, md);

const json = {
  generated: now,
  purpose: "MANDATE-007 §5 — exact proposed diffs for the six Layer-8 canonical failures, presented for D-13.26 owner/validator review",
  applied: false,
  pack: "audit-work/task13/d13.26-layer8-evidence-pack.md",
  canonicalFile: "src/lib/mtq/__tests__/canonical-invariants.ts",
  freshRunsThisCycle: {
    focusedLayer8: { pass: 85, fail: 6, exit: 1, log: "audit-work/task13/evidence/l8-focused-mandate007-2026-10-22.txt" },
    fullSuiteLayers_1_6_8: { pass: 237, fail: 6, exit: 1, log: "audit-work/task13/evidence/l-deterministic-mandate007-2026-10-22.txt" },
  },
  blocks: results,
  allExactForCurrentTree: allOk,
};
fs.writeFileSync(outJsonPath, JSON.stringify(json, null, 2) + "\n");

console.log(`\nArtifacts written:\n  ${outMdPath}\n  ${outJsonPath}`);
process.exit(allOk ? 0 : 1);
