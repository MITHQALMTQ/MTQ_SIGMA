// SPDX-License-Identifier: MIT
//
// ============================================================================
//  MTQΣ — The Global Purchasing Power Unit
//  MTQSigmaV4.sol — Registry-based dynamic-membership reference contract
//  ----------------------------------------------------------------------------
//  REGISTRY-ONLY · NO TOKEN · NO RESERVE CUSTODY · DYNAMIC CONSTITUENCY ·
//  LIFECYCLE STATE MACHINE T1–T9 · EXACT-1e18 BP-QUANTIZED WEIGHTS ·
//  N_max CONSTITUTIONAL TWO-STEP TIMELOCK
// ============================================================================
//
//  PROVENANCE
//   • Design plan: audit-work/task13/v4-contract-dynamic-membership-
//     design-plan.md (status: IMPLEMENTED as a testnet reference layer —
//     Solidity source + compiled artifact + solcjs reproducible harness;
//     UNDEPLOYED; prior status PROPOSED superseded by owner directive
//     2026-11-03 "fix and implement the honest-limits items" — TASK-39).
//   • Governing spec: audit-work/task13/currency-constituency-and-weight-
//     transition-spec.md (v0.1 PROPOSED — Gate C; §13 parameters UNAPPROVED
//     DRAFT). Every rule below cites its spec § in the function NatSpec.
//
//  HONEST POSTURE (read before citing)
//   • UNDEPLOYED reference implementation. Never deployed to any network.
//   • Production deployment is Gate-C / Task-12-gated (the authority
//     migration D8 chain must execute first — spec §11 risk 6, carried,
//     blocking).
//   • NEVER AUDITED. No independent security review exists for this file.
//   • TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE
//     TRANSACTIONS FORBIDDEN · NOT ACCEPTED. No economic parameter herein
//     is production-approved (spec §13 — all values DRAFT, UNAPPROVED).
//   • This contract records governance OUTCOMES and weight commitments; it
//     does NOT verify off-chain rule evidence (scores, observation windows,
//     pre-announcement notices) — it stores their HASHES. The rule engine
//     itself is the TS reference layer src/lib/mtq/constituency/engine.ts
//     (TASK 39-a owns the src/ side; TASK 39-b does not touch src/). The
//     trust split is documented in the design plan §3/§8.
//
//  WHY V4 EXISTS — the spec §9 BLOCKER ("the fixed-7 architecture is
//  hard-coded at every layer … contract-level redesign … not parameter
//  changes"), itemized as the spec §8 breaking changes vs V2/V3 (line
//  numbers VERIFIED by direct read this session):
//   (1) bytes3[7] fixed component shapes → registry-ID mapping + dynamic
//       iteration. Evidence: MTQSigmaV2.sol:298 (`bytes3[7] public
//       COMPONENTS`), :301-305 (`uint256[7]` LOWER_BOUND / UPPER_BOUND /
//       MAX_VELOCITY); MTQSigmaV3.sol:288, :291-295 (identical shapes);
//       every weight loop is `for (i < 7)` (e.g. V2:523-549, V3:1315-1341).
//   (2) uint256[7] envelope/velocity arrays → per-record fields.
//       Evidence: V2:301-305 / V3:291-295; `setEnvelopes` (V2:560-564 /
//       V3:1344-1348) mutates bounds but can NEVER change component count.
//   (3) Positive-weights-only submission → 0 allowed exactly for
//       non-ACTIVE slots + ACTIVE-set membership precondition.
//       Evidence: V2:526 (`if (!(target[i] > 0)) revert Err62();`) and
//       V3:1317 (identical) — under that rule an exit can never reach 0
//       on-chain, so NO exit transition is expressible at all (spec §5.4).
//   (4) Commit tolerance ±1e14 → EXACT 1e18. Evidence: V2:638 and V3:1388
//       (`weightSum > 1e18 + 1e14 || weightSum < 1e18 - 1e14 → revert`) —
//       tightened to exact because bp quantization (spec §5.3) makes
//       exactness achievable via largest-remainder rounding off-chain.
//   (5) TS reference layer: literal unions (`mase.ts:10-11`,
//       `currency.ts:5-23`) → registry-driven; `length !== 7` guard
//       (`chain-index.ts:236-241`) → registry-length validation; 6-leg
//       oracle board → per-component leg provisioning; genesis 7-fixings →
//       genesis over the registered set. OWNED BY TASK 39-a (src/ is NOT
//       touched by this TASK 39-b deliverable).
//   (6) Foundry suites for V2/V3 must be rewritten for the registry ABI —
//       future work, deliberately NOT done here (design plan §8).
//
//  WHAT V4 IS NOT
//   • Not a token: no ERC-20 surface, no mint/redeem, no reserve custody,
//     no oracle consensus, no chain-linked index recursion, no risk state
//     machine. It is the constituency/weight registry layer ONLY — the
//     spec §2 hybrid model (c): on-chain stores {id, status, bounds,
//     weight}; the full dossier (scoring inputs, provenance, decision IDs,
//     quorum records) lives off-chain, committed here as hashes.
//   • Not an upgrade of V2/V3: a clean-slate redeploy path. V2/V3 were
//     never deployed (DEVELOPER-REPORTED, MTQSigmaV2-PENDING.json per
//     Stage A); the deployed v1.2 estate is a different economic family
//     (C-INV-2) and remains untouched (no-reserve-model-compatibility-
//     and-migration.md §3: "contract redesigns, not parameterizations").
//
//  ROLE MODEL (mirrors V3's inlined AccessControl conventions — V3 role
//  names are DEFAULT_ADMIN_ROLE / ADMIN_ROLE / MINTER_ROLE / PAUSER_ROLE /
//  KEEPER_ROLE / ORACLE_ROLE / MONETARY_CONTROL_ROLE plus council
//  ADDRESSES; V3 has NO MTQ_GOVERNANCE_ROLE — its governance surface is
//  the constitutionalCouncil address pattern. V4 therefore mirrors the
//  carried-over names and adds two registry-specific roles):
//   • DEFAULT_ADMIN_ROLE / ADMIN_ROLE / KEEPER_ROLE — V3 names, unchanged
//     semantics (KEEPER submits weights, mirroring V3's onlyKeeper
//     submitTargetWeights).
//   • MTQ_GOVERNANCE_ROLE — NEW in V4: the consolidated governance
//     authority for T1/T2/T3/T4/T5/T6/T8/T9 recorders and the N_max
//     timelock (the spec's Monetary Authority / Risk Council / Economic
//     Authority separation is off-chain; see design plan §3 for the
//     documented flattening).
//   • MTQ_EMERGENCY_ROLE — NEW in V4: the T7 emergency authority (spec
//     §3 T7: Emergency Council 2-of-3 — the 2-of-3 quorum is an off-chain
//     multi-sig property, disclosed).
//
//  Compilation (reproducible — see design plan §7):
//    node contracts/out-v4/compile-standard.mjs ../MTQSigmaV4.sol v4 200 true shanghai
//  Single-file, no external imports — every needed interface is inline,
//  exactly as V2/V3 are for the same solcjs standard-JSON harness.
// ============================================================================

