MTQ Σ — Single Source of Truth  
Consolidated Developer Mandate, MARP Corrections, Deployment
Verification, Quantitative Controls, Authorization, and Roadmap  
Document ID: MTQSIGMA-SINGLE-SOURCE-OF-TRUTH-006 Version: 5.0 — Final
Consolidated Developer Handoff Date: 19 October 2026 Supersedes:
MTQSIGMA-SINGLE-SOURCE-OF-TRUTH-005 (v4.0) and
MTQSIGMA-SINGLE-SOURCE-OF-TRUTH-004 (v3.0), and all earlier MARP
execution-protection drafts Audience: AI Platform Developer,
Smart-Contract Engineering, Quantitative Committee, Risk Council,
Governance, Security Auditors, Operations Status: Testnet operation
authorized; correction and validation work required; production reserve
trading NOT authorized Authority: This is the authoritative
implementation mandate. It is not a production authorization and does
not claim any correction has already been implemented.  
  
0. Executive front matter — read first  
0.1 What this document delivers and does not deliver  
This document delivers:

- A single, authoritative implementation mandate the developer can build
  against.

- Corrected, tested code patterns for every P0 defect identified in the
  COO audit.

- A six-level authority hierarchy for resolving conflicting
  specifications.

- The reported deployment inventory with mandatory verification
  procedure.

- The five separate time measurements and three distinct prices.

- The direction-aware deviation and signed-improvement rules, with
  corrected expected test values.

- The dimensional net-benefit gate with common-numeraire enforcement.

- Checked token-decimal scaling with explicit precision-loss rejection.

- Gas-cost conversion with full-precision mulDiv requirement.

- The 40-test minimum validation matrix.

- The seven release gates with exit criteria and time estimates.

- The thirteen open decisions with named owners.

- The sixteen-entry conflict register with named resolutions.

- The keeper trust boundary, decision-record schema, and reconciliation
  discipline.

- A first-sprint plan the developer can execute on day one.  
  This document does not deliver:

<!-- -->

- A production authorization. That requires Gate 6.

- A waiver of the audit's NO-GO verdict. The verdict is correct.

- An invented objective function J ( s )  J(s)   J(s), threshold policy,
  protection margin, or purchasing-power benchmark. Those are
  Quantitative Committee decisions (OD-1, OD-2, OD-4, OD-5, OD-12).

- A claim that testnet deployment equals production readiness.

- A claim that any correction has already been deployed and verified on
  any chain.  
  The developer must not interpret a request to "go live" as permission
  to bypass the release gates. The only authorized activity that touches
  live funds is the Gate 5 pilot, and only with separate written
  approval.  
  0.2 Six-level authority hierarchy  
  When two sources conflict, resolve in this order. Do not skip levels.
  Do not let code override an approved requirement merely because the
  code is deployed.

||
||
||

<table>
<tbody>
<tr class="odd">
<td><ol type="1">
<li><p>Applicable law and binding regulatory requirements.</p></li>
<li><p>Explicit, documented governance decisions and approved risk
limits.</p></li>
<li><p>The approved MTQ Σ monetary-reference and reserve-governance
specification.</p></li>
<li><p>This mandate's corrected implementation semantics.</p></li>
<li><p>Earlier drafts and implementation notes.</p></li>
<li><p>Existing code, where it conflicts with an approved
requirement.<br />
Until a correction has been implemented, tested, reviewed, and deployed,
the existing deployed behavior is the current technical reality. Do not
claim that the new specification is already enforced on-chain.<br />
No developer may independently invent an economic objective, risk
coefficient, monetary threshold, price source, reserve rule, emergency
exception, or purchasing-power definition.<br />
0.3 Authorization matrix<br />
<br />
</p></li>
</ol>
<p>Activity</p></td>
<td><p>Status</p></td>
<td><p>Conditions</p></td>
</tr>
<tr class="even">
<td><p>Inspect existing deployments and source</p></td>
<td><p>Authorized</p></td>
<td><p>Read-only verification first</p></td>
</tr>
<tr class="odd">
<td><p>Continue testing on Monad Testnet, Arc Testnet, Solana
Devnet</p></td>
<td><p>Authorized</p></td>
<td><p>Keep existing testnet safety practices</p></td>
</tr>
<tr class="even">
<td><p>Correct code and deploy new testnet implementations</p></td>
<td><p>Authorized</p></td>
<td><p>New deployment records; old deployments remain
identifiable</p></td>
</tr>
<tr class="odd">
<td><p>Run automated, simulation, and historical tests</p></td>
<td><p>Authorized</p></td>
<td><p>Results must be reproducible and honestly labeled</p></td>
</tr>
<tr class="even">
<td><p>Run shadow-mode decision generation</p></td>
<td><p>Authorized as development scope</p></td>
<td><p>No reserve-fund movement</p></td>
</tr>
<tr class="odd">
<td><p>Run testnet execution and role-rotation rehearsals</p></td>
<td><p>Authorized</p></td>
<td><p>Use test assets and verify outcomes</p></td>
</tr>
<tr class="even">
<td><p>Execute a limited real-asset reserve pilot</p></td>
<td><p>Not authorized</p></td>
<td><p>Requires Gate 5 and separate written approval</p></td>
</tr>
<tr class="odd">
<td><p>Authorize production reserve trading</p></td>
<td><p>Not authorized</p></td>
<td><p>Requires Gate 6 and written governance authorization</p></td>
</tr>
<tr class="even">
<td><p>Expand to production Solana or consolidated multichain
operation</p></td>
<td><p>Not authorized</p></td>
<td><p>Requires Gate 7 and separate release decision</p></td>
</tr>
</tbody>
</table>

0.4 Mandatory truthfulness rule  
The project may describe the system as deployed to test networks only
after verifying those deployments. It must not describe testnet
deployments, simulated trades, successful compilation, or an uncompleted
audit as evidence of production readiness.  
The COO audit identified four principal P0 implementation defects:

||
||
||

<table>
<tbody>
<tr class="odd">
<td><ol type="1">
<li><p>Direction-aware deviation arithmetic.</p></li>
<li><p>Dimensional integrity of the monetary benefit-cost gate.</p></li>
<li><p>Gas-cost conversion and its input/fallback controls.</p></li>
<li><p>Token-decimal scaling and precision preservation.<br />
The developer must independently verify the original findings against
the actual source. If the source reveals additional P0 defects, add them
to the conflict register and block release until resolved.<br />
0.5 Time estimates and roadmap<br />
The following are honest estimates assuming continuous developer effort
and timely Committee decisions. They are not commitments; they are the
basis for planning.<br />
<br />
</p></li>
</ol>
<p>Step</p></td>
<td><p>Duration</p></td>
<td><p>Dependencies</p></td>
</tr>
<tr class="even">
<td><p>First sprint (verify inventory, reproduce P0s, integrate
corrections)</p></td>
<td><p>1–2 weeks</p></td>
<td><p>None</p></td>
</tr>
<tr class="odd">
<td><p>Test matrix T-01 through T-40 (Part 6)</p></td>
<td><p>2–4 weeks</p></td>
<td><p>First sprint complete</p></td>
</tr>
<tr class="even">
<td><p>Quantitative Committee approvals (OD-1 through OD-5, OD-8,
OD-12)</p></td>
<td><p>2–6 weeks (calendar-dependent)</p></td>
<td><p>Committee constituted (OD-3)</p></td>
</tr>
<tr class="odd">
<td><p>Gate 1 closure (audit, conflict register,</p>
<p>J<br />
(<br />
s<br />
)</p>
<p>J(s)</p>
<p>J(s), thresholds)</p></td>
<td><p>Combined with above</p></td>
<td><p>All of the above</p></td>
</tr>
<tr class="even">
<td><p>Gate 2 shadow implementation on Monad</p></td>
<td><p>2–4 weeks</p></td>
<td><p>Gate 1 closed</p></td>
</tr>
<tr class="odd">
<td><p>Gate 3 quantitative and technical validation</p></td>
<td><p>4–8 weeks</p></td>
<td><p>Gate 2 complete</p></td>
</tr>
<tr class="even">
<td><p>Gate 4 shadow acceptance (minimum 30 days + coverage
criteria)</p></td>
<td><p>30+ days</p></td>
<td><p>Gate 3 complete</p></td>
</tr>
<tr class="odd">
<td><p>Gate 5 limited live pilot</p></td>
<td><p>30–90 days</p></td>
<td><p>Gate 4 complete, OD-6, OD-7, OD-13 approved</p></td>
</tr>
<tr class="even">
<td><p>Gate 6 production authorization</p></td>
<td><p>Governance decision</p></td>
<td><p>Gate 5 complete, OD-11 satisfied</p></td>
</tr>
<tr class="odd">
<td><p>Gate 7 Solana and multichain</p></td>
<td><p>Separate release</p></td>
<td><p>OD-9, OD-10 approved</p></td>
</tr>
</tbody>
</table>

