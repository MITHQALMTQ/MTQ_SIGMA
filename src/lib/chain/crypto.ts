// MTQΣ Network — Sovereign Devnet Reference Node (node-side cryptography)
//
// ed25519 sign/verify via the audited @noble/curves (same library the
// browser Wallet uses — one cryptographic code path for both sides).
//
// NODE-HELD KEYS (validators + faucet) are DETERMINISTICALLY derived from a
// committed PUBLIC seed — exactly like Cosmos SDK tutorial devnet keys:
// fully reproducible genesis across installs, INSECURE BY DESIGN, valid ONLY
// for this testnet reference node. They must NEVER be reused on any real
// network. USER wallet keys are generated randomly in the browser — they
// are never derived from this seed.

import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "node:crypto";
import { addressFromPublicKey, fromHex, toHex, canonicalTxBytes, type Tx } from "./shared";

// ─── primitives ──────────────────────────────────────────────────────────────

/** Random keypair — used ONLY for tooling/tests, never for node identity. */
export function generateKeyPair(): { pub: string; priv: string } {
  const seed = new Uint8Array(randomBytes(32));
  const pub = ed25519.getPublicKey(seed);
  return { pub: toHex(pub), priv: toHex(seed) };
}

export function signTx(privHex: string, tx: Omit<Tx, "sig" | "pub_key">): { sig: string; pub: string } {
  const seed = fromHex(privHex);
  const pub = toHex(ed25519.getPublicKey(seed));
  const sig = ed25519.sign(canonicalTxBytes(tx), seed);
  return { sig: toHex(sig), pub };
}

export function verifyTx(tx: Tx): boolean {
  try {
    const pub = fromHex(tx.pub_key);
    // address binding: the claimed `from` must derive from the pubkey
    if (addressFromPublicKey(pub) !== tx.from) return false;
    return ed25519.verify(fromHex(tx.sig), canonicalTxBytes(tx), pub);
  } catch {
    return false;
  }
}

export function signBytes(privHex: string, bytes: Uint8Array): string {
  return toHex(ed25519.sign(bytes, fromHex(privHex)));
}

export function verifyBytes(sigHex: string, bytes: Uint8Array, pubHex: string): boolean {
  try {
    return ed25519.verify(fromHex(sigHex), bytes, fromHex(pubHex));
  } catch {
    return false;
  }
}

export function pubToAddress(pubHex: string): string {
  return addressFromPublicKey(fromHex(pubHex));
}

// ─── deterministic devnet node keys (INSECURE BY DESIGN — testnet only) ─────

export const DEVNET_KEY_SEED =
  "mtq-devnet-1|deterministic-devnet-keys|PUBLIC-SEED|INSECURE-BY-DESIGN|NEVER-REUSE";

const SEED_ROLES = ["val-0", "val-1", "val-2", "val-3", "faucet"] as const;
export type SeedRole = (typeof SEED_ROLES)[number];

export function deriveKeyPair(role: string): { pub: string; priv: string } {
  const seed = sha256(new TextEncoder().encode(`${DEVNET_KEY_SEED}|${role}`));
  const pub = ed25519.getPublicKey(seed);
  return { pub: toHex(pub), priv: toHex(seed) };
}

export interface NodeKeys {
  validators: Array<{ index: number; moniker: string; pub: string; priv: string }>;
  faucet: { pub: string; priv: string };
}

/** The full node-held keyset — deterministic, public, reproducible. */
export function nodeKeys(): NodeKeys {
  return {
    validators: [0, 1, 2, 3].map((i) => ({
      index: i,
      moniker: `mtq-val-${i}`,
      ...deriveKeyPair(`val-${i}`),
    })),
    faucet: deriveKeyPair("faucet"),
  };
}
