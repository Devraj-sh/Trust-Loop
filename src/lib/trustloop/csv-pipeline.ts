import { buildFeatureVector, type CategoryRow, type CustomerRow, type OrderRow } from "./features";
import { runModel, runAllModels, type ModelResult, type MultiModelComparison } from "@/lib/ml/engine";
import { evaluatePolicy, type PolicyResult } from "./policy";
import { analyseBehaviour, type BehaviourResult } from "./behaviour";
import { decide, fuseEvidence, calculateInvestigationScore, type FusionResult, type InvestigationScoreResult, type DecisionResult } from "./fusion";
import { calculateGeoAdjustment, type GeoAdjustmentResult } from "./geo";
import type { ConditionCode, ReasonCode } from "./domain";
import categoriesSample from "./data/categories.json";

export interface CanonicalFieldDef {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
  description: string;
}

export const CANONICAL_FIELDS: CanonicalFieldDef[] = [
  {
    key: "order_id",
    label: "Order ID",
    required: true,
    aliases: [
      "order_id",
      "order_number",
      "order_no",
      "order id",
      "ord_id",
      "orderid",
      "invoice_no",
      "invoice_id",
      "order_ref",
      "order#",
    ],
    description: "Unique identifier for the order",
  },
  {
    key: "customer_id",
    label: "Customer ID",
    required: true,
    aliases: [
      "customer_id",
      "customer",
      "buyer_id",
      "user_id",
      "customer id",
      "cust_id",
      "buyerid",
      "client_id",
      "account_id",
      "buyer_number",
    ],
    description: "Unique identifier for the customer / buyer",
  },
  {
    key: "order_date",
    label: "Order Date",
    required: true,
    aliases: [
      "order_date",
      "date",
      "purchase_date",
      "transaction_date",
      "order date",
      "purchased_at",
      "created_at",
      "order_time",
      "booking_date",
    ],
    description: "Date when transaction occurred (YYYY-MM-DD or ISO)",
  },
  {
    key: "order_amount",
    label: "Amount (INR)",
    required: true,
    aliases: [
      "amount",
      "total",
      "price",
      "order_amount",
      "final_amount",
      "final_amount_inr",
      "total_amount",
      "order amount",
      "net_amount",
      "grand_total",
      "sales_amount",
      "item_price",
    ],
    description: "Final order amount in Indian Rupees (₹)",
  },
  {
    key: "product_id",
    label: "Product ID / SKU",
    required: false,
    aliases: [
      "product_id",
      "sku",
      "item_sku",
      "item_id",
      "product id",
      "productid",
      "itemid",
      "asin",
      "product_code",
    ],
    description: "Product catalog SKU or item identifier",
  },
  {
    key: "customer_city",
    label: "Customer City",
    required: false,
    aliases: [
      "city",
      "customer_city",
      "buyer_city",
      "shipping_city",
      "delivery_city",
      "customer city",
      "billing_city",
    ],
    description: "City of buyer/delivery",
  },
  {
    key: "customer_state",
    label: "Customer State",
    required: false,
    aliases: [
      "state",
      "customer_state",
      "buyer_state",
      "shipping_state",
      "delivery_state",
      "customer state",
      "state_code",
    ],
    description: "Indian state name or 2-letter state code",
  },
  {
    key: "return_status",
    label: "Return Status",
    required: false,
    aliases: [
      "return_status",
      "return",
      "returned",
      "refund_status",
      "is_returned",
      "return status",
      "has_return",
      "return_flag",
    ],
    description: "Whether the order was returned ('Returned', 'Yes', 1, 'Not Returned', 0)",
  },
  {
    key: "delivery_days",
    label: "Delivery Days",
    required: false,
    aliases: [
      "delivery_days",
      "shipping_days",
      "delivery days",
      "shipping_duration",
      "transit_days",
      "days_to_deliver",
    ],
    description: "Actual transit / delivery time in days",
  },
  {
    key: "customer_rating",
    label: "Customer Rating",
    required: false,
    aliases: [
      "customer_rating",
      "rating",
      "review_score",
      "customer rating",
      "star_rating",
      "score",
      "stars",
    ],
    description: "Customer rating score from 1 to 5",
  },
  {
    key: "payment_method",
    label: "Payment Method",
    required: false,
    aliases: [
      "payment_method",
      "payment_type",
      "payment mode",
      "payment",
      "payment_mode",
      "pay_type",
    ],
    description: "UPI, Credit Card, Debit Card, Net Banking, Cash on Delivery, EMI",
  },
  {
    key: "discount_percent",
    label: "Discount %",
    required: false,
    aliases: [
      "discount_percent",
      "discount_pct",
      "discount",
      "discount_rate",
      "discount_percentage",
      "discount_amount",
    ],
    description: "Percentage discount applied to order",
  },
  {
    key: "product_name",
    label: "Product Name",
    required: false,
    aliases: [
      "product_name",
      "item_name",
      "product",
      "title",
      "product title",
      "item_title",
      "description",
    ],
    description: "Full name or description of the product",
  },
  {
    key: "category",
    label: "Category",
    required: false,
    aliases: [
      "category",
      "product_category",
      "item_category",
      "category_name",
      "department",
      "vertical",
    ],
    description: "Product category name",
  },
];

