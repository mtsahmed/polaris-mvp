import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Profile } from "@/lib/types";
import { applyIntelligence, generateIntelligence } from "../actions";

function List({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm italic text-muted-foreground">Not supported by the sources</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

export function IntelligenceTab({ profile, sourceCount }: { profile: Profile; sourceCount: number }) {
  const intel = profile.intelligence;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="space-y-1.5">
            <CardTitle>Profile intelligence</CardTitle>
            <CardDescription className="max-w-xl">
              Claude reads every source on the Sources tab and drafts the profile (OpenAI steps in only if Claude is unavailable). Each statement comes with a
              quote from the source it rests on; anything the sources do not establish is listed as an open
              question instead of guessed.
            </CardDescription>
          </div>
          {sourceCount === 0 ? (
            <Link href={`/profiles/${profile.id}?tab=sources`} className={buttonVariants({ variant: "outline" })}>
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
          <CardContent className="text-xs text-muted-foreground">
            Generated {new Date(profile.intelligence_generated_at).toLocaleString("en-US")} by {intel.model} from{" "}
            {intel.source_ids.length} {intel.source_ids.length === 1 ? "source" : "sources"}. This draft does not
            change the profile until you apply it.
          </CardContent>
        )}
      </Card>

      {intel && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Draft</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <section className="space-y-1">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Positioning</h3>
                  <p className="text-sm">{intel.positioning || <em className="text-muted-foreground">Not supported by the sources</em>}</p>
                </section>
                <section className="space-y-1">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Audience</h3>
                  <p className="text-sm">{intel.audience || <em className="text-muted-foreground">Not supported by the sources</em>}</p>
                </section>
                <section className="space-y-1">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Services</h3>
                  <List items={intel.services} />
                </section>
                <section className="space-y-1">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Strengths</h3>
                  <List items={intel.strengths} />
                </section>
                <section className="space-y-1">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Objectives</h3>
                  <List items={intel.objectives} />
                </section>
                <form action={applyIntelligence.bind(null, profile.id)} className="border-t pt-4">
                  <SubmitButton pendingLabel="Applying…">Apply to profile</SubmitButton>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Replaces positioning, audience, services, strengths and objectives on the Profile tab, where you can edit them.
                  </p>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Evidence</CardTitle>
                  <CardDescription>{intel.evidence.length} cited statements</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    {intel.evidence.map((e, i) => (
                      <li key={i} className="space-y-1.5 border-l-2 border-gold/60 pl-3">
                        <p className="text-sm">{e.claim}</p>
                        {e.quote && <blockquote className="text-xs italic text-muted-foreground">“{e.quote}”</blockquote>}
                        {/^https?:\/\//.test(e.source) ? (
                          <a href={e.source} target="_blank" rel="noreferrer" className="block truncate text-xs text-muted-foreground underline-offset-4 hover:underline">
                            {e.source}
                          </a>
                        ) : (
                          <Badge variant="outline" className="text-[11px]">
                            {e.source}
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {intel.gaps.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Open questions</CardTitle>
                    <CardDescription>The sources do not answer these. Add a source or answer them in the questionnaire.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <List items={intel.gaps} />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
