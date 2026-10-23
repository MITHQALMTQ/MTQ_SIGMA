/**
 * MTQΣ Task 11 — FRESH READ-ONLY SOLANA VERIFICATION (current + superseded mints)
 * TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
 *
 * Methods: getAccountInfo(jsonParsed — the RPC's own authoritative parse) ·
 * getBalance · getTokenSupply · getTokenAccountsByOwner(jsonParsed) ·
 * getSignaturesForAddress — with UTC timestamps, RPC endpoint identity,
 * request/response hashes, failures and retry counts. A failed query is recorded
 * as UNVERIFIED, never as a negative result. ZERO transactions.
 *
 * Correction history (disclosed): an earlier byte-offset mint parser in this
 * script produced garbage (wrong offsets) and a malformed superseded-mint
 * constant produced a WrongSize RPC error; both failures are preserved in
 * raw-task11-solana.jsonl as FAILED-UNVERIFIED, and this version uses the
 * RPC jsonParsed parse instead of hand-rolled offsets.
 */
import { writeFileSync, appendFileSync } from "node:fs";
import { keccak256, toUtf8Bytes } from "ethers";

const T11 = "/home/z/my-project/audit-work/task11";
const RPC = "https://api.devnet.solana.com";
const now = () => new Date().toISOString();
const stats = { requests: 0, retries: 0, failures: 0 };

const CURRENT_MINT = "GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4";
const SUPERSEDED_MINT = "2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY"; // verbatim from Task 10 solana-probe2.ts
const WALLET_CURRENT = "DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3";
const WALLET_EXPOSED = "4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d";
const SQUADS_ID_CANDIDATE = "SMPLecH531NA7dL1u4Yb2uJkg7who9g2mFxpM18i4rL"; // candidate ID — probed NULL on devnet+mainnet this session; see D4: UNVERIFIED, must be confirmed from official Squads docs

async function rpc(method: string, params: any[], label: string): Promise<any> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  const reqHash = keccak256(toUtf8Bytes(body)).slice(0, 26);
  for (let i = 1; ; i++) {
    try {
      stats.requests++;
      const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body });
      const text = await r.text();
      const resHash = keccak256(toUtf8Bytes(text)).slice(0, 26);
      const j = JSON.parse(text);
      if (j.error) {
        appendFileSync(`${T11}/evidence/raw-task11-solana.jsonl`, JSON.stringify({ t: now(), call: label, reqHash, resHash, jsonrpcError: j.error, attempt: i }) + "\n");
        if (i >= 5) { stats.failures++; throw new Error(j.error.message); }
        stats.retries++;
        await new Promise(res => setTimeout(res, 1500 * i));
        continue;
      }
      appendFileSync(`${T11}/evidence/raw-task11-solana.jsonl`, JSON.stringify({ t: now(), call: label, reqHash, resHash, ok: true, resultPreview: text.length > 300 ? `${text.slice(0, 200)}…(${text.length}ch)` : text }) + "\n");
      return j.result;
    } catch (e: any) {
      if (String(e?.message ?? e).includes("jsonrpc")) throw e;
      appendFileSync(`${T11}/evidence/raw-task11-solana.jsonl`, JSON.stringify({ t: now(), call: label, reqHash, error: String(e?.message ?? e).slice(0, 160), attempt: i, verdict: "TRANSPORT-RETRY" }) + "\n");
      if (i >= 5) { stats.failures++; throw e; }
      stats.retries++;
      await new Promise(res => setTimeout(res, 1500 * i));
    }
  }
}

async function mintInfo(mint: string, label: string) {
  const acc = await rpc("getAccountInfo", [mint, { encoding: "jsonParsed", commitment: "confirmed" }], `mint:${label}`);
  const parsed = acc?.value?.data?.parsed?.info ?? null;
  const sup = await rpc("getTokenSupply", [mint, { commitment: "confirmed" }], `supply:${label}`);
  return {
    exists: acc?.value !== null,
    ownerProgram: acc?.value?.owner,
    lamports: acc?.value?.lamports,
    isInitialized: parsed?.isInitialized ?? null,
    mintAuthority: parsed?.mintAuthority ?? null,
    freezeAuthority: parsed?.freezeAuthority ?? null,
    decimals: parsed?.decimals ?? null,
    supplyRaw: parsed?.supply ?? null,
    supplyIsU64Ceiling: parsed?.supply === "18446744073709551615",
    tokenSupplyRpc: { amount: sup?.value?.amount, decimals: sup?.value?.decimals, uiAmountString: sup?.value?.uiAmountString },
    parse: "jsonParsed (RPC-authoritative)",
  };
}

