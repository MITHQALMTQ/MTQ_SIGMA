// Fix-C verification probe (Task 16-fix-C) — evidence for fix-c-verification.md.
// READ-ONLY against the live DB (SELECTs); writes only to a THROWAWAY /tmp
// SQLite file for the raw-driver round-trip test. Does NOT import pilot-state
// (no tick loop is started by importing audit-trail.ts — it imports only
// @/lib/db [Prisma client construction], type-only engine/oracle imports, and
// node:crypto at module scope).
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { canonNum, canonicalJson } from "../../../src/lib/mtq/audit-trail";

const LIVE = "file:/home/z/my-project/db/custom.db";
const FIX_TS = Date.parse("2026-10-23T20:41:59Z");
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " · " + detail : ""}`);
};

// ---------------------------------------------------------------------------
// A. canonNum stability under the observed Prisma wire rounding (RT16)
// ---------------------------------------------------------------------------
// The audit live-proved the Prisma classic-engine wire protocol serializes
// Float64 to ~16 significant digits (API 1.1773827143799516 → stored
// 1.177382714379952). Model that hop exactly: RT16(v) = Number(v.toPrecision(16)).
const RT16 = (v: number) => Number(v.toPrecision(16));

// A1. the audit's two live-proof values must round-trip EXACTLY once canon'd
const liveProof = [1.1773827143799516, 1112794.8589673354];
for (const v of liveProof) {
  const c = canonNum(v);
  check(
    `canon stability on audit live-proof ${v}`,
    RT16(c) === c && canonNum(RT16(c)) === c,
    `canon=${c} RT16(canon)=${RT16(c)} (raw RT16 would give ${RT16(v)} ≠ ${v})`,
  );
}

// A2. 1,000,000 pseudo-random doubles across magnitudes: canon must be a
// fixed point of RT16 (write path) AND RT16∘canon must commute with canon
// (read path). This is the mathematical core of the 16d-001 fix.
{
  let bad = 0;
  let x = 123456789;
  const rnd = () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x;
  };
  for (let i = 0; i < 1_000_000; i++) {
    // spread mantissas across [1,10) and exponents across 1e-6..1e15
    const mant = 1 + (rnd() / 0x7fffffff) * 9;
    const exp = Math.floor((rnd() / 0x7fffffff) * 21) - 6;
    const v = mant * Math.pow(10, exp) * (rnd() % 2 ? 1 : -1);
    const c = canonNum(v);
    if (RT16(c) !== c) bad++;
  }
  check("canon(RT16-stability) over 1,000,000 random doubles", bad === 0, `${bad} violations`);
}

// A3. adversarial near-power-of-10 mantissas (9.999..., 1.000...1, etc.) —
// the region where 16-digit serialization is most lossy.
{
  let bad = 0, tested = 0;
  for (let k = -6; k <= 15; k++) {
    for (const base of [9.99999999999999, 9.999999999999999, 1.0000000000000002, 4.999999999999999, 5.000000000000001]) {
      const v = base * Math.pow(10, k);
      const c = canonNum(v);
      tested++;
      if (RT16(c) !== c) bad++;
    }
  }
  check("canon stability on adversarial near-power-of-10 mantissas", bad === 0, `${bad}/${tested} violations`);
}

// ---------------------------------------------------------------------------
// B. raw SQLite round-trip is bit-exact (so the verifier's raw reads see the
//    exact stored doubles; the lossy hop is only the Prisma wire, not SQLite)
// ---------------------------------------------------------------------------
{
  const tmp = `/tmp/fix-c-rt-${Date.now()}.db`;
  const c = createClient({ url: `file:${tmp}` });
  await c.execute("CREATE TABLE t (v REAL)");
  const samples = [canonNum(1.1773827143799516), canonNum(1112794.8589673354), canonNum(0.3535894101258974), canonNum(-848490511601428.5), 0, 1];
  for (const v of samples) await c.execute({ sql: "INSERT INTO t VALUES (?)", args: [v] });
  const back = (await c.execute("SELECT v FROM t")).rows.map((r) => Number(r.v));
  let bad = 0;
  samples.forEach((v, i) => { if (back[i] !== v) bad++; });
  check("raw @libsql SQLite REAL write→read bit-exact", bad === 0, `${bad}/${samples.length} mismatches`);
  c.close();
}

// ---------------------------------------------------------------------------
// C. writer-hash ↔ verifier-hash exact round trip for a synthetic canonical
//    row (in-memory exercise of the SAME functions the live writers use)
// ---------------------------------------------------------------------------
{
  const prevHash = "2bd45eb94bcd0c3833bf00000000000000000000000000000000000000000000";
  // raw in-memory doubles as the engine would produce them
  const rawPayload = {
    gfbIndex: 1.1771508483327588, mtqPrice: 1.1771508483327588, nav: 1113105.1843881213,
    rr: 0, lcr: 0, status: "NORMAL", circ: 34.849215790135524, bufferState: "BASE", tickCount: 42,
  };
  // canonicalize every numeric leaf (what the v2.1 writer now does)
  const canonPayload = {
    gfbIndex: canonNum(rawPayload.gfbIndex), mtqPrice: canonNum(rawPayload.mtqPrice),
    nav: canonNum(rawPayload.nav), rr: canonNum(rawPayload.rr), lcr: canonNum(rawPayload.lcr),
    status: rawPayload.status, circ: canonNum(rawPayload.circ), bufferState: rawPayload.bufferState,
    tickCount: rawPayload.tickCount,
  };
  const rowHash = createHash("sha256").update(prevHash).update(canonicalJson(canonPayload)).digest("hex");
  // simulate storage: every numeric leaf goes through the 16-digit wire…
  const stored = Object.fromEntries(
    Object.entries(canonPayload).map(([k, v]) => [k, typeof v === "number" ? RT16(v) : v]),
  );
  // …and the verifier recomputes canonically FROM STORED VALUES:
  const recomputed = createHash("sha256").update(prevHash).update(canonicalJson(stored)).digest("hex");
  check("writer-hash reproduces EXACTLY from stored (RT16'd) values", recomputed === rowHash,
    `rowHash=${rowHash.slice(0, 16)}… recomputed=${recomputed.slice(0, 16)}…`);
}

// ---------------------------------------------------------------------------
// D. live-DB chain state (read-only): MARP threading + no genesis resets +
//    per-row verify of the newest MARP batch rows with the canonical formula
// ---------------------------------------------------------------------------
{
  const c = createClient({ url: LIVE });
  const q = async (sql: string) => (await c.execute({ sql, args: [] })).rows;

  // D1. post-fix MARP rows are chained (non-NULL hashes, non-genesis prev)
  const marp = await q(
    `SELECT COUNT(*) n, SUM(CASE WHEN rowHash IS NULL THEN 1 ELSE 0 END) nullHash,
            SUM(CASE WHEN prevHash = '' OR prevHash IS NULL THEN 1 ELSE 0 END) genesisPrev
     FROM RebalancingDecision WHERE reason LIKE '[MARP:%' AND tickAt >= ${FIX_TS}`,
  );
  const n = Number(marp[0].n);
  check("post-fix MARP rows all chained", n > 0 && Number(marp[0].nullHash) === 0 && Number(marp[0].genesisPrev) === 0,
    `${n} rows, nullHash=${Number(marp[0].nullHash)}, genesisPrev=${Number(marp[0].genesisPrev)}`);

  // D2. zero genesis resets post-fix (was 193 resets pre-fix per audit 16-d)
  const resets = await q(`SELECT COUNT(*) n FROM RebalancingDecision WHERE tickAt >= ${FIX_TS} AND prevHash = ''`);
  check("zero RD genesis resets post-fix", Number(resets[0].n) === 0);
  const resetsDsv = await q(`SELECT COUNT(*) n FROM DailyStateVector WHERE tickAt >= ${FIX_TS} AND prevHash = ''`);
  check("zero DSV genesis resets post-fix", Number(resetsDsv[0].n) === 0);

  // D3. MARP batch: tickAt staggered + intra-batch sequential linkage
  const batch = await q(`SELECT tickAt, prevHash, rowHash FROM RebalancingDecision WHERE reason LIKE '[MARP:%' ORDER BY tickAt DESC LIMIT 7`);
  const ts = batch.map((r: any) => Number(r.tickAt));
  const staggered = new Set(ts).size === ts.length;
  let linked = true;
  for (let i = 0; i < batch.length - 1; i++) {
    if (String(batch[i].prevHash) !== String(batch[i + 1].rowHash)) linked = false;
  }
  check("MARP batch tickAt staggered (distinct ms)", staggered, ts.join(","));
  check("MARP batch intra-batch chain linkage (row k prev == row k-1 hash)", linked);

  // D4. verify one post-fix MARP row EXACTLY with the canonical formula,
  //     recomputing from its stored columns (raw driver = exact stored bits)
  const row: any = batch[0];
  const full: any = (await q(`SELECT * FROM RebalancingDecision WHERE rowHash = '${row.rowHash}'`))[0];
  const payload = {
    tickCount: Number(full.tickCount), navUsd: canonNum(Number(full.navUsd)),
    reserveRatio: canonNum(Number(full.reserveRatio)),
    observedGoldWeight: canonNum(Number(full.observedGoldWeight)),
    targetGoldWeight: canonNum(Number(full.targetGoldWeight)),
    deviationPct: canonNum(Number(full.deviationPct)), applied: Boolean(full.applied),
    shouldRebalance: Boolean(full.shouldRebalance), direction: Number(full.direction),
    tradeUsd: canonNum(Number(full.tradeUsd)), reason: String(full.reason),
  };
  const recomputed = createHash("sha256").update(String(full.prevHash)).update(canonicalJson(payload)).digest("hex");
  check("post-fix MARP row verifies EXACTLY (canonical, from stored values)",
    recomputed === String(full.rowHash),
    `rowHash=${String(full.rowHash).slice(0, 16)}… recomputed=${recomputed.slice(0, 16)}…`);

  // D5. every post-fix DSV row must verify exactly (independent of the lib
  //     verifier — recompute here from stored values)
  const dsv = await q(`SELECT prevHash, rowHash, gfbIndex, mtqPrice, navUsd, reserveRatio, lcr, status, circulatingSupply, bufferState, tickCount FROM DailyStateVector WHERE tickAt >= ${FIX_TS}`);
  let bad = 0;
  for (const r: any of dsv) {
    const h = createHash("sha256").update(String(r.prevHash ?? "")).update(canonicalJson({
      gfbIndex: canonNum(Number(r.gfbIndex)), mtqPrice: canonNum(Number(r.mtqPrice)),
      nav: canonNum(Number(r.navUsd)), rr: canonNum(Number(r.reserveRatio)),
      lcr: canonNum(Number(r.lcr)), status: String(r.status),
      circ: canonNum(Number(r.circulatingSupply)), bufferState: String(r.bufferState),
      tickCount: Number(r.tickCount),
    })).digest("hex");
    if (h !== String(r.rowHash)) bad++;
  }
  check("ALL post-fix DSV rows verify EXACTLY from stored values", bad === 0 && dsv.length > 0,
    `${dsv.length} rows, ${bad} mismatches`);

  c.close();
}

console.log(`\n=== fix-c canon proof: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail === 0 ? 0 : 1);
