// SPDX-License-Identifier: MIT
// MTQΣ — Full MITHQAL ecosystem (AccessControl + Pausable)
// Mirrors the user's original deployment pattern: MTQ token with DEFAULT_ADMIN_ROLE,
// MINTER_ROLE, PAUSER_ROLE + 8 ecosystem contracts (Governance, Safe, Algorithm,
// Reserve, Mint, Redeem, Oracle, Takaful). Deployable as one set per chain.
//
// Roles:
//   DEFAULT_ADMIN_ROLE (0x00…00) — deployer (can grant/revoke all roles)
//   MINTER_ROLE         (keccak256("MINTER_ROLE")) — granted to the Mint contract + deployer
//   PAUSER_ROLE         (keccak256("PAUSER_ROLE")) — granted to the Safe (Multi-Sig) + deployer

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";

// ─── MTQ token (MITHQAL pattern: AccessControl + Pausable + mint(to, amount)) ─
contract MTQToken is AccessControl, Pausable, ERC20 {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    constructor() ERC20("MTQ\u03A3", "MTQ") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _update(address from, address to, uint256 amount) internal override {
        require(!paused(), "MTQ: paused");
        super._update(from, to, amount);
    }
}

// ─── Governance (simple proposal + vote; production = full §14.2 hierarchy) ───
contract Governance is AccessControl {
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    struct Proposal { uint256 id; address proposer; string description; uint256 forVotes; uint256 againstVotes; uint256 deadline; bool executed; }
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    uint256 public proposalCount;
    uint256 public constant VOTING_PERIOD = 1 days;

    event Proposed(uint256 indexed id, address proposer, string description);
    event Voted(uint256 indexed id, address voter, bool support);
    event Executed(uint256 indexed id);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PROPOSER_ROLE, msg.sender);
        _grantRole(EXECUTOR_ROLE, msg.sender);
    }

    function propose(string calldata desc) external onlyRole(PROPOSER_ROLE) returns (uint256) {
        proposalCount++;
        proposals[proposalCount] = Proposal(proposalCount, msg.sender, desc, 0, 0, block.timestamp + VOTING_PERIOD, false);
        emit Proposed(proposalCount, msg.sender, desc);
        return proposalCount;
    }

    function vote(uint256 id, bool support) external {
        require(block.timestamp < proposals[id].deadline, "Gov: voting closed");
        require(!hasVoted[id][msg.sender], "Gov: already voted");
        hasVoted[id][msg.sender] = true;
        if (support) proposals[id].forVotes++; else proposals[id].againstVotes++;
        emit Voted(id, msg.sender, support);
    }

    function execute(uint256 id) external onlyRole(EXECUTOR_ROLE) {
        require(block.timestamp >= proposals[id].deadline, "Gov: voting open");
        require(!proposals[id].executed, "Gov: executed");
        require(proposals[id].forVotes > proposals[id].againstVotes, "Gov: rejected");
        proposals[id].executed = true;
        emit Executed(id);
    }
}

// ─── Safe (Multi-Sig) — minimal 4-of-7 threshold for emergency/pause actions ─
contract Safe is AccessControl {
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    uint256 public constant THRESHOLD = 4;
    uint256 public constant SIGNER_COUNT = 7;

    struct Tx { address target; bytes data; uint256 value; uint256 confirmations; bool executed; }
    mapping(uint256 => Tx) public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmed;
    uint256 public txCount;

    event Submitted(uint256 id, address target, bytes data);
    event Confirmed(uint256 id, address signer);
    event Executed(uint256 id);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SIGNER_ROLE, msg.sender);
    }

    function submit(address target, bytes calldata data, uint256 value) external onlyRole(SIGNER_ROLE) returns (uint256) {
        txCount++;
        transactions[txCount] = Tx(target, data, value, 0, false);
        emit Submitted(txCount, target, data);
        return txCount;
    }

    function confirm(uint256 id) external onlyRole(SIGNER_ROLE) {
        require(!confirmed[id][msg.sender], "Safe: already confirmed");
        require(!transactions[id].executed, "Safe: executed");
        confirmed[id][msg.sender] = true;
        transactions[id].confirmations++;
        emit Confirmed(id, msg.sender);
        if (transactions[id].confirmations >= THRESHOLD) {
            transactions[id].executed = true;
            (bool ok, ) = transactions[id].target.call{value: transactions[id].value}(transactions[id].data);
            require(ok, "Safe: call failed");
            emit Executed(id);
        }
    }
}

// ─── Algorithm Engine — the §6/§8 target gold weight (pilot: owner-set) ──────
contract AlgorithmEngine is AccessControl {
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    uint256 public targetGoldWeight = 0.2625e18;
    uint256 public lastVIX = 18e18;
    uint256 public lastDXY = 104e18;
    event TargetUpdated(uint256 oldTarget, uint256 newTarget, uint256 vix, uint256 dxy);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(KEEPER_ROLE, msg.sender);
    }

    function updateSignals(uint256 vix, uint256 dxy) external onlyRole(KEEPER_ROLE) {
        lastVIX = vix; lastDXY = dxy;
        emit TargetUpdated(targetGoldWeight, targetGoldWeight, vix, dxy);
    }

    function setTargetGoldWeight(uint256 w) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(w >= 0.22e18 && w <= 0.30e18, "Algo: out of [22%,30%]");
        emit TargetUpdated(targetGoldWeight, w, lastVIX, lastDXY);
        targetGoldWeight = w;
    }
}