Realistic time to production authorization: 6–12 months. Anyone who
tells you "three weeks" is lying or has not read the audit. Anyone who
tells you "ready today" is misrepresenting testnet deployment as
production readiness.  
0.6 First sprint plan  
The developer's first sprint should produce the following, in order:

||
||
||

<table>
<tbody>
<tr class="odd">
<td><ol type="1">
<li><p>Verify the reported deployment inventory on Monad, Arc, and
Solana Devnet. Produce the deployment register (chain, address, code
hash, build identifier, deployment transaction, verification status,
current role assignments). See Part 1 and Part 5.</p></li>
<li><p>Reproduce the four P0 findings against the actual deployed
source. For each finding, cite the exact file, function, and line range.
Confirm or refute the COO audit's finding.</p></li>
<li><p>Integrate Listings C-1 through C-6 (Part 4) into a new feature
branch. Do not modify the currently deployed contracts until the
corrected versions pass tests.</p></li>
<li><p>Run tests T-01 through T-10 (Part 6). Publish the results with a
status label: implemented, unit-tested, or not demonstrated.</p></li>
<li><p>Report back to the Committee with the deployment register, the P0
reproduction report, the branch commit hash, the test results, and any
additional findings.<br />
Do not proceed to Gate 1 until the first sprint is complete and the
Committee has reviewed the evidence.<br />
<br />
Part 1 — Deployment inventory (reported, requires verification)<br />
The addresses below are provided by the project owner. The developer
must verify each address, chain ID, runtime bytecode, current role
assignment, and configuration before claiming that the deployment has
the stated properties. A non-empty code response at an address
establishes only that code exists — it does not establish that the code
is correct, audited, or production-ready.<br />
1.1 Monad Testnet (reported chain ID 10143)<br />
<br />
</p></li>
</ol>
<p>Component</p></td>
<td><p>Reported address</p></td>
</tr>
<tr class="even">
<td><p>MTQ.sol</p></td>
<td><p>0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD</p></td>
</tr>
<tr class="odd">
<td><p>Governance.sol</p></td>
<td><p>0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66</p></td>
</tr>
<tr class="even">
<td><p>Safe</p></td>
<td><p>0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0</p></td>
</tr>
<tr class="odd">
<td><p>Algorithm.sol</p></td>
<td><p>0x8839ce50e8D414005518769999c0A5b961D00CB2</p></td>
</tr>
<tr class="even">
<td><p>Reserve.sol</p></td>
<td><p>0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177</p></td>
</tr>
<tr class="odd">
<td><p>Mint.sol</p></td>
<td><p>0x197e9CB28216dfe18a199b4c2930F74C2F460809</p></td>
</tr>
<tr class="even">
<td><p>Redeem.sol</p></td>
<td><p>0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4</p></td>
</tr>
<tr class="odd">
<td><p>Oracle.sol</p></td>
<td><p>0xDfcA66ac0450C9AB86307af1942E157C5A4DB713</p></td>
</tr>
<tr class="even">
<td><p>Takaful.sol</p></td>
<td><p>0x3eC27BB283644eF0A98B9961E9FBED0583a02f19</p></td>
</tr>
<tr class="odd">
<td><p>Reported deployer</p></td>
<td><p>0x3C3932F865892EFabE45892f453f81B64f6c8d8c</p></td>
</tr>
<tr class="even">
<td></td>
<td></td>
</tr>
</tbody>
</table>

The RPC endpoint must be verified against the current official Monad
network documentation. Do not rely on an endpoint supplied in earlier
chat history without confirming it with Monad's published
documentation.  
1.2 Arc Testnet (reported chain ID 5042002)  
  

|                   |                                            |
|-------------------|--------------------------------------------|
| Component         | Reported address                           |
| MTQ.sol           | 0x237c3Aa2B79248f86f6523D3890095BCd1996601 |
| Governance.sol    | 0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66 |
| Safe              | 0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0 |
| Algorithm.sol     | 0x62f8E5243f32eE5C87a14A7896C61104aD9e7727 |
| Reserve.sol       | 0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471 |
| Mint.sol          | 0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa |
| Redeem.sol        | 0xcAde4594177829597882555Ff57d0e34092daF8e |
| Oracle.sol        | 0xFd2B8d176bf059287638Db30D02C6651dA02861e |
| Takaful.sol       | 0xA3B89FfdE28577A7D30E2c22503dB33509044EF0 |
| Reported deployer | 0x3C3932F865892EFabE45892f453f81B64f6c8d8c |
|                   |                                            |

Reported network details: RPC https://rpc.testnet.arc.io; explorer
https://testnet.arcscan.app; reported native currency USDC at 18
decimals — verify against the actual RPC response.  
1.3 Solana Devnet  
  

|          |                                                                                                                                                                       |
|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Field    | Reported value                                                                                                                                                        |
| RPC      | https://api.devnet.solana.com (standard devnet endpoint; the earlier "[tokens.solana.com](https://tokens.solana.com/)" note should be treated as a typo and verified) |
| Mint     | GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4                                                                                                                          |
| Symbol   | MTQ                                                                                                                                                                   |
| Decimals | 18 (reported; verify)                                                                                                                                                 |
| Wallet   | DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3                                                                                                                          |
|          |                                                                                                                                                                       |

Inspect the actual mint account, mint authority, freeze authority,
program owner, token program, metadata, and wallet/AMM compatibility.  
Do not assume that 18 decimals are universally unsupported on Solana or
that all wallets and AMMs handle them correctly. Test the actual
intended integration path. If the chosen wallets, token programs, or
AMMs do not support the required precision reliably, submit a migration
proposal for governance approval. Do not silently change decimals or
represent a migration as a simple metadata edit.  
Solana distribution remains deferred until Gate 7.  
1.4 Reported EVM roles  
  

|                    |                                                                    |                                            |
|--------------------|--------------------------------------------------------------------|--------------------------------------------|
| Role               | Reported hash                                                      | Reported account                           |
| DEFAULT_ADMIN_ROLE | 0x0000000000000000000000000000000000000000000000000000000000000000 | 0x3C3932F865892EFabE45892f453f81B64f6c8d8c |
| MINTER_ROLE        | 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6 | 0x3C3932F865892EFabE45892f453f81B64f6c8d8c |
| PAUSER_ROLE        | 0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a | 0x3C3932F865892EFabE45892f453f81B64f6c8d8c |

These are reported assignments, not independently verified current
state. Check each role on every relevant contract and chain. A role on
MTQ.sol does not prove that the same role controls Mint.sol,
Reserve.sol, or another component.  
Production security finding: if one EOA holds administrator, minting,
and pausing privileges, compromise of that key may enable unauthorized
minting, role escalation, or disruption. The configuration is acceptable
only as an explicitly accepted testnet risk. It is not the production
design. Role rotation is required before Gate 5.  
1.5 Deployment verification procedure  
For each chain and contract:

1.  Verify chain ID and RPC connectivity against current official
    documentation.

2.  Confirm that the address contains runtime bytecode.

3.  Retrieve the deployment transaction, deployer, transaction nonce,
    constructor arguments, and deployment block or slot.

4.  Compare runtime bytecode with the intended build, accounting for
    compiler metadata and immutable values.

5.  Verify proxy implementation, admin, and upgrade mechanism if
    applicable.

6.  Query roles, role-admin relationships, pause state, mint authority,
    reserve permissions, oracle configuration, token decimals, and
    critical parameters.

7.  Record verification evidence: timestamp, tool version, RPC endpoint,
    code hash, and reviewer.  
    Cross-chain caution: The matching Governance and Safe addresses on
    Monad and Arc do not prove CREATE2 was used. A common deployer and
    matching nonce can produce the same address on separate chains.
    Different bytecode at matching addresses is not, by itself, proof of
    a bug. Investigate the deployment method and verify each chain's
    code and configuration independently.  
    Example verification commands  
    Use a currently supported, documented RPC endpoint for the target
    chain.  
    bash  
    *\# Monad candidate endpoint: verify against Monad's current
    documentation first.*  
    export RPC="https://testnet-rpc.monad.xyz"  
    export MTQ="0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD"  
      
    cast chain-id --rpc-url "\$RPC"  
    cast code --rpc-url "\$RPC" "\$MTQ"  
    cast codehash --rpc-url "\$RPC" "\$MTQ"  
      
      
    A non-empty code response establishes only that code exists at the
    address. It does not establish that the code is correct, audited, or
    production-ready.  
      
    Part 2 — Constitutional monetary requirements  
    The following requirements are non-negotiable.  
    The developer must not:

