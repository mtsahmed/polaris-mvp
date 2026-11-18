// Industry segments (end-to-end review, 18 November 2026): every company in a profile's pipeline
// belongs to one segment, taken from the profile's ICP industries, so the dashboard can group
// leads by segment. Discovery asks the AI to pick one; older rows, and AI answers that match no
// segment exactly, are matched here by shared words. Pure, so it is tested.

export const OTHER_SEGMENT = "Other";

// The segments a profile's companies are sorted into: its ICP industries, in the ICP's order.
export function segmentOptions(industries: string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of industries ?? []) {
    const s = raw.trim();
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out;
}

const STOP = new Set(["and", "the", "for", "with", "companies", "company", "businesses", "business", "brands", "firms", "services", "other"]);

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOP.has(w))
      .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w)),
  );
}

// The segment for one company. `picked` is the AI's choice (may be empty or slightly reworded),
// `industry` the company's own industry line. With no ICP industries the company's industry is
// used as it is.
export function resolveSegment(picked: string | null | undefined, industry: string | null | undefined, options: string[]): string {
  const choice = picked?.trim() ?? "";
  const exact = options.find((o) => o.toLowerCase() === choice.toLowerCase());
  if (exact) return exact;
  if (!options.length) return industry?.trim() || choice || OTHER_SEGMENT;

  const have = words(`${choice} ${industry ?? ""}`);
  let best: string | null = null;
  let bestScore = 0;
  for (const o of options) {
    let score = 0;
    for (const w of words(o)) if (have.has(w)) score++;
    if (score > bestScore) {
      best = o;
      bestScore = score;
    }
  }
  return best ?? OTHER_SEGMENT;
}
