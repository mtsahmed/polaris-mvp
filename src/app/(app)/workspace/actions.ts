"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ACTIVE_ORG_COOKIE, requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type DeleteWorkspaceState = { error?: string };

// Deletes the active workspace. The database function re-checks the role and the typed name.
export async function deleteWorkspace(_prev: DeleteWorkspaceState, formData: FormData): Promise<DeleteWorkspaceState> {
  const session = await requireSession();
  if (session.role !== "owner" && session.role !== "admin") {
    return { error: "Only owners and admins can delete a workspace." };
  }
  const typed = z.string().trim().min(1, "Type the workspace name to confirm.").safeParse(formData.get("confirm"));
  if (!typed.success) return { error: typed.error.issues[0].message };
  if (typed.data !== session.org.name) return { error: "The name you typed does not match the workspace name." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_organization", {
    target_org: session.org.id,
    confirm_name: typed.data,
  });
  if (error) return { error: error.message };

  // Forget the deleted workspace; the session then falls back to another one, or to onboarding.
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ORG_COOKIE);
  redirect("/profiles");
}
