import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { createClient } from "@/lib/supabase/server";
import { OrgForm } from "./org-form";

export const metadata: Metadata = { title: "Set up your workspace" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");

  const { count } = await supabase
    .from("memberships")
    .select("org_id", { count: "exact", head: true })
    .eq("user_id", data.claims.sub);
  if ((count ?? 0) > 0) redirect("/profiles");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg space-y-10">
        <BrandMark />
        <div className="space-y-3">
          <div className="kicker">Step 1 of 1</div>
          <h1 className="text-4xl font-semibold tracking-tight">Name your workspace</h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            A workspace holds your profiles, research and pipeline. Everyone you invite later sees the
            same workspace; nobody outside it can.
          </p>
        </div>
        <OrgForm />
      </div>
    </main>
  );
}
