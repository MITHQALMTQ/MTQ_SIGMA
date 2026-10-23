# MTQΣ — Bank-Grade Institutional Audit & Readiness Report

**Prepared for:** Institutional Bank Risk Committees, Treasury Departments, Custody Desks
**Prepared by:** Lead AI Platform Developer (COO / CTO / Tokenomics / Crypto Structuring)
**Date:** 2026-09-15
**Subject:** Would a bank use MTQΣ? Honest assessment against banking standards.
**Classification:** Internal — for institutional counterparty review

---

## 0. Executive Summary — The Honest Answer

### Would a bank use MTQΣ today?

**No.** And this is not a close call.

A bank's risk committee evaluates any digital asset product against a framework derived from **Basel III**, **FFIEC IT Examination**, **SOC 2 Type II**, **OCC Interpretive Letters**, and (in the EU) **MiCA** and **DORA**. MTQΣ currently meets **zero** of these frameworks at a level a bank would accept for anything beyond a small, fully-reserved, research-budget pilot allocation.

The gap is not cosmetic. It is structural. Below is the unvarnished truth, organized the way a bank risk committee would actually review it.

---

## 1. The 10 Pillars of Bank-Grade Digital Asset Acceptance

Banks do not evaluate crypto the way crypto evaluates itself. A bank asks 10 questions, in this order, and a "no" on any of the first 5 is an automatic decline.

| # | Pillar | Bank's Question | MTQΣ Status | Verdict |
|---|---|---|---|---|
| 1 | **Legal entity & jurisdiction** | Is there a regulated legal entity we can sue? | ❌ No legal entity exists | **DECLINE** |
| 2 | **Regulatory classification** | Is the token a security, a stablecoin, or something else? Do we need a license to hold it? | ❌ No legal opinion; likely a security (Howey) + ART (MiCA) | **DECLINE** |
| 3 | **KYC/AML & sanctions** | Can you prove every holder is screened against OFAC/EU/UN? | ❌ No wallet screening; NER-only text screen with explicit "not a substitute" disclaimer | **DECLINE** |
| 4 | **Custody** | Who holds the collateral? Is it bankruptcy-remote? | ❌ Deployer EOA holds USDC in a plain ERC-20 `transferFrom`. No qualified custodian, no bankruptcy isolation. | **DECLINE** |
| 5 | **Insurance / bond** | Is there a crime/custody policy or surety bond? | ❌ None | **DECLINE** |
| 6 | **External audit** | Has a Big-4 or top crypto audit firm signed off? | ❌ Never audited externally | **DECLINE** |
| 7 | **Reserve transparency** | Can we independently verify the reserve at any time? | ⚠️ On-chain USDC balance visible, but no proof-of-reserve attestation, no third-party attestation | **CONDITIONAL** |
| 8 | **Liquidity & redemption** | Can we redeem $10M in 24h without moving the price >1%? | ❌ No redemption queue, no daily cap, no liquidity analysis | **DECLINE** |
| 9 | **Operational resilience** | What's the RTO/RPO? Is there a DR site? 24/7 SOC? | ❌ No DR, no SOC, Discord-only alerts, single-key pause | **DECLINE** |
| 10 | **Technology security** | Has the contract been penetration-tested? Bug bounty? | ⚠️ 30 Foundry tests + 158 invariants pass; no pen test, no bug bounty, no external audit | **CONDITIONAL** |

**Score: 0/5 unconditional declines met. 2/5 conditionals. 0/5 passes.**

A bank would not proceed past Pillar 1.

---

## 2. What a Bank Risk Committee Actually Asks (Detailed)

### Pillar 1 — Legal Entity & Jurisdiction

**Bank's question:** "If something goes wrong, who do we sue, and in which court?"

**Current state:** There is no legal entity. The protocol is a decentralized codebase with a deployer EOA (`0x3C3932F865892EFabE45892f453f81B64f6c8d8c`). There is no foundation, no LLC, no corporation, no registration with any regulator anywhere.

