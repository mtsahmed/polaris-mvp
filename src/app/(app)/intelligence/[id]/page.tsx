import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Check, Clock, Lightbulb, RefreshCw, Users } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { NextAction } from "@/components/next-action";
import { PageHeader } from "@/components/page-header";
import { FollowProfile } from "@/components/profile-switcher";
import { ProspectStageBar } from "@/components/prospect-stage-bar";
import { RichText } from "@/components/rich-text";
import { cleanLabels } from "@/lib/intelligence/assemble";
import { SourceChip } from "@/components/source-chip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { modelDisplayName } from "@/lib/ai/models";
import { ageLabel, bandLabel, bandTone, effectiveStatus, isStale } from "@/lib/intelligence/display";
import {
  applicableKnockout,
  computeFit,
  criteriaFor,
  FULL_BAND_KNOWN,
  isKnown,
  KNOCKOUT_LABEL,
  MAX_RATING,
} from "@/lib/intelligence/fit";
import { BRIEF_STALE_DAYS, RECOMMENDATION_LABEL, type Brief } from "@/lib/intelligence/types";
import { DEAL_TYPE_INFO } from "@/lib/pitch-utils";
import { DEAL_TYPES } from "@/lib/types";
import { activeProfile } from "@/lib/profile-selection";
import { cleanHref, hostOf } from "@/lib/rich-text";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Company, Prospect, Signal } from "@/lib/types";
import { followProfile } from "../../profile-actions";
import { decide, pitchFromBrief, rescoreProspect, researchProspect, setDealGoal } from "../actions";

export const maxDuration = 300;

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
function formatDate(v: string) {
  return dateFmt.format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v));
}

export async function generateMetadata(props: PageProps<"/intelligence/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("prospects").select("companies ( name )").eq("id", id).maybeSingle();
  const name = (data?.companies as unknown as { name: string } | null)?.name;
  return { title: name ? `Brief: ${name}` : "Brief" };
}

