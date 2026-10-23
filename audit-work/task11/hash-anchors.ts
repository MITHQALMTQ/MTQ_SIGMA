/**
 * MTQΣ Task 11 — IDENTITY-ANCHOR RE-HASH (read-only)
 * Re-fetches runtime code for every deployed contract and hashes it under the
 * SAME convention as Tasks 9/10 (keccak256 of the bytecode bytes — ethers v6
 * BytesLike interpretation of the 0x-hex string). This supersedes the
 * ASCII-hex-string hashes recorded by verify-evm.ts (convention difference
 * disclosed there) and re-proves the byte-identity families under the
 * historical convention. Also re-hashes the Safe singleton against the
 * canonical mainnet singleton fetched live.
 * ZERO transactions.
 */
import { writeFileSync, appendFileSync } from "node:fs";
import { keccak256 } from "ethers";

const T11 = "/home/z/my-project/audit-work/task11";
const now = () => new Date().toISOString();
const log = (o: any) => appendFileSync(`${T11}/evidence/raw-task11-evm.jsonl`, JSON.stringify({ t: now(), ...o }) + "\n");

const NETS: Record<string, { url: string; contracts: Record<string, string> }> = {
  monad: {
    url: "https://testnet-rpc.monad.xyz",
    contracts: {
      MTQ: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD",
      Governance: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66",
      Safe: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0",
      Algorithm: "0x8839ce50e8D414005518769999c0A5b961D00CB2",
      Reserve: "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177",
      Mint: "0x197e9CB28216dfe18a199b4c2930F74C2F460809",
      Redeem: "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4",
      Oracle: "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713",
      Takaful: "0x3eC27BB283644eF0A98B9961E9FBED0583a02f19",
      genA: "0x5D9564C27111EA65Da3228a79833F0FF129bfd4a",
      genB: "0x0Ac20360234b4C988a19586CBe55733e18A5982f",
      "SafeSingleton": "0x29fcB43b46531bCa003DdC8fCb67FFE91900C762",
    },
  },
  arc: {
    url: "https://rpc.testnet.arc.io",
    contracts: {
      MTQ: "0x237c3Aa2B79248f86f6523D3890095BCd1996601",
      Governance: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66",
      Safe: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0",
      Algorithm: "0x62f8E5243f32eE5C87a14A7896C61104aD9e7727",
      Reserve: "0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471",
      Mint: "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa",
      Redeem: "0xcAde4594177829597882555Ff57d0e34092daF8e",
      Oracle: "0xFd2B8d176bf059287638Db30D02C6651dA02861e",
      Takaful: "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0",
      genA: "0x826b82F79FD6c5347cDC568B1d0A7918128B63c1",
      genB: "0x24203404B9b971C907e8Ced96106Fa74380d9897",
      genC: "0x5C728F729110013A1fa59fFc85938bbD973A2563",
      "SafeSingleton": "0x29fcB43b46531bCa003DdC8fCb67FFE91900C762",
    },
  },
  robinhood: {
    url: "https://rpc.testnet.chain.robinhood.com/rpc",
    contracts: {
      MTQToken: "0xAF5B85658d074e071BbF392395a2ddA9B644C5A5",
      MTQSigma: "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0",
      Safe: "0xa3CE28A10854B375272D528EeC4295D6bcd75691",
      Governance: "0x80FF03DAD374E1f2f5C110F355B7a448Aa732B56",
    },
  },
  ethereum: {
    url: "https://ethereum-rpc.publicnode.com",
    contracts: { SafeSingletonCanonical: "0x29fcB43b46531bCa003DdC8fCb67FFE91900C762" },
  },
};

async function rpc(url: string, method: string, params: any[], label: string): Promise<any> {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const j = await r.json();
      if (j.error) { log({ call: label, jsonrpcError: j.error }); throw new Error(j.error.message); }
      log({ call: label, ok: true, resultPreview: typeof j.result === "string" && j.result.length > 66 ? `${j.result.slice(0, 66)}…(${j.result.length}ch)` : j.result });
      return j.result;
    } catch (e: any) {
      if (i >= 4) { log({ call: label, error: String(e?.message ?? e).slice(0, 160), verdict: "FAILED-UNVERIFIED" }); throw e; }
      log({ call: label, error: String(e?.message ?? e).slice(0, 160), attempt: i, verdict: "RETRY" });
      await new Promise(r => setTimeout(r, 1000 * i));
    }
  }
}

async function main() {
  const out: any = { task: "task11-identity-anchors-rehash", startedAt: now(), convention: "keccak256(bytecode bytes) — identical to Tasks 9/10", networks: {} };
  for (const [nk, net] of Object.entries(NETS)) {
    const anchors: any = {};
    const chainId = await rpc(net.url, "eth_chainId", [], `${nk}:chainId`);
    const block = await rpc(net.url, "eth_blockNumber", [], `${nk}:blockNumber`);
    for (const [name, addr] of Object.entries(net.contracts)) {
      const code = String(await rpc(net.url, "eth_getCode", [addr, "latest"], `${nk}:getCode:${name}`));
      anchors[name] = { addr, codeSize: (code.length - 2) / 2, runtimeKeccak: keccak256(code) };
    }
    out.networks[nk] = { rpcEndpoint: net.url, chainId, block: parseInt(block, 16), anchors };
  }
  // byte-identity family checks under the historical convention
  const A = out.networks;
  out.families = {
    safeSingleton: {
      monadVsArc: A.monad.anchors.SafeSingleton.runtimeKeccak === A.arc.anchors.SafeSingleton.runtimeKeccak,
      arcVsEthereumCanonical: A.arc.anchors.SafeSingleton.runtimeKeccak === A.ethereum.anchors.SafeSingletonCanonical.runtimeKeccak,
      keccak: A.monad.anchors.SafeSingleton.runtimeKeccak,
    },
    safeProxy: { monadVsArc: A.monad.anchors.Safe.runtimeKeccak === A.arc.anchors.Safe.runtimeKeccak, keccak: A.monad.anchors.Safe.runtimeKeccak },
    genA_family: {
      monadGenA: A.monad.anchors.genA.runtimeKeccak,
      arcGenC: A.arc.anchors.genC.runtimeKeccak,
      rhMTQSigma: A.robinhood.anchors.MTQSigma.runtimeKeccak,
      allIdentical: A.monad.anchors.genA.runtimeKeccak === A.arc.anchors.genC.runtimeKeccak && A.monad.anchors.genA.runtimeKeccak === A.robinhood.anchors.MTQSigma.runtimeKeccak,
    },
    genB_family: {
      monadGenB: A.monad.anchors.genB.runtimeKeccak,
      arcGenB: A.arc.anchors.genB.runtimeKeccak,
      rhMTQToken: A.robinhood.anchors.MTQToken.runtimeKeccak,
      allIdentical: A.monad.anchors.genB.runtimeKeccak === A.arc.anchors.genB.runtimeKeccak && A.monad.anchors.genB.runtimeKeccak === A.robinhood.anchors.MTQToken.runtimeKeccak,
    },
    governanceSameHexDifferentCode: A.monad.anchors.Governance.runtimeKeccak !== A.arc.anchors.Governance.runtimeKeccak,
  };
  out.finishedAt = now();
  writeFileSync(`${T11}/evidence/identity-anchors-task11.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.families, null, 1));
}
main().catch(e => { console.error("FATAL", e); process.exit(1); });
