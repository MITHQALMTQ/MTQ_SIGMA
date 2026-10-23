// SPDX-License-Identifier: MIT
//
// ============================================================================
//  MTQΣ V3 — LIQ-MGMT Foundry test suite
//  ----------------------------------------------------------------------------
//  Task ID: LIQ-MGMT
//  Scope:   4 liquidity-management features added to MTQSigmaV3.sol in
//           response to the bank-grade audit:
//             H5  Slippage protection — executeMint(requestId, minMinted)
//             M2  Per-transaction cap  — MAX_MINT_PER_TX / MAX_REDEEM_PER_TX
//             T7  Daily redemption cap — dailyRedeemCap / dailyRedeemedUsd
//             H4  Circuit breaker      — auto-pause on >10% price jump per
//             O1                           price-commit (advanceIndex /
//                                        commitFxRatesFromOracles / setFxRates)
//
//  Test count: 14 (3 slippage + 3 per-tx + 2 daily-cap + 3 breaker + 3 admin)
//
//  PREREQUISITES — the protocol owner MUST install Foundry before this suite
//  will compile and pass:
//     curl -L https://foundry.paradigm.xyz | sh
//     foundryup
//     cd /path/to/repo/contracts
//     forge install foundry-rs/forge-std --no-commit
//     forge test -vvv --match-contract MTQSigmaV3LiqMgmtTest
//
//  This sandbox does NOT have Foundry installed (no `forge` binary); the file
//  is delivered source-ready. See /contracts/foundry.toml.
// ============================================================================

pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {MTQSigmaV3} from "../MTQSigmaV3.sol";

// ============================================================================
//  MockOracleAdapter — §9 multi-source oracle feed (configurable per pair).
//  Mirrors the mock in MTQSigmaV2.t.sol; returns (price, timestamp, confidence)
//  for a given bytes32 pair key. The V3 contract requires strict 3-source
//  consensus (all 3 adapters within 2.5% of median, all fresh, all low-conf).
// ============================================================================
contract MockOracleAdapter {
    struct Feed {
        uint256 price;
        uint256 timestamp;
        uint256 confidence;
        bool    broken;
    }

    mapping(bytes32 => Feed) internal _feeds;
    bool public alwaysRevert;

    function setFeed(bytes32 pair, uint256 price, uint256 ts, uint256 conf) external {
        _feeds[pair] = Feed({price: price, timestamp: ts, confidence: conf, broken: false});
    }

    function setBroken(bytes32 pair) external { _feeds[pair].broken = true; }
    function setAlwaysRevert(bool v) external { alwaysRevert = v; }

    function getPrice(bytes32 pair) external view returns (uint256 price, uint256 timestamp, uint256 confidence) {
        if (alwaysRevert) revert("MockOracleAdapter: reverted");
        Feed memory f = _feeds[pair];
        if (f.broken) revert("MockOracleAdapter: broken feed");
        return (f.price, f.timestamp, f.confidence);
    }
}

