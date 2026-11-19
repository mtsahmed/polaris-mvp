export const QUESTIONNAIRE = [
  { key: "what_you_do", label: "What do you do, in a sentence or two?", example: "e.g. We make short-form video series for B2B tech brands." },
  {
    key: "best_work",
    label: "Name two or three pieces of work you are proudest of, with results if you have them.",
    example: "e.g. Launch series for Acme Cloud: 1.2M views and 300 demo requests in a month.",
  },
  {
    key: "audience",
    label: "Who is your audience or client base? Size, demographics, platforms.",
    example: "e.g. Marketing teams at US SaaS companies; 40k followers on LinkedIn and YouTube.",
  },
  {
    key: "ideal_partner",
    label: "What kind of partner or brand would be a dream fit, and why?",
    example: "e.g. A design-tool company launching to creative teams, because our clients already use them.",
  },
  {
    key: "avoid",
    label: "Anything you will not do, or brands you will not work with?",
    example: "e.g. No gambling, tobacco or political campaigns.",
  },
] as const;

// Answers typed under "Open questions" on the Insights tab are kept as their own source (same
// kind as the questionnaire, told apart by `location`), so the next insights draft reads them.
export const QUESTIONNAIRE_LOCATION = "questionnaire";
export const OPEN_ANSWERS_LOCATION = "open-questions";
export const OPEN_ANSWERS_TITLE = "Answers to open questions";

export type QaPair = { q: string; a: string };

export function formatQa(pairs: QaPair[]): string {
  return pairs.map(({ q, a }) => `Q: ${q}\nA: ${a}`).join("\n\n");
}

// Reads text written by formatQa. An answer may contain blank lines; a new pair starts only at
// a blank line followed by "Q: ".
export function parseQa(text: string | null | undefined): QaPair[] {
  if (!text) return [];
  return text
    .split(/\n\n(?=Q: )/)
    .map((block) => block.match(/^Q: (.*)\nA: ([\s\S]*)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ q: m[1].trim(), a: m[2].trim() }));
}

// Merges newly typed answers into the saved ones: a non-empty answer replaces the old one for
// that question, an emptied answer removes it, and answers to questions not shown stay.
export function mergeQa(saved: QaPair[], submitted: QaPair[]): QaPair[] {
  const out = new Map(saved.map((p) => [p.q, p.a]));
  for (const { q, a } of submitted) {
    if (a.trim()) out.set(q, a.trim());
    else out.delete(q);
  }
  return [...out].map(([q, a]) => ({ q, a }));
}
