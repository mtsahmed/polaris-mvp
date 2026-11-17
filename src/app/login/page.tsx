import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { LoginForm } from "./login-form";
import { SignUpForm } from "./signup-form";

export async function generateMetadata(props: PageProps<"/login">): Promise<Metadata> {
  const { mode } = await props.searchParams;
  return { title: mode === "signup" ? "Create account" : "Sign in" };
}

// One compact card: email, password, and both actions. The landing page (/) carries the pitch.
export default async function LoginPage(props: PageProps<"/login">) {
  const { next, error, mode } = await props.searchParams;
  const nextPath = typeof next === "string" ? next : "/";
  const signup = mode === "signup";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <Link href="/" className="inline-block" aria-label={`${brand.productName} home`}>
          <BrandMark />
        </Link>

        <div className="space-y-8 rounded-3xl border bg-card p-8 shadow-[0_1px_2px_rgb(10_15_28/0.04)]">
          <div className="space-y-2">
            <div className="kicker">{signup ? "Welcome" : "Welcome back"}</div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {signup ? "Create your account" : "Sign in"}
            </h1>
            <p className="text-base text-muted-foreground">
              {signup ? `Start your ${brand.productName} workspace.` : `Open your ${brand.productName} workspace.`}
            </p>
          </div>
          {typeof error === "string" && (
            <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-base text-destructive">
              {error}
            </p>
          )}
          {signup ? <SignUpForm /> : <LoginForm next={nextPath} />}
        </div>

        <Link href="/" className={buttonVariants({ variant: "ghost" })}>
          <ArrowLeft /> See how {brand.productName} works
        </Link>
      </div>
    </main>
  );
}
