import type {
  Conflict,
  DecisionOutcome,
  EvidenceItem,
  InvestigationScoreResult,
  LayeredAdjustment,
  ReasonCode,
} from "./domain";
export type { InvestigationScoreResult };
import type { PolicyResult } from "./policy";
import type { BehaviourResult } from "./behaviour";
import type { VisionResult } from "./vision-types";
import type { ModelResult } from "@/lib/ml/engine";
import type { NetworkRiskResult } from "./network";
import type { GeoAdjustmentResult } from "./geo";
import type { CrossMerchantEvidenceResult } from "./cross-merchant";

export interface FusionResult {
  /** 0-100. High means the evidence agrees that the claim is genuine. */
  trustScore: number;
  /** 0-1 measure of how much the evidence sources agree with each other. */
  agreement: number;
  evidence: EvidenceItem[];
  conflicts: Conflict[];
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function fuseEvidence(input: {
  model: ModelResult;
  policy: PolicyResult;
  behaviour: BehaviourResult;
  vision: VisionResult | null;
  reason: ReasonCode;
  network?: NetworkRiskResult | null;
  geo?: GeoAdjustmentResult | null;
  crossMerchant?: CrossMerchantEvidenceResult | null;
}): FusionResult {
  const { model, policy, behaviour, vision, reason, network, geo, crossMerchant } = input;
  const evidence: EvidenceItem[] = [];

  evidence.push({
    source: "ml",
    label: `${model.modelLabel} return-risk model`,
    verdict: `${(model.riskScore * 100).toFixed(1)}% risk (${model.riskLevel})`,
    support: clamp(1 - model.riskScore),
    weight: 0.30,
    detail: `Trained on historical orders; top driver: ${model.contributions[0]?.feature ?? "n/a"}.`,
    available: true,
  });

  evidence.push({
    source: "policy",
    label: "Policy engine",
    verdict: policy.eligible ? "Eligible" : "Not eligible",
    support: policy.eligible ? 0.9 : 0,
    weight: 0.15,
    detail:
      policy.rules
        .filter((r) => !r.passed)
        .map((r) => r.label)
        .join("; ") || "All blocking rules passed.",
    available: true,
  });

  evidence.push({
    source: "behaviour",
    label: "Account behaviour",
    verdict: `${(behaviour.behaviourScore * 100).toFixed(0)}% concern`,
    support: clamp(1 - behaviour.behaviourScore),
    weight: 0.15,
    detail:
      behaviour.signals
        .filter((s) => s.direction === "risk" && s.weight > 0.2)
        .map((s) => s.label)
        .join("; ") || "No elevated account signals.",
    available: true,
  });

  if (vision) {
    const support = vision.matchesClaim === null ? 0.5 : vision.matchesClaim ? 0.92 : 0.12;
    evidence.push({
      source: "vision",
      label: vision.isFallback ? "Image check (heuristic fallback)" : "Image analysis",
      verdict:
        vision.matchesClaim === null
          ? "Inconclusive"
          : vision.matchesClaim
            ? "Photo supports the claim"
            : "Photo does not support the claim",
      support,
      weight: vision.isFallback ? 0.1 : 0.20,
      detail: vision.summary,
      available: true,
    });
  } else {
    evidence.push({
      source: "vision",
      label: "Image analysis",
      verdict: "No photo submitted",
      support: 0.5,
      weight: 0,
      detail: "No evidence image was attached to this return.",
      available: false,
    });
  }

  // Network Evidence (TrustLoop 2.0)
  if (network) {
    const netWeight = network.ringId ? 0.15 : 0.05;
    evidence.push({
      source: "network",
      label: "Fraud ring intelligence",
      verdict: network.ringId
        ? `Linked to ${network.ringId} (${network.networkRisk}% risk)`
        : "Isolated account (low network risk)",
      support: clamp(1 - network.networkRisk / 100),
      weight: netWeight,
      detail: network.reasons[0] || "No shared network entities.",
      available: true,
    });
  }

  // Geo Hotspot Evidence (TrustLoop 2.0)
  if (geo) {
    evidence.push({
      source: "geo",
      label: "Regional hotspot intelligence",
      verdict: `${geo.areaName} (${geo.hotspotScore}/100, ${geo.riskTier})`,
      support: clamp(1 - geo.hotspotScore / 100),
      weight: 0.08,
      detail: geo.reason,
      available: true,
    });
  }

  // Cross-Merchant Consortium Evidence (UrbanBasket ⇄ NexaCart)
  if (crossMerchant?.hasCrossMerchantMatch && crossMerchant.riskLevel !== "CLEAN") {
    evidence.push({
      source: "cross_merchant",
      label: "Cross-merchant consortium intelligence",
      verdict: crossMerchant.verdict,
      support: crossMerchant.supportScore,
      weight: crossMerchant.weight,
      detail: crossMerchant.summary,
      available: true,
    });
  }

  const active = evidence.filter((e) => e.weight > 0);
  const totalWeight = active.reduce((a, e) => a + e.weight, 0) || 1;
  const trust = active.reduce((a, e) => a + e.support * e.weight, 0) / totalWeight;

  const mean = active.reduce((a, e) => a + e.support, 0) / active.length;
  const variance = active.reduce((a, e) => a + (e.support - mean) ** 2, 0) / active.length;
  const agreement = clamp(1 - Math.sqrt(variance) * 2);

  const conflicts: Conflict[] = [];
  if (vision?.matchesClaim === false && model.riskScore < 0.3) {
    conflicts.push({
      id: "vision_vs_model",
      label: "Photo contradicts a low model risk",
      detail:
        "The model sees a low-risk order, but the submitted photo does not match the stated condition.",
    });
  }
  if (vision?.matchesClaim === true && model.riskScore >= 0.6) {
    conflicts.push({
      id: "model_vs_vision",
      label: "Model risk contradicts supporting photo",
      detail:
        "The photo supports the claim while the historical model rates this order as high risk.",
    });
  }
  if (!policy.eligible && model.riskScore < 0.3) {
    conflicts.push({
      id: "policy_vs_model",
      label: "Policy blocks an otherwise low-risk claim",
      detail:
        "A blocking policy rule failed even though model and history look clean; a goodwill exception may apply.",
    });
  }
  if ((reason === "DAMAGED" || reason === "DEFECTIVE") && vision?.matchesClaim === false) {
    conflicts.push({
      id: "claim_vs_vision",
      label: "Customer claim contradicts visual evidence",
      detail:
        "Customer reported product damage or defect, but visual inspection detected no corroborating physical damage.",
    });
  }
  if ((reason === "DAMAGED" || reason === "DEFECTIVE") && !vision) {
    conflicts.push({
      id: "missing_evidence",
      label: "Damage claimed without a photo",
      detail: "This reason normally requires photo evidence, and none was provided.",
    });
  }

  // Network Conflict
  if (network?.ringId && model.riskScore < 0.35) {
    conflicts.push({
      id: "network_vs_model",
      label: "High network risk contradicts low individual model risk",
      detail: `The individual transaction appears normal, but the surrounding device/account graph is linked to fraud syndicate ${network.ringId}.`,
    });
  }

  // Cross-Merchant Conflict (Clean Local History on NexaCart vs Abusive History on UrbanBasket)
  if (crossMerchant?.hasCrossMerchantMatch && crossMerchant.riskLevel !== "CLEAN") {
    conflicts.push({
      id: "cross_merchant_vs_local_history",
      label: "Local clean history contradicts cross-merchant abuse pattern",
      detail: `Customer appears normal on ${crossMerchant.currentMerchant.name}, but consortium intelligence detected ${crossMerchant.matchedMerchant?.profile.totalReturns} suspicious returns (${(crossMerchant.matchedMerchant!.profile.returnRate * 100).toFixed(0)}% return rate) on ${crossMerchant.matchedMerchant?.name}.`,
    });
  }

  return { trustScore: Math.round(trust * 100), agreement, evidence, conflicts };
}

/**
 * TrustLoop 2.0 Layered Investigation Score Calculation
 * Final Investigation Score = Base ML Risk + Bounded Network Adjustment + Bounded Geo Adjustment + Evidence Adjustment + Cross-Merchant Adjustment
 */
export function calculateInvestigationScore(input: {
  baseTrustScore: number;
  modelRiskScore: number; // 0-1
  network?: NetworkRiskResult | null;
  geo?: GeoAdjustmentResult | null;
  crossMerchant?: CrossMerchantEvidenceResult | null;
  conflictsCount: number;
}): InvestigationScoreResult {
  const { baseTrustScore, modelRiskScore, network, geo, crossMerchant, conflictsCount } = input;
  const adjustments: LayeredAdjustment[] = [];
  const flaggedReasons: string[] = [];

  const baseRiskPoints = Math.round(modelRiskScore * 100);

  // 1. Network adjustment (capped at 25 points)
  let netAdj = 0;
  if (network && network.ringId) {
    netAdj = Math.min(25, network.adjustment || 20);
    adjustments.push({
      source: "network",
      title: "Network Ring Association",
      points: netAdj,
      reason: `${network.metrics.connectedAccounts} accounts connected through shared device infrastructure (${network.ringId}).`,
      capped: netAdj >= 25,
    });
    flaggedReasons.push(`Connected to suspicious return cluster (${network.ringId})`);
  }

  // 2. Geographic adjustment (capped at 15 points)
  let geoAdj = 0;
  if (geo && geo.hotspotScore >= 40) {
    geoAdj = Math.min(15, geo.adjustment || 8);
    adjustments.push({
      source: "geography",
      title: "Regional Return Hotspot",
      points: geoAdj,
      reason: `Return originated from an area with elevated normalized return-risk (${geo.areaName}).`,
      capped: geoAdj >= 15,
    });
    flaggedReasons.push(`Located in elevated return hotspot (${geo.areaName})`);
  }

  // 3. Evidence conflict adjustment (capped at 15 points)
  let evAdj = 0;
  if (conflictsCount > 0) {
    evAdj = Math.min(15, conflictsCount * 8);
    adjustments.push({
      source: "evidence",
      title: "Evidence Discrepancy",
      points: evAdj,
      reason: "Customer claim conflicts with visual evidence or policy expectations.",
      capped: evAdj >= 15,
    });
    flaggedReasons.push("Customer claim conflicts with visual evidence");
  }

  // 4. Cross-Merchant Consortium adjustment (capped at 25 points)
  let crossMerchantAdj = 0;
  if (crossMerchant?.hasCrossMerchantMatch && crossMerchant.riskLevel !== "CLEAN") {
    crossMerchantAdj = Math.min(25, crossMerchant.adjustmentPoints || 25);
    adjustments.push({
      source: "cross_merchant",
      title: "Cross-Merchant Abuse Flag",
      points: crossMerchantAdj,
      reason: crossMerchant.headline,
      capped: crossMerchantAdj >= 25,
    });
    flaggedReasons.push(crossMerchant.headline);
  }

  if (baseRiskPoints >= 50) {
    flaggedReasons.push(`Elevated baseline ML return risk (${baseRiskPoints}%)`);
  }

  const finalInvestigationScore = Math.min(
    100,
    Math.max(0, baseRiskPoints + netAdj + geoAdj + evAdj + crossMerchantAdj)
  );

  let investigationPriority: InvestigationScoreResult["investigationPriority"] = "LOW";
  if (finalInvestigationScore >= 75 || netAdj >= 20 || crossMerchantAdj >= 20) {
    investigationPriority = "CRITICAL";
  } else if (finalInvestigationScore >= 55) {
    investigationPriority = "HIGH";
  } else if (finalInvestigationScore >= 35) {
    investigationPriority = "MEDIUM";
  }

  return {
    baseTrustScore,
    networkAdjustment: netAdj,
    geoAdjustment: geoAdj,
    evidenceAdjustment: evAdj,
    finalInvestigationScore,
    investigationPriority,
    adjustments,
    flaggedReasons,
  };
}

export interface DecisionResult {
  outcome: DecisionOutcome;
  confidence: number;
  rationale: string[];
}

export function decide(input: {
  fusion: FusionResult;
  policy: PolicyResult;
  model: { riskScore: number };
  vision: VisionResult | null;
  orderValue: number;
  network?: NetworkRiskResult | null;
  geo?: GeoAdjustmentResult | null;
  crossMerchant?: CrossMerchantEvidenceResult | null;
  investigation?: InvestigationScoreResult | null;
  reason?: ReasonCode;
}): DecisionResult {
  const { fusion, policy, model, vision, orderValue, network, crossMerchant, investigation, reason } = input;
  const rationale: string[] = [];

  // 1. Hard Policy Blocking Violations (e.g. used item for change of mind, window closed)
  if (!policy.eligible) {
    const failedRules = policy.rules.filter((r) => r.blocking && !r.passed);
    rationale.push(
      `Blocked by merchant policy — ${failedRules.map((r) => r.detail).join(" ") || "Ineligible under return rules."}`,
    );
    return { outcome: "DECLINE", confidence: 0.9, rationale };
  }

  // 2. Fraud Ring / Coordinated Syndicate Interception
  if (network?.ringId && network.networkRisk >= 75) {
    rationale.push(
      `Flagged by Fraud Ring Intelligence: Linked to ${network.ringName || network.ringId} with ${network.networkRisk}/100 network risk.`,
    );
    rationale.push("Cross-account device/address sharing requires human fraud investigator triage.");
    return { outcome: "MANUAL_REVIEW", confidence: 0.90, rationale };
  }

  // 3. Cross-Merchant Consortium Interception (UrbanBasket ➔ NexaCart)
  if (crossMerchant?.hasCrossMerchantMatch && crossMerchant.riskLevel !== "CLEAN") {
    rationale.push(
      `Cross-Merchant Consortium Alert: ${crossMerchant.headline}`,
    );
    rationale.push(
      `Customer has ${crossMerchant.matchedMerchant?.profile.totalReturns} return claims (${(crossMerchant.matchedMerchant!.profile.returnRate * 100).toFixed(0)}% return rate) and ₹${crossMerchant.matchedMerchant?.profile.totalRefundAmount.toLocaleString()} in refund exposure on ${crossMerchant.matchedMerchant?.name}. Local clean history on ${crossMerchant.currentMerchant.name} is superseded by consortium evidence.`,
    );
    return { outcome: "REFUND_ON_INSPECTION", confidence: 0.92, rationale };
  }

  // 3. Evidence Conflicts (e.g. claim vs photo discrepancy)
  if (fusion.conflicts.length > 0) {
    rationale.push(
      `Evidence sources disagree: ${fusion.conflicts.map((c) => c.label).join("; ")}.`,
    );
    return { outcome: "MANUAL_REVIEW", confidence: 0.8, rationale };
  }

  if (vision?.matchesClaim === false) {
    rationale.push("The submitted physical photo contradicts the reported return claim.");
    return { outcome: "MANUAL_REVIEW", confidence: 0.8, rationale };
  }

  // 4. Physical Inspection Required (functional defects or high-ticket items >= ₹25,000)
  const isDefect = reason === "DEFECTIVE" || policy.rules.some((r) => r.detail?.toLowerCase().includes("defective"));
  const isHighValue = orderValue >= 25000;
  if (isDefect || isHighValue) {
    if (isDefect) {
      rationale.push(
        "Reported functional defect cannot be verified by exterior photos alone; warehouse bench testing mandated.",
      );
    }
    if (isHighValue) {
      rationale.push(
        `High-ticket order value (${orderValue.toFixed(2)}) is at or above the ₹25,000 threshold; physical intake inspection recommended prior to refund.`,
      );
    }
    rationale.push(
      `Trust score ${fusion.trustScore}/100 with ${(fusion.agreement * 100).toFixed(0)}% source agreement.`,
    );
    return { outcome: "REFUND_ON_INSPECTION", confidence: 0.75, rationale };
  }

  // 5. Automated Approval (Low ML risk, policy compliant, aligned evidence)
  if (
    fusion.trustScore >= 65 &&
    model.riskScore < 0.40 &&
    fusion.agreement >= 0.50 &&
    (!investigation || investigation.investigationPriority !== "CRITICAL")
  ) {
    rationale.push(`Trust score ${fusion.trustScore}/100 with all evidence sources agreeing.`);
    rationale.push(
      `Model return risk ${(model.riskScore * 100).toFixed(1)}% is well below the low-risk threshold.`,
    );
    rationale.push("Pre-approved for instant automated refund processing.");
    return { outcome: "AUTO_APPROVE", confidence: 0.88, rationale };
  }

  // 6. Elevated Risk Anomaly Band
  if (model.riskScore >= 0.60 || fusion.trustScore < 45 || (investigation && investigation.finalInvestigationScore >= 70)) {
    rationale.push(
      `Elevated risk profile: Model scored ${(model.riskScore * 100).toFixed(1)}% return risk (Investigation score ${investigation?.finalInvestigationScore ?? "elevated"}/100).`,
    );
    rationale.push(
      "Signals indicate potential return abuse; human investigator confirmation required.",
    );
    return { outcome: "MANUAL_REVIEW", confidence: 0.70, rationale };
  }

  // 7. Middle Band Review
  rationale.push(
    `Trust score ${fusion.trustScore}/100 sits between auto-approve and decline bands (Model risk ${(model.riskScore * 100).toFixed(1)}%).`,
  );
  return { outcome: "MANUAL_REVIEW", confidence: 0.55, rationale };
}
