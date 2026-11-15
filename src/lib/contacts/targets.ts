import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brief } from "@/lib/intelligence/types";
import type { Company, Icp, Prospect } from "@/lib/types";

// Shared lookups for contact finding (used by the Contacts actions and the background jobs).

export type PursuedProspect = Pick<Prospect, "id" | "profile_id" | "company_id" | "decision"> & {
  companies: Pick<Company, "id" | "name" | "domain" | "website" | "location"> | null;
};

export async function loadPursued(supabase: SupabaseClient, prospectId: string) {
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, profile_id, company_id, decision, companies ( id, name, domain, website, location )")
    .eq("id", prospectId)
    .maybeSingle<PursuedProspect>();
  if (!prospect?.companies) return null;
  return prospect;
}

// Spec 7.6: a prospect marked pursue moves to "Ready to pitch" once its company has a contact
// with an email.
export async function promoteReady(supabase: SupabaseClient, companyId: string) {
  await supabase
    .from("prospects")
    .update({ stage: "ready_to_pitch" })
    .eq("company_id", companyId)
    .eq("decision", "pursue")
    .in("stage", ["new_lead", "researching"]);
}

// Job titles to look for: the brief's roles first, then the approved ICP's titles.
// "Branch Manager, Austin" is searched as "Branch Manager".
export async function titlesFor(supabase: SupabaseClient, prospectId: string, profileId: string) {
  const [{ data: brief }, { data: icp }] = await Promise.all([
    supabase
      .from("briefs")
      .select("target_roles")
      .eq("prospect_id", prospectId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle<Pick<Brief, "target_roles">>(),
    supabase
      .from("icps")
      .select("titles")
      .eq("profile_id", profileId)
      .eq("approved", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle<Pick<Icp, "titles">>(),
  ]);
  const roles = (brief?.target_roles ?? []).map((r) => r.role.split(",")[0].trim());
  return [...new Set([...roles, ...(icp?.titles ?? [])].filter(Boolean))];
}
