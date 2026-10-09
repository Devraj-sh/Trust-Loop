/**
 * TrustLoop 2.0 Guided Demo Scenarios
 * Anchored to authentic Indian e-commerce orders and products.
 */

export interface DemoScenario {
  id: string;
  name: string;
  tag: string;
  badgeTone: "positive" | "caution" | "critical" | "neutral";
  headline: string;
  summary: string;
  expectedOutcome: "AUTO_APPROVE" | "MANUAL_REVIEW" | "REFUND_ON_INSPECTION" | "DECLINE";
  expectedOutcomeLabel: string;
  orderId: string;
  orderExternalId: string;
  customerCity: string;
  customerState: string;
  productValue: number;
  reason: "DAMAGED" | "DEFECTIVE" | "WRONG_ITEM" | "NOT_AS_DESCRIBED" | "SIZE_FIT" | "LATE_DELIVERY" | "CHANGED_MIND";
  condition: "UNOPENED" | "LIKE_NEW" | "USED" | "DAMAGED";
  description: string;
  imagePreset: "no_damage" | "damaged";
  imageName: string;
  whyThisMatters: string;
}

// 1. Pristine / No Damage (clean phone/box)
const SVG_PRISTINE = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#0B132B"/>
  <rect x="70" y="30" width="260" height="240" rx="16" fill="#1C2541" stroke="#3A506B" stroke-width="2"/>
  <rect x="90" y="50" width="220" height="200" rx="8" fill="#111827"/>
  <circle cx="200" cy="140" r="36" fill="#1F2937" stroke="#374151" stroke-width="2"/>
  <circle cx="200" cy="140" r="14" fill="#3B82F6"/>
  <rect x="130" y="210" width="140" height="12" rx="4" fill="#374151"/>
  <text x="200" y="275" font-family="monospace" font-size="12" fill="#10B981" text-anchor="middle" font-weight="bold">CONDITION: PRISTINE (0% DAMAGE DETECTED)</text>
</svg>`;

// 2. Damaged Display & Casing
const SVG_DAMAGED = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#1F1515"/>
  <rect x="70" y="30" width="260" height="240" rx="16" fill="#2E1C1C" stroke="#7F1D1D" stroke-width="2"/>
  <rect x="90" y="50" width="220" height="200" rx="8" fill="#181111"/>
  <path d="M 120 70 L 190 140 L 160 170 L 230 210 L 290 230" stroke="#EF4444" stroke-width="3" fill="none"/>
  <path d="M 190 140 L 240 100 L 270 120" stroke="#EF4444" stroke-width="2.5" fill="none"/>
  <path d="M 160 170 L 130 210" stroke="#EF4444" stroke-width="2" fill="none"/>
  <circle cx="190" cy="140" r="6" fill="#EF4444"/>
  <text x="200" y="275" font-family="monospace" font-size="12" fill="#EF4444" text-anchor="middle" font-weight="bold">DAMAGE DETECTED: SEVERE DISPLAY FRACTURE</text>
</svg>`;

function toBase64Payload(svgContent: string, tag: string) {
  const clean = svgContent.trim();
  const svgDataUri = "data:image/svg+xml;utf8," + encodeURIComponent(clean);
  const binary = unescape(encodeURIComponent(clean));
  const base64 = btoa(binary) + "::" + tag;
  return {
    base64,
    contentType: "image/svg+xml" as const,
    byteSize: binary.length,
    preview: svgDataUri,
  };
}

