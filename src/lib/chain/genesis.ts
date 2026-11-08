// MTQΣ Network — Sovereign Devnet genesis
//
// config/chain-genesis.json is COMMITTED and byte-reproducible: the validator
// + faucet keys are deterministically derived from the public devnet seed
// (crypto.ts), the genesis timestamp is a fixed constant. Every install of
// this repo generates the identical genesis → identical genesis hash. The
// keys are INSECURE BY DESIGN (public testnet reference keys — the standard
// tutorial-devnet practice); they hold only worthless testnet credits.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { canonicalRoot } from "../db-ops";
import { nodeKeys, pubToAddress, type NodeKeys } from "./crypto";
import { CHAIN_ID, DEFAULT_CHAIN_PARAMS, MICRO, type ChainParams } from "./shared";

export interface GenesisValidator {
  moniker: string;
  pub_key: string; // hex ed25519 (deterministic devnet key)
  address: string;
  power: number;
  self_stake_u: number;
}

export interface Genesis {
  chain_id: string;
  genesis_time_ms: number; // fixed constant → byte-reproducible
  params: ChainParams;
  validators: GenesisValidator[];
  allocs: Array<{ address: string; fee_u: number; pmtq_u: number; note: string }>;
}

// v28 §5: canonicalRoot() (not raw cwd) — same standalone-bundle fork class
// as the chain store fix: the traced bundle carries a build-time copy of
// config/, and server.js chdirs into the bundle at boot.
const GENESIS_PATH = join(canonicalRoot(), "config", "chain-genesis.json");

// Fixed genesis time (2025-11-01T00:00:00Z) — constant for byte-reproducibility.
const GENESIS_TIME_MS = 1761955200000;

const VALIDATOR_MONIKERS = [
  "mtq-val-0.helios",
  "mtq-val-1.equinox",
  "mtq-val-2.meridian",
  "mtq-val-3.aegis",
];

// Round numbers are illustrative devnet allocations in micro-units.
// Honest framing: uMTQD is a TESTNET-ONLY fee credit with no value; the
// uPMTQ allocation is a PILOT LEDGER MIRROR (non-canonical MTQΣ
// representation for transfer demos — canonical supply lives in the
// monetary protocol engine, untouched by this chain).
const VALIDATOR_SELF_STAKE_U = 1_000_000; // 1.0 MTQD → 10 power each

export function buildGenesis(keys: NodeKeys): Genesis {
  const allocs: Genesis["allocs"] = [];
  for (const v of keys.validators) {
    allocs.push({
      address: pubToAddress(v.pub),
      fee_u: 5_000 * MICRO,
      pmtq_u: 0,
      note: `${VALIDATOR_MONIKERS[v.index]} operator balance (testnet fee credit)`,
    });
  }
  allocs.push({
    address: pubToAddress(keys.faucet.pub),
    fee_u: 1_000_000 * MICRO,
    pmtq_u: 1_000 * MICRO,
    note: "devnet faucet reserve (testnet-only credits, no value)",
  });
  return {
    chain_id: CHAIN_ID,
    genesis_time_ms: GENESIS_TIME_MS,
    params: { ...DEFAULT_CHAIN_PARAMS },
    validators: keys.validators.map((v) => ({
      moniker: VALIDATOR_MONIKERS[v.index],
      pub_key: v.pub,
      address: pubToAddress(v.pub),
      power: Math.floor(VALIDATOR_SELF_STAKE_U / 100_000),
      self_stake_u: VALIDATOR_SELF_STAKE_U,
    })),
    allocs,
  };
}

export function genesisHash(genesis: Genesis): string {
  return "gen_" + createHash("sha256").update(JSON.stringify(genesis)).digest("hex").slice(0, 40);
}

/**
 * Deterministic load-or-verify: derives the canonical genesis from the
 * committed seed, verifies any committed file matches, writes the file only
 * when absent. NEVER regenerates divergently — a mismatch is a hard error.
 */
export function ensureGenesis(): { genesis: Genesis; keys: NodeKeys; created: boolean } {
  const keys = nodeKeys();
  const canonical = buildGenesis(keys);

  if (existsSync(GENESIS_PATH)) {
    let onDisk: Genesis | null = null;
    try {
      onDisk = JSON.parse(readFileSync(GENESIS_PATH, "utf-8")) as Genesis;
    } catch {
      onDisk = null;
    }
    if (!onDisk || onDisk.chain_id !== canonical.chain_id ||
        onDisk.validators.length !== canonical.validators.length ||
        onDisk.validators.some((v, i) => v.pub_key !== canonical.validators[i].pub_key)) {
      throw new Error(
        "[chain] FATAL: config/chain-genesis.json does not match the deterministic devnet genesis " +
        "(edited by hand?). The genesis file is reproducible output — restore it via git checkout.",
      );
    }
    return { genesis: onDisk, keys, created: false };
  }

  mkdirSync(join(canonicalRoot(), "config"), { recursive: true });
  writeFileSync(GENESIS_PATH, JSON.stringify(canonical, null, 2));
  return { genesis: canonical, keys, created: true };
}
