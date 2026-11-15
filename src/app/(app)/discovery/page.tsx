import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Compass, Info, Plus, Target, X } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, NativeSelect } from "@/components/field";
import { NextAction } from "@/components/next-action";
import { PageHeader } from "@/components/page-header";
import { FollowProfile } from "@/components/profile-switcher";
import { RichText } from "@/components/rich-text";
import { SourceChip } from "@/components/source-chip";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MAX_DISCOVERY } from "@/lib/ai/discovery";
import { modelDisplayName } from "@/lib/ai/models";
import { cleanHref, hostOf } from "@/lib/rich-text";
import { activeProfile } from "@/lib/profile-selection";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Company, Icp, Prospect, Signal } from "@/lib/types";
import { followProfile } from "../profile-actions";
import { dismissSuggestion, runDiscovery, shortlistSuggestion } from "./actions";

export const metadata: Metadata = { title: "Discovery" };
// A discovery run searches the web several times; allow up to five minutes.
export const maxDuration = 300;

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function formatDate(value: string) {
  return dateFmt.format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value));
}

type Row = Prospect & { companies: Company | null };

export default async function DiscoveryPage(props: PageProps<"/discovery">) {
  await requireSession();
  const sp = await props.searchParams;
  const supabase = await createClient();

  // ?profile= wins (links from a profile page); otherwise the profile selected in the sidebar.
  const { profiles, active } = await activeProfile();
  const profileId =
    typeof sp.profile === "string" && profiles.some((p) => p.id === sp.profile) ? sp.profile : active?.id;

  if (!profiles?.length || !profileId) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader eyebrow="Weeks 5–6" title="Discovery" />
        <p className="text-base text-muted-foreground">
          Create a profile first; discovery finds companies that fit its ICP.{" "}
          <Link href="/profiles/new" className="font-medium text-brand underline-offset-4 hover:underline">
            New profile
          </Link>
        </p>
      </div>
    );
  }

  const [{ data: icps }, { data: rows, error }] = await Promise.all([
    supabase.from("icps").select("*").eq("profile_id", profileId).order("version", { ascending: false }).returns<Icp[]>(),
    supabase
      .from("prospects")
      .select("*, companies ( * )")
      .eq("profile_id", profileId)
      .in("status", ["suggested", "saved"])
      .not("discovered_at", "is", null)
      .order("discovered_at", { ascending: false })
      .returns<Row[]>(),
  ]);
  // 42703 = undefined column: the discovery migration has not been applied yet.
  if (error?.code === "42703") {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader eyebrow="Weeks 5–6" title="Discovery" />
        <Card>
          <CardHeader>
            <CardTitle icon={Compass}>One database step first</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Discovery needs two new database changes. In the Supabase SQL Editor, paste and run the file{" "}
              <code className="font-mono text-sm">supabase/migrations/20261116000000_discovery.sql</code>, then reload this
              page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  if (error) throw new Error(error.message);
  const icp = icps?.find((i) => i.approved) ?? icps?.[0] ?? null;

  const companyIds = [...new Set((rows ?? []).map((r) => r.company_id))];
  const { data: signalRows } = companyIds.length
    ? await supabase.from("signals").select("*").in("company_id", companyIds).returns<Signal[]>()
    : { data: [] as Signal[] };
  const signalsOf = (companyId: string) => (signalRows ?? []).filter((s) => s.company_id === companyId);

  const suggested = (rows ?? []).filter((r) => r.status === "suggested");
  const added = (rows ?? []).filter((r) => r.status === "saved");
  const found = typeof sp.found === "string" ? Number(sp.found) : null;
  const dropped = typeof sp.dropped === "string" ? Number(sp.dropped) : 0;

  return (
    <div className="mx-auto max-w-7xl">
      <FollowProfile profileId={profileId} activeId={active?.id ?? null} follow={followProfile} />
      <PageHeader
        eyebrow="Weeks 5–6"
        title="Discovery"
        description="Polaris searches the web for companies that might fit a profile's ideal customer profile. Each suggestion shows why it may be relevant and the findings behind it, each with a source. Shortlist the relevant ones; Intelligence then researches each in depth."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle icon={Compass}>Find companies</CardTitle>
            <CardDescription className="text-base">
              A run takes two to four minutes and is logged in Usage &amp; cost.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={runDiscovery} className="space-y-5">
              <Field id="profile_id" label="Find companies for:" hint="The search uses this profile and its ICP.">
                <NativeSelect id="profile_id" name="profile_id" defaultValue={profileId}>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field
                id="focus"
                label="Narrow the search (optional):"
                hint={
                  <>
                    A sector, place or trait to focus on this time.
                    <br />
                    For example &quot;commercial facility service firms in Texas&quot;.
                  </>
                }
              >
                <Input id="focus" name="focus" autoComplete="off" placeholder="sector, city or trait" />
              </Field>
              <Field id="count" label="How many companies:" hint={`Up to ${MAX_DISCOVERY}. Fewer is faster and cheaper.`}>
                <NativeSelect id="count" name="count" defaultValue="5">
                  {[3, 5, 8].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <SubmitButton variant="gradient-outline" pendingLabel="Searching… this takes a few minutes">
                <Compass /> Find companies
              </SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle icon={Target}>What the search uses</CardTitle>
            <CardDescription className="text-base">
              {icp
                ? `ICP version ${icp.version}${icp.approved ? ", approved" : ", not approved yet"}.`
                : "This profile has no ICP yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-base">
            {icp ? (
              <>
                <IcpLine label="Industries" items={icp.industries} />
                <IcpLine label="Geographies" items={icp.geographies} />
                <IcpLine label="Company traits" items={icp.company_traits} />
                {!icp.approved && (
                  <p className="text-[13px] text-muted-foreground/75 italic">
                    The search uses this draft. Approve it on the profile page once it looks right.
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">
                Without an ICP the search works from the profile description alone, which gives broader results.
              </p>
            )}
            <Link
              href={`/profiles/${profileId}`}
              className={buttonVariants({ variant: "gradient-outline", size: "sm" })}
            >
              {icp ? "Edit the ICP" : "Draft an ICP"}
            </Link>
          </CardContent>
        </Card>
      </div>

      <section className="mt-12 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="kicker">Suggestions</div>
            <h2 className="text-3xl font-semibold tracking-tight">
              {suggested.length ? `${suggested.length} to review` : "Nothing to review"}
            </h2>
            {found !== null && (
              <p className="text-[13px] text-muted-foreground/75 italic">
                Last run added {found} {found === 1 ? "company" : "companies"}
                {dropped ? `; ${dropped} left out because they had no website or no finding whose link the AI actually read` : ""}.
              </p>
            )}
          </div>
          {profiles.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Showing:</span>
              {profiles.map((p) => (
                <Link
                  key={p.id}
                  href={`/discovery?profile=${p.id}`}
                  className={cn(
                    "rounded-full border px-3 py-1 font-medium transition-colors",
                    p.id === profileId ? "border-brand/50 bg-brand/10 text-brand" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {!suggested.length && !added.length ? (
          <p className="text-base text-muted-foreground">
            Run a search above. Suggested companies appear here for you to shortlist or dismiss.
          </p>
        ) : (
          <div className={cn("grid gap-5", suggested.length > 1 && "lg:grid-cols-2")}>
            {suggested.map((r) => (
              <Suggestion key={r.id} row={r} signals={signalsOf(r.company_id)} />
            ))}
          </div>
        )}

        {added.length > 0 && (
          <div className="space-y-4 pt-6">
            <h3 className="text-xl font-semibold tracking-tight">Shortlisted</h3>
            <div className={cn("grid gap-5", added.length > 1 && "lg:grid-cols-2")}>
              {added.map((r) => (
                <Suggestion key={r.id} row={r} signals={signalsOf(r.company_id)} />
              ))}
            </div>
          </div>
        )}
      </section>

      <NextAction current="discover" profileId={profileId} />
    </div>
  );
}

function IcpLine({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-muted-foreground">{items.join(" · ")}</div>
    </div>
  );
}

function Suggestion({ row, signals }: { row: Row; signals: Signal[] }) {
  const company = row.companies;
  if (!company) return null;
  const website = company.website ?? (company.domain ? `https://${company.domain}` : null);
  // The homepage is only "seen" if one of the findings came from the company's own site.
  const domain = company.domain;
  const siteSeen = Boolean(domain && signals.some((s) => hostOf(s.source_url).toLowerCase().endsWith(domain)));

  return (
    <article
      className={cn(
        "flex flex-col gap-5 rounded-3xl border bg-card p-6 shadow-sm",
        row.status === "saved" && "border-success/40",
      )}
    >
      <header className="space-y-2">
        <h3 className="font-heading text-2xl font-semibold tracking-tight">{company.name}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {website && <SourceChip href={website} host={company.domain ?? hostOf(website)} />}
          {company.industry && <Badge variant="secondary">{company.industry}</Badge>}
          {company.location && <Badge variant="secondary">{company.location}</Badge>}
        </div>
        {!siteSeen && (
          <p className="text-[13px] text-muted-foreground/75 italic">
            Website taken from the AI&apos;s answer; it was not opened during the search. Check it before pitching.
          </p>
        )}
      </header>

      {row.fit_summary && (
        <div className="space-y-1.5">
          <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Why it may be relevant:</div>
          <RichText text={row.fit_summary} className="block text-base leading-relaxed" />
        </div>
      )}

      <div className="space-y-3">
        <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Findings:</div>
        <ul className="space-y-3">
          {signals.map((s) => (
            <li key={s.id} className="space-y-1">
              <RichText text={s.summary} omitHref={s.source_url} className="block text-[0.9375rem] leading-relaxed" />
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <SourceChip href={cleanHref(s.source_url)} host={hostOf(s.source_url)} />
                <span className={cn(!s.source_date && "italic")}>{s.source_date ? formatDate(s.source_date) : "Undated"}</span>
              </div>
            </li>
          ))}
        </ul>
        <p className="flex gap-2 rounded-xl border border-dashed px-3 py-2 text-[13px] leading-snug text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden="true" />
          <span>
            A quick relevance check, not a verdict. Shortlisting runs deeper research and an explainable fit score in
            Intelligence.
          </span>
        </p>
      </div>

      <footer className="mt-auto flex flex-wrap items-center gap-3 border-t pt-4">
        {row.status === "suggested" ? (
          <>
            <ActionForm action={shortlistSuggestion.bind(null, row.id)}>
              <SubmitButton variant="gradient-outline" pendingLabel="Shortlisting…">
                <Plus /> Shortlist
              </SubmitButton>
            </ActionForm>
            <form action={dismissSuggestion.bind(null, row.id)}>
              <SubmitButton variant="ghost" pendingLabel="Dismissing…">
                <X /> Dismiss
              </SubmitButton>
            </form>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-2 text-base font-medium text-success">
              <CheckCircle2 className="size-5" /> Shortlisted
            </span>
            <Link href={`/intelligence/${row.id}`} className={buttonVariants({ variant: "gradient-outline" })}>
              Open brief <ArrowRight />
            </Link>
          </>
        )}
        <span className="ml-auto text-[13px] text-muted-foreground/75 italic">
          Found {row.discovered_at ? dateTimeFmt.format(new Date(row.discovered_at)) : ""}
          {row.discovery_model ? ` with ${modelDisplayName(row.discovery_model)}` : ""}
          {row.discovery_focus ? ` · focus: ${row.discovery_focus}` : ""}
        </span>
      </footer>
    </article>
  );
}
