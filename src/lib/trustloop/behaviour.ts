import type { Signal } from "./domain";
import { formatCurrency } from "./domain";
import type { CustomerRow, OrderRow } from "./features";

export interface BehaviourResult {
  /** 0-1, higher means the account history looks more concerning. */
  behaviourScore: number;
  signals: Signal[];
}

/**
 * Account-history signals built from customer historical transactions.
 * These are descriptive facts drawn from the customer's own order history.
 */
export function analyseBehaviour(customer: CustomerRow, order: OrderRow): BehaviourResult {
  const signals: Signal[] = [];
  const num = (v: unknown) => Number(v ?? 0);

  // 1. Return Frequency Signal
  const retRate = num(customer.return_rate);
  const totalOrders = num(customer.total_orders);
  const totalReturns = num(customer.total_returns);
  signals.push({
    id: "return_frequency",
    label: "Historical return frequency",
    value: totalOrders > 0
      ? `${totalReturns} returns / ${totalOrders} orders (${(retRate * 100).toFixed(1)}%)`
      : "No order history",
    weight: retRate > 0.35 ? Math.min(0.9, (retRate - 0.35) * 1.5 + 0.3) : retRate <= 0.10 ? 0.2 : 0.05,
    direction: retRate > 0.35 ? "risk" : retRate <= 0.10 ? "trust" : "neutral",
    detail:
      retRate > 0.35
        ? `Customer has an elevated historical return rate of ${(retRate * 100).toFixed(1)}%.`
        : totalOrders > 1
        ? `Consistently low return rate (${(retRate * 100).toFixed(1)}%) across ${totalOrders} orders.`
        : "Initial purchase with no prior return history.",
  });

  // 2. Recent Return Velocity (Last 30 Days)
  const returns30 = num(customer.returns_last_30_days);
  const retVal30 = num(customer.return_value_last_30_days);
  if (returns30 > 0 || totalOrders > 1) {
    signals.push({
      id: "recent_returns",
      label: "30-day return velocity",
      value: `${returns30} returns in last 30d (${formatCurrency(retVal30)})`,
      weight: returns30 >= 3 ? 0.85 : returns30 >= 2 ? 0.5 : 0.05,
      direction: returns30 >= 2 ? "risk" : returns30 === 0 ? "trust" : "neutral",
      detail:
        returns30 >= 2
          ? `High frequency of recent claims: ${returns30} items returned in the past month.`
          : "Normal or zero return activity in the recent 30-day window.",
    });
  }

  // 3. Customer Account Tenure & Lifetime Value
  const tenure = num(customer.customer_lifetime_days);
  const isOneTime = num(customer.is_one_time_buyer) === 1 || totalOrders <= 1;
  signals.push({
    id: "tenure",
    label: "Account tenure & spend",
    value: isOneTime
      ? "First recorded purchase"
      : `${tenure.toFixed(0)} days tenure · ${formatCurrency(num(customer.total_spent))} spend`,
    weight: isOneTime ? 0.40 : Math.max(0, 0.3 - tenure / 1000),
    direction: isOneTime ? "risk" : "trust",
    detail: isOneTime
      ? "First-time buyer with no established purchasing pattern."
      : `Established customer with ${totalOrders} orders and ${formatCurrency(num(customer.total_spent))} total spend.`,
  });

  // 4. Order Value vs. Historical Basket Size
  const orderValue = num(order.total_price);
  const avgValue = Math.max(1, num(customer.avg_order_value));
  const ratio = orderValue / avgValue;
  signals.push({
    id: "value_deviation",
    label: "Order value vs. customer norm",
    value: `${ratio.toFixed(2)}x average (${formatCurrency(orderValue)} vs ${formatCurrency(avgValue)})`,
    weight: ratio > 2.5 ? Math.min(0.9, (ratio - 2.5) / 3 + 0.3) : 0.05,
    direction: ratio > 2.5 ? "risk" : "neutral",
    detail:
      ratio > 2.5
        ? `This order is significantly higher than this customer's typical purchase (${formatCurrency(avgValue)}).`
        : "Order value is consistent with the customer's typical purchasing basket.",
  });

  // 5. Customer Rating Profile
  const lowRatingCount = num(customer.low_rating_count);
  const avgRating = num(customer.avg_customer_rating || 4.2);
  signals.push({
    id: "rating_history",
    label: "Review profile",
    value: `${avgRating.toFixed(1)}/5.0 avg · ${lowRatingCount} low ratings`,
    weight: lowRatingCount >= 3 ? 0.35 : 0.05,
    direction: lowRatingCount >= 3 ? "risk" : avgRating >= 4.0 ? "trust" : "neutral",
    detail:
      lowRatingCount >= 3
        ? "History shows repeated low-rating dissatisfaction complaints."
        : "Customer maintains a broadly positive feedback history.",
  });

  // 6. Delivery Performance Context
  const avgDelivery = num(customer.avg_delivery_days || order.delivery_days || 4);
  signals.push({
    id: "delivery_experience",
    label: "Delivery experience",
    value: `${avgDelivery.toFixed(1)} days avg delivery`,
    weight: 0.02,
    direction: "neutral",
    detail: `Orders typically delivered in ~${avgDelivery.toFixed(0)} days for this account.`,
  });

  const riskWeights = signals.filter((s) => s.direction === "risk").map((s) => s.weight);
  const trustOffset = signals.filter((s) => s.direction === "trust").length * 0.06;
  const raw = riskWeights.reduce((a, b) => a + b, 0) / Math.max(1, riskWeights.length || 1);
  const behaviourScore = Math.max(0, Math.min(1, raw - trustOffset));

  return { behaviourScore, signals };
}
