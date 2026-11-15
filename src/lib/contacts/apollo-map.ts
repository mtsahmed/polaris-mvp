// Pure parts of the Apollo adapter: building request queries and reading responses.
// No server-only imports, so these are unit-tested. Field names follow Apollo's API reference
// (docs.apollo.io, read 14 November 2026): people search returns `people[]` with an obfuscated
// last name and no emails; people/match returns `person` with `email` and `email_status`.

import type { VerificationStatus } from "@/lib/types";

export type ApolloCandidate = {
  apolloId: string;
  displayName: string; // first name plus Apollo's obfuscated last name, e.g. "Jordan Bl***e"
  title: string | null;
  hasEmail: boolean;
};

export type ApolloPerson = {
  apolloId: string;
  name: string;
  title: string | null;
  email: string | null;
  emailStatus: VerificationStatus;
  linkedinUrl: string | null;
};

// Apollo wants a bare domain: no scheme, no "www.", no path.
export function bareDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
}

export function searchQuery(domain: string, titles: string[], perPage = 10): string {
  const q = new URLSearchParams();
  q.append("q_organization_domains_list[]", bareDomain(domain));
  for (const t of titles.map((t) => t.trim()).filter(Boolean).slice(0, 10)) q.append("person_titles[]", t);
  q.set("page", "1");
  q.set("per_page", String(perPage));
  return q.toString();
}

type RawSearchPerson = {
  id?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  last_name_obfuscated?: unknown;
  title?: unknown;
  has_email?: unknown;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function readSearch(json: unknown): ApolloCandidate[] {
  const people = (json as { people?: unknown })?.people;
  if (!Array.isArray(people)) return [];
  return people
    .map((p: RawSearchPerson) => {
      const id = str(p.id);
      if (!id) return null;
      const name = [str(p.first_name), str(p.last_name) ?? str(p.last_name_obfuscated)].filter(Boolean).join(" ");
      return { apolloId: id, displayName: name || "Name hidden", title: str(p.title), hasEmail: p.has_email === true };
    })
    .filter((c): c is ApolloCandidate => c !== null);
}

// Apollo's email statuses: verified, unverified, "likely to engage", unavailable. Only "verified"
// counts as verified in Polaris; any other address is unverified; no address is missing.
export function emailStatusOf(email: string | null, apolloStatus: unknown): VerificationStatus {
  if (!email) return "missing";
  return typeof apolloStatus === "string" && apolloStatus.toLowerCase() === "verified" ? "verified" : "unverified";
}

export function readMatch(json: unknown): ApolloPerson | null {
  const p = (json as { person?: Record<string, unknown> | null })?.person;
  if (!p) return null;
  const id = str(p.id);
  if (!id) return null;
  const name = str(p.name) ?? [str(p.first_name), str(p.last_name)].filter(Boolean).join(" ");
  // Apollo sometimes returns a placeholder such as "email_not_unlocked@domain.com".
  const raw = str(p.email);
  const email = raw && raw.includes("@") && !/not_unlocked/i.test(raw) ? raw : null;
  return {
    apolloId: id,
    name: name || "Name not returned",
    title: str(p.title),
    email,
    emailStatus: emailStatusOf(email, p.email_status),
    linkedinUrl: str(p.linkedin_url),
  };
}
