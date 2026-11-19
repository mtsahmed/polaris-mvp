import type { DealType } from "@/lib/types";
import type { CriteriaSets, CriterionRating, FitBand, Knockout, Recommendation } from "./fit";

export type { Recommendation };

export type BriefStatus = "researching" | "ready" | "insufficient_evidence" | "failed";

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
  // The active goal's ratings (or the legacy five for briefs made before 16 November 2026).
  criteria: CriterionRating[];
  // Null on legacy briefs. The goal the brief is scored for, what the AI suggested and why.
  deal_goal: DealType | null;
  deal_goal_suggested: DealType | null;
  deal_goal_reason: string | null;
  // Both criteria sets, so changing the goal re-scores without a new AI call. Null on legacy briefs.
  criteria_sets: CriteriaSets | null;
  // Knockout rules the research found to apply, each with its source.
  knockouts: Knockout[];
  fit_known: number | null; // criteria with sourced evidence in the active set
  fit_case: string | null; // one sentence: strongest reason for and against
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
  updated_at?: string; // migration 20261128000000
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