<!-- -->

1.  Peg MTQ Σ to USD or treat USD as its permanent reference value.

2.  Replace the governed currency-and-gold reference basket with a USD
    peg.

3.  Confuse reference-index weights with reserve-portfolio weights.

4.  Change MTQ Σ's purchasing-power definition without explicit
    governance approval.

5.  Allow MASE or MARP to bypass governance, authorization, oracle,
    reserve-solvency, or execution controls.

6.  Introduce a competing rebalancing engine.

7.  Treat oracle spot prices as executable route prices.

8.  Count the same fee twice or omit an execution cost because of an
    inconsistent data source.

9.  Treat simulated fills as evidence of real execution quality.

10. Treat a reserve ratio as a guarantee of redemption at the
    reference-index value.

11. Claim that a successful test, audit report, or passage of time
    automatically authorizes production.

12. Allow the developer to invent objective functions, risk
    coefficients, threshold policies, price sources, or emergency
    exceptions.  
    USD-equivalent values may be used as a common accounting numeraire
    to compare heterogeneous costs and benefits. That accounting
    convention does not make MTQ Σ USD-pegged.  
    The governed reference index, the reserve portfolio, and the
    execution system are three different systems:

- Reference index — the governed measurement of MTQ Σ's purchasing-power
  reference.

- Reserve portfolio — the actual assets and liabilities, subject to
  reserve policy, liquidity, market risk, and redemption arrangements.

- Execution system — determines whether a specific proposed transaction
  is economically justified and operationally safe.  
  A correct rebalancing algorithm must not silently equate these three
  concepts.  
    
  Part 3 — MARP architecture and execution protection  
  3.1 Separation of responsibilities  
  MASE calculates the proposed reserve target under the approved
  methodology.  
  MARP evaluates whether and how an approved target should be approached
  through executable transactions.  
  The architecture must separate these stages:

1.  Reference-index calculation.

2.  Reserve valuation and holdings reconciliation.

3.  Target-weight computation.

4.  Trade sizing and direction.

5.  Executable route quotation.

6.  Estimated cost and adverse-movement protection.

7.  Economic eligibility.

8.  Authorization and on-chain hard-bound enforcement.

9.  Execution.

10. Settlement reconciliation and calibration.  
    MASE must not execute trades. MARP must not rewrite the governed
    index. Neither component may bypass the authorization layer.  
    3.2 Five separate time measurements  
    Implement and record all five. Do not collapse these into a single
    "freshness" flag.

||
||
||

<table>
<tbody>
<tr class="odd">
<td><ol type="1">
<li><p>Oracle observation age — current time minus the oracle
observation timestamp.</p></li>
<li><p>Executable-quote age — current time minus the quote's creation
timestamp.</p></li>
<li><p>Decision-to-submission delay — submission time minus decision
time.</p></li>
<li><p>Submission-to-execution delay — execution/inclusion time minus
submission time, where observable.</p></li>
<li><p>Settlement/finality delay — finality time minus
execution/inclusion time.<br />
Each measurement requires a defined clock, units, data source, maximum
permitted value, and failure behavior. If a value is not observable or
reliable on a particular chain, label it unavailable and apply the
approved conservative policy. Do not substitute zero.<br />
3.3 Three distinct prices<br />
<br />
</p></li>
</ol>
<p>Price</p></td>
<td><p>Purpose</p></td>
<td><p>May authorize a trade by itself?</p></td>
</tr>
<tr class="even">
<td><p>Reference valuation price</p></td>
<td><p>Accounting, portfolio valuation, sanity checks</p></td>
<td><p>No</p></td>
</tr>
<tr class="odd">
<td><p>Executable route quote</p></td>
<td><p>Trade sizing and estimated execution economics</p></td>
<td><p>No — only with remaining checks</p></td>
</tr>
<tr class="even">
<td><p>Realized execution price</p></td>
<td><p>Reconciliation from actual settled input/output</p></td>
<td><p>No — it measures a completed transaction</p></td>
</tr>
</tbody>
</table>

The executable quote must come from the intended venue or route and must
identify the actual route, assets, trade side, amount semantics,
timestamp, expiry/deadline, and expected output or required input.  
For a multi-leg route, calculate the compounded conversion and fees for
each leg. Do not apply a single-leg spread formula to a multi-leg route
when actual executable quotes are available.  
3.4 Trade direction and post-trade state  
All internal weight arithmetic must be signed and use one documented
scale.  
Let:

||
||
||

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
|     |     |     |     |     |     |
|     |     |     |     |     |     |

||
||
||

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
|     |     |     |     |     |     |
|     |     |     |     |     |     |

||
||
||

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
|     |     |     |     |     |     |
|     |     |     |     |     |     |
|     |     |     |     |     |     |

<table>
<tbody>
<tr class="odd">
<td><ul>
<li><p>w i   w_i   w</p></li>
<li><p>i</p></li>
<li><p>— observed reserve weight of asset i  i   i.</p></li>
<li><p>w i ∗   w_i^*   w</p></li>
<li><p>i ∗</p></li>
<li><p>— approved target weight.</p></li>
<li><p>Δ w i  ( q )  \Delta w_i(q)   Δw</p></li>
<li><p>i</p></li>
<li><p>(q) — modeled change caused by proposed trade q  q   q.<br />
Then:<br />
d<br />
i<br />
=<br />
w<br />
i<br />
−<br />
w<br />
i<br />
∗<br />
d_i = w_i - w_i^*<br />
d</p></li>
</ul>
<p>i</p></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
</tbody>
</table>

=w

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
| i   |     |     |     |     |     |
|     |     |     |     |     |     |
|     |     |     |     |     |     |

−w

<table>
<tbody>
<tr class="odd">
<td><p>i<br />
∗</p></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
</tbody>
</table>

d  
i  
′  
(  
q  
)  
=  
w  
i  
+  
Δ  
w  
i  
(  
q  
)  
−  
w  
i  
∗  
d_i'(q) = w_i + \Delta w_i(q) - w_i^\*  
d

<table>
<tbody>
<tr class="odd">
<td><p>i<br />
′</p></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
</tbody>
</table>

(q)=w

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
| i   |     |     |     |     |     |
|     |     |     |     |     |     |
|     |     |     |     |     |     |

+Δw

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
| i   |     |     |     |     |     |
|     |     |     |     |     |     |
|     |     |     |     |     |     |

(q)−w

<table>
<tbody>
<tr class="odd">
<td><p>i<br />
∗</p></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
</tbody>
</table>

I  
i  
(  
q  
)  
=  
∣  
d  
i  
∣  
−  
∣  
d  
i  
′  
(  
q  
)  
∣  
I_i(q) = \|d_i\| - \|d_i'(q)\|  
I

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
| i   |     |     |     |     |     |
|     |     |     |     |     |     |
|     |     |     |     |     |     |

(q)=∣d

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
| i   |     |     |     |     |     |
|     |     |     |     |     |     |
|     |     |     |     |     |     |

∣−∣d

<table>
<tbody>
<tr class="odd">
<td><p>i<br />
′</p></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
</tbody>
</table>

(q)∣  
Interpretation:

||
||
||

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
|     |     |     |     |     |     |
|     |     |     |     |     |     |

||
||
||

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
|     |     |     |     |     |     |
|     |     |     |     |     |     |

||
||
||

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
|     |     |     |     |     |     |
|     |     |     |     |     |     |
|     |     |     |     |     |     |

<table>
<tbody>
<tr class="odd">
<td><ul>
<li><p>I i  ( q ) &gt; 0  I_i(q) &gt; 0   I</p></li>
<li><p>i</p></li>
<li><p>(q)&gt;0 — absolute deviation improves.</p></li>
<li><p>I i  ( q ) = 0  I_i(q) = 0   I</p></li>
<li><p>i</p></li>
<li><p>(q)=0 — no improvement.</p></li>
<li><p>I i  ( q ) &lt; 0  I_i(q) &lt; 0   I</p></li>
<li><p>i</p></li>
<li><p>(q)&lt;0 — deviation worsens.<br />
Do not silently floor a negative improvement to zero. Preserve the
signed value in the diagnostic record. Use a separate non-negative
eligibility signal (see §3.4.1) for the eligibility decision.<br />
A wrong-direction trade must be rejected in normal mode. An overshoot
must be flagged and resized or rejected if it worsens the objective. A
trade that reduces one asset's deviation can still worsen the portfolio
objective, liquidity, or risk. The single-asset improvement<br />
I<br />
i<br />
I_i<br />
I</p></li>
</ul>
<p>i</p></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
</tbody>
</table>

