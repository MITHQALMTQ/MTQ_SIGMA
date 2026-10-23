// MTQΣ — Old roles audit + fix on Monad + Arc user MITHQAL.
// Checks if MINTER_ROLE is granted to the Mint contract and PAUSER_ROLE to the
// Safe (Multi-Sig) — the correct production role wiring. If missing, grants them.

import { ethers } from "ethers";
import { readFileSync } from "fs";

const env = readFileSync(".env", "utf8");
const pk = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)![1];

const ROLE_ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000";
const ROLE_MINTER = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const ROLE_PAUSER = "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a";

const CHAINS = [
  { key: "monad", label: "Monad", chainId: 10143, rpc: "https://testnet-rpc.monad.xyz",
    mtq: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", mint: "0x197e9CB28216dfe18a199b4c2930F74C2F460809", safe: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0" },
  { key: "arc", label: "Arc", chainId: 5042002, rpc: "https://rpc.testnet.arc.io",
    mtq: "0x237c3Aa2B79248f86f6523D3890095BCd1996601", mint: "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa", safe: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0" },
];

const ACCESS_ABI = ["function hasRole(bytes32,address) view returns (bool)","function grantRole(bytes32,address) returns (bool)","function getRoleAdmin(bytes32) view returns (bytes32)","function name() view returns (string)"];

(async () => {
  for (const c of CHAINS) {
    console.log(`\n══════ OLD ROLES AUDIT — ${c.label.toUpperCase()} ══════`);
    const provider = new ethers.JsonRpcProvider(c.rpc, { chainId: c.chainId, name: c.key }, { staticNetwork: true });
    const w = new ethers.Wallet(pk, provider);
    const mtq = new ethers.Contract(c.mtq, ACCESS_ABI, w);

    // Check existing roles
    const adminOnDeployer = await mtq.hasRole(ROLE_ADMIN, w.address);
    const minterOnDeployer = await mtq.hasRole(ROLE_MINTER, w.address);
    const minterOnMint = await mtq.hasRole(ROLE_MINTER, c.mint);
    const pauserOnDeployer = await mtq.hasRole(ROLE_PAUSER, w.address);
    const pauserOnSafe = await mtq.hasRole(ROLE_PAUSER, c.safe);

    console.log(`  MTQ ${c.mtq}: name="${await mtq.name()}"`);
    console.log(`    DEFAULT_ADMIN_ROLE(deployer):  ${adminOnDeployer}`);
    console.log(`    MINTER_ROLE(deployer):         ${minterOnDeployer}`);
    console.log(`    MINTER_ROLE(Mint contract):    ${minterOnMint}  ${minterOnMint ? "✓" : "✗ MISSING — should be granted so Mint can mint on user deposit"}`);
    console.log(`    PAUSER_ROLE(deployer):         ${pauserOnDeployer}`);
    console.log(`    PAUSER_ROLE(Safe Multi-Sig):    ${pauserOnSafe}  ${pauserOnSafe ? "✓" : "✗ MISSING — should be granted so Safe can pause in emergencies"}`);

    // Fix missing roles (deployer has ADMIN → can grant)
    if (!minterOnMint) {
      console.log(`  → Fixing: granting MINTER_ROLE to Mint contract ${c.mint}...`);
      try {
        const tx = await mtq.grantRole(ROLE_MINTER, c.mint);
        await tx.wait();
        console.log(`    ✓ Granted (tx ${tx.hash.slice(0,18)}…). Verify: ${await mtq.hasRole(ROLE_MINTER, c.mint)}`);
      } catch (e: any) { console.log(`    ✗ grant failed: ${e.message?.slice(0, 80)}`); }
    }
    if (!pauserOnSafe) {
      console.log(`  → Fixing: granting PAUSER_ROLE to Safe (Multi-Sig) ${c.safe}...`);
      try {
        const tx = await mtq.grantRole(ROLE_PAUSER, c.safe);
        await tx.wait();
        console.log(`    ✓ Granted (tx ${tx.hash.slice(0,18)}…). Verify: ${await mtq.hasRole(ROLE_PAUSER, c.safe)}`);
      } catch (e: any) { console.log(`    ✗ grant failed: ${e.message?.slice(0, 80)}`); }
    }

    // Final state
    console.log(`  Final role state on ${c.label} MTQ:`);
    console.log(`    ADMIN→deployer:${await mtq.hasRole(ROLE_ADMIN, w.address)}  MINTER→deployer:${await mtq.hasRole(ROLE_MINTER, w.address)}  MINTER→Mint:${await mtq.hasRole(ROLE_MINTER, c.mint)}  PAUSER→deployer:${await mtq.hasRole(ROLE_PAUSER, w.address)}  PAUSER→Safe:${await mtq.hasRole(ROLE_PAUSER, c.safe)}`);
  }
})();
