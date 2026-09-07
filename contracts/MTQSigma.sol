// SPDX-License-Identifier: MIT
// MTQΣ — The Global Purchasing Power Unit
// Source of Truth Blueprint v1.2 — Final Closed-Loop Monetary Architecture
// Pilot deployment contract (faithful minimal-but-complete implementation)
//
// Implements:
//   §2  GFB Index (normalised basket: USD 0.389 / EUR 0.278 / GBP 0.1669 / JPY 0.1111 / CNY 0.055)
//   §3  MTQ Reference Price = GFB_t / GFB_base; safety band 0.50–2.00 USD
//   §12 Mint  (priced against GFB: MTQ = USDC_net / P_MTQ, fee 0.10%)
//   §12 Redeem (priced against GFB: USDC = MTQ × P_MTQ × (1 − fee), fee 0.15%)
//   §3.3 Circulating supply (excludes Genesis Reserve locked balance)
//   §14.1 Risk state machine (status-driven mint throttle + redeem fee)
//
// Honest reconciliation: §3.4.2 is the canonical redemption price (arbitrage-safe).
// §12.2's NAV-per-token is informational book value, NOT settlement.
//
// This is a PILOT contract: oracle prices are settable by the owner (simulating
// the §9 multi-source consensus). Production requires real Chainlink/Pyth/Chronicle
// feed integrations + the Reserve vault holding real collateral.

pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

