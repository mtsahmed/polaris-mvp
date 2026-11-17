import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";
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
  const email = typeof data.claims.email === "string" ? data.claims.email : null;

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
        {/* Shows which account is signed in, and a way out when it is the wrong one. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-sm text-muted-foreground">
          <span>
            Signed in as <span className="font-medium text-foreground">{email ?? "this account"}</span>
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-2 font-medium text-foreground underline-offset-4 hover:underline"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
