# 🔴 CRITICAL — Deployer Private Key Rotation Required

## Status: BLOCKING public testnet launch

## Problem
A plaintext deployer private key exists at `upload/private_key.txt` (gitignored, on disk only).
This key derives to `0x3C3932F865892EFabE45892f453f81B64f6c8d8c` and is the **owner of all 4 testnet contracts**:

| Chain | Contract Address | Deployed |
|---|---|---|
| Monad Testnet (10143) | `0x0Ac20360234b4C988a19586CBe55733e18A5982f` | ✅ |
| Arc Testnet (5042002) | `0x9e6EdC15...` | ✅ |
| Robinhood Chain Testnet (46630) | `0x237c3Aa2...` | ✅ |
| Solana Devnet | `2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY` | ✅ |

## Remediation (before public testnet launch)

### Step 1: Generate a new deployer wallet
```bash
node -e "const {Wallet} = require('ethers'); const w = Wallet.createRandom(); console.log('addr:', w.address, 'key:', w.privateKey)"
```

### Step 2: Deploy Safe multi-sig on each testnet
- Use https://app.safe.io (free, no credit card)
- Configure 2-of-3 or 3-of-5 threshold
- Add governance council members as signers

### Step 3: Transfer contract ownership
```solidity
// On each testnet contract:
contract.grantRole(DEFAULT_ADMIN_ROLE, safeAddress);
contract.grantRole(PAUSER_ROLE, safeAddress);
contract.grantRole(EMERGENCY_ROLE, safeAddress);
contract.renounceRole(DEFAULT_ADMIN_ROLE, deployerEOA);
```

### Step 4: Rotate the deployer key
- Delete `upload/private_key.txt`
- Generate a fresh deployer key for future testnet deploys
- Store in `.env.local` as `DEPLOYER_PRIVATE_KEY`

### Step 5: Fund the new deployer
- Use testnet faucets (free, no card)
- Monad: https://faucet.monad.testnet
- Arc: https://faucet.arc.top
- Robinhood: https://faucet.robinhood.org

## Timeline
- **Internal pilot:** acceptable to keep current key (engineering team only)
- **Public testnet:** MUST complete Steps 1-5 before launch
- **Mainnet:** BLOCKED by 11 validation gates (Section 25.5) regardless

## COO/PM Action Required
- [ ] Approve Safe multi-sig configuration (2-of-3? 3-of-5?)
- [ ] Provide governance council member wallet addresses
- [ ] Confirm testnet faucet funding for new deployer
