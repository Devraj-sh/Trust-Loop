/**
 * TrustLoop 2.0 In-Memory Resilient Data Store
 * Provides seamless local/offline execution when Supabase is not configured.
 * Seeded with deterministically anchored orders from Olist historical dataset,
 * demo fraud rings, and audit trails.
 */

import ordersSample from "./data/orders_sample.json";
import customersSample from "./data/customers_sample.json";
import categoriesSample from "./data/categories.json";
import { evaluateNetworkRisk } from "./network";
import { calculateGeoAdjustment } from "./geo";
import { calculateInvestigationScore } from "./fusion";

export interface MockReturnRecord {
  id: string;
  reference: string;
  orderId: string;
  orderRef: string;
  orderValue: number;
  reason: string;
  condition: string;
  status: string;
  createdAt: string;
  riskScore: number;
  riskLevel: string;
  trustScore: number;
  currentDecision: string;
  decisionSource: string;
  decidedByHuman: boolean;
  networkRisk: number;
  ringId: string | null;
  isRingConnected: boolean;
  prediction?: any;
  policy?: any;
  behaviour?: any;
  fusion?: any;
  decisions?: any[];
  vision?: any;
  imageUrl?: string | null;
  reviews?: any[];
  events?: any[];
}

export interface MockAuditEvent {
  id: string;
  stage: string;
  actor: string;
  actorName: string;
  summary: string;
  payload: any;
  createdAt: string;
  returnId: string;
  reference: string;
}

// Global in-memory state
const mockReturns: Map<string, MockReturnRecord> = new Map();
const mockAuditEvents: MockAuditEvent[] = [];

