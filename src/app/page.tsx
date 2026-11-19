import {
  Contact,
  Handshake,
  IdCard,
  Lightbulb,
  MessagesSquare,
  SquareKanban,
  Target,
  Telescope,
  type LucideIcon,
} from "lucide-react";
import { brand } from "@/config/brand";
import { seo, siteUrl } from "@/config/seo";
import { createClient } from "@/lib/supabase/server";
import { ImpactCalculator } from "@/components/impact-calculator";
import { ImpactReportForm } from "@/components/impact-report-form";
import { LandingShell } from "./landing-shell";

// What Polaris does, in route order: the owner's eight points (19 Nov 2026), shown as cards below
// "Your AI SDR" in the style of docs/Reference-image-for-showing-bullet-text-on-landing-page.png.
const POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: IdCard,
    title: "Your business profile & your target ideal customer (ICP)",
    body: "Polaris reads your website and documents, then drafts your profile and the customers you should target.",
  },
  {
    icon: Telescope,
    title: "Discover B2B partnerships, sponsorships or customers",
    body: "AI web search suggests companies that fit your ICP, each with the sources it found.",
  },
  {
    icon: Handshake,
    title: "Find companies worth a collaboration",
    body: "Shortlist the ones worth a closer look and dismiss the rest in one click.",
  },
  {
    icon: Target,
    title: "See which companies are worth pursuing, and why",
    body: "Each brief scores fit from cited findings and recommends pursue, hold or skip. You decide.",
  },
  {
    icon: Contact,
    title: "Contact the Decision-makers and Founders",
    body: "Names, roles, emails and phone numbers from the company's site, the web and Apollo, each with its source.",
  },
  {
    icon: Lightbulb,
    title: "Design pitch concepts & ideas for partnership",
    body: "Concepts built on the research, then a first email and a follow-up written in your voice.",
  },
  {
    icon: MessagesSquare,
    title: "Multi-channel automated outreach platform (Phone, Email, WhatsApp)",
    body: "Approve each message, then email, call or WhatsApp, with follow-up reminders and every reply logged.",
  },
  {
    icon: SquareKanban,
    title: "Sales Pipeline and Dashboard",
    body: "Every company by stage, with next tasks, notes and your leads by industry segment.",
  },
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
      {/* Agent discovery files (docs/seo-plan.md); React moves these links into <head>. */}
      <link rel="ai-catalog" href="/.well-known/ai-catalog.json" />
      <link rel="ard" href="/.well-known/ard.json" />
      <script
        type="application/ld+json"
        // Only our own constants (brand and seo config), never user text, so nothing can close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <section className="relative px-5 pb-6 pt-12 sm:px-8 lg:pt-16">
        <div className="relative mx-auto grid max-w-[1120px] gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div className="space-y-6">
            <div className="kicker text-gold">B2B partnership &amp; GTM intelligence</div>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-sidebar-foreground sm:text-5xl">
              Find the B2B partners worth pitching, and say{" "}
              <span className="text-gradient">something worth reading.</span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-sidebar-foreground/85 sm:text-xl">
              {brand.productName} researches who fits, finds the right person and drafts the pitch. You approve
              every message before it goes out.
            </p>
            <p className="text-[0.9375rem] text-sidebar-foreground/80">{brand.tagline}</p>
          </div>
          {/* Owner review, 19 Nov 2026: the quotation fills the right of the hero. */}
          <figure className="relative lg:pl-10">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-10 left-0 font-heading text-[7rem] leading-none text-gold/30 lg:left-6"
            >
              &ldquo;
            </span>
            <blockquote className="relative border-l-2 border-gold/50 pl-6">
              <p className="font-heading text-2xl leading-snug font-semibold tracking-tight text-sidebar-foreground sm:text-3xl">
                Empower your sales teams and sales development reps with AI automations &ndash;{" "}
                <span className="text-gradient">Your AI SDR</span>
              </p>
            </blockquote>
          </figure>
        </div>
      </section>

      {/* Owner review, 19 Nov 2026: the eight points as cards, before the route map. */}
      <section aria-labelledby="does-title" className="relative px-5 pt-6 pb-4 sm:px-8">
        <div className="mx-auto max-w-[1120px] space-y-8">
          <h2 id="does-title" className="text-3xl font-semibold tracking-tight text-sidebar-foreground sm:text-4xl">
            What Polaris Does
          </h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {POINTS.map(({ icon: Icon, title, body }, i) => (
              <li
                key={title}
                className="flex flex-col gap-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-5 transition-colors hover:border-gold/40"
              >
                <div className="flex items-center justify-between">
                  <Icon className="size-[22px] text-gold" strokeWidth={1.75} aria-hidden="true" />
                  <span className="font-mono text-xs tabular-nums text-sidebar-foreground/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="text-[17px] leading-snug font-semibold text-sidebar-foreground">{title}</h3>
                <p className="text-[15px] leading-relaxed text-sidebar-foreground/75">{body}</p>
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