export interface ColumnDetectionResult {
  targetField: string;
  targetLabel: string;
  required: boolean;
  detectedColumn: string | null;
  confidence: "high" | "medium" | "low" | "none";
}

export interface ValidationIssue {
  type: "error" | "warning";
  code: string;
  message: string;
  affectedCount: number;
  sampleRows?: (string | number)[];
}

export interface ValidationReport {
  totalRows: number;
  totalColumns: number;
  uniqueOrders: number;
  uniqueCustomers: number;
  totalReturns: number;
  returnRate: number;
  issues: ValidationIssue[];
  isSufficientForMl: boolean;
  sufficiencyNote?: string;
}

export interface NormalizedOrderRecord {
  order_id: string;
  customer_id: string;
  order_date: string;
  order_date_parsed: number;
  order_amount: number;
  product_id?: string;
  product_name?: string;
  category?: string;
  customer_city?: string;
  customer_state?: string;
  return_status?: string;
  is_returned: boolean;
  delivery_days?: number;
  customer_rating?: number;
  payment_method?: string;
  discount_percent?: number;
  raw: Record<string, string>;
}

export interface CustomerHistoricalMetrics {
  total_orders: number;
  total_spent: number;
  average_order_value: number;
  total_returns: number;
  return_rate: number;
  average_discount: number;
  average_delivery_days: number;
  average_customer_rating: number;
  low_rating_count: number;
  days_since_last_order: number;
  customer_lifetime_days: number;
  one_time_buyer: number;
  orders_last_7_days: number;
  orders_last_30_days: number;
  returns_last_7_days: number;
  returns_last_30_days: number;
  return_value_last_30_days: number;
  previous_return_count: number;
  previous_return_rate: number;
  historicalOrders: NormalizedOrderRecord[];
}

export interface CsvAnalysisResult {
  currentOrder: NormalizedOrderRecord;
  history: CustomerHistoricalMetrics;
  modelResult: ModelResult | null;
  policyResult: PolicyResult;
  behaviourResult: BehaviourResult;
  geoResult: GeoAdjustmentResult;
  fusionResult: FusionResult;
  investigationResult: InvestigationScoreResult;
  decisionResult: DecisionResult;
  featureVector: Record<string, number> | null;
  allModels?: MultiModelComparison | undefined;
  isSufficient: boolean;
  insufficientMessage?: string;
}

/**
 * Standard RFC-4180 CSV parser that properly handles quoted cells and escaped quotes.
 */
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;
  const cleanText = text.replace(/^\uFEFF/, ""); // Remove BOM if present

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip next quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = lines[0] ?? [];
  const headers = rawHeaders.map((h, idx) => (h ? h.trim() : `col_${idx + 1}`));
  const dataRows = lines.slice(1);

  const rows: Record<string, string>[] = [];
  for (const row of dataRows) {
    const obj: Record<string, string> = {};
    let hasAnyData = false;
    headers.forEach((h, idx) => {
      const val = row[idx] ?? "";
      obj[h] = val;
      if (val.trim()) hasAnyData = true;
    });
    if (hasAnyData) {
      rows.push(obj);
    }
  }

  return { headers, rows };
}

/**
 * Automatically match CSV headers against canonical TrustLoop Indian fields.
 */
