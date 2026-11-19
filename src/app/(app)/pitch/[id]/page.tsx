import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Lightbulb, Mail, MessageCircleQuestion, NotebookPen, RefreshCw, Search, Sparkles } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AiStreamForm } from "@/components/ai-stream-form";
import { conceptsUpToDate, emailUpToDate, researchUpToDate } from "@/lib/reruns";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { NextAction } from "@/components/next-action";
import { FollowProfile } from "@/components/profile-switcher";
import { ProspectStageBar } from "@/components/prospect-stage-bar";
import { activeProfile } from "@/lib/profile-selection";
import { CopyButton } from "@/components/copy-button";
import { Field, NativeSelect } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { RichText } from "@/components/rich-text";
import { SourceChip } from "@/components/source-chip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { modelDisplayName } from "@/lib/ai/models";
import { DEAL_TYPE_INFO, orderSignals, signalLabel, STAGE_LABEL } from "@/lib/pitch-utils";
import { cleanHref, hostOf } from "@/lib/rich-text";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { DEAL_TYPES, type Company, type Concept, type Pitch, type Prospect, type Signal } from "@/lib/types";
import {
  approvePitch,
  chooseConcept,
  deletePitchWorkspace,
  saveConcept,
  saveNotes,
  savePitch,
} from "../actions";
import { followProfile } from "../../profile-actions";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function formatDate(value: string) {
  // Plain dates (YYYY-MM-DD) are shown as written, without a time-zone shift.
  return dateFmt.format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value));
}

export async function generateMetadata(props: PageProps<"/pitch/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("prospects").select("companies ( name )").eq("id", id).maybeSingle();
  const name = (data?.companies as unknown as { name: string } | null)?.name;
  return { title: name ? `Pitch: ${name}` : "Pitch" };
}

