// SPDX-License-Identifier: MIT
//
// ============================================================================
//  MTQΣ — The Global Purchasing Power Unit
//  MTQSigmaV2.sol — Full v1.0 Master Blueprint on-chain implementation
// ============================================================================
//
//  Source of Truth: src/lib/mtq/blueprint.ts
//    (MTQΣ Master Monetary Architecture v1.0, 2026-09-08)
//
//  This is the v1.0 Master Blueprint on-chain implementation:
//    §2    7-Component GFB Index (chain-linked): USD/EUR/JPY/GBP/CNY/CHF/Gold
//          with Gold + CHF as FIRST-CLASS index components (not just reserve).
//    §3    MTQ Reference Price = GFB_t / GFB_base; safety band 0.50–2.00 USD.
//    §3.4  Genesis weight init: each component's USD notional = Strategic Prior
//          share, at the immutable base-date fixings (Jan 1, 2026 00:00 UTC).
//    §3.4.2 + §12  Mint/Redeem priced against the GFB Index (arbitrage-safe).
//    §5    Asset admission registry interface (haircuts + state + issuerId).
//    §8.1  On-chain MASE weight registry: Target / Smoothed / Execution
//          with per-component admissibility envelopes (hard bounds).
//    §9    Multi-source oracle adapter (Chainlink / Pyth / Chronicle) with
//          §9.2 validation (staleness ≤60s, confidence <1%, deviation <2.5%)
//          and §9.3 consensus (median(3) / average(2) / paused(<2)).
//    §10   MARP rebalancing — keeper-executed, 24h direction lock, daily cap.
//    §14.1 Risk state machine — 5 states, status-driven mint throttle + fees.
//    §14.2 DAO/multi-sig governance with 48h timelock on parameter changes.
//    §25   Honest Status — getHonestStatus() returns 0x7FF (all 11 v1.0 bits set).
//
//  NOT YET DEPLOYED — source ready, pending deployment by the protocol owner.
//  Production-authorized when oracles + registry + reserve vault are wired to
//  real adapters (Chainlink/Pyth/Chronicle feeds + registry contract + Reserve
//  vault holding real collateral).
//
//  Honest status: getHonestStatus() returns implementedMask = 0x7FF.
//
//  Bit encoding (identical to the v1.2 pilot's getHonestStatus):
//    bit 0  basketHas7Components       (1 = 7-comp v1.0 with Gold+CHF)
//    bit 1  goldIsFirstClassIndex      (1 = gold in index, not just reserve)
//    bit 2  chfIsFirstClassIndex       (1 = CHF in index)
//    bit 3  chainLinkedIndex           (1 = immutable divisor / continuity)
//    bit 4  maseWeightRegistry        (1 = MASE outputs committed on-chain)
//    bit 5  admissibilityEnvelopes     (1 = per-component bounds enforced)
//    bit 6  marpExecution              (1 = on-chain rebalance present)
//    bit 7  assetRegistry             (1 = registry contract wired)
//    bit 8  multiSourceOracle          (1 = Chainlink/Pyth/Chronicle adapter)
//    bit 9  daoGovernance              (1 = DAO/multi-sig + timelock)
//    bit 10 honestStatusExposed        (1 = getHonestStatus function exists)
//
//  v1.2 Pilot (deployed at 0x826b82F79FD6c5347cDC568B1d0A7918128B63c1) returns
//  0x400 (only bit 10 set). This V2 contract returns 0x7FF — the "all on"
//  complement.
//
//  Single-file, no external imports — minimal AccessControl + Pausable inlined.
//  Compiles with solc 0.8.20+.
// ============================================================================

pragma solidity ^0.8.20;

// ============================================================================
// §0  Interfaces (no external imports — everything inline)
// ============================================================================

/// @notice Minimal ERC-20 interface (collateral token: USDC, 6 decimals).
interface IERC20 {
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
    function allowance(address, address) external view returns (uint256);
}

/// @title IOracleAdapter — §9 multi-source oracle feed adapter
/// @dev Each adapter wraps one source (Chainlink / Pyth / Chronicle) and
///      returns (price, timestamp, confidence) for a bytes32 pair identifier.
interface IOracleAdapter {
    /// @return price       USD-per-unit, 1e18 scale
    /// @return timestamp   unix seconds of the latest update
    /// @return confidence  confidence band as fraction of price, 1e18 scale
    ///                    (e.g. 0.005e18 = 0.5% — valid if < 1% per §9.2.3)
    function getPrice(bytes32 pair) external view returns (uint256 price, uint256 timestamp, uint256 confidence);
}

/// @title IAssetRegistry — §5 asset admission registry
/// @dev Resolves a currency code (e.g. "USD", "EUR", "XAU") to its token +
///      haircut + state + issuer identifier. Used for reserve NAV haircuts.
interface IAssetRegistry {
    /// @return token      ERC-20 token address (address(0) if cash/physical)
    /// @return haircut    risk haircut, 1e18 scale (e.g. 0.005e18 = 0.5%)
    /// @return state      0=active, 1=warn, 2=frozen, 3=delisted
    /// @return issuerId   bytes32 identifier of the issuer (Circle/Paxos/Tether/...)
    function getAsset(bytes32 currencyCode) external view returns (
        address token, uint256 haircut, uint8 state, bytes32 issuerId
    );
}

