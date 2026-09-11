import type { FeatureVector } from "@/lib/ml/engine";

export interface OrderRow {
  id: string;
  external_id: string;
  category_code: number;
  purchased_at: string;
  delivered_at: string | null;
  estimated_delivery_at: string | null;
  num_items: number;
  total_price: number;
  avg_item_price: number;
  total_freight: number;
  freight_ratio: number;
  price_segment: number;
  review_score: number;
  has_review_comment: number;
  actual_delivery_days: number;
  estimated_delivery_days: number;
  delivery_delay_days: number;
  is_late_delivery: number;
  purchase_month: number;
  purchase_day_of_week: number;
}

export interface CustomerRow {
  id: string;
  external_id: string;
  city: string;
  city_code: number;
  state: string;
  state_code: number;
  total_orders: number;
  total_items_purchased: number;
  avg_items_per_order: number;
  total_spent: number;
  avg_order_value: number;
  total_freight: number;
  freight_to_value_ratio: number;
  total_reviews: number;
  avg_review_score: number;
  low_rating_count: number;
  high_rating_count: number;
  low_rating_percentage: number;
  avg_delivery_days: number;
  late_deliveries: number;
  late_delivery_percentage: number;
  days_since_last_order: number;
  customer_lifetime_days: number;
  is_one_time_buyer: number;
}

export interface CategoryRow {
  code: number;
  name: string;
  avg_rating: number;
  complaint_rate: number;
  dissatisfaction_rate: number;
  low_rating_pct: number;
}

const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

/**
 * Assemble the exact 41-column feature vector the models were trained on.
 * Column names and ordering come from the exported feature_columns artifact.
 */
export function buildFeatureVector(
  order: OrderRow,
  customer: CustomerRow,
  category: CategoryRow,
): FeatureVector {
  return {
    customer_city: n(customer.city_code),
    customer_state: n(customer.state_code),
    num_items: n(order.num_items),
    total_price: n(order.total_price),
    avg_item_price: n(order.avg_item_price),
    price_segment: n(order.price_segment),
    total_freight: n(order.total_freight),
    freight_ratio: n(order.freight_ratio),
    product_category: n(order.category_code),
    review_score: n(order.review_score),
    has_review_comment: n(order.has_review_comment),
    actual_delivery_days: n(order.actual_delivery_days),
    estimated_delivery_days: n(order.estimated_delivery_days),
    delivery_delay_days: n(order.delivery_delay_days),
    is_late_delivery: n(order.is_late_delivery),
    total_orders: n(customer.total_orders),
    total_items_purchased: n(customer.total_items_purchased),
    avg_items_per_order: n(customer.avg_items_per_order),
    total_spent: n(customer.total_spent),
    avg_order_value: n(customer.avg_order_value),
    total_freight_cust: n(customer.total_freight),
    freight_to_value_ratio: n(customer.freight_to_value_ratio),
    total_reviews: n(customer.total_reviews),
    avg_review_score: n(customer.avg_review_score),
    low_rating_count: n(customer.low_rating_count),
    high_rating_count: n(customer.high_rating_count),
    low_rating_percentage: n(customer.low_rating_percentage),
    avg_delivery_days: n(customer.avg_delivery_days),
    late_deliveries: n(customer.late_deliveries),
    late_delivery_percentage: n(customer.late_delivery_percentage),
    days_since_last_order: n(customer.days_since_last_order),
    customer_lifetime_days: n(customer.customer_lifetime_days),
    is_one_time_buyer: n(customer.is_one_time_buyer),
    category_complaint_rate: n(category.complaint_rate),
    category_dissatisfaction_rate: n(category.dissatisfaction_rate),
    category_avg_rating: n(category.avg_rating),
    category_low_rating_pct: n(category.low_rating_pct),
    purchase_month: n(order.purchase_month),
    purchase_day_of_week: n(order.purchase_day_of_week),
    delay_freight_cross: n(order.delivery_delay_days) * n(order.freight_ratio),
    review_delay_cross: n(order.review_score) * n(order.delivery_delay_days),
  };
}

/** Human-readable labels for the model's feature names. */
export const FEATURE_LABELS: Record<string, string> = {
  customer_city: "Customer city",
  customer_state: "Customer state",
  num_items: "Items in order",
  total_price: "Order value",
  avg_item_price: "Average item price",
  price_segment: "Price segment",
  total_freight: "Shipping cost",
  freight_ratio: "Shipping as share of order",
  product_category: "Product category",
  review_score: "Order review score",
  has_review_comment: "Left a written review",
  actual_delivery_days: "Actual delivery days",
  estimated_delivery_days: "Promised delivery days",
  delivery_delay_days: "Days early / late",
  is_late_delivery: "Delivered late",
  total_orders: "Lifetime orders",
  total_items_purchased: "Lifetime items",
  avg_items_per_order: "Average basket size",
  total_spent: "Lifetime spend",
  avg_order_value: "Average order value",
  total_freight_cust: "Lifetime shipping paid",
  freight_to_value_ratio: "Lifetime shipping ratio",
  total_reviews: "Reviews left",
  avg_review_score: "Average review score",
  low_rating_count: "1-2 star reviews",
  high_rating_count: "4-5 star reviews",
  low_rating_percentage: "Share of low ratings",
  avg_delivery_days: "Average delivery days",
  late_deliveries: "Late deliveries",
  late_delivery_percentage: "Share of late deliveries",
  days_since_last_order: "Days since last order",
  customer_lifetime_days: "Customer lifetime (days)",
  is_one_time_buyer: "One-time buyer",
  category_complaint_rate: "Category complaint rate",
  category_dissatisfaction_rate: "Category dissatisfaction rate",
  category_avg_rating: "Category average rating",
  category_low_rating_pct: "Category low-rating share",
  purchase_month: "Purchase month",
  purchase_day_of_week: "Purchase weekday",
  delay_freight_cross: "Delay x shipping ratio",
  review_delay_cross: "Review x delay",
};

export function featureLabel(name: string): string {
  return FEATURE_LABELS[name] ?? name;
}
