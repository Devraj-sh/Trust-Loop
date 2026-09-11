import type { ConditionCode, ReasonCode } from "./domain";

export interface DemoScenario {
  id: string;
  name: string;
  tag: string;
  badgeTone: "positive" | "caution" | "critical" | "brand";
  headline: string;
  summary: string;
  expectedOutcome: "AUTO_APPROVE" | "DECLINE" | "MANUAL_REVIEW" | "REFUND_ON_INSPECTION";
  expectedOutcomeLabel: string;
  orderId: string;
  orderExternalId: string;
  customerCity: string;
  customerState: string;
  productValue: number;
  reason: ReasonCode;
  condition: ConditionCode;
  description: string;
  imagePreset: "no_damage" | "damaged" | null;
  imageName?: string;
  whyThisMatters: string;
}

// Clean embedded base64 SVG/PNG data for standalone, reliable demo execution
const SVG_PRISTINE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="100%" height="100%" fill="%230f172a"/>
  <rect x="30" y="30" width="340" height="240" rx="16" fill="%231e293b" stroke="%23334155" stroke-width="2"/>
  <circle cx="200" cy="130" r="60" fill="%230284c7" opacity="0.15"/>
  <path d="M160 140 C160 100 240 100 240 140" fill="none" stroke="%2338bdf8" stroke-width="6" stroke-linecap="round"/>
  <rect x="150" y="130" width="20" height="40" rx="8" fill="%230284c7"/>
  <rect x="230" y="130" width="20" height="40" rx="8" fill="%230284c7"/>
  <text x="200" y="220" fill="%2394a3b8" font-family="system-ui,sans-serif" font-size="13" font-weight="600" text-anchor="middle">DEMO_PRESET_NO_DAMAGE</text>
  <text x="200" y="240" fill="%2322c55e" font-family="system-ui,sans-serif" font-size="12" font-weight="500" text-anchor="middle">✓ Factory Surface Clean · No Visible Defects</text>
</svg>`;

const SVG_DAMAGED = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="100%" height="100%" fill="%23180f14"/>
  <rect x="30" y="30" width="340" height="240" rx="16" fill="%2326131c" stroke="%234c1d24" stroke-width="2"/>
  <path d="M150 70 L210 145 L180 190 L260 230" fill="none" stroke="%23ef4444" stroke-width="3" stroke-linecap="round"/>
  <path d="M210 145 L255 110" fill="none" stroke="%23ef4444" stroke-width="2" stroke-linecap="round"/>
  <circle cx="210" cy="145" r="5" fill="%23ef4444"/>
  <text x="200" y="220" fill="%23f87171" font-family="system-ui,sans-serif" font-size="13" font-weight="600" text-anchor="middle">DEMO_PRESET_DAMAGED</text>
  <text x="200" y="240" fill="%23ef4444" font-family="system-ui,sans-serif" font-size="12" font-weight="500" text-anchor="middle">⚠ Structural Impact Fracture Detected</text>
</svg>`;

