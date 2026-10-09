import type { FeatureVector } from "@/lib/ml/engine";

export interface OrderRow {
  id: string;
  external_id: string;
  category_code: number;
  customer_id?: string;
  customer_name?: string;
  product_name?: string;
  brand?: string;
  evidence_image_url?: string | null;
  purchased_at: string;
  delivered_at?: string | null;
  num_items?: number;
  total_price: number; // Final amount in INR
  original_price?: number;
  discount_percent?: number;
  avg_item_price?: number;
  customer_rating?: number;
  review_score?: number; // legacy alias for rating
  delivery_days?: number;
  actual_delivery_days?: number;
  payment_method?: string;
  is_prime_member?: number;
  is_festival_sale?: number;
  festival_name?: string;
  return_status?: string;
  return_reason?: string | null;
  order_month?: number;
  purchase_month?: number;
  purchase_day_of_week?: number;
}

export interface CustomerRow {
  id: string;
  external_id: string;
  customer_name?: string;
  city: string;
  city_code: number;
  state: string;
  state_code: number;
  is_prime_member?: number;
  age_group?: string;
  spending_tier?: string;
  total_orders: number;
  total_spent: number;
  avg_order_value: number;
  total_returns: number;
  return_rate: number;
  average_discount?: number;
  avg_delivery_days: number;
  avg_customer_rating?: number;
  low_rating_count: number;
  days_since_last_order: number;
  customer_lifetime_days: number;
  is_one_time_buyer: number;
  orders_last_7_days?: number;
  orders_last_30_days?: number;
  returns_last_7_days?: number;
  returns_last_30_days?: number;
  return_value_last_30_days?: number;
  previous_return_count?: number;
  previous_return_rate?: number;
  past_orders?: any[];
}

export interface CategoryRow {
  code: number;
  name: string;
  avg_rating: number;
  complaint_rate: number;
  dissatisfaction_rate: number;
  low_rating_pct: number;
}

const n = (v: unknown, fallback = 0) => {
  const num = typeof v === "number" ? v : Number(v ?? fallback);
  return Number.isFinite(num) ? num : fallback;
};

/**
 * Assemble the exact 38-column Indian feature vector.
 * Completely free of Olist-specific fields (freight, delay days, etc.)
 */