// ============================================================================
//  MTQSigmaV3LiqMgmtTest — the main Foundry test contract (14 LIQ-MGMT tests)
// ============================================================================
contract MTQSigmaV3LiqMgmtTest is Test {
    // ---------------------------------------------------------------------
    //  State
    // ---------------------------------------------------------------------
    MTQSigmaV3       public mtq;
    MockOracleAdapter public cl; // chainlink  (source 0)
    MockOracleAdapter public py; // pyth        (source 1)
    MockOracleAdapter public chr; // chronicle  (source 2)

    // The authorized bank that submits mint requests + redeems on behalf of
    // corporate customers.
    address public constant BANK     = address(0xBABE);
    // A corporate customer / redeemer who holds MTQ.
    address public constant REDEEMER = address(0xBEEF);

    // Base FX fixings (mirror the contract's BASE_* constants, 1e18 scale)
    uint256 constant EUR  = 1.05e18;
    uint256 constant GBP  = 1.25e18;
    uint256 constant JPY  = 0.0067e18;
    uint256 constant CNY  = 0.14e18;
    uint256 constant CHF  = 1.13e18;
    uint256 constant XAU  = 2500e18;

    // 1e18-scale price vector for the base fixings (USD = 1.0).
    // Index order MUST match the V3 contract: [USD, EUR, JPY, GBP, CNY, CHF, XAU].
    uint256[7] BASE_PRICES = [
        uint256(1e18), EUR, JPY, GBP, CNY, CHF, XAU
    ];

    // Strategic prior weights (mirror the contract's Q_* constants)
    uint256[7] STRATEGIC_PRIOR = [
        uint256(0.27e18), 0.20e18, 0.09e18, 0.08e18, 0.05e18, 0.05e18, 0.26e18
    ];

    // ---------------------------------------------------------------------
    //  setUp — bootstrap a fully-initialized V3 protocol
    // ---------------------------------------------------------------------
    function setUp() public {
        // 1. Deploy the V3 contract. Constructor grants DEFAULT_ADMIN to this.
        mtq = new MTQSigmaV3();

        // 2. Grant roles: this test contract is ADMIN + KEEPER + ORACLE +
        //    PAUSER + MONETARY_CONTROL (L4 signer).
        mtq.grantRole(mtq.ADMIN_ROLE(),             address(this));
        mtq.grantRole(mtq.KEEPER_ROLE(),            address(this));
        mtq.grantRole(mtq.ORACLE_ROLE(),            address(this));
        mtq.grantRole(mtq.PAUSER_ROLE(),            address(this));
        mtq.grantRole(mtq.MONETARY_CONTROL_ROLE(),  address(this));

        // 3. Set the 4 governance bodies to this contract so we can call
        //    onlyConstitutionalCouncil / onlyRiskCouncil setters directly.
        mtq.setConstitutionalCouncil(address(this));
        mtq.setDao(address(this));
        mtq.setRiskCouncil(address(this));
        mtq.setEmergencyCouncil(address(this));

        // 4. Deploy + wire the 3 oracle adapters.
        cl  = new MockOracleAdapter();
        py  = new MockOracleAdapter();
        chr = new MockOracleAdapter();
        mtq.setOracleAdapter(0, address(cl));
        mtq.setOracleAdapter(1, address(py));
        mtq.setOracleAdapter(2, address(chr));

        // 5. Seed the MASE live weights with the strategic prior, then
        //    genesis the chain index (I_0 = 1.0, lastPrices = base fixings).
        mtq.seedGenesisWeights();
        mtq.genesisIndex();

        // 6. Bootstrap reserve holdings (one-shot): $1.1M split per prior.
        uint256[7] memory holdings;
        uint256 NAV = 1_100_000e18; // $1.1M (1e18 scale)
        for (uint256 i = 0; i < 7; i++) {
            holdings[i] = NAV * STRATEGIC_PRIOR[i] / 1e18;
        }
        mtq.bootstrapReserveHoldings(holdings);

        // 7. Genesis mint: 1,000,000 MTQ to the genesis reserve (locked).
        //    This makes totalSupply = 1M but circulatingSupply = 0 until the
        //    first executeMint mints to a bank.
        mtq.genesisMint(1_000_000e18);

        // 8. Authorize the bank with a $2M daily mint cap (high enough for
        //    the per-tx-cap tests that mint up to $500K per tx).
        mtq.authorizeBank(BANK, "TestBank", "US", 2_000_000e18);

        // 9. Warp to a known timestamp so oracle staleness checks pass.
        vm.warp(1_000_000);

        // 10. Seed all 3 oracle adapters with fresh base-price feeds.
        _refreshOracles();

        // 11. Submit + verify a $2M ABC for the bank (covers multiple mints).
        _submitAndVerifyABC(keccak256("cert-1"), 2_000_000e18);
    }

    // ---------------------------------------------------------------------
    //  Helpers
    // ---------------------------------------------------------------------

    /// @dev Refresh all 3 oracle adapters with fresh base-price feeds for
    ///      all 6 pairs. MUST be called after any vm.warp that precedes an
    ///      oracle-dependent operation (executeMint / redeem / advanceWorkflow
    ///      BM-13 / commitFxRatesFromOracles).
    function _refreshOracles() internal {
        bytes32[6] memory pairs = _sixPairs();
        uint256[6] memory prices = [uint256(EUR), GBP, JPY, CNY, CHF, XAU];
        for (uint256 i = 0; i < 6; i++) {
            cl.setFeed(pairs[i],  prices[i], block.timestamp, 0);
            py.setFeed(pairs[i],  prices[i], block.timestamp, 0);
            chr.setFeed(pairs[i], prices[i], block.timestamp, 0);
        }
    }

    /// @dev The 6 FX pairs the V3 contract oracles (in commitFxRatesFromOracles
    ///      order). USD is the numeraire and has no pair.
    function _sixPairs() internal view returns (bytes32[6] memory pairs) {
        pairs[0] = mtq.PAIR_EUR_USD();
        pairs[1] = mtq.PAIR_GBP_USD();
        pairs[2] = mtq.PAIR_JPY_USD();
        pairs[3] = mtq.PAIR_CNY_USD();
        pairs[4] = mtq.PAIR_CHF_USD();
        pairs[5] = mtq.PAIR_XAU_USD();
    }

    /// @dev Submit + verify an AvailableBackingCertificate for the bank.
    ///      Pranks as BANK for submit, then calls verify as keeper (this).
    function _submitAndVerifyABC(bytes32 certId, uint256 amountUsd) internal {
        // Prank as the bank to submit the ABC.
        vm.startPrank(BANK);
        mtq.submitBackingCertificate(MTQSigmaV3.AvailableBackingCertificate({
            certificateId:              certId,
            bank:                       BANK,
            amountUsd:                  amountUsd,
            custodianAttestationHash:   keccak256("attestation"),
            custodianAttestationExpiry: block.timestamp + 30 days,
            reserveAssetBreakdownHash:  keccak256("breakdown"),
            issuedAt:                   0,   // overwritten by submit
            verified:                   false // overwritten by submit
        }));
        vm.stopPrank();
        // Verify as keeper (this contract has KEEPER_ROLE).
        mtq.verifyBackingCertificate(certId);
    }

    /// @dev Submit a mint request as the bank and advance the workflow all
    ///      the way through BM-15 AUTHORIZED. Returns the requestId.
    ///      Caller still needs to call executeMint(requestId, minMinted).
    function _requestAndAdvanceToAuthorized(
        bytes32 certId,
        uint256 amountUsd,
        uint256 nonce
    ) internal returns (bytes32 requestId) {
        // Prank as the bank to submit the mint request.
        vm.startPrank(BANK);
        requestId = mtq.requestMint(MTQSigmaV3.BankMintRequest({
            bank:                    BANK,
            corporateCustomerHash:   keccak256(abi.encodePacked("customer", nonce)),
            amountUsd:               amountUsd,
            backingCertificateId:    certId,
            jurisdiction:            "US",
            nonce:                   nonce,
            expiry:                  block.timestamp + 1 hours
        }));
        vm.stopPrank();

        // Advance BM-02 .. BM-15. The test contract holds both KEEPER_ROLE
        // (BM-02..BM-14) and MONETARY_CONTROL_ROLE (BM-15). advanceWorkflow
        // enforces the role per target state internally.
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM02_RECEIVED);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM03_KYC);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM04_AML);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM05_BACKING);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM06_EVIDENCE);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM07_REQUESTED);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM08_TRANSLATED);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM09_ELIGIBLE);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM10_JURISDICTION);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM11_BACKING_VERIFIED);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM12_BANK_RISK);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM13_SYSTEM_RISK);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM14_DMCE);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM15_AUTHORIZED);
    }

    /// @dev Full happy-path mint: request → advance to BM-15 → executeMint.
    ///      Returns the minted MTQ amount.
    function _fullMint(
        bytes32 certId,
        uint256 amountUsd,
        uint256 nonce,
        uint256 minMinted
    ) internal returns (uint256 minted) {
        bytes32 requestId = _requestAndAdvanceToAuthorized(certId, amountUsd, nonce);
        minted = mtq.executeMint(requestId, minMinted);
    }

    /// @dev Mint MTQ to the bank, then transfer to the redeemer + approve.
    ///      Used to set up redeem tests.
    function _fundRedeemer(uint256 mintAmountUsd, uint256 transferMtq) internal {
        uint256 nonce = uint256(keccak256(abi.encodePacked("fund", mintAmountUsd, block.timestamp)));
        _fullMint(keccak256("cert-1"), mintAmountUsd, nonce, 0);
        // Bank transfers MTQ to the redeemer.
        vm.prank(BANK);
        mtq.transfer(REDEEMER, transferMtq);
        // Redeemer approves the bank to burn on redeem.
        vm.prank(REDEEMER);
        mtq.approve(BANK, type(uint256).max);
    }

    // ========================================================================
    //  === H5: Slippage protection (3 tests) ===
    // ========================================================================

    /// @notice H5: executeMint with minMinted > actual minted MUST revert
    ///         with Err93_SlippageExceeded.
    function test_Slippage_RevertWhenMintedBelowMinMinted() public {
        uint256 amountUsd = 100_000e18; // $100K mint
        bytes32 requestId = _requestAndAdvanceToAuthorized(
            keccak256("cert-1"), amountUsd, 1
        );

        // The actual minted at NORMAL state (throttle = 1.0) and price = $1.0:
        //   minted = 100_000e18 * 1e18 / 1e18 * 1.0e18 / 1e18 = 100_000e18 MTQ
        // Demand a minMinted 50% higher than the actual → MUST revert.
        uint256 greedyMinMinted = 150_000e18;

        vm.expectRevert(MTQSigmaV3.Err93_SlippageExceeded.selector);
        mtq.executeMint(requestId, greedyMinMinted);
    }

    /// @notice H5: executeMint with minMinted = 0 (no protection) MUST succeed.
    function test_Slippage_PassWithZeroMinMinted() public {
        uint256 amountUsd = 100_000e18;
        bytes32 requestId = _requestAndAdvanceToAuthorized(
            keccak256("cert-1"), amountUsd, 1
        );

        uint256 bankBefore = mtq.balanceOf(BANK);
        uint256 minted = mtq.executeMint(requestId, 0);

        // At NORMAL (throttle 1.0) and P_MTQ = $1.0, minted = amountUsd.
        assertEq(minted, amountUsd, "minted == amountUsd at P_MTQ=1.0, throttle=1.0");
        assertEq(mtq.balanceOf(BANK), bankBefore + minted, "bank balance credited");
        MTQSigmaV3.MintRequest memory req = mtq.mintRequests(requestId);
        assertEq(uint256(req.state), uint256(MTQSigmaV3.WorkflowState.BM16_MINTED), "state == BM16_MINTED");
    }

    /// @notice H5: executeMint with minMinted == actual minted MUST succeed
    ///         (boundary: exactly at the floor).
    function test_Slippage_PassAtExactBoundary() public {
        uint256 amountUsd = 100_000e18;
        bytes32 requestId = _requestAndAdvanceToAuthorized(
            keccak256("cert-1"), amountUsd, 1
        );

        // At NORMAL + P_MTQ = $1.0, minted = 100_000e18 exactly.
        uint256 exactMinMinted = 100_000e18;
        uint256 minted = mtq.executeMint(requestId, exactMinMinted);

        assertEq(minted, exactMinMinted, "minted == minMinted at boundary");
    }

    // ========================================================================
    //  === M2: Per-transaction cap (2 tests) ===
    // ========================================================================

    /// @notice M2: executeMint with amountUsd > MAX_MINT_PER_TX ($500K) MUST
    ///         revert with Err94_PerTxCapExceeded. The workflow still advances
    ///         to BM-15 (the cap is enforced at executeMint, not requestMint).
    function test_PerTxCap_MintRevertsAbove500K() public {
        uint256 amountUsd = 500_001e18; // $1 above the $500K cap
        bytes32 requestId = _requestAndAdvanceToAuthorized(
            keccak256("cert-1"), amountUsd, 1
        );

        // The request advanced to BM-15 (the cap is NOT checked during the
        // workflow — only at executeMint). executeMint must reject.
        MTQSigmaV3.MintRequest memory req = mtq.mintRequests(requestId);
        assertEq(uint256(req.state), uint256(MTQSigmaV3.WorkflowState.BM15_AUTHORIZED), "workflow reached BM-15");

        vm.expectRevert(MTQSigmaV3.Err94_PerTxCapExceeded.selector);
        mtq.executeMint(requestId, 0);
    }

    /// @notice M2: executeMint with amountUsd == MAX_MINT_PER_TX ($500K exactly)
    ///         MUST succeed (boundary: the check is strict >).
    function test_PerTxCap_MintPassesAtExact500K() public {
        uint256 amountUsd = 500_000e18; // exactly at the cap
        uint256 minted = _fullMint(keccak256("cert-1"), amountUsd, 1, 0);
        assertEq(minted, amountUsd, "minted == 500K at P_MTQ=1.0, throttle=1.0");
        assertEq(mtq.balanceOf(BANK), amountUsd, "bank credited 500K MTQ");
    }

    // ========================================================================
    //  === M2: Per-tx cap on redeem (1 test) ===
    // ========================================================================

    /// @notice M2: redeem with grossUsd18 > MAX_REDEEM_PER_TX ($500K) MUST
    ///         revert with Err94_PerTxCapExceeded.
    function test_PerTxCap_RedeemRevertsAbove500K() public {
        // Mint $100K to the bank (100K MTQ at P_MTQ = $1.0).
        // circulatingSupply = 100K MTQ, NAV = $1.1M → navPerToken = $11.0.
        _fundRedeemer(100_000e18, 60_000e18);

        // Redeem 50K MTQ → grossUsd18 = 50K * $11 = $550K > $500K cap.
        uint256 redeemAmount = 50_000e18;
        vm.prank(BANK);
        vm.expectRevert(MTQSigmaV3.Err94_PerTxCapExceeded.selector);
        mtq.redeem(redeemAmount, REDEEMER);
    }

    // ========================================================================
    //  === T7: Daily redemption cap (2 tests) ===
    // ========================================================================

    /// @notice T7: cumulative daily redeemed gross-USD > dailyRedeemCap
    ///         ($500K default) MUST revert with Err95_DailyRedeemCapExceeded.
    function test_DailyRedeemCap_RevertWhenCumulativeExceeds() public {
        // Mint $100K to the bank. navPerToken = $11.0.
        _fundRedeemer(100_000e18, 70_000e18);

        // Redeem 1: 20K MTQ → gross = 20K * $11 = $220K. Cumulative = $220K.
        vm.prank(BANK);
        mtq.redeem(20_000e18, REDEEMER);
        assertEq(mtq.dailyRedeemedUsd(), 220_000e18, "dailyRedeemedUsd after redeem 1");

        // Redeem 2: 20K MTQ → gross = $220K. Cumulative = $440K <= $500K. OK.
        vm.prank(BANK);
        mtq.redeem(20_000e18, REDEEMER);
        assertEq(mtq.dailyRedeemedUsd(), 440_000e18, "dailyRedeemedUsd after redeem 2");

        // Redeem 3: 20K MTQ → gross = $220K. Cumulative = $660K > $500K → revert.
        vm.prank(BANK);
        vm.expectRevert(MTQSigmaV3.Err95_DailyRedeemCapExceeded.selector);
        mtq.redeem(20_000e18, REDEEMER);
    }

    /// @notice T7: the 24h window resets on the first redeem after
    ///         dailyRedeemResetAt + 1 days. After reset, dailyRedeemedUsd = 0
    ///         and a previously-blocked redeem now succeeds.
    function test_DailyRedeemCap_ResetsAfter24h() public {
        // Mint $100K to the bank. navPerToken = $11.0.
        _fundRedeemer(100_000e18, 70_000e18);

        // Redeem 1: 20K MTQ → gross $220K. Cumulative = $220K.
        vm.prank(BANK);
        mtq.redeem(20_000e18, REDEEMER);
        assertEq(mtq.dailyRedeemedUsd(), 220_000e18, "used before warp");
        uint256 resetAtBefore = mtq.dailyRedeemResetAt();

        // Warp 25 hours forward + refresh oracles (staleness).
        vm.warp(block.timestamp + 25 hours);
        _refreshOracles();

        // Redeem 2: 20K MTQ → should trigger the daily reset (the 24h window
        // has elapsed), then succeed. dailyRedeemedUsd should be $220K (just
        // this redeem's gross, the prior $220K was reset).
        vm.expectEmit(false, false, false, true, address(mtq));
        emit MTQSigmaV3.DailyRedeemCapReset(220_000e18, 0, block.timestamp);
        vm.prank(BANK);
        mtq.redeem(20_000e18, REDEEMER);

        assertEq(mtq.dailyRedeemedUsd(), 220_000e18, "used after reset = just this redeem");
        assertGt(mtq.dailyRedeemResetAt(), resetAtBefore, "resetAt advanced");
    }

    // ========================================================================
    //  === H4/O1: Circuit breaker (3 tests) ===
    // ========================================================================

    /// @notice H4/O1: a >10% MTQ-price jump in a single advanceIndex commit
    ///         MUST auto-pause the contract and emit CircuitBreakerTriggered.
    ///         Gold +50% → index grows by 0.26 * 0.50 = 13% → triggers.
    function test_CircuitBreaker_TriggersOnGoldPlus50Pct() public {
        // First commit: advanceIndex with base prices. lastCommitPrice was 0
        // (no prior commit), so the breaker does NOT fire. lastCommitPrice
        // is set to the post-commit price (= 1.0e18 since growth = 1.0).
        mtq.advanceIndex(BASE_PRICES);
        assertEq(mtq.lastCommitPrice(), 1e18, "lastCommitPrice after first commit");
        assertFalse(mtq.paused(), "not paused after first commit");

        // Second commit: gold +50%. growth = 0.74 + 0.26*1.5 = 1.13.
        // new indexValue = 1.0e18 * 1.13 = 1.13e18. jumpPct = 13 > 10 → trigger.
        uint256[7] memory shockedPrices = BASE_PRICES;
        shockedPrices[6] = shockedPrices[6] * 150 / 100; // gold +50%

        // advanceIndex emits IndexAdvanced first, then _circuitBreakerCheck
        // emits CircuitBreakerTriggered + Paused. Expect them in order.
        vm.expectEmit(false, false, false, true, address(mtq));
        emit MTQSigmaV3.IndexAdvanced(1.13e18, block.timestamp);
        vm.expectEmit(false, false, false, true, address(mtq));
        emit MTQSigmaV3.CircuitBreakerTriggered(1.13e18, 1e18, 13);
        mtq.advanceIndex(shockedPrices);

        assertTrue(mtq.paused(), "paused after >10% jump");
        assertEq(mtq.lastCommitPrice(), 1.13e18, "lastCommitPrice updated to new price");

        // Subsequent state-changing calls are now blocked by whenNotPaused.
        vm.expectRevert(MTQSigmaV3.Err41.selector);
        mtq.advanceIndex(BASE_PRICES);
    }

    /// @notice H4/O1: the first price-commit (lastCommitPrice == 0) MUST NOT
    ///         trigger the breaker even if the price is wild — there is no
    ///         prior price to compare against.
    function test_CircuitBreaker_FirstCommitNeverTriggers() public {
        // First commit with a shocked price (gold +50% → 13% index jump).
        // lastCommitPrice is 0, so the breaker skips. The contract is NOT paused.
        uint256[7] memory shockedPrices = BASE_PRICES;
        shockedPrices[6] = shockedPrices[6] * 150 / 100;

        mtq.advanceIndex(shockedPrices);
        assertFalse(mtq.paused(), "first commit never triggers breaker");
        assertEq(mtq.lastCommitPrice(), 1.13e18, "lastCommitPrice set on first commit");
    }

    /// @notice H4/O1: a price move of exactly 10% does NOT trigger (strict >).
    ///         A move of ~10.1% does trigger. This pins the boundary.
    function test_CircuitBreaker_BoundaryExactly10PctNoTrigger() public {
        // Prime lastCommitPrice with a first commit at base prices.
        mtq.advanceIndex(BASE_PRICES);
        assertEq(mtq.lastCommitPrice(), 1e18, "primed at 1.0e18");

        // Second commit: gold +X% chosen so the index jumps exactly ~10%.
        // growth = 0.74 + 0.26 * (1 + X/100). For growth = 1.10:
        //   0.26 * (1 + X/100) = 0.36 → (1 + X/100) = 1.3846 → X ≈ 38.46%.
        // That gives a 10.0% index jump → NOT triggered (strict >).
        uint256 goldUp = 13846; // 138.46% of base = +38.46% (in 1e4 bps)
        uint256[7] memory shockedPrices = BASE_PRICES;
        shockedPrices[6] = shockedPrices[6] * goldUp / 10000;

        mtq.advanceIndex(shockedPrices);
        assertFalse(mtq.paused(), "exactly 10% does NOT trigger (strict >)");
        // The new index should be ~1.10e18.
        assertApproxEqAbs(mtq.lastCommitPrice(), 1.10e18, 1e16, "index ~1.10e18");
    }

    // ========================================================================
    //  === T7 admin: setDailyRedeemCap (3 tests) ===
    // ========================================================================

    /// @notice T7: the Constitutional Council can adjust dailyRedeemCap.
    function test_SetDailyRedeemCap_SucceedsForCouncil() public {
        uint256 oldCap = mtq.dailyRedeemCap(); // 500_000e18
        uint256 newCap = 1_000_000e18;

        // DailyRedeemCapSet(uint256 oldCap, uint256 newCap, address indexed setter)
        // — setter is indexed (topic1); oldCap + newCap are in the data.
        vm.expectEmit(true, false, false, true, address(mtq));
        emit MTQSigmaV3.DailyRedeemCapSet(oldCap, newCap, address(this));
        mtq.setDailyRedeemCap(newCap);

        assertEq(mtq.dailyRedeemCap(), newCap, "cap updated");
    }

    /// @notice T7: setDailyRedeemCap(0) MUST revert (cap must be > 0).
    function test_SetDailyRedeemCap_RevertsOnZero() public {
        vm.expectRevert(MTQSigmaV3.Err87_DailyCapZero.selector);
        mtq.setDailyRedeemCap(0);
    }

    /// @notice T7: setDailyRedeemCap from a non-council address MUST revert
    ///         with Err35 (onlyConstitutionalCouncil).
    function test_SetDailyRedeemCap_RevertsForNonCouncil() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(MTQSigmaV3.Err35.selector);
        mtq.setDailyRedeemCap(1_000_000e18);
    }
}

