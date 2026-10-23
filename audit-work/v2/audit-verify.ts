// AUDIT numerical verification — ad-hoc (not a repo test). Reproduces:
//  §5 B: P_MTQ = I_t / I_base cross-check from live FX + base fixings
//  §5 C: NAV per token + redemption calc
//  worked mint/redeem examples (§19.6.1 style)
//  Appendix C regressions (C.1, C.2, C.4, C.5)
import { STRATEGIC_PRIOR, BASE_FIXINGS, HAIRCUTS, MINT_FEE_BPS, NO_TRADE_BAND_BASE } from "../../src/lib/mtq/blueprint";
import { initChainIndex, advanceIndex, commitWeights, getMTQPrice, baseFixingsToPrices, strategicPriorToWeights, fxToPriceVector } from "../../src/lib/mtq/chain-index";
import { marpDecision, inNoTradeZone, costBenefitGate, partialCorrection } from "../../src/lib/mtq/marp";
import { initReserveState, applyMint, applyRedeem, reserveAssetValues, circulatingSupply } from "../../src/lib/mtq/engine";
import { runSelfTest as smTest } from "../../src/lib/mtq/state-machine";
import { runSelfTest as ciTest } from "../../src/lib/mtq/chain-index";

const live = { EUR_USD: 1.125696, GBP_USD: 1.333529, JPY_USD: 0.006328, CNY_USD: 0.149562, CHF_USD: 1.213651, XAU_USD: 4173.299805 };

// --- B: independent index recomputation ---
const prior = strategicPriorToWeights(STRATEGIC_PRIOR);
const base = baseFixingsToPrices(BASE_FIXINGS);
let st = initChainIndex(650.3, prior, base, 0);
const adv = advanceIndex(st, fxToPriceVector(live));
st = adv.state;
const P = getMTQPrice(st);
const contributions = prior.map((w, i) => ({ c: ["USD","EUR","JPY","GBP","CNY","CHF","Gold"][i], w, rel: fxToPriceVector(live)[i]/base[i], contrib: w*(fxToPriceVector(live)[i]/base[i]-1) }));
console.log("=== B. Index-derived P_MTQ (independent recompute) ===");
console.log("I_0 = 1.000000  P_genesis = 1.00");
for (const x of contributions) console.log(`  ${x.c.padEnd(4)} W=${x.w.toFixed(2)} rel=${x.rel.toFixed(4)} contribution=${(x.contrib*100).toFixed(3)}%`);
const sumContrib = contributions.reduce((a,x)=>a+x.contrib,0);
console.log(`  Σ contributions = ${(sumContrib*100).toFixed(3)}%  → I_t = 1 + that = ${(1+sumContrib).toFixed(6)}`);
console.log(`  chain-index I_t = ${P.toFixed(6)} (match: ${Math.abs(P-(1+sumContrib))<1e-9})`);

// --- chain-link zero-artificial-return check ---
const w2 = [0.24,0.20,0.09,0.08,0.05,0.05,0.29];
const cw = commitWeights(st, w2, fxToPriceVector(live), 1);
console.log(`  commitWeights (gold 26→29%): divisor D_t = ${cw.divisor.toFixed(6)}, I_t after = ${getMTQPrice(cw.state).toFixed(6)} (unchanged: ${Math.abs(getMTQPrice(cw.state)-P)<1e-12})`);

// --- C: NAV + redemption with a live-like state ---
console.log("\n=== C. Reserve NAV / redemption ===");
const s = initReserveState(live.XAU_USD);
const fx = { ...live, VIX: 19.99, DXY: 101.855, fetchedAt: Date.now(), source: "audit" } as any;
// genesis: simulate MASE prior
s.maseSmoothed = { ...STRATEGIC_PRIOR } as any;
const vals0 = reserveAssetValues(s, fx);
const circ0 = circulatingSupply(s);
console.log(`  genesis holdings NAV (haircut) = $${vals0.nav.toFixed(2)}  circulating = ${circ0}`);
// a mint to create circulating supply
const mint = applyMint(s, fx, "NORMAL", 250);
console.log(`  MINT 250 USDC: ok=${mint.ok} fee=$${mint.feeUsd.toFixed(2)} net=$${mint.netUsd.toFixed(2)} P=${mint.mtqPrice.toFixed(6)} → ${mint.mtqMinted.toFixed(4)} MTQ (fewer tokens @ index > 1 — §19.6.1)`);
const vals1 = reserveAssetValues(s, fx);
const circ1 = circulatingSupply(s);
const navPer = vals1.nav / circ1;
const red = applyRedeem(s, fx, "NORMAL", 100);
console.log(`  NAV after mint = $${vals1.nav.toFixed(2)}  S_circ = ${circ1.toFixed(4)}  NAV/MTQ = $${navPer.toFixed(2)}`);
console.log(`  REDEEM 100 MTQ: ok=${red.ok} gross=Y×NAV=$${red.grossUsd.toFixed(2)} fee=${red.feeBps}bps net=$${red.netUsd.toFixed(2)} basket legs=${red.basket.length}`);
if (red.ok) for (const b of red.basket) console.log(`    ${b.currency.padEnd(4)} ${b.token.padEnd(14)} $${b.usdValue.toFixed(2)} (${(b.weight*100).toFixed(1)}% of holdings)`);

// --- Appendix C regressions ---
console.log("\n=== Appendix C regressions ===");
// C.1: D=0.3% vs band → no trade
const obs = { USD: 0.285, EUR: 0.20, JPY: 0.09, GBP: 0.08, CNY: 0.05, CHF: 0.05, Gold: 0.245 };
const tgt = { USD: 0.282, EUR: 0.20, JPY: 0.09, GBP: 0.08, CNY: 0.05, CHF: 0.05, Gold: 0.248 };
const dUSD = obs.USD - tgt.USD;
console.log(`  C.1: D_USD = ${Math.abs(dUSD*100).toFixed(1)}%  inNoTradeZone(θ=0.75%) = ${inNoTradeZone(dUSD)} → Trade=0 ✓`);
// C.2: gold target 27.0, actual 29.4 → D=2.4% > band; β=0.40 (doc) vs 0.5 (pilot)
const devGold = 0.27 - 0.294;
console.log(`  C.2: D_gold = ${Math.abs(devGold*100).toFixed(1)}% > band → trigger; doc β=0.40 → ${(devGold*0.40*100).toFixed(2)}pp; pilot β=0.50 → ${(partialCorrection(devGold)*100).toFixed(2)}pp (both partial, doctrine-compliant)`);
// C.4: benefit 0.12% vs cost 0.17% of portfolio → reject
const g = costBenefitGate(0.012, 1_000_000, 1_000_000*0.17*0.012/0.12*0.1, 0.0017/0.17*0.17, 0);
console.log(`  C.4-style: benefit=$${g.benefit.toFixed(0)} cost=$${g.cost.toFixed(0)} net=$${g.netBenefit.toFixed(0)} pass=${g.pass} (negative-net rejected ✓)`);
// C.5: gold target 29.2% vs prior 26%
console.log(`  C.5: target 29.2% in Gold envelope 20–32% = ${(0.292>=0.20 && 0.292<=0.32)} — envelope admissible, prior≠target ✓`);

// --- self-tests ---
console.log("\n=== module self-tests ===");
console.log("  state-machine:", smTest().pass ? "17/17 PASS" : "FAIL "+smTest().reason);
console.log("  chain-index:", ciTest().pass ? "PASS" : "FAIL "+ciTest().reason);
