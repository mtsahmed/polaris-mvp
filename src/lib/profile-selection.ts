import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const PROFILE_COOKIE = "polaris_profile";

export type ProfileOption = { id: string; name: string };

// The profiles in the active workspace and the one selected in the sidebar (per browser).
// Falls back to the most recently updated profile. Cached per request.
export const activeProfile = cache(async (): Promise<{ profiles: ProfileOption[]; active: ProfileOption | null }> => {
  const session = await requireSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("org_id", session.org.id)
    .order("updated_at", { ascending: false })
    .returns<ProfileOption[]>();
  const profiles = data ?? [];
  const wanted = (await cookies()).get(PROFILE_COOKIE)?.value;
  return { profiles, active: profiles.find((p) => p.id === wanted) ?? profiles[0] ?? null };
});