export function detectColumns(headers: string[]): ColumnDetectionResult[] {
  const normHeaders = headers.map((h) => ({
    original: h,
    cleaned: h.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, ""),
  }));

  const usedOriginals = new Set<string>();
  const results: ColumnDetectionResult[] = [];

  for (const field of CANONICAL_FIELDS) {
    let matchedCol: string | null = null;
    let confidence: "high" | "medium" | "low" | "none" = "none";

    // 1. Check exact matches in aliases
    for (const h of normHeaders) {
      if (usedOriginals.has(h.original)) continue;
      const exact = field.aliases.some((alias) => {
        const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "_");
        return h.cleaned === cleanAlias || h.original.toLowerCase() === alias.toLowerCase();
      });
      if (exact) {
        matchedCol = h.original;
        confidence = "high";
        break;
      }
    }

    // 2. Check substring / partial matches if not matched
    if (!matchedCol) {
      for (const h of normHeaders) {
        if (usedOriginals.has(h.original)) continue;
        const partial = field.aliases.some((alias) => {
          const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
          const cleanH = h.cleaned.replace(/[^a-z0-9]/g, "");
          return cleanH.includes(cleanAlias) || cleanAlias.includes(cleanH);
        });
        if (partial) {
          matchedCol = h.original;
          confidence = "medium";
          break;
        }
      }
    }

    if (matchedCol) {
      usedOriginals.add(matchedCol);
    }

    results.push({
      targetField: field.key,
      targetLabel: field.label,
      required: field.required,
      detectedColumn: matchedCol,
      confidence,
    });
  }

  return results;
}

/**
 * Validate parsed data using active mapping.
 */
