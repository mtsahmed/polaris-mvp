import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Globe, Search } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, NativeSelect } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { STAGE_LABEL } from "@/lib/pitch-utils";
import type { PipelineStage } from "@/lib/types";
import { NextAction } from "@/components/next-action";
import { startPitch } from "./actions";

export const metadata: Metadata = { title: "Pitch studio" };
// Research reads the company's site and runs web searches; allow up to five minutes.
export const maxDuration = 300;

type Row = {
  id: string;
  stage: PipelineStage;
  updated_at: string;
  profiles: { name: string } | null;
  companies: { name: string; domain: string | null } | null;
  pitches: { status: string; kind: string }[];
};

export default async function PitchStudioPage(props: PageProps<"/pitch">) {
  const session = await requireSession();
  const { profile: preselect } = await props.searchParams;
  const supabase = await createClient();
  const [{ data: profiles }, { data: rows, error }] = await Promise.all([
    supabase.from("profiles").select("id, name").eq("org_id", session.org.id).order("updated_at", { ascending: false }),
    supabase
      .from("prospects")
      .select("id, stage, updated_at, profiles ( name ), companies ( name, domain ), pitches ( status, kind )")
      .eq("org_id", session.org.id)
      .eq("status", "saved") // suggestions from Discovery appear here once added to the pipeline
      .order("updated_at", { ascending: false })
      .limit(50)
      .returns<Row[]>(),
  ]);
  if (error) throw new Error(error.message);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Weeks 3–4"
        title="Pitch studio"
        description="Paste a company's website. Polaris reads it, searches for recent news with a source for every finding, proposes partnership concepts and drafts the email and follow-up. Nothing is sent: you edit and approve every word."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle icon={Search}>New pitch</CardTitle>
            <CardDescription className="text-base">
              Research takes one to three minutes and is logged in Usage &amp; cost.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!profiles?.length ? (
              <p className="text-base text-muted-foreground">
                Create a profile first; pitches are written on its behalf.{" "}
                <Link href="/profiles/new" className="font-medium text-brand underline-offset-4 hover:underline">
                  New profile
                </Link>
              </p>
            ) : (
              <ActionForm action={startPitch} className="space-y-5">
                <Field
                  id="profile_id"
                  label="Pitching for (your side):"
                  hint="Its website, sources, ICP and writing samples come from the profile; nothing to re-enter."
                >
                  <NativeSelect
                    id="profile_id"
                    name="profile_id"
                    defaultValue={typeof preselect === "string" ? preselect : profiles[0].id}
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field
                  id="url"
                  label="Company to pitch to (their website):"
                  hint={
                    <>
                      The brand you want to pitch your idea, service, partnership or sponsorship to.
                      <br />
                      For example nike.com or a24films.com.
                    </>
                  }
                >
                  <Input id="url" name="url" placeholder="targetcompany.com" required autoComplete="off" />
                </Field>
                <Field
                  id="notes"
                  label="What you already know (optional):"
                  hint={
                    <>
                      A contact you met, an angle to try, things to avoid.
                      <br />
                      The AI uses this as context, not as a source.
                    </>
                  }
                >
                  <Textarea id="notes" name="notes" rows={3} />
                </Field>
                <SubmitButton variant="gradient-outline" pendingLabel="Researching… this takes a minute or two">
                  <Search /> Research company
                </SubmitButton>
              </ActionForm>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle icon={Globe}>Recent pitches</CardTitle>
            <CardDescription className="text-base">
              {rows?.length ? `${rows.length} ${rows.length === 1 ? "company" : "companies"}` : "None yet."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!rows?.length ? (
              <p className="text-base text-muted-foreground">Your researched companies will appear here.</p>
            ) : (
              <ul className="divide-y">
                {rows.map((r) => {
                  const email = r.pitches.find((p) => p.kind === "first_contact");
                  return (
                    <li key={r.id} className="min-w-0">
                      <Link
                        href={`/pitch/${r.id}`}
                        className="group flex items-center gap-4 py-3.5 transition-colors hover:text-brand"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-heading text-lg font-semibold tracking-tight">
                            {r.companies?.name ?? "Company"}
                          </div>
                          <div className="truncate text-sm text-muted-foreground">
                            for {r.profiles?.name ?? "profile"} · {r.companies?.domain}
                          </div>
                        </div>
                        {email ? (
                          email.status === "draft" ? (
                            <Badge variant="secondary">Email draft</Badge>
                          ) : (
                            <Badge className="bg-success/15 text-success">Email approved</Badge>
                          )
                        ) : (
                          <Badge variant="outline">{STAGE_LABEL[r.stage]}</Badge>
                        )}
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-brand" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Sending through Instantly and contacts from Apollo arrive in later phases. For now, copy an approved email into
        your own mail client.{" "}
        <Link href="/usage" className={buttonVariants({ variant: "link", className: "h-auto p-0 text-sm" })}>
          See costs
        </Link>
      </p>
      <NextAction current="pitch" />
    </div>
  );
}