is a diagnostic, not a substitute for the approved  
J  
(  
s  
)  
J(s)  
J(s).  
3.4.1 Required eligibility signal  
The eligibility signal for normal-mode execution must be:  
solidity  
function isEligibleForNormalMode(  
int256 signedImprovement,  
int256 observedW,  
int256 targetW,  
int256 deltaW  
) internal pure returns (bool) {  
if (signedImprovement \<= 0) return false; *// must improve absolute
deviation*  
int256 d = observedW - targetW;  
if (deltaW \> 0 && d \>= 0) return false; *// buy only when
underweight*  
if (deltaW \< 0 && d \<= 0) return false; *// sell only when
overweight*  
return true;  
}  
  
  
This is not a substitute for the full  
J  
(  
s  
)  
J(s)  
J(s)-based gate. It is the minimum direction-correctness check that must
precede it.  
3.5 Objective function  
J  
(  
s  
)  
J(s)  
J(s) — Committee approval required  
The Quantitative Committee must approve the complete objective before
economic eligibility can be enabled for reserve trading.  
A candidate framework is:  
J  
(  
s  
)  
=  
J  
tracking  
(  
s  
)  
+  
J  
reserve-risk  
(  
s  
)  
J(s) = J\_{\text{tracking}}(s) + J\_{\text{reserve-risk}}(s)  
J(s)=J

|          |     |     |     |     |     |
|----------|-----|-----|-----|-----|-----|
| tracking |     |     |     |     |     |
|          |     |     |     |     |     |
|          |     |     |     |     |     |

(s)+J

|              |     |     |     |     |     |
|--------------|-----|-----|-----|-----|-----|
| reserve-risk |     |     |     |     |     |
|              |     |     |     |     |     |
|              |     |     |     |     |     |

(s)  
A candidate tracking term is:  
J  
tracking  
(  
s  
)  
=  
NAV  
⁡  
(  
s  
)  
2  
∑  
i  
κ  
i  
(  
w  
i  
(  
s  
)  
−  
w  
i  
∗  
)  
2  
J\_{\text{tracking}}(s) = \frac{\operatorname{NAV}(s)}{2} \sum_i
\kappa_i \big(w_i(s) - w_i^\*\big)^2  
J

|          |     |     |     |     |     |
|----------|-----|-----|-----|-----|-----|
| tracking |     |     |     |     |     |
|          |     |     |     |     |     |
|          |     |     |     |     |     |

(s)=

<table>
<tbody>
<tr class="odd">
<td><p>2<br />
<br />
NAV(s)</p></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td><p>i<br />
∑</p></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
</tbody>
</table>

κ

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
| i   |     |     |     |     |     |
|     |     |     |     |     |     |
|     |     |     |     |     |     |

(w

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
| i   |     |     |     |     |     |
|     |     |     |     |     |     |
|     |     |     |     |     |     |

(s)−w

<table>
<tbody>
<tr class="odd">
<td><p>i<br />
∗</p></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
</tbody>
</table>

)

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
| 2   |     |     |     |     |     |

This candidate is not approved for production implementation until the
Committee defines and approves:

||
||
||

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
|     |     |     |     |     |     |
|     |     |     |     |     |     |

||
||
||

