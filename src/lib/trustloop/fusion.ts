import type { Conflict, DecisionOutcome, EvidenceItem, ReasonCode } from "./domain";
import type { PolicyResult } from "./policy";
import type { BehaviourResult } from "./behaviour";
import type { VisionResult } from "./vision-types";
import type { ModelResult } from "@/lib/ml/engine";

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
}): FusionResult {
  const { model, policy, behaviour, vision, reason } = input;
  const evidence: EvidenceItem[] = [];

  evidence.push({
    source: "ml",
    label: `${model.modelLabel} return-risk model`,
    verdict: `${(model.riskScore * 100).toFixed(1)}% risk (${model.riskLevel})`,
    support: clamp(1 - model.riskScore),
    weight: 0.35,
    detail: `Trained on historical orders; top driver: ${model.contributions[0]?.feature ?? "n/a"}.`,
    available: true,
  });

  evidence.push({
    source: "policy",
    label: "Policy engine",
    verdict: policy.eligible ? "Eligible" : "Not eligible",
    support: policy.eligible ? 0.9 : 0,
    weight: 0.2,
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
      weight: vision.isFallback ? 0.1 : 0.3,
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

  return { trustScore: Math.round(trust * 100), agreement, evidence, conflicts };
}

export interface DecisionResult {
  outcome: DecisionOutcome;
  confidence: number;
  rationale: string[];
}

/** Explicit, inspectable decision policy. No hidden thresholds. */
export function decide(input: {
  fusion: FusionResult;
  policy: PolicyResult;
  model: { riskScore: number };
  vision: VisionResult | null;
  orderValue: number;
}): DecisionResult {
  const { fusion, policy, model, vision, orderValue } = input;
  const rationale: string[] = [];

  if (!policy.eligible) {
    rationale.push(
      `Blocked by policy — ${policy.rules
        .filter((r) => r.blocking && !r.passed)
        .map((r) => r.detail)
        .join(" ")}`,
    );
    if (fusion.trustScore >= 60) {
      rationale.push(
        "Evidence otherwise supports the customer, so a human should confirm before declining.",
      );
      return { outcome: "MANUAL_REVIEW", confidence: 0.6, rationale };
    }
    return { outcome: "DECLINE", confidence: 0.85, rationale };
  }

  if (fusion.conflicts.length > 0) {
    rationale.push(
      `Evidence sources disagree: ${fusion.conflicts.map((c) => c.label).join("; ")}.`,
    );
    return { outcome: "MANUAL_REVIEW", confidence: 0.5, rationale };
  }

  if (vision?.matchesClaim === false) {
    rationale.push("The submitted photo does not support the stated condition.");
    return { outcome: "MANUAL_REVIEW", confidence: 0.65, rationale };
  }

  if (orderValue >= 500) {
    rationale.push(
      `Order value ${orderValue.toFixed(2)} is at or above the 500 inspection threshold.`,
    );
    rationale.push(
      `Trust score ${fusion.trustScore}/100 with ${(fusion.agreement * 100).toFixed(0)}% source agreement.`,
    );
    return { outcome: "REFUND_ON_INSPECTION", confidence: 0.7, rationale };
  }

  if (fusion.trustScore >= 75 && model.riskScore < 0.3 && fusion.agreement >= 0.6) {
    rationale.push(`Trust score ${fusion.trustScore}/100 with all sources agreeing.`);
    rationale.push(
      `Model risk ${(model.riskScore * 100).toFixed(1)}% is below the 30% low-risk threshold.`,
    );
    return { outcome: "AUTO_APPROVE", confidence: 0.85, rationale };
  }

  if (fusion.trustScore < 35) {
    rationale.push(
      `Trust score ${fusion.trustScore}/100 with model risk ${(model.riskScore * 100).toFixed(1)}%.`,
    );
    rationale.push(
      "Evidence points away from a genuine claim, but a human confirms every decline.",
    );
    return { outcome: "MANUAL_REVIEW", confidence: 0.6, rationale };
  }

  rationale.push(
    `Trust score ${fusion.trustScore}/100 sits between the auto-approve and decline bands.`,
  );
  rationale.push(
    `Model risk ${(model.riskScore * 100).toFixed(1)}%, source agreement ${(fusion.agreement * 100).toFixed(0)}%.`,
  );
  return { outcome: "MANUAL_REVIEW", confidence: 0.55, rationale };
}
