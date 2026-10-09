/** Shared TrustLoop domain vocabulary (client-safe). */

export const REASON_CODES = [
  { code: "DAMAGED", label: "Arrived damaged" },
  { code: "DEFECTIVE", label: "Faulty / not working" },
  { code: "WRONG_ITEM", label: "Wrong item sent" },
  { code: "NOT_AS_DESCRIBED", label: "Not as described" },
  { code: "SIZE_FIT", label: "Size or fit" },
  { code: "LATE_DELIVERY", label: "Arrived too late" },
  { code: "CHANGED_MIND", label: "Changed my mind" },
] as const;

export type ReasonCode = (typeof REASON_CODES)[number]["code"];

export const CONDITIONS = [
  { code: "UNOPENED", label: "Unopened, sealed" },
  { code: "LIKE_NEW", label: "Opened, like new" },
  { code: "USED", label: "Used" },
  { code: "DAMAGED", label: "Damaged" },
] as const;

export type ConditionCode = (typeof CONDITIONS)[number]["code"];

export type DecisionOutcome = "AUTO_APPROVE" | "MANUAL_REVIEW" | "REFUND_ON_INSPECTION" | "DECLINE";

export const DECISION_LABELS: Record<DecisionOutcome, string> = {
  AUTO_APPROVE: "Auto-approve refund",
  MANUAL_REVIEW: "Send to human review",
  REFUND_ON_INSPECTION: "Refund after inspection",
  DECLINE: "Decline request",
};

export const DECISION_TONE: Record<
  DecisionOutcome,
  "positive" | "caution" | "critical" | "neutral"
> = {
  AUTO_APPROVE: "positive",
  MANUAL_REVIEW: "caution",
  REFUND_ON_INSPECTION: "neutral",
  DECLINE: "critical",
};

/** Return window used by the policy engine, in days from delivery. */
export const RETURN_WINDOW_DAYS = 30;
/** Change-of-mind returns get a shorter window. */
export const CHANGE_OF_MIND_WINDOW_DAYS = 14;

export interface RuleResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  blocking: boolean;
}

export interface Signal {
  id: string;
  label: string;
  value: string;
  weight: number;
  direction: "risk" | "trust" | "neutral";
  detail: string;
}

export interface EvidenceItem {
  source: "ml" | "policy" | "vision" | "behaviour" | "network" | "geo" | "cross_merchant";
  label: string;
  verdict: string;
  /** 0-1, where 1 means "fully supports approving the return as claimed". */
  support: number;
  weight: number;
  detail: string;
  available: boolean;
}

export interface LayeredAdjustment {
  source: "network" | "geography" | "evidence" | "cross_merchant";
  title: string;
  points: number;
  reason: string;
  capped: boolean;
}

export interface InvestigationScoreResult {
  baseTrustScore: number;
  networkAdjustment: number;
  geoAdjustment: number;
  evidenceAdjustment: number;
  finalInvestigationScore: number; // 0-100
  investigationPriority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  adjustments: LayeredAdjustment[];
  flaggedReasons: string[];
}

export interface Conflict {
  id: string;
  label: string;
  detail: string;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}
