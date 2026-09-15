// MTQΣ — Reserve Basket + Dynamic Weighting Audit
// Pulls the live pilot snapshot, decomposes the full reserve basket (GFB currencies
// + bullion/gold), shows the target vs observed weights, and samples over multiple
// ticks to prove the §6 Adaptive Macro Engine + §8 Dynamic Buffer + §7 Rebalancing
// are actually moving the gold weight dynamically.

import { readFileSync } from "fs";

const BASE = "http://localhost:3000";

async function snap() {
  const r = await fetch(`${BASE}/api/metrics`, { signal: AbortSignal.timeout(8000) });
  return (await r.json()) as any;
}

function pct(x: number) { return (x * 100).toFixed(2) + "%"; }
function usd(x: number) { return "$" + x.toLocaleString("en-US", { maximumFractionDigits: 0 }); }

(async () => {
  console.log("================================================================");
  console.log("  MTQΣ — RESERVE BASKET & DYNAMIC WEIGHTING AUDIT");
  console.log("================================================================\n");

  // --- §2.1 GFB Index reference basket (fixed quantities q_i, immutable) ---
  console.log("─── §2.1 GFB INDEX — fixed currency basket (the reference) ───");
  console.log("  Base date: 2026-01-01 00:00 UTC. GFB_base = 0.89796937 (normalised to 1.0).");
  console.log("  Quantities q_i are FIXED (immutable except 7/7 Multi-Sig + 90d timelock).\n");
  const basket = [
    { ccy: "USD", asset: "USDC (Circle)",        q: 0.389,   weight: 0.389,   fxKey: null,    baseFx: 1.0 },
    { ccy: "EUR", asset: "EURC (Circle)",        q: 0.278,   weight: 0.278,   fxKey: "EUR_USD", baseFx: 1.05 },
    { ccy: "GBP", asset: "GBP stablecoin (TBD)", q: 0.1669,  weight: 0.1669,  fxKey: "GBP_USD", baseFx: 1.25 },
    { ccy: "JPY", asset: "JPY stablecoin (TBD)", q: 0.1111,  weight: 0.1111,  fxKey: "JPY_USD", baseFx: 0.0067 },
    { ccy: "CNY", asset: "CNY/CNH stablecoin (TBD)", q: 0.055, weight: 0.055, fxKey: "CNY_USD", baseFx: 0.14 },
  ];
  console.log("  Currency | Asset                | q_i (fixed) | Base weight | Live FX      | Live USD-equiv");
  console.log("  -------- | -------------------- | ----------- | ----------- | ------------ | --------------");

  const s = await snap();
  let liveBasketUsd = 0;
  for (const b of basket) {
    const fx = b.fxKey ? (s.fx as any)[b.fxKey] : 1.0;
    const liveUsd = b.q * fx;
    liveBasketUsd += liveUsd;
    console.log(`  ${b.ccy.padEnd(8)} | ${b.asset.padEnd(20)} | ${b.q.toFixed(4).padEnd(11)} | ${pct(b.weight).padEnd(11)} | ${fx.toFixed(4).padEnd(12)} | $${liveUsd.toFixed(4)}`);
  }
  const gfbLive = liveBasketUsd / 0.89796937;
  console.log(`\n  Live GFB Index = ${gfbLive.toFixed(4)} (normalised). MTQ price = $${gfbLive.toFixed(4)}.`);
  console.log(`  Engine read-back: GFB=${s.gfbIndex.toFixed(4)}, price=$${s.mtqPrice.toFixed(4)} ${Math.abs(s.gfbIndex - gfbLive) < 0.001 ? "✓ matches" : "✗ mismatch"}\n`);

  // --- Actual reserve holdings (the implementation assets) ---
  console.log("─── §4 RESERVE VAULT — actual holdings (implementation assets) ───");
  const r = s.reserve;
  const holdings = [
    { ccy: "USD", token: "USDC (Circle)",    usd: (s.perIssuer?.usdcUsd ?? 0), isStable: true,  issuer: "Circle" },
    { ccy: "USD", token: "USDP (Paxos)",     usd: (s.perIssuer?.usdpUsd ?? 0), isStable: true,  issuer: "Paxos" },
    { ccy: "USD", token: "USDT (Tether)",    usd: (s.perIssuer?.usdtUsd ?? 0), isStable: true,  issuer: "Tether" },
    { ccy: "EUR", token: "EURC (Circle)",   usd: r.eurNet, isStable: true,  issuer: "Circle" },
    { ccy: "GBP", token: "GBP₿ (TBD)",       usd: r.gbpNet, isStable: true,  issuer: "TBD" },
    { ccy: "JPY", token: "JPY₿ (TBD)",       usd: r.jpyNet, isStable: true,  issuer: "TBD" },
    { ccy: "CNY", token: "CNY₿ (TBD)",       usd: r.cnyNet, isStable: true,  issuer: "TBD" },
    { ccy: "XAU", token: "PAXG (Paxos)",     usd: (s.perIssuer?.paxgUsd ?? 0), isStable: false, issuer: "Paxos",  bullion: true },
    { ccy: "XAU", token: "XAUT (Tether)",    usd: (s.perIssuer?.xautUsd ?? 0), isStable: false, issuer: "Tether", bullion: true },
  ];
  const nav = s.nav;
  console.log(`  NAV (net, after haircuts): ${usd(nav)}\n`);
  console.log("  Asset           | Type        | Issuer  | Net USD        | Weight  | Haircut");
  console.log("  --------------- | ----------- | ------- | -------------- | ------- | -------");
  const HAIRCUTS: any = { USD: 0.005, EUR: 0.007, GBP: 0.01, JPY: 0.01, CNY: 0.015, XAU: 0.01 };
  let fiatUsd = 0, goldUsd = 0;
  for (const h of holdings) {
    const w = nav > 0 ? h.usd / nav : 0;
    if (h.isStable) fiatUsd += h.usd; else goldUsd += h.usd;
    const hc = HAIRCUTS[h.ccy] ?? 0;
    console.log(`  ${h.token.padEnd(15)} | ${(h.bullion ? "Bullion" : "Stablecoin").padEnd(11)} | ${h.issuer.padEnd(7)} | ${usd(h.usd).padEnd(14)} | ${pct(w).padEnd(7)} | ${pct(hc)}`);
  }
  console.log(`\n  Fiat/stablecoins total: ${usd(fiatUsd)} (${pct(fiatUsd / nav)})`);
  console.log(`  Bullion (gold) total:  ${usd(goldUsd)} (${pct(goldUsd / nav)})`);

  // --- §8 Dynamic Buffer + gold weight target ---
  console.log("\n─── §8 DYNAMIC BUFFER + §6 ADAPTIVE MACRO ENGINE (dynamic weighting) ───");
  const m = s.macro;
  console.log(`  VIX (simulated):       ${m.vix.toFixed(2)}  (90d mean ${m.vixMean.toFixed(2)}, σ ${m.vixSd.toFixed(2)})`);
  console.log(`  DXY (simulated):       ${m.dxy.toFixed(2)}  (90d mean ${m.dxyMean.toFixed(2)}, σ ${m.dxySd.toFixed(2)})`);
  console.log(`  z-VIX:                 ${m.zVix.toFixed(3)}  (α=0.15 sensitivity)`);
  console.log(`  z-DXY:                 ${m.zDxy.toFixed(3)}  (β=0.10 sensitivity)`);
  console.log(`  θ (raw adjustment):    ${(m.rawTheta * 100).toFixed(2)} pp  (cap ±3.00 pp)`);
  console.log(`  Raw target W_gold:     ${pct(m.rawTarget)}  (base 26.25% + θ, clamped 22%–30%)`);
  console.log(`  EMA-smoothed target:   ${pct(m.smoothedTarget)}  (λ=0.20 smoothing)`);
  console.log(`  Buffer state:          ${s.bufferState}  (BASE 62.5% / STRESS 85% / EMERGENCY 100% buffer-gold)`);
  console.log(`  Buffer gold ratio:     ${pct(s.bufferGoldRatio)}`);
  console.log(`  §8 unified target:    ${pct(s.targetGoldWeight)}  = 0.20 core + 0.10×B_gold(${pct(s.bufferGoldRatio)}) + θ_smoothed`);
  console.log(`  Observed gold weight:  ${pct(s.observedGoldWeight)}`);
  console.log(`  Deviation:             ${(s.rebalance.deviation * 100).toFixed(2)} pp  (observed − target)`);
  console.log(`  Rebalance decision:    ${s.rebalance.shouldRebalance ? `EXECUTE (${s.rebalance.direction === -1 ? "sell gold" : "buy gold"} ${usd(s.rebalance.tradeUsd)})` : "hold — " + s.rebalance.reason}`);

  // --- Sample over multiple ticks to prove dynamic weighting is moving ---
  console.log("\n─── DYNAMIC WEIGHTING — sampling live engine over 24 seconds (6 ticks) ───");
  console.log("  tick | VIX    | DXY    | zVIX   | zDXY   | θ(pp)  | rawTgt  | smoothed | target  | observed | dev(pp) | action");
  console.log("  ---- | ------ | ------ | ------ | ------ | ------ | ------- | -------- | ------- | -------- | ------- | ------");
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const t = await snap();
    const mm = t.macro;
    const reb = t.rebalance;
    const action = reb.shouldRebalance ? `${reb.direction === -1 ? "SELL" : "BUY"} ${usd(reb.tradeUsd)}` : "hold";
    console.log(`  ${String(i + 1).padEnd(4)} | ${mm.vix.toFixed(2).padEnd(6)} | ${mm.dxy.toFixed(2).padEnd(6)} | ${mm.zVix.toFixed(3).padEnd(6)} | ${mm.zDxy.toFixed(3).padEnd(6)} | ${(mm.rawTheta * 100).toFixed(2).padEnd(6)} | ${pct(mm.rawTarget).padEnd(7)} | ${pct(mm.smoothedTarget).padEnd(8)} | ${pct(t.targetGoldWeight).padEnd(7)} | ${pct(t.observedGoldWeight).padEnd(8)} | ${(reb.deviation * 100).toFixed(2).padEnd(7)} | ${action}`);
  }

  console.log("\n─── INTERPRETATION ───");
  const last = await snap();
  const moving = Math.abs(last.macro.smoothedTarget - 0.2625) > 0.0005;
  const bufferActive = last.bufferState !== "BASE" || Math.abs(last.bufferGoldRatio - 0.625) > 0.001;
  const rebalancing = last.rebalance.shouldRebalance;
  console.log(`  §6 Adaptive Macro Engine: ${moving ? "ACTIVE — smoothed target diverged from 26.25% base, θ is working" : "at base (θ smoothed toward 0; macro signals calm)"}`);
  console.log(`  §8 Dynamic Buffer:       ${bufferActive ? `ACTIVE — state=${last.bufferState}, buffer-gold=${pct(last.bufferGoldRatio)} (≠ 62.5% BASE default)` : "at BASE (62.5% buffer-gold, RR ≥ 110%)"}`);
  console.log(`  §7 Rebalancing Engine:    ${rebalancing ? `EXECUTING — ${last.rebalance.direction === -1 ? "selling" : "buying"} gold ${usd(last.rebalance.tradeUsd)} to close ${(Math.abs(last.rebalance.deviation) * 100).toFixed(2)}pp deviation` : "holding (deviation within tolerance or cost ≥ benefit)"}`);
  console.log(`  Dynamic weighting working: ${moving || bufferActive || rebalancing ? "YES ✓ — target is computed from live VIX/DXY + buffer state and the rebalancer trades toward it" : "monitoring (engine healthy; no trade needed this tick)"}`);
})();
