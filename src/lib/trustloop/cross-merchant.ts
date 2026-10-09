/**
 * TrustLoop 2.0 Cross-Merchant Consortium Intelligence Engine
 * 
 * Enables privacy-preserving cross-merchant intelligence sharing.
 * Detects when a customer with a "clean" or "normal" history on the current merchant (e.g. NexaCart)
 * has an extensive record of return abuse, serial empty box claims, or wardrobing on
 * another consortium member merchant (e.g. UrbanBasket).
 * 
 * ARCHITECTURE:
 *   URBANBASKET (Same customer, Suspicious history)
 *        │ stored in demo merchant system
 *        ▼
 *   NEXACART (Same customer, Normal history)
 *        │ customer requests return
 *        ▼
 *   TRUSTLOOP (Existing ML + Policy + Behaviour + Evidence + Risk)
 *        │
 *        ▼
 *   NEW CROSS-MERCHANT EVIDENCE:
 *   "Matching customer found on UrbanBasket.
 *    Suspicious return behaviour detected there."
 */

export interface CrossMerchantProfile {
  merchantId: string;
  merchantName: string;
  merchantType: string;
  customerId: string;
  accountAgeDays: number;
  totalOrders: number;
  totalReturns: number;
  returnRate: number;
  totalRefundAmount: number;
  riskStatus: "NORMAL" | "SUSPICIOUS" | "RESTRICTED_ABUSER";
  flags: string[];
  recentReturnClaims: {
    date: string;
    product: string;
    value: number;
    claimedReason: string;
    finding: string;
  }[];
}

export interface CrossMerchantEvidenceResult {
  hasCrossMerchantMatch: boolean;
  currentMerchant: {
    id: string;
    name: string;
    profile: {
      orders: number;
      returns: number;
      returnRate: number;
      status: string;
    };
  };
  matchedMerchant: {
    id: string;
    name: string;
    profile: CrossMerchantProfile;
  } | null;
  matchIdentifierType: "SHA256_HASHED_PHONE" | "SHA256_HASHED_EMAIL" | "DEVICE_TOKEN" | "DIRECT_ID";
  hashedToken: string;
  headline: string;
  verdict: string;
  summary: string;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "CLEAN";
  supportScore: number; // 0-1, low value = opposes auto-refund
  weight: number;
  adjustmentPoints: number; // e.g. +20 to +25 investigation points
  consortiumProtectionImpact: string;
}

// Demo Consortium Database storing cross-merchant profiles
export const DEMO_MERCHANT_CONSORTIUM: Record<
  string,
  {
    nexaCart: {
      orders: number;
      returns: number;
      returnRate: number;
      status: string;
      customerName: string;
    };
    urbanBasket: CrossMerchantProfile;
  }
> = {
  // Flagship scenario customer: Rahul / Kavita / Cross-Merchant Abuser
  "cross-merchant-abuser": {
    nexaCart: {
      customerName: "Kavita Roy (NexaCart Account)",
      orders: 1,
      returns: 0,
      returnRate: 0.0,
      status: "Normal history (New customer, 0 prior returns)",
    },
    urbanBasket: {
      merchantId: "MERCH-UB-01",
      merchantName: "UrbanBasket",
      merchantType: "Quick-Commerce & Lifestyle Platform",
      customerId: "UB-CUST-84920",
      accountAgeDays: 240,
      totalOrders: 9,
      totalReturns: 6,
      returnRate: 0.667,
      totalRefundAmount: 58400,
      riskStatus: "RESTRICTED_ABUSER",
      flags: [
        "3x Serial 'Empty Box' claims on high-ticket consumer electronics",
        "2x Serial number mismatch on returned products",
        "Disputed 2 delivery courier logs despite GPS pin match",
        "Account restricted from Cash-on-Delivery on UrbanBasket",
      ],
      recentReturnClaims: [
        {
          date: "14 days ago",
          product: "Apple AirPods Pro (2nd Gen)",
          value: 20900,
          claimedReason: "Empty Box Received",
          finding: "Courier weight manifest matched 320g sealed package; claim rejected as fraud.",
        },
        {
          date: "38 days ago",
          product: "Sony WH-1000XM4 Headphones",
          value: 22490,
          claimedReason: "Wrong Item Shipped",
          finding: "Returned counterfeit replica with non-matching serial number.",
        },
        {
          date: "62 days ago",
          product: "Samsung Galaxy Buds2 Pro",
          value: 12990,
          claimedReason: "Arrived Damaged",
          finding: "Visual photo showed physically broken dummy unit.",
        },
      ],
    },
  },
};