// Initialize seed data
function initializeMockStore() {
  if (mockReturns.size > 0) return;

  const heroOrder = (ordersSample as any[]).find(
    (o) => o.id === "5e1a9a20-5d9e-5019-97a6-19ddf02b72f1" || o.external_id === "e481f51cbdc54678b7cc49136f2d6af7",
  ) || (ordersSample as any[])[0];

  const normalOrder = (ordersSample as any[])[1];
  const inspOrder = (ordersSample as any[])[2];

  // 1. Hero return (connected to Fraud Ring TL-RING-001)
  const heroId = "5e1a9a20-5d9e-5019-97a6-19ddf02b72f1";
  const heroReturn: MockReturnRecord = {
    id: heroId,
    reference: "RET-HERO-001",
    orderId: heroOrder.id,
    orderRef: heroOrder.external_id,
    orderValue: Number(heroOrder.total_price),
    reason: "DAMAGED",
    condition: "DAMAGED",
    status: "IN_REVIEW",
    createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    riskScore: 0.42,
    riskLevel: "MEDIUM",
    trustScore: 74,
    currentDecision: "MANUAL_REVIEW",
    decisionSource: "SYSTEM",
    decidedByHuman: false,
    networkRisk: 91,
    ringId: "TL-RING-001",
    isRingConnected: true,
    prediction: {
      risk_score: 0.42,
      risk_level: "MEDIUM",
      model_label: "XGBoost Classifier",
      confidence: 0.88,
      contributions: [
        { feature: "num_items", value: 1, contribution: 0.05 },
        { feature: "freight_ratio", value: 0.29, contribution: 0.12 },
        { feature: "actual_delivery_days", value: 8.4, contribution: -0.08 },
        { feature: "review_score", value: 4, contribution: -0.15 },
      ],
    },
    policy: {
      eligible: true,
      window_days_remaining: 18,
      rules: [
        { name: "30-Day Return Window", passed: true, details: "Within 30-day window (18 days remaining)" },
        { name: "Condition Eligibility", passed: true, details: "DAMAGED acceptable for transit claim" },
      ],
    },
    behaviour: {
      behaviourScore: 0.31,
      signals: [
        { code: "FREQ_ORDER", severity: "LOW", message: "2 past orders recorded" },
        { code: "BURST_ATTEMPT", severity: "MEDIUM", message: "Account created within 48h of return window closure" },
      ],
    },
    fusion: {
      trustScore: 74,
      agreement: 0.85,
      evidence: [
        { source: "ml_model", riskScore: 0.42, weight: 0.35, confidence: 0.88 },
        { source: "policy", riskScore: 0.1, weight: 0.2, confidence: 0.99 },
        { source: "behaviour", riskScore: 0.31, weight: 0.25, confidence: 0.75 },
        { source: "vision", riskScore: 0.78, weight: 0.2, confidence: 0.82 },
      ],
      conflicts: [
        "Customer claim ('Transit Impact Crushed') conflicts with visual inspection (unopened retail packaging, zero carton perforation).",
      ],
    },
    decisions: [
      {
        outcome: "MANUAL_REVIEW",
        source: "SYSTEM",
        confidence: 0.88,
        is_current: true,
        created_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
        rationale: [
          "Elevated network risk (+25) from connection to Fraud Ring TL-RING-001.",
          "Visual evidence conflict observed: claim of structural transit damage not supported by packaging photo.",
          "Routed to Human Fraud Specialist queue for multi-account investigation.",
        ],
      },
    ],
    vision: {
      matches_claim: false,
      observed_condition: "Minor cosmetic corner scuff, packaging intact",
      damage_score: 0.18,
      summary: "Customer claimed severe impact destruction. Photo shows undamaged outer retail carton.",
      provider: "GEMINI_2_FLASH",
      is_fallback: false,
    },
    imageUrl: null,
    reviews: [],
    events: [
      {
        id: "evt-01",
        stage: "intake",
        actor: "SYSTEM",
        actorName: "TrustLoop Ingestion",
        summary: "Return request RET-HERO-001 submitted for order e481f51cbdc54678b7cc49136f2d6af7.",
        payload: { reason: "DAMAGED", orderRef: heroOrder.external_id },
        createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
        returnId: heroId,
        reference: "RET-HERO-001",
      },
      {
        id: "evt-02",
        stage: "model",
        actor: "SYSTEM",
        actorName: "ML Engine",
        summary: "XGBoost Classifier scored 42.0% return risk (MEDIUM).",
        payload: { model: "xgboost", riskScore: 0.42 },
        createdAt: new Date(Date.now() - 3600 * 1000 * 2 + 100).toISOString(),
        returnId: heroId,
        reference: "RET-HERO-001",
      },
      {
        id: "evt-03",
        stage: "network_analysis",
        actor: "SYSTEM",
        actorName: "Fraud Ring Intelligence",
        summary: "Linked to fraud ring TL-RING-001: 91% network risk (+25 bounded adjustment points). 8 accounts sharing 3 devices.",
        payload: { networkRisk: 91, ringId: "TL-RING-001", connectedAccounts: 8 },
        createdAt: new Date(Date.now() - 3600 * 1000 * 2 + 200).toISOString(),
        returnId: heroId,
        reference: "RET-HERO-001",
      },
      {
        id: "evt-04",
        stage: "geo_analysis",
        actor: "SYSTEM",
        actorName: "Geo Hotspot Engine",
        summary: "Origin area São Paulo (SP): Hotspot Score 82/100 (HIGH RISK). Added +12 risk adjustment points.",
        payload: { hotspotScore: 82, area: "São Paulo (SP)", adjustment: 12 },
        createdAt: new Date(Date.now() - 3600 * 1000 * 2 + 300).toISOString(),
        returnId: heroId,
        reference: "RET-HERO-001",
      },
      {
        id: "evt-05",
        stage: "risk_adjustment",
        actor: "SYSTEM",
        actorName: "Multi-Pillar Evidence Fusion",
        summary: "Layered Score: 89/100 (HIGH priority). Base ML: 42, Geo: +12, Network: +25, Conflict: +10.",
        payload: { finalScore: 89, priority: "HIGH" },
        createdAt: new Date(Date.now() - 3600 * 1000 * 2 + 400).toISOString(),
        returnId: heroId,
        reference: "RET-HERO-001",
      },
      {
        id: "evt-06",
        stage: "decision",
        actor: "SYSTEM",
        actorName: "Decision Arbiter",
        summary: "System decision: MANUAL_REVIEW (Confidence 88%). Flagged for investigation.",
        payload: { outcome: "MANUAL_REVIEW", confidence: 0.88 },
        createdAt: new Date(Date.now() - 3600 * 1000 * 2 + 500).toISOString(),
        returnId: heroId,
        reference: "RET-HERO-001",
      },
    ],
  };

  mockReturns.set(heroId, heroReturn);
  mockAuditEvents.push(...heroReturn.events!);

  // 2. Normal Low-Risk Return
  if (normalOrder) {
    const normalId = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";
    const normalReturn: MockReturnRecord = {
      id: normalId,
      reference: "RET-NORM-042",
      orderId: normalOrder.id,
      orderRef: normalOrder.external_id,
      orderValue: Number(normalOrder.total_price),
      reason: "SIZE_FIT",
      condition: "UNOPENED",
      status: "RESOLVED",
      createdAt: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
      riskScore: 0.14,
      riskLevel: "LOW",
      trustScore: 92,
      currentDecision: "AUTO_APPROVE",
      decisionSource: "SYSTEM",
      decidedByHuman: false,
      networkRisk: 12,
      ringId: null,
      isRingConnected: false,
      prediction: {
        risk_score: 0.14,
        risk_level: "LOW",
        model_label: "XGBoost Classifier",
        confidence: 0.94,
        contributions: [],
      },
      policy: { eligible: true, window_days_remaining: 24, rules: [] },
      behaviour: { behaviourScore: 0.05, signals: [] },
      fusion: { trustScore: 92, agreement: 0.95, evidence: [], conflicts: [] },
      decisions: [
        {
          outcome: "AUTO_APPROVE",
          source: "SYSTEM",
          confidence: 0.95,
          is_current: true,
          created_at: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
          rationale: ["Pristine buyer history", "No network connections", "Eligible policy window"],
        },
      ],
      vision: null,
      imageUrl: null,
      reviews: [],
      events: [
        {
          id: "evt-norm-01",
          stage: "decision",
          actor: "SYSTEM",
          actorName: "Decision Arbiter",
          summary: "System decision: AUTO_APPROVE. Fast-tracked for refund processing.",
          payload: { outcome: "AUTO_APPROVE" },
          createdAt: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
          returnId: normalId,
          reference: "RET-NORM-042",
        },
      ],
    };
    mockReturns.set(normalId, normalReturn);
    mockAuditEvents.push(...normalReturn.events!);
  }

  // 3. Medium-High Inspection Return
  if (inspOrder) {
    const inspId = "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e";
    const inspReturn: MockReturnRecord = {
      id: inspId,
      reference: "RET-INSP-089",
      orderId: inspOrder.id,
      orderRef: inspOrder.external_id,
      orderValue: Number(inspOrder.total_price),
      reason: "DEFECTIVE",
      condition: "USED",
      status: "IN_REVIEW",
      createdAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
      riskScore: 0.65,
      riskLevel: "HIGH",
      trustScore: 48,
      currentDecision: "REFUND_ON_INSPECTION",
      decisionSource: "SYSTEM",
      decidedByHuman: false,
      networkRisk: 64,
      ringId: "TL-RING-002",
      isRingConnected: true,
      prediction: {
        risk_score: 0.65,
        risk_level: "HIGH",
        model_label: "XGBoost Classifier",
        confidence: 0.81,
        contributions: [],
      },
      policy: { eligible: true, window_days_remaining: 5, rules: [] },
      behaviour: { behaviourScore: 0.45, signals: [] },
      fusion: { trustScore: 48, agreement: 0.72, evidence: [], conflicts: ["Used condition on technical product"] },
      decisions: [
        {
          outcome: "REFUND_ON_INSPECTION",
          source: "SYSTEM",
          confidence: 0.84,
          is_current: true,
          created_at: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
          rationale: ["Defect claim on used item requires warehouse bench testing prior to refund."],
        },
      ],
      vision: null,
      imageUrl: null,
      reviews: [],
      events: [
        {
          id: "evt-insp-01",
          stage: "decision",
          actor: "SYSTEM",
          actorName: "Decision Arbiter",
          summary: "System decision: REFUND_ON_INSPECTION. Warehouse testing mandated.",
          payload: { outcome: "REFUND_ON_INSPECTION" },
          createdAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
          returnId: inspId,
          reference: "RET-INSP-089",
        },
      ],
    };
    mockReturns.set(inspId, inspReturn);
    mockAuditEvents.push(...inspReturn.events!);
  }
}

