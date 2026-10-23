// SPDX-License-Identifier: MIT
//
//  MTQΣ — Chronicle Oracle Adapter (B4 PRODUCTION)
//  Reads from Chronicle Scribe optimistically-updated on-chain price feeds.
//
//  Security: setFeed gated by ORACLE_ROLE.
//  Staleness: 60s (§9.2.1). Zero prices rejected.
//  Fallback: readStale() used if read() reverts (Chronicle's own fallback).
// ============================================================================

pragma solidity ^0.8.20;

import {IOracleAdapter} from "../MTQSigmaV3.sol";

interface IScribe {
    function read() external view returns (uint256 val, uint256 age);
    function readStale() external view returns (uint256 val, uint256 age);
}

contract ChronicleAdapter is IOracleAdapter {
    mapping(bytes32 => IScribe) public feeds;
    uint256 public constant STALENESS_SEC = 60;
    address public oracleAdmin;
    event FeedSet(bytes32 indexed pair, address indexed scribe, address setter);
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

    function setFeed(bytes32 pair, address scribe) external onlyOracleAdmin {
        require(scribe != address(0), "zero scribe");
        feeds[pair] = IScribe(scribe);
        emit FeedSet(pair, scribe, msg.sender);
    }

    function getPrice(bytes32 pair) external view override returns (uint256 price, uint256 timestamp, uint256 confidence) {
        IScribe scribe = feeds[pair];
        if (address(scribe) == address(0)) return (0, 0, 0);
        try scribe.read() returns (uint256 val, uint256 age) {
            if (val == 0) return (0, 0, 0);
            if (block.timestamp < age) return (0, 0, 0); // future
            if (block.timestamp - age > STALENESS_SEC) return (0, 0, 0);
            return (val, age, 0);
        } catch {
            try scribe.readStale() returns (uint256 val, uint256 age) {
                if (val == 0) return (0, 0, 0);
                if (block.timestamp < age) return (0, 0, 0);
                if (block.timestamp - age > STALENESS_SEC) return (0, 0, 0);
                return (val, age, 0);
            } catch { return (0, 0, 0); }
        }
    }
}
