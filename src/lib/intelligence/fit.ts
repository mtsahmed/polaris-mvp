// Fit score for an intelligence brief (docs/polaris-fit-scoring-plan.md). Pure functions, safe on
// server and client.
//
// Every brief is scored for one deal goal (customer, partnership, referral, co-marketing). The AI
// rates both criteria sets in one pass, customer and partner, so changing the goal only re-runs
// the arithmetic here. Ratings use five anchored steps (0, 5, 10, 15, 20). A criterion with no
// sourced evidence is Unknown and is left out of the score; coverage is shown beside it. Fewer
// than three known criteria give "Insufficient evidence"; exactly three cap the band at Possible.
// Knockouts (set on the ICP) override the score, and the recommendation follows fixed rules.

import type { DealType, ProfileType } from "@/lib/types";

export type CriterionDef = {
  key: string;
  label: string;
  question: string;
  // What 0, 5, 10, 15 and 20 mean for this criterion. Legacy criteria have none.
  anchors?: readonly [string, string, string, string, string];
};

export const CUSTOMER_CRITERIA = [
  {
    key: "problem_match",
    label: "Problem match",
    question: "Does the company have the problem the profile's offer solves?",
    anchors: [
      "evidence they do not have this problem, or already solve it in-house",
      "the problem is possible but nothing shows it",
      "indirect signs of the problem (adjacent needs, related hiring)",
      "clear signs of the problem (they talk about it, hire for it, or buy similar services)",
      "they are actively looking for this kind of solution right now",
    ],
  },
  {
    key: "category_fit",
    label: "Category fit",
    question: "Is the company in an industry or category the ICP names?",
    anchors: [
      "an industry the ICP does not cover",
      "a distant neighbour of an ICP industry",
      "an adjacent industry the ICP could reasonably include",
      "an ICP industry, but not its core segment",
      "exactly the ICP's core industry and segment",
    ],
  },
  {
    key: "size_budget",
    label: "Size and budget",
    question: "Do size, revenue or spending signals suggest they can afford the offer?",
    anchors: [
      "clearly too small or cutting spend",
      "small, with no sign of budget for this",
      "plausible size, budget unclear",
      "the right size, with signs of spending on similar things",
      "the right size and spending on this kind of offer already",
    ],
  },
  {
    key: "practical_fit",
    label: "Geography and practicality",
    question: "Can the profile serve them: geography, language, delivery model?",
    anchors: [
      "outside where the profile can work",
      "serving them would be awkward (far away, different market)",
      "workable with some effort",
      "inside the profile's geography and delivery model",
      "local or ideally placed for the profile",
    ],
  },
  {
    key: "buyer_role",
    label: "Buyer exists",
    question: "Is there a role that would own buying this (for example marketing head, operations lead)?",
    anchors: [
      "no such function exists",
      "the function may exist but nothing shows it",
      "the function exists, owner unclear",
      "a matching role or team is named",
      "a named owner of exactly this area",
    ],
  },
] as const satisfies readonly CriterionDef[];

export const PARTNER_CRITERIA = [
  {
    key: "audience_overlap",
    label: "Audience overlap",
    question: "Does the company reach the same people the profile wants to reach?",
    anchors: [
      "a different audience altogether",
      "slight overlap",
      "partial overlap",
      "large overlap",
      "the same audience",
    ],
  },
  {
    key: "complementary_offer",
    label: "Complementary offer",
    question: "Does the company's offer complement the profile's without competing with it?",
    anchors: [
      "a direct competitor",
      "overlaps with the profile's offer in places",
      "neutral: neither competes nor clearly complements",
      "complements the profile's offer",
      "each side clearly fills a gap in the other's offer",
    ],
  },
  {
    key: "partnership_record",
    label: "Partnership record",
    question: "Does the company sponsor, co-market, refer or partner in ways this profile could join?",
    anchors: [
      "avoids partnerships",
      "no visible partnerships",
      "occasional partnerships of another kind",
      "regular partnerships of a similar kind",
      "a running partner programme the profile fits",
    ],
  },
  {
    key: "brand_fit",
    label: "Brand fit",
    question: "Do the company's brand, values and tone suit being associated with the profile?",
    anchors: [
      "conflicting values or a reputational risk",
      "an awkward match",
      "neutral",
      "a good match",
      "a natural, visible match",
    ],
  },
  {
    key: "practical_fit",
    label: "Practical fit",
    question: "Do size and geography make a partnership workable for both sides?",
    anchors: [
      "unworkable (size or place)",
      "hard to make work",
      "workable with effort",
      "a good practical match",
      "an ideal practical match",
    ],
  },
] as const satisfies readonly CriterionDef[];