// Public API for Mock Store
export function getMockOverview() {
  initializeMockStore();
  const returnList = Array.from(mockReturns.values());

  const decisionCounts: Record<string, number> = {
    AUTO_APPROVE: 89,
    MANUAL_REVIEW: 27,
    REFUND_ON_INSPECTION: 19,
    DECLINE: 7,
  };

  for (const r of returnList) {
    if (r.currentDecision && decisionCounts[r.currentDecision] !== undefined) {
      decisionCounts[r.currentDecision] = (decisionCounts[r.currentDecision] || 0) + 1;
    }
  }

  return {
    historicalOrders: (ordersSample as any[]).length, // 4,981
    historicalCustomers: (customersSample as any[]).length, // 4,981
    totalReturns: 142 + returnList.length,
    decisionCounts,
    automationRate: 0.68,
    humanReviews: 34,
    agreementRate: 0.91,
    riskBands: { LOW: 98, MEDIUM: 31, HIGH: 13 },
    avgRisk: 0.32,
    evidenceConflicts: 31,
    policyViolations: 12,
    humanEscalations: decisionCounts["MANUAL_REVIEW"] || 27,
    // TrustLoop 2.0 Command Center Executive KPIs
    returnsAnalyzed: (ordersSample as any[]).length, // 4,981
    highRiskReturns: 27,
    activeFraudRingsCount: 8,
    riskHotspotsCount: 5,
    refundExposureTotal: 148500, // ₹12.4L equivalent
  };
}

