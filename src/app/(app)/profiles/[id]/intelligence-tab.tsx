import type { ReactNode } from "react";
import Link from "next/link";
import { FilePenLine, MessageCircleQuestion, Quote, Sparkles } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Profile } from "@/lib/types";
import { applyIntelligence, generateIntelligence } from "../actions";

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

export function IntelligenceTab({ profile, sourceCount }: { profile: Profile; sourceCount: number }) {
  const intel = profile.intelligence;

  return (
    <div className="space-y-6">
      {/* 1. Profile intelligence */}
      <Card>
        <CardHeader className="sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="space-y-3">
            <CardTitle icon={Sparkles}>Profile intelligence</CardTitle>
            <CardDescription className="max-w-3xl text-base leading-relaxed">
              The AI reads every source on the Sources tab and drafts the profile. Each statement comes with a
              quote from the source it rests on; anything the sources do not establish is listed as an open
              question instead of guessed.
            </CardDescription>
          </div>
          {sourceCount === 0 ? (
            <Link href={`/profiles/${profile.id}?tab=sources`} className={buttonVariants()}>
              Add sources first
            </Link>
          ) : (
            <ActionForm action={generateIntelligence.bind(null, profile.id)}>
              <SubmitButton pendingLabel="Reading sources… (up to a minute)">
                <Sparkles /> {intel ? "Regenerate draft" : "Generate draft"}
              </SubmitButton>
            </ActionForm>
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
                  Applying replaces positioning, audience, services, strengths and objectives on the Profile tab,
                  where you can still edit them.
                </CardDescription>
              </div>
              <form action={applyIntelligence.bind(null, profile.id)}>
                <SubmitButton pendingLabel="Applying…">Apply to profile</SubmitButton>
              </form>
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

          {/* 3. Open questions */}
          {intel.gaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle icon={MessageCircleQuestion}>Open questions</CardTitle>
                <CardDescription className="text-base">
                  The sources do not answer these. Add a source or answer them in the questionnaire.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid list-disc gap-x-10 gap-y-2 pl-5 text-base leading-relaxed md:grid-cols-2">
                  {intel.gaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
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