// ─── Reserve Vault — holds collateral, reports NAV (pilot: owner-set prices) ─
contract ReserveVault is AccessControl {
    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");
    IERC20 public usdc;
    IERC20 public paxg;
    uint256 public navUsd = 1_100_000e18;
    event NavUpdated(uint256 nav);
    constructor(address _usdc, address _paxg) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REBALANCER_ROLE, msg.sender);
        usdc = IERC20(_usdc); paxg = IERC20(_paxg);
    }
    function setNav(uint256 nav) external onlyRole(REBALANCER_ROLE) { navUsd = nav; emit NavUpdated(nav); }
    function collateralBalance() external view returns (uint256 usdcBal, uint256 paxgBal) {
        return (usdc.balanceOf(address(this)), paxg.balanceOf(address(this)));
    }
}

// ─── Mint — deposits USDC, mints MTQ (pilot: fixed price; prod = GFB-indexed) ─
contract MintContract is AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    IERC20 public usdc;
    MTQToken public mtq;
    uint256 public mintFeeBps = 10;
    uint256 public mtqPriceUsd = 1e18;
    event Mint(address indexed user, uint256 usdcIn, uint256 fee, uint256 mtqOut);
    constructor(address _usdc, address _mtq) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        usdc = IERC20(_usdc); mtq = MTQToken(_mtq);
    }
    function mint(uint256 usdcAmount) external returns (uint256) {
        require(usdcAmount > 0, "Mint: zero");
        usdc.transferFrom(msg.sender, address(this), usdcAmount);
        uint256 fee = usdcAmount * mintFeeBps / 10000;
        uint256 net = usdcAmount - fee;
        uint256 mtqOut = net * 1e18 / mtqPriceUsd;
        mtq.mint(msg.sender, mtqOut);
        emit Mint(msg.sender, usdcAmount, fee, mtqOut);
        return mtqOut;
    }
    function setPrice(uint256 p) external onlyRole(DEFAULT_ADMIN_ROLE) { mtqPriceUsd = p; }
}

// ─── Redeem — burns MTQ, releases USDC (pilot: §3.4.2 canonical) ──────────────
contract RedeemContract is AccessControl {
    IERC20 public usdc;
    MTQToken public mtq;
    uint256 public redeemFeeBps = 15;
    uint256 public mtqPriceUsd = 1e18;
    event Redeem(address indexed user, uint256 mtqIn, uint256 fee, uint256 usdcOut);
    constructor(address _usdc, address _mtq) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        usdc = IERC20(_usdc); mtq = MTQToken(_mtq);
    }
    function redeem(uint256 mtqAmount) external returns (uint256) {
        require(mtqAmount > 0, "Redeem: zero");
        uint256 gross = mtqAmount * mtqPriceUsd / 1e18;
        uint256 fee = gross * redeemFeeBps / 10000;
        uint256 usdcOut = gross - fee;
        mtq.transferFrom(msg.sender, address(this), mtqAmount);
        usdc.transfer(msg.sender, usdcOut);
        emit Redeem(msg.sender, mtqAmount, fee, usdcOut);
        return usdcOut;
    }
    function setPrice(uint256 p) external onlyRole(DEFAULT_ADMIN_ROLE) { mtqPriceUsd = p; }
}

// ─── Oracle — §9 multi-source price feed (pilot: owner-set single source) ────
contract Oracle is AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    struct Price { uint256 value; uint256 timestamp; uint8 validFeeds; }
    mapping(bytes32 => Price) public prices;
    event PriceUpdated(bytes32 indexed key, uint256 value, uint8 validFeeds);
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }
    function setPrice(bytes32 pair, uint256 value, uint8 validFeeds) external onlyRole(ORACLE_ROLE) {
        prices[pair] = Price(value, block.timestamp, validFeeds);
        emit PriceUpdated(pair, value, validFeeds);
    }
    function getPrice(bytes32 pair) external view returns (uint256, uint256, uint8) {
        Price memory p = prices[pair];
        return (p.value, p.timestamp, p.validFeeds);
    }
}

// ─── Takaful — Sharia mutual-aid pool (pilot: simple contribution pool) ──────
contract Takaful is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    IERC20 public usdc;
    mapping(address => uint256) public contributions;
    uint256 public totalPool;
    event Contributed(address indexed member, uint256 amount);
    event Claim(address indexed member, uint256 amount);
    constructor(address _usdc) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        usdc = IERC20(_usdc);
    }
    function contribute(uint256 amount) external {
        usdc.transferFrom(msg.sender, address(this), amount);
        contributions[msg.sender] += amount;
        totalPool += amount;
        emit Contributed(msg.sender, amount);
    }
    function claim(address to, uint256 amount) external onlyRole(OPERATOR_ROLE) {
        usdc.transfer(to, amount);
        totalPool -= amount;
        emit Claim(to, amount);
    }
}

// ─── MockUSDC — test collateral (ERC-20, 6 decimals, free-mint for pilot) ───
contract MockUSDC {
    string public constant name = "USD Coin (Mock Pilot)";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    address public owner;
    event Transfer(address indexed from, address indexed to, uint256 v);
    event Approval(address indexed o, address indexed s, uint256 v);
    constructor() { owner = msg.sender; }
    function transfer(address to, uint256 a) external returns (bool) { balanceOf[msg.sender]-=a; balanceOf[to]+=a; emit Transfer(msg.sender,to,a); return true; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s]=a; emit Approval(msg.sender,s,a); return true; }
    function transferFrom(address f, address t, uint256 a) external returns (bool) {
        uint256 al=allowance[f][msg.sender];
        if(al!=type(uint256).max){allowance[f][msg.sender]=al-a;}
        balanceOf[f]-=a; balanceOf[t]+=a; emit Transfer(f,t,a); return true;
    }
    function mint(address to, uint256 a) external { require(msg.sender==owner); totalSupply+=a; balanceOf[to]+=a; emit Transfer(address(0),to,a); }
}
