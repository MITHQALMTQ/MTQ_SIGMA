// ============================================================================
// MTQΣ — Dynamic currency-constituency engine — deterministic serialization +
//        digests (§0)
// ============================================================================
// Provenance: port of audit-work/task13/evidence/dynamic-replacement/
//   constituency-lifecycle.ts:44-91, 398-404 (validated prototype; byte-
//   identical serialization is what makes the decision records reproducible —
//   MANDATE-007 §3 behavior 8 / DR-07).
//
// Digest encoding note (evidence hygiene): digests are base64url, never hex —
//   this repository's secret scanner treats bare 64-hex literals as
//   credential-shaped. No secret exists in any of these values.
//
// CLIENT-BUNDLE SAFETY: this module imports node:crypto and is therefore
//   SERVER/TEST-ONLY. It must never be imported (directly or transitively) from
//   a client component; the registry module (registry.ts) is deliberately kept
//   crypto-free for exactly that reason.
// ============================================================================

import { createHash } from "node:crypto";
import type { DecisionRecord } from "./types";

/** Canonical number string: integers verbatim; floats via toFixed(10) with
 *  trailing zeros trimmed (canonicalizes IEEE754 representation noise so two
 *  runs producing the same value always serialize byte-identically).
 *  Prototype: constituency-lifecycle.ts:48-58. */
function canonicalNumber(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`canonicalNumber: non-finite number ${n}`);
  if (Object.is(n, -0)) n = 0;
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  let s = n.toFixed(10);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

/** Deterministic serializer: object keys sorted ascending, arrays in order,
 *  numbers canonicalized (see canonicalNumber).
 *  Prototype: constituency-lifecycle.ts:60-74. */
export function canonicalSerialize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return canonicalNumber(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map((v) => canonicalSerialize(v)).join(",") + "]";
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const keys = Object.keys(rec).sort();
    return "{" + keys.map((k) => `${JSON.stringify(k)}:${canonicalSerialize(rec[k])}`).join(",") + "}";
  }
  throw new Error(`canonicalSerialize: unsupported type ${typeof value}`);
}

/** sha256 digest, base64url-encoded. Prototype: constituency-lifecycle.ts:76-82. */
export function sha256Base64Url(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("base64url");
}

/** datasetHash = sha256(canonicalSerialize(dataset content with the top-level
 *  `datasetHash` field omitted)), base64url-encoded.
 *  Prototype: constituency-lifecycle.ts:84-91. */
export function computeDatasetHash(dataset: object): string {
  const rec = dataset as Record<string, unknown>;
  const clone: Record<string, unknown> = {};
  for (const k of Object.keys(rec)) if (k !== "datasetHash") clone[k] = rec[k];
  return sha256Base64Url(canonicalSerialize(clone));
}

/** Serialize the full decision record deterministically (spec §4.3: the entire
 *  decision is reproducible from versioned inputs + methodology version).
 *  Prototype: constituency-lifecycle.ts:398-400. */
export function serializeDecisionRecord(record: DecisionRecord): string {
  return canonicalSerialize(record);
}

/** Deterministic digest of the serialized decision record.
 *  Prototype: constituency-lifecycle.ts:402-404. */
export function decisionRecordDigest(record: DecisionRecord): string {
  return sha256Base64Url(serializeDecisionRecord(record));
}
