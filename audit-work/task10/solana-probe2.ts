/**
 * MTQΣ Task 10 — SOLANA DEVNET PROBE v2 (READ-ONLY, single-call, patient)
 * The public RPC throttles per-method; call one method at a time with 20s+ pacing,
 * save evidence incrementally after each success so timeouts never lose data.
 */
import { writeFileSync, appendFileSync, readFileSync, existsSync } from "node:fs";

const SOL = "https://api.devnet.solana.com";
const OUTP = "/home/z/my-project/audit-work/task10/evidence/onchain-solana.json";
const RAWLOG = "/home/z/my-project/audit-work/task10/evidence/raw-onchain.jsonl";
const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const log = (o: any) => appendFileSync(RAWLOG, JSON.stringify({ t: now(), ...o }) + "\n");

const MINT = "GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4";
const OLD = "2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY";
const AUTH = "DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3";
const EXP = "4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d";

const b58 = (b: Buffer) => { const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"; let n = 0n; for (const x of b) n = n * 256n + BigInt(x); let s = ""; while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; } for (const x of b) { if (x !== 0) break; s = "1" + s; } return s; };
function parseMint(info: any) {
  if (!info?.value?.data?.[0]) return { exists: false, note: "account not found or null" };
  const raw = Buffer.from(info.value.data[0], "base64");
  const r: any = { exists: true, ownerProgram: info.value.owner, lamports: info.value.lamports, dataLen: raw.length };
  if (raw.length >= 82) {
    const mOpt = raw.readUInt32LE(0), fOpt = raw.readUInt32LE(46);
    r.mintAuthority = mOpt ? b58(raw.subarray(4, 36)) : null;
    r.supplyRaw = raw.readBigUInt64LE(36).toString();
    r.u64Ceiling = raw.readBigUInt64LE(36) === 18446744073709551615n;
    r.decimals = raw.readUInt8(44);
    r.isInitialized = raw.readUInt8(45) === 1;
    r.freezeAuthority = fOpt ? b58(raw.subarray(50, 82)) : null;
  }
  return r;
}

async function call(method: string, params: any[], label: string, tries = 6): Promise<any | null> {
  for (let a = 1; a <= tries; a++) {
    await sleep(a === 1 ? 2500 : 22000 * a);
    try {
      const r = await fetch(SOL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: Date.now() % 1e6, method, params }) });
      const j = await r.json() as any;
      if (j.error) throw new Error(j.error.message);
      log({ call: label, ok: true, brief: JSON.stringify(j.result).slice(0, 200) });
      return j.result;
    } catch (e: any) {
      log({ call: label, error: String(e.message).slice(0, 120), attempt: a });
    }
  }
  return null;
}

async function main() {
  let out: any = existsSync(OUTP) && process.argv[2] !== "fresh" ? JSON.parse(readFileSync(OUTP, "utf8")) : { chain: "solana", startedAt: now(), rpc: SOL };
  const save = () => { out.finishedAt = now(); writeFileSync(OUTP, JSON.stringify(out, null, 2)); };

  if (!out.mint) { const r = await call("getAccountInfo", [MINT, { encoding: "base64", commitment: "confirmed" }], "sol2:mint"); if (r) { out.mint = parseMint(r); save(); } }
  if (!out.supersededMint) { const r = await call("getAccountInfo", [OLD, { encoding: "base64", commitment: "confirmed" }], "sol2:oldMint"); if (r) { out.supersededMint = parseMint(r); save(); } }
  if (!out["4saT_allTokenAccounts"]) {
    const r = await call("getTokenAccountsByOwner", [EXP, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9S666QoqWvNm" }, { encoding: "jsonParsed", commitment: "confirmed" }], "sol2:4saT:byProgram");
    if (r) out["4saT_allTokenAccounts"] = (r.value ?? []).map((x: any) => ({ mint: x.account.data.parsed?.info?.mint, uiAmountString: x.account.data.parsed?.info?.tokenAmount?.uiAmountString, ata: x.pubkey })); save();
  }
  if (!out.solBalance_4saT) { const r = await call("getBalance", [EXP, { commitment: "confirmed" }], "sol2:4saT:balance"); if (r) { out.solBalance_4saT = r.value; save(); } }
  if (!out.exposedWalletHistory) {
    const r = await call("getSignaturesForAddress", [EXP, { limit: 25 }], "sol2:4saT:sigs");
    if (r) out.exposedWalletHistory = r.map((s: any) => ({ sig: s.signature, ts: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null, err: s.err })); save();
  }
  if (!out.mintTxHistory) {
    const r = await call("getSignaturesForAddress", [MINT, { limit: 25 }], "sol2:mint:sigs");
    if (r) out.mintTxHistory = r.map((s: any) => ({ sig: s.signature, ts: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null, err: s.err })); save();
  }
  if (!out.mintCreationTx) {
    if (out.mintTxHistory?.length) {
      const oldest = [...out.mintTxHistory].sort((a: any, b: any) => (a.ts ?? "").localeCompare(b.ts ?? ""))[0];
      if (oldest?.sig) {
        const r = await call("getTransaction", [oldest.sig, { maxSupportedTransactionVersion: 0, encoding: "json" }], "sol2:mint:oldestTx");
        if (r) out.mintCreationTx = { slot: r.slot, blockTime: r.blockTime ? new Date(r.blockTime * 1000).toISOString() : null, feePayer: r.transaction?.message?.accountKeys?.[0] ?? null, accounts: r.transaction?.message?.accountKeys?.slice(0, 8), logs: r.meta?.logMessages?.slice(0, 6) }; save();
      }
    } else out.mintCreationTx = { note: "no mint sigs available yet" };
  }
  // token accounts by (mint) filter for the exposed wallet — programId filter is broken on this RPC build (WrongSize)
  for (const [tag, mintAddr] of Object.entries({ "4saT_onCurrentMint": MINT, "4saT_onSupersededMint": OLD })) {
    if (!out[tag as string]) {
      const r = await call("getTokenAccountsByOwner", [EXP, { mint: mintAddr }, { encoding: "jsonParsed", commitment: "confirmed" }], `sol2:4saT:${tag}`);
      if (r) (out as any)[tag as string] = (r.value ?? []).map((x: any) => ({ mint: x.account.data.parsed?.info?.mint, uiAmountString: x.account.data.parsed?.info?.tokenAmount?.uiAmountString, ata: x.pubkey })); save();
    }
  }
  if (!out.DbFjz_allTokenAccounts) {
    const r = await call("getTokenAccountsByOwner", [AUTH, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9S666QoqWvNm" }, { encoding: "jsonParsed", commitment: "confirmed" }], "sol2:DbFjz:byProgram");
    if (r) out.DbFjz_allTokenAccounts = (r.value ?? []).map((x: any) => ({ mint: x.account.data.parsed?.info?.mint, uiAmountString: x.account.data.parsed?.info?.tokenAmount?.uiAmountString, ata: x.pubkey })); save();
  }
  save();
  console.log("FINAL: " + readFileSync(OUTP, "utf8").slice(0, 3500));
}
main().catch(e => { console.error("FATAL", e); process.exit(1); });
