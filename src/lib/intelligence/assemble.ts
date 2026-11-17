// Pure parts of brief generation: which findings to keep, and turning the model's labelled
// answer into the stored brief. No server-only imports, so these are unit-tested.

import { urlKey } from "@/lib/url-key";
import type { DealType, ProfileType } from "@/lib/types";
import type { BriefOutput, ScoreOutput } from "./brief";
import {
  applicableKnockout,
  clampRating,
  computeFit,
  CRITERIA_SETS,
  recommend,
  setForGoal,
  type CriteriaSets,
  type CriterionDef,
  type CriterionRating,
  type Knockout,
} from "./fit";
import type { BriefStatus, ConceptStarter, SourcedStatement, TargetRole } from "./types";

const MAX_NEW_FINDINGS = 10;

export type NewFinding = BriefOutput["findings"][number] & { label: string };

// Finding labels (E1, N2, W1) are for the model only. In text the model sometimes writes them as
// "(N1, E2)" or starts a summary with "N4:". Groups are swapped for the findings' links (shown as
// source chips) when `urlOf` is given, otherwise removed; a leading label is always removed.
const LABEL = String.raw`[ENW]\d+`;
const LABEL_GROUP = new RegExp(String.raw`\s*\(\s*${LABEL}(?:\s*(?:,|;|and)\s*${LABEL})*\s*\)`, "g");
const LABEL_PREFIX = new RegExp(String.raw`^\s*${LABEL}\s*[:.–-]\s*`);

