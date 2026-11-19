import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, Organization } from "@/lib/types";

export const ACTIVE_ORG_COOKIE = "polaris_org";

export type SessionContext = {
  userId: string;
  email: string | null;
  fullName: string | null; // from sign-up (user_metadata.full_name); null for older accounts
  org: Organization;
  role: MemberRole;
  orgs: (Organization & { role: MemberRole })[];
};

// Signed-in user plus their active organization. Redirects to login or onboarding when missing.
// Cached per request so layouts and pages share one lookup.
export const requireSession = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) redirect("/login");

  const { data: rows, error } = await supabase
    .from("memberships")
    .select("role, organizations ( id, name )")
    .eq("user_id", claims.sub)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load organizations: ${error.message}`);

  const orgs = (rows ?? [])
    .map((r) => {
      const o = r.organizations as unknown as Organization | null;
      return o ? { ...o, role: r.role as MemberRole } : null;
    })
    .filter((o): o is Organization & { role: MemberRole } => o !== null);

  if (orgs.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const active = orgs.find((o) => o.id === preferred) ?? orgs[0];

  return {
    userId: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    fullName: ((claims.user_metadata as { full_name?: string } | undefined)?.full_name ?? "").trim() || null,
    org: { id: active.id, name: active.name },
    role: active.role,
    orgs,
  };
});

// Polaris app admin (table platform_admins, checked in the database). Cached per request.
export const isAppAdmin = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
});
