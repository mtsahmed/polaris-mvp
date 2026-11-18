import { brand } from "@/config/brand";
import { seo, siteUrl } from "@/config/seo";
import { createClient } from "@/lib/supabase/server";
import { ImpactCalculator } from "@/components/impact-calculator";
import { ImpactReportForm } from "@/components/impact-report-form";
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

// Structured data for search engines (docs/seo-plan.md): the organisation and the product.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${brand.website}#organization`,
      name: brand.companyName,
      url: brand.website,
      email: brand.contactEmail,
    },
    {
      "@type": "SoftwareApplication",
      name: brand.fullName,
      url: `${siteUrl}/`,
      description: seo.description,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      publisher: { "@id": `${brand.website}#organization` },
    },
  ],
};

// Public landing page: what Polaris is, then the animated route map (public/how-it-works.html).
// Signed-in users can open it from the logo; its header button then leads back into the app.
export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  return (
    <LandingShell
      signedIn={signedIn}
      after={
        <>
          <ImpactCalculator />
          <Different />
          <ImpactReportForm />
        </>
      }
    >
      <script
        type="application/ld+json"
        // Only our own constants (brand and seo config), never user text, so nothing can close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
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

// Shown below the impact calculator (owner request, 17 Nov 2026). Same text as the "What makes
// Polaris different" section of public/how-it-works.html, which the landing embed hides (?nodiff);
// keep the two in step.
const DIFFERENT: [string, string][] = [
  ["A source behind every claim.", "Each rating shows its reason and the page it came from."],
  ["Unknown is not a low score.", "Missing evidence is shown as Unknown and left out of the score."],
  ["Polaris recommends, you decide.", "Pursue, hold or skip is your call, and you can override the recommendation."],
  ["Research before contact spend.", "Contact credits are used only on companies you chose to pursue."],
  ["Nothing is sent without approval.", "A named person approves every message before it goes out."],
];

function Different() {
  return (
    <section aria-labelledby="different-title" className="relative px-5 pt-10 pb-16 sm:px-8">
      <div className="mx-auto max-w-[1120px] space-y-5">
        <h2 id="different-title" className="kicker text-gold">
          What makes Polaris different
        </h2>
        <div className="grid gap-x-10 gap-y-3.5 text-[17px] leading-relaxed text-sidebar-foreground/75 md:grid-cols-2">
          {DIFFERENT.map(([title, body]) => (
            <p key={title}>
              <strong className="font-semibold text-sidebar-foreground">{title}</strong> {body}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
