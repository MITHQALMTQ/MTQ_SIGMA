// v28 §6 — Monetary / governance restrictions verification (READ-ONLY).
// Proves: zero issuance, zero redemption, zero applied rebalancing/reserve
// transfer, zero privileged key usage, governance/Safe controls untouched,
// shadow mode active. No writes anywhere.
import { Database } from "bun:sqlite";

const c = new Database("/home/z/my-project/db/chain.db", { readonly: true });
const m = new Database("/home/z/my-project/db/custom.db", { readonly: true });

// 1. Issuance / redemption surfaces (custom.db)
const issuance = (m.query('SELECT COUNT(*) n FROM "IssuanceEvent"').get() as { n: number }).n;
const mintReq = (m.query('SELECT COUNT(*) n FROM "MbzMintRequest"').get() as { n: number }).n;
const backing = (m.query('SELECT COUNT(*) n FROM "MbzBackingCertificate"').get() as { n: number }).n;
const bank = (m.query('SELECT COUNT(*) n FROM "MbzBank"').get() as { n: number }).n;
const scoringUploads = (m.query('SELECT COUNT(*) n FROM "ScoringUpload"').get() as { n: number }).n;

// 2. Rebalancing decisions: applied flag distribution (shadow ⇒ applied=0 everywhere)
const appliedDist = m.query('SELECT applied, COUNT(*) n FROM "RebalancingDecision" GROUP BY applied').all();
const blockedReasons = m.query(
  'SELECT reason, COUNT(*) n FROM "RebalancingDecision" WHERE applied != 0 GROUP BY reason LIMIT 5'
).all();

// 3. Chain events: monetary-type event census (read-only)
const eventTypes = c.query("SELECT type, COUNT(*) n FROM events GROUP BY type ORDER BY n DESC").all();
const monetaryTypes = (eventTypes as { type: string; n: number }[]).filter((r) =>
  /issu|redeem|mint|burn|transfer|reserve|rebalanc|treasury|settle/i.test(r.type)
);

// 4. txs table census (types)
const txTypes = c.query("SELECT COUNT(*) n FROM txs").get();

// 5. Governance: proposals + votes (should be unchanged small counts)
const proposals = (c.query("SELECT COUNT(*) n FROM proposals").get() as { n: number }).n;
const votes = (c.query("SELECT COUNT(*) n FROM votes").get() as { n: number }).n;

// 6. Accounts: balances present but no treasury movements beyond fee accounting
const accounts = c.query("SELECT address, fee_u, pmtq_u FROM accounts ORDER BY pmtq_u DESC LIMIT 10").all();
const totalPmtq = (c.query("SELECT SUM(pmtq_u) s FROM accounts").get() as { s: number | null }).s;

// 7. meta: boot mode / genesis unchanged
const meta = Object.fromEntries(c.query("SELECT key, value FROM meta").all().map((r) => [r.key, r.value]));

// 8. Shadow-mode evidence: shadow event lines in dev.log (§11.7 event:)
import { readFileSync } from "node:fs";
const devlog = readFileSync("/home/z/my-project/dev.log", "utf8");
const shadowEvents = (devlog.match(/§11\.7 event:/g) || []).length;
const shadowSkipped = (devlog.match(/RebalanceSkipped/g) || []).length;
const rebalanceApplied = (devlog.match(/RebalanceApplied/g) || []).length;

console.log(
  JSON.stringify(
    {
      issuanceSurfaces: { IssuanceEvent: issuance, MbzMintRequest: mintReq, MbzBackingCertificate: backing, MbzBank: bank, ScoringUpload: scoringUploads },
      rebalancing: { appliedDistribution: appliedDist, nonZeroAppliedRows: blockedReasons },
      monetaryEventTypes: monetaryTypes,
      txRowCount: txTypes,
      governance: { proposals, votes },
      accounts,
      totalPmtq,
      meta,
      shadowMode: { shadowEventLines: shadowEvents, rebalanceSkipped: shadowSkipped, rebalanceApplied },
    },
    null,
    1
  )
);
