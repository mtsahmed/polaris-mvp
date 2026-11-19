import type { ReactNode } from "react";
import Link from "next/link";
import { Check, FilePenLine, MessageCircleQuestion, Quote, Sparkles } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AiStreamForm } from "@/components/ai-stream-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { OPEN_ANSWERS_LOCATION, parseQa } from "@/lib/questionnaire";
import type { Profile, ProfileIntelligence, ProfileSource } from "@/lib/types";
import { insightsUpToDate } from "@/lib/reruns";
import { applyIntelligence, saveOpenAnswers } from "../actions";

// True when the profile already holds exactly what this draft says, so applying again would
// change nothing (owner review, 18 Nov 2026: the button greys out until a new draft differs).
function draftApplied(profile: Profile, intel: ProfileIntelligence) {
  const same = (a: string | null, b: string) => (a ?? "").trim() === (b ?? "").trim();
  const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x.trim() === b[i].trim());
  return (
    same(profile.positioning, intel.positioning) &&
    same(profile.audience, intel.audience) &&
    sameList(profile.services, intel.services) &&
    sameList(profile.strengths, intel.strengths) &&
    sameList(profile.objectives, intel.objectives)
  );
}

function List({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-base italic text-muted-foreground">Not supported by the sources</p>;
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-base leading-relaxed">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-sans text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function InsightsTab({ profile, sources }: { profile: Profile; sources: ProfileSource[] }) {
  const intel = profile.intelligence;
  const sourceCount = sources.length;
  const openAnswers = new Map(
    parseQa(sources.find((s) => s.kind === "questionnaire" && s.location === OPEN_ANSWERS_LOCATION)?.extracted_text).map(
      (p) => [p.q, p.a],
    ),
  );
  const applied = intel ? draftApplied(profile, intel) : false;

  return (
    <div className="space-y-6">
      {/* 1. Profile insights */}
      <Card>
        <CardHeader className="sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="space-y-3">
            <CardTitle icon={Sparkles}>Profile insights</CardTitle>
            <CardDescription className="max-w-3xl text-base leading-relaxed">
              The AI reads every source on the Sources tab and drafts the profile. Each statement comes with a
              quote from the source it rests on; anything the sources do not establish is listed as an open
              question instead of guessed.
            </CardDescription>
          </div>
          {sourceCount === 0 ? (
            <Link href={`/profiles/${profile.id}?tab=sources`} className={buttonVariants({ variant: "gradient-outline" })}>
              Add sources first
            </Link>
          ) : (
            <AiStreamForm
              task="profile-intelligence"
              fields={{ profileId: profile.id }}
              resultKey={profile.intelligence_generated_at}
              working="Polaris is reading your sources and drafting the profile…"
              note="Up to a minute."
              panelClassName="max-w-xs"
            >
              <SubmitButton
                variant="gradient-outline"
                working
                pendingLabel="Reading sources…"
                upToDate={insightsUpToDate(profile.intelligence_generated_at, intel?.source_ids, sources)}
              >
                <Sparkles /> {intel ? "Regenerate draft" : "Generate draft"}
              </SubmitButton>
            </AiStreamForm>
          )}
        </CardHeader>
        {intel && profile.intelligence_generated_at && (
          <CardContent className="text-sm text-muted-foreground">
            Generated {new Date(profile.intelligence_generated_at).toLocaleString("en-US")} by {intel.model} from{" "}
            {intel.source_ids.length} {intel.source_ids.length === 1 ? "source" : "sources"}. This draft does not
            change the profile until you apply it.
          </CardContent>
        )}
      </Card>

      {intel && (
        <>
          {/* 2. Draft */}
          <Card>
            <CardHeader className="sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="space-y-3">
                <CardTitle icon={FilePenLine}>Draft</CardTitle>
                <CardDescription className="text-base">
                  {applied
                    ? "This draft is on the Profile tab, where you can still edit it. Regenerate the draft to apply new findings."
                    : "Applying replaces positioning, audience, services, strengths and objectives on the Profile tab, where you can still edit them."}
                </CardDescription>
              </div>
              {applied ? (
                <Button variant="outline" disabled className="shrink-0">
                  <Check /> Applied to profile
                </Button>
              ) : (
                <form action={applyIntelligence.bind(null, profile.id)}>
                  <SubmitButton variant="gradient-outline" pendingLabel="Applying…">Apply to profile</SubmitButton>
                </form>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Section title="Positioning">
                  <p className="text-base leading-relaxed">
                    {intel.positioning || <em className="text-muted-foreground">Not supported by the sources</em>}
                  </p>
                </Section>
                <Section title="Audience">
                  <p className="text-base leading-relaxed">
                    {intel.audience || <em className="text-muted-foreground">Not supported by the sources</em>}
                  </p>
                </Section>
              </div>
              <div className="grid gap-6 border-t pt-6 md:grid-cols-3">
                <Section title="Services">
                  <List items={intel.services} />
                </Section>
                <Section title="Strengths">
                  <List items={intel.strengths} />
                </Section>
                <Section title="Objectives">
                  <List items={intel.objectives} />
                </Section>
              </div>
            </CardContent>
          </Card>

          {/* 3. Open questions: answered here (owner review, 18 Nov 2026), saved as a source. */}
          {intel.gaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle icon={MessageCircleQuestion}>Open questions</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  The sources do not answer these. Type what you know below and save: the answers become a source
                  called &ldquo;Answers to open questions&rdquo; on the Sources tab. Then regenerate the draft so it uses them.
                  You can also add a link or file on the{" "}
                  <Link href={`/profiles/${profile.id}?tab=sources`} className="font-medium text-brand underline-offset-4 hover:underline">
                    Sources tab
                  </Link>
                  .
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ActionForm action={saveOpenAnswers.bind(null, profile.id)} className="space-y-5">
                  <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                    {intel.gaps.map((g, i) => (
                      <div key={g} className="space-y-2">
                        <label htmlFor={`answer_${i}`} className="flex items-start gap-2 text-base leading-snug font-medium">
                          <span>{g}</span>
                          {openAnswers.has(g) && (
                            <Badge className="shrink-0 bg-success/15 text-success">Answered</Badge>
                          )}
                        </label>
                        <input type="hidden" name={`question_${i}`} value={g} />
                        <Textarea
                          id={`answer_${i}`}
                          name={`answer_${i}`}
                          rows={2}
                          defaultValue={openAnswers.get(g) ?? ""}
                          placeholder="Your answer (leave empty to skip)"
                          className="placeholder:transition-opacity focus:placeholder:opacity-0"
                        />
                      </div>
                    ))}
                  </div>
                  <SubmitButton variant="gradient-outline" pendingLabel="Saving…" requireChanges>Save answers</SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          )}

          {/* 4. Evidence */}
          <Card>
            <CardHeader>
              <CardTitle icon={Quote}>Evidence</CardTitle>
              <CardDescription className="text-base">{intel.evidence.length} cited statements</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-x-8 gap-y-6 md:grid-cols-2">
                {intel.evidence.map((e, i) => (
                  <li key={i} className="min-w-0 space-y-2 border-l-2 border-gold pl-4">
                    <p className="text-base">{e.claim}</p>
                    {e.quote && (
                      <blockquote className="text-sm italic leading-relaxed text-muted-foreground">“{e.quote}”</blockquote>
                    )}
                    {/^https?:\/\//.test(e.source) ? (
                      <a
                        href={e.source}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm text-muted-foreground underline-offset-4 hover:underline"
                      >
                        {e.source}
                      </a>
                    ) : (
                      <Badge variant="outline">{e.source}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