export default async function PitchWorkspacePage(props: PageProps<"/pitch/[id]">) {
  const { id } = await props.params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", id).maybeSingle<Prospect>();
  if (!prospect) notFound();
  const [{ data: company }, { data: profile }, { data: signalRows }, { data: concepts }, { data: pitches }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", prospect.company_id).single<Company>(),
    supabase.from("profiles").select("id, name").eq("id", prospect.profile_id).single<{ id: string; name: string }>(),
    supabase.from("signals").select("*").eq("company_id", prospect.company_id).returns<Signal[]>(),
    supabase.from("concepts").select("*").eq("prospect_id", id).order("created_at").returns<Concept[]>(),
    supabase.from("pitches").select("*").eq("prospect_id", id).returns<Pitch[]>(),
  ]);
  if (!company || !profile) notFound();
  const { active } = await activeProfile();

  const signals = orderSignals(signalRows ?? []);
  const labelOf = new Map(signals.map((s, i) => [s.id, signalLabel(i)]));
  const selected = concepts?.find((c) => c.selected) ?? null;
  const email = pitches?.find((p) => p.kind === "first_contact") ?? null;
  const followUp = pitches?.find((p) => p.kind === "follow_up") ?? null;
  const websiteUrl = company.website ?? (company.domain ? `https://${company.domain}` : null);

  return (
    <div className="mx-auto max-w-7xl">
      <FollowProfile profileId={profile.id} activeId={active?.id ?? null} follow={followProfile} />
      <div className="mb-4 text-sm">
        <Link href="/pitch" className="text-muted-foreground hover:text-foreground">
          ← Pitch studio
        </Link>
      </div>
      <PageHeader
        eyebrow={`Pitch for ${profile.name}`}
        title={company.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{STAGE_LABEL[prospect.stage]}</Badge>
            {company.industry && <Badge variant="secondary">{company.industry}</Badge>}
            {company.location && <Badge variant="secondary">{company.location}</Badge>}
            {websiteUrl && (
              <a href={websiteUrl} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                {company.domain ?? hostOf(websiteUrl)}
              </a>
            )}
          </span>
        }
        actions={<ConfirmSubmit action={deletePitchWorkspace.bind(null, prospect.id)} label="Delete pitch" />}
      />
      <ProspectStageBar stage={prospect.stage} className="-mt-6 mb-8" />

      <div className="space-y-6">
        {/* 01 Research */}
        <Card>
          <CardHeader className="sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="kicker">Step 1</div>
              <CardTitle icon={Search}>Research</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                What Polaris found about {company.name}, with a source for every finding.
              </CardDescription>
              <p className="text-[0.8125rem] leading-relaxed text-muted-foreground italic">
                {prospect.researched_at ? (
                  <>
                    Researched {dateTimeFmt.format(new Date(prospect.researched_at))}
                    {prospect.research_model ? ` with ${modelDisplayName(prospect.research_model)}` : ""} ·{" "}
                    {signals.length} cited {signals.length === 1 ? "finding" : "findings"} · Findings whose link the AI
                    had not actually read are dropped.
                  </>
                ) : (
                  prospect.discovered_at
                    ? "Not researched yet. The findings below come from Discovery; Research company reads the site and searches for more."
                    : "Not researched yet."
                )}
              </p>
            </div>
            <AiStreamForm
              task="pitch-research"
              fields={{ prospectId: prospect.id }}
              resultKey={prospect.researched_at}
              panelSlot="pitch-research-panel"
              working="Polaris is reading the site and searching for evidence…"
              note="This takes a minute or two. If you leave, the research still finishes and is saved."
              className="mt-4 shrink-0 sm:mt-0"
            >
              <SubmitButton
                variant="gradient-outline"
                working
                pendingLabel="Researching…"
                upToDate={researchUpToDate(prospect.researched_at)}
              >
                <RefreshCw /> {prospect.researched_at ? "Refresh research" : "Research company"}
              </SubmitButton>
            </AiStreamForm>
          </CardHeader>
          <CardContent className="space-y-8">
            <div id="pitch-research-panel" className="empty:hidden" />
            {company.summary && (
              <section className="rounded-2xl border-l-4 border-brand/60 bg-muted/50 px-6 py-5">
                <h3 className="mb-2 font-mono text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  At a glance
                </h3>
                <p className="text-lg leading-relaxed">
                  <RichText text={company.summary} />
                </p>
              </section>
            )}

            <section className="space-y-4">
              <h3 className="flex items-baseline gap-2 font-heading text-lg font-semibold">
                Findings <span className="text-sm font-normal text-muted-foreground">{signals.length}</span>
              </h3>
              {signals.length === 0 ? (
                <p className="rounded-2xl border border-dashed px-5 py-6 text-base text-muted-foreground">
                  No cited findings were kept. Try refreshing, picking another model, or adding notes about what to
                  look for.
                </p>
              ) : (
                <ol className="grid gap-4 md:grid-cols-2">
                  {signals.map((s, i) => (
                    <li
                      key={s.id}
                      className="flex flex-col gap-3 rounded-2xl border bg-card p-5 transition-shadow hover:shadow-[0_10px_30px_-18px_rgb(196_0_106/0.35)]"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge className="bg-brand/10 font-mono text-brand">{signalLabel(i)}</Badge>
                        <Badge variant="outline" className="capitalize">
                          {s.type}
                        </Badge>
                        <span className={cn("ml-auto text-xs", !s.source_date && "italic")}>
                          {s.source_date ? formatDate(s.source_date) : "Undated"}
                        </span>
                      </div>
                      <p className="text-base leading-relaxed">
                        <RichText text={s.summary} omitHref={s.source_url} />
                      </p>
                      {s.quote && (
                        <blockquote className="border-l-2 border-gold pl-3 text-sm leading-relaxed text-muted-foreground italic">
                          “{s.quote}”
                        </blockquote>
                      )}
                      <div className="mt-auto flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
                        Source
                        <SourceChip href={cleanHref(s.source_url)} host={hostOf(s.source_url)} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="space-y-3 rounded-2xl border border-dashed p-5">
                <h3 className="flex items-center gap-2 font-heading text-lg font-semibold">
                  <MessageCircleQuestion className="size-5 text-muted-foreground" /> Not established
                </h3>
                <p className="text-[0.8125rem] text-muted-foreground italic">
                  Open questions to check before pitching. They are not used as facts.
                </p>
                {prospect.research_gaps.length ? (
                  <ul className="space-y-2.5 text-[0.9375rem] leading-relaxed">
                    {prospect.research_gaps.map((g) => (
                      <li key={g} className="flex gap-2.5">
                        <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold" />
                        <span>
                          <RichText text={g} />
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-base text-muted-foreground">Nothing flagged.</p>
                )}
              </section>
              <ActionForm action={saveNotes.bind(null, prospect.id)} className="space-y-3">
                <Field
                  id="notes"
                  label="Your notes:"
                  hint="Used as context for concepts and emails, never quoted as research."
                >
                  <Textarea
                    id="notes"
                    name="notes"
                    rows={6}
                    defaultValue={prospect.notes ?? ""}
                    placeholder="e.g. Met their brand lead at SXSW; they want creator content for a Q2 launch. Avoid paid-media angles."
                  />
                </Field>
                <SubmitButton variant="gradient-outline" requireChanges>
                  <NotebookPen /> Save notes
                </SubmitButton>
              </ActionForm>
            </div>
          </CardContent>
        </Card>

        {/* 02 Concepts */}
        <Card>
          <CardHeader className="sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="kicker">Step 2</div>
              <CardTitle icon={Lightbulb}>Pitch concepts</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                Two or three ideas built on the research, each tagged with its deal type. Edit any of them, then choose the one to pitch.
              </CardDescription>
            </div>
            <AiStreamForm
              task="pitch-concepts"
              fields={{ prospectId: prospect.id }}
              resultKey={concepts?.map((c) => c.id).join(",") ?? ""}
              panelSlot="pitch-concepts-panel"
              working="Polaris is drafting concepts from the research…"
              note="Usually under a minute."
            >
              <SubmitButton
                variant="gradient-outline"
                working
                pendingLabel="Drafting concepts…"
                upToDate={conceptsUpToDate(prospect.updated_at, concepts ?? [])}
              >
                <Sparkles /> {concepts?.length ? "Redraft concepts" : "Draft concepts"}
              </SubmitButton>
            </AiStreamForm>
          </CardHeader>
          <CardContent>
            <div id="pitch-concepts-panel" className="mb-5 empty:hidden" />
            {!concepts?.length ? (
              <p className="text-base text-muted-foreground">
                {signals.length ? "No concepts yet." : "Concepts need at least one cited finding."}
              </p>
            ) : (
              <div
                className={cn(
                  "grid gap-5",
                  concepts.length === 2 && "lg:grid-cols-2",
                  concepts.length >= 3 && "lg:grid-cols-2 xl:grid-cols-3",
                )}
              >
                {concepts.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      "flex flex-col gap-4 rounded-2xl border p-5",
                      c.selected && "border-brand/60 bg-brand/[0.03] ring-2 ring-brand/30",
                    )}
                  >
                    {c.deal_type && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                            Pitch concept tags:
                          </span>
                          <Badge className="h-7 bg-brand px-3 text-sm font-semibold text-white dark:text-brand-ink">
                            {DEAL_TYPE_INFO[c.deal_type].label}
                          </Badge>
                          {c.deal_angle && (
                            <Badge variant="outline" className="h-7 border-brand/40 px-3 text-sm font-medium text-brand">
                              {c.deal_angle}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[13px] leading-snug text-muted-foreground/75 italic">
                          {DEAL_TYPE_INFO[c.deal_type].next}
                        </p>
                      </div>
                    )}
                    <ActionForm
                      action={saveConcept.bind(null, prospect.id, c.id)}
                      className="space-y-4"
                      key={`${c.id}-${c.title}-${c.deal_type}-${c.deal_angle}`}
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field id={`deal-type-${c.id}`} label="Deal type">
                          <NativeSelect id={`deal-type-${c.id}`} name="deal_type" defaultValue={c.deal_type ?? ""}>
                            <option value="">Not set</option>
                            {DEAL_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {DEAL_TYPE_INFO[t].label}
                              </option>
                            ))}
                          </NativeSelect>
                        </Field>
                        <Field id={`deal-angle-${c.id}`} label="Angle">
                          <Input
                            id={`deal-angle-${c.id}`}
                            name="deal_angle"
                            defaultValue={c.deal_angle ?? ""}
                            placeholder="e.g. Discounted pilot"
                          />
                        </Field>
                      </div>
                      <Field id={`title-${c.id}`} label="Title">
                        <Input id={`title-${c.id}`} name="title" defaultValue={c.title} required placeholder="e.g. Co-branded launch series" />
                      </Field>
                      <Field id={`description-${c.id}`} label="The idea">
                        <Textarea
                          id={`description-${c.id}`}
                          name="description"
                          rows={5}
                          defaultValue={c.description}
                          required
                          placeholder="e.g. A three-part video series showing their product in real client workflows."
                        />
                      </Field>
                      <Field id={`rationale-${c.id}`} label="Why they would say yes now">
                        <Textarea
                          id={`rationale-${c.id}`}
                          name="commercial_rationale"
                          rows={4}
                          defaultValue={c.commercial_rationale ?? ""}
                          placeholder="e.g. They launch a new product line in Q2 and are hiring creative partners now."
                        />
                      </Field>
                      {c.signal_ids.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                          Built on
                          {c.signal_ids.map((sid) =>
                            labelOf.has(sid) ? (
                              <Badge key={sid} className="bg-brand/10 font-mono text-brand">
                                {labelOf.get(sid)}
                              </Badge>
                            ) : null,
                          )}
                        </div>
                      )}
                      <SubmitButton variant="ghost" className="-ml-3" requireChanges>
                        Save changes
                      </SubmitButton>
                    </ActionForm>
                    <div className="mt-auto border-t pt-4">
                      {c.selected ? (
                        <span className="inline-flex items-center gap-2 text-base font-medium text-brand">
                          <CheckCircle2 className="size-5" /> Chosen concept
                        </span>
                      ) : (
                        <form action={chooseConcept.bind(null, prospect.id, c.id)}>
                          <SubmitButton variant="gradient-outline" pendingLabel="Choosing…">
                            Use this concept
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 03 Pitch */}
        <Card>
          <CardHeader className="sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="kicker">Step 3</div>
              <CardTitle icon={Mail}>Email and follow-up</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                {selected
                  ? `Written for “${selected.title}” in ${profile.name}'s voice (from its writing samples). Drafts stay drafts until you approve them; editing an approved email sends it back to draft.`
                  : "Choose a concept above first."}
              </CardDescription>
            </div>
            {selected && (
              <AiStreamForm
                task="pitch-email"
                fields={{ prospectId: prospect.id }}
                resultKey={email?.id ?? ""}
                panelSlot="pitch-email-panel"
                working="Polaris is writing the email in the profile's voice…"
                note="Usually under a minute. The draft appears below as it is written."
              >
                <SubmitButton
                  variant="gradient-outline"
                  working
                  pendingLabel="Writing the email…"
                  upToDate={emailUpToDate(email?.created_at, {
                    prospectUpdatedAt: prospect.updated_at,
                    conceptUpdatedAt: selected?.updated_at,
                  })}
                >
                  <Sparkles /> {email ? "Rewrite both" : "Write email"}
                </SubmitButton>
              </AiStreamForm>
            )}
          </CardHeader>
          <CardContent>
            <div id="pitch-email-panel" className="mb-5 empty:hidden" />
            {!email && !followUp ? (
              <p className="text-base text-muted-foreground">
                {selected ? "No email yet." : "The email is written from the chosen concept and the cited research."}
              </p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {[email, followUp].map((p) =>
                  p ? (
                    <PitchEditor
                      key={`${p.id}-${p.updated_at}`}
                      prospectId={prospect.id}
                      pitch={p}
                      approvedByMe={p.approved_by === session.userId}
                      stale={Boolean(selected && p.concept_id !== selected.id)}
                    />
                  ) : null,
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <NextAction current="pitch" profileId={profile.id} />
    </div>
  );
}

function PitchEditor({
  prospectId,
  pitch,
  approvedByMe,
  stale,
}: {
  prospectId: string;
  pitch: Pitch;
  approvedByMe: boolean;
  stale: boolean;
}) {
  const title = pitch.kind === "first_contact" ? "First email" : "Follow-up";
  const approved = pitch.status !== "draft";
  const copyText = `Subject: ${pitch.subject ?? ""}\n\n${pitch.body}`;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-heading text-xl font-semibold tracking-tight">{title}</h3>
        {approved ? (
          <Badge className="bg-success/15 text-success">
            Approved{pitch.approved_at ? ` ${dateTimeFmt.format(new Date(pitch.approved_at))}` : ""}
            {approvedByMe ? " by you" : ""}
          </Badge>
        ) : (
          <Badge variant="secondary">Draft</Badge>
        )}
      </div>
      {pitch.kind === "follow_up" && (
        <p className="text-[13px] italic text-muted-foreground/75">Send 3–5 business days after the first email if there is no reply.</p>
      )}
      {stale && (
        <p className="rounded-xl bg-gold/15 px-3 py-2 text-sm">
          Written for a different concept than the one now chosen. Rewrite if you want them to match.
        </p>
      )}
      <ActionForm action={savePitch.bind(null, prospectId, pitch.id)} className="space-y-4">
        <Field id={`subject-${pitch.id}`} label="Subject line">
          <Input id={`subject-${pitch.id}`} name="subject" defaultValue={pitch.subject ?? ""} placeholder="e.g. An idea for your Q2 creator launch" />
        </Field>
        <Field id={`body-${pitch.id}`} label="Body" hint={`${wordCount(pitch.body)} words saved`}>
          <Textarea
            id={`body-${pitch.id}`}
            name="body"
            rows={12}
            defaultValue={pitch.body}
            placeholder="e.g. Hi Maria, I saw your team is launching… (keep it under 120 words)"
            className="text-[0.9375rem] leading-7"
            required
          />
        </Field>
        <SubmitButton variant="gradient-outline" requireChanges>Save edits</SubmitButton>
      </ActionForm>
      <div className="mt-auto flex flex-wrap items-center gap-3 border-t pt-4">
        {approved ? (
          <CopyButton text={copyText} label="Copy approved email" />
        ) : (
          <form action={approvePitch.bind(null, prospectId, pitch.id)}>
            <SubmitButton variant="gradient-outline" pendingLabel="Approving…">
              <CheckCircle2 /> Approve
            </SubmitButton>
          </form>
        )}
        <span className="text-sm text-muted-foreground">
          {pitch.status === "sent" ? (
            <>
              Sent{pitch.sent_at ? ` ${dateTimeFmt.format(new Date(pitch.sent_at))}` : ""}. A sent email can no longer be edited.
            </>
          ) : approved ? (
            <>
              Send it from{" "}
              <Link href="/outreach" className="font-medium text-brand hover:underline">
                Outreach
              </Link>
              .
            </>
          ) : (
            "Approving records you as the approver of this exact text."
          )}
        </span>
      </div>
    </div>
  );
}

function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}
