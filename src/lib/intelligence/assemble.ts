// Pure parts of brief generation: which findings to keep, and turning the model's labelled
// answer into the stored brief. No server-only imports, so these are unit-tested.

import { urlKey } from "@/lib/url-key";
import type { ProfileType } from "@/lib/types";
import type { BriefOutput } from "./brief";
import { clampRating, computeFit, CRITERIA, type CriterionRating } from "./fit";
import type { ConceptStarter, Recommendation, SourcedStatement, TargetRole } from "./types";

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

// Turns the model's labelled answer into the stored brief, given which labels map to which
// stored signal ids. Claims that cite no known finding lose that citation; a criterion left with
// no citation becomes Unknown. Pure apart from the input, so it can be tested.
// `urlOf` maps labels to links, so labels cited in unsourced text (summary, recommendation, roles)
// turn into source chips.
export function assembleBrief(
  out: BriefOutput,
  idOf: Map<string, string>,
  profileType?: ProfileType | null,
  urlOf?: Map<string, string>,
) {
  const strip = (t: string) => cleanLabels(t);
  const link = (t: string) => cleanLabels(t, urlOf);
  const ids = (refs: string[]) => [...new Set(refs.map((r) => idOf.get(r.trim().toUpperCase())).filter((x): x is string => Boolean(x)))];

  const byKey = new Map(out.criteria.map((c) => [c.key, c]));
  const criteria: CriterionRating[] = CRITERIA.map(({ key }) => {
    const c = byKey.get(key);
    const signal_ids = c ? ids(c.refs) : [];
    const rating = c && signal_ids.length ? clampRating(c.rating) : null;
    return {
      key,
      rating,
      reason: (c && strip(c.reason)) || "No evidence found",
      signal_ids: rating === null ? [] : signal_ids,
    };
  });
  const fit = computeFit(criteria, profileType);

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

  const signal_ids = [
    ...new Set([
      ...criteria.flatMap((c) => c.signal_ids),
      ...why_now.map((w) => w.signal_id),
      ...risks.map((r) => r.signal_id).filter(Boolean),
      ...concept_starters.flatMap((c) => c.signal_ids),
    ]),
  ];

  return {
    status: fit.kind === "insufficient" || signal_ids.length === 0 ? ("insufficient_evidence" as const) : ("ready" as const),
    summary: link(out.summary) || null,
    fit_score: fit.kind === "scored" ? fit.score : null,
    fit_band: fit.kind === "scored" ? fit.band : null,
    criteria,
    why_now,
    risks,
    recommendation: out.recommendation as Recommendation,
    recommendation_reason: link(out.recommendation_reason) || null,
    suggested_angle: strip(out.suggested_angle) || null,
    target_roles,
    concept_starters,
    signal_ids,
  };
}