export default async function BriefPage(props: PageProps<"/intelligence/[id]">) {
  const { id } = await props.params;
  const session = await requireSession();
  const supabase = await createClient();
  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", id).maybeSingle<Prospect>();
  if (!prospect) notFound();

  const [{ data: company }, { data: profile }, { data: briefs }, { active }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", prospect.company_id).single<Company>(),
    supabase.from("profiles").select("id, name").eq("id", prospect.profile_id).single<{ id: string; name: string }>(),
    supabase.from("briefs").select("*").eq("prospect_id", id).order("version", { ascending: false }).returns<Brief[]>(),
    activeProfile(),
  ]);
  if (!company || !profile) notFound();

  const brief = briefs?.[0] ?? null;
  // The last brief that finished, shown while a refresh is running or after a failed refresh.
  const shownBrief = briefs?.find((b) => b.status === "ready" || b.status === "insufficient_evidence") ?? null;
  const status = brief ? effectiveStatus(brief) : null;
  const { data: signalRows } = shownBrief?.signal_ids.length
    ? await supabase.from("signals").select("*").in("id", shownBrief.signal_ids).returns<Signal[]>()
    : { data: [] as Signal[] };
  const signalById = new Map((signalRows ?? []).map((s) => [s.id, s]));
  const isAdmin = session.role === "owner" || session.role === "admin";
  const website = company.website ?? (company.domain ? `https://${company.domain}` : null);

  return (
    <div className="mx-auto max-w-7xl">
      <FollowProfile profileId={profile.id} activeId={active?.id ?? null} follow={followProfile} />
      <AutoRefresh active={status === "researching"} />
      <div className="mb-4 text-sm">
        <Link href="/intelligence" className="text-muted-foreground hover:text-foreground">
          ← Intelligence
        </Link>
      </div>
      <PageHeader
        eyebrow={`Polaris Intelligence · for ${profile.name}`}
        title={company.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {website && <SourceChip href={website} host={company.domain ?? hostOf(website)} />}
            {company.industry && <Badge variant="secondary">{company.industry}</Badge>}
            {company.location && <Badge variant="secondary">{company.location}</Badge>}
          </span>
        }
        actions={
          <>
            {status !== "researching" && (
              <ActionForm action={researchProspect.bind(null, prospect.id)}>
                <SubmitButton variant="gradient-outline" pendingLabel="Starting…">
                  <RefreshCw /> {!brief ? "Research company" : status === "failed" ? "Retry research" : "Refresh research"}
                </SubmitButton>
              </ActionForm>
            )}
            {shownBrief && shownBrief.concept_starters.length > 0 && (
              <form action={pitchFromBrief.bind(null, prospect.id)}>
                <SubmitButton variant="gradient-outline" pendingLabel="Opening…">
                  <Lightbulb /> Start pitch with these concepts
                </SubmitButton>
              </form>
            )}
          </>
        }
      />
      <ProspectStageBar stage={prospect.stage} className="-mt-6 mb-8" />

      {/* Research status */}
      {status === "researching" && (
        <Notice icon={<Clock className="size-4 text-brand" />}>
          Researching since {dateTimeFmt.format(new Date(brief!.created_at))}. This usually takes two to four minutes; the
          page updates by itself.
        </Notice>
      )}
      {status === "failed" && (
        <Notice tone="error" icon={<AlertTriangle className="size-4" />}>
          Research failed: {brief!.error ?? "the job stopped before finishing"}. Use Retry research to run it again.
          {shownBrief ? " The brief below is the last one that finished." : ""}
        </Notice>
      )}
      {!brief && (
        <Notice icon={<Clock className="size-4 text-muted-foreground" />}>
          No brief yet. Research company reads the site and searches for evidence; it is logged in Usage &amp; cost.
        </Notice>
      )}
      {shownBrief && isStale(shownBrief) && (
        <Notice icon={<Clock className="size-4 text-muted-foreground" />}>
          This brief is {ageLabel(shownBrief.researched_at)?.toLowerCase()}, older than {BRIEF_STALE_DAYS} days. Refresh
          research to check for newer evidence.
        </Notice>
      )}

      {shownBrief && (
        <BriefBody brief={shownBrief} prospect={prospect} signalById={signalById} running={status === "researching"} />
      )}

      {shownBrief && isAdmin && (
        <p className="mt-6 text-[13px] text-muted-foreground/75 italic">
          Admin: this brief cost{" "}
          {shownBrief.cost_estimate_usd !== null ? `about $${Number(shownBrief.cost_estimate_usd).toFixed(3)}` : "an unknown amount"}{" "}
          · {shownBrief.search_count ?? 0} web searches
          {shownBrief.model ? ` · ${modelDisplayName(shownBrief.model)}` : ""} · version {shownBrief.version}
          {shownBrief.researched_at ? ` · ${dateTimeFmt.format(new Date(shownBrief.researched_at))}` : ""}
        </p>
      )}

      <NextAction
        current="intelligence"
        profileId={profile.id}
        href={prospect.decision === "pursue" ? `/contacts?company=${prospect.id}` : undefined}
      />
    </div>
  );
}

function Notice({ children, icon, tone }: { children: ReactNode; icon: ReactNode; tone?: "error" }) {
  return (
    <div
      role="status"
      className={cn(
        "mb-6 flex items-start gap-3 rounded-2xl border border-dashed px-4 py-3 text-base",
        tone === "error" && "border-destructive/40 text-destructive",
      )}
    >
      <span className="mt-1 shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </div>
  );
}

function Sources({ ids, signalById }: { ids: string[]; signalById: Map<string, Signal> }) {
  const list = ids.map((i) => signalById.get(i)).filter((s): s is Signal => Boolean(s));
  if (!list.length) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {list.map((s) => (
        <SourceChip key={s.id} href={cleanHref(s.source_url)} host={hostOf(s.source_url)} />
      ))}
    </span>
  );
}

