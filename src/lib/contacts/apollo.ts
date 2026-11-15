import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logProviderCall } from "@/lib/providers/usage-log";
import { readMatch, readSearch, searchQuery, type ApolloCandidate, type ApolloPerson } from "./apollo-map";

// ContactProvider for Apollo (roadmap section 4). People search is free and returns no emails;
// revealing one person's email costs 1 credit (people/match). Mobile numbers are not revealed
// here: Apollo delivers them asynchronously to a public webhook, which a local app cannot receive.
// Every call is logged in Usage & cost with its credits.

const BASE = "https://api.apollo.io/api/v1";

export function apolloConfigured() {
  return Boolean(process.env.APOLLO_API_KEY);
}

async function call(path: string, query: string) {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("Apollo is not connected. Add APOLLO_API_KEY to .env.local and restart the app.");
  const res = await fetch(`${BASE}/${path}?${query}`, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json", "Cache-Control": "no-cache", accept: "application/json" },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const message =
      json?.error_code === "API_INACCESSIBLE"
        ? "Your Apollo plan does not include API access (Apollo's Free plan has none). Upgrade to a paid Apollo plan, or add people by hand below."
        : res.status === 401 || res.status === 403
        ? "Apollo rejected the API key, or the key has no access to this endpoint."
        : res.status === 429
          ? "Apollo's hourly limit was reached. Try again later."
          : (typeof json?.error === "string" && json.error) || `Apollo returned an error (${res.status}).`;
    throw new Error(message);
  }
  return json;
}

export async function searchPeople(
  supabase: SupabaseClient,
  orgId: string,
  domain: string,
  titles: string[],
): Promise<ApolloCandidate[]> {
  try {
    const json = await call("mixed_people/api_search", searchQuery(domain, titles));
    await logProviderCall(supabase, { orgId, provider: "apollo", endpoint: "mixed_people/api_search", credits: 0, ok: true });
    return readSearch(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Apollo search failed.";
    await logProviderCall(supabase, { orgId, provider: "apollo", endpoint: "mixed_people/api_search", credits: 0, ok: false, error: message });
    throw new Error(message);
  }
}

// Reveals one person's work email. Apollo charges 1 credit when it returns an email or new data,
// 0 when nothing is found; the log records 1 when an email came back and 0 otherwise.
export async function revealPerson(supabase: SupabaseClient, orgId: string, apolloId: string): Promise<ApolloPerson | null> {
  const query = new URLSearchParams({ id: apolloId, reveal_personal_emails: "false" }).toString();
  try {
    const person = readMatch(await call("people/match", query));
    await logProviderCall(supabase, { orgId, provider: "apollo", endpoint: "people/match", credits: person?.email ? 1 : 0, ok: true });
    return person;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Apollo lookup failed.";
    await logProviderCall(supabase, { orgId, provider: "apollo", endpoint: "people/match", credits: 0, ok: false, error: message });
    throw new Error(message);
  }
}
