// MTQΣ — /api/roles — LIVE AccessControl role matrix (READ-ONLY).
// §1 VERIFICATION-ONLY: hasRole()/paused() are view functions — no signer,
// no transactions, no state changes, ever. Individual eth_calls (batch RPC
// proved flaky — see audit-work/v9-roles), concurrency-limited, 60s memory cache.
// On RPC failure the route DEGRADES to the static verified snapshot — it NEVER
// fabricates live-state data.
import { NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
import {
  ROLE_EVIDENCE,
  MTQ_ROLE_HASHES,
  ROLE_KEYS,
  DEPLOYER_WALLET,
  SAFE_ADDRESS,
  GOVERNANCE_ADDRESS,
  type RoleVerdict,
  type RoleRowEvidence,
  type ChainRoleEvidence,
} from "@/lib/mtq/roles";

export const dynamic = "force-dynamic";

const RPC: Record<string, string> = {
  monad: "https://testnet-rpc.monad.xyz",
  arc: "https://rpc.testnet.arc.io",
};
const SEL_HAS_ROLE = "0x91d14854"; // hasRole(bytes32,address)
const SEL_PAUSED = "0x5c975abb"; // paused()

const pad32 = (addr: string) => addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const hasRoleData = (roleHash: string, account: string) =>
  SEL_HAS_ROLE + roleHash.slice(2) + pad32(account);

async function ethCall(rpc: string, to: string, data: string): Promise<RoleVerdict> {
  // A REAL revert (contract does not implement the function) is a JSON-RPC
  // error whose message contains "revert" — that is a stable, deterministic
  // verdict. Other JSON-RPC errors (rate limits, load) are TRANSIENT and must
  // NOT be labeled REVERT: retry up to 3×, then report honestly as UNVERIFIED.
  // (Lesson 2026-10-21: two Monad RPC-error streaks were initially
  // misclassified as reverts and corrected after direct re-verification —
  // see audit-work/v9-roles/ROLE-VERIFICATION.md correction note.)
  let lastTransient = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
        signal: AbortSignal.timeout(10_000),
      });
      const j = (await res.json()) as { result?: string; error?: { message?: string } };
      if (j.error) {
        const msg = String(j.error.message ?? "");
        if (/revert/i.test(msg)) return "REVERT"; // deterministic contract revert
        lastTransient = true; // rate-limit / load / server error — retry
        continue;
      }
      const raw = j.result ?? "";
      if (raw.length >= 66) return raw.slice(-2) === "01" ? "true" : "false";
      return "REVERT"; // empty/short return = no matching function
    } catch {
      lastTransient = true; // transport failure — retry
    }
  }
  return lastTransient ? "UNREACHABLE" : "REVERT";
}

/** Concurrency-limited mapper (max 6 in flight per chain). */
async function pooled<T>(items: T[], limit: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

let cache: { at: number; body: unknown } | null = null;
const CACHE_TTL_MS = 60_000;

export async function GET(req: Request) {
  // [16a-007 fix, Task 16-fix-A] Per-IP rate limit — "rpc" bucket, 30
  // req/IP/min. This route fires dozens of eth_calls (×3 retries) across 2
  // chains and previously had no limiter (amplification surface).
  const rl = await rateLimit(getClientIP(req), "rpc");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.body);
  }
  try {
    const chains: (ChainRoleEvidence & { verifiedAt: string })[] = [];
    for (const ev of ROLE_EVIDENCE) {
      const rpc = RPC[ev.id];
      if (!rpc) continue;
      const blockHex = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
        signal: AbortSignal.timeout(10_000),
      }).then((r) => r.json() as Promise<{ result?: string }>);
      const block = parseInt(blockHex.result ?? "0x0", 16);

      const rows: RoleRowEvidence[] = ev.rows.map((r) => ({
        contract: r.contract,
        address: r.address,
        deployer: {} as Record<(typeof ROLE_KEYS)[number], RoleVerdict>,
        ...(r.holders ? { holders: { safe: {}, governance: {} } } : {}),
        ...(r.paused !== undefined ? { paused: "UNREACHABLE" as RoleVerdict } : {}),
      }));

      const jobs: (() => Promise<void>)[] = [];
      ev.rows.forEach((src, idx) => {
        const dst = rows[idx];
        ROLE_KEYS.forEach((role) => {
          jobs.push(async () => {
            dst.deployer[role] = await ethCall(rpc, src.address, hasRoleData(MTQ_ROLE_HASHES[role], DEPLOYER_WALLET));
          });
          if (src.holders) {
            jobs.push(async () => {
              (dst.holders!.safe as Record<string, RoleVerdict>)[role] = await ethCall(rpc, src.address, hasRoleData(MTQ_ROLE_HASHES[role], SAFE_ADDRESS));
            });
            jobs.push(async () => {
              (dst.holders!.governance as Record<string, RoleVerdict>)[role] = await ethCall(rpc, src.address, hasRoleData(MTQ_ROLE_HASHES[role], GOVERNANCE_ADDRESS));
            });
          }
        });
        if (src.paused !== undefined) {
          jobs.push(async () => {
            dst.paused = await ethCall(rpc, src.address, SEL_PAUSED);
          });
        }
      });
      await pooled(jobs, 6, (j) => j());
      chains.push({ ...ev, rows, block, verifiedAt: new Date().toISOString() });
    }

    const body = {
      status: "LIVE" as const,
      verifiedAt: new Date().toISOString(),
      mode: "READ-ONLY eth_call (hasRole/paused view functions) — no transactions, §1 shadow-mode enforced",
      chains,
    };
    cache = { at: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    // [16a-007 fix, Task 16-fix-A] Sanitized degrade reason — the raw
    // upstream error text (which can contain provider URLs/latency details)
    // is logged server-side only. The honest DEGRADED-to-verified-snapshot
    // contract is preserved (status 200 + lastVerified + explicit
    // "live state UNVERIFIED" disclosure — never fabricate live-state data).
    console.error("[api/roles] live probe failed:", e);
    return NextResponse.json(
      {
        status: "DEGRADED" as const,
        reason: "Live role probe failed (upchain RPC unavailable) — displaying the last VERIFIED snapshot; live state UNVERIFIED until the RPCs answer.",
        lastVerified: ROLE_EVIDENCE,
      },
      { status: 200 },
    );
  }
}