// The single set used before 16 November 2026. Kept so older briefs still display correctly.
export const LEGACY_CRITERIA: readonly CriterionDef[] = [
  { key: "audience_match", label: "Audience match", question: "Does the company's target customer overlap with the profile's audience?" },
  { key: "category_fit", label: "Category fit", question: "Is the company in an industry or category the ideal customer profile names?" },
  { key: "partnership_behaviour", label: "Partnership behaviour", question: "Is there evidence it sponsors, advertises or partners in ways this profile could serve?" },
  { key: "timing", label: "Timing", question: "Are there recent signals that make outreach relevant now?" },
  { key: "practical_fit", label: "Practical fit", question: "Do size, geography and budget signals suit the profile's offer?" },
];

export type CriteriaSetKey = "customer" | "partner";
export const CRITERIA_SETS: Record<CriteriaSetKey, readonly CriterionDef[]> = {
  customer: CUSTOMER_CRITERIA,
  partner: PARTNER_CRITERIA,
};

export function setForGoal(goal: DealType): CriteriaSetKey {
  return goal === "customer" ? "customer" : "partner";
}

// The criteria a brief was scored with: its goal's set, or the legacy set for older briefs.
export function criteriaFor(goal: DealType | null | undefined): readonly CriterionDef[] {
  return goal ? CRITERIA_SETS[setForGoal(goal)] : LEGACY_CRITERIA;
}

// "as a customer", used in sentences such as "Strong fit as a customer".
export const GOAL_PHRASE: Record<DealType, string> = {
  customer: "as a customer",
  partnership: "as a partner",
  referral: "as a referral partner",
  co_marketing: "for co-marketing",
};

export const MAX_RATING = 20;
export const RATING_STEP = 5;
// Fewer known criteria than this: "Insufficient evidence", no score.
export const MIN_KNOWN = 3;
// Fewer known criteria than this (but at least MIN_KNOWN): band capped at Possible.
export const FULL_BAND_KNOWN = 4;

// Weights per profile type and criterion key, all 1 for now (tuned by hand in Phase 3).
export const CRITERIA_WEIGHTS: Partial<Record<ProfileType, Record<string, number>>> = {};

export function weightOf(type: ProfileType | null | undefined, key: string): number {
  return (type && CRITERIA_WEIGHTS[type]?.[key]) ?? 1;
}

// rating: 0–20 in steps of 5, or null for Unknown.
export type CriterionRating = { key: string; rating: number | null; reason: string; signal_ids: string[] };
export type CriteriaSets = Record<CriteriaSetKey, CriterionRating[]>;

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

// Clamps to 0–20 and snaps to the nearest anchored step (0, 5, 10, 15, 20).
export function clampRating(r: number | null): number | null {
  if (r === null || !Number.isFinite(r)) return null;
  const clamped = Math.max(0, Math.min(MAX_RATING, r));
  return Math.round(clamped / RATING_STEP) * RATING_STEP;
}

export type FitResult =
  | { kind: "scored"; score: number; band: FitBand; known: number; total: number; capped: boolean }
  | { kind: "insufficient"; known: number; total: number };

// A criterion counts as known only when it has a rating and at least one source.
export function isKnown(c: Pick<CriterionRating, "rating" | "signal_ids">) {
  return c.rating !== null && c.signal_ids.length > 0;
}

