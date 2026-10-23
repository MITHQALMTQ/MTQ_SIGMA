// ============================================================================
// MTQΣ — Dynamic currency-constituency engine — bp weight helpers (spec §5.3)
// ============================================================================
// Provenance: port of audit-work/task13/evidence/dynamic-replacement/
//   constituency-lifecycle.ts:476-527 (validated prototype — DR-04/DR-05/DR-15
//   prove exclusion-zero and exact-sum on every commit of the 20-period
//   demonstration).
//
// Rule (spec §5.3 — D-13.14 UNAPPROVED): largest-remainder rounding to the bp
//   quantum with ties broken by ASCENDING LEXICOGRAPHIC order of the STABLE
//   component ID (the bytes3 analog per spec §5.3; the registry uses stable
//   string IDs). Result: the committed integer vector sums to exactly 10000 bp
//   (1e18 on-chain), within the declared float tolerance 1e-9. Deterministic:
//   identical inputs ⇒ identical vector — the only ordering input is the ID
//   itself, which is stable across registry versions.
// ============================================================================

/** Total committed mass in basis points (bp quantum = 1e-4 per spec §5.3). */
export const TOTAL_BP = 10000;

/** Largest-remainder rounding to bp with ascending-lexicographic-ID tie-break
 *  (spec §5.3). Excluded/zero components (raw 0 → floor 0, remainder 0) can
 *  never receive a residual unit while any component has a positive remainder,
 *  so the EXCLUSION-ZERO guarantee (spec §5.4: excluded ⇒ exactly 0 bp, no
 *  positive floor ever) survives rounding exactly.
 *  Prototype: constituency-lifecycle.ts:483-512. */
export function roundToBp(rawWeights: Record<string, number>): Record<string, number> {
  const ids = Object.keys(rawWeights).sort();
  const floors: Record<string, number> = {};
  const fracs: Array<{ id: string; frac: number }> = [];
  let floorSum = 0;
  for (const id of ids) {
    const w = rawWeights[id];
    if (!(w >= 0)) throw new Error(`roundToBp: negative raw weight ${w} for ${id}`);
    const fl = Math.floor(w);
    floors[id] = fl;
    floorSum += fl;
    fracs.push({ id, frac: w - fl });
  }
  let residual = TOTAL_BP - floorSum;
  if (residual < 0) {
    // Redistribute the over-floor case deterministically by remainder rank.
    let over = -residual;
    const bySmallest = [...fracs].sort((a, b) => a.frac - b.frac || (a.id < b.id ? -1 : 1));
    for (const f of bySmallest) {
      if (over <= 0) break;
      const take = Math.min(over, floors[f.id]);
      floors[f.id] -= take;
      over -= take;
    }
    residual = 0;
  }
  fracs.sort((a, b) => b.frac - a.frac || (a.id < b.id ? -1 : 1));
  for (let i = 0; i < residual; i++) floors[fracs[i].id] += 1;
  return floors;
}

/** Sum of a string-keyed number record. Prototype: constituency-lifecycle.ts:514-518. */
export function sumRecord(rec: Record<string, number>): number {
  let s = 0;
  for (const k of Object.keys(rec)) s += rec[k];
  return s;
}

/** HHI concentration of a bp weight vector (spec §5.2 aggregate cap —
 *  evaluated on the whole ACTIVE vector after projection; draft cap in
 *  parameters.ts HHI_CAP_DRAFT, D-13.14 UNAPPROVED).
 *  Prototype: constituency-lifecycle.ts:520-527. */
export function hhiOf(weightsBp: Record<string, number>): number {
  let h = 0;
  for (const k of Object.keys(weightsBp)) {
    const w = weightsBp[k] / TOTAL_BP;
    h += w * w;
  }
  return h;
}