export function cleanLabels(text: string, urlOf?: Map<string, string>): string {
  return text
    .replace(LABEL_PREFIX, "")
    .replace(LABEL_GROUP, (group) => {
      if (!urlOf) return "";
      const urls = [...new Set((group.match(new RegExp(LABEL, "g")) ?? []).map((l) => urlOf.get(l)).filter(Boolean))];
      return urls.length ? ` ${urls.join(" ")}` : "";
    })
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

// Splits the model's new findings into ones whose link was really seen (kept) and the rest.
export function verifiedFindings(findings: BriefOutput["findings"], seenUrls: string[]) {
  const seen = new Set(seenUrls.map(urlKey).filter(Boolean));
  const kept: NewFinding[] = [];
  findings.slice(0, MAX_NEW_FINDINGS).forEach((f, i) => {
    const key = urlKey(f.source_url);
    const summary = cleanLabels(f.summary);
    if (key && seen.has(key) && summary) kept.push({ ...f, summary, label: `N${i + 1}` });
  });
  return kept;
}

type Ids = (refs: string[]) => string[];

function idsFrom(idOf: Map<string, string>): Ids {
  return (refs) => [...new Set(refs.map((r) => idOf.get(r.trim().toUpperCase())).filter((x): x is string => Boolean(x)))];
}

// One criteria set from the model: a rating that cites no known finding becomes Unknown.
function ratingsFrom(list: ScoreOutput["customer_criteria"], defs: readonly CriterionDef[], ids: Ids): CriterionRating[] {
  const byKey = new Map(list.map((c) => [c.key, c]));
  return defs.map(({ key }) => {
    const c = byKey.get(key);
    const signal_ids = c ? ids(c.refs) : [];
    const rating = c && signal_ids.length ? clampRating(c.rating) : null;
    return {
      key,
      rating,
      reason: (c && cleanLabels(c.reason)) || "No evidence found",
      signal_ids: rating === null ? [] : signal_ids,
    };
  });
}

export type ScoreParts = {
  deal_goal_suggested: DealType;
  deal_goal_reason: string | null;
  criteria_sets: CriteriaSets;
  knockouts: Knockout[];
  fit_case: string | null;
  suggested_angle: string | null;
};

// The scoring part of the model's answer, with labels mapped to stored signal ids. Knockouts
// without a known source are dropped.
export function assembleScore(out: ScoreOutput, idOf: Map<string, string>, urlOf?: Map<string, string>): ScoreParts {
  const ids = idsFrom(idOf);
  const knockouts: Knockout[] = [];
  for (const k of out.knockouts) {
    const signal_id = idOf.get(k.ref.trim().toUpperCase());
    if (signal_id && !knockouts.some((x) => x.rule === k.rule)) knockouts.push({ rule: k.rule, reason: cleanLabels(k.reason), signal_id });
  }
  return {
    deal_goal_suggested: out.deal_goal,
    deal_goal_reason: cleanLabels(out.deal_goal_reason, urlOf) || null,
    criteria_sets: {
      customer: ratingsFrom(out.customer_criteria, CRITERIA_SETS.customer, ids),
      partner: ratingsFrom(out.partner_criteria, CRITERIA_SETS.partner, ids),
    },
    knockouts,
    fit_case: cleanLabels(out.fit_case, urlOf) || null,
    suggested_angle: cleanLabels(out.suggested_angle) || null,
  };
}

// Scores a brief for one goal from its stored parts. Pure: used after research, after re-scoring
// and when the user changes the goal (no AI call). The recommendation follows fixed rules.
export function scoreForGoal(input: {
  goal: DealType;
  criteria_sets: CriteriaSets;
  knockouts: Knockout[];
  fit_case: string | null;
  hasTiming: boolean;
  hasSources: boolean;
  profileType?: ProfileType | null;
}) {
  const set = setForGoal(input.goal);
  const criteria = input.criteria_sets[set];
  const fit = computeFit(criteria, CRITERIA_SETS[set], input.profileType);
  const knockout = applicableKnockout(input.knockouts, input.goal);
  const { recommendation, lead } = recommend({ fit, knockout, goal: input.goal, hasTiming: input.hasTiming });
  const reason = knockout ? `${lead} ${knockout.reason}` : input.fit_case ? `${lead} ${input.fit_case}` : lead;
  const status: BriefStatus = fit.kind === "insufficient" || !input.hasSources ? "insufficient_evidence" : "ready";
  return {
    deal_goal: input.goal,
    criteria,
    fit_score: fit.kind === "scored" ? fit.score : null,
    fit_band: fit.kind === "scored" ? fit.band : null,
    fit_known: fit.known,
    recommendation,
    recommendation_reason: reason,
    status,
  };
}

// Turns the model's labelled answer into the stored brief, given which labels map to which
// stored signal ids. Claims that cite no known finding lose that citation; a criterion left with
// no citation becomes Unknown. `urlOf` maps labels to links, so labels cited in unsourced text
// (summary, reasons, roles) turn into source chips.
export function assembleBrief(
  out: BriefOutput,
  idOf: Map<string, string>,
  profileType?: ProfileType | null,
  urlOf?: Map<string, string>,
) {
  const strip = (t: string) => cleanLabels(t);
  const link = (t: string) => cleanLabels(t, urlOf);
  const ids = idsFrom(idOf);

  const parts = assembleScore(out, idOf, urlOf);

  const sourced = (list: { statement: string; ref: string }[], requireRef: boolean): SourcedStatement[] =>
    list
      .map((x) => ({ statement: strip(x.statement), signal_id: idOf.get(x.ref.trim().toUpperCase()) ?? "" }))
      .filter((x) => x.statement && (!requireRef || x.signal_id));

  const why_now = sourced(out.why_now, true);
  const risks = sourced(out.risks, false);
  const concept_starters: ConceptStarter[] = out.concept_starters
    .map((c) => ({ title: strip(c.title), description: strip(c.description), signal_ids: ids(c.refs) }))
    .filter((c) => c.title && c.signal_ids.length > 0)
    .slice(0, 3);
  const target_roles: TargetRole[] = out.target_roles
    .map((r) => ({ role: strip(r.role), reason: link(r.reason) }))
    .filter((r) => r.role)
    .slice(0, 3);

  const signal_ids = briefSignalIds({ ...parts, why_now, risks, concept_starters });
  const scored = scoreForGoal({
    goal: parts.deal_goal_suggested,
    criteria_sets: parts.criteria_sets,
    knockouts: parts.knockouts,
    fit_case: parts.fit_case,
    hasTiming: why_now.length > 0,
    hasSources: signal_ids.length > 0,
    profileType,
  });

  return {
    ...parts,
    ...scored,
    summary: link(out.summary) || null,
    why_now,
    risks,
    target_roles,
    concept_starters,
    signal_ids,
  };
}

// Every source a brief cites, from both criteria sets, knockouts, timing, risks and concepts.
export function briefSignalIds(b: {
  criteria_sets: CriteriaSets;
  knockouts: Knockout[];
  why_now: SourcedStatement[];
  risks: SourcedStatement[];
  concept_starters: ConceptStarter[];
}) {
  return [
    ...new Set([
      ...b.criteria_sets.customer.flatMap((c) => c.signal_ids),
      ...b.criteria_sets.partner.flatMap((c) => c.signal_ids),
      ...b.knockouts.map((k) => k.signal_id),
      ...b.why_now.map((w) => w.signal_id),
      ...b.risks.map((r) => r.signal_id).filter(Boolean),
      ...b.concept_starters.flatMap((c) => c.signal_ids),
    ]),
  ];
}
