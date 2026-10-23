import { costBenefitGate } from "../../src/lib/mtq/marp";
// Appendix C.4 exact: B = 0.12% of portfolio ($1,200 on $1M) vs C = 0.17% ($1,700).
// costBenefitGate: benefit = |dev|·nav·λ₁(0.4); to realize B=$1,200 → dev = 0.003.
// cost = tradeUsd·slippage + gas = $1,700 → tradeUsd = $1M, slippage = 0.0017.
const g = costBenefitGate(0.003, 1_000_000, 1_000_000, 0.0017, 0);
console.log(`C.4 exact: benefit=$${g.benefit.toFixed(0)} cost=$${g.cost.toFixed(0)} net=$${g.netBenefit.toFixed(0)} pass=${g.pass} → ${g.pass ? "TRADE" : "Trade=0 (rejected — negative net benefit ✓)"}`);
// And a doc-favorable case: B=$2,400 (dev 0.006) vs C=$1,700 → pass
const g2 = costBenefitGate(0.006, 1_000_000, 1_000_000, 0.0017, 0);
console.log(`C.4 mirror: benefit=$${g2.benefit.toFixed(0)} cost=$${g2.cost.toFixed(0)} net=$${g2.netBenefit.toFixed(0)} pass=${g2.pass} → ${g2.pass ? "TRADE (net > ε=$10 ✓)" : "rejected"}`);
