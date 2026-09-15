// SPDX-License-Identifier: MIT
//
//  MTQΣ — Chainlink Oracle Adapter (B4 scaffold)
//  Reads EUR/USD, GBP/USD, JPY/USD, CNY/USD, XAU/USD from Chainlink
//  AggregatorV3Interface feeds. Implements IOracleAdapter.
// ============================================================================

pragma solidity ^0.8.20;

import {IOracleAdapter} from "../MTQSigmaV2.sol";

interface AggregatorV3Interface {
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
    function decimals() external view returns (uint8);
}

contract ChainlinkAdapter is IOracleAdapter {
    mapping(bytes32 => AggregatorV3Interface) public feeds;
    uint256 public constant STALENESS_SEC = 60;
    event FeedSet(bytes32 indexed pair, address indexed aggregator, address setter);

    function setFeed(bytes32 pair, address agg) external {
        require(agg != address(0), "zero aggregator");
        feeds[pair] = AggregatorV3Interface(agg);
        emit FeedSet(pair, agg, msg.sender);
    }

    function getPrice(bytes32 pair) external view override returns (uint256 price, uint256 timestamp, uint256 confidence) {
        AggregatorV3Interface agg = feeds[pair];
        if (address(agg) == address(0)) return (0, 0, 0);
        try agg.latestRoundData() returns (uint80, int256 answer, uint256, uint256 updatedAt, uint80 answeredInRound) {
            if (block.timestamp - updatedAt > STALENESS_SEC) return (0, 0, 0);
            if (answeredInRound == 0 || answer <= 0) return (0, 0, 0);
            uint8 dec = agg.decimals();
            price = (dec == 8) ? uint256(int256(answer)) * 1e10 : uint256(int256(answer));
            timestamp = updatedAt;
            confidence = 0;
        } catch { return (0, 0, 0); }
    }
}
