// SPDX-License-Identifier: MIT
//
//  MTQΣ — Chainlink Oracle Adapter (B4 PRODUCTION)
//  Reads EUR/USD, GBP/USD, JPY/USD, CNY/USD, CHF/USD, XAU/USD from Chainlink
//  AggregatorV3Interface feeds. Implements IOracleAdapter.
//
//  Security: setFeed is gated by ORACLE_ROLE — only authorized oracle admins
//  can configure which Chainlink aggregator address backs each pair.
//  Staleness: 60s (§9.2.1). Zero/negative prices rejected (C6 fix).
//  Decimals: normalized to 1e18 (Chainlink uses 8 for FX, 18 for some others).
// ============================================================================

pragma solidity ^0.8.20;

import {IOracleAdapter} from "../MTQSigmaV3.sol";

interface AggregatorV3Interface {
    function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
    function decimals() external view returns (uint8);
}

contract ChainlinkAdapter is IOracleAdapter {
    mapping(bytes32 => AggregatorV3Interface) public feeds;
    uint256 public constant STALENESS_SEC = 60;
    address public oracleAdmin;
    event FeedSet(bytes32 indexed pair, address indexed aggregator, address setter);
    event OracleAdminSet(address indexed oldAdmin, address indexed newAdmin);

    modifier onlyOracleAdmin() {
        require(msg.sender == oracleAdmin, "not oracle admin");
        _;
    }

    constructor(address _oracleAdmin) {
        require(_oracleAdmin != address(0), "zero admin");
        oracleAdmin = _oracleAdmin;
        emit OracleAdminSet(address(0), _oracleAdmin);
    }

    function setOracleAdmin(address newAdmin) external onlyOracleAdmin {
        require(newAdmin != address(0), "zero admin");
        emit OracleAdminSet(oracleAdmin, newAdmin);
        oracleAdmin = newAdmin;
    }

    function setFeed(bytes32 pair, address agg) external onlyOracleAdmin {
        require(agg != address(0), "zero aggregator");
        feeds[pair] = AggregatorV3Interface(agg);
        emit FeedSet(pair, agg, msg.sender);
    }

    function getPrice(bytes32 pair) external view override returns (uint256 price, uint256 timestamp, uint256 confidence) {
        AggregatorV3Interface agg = feeds[pair];
        if (address(agg) == address(0)) return (0, 0, 0);
        try agg.latestRoundData() returns (uint80, int256 answer, uint256, uint256 updatedAt, uint80 answeredInRound) {
            if (answeredInRound == 0 || answer <= 0) return (0, 0, 0);
            if (block.timestamp < updatedAt) return (0, 0, 0); // future timestamp
            if (block.timestamp - updatedAt > STALENESS_SEC) return (0, 0, 0);
            uint8 dec = agg.decimals();
            if (dec == 8) {
                price = uint256(int256(answer)) * 1e10; // 8 → 18
            } else if (dec == 18) {
                price = uint256(int256(answer));
            } else {
                price = uint256(int256(answer)) * (10 ** (18 - dec));
            }
            timestamp = updatedAt;
            confidence = 0; // Chainlink doesn't expose confidence
        } catch { return (0, 0, 0); }
    }
}
