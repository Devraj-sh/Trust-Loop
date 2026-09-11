/**
 * TrustLoop ML engine.
 *
 * The models were trained in the uploaded Smart Return Risk Analytics project
 * (scikit-learn / XGBoost). Their learned parameters were exported verbatim to
 * JSON and are evaluated here. Nothing is retrained or approximated: the same
 * feature columns, medians, splits and coefficients produce the same scores.
 */
import featuresArtifact from "./artifacts/features.json";
import lrArtifact from "./artifacts/lr.json";
import dtArtifact from "./artifacts/dt.json";
import xgbArtifact from "./artifacts/xgb.json";

export const FEATURE_COLUMNS: string[] = featuresArtifact.featureColumns;
export const FEATURE_MEDIANS: Record<string, number> = featuresArtifact.medians;

export type FeatureVector = Record<string, number>;

export type ModelKey = "xgboost" | "logistic_regression" | "decision_tree";

export interface ModelMeta {
  key: ModelKey;
  label: string;
  algorithm: string;
  runnable: boolean;
}

export const MODELS: ModelMeta[] = [
  {
    key: "xgboost",
    label: "XGBoost",
    algorithm: "Gradient boosted trees (139 trees)",
    runnable: true,
  },
  {
    key: "logistic_regression",
    label: "Logistic Regression",
    algorithm: "Standardised linear model",
    runnable: true,
  },
  { key: "decision_tree", label: "Decision Tree", algorithm: "Single CART tree", runnable: true },
];

export const RISK_THRESHOLDS = { low: 0.3, medium: 0.6, high: 0.8 } as const;

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export function riskLevel(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.medium) return "HIGH";
  if (score >= RISK_THRESHOLDS.low) return "MEDIUM";
  return "LOW";
}

export interface FeatureContribution {
  feature: string;
  value: number;
  contribution: number;
}

export interface ModelResult {
  riskScore: number;
  riskLevel: RiskLevel;
  prediction: "RETURN_RISK" | "NO_RETURN_RISK";
  confidence: number;
  model: ModelKey;
  modelLabel: string;
  contributions: FeatureContribution[];
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function toArray(features: FeatureVector): number[] {
  return FEATURE_COLUMNS.map((c) => {
    const v = features[c];
    return Number.isFinite(v) ? (v as number) : (FEATURE_MEDIANS[c] ?? 0);
  });
}

/* ---------------------------------- logistic ---------------------------------- */

function predictLogistic(x: number[]): { p: number; contributions: FeatureContribution[] } {
  const a = lrArtifact;
  let margin = a.intercept;
  const contributions: FeatureContribution[] = [];
  for (let i = 0; i < x.length; i++) {
    const z = (x[i]! - a.mean[i]!) / (a.scale[i]! || 1);
    const c = z * a.coef[i]!;
    margin += c;
    contributions.push({ feature: FEATURE_COLUMNS[i]!, value: x[i]!, contribution: c });
  }
  return { p: sigmoid(margin), contributions };
}

/* ------------------------------- sklearn CART -------------------------------- */

interface SkTree {
  children_left: number[];
  children_right: number[];
  feature: number[];
  threshold: number[];
  value: number[];
  weighted_n: number[];
}

function predictSkTree(tree: SkTree, x: number[]) {
  const contributions = new Map<number, number>();
  let node = 0;
  let prev = tree.value[0]!;
  while (tree.children_left[node] !== -1) {
    const f = tree.feature[node]!;
    node = x[f]! <= tree.threshold[node]! ? tree.children_left[node]! : tree.children_right[node]!;
    const cur = tree.value[node]!;
    contributions.set(f, (contributions.get(f) ?? 0) + (cur - prev));
    prev = cur;
  }
  return { p: prev, contributions };
}

/* ----------------------------------- xgboost ---------------------------------- */

interface XgbNode {
  nodeid: number;
  split?: string;
  split_condition?: number;
  yes?: number;
  no?: number;
  missing?: number;
  cover: number;
  leaf?: number;
  children?: XgbNode[];
}

const nodeValueCache = new WeakMap<XgbNode, number>();

/** Cover-weighted average leaf value of a subtree (used for path contributions). */
function nodeValue(node: XgbNode): number {
  const cached = nodeValueCache.get(node);
  if (cached !== undefined) return cached;
  let v: number;
  if (node.leaf !== undefined) {
    v = node.leaf;
  } else {
    const [a, b] = node.children as [XgbNode, XgbNode];
    const total = a.cover + b.cover || 1;
    v = (nodeValue(a) * a.cover + nodeValue(b) * b.cover) / total;
  }
  nodeValueCache.set(node, v);
  return v;
}

function predictXgb(x: number[], byName: Record<string, number>) {
  const trees = xgbArtifact.trees as unknown as XgbNode[];
  let margin = Math.log(xgbArtifact.baseScore / (1 - xgbArtifact.baseScore));
  const contributions = new Map<string, number>();
  for (const root of trees) {
    let node = root;
    let prev = nodeValue(node);
    while (node.leaf === undefined) {
      const children = node.children as XgbNode[];
      const value = byName[node.split!];
      // XGBoost compares in float32; match it exactly or boundary splits diverge.
      const goYes =
        value === undefined
          ? node.missing === node.yes
          : Math.fround(value) < Math.fround(node.split_condition!);
      const nextId = goYes ? node.yes! : node.no!;
      const next = children.find((c) => c.nodeid === nextId)!;
      const cur = nodeValue(next);
      contributions.set(node.split!, (contributions.get(node.split!) ?? 0) + (cur - prev));
      prev = cur;
      node = next;
    }
    margin += node.leaf!;
  }
  void x;
  return { p: sigmoid(margin), contributions };
}

/* ------------------------------------ api ------------------------------------- */

export function runModel(features: FeatureVector, model: ModelKey = "xgboost"): ModelResult {
  const x = toArray(features);
  const byName: Record<string, number> = {};
  FEATURE_COLUMNS.forEach((c, i) => (byName[c] = x[i]!));

  let p = 0;
  let contributions: FeatureContribution[] = [];

  if (model === "logistic_regression") {
    const r = predictLogistic(x);
    p = r.p;
    contributions = r.contributions;
  } else if (model === "decision_tree") {
    const r = predictSkTree(dtArtifact.tree as SkTree, x);
    p = r.p;
    contributions = [...r.contributions.entries()].map(([f, c]) => ({
      feature: FEATURE_COLUMNS[f]!,
      value: x[f]!,
      contribution: c,
    }));
  } else {
    const r = predictXgb(x, byName);
    p = r.p;
    contributions = [...r.contributions.entries()].map(([f, c]) => ({
      feature: f,
      value: byName[f] ?? 0,
      contribution: c,
    }));
  }

  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const meta = MODELS.find((m) => m.key === model)!;
  return {
    riskScore: p,
    riskLevel: riskLevel(p),
    prediction: p >= RISK_THRESHOLDS.low ? "RETURN_RISK" : "NO_RETURN_RISK",
    // Distance from the decision boundary, expressed as a 0-1 confidence.
    confidence: Math.min(1, Math.abs(p - 0.5) * 2),
    model,
    modelLabel: meta.label,
    contributions: contributions.slice(0, 12),
  };
}
