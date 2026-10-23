/**
 * MTQΣ Task 11 — SAFE SINGLETON IDENTITY PROBE (read-only)
 * Checks whether the Safe singleton behind both Genesis Safes is the canonical
 * Gnosis Safe v1.4.1 (which exposes getGuard/getFallbackHandler) or a modified
 * build. Also probes the guard/fallback storage slots on the proxies.
 * ZERO transactions.
 */
import { writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { keccak256, toUtf8Bytes } from "ethers";

const T11 = "/home/z/my-project/audit-work/task11";
mkdirSync(`${T11}/evidence`, { recursive: true });
const now = () => new Date().toISOString();
const log = (o: any) => appendFileSync(`${T11}/evidence/raw-task11-evm.jsonl`, JSON.stringify({ t: now(), ...o }) + "\n");

const MONAD = "https://testnet-rpc.monad.xyz";
const ARC = "https://rpc.testnet.arc.io";
const SINGLETON_CANONICAL = "0x29fcB43b46531bCa003DdC8fCb67FFE91900C762"; // canonical Safe v1.4.1 singleton
const SAFES = {
  monad: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0",
  arc: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0",
};
// v1.4.1 storage slots (documented in Safe repo StorageAccessible comments)
const SLOTS = {
  guard: "0x" + BigInt(keccak256(toUtf8Bytes("guard_manager.guards._guard.guard"))).toString(16).padStart(64, "0"),
  fallbackHandler: "0x" + BigInt(keccak256(toUtf8Bytes("fallback_manager.handler.handler"))).toString(16).padStart(64, "0"),
};
const SEL = {
  getGuard: keccak256(toUtf8Bytes("getGuard()")).slice(0, 10),
  getFallbackHandler: keccak256(toUtf8Bytes("getFallbackHandler()")).slice(0, 10),
  setGuard: keccak256(toUtf8Bytes("setGuard(address)")).slice(0, 10),
  setFallbackHandler: keccak256(toUtf8Bytes("setFallbackHandler(address)")).slice(0, 10),
  getThreshold: keccak256(toUtf8Bytes("getThreshold()")).slice(0, 10),
  getOwners: keccak256(toUtf8Bytes("getOwners()")).slice(0, 10),
  VERSION: keccak256(toUtf8Bytes("VERSION()")).slice(0, 10),
};
console.log("selectors:", JSON.stringify(SEL, null, 1));
console.log("guard slot:", SLOTS.guard);
console.log("fallback slot:", SLOTS.fallbackHandler);

async function rpc(url: string, method: string, params: any[], label: string) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const j = await r.json();
      if (j.error) { log({ call: label, jsonrpcError: j.error }); throw new Error(j.error.message); }
      log({ call: label, ok: true, result: typeof j.result === "string" && j.result.length > 200 ? `${j.result.slice(0, 66)}…(${j.result.length}ch)` : j.result });
      return j.result;
    } catch (e: any) {
      if (i >= 3) { log({ call: label, error: String(e?.message ?? e).slice(0, 160), verdict: "FAILED-UNVERIFIED" }); throw e; }
      await new Promise(r => setTimeout(r, 1000 * i));
    }
  }
}

async function main() {
  const out: any = { task: "task11-safe-singleton-probe", startedAt: now(), selectors: SEL, slots: SLOTS, chains: {} };
  for (const [chain, url] of Object.entries({ monad: MONAD, arc: ARC })) {
    const c: any = {};
    c.chainId = await rpc(url as string, "eth_chainId", [], `${chain}:chainId`);
    // 1. singleton code identity
    const sc = String(await rpc(url as string, "eth_getCode", [SINGLETON_CANONICAL, "latest"], `${chain}:singleton.getCode`));
    c.singleton = {
      addr: SINGLETON_CANONICAL,
      codeSize: (sc.length - 2) / 2,
      runtimeKeccak: keccak256(toUtf8Bytes(sc)),
      has: {
        getGuard: sc.toLowerCase().includes(SEL.getGuard.slice(2)),
        setGuard: sc.toLowerCase().includes(SEL.setGuard.slice(2)),
        getFallbackHandler: sc.toLowerCase().includes(SEL.getFallbackHandler.slice(2)),
        setFallbackHandler: sc.toLowerCase().includes(SEL.setFallbackHandler.slice(2)),
        getThreshold: sc.toLowerCase().includes(SEL.getThreshold.slice(2)),
        VERSION: sc.toLowerCase().includes(SEL.VERSION.slice(2)),
      },
    };
    // 2. raw eth_calls against the singleton and the proxy (revert = recorded, not fatal)
    for (const [name, sel] of Object.entries(SEL)) {
      try { c[`${name}_onSingleton`] = await rpc(url as string, "eth_call", [{ to: SINGLETON_CANONICAL, data: sel }, "latest"], `${chain}:call.singleton.${name}`); }
      catch (e: any) { c[`${name}_onSingleton`] = { revert: true, err: String(e?.message ?? e).slice(0, 120) }; }
    }
    const safe = SAFES[chain as "monad" | "arc"];
    for (const [name, sel] of Object.entries({ getGuard: SEL.getGuard, getFallbackHandler: SEL.getFallbackHandler })) {
      try { c[`${name}_onProxy`] = await rpc(url as string, "eth_call", [{ to: safe, data: sel }, "latest"], `${chain}:call.proxy.${name}`); }
      catch (e: any) { c[`${name}_onProxy`] = { revert: true, err: String(e?.message ?? e).slice(0, 120) }; }
    }
    // 3. storage slots on the proxy
    c.proxySlots = {
      guard: await rpc(url as string, "eth_getStorageAt", [safe, SLOTS.guard, "latest"], `${chain}:proxy.slot.guard`),
      fallbackHandler: await rpc(url as string, "eth_getStorageAt", [safe, SLOTS.fallbackHandler, "latest"], `${chain}:proxy.slot.fallback`),
    };
    (out.chains as any)[chain] = c;
  }
  // cross-chain singleton comparison
  const k = Object.values(out.chains).map((c: any) => c.singleton.runtimeKeccak);
  out.singletonByteIdenticalCrossChain = k[0] === k[1];
  out.finishedAt = now();
  writeFileSync(`${T11}/evidence/safe-singleton-probe.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ monadSingletonKeccak: out.chains.monad.singleton.runtimeKeccak, arcSingletonKeccak: out.chains.arc.singleton.runtimeKeccak, identical: out.singletonByteIdenticalCrossChain, monadHasGuardFn: out.chains.monad.singleton.has.getGuard, sizes: { monad: out.chains.monad.singleton.codeSize, arc: out.chains.arc.singleton.codeSize } }, null, 1));
}
main().catch(e => { console.error("FATAL", e); process.exit(1); });