export function validateUploadedData(
  rows: Record<string, string>[],
  mapping: Record<string, string | null>,
): {
  normalized: NormalizedOrderRecord[];
  report: ValidationReport;
} {
  const issues: ValidationIssue[] = [];
  const normalized: NormalizedOrderRecord[] = [];

  const orderIdCol = mapping["order_id"];
  const customerIdCol = mapping["customer_id"];
  const orderDateCol = mapping["order_date"];
  const amountCol = mapping["order_amount"];
  const returnCol = mapping["return_status"];
  const cityCol = mapping["customer_city"];
  const stateCol = mapping["customer_state"];
  const prodCol = mapping["product_id"];
  const prodNameCol = mapping["product_name"];
  const catCol = mapping["category"];
  const delivCol = mapping["delivery_days"];
  const ratingCol = mapping["customer_rating"];
  const payCol = mapping["payment_method"];
  const discCol = mapping["discount_percent"];

  if (!orderIdCol || !customerIdCol || !orderDateCol || !amountCol) {
    return {
      normalized: [],
      report: {
        totalRows: rows.length,
        totalColumns: Object.keys(mapping).length,
        uniqueOrders: 0,
        uniqueCustomers: 0,
        totalReturns: 0,
        returnRate: 0,
        issues: [
          {
            type: "error",
            code: "MISSING_REQUIRED_MAPPING",
            message:
              "Required fields (Order ID, Customer ID, Order Date, Amount) must be mapped.",
            affectedCount: rows.length,
          },
        ],
        isSufficientForMl: false,
        sufficiencyNote: "Insufficient data for complete ML prediction: Missing primary key or financial columns.",
      },
    };
  }

  const seenOrderIds = new Set<string>();
  const duplicateOrders = new Set<string>();
  let missingOrderIds = 0;
  let missingCustomerIds = 0;
  let invalidDates = 0;
  let futureDates = 0;
  let invalidAmounts = 0;
  let malformedReturns = 0;
  const now = Date.now() + 86400000; // allow 1 day tolerance for timezones

  rows.forEach((row, idx) => {
    const rawOrderId = (orderIdCol ? row[orderIdCol] : "")?.trim() || "";
    const rawCustId = (customerIdCol ? row[customerIdCol] : "")?.trim() || "";
    const rawDate = (orderDateCol ? row[orderDateCol] : "")?.trim() || "";
    const rawAmt = (amountCol ? row[amountCol] : "")?.trim() || "";

    if (!rawOrderId) missingOrderIds++;
    if (!rawCustId) missingCustomerIds++;

    if (rawOrderId) {
      if (seenOrderIds.has(rawOrderId)) {
        duplicateOrders.add(rawOrderId);
      } else {
        seenOrderIds.add(rawOrderId);
      }
    }

    // Parse date
    const parsedDate = Date.parse(rawDate);
    if (isNaN(parsedDate)) {
      invalidDates++;
    } else if (parsedDate > now) {
      futureDates++;
    }

    // Parse amount
    const cleanAmtStr = rawAmt.replace(/[^0-9.-]/g, "");
    const parsedAmt = parseFloat(cleanAmtStr);
    if (isNaN(parsedAmt) || parsedAmt < 0) {
      invalidAmounts++;
    }

    // Parse return status
    let isReturned = false;
    let returnStatusText = "Not Returned";
    if (returnCol && row[returnCol] !== undefined) {
      const val = row[returnCol].trim().toLowerCase();
      if (
        val === "1" ||
        val === "true" ||
        val === "returned" ||
        val === "yes" ||
        val === "refunded"
      ) {
        isReturned = true;
        returnStatusText = "Returned";
      } else if (
        val === "0" ||
        val === "false" ||
        val === "not returned" ||
        val === "no" ||
        val === ""
      ) {
        isReturned = false;
        returnStatusText = "Not Returned";
      } else {
        malformedReturns++;
        // best guess
        isReturned = val.includes("return") || val.includes("refund");
        returnStatusText = isReturned ? "Returned" : "Not Returned";
      }
    }

    // Parse optional numbers
    const deliveryDays = delivCol && row[delivCol] ? parseFloat(row[delivCol]) : undefined;
    const rating = ratingCol && row[ratingCol] ? parseFloat(row[ratingCol]) : undefined;
    const discount = discCol && row[discCol] ? parseFloat(row[discCol]) : undefined;

    normalized.push({
      order_id: rawOrderId || `ROW_${idx + 1}`,
      customer_id: rawCustId || "UNKNOWN_CUSTOMER",
      order_date: isNaN(parsedDate) ? new Date().toISOString().split("T")[0]! : rawDate,
      order_date_parsed: isNaN(parsedDate) ? Date.now() : parsedDate,
      order_amount: isNaN(parsedAmt) ? 0 : parsedAmt,
      product_id: prodCol ? row[prodCol]?.trim() : undefined,
      product_name: prodNameCol ? row[prodNameCol]?.trim() : undefined,
      category: catCol ? row[catCol]?.trim() : undefined,
      customer_city: cityCol ? row[cityCol]?.trim() : undefined,
      customer_state: stateCol ? row[stateCol]?.trim() : undefined,
      return_status: returnStatusText,
      is_returned: isReturned,
      delivery_days: isNaN(deliveryDays as number) ? 5 : deliveryDays,
      customer_rating: isNaN(rating as number) ? 4.0 : rating,
      payment_method: payCol ? row[payCol]?.trim() : "UPI",
      discount_percent: isNaN(discount as number) ? 0 : discount,
      raw: row,
    } as any);
  });

  if (duplicateOrders.size > 0) {
    issues.push({
      type: "warning",
      code: "DUPLICATE_ORDER_IDS",
      message: `${duplicateOrders.size} duplicate order IDs found across rows.`,
      affectedCount: duplicateOrders.size,
      sampleRows: Array.from(duplicateOrders).slice(0, 5),
    });
  }
  if (missingOrderIds > 0) {
    issues.push({
      type: "error",
      code: "MISSING_ORDER_IDS",
      message: `${missingOrderIds} records are missing an Order ID.`,
      affectedCount: missingOrderIds,
    });
  }
  if (missingCustomerIds > 0) {
    issues.push({
      type: "error",
      code: "MISSING_CUSTOMER_IDS",
      message: `${missingCustomerIds} records are missing a Customer ID.`,
      affectedCount: missingCustomerIds,
    });
  }
  if (invalidDates > 0) {
    issues.push({
      type: "warning",
      code: "INVALID_DATES",
      message: `${invalidDates} records have unparseable order dates. Fallback to current date used.`,
      affectedCount: invalidDates,
    });
  }
  if (futureDates > 0) {
    issues.push({
      type: "warning",
      code: "FUTURE_DATES",
      message: `${futureDates} records specify order dates in the future.`,
      affectedCount: futureDates,
    });
  }
  if (invalidAmounts > 0) {
    issues.push({
      type: "warning",
      code: "INVALID_AMOUNTS",
      message: `${invalidAmounts} records contain negative or unparseable monetary amounts.`,
      affectedCount: invalidAmounts,
    });
  }
  if (malformedReturns > 0) {
    issues.push({
      type: "warning",
      code: "MALFORMED_RETURNS",
      message: `${malformedReturns} records had non-standard return status text.`,
      affectedCount: malformedReturns,
    });
  }

  const uniqueCusts = new Set(normalized.map((o) => o.customer_id)).size;
  const totalReturnsCount = normalized.filter((o) => o.is_returned).length;
  const returnRate = normalized.length > 0 ? totalReturnsCount / normalized.length : 0;

  const isSufficientForMl =
    Boolean(orderIdCol && customerIdCol && orderDateCol && amountCol) &&
    normalized.length > 0;

  return {
    normalized,
    report: {
      totalRows: rows.length,
      totalColumns: Object.keys(mapping).length,
      uniqueOrders: seenOrderIds.size,
      uniqueCustomers: uniqueCusts,
      totalReturns: totalReturnsCount,
      returnRate,
      issues,
      isSufficientForMl,
      sufficiencyNote: isSufficientForMl
        ? undefined
        : "Insufficient data for complete ML prediction: Essential schema columns could not be verified.",
    } as any,
  };
}