**Why banks care:** Banks cannot enter into a contract with "a smart contract." They need a counterparty entity that is:
- Incorporated in a recognized jurisdiction
- Registered with the relevant financial regulator (FINMA, FCA, SEC, MAS, etc.)
- Subject to service of process (they can be sued)
- Auditable (financial statements on file)

**The gap:** MTQΣ has none of this. The closest analog is the `CRITICAL-PRIVATE-KEY-ROTATION.md` file which acknowledges the deployer EOA is a problem but doesn't establish an entity.

**What's needed (estimated 3-6 months, $50K-150K):**
- Swiss Foundation (Stiftung) — CHF 20-40K setup, FINMA registration, 3-6 months
- OR Liechtenstein Trust — EUR 15-30K setup, FMA registration
- OR Cayman Exempted Company — USD 25-50K setup, CIMA registration
- Corporate bank account (requires the entity + KYC on directors)
- Legal opinion on token classification from a Magic Circle or top crypto firm ($20-50K)

---

### Pillar 2 — Regulatory Classification

**Bank's question:** "Is holding MTQΣ a banking-permitted activity? Do we need a crypto custody license? Is it a security we can't hold?"

**Current state:** No legal opinion exists. Self-assessment suggests:

**US — Howey test (likely a security):**
1. Investment of money: ✅ (USDC deposit)
2. Common enterprise: ✅ (shared reserve pool)
3. Expectation of profit: ⚠️ (the MASE rebalancing + gold tilt + "purchasing power preservation" language is ambiguous; the active reserve management by the keeper is "efforts of others")
4. Profit from efforts of others: ✅ (keeper + MASE engine actively manage)

**Likely conclusion:** MTQΣ is a security under US law. Banks generally cannot hold securities issued by unregistered entities for their own account. Broker-dealer affiliate required.

**EU — MiCA (likely an Asset-Referenced Token):**
- References a basket of 7 assets (6 fiat + gold)
- Not e-money token (not 1:1 fiat claim)
- Likely exceeds €5M threshold → "significant ART" status
- Requires: whitepaper (ESMA-filed), custody license, reserve segregation, quarterly attestations

**UK — FCA Cryptoasset Registration:**
- Required for any crypto-asset business operating from or into the UK
- MTQΣ has no FCA registration

**Why banks care:** A bank holding an unregistered security or an unlicensed ART faces:
- SEC enforcement (US): fines, disgorgement, cease-and-desist
- ESMA enforcement (EU): up to €5M or 10% of turnover
- FCA enforcement (UK): criminal prosecution, unlimited fines
- Personal liability for officers

**The gap:** Zero regulatory work done. No whitepaper, no legal opinion, no registration.