<table>
<tbody>
<tr class="odd">
<td><ul>
<li><p>The state s  s   s and valuation time.</p></li>
<li><p>The definition and numeraire of NAV.</p></li>
<li><p>Target weights and their governance source.</p></li>
<li><p>Each coefficient κ i   \kappa_i   κ</p></li>
<li><p>i</p></li>
<li><p>, its units, and calibration method.</p></li>
<li><p>Whether covariance, tracking error, or another portfolio-risk
representation is required.</p></li>
<li><p>The reserve-risk term, horizon, scenarios, and aggregation
method.</p></li>
<li><p>How concentration, liquidity, volatility, and tail risk are
handled without double-counting.</p></li>
<li><p>How objective changes are evaluated when a trade changes
NAV.</p></li>
<li><p>Model versioning, independent validation, and approval
procedures.<br />
Do not assign arbitrary coefficients or claim that a quadratic tracking
penalty alone represents purchasing-power preservation. Do not assign
arbitrary monetary values to dimensionless urgency scores,
purchasing-power improvements, or diversification benefits.<br />
3.6 Protected net-benefit gate<br />
For a candidate trade<br />
q<br />
q<br />
q:<br />
G<br />
(<br />
q<br />
;<br />
s<br />
)<br />
=<br />
J<br />
(<br />
s<br />
)<br />
−<br />
J<br />
(<br />
s<br />
′<br />
(<br />
q<br />
)<br />
)<br />
G(q; s) = J(s) - J(s'(q))<br />
G(q;s)=J(s)−J(s</p></li>
</ul>
<p>′</p></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
</tbody>
</table>

(q))  
where  
s  
′  
(  
q  
)  
s'(q)  
s

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
| ′   |     |     |     |     |     |
|     |     |     |     |     |     |

\(q\) is the modeled post-trade state using the quoted route and actual
asset amounts.  
Define total expected cost in the common accounting numeraire:  
C  
(  
q  
)  
=  
C  
spread  
+  
C  
route  
+  
C  
impact  
+  
C  
fees  
+  
C  
settlement  
+  
C  
other  
C(q) = C\_{\text{spread}} + C\_{\text{route}} + C\_{\text{impact}} +
C\_{\text{fees}} + C\_{\text{settlement}} + C\_{\text{other}}  
C(q)=C

|        |     |     |     |     |     |
|--------|-----|-----|-----|-----|-----|
| spread |     |     |     |     |     |
|        |     |     |     |     |     |
|        |     |     |     |     |     |

+C

|       |     |     |     |     |     |
|-------|-----|-----|-----|-----|-----|
| route |     |     |     |     |     |
|       |     |     |     |     |     |
|       |     |     |     |     |     |

+C

|        |     |     |     |     |     |
|--------|-----|-----|-----|-----|-----|
| impact |     |     |     |     |     |
|        |     |     |     |     |     |
|        |     |     |     |     |     |

+C

|      |     |     |     |     |     |
|------|-----|-----|-----|-----|-----|
| fees |     |     |     |     |     |
|      |     |     |     |     |     |
|      |     |     |     |     |     |

+C

|            |     |     |     |     |     |
|------------|-----|-----|-----|-----|-----|
| settlement |     |     |     |     |     |
|            |     |     |     |     |     |
|            |     |     |     |     |     |

+C

|       |     |     |     |     |     |
|-------|-----|-----|-----|-----|-----|
| other |     |     |     |     |     |
|       |     |     |     |     |     |
|       |     |     |     |     |     |

Every cost component must be itemized. If a quoted output already
includes a spread or fee, do not add that same amount again. Record
which components are quote-embedded and which are incremental.  
Define the protection margin:  
B  
time  
(  
q  
)  
=  
V  
(  
q  
)  
⋅  
b  
(  
Δ  
t  
,  
σ  
,  
L  
,  
route  
,  
side  
,  
size  
)  
B\_{\text{time}}(q) = V(q) \cdot b(\Delta t, \sigma, L, \text{route},
\text{side}, \text{size})  
B

|      |     |     |     |     |     |
|------|-----|-----|-----|-----|-----|
| time |     |     |     |     |     |
|      |     |     |     |     |     |

(q)=V(q)⋅b(Δt,σ,L,route,side,size)  
where:

||
||
||

<table>
<tbody>
<tr class="odd">
<td><ul>
<li><p>V ( q )  V(q)   V(q) — trade value in the accounting
numeraire.</p></li>
<li><p>Δ t  \Delta t   Δt — relevant quote age and expected execution
delay.</p></li>
<li><p>σ  \sigma   σ — a defined short-horizon volatility
measure.</p></li>
<li><p>L  L   L — available liquidity/depth and its
reliability.</p></li>
<li><p>Route, side, and size distinguish execution conditions.<br />
The protection function must be calibrated against actual execution data
and stress tests. Before sufficient evidence exists, use a formally
approved conservative fallback and hard limits. Do not claim that a
guessed fixed factor is calibrated.<br />
The protected net benefit is:<br />
N<br />
(<br />
q<br />
;<br />
s<br />
)<br />
=<br />
G<br />
(<br />
q<br />
;<br />
s<br />
)<br />
−<br />
C<br />
(<br />
q<br />
)<br />
−<br />
B<br />
time<br />
(<br />
q<br />
)<br />
N(q; s) = G(q; s) - C(q) - B_{\text{time}}(q)<br />
N(q;s)=G(q;s)−C(q)−B</p></li>
</ul>
<p>time</p></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
</tbody>
</table>

(q)  
Normal-mode execution requires:  
N  
(  
q  
;  
s  
)  
\>  
ε  
(  
q  
)  
N(q; s) \> \varepsilon(q)  
N(q;s)\>ε(q)  
and every independent authorization, oracle, reserve, liquidity,
quote-validity, slippage, and operational check must pass.  
All terms must use the same approved numeraire and compatible scale. A
dimensionless deviation improvement cannot be subtracted directly from a
monetary execution cost.  
The threshold  
ε  
(  
q  
)  
\varepsilon(q)  
ε(q) must have an approved definition, units, and policy. The current
conflict between a \$10 minimum benefit and a 1% benefit margin must be
resolved under OD-2. The developer must not combine them arbitrarily or
pick whichever threshold permits a trade.  
3.6.1 Gross benefit verification gap  
The on-chain contract can verify arithmetic consistency of supplied
values. It cannot verify that the supplied gross benefit was computed
correctly from the approved  
J  
(  
s  
)  
J(s)  
J(s). The correctness of the gross benefit is the keeper's
responsibility and the auditor's check. The developer must:

||
||
||

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
|     |     |     |     |     |     |

- Compute J ( s )  J(s)   J(s) and J ( s ′  ( q ) )  J(s'(q))   J(s

- ′

- (q)) off-chain under the approved objective version.

- Bind the gross benefit and the objective version into the signed
  decision record.

- Ensure the on-chain contract enforces only what it can independently
  check (arithmetic consistency, authorization, hard bounds, version
  match).

- Never describe on-chain enforcement as verification of the economic
  calculation.  
  3.7 Gas-cost conversion  
  When:

||
||
||

|     |     |     |     |     |     |
|-----|-----|-----|-----|-----|-----|
|     |     |     |     |     |     |
|     |     |     |     |     |     |

<table>
<tbody>
<tr class="odd">
<td><ul>
<li><p>gasUnits is measured in gas units,</p></li>
<li><p>gasPriceWei is wei per gas,</p></li>
<li><p>nativeUsdPriceE18 is USD per native token scaled by
10 18   10^{18}   10</p></li>
<li><p>18</p></li>
<li><p>,<br />
the USD-equivalent cost scaled by<br />
10<br />
18<br />
10^{18}<br />
10</p></li>
</ul>
<p>18</p></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
</tbody>
</table>

is:  
text  
gasCostUsdE18 = gasUnits \* gasPriceWei \* nativeUsdPriceE18 / 1e18  
  
  
This formula assumes the price is in the specified units and the
arithmetic is safely implemented with a full-precision mulDiv.  
GAS_FALLBACK must never be passed into this function as though it were a
gas price if it represents a monetary fallback. Record when the fallback
is used, its value, its source, and its effect on eligibility. If the
approved fallback policy does not authorize trading without a valid
native-token price, reject or defer the trade.  
Sanity checks:

- 150,000 gas × 30 gwei × \$3,000/native token = \*\*\$13.50\*\*.

- 300,000 gas × 100 gwei × \$1,500/native token = \*\*\$45.00\*\*.  
  The accounting numeraire remains an accounting convention, not a
  monetary peg.  
  3.8 Quote protection and hard execution bounds  
  Immediately before execution, validate:

<!-- -->

- Route quote exists, belongs to the intended assets and trade side, and
  is fresh.

- Quote timestamp, quote age, expiry, and deadline are valid.

- Oracle data are independently fresh and satisfy approved
  confidence/deviation checks.

- Input/output amount semantics are correct.

- minAmountOut or maxAmountIn is correctly derived and denominated.

- Route liquidity and size caps are satisfied.

- Fees are correctly represented and not double-counted.

- The proposed trade remains within reserve, turnover, concentration,
  and authorization limits.

- The keeper is authorized.

- The decision record and approved parameter/model versions are valid.  
  If the quote is stale, the oracle fails its checks, or the price has
  deteriorated beyond the hard bound, reject, requote, resize, or defer
  according to the approved policy.  
  An on-chain contract cannot independently prove that an off-chain
  route was globally optimal or that all estimated economic costs were
  correct. On-chain enforcement must enforce hard bounds and
  authorization. The keeper performs the approved economic analysis and
  signs an attributable decision record.  
  3.9 Emergency mode  
  Normal, degraded, and emergency modes must be separate, explicitly
  defined states.  
  An emergency trade may bypass the normal economic eligibility
  threshold only if a written policy is approved in advance and defines:

||
||
||

<table>
<tbody>
<tr class="odd">
<td><ul>
<li><p>The triggering conditions.</p></li>
<li><p>The risk-reducing objective.</p></li>
<li><p>Authorized initiators and signers.</p></li>
<li><p>Permitted assets, routes, counterparties, and maximum
sizes.</p></li>
<li><p>Maximum frequency and cumulative exposure.</p></li>
<li><p>Required oracle and execution bounds.</p></li>
<li><p>Expiry and automatic return-to-normal behavior.</p></li>
<li><p>Audit logging and post-event review.</p></li>
<li><p>Independent monitoring and kill-switch behavior.<br />
Emergency mode must never implicitly waive authorization,
reserve-solvency limits, approved oracle sanity checks, or
minimum-output/maximum-input protection.<br />
OD-6 remains open until the relevant governance bodies approve and test
the policy.<br />
<br />
Part 4 — Corrected implementation patterns<br />
These examples define required semantics. They are not drop-in
replacements for the deployed system. The developer must adapt them to
the actual contract interfaces, compiler version, access-control design,
state model, and approved parameters.<br />
Every library below must be integrated into the actual MARP contract
(not left as a separate library that is never called), and must be
covered by the tests in Part 6.<br />
4.1 Listing C-1 — Signed deviation and signed improvement<br />
solidity<br />
<em>// SPDX-License-Identifier: MIT</em><br />
pragma solidity ^0.8.19;<br />
<br />
library DeviationMath {<br />
error SignedOverflow();<br />
<br />
<em>/// @notice Signed deviation: observed minus target.</em><br />
<em>/// Positive means overweight; negative means
underweight.</em><br />
function signedDeviation(<br />
int256 observedW,<br />
int256 targetW<br />
) internal pure returns (int256) {<br />
return observedW - targetW;<br />
}<br />
<br />
<em>/// @notice Absolute value without accepting int256
minimum.</em><br />
function absDeviation(int256 d) internal pure returns (uint256) {<br />
if (d == type(int256).min) revert SignedOverflow();<br />
return uint256(d &gt;= 0 ? d : -d);<br />
}<br />
<br />
<em>/// @notice Signed post-trade deviation.</em><br />
<em>/// deltaW is positive for an increase in the asset
weight.</em><br />
function postTradeDeviation(<br />
int256 observedW,<br />
int256 targetW,<br />
int256 deltaW<br />
) internal pure returns (int256) {<br />
return (observedW + deltaW) - targetW;<br />
}<br />
<br />
<em>/// @notice Signed improvement: positive improves absolute
deviation,</em><br />
<em>/// negative worsens, zero means no change.</em><br />
function signedImprovement(<br />
int256 observedW,<br />
int256 targetW,<br />
int256 deltaW<br />
) internal pure returns (int256) {<br />
uint256 beforeAbs = absDeviation(signedDeviation(observedW,
targetW));<br />
uint256 afterAbs = absDeviation(postTradeDeviation(observedW, targetW,
deltaW));<br />
<br />
if (beforeAbs &gt;= afterAbs) {<br />
uint256 diff = beforeAbs - afterAbs;<br />
if (diff &gt; uint256(type(int256).max)) revert SignedOverflow();<br />
return int256(diff);<br />
}<br />
<br />
uint256 deterioration = afterAbs - beforeAbs;<br />
if (deterioration &gt; uint256(type(int256).max)) revert
SignedOverflow();<br />
return -int256(deterioration);<br />
}<br />
<br />
<em>/// @notice Normal-mode eligibility: positive improvement, correct
direction.</em><br />
function isEligibleForNormalMode(<br />
int256 signedImp,<br />
int256 observedW,<br />
int256 targetW,<br />
int256 deltaW<br />
) internal pure returns (bool) {<br />
if (signedImp &lt;= 0) return false;<br />
int256 d = observedW - targetW;<br />
if (deltaW &gt; 0 &amp;&amp; d &gt;= 0) return false;<br />
if (deltaW &lt; 0 &amp;&amp; d &lt;= 0) return false;<br />
return true;<br />
}<br />
}<br />
<br />
<br />
Required tests (T-01 through T-04):<br />
<br />
</p></li>
</ul>
<p>Case</p></td>
<td><p>Observed</p></td>
<td><p>Target</p></td>
<td><p>Delta</p></td>
<td><p>Post-trade deviation</p></td>
<td><p>Signed improvement</p></td>
</tr>
<tr class="even">
<td><p>Buy underweight</p></td>
<td><p>0.25</p></td>
<td><p>0.30</p></td>
<td><p>+0.03</p></td>
<td><p>-0.02</p></td>
<td><p>+0.03</p></td>
</tr>
<tr class="odd">
<td><p>Sell overweight</p></td>
<td><p>0.35</p></td>
<td><p>0.30</p></td>
<td><p>-0.03</p></td>
<td><p>+0.02</p></td>
<td><p>+0.03</p></td>
</tr>
<tr class="even">
<td><p>Buy overweight (wrong direction)</p></td>
<td><p>0.35</p></td>
<td><p>0.30</p></td>
<td><p>+0.03</p></td>
<td><p>+0.08</p></td>
<td><p>-0.03</p></td>
</tr>
<tr class="odd">
<td><p>No trade</p></td>
<td><p>0.25</p></td>
<td><p>0.30</p></td>
<td><p>0</p></td>
<td><p>-0.05</p></td>
<td><p>0</p></td>
</tr>
<tr class="even">
<td><p>Overshoot that worsens deviation</p></td>
<td><p>0.28</p></td>
<td><p>0.30</p></td>
<td><p>+0.05</p></td>
<td><p>+0.03</p></td>
<td><p>-0.01</p></td>
</tr>
</tbody>
</table>

The overshoot case must be rejected or resized in normal mode. The
diagnostic must not report a positive improvement when absolute
deviation increases. The values above use weight fractions for
readability; production code must use the blueprint's actual scale.  
4.2 Listing C-2 — Checked token scaling  
Never assume every token uses 18 decimals. Read and verify the actual
decimals from the intended token contract or chain adapter, subject to
the approved asset registry.  
solidity  
*// SPDX-License-Identifier: MIT*  
pragma solidity ^0.8.19;  
  
library TokenScale {  
error UnsupportedDecimals(uint8 decimals);  
error PrecisionLoss();  
error ScaleOverflow();  
  
uint8 internal constant INTERNAL_DECIMALS = 18;  
  
*/// @notice Convert a token-native amount into internal 18-decimal
form.*  
*/// Reverts on decimals \> 18 or multiplicative overflow.*  
function to18Exact(uint256 amount, uint8 decimals)  
internal pure returns (uint256)  
{  
if (decimals \> 18) revert UnsupportedDecimals(decimals);  
uint256 factor = 10 \*\* uint256(18 - decimals);  
if (amount != 0 && amount \> type(uint256).max / factor) {  
revert ScaleOverflow();  
}  
return amount \* factor;  
}  
  
*/// @notice Convert internal 18-decimal amount into token-native
form.*  
*/// Reverts if the conversion cannot be represented exactly.*  
function from18Exact(uint256 amount18, uint8 decimals)  
internal pure returns (uint256)  
{  
if (decimals \> 18) revert UnsupportedDecimals(decimals);  
uint256 factor = 10 \*\* uint256(18 - decimals);  
if (amount18 % factor != 0) revert PrecisionLoss();  
return amount18 / factor;  
}  
}  
  
  
Asset registry validation (required):  
solidity  
function validateAssetForRegistry(address token) internal view {  
uint8 decimals = IERC20Metadata(token).decimals();  
require(decimals \<= 18,  
"Asset registry: \>18 decimals requires separate precision approval");  
*// Additional checks: token standard, transfer behavior,
fee-on-transfer detection, etc.*  
}  
  
  
Required tests (T-05 through T-08):

- 1,000,000 USDC (6 decimals) round-trips through internal form exactly.

- 1.5 PAXG (18 decimals) is unchanged.

- 100 USDC round-trips without loss.

- Conversion to lower decimals rejects non-representable dust.

- Unsupported decimals and overflow are rejected.

- Token metadata mismatches trigger asset-registry failure.  
  This is intentionally conservative. If the actual asset set includes a
  token with more than 18 decimals, the developer must propose a
  separate representation with explicit precision and rounding analysis.
  Do not silently truncate.  
  4.3 Listing C-3 — Gas cost with full-precision mulDiv  
  solidity  
  *// SPDX-License-Identifier: MIT*  
  pragma solidity ^0.8.19;  
    
  library GasCost {  
  error InvalidInput();  
  error Overflow();  
    
  uint256 internal constant SCALE = 1e18;  
    
  */// @notice Estimate gas cost in USD-equivalent 1e18 units.*  
  */// @dev Inputs must be validated by the caller.*  
  */// @dev The mulDiv function must be replaced with an audited*  
  */// full-precision implementation before production.*  
  function estimate(  
  uint256 gasUnits,  
  uint256 gasPriceWei,  
  uint256 nativeUsdPriceE18  
  ) internal pure returns (uint256) {  
  if (gasUnits == 0 \|\| gasPriceWei == 0 \|\| nativeUsdPriceE18 == 0)
  {  
  revert InvalidInput();  
  }  
  *// Avoid naive a\*b\*c; use full-precision mulDiv.*  
  *// Placeholder below: replace with OpenZeppelin Math.mulDiv or
  equivalent.*  
  return mulDivFullPrecision(  
  gasUnits \* gasPriceWei, *// gasCostWei*  
  nativeUsdPriceE18,  
  SCALE  
  );  
  }  
    
  */// @dev Placeholder. Replace with an audited full-precision
  mulDiv*  
  */// (e.g. OpenZeppelin Math.mulDiv, Remco Bloemen's
  implementation).*  
  function mulDivFullPrecision(  
  uint256 x,  
  uint256 y,  
  uint256 denominator  
  ) private pure returns (uint256) {  
  if (denominator == 0) revert InvalidInput();  
  if (x != 0 && y \> type(uint256).max / x) revert Overflow();  
  return (x \* y) / denominator;  
  }  
  }  
    
    
  Implementation requirement: the placeholder mulDivFullPrecision above
  is deliberately a simple checked implementation and will revert when
  the intermediate product overflows. It is not the production solution.
  Replace with an audited full-precision implementation from
  OpenZeppelin (Math.mulDiv) or an equivalent reviewed library.  
  Sanity example (must be tested, T-09 and T-10):

