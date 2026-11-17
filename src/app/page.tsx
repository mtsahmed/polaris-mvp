import { redirect } from "next/navigation";
import { brand } from "@/config/brand";
import { createClient } from "@/lib/supabase/server";
import { LandingShell } from "./landing-shell";

// What Polaris does, in route order.
const POINTS = [
  "Profile and ICP",
  "Cited opportunity discovery",
  "Find companies worth a closer look",
  "See which companies are worth pursuing, and why",
  "Decision-maker contacts",
  "Partnership concepts",
  "Approved outreach",
  "Pipeline",
];

// Public landing page: what Polaris is, then the animated route map (public/how-it-works.html).
// Signed-in users go straight to their profiles.
export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/profiles");

  return (
    <LandingShell>
      <section className="relative px-5 pb-6 pt-12 sm:px-8 lg:pt-16">
        <div className="relative mx-auto grid max-w-[1120px] gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div className="space-y-6">
            <div className="kicker text-gold">Partnership intelligence</div>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-sidebar-foreground sm:text-5xl">
              Find the partners worth pitching, and say{" "}
              <span className="text-gradient">something worth reading.</span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-sidebar-foreground/85 sm:text-xl">
              {brand.productName} researches who fits, finds the right person and drafts the pitch. You approve
              every message before it goes out.
            </p>
            <p className="text-[0.9375rem] text-sidebar-foreground/80">{brand.tagline}</p>
          </div>
          <ol className="flex flex-wrap gap-2.5">
            {POINTS.map((point, i) => (
              <li
                key={point}
                className="flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent/60 py-1.5 pl-1.5 pr-4 text-[0.9375rem]"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sidebar text-xs font-semibold tabular-nums text-gold">
                  {i + 1}
                </span>
                {point}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </LandingShell>
  );
}
