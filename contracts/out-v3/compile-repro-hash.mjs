// MTQΣ EVIDENCE TOOLING — reproducible compile + bytecode hashing (READ-ONLY).
// Purpose (Evidence Reconciliation Directive §2/§5): the committed out-v3
// artifacts record only byte COUNTS (creationBytes/deployedBytes) and omit
// evmVersion; this script re-compiles the same sources with byte-identical
// settings to contracts/out-v3/compile-standard.mjs (optimizer enabled,
// runs=200, viaIR=true, evmVersion=shanghai, solcjs 0.8.36) and additionally
// records keccak256 + sha256 of the creation and deployed (runtime) bytecode,
// closing the "runtime bytecode hash" gap in the Evidence Baseline Manifest.
//
// No keys, no network, no deployment. Pure local compilation evidence.
//
// Usage:
//   node compile-repro-hash.mjs <solPath> <contractName> <label> [runs] [viaIR] [evmVersion]
// Example:
//   node compile-repro-hash.mjs ../MTQSigmaV3.sol MTQSigmaV3 verifyindexbase-repro
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);
const solc = require("solc");
const { keccak256 } = require("ethers");

const here = dirname(fileURLToPath(import.meta.url));
const [, , solPathArg, nameArg, labelArg, runsArg, viaIRArg, evmArg] = process.argv;
const solPath = resolve(here, solPathArg);
const contractName = nameArg;
const label = labelArg;
const runs = parseInt(runsArg || "200", 10);
const viaIR = (viaIRArg || "true") === "true";
const evmVersion = evmArg || "shanghai";
const sourceBasename = solPath.split("/").pop();
const source = readFileSync(solPath, "utf8");

const input = {
  language: "Solidity",
  sources: { [sourceBasename]: { content: source } },
  settings: {
    optimizer: { enabled: true, runs },
    viaIR,
    evmVersion,
    outputSelection: {
      "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] },
    },
  },
};

console.log(`[compile-repro] ${label}: ${solPath} contract=${contractName} runs=${runs} viaIR=${viaIR} evmVersion=${evmVersion}`);
const t0 = Date.now();
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const ms = Date.now() - t0;
const errs = out.errors || [];
const realErrs = errs.filter((e) => e.severity === "error");
const sizeWarn = errs.find((e) => String(e.errorCode) === "5574");
console.log(`solc=${solc.version()} errors=${realErrs.length} warnings=${errs.length - realErrs.length} (${ms} ms)`);
for (const e of realErrs) console.log("ERROR:", (e.formattedMessage || e.message).split("\n")[0]);
if (sizeWarn) console.log("SIZE-WARN:", (sizeWarn.formattedMessage || sizeWarn.message).split("\n")[0]);

const c = out.contracts?.[sourceBasename]?.[contractName];
if (!c) {
  console.log("NO CONTRACT OUTPUT (compile failed)");
  process.exit(1);
}
// solc standard-JSON emits unprefixed hex; ethers keccak requires 0x — normalize.
// Sizes MUST be computed from the RAW hex (0x prefix would add a phantom byte).
const fix = (h) => (h && !h.startsWith("0x") ? "0x" + h : h || "0x");
const creationRaw = c.evm.bytecode.object || "";
const deployedRaw = c.evm.deployedBytecode.object || "";
const creationHex = fix(creationRaw);
const deployedHex = fix(deployedRaw);
const sha = (hex) => createHash("sha256").update(Buffer.from(hex.slice(2), "hex")).digest("hex");
const record = {
  label,
  purpose: "Evidence baseline repro — byte-identical settings to contracts/out-v3/compile-standard.mjs; adds bytecode hashes + evmVersion (missing from committed artifacts)",
  sourcePath: solPath,
  sourceSha256: createHash("sha256").update(source).digest("hex"),
  sourceLines: source.split("\n").length,
  contractName,
  settings: { optimizer: { enabled: true, runs }, viaIR, evmVersion },
  solcVersion: solc.version(),
  compileMs: ms,
  errors: errs.map((e) => ({ severity: e.severity, errorCode: e.errorCode ?? null, firstLine: (e.formattedMessage || e.message).split("\n")[0] })),
  creationBytes: creationRaw.length / 2,
  deployedBytes: deployedRaw.length / 2,
  eip170: { limit: 24576, within: deployedHex.length / 2 <= 24576, exceedsBy: Math.max(0, deployedHex.length / 2 - 24576) },
  hashes: {
    creationKeccak256: keccak256(creationHex),
    creationSha256: sha(creationHex),
    deployedKeccak256: keccak256(deployedHex),
    deployedSha256: sha(deployedHex),
  },
};
console.log(`creation bytecode:  ${record.creationBytes} bytes`);
console.log(`deployed runtime:  ${record.deployedBytes} bytes  (EIP-170 limit 24576, ${record.eip170.within ? "WITHIN" : "EXCEEDS by " + record.eip170.exceedsBy})`);
console.log(`keccak256(deployed)= ${record.hashes.deployedKeccak256}`);
console.log(`sha256(deployed)   = ${record.hashes.deployedSha256}`);

const outDir = resolve(here, "../../audit-work/v6");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, `compile-repro-${label}.json`);
writeFileSync(outPath, JSON.stringify(record, null, 2));
console.log(`wrote ${outPath}`);
