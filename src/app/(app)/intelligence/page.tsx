import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, Telescope } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { NextAction } from "@/components/next-action";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ageLabel, bandLabel, bandTone, effectiveStatus, STATUS_LABEL } from "@/lib/intelligence/display";
import { RECOMMENDATION_LABEL, type Brief } from "@/lib/intelligence/types";
import { activeProfile } from "@/lib/profile-selection";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Company, Prospect } from "@/lib/types";

export const metadata: Metadata = { title: "Intelligence" };
// Research and refresh actions run the brief job after the response, within this limit.
export const maxDuration = 300;

const FILTERS = [
  { key: "review", label: "To review" },
  { key: "pursue", label: "Pursue" },
  { key: "hold", label: "Hold" },
  { key: "skip", label: "Skip" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

type Row = Prospect & { companies: Pick<Company, "name" | "domain"> | null };

export default async function IntelligencePage(props: PageProps<"/intelligence">) {
  const { filter: rawFilter } = await props.searchParams;
  const filter: FilterKey = FILTERS.some((f) => f.key === rawFilter) ? (rawFilter as FilterKey) : "review";
  const { active } = await activeProfile();
  const supabase = await createClient();

  if (!active) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader eyebrow="Polaris Intelligence" title="Intelligence" />
        <p className="text-base text-muted-foreground">Create a profile first.</p>
      </div>
    );
  }

  const { data: rows, error } = await supabase
    .from("prospects")
    .select("*, companies ( name, domain )")
    .eq("profile_id", active.id)
    .neq("status", "rejected")
    .not("shortlisted_at", "is", null)
    .returns<Row[]>();
  // 42703 = undefined column: the intelligence migration has not been applied yet.
  if (error?.code === "42703") {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader eyebrow="Polaris Intelligence" title="Intelligence" />
        <Card>
          <CardContent className="py-6 text-base leading-relaxed text-muted-foreground">
            Intelligence needs one database change. In the Supabase SQL Editor, paste and run the file{" "}
            <code className="font-mono text-sm">supabase/migrations/20261117000000_intelligence.sql</code>, then reload this
            page.
          </CardContent>
        </Card>
      </div>
    );
  }
  if (error) throw new Error(error.message);
  const ids = (rows ?? []).map((r) => r.id);
  const { data: briefRows } = ids.length
    ? await supabase.from("briefs").select("*").in("prospect_id", ids).order("version", { ascending: false }).returns<Brief[]>()
    : { data: [] as Brief[] };
  const latest = new Map<string, Brief>();
  for (const b of briefRows ?? []) if (!latest.has(b.prospect_id)) latest.set(b.prospect_id, b);

  const all = (rows ?? []).map((r) => ({ row: r, brief: latest.get(r.id) ?? null }));
  const counts: Record<FilterKey, number> = {
    review: all.filter((x) => x.row.decision === "none").length,
    pursue: all.filter((x) => x.row.decision === "pursue").length,
    hold: all.filter((x) => x.row.decision === "hold").length,
    skip: all.filter((x) => x.row.decision === "skip").length,
  };
  const shown = all
    .filter((x) => (filter === "review" ? x.row.decision === "none" : x.row.decision === filter))
    .sort((a, b) => (b.brief?.fit_score ?? -1) - (a.brief?.fit_score ?? -1));
  const running = all.some((x) => x.brief && effectiveStatus(x.brief) === "researching");

  return (
    <div className="mx-auto max-w-7xl">
      <AutoRefresh active={running} />
      <PageHeader
        eyebrow="Polaris Intelligence"
        title="Intelligence"
        description={`How well each company shortlisted for ${active.name} fits, why, and what Polaris recommends. You decide: pursue, hold or skip.`}
      />

      {!all.length ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 py-8">
            <Telescope className="size-8 text-brand" aria-hidden="true" />
            <p className="max-w-[60ch] text-base leading-relaxed">
              Briefs appear here once companies are shortlisted. Shortlist companies in Discover and Polaris researches
              each one.
            </p>
            <Link href={`/discovery?profile=${active.id}`} className={buttonVariants({ variant: "gradient-outline" })}>
              <Compass /> Go to Discover
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div role="tablist" aria-label="Filter companies" className="mb-6 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                role="tab"
                aria-selected={f.key === filter}
                href={`/intelligence?filter=${f.key}`}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  f.key === filter ? "border-brand/50 bg-brand/10 text-brand" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label} <span className="tabular-nums">({counts[f.key]})</span>
              </Link>
            ))}
          </div>

          {!shown.length ? (
            <p className="text-base text-muted-foreground">No companies here.</p>
          ) : (
            <ul className="divide-y rounded-3xl border bg-card">
              {shown.map(({ row, brief }) => {
                const status = brief ? effectiveStatus(brief) : null;
                const band = bandLabel(brief?.fit_band ?? null);
                return (
                  <li key={row.id}>
                    <Link
                      href={`/intelligence/${row.id}`}
                      className="group grid gap-3 px-5 py-4 transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-heading text-lg font-semibold tracking-tight group-hover:text-brand">
                          {row.companies?.name ?? "Company"}
                        </div>
                        <div className="truncate text-sm text-muted-foreground">{row.companies?.domain}</div>
                      </div>
                      <div>
                        {status === "ready" && brief?.fit_score !== null && brief ? (
                          <span className={cn("font-semibold", bandTone(brief.fit_band))}>
                            <span className="font-heading text-2xl tabular-nums">{brief.fit_score}</span>{" "}
                            <span className="text-sm">{band}</span>
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "text-sm font-medium",
                              status === "failed" ? "text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {status ? STATUS_LABEL[status] : "No brief yet"}
                          </span>
                        )}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Polaris: </span>
                        {brief?.recommendation ? RECOMMENDATION_LABEL[brief.recommendation] : "—"}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">You: </span>
                        {row.decision === "none" ? (
                          <Badge variant="secondary">To review</Badge>
                        ) : (
                          <Badge variant="outline" className="capitalize">
                            {row.decision}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[13px] text-muted-foreground/75 italic">
                        {ageLabel(brief?.researched_at ?? null)}
                        <ArrowRight className="size-4 not-italic text-muted-foreground group-hover:text-brand" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <NextAction current="intelligence" profileId={active.id} />
    </div>
  );
}
