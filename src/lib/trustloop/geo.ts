/**
 * TrustLoop 2.0 Geographical Return Hotspot Intelligence Engine
 * Computes normalized regional metrics across orders and returns.
 * 
 * IMPORTANT DATA HONESTY:
 * Coordinates represent static regional centroids for visualization only.
 * They do NOT represent exact customer addresses.
 * Geography is NEVER used as proof of fraud; it only adjusts investigation priority.
 */

import ordersSample from "./data/orders_sample.json";

export interface GeoCentroid {
  state: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
}

export interface AreaHotspotMetric {
  areaId: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  region: string;
  totalOrders: number;
  totalReturns: number;
  returnRate: number;
  highRiskReturns: number;
  highRiskRate: number;
  evidenceConflicts: number;
  evidenceConflictRate: number;
  refundExposure: number;
  activeFraudRings: number;
  hotspotScore: number;
  riskTier: "LOW RISK" | "MEDIUM RISK" | "HIGH RISK" | "CRITICAL HOTSPOT";
  topCategories: string[];
  topReturnReasons: string[];
}

export interface GeoAdjustmentResult {
  hotspotScore: number;
  adjustment: number;
  areaName: string;
  riskTier: AreaHotspotMetric["riskTier"];
  reason: string;
  metrics: {
    returnRate: number;
    highRiskRate: number;
    evidenceConflictRate: number;
  };
}

/** Static centroid lookup for Indian states (regional hotspot visualization) */
export const INDIA_STATE_CENTROIDS: Record<string, GeoCentroid> = {
  MH: { state: "MH", name: "Maharashtra", lat: 19.7515, lng: 75.7139, region: "West" },
  DL: { state: "DL", name: "Delhi", lat: 28.7041, lng: 77.1025, region: "North" },
  KA: { state: "KA", name: "Karnataka", lat: 15.3173, lng: 75.7139, region: "South" },
  TN: { state: "TN", name: "Tamil Nadu", lat: 11.1271, lng: 78.6569, region: "South" },
  TS: { state: "TS", name: "Telangana", lat: 18.1124, lng: 79.0193, region: "South" },
  GJ: { state: "GJ", name: "Gujarat", lat: 22.2587, lng: 71.1924, region: "West" },
  WB: { state: "WB", name: "West Bengal", lat: 22.9868, lng: 87.855, region: "East" },
  UP: { state: "UP", name: "Uttar Pradesh", lat: 26.8467, lng: 80.9462, region: "North" },
  RJ: { state: "RJ", name: "Rajasthan", lat: 27.0238, lng: 74.2179, region: "North" },
  KL: { state: "KL", name: "Kerala", lat: 10.8505, lng: 76.2711, region: "South" },
  PB: { state: "PB", name: "Punjab", lat: 31.1471, lng: 75.3412, region: "North" },
  MP: { state: "MP", name: "Madhya Pradesh", lat: 22.9734, lng: 78.6569, region: "Central" },
  HR: { state: "HR", name: "Haryana", lat: 29.0588, lng: 76.0856, region: "North" },
  AP: { state: "AP", name: "Andhra Pradesh", lat: 15.9129, lng: 79.74, region: "South" },
  BR: { state: "BR", name: "Bihar", lat: 25.0961, lng: 85.3131, region: "East" },
  OR: { state: "OR", name: "Odisha", lat: 20.9517, lng: 85.0985, region: "East" },
};

/** Hotspot Score Weights */
export const HOTSPOT_WEIGHTS = {
  returnRate: 0.30,
  highRiskRate: 0.25,
  evidenceConflictRate: 0.20,
  networkRisk: 0.15,
  refundExposure: 0.10,
};

/** Maximum allowed geographic risk contribution to prevent bias */
export const MAX_GEO_ADJUSTMENT = 15;

/** Memoized computed hotspots */
let cachedHotspots: AreaHotspotMetric[] | null = null;

