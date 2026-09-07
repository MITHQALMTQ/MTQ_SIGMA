MTQ Σ — The Global Purchasing Power Unit

Status: ⚠️ TESTNET CANDIDATE — Not Production-Authorized.
Version: Σ-v1.2 (FINAL CLOSED-LOOP)
Date: 2026-09-04

What is MTQ Σ?

MTQ Σ (Mithqal) is a non-USD, multi-currency reference unit backed by a 110%+ collateralized reserve of stablecoins and tokenized gold.

Unlike traditional stablecoins that peg to a single fiat currency (like the USD), MTQ Σ is priced against the GFB Index—a fixed-quantity basket of the world's five major currencies (USD, EUR, GBP, JPY, CNY). This ensures the token maintains global purchasing power, independent of any single nation's monetary policy.

The Constitutional Separation

This protocol strictly separates three concepts that are often conflated:

Layer	Concept	Definition	Role
(A)	The Reference Index (GFB)	A pure mathematical definition of global purchasing power.	Defines the unit of account.
(B)	The Monetary Unit (MTQ Σ)	A token representing a claim to one GFB-Unit.	The transferable instrument.
(C)	The Reserve Portfolio (Collateral)	Assets held to back that obligation.	Provides the economic backing.
The Core Rule: The Index defines the value. The Reserve backs the token. The token is a liability, not an index itself.

Key Features

Asset-Backed Reserve: Targets 110% collateralization with dynamic buffer layers (BASE, STRESS, EMERGENCY).
Smart Rebalancing Engine: Uses a cost-benefit optimization function with liquidity-aware sizing.
Multi-Source Oracle Architecture: Aggregates Chainlink, Pyth, and Chronicle with strict timestamp, confidence, and deviation checks.
Geopolitical Eject Mechanism: Staged liquidation (10% → 25% → 50% → 100%) with a reintegration score to prevent gaming.
Six-State Risk Management: NORMAL → CAUTION → STRESS → DEFENSIVE → EMERGENCY → RECOVERY.
Four-Layer Governance: Constitutional (7/7), Monetary (DAO 51%), Risk (4/7), and Emergency (4/7) Multi-Sigs.
Sharia-Ready Design: Interest-free, asset-backed, and non-speculative by architecture (certification pending).
Current Status: Public Testnet

This repository contains the Source of Truth Blueprint v1.2.

Deployed on: Arc, Monad, and Solana Devnet.
Oracles & Assets: Currently simulated for testing purposes.
Production Authorization: ❌ NOT GRANTED.
Mainnet deployment requires passing 11 independent validation gates, including:

Smart Contract Audit (Top-tier firm).
Independent Model Validation.
Sharia Certification (AAOIFI-qualified board).
Institutional Review.
30-day Community Stress Test.
Mathematical Anchor

The GFB Index formula ensures absolute transparency:

G
F
B
t
=
q
U
S
D
⋅
1.00
+
q
E
U
R
⋅
F
X
E
U
R
/
U
S
D
,
t
+
q
G
B
P
⋅
F
X
G
B
P
/
U
S
D
,
t
+
q
J
P
Y
⋅
F
X
J
P
Y
/
U
S
D
,
t
+
q
C
N
Y
⋅
F
X
C
N
Y
/
U
S
D
,
t
q
U
S
D
⋅
1.00
+
q
E
U
R
⋅
F
X
E
U
R
/
U
S
D
,
b
a
s
e
+
q
G
B
P
⋅
F
X
G
B
P
/
U
S
D
,
b
a
s
e
+
q
J
P
Y
⋅
F
X
J
P
Y
/
U
S
D
,
b
a
s
e
+
q
C
N
Y
⋅
F
X
C
N
Y
/
U
S
D
,
b
a
s
e
GFB 
t
​	
 = 
q 
USD
​	
 ⋅1.00+q 
EUR
​	
 ⋅FX 
EUR/USD,base
​	
 +q 
GBP
​	
 ⋅FX 
GBP/USD,base
​	
 +q 
JPY
​	
 ⋅FX 
JPY/USD,base
​	
 +q 
CNY
​	
 ⋅FX 
CNY/USD,base
​	
 
q 
USD
​	
 ⋅1.00+q 
EUR
​	
 ⋅FX 
EUR/USD,t
​	
 +q 
GBP
​	
 ⋅FX 
GBP/USD,t
​	
 +q 
JPY
​	
 ⋅FX 
JPY/USD,t
​	
 +q 
CNY
​	
 ⋅FX 
CNY/USD,t
​	
 
​	
 

Fixed Basket Quantities (per 1 MTQ Unit):

USD: 0.3890 (38.90%)
EUR: 0.2780 (27.80%)
GBP: 0.1669 (16.69%)
JPY: 0.1111 (11.11%)
CNY: 0.0550 (5.50%)
Technology Stack

Languages: Solidity (EVM) / Rust (Solana)
Networks: Arc, Monad, Solana (Testnet)
Oracles: Chainlink, Pyth Network, Chronicle Protocol
DEX Aggregators: 1inch, Paraswap
Governance: Gnosis Safe (4/7 & 7/7 Multi-Sig), DAO
Private Mempool: Flashbots Protect
Documentation

The full Source of Truth Blueprint contains complete mathematical specifications, Solidity/Rust implementations, and the complete governance framework (Sections 1–16 of the v1.2 specification).

License & Contact

Code: MIT
Documentation: CC BY-SA 4.0
Contact: meltonsy@icloud.com
