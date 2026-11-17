import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronDown, Info, MailCheck, RefreshCw, Save, Search, Telescope, Trash2, UserPlus, Users } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { EmailStatusBadge, UnconfirmedEmailBadge } from "@/components/contact-badges";
import { Field } from "@/components/field";
import { NextAction } from "@/components/next-action";
import { PageHeader } from "@/components/page-header";
import { PolarisWorking } from "@/components/polaris-working";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apolloConfigured } from "@/lib/contacts/apollo";
import { effectiveJobStatus, isActive, stepLine } from "@/lib/contacts/job-status";
import type { Brief } from "@/lib/intelligence/types";
import { STAGE_LABEL } from "@/lib/outreach/rules";
import { cleanHref } from "@/lib/rich-text";
import { activeProfile } from "@/lib/profile-selection";
import { createClient } from "@/lib/supabase/server";
import type { Company, Contact, ContactJob, Prospect } from "@/lib/types";
import { addContact, deleteContact, findAllContacts, recheckEmails, saveMobile, searchAgain } from "./actions";
import { ApolloFinder } from "./apollo-finder";

export const metadata: Metadata = { title: "Contacts" };
// Contact jobs run after the response (after()) within this limit.
export const maxDuration = 300;

const FOUND_AT = ["Google Maps", "Company website", "LinkedIn", "Other"];

type JobRow = Pick<ContactJob, "prospect_id" | "status" | "summary" | "saved_count" | "error" | "created_at" | "finished_at">;

function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

type Row = Pick<Prospect, "id" | "company_id" | "stage"> & { companies: Pick<Company, "name" | "domain" | "location"> | null };