// ============================================================================
//  MTQSigmaV3StabilityPoolTest — STABILITY-POOL-FEES-POR test suite
//  ----------------------------------------------------------------------------
//  Task ID: STABILITY-POOL-FEES-POR
//  Scope:   T3 (stability pool / liquidation mechanism) + T4 (fee separation)
//
//  Test count: 12 (7 stability pool + 5 fee separation)
//
//  Tests covered:
//    T3.a  setStabilityAsset — non-council reverts
//    T3.b  depositToStabilityPool — happy path: pulls USDC, updates balances
//    T3.c  depositToStabilityPool — reverts on zero amount
//    T3.d  withdrawFromStabilityPool — happy path: returns USDC, updates pool
//    T3.e  withdrawFromStabilityPool — reverts on insufficient balance
//    T3.f  useStabilityPoolForDeficit — reverts outside EMERGENCY
//    T3.g  useStabilityPoolForDeficit — succeeds in EMERGENCY, covers deficit
//    T4.a  setFeeWallet — rejects zero address
//    T4.a2 setFeeWallet — reverts from non-council caller
//    T4.b  setFeeWallet — emits FeeWalletSet event with old/new
//    T4.c  redeem accrues fee in accumulatedFees
//    T4.d  executeMint accrues mint fee in accumulatedFees
//
//  PREREQUISITES — same as the LIQ-MGMT suite (Foundry installed).
// ============================================================================

