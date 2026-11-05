/**
 * MTQΣ devnet oracle E2E feed — keeps fresh validator-signed observations
 * flowing while the browser E2E verifies the NOC oracle panel's live states.
 *
 * HONEST LABELING: this signs with the DETERMINISTIC public-seed devnet
 * validator keys (INSECURE-BY-DESIGN, config/chain-genesis.json — the
 * documented reference-devnet key model) via the node-held signAndSubmit
 * helper (the smoke battery's pattern). Values are operator-submitted TEST
 * VALUES, not market data — exactly what the on-panel honest disclosure says.
 *
 * Feed composition per round (every ~5 s):
 *   val-0 → XAU/USD family "chainlink-mirror"  3,940.00
 *   val-1 → XAU/USD family "pyth-mirror"       3,945.00   → 2 families, ~13 bp spread → PUBLISHED (median 3940)
 *   val-3 → EUR/USD family "frankfurter-mirror" 1,085.00  → SINGLE family → gate closed (STALE, never publishes)
 */
import { ensureChainNode, signAndSubmit } from "@/lib/chain/node";
import * as store from "@/lib/chain/store";

const ROUNDS = Number(process.argv[2] ?? 18); // default ~90 s at 5 s/round
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function nextNonce(addr: string): Promise<number> {
  return (await store.getAccount(addr)).nonce + 1;
}

const rt = await ensureChainNode();
const v0 = rt.genesis.validators[0].address;
const v1 = rt.genesis.validators[1].address;
const v3 = rt.genesis.validators[3].address;

for (let i = 0; i < ROUNDS; i++) {
  const r1 = await signAndSubmit("val-0", { type: "oracle_observe", from: v0, nonce: await nextNonce(v0), fee: 1000, payload: { symbol: "XAU/USD", family: "chainlink-mirror", value_u: 3_940_000_000 } });
  const r2 = await signAndSubmit("val-1", { type: "oracle_observe", from: v1, nonce: await nextNonce(v1), fee: 1000, payload: { symbol: "XAU/USD", family: "pyth-mirror", value_u: 3_945_000_000 } });
  const r3 = await signAndSubmit("val-3", { type: "oracle_observe", from: v3, nonce: await nextNonce(v3), fee: 1000, payload: { symbol: "EUR/USD", family: "frankfurter-mirror", value_u: 1_085_000_000 } });
  if (!r1.ok || !r2.ok || !r3.ok) console.log(`[feed] round ${i}: submit issue — ${r1.error ?? ""} ${r2.error ?? ""} ${r3.error ?? ""}`);
  await sleep(5000);
}
await sleep(4000); // let the final aggregation land
const prices = await store.getOraclePrices();
console.log("[feed] final price states:", JSON.stringify(prices.map((p) => [p.symbol, p.status, p.value_u / 1e6, `${p.families}f`, `${p.spread_bp}bp`])));
rt.stop();
process.exit(0);
