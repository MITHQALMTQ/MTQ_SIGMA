/**
 * MTQΣ Task 10 — SOLANA DEVNET PROBE (READ-ONLY, batched JSON-RPC)
 * TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS
 */
import { writeFileSync, appendFileSync } from "node:fs";

const SOL = "https://api.devnet.solana.com";
const RAWLOG = "/home/z/my-project/audit-work/task10/evidence/raw-onchain.jsonl";
const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const log = (o: any) => appendFileSync(RAWLOG, JSON.stringify({ t: now(), ...o }) + "\n");

async function rpcBatch(body: any[], label: string): Promise<any[]> {
  for (let attempt = 1; attempt <= 8; attempt++) {
    await sleep(attempt === 1 ? 6000 : 8000 * attempt);
    try {
      const r = await fetch(SOL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json() as any;
      if (!Array.isArray(j)) throw new Error(JSON.stringify(j).slice(0, 150));
      const errs = j.filter((x: any) => x.error);
      if (errs.length) throw new Error(errs.map((x: any) => x.error.message).join("; ").slice(0, 200));
      log({ call: label, ok: true, count: body.length, brief: JSON.stringify(j.map((x: any) => x.result)).slice(0, 300) });
      return j.map((x: any) => x.result);
    } catch (e: any) {
      log({ call: label, error: String(e.message).slice(0, 140), attempt });
      if (attempt === 8) throw e;
    }
  }
  throw new Error("unreachable");
}

const b58 = (b: Buffer) => { const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"; let n = 0n; for (const x of b) n = n * 256n + BigInt(x); let s = ""; while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; } for (const x of b) { if (x !== 0) break; s = "1" + s; } return s; };
function parseMint(info: any) {
  if (!info?.value?.data?.[0]) return { exists: false };
  const raw = Buffer.from(info.value.data[0], "base64");
  const r: any = { exists: true, ownerProgram: info.value.owner, lamports: info.value.lamports, dataLen: raw.length };
  if (raw.length >= 82) {
    const mOpt = raw.readUInt32LE(0), fOpt = raw.readUInt32LE(46);
    r.mintAuthority = mOpt ? b58(raw.subarray(4, 36)) : null;
    r.mintAuthorityOption = mOpt;
    r.supplyRaw = raw.readBigUInt64LE(36).toString();
    r.u64Ceiling = raw.readBigUInt64LE(36) === 18446744073709551615n;
    r.decimals = raw.readUInt8(44);
    r.isInitialized = raw.readUInt8(45) === 1;
    r.freezeAuthority = fOpt ? b58(raw.subarray(50, 82)) : null;
    r.freezeAuthorityOption = fOpt;
  }
  return r;
}

(async () => {
  const MINT = "GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4";
  const OLD = "2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY";
  const AUTH = "DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3";
  const EXP = "4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d";
  let id = 1000;
  const req = (method: string, params: any[]) => ({ jsonrpc: "2.0", id: id++, method, params });
  const out: any = { chain: "solana", startedAt: now(), rpc: SOL };

  // ── batch 1: accounts + supply + largest + balances ──
  const b1 = await rpcBatch([
    req("getAccountInfo", [MINT, { encoding: "base64", commitment: "confirmed" }]),
    req("getAccountInfo", [OLD, { encoding: "base64", commitment: "confirmed" }]),
    req("getTokenSupply", [MINT, { commitment: "confirmed" }]),
    req("getTokenLargestAccounts", [MINT, { commitment: "confirmed" }]),
    req("getBalance", [AUTH, { commitment: "confirmed" }]),
    req("getBalance", [EXP, { commitment: "confirmed" }]),
  ], "sol:batch1");
  out.mint = parseMint(b1[0]);
  out.supersededMint = parseMint(b1[1]);
  out.tokenSupply = b1[2]?.value ? { amount: b1[2].value.amount, decimals: b1[2].value.decimals, uiAmountString: b1[2].value.uiAmountString } : null;
  out.largestAccounts = b1[3]?.value?.topAccounts?.map((a: any) => ({ address: a.address, amount: a.amount, uiAmountString: a.uiAmountString })) ?? null;
  out.solBalance_DbFjz = b1[4]?.value;
  out.solBalance_4saT = b1[5]?.value;

  // ── batch 2: token accounts by owner ──
  const b2 = await rpcBatch([
    req("getTokenAccountsByOwner", [AUTH, { mint: MINT }, { encoding: "jsonParsed", commitment: "confirmed" }]),
    req("getTokenAccountsByOwner", [EXP, { mint: MINT }, { encoding: "jsonParsed", commitment: "confirmed" }]),
    req("getTokenAccountsByOwner", [AUTH, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9S666QoqWvNm" }, { encoding: "jsonParsed", commitment: "confirmed" }]),
    req("getTokenAccountsByOwner", [EXP, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9S666QoqWvNm" }, { encoding: "jsonParsed", commitment: "confirmed" }]),
  ], "sol:batch2");
  const parseAccts = (r: any) => (r?.value ?? []).map((a: any) => ({ mint: a.account.data.parsed?.info?.mint, uiAmountString: a.account.data.parsed?.info?.tokenAmount?.uiAmountString, owner: a.account.data.parsed?.info?.owner, ata: a.pubkey }));
  out.DbFjz_onCurrentMint = parseAccts(b2[0]);
  out["4saT_onCurrentMint"] = parseAccts(b2[1]);
  out.DbFjz_allTokenAccounts = parseAccts(b2[2]);
  out["4saT_allTokenAccounts"] = parseAccts(b2[3]);

  // ── batch 3: signature histories ──
  const b3 = await rpcBatch([
    req("getSignaturesForAddress", [MINT, { limit: 30 }]),
    req("getSignaturesForAddress", [EXP, { limit: 30 }]),
  ], "sol:batch3");
  out.mintTxHistory = (b3[0] ?? []).map((s: any) => ({ sig: s.signature.slice(0, 20), ts: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null, err: s.err, memo: s.memo?.slice(0, 60) }));
  out.exposedWalletHistory = (b3[1] ?? []).map((s: any) => ({ sig: s.signature.slice(0, 20), ts: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null, err: s.err }));

  // ── batch 4: creation tx of the mint (oldest signature) ──
  if ((b3[0] ?? []).length) {
    const oldest = [...b3[0]].sort((a: any, b: any) => (a.blockTime ?? 9e18) - (b.blockTime ?? 9e18))[0];
    try {
      const b4 = await rpcBatch([
        req("getTransaction", [oldest.signature, { maxSupportedTransactionVersion: 0, encoding: "json" }]),
      ], "sol:batch4");
      const tx = b4[0];
      out.mintCreationTx = tx ? {
        slot: tx.slot, blockTime: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
        feePayer: tx.transaction?.message?.accountKeys?.[0] ?? null,
        accountKeys: tx.transaction?.message?.accountKeys?.slice(0, 10),
        logs: tx.meta?.logMessages?.slice(0, 8),
        err: tx.meta?.err,
      } : null;
    } catch (e: any) { out.mintCreationTx = { err: String(e.message).slice(0, 120) }; }
  }
  out.finishedAt = now();
  const p = "/home/z/my-project/audit-work/task10/evidence/onchain-solana.json";
  writeFileSync(p, JSON.stringify(out, null, 2));
  console.log("written " + p);
  console.log(JSON.stringify({ mint: out.mint, superseded: out.supersededMint, tokenSupply: out.tokenSupply, largest: out.largestAccounts?.slice(0, 5), DbFjz_onMint: out.DbFjz_onCurrentMint, s4saT_onMint: out["4saT_onCurrentMint"], DbFjz_all: out.DbFjz_allTokenAccounts?.slice(0, 6), s4saT_all: out["4saT_allTokenAccounts"]?.slice(0, 6), balDb: out.solBalance_DbFjz, balExp: out.solBalance_4saT, mintTx: out.mintTxHistory?.slice(0, 12), creation: out.mintCreationTx, expHistory: out.exposedWalletHistory?.slice(0, 12) }, null, 1));
})();
