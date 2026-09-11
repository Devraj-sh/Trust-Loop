export interface VisionFinding {
  label: string;
  detail: string;
}

export interface VisionResult {
  provider: string;
  model: string;
  isFallback: boolean;
  observedCondition: string | null;
  damageScore: number | null;
  matchesClaim: boolean | null;
  findings: VisionFinding[];
  summary: string;
}