// A plain Google Maps search link: opens Maps for the user, uses no API and stores nothing.
function mapsHref(name: string, location: string | null | undefined) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, location].filter(Boolean).join(" "))}`;
}

export default async function ContactsPage(props: PageProps<"/contacts">) {
  const { company } = await props.searchParams;
  const { active } = await activeProfile();
  if (!active) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader eyebrow="Contacts" title="Contacts" />
        <p className="text-base text-muted-foreground">Create a profile first.</p>
      </div>
    );
  }
  const supabase = await createClient();

  // Only companies the user marked pursue appear here (spec 7.6).
  const { data: rows, error } = await supabase
    .from("prospects")
    .select("id, company_id, stage, companies ( name, domain, location )")
    .eq("profile_id", active.id)
    .eq("decision", "pursue")
    .neq("status", "rejected")
    .order("decided_at", { ascending: false })
    .returns<Row[]>();
  if (error) throw new Error(error.message);
  const prospects = rows ?? [];
  const ids = prospects.map((p) => p.id);
  const companyIds = prospects.map((p) => p.company_id);

  const [contactsRes, briefsRes, jobsRes] = await Promise.all([
    companyIds.length
      ? supabase.from("contacts").select("*").in("company_id", companyIds).order("created_at").returns<Contact[]>()
      : { data: [] as Contact[], error: null },
    ids.length
      ? supabase
          .from("briefs")
          .select("prospect_id, version, target_roles")
          .in("prospect_id", ids)
          .order("version", { ascending: false })
          .returns<Pick<Brief, "prospect_id" | "version" | "target_roles">[]>()
      : { data: [] as Pick<Brief, "prospect_id" | "version" | "target_roles">[], error: null },
    ids.length
      ? supabase
          .from("contact_jobs")
          .select("prospect_id, status, summary, saved_count, error, created_at, finished_at")
          .in("prospect_id", ids)
          .order("created_at", { ascending: false })
          .returns<JobRow[]>()
      : { data: [] as JobRow[], error: null },
  ]);
  // 42703: a contacts migration has not been run yet.
  if (contactsRes.error?.code === "42703") return <MigrationNotice file="20261118000000_contacts_outreach.sql" />;
  const probe = await supabase.from("contacts").select("phone, whatsapp, source_url").limit(1);
  // 42703 / 42P01: the contact-sources migration (new columns and the contact_jobs table) is missing.
  if (probe.error?.code === "42703" || ["42P01", "PGRST205"].includes(jobsRes.error?.code ?? "")) return <MigrationNotice file="20261119000000_contact_web_sources.sql" />;
  const probe2 = await supabase.from("contacts").select("email_unconfirmed").limit(1);
  if (probe2.error?.code === "42703") return <MigrationNotice file="20261120000000_email_confirmation.sql" />;
  if (contactsRes.error) throw new Error(contactsRes.error.message);

  const rolesOf = new Map<string, Brief["target_roles"]>();
  for (const b of briefsRes.data ?? []) if (!rolesOf.has(b.prospect_id)) rolesOf.set(b.prospect_id, b.target_roles ?? []);
  const connected = apolloConfigured();
  const jobOf = new Map<string, JobRow>();
  for (const j of jobsRes.data ?? []) if (!jobOf.has(j.prospect_id)) jobOf.set(j.prospect_id, j);
  const anyRunning = [...jobOf.values()].some((j) => isActive(j));
  // One company at a time (owner review, 17 Nov 2026): the one chosen with ?company= (the brief's
  // Next action), else the most recently pursued; the rest sit in a collapsed Other contacts block.
  const focus = prospects.find((p) => p.id === company) ?? prospects[0] ?? null;
  const others = prospects.filter((p) => p !== focus);

  const renderCompany = (p: Row, nested = false) => {
    const contacts = (contactsRes.data ?? []).filter((c) => c.company_id === p.company_id);
    const roles = rolesOf.get(p.id) ?? [];
    const job = jobOf.get(p.id) ?? null;
    return (
      <Card key={p.id} className={nested ? "shadow-none ring-0" : undefined}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle icon={Users}>{p.companies?.name ?? "Company"}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{STAGE_LABEL[p.stage]}</Badge>
              <Link href={`/intelligence/${p.id}`} className="text-sm font-medium text-brand hover:underline">
                Brief
              </Link>
              <Link href={`/pitch/${p.id}`} className="text-sm font-medium text-brand hover:underline">
                Pitch
              </Link>
              <a
                href={mapsHref(p.companies?.name ?? "", p.companies?.location)}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm font-medium text-brand hover:underline"
              >
                Google Maps
              </a>
            </div>
          </div>
          {roles.length > 0 && (
            <CardDescription className="text-[0.9375rem]">
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Roles to approach: </span>
              {roles.map((r) => r.role).join(" · ")}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <JobStatus prospectId={p.id} job={job} hasContacts={contacts.length > 0} unconfirmed={contacts.filter((c) => c.email && c.email_unconfirmed).length} />
          {contacts.length > 0 ? (
            <ContactsTable contacts={contacts} />
          ) : (
            <p className="text-[0.9375rem] text-muted-foreground">No contacts yet.</p>
          )}

          <div className="space-y-2">
            <div className="text-sm font-semibold">Find people in Apollo</div>
            <ApolloFinder prospectId={p.id} connected={connected} />
          </div>

          <details className="rounded-2xl border p-4">
            <summary className="flex cursor-pointer items-center gap-2 font-semibold">
              <UserPlus className="size-4 text-brand" /> Add details you found yourself (Google Maps, LinkedIn…)
            </summary>
            <ActionForm action={addContact.bind(null, p.id)} resetOnSuccess className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field id={`name-${p.id}`} label="Name">
                <Input id={`name-${p.id}`} name="name" required />
              </Field>
              <Field id={`title-${p.id}`} label="Job title">
                <Input id={`title-${p.id}`} name="title" />
              </Field>
              <Field id={`email-${p.id}`} label="Work email" hint="Saved as unverified: Polaris has not checked it.">
                <Input id={`email-${p.id}`} name="email" type="email" />
              </Field>
              <Field id={`phone-${p.id}`} label="Office or main line">
                <Input id={`phone-${p.id}`} name="phone" />
              </Field>
              <Field id={`mobile-${p.id}`} label="Mobile">
                <Input id={`mobile-${p.id}`} name="mobile" />
              </Field>
              <Field id={`whatsapp-${p.id}`} label="WhatsApp">
                <Input id={`whatsapp-${p.id}`} name="whatsapp" />
              </Field>
              <Field id={`found-${p.id}`} label="Where you found them">
                <select
                  id={`found-${p.id}`}
                  name="found_at"
                  defaultValue="Google Maps"
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                >
                  {FOUND_AT.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </Field>
              <Field id={`other-${p.id}`} label="If Other, where" hint="For example: a conference speaker list.">
                <Input id={`other-${p.id}`} name="found_at_other" />
              </Field>
              <div className="sm:col-span-2">
                <Field id={`url-${p.id}`} label="Page link (optional)" hint="The page the details are on, such as the Google Maps listing.">
                  <Input id={`url-${p.id}`} name="source_url" type="url" placeholder="https://" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <SubmitButton variant="gradient-outline">
                  <UserPlus /> Save contact
                </SubmitButton>
              </div>
            </ActionForm>
          </details>
        </CardContent>
      </Card>
    );
  };

  // A company in Other contacts: one row (name, stage, contact count); the arrow opens its card.
  const renderCollapsed = (p: Row) => {
    const count = (contactsRes.data ?? []).filter((c) => c.company_id === p.company_id).length;
    return (
      <details key={p.id} className="group/company rounded-2xl border bg-card shadow-sm">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
          <Users className="size-5 text-brand" aria-hidden="true" />
          <span className="font-heading text-base font-semibold tracking-tight">{p.companies?.name ?? "Company"}</span>
          <Badge variant="outline">{STAGE_LABEL[p.stage]}</Badge>
          <span className="text-[13px] text-muted-foreground/75 italic">
            {count} {count === 1 ? "contact" : "contacts"}
          </span>
          <ChevronDown
            className="ml-auto size-5 text-muted-foreground transition-transform group-open/company:rotate-180"
            aria-hidden="true"
          />
          <span className="sr-only">Show contacts</span>
        </summary>
        <div className="border-t">{renderCompany(p, true)}</div>
      </details>
    );
  };

  const waiting = prospects.filter((p) => !(contactsRes.data ?? []).some((c) => c.company_id === p.company_id) && !isActive(jobOf.get(p.id))).length;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Contacts"
        title="Contacts"
        description={`Polaris finds the people to approach at the companies ${active.name} chose to pursue: Apollo first when your plan allows, then public web pages. Every contact shows where it came from, and an email or number is kept only if Polaris found it on its source page.`}
        actions={
          prospects.length ? (
            <div className="flex flex-col items-end gap-1.5">
              <ActionForm action={findAllContacts} className="flex justify-end">
                <SubmitButton variant="gradient-outline" disabled={!waiting} working pendingLabel="Starting searches…">
                  <Search /> {waiting ? `Find contacts for all (${waiting})` : "All companies searched"}
                </SubmitButton>
              </ActionForm>
              <a href="/contacts/export" className="text-[13px] text-muted-foreground/75 italic hover:underline">
                Download CSV (backup)
              </a>
            </div>
          ) : null
        }
      />
      <AutoRefresh active={anyRunning} />

      {prospects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle icon={Telescope}>No companies to pursue yet</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Contacts are found only for companies you mark as pursue in Intelligence, so Apollo credits are spent on real interest.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/intelligence" className={buttonVariants({ variant: "gradient-outline" })}>
              <ArrowRight /> Open Intelligence
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {focus && renderCompany(focus)}
          {others.length > 0 && (
            <details className="group rounded-3xl border border-dashed p-5">
              <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
                <span className="space-y-0.5">
                  <span className="block text-lg font-semibold tracking-tight">Other contacts ({others.length})</span>
                  <span className="block text-[13px] text-muted-foreground/75 italic">Contacts of previously contacted companies</span>
                </span>
                <ChevronDown className="mt-1 ml-auto size-5 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                <span className="sr-only">Show other companies</span>
              </summary>
              <div className="mt-5 space-y-3">{others.map(renderCollapsed)}</div>
            </details>
          )}
        </div>
      )}
      <NextAction current="contacts" />
    </div>
  );
}

function MigrationNotice({ file }: { file: string }) {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="Contacts" title="Contacts" />
      <Card>
        <CardContent className="py-6 text-base leading-relaxed text-muted-foreground">
          Contacts needs one database change. In the Supabase SQL Editor, paste and run the file{" "}
          <code className="font-mono text-sm">supabase/migrations/{file}</code>, then reload this page.
        </CardContent>
      </Card>
    </div>
  );
}

// The latest contact-finding run for a company, with Search again once it has finished.
function JobStatus({ prospectId, job, hasContacts, unconfirmed }: { prospectId: string; job: JobRow | null; hasContacts: boolean; unconfirmed: number }) {
  const status = job ? effectiveJobStatus(job) : null;
  if (job && (status === "queued" || status === "running")) {
    return (
      <PolarisWorking panel>
        Finding contacts… started {when(job.created_at)}. Usually 1–3 minutes; the page updates by itself.
      </PolarisWorking>
    );
  }
  const line = !job
    ? hasContacts
      ? null
      : "Not searched yet."
    : status === "failed"
      ? `Search failed${job.error ? `: ${job.error}` : "."}`
      : `Searched ${when(job.finished_at ?? job.created_at)} · ${job.saved_count} contact${job.saved_count === 1 ? "" : "s"} added or completed`;
  const steps = job?.summary ?? [];
  const checks = steps.flatMap((s) => s.checks ?? []);
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-0.5">
        {line && <p className={status === "failed" ? "text-[0.9375rem] text-destructive" : "text-[0.9375rem]"}>{line}</p>}
        {steps.length > 0 && <p className="text-[13px] text-muted-foreground/75 italic">{steps.map(stepLine).join(" · ")}</p>}
        {checks.length > 0 && (
          <details className="pt-1 text-[13px] text-muted-foreground">
            <summary className="cursor-pointer">What Polaris could not confirm ({checks.length})</summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {checks.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {unconfirmed > 0 && (
          <ActionForm action={recheckEmails.bind(null, prospectId)}>
            <SubmitButton variant="ghost" className="h-9" working pendingLabel="Rechecking…">
              <MailCheck /> Recheck emails ({unconfirmed}, free)
            </SubmitButton>
          </ActionForm>
        )}
        <ActionForm action={searchAgain.bind(null, prospectId)}>
          <SubmitButton variant="ghost" className="h-9" working pendingLabel="Starting search…">
            {job ? <RefreshCw /> : <Search />} {job ? "Search again" : "Find contacts"}
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}

// Most useful first: confirmed emails, then emails not yet confirmed, then phone-only contacts,
// then names without details. Order within a group stays as saved.
function rank(c: Contact) {
  if (c.email && !c.email_unconfirmed) return 0;
  if (c.email) return 1;
  if (c.phone || c.mobile || c.whatsapp) return 2;
  return 3;
}

function Empty() {
  return <span className="text-muted-foreground/60">—</span>;
}

function ContactsTable({ contacts }: { contacts: Contact[] }) {
  const rows = [...contacts].sort((a, b) => rank(a) - rank(b));
  return (
    // Thin, light grid lines between rows and columns.
    <div className="overflow-hidden rounded-2xl border border-border/60">
      <Table className="[&_td:not(:last-child)]:border-r [&_td]:border-border/40 [&_th:not(:last-child)]:border-r [&_th]:border-border/40">
        <TableHeader>
          <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
            <TableHead className="pl-4">Contact</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Office line</TableHead>
            <TableHead>Mobile</TableHead>
            <TableHead>WhatsApp</TableHead>
            <TableHead className="w-px text-center">Source</TableHead>
            <TableHead className="w-px">
              <span className="sr-only">Delete</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.id} className="border-border/40 align-top">
              <TableCell className="max-w-56 pl-4 whitespace-normal">
                <div className="font-semibold">{c.name}</div>
                {c.title && <div className="text-[13px] text-muted-foreground">{c.title}</div>}
              </TableCell>
              <TableCell className="whitespace-normal">
                {c.email ? (
                  <div className="space-y-1">
                    <a href={`mailto:${c.email}`} className="font-mono text-[13px] text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
                      {c.email}
                    </a>
                    <div className="flex flex-wrap gap-1">
                      <EmailStatusBadge status={c.email_status} />
                      {c.email_unconfirmed && <UnconfirmedEmailBadge />}
                    </div>
                  </div>
                ) : (
                  <Empty />
                )}
              </TableCell>
              <TableCell className="font-mono text-[13px]">{c.phone ?? <Empty />}</TableCell>
              <TableCell>
                <ActionForm action={saveMobile.bind(null, c.id)} className="flex items-center gap-1">
                  <Input
                    name="mobile"
                    defaultValue={c.mobile ?? ""}
                    placeholder="Add mobile"
                    aria-label={`Mobile for ${c.name} (unverified)`}
                    className="h-8 w-36 font-mono text-[13px]"
                  />
                  <SubmitButton variant="ghost" className="h-8 px-2" pendingLabel="…">
                    <Save aria-label="Save mobile" />
                  </SubmitButton>
                </ActionForm>
              </TableCell>
              <TableCell className="font-mono text-[13px]">{c.whatsapp ?? <Empty />}</TableCell>
              <TableCell className="text-center">
                <SourceInfo source={c.source} url={c.source_url} />
              </TableCell>
              <TableCell className="px-2 text-center">
                <ConfirmSubmit
                  action={deleteContact.bind(null, c.id)}
                  size="xs"
                  title={`Delete ${c.name}`}
                  label={
                    <>
                      <Trash2 className="text-muted-foreground" aria-hidden="true" />
                      <span className="sr-only">Delete {c.name}</span>
                    </>
                  }
                  confirmLabel="Delete"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Source as an info icon: hover shows where the contact came from and the page link; clicking
// opens that page. Keeps the table narrow.
function SourceInfo({ source, url }: { source: string; url: string | null }) {
  const tip = url ? `Source: ${source}\n${cleanHref(url)}` : `Source: ${source}`;
  const icon = <Info className="size-4" aria-hidden="true" />;
  return url ? (
    <a
      href={cleanHref(url)}
      target="_blank"
      rel="noreferrer noopener"
      title={tip}
      aria-label={tip}
      className="inline-flex text-muted-foreground hover:text-brand"
    >
      {icon}
    </a>
  ) : (
    <span title={tip} aria-label={tip} className="inline-flex cursor-help text-muted-foreground">
      {icon}
    </span>
  );
}