// Convert SVG data URI to simulated base64 payload
function toBase64Payload(svgDataUri: string, tag: string) {
  const clean = svgDataUri;
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
    id: "scenario-4-conflict",
    name: "Scenario 4 — Evidence Conflict (Hero Scenario)",
    tag: "HERO SCENARIO",
    badgeTone: "critical",
    headline: "Customer claims severe transit damage, but visual analysis finds pristine hardware.",
    summary:
      "Consumer files a return claiming 'Arrived Damaged'. The ML model identifies risk signals, policy permits return, but AI vision detects 0% damage. Signals directly conflict, so TrustLoop refuses to blindly reject and routes to human investigation.",
    expectedOutcome: "MANUAL_REVIEW",
    expectedOutcomeLabel: "Human Investigation (Evidence Conflict)",
    orderId: "5e1a9a20-5d9e-5019-97a6-19ddf02b72f1",
    orderExternalId: "e481f51cbdc54678b7cc49136f2d6af7",
    customerCity: "sao paulo",
    customerState: "SP",
    productValue: 29.99,
    reason: "DAMAGED",
    condition: "DAMAGED",
    description: "Item arrived crushed in the box with severe chassis crack and shattered display.",
    imagePreset: "no_damage",
    imageName: "customer_proof_photo_1.jpg (Clean hardware)",
    whyThisMatters:
      "Demonstrates responsible AI. Rather than an irreversible automated decline or blind approval, TrustLoop highlights the exact conflict between claim and photo, protecting both merchant revenue and customer trust.",
  },
  {
    id: "scenario-1-trusted",
    name: "Scenario 1 — Trusted Return (Aligned Positive)",
    tag: "AUTO APPROVAL",
    badgeTone: "positive",
    headline: "Loyal customer with clean history returning an unopened item within window.",
    summary:
      "Order delivered on schedule to an established customer. Reason is change of mind with item in factory condition. All four evidence pillars align with low risk, triggering immediate automated approval.",
    expectedOutcome: "AUTO_APPROVE",
    expectedOutcomeLabel: "Auto Approve (All Evidence Aligned)",
    orderId: "46fe78f3-f5aa-5521-9e25-468c60a01606",
    orderExternalId: "ad21c59c0840e6cb83a9ceb5573f8159",
    customerCity: "santo andre",
    customerState: "SP",
    productValue: 19.9,
    reason: "CHANGED_MIND",
    condition: "UNOPENED",
    description: "Bought the wrong color variation for a gift. Box is completely sealed and unhandled.",
    imagePreset: "no_damage",
    imageName: "sealed_box_evidence.jpg",
    whyThisMatters:
      "Eliminates manual review overhead for provably safe claims without sacrificing security controls.",
  },
  {
    id: "scenario-2-policy",
    name: "Scenario 2 — Policy Violation (Blocking Rule)",
    tag: "POLICY BLOCK",
    badgeTone: "caution",
    headline: "Customer attempts change-of-mind return on heavily used, unboxed merchandise.",
    summary:
      "Merchant policy explicitly mandates that change-of-mind returns must be in unopened or like-new condition. The condition rule blocks the claim outright with an auditable rule reason.",
    expectedOutcome: "DECLINE",
    expectedOutcomeLabel: "Decline (Policy Violation)",
    orderId: "953f98b0-316c-5fc9-a436-caa9025bff41",
    orderExternalId: "47770eb9100c2d0c44946d9cf07ec65d",
    customerCity: "vianopolis",
    customerState: "GO",
    productValue: 159.9,
    reason: "CHANGED_MIND",
    condition: "USED",
    description: "Decided I do not need this anymore after using it for a couple weeks.",
    imagePreset: null,
    whyThisMatters:
      "Shows hard compliance guards operating before probabilistic ML models, preventing policy drift.",
  },
  {
    id: "scenario-3-suspicious",
    name: "Scenario 3 — Suspicious Return (High Risk Investigation)",
    tag: "RISK ESCALATION",
    badgeTone: "caution",
    headline: "High-value return with elevated model risk requiring physical warehouse inspection.",
    summary:
      "Higher price point order with elevated delivery friction and high model risk. The photo corroborates damage, but because order value exceeds inspection thresholds, TrustLoop routes to refund-on-inspection.",
    expectedOutcome: "REFUND_ON_INSPECTION",
    expectedOutcomeLabel: "Refund on Inspection (High Value / Risk)",
    orderId: "9ff7e204-2947-5087-896f-57d324cd3c0a",
    orderExternalId: "53cdb2fc8bc7dce0b6741e2150273451",
    customerCity: "barreiras",
    customerState: "BA",
    productValue: 118.7,
    reason: "DEFECTIVE",
    condition: "DAMAGED",
    description: "Device sparked upon plugging in and outer housing shows scorch marks.",
    imagePreset: "damaged",
    imageName: "scorch_damage_evidence.jpg",
    whyThisMatters:
      "Protects high-value merchandise from automated refund loss while maintaining fair dispute resolution.",
  },
];