export const PRESET_IMAGES = {
  no_damage: toBase64Payload(SVG_PRISTINE, "DEMO_PRESET_NO_DAMAGE"),
  damaged: toBase64Payload(SVG_DAMAGED, "DEMO_PRESET_DAMAGED"),
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "scenario-in-rahul",
    name: "Scenario 1 — Rahul Sharma (Delhi): Repeat Returner",
    tag: "BEHAVIOUR RISK",
    badgeTone: "caution",
    headline: "Customer with 35.7% historical return rate & 5 low ratings returning a smartwatch.",
    summary:
      "Rahul Sharma (Delhi, CUST-IN-10001) has placed 14 previous orders with 5 returns (35.7% return rate) and 5 one-star complaints. Now submitting return for Noise ColorFit Pro 5 (₹3,249.35). Behavioral model flags elevated return velocity.",
    expectedOutcome: "MANUAL_REVIEW",
    expectedOutcomeLabel: "Human Review (Repeat Return Signals)",
    orderId: "IN-CURRENT-001",
    orderExternalId: "IN-CURRENT-001",
    customerCity: "Delhi",
    customerState: "DL",
    productValue: 3249.35,
    reason: "DAMAGED",
    condition: "DAMAGED",
    description: "Noise ColorFit Pro 5 arrived with cracked glass display and broken dial in shipping carton.",
    imagePreset: "damaged",
    imageName: "smartphone_cracked_screen.jpg (Wikimedia)",
    whyThisMatters:
      "Demonstrates multi-pillar behavior scoring: customer's 14-order history with 5 prior returns and repeated low-rating claims triggers investigator escalation.",
  },
  {
    id: "scenario-in-aarav",
    name: "Scenario 2 — Aarav Mehta (Mumbai): Trusted Loyal Buyer",
    tag: "LOYAL BUYER",
    badgeTone: "positive",
    headline: "High-reputation customer with 14 orders, ₹1.07L spend, and only 7.1% return rate.",
    summary:
      "Aarav Mehta (Mumbai, CUST-IN-10002) is a verified loyal customer with 14 lifetime orders, ₹1,07,784 total spend, and a pristine 4.43/5.0 average feedback rating. Returning HP Wireless Keyboard (₹2,124.15). All evidence pillars align cleanly.",
    expectedOutcome: "AUTO_APPROVE",
    expectedOutcomeLabel: "Auto Approve (Trusted Customer Profile)",
    orderId: "IN-CURRENT-002",
    orderExternalId: "IN-CURRENT-002",
    customerCity: "Mumbai",
    customerState: "MH",
    productValue: 2124.15,
    reason: "DAMAGED",
    condition: "DAMAGED",
    description: "HP Wireless Keyboard frame cracked on arrival with multiple loose keys.",
    imagePreset: "damaged",
    imageName: "damaged_keyboard_evidence.jpg",
    whyThisMatters:
      "Demonstrates high trust scoring: customer's substantial positive transaction history overrides isolated return friction to deliver instant friction-free refunds.",
  },
  {
    id: "scenario-in-neha",
    name: "Scenario 3 — Neha Yadav (Noida): Habitual Return Pattern",
    tag: "HABITUAL RETURN",
    badgeTone: "critical",
    headline: "Customer with 6 prior returns (42.9% rate) & 6 low ratings returning a mobile phone.",
    summary:
      "Neha Yadav (Noida, CUST-IN-10007) has returned 6 out of 14 previous orders (42.9% return rate) with 6 one-star ratings. Claiming damaged OnePlus Nord CE 4 Lite (₹14,299.35). High behavioral risk and elevated refund exposure mandate inspection.",
    expectedOutcome: "REFUND_ON_INSPECTION",
    expectedOutcomeLabel: "Refund on Inspection (High-Value Exposure)",
    orderId: "IN-CURRENT-007",
    orderExternalId: "IN-CURRENT-007",
    customerCity: "Noida",
    customerState: "UP",
    productValue: 14299.35,
    reason: "DAMAGED",
    condition: "DAMAGED",
    description: "OnePlus Nord CE 4 Lite display shattered during courier handling with body deformation.",
    imagePreset: "damaged",
    imageName: "smartphone_cracked_screen.jpg (Wikimedia)",
    whyThisMatters:
      "Prevents merchant revenue leakage on high-value items when buyer demonstrates chronic return abuse patterns across chronological purchase history.",
  },
  {
    id: "scenario-in-ananya",
    name: "Scenario 4 — Ananya Singh (Jaipur): High-Value VIP",
    tag: "VIP ACCOUNT",
    badgeTone: "positive",
    headline: "VIP account with ₹1.38L spend, 4.57 avg rating, and only 1 prior return.",
    summary:
      "Ananya Singh (Jaipur, CUST-IN-10005) has generated ₹1,38,894 in GMV across 14 transactions with a top-tier 4.57 rating and only 1 past return. Returning Redmi Pad SE (₹12,749.15) with valid photo evidence.",
    expectedOutcome: "AUTO_APPROVE",
    expectedOutcomeLabel: "Auto Approve (VIP Customer Protection)",
    orderId: "IN-CURRENT-005",
    orderExternalId: "IN-CURRENT-005",
    customerCity: "Jaipur",
    customerState: "RJ",
    productValue: 12749.15,
    reason: "DAMAGED",
    condition: "DAMAGED",
    description: "Redmi Pad SE screen has hairline fractures upon opening retail carton.",
    imagePreset: "damaged",
    imageName: "tablet_screen_fracture.jpg",
    whyThisMatters:
      "Protects high-LTV customer relationships by weighting account tenure and GMV contribution heavily in the trust score fusion.",
  },
  {
    id: "scenario-cross-merchant",
    name: "Scenario 5 — Cross-Merchant Risk: UrbanBasket ➔ NexaCart",
    tag: "CROSS-MERCHANT INTEL",
    badgeTone: "critical",
    headline: "Matching customer found on UrbanBasket. Suspicious return behaviour detected there.",
    summary:
      "Customer has clean/normal history on NexaCart (1 order, 0 returns), but TrustLoop cross-merchant intelligence matches customer to UrbanBasket where 6 return claims (66.7% rate), 3 empty box disputes, and ₹58,400 in refund exposure were detected.",
    expectedOutcome: "REFUND_ON_INSPECTION",
    expectedOutcomeLabel: "Refund on Inspection (Cross-Merchant Flag)",
    orderId: "ORD-NC-9842",
    orderExternalId: "ORD-NC-9842",
    customerCity: "Bengaluru",
    customerState: "KA",
    productValue: 24990.0,
    reason: "DAMAGED",
    condition: "DAMAGED",
    description: "Sony WH-1000XM5 Wireless Headphones headband snapped in half during transit and earcups dented.",
    imagePreset: "damaged",
    imageName: "damaged_headphones_evidence.jpg",
    whyThisMatters:
      "Solves the 'clean on my store, abusive on yours' blind spot: Customers who exploit return policies across multiple platforms are intercepted via privacy-preserving consortium intelligence.",
  },
];