/**
 * Reconstruct complete customer history relative to a selected current order.
 * Calculates all 19 customer features defined in Section 8.
 */
export function reconstructCustomerHistory(
  selectedOrderId: string,
  allOrders: NormalizedOrderRecord[],
): CustomerHistoricalMetrics {
  const current = allOrders.find((o) => o.order_id === selectedOrderId);
  if (!current) {
    return {
      total_orders: 1,
      total_spent: 0,
      average_order_value: 0,
      total_returns: 0,
      return_rate: 0,
      average_discount: 0,
      average_delivery_days: 5,
      average_customer_rating: 4.0,
      low_rating_count: 0,
      days_since_last_order: 0,
      customer_lifetime_days: 0,
      one_time_buyer: 1,
      orders_last_7_days: 1,
      orders_last_30_days: 1,
      returns_last_7_days: 0,
      returns_last_30_days: 0,
      return_value_last_30_days: 0,
      previous_return_count: 0,
      previous_return_rate: 0,
      historicalOrders: [],
    };
  }

  // Find all orders for this customer, sorted chronologically
  const customerOrders = allOrders
    .filter((o) => o.customer_id === current.customer_id)
    .sort((a, b) => a.order_date_parsed - b.order_date_parsed);

  // Filter orders strictly before or equal to the current order timestamp
  const upToCurrent = customerOrders.filter((o) => o.order_date_parsed <= current.order_date_parsed);
  // Preceding orders strictly before current
  const strictlyPrevious = customerOrders.filter(
    (o) => o.order_id !== current.order_id && o.order_date_parsed <= current.order_date_parsed,
  );

  const totalOrders = Math.max(1, upToCurrent.length);
  const totalSpent = upToCurrent.reduce((acc, o) => acc + o.order_amount, 0);
  const avgOrderValue = totalSpent / totalOrders;
  const totalReturns = upToCurrent.filter((o) => o.is_returned).length;
  const returnRate = totalOrders > 0 ? totalReturns / totalOrders : 0;

  const discounts = upToCurrent.map((o) => o.discount_percent ?? 0);
  const avgDiscount = discounts.reduce((a, b) => a + b, 0) / totalOrders;

  const deliveries = upToCurrent.map((o) => o.delivery_days ?? 5);
  const avgDelivery = deliveries.reduce((a, b) => a + b, 0) / totalOrders;

  const ratings = upToCurrent.map((o) => o.customer_rating ?? 4.0);
  const avgRating = ratings.reduce((a, b) => a + b, 0) / totalOrders;
  const lowRatingCount = ratings.filter((r) => r <= 2.0).length;

  // Time metrics
  const firstOrderTime = customerOrders[0]?.order_date_parsed ?? current.order_date_parsed;
  const customerLifetimeDays = Math.max(
    0,
    Math.round((current.order_date_parsed - firstOrderTime) / (1000 * 60 * 60 * 24)),
  );

  const lastPreceding = strictlyPrevious[strictlyPrevious.length - 1];
  const daysSinceLastOrder = lastPreceding
    ? Math.max(
        0,
        Math.round((current.order_date_parsed - lastPreceding.order_date_parsed) / (1000 * 60 * 60 * 24)),
      )
    : 30;

  const oneTimeBuyer = totalOrders <= 1 ? 1 : 0;

  // Window metrics (7 days and 30 days prior to current order date)
  const MS_7 = 7 * 86400000;
  const MS_30 = 30 * 86400000;

  const in7Days = upToCurrent.filter((o) => current.order_date_parsed - o.order_date_parsed <= MS_7);
  const in30Days = upToCurrent.filter((o) => current.order_date_parsed - o.order_date_parsed <= MS_30);

  const ordersLast7Days = in7Days.length;
  const ordersLast30Days = in30Days.length;
  const returnsLast7Days = in7Days.filter((o) => o.is_returned).length;
  const returnsLast30Days = in30Days.filter((o) => o.is_returned).length;
  const returnValueLast30Days = in30Days
    .filter((o) => o.is_returned)
    .reduce((sum, o) => sum + o.order_amount, 0);

  const prevReturnCount = strictlyPrevious.filter((o) => o.is_returned).length;
  const prevReturnRate =
    strictlyPrevious.length > 0 ? prevReturnCount / strictlyPrevious.length : 0;

  return {
    total_orders: totalOrders,
    total_spent: totalSpent,
    average_order_value: avgOrderValue,
    total_returns: totalReturns,
    return_rate: returnRate,
    average_discount: avgDiscount,
    average_delivery_days: avgDelivery,
    average_customer_rating: avgRating,
    low_rating_count: lowRatingCount,
    days_since_last_order: daysSinceLastOrder,
    customer_lifetime_days: customerLifetimeDays,
    one_time_buyer: oneTimeBuyer,
    orders_last_7_days: ordersLast7Days,
    orders_last_30_days: ordersLast30Days,
    returns_last_7_days: returnsLast7Days,
    returns_last_30_days: returnsLast30Days,
    return_value_last_30_days: returnValueLast30Days,
    previous_return_count: prevReturnCount,
    previous_return_rate: prevReturnRate,
    historicalOrders: customerOrders,
  };
}