export function buildFeatureVector(
  order: OrderRow,
  customer: CustomerRow,
  category: CategoryRow,
): FeatureVector {
  const orderAmt = n(order.total_price);
  const origPrice = n(order.original_price ?? orderAmt);
  const discPct = n(order.discount_percent);
  const delivDays = n(order.delivery_days ?? order.actual_delivery_days ?? 5);
  const rating = n(order.customer_rating ?? order.review_score ?? 4.0);
  const prime = n(order.is_prime_member ?? customer.is_prime_member ?? 0);
  const festival = n(order.is_festival_sale ?? 0);

  const prevRetRate = n(customer.previous_return_rate ?? (customer.total_returns > 0 ? (customer.total_returns - 1) / Math.max(1, customer.total_orders - 1) : 0));
  const avgSpend = n(customer.avg_order_value || (customer.total_orders > 0 ? customer.total_spent / customer.total_orders : orderAmt) || orderAmt || 1);
  const valRatio = orderAmt / Math.max(1, avgSpend);

  const purchDate = order.purchased_at ? new Date(order.purchased_at) : new Date();
  const month = n(order.order_month ?? order.purchase_month ?? purchDate.getMonth() + 1);
  const dow = n(order.purchase_day_of_week ?? purchDate.getDay());

  return {
    order_amount: orderAmt,
    original_price: origPrice,
    discount_percent: discPct,
    delivery_days: delivDays,
    customer_rating: rating,
    is_prime_member: prime,
    is_festival_sale: festival,
    category_code: n(order.category_code),
    customer_city_code: n(customer.city_code),
    customer_state_code: n(customer.state_code),
    order_month: month,
    order_day_of_week: dow,
    total_orders: n(customer.total_orders, 1),
    total_spent: n(customer.total_spent, orderAmt),
    avg_order_value: avgSpend,
    total_returns: n(customer.total_returns, 0),
    return_rate: n(customer.return_rate, 0),
    average_discount: n(customer.average_discount, discPct),
    avg_delivery_days: n(customer.avg_delivery_days, delivDays),
    avg_customer_rating: n(customer.avg_customer_rating, rating),
    low_rating_count: n(customer.low_rating_count, 0),
    days_since_last_order: n(customer.days_since_last_order, 30),
    customer_lifetime_days: n(customer.customer_lifetime_days, 0),
    is_one_time_buyer: n(customer.is_one_time_buyer, 1),
    orders_last_7_days: n(customer.orders_last_7_days, 0),
    orders_last_30_days: n(customer.orders_last_30_days, 0),
    returns_last_7_days: n(customer.returns_last_7_days, 0),
    returns_last_30_days: n(customer.returns_last_30_days, 0),
    return_value_last_30_days: n(customer.return_value_last_30_days, 0),
    previous_return_count: n(customer.previous_return_count, 0),
    previous_return_rate: prevRetRate,
    value_to_avg_spend_ratio: valRatio,
    category_complaint_rate: n(category.complaint_rate, 0.14),
    category_dissatisfaction_rate: n(category.dissatisfaction_rate, 0.16),
    category_avg_rating: n(category.avg_rating, 4.2),
    category_low_rating_pct: n(category.low_rating_pct, 12.0),
    discount_return_cross: discPct * prevRetRate,
    rating_delivery_cross: rating * delivDays,
  };
}

/** Human-readable labels for the Indian e-commerce feature set. */
export const FEATURE_LABELS: Record<string, string> = {
  order_amount: "Order Amount (INR)",
  original_price: "Original Price (INR)",
  discount_percent: "Discount Percentage",
  delivery_days: "Delivery Days",
  customer_rating: "Customer Rating",
  is_prime_member: "Prime Member Status",
  is_festival_sale: "Festival Sale Order",
  category_code: "Product Category",
  customer_city_code: "Customer City",
  customer_state_code: "Customer State",
  order_month: "Order Month",
  order_day_of_week: "Order Day of Week",
  total_orders: "Historical Orders",
  total_spent: "Total Historical Spend (INR)",
  avg_order_value: "Average Order Value (INR)",
  total_returns: "Total Historical Returns",
  return_rate: "Historical Return Rate",
  average_discount: "Average Historical Discount",
  avg_delivery_days: "Average Delivery Days",
  avg_customer_rating: "Average Customer Rating",
  low_rating_count: "1-2 Star Reviews Count",
  days_since_last_order: "Days Since Last Order",
  customer_lifetime_days: "Customer Lifetime (Days)",
  is_one_time_buyer: "One-Time Buyer Status",
  orders_last_7_days: "Orders in Last 7 Days",
  orders_last_30_days: "Orders in Last 30 Days",
  returns_last_7_days: "Returns in Last 7 Days",
  returns_last_30_days: "Returns in Last 30 Days",
  return_value_last_30_days: "Return Amount in Last 30 Days (INR)",
  previous_return_count: "Previous Return Count",
  previous_return_rate: "Previous Return Rate",
  value_to_avg_spend_ratio: "Current Order vs. Avg Spend Ratio",
  category_complaint_rate: "Category Complaint Rate",
  category_dissatisfaction_rate: "Category Dissatisfaction Rate",
  category_avg_rating: "Category Average Rating",
  category_low_rating_pct: "Category Low-Rating Share",
  discount_return_cross: "Discount x Return Frequency Interaction",
  rating_delivery_cross: "Rating x Delivery Speed Interaction",
};

export function featureLabel(name: string): string {
  return FEATURE_LABELS[name] ?? name.replace(/_/g, " ");
}
