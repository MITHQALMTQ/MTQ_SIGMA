# MTQΣ — Sharia Compliance Note

## Decision: Reserve Yield Module (R4) Excluded

The "Reserve Yield" module (competitive analysis R4) proposed integrating with Aave V3
to earn 3-5% APY on the reserve's stablecoin holdings (USDC/USDP/USDT).

**This module has been deliberately EXCLUDED** because:

1. **Riba (Interest) Prohibition**: Aave's lending model involves earning interest on deposits.
   In Islamic finance, earning interest (Riba) is strictly prohibited (Quran 2:275-279).
   Even if the reserve (not individual users) earns the interest, the protocol would be
   complicit in an interest-bearing system.

2. **Sharia-Compliant Alternatives**: Instead of Aave lending, the protocol can explore:
   - **Murabaha (cost-plus financing)**: The reserve could purchase assets and sell them
     at a markup (profit-sharing, not interest)
   - **Ijarah (leasing)**: The reserve could lease physical assets (gold custody, etc.)
   - **Sukuk (Islamic bonds)**: The reserve could invest in Sharia-compliant bonds
   - **Profit-sharing (Mudaraba)**: The protocol could enter profit-sharing arrangements
     with DeFi protocols that use profit-and-loss sharing (not fixed interest)

3. **Protocol Position**: MTQΣ is designed for Sharia review (§2.8 of the blueprint).
   The protocol does NOT charge or pay interest. The mint/redeem fees are transactional
   fees (service charges), not interest. The exclusion of the yield module maintains
   this Sharia-compliant posture.

4. **Honest Status**: This exclusion is documented in the Honest Status system. The
   "Reserve Yield" feature is listed as SPECIFIED_ONLY — it was considered but not
   implemented for Sharia compliance reasons.
