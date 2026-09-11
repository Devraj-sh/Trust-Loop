import type { Signal } from "./domain";
import type { CustomerRow, OrderRow } from "./features";

export interface BehaviourResult {
  /** 0-1, higher means the account history looks more concerning. */
  behaviourScore: number;
  signals: Signal[];
}

/**
 * Account-history signals. These are descriptive facts drawn from the
 * customer's own order history, not accusations: each one states the number it
 * is based on so a reviewer can judge it.
 */
export function analyseBehaviour(customer: CustomerRow, order: OrderRow): BehaviourResult {
  const signals: Signal[] = [];
  const num = (v: unknown) => Number(v ?? 0);

  const lowRatingShare = num(customer.low_rating_percentage) / 100;
  signals.push({
    id: "low_ratings",
    label: "Low-rating history",
    value: `${lowRatingShare === 0 ? "0" : (lowRatingShare * 100).toFixed(0)}% of ${num(customer.total_reviews)} reviews`,
    weight: Math.min(1, lowRatingShare * 2),
    direction: lowRatingShare > 0.4 ? "risk" : lowRatingShare === 0 ? "trust" : "neutral",
    detail:
      lowRatingShare > 0.4
        ? "A large share of this customer's reviews are 1-2 stars."
        : "Review history is broadly positive.",
  });

  const tenure = num(customer.customer_lifetime_days);
  signals.push({
    id: "tenure",
    label: "Account tenure",
    value:
      num(customer.is_one_time_buyer) === 1
        ? "First recorded order"
        : `${tenure.toFixed(0)} days, ${num(customer.total_orders)} orders`,
    weight: num(customer.is_one_time_buyer) === 1 ? 0.45 : Math.max(0, 0.3 - tenure / 1000),
    direction: num(customer.is_one_time_buyer) === 1 ? "risk" : "trust",
    detail:
      num(customer.is_one_time_buyer) === 1
        ? "No prior purchase history to compare this claim against."
        : `Repeat customer with ${num(customer.total_orders)} orders and ${num(customer.total_spent).toFixed(2)} lifetime spend.`,
  });

  const orderValue = num(order.total_price);
  const avgValue = Math.max(1, num(customer.avg_order_value));
  const ratio = orderValue / avgValue;
  signals.push({
    id: "value_deviation",
    label: "Order value vs. their norm",
    value: `${ratio.toFixed(2)}x average`,
    weight: ratio > 3 ? Math.min(1, (ratio - 3) / 4 + 0.4) : 0.05,
    direction: ratio > 3 ? "risk" : "neutral",
    detail:
      ratio > 3
        ? "This order is far more valuable than this customer usually buys."
        : "Order value is in line with this customer's usual basket.",
  });

  const lateShare = num(customer.late_delivery_percentage) / 100;
  signals.push({
    id: "service_history",
    label: "Delivery experience",
    value: `${(lateShare * 100).toFixed(0)}% deliveries late`,
    weight: 0,
    direction: lateShare > 0.3 ? "trust" : "neutral",
    detail:
      lateShare > 0.3
        ? "This customer has repeatedly been let down on delivery, which makes a genuine complaint more likely."
        : "Delivery performance for this customer has been mostly on time.",
  });

  const recency = num(customer.days_since_last_order);
  signals.push({
    id: "recency",
    label: "Ordering recency",
    value: `${recency.toFixed(0)} days since last order`,
    weight: recency > 540 ? 0.2 : 0.02,
    direction: recency > 540 ? "risk" : "neutral",
    detail:
      recency > 540
        ? "The account has been dormant for a long period before this claim."
        : "The account has been recently active.",
  });

  const riskWeights = signals.filter((s) => s.direction === "risk").map((s) => s.weight);
  const trustOffset = signals.filter((s) => s.direction === "trust").length * 0.05;
  const raw = riskWeights.reduce((a, b) => a + b, 0) / Math.max(1, riskWeights.length || 1);
  const behaviourScore = Math.max(0, Math.min(1, raw - trustOffset));

  return { behaviourScore, signals };
}