pragma solidity ^0.8.20;

// ============================================================================
// §0  Interfaces (no external imports — everything inline, as V2/V3)
// ============================================================================

/// @notice Minimal ERC-20 interface, retained verbatim from V2/V3 for
///         harness-convention symmetry and future settlement-layer adapter
///         use. V4 itself custodies NO ERC-20 (registry-only, non-custodial
///         no-reserve posture — no-reserve-model-compatibility-and-
///         migration.md §2) and makes no calls through this interface.
interface IERC20 {
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
    function allowance(address, address) external view returns (uint256);
}

// ============================================================================
// §1  MTQSigmaV4 — dynamic-membership registry (reference, UNDEPLOYED)
// ============================================================================
contract MTQSigmaV4 {
    // ------------------------------------------------------------------
    // §1.a  Custom errors (gas-efficient, named per TASK-39; V2/V3 use the
    //       ErrNN idiom for their paths — V4's new validation paths use
    //       descriptive names, with arguments for off-chain decoding).
    // ------------------------------------------------------------------
    // Access control
    error Unauthorized();
    error RenounceNotSelf();
    error ZeroAuthority();
    // Registry core (spec §2/§3)
    error AlreadyRegistered(bytes3 id);
    error InvalidEnvelope(uint32 minBp, uint32 maxBp);
    error MissingDossier();
    error RegistryFull(uint256 total);
    error NotRegistered(uint256 registryId);
    error InvalidStatus(uint8 current);
    error MissingEvidence();
    error BasketFull(uint256 activeCount, uint256 nMax);
    error ExclusionWeightNotZero(uint256 registryId, uint256 weight);
    error NotSuspendable(uint8 current);
    error MissingCause();
    error NotSuspended(uint8 current);
    // N_max constitutional path (spec §7)
    error NoPendingNMax();
    error InvalidNMax(uint256 proposed, uint256 maxAllowed);
    error NMaxBelowActive(uint256 proposed, uint256 activeCount);
    error TimelockNotElapsed(uint256 currentBlock, uint256 effectiveBlock);
    // Weight submission (spec §5.3/§5.4, §8 items 3-4)
    error EmptySubmission();
    error LengthMismatch(uint256 idsLen, uint256 weightsLen);
    error ActiveOmitted(uint256 registryId);
    error ZeroWeightForActive(uint256 registryId);
    error ExcludedMustBeZero(uint256 registryId, uint256 weight);
    error NotBpQuantum(uint256 registryId, uint256 weight);
    error WeightBelowEnvelope(uint256 registryId, uint256 weight, uint256 minBp18);
    error WeightAboveEnvelope(uint256 registryId, uint256 weight, uint256 maxBp18);
    error SumNotExact(uint256 sum);
    error DuplicateId(uint256 registryId);
    error OmittedPositiveWeight(uint256 registryId, uint256 weight);
    error InvariantSumNotExact(uint256 total);

    // ------------------------------------------------------------------
    // §1.b  Inlined AccessControl (mirrors V3 §1 — same storage layout,
    //       same DEFAULT_ADMIN bypass, same event shapes)
    // ------------------------------------------------------------------
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant ADMIN_ROLE   = keccak256("ADMIN_ROLE");
    bytes32 public constant KEEPER_ROLE  = keccak256("KEEPER_ROLE");
    /// @notice V4 NEW: consolidated governance authority for the lifecycle
    ///         recorders and the N_max timelock (V3 has no such role — its
    ///         governance is the constitutionalCouncil address pattern).
    bytes32 public constant MTQ_GOVERNANCE_ROLE = keccak256("MTQ_GOVERNANCE_ROLE");
    /// @notice V4 NEW: T7 emergency authority (spec §3 T7 Emergency Council
    ///         2-of-3 — the quorum itself is an off-chain multi-sig
    ///         property, disclosed in the design plan §3).
    bytes32 public constant MTQ_EMERGENCY_ROLE = keccak256("MTQ_EMERGENCY_ROLE");

    mapping(bytes32 => mapping(address => bool)) private _roles;

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    modifier onlyRole(bytes32 role) {
        if (!(_roles[role][msg.sender] || _roles[DEFAULT_ADMIN_ROLE][msg.sender])) revert Unauthorized();
        _;
    }
    modifier onlyGovernance() {
        if (!(_roles[MTQ_GOVERNANCE_ROLE][msg.sender] || _roles[DEFAULT_ADMIN_ROLE][msg.sender])) revert Unauthorized();
        _;
    }
    modifier onlyEmergencyAuthority() {
        if (!(_roles[MTQ_EMERGENCY_ROLE][msg.sender] || _roles[DEFAULT_ADMIN_ROLE][msg.sender])) revert Unauthorized();
        _;
    }
    modifier onlyKeeper() {
        if (!(_roles[KEEPER_ROLE][msg.sender] || _roles[DEFAULT_ADMIN_ROLE][msg.sender])) revert Unauthorized();
        _;
    }

    // ------------------------------------------------------------------
    // §1.c  Registry core (spec §2 hybrid model (c) + §3 state machine)
    // ------------------------------------------------------------------
    /// @notice Lifecycle states per spec §3: CANDIDATE → ELIGIBLE → ACTIVE →
    ///         WATCH → RETIRING → EXCLUDED, with EMERGENCY_SUSPENDED as a
    ///         distinct overlay path (not a normal-retirement state) and
    ///         ELIGIBLE as a queue state. NONEXISTENT is the storage
    ///         default for never-registered ids.
    enum LifecycleStatus {
        NONEXISTENT,        // 0 — storage default (never registered)
        CANDIDATE,          // 1 — T1 nominated, dossier committed
        ELIGIBLE,           // 2 — T2 rule-driven score-in (queue state)
        ACTIVE,             // 3 — T3 admitted, weight-bearing (≥ w_min)
        WATCH,              // 4 — T4 warning-band, still weight-bearing
        RETIRING,           // 5 — T5 confirmed, glide-decaying to 0
        EXCLUDED,           // 6 — T6 complete, weight exactly 0
        EMERGENCY_SUSPENDED // 7 — T7 overlay, weight frozen at suspension value
    }

    /// @notice Per-component registry record (spec §2 registry record
    ///         schema, hybrid model (c) subset: on-chain stores only
    ///         {id, status, bounds, weight}; the full dossier is off-chain,
    ///         committed as dossierHash).
    /// @dev    envelopeMinBp/MaxBp are bp quanta (1e-4): 2300 = 23.00%.
    ///         velocityBp is the per-accepted-update velocity class in bp
    ///         (spec §5.5 Δ_i) — stored for governance visibility; V4 does
    ///         NOT enforce velocity on-chain (glide planning is off-chain
    ///         in the TS reference layer; documented in design plan §4).
    ///         baseFixingUsdMicros is the genesis fixing in USD micros
    ///         (1e-6 USD) — reserved for the future chain-linked index
    ///         adapter (deliverable 5); dormant field per TASK-39 struct.
    struct ComponentRecord {
        bytes3 id;                  // stable component code (e.g. "USD", "XAU")
        uint64 registeredAt;        // unix seconds of the ORIGINAL T1 registration
        LifecycleStatus status;     // spec §3 state
        uint32 envelopeMinBp;       // approved floor, bp (ACTIVE-only — spec §5.2)
        uint32 envelopeMaxBp;       // approved ceiling, bp (ACTIVE-only — spec §5.2)
        uint32 velocityBp;          // per-update velocity class Δ_i, bp (spec §5.5)
        uint96 baseFixingUsdMicros; // genesis USD fixing, micros (dormant)
        bytes32 dossierHash;        // commitment to the off-chain dossier (spec §2)
        bool exists;                // record-allocated flag (registryId validity)
    }

    /// @notice All ever-registered component ids, in registration order.
    ///         EXCLUDED records remain listed (append-only history; T9
    ///         renomination reuses the SAME registryId — never re-appended).
    bytes3[] public componentList;

    /// @notice Registry records keyed by registryId — a monotonic counter
    ///         that is NEVER reused (TASK-39; spec §2 append-only history).
    mapping(uint256 => ComponentRecord) public records;

    /// @notice bytes3 code → registryId lookup (0 = never registered).
    mapping(bytes3 => uint256) public idToRegistryId;

    /// @notice Monotonic registryId counter (starts at 1; 0 is the
    ///         "absent" sentinel of idToRegistryId). Never decremented,
    ///         never reused.
    uint256 public nextRegistryId;

    /// @notice Registry version (spec §2 versioned registry). Starts at 1;
    ///         every status mutator and every executed N_max change bumps
    ///         it and emits RegistryVersionBumped — an append-only record
    ///         of registry-content generations.
    uint256 public registryVersion;

    /// @notice Hard structural cap on N_max (spec §7 draft bound upper
    ///         end: 7–15). A constant, NOT the live parameter — the live
    ///         parameter is nMax below, changed only via the §5 two-step
    ///         constitutional timelock.
    uint256 public constant MAX_BASKET_SIZE = 15;

    /// @notice Live maximum basket size (spec §7, D-13.11 — UNAPPROVED
    ///         DRAFT initial value 7, preserving current composition).
    ///         Mutable ONLY via proposeNMax → executeNMax.
    uint256 public nMax;

    /// @notice DRAFT constant (spec §7: "a change of N_max is itself a
    ///         constitutional event (timelock + version bump)"). ~7 days at
    ///         the assumed 12s block cadence; block-based timelocks are an
    ///         approximation (post-merge block times vary) — flagged as a
    ///         DRAFT mechanism per spec §13 posture; owner approval
    ///         required before any real use.
    uint256 public constant NMAX_TIMELOCK_BLOCKS = 43200;

    uint256 public pendingNMax;
    uint256 public pendingNMaxEffectiveBlock;

    // ------------------------------------------------------------------
    // §1.d  Weight state (spec §5.3/§5.4)
    // ------------------------------------------------------------------
    /// @notice Committed weight per registryId, 1e18 scale, in bp quanta
    ///         (multiples of 1e14 — spec §5.3). EXCLUDED ⇒ exactly 0
    ///         (enforced at T6 by completeRetirement and at every
    ///         submission by the EXCLUDED-must-be-zero rule).
    mapping(uint256 => uint256) public weightsBp;

    /// @notice Submission counter (bumped on every accepted
    ///         submitWeights; NOT a registryVersion event — weight commits
    ///         are not status mutations).
    uint256 public weightVersion;

    /// @notice Append-only history of submitted vector hashes
    ///         (keccak256(abi.encodePacked(registryVersion, ids, weights))
    ///         per submission — spec §2 "no in-place mutation of history").
    bytes32[] public weightHistory;

    /// @notice T7 evidence: suspension cause hash per registryId
    ///         (spec §2 registry schema "suspensionCause (T7 only)").
    mapping(uint256 => bytes32) public suspensionCause;

    // ------------------------------------------------------------------
    // §1.e  Events
    // ------------------------------------------------------------------
    event ComponentRegistered(uint256 indexed registryId, bytes3 indexed id, bytes32 dossierHash, uint64 registeredAt);
    event EligibilityMarked(uint256 indexed registryId, bytes32 evidenceHash, uint256 timestamp);
    event AdmissionConfirmed(uint256 indexed registryId, bytes32 evidenceHash, uint256 timestamp);
    event WatchFlagged(uint256 indexed registryId, bytes32 reasonHash, uint256 timestamp);
    event RetirementConfirmed(uint256 indexed registryId, bytes32 evidenceHash, uint256 timestamp);
    event ExclusionCompleted(uint256 indexed registryId, uint256 timestamp);
    event EmergencySuspended(uint256 indexed registryId, bytes32 causeHash, uint256 timestamp);
    event SuspensionResolved(uint256 indexed registryId, bool reinstated, uint256 timestamp);
    event Renominated(uint256 indexed registryId, bytes32 freshDossierHash, uint256 timestamp);
    event RegistryVersionBumped(uint256 newVersion);
    event WeightsSubmitted(uint256 weightVersion, uint256 count, bytes32 vectorHash);
    event NMaxProposed(uint256 proposed, uint256 effectiveBlock, uint256 timestamp);
    event NMaxExecuted(uint256 oldNMax, uint256 newNMax, uint256 timestamp);

    // ------------------------------------------------------------------
    // §1.f  Constructor (mirrors V3's deployer-gets-admin convention)
    // ------------------------------------------------------------------
    /// @notice Deploys the registry with the initial DRAFT nMax = 7
    ///         (spec §7) and the two V4 authority roles granted to param
    ///         addresses. DEFAULT_ADMIN_ROLE and KEEPER_ROLE go to the
    ///         deployer (V3 convention + reference operability); a real
    ///         deployment MUST rotate both before use — this is an
    ///         UNDEPLOYED, never-audited reference.
    constructor(address _governance, address _emergencyAuthority) {
        if (_governance == address(0) || _emergencyAuthority == address(0)) revert ZeroAuthority();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(KEEPER_ROLE, msg.sender);
        _grantRole(MTQ_GOVERNANCE_ROLE, _governance);
        _grantRole(MTQ_EMERGENCY_ROLE, _emergencyAuthority);
        registryVersion = 1;   // spec §2: versioned registry starts at 1
        nextRegistryId = 1;    // 0 reserved as the "absent" sentinel
        nMax = 7;              // spec §7 DRAFT initial value (UNAPPROVED)
    }

    // ==================================================================
    // §2  Registry lifecycle mutators (spec §3 T1–T9)
    // ==================================================================

    /// @notice T1 nomination → CANDIDATE (spec §3 T1). Records the
    ///         component shell + the dossier-hash commitment; the full
    ///         provenance dossier (all §4 scoring inputs, named sources,
    ///         publication calendars, ≥2 independent price families)
    ///         lives OFF-chain (spec §2 hybrid (c)).
    ///         Authority note: spec T1 assigns nomination to the Economic
    ///         Authority with Risk-Council docketing; V4 flattens both to
    ///         MTQ_GOVERNANCE_ROLE (disclosed in design plan §3).
    /// @param id                stable bytes3 component code ("USD".."XAU")
    /// @param dossierHash       non-zero commitment to the off-chain dossier
    /// @param envMinBp          approved floor in bp (ACTIVE-only, spec §5.2)
    /// @param envMaxBp          approved ceiling in bp (> 0; min < max)
    /// @param velocityBp        per-update velocity class Δ_i in bp (spec §5.5)
    /// @param baseFixingUsdMicros genesis USD fixing in micros (dormant field)
    function register(
        bytes3 id,
        bytes32 dossierHash,
        uint32 envMinBp,
        uint32 envMaxBp,
        uint32 velocityBp,
        uint96 baseFixingUsdMicros
    ) external onlyGovernance {
        if (idToRegistryId[id] != 0) revert AlreadyRegistered(id);        // spec §5.4: no duplicated component
        if (!(envMaxBp > 0 && envMinBp < envMaxBp)) revert InvalidEnvelope(envMinBp, envMaxBp);
        if (dossierHash == bytes32(0)) revert MissingDossier();           // spec §3 T1 evidence row
        if (componentList.length >= 64) revert RegistryFull(componentList.length); // TASK-39 hard sanity bound on N_total
        uint256 rid = nextRegistryId;
        nextRegistryId += 1;                                              // monotonic, NEVER reused (TASK-39)
        records[rid] = ComponentRecord({
            id: id,
            registeredAt: uint64(block.timestamp),
            status: LifecycleStatus.CANDIDATE,
            envelopeMinBp: envMinBp,
            envelopeMaxBp: envMaxBp,
            velocityBp: velocityBp,
            baseFixingUsdMicros: baseFixingUsdMicros,
            dossierHash: dossierHash,
            exists: true
        });
        idToRegistryId[id] = rid;
        componentList.push(id);
        _bumpRegistryVersion();
        emit ComponentRegistered(rid, id, dossierHash, uint64(block.timestamp));
    }

    /// @notice T2 recorder: CANDIDATE → ELIGIBLE (spec §3 T2 — the
    ///         RULE-DRIVEN score-in; the score evaluation itself is
    ///         off-chain in the TS reference layer, whose outcome
    ///         governance relays here). ELIGIBLE is a queue state that is
    ///         NOT yet weight-bearing (spec §3 state matrix).
    ///         ADDED beyond TASK-39's function list because T3's
    ///         ELIGIBLE precondition needs an on-chain T2 path — see
    ///         design plan §3.
    function markEligible(uint256 registryId, bytes32 evidenceHash) external onlyGovernance {
        ComponentRecord storage rec = records[registryId];
        if (!rec.exists) revert NotRegistered(registryId);
        if (rec.status != LifecycleStatus.CANDIDATE) revert InvalidStatus(uint8(rec.status));
        if (evidenceHash == bytes32(0)) revert MissingEvidence();         // spec §3 T2 evidence: score series over T_obs_entry
        rec.status = LifecycleStatus.ELIGIBLE;
        _bumpRegistryVersion();
        emit EligibilityMarked(registryId, evidenceHash, block.timestamp);
    }

    /// @notice T3 admission: CANDIDATE/ELIGIBLE → ACTIVE (spec §3 T3).
    ///         Accepts BOTH pre-states because T2 is rule-driven and may
    ///         be recorded off-chain only; the admission evidence hash
    ///         (T2 record + planned ramp schedule) is committed on-chain.
    ///         Slot availability N_active < N_max is D-13.11 (spec §3 T3
    ///         evidence row; §5.2 invariant "N_active ≤ N_max checked at
    ///         T3"). The ≥ T_ann pre-announcement and the ratification
    ///         timelock are OFF-chain obligations (I7/I8: membership is
    ///         governed, never individual weights) — hashes only.
    function confirmAdmission(uint256 registryId, bytes32 evidenceHash) external onlyGovernance {
        ComponentRecord storage rec = records[registryId];
        if (!rec.exists) revert NotRegistered(registryId);
        LifecycleStatus s = rec.status;
        if (!(s == LifecycleStatus.CANDIDATE || s == LifecycleStatus.ELIGIBLE)) revert InvalidStatus(uint8(s));
        if (evidenceHash == bytes32(0)) revert MissingEvidence();         // spec §3 T3 evidence row
        if (activeCount() >= nMax) revert BasketFull(activeCount(), nMax); // D-13.11 slot availability
        rec.status = LifecycleStatus.ACTIVE;
        _bumpRegistryVersion();
        emit AdmissionConfirmed(registryId, evidenceHash, block.timestamp);
    }

    /// @notice T4 recorder: ACTIVE → WATCH (spec §3 T4 — the RULE-DRIVEN
    ///         warning-band breach; outcome relayed by governance).
    ///         WATCH is still weight-bearing with intensified scoring
    ///         (spec §3 state matrix). ADDED beyond TASK-39's function
    ///         list because T5's WATCH precondition needs an on-chain T4
    ///         path — see design plan §3.
    function flagWatch(uint256 registryId, bytes32 reasonHash) external onlyGovernance {
        ComponentRecord storage rec = records[registryId];
        if (!rec.exists) revert NotRegistered(registryId);
        if (rec.status != LifecycleStatus.ACTIVE) revert InvalidStatus(uint8(rec.status));
        if (reasonHash == bytes32(0)) revert MissingEvidence();           // spec §3 T4 evidence: score series + oracle data-quality flags
        rec.status = LifecycleStatus.WATCH;
        _bumpRegistryVersion();
        emit WatchFlagged(registryId, reasonHash, block.timestamp);
    }

    /// @notice T5 normal retirement: WATCH → RETIRING (spec §3 T5).
    ///         Evidence-checked: the hash commits to the S_i < θ_out
    ///         sustained-over-T_obs_exit series, the complete WATCH record,
    ///         and the completed-exit-window attestation; the ≥ T_ann
    ///         pre-announcement with glide schedule is an off-chain
    ///         obligation (hashes only). The glide itself (§5.5) runs
    ///         through submitWeights vectors that ramp the RETIRING
    ///         component to exactly 0 before T6.
    function confirmRetirement(uint256 registryId, bytes32 evidenceHash) external onlyGovernance {
        ComponentRecord storage rec = records[registryId];
        if (!rec.exists) revert NotRegistered(registryId);
        if (rec.status != LifecycleStatus.WATCH) revert InvalidStatus(uint8(rec.status));
        if (evidenceHash == bytes32(0)) revert MissingEvidence();         // spec §3 T5 evidence row
        rec.status = LifecycleStatus.RETIRING;
        _bumpRegistryVersion();
        emit RetirementConfirmed(registryId, evidenceHash, block.timestamp);
    }

    /// @notice T6 glide completion: RETIRING → EXCLUDED (spec §3 T6 —
    ///         "automatic on glide completion"; here the completion is
    ///         attested by the caller, but the EXCLUSION-ZERO INVARIANT is
    ///         enforced ON-CHAIN: the transition is permitted ONLY when
    ///         the component's committed weight is exactly 0 (spec §5.4 —
    ///         "excluded ⇒ exactly 0 … no residual minimum"). This is the
    ///         on-chain rule the V2/V3 positive-weights-only submission
    ///         (V2:526 / V3:1317) made IMPOSSIBLE (spec §5.4 BLOCKER).
    function completeRetirement(uint256 registryId) external onlyGovernance {
        ComponentRecord storage rec = records[registryId];
        if (!rec.exists) revert NotRegistered(registryId);
        if (rec.status != LifecycleStatus.RETIRING) revert InvalidStatus(uint8(rec.status));
        if (weightsBp[registryId] != 0) revert ExclusionWeightNotZero(registryId, weightsBp[registryId]);
        rec.status = LifecycleStatus.EXCLUDED;
        _bumpRegistryVersion();
        emit ExclusionCompleted(registryId, block.timestamp);
    }

    /// @notice T7 emergency suspension: ACTIVE/WATCH/RETIRING →
    ///         EMERGENCY_SUSPENDED (spec §3 T7 — the DISTINCT overlay
    ///         path: no pre-announcement by definition, post-hoc
    ///         disclosure within 24h off-chain, cause documented here as a
    ///         hash). Only weight-bearing states are suspendable (spec §3
    ///         state matrix). The weight stays FROZEN at its suspension
    ///         value — weightsBp is deliberately untouched; the frozen
    ///         value must be re-asserted in every subsequent submitWeights
    ///         vector for the exact-1e18 sum to hold (rule 8 below).
    function emergencySuspend(uint256 registryId, bytes32 causeHash) external onlyEmergencyAuthority {
        ComponentRecord storage rec = records[registryId];
        if (!rec.exists) revert NotRegistered(registryId);
        LifecycleStatus s = rec.status;
        if (!(s == LifecycleStatus.ACTIVE || s == LifecycleStatus.WATCH || s == LifecycleStatus.RETIRING)) {
            revert NotSuspendable(uint8(s));
        }
        if (causeHash == bytes32(0)) revert MissingCause();               // spec §3 T7 evidence: documented trigger event
        suspensionCause[registryId] = causeHash;
        rec.status = LifecycleStatus.EMERGENCY_SUSPENDED;
        _bumpRegistryVersion();
        emit EmergencySuspended(registryId, causeHash, block.timestamp);
    }

    /// @notice T8 resolution: EMERGENCY_SUSPENDED → ACTIVE (fast-track
    ///         reinstatement) or RETIRING (proceed toward exclusion) —
    ///         spec §3 T8. The fast-track window T_rein (draft 30d) and
    ///         the joint Emergency-Council + Risk-Council quorum are
    ///         OFF-chain obligations (flattened to MTQ_GOVERNANCE_ROLE
    ///         here — disclosed in design plan §3). reinstate=false takes
    ///         the accelerated-glide exit (N_em ≤ 3 periods off-chain),
    ///         which must still land at exactly 0 before T6 fires.
    function resolveSuspension(uint256 registryId, bool reinstate) external onlyGovernance {
        ComponentRecord storage rec = records[registryId];
        if (!rec.exists) revert NotRegistered(registryId);
        if (rec.status != LifecycleStatus.EMERGENCY_SUSPENDED) revert NotSuspended(uint8(rec.status));
        rec.status = reinstate ? LifecycleStatus.ACTIVE : LifecycleStatus.RETIRING;
        _bumpRegistryVersion();
        emit SuspensionResolved(registryId, reinstate, block.timestamp);
    }

    /// @notice T9 re-entry: EXCLUDED → CANDIDATE with a FRESH dossier
    ///         hash (spec §3 T9 — no automatic re-admission; a full new
    ///         T1→T2→T3 cycle with full T_obs_entry re-observation and
    ///         hysteresis re-applied; the oscillation guard). Reuses the
    ///         SAME registryId (ids are never re-minted); registeredAt is
    ///         deliberately NOT restamped — the Renominated event carries
    ///         the re-nomination timestamp, preserving the original
    ///         registration provenance.
    function renominate(uint256 registryId, bytes32 freshDossierHash) external onlyGovernance {
        ComponentRecord storage rec = records[registryId];
        if (!rec.exists) revert NotRegistered(registryId);
        if (rec.status != LifecycleStatus.EXCLUDED) revert InvalidStatus(uint8(rec.status));
        if (freshDossierHash == bytes32(0)) revert MissingDossier();      // spec §3 T9 evidence: fresh dossier
        rec.status = LifecycleStatus.CANDIDATE;
        rec.dossierHash = freshDossierHash;
        _bumpRegistryVersion();
        emit Renominated(registryId, freshDossierHash, block.timestamp);
    }

    // ==================================================================
    // §3  N_max constitutional change path (spec §7 — two-step timelock)
    // ==================================================================

    /// @notice Step 1 of the N_max constitutional change (spec §7: "a
    ///         change of N_max is itself a constitutional event (timelock
    ///         + version bump), never an incidental edit"). Records the
    ///         proposal and its earliest effective block. A later proposal
    ///         overwrites an earlier pending one (latest-wins).
    function proposeNMax(uint256 newNMax) external onlyGovernance {
        if (newNMax == 0 || newNMax > MAX_BASKET_SIZE) revert InvalidNMax(newNMax, MAX_BASKET_SIZE);
        pendingNMax = newNMax;
        pendingNMaxEffectiveBlock = block.number + NMAX_TIMELOCK_BLOCKS;
        emit NMaxProposed(newNMax, pendingNMaxEffectiveBlock, block.timestamp);
    }

    /// @notice Step 2 of the N_max constitutional change — executable
    ///         only after the DRAFT block timelock elapses, only if the
    ///         new cap would not already violate the live
    ///         N_active ≤ N_max invariant (spec §5.2), and it bumps
    ///         registryVersion (spec §7: version bump on the change
    ///         itself).
    function executeNMax() external onlyGovernance {
        if (pendingNMax == 0) revert NoPendingNMax();
        if (block.number < pendingNMaxEffectiveBlock) revert TimelockNotElapsed(block.number, pendingNMaxEffectiveBlock);
        if (pendingNMax < activeCount()) revert NMaxBelowActive(pendingNMax, activeCount());
        uint256 old = nMax;
        nMax = pendingNMax;
        pendingNMax = 0;
        pendingNMaxEffectiveBlock = 0;
        _bumpRegistryVersion();                                           // spec §7: constitutional event ⇒ version bump
        emit NMaxExecuted(old, nMax, block.timestamp);
    }

    // ==================================================================
    // §4  Dynamic weight submission (spec §5.3/§5.4 + §8 items 3-4)
    // ==================================================================

    /// @notice Submits the full committed weight vector over the registry
    ///         domain. Replaces V2/V3's fixed-shape positive-weights-only
    ///         submitTargetWeights (V2:518-555 / V3:1310-1342) with
    ///         registry-keyed, bp-quantized, EXACT-sum semantics.
    ///
    ///         Validation (in order — each with a named custom error):
    ///          1. non-empty arrays, equal lengths;
    ///          2. every submitted id is a REGISTERED component
    ///             (membership precondition — spec §8 item 3);
    ///          3. every ACTIVE component is included — no silent
    ///             omission; the ACTIVE set is the submission's domain
    ///             (spec §8 item 3);
    ///          4. weight values: ACTIVE ⇒ > 0; non-ACTIVE ⇒ ≥ 0 (0 is
    ///             allowed EXACTLY for non-ACTIVE slots — spec §8 item 3;
    ///             WATCH/RETIRING/EMERGENCY_SUSPENDED carry glide/frozen
    ///             positives); EXCLUDED ⇒ exactly 0; every value must be a
    ///             bp quantum (multiple of 1e14 — spec §5.3);
    ///          5. per-record envelope check for ACTIVE components
    ///             (envelopeMinBp·1e14 ≤ w ≤ envelopeMaxBp·1e14 — §5.2);
    ///          6. sum == EXACTLY 1e18 (SumNotExact) — the ±1e14 commit
    ///             tolerance of V2/V3 (V2:638 / V3:1388) is TIGHTENED to
    ///             exact per spec §8 item 4; bp quantization +
    ///             largest-remainder rounding off-chain (§5.3) make
    ///             exactness achievable;
    ///          7. no duplicate ids.
    ///         Plus rule 8 (ADDED, closing the freeze-omission hole):
    ///          8. any registered component OMITTED from the submission
    ///             must carry stored weight exactly 0 — otherwise merging
    ///             would leave the stored vector's total ≠ 1e18 (spec §5.4
    ///             "no unallocated weight"; §3 frozen-suspension weight).
    ///
    ///         On success: stores weightsBp[registryId] for every
    ///         submitted id, records the vector hash
    ///         keccak256(abi.encodePacked(registryVersion, ids, weights))
    ///         in weightHistory (append-only — spec §2), bumps
    ///         weightVersion, and emits WeightsSubmitted.
    /// @param registryIds  registry ids covered by this submission
    /// @param weightsBp18  bp-quanta weights in 1e18 scale (multiples of 1e14)
    function submitWeights(
        uint256[] calldata registryIds,
        uint256[] calldata weightsBp18
    ) external onlyKeeper {
        // Rule 1 — shape (spec §8 item 3 domain discipline)
        if (registryIds.length == 0) revert EmptySubmission();
        if (registryIds.length != weightsBp18.length) revert LengthMismatch(registryIds.length, weightsBp18.length);

        // Rule 2 — membership precondition: every submitted id is REGISTERED
        for (uint256 i = 0; i < registryIds.length; i++) {
            if (!records[registryIds[i]].exists) revert NotRegistered(registryIds[i]);
        }

        // Rule 3 — ACTIVE-set coverage: every ACTIVE component is included
        // (no silent omission). Bounded O(N_total × M) with N_total ≤ 64.
        uint256 n = componentList.length;
        for (uint256 j = 0; j < n; j++) {
            uint256 activeRid = idToRegistryId[componentList[j]];
            if (records[activeRid].status != LifecycleStatus.ACTIVE) continue;
            bool found = false;
            for (uint256 i = 0; i < registryIds.length; i++) {
                if (registryIds[i] == activeRid) { found = true; break; }
            }
            if (!found) revert ActiveOmitted(activeRid);
        }

        // Rules 4 + 5 — per-value semantics, bp quantum, ACTIVE envelopes
        uint256 sum = 0;
        for (uint256 i = 0; i < registryIds.length; i++) {
            uint256 rid = registryIds[i];
            uint256 w = weightsBp18[i];
            ComponentRecord storage rec = records[rid];
            if (w % 1e14 != 0) revert NotBpQuantum(rid, w);               // spec §5.3 quantum
            if (rec.status == LifecycleStatus.ACTIVE) {
                if (w == 0) revert ZeroWeightForActive(rid);              // ACTIVE ⇒ > 0 (spec §8 item 3)
                uint256 lo = uint256(rec.envelopeMinBp) * 1e14;           // spec §5.2 envelope (ACTIVE-only)
                uint256 hi = uint256(rec.envelopeMaxBp) * 1e14;
                if (w < lo) revert WeightBelowEnvelope(rid, w, lo);
                if (w > hi) revert WeightAboveEnvelope(rid, w, hi);
            } else if (rec.status == LifecycleStatus.EXCLUDED) {
                if (w != 0) revert ExcludedMustBeZero(rid, w);            // spec §5.4 exclusion-zero
            }
            // Non-ACTIVE, non-EXCLUDED (WATCH / RETIRING / EMERGENCY_
            // SUSPENDED / CANDIDATE / ELIGIBLE): w ≥ 0 — 0 allowed exactly
            // for these slots (spec §8 item 3). Positive values are the
            // glide/freeze semantics of §3; note the spec §3 matrix pins
            // CANDIDATE/ELIGIBLE at 0 — that stricter form is enforced by
            // the TS reference layer, not here (design plan §4/§8).
            sum += w;
        }

        // Rule 6 — EXACT sum (spec §8 item 4: ±1e14 → exact)
        if (sum != 1e18) revert SumNotExact(sum);

        // Rule 7 — duplicate ids (spec §5.4: no duplicated component)
        for (uint256 i = 0; i < registryIds.length; i++) {
            for (uint256 k = i + 1; k < registryIds.length; k++) {
                if (registryIds[i] == registryIds[k]) revert DuplicateId(registryIds[i]);
            }
        }

        // Rule 8 (ADDED) — omitted components must carry no stored weight,
        // else the post-merge stored total would violate the exact-1e18
        // invariant (spec §5.4 "no unallocated weight"; §3 freeze).
        for (uint256 j = 0; j < n; j++) {
            uint256 rid = idToRegistryId[componentList[j]];
            bool found = false;
            for (uint256 i = 0; i < registryIds.length; i++) {
                if (registryIds[i] == rid) { found = true; break; }
            }
            if (!found && weightsBp[rid] != 0) revert OmittedPositiveWeight(rid, weightsBp[rid]);
        }

        // Commit — append-only (spec §2: no in-place mutation of history)
        bytes32 vectorHash = keccak256(abi.encodePacked(registryVersion, registryIds, weightsBp18));
        for (uint256 i = 0; i < registryIds.length; i++) {
            weightsBp[registryIds[i]] = weightsBp18[i];
        }
        weightVersion += 1;
        weightHistory.push(vectorHash);
        emit WeightsSubmitted(weightVersion, registryIds.length, vectorHash);
    }

    // ==================================================================
    // §5  Views
    // ==================================================================

    /// @notice Committed weight of a registryId (1e18 scale, bp quanta).
    ///         Returns 0 for absent/non-weight-bearing records.
    function getActiveWeight(uint256 registryId) external view returns (uint256) {
        return weightsBp[registryId];
    }

    /// @notice The ACTIVE registry ids (dynamic array — the submission
    ///         domain of §4 and the MASE optimization domain of spec §6).
    function getActiveIds() external view returns (uint256[] memory activeIds) {
        uint256 n = componentList.length;
        uint256 count = 0;
        for (uint256 j = 0; j < n; j++) {
            if (records[idToRegistryId[componentList[j]]].status == LifecycleStatus.ACTIVE) count += 1;
        }
        activeIds = new uint256[](count);
        uint256 k = 0;
        for (uint256 j = 0; j < n; j++) {
            uint256 rid = idToRegistryId[componentList[j]];
            if (records[rid].status == LifecycleStatus.ACTIVE) {
                activeIds[k] = rid;
                k += 1;
            }
        }
    }

    /// @notice Count of ACTIVE components (the D-13.11 slot-availability
    ///         input for T3 and the §5.2 invariant N_active ≤ N_max).
    function activeCount() public view returns (uint256 count) {
        for (uint256 j = 0; j < componentList.length; j++) {
            if (records[idToRegistryId[componentList[j]]].status == LifecycleStatus.ACTIVE) count += 1;
        }
    }

    /// @notice Total registered components ever (N_total; EXCLUDED records
    ///         remain listed — append-only history).
    function registrySize() external view returns (uint256) {
        return componentList.length;
    }

    /// @notice Sum of ALL stored weights. Once at least one submission has
    ///         been accepted (weightVersion > 0) this MUST be exactly 1e18
    ///         — the view reverts otherwise, exposing any invariant break
    ///         (spec §5.4: "sum = 1 exactly at every step"; the TS
    ///         reference layer enforces the same at engine.ts:902).
    function totalWeight() external view returns (uint256 total) {
        for (uint256 j = 0; j < componentList.length; j++) {
            total += weightsBp[idToRegistryId[componentList[j]]];
        }
        if (weightVersion > 0 && total != 1e18) revert InvariantSumNotExact(total);
    }

    // ==================================================================
    // §6  Honest status (on-chain self-declaration — V2/V3 convention)
    // ==================================================================

    /// @notice Static honest-status declaration for this UNDEPLOYED
    ///         reference. Production deployment is Gate-C / Task-12-gated;
    ///         this file has never been audited.
    function getHonestStatus() external view returns (string memory) {
        // unicode"" literal: the required declaration contains an em-dash.
        return unicode"TESTNET ONLY — V4 REFERENCE (UNDEPLOYED, NOT PRODUCTION-AUTHORIZED)";
    }

    // ==================================================================
    // §7  Internal helpers
    // ==================================================================

    /// @dev Bumps the registry version and emits the append-only record
    ///      (spec §2 versioned registry — every transition is recorded).
    function _bumpRegistryVersion() internal {
        registryVersion += 1;
        emit RegistryVersionBumped(registryVersion);
    }

    // ---- Inlined AccessControl internals (V3 §1 conventions, verbatim
    //      semantics: idempotent grant/revoke with events) ----
    function grantRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(role, account);
    }
    function revokeRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(role, account);
    }
    function renounceRole(bytes32 role, address account) external {
        if (!(msg.sender == account)) revert RenounceNotSelf();
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
}
