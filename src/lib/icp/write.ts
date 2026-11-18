import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Icp } from "@/lib/types";

export type IcpFields = Pick<Icp, "industries" | "company_traits" | "geographies" | "titles" | "problems_addressed" | "notes"> &
  Partial<Pick<Icp, "excluded_geographies" | "competitors" | "min_employees">>;

export async function latestIcp(supabase: SupabaseClient, profileId: string) {
  const { data } = await supabase
    .from("icps")
    .select("*")
    .eq("profile_id", profileId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<Icp>();
  return data;
}

// Edits the current draft, or starts a new version if the latest one is already approved. A new
// version keeps the previous knockouts unless the fields say otherwise (the AI draft never sets them).
export async function writeIcp(supabase: SupabaseClient, profileId: string, orgId: string, fields: IcpFields) {
  const latest = await latestIcp(supabase, profileId);
  if (latest && !latest.approved) {
    return supabase.from("icps").update(fields).eq("id", latest.id);
  }
  return supabase.from("icps").insert({
    excluded_geographies: latest?.excluded_geographies ?? [],
    competitors: latest?.competitors ?? [],
    min_employees: latest?.min_employees ?? null,
    ...fields,
    org_id: orgId,
    profile_id: profileId,
    version: (latest?.version ?? 0) + 1,
  });
}
