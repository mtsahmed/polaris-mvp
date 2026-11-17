import type { Metadata } from "next";
import { Route } from "lucide-react";
import { BrandMark, StarIcon } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const STEPS = [
  "Profile and ICP",
  "Cited opportunity discovery",
  "Decision-maker contacts",
  "Partnership concepts",
  "Approved outreach",
  "Pipeline",
];

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, error } = await props.searchParams;
  const nextPath = typeof next === "string" ? next : "/";

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-40 size-[36rem] rounded-full opacity-30 blur-3xl bg-brand-gradient"
        />
        <StarIcon plain className="pointer-events-none absolute -right-24 -top-24 size-96 text-white opacity-[0.04]" />

        <BrandMark className="relative" />

        <div className="relative max-w-xl space-y-8">
          <div className="kicker mt-2.5 text-gold">Partnership intelligence</div>
          <h1 className="text-5xl font-semibold leading-[1.08] tracking-tight text-white">
            Find the partners worth pitching, and say{" "}
            <span className="text-gradient">something worth reading.</span>
          </h1>
          <p className="max-w-lg text-xl leading-relaxed text-sidebar-foreground/85">
            {brand.productName} researches who fits, finds the right person and drafts the pitch. You approve every
            message before it goes out.
          </p>
          <ol className="flex flex-wrap gap-2.5">
            {STEPS.map((step, i) => (
              <li
                key={step}
                className="flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent/60 py-1.5 pl-1.5 pr-4 text-[0.9375rem]"
              >
                <span className="grid size-6 place-items-center rounded-full bg-sidebar text-xs font-semibold tabular-nums text-gold">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <a
            href="/how-it-works.html"
            className={buttonVariants({
              variant: "gradient-outline",
              size: "lg",
              // The gradient outline fills with the card colour by default; on this dark panel use the panel colour.
              className: "text-white [--gradient-fill:var(--sidebar)] hover:[--gradient-fill:var(--sidebar-accent)]",
            })}
          >
            <Route /> See how {brand.productName} works
          </a>
        </div>

        <p className="relative mt-10 text-[0.9375rem] text-sidebar-foreground/80">{brand.tagline}</p>
      </section>

      <section className="flex items-center justify-center px-4 py-16 sm:px-8">
        <div className="w-full max-w-md space-y-10">
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <div className="space-y-3">
            <div className="kicker">Welcome back</div>
            <h2 className="text-4xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-lg text-muted-foreground">Open your {brand.productName} workspace.</p>
          </div>
          {typeof error === "string" && (
            <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-base text-destructive">
              {error}
            </p>
          )}
          <LoginForm next={nextPath} />
        </div>
      </section>
    </main>
  );
}
