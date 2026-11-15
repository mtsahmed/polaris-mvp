import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apolloConfigured, revealPerson, searchPeople } from "../apollo";
import { isPlanBlocked } from "../job-status";
import { pickTop } from "../rank";
import type { FoundContact, SourceContext, SourceResult } from "./types";

// Automatic Apollo step: free people search, then email reveals (1 credit each) for up to 3
// people whose titles best match the roles to approach. Mobile reveals stay a click.
export const AUTO_REVEALS = 3;

const FREE_PLAN = "Free plan has no API access";

// Skipped without calling Apollo when Apollo said in the last 24 hours that the plan has no API
// access, so a Free-plan account is not called on every job.
async function blockedRecently(supabase: SupabaseClient, orgId: string) {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await supabase
    .from("provider_calls")
    .select("error")
    .eq("org_id", orgId)
    .eq("provider", "apollo")
    .eq("ok", false)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<{ error: string | null }[]>();
  return (data ?? []).some((r) => isPlanBlocked(r.error));
}

export async function findWithApollo(supabase: SupabaseClient, ctx: SourceContext): Promise<SourceResult> {
  if (!apolloConfigured()) return { outcome: "skipped", contacts: [], note: "not connected" };
  const domain = ctx.domain ?? ctx.website;
  if (!domain) return { outcome: "skipped", contacts: [], note: "no website to search with" };
  if (await blockedRecently(supabase, ctx.orgId)) return { outcome: "skipped", contacts: [], note: FREE_PLAN };

  try {
    let candidates = ctx.roles.length ? await searchPeople(supabase, ctx.orgId, domain, ctx.roles) : [];
    if (!candidates.length) candidates = await searchPeople(supabase, ctx.orgId, domain, []);
    if (!candidates.length) return { outcome: "none", contacts: [] };
    const contacts: FoundContact[] = [];
    for (const c of pickTop(candidates, ctx.roles, AUTO_REVEALS)) {
      const person = await revealPerson(supabase, ctx.orgId, c.apolloId);
      if (!person) continue;
      contacts.push({
        name: person.name,
        title: person.title,
        email: person.email,
        emailStatus: person.emailStatus,
        phone: null,
        mobile: null,
        whatsapp: null,
        source: "Apollo",
        sourceUrl: null,
        apolloId: person.apolloId,
        linkedinUrl: person.linkedinUrl,
      });
    }
    return { outcome: contacts.length ? "found" : "none", contacts };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Apollo failed.";
    if (isPlanBlocked(message)) return { outcome: "skipped", contacts: [], note: FREE_PLAN };
    return { outcome: "failed", contacts: [], note: message };
  }
}
