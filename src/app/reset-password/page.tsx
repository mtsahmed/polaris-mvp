import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { brand } from "@/config/brand";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached from the reset email: /auth/confirm (type=recovery) signs the user in, then sends them here.
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    redirect(`/login?mode=forgot&error=${encodeURIComponent("Your reset link has expired. Ask for a new one below.")}`);
  }
  const email = typeof data.claims.email === "string" ? data.claims.email : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <Link href="/" className="inline-block" aria-label={`${brand.productName} home`}>
          <BrandMark />
        </Link>
        <div className="space-y-8 rounded-3xl border bg-card p-8 shadow-[0_1px_2px_rgb(10_15_28/0.04)]">
          <div className="space-y-2">
            <div className="kicker">Account help</div>
            <h1 className="text-3xl font-semibold tracking-tight">Choose a new password</h1>
            <p className="text-base text-muted-foreground">
              {email ? (
                <>
                  For <span className="break-all font-medium text-foreground">{email}</span>.
                </>
              ) : (
                `For your ${brand.productName} account.`
              )}
            </p>
          </div>
          <NewPasswordForm />
        </div>
      </div>
    </main>
  );
}
