// MTQΣ Network — browser-local wallet store (client-only, zustand).
//
// HONEST CUSTODY: the private key (seed) lives in localStorage on the user's
// machine and NEVER leaves the browser — every transaction is signed
// client-side (ed25519 via @noble/curves) and only the finished signed Tx is
// POSTed to /api/chain/submit. This is devnet-demo custody: NOT secure
// storage, never to hold value. The storage shape:
//   localStorage["mtqs.chain.wallet.v1"] = { seed, pub, address, created_at }
//
// Shared by WalletSection and StakingSection (both read the same singleton).

"use client";

import { create } from "zustand";

export interface WalletRecord {
  seed: string; // 32-byte ed25519 seed, hex (64 chars) — PRIVATE, browser-local
  pub: string; // 32-byte ed25519 public key, hex
  address: string; // mtq1 + 40 hex (sha256(pub)[:20])
  created_at: number; // epoch ms
}

interface WalletStore {
  wallet: WalletRecord | null;
  /** True once hydrate() has read localStorage (avoids SSR/first-paint flap). */
  hydrated: boolean;
  /** Read localStorage into state (call once on mount). */
  hydrate: () => void;
  /** Persist + set a wallet (generate or import). */
  setWallet: (w: WalletRecord) => void;
  /** Forget the key: remove from localStorage + state. */
  removeWallet: () => void;
}

export const WALLET_STORAGE_KEY = "mtqs.chain.wallet.v1";

function readStored(): WalletRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WALLET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WalletRecord>;
    if (
      typeof parsed.seed === "string" &&
      typeof parsed.pub === "string" &&
      typeof parsed.address === "string"
    ) {
      return {
        seed: parsed.seed,
        pub: parsed.pub,
        address: parsed.address,
        created_at: typeof parsed.created_at === "number" ? parsed.created_at : 0,
      };
    }
    return null;
  } catch {
    // corrupted entry — treat as absent (honest: no silent partial wallet)
    return null;
  }
}

export const useWalletStore = create<WalletStore>((set) => ({
  wallet: null,
  hydrated: false,
  hydrate: () => {
    set({ wallet: readStored(), hydrated: true });
  },
  setWallet: (w) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(w));
      } catch {
        // storage unavailable (private mode etc.) — wallet lives in memory only
      }
    }
    set({ wallet: w, hydrated: true });
  },
  removeWallet: () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(WALLET_STORAGE_KEY);
      } catch {
        /* best-effort */
      }
    }
    set({ wallet: null, hydrated: true });
  },
}));
