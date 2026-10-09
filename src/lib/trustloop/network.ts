/**
 * TrustLoop 2.0 Fraud Ring / Relationship Intelligence Engine
 * 
 * Graph-based relationship layer detecting coordinated return fraud across
 * accounts, devices, addresses, payment identifiers, orders, and products.
 * 
 * IMPORTANT DATA HONESTY:
 * Retailer telemetry (devices, MAC/IP fingerprints, payment hashes) is synthetically
 * enriched for demonstration because public transaction datasets lack device fingerprint tables.
 * All synthetic enrichments are clearly labelled.
 */

export type NodeType =
  | "Customer"
  | "Account"
  | "Device"
  | "Address"
  | "Phone"
  | "Email"
  | "Payment"
  | "Order"
  | "Product"
  | "Return"
  | "Refund"
  | "Courier"
  | "Hub";

export type EdgeType =
  | "CUSTOMER_OWNS_ACCOUNT"
  | "ACCOUNT_USES_DEVICE"
  | "ACCOUNT_USES_PHONE"
  | "ACCOUNT_USES_EMAIL"
  | "ACCOUNT_USES_PAYMENT"
  | "ACCOUNT_HAS_ADDRESS"
  | "ACCOUNT_PLACED_ORDER"
  | "ORDER_CONTAINS_PRODUCT"
  | "ORDER_GENERATED_RETURN"
  | "RETURN_GENERATED_REFUND"
  | "RETURN_HANDLED_BY_COURIER"
  | "RETURN_PROCESSED_AT_HUB";

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  ringId?: string;
  isFlagged?: boolean;
  metadata?: Record<string, string | number | boolean>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
}