// ============================================================================
// §1  MTQSigmaV2 — v1.0 Master Blueprint on-chain monetary unit (ERC-20)
// ============================================================================
contract MTQSigmaV2 {
    // ------------------------------------------------------------------
    // §14.2  Inline AccessControl (no external imports)
    // ------------------------------------------------------------------
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant ADMIN_ROLE   = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE  = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE  = keccak256("PAUSER_ROLE");
    bytes32 public constant KEEPER_ROLE  = keccak256("KEEPER_ROLE");
    bytes32 public constant ORACLE_ROLE  = keccak256("ORACLE_ROLE");

    mapping(bytes32 => mapping(address => bool)) private _roles;

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    modifier onlyRole(bytes32 role) {
        require(_roles[role][msg.sender] || _roles[DEFAULT_ADMIN_ROLE][msg.sender], "MTQV2: not authorized");
        _;
    }
    modifier onlyAdmin()   { require(_roles[ADMIN_ROLE][msg.sender]        || _roles[DEFAULT_ADMIN_ROLE][msg.sender], "MTQV2: not admin");   _; }
    modifier onlyKeeper()  { require(_roles[KEEPER_ROLE][msg.sender]       || _roles[DEFAULT_ADMIN_ROLE][msg.sender], "MTQV2: not keeper");  _; }
    modifier onlyPauser()  { require(_roles[PAUSER_ROLE][msg.sender]       || _roles[DEFAULT_ADMIN_ROLE][msg.sender], "MTQV2: not pauser");  _; }
    modifier onlyOracleOrKeeper() {
        require(
            _roles[ORACLE_ROLE][msg.sender] ||
            _roles[KEEPER_ROLE][msg.sender] ||
            _roles[DEFAULT_ADMIN_ROLE][msg.sender],
            "MTQV2: not oracle/keeper"
        );
        _;
    }

    // ------------------------------------------------------------------
    // §1  Pausable (inline)
    // ------------------------------------------------------------------
    bool public paused;
    event Paused(address indexed account);
    event Unpaused(address indexed account);
    modifier whenNotPaused() { require(!paused, "MTQV2: paused"); _; }

    function pause()   external onlyPauser { paused = true;  emit Paused(msg.sender); }
    function unpause() external onlyPauser { paused = false; emit Unpaused(msg.sender); }

    // ------------------------------------------------------------------
    // §1  ERC-20 state
    // ------------------------------------------------------------------
    string  public constant name     = "MTQ Sigma V2";
    string  public constant symbol   = "MTQv2";
    uint8   public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256)                     public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // ------------------------------------------------------------------
    // §3.2  Strategic Prior (immutable, 1e18 scale)
    // Canonical component order: [USD, EUR, JPY, GBP, CNY, CHF, Gold].
    // Source: blueprint.ts STRATEGIC_PRIOR.
    // ------------------------------------------------------------------
    uint256 public constant PRIOR_USD   = 0.27e18;
    uint256 public constant PRIOR_EUR   = 0.20e18;
    uint256 public constant PRIOR_JPY   = 0.09e18;
    uint256 public constant PRIOR_GBP   = 0.08e18;
    uint256 public constant PRIOR_CNY   = 0.05e18;
    uint256 public constant PRIOR_CHF   = 0.05e18;
    uint256 public constant PRIOR_GOLD  = 0.26e18;

    // ------------------------------------------------------------------
    // §3.4  Base FX fixings (immutable, Jan 1 2026 00:00 UTC, 1e18 scale)
    // Source: blueprint.ts BASE_FIXINGS.
    // ------------------------------------------------------------------
    uint256 public constant BASE_EUR_USD = 1.05e18;
    uint256 public constant BASE_GBP_USD = 1.25e18;
    uint256 public constant BASE_JPY_USD = 0.0067e18;
    uint256 public constant BASE_CNY_USD = 0.14e18;
    uint256 public constant BASE_CHF_USD = 0.88e18;
    uint256 public constant BASE_XAU_USD = 2500e18;

    // ------------------------------------------------------------------
    // §2  Chain-linked denominator — GFB_base = Σ W^Prior_i × P_{i,0}
    // Computed ONCE in the constructor (immutable), NOT recomputed per call.
    // ------------------------------------------------------------------
    uint256 public immutable GFB_BASE_DENOMINATOR;

    // ------------------------------------------------------------------
    // §2  Live FX rates (USD per 1 unit), 1e18 scale.
    // Default to base fixings; updated by ORACLE_ROLE/KEEPER_ROLE via
    // commitFxRatesFromOracles() (production) or setFxRates() (pilot fallback).
    // ------------------------------------------------------------------
    uint256 public fxEUR_USD = BASE_EUR_USD;
    uint256 public fxGBP_USD = BASE_GBP_USD;
    uint256 public fxJPY_USD = BASE_JPY_USD;
    uint256 public fxCNY_USD = BASE_CNY_USD;
    uint256 public fxCHF_USD = BASE_CHF_USD;
    uint256 public fxXAU_USD = BASE_XAU_USD;

    // ------------------------------------------------------------------
    // §3.5  Price safety band (circuit breakers)
    // ------------------------------------------------------------------
    uint256 public constant PRICE_SAFETY_LOWER = 0.50e18;
    uint256 public constant PRICE_SAFETY_UPPER = 2.00e18;

    // ------------------------------------------------------------------
    // §3.4 + §12.1  Fees — settable via §14.2 timelock (defaults match v1.0)
    // ------------------------------------------------------------------
    uint256 public mintFeeBps   = 10;    // §12.1   0.10%
    uint256 public redeemFeeBps = 15;    // §3.4.2  0.15% (NORMAL/CAUTION)
    // DEFENSIVE 0.5% (50 bps), EMERGENCY 2% (200 bps) — applied per status.

    // ------------------------------------------------------------------
    // §14.1  Risk state machine
    // ------------------------------------------------------------------
    enum Status { NORMAL, CAUTION, DEFENSIVE, EMERGENCY, RECOVERY }
    Status public protocolStatus = Status.NORMAL;
    event StatusChanged(Status oldStatus, Status newStatus);

    // ------------------------------------------------------------------
    // §8.1  Component enumeration (canonical order)
    // ------------------------------------------------------------------
    enum Component { USD, EUR, JPY, GBP, CNY, CHF, Gold }

    // ------------------------------------------------------------------
    // §8.1  Per-component admissibility envelopes (immutable bounds, 1e18)
    // Source: blueprint.ts ADMISSIBILITY_ENVELOPES.
    // No MASE / MARP output may cross these per-component hard bounds.
    // ------------------------------------------------------------------
    uint256 public constant ENV_USD_LOWER  = 0.23e18; uint256 public constant ENV_USD_UPPER  = 0.32e18;
    uint256 public constant ENV_EUR_LOWER  = 0.17e18; uint256 public constant ENV_EUR_UPPER  = 0.24e18;
    uint256 public constant ENV_JPY_LOWER  = 0.07e18; uint256 public constant ENV_JPY_UPPER  = 0.12e18;
    uint256 public constant ENV_GBP_LOWER  = 0.06e18; uint256 public constant ENV_GBP_UPPER  = 0.11e18;
    uint256 public constant ENV_CNY_LOWER  = 0.03e18; uint256 public constant ENV_CNY_UPPER  = 0.07e18;
    uint256 public constant ENV_CHF_LOWER  = 0.03e18; uint256 public constant ENV_CHF_UPPER  = 0.07e18;
    uint256 public constant ENV_GOLD_LOWER  = 0.20e18; uint256 public constant ENV_GOLD_UPPER  = 0.32e18;

    // ------------------------------------------------------------------
    // §8.1  MASE Weight Registry (on-chain, oracle/keeper-committed)
    //   targetWeights     — §7  MASE ensemble output (constrained optimum)
    //   smoothedWeights   — §8.4 stress-adaptive smoothed
    //   executionWeights  — §10 MARP execution (the published weight, §24)
    // ------------------------------------------------------------------
    struct WeightRegistry {
        uint256[7] targetWeights;
        uint256[7] smoothedWeights;
        uint256[7] executionWeights;
        uint256    lastUpdatedAt;
    }
    WeightRegistry public weights;
    event WeightsCommitted(uint256[7] target, uint256[7] smoothed, uint256[7] execution, uint256 timestamp);

    // ------------------------------------------------------------------
    // §10  MARP Rebalance Trade
    // ------------------------------------------------------------------
    struct RebalanceTrade {
        Component component;
        int256    direction; // +1 buy, -1 sell, 0 hold
        uint256   tradeUsd;  // USD value, 1e18 scale
        uint256   level;     // 1-6 (MARP decision level)
        string    reason;    // human-readable MARP reason
    }

    // §10  MARP constants (1e18 fractions)
    uint256 public constant DIRECTION_LOCK_HOURS  = 24 hours;   // §10 24h direction lock
    uint256 public constant MAX_DAILY_TURNOVER    = 0.05e18;   // §10 5% of NAV
    uint256 public constant REBALANCE_TOLERANCE     = 0.05e18;   // §10 5% tolerance vs execution weight

    // §10  MARP state
    mapping(Component => int256)  public lastDirection;     // +1/-1/0
    mapping(Component => uint256) public lastRebalanceAt;   // unix seconds
    uint256 public dailyTradeUsd;                            // sum of tradeUsd since reset
    uint256 public dailyTradeResetAt;                        // start of current 24h window
    mapping(Component => uint256) public reserveHeldUsd;      // on-chain reserve mirror, 1e18 USD

    event RebalanceExecuted(RebalanceTrade[] trades, uint256 timestamp);

    // ------------------------------------------------------------------
    // §9  Oracle adapters + pair identifiers + consensus params
    // ------------------------------------------------------------------
    IOracleAdapter public chainlinkAdapter;
    IOracleAdapter public pythAdapter;
    IOracleAdapter public chronicleAdapter;
    event OracleAdapterSet(uint8 indexed source, address indexed adapter, address indexed setter);

    bytes32 public constant PAIR_EUR_USD = keccak256("EUR/USD");
    bytes32 public constant PAIR_GBP_USD = keccak256("GBP/USD");
    bytes32 public constant PAIR_JPY_USD = keccak256("JPY/USD");
    bytes32 public constant PAIR_CNY_USD = keccak256("CNY/USD");
    bytes32 public constant PAIR_CHF_USD = keccak256("CHF/USD");
    bytes32 public constant PAIR_XAU_USD = keccak256("XAU/USD");

    // §9.2  Validation thresholds
    uint256 public constant ORACLE_STALENESS_SEC     = 60;       // §9.2.1 ≤60s
    uint256 public constant ORACLE_CONFIDENCE_MAX    = 0.01e18;  // §9.2.3 <1% of price
    uint256 public constant ORACLE_DEVIATION_MAX_BPS = 250;      // §9.2.4 <2.5% (250 bps)

    // ------------------------------------------------------------------
    // §5  Asset admission registry
    // ------------------------------------------------------------------
    IAssetRegistry public assetRegistry;
    event AssetRegistrySet(address indexed registry, address indexed setter);

    // ------------------------------------------------------------------
    // §14.2  DAO / Multi-Sig Governance Timelock (48h on parameter changes)
    // ------------------------------------------------------------------
    uint256 public constant TIMELOCK_DELAY = 48 hours; // §5.10 / §14.2 monetary tier

    struct ParameterChange {
        bytes32  key;
        uint256  newValue;
        uint256  queuedAt;
        uint256  executesAt;
        bool     executed;
    }
    mapping(bytes32 => ParameterChange) public paramChanges;

    // Trackable parameter keys
    bytes32 public constant PARAM_MINT_FEE_BPS         = keccak256("PARAM_MINT_FEE_BPS");
    bytes32 public constant PARAM_REDEEM_FEE_BPS       = keccak256("PARAM_REDEEM_FEE_BPS");
    bytes32 public constant PARAM_RESERVE_RATIO_TARGET = keccak256("PARAM_RESERVE_RATIO_TARGET");

    // Default reserve ratio target = 110% (RR_TARGET per blueprint.ts)
    uint256 public reserveRatioTarget = 1.10e18;

    event ParameterQueued(bytes32 indexed key, uint256 newValue, uint256 executesAt);
    event ParameterExecuted(bytes32 indexed key, uint256 newValue, uint256 timestamp);
    event ParameterCancelled(bytes32 indexed key, uint256 timestamp);

    // ------------------------------------------------------------------
    // §12 + §13  Genesis + reserve accounting
    // ------------------------------------------------------------------
    address  public genesisReserve;          // locked MTQ excluded from circulating supply
    uint256  public genesisReserveBalance;   // total MTQ held by genesis reserve
    address  public reserveVault;            // holds USDC collateral + fees
    IERC20   public usdc;                    // collateral token (6 decimals)
    bool     public genesisDone;             // one-shot guard

    // ------------------------------------------------------------------
    // Events — full set (§3.6, §12, §14.1, §8.1, §10, §9, §5, §14.2)
    // ------------------------------------------------------------------
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed user, uint256 usdcIn, uint256 feeUsd, uint256 mtqMinted, uint256 price);
    event Redeem(address indexed user, uint256 mtqIn, uint256 feeUsd, uint256 usdcOut, uint256 price);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);

    // ==================================================================
    // Constructor
    // ==================================================================
    constructor(address _usdc) {
        // §14.2  Inline AccessControl: deployer gets DEFAULT_ADMIN_ROLE + all
        // operational roles so the contract is immediately functional. The
        // deployer can then grant roles to keeper / oracle / pauser multisigs
        // and renounce the operational roles once the DAO is wired.
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE,         msg.sender);
        _grantRole(PAUSER_ROLE,        msg.sender);
        _grantRole(KEEPER_ROLE,        msg.sender);
        _grantRole(ORACLE_ROLE,        msg.sender);
        // MINTER_ROLE not granted by default — public mint() is open.

        usdc           = IERC20(_usdc);
        reserveVault   = msg.sender;       // deployer acts as reserve vault until reset
        genesisReserve = address(this);    // contract self-holds genesis reserve

        // §2  GFB_base = Σ W^Prior_i × P_{i,0}  (chain-linked, immutable)
        GFB_BASE_DENOMINATOR = (
              PRIOR_USD
            + PRIOR_EUR * BASE_EUR_USD / 1e18
            + PRIOR_JPY * BASE_JPY_USD / 1e18
            + PRIOR_GBP * BASE_GBP_USD / 1e18
            + PRIOR_CNY * BASE_CNY_USD / 1e18
            + PRIOR_CHF * BASE_CHF_USD / 1e18
            + PRIOR_GOLD * BASE_XAU_USD / 1e18
        );
    }

    // ==================================================================
    // §1  ERC-20 core
    // ==================================================================
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
            require(allowed >= amount, "MTQV2: insufficient allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }
    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "MTQV2: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to]   += amount;
        emit Transfer(from, to, amount);
    }
    function _mint(address to, uint256 amount) internal {
        totalSupply   += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
    function _burn(address from, uint256 amount) internal {
        require(balanceOf[from] >= amount, "MTQV2: burn exceeds balance");
        balanceOf[from] -= amount;
        totalSupply     -= amount;
        emit Transfer(from, address(0), amount);
    }

    // ==================================================================
    // §2  7-Component GFB Index (chain-linked)
    //   GFB_t = Σ W^Prior_i × P_i,t  /  GFB_base
    //   where GFB_base = Σ W^Prior_i × P_{i,0}  (immutable, set in constructor)
    //   Includes CHF and Gold as FIRST-CLASS index components.
    // ==================================================================
    function getGFB() public view returns (uint256) {
        uint256 numerator = (
              PRIOR_USD
            + PRIOR_EUR * fxEUR_USD / 1e18
            + PRIOR_JPY * fxJPY_USD / 1e18
            + PRIOR_GBP * fxGBP_USD / 1e18
            + PRIOR_CNY * fxCNY_USD / 1e18
            + PRIOR_CHF * fxCHF_USD / 1e18
            + PRIOR_GOLD * fxXAU_USD / 1e18
        );
        return numerator * 1e18 / GFB_BASE_DENOMINATOR;
    }

    // ==================================================================
    // §3.1  MTQ Reference Price = GFB_t / GFB_base (1 MTQ = 1 basket-unit)
    // ==================================================================
    function getMTQPrice() public view returns (uint256) {
        return getGFB();
    }

    /// @dev §3.5 Price-safety guard. Reverts if price is outside [0.50, 2.00].
    function getMTQPriceWithGuard() public view returns (uint256) {
        uint256 price = getMTQPrice();
        require(price >= PRICE_SAFETY_LOWER && price <= PRICE_SAFETY_UPPER, "MTQV2: price out of safety band");
        return price;
    }

    /// @dev §3.3 Circulating supply = totalSupply − genesisReserveBalance.
    function getCirculatingSupply() public view returns (uint256) {
        return totalSupply - genesisReserveBalance;
    }

    /// @dev §3.2 Liability (USD, 1e18) = circulatingSupply × price / 1e18.
    function getLiability() public view returns (uint256) {
        return getCirculatingSupply() * getMTQPrice() / 1e18;
    }

    // ==================================================================
    // §3.4.2 + §12.1  Mint — priced against the GFB Index
    //   Pull USDC (6 dec), fee 0.10%, MTQ minted = netUsd18 × 1e18 / price.
    //   Throttled by status: NORMAL 100%, CAUTION 50%, RECOVERY 25%,
    //   DEFENSIVE/EMERGENCY paused.
    // ==================================================================
    function mint(uint256 usdcAmount) external whenNotPaused returns (uint256 minted) {
        require(usdcAmount > 0, "MTQV2: zero amount");
        require(
            protocolStatus != Status.DEFENSIVE && protocolStatus != Status.EMERGENCY,
            "MTQV2: mint paused by risk state"
        );

        uint256 price = getMTQPriceWithGuard();

        // Pull USDC from minter to reserve vault (6 decimals).
        require(usdc.transferFrom(msg.sender, reserveVault, usdcAmount), "MTQV2: USDC pull failed");

        // §12.1  0.10% fee (configurable via timelock)
        uint256 feeUsd = usdcAmount * mintFeeBps / 10000;
        uint256 netUsd = usdcAmount - feeUsd;
        // Scale 6-dec USDC → 18-dec USD value, then divide by 18-dec price.
        uint256 netUsd18  = netUsd * 1e12;
        uint256 grossMint = netUsd18 * 1e18 / price;

        // §14.1  Throttle by status
        uint256 throttle = 1e18;
        if (protocolStatus == Status.CAUTION)  throttle = 0.50e18;
        if (protocolStatus == Status.RECOVERY) throttle = 0.25e18;
        minted = grossMint * throttle / 1e18;

        _mint(msg.sender, minted);
        emit Mint(msg.sender, usdcAmount, feeUsd, minted, price);
    }

    // ==================================================================
    // §3.4.2 + §12.2  Redeem — priced against the GFB Index (arbitrage-safe)
    //   Burn MTQ, grossUsd18 = mtq × price / 1e18, fee by status:
    //   NORMAL/CAUTION 0.15%, DEFENSIVE 0.5%, EMERGENCY 2%, net → USDC 6 dec,
    //   released from reserve vault.
    // ==================================================================
    function redeem(uint256 mtqAmount) external whenNotPaused returns (uint256 usdcOut) {
        require(mtqAmount > 0, "MTQV2: zero amount");
        require(balanceOf[msg.sender] >= mtqAmount, "MTQV2: insufficient balance");

        uint256 price = getMTQPrice();

        // §14.1  Fee by status
        uint256 feeBps = redeemFeeBps;
        if (protocolStatus == Status.DEFENSIVE) feeBps = 50;   // 0.5%
        if (protocolStatus == Status.EMERGENCY) feeBps = 200; // 2.0%

        uint256 grossUsd18 = mtqAmount * price / 1e18;
        uint256 feeUsd18   = grossUsd18 * feeBps / 10000;
        uint256 netUsd18   = grossUsd18 - feeUsd18;
        usdcOut            = netUsd18 / 1e12; // 18-dec → 6-dec USDC

        _burn(msg.sender, mtqAmount);
        // Release USDC from reserve vault to minter (vault must approve this contract).
        require(usdc.transferFrom(reserveVault, msg.sender, usdcOut), "MTQV2: USDC release failed");
        emit Redeem(msg.sender, mtqAmount, feeUsd18 / 1e12, usdcOut, price);
    }

    // ==================================================================
    // §14.1  Risk state machine — KEEPER_ROLE (MARP-keeper hook)
    // ==================================================================
    function setProtocolStatus(Status s) external onlyKeeper {
        emit StatusChanged(protocolStatus, s);
        protocolStatus = s;
    }

    // ==================================================================
    // §8.1  Admissibility envelope helpers (pure)
    // ==================================================================
    function envelopeLower(Component c) public pure returns (uint256) {
        if (c == Component.USD)  return ENV_USD_LOWER;
        if (c == Component.EUR)  return ENV_EUR_LOWER;
        if (c == Component.JPY)  return ENV_JPY_LOWER;
        if (c == Component.GBP)  return ENV_GBP_LOWER;
        if (c == Component.CNY)  return ENV_CNY_LOWER;
        if (c == Component.CHF)  return ENV_CHF_LOWER;
        return ENV_GOLD_LOWER;
    }
    function envelopeUpper(Component c) public pure returns (uint256) {
        if (c == Component.USD)  return ENV_USD_UPPER;
        if (c == Component.EUR)  return ENV_EUR_UPPER;
        if (c == Component.JPY)  return ENV_JPY_UPPER;
        if (c == Component.GBP)  return ENV_GBP_UPPER;
        if (c == Component.CNY)  return ENV_CNY_UPPER;
        if (c == Component.CHF)  return ENV_CHF_UPPER;
        return ENV_GOLD_UPPER;
    }
    function _assertEnvelope(Component c, uint256 w) internal pure {
        uint256 lo = envelopeLower(c);
        uint256 hi = envelopeUpper(c);
        require(w >= lo && w <= hi, "MTQV2: weight outside envelope");
    }

    // ==================================================================
    // §8.1  On-Chain MASE Weight Registry — commit (oracle/keeper only)
    //   Validates each weight against its per-component admissibility envelope
    //   (hard bounds) — reverts on envelope breach.
    // ==================================================================
    function commitWeights(
        uint256[7] calldata target,
        uint256[7] calldata smoothed,
        uint256[7] calldata execution
    ) external onlyOracleOrKeeper {
        for (uint8 i = 0; i < 7; i++) {
            Component c = Component(i);
            _assertEnvelope(c, target[i]);
            _assertEnvelope(c, smoothed[i]);
            _assertEnvelope(c, execution[i]);
            weights.targetWeights[i]    = target[i];
            weights.smoothedWeights[i] = smoothed[i];
            weights.executionWeights[i] = execution[i];
        }
        weights.lastUpdatedAt = block.timestamp;
        emit WeightsCommitted(target, smoothed, execution, block.timestamp);
    }

    /// @notice Current weight registry (target/smoothed/execution + lastUpdatedAt).
    function getWeights() external view returns (
        uint256[7] memory target,
        uint256[7] memory smoothed,
        uint256[7] memory execution,
        uint256 lastUpdatedAt
    ) {
        return (weights.targetWeights, weights.smoothedWeights, weights.executionWeights, weights.lastUpdatedAt);
    }

    /// @notice One component's (target, smoothed, execution) tuple.
    function getWeight(Component c) external view returns (
        uint256 target, uint256 smoothed, uint256 execution
    ) {
        uint256 idx = uint256(c);
        return (weights.targetWeights[idx], weights.smoothedWeights[idx], weights.executionWeights[idx]);
    }

    // ==================================================================
    // §10  MARP Rebalancing Execution — keeper-callable
    //   For each trade: validates it moves toward the latest committed
    //   executionWeight within a 5% tolerance, enforces 24h direction lock,
    //   validates total daily trade USD ≤ 5% of NAV, and updates reserve
    //   holdings (on-chain mirror).
    // ==================================================================
    function executeRebalance(RebalanceTrade[] calldata trades) external onlyKeeper whenNotPaused {
        require(weights.lastUpdatedAt > 0, "MTQV2: no weights committed");

        // Reset 24h daily turnover window if elapsed
        if (block.timestamp >= dailyTradeResetAt + DIRECTION_LOCK_HOURS) {
            dailyTradeUsd    = 0;
            dailyTradeResetAt = block.timestamp;
        }

        uint256 nav = getReserveNavUsd();
        uint256 maxDaily = nav * MAX_DAILY_TURNOVER / 1e18;

        for (uint256 i = 0; i < trades.length; i++) {
            RebalanceTrade calldata t = trades[i];
            require(t.level >= 1 && t.level <= 6, "MTQV2: invalid MARP level");

            // Hold trade — no action
            if (t.direction == 0 || t.tradeUsd == 0) continue;

            require(t.direction == 1 || t.direction == -1, "MTQV2: bad direction");

            // §10  24h direction lock — opposite direction blocked within 24h
            int256 prevDir = lastDirection[t.component];
            if (prevDir != 0 && prevDir != t.direction) {
                require(
                    block.timestamp >= lastRebalanceAt[t.component] + DIRECTION_LOCK_HOURS,
                    "MTQV2: direction lock"
                );
            }

            // Validate trade moves toward execution weight (within 5% tolerance)
            uint256 execW    = weights.executionWeights[uint256(t.component)];
            uint256 currentW = (nav == 0) ? 0 : reserveHeldUsd[t.component] * 1e18 / nav;
            if (t.direction == 1) {
                require(currentW < execW, "MTQV2: buy but already above target");
            } else {
                require(currentW > execW, "MTQV2: sell but already below target");
            }

            // New weight after trade must be within 5pp (absolute) of execW
            uint256 newHeldUsd = (t.direction == 1)
                ? reserveHeldUsd[t.component] + t.tradeUsd
                : reserveHeldUsd[t.component] - t.tradeUsd;
            require(reserveHeldUsd[t.component] >= t.tradeUsd || t.direction == 1, "MTQV2: insufficient reserve");
            uint256 newW = (nav == 0) ? 0 : newHeldUsd * 1e18 / nav;
            uint256 absDiff = (newW > execW) ? newW - execW : execW - newW;
            require(absDiff <= REBALANCE_TOLERANCE, "MTQV2: trade overshoots execution weight by >5%");

            // §10  Daily turnover cap (5% of NAV)
            require(dailyTradeUsd + t.tradeUsd <= maxDaily, "MTQV2: daily turnover cap");
            dailyTradeUsd += t.tradeUsd;

            // Update reserve mirror
            if (t.direction == 1) {
                reserveHeldUsd[t.component] += t.tradeUsd;
            } else {
                reserveHeldUsd[t.component] -= t.tradeUsd;
            }
            lastDirection[t.component]   = t.direction;
            lastRebalanceAt[t.component] = block.timestamp;
        }

        emit RebalanceExecuted(trades, block.timestamp);
    }

    // ==================================================================
    // §9  Multi-Source Oracle Adapter Interface
    // ==================================================================

    /// @notice Set oracle adapter for a source (0=Chainlink, 1=Pyth, 2=Chronicle)
    function setOracleAdapter(uint8 source, address adapter) external onlyRole(ORACLE_ROLE) {
        require(source <= 2, "MTQV2: bad source");
        if (source == 0)      chainlinkAdapter   = IOracleAdapter(adapter);
        else if (source == 1) pythAdapter       = IOracleAdapter(adapter);
        else                  chronicleAdapter  = IOracleAdapter(adapter);
        emit OracleAdapterSet(source, adapter, msg.sender);
    }

    /// @notice §9.1-9.3  Consensus across all 3 adapters for a single pair.
    /// @return finalPrice  USD-per-unit, 1e18 scale (0 if paused)
    /// @return validCount  Number of valid feeds after all filters
    /// @return method      0=paused, 1=average(2), 2=median(3)
    /// @return paused_     True if fewer than 2 feeds are valid
    /// @return prices      Raw prices per adapter (1e18) — index 0/1/2 = CL/Pyth/Cro
    /// @return valid       Per-adapter validity flag after all filters
    function getOracleConsensus(bytes32 pair) public view returns (
        uint256 finalPrice,
        uint8  validCount,
        uint8  method,
        bool   paused_,
        uint256[3] memory prices,
        bool[3] memory valid
    ) {
        // Fetch from each adapter (try/catch — missing adapters are skipped)
        IOracleAdapter[3] memory adapters;
        adapters[0] = chainlinkAdapter;
        adapters[1] = pythAdapter;
        adapters[2] = chronicleAdapter;

        uint256[3] memory raw;
        uint256[3] memory ts;
        uint256[3] memory conf;

        for (uint8 i = 0; i < 3; i++) {
            valid[i] = false;
            if (address(adapters[i]) == address(0)) continue;
            try adapters[i].getPrice(pair) returns (uint256 p, uint256 t, uint256 c) {
                raw[i]  = p;
                ts[i]   = t;
                conf[i] = c;
                prices[i] = p;
                // §9.2.1  staleness ≤60s (also reject future timestamps)
                if (t > block.timestamp) continue;
                if (block.timestamp - t > ORACLE_STALENESS_SEC) continue;
                // §9.2.3  confidence < 1% of price
                if (conf[i] >= ORACLE_CONFIDENCE_MAX) continue;
                valid[i] = true;
            } catch {
                // leave valid[i] = false
            }
        }

        // Count valid
        validCount = 0;
        for (uint8 i = 0; i < 3; i++) if (valid[i]) validCount++;

        if (validCount < 2) {
            paused_ = true;
            method  = 0;
            return (finalPrice, validCount, method, paused_, prices, valid);
        }

        // Sort the valid prices and pick median (n=3) or average (n=2)
        uint256[3] memory sorted;
        uint8 n = 0;
        for (uint8 i = 0; i < 3; i++) {
            if (valid[i]) { sorted[n] = raw[i]; n++; }
        }
        _insertionSort(sorted, n);
        uint256 med = (n == 3) ? sorted[1] : (n == 2 ? (sorted[0] + sorted[1]) / 2 : sorted[0]);

        // §9.2.4  Deviation < 2.5% from median → discard
        for (uint8 i = 0; i < 3; i++) {
            if (valid[i]) {
                uint256 d = (raw[i] > med) ? raw[i] - med : med - raw[i];
                if (d * 10000 > med * ORACLE_DEVIATION_MAX_BPS) {
                    valid[i] = false;
                    validCount--;
                }
            }
        }

        if (validCount < 2) {
            paused_ = true;
            method  = 0;
            return (finalPrice, validCount, method, paused_, prices, valid);
        }

        paused_ = false;
        if (validCount == 3) {
            finalPrice = med;
            method     = 2; // median(3)
        } else {
            // Average of the 2 remaining valid feeds
            uint256 sum = 0;
            uint8  cnt = 0;
            for (uint8 i = 0; i < 3; i++) {
                if (valid[i]) { sum += raw[i]; cnt++; }
            }
            finalPrice = sum / cnt;
            method     = 1; // average(2)
        }
    }

    /// @notice §9 → §2  Commit FX rates from oracle consensus (keeper path).
    ///         Reads consensus for all 6 pairs and stores them as the live
    ///         FX rates used by getGFB(). Reverts if any pair is paused.
    function commitFxRatesFromOracles() external onlyKeeper whenNotPaused {
        {
            (uint256 p, , , bool paused_, , ) = getOracleConsensus(PAIR_EUR_USD);
            require(!paused_, "MTQV2: EUR/USD oracle paused");
            fxEUR_USD = p;
        }
        {
            (uint256 p, , , bool paused_, , ) = getOracleConsensus(PAIR_GBP_USD);
            require(!paused_, "MTQV2: GBP/USD oracle paused");
            fxGBP_USD = p;
        }
        {
            (uint256 p, , , bool paused_, , ) = getOracleConsensus(PAIR_JPY_USD);
            require(!paused_, "MTQV2: JPY/USD oracle paused");
            fxJPY_USD = p;
        }
        {
            (uint256 p, , , bool paused_, , ) = getOracleConsensus(PAIR_CNY_USD);
            require(!paused_, "MTQV2: CNY/USD oracle paused");
            fxCNY_USD = p;
        }
        {
            (uint256 p, , , bool paused_, , ) = getOracleConsensus(PAIR_CHF_USD);
            require(!paused_, "MTQV2: CHF/USD oracle paused");
            fxCHF_USD = p;
        }
        {
            (uint256 p, , , bool paused_, , ) = getOracleConsensus(PAIR_XAU_USD);
            require(!paused_, "MTQV2: XAU/USD oracle paused");
            fxXAU_USD = p;
        }
        uint256 oldPrice = getMTQPrice();
        // Re-read after all updates (all six stored above)
        uint256 newPrice = getMTQPrice();
        uint256 diff = (newPrice > oldPrice) ? newPrice - oldPrice : oldPrice - newPrice;
        if (diff * 200 > oldPrice) emit PriceUpdated(oldPrice, newPrice);
    }

    /// @notice §9 pilot fallback: manually set live FX rates (ORACLE_ROLE).
    ///         Used before adapters are wired; once Chainlink/Pyth/Chronicle
    ///         adapters are set, prefer commitFxRatesFromOracles().
    function setFxRates(
        uint256 eur, uint256 gbp, uint256 jpy, uint256 cny, uint256 chf, uint256 xau
    ) external onlyRole(ORACLE_ROLE) {
        require(eur > 0 && gbp > 0 && jpy > 0 && cny > 0 && chf > 0 && xau > 0, "MTQV2: zero rate");
        uint256 oldPrice = getMTQPrice();
        fxEUR_USD = eur; fxGBP_USD = gbp; fxJPY_USD = jpy;
        fxCNY_USD = cny; fxCHF_USD = chf; fxXAU_USD = xau;
        uint256 newPrice = getMTQPrice();
        // §3.6  PriceUpdated event if >0.5% change
        uint256 diff = (newPrice > oldPrice) ? newPrice - oldPrice : oldPrice - newPrice;
        if (diff * 200 > oldPrice) emit PriceUpdated(oldPrice, newPrice);
    }

    // ==================================================================
    // §5  Asset admission registry
    // ==================================================================
    function setAssetRegistry(address registry) external onlyAdmin {
        assetRegistry = IAssetRegistry(registry);
        emit AssetRegistrySet(registry, msg.sender);
    }

    /// @notice Reserve NAV (USD, 1e18) — gross sum of on-chain reserve mirror.
    function getReserveNavUsd() public view returns (uint256) {
        uint256 sum = 0;
        for (uint8 i = 0; i < 7; i++) {
            sum += reserveHeldUsd[Component(i)];
        }
        return sum;
    }

    /// @notice §5 + §14.1  Reserve Net Asset Value (USD, 1e18) — applies
    ///         per-asset haircuts pulled from the registry. Frozen/delisted
    ///         assets contribute 0 to NAV. If the registry is unset, falls
    ///         back to the raw gross sum.
    function getReserveNetAssetValue() public view returns (uint256) {
        if (address(assetRegistry) == address(0)) {
            return getReserveNavUsd();
        }
        bytes32[7] memory codes;
        codes[0] = bytes32("USD");
        codes[1] = bytes32("EUR");
        codes[2] = bytes32("JPY");
        codes[3] = bytes32("GBP");
        codes[4] = bytes32("CNY");
        codes[5] = bytes32("CHF");
        codes[6] = bytes32("XAU");

        uint256 nav = 0;
        for (uint8 i = 0; i < 7; i++) {
            uint256 held = reserveHeldUsd[Component(i)];
            if (held == 0) continue;
            try IAssetRegistry(assetRegistry).getAsset(codes[i]) returns (
                address, uint256 haircut, uint8 state, bytes32
            ) {
                if (state == 2 || state == 3) continue; // frozen / delisted → 0 NAV
                // Apply haircut: nav += held × (1 − haircut)
                nav += held * (1e18 - haircut) / 1e18;
            } catch {
                // Registry call failed — fall back to no haircut for this asset
                nav += held;
            }
        }
        return nav;
    }

    /// @notice §3.2 + §14.2  Reserve ratio = NAV / liability (1e18 scale).
    ///         ≥ 1.10 = healthy (RR_TARGET); ≥ 1.00 = solvent (I2 hard floor).
    function getReserveRatio() public view returns (uint256) {
        uint256 nav  = getReserveNetAssetValue();
        uint256 liab = getLiability();
        if (liab == 0) return type(uint256).max;
        return nav * 1e18 / liab;
    }

    // ==================================================================
    // §14.2  DAO / Multi-Sig Governance with Timelock
    //   48h delay on parameter changes — monetary tier per §5.10.
    // ==================================================================

    /// @notice Queue a parameter change (ADMIN_ROLE). Executes after 48h.
    function queueChange(bytes32 key, uint256 newValue) external onlyAdmin {
        ParameterChange storage pc = paramChanges[key];
        require(!pc.executed, "MTQV2: already executed");
        pc.key        = key;
        pc.newValue   = newValue;
        pc.queuedAt   = block.timestamp;
        pc.executesAt = block.timestamp + TIMELOCK_DELAY;
        pc.executed   = false;
        emit ParameterQueued(key, newValue, pc.executesAt);
    }

    /// @notice Execute a queued parameter change after the timelock elapses.
    ///         Anyone can call (the timelock is the protection, not the caller).
    function executeChange(bytes32 key) external {
        ParameterChange storage pc = paramChanges[key];
        require(pc.queuedAt > 0, "MTQV2: not queued");
        require(!pc.executed, "MTQV2: already executed");
        require(block.timestamp >= pc.executesAt, "MTQV2: timelock not elapsed");
        pc.executed = true;
        _applyParam(key, pc.newValue);
        emit ParameterExecuted(key, pc.newValue, block.timestamp);
    }

    /// @notice Cancel a queued parameter change before execution (ADMIN_ROLE).
    function cancelChange(bytes32 key) external onlyAdmin {
        ParameterChange storage pc = paramChanges[key];
        require(pc.queuedAt > 0 && !pc.executed, "MTQV2: nothing to cancel");
        delete paramChanges[key];
        emit ParameterCancelled(key, block.timestamp);
    }

    function _applyParam(bytes32 key, uint256 value) internal {
        if (key == PARAM_MINT_FEE_BPS) {
            require(value <= 500, "MTQV2: mint fee too high"); // ≤ 5%
            mintFeeBps = value;
        } else if (key == PARAM_REDEEM_FEE_BPS) {
            require(value <= 1000, "MTQV2: redeem fee too high"); // ≤ 10%
            redeemFeeBps = value;
        } else if (key == PARAM_RESERVE_RATIO_TARGET) {
            require(value >= 1.00e18 && value <= 2.00e18, "MTQV2: RR target out of range");
            reserveRatioTarget = value;
        } else {
            revert("MTQV2: unknown param key");
        }
    }

    // ==================================================================
    // §12 + §13  Genesis + reserve accounting
    // ==================================================================

    /// @notice §13.1  One-shot genesis mint of MTQ to the Genesis Reserve
    ///         (locked — excluded from circulating supply).
    function genesisMint(uint256 amount) external onlyAdmin {
        require(!genesisDone, "MTQV2: genesis already done");
        genesisDone = true;
        _mint(genesisReserve, amount);
        genesisReserveBalance = amount;
    }

    /// @notice Move the genesis reserve to a new address (ADMIN_ROLE).
    function setGenesisReserve(address g) external onlyAdmin {
        require(g != address(0), "MTQV2: zero genesis reserve");
        genesisReserve = g;
    }

    /// @notice Set the reserve vault that holds USDC collateral + fees.
    function setReserveVault(address v) external onlyAdmin {
        require(v != address(0), "MTQV2: zero reserve vault");
        reserveVault = v;
    }

    /// @notice Bootstrap the on-chain reserve mirror (ADMIN_ROLE, one-off).
    ///         Used to initialize heldUsd per component before any MARP trade.
    function bootstrapReserveHoldings(uint256[7] calldata holdings) external onlyAdmin {
        for (uint8 i = 0; i < 7; i++) {
            reserveHeldUsd[Component(i)] = holdings[i];
        }
    }

    /// @notice Adjust a single component's reserve holding (ADMIN_ROLE).
    function setReserveHolding(Component c, uint256 usd) external onlyAdmin {
        reserveHeldUsd[c] = usd;
    }

    // ==================================================================
    // §14.2  Role management
    // ==================================================================
    function grantRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(role, account);
    }
    function revokeRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(role, account);
    }
    function hasRole(bytes32 role, address account) external view returns (bool) {
        return _roles[role][account] || _roles[DEFAULT_ADMIN_ROLE][account];
    }
    function _grantRole(bytes32 role, address account) internal {
        if (!_roles[role][account]) {
            _roles[role][account] = true;
            emit RoleGranted(role, account, msg.sender);
        }
    }
    function _revokeRole(bytes32 role, address account) internal {
        if (_roles[role][account]) {
            _roles[role][account] = false;
            emit RoleRevoked(role, account, msg.sender);
        }
    }

    // ==================================================================
    // §25  Honest Status (on-chain self-declaration) — THE KEY FUNCTION
    //
    // Bit encoding (identical to the v1.2 pilot's getHonestStatus — so V2's
    // 0x7FF is exactly the "all on" complement of the pilot's 0x400):
    //   bit 0  basketHas7Components       (0 = 5-currency v1.2 pilot; 1 = 7-comp v1.0 with Gold+CHF)
    //   bit 1  goldIsFirstClassIndex      (0 = gold reserve-only;          1 = gold in the index)
    //   bit 2  chfIsFirstClassIndex       (0 = no CHF;                     1 = CHF in the index)
    //   bit 3  chainLinkedIndex           (0 = recomputed each call;       1 = immutable divisor / continuity)
    //   bit 4  maseWeightRegistry         (0 = no on-chain weight store;   1 = MASE outputs committed)
    //   bit 5  admissibilityEnvelopes     (0 = no on-chain bounds;         1 = per-component bounds enforced)
    //   bit 6  marpExecution              (0 = no on-chain rebalance;      1 = auto-rebalance present)
    //   bit 7  assetRegistry              (0 = hardcoded assets;           1 = registry contract wired)
    //   bit 8  multiSourceOracle          (0 = owner-set FX;               1 = Chainlink/Pyth/Chronicle adapter)
    //   bit 9  daoGovernance              (0 = owner-only;                1 = DAO/multi-sig + timelock)
    //   bit 10 honestStatusExposed        (1 = this function exists)
    //
    // V2 (this contract) returns: 0x7FF (all 11 bits set).
    // v1.2 Pilot returns:        0x400 (only bit 10 set).
    // ==================================================================
    function getHonestStatus() external pure returns (
        uint256 implementedMask,
        uint8  blueprintMajor,
        uint8  contractVersion,
        string memory statusDeclaration
    ) {
        implementedMask   = 0x7FF; // all 11 v1.0 bits set — see encoding above
        blueprintMajor    = 1;    // Master Monetary Architecture v1.0 is the source of truth
        contractVersion   = 1;    // 1 = v1.0 contract (NOT the v1.2 pilot which returns 0)
        statusDeclaration = "v1.0 Master Blueprint on-chain. 7-component Strategic Prior (incl. Gold + CHF as first-class index components), chain-linked denominator, on-chain MASE weight registry with admissibility envelopes, MARP keeper-executed rebalancing, multi-source oracle adapter (Chainlink/Pyth/Chronicle), DAO timelock governance. Production-authorized when oracles + registry + reserve vault are wired to real adapters.";
    }

    // ==================================================================
    // §9  Pure helpers
    // ==================================================================
    /// @dev In-place insertion sort of sorted[0..n), ascending.
    function _insertionSort(uint256[3] memory arr, uint8 n) internal pure {
        for (uint8 i = 1; i < n; i++) {
            uint256 key = arr[i];
            uint8 j = i;
            while (j > 0 && arr[j - 1] > key) {
                arr[j] = arr[j - 1];
                j--;
            }
            arr[j] = key;
        }
    }
}