/**
 * Evaluates whether an order or customer has a cross-merchant consortium match.
 * Simulates real-time SHA-256 hashed identity lookups across participating merchants.
 */
export function evaluateCrossMerchantRisk(
  orderIdOrRef?: string,
  customerIdentifier?: string,
  currentMerchantName = "NexaCart"
): CrossMerchantEvidenceResult {
  const target = (orderIdOrRef || customerIdentifier || "").toLowerCase();

  // Match if explicitly requested via cross-merchant scenario, or matching specific IDs
  const isMatch =
    target.includes("cross") ||
    target.includes("urban") ||
    target.includes("nexa") ||
    target.includes("scenario-cross") ||
    target.includes("nc-9842") ||
    target.includes("nc-9421") ||
    target.includes("cust-in-10001") ||
    target.includes("in-current-001");

  if (!isMatch) {
    return {
      hasCrossMerchantMatch: false,
      currentMerchant: {
        id: "MERCH-NC-01",
        name: currentMerchantName,
        profile: {
          orders: 3,
          returns: 0,
          returnRate: 0.0,
          status: "Standard customer profile",
        },
      },
      matchedMerchant: null,
      matchIdentifierType: "SHA256_HASHED_PHONE",
      hashedToken: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      headline: "No suspicious cross-merchant activity detected",
      verdict: "Clean consortium record across all member merchants",
      summary: "No prior fraud or abusive return patterns found across participating retailers.",
      riskLevel: "CLEAN",
      supportScore: 0.92,
      weight: 0.05,
      adjustmentPoints: 0,
      consortiumProtectionImpact: "Zero cross-merchant risk detected.",
    };
  }

  const ub = DEMO_MERCHANT_CONSORTIUM["cross-merchant-abuser"]!.urbanBasket;
  const nc = DEMO_MERCHANT_CONSORTIUM["cross-merchant-abuser"]!.nexaCart;

  return {
    hasCrossMerchantMatch: true,
    currentMerchant: {
      id: "MERCH-NC-01",
      name: currentMerchantName,
      profile: {
        orders: nc.orders,
        returns: nc.returns,
        returnRate: nc.returnRate,
        status: nc.status,
      },
    },
    matchedMerchant: {
      id: ub.merchantId,
      name: ub.merchantName,
      profile: ub,
    },
    matchIdentifierType: "SHA256_HASHED_PHONE",
    hashedToken: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    headline: "Matching customer found on UrbanBasket. Suspicious return behaviour detected there.",
    verdict: "Matching customer found on UrbanBasket. Suspicious return behaviour detected there.",
    summary: `Consortium identity match found on UrbanBasket (${ub.customerId}). Customer has placed ${ub.totalOrders} orders on UrbanBasket with ${ub.totalReturns} return claims (${(ub.returnRate * 100).toFixed(1)}% return rate), racking up ₹${ub.totalRefundAmount.toLocaleString()} in refund exposure despite a clean initial profile on ${currentMerchantName}.`,
    riskLevel: "CRITICAL",
    supportScore: 0.08, // Very low support for approving claim
    weight: 0.22,
    adjustmentPoints: 25, // Max layered adjustment points
    consortiumProtectionImpact: `Prevents ${currentMerchantName} from blindly auto-approving a ₹24,990 return claim by exposing chronic cross-merchant return abuse history.`,
  };
}
