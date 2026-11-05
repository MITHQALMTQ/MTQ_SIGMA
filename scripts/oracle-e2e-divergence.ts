/**
 * MTQΣ devnet oracle divergence seed — one-shot: val-2 submits XAU/USD
 * family "chronicle-mirror" at 4,800.00 (far off the fed 3,940/3,945 pair).
 * With the pair still fresh, aggregation sees 3 families → cross-family
 * spread ~2,183 bp > 200 bp → DEGRADED_SPREAD, published value RETAINED
 * (fail-closed). Used by the browser E2E to verify the degraded UI state.
 * Same honest labeling as oracle-e2e-feed.ts.
 */
import { ensureChainNode, signAndSubmit } from "@/lib/chain/node";
import * as store from "@/lib/chain/store";

const rt = await ensureChainNode();
const v2 = rt.genesis.validators[2].address;
const nonce = (await store.getAccount(v2)).nonce + 1;
const r = await signAndSubmit("val-2", { type: "oracle_observe", from: v2, nonce, fee: 1000, payload: { symbol: "XAU/USD", family: "chronicle-mirror", value_u: 4_800_000_000 } });
console.log("[divergence] submit:", r.ok ? "OK" : r.error);
await new Promise((res) => setTimeout(res, 4000));
const xau = (await store.getOraclePrices()).find((p) => p.symbol === "XAU/USD");
console.log("[divergence] XAU/USD:", xau?.status, (xau?.value_u ?? 0) / 1e6, `${xau?.families}f`, `${xau?.spread_bp}bp`);
rt.stop();
process.exit(0);