export function listMockReturns(onlyReviewable = false, limit = 50) {
  initializeMockStore();
  let list = Array.from(mockReturns.values());
  if (onlyReviewable) {
    list = list.filter((r) => r.currentDecision === "MANUAL_REVIEW" && !r.decidedByHuman);
  }
  return list.slice(0, limit);
}

export function getMockReturn(id: string) {
  initializeMockStore();
  const found = mockReturns.get(id);
  if (!found) {
    // If querying an order directly, check if we can synthesize a return view for it
    const order = (ordersSample as any[]).find((o) => o.id === id || o.external_id === id);
    if (!order) return null;

    const customer = (customersSample as any[]).find((c) => c.id === order.customer_id) || order.customers;
    const category = (categoriesSample as any[]).find((c) => c.code === order.category_code);
    const net = evaluateNetworkRisk(order.id || order.external_id);
    const geo = calculateGeoAdjustment(customer?.state);
    const inv = calculateInvestigationScore({
      baseTrustScore: 65,
      modelRiskScore: 0.35,
      network: net,
      geo,
      conflictsCount: 0,
    });

    return {
      request: {
        id,
        reference: `RET-${order.external_id.slice(0, 8).toUpperCase()}`,
        order_id: order.id,
        reason_code: "DAMAGED",
        claimed_condition: "DAMAGED",
        status: "IN_REVIEW",
        created_at: new Date().toISOString(),
        orders: { ...order, customers: customer, product_categories: category },
      },
      prediction: {
        risk_score: 0.35,
        risk_level: "MEDIUM",
        model_label: "XGBoost Classifier",
        confidence: 0.85,
        contributions: [],
      },
      policy: { eligible: true, window_days_remaining: 14, rules: [] },
      behaviour: { behaviourScore: 0.25, signals: [] },
      fusion: { trustScore: 65, agreement: 0.8, evidence: [], conflicts: [] },
      decisions: [{ outcome: "MANUAL_REVIEW", source: "SYSTEM", confidence: 0.85, is_current: true }],
      vision: null,
      imageUrl: null,
      reviews: [],
      events: [],
      network: net,
      geo,
      investigation: inv,
    };
  }

  // Find order context
  const foundOrder = (ordersSample as any[]).find((o) => o.id === found.orderId || o.external_id === found.orderRef);
  const foundCustomer = foundOrder
    ? (customersSample as any[]).find((c) => c.id === foundOrder.customer_id) || foundOrder.customers
    : null;
  const foundCategory = foundOrder
    ? (categoriesSample as any[]).find((c) => c.code === foundOrder.category_code)
    : null;

  const net = evaluateNetworkRisk(found.orderId || found.orderRef);
  const geo = calculateGeoAdjustment(foundCustomer?.state);
  const inv = calculateInvestigationScore({
    baseTrustScore: found.trustScore,
    modelRiskScore: found.riskScore,
    network: net,
    geo,
    conflictsCount: found.fusion?.conflicts?.length || 0,
  });

  return {
    request: {
      id: found.id,
      reference: found.reference,
      order_id: found.orderId,
      reason_code: found.reason,
      claimed_condition: found.condition,
      status: found.status,
      created_at: found.createdAt,
      orders: foundOrder ? { ...foundOrder, customers: foundCustomer, product_categories: foundCategory } : null,
    },
    prediction: found.prediction,
    policy: found.policy,
    behaviour: found.behaviour,
    fusion: found.fusion,
    decisions: found.decisions || [],
    vision: found.vision,
    imageUrl: found.imageUrl,
    reviews: found.reviews || [],
    events: found.events || [],
    network: net,
    geo,
    investigation: inv,
  };
}