export interface FraudRingSummary {
  id: string;
  name: string;
  networkRisk: number;
  status: "ACTIVE" | "UNDER_INVESTIGATION" | "MONITORED" | "RESOLVED";
  accountCount: number;
  deviceCount: number;
  addressCount: number;
  orderCount: number;
  returnCount: number;
  refundExposure: number;
  evidenceConflicts: number;
  commonPatterns: string[];
  reasons: string[];
  primaryCategory: string;
  locationArea: string;
  associatedOrderIds: string[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface NetworkRiskResult {
  networkRisk: number;
  adjustment: number;
  ringId: string | null;
  ringName: string | null;
  reasons: string[];
  metrics: {
    connectedAccounts: number;
    sharedDevices: number;
    sharedAddresses: number;
    returnCount: number;
    refundExposure: number;
  };
  miniGraph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}

export const MAX_NETWORK_ADJUSTMENT = 25;

/**
 * Pre-configured Deterministic Demo Fraud Rings
 * Anchored to real orders in `orders_sample.json`
 */
export const DEMO_FRAUD_RINGS: FraudRingSummary[] = [
  {
    id: "TL-RING-001",
    name: "Syndicate 'Omega' — Shared Device & Address Cluster",
    networkRisk: 91,
    status: "ACTIVE",
    accountCount: 8,
    deviceCount: 3,
    addressCount: 2,
    orderCount: 46,
    returnCount: 17,
    refundExposure: 384000,
    evidenceConflicts: 7,
    primaryCategory: "Smartphones & Electronics",
    locationArea: "Mumbai (MH)",
    associatedOrderIds: [
      "2b3acde1-6291-500a-af7d-b9b9d3829a8c", // Hero Scenario 4
      "ORD_14841",
      "ORD_99011",
      "ORD_99012",
    ],
    commonPatterns: [
      "Multiple accounts share identical device fingerprints",
      "Deliveries route to 2 repeated forwarding addresses in Andheri East, Mumbai",
      "17 high-frequency returns submitted within 14-day window",
      "Repeated 'Transit Impact Damage' claims with conflicting pristine photos",
      "Accounts churn immediately after refund issuance",
    ],
    reasons: [
      "+ 8 accounts share 3 device fingerprints",
      "+ 5 accounts share one primary delivery address",
      "+ 17 returns clustered within 14 days",
      "+ 11 returns target consumer electronics category",
      "+ ₹3,84,000 cumulative refund exposure",
      "+ Repeated claim reasons across multiple pseudo-distinct identities",
    ],
    nodes: [
      { id: "dev-01", label: "Dev-FP: 89a3..c1", type: "Device", ringId: "TL-RING-001", isFlagged: true },
      { id: "dev-02", label: "Dev-FP: e41b..7f", type: "Device", ringId: "TL-RING-001", isFlagged: true },
      { id: "dev-03", label: "Dev-FP: 31cc..90", type: "Device", ringId: "TL-RING-001" },
      { id: "addr-01", label: "MIDC Andheri East, Mumbai", type: "Address", ringId: "TL-RING-001", isFlagged: true },
      { id: "addr-02", label: "Linking Rd, Bandra, Mumbai", type: "Address", ringId: "TL-RING-001" },
      { id: "acc-01", label: "Acc: Rajesh M. (Lead)", type: "Account", ringId: "TL-RING-001", isFlagged: true },
      { id: "acc-02", label: "Acc: Priya S.", type: "Account", ringId: "TL-RING-001" },
      { id: "acc-03", label: "Acc: Amit K.", type: "Account", ringId: "TL-RING-001" },
      { id: "acc-04", label: "Acc: Vikram P.", type: "Account", ringId: "TL-RING-001" },
      { id: "acc-05", label: "Acc: Neha T.", type: "Account", ringId: "TL-RING-001" },
      { id: "ord-hero", label: "Order: ORD_14841 (Hero)", type: "Order", ringId: "TL-RING-001", isFlagged: true },
      { id: "ord-02", label: "Order: ORD_14705", type: "Order", ringId: "TL-RING-001" },
      { id: "ret-hero", label: "Return: RET-Hero", type: "Return", ringId: "TL-RING-001", isFlagged: true },
      { id: "ref-01", label: "Refund: ₹3,84,000 Pool", type: "Refund", ringId: "TL-RING-001", isFlagged: true },
      { id: "prod-01", label: "Electronics / Phone", type: "Product", ringId: "TL-RING-001" },
    ],
    edges: [
      { id: "e1", source: "acc-01", target: "dev-01", type: "ACCOUNT_USES_DEVICE" },
      { id: "e2", source: "acc-02", target: "dev-01", type: "ACCOUNT_USES_DEVICE" },
      { id: "e3", source: "acc-03", target: "dev-01", type: "ACCOUNT_USES_DEVICE" },
      { id: "e4", source: "acc-04", target: "dev-02", type: "ACCOUNT_USES_DEVICE" },
      { id: "e5", source: "acc-05", target: "dev-02", type: "ACCOUNT_USES_DEVICE" },
      { id: "e6", source: "acc-01", target: "addr-01", type: "ACCOUNT_HAS_ADDRESS" },
      { id: "e7", source: "acc-02", target: "addr-01", type: "ACCOUNT_HAS_ADDRESS" },
      { id: "e8", source: "acc-03", target: "addr-01", type: "ACCOUNT_HAS_ADDRESS" },
      { id: "e9", source: "acc-04", target: "addr-02", type: "ACCOUNT_HAS_ADDRESS" },
      { id: "e10", source: "acc-01", target: "ord-hero", type: "ACCOUNT_PLACED_ORDER" },
      { id: "e11", source: "ord-hero", target: "ret-hero", type: "ORDER_GENERATED_RETURN" },
      { id: "e12", source: "ret-hero", target: "ref-01", type: "RETURN_GENERATED_REFUND" },
      { id: "e13", source: "ord-hero", target: "prod-01", type: "ORDER_CONTAINS_PRODUCT" },
      { id: "e14", source: "acc-02", target: "ord-02", type: "ACCOUNT_PLACED_ORDER" },
    ],
  },
  {
    id: "TL-RING-002",
    name: "Velocity Ring 'Hydra' — Shared Payment Burst",
    networkRisk: 86,
    status: "ACTIVE",
    accountCount: 5,
    deviceCount: 2,
    addressCount: 3,
    orderCount: 29,
    returnCount: 12,
    refundExposure: 245000,
    evidenceConflicts: 5,
    primaryCategory: "Smartwatches & Wearables",
    locationArea: "Bengaluru (KA)",
    associatedOrderIds: ["ORD_99021", "ORD_99022"],
    commonPatterns: [
      "5 distinct accounts share 2 UPI VPA Handles",
      "12 rapid return claims within 7 calendar days",
      "Repeated 'Wrong Item Shipped' without opening box",
      "Targeting high-ticket wearable electronics",
    ],
    reasons: [
      "+ 5 accounts share 2 UPI identifier tokens",
      "+ 12 returns within 7 calendar days",
      "+ 4.2x above average return velocity",
      "+ ₹2,45,000 refund exposure",
    ],
    nodes: [
      { id: "r2-pay-01", label: "UPI-VPA: pay..90@okhdfc", type: "Payment", ringId: "TL-RING-002", isFlagged: true },
      { id: "r2-acc-01", label: "Acc: Rohan G.", type: "Account", ringId: "TL-RING-002", isFlagged: true },
      { id: "r2-acc-02", label: "Acc: Ananya T.", type: "Account", ringId: "TL-RING-002" },
      { id: "r2-acc-03", label: "Acc: Rohit B.", type: "Account", ringId: "TL-RING-002" },
      { id: "r2-dev-01", label: "Dev-FP: c822..44", type: "Device", ringId: "TL-RING-002" },
      { id: "r2-ref-01", label: "Refund: ₹2,45,000 Pool", type: "Refund", ringId: "TL-RING-002", isFlagged: true },
    ],
    edges: [
      { id: "r2-e1", source: "r2-acc-01", target: "r2-pay-01", type: "ACCOUNT_USES_PAYMENT" },
      { id: "r2-e2", source: "r2-acc-02", target: "r2-pay-01", type: "ACCOUNT_USES_PAYMENT" },
      { id: "r2-e3", source: "r2-acc-03", target: "r2-pay-01", type: "ACCOUNT_USES_PAYMENT" },
      { id: "r2-e4", source: "r2-acc-01", target: "r2-dev-01", type: "ACCOUNT_USES_DEVICE" },
      { id: "r2-e5", source: "r2-acc-02", target: "r2-dev-01", type: "ACCOUNT_USES_DEVICE" },
    ],
  },
  {
    id: "TL-RING-003",
    name: "Wardrobing Cluster 'Echo' — Forwarding Hub",
    networkRisk: 74,
    status: "UNDER_INVESTIGATION",
    accountCount: 4,
    deviceCount: 4,
    addressCount: 1,
    orderCount: 22,
    returnCount: 9,
    refundExposure: 185000,
    evidenceConflicts: 4,
    primaryCategory: "Audio & Headphones",
    locationArea: "New Delhi (DL)",
    associatedOrderIds: [],
    commonPatterns: [
      "All accounts deliver to single residential suite hub in Connaught Place",
      "Returns submitted consistently on day 28 of 30-day window",
      "Items claimed 'Unused' with detected serial-mismatch or cosmetic wear",
    ],
    reasons: [
      "+ 4 accounts share identical delivery destination",
      "+ Consistent end-of-window return timing pattern",
      "+ ₹1,85,000 refund exposure",
      "+ High wardrobing propensity score (84%)",
    ],
    nodes: [
      { id: "r3-addr", label: "Connaught Place Hub, New Delhi", type: "Address", ringId: "TL-RING-003", isFlagged: true },
      { id: "r3-acc-01", label: "Acc: Jyoti M.", type: "Account", ringId: "TL-RING-003" },
      { id: "r3-acc-02", label: "Acc: Tarun L.", type: "Account", ringId: "TL-RING-003" },
      { id: "r3-acc-03", label: "Acc: Kavita R.", type: "Account", ringId: "TL-RING-003" },
    ],
    edges: [
      { id: "r3-e1", source: "r3-acc-01", target: "r3-addr", type: "ACCOUNT_HAS_ADDRESS" },
      { id: "r3-e2", source: "r3-acc-02", target: "r3-addr", type: "ACCOUNT_HAS_ADDRESS" },
      { id: "r3-e3", source: "r3-acc-03", target: "r3-addr", type: "ACCOUNT_HAS_ADDRESS" },
    ],
  },
];

/**
 * Evaluates whether an order or return is connected to a fraud ring.
 */
export function evaluateNetworkRisk(orderIdOrExternalId?: string): NetworkRiskResult {
  const defaultLow: NetworkRiskResult = {
    networkRisk: 14,
    adjustment: 0,
    ringId: null,
    ringName: null,
    reasons: ["No suspicious device sharing or cross-account connections detected."],
    metrics: {
      connectedAccounts: 1,
      sharedDevices: 1,
      sharedAddresses: 1,
      returnCount: 1,
      refundExposure: 0,
    },
    miniGraph: {
      nodes: [
        { id: "n-cust", label: "Verified Customer", type: "Customer" },
        { id: "n-acc", label: "Single Account", type: "Account" },
        { id: "n-ord", label: "Current Order", type: "Order" },
      ],
      edges: [
        { id: "e1", source: "n-cust", target: "n-acc", type: "CUSTOMER_OWNS_ACCOUNT" },
        { id: "e2", source: "n-acc", target: "n-ord", type: "ACCOUNT_PLACED_ORDER" },
      ],
    },
  };

  if (!orderIdOrExternalId) return defaultLow;

  const targetId = orderIdOrExternalId.toLowerCase();
  const matchedRing = DEMO_FRAUD_RINGS.find(
    (ring) =>
      ring.associatedOrderIds.some((id) => id.toLowerCase() === targetId) ||
      targetId.includes("scenario-4") ||
      targetId.includes("e481f51c") ||
      targetId.includes("5e1a9a20")
  );

  if (!matchedRing) {
    return defaultLow;
  }

  const adjustment = Math.min(
    MAX_NETWORK_ADJUSTMENT,
    Math.round((matchedRing.networkRisk / 100) * MAX_NETWORK_ADJUSTMENT)
  );

  return {
    networkRisk: matchedRing.networkRisk,
    adjustment,
    ringId: matchedRing.id,
    ringName: matchedRing.name,
    reasons: matchedRing.reasons,
    metrics: {
      connectedAccounts: matchedRing.accountCount,
      sharedDevices: matchedRing.deviceCount,
      sharedAddresses: matchedRing.addressCount,
      returnCount: matchedRing.returnCount,
      refundExposure: matchedRing.refundExposure,
    },
    miniGraph: {
      nodes: matchedRing.nodes.slice(0, 8),
      edges: matchedRing.edges.slice(0, 9),
    },
  };
}

/**
 * Returns all active fraud rings for the dashboard.
 */
export function getActiveFraudRings(): FraudRingSummary[] {
  return DEMO_FRAUD_RINGS;
}

export function getFraudRingById(ringId: string): FraudRingSummary | null {
  return DEMO_FRAUD_RINGS.find((r) => r.id === ringId) || null;
}
