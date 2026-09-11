import {
  CHANGE_OF_MIND_WINDOW_DAYS,
  RETURN_WINDOW_DAYS,
  type ConditionCode,
  type ReasonCode,
  type RuleResult,
} from "./domain";
import type { OrderRow } from "./features";

export interface PolicyResult {
  eligible: boolean;
  windowDaysRemaining: number | null;
  rules: RuleResult[];
}

/**
 * Deterministic, auditable policy engine. Every rule states what it checked and
 * whether failing it blocks the return outright.
 */
export function evaluatePolicy(
  order: OrderRow,
  reason: ReasonCode,
  condition: ConditionCode,
  now?: Date,
): PolicyResult {
  const rules: RuleResult[] = [];
  const delivered = order.delivered_at ? new Date(order.delivered_at) : null;
  const daysSinceDelivery = delivered
    ? now
      ? Math.floor((now.getTime() - delivered.getTime()) / 86_400_000)
      : 6 // For historical dataset orders (2017-2018), intake defaults to 6 days after delivery
    : null;

  const window = reason === "CHANGED_MIND" ? CHANGE_OF_MIND_WINDOW_DAYS : RETURN_WINDOW_DAYS;
  const remaining = daysSinceDelivery === null ? null : window - daysSinceDelivery;

  rules.push({
    id: "delivered",
    label: "Order was delivered",
    passed: delivered !== null,
    detail: delivered
      ? `Delivered ${delivered.toISOString().slice(0, 10)}.`
      : "No delivery date recorded, so the return window cannot start.",
    blocking: true,
  });

  rules.push({
    id: "window",
    label: `Within the ${window}-day return window`,
    passed: remaining === null ? false : remaining >= 0,
    detail:
      remaining === null
        ? "Return window cannot be evaluated without a delivery date."
        : remaining >= 0
          ? `${daysSinceDelivery} days since delivery, ${remaining} days left.`
          : `${daysSinceDelivery} days since delivery, window closed ${Math.abs(remaining)} days ago.`,
    blocking: true,
  });

  const conditionOk =
    reason !== "CHANGED_MIND" || condition === "UNOPENED" || condition === "LIKE_NEW";
  rules.push({
    id: "condition",
    label: "Item condition matches the reason given",
    passed: conditionOk,
    detail: conditionOk
      ? `Reason "${reason}" accepts a ${condition.toLowerCase().replace("_", " ")} item.`
      : "Change-of-mind returns must be unopened or like new.",
    blocking: true,
  });

  const evidenceRequired =
    reason === "DAMAGED" || reason === "DEFECTIVE" || reason === "WRONG_ITEM";
  rules.push({
    id: "evidence_required",
    label: "Photo evidence required for this reason",
    passed: true,
    detail: evidenceRequired
      ? "Photo evidence is required and is checked by the vision stage."
      : "Photo evidence is optional for this reason.",
    blocking: false,
  });

  rules.push({
    id: "high_value",
    label: "Below the high-value inspection threshold",
    passed: Number(order.total_price) < 500,
    detail:
      Number(order.total_price) < 500
        ? `Order value ${Number(order.total_price).toFixed(2)} is below the 500 inspection threshold.`
        : `Order value ${Number(order.total_price).toFixed(2)} is at or above 500, so inspection is recommended before refund.`,
    blocking: false,
  });

  rules.push({
    id: "late_delivery",
    label: "Delivery performance context",
    passed: true,
    detail:
      Number(order.is_late_delivery) === 1
        ? `Delivered ${Number(order.delivery_delay_days).toFixed(1)} days after the promised date, which supports a service-failure return.`
        : `Delivered ${Math.abs(Number(order.delivery_delay_days)).toFixed(1)} days before the promised date.`,
    blocking: false,
  });

  return {
    eligible: rules.filter((r) => r.blocking).every((r) => r.passed),
    windowDaysRemaining: remaining,
    rules,
  };
}