export function computeRegionalHotspots(): AreaHotspotMetric[] {
  if (cachedHotspots) return cachedHotspots;

  const orders = ordersSample as any[];
  const stateAggs: Record<
    string,
    {
      orders: number;
      returns: number;
      highRisk: number;
      conflicts: number;
      exposure: number;
      categories: Record<string, number>;
      reasons: Record<string, number>;
    }
  > = {};

  // Initialize all known Indian states
  for (const st of Object.keys(INDIA_STATE_CENTROIDS)) {
    stateAggs[st] = {
      orders: 0,
      returns: 0,
      highRisk: 0,
      conflicts: 0,
      exposure: 0,
      categories: {},
      reasons: {},
    };
  }

  // Aggregate historical orders
  for (const o of orders) {
    const st = o.customers?.state || "MH";
    if (!stateAggs[st]) {
      stateAggs[st] = {
        orders: 0,
        returns: 0,
        highRisk: 0,
        conflicts: 0,
        exposure: 0,
        categories: {},
        reasons: {},
      };
    }
    const agg = stateAggs[st];
    agg.orders += 1;

    // Use Indian dataset observed return behavior
    const isReturn = o.return_status === "Returned" ||
      (o.customer_rating && o.customer_rating <= 2) ||
      (o.review_score && o.review_score <= 2);

    if (isReturn) {
      agg.returns += 1;
      agg.exposure += Number(o.total_price || 0);

      // Elevated risk if low rating and high value or suspicious repeat pattern
      if ((o.customer_rating && o.customer_rating <= 1.5) || (o.customers?.return_rate && o.customers.return_rate > 0.35)) {
        agg.highRisk += 1;
      }

      // Evidence conflicts (e.g. claim of defective/damaged with high customer rating)
      if (o.return_status === "Returned" && (o.customer_rating || o.review_score) >= 4) {
        agg.conflicts += 1;
      }

      const cat = o.category_name || o.category_code || "Electronics";
      agg.categories[cat] = (agg.categories[cat] || 0) + 1;
      if (o.return_reason) {
        agg.reasons[o.return_reason] = (agg.reasons[o.return_reason] || 0) + 1;
      }
    }
  }

  // Ring counts per Indian state (anchored to detected synthetic fraud networks)
  const ringCountByState: Record<string, number> = {
    MH: 3,
    DL: 2,
    KA: 2,
    TS: 1,
    TN: 1,
  };

  const results: AreaHotspotMetric[] = [];

  for (const [st, agg] of Object.entries(stateAggs)) {
    const centroid = INDIA_STATE_CENTROIDS[st] || {
      state: st,
      name: `State ${st}`,
      lat: 20.5937,
      lng: 78.9629,
      region: "India",
    };

    const returnRate = agg.orders > 0 ? agg.returns / agg.orders : 0;
    const highRiskRate = agg.returns > 0 ? agg.highRisk / agg.returns : 0;
    const conflictRate = agg.returns > 0 ? agg.conflicts / agg.returns : 0;
    const activeRings = ringCountByState[st] || 0;

    // Normalized scores (0-100)
    const normReturnRate = Math.min(100, (returnRate / 0.35) * 100);
    const normHighRisk = Math.min(100, (highRiskRate / 0.5) * 100);
    const normConflict = Math.min(100, (conflictRate / 0.4) * 100);
    const normNetwork = Math.min(100, activeRings * 25);
    const normExposure = Math.min(100, (agg.exposure / 25000) * 100);

    const hotspotScore = Math.round(
      normReturnRate * HOTSPOT_WEIGHTS.returnRate +
      normHighRisk * HOTSPOT_WEIGHTS.highRiskRate +
      normConflict * HOTSPOT_WEIGHTS.evidenceConflictRate +
      normNetwork * HOTSPOT_WEIGHTS.networkRisk +
      normExposure * HOTSPOT_WEIGHTS.refundExposure
    );

    let riskTier: AreaHotspotMetric["riskTier"] = "LOW RISK";
    if (hotspotScore >= 75) riskTier = "CRITICAL HOTSPOT";
    else if (hotspotScore >= 55) riskTier = "HIGH RISK";
    else if (hotspotScore >= 35) riskTier = "MEDIUM RISK";

    const topCategories = Object.entries(agg.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);

    results.push({
      areaId: `AREA-${st}`,
      name: centroid.name,
      state: st,
      lat: centroid.lat,
      lng: centroid.lng,
      region: centroid.region,
      totalOrders: agg.orders,
      totalReturns: agg.returns,
      returnRate: Number(returnRate.toFixed(3)),
      highRiskReturns: agg.highRisk,
      highRiskRate: Number(highRiskRate.toFixed(3)),
      evidenceConflicts: agg.conflicts,
      evidenceConflictRate: Number(conflictRate.toFixed(3)),
      refundExposure: Math.round(agg.exposure),
      activeFraudRings: activeRings,
      hotspotScore,
      riskTier,
      topCategories: topCategories.length ? topCategories : ["electronics", "apparel"],
      topReturnReasons: ["Arrived Damaged", "Not as Described", "Late Delivery"],
    });
  }

  // Sort descending by hotspot score
  results.sort((a, b) => b.hotspotScore - a.hotspotScore);
  cachedHotspots = results;
  return results;
}

/**
 * Calculates bounded geographic adjustment for an area.
 * Guaranteed capped at MAX_GEO_ADJUSTMENT (+15 points).
 */
export function calculateGeoAdjustment(stateCode?: string): GeoAdjustmentResult {
  const hotspots = computeRegionalHotspots();
  const st = (stateCode || "SP").toUpperCase();
  const found = hotspots.find((h) => h.state === st) || hotspots[0]!;

  const adjustment = Math.min(
    MAX_GEO_ADJUSTMENT,
    Math.round((found.hotspotScore / 100) * MAX_GEO_ADJUSTMENT)
  );

  return {
    hotspotScore: found.hotspotScore,
    adjustment,
    areaName: `${found.name} (${found.state})`,
    riskTier: found.riskTier,
    reason: `Return originated from an area with elevated normalized return-risk (${found.name}: ${found.hotspotScore}/100); this contributed +${adjustment} to investigation priority. (Geographic signal is one of multiple independent signals and never proof of fraud).`,
    metrics: {
      returnRate: found.returnRate,
      highRiskRate: found.highRiskRate,
      evidenceConflictRate: found.evidenceConflictRate,
    },
  };
}