function Section({ n, title, children, className }: { n: number; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)} aria-labelledby={`section-${n}`}>
      <h2 id={`section-${n}`} className="flex items-baseline gap-2 text-xl font-semibold tracking-tight">
        <span className="font-mono text-sm text-brand">{String(n).padStart(2, "0")}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function BriefBody({
  brief,
  prospect,
  signalById,
  running,
}: {
  brief: Brief;
  prospect: Prospect;
  signalById: Map<string, Signal>;
  running: boolean;
}) {
  const sources = brief.signal_ids.map((i) => signalById.get(i)).filter((s): s is Signal => Boolean(s));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="space-y-8 pt-6">
            <Section n={1} title="Summary">
              {brief.summary ? (
                <RichText text={cleanLabels(brief.summary)} className="text-base leading-relaxed" />
              ) : (
                <p className="text-base text-muted-foreground">No summary.</p>
              )}
            </Section>

            <Section n={2} title="Fit score">
              <FitScore brief={brief} prospectId={prospect.id} signalById={signalById} running={running} />
            </Section>

            <Section n={3} title="Why now">
              {brief.why_now.length ? (
                <ul className="space-y-3">
                  {brief.why_now.map((w, i) => {
                    const s = signalById.get(w.signal_id);
                    return (
                      <li key={i} className="space-y-1">
                        <RichText text={cleanLabels(w.statement)} className="text-base leading-relaxed" />
                        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                          <Sources ids={[w.signal_id]} signalById={signalById} />
                          <span className={cn(!s?.source_date && "italic")}>
                            {s?.source_date ? formatDate(s.source_date) : "Undated"}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-base text-muted-foreground">No timing signals found.</p>
              )}
            </Section>

            <Section n={4} title="Risks and reasons against">
              {brief.risks.length ? (
                <ul className="space-y-3">
                  {brief.risks.map((r, i) => (
                    <li key={i} className="space-y-1">
                      <RichText text={cleanLabels(r.statement)} className="text-base leading-relaxed" />
                      {r.signal_id ? (
                        <Sources ids={[r.signal_id]} signalById={signalById} />
                      ) : (
                        <p className="text-[13px] text-muted-foreground/75 italic">Based on missing evidence, not a source.</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-base text-muted-foreground">No risks found.</p>
              )}
            </Section>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-brand/30">
            <CardHeader>
              <div className="kicker">05</div>
              <CardTitle>Recommendation</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                Polaris recommends{" "}
                <strong className="text-foreground">
                  {brief.recommendation ? RECOMMENDATION_LABEL[brief.recommendation].toLowerCase() : "nothing yet"}
                </strong>
                {brief.recommendation_reason ? (
                  <>
                    : <RichText text={cleanLabels(brief.recommendation_reason)} />
                  </>
                ) : (
                  "."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {brief.suggested_angle && (
                <p className="text-base leading-relaxed">
                  <span className="font-semibold">Suggested angle: </span>
                  {brief.suggested_angle}
                </p>
              )}
              <DecisionForm prospect={prospect} recommendation={brief.recommendation} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="kicker">06</div>
              <CardTitle icon={Users}>Who to approach</CardTitle>
              <CardDescription className="text-base">Roles only. Named people come from the Contacts stage.</CardDescription>
            </CardHeader>
            <CardContent>
              {brief.target_roles.length ? (
                <ul className="space-y-3">
                  {brief.target_roles.map((r) => (
                    <li key={r.role}>
                      <div className="font-semibold">{r.role}</div>
                      <RichText text={cleanLabels(r.reason)} className="block text-[0.9375rem] text-muted-foreground" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-base text-muted-foreground">No roles suggested.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-8 pt-6">
          <Section n={7} title="Concept starters">
            {brief.concept_starters.length ? (
              <div className={cn("grid gap-4", brief.concept_starters.length > 1 && "md:grid-cols-2 xl:grid-cols-3")}>
                {brief.concept_starters.map((c) => (
                  <div key={c.title} className="space-y-2 rounded-2xl border p-4">
                    <div className="font-semibold">{c.title}</div>
                    <RichText text={cleanLabels(c.description)} className="block text-[0.9375rem] leading-relaxed" />
                    <Sources ids={c.signal_ids} signalById={signalById} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-base text-muted-foreground">No concept starters with sources.</p>
            )}
          </Section>

          <Section n={8} title="Sources">
            {sources.length ? (
              <ol className="space-y-3">
                {sources.map((s) => (
                  <li key={s.id} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
                    <span className={cn("w-28 shrink-0 text-[13px] text-muted-foreground", !s.source_date && "italic")}>
                      {s.source_date ? formatDate(s.source_date) : "Undated"}
                    </span>
                    <span className="min-w-0 space-y-1">
                      <RichText text={cleanLabels(s.summary)} omitHref={s.source_url} className="block text-[0.9375rem] leading-relaxed" />
                      <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground/75 italic">
                        <SourceChip href={cleanHref(s.source_url)} host={hostOf(s.source_url)} />
                        Retrieved {formatDate(s.retrieved_at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-base text-muted-foreground">No sources.</p>
            )}
          </Section>
        </CardContent>
      </Card>
    </div>
  );
}

// Score, coverage, deal goal, knockout and the criteria behind it. Briefs made before
// 16 November 2026 (no deal goal) show the earlier single set and offer a re-score.
function FitScore({
  brief,
  prospectId,
  signalById,
  running,
}: {
  brief: Brief;
  prospectId: string;
  signalById: Map<string, Signal>;
  running: boolean;
}) {
  const goal = brief.deal_goal;
  const defs = criteriaFor(goal);
  const rows = defs.map((def) => ({ def, c: brief.criteria.find((c) => c.key === def.key) }));
  const known = rows.filter(({ c }) => c && isKnown(c)).length;
  const fit = goal ? computeFit(brief.criteria, defs) : null;
  const knockout = goal ? applicableKnockout(brief.knockouts, goal) : null;

  return (
    <div className="space-y-4">
      {goal ? (
        <ActionForm action={setDealGoal.bind(null, prospectId, brief.id)} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Scored as:</span>
            {DEAL_TYPES.map((t) => (
              <SubmitButton
                key={t}
                name="goal"
                value={t}
                size="sm"
                variant={t === goal ? "gradient-outline" : "ghost"}
                className={cn(t === goal && "ring-3 ring-brand/30")}
                pendingLabel="Scoring…"
                disabled={running}
              >
                {t === goal && <Check />}
                {DEAL_TYPE_INFO[t].label}
                {t === goal && <span className="sr-only"> (current goal)</span>}
              </SubmitButton>
            ))}
          </div>
          {brief.deal_goal_suggested && (
            <p className="text-[13px] text-muted-foreground/75 italic">
              Polaris suggested {DEAL_TYPE_INFO[brief.deal_goal_suggested].label.toLowerCase()}
              {brief.deal_goal_reason ? <>: <RichText text={cleanLabels(brief.deal_goal_reason)} /></> : "."} Changing the
              goal re-scores from the same research, at no cost.
            </p>
          )}
        </ActionForm>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.9375rem]">
            Scored the earlier way: one set of criteria for every company, with Unknown counted as 0. Re-score to score it
            for a deal goal from the saved findings, with no new web research.
          </p>
          {!running && (
            <ActionForm action={rescoreProspect.bind(null, prospectId)} className="shrink-0">
              <SubmitButton variant="gradient-outline" size="sm" pendingLabel="Starting…">
                <RefreshCw /> Re-score
              </SubmitButton>
            </ActionForm>
          )}
        </div>
      )}

      {knockout && (
        <div role="note" className="flex items-start gap-3 rounded-2xl border border-destructive/40 px-4 py-3">
          <AlertTriangle className="mt-1 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">Not a fit: {KNOCKOUT_LABEL[knockout.rule].toLowerCase()}</p>
            <RichText text={cleanLabels(knockout.reason)} className="block text-[0.9375rem]" />
            <Sources ids={[knockout.signal_id]} signalById={signalById} />
            <p className="text-[13px] text-muted-foreground/75 italic">This overrides the score. Set knockouts on the ICP.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-baseline gap-3">
        {brief.fit_score !== null ? (
          <>
            <span className={cn("font-heading text-5xl font-semibold tabular-nums", bandTone(brief.fit_band))}>
              {brief.fit_score}
            </span>
            <span className={cn("text-lg font-semibold", bandTone(brief.fit_band))}>{bandLabel(brief.fit_band)}</span>
          </>
        ) : (
          <span className="text-lg font-semibold text-muted-foreground">Insufficient evidence</span>
        )}
        <span className="text-[13px] text-muted-foreground/75 italic">
          {goal
            ? `Based on ${known} of ${defs.length} criteria.${fit?.kind === "scored" && fit.capped ? ` Band capped at Possible: fewer than ${FULL_BAND_KNOWN} criteria known.` : ""}`
            : known === defs.length
              ? "All five criteria have evidence."
              : `${defs.length - known} of ${defs.length} criteria unknown.`}
        </span>
        {goal && !running && (
          <ActionForm action={rescoreProspect.bind(null, prospectId)} className="ml-auto">
            <SubmitButton variant="ghost" size="sm" pendingLabel="Starting…" title="Re-score from the saved findings, with no new web research">
              <RefreshCw /> Re-score
            </SubmitButton>
          </ActionForm>
        )}
      </div>

      <ul className="divide-y rounded-2xl border">
        {rows.map(({ def, c }) => {
          const isK = c ? isKnown(c) : false;
          return (
            <li key={def.key} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_5rem_minmax(0,1fr)] sm:gap-4">
              <div className="font-semibold">{def.label}</div>
              <div className={cn("tabular-nums", isK ? "font-semibold" : "text-muted-foreground italic")}>
                {isK ? `${c!.rating} / ${MAX_RATING}` : "Unknown"}
              </div>
              <div className="space-y-1.5">
                <RichText text={cleanLabels(c?.reason ?? "No evidence found")} className="text-[0.9375rem] leading-relaxed" />
                {c && <Sources ids={c.signal_ids} signalById={signalById} />}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[13px] text-muted-foreground/75 italic">
        {goal
          ? "Each criterion is rated 0, 5, 10, 15 or 20 against written anchors, from sourced evidence. Unknown criteria are left out of the score instead of counting as 0: with fewer than three known there is no score, and with three the band stops at Possible."
          : "Each criterion is rated 0–20 from sourced evidence. Unknown counts as 0; with three or more unknown, no score is given."}
      </p>
    </div>
  );
}

function DecisionForm({ prospect, recommendation }: { prospect: Prospect; recommendation: Brief["recommendation"] }) {
  const options = [
    { value: "pursue", label: "Pursue" },
    { value: "hold", label: "Hold" },
    { value: "skip", label: "Skip" },
  ] as const;
  return (
    <ActionForm action={decide.bind(null, prospect.id)} className="space-y-3 border-t pt-4">
      <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Your decision:</div>
      <p className="text-[0.9375rem]">
        {prospect.decision === "none" ? (
          "Not decided yet."
        ) : (
          <>
            <strong className="capitalize">{prospect.decision}</strong>
            {prospect.decided_at ? ` · ${dateTimeFmt.format(new Date(prospect.decided_at))}` : ""}
            {prospect.decision_reason ? ` · “${prospect.decision_reason}”` : ""}
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <SubmitButton
            key={o.value}
            name="decision"
            value={o.value}
            variant="gradient-outline"
            className={cn(prospect.decision === o.value && "ring-3 ring-brand/30")}
            pendingLabel="Saving…"
          >
            {prospect.decision === o.value && <Check />}
            {o.label}
            {prospect.decision === o.value && <span className="sr-only"> (current decision)</span>}
          </SubmitButton>
        ))}
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">
          Reason, if you choose differently from Polaris{recommendation ? ` (${RECOMMENDATION_LABEL[recommendation].toLowerCase()})` : ""}{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </span>
        <Textarea name="reason" rows={2} />
      </label>
    </ActionForm>
  );
}