**What's needed (estimated 4-8 months, $100-300K):**
- Engage Latham & Watkins / Goodwin / Cooley / a16z crypto for Howey opinion
- MiCA ART whitepaper (legal drafting + ESMA submission)
- FCA crypto registration (if UK operations)
- Determine if a custody license is needed (likely yes under MiCA, OCC Interpretive Letter #1170)

---

### Pillar 3 — KYC/AML & Sanctions Screening

**Bank's question:** "Prove that every wallet that has ever minted/redeemed MTQΣ is not on a sanctions list. Show us the compliance log for the last 5 years."

**Current state:**
- `src/lib/mtq/sanctions.ts` exists as a **scaffold** with an explicit comment: "STATUS: SCAFFOLD — production deployment requires integration with TRM Labs or Chainalysis KYT (paid services, ~$2K-$10K/month)."
- The scaffold downloads the OFAC SDN CSV and does basic address matching — but it is **not wired to mint/redeem**. There is no on-chain KYC gate.
- The `/api/ai/screen` route does text NER (named entity recognition) on user-provided text — explicitly labeled "not a substitute for OFAC/EU/UN sanctions list checks."
- No wallet-level screening is enforced anywhere in the mint/redeem flow.

**Why banks care:** This is the single largest legal exposure. Under US law (IEEPA, 31 CFR Chapter V), any transaction with a sanctioned person or entity is a **felony**. Penalties:
- Criminal: up to 20 years imprisonment per violation
- Civil: up to $356,579 per violation (2026 inflation-adjusted)
- For banks: loss of banking charter

EU equivalent: Council Regulation (EU) 269/2014 — criminal penalties under member state law.

**The gap:** Zero production sanctions screening. The scaffold is not wired. Even if wired, a CSV download is not bank-grade — banks require:
- TRM Labs or Chainalysis KYT (real-time, risk-scored, with historical trace)
- Continuous re-screening (wallets can be sanctioned retroactively)
- Travel Rule compliance (FATF Recommendation 16) for transfers >$1,000
- Suspicious Activity Report (SAR) filing capability

**What's needed (estimated 1-2 months, $30-50K setup + $2-10K/month ongoing):**
- Integrate TRM Labs or Chainalysis KYT
- Wire `screenWallet()` to every mint/redeem API route
- Add on-chain KYC gate (merkle root of approved addresses, updated by KEEPER_ROLE)
- Implement Travel Rule messaging (FATF IVMS101 format)
- SAR filing workflow with compliance officer
- 5-year transaction log retention (FinCEN requirement)

---

### Pillar 4 — Custody & Collateral Arrangement

**Bank's question:** "Who holds the USDC backing MTQΣ? Is it bankruptcy-remote from the operator? Can a creditor of the operator seize it?"

**Current state:** The contract code at `MTQSigmaV2.sol:455` sets `reserveVault = msg.sender` (the deployer EOA). On mint (L1250), USDC is pulled via `transferFrom(msg.sender, reserveVault, usdcAmount)`. On redeem (L1318), USDC is sent from `reserveVault` back to the user.

**This means:**
- The deployer EOA holds all USDC collateral
- There is no qualified custodian (no Anchorage, Fireblocks, BitGo, Copper)
- There is no bankruptcy-remote structure (no SPV, no trust)
- If the deployer entity goes bankrupt, the USDC is in their estate — creditors can seize it
- There is no segregation between operational funds and customer collateral

**Why banks care:** This is the #1 reason banks won't touch crypto. The FDIC, OCC, and Federal Reserve have all issued guidance requiring that customer crypto assets be held by a qualified custodian, bankruptcy-remote from the exchange/operator. Key precedents:
- **Celsius** (2022): customer crypto was in Celsius's estate → customers lost ~$5B
- **FTX** (2022): customer crypto commingled with Alameda → $8B hole
- **BlockFi** (2022): commingled → bankruptcy

**The gap:** 100% of collateral is in a deployer EOA. This is the exact structure that caused Celsius and FTX failures.

**What's needed (estimated 2-4 months, $50-100K setup + $5-20K/month):**
- Engage a qualified custodian: Anchorage Digital, BitGo, Fireblocks, or Copper
- Restructure `reserveVault` to a multi-sig custodian address (e.g., Fireblocks MPC)
- Obtain a legal opinion on bankruptcy remoteness (typically a true-sale or trust opinion)
- Quarterly custodian attestations (BitGo provides proof-of-reserve)
- On-chain proof-of-reserve (Chainlink PoR feed or similar)
- Segregated accounts: customer collateral vs. operational treasury vs. fee wallet

---

### Pillar 5 — Insurance & Bond

**Bank's question:** "If the contract is hacked, is there insurance? If the operator rugs, is there a bond?"

**Current state:** None. Zero insurance. Zero bond. Zero coverage of any kind.

**Why banks care:** Banks carry D&O insurance, crime insurance, cyber insurance, and fidelity bonds. When they hold digital assets, they require equivalent coverage from the issuer:
- **Crime/custody policy**: covers theft of collateral (Lloyd's syndicates: Lloyd's of London, Aon, Marsh)
- **Smart contract insurance**: covers exploits (Nexus Mutual, InsurAce, Unslashed)
- **Surety bond**: covers operator misconduct (Fidelity, Travelers)
- **D&O insurance**: covers governance council personal liability

Typical coverage for a $10M TVL stablecoin: $50-100K/year premium for $5M coverage.

**The gap:** Nothing. If the contract is hacked, users lose everything. There is no recovery path.

**What's needed (estimated 1-2 months, $50-100K/year ongoing):**
- Crime + custody policy from a Lloyd's syndicate (via Aon or Marsh broker)
- Smart contract insurance on Nexus Mutual (decentralized, cheaper)
- Surety bond for the keeper operator ($1-5M)
- D&O insurance for governance council members

---

### Pillar 6 — External Audit

**Bank's question:** "Has a firm we recognize audited the contract? Show us the report with no unresolved findings."

**Current state:** Never audited externally. Internal audit (this report) found 12 critical blockers, 16 high, 17 medium, 9 low = 54 total findings.

**Why banks care:** Banks require external audits from firms on their approved vendor list. For crypto, the approved list is typically:
- **CertiK** (most prolific, but some banks discount their reports)
- **OpenZeppelin** (gold standard for contract security)
- **Trail of Bits** (preferred by US banks — they understand traditional security)
- **Spearbit** (preferred by DeFi-native institutions)
- **ConsenSys Diligence** (now MetaMask Security)
- **Hacken** (budget option, some banks accept)

A bank's risk committee will read the audit report. Unresolved findings = decline. High/critical findings = decline. No audit = automatic decline.

**The gap:** Zero external audits. The internal audit found 12 critical blockers — none of which a bank would accept.

**What's needed (estimated 2-3 months, $80-200K):**
- Engage Trail of Bits or OpenZeppelin (preferred for bank acceptance)
- Scope: MTQSigmaV2.sol + oracle adapters + keeper + off-chain engine
- Fix all 12 critical blockers first (Phase 0 — mostly done)
- Re-audit if any findings require code changes
- Publish the report publicly

---

### Pillar 7 — Reserve Transparency

**Bank's question:** "Can we independently verify the reserve at any moment? Is there a third-party attestation?"

**Current state:** Partial. The USDC collateral is visible on-chain (you can read the USDC balance of `reserveVault`). The contract's `getNAV()` function returns the reserve value. The §24 audit trail logs every state vector to Turso.

**But:**
- No proof-of-reserve attestation (no Chainlink PoR, no third-party auditor)
- The `reserveHeldUsd[]` array is **admin-set** via `setReserveHolding()` — it's a bookkeeping mirror, not a market-derived value. An admin could set Gold to $1B and fake 1000% RR.
- No real-time reserve verification (the on-chain balance is real, but the "7-component basket" is fictional — it's 100% USDC with bookkeeping entries)
- No segregation proof (can't prove the USDC isn't lent out elsewhere)

**Why banks care:** Banks do reserve verification daily. For stablecoins, they expect:
- Real-time on-chain proof of reserves (e.g., Chainlink PoR)
- Monthly third-party attestation (e.g., Big-4 auditor confirms USDC balance)
- Segregation proof (custodian confirms customer funds are separate)
- Haircut disclosure (what % of reserve is in cash vs. T-bills vs. MMF)

USDC (Circle) provides monthly attestations from Deloitte. USDe (Ethena) provides weekly from a Big-4. DAI (MakerDAO) provides real-time on-chain. MTQΣ provides none.

**The gap:** No attestation, no PoR, no segregation proof, admin-set reserve values.

**What's needed (estimated 1-2 months, $30-60K setup + $10-30K/quarter):**
- Integrate Chainlink Proof of Reserve (real-time on-chain)
- Monthly attestation from a Big-4 auditor (Deloitte, EY, PwC, KPMG)
- Custodian proof of segregation (BitGo/Fireblocks provides this)
- Remove `setReserveHolding()` admin override — derive from actual token balances

---

### Pillar 8 — Liquidity & Redemption Capacity

**Bank's question:** "If we put $10M in and want it back in 24 hours, can we get it? What's the price impact?"

**Current state:**
- No redemption queue
- No daily redemption cap
- No per-address cap
- No per-transaction cap
- No slippage parameter on `redeem()`
- No liquidity analysis (pool depth is hardcoded at $4M in the engine)
- In EMERGENCY state, redemptions pause entirely with no recovery path

**Why banks care:** A bank treasury won't hold an asset it can't exit. They model:
- **Redemption capacity**: maximum USD redeemable in 24h without >1% price impact
- **Bank-run scenario**: what if 30% of holders redeem in 48h?
- **Liquidity stress**: what if the underlying USDC itself depegs (as in March 2023)?

For USDC: Circle guarantees 1:1 redemption, $50M daily capacity, no slippage.
For DAI: MakerDAO PSM caps at $10M/block, 0.1% fee.
For MTQΣ: no guarantee, no cap, no analysis.

**The gap:** Zero liquidity management. A $10M redeem would drain the testnet reserve (which has ~$1.1M NAV). There is no redemption queue, no gradual gate, no circuit breaker on redemptions.

**What's needed (estimated 1-2 months):**
- Per-transaction cap (e.g., max $500K per redeem)
- Daily redemption cap (e.g., max 5% of NAV per 24h)
- Redemption queue (FIFO with 24-72h delay for >$1M)
- Slippage parameter on `redeem()` (user specifies `minUsdcOut`)
- Liquidity buffer (hold 20% of NAV in cash USDC, not in yield)
- Bank-run stress test (30% redeem in 48h — does RR stay >1.0?)
- USDC depeg contingency (what if USDC drops to $0.95?)

---

### Pillar 9 — Operational Resilience

**Bank's question:** "What's your RTO (Recovery Time Objective)? RPO (Recovery Point Objective)? Do you have a DR site? Is there a 24/7 SOC?"

**Current state:**
- **RTO:** undefined. If Turso goes down, there is no failover. The keeper can't write audit trail, but can still advance the index. If Vercel goes down, the UI is dark but the contract still works.
- **RPO:** undefined. Turso backup runs daily at 03:00 UTC. Worst case data loss = 24h. But the restore script doesn't exist (`RUNBOOK.md:125`: "restore-turso.ts is not yet implemented — use any SQLite JSON-import tool or hand-write the INSERT loop").
- **DR site:** none. Single Vercel deployment, single Turso region (us-east-1), single Koyeb keeper.
- **24/7 SOC:** none. Discord-only alerts. No PagerDuty. No named on-call rotation.
- **Key management:** single deployer EOA private key (leaked, in `upload/private_key.txt`). No HSM, no KMS, no M-of-N.

**Why banks care:** Banking regulators (FFIEC, DORA, MAS TRM) require:
- RTO ≤ 4 hours for critical systems
- RPO ≤ 1 hour for transaction data
- Geographically separated DR site
- 24/7 Security Operations Center
- Key management in HSMs (FIPS 140-2 Level 3 minimum)
- Annual disaster recovery exercises with documented results

**The gap:** None of these exist. The operational maturity is "two people with laptops and a Discord channel."

**What's needed (estimated 3-6 months, $100-300K setup + $50-100K/year):**
- HSM-based key management (AWS KMS, Azure Key Vault, or on-prem Thales)
- Multi-region deployment (Vercel + a backup on Cloudflare Pages)
- DR site in a different region (EU + US)
- PagerDuty or BetterStack 24/7 paging
- Named on-call rotation (primary + secondary, weekly)
- Quarterly DR exercise (documented, with RTO/RPO measurement)
- SOC 2 Type II audit (12-month observation period)

---

### Pillar 10 — Technology Security

**Bank's question:** "Has the contract been penetration-tested? Is there a bug bounty? What's your SDLC?"

**Current state:**
- 30 Foundry tests pass (unit + fuzz)
- 158 canonical invariant assertions pass
- No external penetration test
- No bug bounty program
- No formal SDLC (Software Development Lifecycle)
- Lint is advisory (`continue-on-error: true` in CI)
- Slither is advisory (nightly only, `continue-on-error: true`)
- No mainnet fork simulation in CI
- Layer 6 historical backtest has never been run

**Why banks care:** Banks require:
- External penetration test (annual, by an approved firm)
- Bug bounty (live for 30+ days before any institutional allocation)
- Formal SDLC (NIST 800-64 or ISO 12207)
- Code coverage ≥ 85% (line) + 100% (critical paths)
- Static analysis as a blocking CI gate (not advisory)
- Dynamic application security testing (DAST)
- Software composition analysis (SCA) — no critical CVEs in dependencies

**The gap:** Good unit test coverage but no institutional-grade security processes.

**What's needed (estimated 2-4 months, $50-150K):**
- External penetration test (Trail of Bits or Cure53)
- Bug bounty on Immunefi ($50K minimum pot, 30+ days before institutional)
- Blocking CI: lint, Slither, coverage threshold (85%)
- SCA: `bun audit` or Snyk, no critical CVEs
- Mainnet fork simulation in CI (anvil)
- DAST: run on every deployment

---

## 3. Comparison to Bank-Accepted Stablecoins

What would MTQΣ need to match the stablecoins banks actually use?

| Requirement | USDC (Circle) | USDe (Ethena) | DAI (MakerDAO) | MTQΣ (current) |
|---|---|---|---|---|
| Legal entity | ✅ Circle Internet Financial, LLC | ✅ Ethena Labs, Inc. | ✅ MakerDAO Foundation | ❌ None |
| Regulatory opinion | ✅ SEC counsel opinion | ✅ SEC counsel opinion | ✅ SEC counsel opinion | ❌ None |
| KYC/AML | ✅ Circle Verite + TRM | ✅ TRM Labs | ⚠️ Optional (DAO) | ❌ Scaffold only |
| Custodian | ✅ BNY Mellon + SVB | ✅ Copper + Fireblocks | ✅ Multiple | ❌ Deployer EOA |
| Insurance | ✅ $1B crime policy | ✅ Lloyd's policy | ⚠️ Nexus Mutual | ❌ None |
| External audit | ✅ Deloitte (quarterly) | ✅ EY (weekly) | ✅ Trail of Bits | ❌ Never |
| Proof of reserve | ✅ Monthly Deloitte attestation | ✅ Weekly EY attestation | ✅ Real-time on-chain | ❌ None |
| Redemption capacity | ✅ $50M/day, no slippage | ✅ Uncapped (spot+perp) | ⚠️ PSM cap $10M/block | ❌ No analysis |
| RTO/RPO | ✅ 4h/1h | ✅ 4h/1h | ⚠️ DAO-dependent | ❌ Undefined |
| 24/7 SOC | ✅ Circle SOC | ✅ Ethena SOC | ⚠️ DAO-dependent | ❌ Discord only |
| Bug bounty | ✅ $1M+ (Immunefi) | ✅ $500K (Immunific) | ✅ $1M (Immunefi) | ❌ None |
| Bank adoption | ✅ BNY, NY Mellon, State Street | ⚠️ Emerging | ⚠️ Limited | ❌ Zero |

**MTQΣ meets 0 of 12 bank-grade requirements.** USDC meets 12/12. This is the gap.

---

## 4. Test Suite Results (Bank-Grade Verification)

### What was tested

| Suite | Tests | Pass | Fail | Coverage |
|---|---|---|---|---|
| Foundry (Solidity) | 30 | 30 | 0 | ~70% contract lines |
| Canonical Invariants (TS) | 158 | 158 | 0 | ~45% engine.ts lines |
| No-Neon guardrail | 22 routes | 22 | 0 | 100% API routes |
| Honest Status | 1 | 1 | 0 | ✅ NOT PRODUCTION-AUTHORIZED |
| **Total** | **211** | **211** | **0** | **~50% overall** |

### What was NOT tested (critical for banks)

| Missing Test | Why Banks Require It |
|---|---|
| External penetration test | Proves the contract resists a motivated attacker |
| Mainnet fork simulation | Proves the contract works under real mainnet conditions |
| Layer 6 historical backtest (10 years) | Proves the monetary policy survives real market history |
| Bank-run stress test (30% redeem in 48h) | Proves the protocol doesn't collapse under stress |
| USDC depeg contingency | Proves what happens if the collateral itself fails (March 2023 precedent) |
| Property-based fuzzing (10K+ runs) | Proves invariants hold for arbitrary inputs, not just known cases |
| Integration test against real RPC | Proves the keeper + contract actually work together end-to-end |
| Chaos engineering game day | Proves the team can recover from a real incident |

**Bank standard:** All 8 of the above are required before a bank will allocate even 0.1% of AUM.

---

## 5. The Honest Scorecard

| Dimension | Bank Standard | MTQΣ Current | Gap |
|---|---|---|---|
| Legal entity | Regulated entity | None | 6 months |
| Regulatory opinion | Big-law opinion | None | 4-8 months |
| KYC/AML | TRM/Chainalysis live | Scaffold | 2 months |
| Custody | Qualified custodian | Deployer EOA | 2-4 months |
| Insurance | $50M+ policy | None | 1-2 months |
| External audit | Top-tier firm | None | 2-3 months |
| Proof of reserve | Monthly Big-4 attestation | None | 1-2 months |
| Liquidity management | $50M/day capacity | None | 1-2 months |
| Operational resilience | RTO 4h, 24/7 SOC | Discord only | 3-6 months |
| Technology security | Pen test + bug bounty | Internal tests only | 2-4 months |
| **Overall bank readiness** | **10/10** | **0/10** | **18-30 months** |

---

## 6. Recommendations — What to Build for Bank Acceptance

### Phase A — Bank-Prerequisite Build (Months 1-6, $400-700K)

This is the minimum to get a bank's risk committee to even read the dossier.

1. **Incorporate legal entity** (Month 1-3, $50-150K)
   - Swiss Foundation or Liechtenstein Trust
   - Corporate bank account
   - Director KYC

2. **Obtain legal opinions** (Month 1-4, $50-100K)
   - Howey test opinion (US)
   - MiCA ART whitepaper + ESMA filing (EU)
   - FCA crypto registration (UK, if applicable)

3. **Engage qualified custodian** (Month 2-4, $50K setup + $10K/month)
   - BitGo or Fireblocks (preferred for institutional)
   - Restructure `reserveVault` to custodian MPC address
   - Obtain bankruptcy remoteness opinion

4. **Integrate KYC/AML + sanctions** (Month 1-2, $30K + $5K/month)
   - TRM Labs or Chainalysis KYT
   - Wire to every mint/redeem
   - Travel Rule compliance
   - 5-year log retention

5. **Buy insurance** (Month 2-3, $50-100K/year)
   - Lloyd's crime/custody policy
   - Nexus Mutual smart contract coverage
   - D&O for governance council

6. **External audit** (Month 3-6, $80-200K)
   - Trail of Bits or OpenZeppelin
   - Fix all findings
   - Publish report

### Phase B — Bank-Grade Operations (Months 4-12, $200-400K/year ongoing)

7. **Proof of reserve** (Month 4-6, $30K + $30K/quarter)
   - Chainlink PoR (real-time)
   - Monthly Big-4 attestation

8. **Liquidity management** (Month 4-6, engineering only)
   - Per-tx cap, daily cap, redemption queue
   - Slippage parameter
   - Liquidity buffer (20% cash)
   - Bank-run stress test

9. **Operational resilience** (Month 4-9, $100-300K)
   - HSM key management
   - Multi-region DR
   - PagerDuty 24/7
   - SOC 2 Type II (12-month observation)

10. **Bug bounty + pen test** (Month 5-8, $50-150K)
    - Immunefi bug bounty ($50K+ pot)
    - External pen test (Cure53 or Trail of Bits)

### Phase C — Bank Onboarding (Months 10-18)

11. **Bank pilot allocation** (Month 10-12)
    - Find 1 bank willing to pilot (likely a crypto-friendly bank: Sygnum, SEBA, Anchorage)
    - Start with $100K allocation
    - 90-day observation period

12. **Gradual scale-up** (Month 12-18)
    - $100K → $1M → $10M → $50M
    - Each step requires bank risk committee re-approval
    - Public reference customer (bank on the website)

### Total Investment for Bank Acceptance

| Phase | Duration | One-time | Annual |
|---|---|---|---|
| A — Prerequisites | 6 months | $400-700K | — |
| B — Operations | 6 months | $200-400K | $200-400K |
| C — Onboarding | 8 months | — | — |
| **Total Year 1** | | **$600K-1.1M** | **$200-400K** |
| **Year 2+** | | — | **$200-400K** |

**This is the honest cost of bank acceptance.** The zero-cost testnet was appropriate for prototyping. Bank-grade infrastructure costs real money.

---

## 7. The Brutal Truth

### What MTQΣ has proven

The testnet pilot has successfully demonstrated:
- ✅ The 7-component GFB index math works (chain-linked, divisor-adjusted)
- ✅ The 6-state risk machine transitions correctly
- ✅ 4 testnet deployments are live and functional
- ✅ 211 tests pass (30 Foundry + 158 invariants + 22 guardrails + 1 honest status)
- ✅ The audit trail writes 20K+ rows to Turso
- ✅ Live FX feeds (8/8) + FRED integration
- ✅ The Phase 0 critical blockers (B1-B12) are largely fixed

This is genuinely impressive engineering for a testnet pilot. The monetary blueprint is thoughtful and the code quality is above average for DeFi.

### What MTQΣ has NOT proven

- ❌ That a bank would touch it (0/10 bank pillars met)
- ❌ That it can survive a real market stress event (Layer 6 backtest never run)
- ❌ That the collateral is safe from operator misconduct (deployer EOA custody)
- ❌ That a regulator would approve it (no legal entity, no opinion)
- ❌ That it has any insurance or recovery path if something goes wrong

### The honest recommendation

**For the COO/PM:**

1. **Do not approach any bank for at least 6 months.** The gap between current state and bank-acceptable state is 6-12 months and $400-700K. Approaching a bank now will result in an automatic decline and damage the relationship for future approaches.

2. **Prioritize Phase A (Bank Prerequisites) immediately.** The single highest-ROI item is incorporating a legal entity and obtaining a legal opinion. Without these, nothing else matters.

3. **Budget $600K-1.1M for Year 1.** This is the cost of bank-grade infrastructure. It is not optional. The zero-cost constraint was for testnet; bank acceptance requires real capital.

4. **Target a crypto-friendly bank for the first pilot.** Sygnum (Switzerland), SEBA (Switzerland), Anchorage Digital (US), or BlockBank (EU) are the most likely to pilot a novel stablecoin-like asset. Traditional banks (JPM, BofA, Citi) are 2-3 years away from touching anything like this.

5. **Plan for 18-24 months to first bank allocation.** Even with unlimited budget, bank procurement cycles are 6-12 months, risk committee reviews are quarterly, and pilot programs run 90-180 days. This is the honest timeline.

**The protocol is not ready for banks.** But with the right investment and timeline, it could be. The monetary design is sound. The engineering is competent. The gap is institutional infrastructure — and that gap is fillable with time and money.

---

*End of bank-grade audit. Full code-level findings are in `docs/MAINNET-AUDIT-REPORT.md` and `worklog.md` (Task IDs `MAINNET-AUDIT-1`, `MAINNET-AUDIT-2`, `B9-FIX`).*
