// Fit score for an intelligence brief (spec 7.5). Pure functions, safe on server and client.
// Five criteria, each rated 0–20 by the AI with a reason and at least one source. A criterion
// with no evidence is "Unknown": it adds 0, is shown as "Unknown", and three or more Unknowns
// mean "Insufficient evidence" with no score at all.

import type { ProfileType } from "@/lib/types";

export const CRITERIA = [
  {
    key: "audience_match",
    label: "Audience match",
    question: "Does the company's target customer overlap with the profile's audience?",
  },
  {
    key: "category_fit",
    label: "Category fit",
    question: "Is the company in an industry or category the ideal customer profile names?",
  },
  {
    key: "partnership_behaviour",
    label: "Partnership behaviour",
    question: "Is there evidence it sponsors, advertises or partners in ways this profile could serve?",
  },
  {
    key: "timing",
    label: "Timing",
    question: "Are there recent signals that make outreach relevant now?",
  },
  {
    key: "practical_fit",
    label: "Practical fit",
    question: "Do size, geography and budget signals suit the profile's offer?",
  },
] as const;

export type CriterionKey = (typeof CRITERIA)[number]["key"];

export const MAX_RATING = 20;
export const INSUFFICIENT_AT_UNKNOWNS = 3;

// Weights per profile type, all 1 for now. Kept in one place so they can be tuned later
// (spec 7.5); there is deliberately no tuning screen. Weighted totals are rescaled to 0–100.
const DEFAULT_WEIGHTS: Record<CriterionKey, number> = {
  audience_match: 1,
  category_fit: 1,
  partnership_behaviour: 1,
  timing: 1,
  practical_fit: 1,
};
export const CRITERIA_WEIGHTS: Partial<Record<ProfileType, Record<CriterionKey, number>>> = {};

export function weightsFor(type: ProfileType | null | undefined): Record<CriterionKey, number> {
  return (type && CRITERIA_WEIGHTS[type]) || DEFAULT_WEIGHTS;
}

// rating: 0–20, or null for Unknown.
export type CriterionRating = { key: CriterionKey; rating: number | null; reason: string; signal_ids: string[] };

export type FitBand = "strong" | "possible" | "weak";

export const BAND_LABEL: Record<FitBand, string> = {
  strong: "Strong fit",
  possible: "Possible fit",
  weak: "Weak fit",
};

export function bandFor(score: number): FitBand {
  if (score >= 70) return "strong";
  if (score >= 40) return "possible";
  return "weak";
}

export function clampRating(r: number | null): number | null {
  if (r === null || !Number.isFinite(r)) return null;
  return Math.max(0, Math.min(MAX_RATING, Math.round(r)));
}

export type FitResult =
  | { kind: "scored"; score: number; band: FitBand; unknown: number }
  | { kind: "insufficient"; unknown: number };

// A criterion counts as known only when it has a rating and at least one source.
export function isKnown(c: Pick<CriterionRating, "rating" | "signal_ids">) {
  return c.rating !== null && c.signal_ids.length > 0;
}

export function computeFit(criteria: CriterionRating[], type?: ProfileType | null): FitResult {
  const weights = weightsFor(type);
  const byKey = new Map(criteria.map((c) => [c.key, c]));
  let unknown = 0;
  let total = 0;
  let max = 0;
  for (const { key } of CRITERIA) {
    const c = byKey.get(key);
    const w = weights[key];
    max += MAX_RATING * w;
    if (!c || !isKnown(c)) {
      unknown++;
      continue;
    }
    total += (clampRating(c.rating) ?? 0) * w;
  }
  if (unknown >= INSUFFICIENT_AT_UNKNOWNS) return { kind: "insufficient", unknown };
  const score = max > 0 ? Math.round((total / max) * 100) : 0;
  return { kind: "scored", score, band: bandFor(score), unknown };
}