||
||
||

<table>
<tbody>
<tr class="odd">
<td><ul>
<li><p>150,000 gas × 30 gwei × $3,000/native token = $13.50 (within
defined rounding tolerance).</p></li>
<li><p>300,000 gas × 100 gwei × $1,500/native token = $45.00 (within
defined rounding tolerance).<br />
4.4 Listing C-4 — Dimensional net-benefit gate<br />
solidity<br />
<em>// SPDX-License-Identifier: MIT</em><br />
pragma solidity ^0.8.19;<br />
<br />
library NetBenefit {<br />
error ValueOutOfRange();<br />
<br />
<em>/// @notice All monetary inputs use the same approved numeraire and
scale.</em><br />
function calculate(<br />
int256 grossBenefitE18,<br />
uint256 costE18,<br />
uint256 protectionE18<br />
) internal pure returns (int256 netBenefitE18) {<br />
if (<br />
costE18 &gt; uint256(type(int256).max) ||<br />
protectionE18 &gt; uint256(type(int256).max)<br />
) revert ValueOutOfRange();<br />
<br />
int256 deductions = int256(costE18);<br />
if (protectionE18 &gt; uint256(type(int256).max) - costE18) {<br />
revert ValueOutOfRange();<br />
}<br />
deductions += int256(protectionE18);<br />
return grossBenefitE18 - deductions;<br />
}<br />
<br />
function isEligible(<br />
int256 grossBenefitE18,<br />
uint256 costE18,<br />
uint256 protectionE18,<br />
uint256 thresholdE18<br />
) internal pure returns (bool eligible, int256 netBenefitE18) {<br />
if (thresholdE18 &gt; uint256(type(int256).max)) {<br />
revert ValueOutOfRange();<br />
}<br />
netBenefitE18 = calculate(grossBenefitE18, costE18,
protectionE18);<br />
eligible = netBenefitE18 &gt; int256(thresholdE18);<br />
}<br />
}<br />
<br />
<br />
This library only enforces arithmetic and unit consistency. It does not
validate that the gross benefit was correctly computed from the
approved<br />
J<br />
(<br />
s<br />
)<br />
J(s)<br />
J(s) — see §3.6.1.<br />
Required tests (T-11):<br />
<br />
</p></li>
</ul>
<p>Gross benefit</p></td>
<td><p>Cost</p></td>
<td><p>Protection</p></td>
<td><p>Threshold</p></td>
<td><p>Net benefit</p></td>
<td><p>Eligible</p></td>
</tr>
<tr class="even">
<td><p>0.12</p></td>
<td><p>0.05</p></td>
<td><p>0.02</p></td>
<td><p>0.01</p></td>
<td><p>0.04</p></td>
<td><p>Yes</p></td>
</tr>
<tr class="odd">
<td><p>0.12</p></td>
<td><p>0.05</p></td>
<td><p>0.02</p></td>
<td><p>0.05</p></td>
<td><p>0.04</p></td>
<td><p>No</p></td>
</tr>
<tr class="even">
<td><p>0.05</p></td>
<td><p>0.10</p></td>
<td><p>0.02</p></td>
<td><p>0</p></td>
<td><p>-0.07</p></td>
<td><p>No</p></td>
</tr>
<tr class="odd">
<td><p>-0.01</p></td>
<td><p>0</p></td>
<td><p>0</p></td>
<td><p>0</p></td>
<td><p>-0.01</p></td>
<td><p>No</p></td>
</tr>
</tbody>
</table>

