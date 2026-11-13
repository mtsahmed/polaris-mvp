import type { Metadata } from "next";
import { BrandMark, StarIcon } from "@/components/brand-mark";
import { brand } from "@/config/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, error } = await props.searchParams;
  const nextPath = typeof next === "string" ? next : "/";

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <BrandMark />
        <div className="max-w-md space-y-6">
          <h1 className="font-heading text-5xl leading-[1.05] tracking-tight">
            Find the partners worth pitching, and say something worth reading.
          </h1>
          <ol className="space-y-3 text-sm text-sidebar-foreground/70">
            {["Profile and ICP", "Cited opportunity discovery", "Decision-maker contacts", "Partnership concepts", "Approved outreach", "Pipeline"].map(
              (step, i) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="grid size-6 place-items-center rounded-full border border-sidebar-border text-[11px] tabular-nums">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ),
            )}
          </ol>
        </div>
        <p className="text-xs text-sidebar-foreground/50">{brand.tagline}</p>
        <StarIcon className="pointer-events-none absolute -right-24 -top-24 size-96 opacity-[0.06]" />
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-heading text-3xl tracking-tight">Welcome</h2>
            <p className="text-sm text-muted-foreground">Sign in to your {brand.productName} workspace.</p>
          </div>
          {typeof error === "string" && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <LoginForm next={nextPath} />
        </div>
      </section>
    </main>
  );
}