/**
 * Execute complete Return Analysis on a selected order from the uploaded CSV
 * using the real TrustLoop return engine, Indian model, and policy logic.
 */
export function analyzeUploadedReturn(input: {
  orderId: string;
  allOrders: NormalizedOrderRecord[];
  reason?: ReasonCode;
  condition?: ConditionCode;
}): CsvAnalysisResult {
  const { orderId, allOrders, reason = "DEFECTIVE", condition = "LIKE_NEW" } = input;
  const current = allOrders.find((o) => o.order_id === orderId);

  if (!current) {
    throw new Error(`Order ${orderId} not found in uploaded dataset.`);
  }

  // 1. Reconstruct full customer history
  const history = reconstructCustomerHistory(orderId, allOrders);

  // 2. Map category code
  const catName = current.category || "Electronics";
  const matchedCategory = (categoriesSample as any[]).find(
    (c) => c.name.toLowerCase() === catName.toLowerCase(),
  ) || {
    code: 5,
    name: catName,
    avg_rating: 4.1,
    complaint_rate: 0.14,
    dissatisfaction_rate: 0.15,
    low_rating_pct: 12.0,
  };

  const categoryRow: CategoryRow = {
    code: matchedCategory.code,
    name: matchedCategory.name,
    avg_rating: matchedCategory.avg_rating,
    complaint_rate: matchedCategory.complaint_rate,
    dissatisfaction_rate: matchedCategory.dissatisfaction_rate,
    low_rating_pct: matchedCategory.low_rating_pct,
  };

  // 3. Map customer row
  const customerRow: CustomerRow = {
    id: current.customer_id,
    external_id: current.customer_id,
    city: current.customer_city || "Mumbai",
    city_code: 1,
    state: current.customer_state || "MH",
    state_code: 1,
    is_prime_member: 0,
    total_orders: history.total_orders,
    total_spent: history.total_spent,
    avg_order_value: history.average_order_value,
    total_returns: history.total_returns,
    return_rate: history.return_rate,
    average_discount: history.average_discount,
    avg_delivery_days: history.average_delivery_days,
    avg_customer_rating: history.average_customer_rating,
    low_rating_count: history.low_rating_count,
    days_since_last_order: history.days_since_last_order,
    customer_lifetime_days: history.customer_lifetime_days,
    is_one_time_buyer: history.one_time_buyer,
    orders_last_7_days: history.orders_last_7_days,
    orders_last_30_days: history.orders_last_30_days,
    returns_last_7_days: history.returns_last_7_days,
    returns_last_30_days: history.returns_last_30_days,
    return_value_last_30_days: history.return_value_last_30_days,
    previous_return_count: history.previous_return_count,
    previous_return_rate: history.previous_return_rate,
  };

  // 4. Map order row
  const orderRow: OrderRow = {
    id: current.order_id,
    external_id: current.order_id,
    category_code: categoryRow.code,
    purchased_at: current.order_date,
    delivered_at: current.order_date,
    total_price: current.order_amount,
    original_price: current.order_amount / Math.max(0.01, 1 - (current.discount_percent ?? 0) / 100),
    discount_percent: current.discount_percent ?? 0,
    delivery_days: current.delivery_days ?? 5,
    customer_rating: current.customer_rating ?? 4.0,
    payment_method: current.payment_method || "UPI",
    return_status: current.return_status,
  } as any;

  // Check sufficiency
  if (current.order_amount <= 0 && history.total_orders <= 0) {
    return {
      currentOrder: current,
      history,
      modelResult: null,
      policyResult: evaluatePolicy(orderRow, reason, condition),
      behaviourResult: analyseBehaviour(customerRow, orderRow),
      geoResult: calculateGeoAdjustment(customerRow.state),
      fusionResult: { trustScore: 50, agreement: 0.5, evidence: [], conflicts: [] },
      investigationResult: {
        baseTrustScore: 50,
        networkAdjustment: 0,
        geoAdjustment: 0,
        evidenceAdjustment: 0,
        finalInvestigationScore: 50,
        investigationPriority: "MEDIUM",
        adjustments: [],
        flaggedReasons: ["Insufficient data for complete ML prediction."],
      },
      decisionResult: {
        outcome: "MANUAL_REVIEW",
        confidence: 0.5,
        rationale: ["Insufficient data for complete ML prediction."],
      },
      featureVector: null,
      isSufficient: false,
      insufficientMessage: "Insufficient data for complete ML prediction: Missing monetary or historical details.",
    };
  }

  // 5. Build features & run Indian ML models (XGBoost, Logistic Regression, Decision Tree)
  const features = buildFeatureVector(orderRow, customerRow, categoryRow);
  const allModels = runAllModels(features);
  const modelResult = allModels.xgboost;

  // 6. Policy evaluation
  const policyResult = evaluatePolicy(orderRow, reason, condition);

  // 7. Behaviour analysis
  const behaviourResult = analyseBehaviour(customerRow, orderRow);

  // 8. Regional Hotspot / Geo adjustment
  const geoResult = calculateGeoAdjustment(customerRow.state);

  // 9. Multi-source Fusion
  const fusionResult = fuseEvidence({
    model: modelResult,
    policy: policyResult,
    behaviour: behaviourResult,
    vision: null, // no image on raw CSV upload
    reason,
    network: null,
    geo: geoResult,
  });

  // 10. Investigation score calculation
  const investigationResult = calculateInvestigationScore({
    baseTrustScore: fusionResult.trustScore,
    modelRiskScore: modelResult.riskScore,
    network: null,
    geo: geoResult,
    conflictsCount: fusionResult.conflicts.length,
  });

  // 11. Policy & Risk Decision
  const decisionResult = decide({
    fusion: fusionResult,
    policy: policyResult,
    model: modelResult,
    vision: null,
    orderValue: current.order_amount,
    network: null,
    investigation: investigationResult,
  });

  return {
    currentOrder: current,
    history,
    modelResult,
    allModels,
    policyResult,
    behaviourResult,
    geoResult,
    fusionResult,
    investigationResult,
    decisionResult,
    featureVector: features,
    isSufficient: true,
  };
}
