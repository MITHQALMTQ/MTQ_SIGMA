// GET /api/mandate
//
// MTQΣ Single Source of Truth v5.0 + Ext-1 + Ext-2 + Ext-3 — mandate
// compliance snapshot for the Pilot Command Center Validation section.
//
// Returns:
//   • Authorization status (v5.0 §0.3 / §11.2 — production trading NOT authorized)
//   • Listing self-test results (T-01..T-11, T-45, T-47, T-50, T-51, T-53, T-71)
//   • The corrected 21-step pipeline demonstrated end-to-end in shadow mode
//   • Genesis 7-step sequence result (OD-33)
//   • OD-1..38 / C-001..040 / T-01..88 registers with honest status labels
//   • Rollup counts

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
import {
  runMandateSelfTests,
  runMarpPipeline,
  ECONOMIC_ELIGIBILITY_ENABLED,
  JS_OBJECTIVE_VERSION,
  PROTECTION_MODEL_VERSION,
  THRESHOLD_POLICY,
  MTQ_NOT_USD_PEGGED,
  NUMERAIRE_CONVENTION,
  type PipelineInputs,
} from "@/lib/mtq/mandate";
import { executeGenesisSequence, GENESIS_RESERVE_SAFE } from "@/lib/mtq/genesis";
import {
  OPEN_DECISIONS,
  CONFLICT_REGISTER,
  TEST_MATRIX,
  registerRollups,
} from "@/lib/mtq/mandate-register";
import { getOracleFeedSummary } from "@/lib/mtq/oracle-feeds";

export const dynamic = "force-dynamic";

function e18(x: number): bigint {
  return BigInt(Math.round(x * 1e9)) * 10n ** 9n;
}

/** Load the 2026-10-19 OD-35 live-verification evidence (read-only file) and
 *  project it to a compact API object. Returns null if the evidence file is
 *  absent (the UI then honestly shows "evidence unavailable"). */
async function loadSafeVerification() {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "audit-work", "v5", "safe-verification.json"),
      "utf-8",
    );
    const j = JSON.parse(raw) as {
      generatedAt: string;
      safeAddress: string;
      expectedConfiguration?: unknown;
      chains: Record<string, {
        name: string;
        blockNumber: number;
        verdict: string;
        verdictDetail?: string;
        safeFindings: {
          codeBytes: number;
          threshold: string;
          ownersCount: number;
          owners: string[];
          version: string;
          nonce: string;
          modulesCount: number;
          guardIsZero: boolean;
          singleton: string;
        };
      }>;
    };
    const chains: Record<string, unknown> = {};
    for (const [key, c] of Object.entries(j.chains)) {
      chains[key] = {
        name: c.name,
        blockNumber: c.blockNumber,
        verdict: c.verdict,
        verdictDetail: c.verdictDetail,
        findings: c.safeFindings,
      };
    }
    return {
      safeAddress: j.safeAddress,
      generatedAt: j.generatedAt,
      expected: "threshold 4 of 7 Constitutional signers (v5.0 §1.4 reported posture)",
      chains,
      evidence: "audit-work/v5/SAFE-VERIFICATION.md + safe-verification.json (read-only eth_call / eth_getCode; script scripts/verify-safe.ts)",
    };
  } catch {
    return null;
  }
}

/** OD-37 / T-88 token-standard evidence (contracts/TOKEN-STANDARD.md). */
const TOKEN_STANDARD = {
  od: "OD-37",
  test: "T-88",
  standard: "ERC-20 + EIP-2612 Permit + ERC-20 Votes/Snapshots (IERC-5805/IERC-6372)",
  posture: {
    transferRestrictions: "none (per Ext-3 A.7; subject to legal review)",
    supplyCap: "none initially — cap policy remains OD-29 OPEN",
    upgradeability: "NOT upgradeable — Option A (UPGRADEABILITY.md)",
  },
  implementation: "inline in contracts/MTQSigmaV3.sol §1.b (permit + nonces + DOMAIN_SEPARATOR; Checkpoint-based delegate/delegateBySig/getVotes/getPastVotes/getPastTotalSupply)",
  compile: {
    compiler: "solcjs 0.8.36",
    optimizerRuns: 200,
    zeroErrors: true,
    storageLayoutUnchanged: true,
    appendedSlots: 4,
  },
  eip170: {
    runtimeBytes: 40_500,
    limitBytes: 24_576,
    exceeded: true,
    note: "PRE-EXISTING: V3 runtime was already 36,706 B before permit+votes (+3,705) and before the Ext-3 A.3 on-chain verifyIndexBase() view (+89). Committee must split modules or otherwise mitigate before deploy.",
  },
  deployedOnChain: false,
  doc: "contracts/TOKEN-STANDARD.md",
};