export function saveMockReturn(record: MockReturnRecord, auditTrail: MockAuditEvent[]) {
  mockReturns.set(record.id, record);
  mockAuditEvents.unshift(...auditTrail);
}

export function saveMockReview(returnId: string, verdict: string, reviewerName: string, notes?: string) {
  const existing = mockReturns.get(returnId);
  if (existing) {
    existing.currentDecision = verdict;
    existing.decidedByHuman = true;
    existing.status = "RESOLVED";
    if (!existing.reviews) existing.reviews = [];
    existing.reviews.unshift({
      id: `rev-${Date.now()}`,
      reviewer_name: reviewerName,
      verdict,
      notes: notes || null,
      agreed_with_system: existing.currentDecision === verdict,
      created_at: new Date().toISOString(),
    });
    if (!existing.decisions) existing.decisions = [];
    existing.decisions.unshift({
      outcome: verdict,
      source: "HUMAN",
      confidence: 1,
      rationale: [`Human investigator ${reviewerName} resolved case to ${verdict}.`, ...(notes ? [notes] : [])],
      is_current: true,
      created_at: new Date().toISOString(),
    });

    const evt: MockAuditEvent = {
      id: `evt-rev-${Date.now()}`,
      stage: "human_review",
      actor: "HUMAN",
      actorName: reviewerName,
      summary: `Case reviewed and verdict set to ${verdict}.`,
      payload: { verdict, notes },
      createdAt: new Date().toISOString(),
      returnId,
      reference: existing.reference,
    };
    if (!existing.events) existing.events = [];
    existing.events.push(evt);
    mockAuditEvents.unshift(evt);
  }
}

export function listMockAuditEvents(limit = 120): MockAuditEvent[] {
  initializeMockStore();
  return mockAuditEvents.slice(0, limit);
}
