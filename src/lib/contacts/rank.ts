// Ranks Apollo candidates by how well their job title matches the roles to approach, so the
// automatic email reveals (a credit each) go to the right people. Pure, unit-tested.

const STOP = new Set(["of", "and", "the", "for", "&", "-", "a", "an", "at"]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t));
}

// 0 = unrelated; higher is better. An exact title match beats a partial one; earlier roles in
// the list (the brief's first choices) weigh a little more.
export function titleScore(title: string | null, roles: string[]): number {
  if (!title) return 0;
  const t = tokens(title);
  if (!t.length) return 0;
  let best = 0;
  roles.forEach((role, i) => {
    const r = tokens(role.split(",")[0]);
    if (!r.length) return;
    const shared = r.filter((w) => t.includes(w)).length;
    if (!shared) return;
    const exact = shared === r.length && shared === t.length ? 2 : 0;
    const score = shared / r.length + exact + (roles.length - i) * 0.01;
    best = Math.max(best, score);
  });
  return best;
}

// Best matches first, up to `limit`; people Apollo has an email for come first among equals.
// With roles given, unrelated people are never picked (no credit spent on them).
export function pickTop<T extends { title: string | null; hasEmail: boolean }>(candidates: T[], roles: string[], limit: number): T[] {
  const scored = candidates.map((c) => ({ c, s: roles.length ? titleScore(c.title, roles) : 1 }));
  return scored
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || Number(b.c.hasEmail) - Number(a.c.hasEmail))
    .slice(0, limit)
    .map((x) => x.c);
}