export async function GET(req: Request) {
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "health");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rl.resetAt },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  try {
    // 1. Listing self-tests (run live on every request — reproducible evidence).
    const selfTests = runMandateSelfTests();

    // 2. Demonstrate the corrected 21-step pipeline in SHADOW MODE on a
    //    representative underweight-buy scenario (I(q) > 0, direction correct).
    const now = Date.now();
    const pipelineInputs: PipelineInputs = {
      now,
      chainId: "10143",
      component: "Gold",
      observedW: e18(0.23),      // underweight vs 26% target
      targetW: e18(0.26),
      deltaW: e18(0.015),        // buy +1.5% weight
      navE18: e18(1_100_000),
      tradeValueE18: e18(16_500),
      quote: { priceE18: e18(2614), createdAt: now - 5_000, route: "USDC→PAXG (aggregator multi-hop)", embeddedFeeE18: e18(16.5) },
      gas: { gasUnits: 250_000n, gasPriceWei: 30n * 10n ** 9n, nativeUsdPriceE18: e18(3.2) },
      oracle: {
        sourceAgesMs: [4_000, 8_000, 12_000],
        stalenessThresholdMs: 60_000,
        deviationsFromMedian: [0.001, 0.002, 0.0015],
        confidenceMultiples: [1.0, 1.1, 0.9],
        independentSourceFamilies: 3,
      },
      oracleObservedAt: now - 8_000,
      sigmaShortHorizon: 0.14,
      liquidityDepth: 0.8,
      keeper: { primary: "0xKEEPER_PRIMARY", backup: "0xKEEPER_BACKUP", submitter: "0xKEEPER_SUBMITTER", emergency: "0xKEEPER_EMERGENCY", primaryLastSeenMs: now, emergencyModeActive: false },
      parameterSetHash: "0x" + "a7".repeat(32),
    };
    const pipeline = runMarpPipeline(pipelineInputs);

    // 3. Genesis 7-step sequence (OD-33 reference run).
    const genesis = executeGenesisSequence({
      USD: 1, EUR: 1.09, JPY: 0.0067, GBP: 1.27, CNY: 0.14, CHF: 1.13, XAU: 2614,
    });

    // 4. Registers + rollup.
    const rollups = registerRollups();

    // 5. Ext-3 external-specification evidence: OD-35 live Safe verification
    //    (2026-10-19), OD-34 per-chain oracle feed configuration, OD-37 token
    //    standard compile evidence.
    const safeVerification = await loadSafeVerification();
    const oracleFeeds = getOracleFeedSummary();

    return NextResponse.json({
      source: "MTQΣ Single Source of Truth v5.0+Ext1+Ext2+Ext3 — Mandate Reference Layer",
      fetchedAt: new Date().toISOString(),
      authorization: {
        testnetActivity: "AUTHORIZED",
        productionReserveTrading: "NOT AUTHORIZED (Gate 6 required)",
        livePilot: "NOT AUTHORIZED (Gate 5 + written approval required)",
        economicEligibilityEnabled: ECONOMIC_ELIGIBILITY_ENABLED,
        shadowMode: "AUTHORIZED development scope (v5.0 §0.3) — decisions recorded, no reserve-fund movement",
        constitutional: {
          notUsdPegged: MTQ_NOT_USD_PEGGED,
          numeraireConvention: NUMERAIRE_CONVENTION,
        },
      },
      objectiveVersions: {
        jsTradeGate: JS_OBJECTIVE_VERSION,
        protectionModel: PROTECTION_MODEL_VERSION,
        thresholdPolicy: { absoluteUsd: 10, relativePct: 0.01, committeeDecision: THRESHOLD_POLICY.committeeDecision },
      },
      selfTests,
      selfTestsSummary: {
        total: selfTests.length,
        passed: selfTests.filter((t) => t.pass).length,
        failed: selfTests.filter((t) => !t.pass).length,
      },
      pipelineDemo: {
        scenario: "Gold underweight buy (0.23 → 0.245 vs 0.26 target)",
        decision: pipeline.decision,
        reason: pipeline.reason,
        shadowOnly: pipeline.shadowOnly,
        signedImprovement: Number(pipeline.signedImprovementE18) / 1e18,
        directionEligible: pipeline.directionEligible,
        grossBenefitUsd: Number(pipeline.grossBenefitE18) / 1e18,
        costUsd: Number(pipeline.costE18) / 1e18,
        protectionUsd: Number(pipeline.protectionE18) / 1e18,
        netBenefitUsd: Number(pipeline.netBenefitE18) / 1e18,
        thresholdUsd: 10,
        oracleHealth: pipeline.oracleHealth.level,
        steps: pipeline.steps,
        decisionRecord: {
          decisionId: pipeline.record.decisionId,
          objectiveVersion: pipeline.record.objectiveVersion,
          protectionModelVersion: pipeline.record.protectionModelVersion,
          thresholdPolicyStatus: pipeline.record.thresholdPolicyStatus,
          finalityState: pipeline.record.finalityState,
          statusLabel: pipeline.record.statusLabel,
          costItems: pipeline.record.costItems.map((c) => ({ kind: c.kind, quoteEmbedded: c.quoteEmbedded, source: c.source })),
        },
      },
      genesis: {
        ok: genesis.ok,
        steps: genesis.steps,
        safe: GENESIS_RESERVE_SAFE,
        basket: genesis.basketAllocations,
        indexBaseDenominator: genesis.indexBaseDenominator,
        verifyIndexBaseNote: "verifyIndexBase() supersedes the audit-flagged verifyGFBBase() — all SEVEN fixings checked (OD-33).",
      },
      safeVerification,
      oracleFeeds,
      tokenStandard: TOKEN_STANDARD,
      registers: {
        openDecisions: OPEN_DECISIONS,
        conflicts: CONFLICT_REGISTER,
        tests: TEST_MATRIX,
        rollups,
      },
    }, {
      headers: {
        "X-RateLimit-Remaining": String(rl.remaining),
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 503 },
    );
  }
}
