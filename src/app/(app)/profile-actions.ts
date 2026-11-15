"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { PROFILE_COOKIE } from "@/lib/profile-selection";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

async function remember(profileId: string) {
  const session = await requireSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("org_id", session.org.id)
    .maybeSingle<{ id: string }>();
  if (!data) return false;
  (await cookies()).set(PROFILE_COOKIE, profileId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return true;
}

// The profile switcher in the sidebar.
export async function setActiveProfile(formData: FormData) {
  await remember(String(formData.get("profile") ?? ""));
  revalidatePath("/", "layout");
}

// Called by pages that belong to one profile (a profile page, a pitch) so the journey bar
// follows the profile the user is looking at.
export async function followProfile(profileId: string) {
  if (await remember(profileId)) revalidatePath("/", "layout");
}
