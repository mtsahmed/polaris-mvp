import type { CriterionRating, FitBand } from "./fit";

export type BriefStatus = "researching" | "ready" | "insufficient_evidence" | "failed";
export type Recommendation = "pursue" | "hold" | "skip";

export type SourcedStatement = { statement: string; signal_id: string };
export type TargetRole = { role: string; reason: string };
export type ConceptStarter = { title: string; description: string; signal_ids: string[] };

export type Brief = {
  id: string;
  org_id: string;
  prospect_id: string;
  version: number;
  status: BriefStatus;
  summary: string | null;
  fit_score: number | null;
  fit_band: FitBand | null;
  criteria: CriterionRating[];
  why_now: SourcedStatement[];
  risks: SourcedStatement[];
  recommendation: Recommendation | null;
  recommendation_reason: string | null;
  suggested_angle: string | null;
  target_roles: TargetRole[];
  concept_starters: ConceptStarter[];
  signal_ids: string[];
  error: string | null;
  model: string | null;
  search_count: number | null;
  cost_estimate_usd: number | null;
  researched_at: string | null;
  created_by: string | null;
  created_at: string;
};

export const BRIEF_STALE_DAYS = 30;
// A brief still "researching" after this long is treated as failed (the background job died).
export const RESEARCH_TIMEOUT_MINUTES = 10;

export function effectiveStatus(b: Pick<Brief, "status" | "created_at">, now = Date.now()): BriefStatus {
  if (b.status === "researching" && now - new Date(b.created_at).getTime() > RESEARCH_TIMEOUT_MINUTES * 60_000) {
    return "failed";
  }
  return b.status;
}

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = { pursue: "Pursue", hold: "Hold", skip: "Skip" };
