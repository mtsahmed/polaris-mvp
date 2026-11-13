"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/session";

export type OrgState = { error?: string };

export async function createOrganization(_prev: OrgState, formData: FormData): Promise<OrgState> {
  const parsed = z
    .string()
    .trim()
    .min(1, "Enter an organization name.")
    .max(120, "Keep the name under 120 characters.")
    .safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization", { org_name: parsed.data });
  if (error) return { error: error.message };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, data as string, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/profiles");
}

export async function switchOrganization(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("id").eq("id", orgId).maybeSingle();
  if (!data) return; // not a member; RLS hid it
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/profiles");
}