// Scores over the known criteria only, so missing research never reads as a poor fit.
export function computeFit(
  criteria: CriterionRating[],
  defs: readonly CriterionDef[],
  type?: ProfileType | null,
): FitResult {
  const byKey = new Map(criteria.map((c) => [c.key, c]));
  let known = 0;
  let total = 0;
  let max = 0;
  for (const { key } of defs) {
    const c = byKey.get(key);
    if (!c || !isKnown(c)) continue;
    const w = weightOf(type, key);
    known++;
    total += (clampRating(c.rating) ?? 0) * w;
    max += MAX_RATING * w;
  }
  if (known < MIN_KNOWN) return { kind: "insufficient", known, total: defs.length };
  const score = max > 0 ? Math.round((total / max) * 100) : 0;
  const band = bandFor(score);
  const capped = known < FULL_BAND_KNOWN && band === "strong";
  return { kind: "scored", score, band: capped ? "possible" : band, known, total: defs.length, capped };
}

// ---------------------------------------------------------------------------
// Knockouts: hard "not a fit" rules set on the ICP. A hit needs a cited finding.
// ---------------------------------------------------------------------------

export const KNOCKOUT_RULES = ["excluded_geography", "competitor", "below_min_size", "exclusive_partner"] as const;
export type KnockoutRule = (typeof KNOCKOUT_RULES)[number];

export const KNOCKOUT_LABEL: Record<KnockoutRule, string> = {
  excluded_geography: "Excluded geography",
  competitor: "Competitor",
  below_min_size: "Below minimum size",
  exclusive_partner: "Exclusive partner in place",
};

export type Knockout = { rule: KnockoutRule; reason: string; signal_id: string };

export type KnockoutConfig = { excluded_geographies: string[]; competitors: string[]; min_employees: number | null };

// The rules the AI is asked to check. Competitor is always checked (a direct competitor is never a
// customer or partner); the others only when the ICP sets them. Exclusive partner is checked for
// every brief but only applies to the partnership goal (see applicableKnockout).
export function knockoutRulesFor(icp: Partial<KnockoutConfig> | null | undefined): KnockoutRule[] {
  const rules: KnockoutRule[] = ["competitor", "exclusive_partner"];
  if (icp?.excluded_geographies?.length) rules.push("excluded_geography");
  if (icp?.min_employees) rules.push("below_min_size");
  return rules;
}

export function applicableKnockout(knockouts: Knockout[], goal: DealType): Knockout | null {
  return knockouts.find((k) => k.signal_id && (k.rule !== "exclusive_partner" || goal === "partnership")) ?? null;
}

// ---------------------------------------------------------------------------
// Recommendation: fixed rules, so it can never contradict the score.
// ---------------------------------------------------------------------------

export type Recommendation = "pursue" | "hold" | "skip";

export function recommend(input: {
  fit: FitResult;
  knockout: Knockout | null;
  goal: DealType;
  hasTiming: boolean;
}): { recommendation: Recommendation; lead: string } {
  const { fit, knockout, goal, hasTiming } = input;
  const as = GOAL_PHRASE[goal];
  if (knockout) return { recommendation: "skip", lead: `Not a fit: ${KNOCKOUT_LABEL[knockout.rule].toLowerCase()}.` };
  if (fit.kind === "insufficient") {
    return {
      recommendation: "hold",
      lead: `Not enough evidence to score ${as} yet (${fit.known} of ${fit.total} criteria known).`,
    };
  }
  const label = `${BAND_LABEL[fit.band]} ${as} (${fit.score})`;
  if (fit.band === "weak") return { recommendation: "skip", lead: `${label}.` };
  if (fit.band === "strong") return { recommendation: "pursue", lead: `${label}.` };
  return hasTiming
    ? { recommendation: "pursue", lead: `${label}, with a current reason to reach out.` }
    : { recommendation: "hold", lead: `${label}, with no current trigger to reach out.` };
}
