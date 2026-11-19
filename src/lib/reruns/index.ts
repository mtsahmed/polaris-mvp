// When an AI re-run button is active (owner review, 19 November 2026: secondary buttons stay inactive
// until there is new data). Each function returns null when the step should be allowed to run, or a
// short reason, shown on hover, when its result is already up to date with its inputs. A missing
// timestamp (for example before migration 20261128000000 is applied) always allows the run.

export const RESEARCH_FRESH_DAYS = 7;

const DAY = 86_400_000;
// One second of slack, since a job's own writes can land a moment after the time it records.
function later(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return Date.parse(a) > Date.parse(b) + 1000;
}
function latest(times: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const t of times) if (t && (!best || Date.parse(t) > Date.parse(best))) best = t;
  return best;
}

// Profile insights read every source. New, removed or re-saved sources make a new draft worthwhile.
export function insightsUpToDate(
  generatedAt: string | null | undefined,
  usedSourceIds: string[] | undefined,
  sources: { id: string; created_at: string }[],
): string | null {
  if (!generatedAt || !usedSourceIds) return null;
  const used = new Set(usedSourceIds);
  if (sources.length !== used.size || sources.some((s) => !used.has(s.id))) return null;
  if (sources.some((s) => later(s.created_at, generatedAt))) return null;
  return "Up to date with your sources. Add or change a source to draft again.";
}

// The ICP draft reads the profile and its insights (both on the profile row).
export function icpUpToDate(profileUpdatedAt: string | null | undefined, icpUpdatedAt: string | null | undefined): string | null {
  if (!icpUpdatedAt || !profileUpdatedAt) return null;
  if (later(profileUpdatedAt, icpUpdatedAt)) return null;
  return "Up to date with the profile. Change the profile to draft again.";
}

// Web research has no local input that changes, so it opens again once it is a week old.
export function researchUpToDate(researchedAt: string | null | undefined, now = Date.now()): string | null {
  if (!researchedAt) return null;
  const age = now - Date.parse(researchedAt);
  if (age >= RESEARCH_FRESH_DAYS * DAY) return null;
  const left = Math.max(1, Math.ceil((RESEARCH_FRESH_DAYS * DAY - age) / DAY));
  return `Researched within the last ${RESEARCH_FRESH_DAYS} days. Refresh opens again in ${left} ${left === 1 ? "day" : "days"}.`;
}

// Concepts read the research and your notes (both change the prospect row).
export function conceptsUpToDate(
  prospectUpdatedAt: string | null | undefined,
  concepts: { created_at: string }[],
): string | null {
  const drafted = latest(concepts.map((c) => c.created_at));
  if (!drafted || !prospectUpdatedAt) return null;
  if (later(prospectUpdatedAt, drafted)) return null;
  return "Up to date with the research and your notes. Change either to redraft.";
}

// The email reads the chosen concept, the research and your notes.
export function emailUpToDate(
  emailCreatedAt: string | null | undefined,
  inputs: { prospectUpdatedAt?: string | null; conceptUpdatedAt?: string | null },
): string | null {
  if (!emailCreatedAt) return null;
  if (!inputs.prospectUpdatedAt || !inputs.conceptUpdatedAt) return null;
  if (later(inputs.prospectUpdatedAt, emailCreatedAt) || later(inputs.conceptUpdatedAt, emailCreatedAt)) return null;
  return "Up to date with the chosen concept and your notes. Change or choose a concept to rewrite.";
}

// Re-score reads the saved findings and the ICP, so it opens again when the ICP changes.
export function rescoreUpToDate(briefUpdatedAt: string | null | undefined, icpUpdatedAt: string | null | undefined): string | null {
  if (!briefUpdatedAt || !icpUpdatedAt) return null;
  if (later(icpUpdatedAt, briefUpdatedAt)) return null;
  return "Scored against the current ICP. Change the ICP to re-score.";
}
