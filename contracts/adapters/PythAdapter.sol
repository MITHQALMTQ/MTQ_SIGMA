// SPDX-License-Identifier: MIT
//
//  MTQΣ — Pyth Oracle Adapter (B4 PRODUCTION)
//  Reads from Pyth Network PriceServiceV2. Implements IOracleAdapter.
//
//  Security: setPyth + setFeedId gated by ORACLE_ROLE.
//  Staleness: 60s (§9.2.1). Zero/negative prices rejected.
//  Exponent handling: Pyth uses negative exponents (e.g. -8 for USD pairs).
//  Confidence: Pyth exposes confidence band — passed through to consensus.
// ============================================================================

pragma solidity ^0.8.20;

import {IOracleAdapter} from "../MTQSigmaV3.sol";

interface IPyth {
    function getPrice(bytes32 id) external view returns (int64 price, uint64 conf, int32 expo, uint256 publishTime);
    function getPriceUnsafe(bytes32 id) external view returns (int64 price, uint64 conf, int32 expo, uint256 publishTime);
}

contract PythAdapter is IOracleAdapter {
    IPyth public pyth;
    mapping(bytes32 => bytes32) public pairToPythId;
    uint256 public constant STALENESS_SEC = 60;
    address public oracleAdmin;
    event PythSet(address indexed pythContract, address setter);
    event FeedIdSet(bytes32 indexed pair, bytes32 indexed pythId, address setter);
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

    function setPyth(address _pyth) external onlyOracleAdmin {
        require(_pyth != address(0), "zero pyth");
        pyth = IPyth(_pyth);
        emit PythSet(_pyth, msg.sender);
    }

    function setFeedId(bytes32 pair, bytes32 pythId) external onlyOracleAdmin {
        require(pythId != bytes32(0), "zero pyth id");
        pairToPythId[pair] = pythId;
        emit FeedIdSet(pair, pythId, msg.sender);
    }

    function getPrice(bytes32 pair) external view override returns (uint256 price, uint256 timestamp, uint256 confidence) {
        if (address(pyth) == address(0)) return (0, 0, 0);
        bytes32 pythId = pairToPythId[pair];
        if (pythId == bytes32(0)) return (0, 0, 0);
        try pyth.getPrice(pythId) returns (int64 p, uint64 conf, int32 expo, uint256 publishTime) {
            if (p <= 0) return (0, 0, 0);
            if (block.timestamp < publishTime) return (0, 0, 0); // future
            if (block.timestamp - publishTime > STALENESS_SEC) return (0, 0, 0);
            if (expo < 0) {
                uint256 exp = uint256(int256(-int32(expo)));
                if (exp > 18) return (0, 0, 0); // would overflow
                price = uint256(int256(p)) * (10 ** (18 - exp));
                confidence = uint256(conf) * (10 ** (18 - exp));
            } else {
                uint256 posExp = uint256(int256(int32(expo)));
                price = uint256(int256(p)) * (10 ** (18 + posExp));
                confidence = uint256(conf) * (10 ** (18 + posExp));
            }
            timestamp = publishTime;
        } catch { return (0, 0, 0); }
    }
}