/// @title MTQΣ — Pilot monetary unit (ERC-20 with GFB-index pricing)
contract MTQSigma {
    // --- ERC-20 state ---
    string public constant name = "MTQ Sigma";
    string public constant symbol = "MTQ";
    uint8  public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // --- §2.1 Fixed basket quantities (q_i, immutable, USD-equivalent at base date) ---
    uint256 public constant Q_USD = 0.389e18;
    uint256 public constant Q_EUR = 0.278e18;
    uint256 public constant Q_GBP = 0.1669e18;
    uint256 public constant Q_JPY = 0.1111e18;
    uint256 public constant Q_CNY = 0.055e18;

    // --- §2.3 Base FX fixings (Jan 1, 2026 00:00 UTC) — normalisation denominator ---
    uint256 public constant BASE_EUR_USD = 1.05e18;
    uint256 public constant BASE_GBP_USD = 1.25e18;
    uint256 public constant BASE_JPY_USD = 0.0067e18;
    uint256 public constant BASE_CNY_USD = 0.14e18;
    uint256 public constant GFB_BASE_DENOMINATOR =
        Q_USD + Q_EUR * BASE_EUR_USD / 1e18 +
        Q_GBP * BASE_GBP_USD / 1e18 +
        Q_JPY * BASE_JPY_USD / 1e18 +
        Q_CNY * BASE_CNY_USD / 1e18;

    // --- §3.5 Safety band (circuit breakers) ---
    uint256 public constant PRICE_SAFETY_LOWER = 0.50e18;
    uint256 public constant PRICE_SAFETY_UPPER = 2.00e18;

    // --- §3.4 + §12.1 Fees ---
    uint256 public constant MINT_FEE_BPS  = 10;   // 0.10%
    uint256 public constant REDEEM_FEE_BPS = 15;  // 0.15%

    // --- Live FX rates (USD per 1 unit of currency), 1e18 scale ---
    // Owner-settable in the pilot to simulate the §9 oracle consensus.
    uint256 public fxEUR_USD = BASE_EUR_USD;
    uint256 public fxGBP_USD = BASE_GBP_USD;
    uint256 public fxJPY_USD = BASE_JPY_USD;
    uint256 public fxCNY_USD = BASE_CNY_USD;
    uint256 public fxXAU_USD = 2650e18; // gold (USD per troy oz)

    // --- §14.1 Risk state machine ---
    enum Status { NORMAL, CAUTION, DEFENSIVE, EMERGENCY, RECOVERY }
    Status public protocolStatus = Status.NORMAL;

    // --- Genesis + reserve accounting ---
    address public genesisReserve;     // locked MTQ excluded from circulating supply
    uint256 public genesisReserveBalance;
    address public reserveVault;       // receives USDC collateral + fees
    IERC20  public usdc;               // collateral token
    address public owner;
    bool    public mintPaused = false;

    // --- Events ---
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed user, uint256 usdcIn, uint256 feeUsd, uint256 mtqMinted, uint256 price);
    event Redeem(address indexed user, uint256 mtqIn, uint256 feeUsd, uint256 usdcOut, uint256 price);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event StatusChanged(Status oldStatus, Status newStatus);

    modifier onlyOwner() {
        require(msg.sender == owner, "MTQ: not owner");
        _;
    }

    constructor(address _usdc) {
        owner = msg.sender;
        usdc = IERC20(_usdc);
        reserveVault = msg.sender; // pilot: deployer acts as reserve vault
        genesisReserve = address(this); // pilot: self holds genesis reserve
    }

    // --- §2.2 GFB Index (normalised) ---
    /// @dev Current GFB Index value, 1e18 scale (=1.0 at base date).
    function getGFB() public view returns (uint256) {
        uint256 numerator = Q_USD
            + Q_EUR * fxEUR_USD / 1e18
            + Q_GBP * fxGBP_USD / 1e18
            + Q_JPY * fxJPY_USD / 1e18
            + Q_CNY * fxCNY_USD / 1e18;
        return numerator * 1e18 / GFB_BASE_DENOMINATOR;
    }

    // --- §3.1 MTQ Reference Price (USD per 1 MTQ), 1e18 scale ---
    function getMTQPrice() public view returns (uint256) {
        return getGFB();
    }

    /// @dev §3.5 Price-safety guard. Reverts if price is outside the 0.50–2.00 band.
    function getMTQPriceWithGuard() public view returns (uint256) {
        uint256 price = getMTQPrice();
        require(price >= PRICE_SAFETY_LOWER && price <= PRICE_SAFETY_UPPER, "MTQ: price out of safety band");
        return price;
    }

    // --- §3.3 Circulating supply (excludes Genesis Reserve locked balance) ---
    function getCirculatingSupply() public view returns (uint256) {
        return totalSupply - genesisReserveBalance;
    }

    // --- §3.2 Liability (USD), 1e18 scale ---
    function getLiability() public view returns (uint256) {
        return getCirculatingSupply() * getMTQPrice() / 1e18;
    }

    // --- §12.1 Mint (priced against the GFB Index) ---
    /// @notice Deposits `usdcAmount` USDC (6 decimals) and mints MTQΣ (18 dec)
    ///         = usdcNet / P_MTQ. Fee 0.10%. Throttled by status.
    ///         USDC is 6 decimals; we scale to 18 before dividing by price (1e18).
    function mint(uint256 usdcAmount) external returns (uint256 minted) {
        require(!mintPaused, "MTQ: mint paused");
        require(usdcAmount > 0, "MTQ: zero amount");
        uint256 price = getMTQPriceWithGuard();
        require(protocolStatus != Status.DEFENSIVE && protocolStatus != Status.EMERGENCY, "MTQ: mint paused by risk state");

        // Pull USDC from minter to reserve vault
        require(usdc.transferFrom(msg.sender, reserveVault, usdcAmount), "MTQ: USDC pull failed");

        uint256 feeUsd = usdcAmount * MINT_FEE_BPS / 10000;
        uint256 netUsd = usdcAmount - feeUsd;
        // Scale 6-dec USDC → 18-dec USD value, then divide by 18-dec price → MTQ (18 dec)
        uint256 netUsd18 = netUsd * 1e12; // 6 dec → 18 dec
        uint256 grossMint = netUsd18 * 1e18 / price;

        // §14.1 throttle
        uint256 throttle = 1e18;
        if (protocolStatus == Status.CAUTION)  throttle = 0.5e18;
        if (protocolStatus == Status.RECOVERY) throttle = 0.25e18;
        minted = grossMint * throttle / 1e18;

        _mint(msg.sender, minted);
        emit Mint(msg.sender, usdcAmount, feeUsd, minted, price);
    }

    // --- §12.2 Redeem (priced against the GFB Index — §3.4.2 canonical) ---
    /// @notice Burns `mtqAmount` MTQΣ (18 dec) and returns USDC (6 dec)
    ///         = mtqAmount × P_MTQ × (1 − fee), scaled from 18→6 decimals.
    ///         Fee by status: NORMAL/CAUTION 0.15%, DEFENSIVE 0.5%, EMERGENCY 2%.
    function redeem(uint256 mtqAmount) external returns (uint256 usdcOut) {
        require(mtqAmount > 0, "MTQ: zero amount");
        require(balanceOf[msg.sender] >= mtqAmount, "MTQ: insufficient balance");
        uint256 price = getMTQPrice();

        uint256 feeBps = REDEEM_FEE_BPS;
        if (protocolStatus == Status.DEFENSIVE) feeBps = 50;
        if (protocolStatus == Status.EMERGENCY) feeBps = 200;

        // grossUsd in 18 dec = mtqAmount(18) × price(18) / 1e18
        uint256 grossUsd18 = mtqAmount * price / 1e18;
        uint256 feeUsd18 = grossUsd18 * feeBps / 10000;
        uint256 netUsd18 = grossUsd18 - feeUsd18;
        // Scale 18-dec USD → 6-dec USDC
        usdcOut = netUsd18 / 1e12;

        // Burn MTQ from minter
        _burn(msg.sender, mtqAmount);
        // Release USDC from reserve vault to minter (pilot: vault must approve this contract)
        require(usdc.transferFrom(reserveVault, msg.sender, usdcOut), "MTQ: USDC release failed");
        emit Redeem(msg.sender, mtqAmount, feeUsd18 / 1e12, usdcOut, price);
    }

    // --- ERC-20 internals ---
    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
    function _burn(address from, uint256 amount) internal {
        require(balanceOf[from] >= amount, "MTQ: burn exceeds balance");
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
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
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "MTQ: insufficient allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }
    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "MTQ: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    // --- Owner / governance setters (pilot) ---
    /// @notice Sets live FX rates (simulating §9 oracle consensus). Pilot only.
    function setFxRates(uint256 eur, uint256 gbp, uint256 jpy, uint256 cny, uint256 xau) external onlyOwner {
        require(eur > 0 && gbp > 0 && jpy > 0 && cny > 0 && xau > 0, "MTQ: zero rate");
        uint256 oldPrice = getMTQPrice();
        fxEUR_USD = eur; fxGBP_USD = gbp; fxJPY_USD = jpy; fxCNY_USD = cny; fxXAU_USD = xau;
        uint256 newPrice = getMTQPrice();
        // §3.6 PriceUpdated event (0.5% change threshold)
        uint256 diff = newPrice > oldPrice ? newPrice - oldPrice : oldPrice - newPrice;
        if (diff * 200 > oldPrice) emit PriceUpdated(oldPrice, newPrice);
    }

    function setProtocolStatus(Status s) external onlyOwner {
        emit StatusChanged(protocolStatus, s);
        protocolStatus = s;
    }

    function setMintPaused(bool p) external onlyOwner {
        mintPaused = p;
    }

    function setReserveVault(address v) external onlyOwner {
        reserveVault = v;
    }

    /// @notice Genesis event (§13.1): mint `amount` MTQ to the Genesis Reserve
    ///         (locked — excluded from circulating supply).
    function genesisMint(uint256 amount) external onlyOwner {
        require(genesisReserveBalance == 0, "MTQ: genesis already done");
        _mint(genesisReserve, amount);
        genesisReserveBalance = amount;
    }
}

/// @title MockUSDC — test collateral (ERC-20, 6 decimals, free-mint for pilot)
contract MockUSDC {
    string public constant name = "USD Coin (Mock Pilot)";
    string public constant symbol = "USDC";
    uint8  public constant decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    address public owner;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() { owner = msg.sender; }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "USDC: insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "USDC: insufficient allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        require(balanceOf[from] >= amount, "USDC: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
    function mint(address to, uint256 amount) external {
        require(msg.sender == owner, "USDC: not owner");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}
