"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Download, FileText, RotateCcw } from "lucide-react";
import { SpinningStar } from "@/components/polaris-working";
import { DEFAULT_INPUTS, fromHash } from "@/lib/impact/model";
import { cn } from "@/lib/utils";

// Lead magnet at the end of the landing page: the visitor's calculator scenario as a one-page PDF
// for investor or client meetings. The download link appears once their name and email are saved
// (POST /api/impact-report). The scenario is read from the page address the calculator keeps.

type Goal = "partnerships" | "customers";

const GOALS: { value: Goal; label: string }[] = [
  { value: "partnerships", label: "Partnerships" },
  { value: "customers", label: "Customers" },
];

const field =
  "h-11 w-full rounded-xl border border-sidebar-border bg-sidebar px-3.5 text-[0.9375rem] text-sidebar-foreground placeholder:text-sidebar-foreground/45 outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/25";

export function ImpactReportForm() {
  const [goal, setGoal] = useState<Goal>("partnerships");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<{ url: string; name: string } | null>(null);
  // When the form appeared. The server refuses forms sent within 2 seconds of it (a bot check;
  // a hidden "honeypot" field was tried first, but Chrome's autofill filled it in).
  const shownAt = useRef(0);
  useEffect(() => {
    if (!ready) shownAt.current = Date.now();
  }, [ready]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/impact-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          company: form.get("company"),
          elapsedMs: Date.now() - shownAt.current,
          goal,
          inputs: fromHash(window.location.hash) ?? DEFAULT_INPUTS,
        }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) setError(json.error ?? "Could not create the report. Try again.");
      else setReady({ url: json.url, name: String(form.get("name") ?? "").trim() });
    } catch {
      setError("Could not reach Polaris. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section id="report" aria-labelledby="report-title" className="relative scroll-mt-24 px-5 pb-20 sm:px-8">
      <div className="mx-auto grid max-w-[1120px] gap-8 rounded-3xl border border-sidebar-border bg-sidebar-accent/40 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:p-10">
        <div className="space-y-5">
          <div className="kicker text-gold">Free one-page report</div>
          <h2 id="report-title" className="text-3xl font-semibold text-sidebar-foreground tracking-tight text-balance sm:text-4xl">
            Take your scenario to <span className="text-gradient">your next meeting</span>
          </h2>
          <p className="text-lg leading-relaxed text-sidebar-foreground/80">
            Get the numbers from the calculator above as a one-page PDF, ready for an investor update or a client
            conversation about winning new partners or customers.
          </p>
          <ul className="space-y-2 text-[0.9375rem] text-sidebar-foreground/85">
            {[
              "Extra revenue, meetings and pipeline over 12 months",
              "By hand vs with Polaris, month by month, with a chart",
              "Every assumption listed, so the numbers can be checked",
              "How Polaris finds and pitches the right companies",
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-sidebar-border bg-sidebar p-5 sm:p-6">
          {ready ? (
            <div className="space-y-4 text-center" role="status">
              <FileText className="mx-auto size-10 text-brand" aria-hidden="true" />
              <div className="space-y-1">
                <h3 className="text-xl font-semibold tracking-tight text-sidebar-foreground">Your report is ready{ready.name ? `, ${ready.name}` : ""}</h3>
                <p className="text-[0.9375rem] text-sidebar-foreground/75">One page, US Letter, with your current numbers.</p>
              </div>
              <a
                href={ready.url}
                download
                className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-gradient-button px-6 font-semibold text-brand-ink shadow-[0_8px_24px_-10px_rgb(196_0_106/0.6)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Download className="size-4" /> Download the PDF
              </a>
              <p className="text-[13px] text-sidebar-foreground/65 italic">
                Changed the numbers?{" "}
                <button type="button" onClick={() => setReady(null)} className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-sidebar-foreground">
                  <RotateCcw className="size-3" /> Make a new report
                </button>
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Name</span>
                  <input name="name" required maxLength={120} autoComplete="name" className={field} />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Work email</span>
                  <input name="email" type="email" required maxLength={254} autoComplete="email" className={field} />
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">
                  Company <span className="font-normal text-sidebar-foreground/60">(optional)</span>
                </span>
                <input name="company" maxLength={160} autoComplete="organization" className={field} />
              </label>
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">You are looking for</legend>
                <div role="radiogroup" className="flex flex-wrap gap-2 pt-1.5">
                  {GOALS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      role="radio"
                      aria-checked={goal === g.value}
                      onClick={() => setGoal(g.value)}
                      className={cn(
                        "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        goal === g.value
                          ? "border-brand bg-brand/15 text-sidebar-foreground"
                          : "border-sidebar-border text-sidebar-foreground/75 hover:text-sidebar-foreground",
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              {error && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-gradient-button px-6 font-semibold text-brand-ink shadow-[0_8px_24px_-10px_rgb(196_0_106/0.6)] transition-opacity disabled:opacity-80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {pending ? (
                  <>
                    <SpinningStar /> Preparing your report…
                  </>
                ) : (
                  <>
                    <FileText className="size-4" /> Get my one-page report
                  </>
                )}
              </button>
              <p className="text-[12px] leading-snug text-sidebar-foreground/60">
                Uses the numbers in the calculator above. By requesting the report you agree that TiffanyAI may
                contact you about Polaris. We don&apos;t share your details.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