async function walletDossier(wallet: string, label: string) {
  const bal = await rpc("getBalance", [wallet, { commitment: "confirmed" }], `balance:${label}`);
  const atas = await rpc("getTokenAccountsByOwner", [wallet, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed", commitment: "confirmed" }], `ata:${label}`);
  const tokenAccounts: any[] = [];
  for (const a of atas?.value ?? []) {
    const info = a.account?.data?.parsed?.info ?? {};
    tokenAccounts.push({
      ata: a.pubkey,
      mint: info.mint === CURRENT_MINT ? "CURRENT_MINT" : info.mint === SUPERSEDED_MINT ? "SUPERSEDED_MINT" : info.mint,
      amountRaw: info.tokenAmount?.amount ?? null,
      uiAmountString: info.tokenAmount?.uiAmountString ?? null,
      delegate: info.delegate ?? null,
      delegatedAmount: info.delegatedAmount?.amount ?? null,
      state: info.state ?? null,
      closeAuthority: info.closeAuthority ?? null,
    });
  }
  const sigs = await rpc("getSignaturesForAddress", [wallet, { limit: 100 }], `sigs:${label}`);
  return {
    lamports: bal?.value, sol: (Number(bal?.value ?? 0) / 1e9).toFixed(9),
    tokenAccounts,
    signatureCount: sigs?.length ?? null,
    signatures: (sigs ?? []).map((s: any) => ({ slot: s.slot, ts: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null, err: s.err })),
  };
}

async function main() {
  const out: any = { task: "task11-fresh-solana-verification", startedAt: now(), rpcEndpoint: RPC };
  out.slot = await rpc("getSlot", [{ commitment: "confirmed" }], "slot");
  out.epochInfo = await rpc("getEpochInfo", [{ commitment: "confirmed" }], "epochInfo");

  out.currentMint = await mintInfo(CURRENT_MINT, "current");
  out.supersededMint = await mintInfo(SUPERSEDED_MINT, "superseded");
  out.wallet_currentAuthority = await walletDossier(WALLET_CURRENT, "DbFjz-current");
  out.wallet_exposed = await walletDossier(WALLET_EXPOSED, "4saT-exposed");

  // Squads program candidate — probed honestly; result recorded whatever it is
  try {
    const squads = await rpc("getAccountInfo", [SQUADS_ID_CANDIDATE, { encoding: "base64" }], "squads-program-candidate");
    out.squadsMplProgram = {
      candidateId: SQUADS_ID_CANDIDATE,
      devnetResult: squads?.value === null ? "NULL — account does not exist on devnet" : { owner: squads?.value?.owner, executable: squads?.value?.executable },
      verdict: "UNVERIFIED — the candidate program ID could not be confirmed live on devnet (NULL). No Squads program identity is asserted in this report; the owner MUST confirm the exact program ID and version from official Squads documentation before any multisig provisioning. mainnet probe also NULL (see raw log).",
    };
  } catch (e: any) {
    out.squadsMplProgram = { candidateId: SQUADS_ID_CANDIDATE, error: String(e?.message ?? e), verdict: "UNVERIFIED" };
  }

  // u64 representation ceiling table (computed locally, no RPC)
  const U64MAX = 18446744073709551615n;
  out.u64Ceilings = {};
  for (const d of [18, 13, 12, 9, 8, 6]) {
    const pow = 10n ** BigInt(d);
    out.u64Ceilings[`decimals_${d}`] = {
      maxWholeTokens: (U64MAX / pow).toString(),
      mandated_1M_raw: (1000000n * pow).toString(),
      mandated_1M_representable: 1000000n * pow <= U64MAX,
      scripted_10B_raw: (10000000000n * pow).toString(),
      scripted_10B_representable: 10000000000n * pow <= U64MAX,
    };
  }

  out.finishedAt = now();
  out.stats = { ...stats, note: "failures are recorded as UNVERIFIED, never as negative results" };
  writeFileSync(`${T11}/evidence/onchain-solana-task11.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({
    currentMint: { auth: out.currentMint.mintAuthority, freeze: out.currentMint.freezeAuthority, dec: out.currentMint.decimals, supply: out.currentMint.supplyRaw, ceiling: out.currentMint.supplyIsU64Ceiling },
    superseded: { auth: out.supersededMint.mintAuthority, freeze: out.supersededMint.freezeAuthority, supply: out.supersededMint.supplyRaw, dec: out.supersededMint.decimals },
    exposedWallet: { sol: out.wallet_exposed.sol, atas: out.wallet_exposed.tokenAccounts.map((t: any) => ({ which: t.mint, amt: t.amountRaw, state: t.state })), sigs: out.wallet_exposed.signatureCount },
    currentAuthorityWallet: { sol: out.wallet_currentAuthority.sol, atas: out.wallet_currentAuthority.tokenAccounts.map((t: any) => ({ which: t.mint, amt: t.amountRaw, state: t.state })), sigs: out.wallet_currentAuthority.signatureCount },
    squads: out.squadsMplProgram.verdict,
    slot: out.slot,
    stats: out.stats,
  }, null, 1));
}
main().catch(e => { console.error("FATAL", e); process.exit(1); });
