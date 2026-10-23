// MTQΣ V3 standalone compile harness (solcjs standard-JSON).
// Replicates contracts/foundry.toml: solc >=0.8.20, optimizer enabled,
// runs = 200, via_ir = true — plus the EIP-170-relevant outputs.
//
// Usage: node compile-standard.mjs <path-to-MTQSigmaV3.sol> <label> [runs] [viaIR] [evmVersion]
//   e.g. node compile-standard.mjs ../MTQSigmaV3.sol v3 200 true shanghai
// Writes <label>-result.json next to this script and prints a size report.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const solc = require("solc");

const here = dirname(fileURLToPath(import.meta.url));
const [, , solPathArg, labelArg, runsArg, viaIRArg, evmArg] = process.argv;
const solPath = resolve(here, solPathArg || "../MTQSigmaV3.sol");
const label = labelArg || "v3";
const runs = parseInt(runsArg || "200", 10);
const viaIR = (viaIRArg || "true") === "true";
const evmVersion = evmArg || "shanghai";

const source = readFileSync(solPath, "utf8");

const input = {
  language: "Solidity",
  sources: { "MTQSigmaV3.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs },
    viaIR,
    evmVersion,
    outputSelection: {
      "*": {
        "*": [
          "abi",
          "evm.bytecode.object",
          "evm.deployedBytecode.object",
          "evm.methodIdentifiers",
          "storageLayout",
        ],
        "": ["ast"],
      },
    },
  },
};

const raw = solc.compile(JSON.stringify(input));
const out = JSON.parse(raw);

const errs = out.errors || [];
const real = errs.filter((e) => e.severity === "error");
const warns = errs.filter((e) => e.severity === "warning");
console.log(`label=${label} runs=${runs} viaIR=${viaIR}`);
console.log(`solc errors: ${real.length}, warnings: ${warns.length}`);
for (const e of real) console.log("ERROR:", e.formattedMessage || e.message);
for (const e of warns) console.log("WARN:", (e.formattedMessage || e.message).split("\n")[0]);

const c = out.contracts?.["MTQSigmaV3.sol"]?.MTQSigmaV3;
if (!c) {
  console.log("NO CONTRACT OUTPUT (compile failed)");
  process.exit(1);
}
const creation = (c.evm.bytecode.object || "").length / 2;
const deployed = (c.evm.deployedBytecode.object || "").length / 2;
console.log(`creation bytecode:  ${creation} bytes`);
console.log(`deployed runtime:  ${deployed} bytes  (EIP-170 limit 24576, ${deployed <= 24576 ? "WITHIN" : "EXCEEDS by " + (deployed - 24576)})`);

writeFileSync(
  resolve(here, `${label}-result.json`),
  JSON.stringify({
    label,
    runs,
    viaIR,
    sourcePath: solPath,
    solcVersion: solc.version(),
    errors: errs,
    creationBytes: creation,
    deployedBytes: deployed,
    abi: c.abi,
    methodIdentifiers: c.evm.methodIdentifiers,
    storageLayout: c.storageLayout,
  }, null, 2)
);
console.log(`wrote ${label}-result.json`);