All values are illustrative USD-equivalent amounts; the implementation
must use the approved integer scale.  
4.5 Listing C-5 — Corrected execution pipeline  
Do not deploy the following as a replacement contract. Integrate the
steps into the actual MARP architecture.  
text  
1. Load approved target state and parameter/model versions.  
2. Read holdings and approved reference valuations.  
3. Compute target gap and proposed signed trade.  
4. Validate trade direction (isEligibleForNormalMode).  
5. Simulate post-trade state from quoted asset amounts.  
6. Apply approved per-asset, portfolio, turnover, and liquidity
limits.  
7. Request a fresh executable route quote.  
8. Record quote timestamp, route legs, input/output semantics,  
embedded fees, expiry/deadline, and estimated delay.  
9. Validate independent oracle freshness, confidence, and deviation.  
10. Compute post-trade state (signed, direction-aware).  
11. Compute gross benefit from the Committee-approved J(s).  
12. Estimate every incremental cost in the common numeraire  
(including correctly converted gas).  
13. Compute the Committee-approved time-dependent protection margin.  
14. Apply the Committee-approved threshold policy.  
15. Reject, resize, requote, defer, or proceed.  
16. Produce a signed, attributable decision record binding:  
- Decision ID  
- Chain/deployment IDs  
- Keeper/signer identity  
- Asset/route IDs  
- Trade direction, size, limits  
- Quote provider and timestamp  
- Oracle source and observation metadata  
- Cost-model, protection-model, objective-function versions  
- Parameter-set hash  
- Estimated cost, protection margin, gross benefit, net benefit  
- Threshold and safety-policy versions  
17. Verify keeper authorization and hard on-chain bounds.  
18. Execute with minAmountOut or maxAmountIn and a valid deadline.  
19. Reconcile settled amounts, actual fees, actual price, and
finality.  
20. Record discrepancies, failures, and post-trade reserve state.  
21. Feed verified outcomes into the governed calibration process.  
  
  
A decision record must not be accepted solely because a keeper supplied
a positive benefit value. The record must be bound to the approved
objective, parameter set, valuation snapshot, route quote, cost-model
version, protection-model version, and decision time.  
4.6 Listing C-6 — Role rotation  
Do not implement generic wrapper functions that merely call another
contract's grantRole. Verify the target's actual role-admin hierarchy
first.  
Production baseline:

- DEFAULT_ADMIN_ROLE — governance Safe or approved governance-controlled
  mechanism.

- MINTER_ROLE — governance Safe or narrowly scoped, approved minter
  contract.

- PAUSER_ROLE — approved emergency/governance authority.

- Deployer EOA — no persistent privileged role unless explicit, reviewed
  policy permits it.  
  Do not assume the Safe is a 4-of-7 Safe unless its actual
  configuration proves it. If the deployer is a Safe signer, that does
  not justify retaining a separate EOA administrator role.  
  Approved signing methods for rotation (do not paste private keys
  anywhere):

<!-- -->

- Hardware wallet: cast send --ledger --rpc-url \$RPC ...

- Safe Wallet app or Safe CLI for transactions originating from the
  Safe.

- Secrets manager injecting the key at runtime into a signing service
  that is not the developer's shell history.  
    
  Part 5 — Verification and role rotation operations  
  5.1 Verify EVM role assignments  
  bash  
  export MTQ="0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD"  
  export SAFE="0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0"  
  export DEPLOYER="0x3C3932F865892EFabE45892f453f81B64f6c8d8c"  
    
  export
  ROLE_ADMIN="0x0000000000000000000000000000000000000000000000000000000000000000"  
  export
  ROLE_MINTER="0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"  
  export
  ROLE_PAUSER="0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a"  
    
  *\# Verify deployer holds all three*  
  cast call --rpc-url "\$RPC" "\$MTQ" "hasRole(bytes32,address)(bool)"
  "\$ROLE_ADMIN" "\$DEPLOYER"  
  cast call --rpc-url "\$RPC" "\$MTQ" "hasRole(bytes32,address)(bool)"
  "\$ROLE_MINTER" "\$DEPLOYER"  
  cast call --rpc-url "\$RPC" "\$MTQ" "hasRole(bytes32,address)(bool)"
  "\$ROLE_PAUSER" "\$DEPLOYER"  
    
  *\# Verify Safe does / does not hold each role*  
  cast call --rpc-url "\$RPC" "\$MTQ" "hasRole(bytes32,address)(bool)"
  "\$ROLE_ADMIN" "\$SAFE"  
  cast call --rpc-url "\$RPC" "\$MTQ" "hasRole(bytes32,address)(bool)"
  "\$ROLE_MINTER" "\$SAFE"  
  cast call --rpc-url "\$RPC" "\$MTQ" "hasRole(bytes32,address)(bool)"
  "\$ROLE_PAUSER" "\$SAFE"  
    
    
  Repeat on Arc using Arc's MTQ address and a verified Arc RPC. Repeat
  for every contract whose access-control configuration matters
  (Mint.sol, Reserve.sol, Governance.sol).  
  These commands are read-only. They do not rotate roles.  
  5.2 Testnet role-rotation rehearsal  
  The developer must prepare ROLE_ROTATION.md containing the exact
  contract interface, role-admin configuration, transaction sequence,
  expected state after each step, rollback considerations, and
  verification commands.  
  Intended sequence (testnet rehearsal first, production only after Gate
  5 approval):

1.  Verify the Safe and its signers/threshold by inspecting its actual
    configuration.

2.  Grant the Safe the required administrative role
    (grantRole(ROLE_ADMIN, SAFE)).

3.  Verify the Safe can exercise the admin role.

4.  Grant the Safe the required operational roles (MINTER, PAUSER).

5.  Verify the Safe can perform the intended operational actions on each
    contract.

6.  Revoke the deployer's operational roles through the authorized
    mechanism.

7.  Verify the deployer no longer holds those roles.

8.  Revoke the deployer's admin role if the approved policy requires it.

9.  Verify that a legitimate governance administrator remains and that
    no critical action has become impossible.  
    Template (testnet rehearsal — do not run on production without Gate
    5):  
    bash  
    *\# Step 1: Grant admin to Safe*  
    cast send --rpc-url "\$RPC" --ledger "\$MTQ" \\  
    "grantRole(bytes32,address)" "\$ROLE_ADMIN" "\$SAFE"  
      
    *\# Step 2: Grant minter and pauser to Safe*  
    cast send --rpc-url "\$RPC" --ledger "\$MTQ" \\  
    "grantRole(bytes32,address)" "\$ROLE_MINTER" "\$SAFE"  
    cast send --rpc-url "\$RPC" --ledger "\$MTQ" \\  
    "grantRole(bytes32,address)" "\$ROLE_PAUSER" "\$SAFE"  
      
    *\# Step 3: Verify Safe holds all three*  
    cast call --rpc-url "\$RPC" "\$MTQ" "hasRole(bytes32,address)(bool)"
    "\$ROLE_ADMIN" "\$SAFE"  
    cast call --rpc-url "\$RPC" "\$MTQ" "hasRole(bytes32,address)(bool)"
    "\$ROLE_MINTER" "\$SAFE"  
    cast call --rpc-url "\$RPC" "\$MTQ" "hasRole(bytes32,address)(bool)"
    "\$ROLE_PAUSER" "\$SAFE"  
      
    *\# Step 4: Execute revocations FROM the Safe (Safe UI or Safe
    CLI):*  
    *\# MTQ.revokeRole(ROLE_MINTER, DEPLOYER)*  
    *\# MTQ.revokeRole(ROLE_PAUSER, DEPLOYER)*  
      
    *\# Step 5: Verify deployer no longer holds operational roles*  
    cast call --rpc-url "\$RPC" "\$MTQ" "hasRole(bytes32,address)(bool)"
    "\$ROLE_MINTER" "\$DEPLOYER"  
    cast call --rpc-url "\$RPC" "\$MTQ" "hasRole(bytes32,address)(bool)"
    "\$ROLE_PAUSER" "\$DEPLOYER"  
      
    *\# Step 6: Optionally revoke admin from deployer if the deployer is
    not a Safe signer*  
    *\# (Safe execution): MTQ.revokeRole(ROLE_ADMIN, DEPLOYER)*  
      
      
    The --ledger flag is preferred. Do not paste private keys into
    source code, chat, logs, shell history, or shared command files. If
    a hardware wallet is unavailable, use the Safe interface or a
    secrets manager that injects the key at runtime into a signing
    service — never into the developer's interactive shell.  
    5.3 Solana mint verification  
    bash  
    export SOLANA_RPC="https://api.devnet.solana.com"  
    export MINT="GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4"  
      
    spl-token display "\$MINT" --url "\$SOLANA_RPC"  
      
      
    Record actual mint authority, freeze authority, decimals, token
    program, metadata, and compatibility test results. Do not assume the
    reported wallet is the mint authority without inspecting the
    account.  
    5.4 Cross-chain verification  
    For the reported Governance and Safe addresses, collect on each
    chain independently:

