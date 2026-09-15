// SPDX-License-Identifier: MIT
//
//  MTQΣ — Chronicle Oracle Adapter (B4 scaffold)
//  Reads from Chronicle Scribe optimistically-updated on-chain price feeds.
// ============================================================================

pragma solidity ^0.8.20;

import {IOracleAdapter} from "../MTQSigmaV2.sol";

interface IScribe {
    function read() external view returns (uint256 val, uint256 age);
    function readStale() external view returns (uint256 val, uint256 age);
}

contract ChronicleAdapter is IOracleAdapter {
    mapping(bytes32 => IScribe) public feeds;
    uint256 public constant STALENESS_SEC = 60;
    event FeedSet(bytes32 indexed pair, address indexed scribe, address setter);

    function setFeed(bytes32 pair, address scribe) external {
        require(scribe != address(0), "zero scribe");
        feeds[pair] = IScribe(scribe);
        emit FeedSet(pair, scribe, msg.sender);
    }

    function getPrice(bytes32 pair) external view override returns (uint256 price, uint256 timestamp, uint256 confidence) {
        IScribe scribe = feeds[pair];
        if (address(scribe) == address(0)) return (0, 0, 0);
        try scribe.read() returns (uint256 val, uint256 age) {
            if (block.timestamp - age > STALENESS_SEC) return (0, 0, 0);
            if (val == 0) return (0, 0, 0);
            return (val, age, 0);
        } catch {
            try scribe.readStale() returns (uint256 val, uint256 age) {
                if (block.timestamp - age > STALENESS_SEC) return (0, 0, 0);
                if (val == 0) return (0, 0, 0);
                return (val, age, 0);
            } catch { return (0, 0, 0); }
        }
    }
}