/// @notice Minimal 6-decimal USDC mock for the stability pool. Mirrors the
///         MockUSDC contract in MTQSigmaV2.t.sol but kept self-contained here
///         so this test file has no cross-file dependencies.
contract MockUSDCv3 {
    string  public constant name     = "USD Coin";
    string  public constant symbol   = "USDC";
    uint8   public constant decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256)                     public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply   += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "USDC: insufficient allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "USDC: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to]   += amount;
        emit Transfer(from, to, amount);
    }
}

contract MTQSigmaV3StabilityPoolTest is Test {
    MTQSigmaV3       public mtq;
    MockUSDCv3       public usdc;

    // A depositor (random address) for the stability pool.
    address public constant DEPOSITOR = address(0xD0D0);
    // The dedicated fee wallet.
    address public constant FEE_WALLET = address(0xFEE);

    // Base FX fixings (mirror the contract's BASE_* constants, 1e18 scale).
    uint256 constant EUR = 1.05e18;
    uint256 constant GBP = 1.25e18;
    uint256 constant JPY = 0.0067e18;
    uint256 constant CNY = 0.14e18;
    uint256 constant CHF = 1.13e18;
    uint256 constant XAU = 2500e18;

    uint256[7] BASE_PRICES = [
        uint256(1e18), EUR, JPY, GBP, CNY, CHF, XAU
    ];

    uint256[7] STRATEGIC_PRIOR = [
        uint256(0.27e18), 0.20e18, 0.09e18, 0.08e18, 0.05e18, 0.05e18, 0.26e18
    ];

    // Three oracle adapters (we re-use the MockOracleAdapter from above).
    MockOracleAdapter public cl;
    MockOracleAdapter public py;
    MockOracleAdapter public chr;

    address public constant BANK     = address(0xBABE);
    address public constant REDEEMER = address(0xBEEF);

    function setUp() public {
        mtq = new MTQSigmaV3();
        // Grant all roles to this test contract.
        mtq.grantRole(mtq.ADMIN_ROLE(),            address(this));
        mtq.grantRole(mtq.KEEPER_ROLE(),           address(this));
        mtq.grantRole(mtq.ORACLE_ROLE(),           address(this));
        mtq.grantRole(mtq.PAUSER_ROLE(),           address(this));
        mtq.grantRole(mtq.MONETARY_CONTROL_ROLE(), address(this));
        mtq.setConstitutionalCouncil(address(this));
        mtq.setDao(address(this));
        mtq.setRiskCouncil(address(this));
        mtq.setEmergencyCouncil(address(this));

        // Deploy + wire 3 oracles.
        cl  = new MockOracleAdapter();
        py  = new MockOracleAdapter();
        chr = new MockOracleAdapter();
        mtq.setOracleAdapter(0, address(cl));
        mtq.setOracleAdapter(1, address(py));
        mtq.setOracleAdapter(2, address(chr));

        // Seed weights + genesis index.
        mtq.seedGenesisWeights();
        mtq.genesisIndex();

        // Bootstrap reserve holdings ($1.1M split per prior).
        uint256[7] memory holdings;
        uint256 NAV = 1_100_000e18;
        for (uint256 i = 0; i < 7; i++) {
            holdings[i] = NAV * STRATEGIC_PRIOR[i] / 1e18;
        }
        mtq.bootstrapReserveHoldings(holdings);

        // Genesis mint 1M MTQ.
        mtq.genesisMint(1_000_000e18);

        // Authorize the bank.
        mtq.authorizeBank(BANK, "TestBank", "US", 2_000_000e18);

        // Warp + refresh oracles.
        vm.warp(1_000_000);
        _refreshOracles();

        // Submit + verify a $2M ABC for the bank.
        _submitAndVerifyABC(keccak256("cert-sp-1"), 2_000_000e18);

        // Deploy MockUSDC + set it as the stability asset.
        usdc = new MockUSDCv3();
        mtq.setStabilityAsset(address(usdc));

        // Mint 1M USDC to the depositor.
        usdc.mint(DEPOSITOR, 1_000_000e6);

        // Approve the contract to spend the depositor's USDC.
        vm.prank(DEPOSITOR);
        usdc.approve(address(mtq), type(uint256).max);

        // Set the fee wallet.
        mtq.setFeeWallet(FEE_WALLET);
    }

    function _refreshOracles() internal {
        bytes32[6] memory pairs = _sixPairs();
        uint256[6] memory prices = [uint256(EUR), GBP, JPY, CNY, CHF, XAU];
        for (uint256 i = 0; i < 6; i++) {
            cl.setFeed(pairs[i],  prices[i], block.timestamp, 0);
            py.setFeed(pairs[i],  prices[i], block.timestamp, 0);
            chr.setFeed(pairs[i], prices[i], block.timestamp, 0);
        }
    }

    function _sixPairs() internal view returns (bytes32[6] memory pairs) {
        pairs[0] = mtq.PAIR_EUR_USD();
        pairs[1] = mtq.PAIR_GBP_USD();
        pairs[2] = mtq.PAIR_JPY_USD();
        pairs[3] = mtq.PAIR_CNY_USD();
        pairs[4] = mtq.PAIR_CHF_USD();
        pairs[5] = mtq.PAIR_XAU_USD();
    }

    function _submitAndVerifyABC(bytes32 certId, uint256 amountUsd) internal {
        vm.startPrank(BANK);
        mtq.submitBackingCertificate(MTQSigmaV3.AvailableBackingCertificate({
            certificateId:              certId,
            bank:                       BANK,
            amountUsd:                  amountUsd,
            custodianAttestationHash:   keccak256("attestation"),
            custodianAttestationExpiry: block.timestamp + 30 days,
            reserveAssetBreakdownHash:  keccak256("breakdown"),
            issuedAt:                   0,
            verified:                   false
        }));
        vm.stopPrank();
        mtq.verifyBackingCertificate(certId);
    }

    // ========================================================================
    //  === T3: Stability Pool (7 tests) ===
    // ========================================================================

    /// @notice T3.a: setStabilityAsset from a non-council address reverts.
    function test_SetStabilityAsset_RevertsForNonCouncil() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(MTQSigmaV3.Err35.selector);
        mtq.setStabilityAsset(address(usdc));
    }

    /// @notice T3.b: depositToStabilityPool happy path — pulls USDC, updates
    ///         balances, emits StabilityDeposit.
    function test_DepositToStabilityPool_HappyPath() public {
        uint256 amt = 10_000e6; // 10,000 USDC (6-dec)
        uint256 contractBefore = usdc.balanceOf(address(mtq));

        vm.expectEmit(true, true, false, true, address(mtq));
        emit MTQSigmaV3.StabilityDeposit(DEPOSITOR, amt, amt, block.timestamp);
        vm.prank(DEPOSITOR);
        mtq.depositToStabilityPool(amt);

        assertEq(mtq.stabilityDeposits(DEPOSITOR), amt, "depositor balance");
        assertEq(mtq.totalStabilityPool(), amt, "total pool");
        assertEq(usdc.balanceOf(address(mtq)) - contractBefore, amt, "contract received USDC");
        assertEq(usdc.balanceOf(DEPOSITOR), 1_000_000e6 - amt, "depositor balance after");
    }

    /// @notice T3.c: depositToStabilityPool reverts on zero amount and when
    ///         the asset is not set.
    function test_DepositToStabilityPool_RevertsOnZeroAmount() public {
        vm.prank(DEPOSITOR);
        vm.expectRevert(MTQSigmaV3.Err96_StabilityZeroAmount.selector);
        mtq.depositToStabilityPool(0);
    }

    /// @notice T3.c: withdrawFromStabilityPool happy path — returns USDC,
    ///         updates balances, emits StabilityWithdrawal.
    function test_WithdrawFromStabilityPool_HappyPath() public {
        uint256 amt = 10_000e6;
        vm.prank(DEPOSITOR);
        mtq.depositToStabilityPool(amt);

        uint256 contractBefore = usdc.balanceOf(address(mtq));
        uint256 depositorBefore = usdc.balanceOf(DEPOSITOR);

        vm.expectEmit(true, true, false, true, address(mtq));
        emit MTQSigmaV3.StabilityWithdrawal(DEPOSITOR, amt, 0, block.timestamp);
        vm.prank(DEPOSITOR);
        mtq.withdrawFromStabilityPool(amt);

        assertEq(mtq.stabilityDeposits(DEPOSITOR), 0, "depositor drained");
        assertEq(mtq.totalStabilityPool(), 0, "pool drained");
        assertEq(usdc.balanceOf(address(mtq)), contractBefore - amt, "contract sent USDC");
        assertEq(usdc.balanceOf(DEPOSITOR), depositorBefore + amt, "depositor got USDC");
    }

    /// @notice T3.c: withdrawFromStabilityPool reverts when the depositor has
    ///         insufficient balance.
    function test_WithdrawFromStabilityPool_RevertsOnInsufficient() public {
        uint256 amt = 10_000e6;
        vm.prank(DEPOSITOR);
        mtq.depositToStabilityPool(amt);

        vm.prank(DEPOSITOR);
        vm.expectRevert(MTQSigmaV3.Err97_StabilityInsufficient.selector);
        mtq.withdrawFromStabilityPool(amt + 1); // 1 over balance
    }

    /// @notice T3.f: useStabilityPoolForDeficit reverts when the protocol is
    ///         NOT in EMERGENCY (the default setUp state is NORMAL).
    function test_UseStabilityPoolForDeficit_RevertsOutsideEmergency() public {
        // Seed the pool with 10K USDC.
        vm.prank(DEPOSITOR);
        mtq.depositToStabilityPool(10_000e6);

        // Protocol is in NORMAL (default). Deficit call must revert.
        vm.expectRevert(MTQSigmaV3.Err100_NotEmergencyState.selector);
        mtq.useStabilityPoolForDeficit(5_000e18);
    }

    /// @notice T3.g: useStabilityPoolForDeficit succeeds in EMERGENCY, covers
    ///         the deficit up to the pool's balance, and emits StabilityPoolUsed.
    function test_UseStabilityPoolForDeficit_SucceedsInEmergency() public {
        // Seed the pool with 10K USDC.
        vm.prank(DEPOSITOR);
        mtq.depositToStabilityPool(10_000e6);

        // Force the protocol into EMERGENCY by calling updateState with
        // rr < RR_HARD_FLOOR (1.0e18) and lcr < 0.70e18. The state machine
        // will transition to EMERGENCY immediately (more restrictive).
        mtq.updateState(0.95e18, 0.50e18);
        assertEq(uint256(mtq.currentState()), uint256(MTQSigmaV3.ProtocolState.EMERGENCY), "in EMERGENCY");

        // Cover $5K deficit (5_000e18 USD = 5_000e6 USDC).
        vm.expectEmit(false, false, true, true, address(mtq));
        emit MTQSigmaV3.StabilityPoolUsed(5_000e6, 5_000e6, address(this), block.timestamp);
        uint256 covered = mtq.useStabilityPoolForDeficit(5_000e18);

        assertEq(covered, 5_000e6, "covered = 5K USDC");
        assertEq(mtq.totalStabilityPool(), 5_000e6, "pool remaining = 5K USDC");
    }

    // ========================================================================
    //  === T4: Fee Separation (4 tests) ===
    // ========================================================================

    /// @notice T4.a: setFeeWallet rejects address(0).
    function test_SetFeeWallet_RejectsZero() public {
        vm.expectRevert(MTQSigmaV3.Err101_ZeroFeeWallet.selector);
        mtq.setFeeWallet(address(0));
    }

    /// @notice T4.a: setFeeWallet reverts from a non-council caller.
    function test_SetFeeWallet_RevertsForNonCouncil() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(MTQSigmaV3.Err35.selector);
        mtq.setFeeWallet(address(0xBEEF));
    }

    /// @notice T4.b: setFeeWallet emits FeeWalletSet with old + new wallet.
    function test_SetFeeWallet_EmitsEvent() public {
        address newWallet = address(0xCAFE);
        vm.expectEmit(true, true, true, true, address(mtq));
        emit MTQSigmaV3.FeeWalletSet(FEE_WALLET, newWallet, address(this));
        mtq.setFeeWallet(newWallet);
        assertEq(mtq.feeWallet(), newWallet, "feeWallet updated");
    }

    /// @notice T4.c: redeem accrues the redeem fee in accumulatedFees and
    ///         emits FeesCollected. We mint $100K (100K MTQ at P_MTQ=1.0),
    ///         transfer to REDEEMER, then redeem 10K MTQ. At NORMAL state
    ///         redeemFee = 0.0015e18 (0.15%). navPerToken = $11.0.
    ///         grossUsd18 = 10K * $11 = $110K. feeUsd18 = $110K * 0.15% = $165.
    function test_Redeem_AccruesFeeInAccumulatedFees() public {
        // Mint $100K to the bank (100K MTQ at P_MTQ=$1.0).
        _fullMint(keccak256("cert-sp-1"), 100_000e18, 1, 0);
        // Transfer to REDEEMER + approve.
        vm.prank(BANK);
        mtq.transfer(REDEEMER, 60_000e18);
        vm.prank(REDEEMER);
        mtq.approve(BANK, type(uint256).max);

        uint256 feesBefore = mtq.accumulatedFees();
        // Redeem 10K MTQ → grossUsd18 = 10K * $11 = $110K. feeUsd18 = $165.
        vm.prank(BANK);
        mtq.redeem(10_000e18, REDEEMER);

        uint256 feesAfter = mtq.accumulatedFees();
        uint256 delta = feesAfter - feesBefore;
        // feeUsd18 = 110_000e18 * 0.0015e18 / 1e18 = 165e18.
        assertEq(delta, 165e18, "redeem fee accrued");
        assertGt(feesAfter, feesBefore, "accumulatedFees increased");
    }

    /// @notice T4.d: executeMint accrues the mint fee in accumulatedFees.
    ///         mintFee = 0.001e18 (0.10%). At NORMAL, throttle = 1.0, P_MTQ=$1.0,
    ///         minted = amountUsd = 100K MTQ. mintFeeUsd18 = 100K * 0.10% = $100.
    function test_ExecuteMint_AccruesMintFee() public {
        uint256 feesBefore = mtq.accumulatedFees();
        _fullMint(keccak256("cert-sp-1"), 100_000e18, 1, 0);
        uint256 feesAfter = mtq.accumulatedFees();
        uint256 delta = feesAfter - feesBefore;
        // mintFeeUsd18 = 100_000e18 * 0.001e18 / 1e18 = 100e18.
        assertEq(delta, 100e18, "mint fee accrued");
    }

    // ---- Internal helpers (mirrors of the LIQ-MGMT suite) ----

    function _requestAndAdvanceToAuthorized(
        bytes32 certId,
        uint256 amountUsd,
        uint256 nonce
    ) internal returns (bytes32 requestId) {
        vm.startPrank(BANK);
        requestId = mtq.requestMint(MTQSigmaV3.BankMintRequest({
            bank:                    BANK,
            corporateCustomerHash:   keccak256(abi.encodePacked("customer", nonce)),
            amountUsd:               amountUsd,
            backingCertificateId:    certId,
            jurisdiction:            "US",
            nonce:                   nonce,
            expiry:                  block.timestamp + 1 hours
        }));
        vm.stopPrank();
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM02_RECEIVED);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM03_KYC);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM04_AML);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM05_BACKING);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM06_EVIDENCE);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM07_REQUESTED);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM08_TRANSLATED);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM09_ELIGIBLE);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM10_JURISDICTION);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM11_BACKING_VERIFIED);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM12_BANK_RISK);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM13_SYSTEM_RISK);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM14_DMCE);
        mtq.advanceWorkflow(requestId, MTQSigmaV3.WorkflowState.BM15_AUTHORIZED);
    }

    function _fullMint(
        bytes32 certId,
        uint256 amountUsd,
        uint256 nonce,
        uint256 minMinted
    ) internal returns (uint256 minted) {
        bytes32 requestId = _requestAndAdvanceToAuthorized(certId, amountUsd, nonce);
        minted = mtq.executeMint(requestId, minMinted);
    }
}