||
||
||
||

<table>
<tbody>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td><p>Threshold, signers, modules, guard match expected 4/7 config;
critical security finding if not</p>
<p>T-88</p>
<p>MTQ token standard</p>
<p>Permits, snapshots, transfer restrictions (or absence) verified per
OD-37</p>
<p>Total across all documents: T-01 through T-88.</p>
<p>Part G — Consolidated Gate 2 exit criteria (all four documents)</p>
<p>For Gate 2 to close, all of the following must be satisfied. This
supersedes the corresponding section in Extension 2 (Part N).<br />
Layer 1 — Reference index (MASE):</p>
<ul>
<li><p>□ MASE implemented per Blueprint Chapters 5–7 (OD-31)</p></li>
<li><p>□ J(s) in v5.0 §3.5 confirmed as trade-gating objective, distinct
from MASE objective</p></li>
<li><p>□ MASE weights published daily with version hashes</p></li>
<li><p>□ Chain-linked index computes correctly (OD-12 approved)</p></li>
<li><p>□ Base fixings immutable</p></li>
<li><p>□ Daily index published</p></li>
</ul>
<p>Layer 2 — Reserve valuation:</p>
<ul>
<li><p>□ NAV with haircuts matches independent recomputation (Ext 2
Listing E-1)</p></li>
<li><p>□ RR with three floors (Ext 2 Listing E-2)</p></li>
<li><p>□ LCR with 24h liquid classification (Ext 2 Listing E-3)</p></li>
<li><p>□ Buffer states BASE/STRESS/EMERGENCY (Ext 2 Listing
E-4)</p></li>
<li><p>□ First-loss waterfall (Ext 2 Listing E-5)</p></li>
<li><p>□ Stress equation passes (Ext 2 §B.6)</p></li>
</ul>
<p>Layer 3 — Asset governance:</p>
<ul>
<li><p>□ Registry with eight criteria (Ext 2 Part D)</p></li>
<li><p>□ Four states</p></li>
<li><p>□ Concentration limits</p></li>
<li><p>□ Chain diversification</p></li>
</ul>
<p>Layer 4 — MARP execution:</p>
<ul>
<li><p>□ All v5.0 Part 4 Listings C-1 through C-6</p></li>
<li><p>□ All Extension 1 Listings C-7 through C-10</p></li>
<li><p>□ MARP correctly consumes MASE weights (OD-31)</p></li>
</ul>
<p>Layer 5 — Operational safety:</p>
<ul>
<li><p>□ All Extension 1 requirements</p></li>
<li><p>□ MEV protection (Ext 2 Part G)</p></li>
<li><p>□ Token edge cases (Ext 2 Part H)</p></li>
</ul>
<p>Layer 6 — Reporting:</p>
<ul>
<li><p>□ Daily State Vector (Ext 2 Listing E-6)</p></li>
<li><p>□ Reconciliation report</p></li>
<li><p>□ Log retention policy approved (OD-21)</p></li>
</ul>
<p>Layer 7 — Governance and emergency:</p>
<ul>
<li><p>□ Four-layer governance operational</p></li>
<li><p>□ Parameter registry complete</p></li>
<li><p>□ Genesis Reserve / Cold Treasury configured (OD-33)</p></li>
<li><p>□ De-peg eject mechanism tested (Ext 2 Listing E-8)</p></li>
<li><p>□ Emergency response playbook approved (OD-22)</p></li>
</ul>
<p>Layer 8 — External specifications integrated:</p>
<ul>
<li><p>□ MASE implementation confirmed (OD-31)</p></li>
<li><p>□ Mint/redeem implementation confirmed (OD-32)</p></li>
<li><p>□ Genesis implementation confirmed (OD-33)</p></li>
<li><p>□ Oracle addresses confirmed (OD-34)</p></li>
</ul>
<p>All 88 tests (T-01 through T-88) must pass or have documented
accepted risk.</p>
<p>Part H — What the developer's first sprint must produce</p>
<p>Amending v5.0 §0.6 + Extension 1 §J.3 + Extension 2 §P.3:</p>
<ol type="1">
<li><p>Verify the deployment inventory (v5.0 §1.5) on Monad, Arc,
Solana.</p></li>
<li><p>Reproduce the four P0 findings (v5.0 §0.4) against actual
source.</p></li>
<li><p>Obtain repository access and deployment record (OD-36). Confirm
commit hash of deployed contracts.</p></li>
<li><p>Review Extension 1, Extension 2, Extension 3 and confirm
applicability.</p></li>
<li><p>Read Master Blueprint Chapters 5–7, 19, 20.1 (the MASE,
mint/redeem, genesis specifications).</p></li>
<li><p>Report on MASE implementation status (OD-31): is it implemented?
Where? Does it match Blueprint? Is the objective distinct from v5.0's
J(s)?</p></li>
<li><p>Report on mint/redeem implementation status (OD-32): does it
match Blueprint Chapter 19? Are the fees correct? Is the risk-state
dependency present?</p></li>
<li><p>Report on genesis implementation status (OD-33): does it follow
the seven-step sequence? Is the seven-component basket used? Is the base
denominator computed?</p></li>
<li><p>Report on oracle feed configuration (OD-34): what feeds does each
deployed Oracle.sol use? Mock or real?</p></li>
<li><p>Integrate Listings C-1 through C-10 and E-1 through E-10 into a
new branch.</p></li>
<li><p>Run tests T-01 through T-88 (or documented subset with reasons
for deferral).</p></li>
<li><p>Report back to the Committee with all of the above.</p></li>
</ol>
<p>Part I — Final honest statement</p>
<p>What I am confident about:<br />
The four documents (v5.0, Ext 1, Ext 2, Ext 3) together, plus the Master
Blueprint v1.0, are a complete specification for a testnet-live
single-chain EVM deployment at Gate 2.<br />
The eight items above close the last essential gaps. None of them
require new architecture; all of them either:</p>
<ul>
<li><p>Point to an existing Blueprint section that was never formally
listed as an input dependency.</p></li>
<li><p>Verify existing infrastructure that was assumed but not
checked.</p></li>
<li><p>Add a required policy (vulnerability disclosure) that is standard
practice.</p></li>
</ul>
<p>What I am not confident about:<br />
I cannot guarantee that no additional gaps exist. What I can say is that
any remaining gap would be in one of these categories:</p>
<ul>
<li><p>Deferred by design (portfolio optimization, multichain, yield
strategy, Solana) — these are Gate 5 or Gate 7 items.</p></li>
<li><p>Operational (monitoring dashboards, incident response templates,
on-call rotation) — these are Governance deliverables, not developer
blockers.</p></li>
<li><p>Legal (regulatory classification, KYC/AML, jurisdiction
selection) — these are Legal deliverables, not developer
blockers.</p></li>
<li><p>External (audit findings, market feedback, commercial evidence) —
these are Gate 3 or Gate 6 evidence items.</p></li>
</ul>
<p>If the developer begins the first sprint with these four documents
and the Master Blueprint, and reports back honestly, the Committee will
know within 2–3 weeks whether any additional gaps exist. The first
sprint is itself the verification.<br />
What the developer must not do:</p>
<ul>
<li><p>Assume the four documents are sufficient without reading the
Master Blueprint.</p></li>
<li><p>Invent MASE, Mint/Redeem, Genesis, or Oracle addresses.</p></li>
<li><p>Skip Safe verification (OD-35) or Repository access
(OD-36).</p></li>
<li><p>Deploy to testnet without running T-01 through T-88 (or
documented subset).</p></li>
<li><p>Claim Gate 2 closure without the Layer 8 external specifications
integrated.</p></li>
</ul>
<p>The one sentence to carry away:<br />
The four documents plus the Master Blueprint are the complete
implementation input for Gate 2; the eight items above are the last
things a developer must obtain, verify, or confirm before that input is
usable.</p>
<p>End of Extension 3.</p></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
</tbody>
</table>
