import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, Check, MessageCircle, PenLine, Phone, Send } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, NativeSelect } from "@/components/field";
import { NextAction } from "@/components/next-action";
import { PageHeader } from "@/components/page-header";
import { ProspectStageBar } from "@/components/prospect-stage-bar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { allowedChannels, EVENT_LABEL, telHref, whatsappHref } from "@/lib/outreach/rules";
import { activeProfile } from "@/lib/profile-selection";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Company, Contact, OutreachEvent, Pitch, Prospect, Task } from "@/lib/types";
import { completeTask, logEvent, markSent } from "./actions";
import { SendPanel } from "./send-panel";

export const metadata: Metadata = { title: "Outreach" };

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const day = (v: string) => dateFmt.format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v));

type Row = Pick<Prospect, "id" | "company_id" | "stage"> & { companies: Pick<Company, "name"> | null };

export default async function OutreachPage() {
  const { active } = await activeProfile();
  if (!active) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader eyebrow="Outreach" title="Outreach" />
        <p className="text-base text-muted-foreground">Create a profile first.</p>
      </div>
    );
  }
  const supabase = await createClient();
  const { data: prospectRows, error } = await supabase
    .from("prospects")
    .select("id, company_id, stage, companies ( name )")
    .eq("profile_id", active.id)
    .neq("status", "rejected")
    .returns<Row[]>();
  if (error) throw new Error(error.message);
  const allIds = (prospectRows ?? []).map((p) => p.id);

  const { data: pitchRows } = allIds.length
    ? await supabase
        .from("pitches")
        .select("*")
        .in("prospect_id", allIds)
        .in("kind", ["first_contact", "follow_up"])
        .returns<Pitch[]>()
    : { data: [] as Pitch[] };
  const pitches = pitchRows ?? [];
  // A company appears once it has an approved (or already sent) first email.
  const ready = (prospectRows ?? []).filter((p) =>
    pitches.some((x) => x.prospect_id === p.id && x.kind === "first_contact" && x.status !== "draft"),
  );
  const ids = ready.map((p) => p.id);
  const companyIds = ready.map((p) => p.company_id);

  const [contactsRes, eventsRes, tasksRes] = await Promise.all([
    companyIds.length
      ? supabase.from("contacts").select("*").in("company_id", companyIds).order("created_at").returns<Contact[]>()
      : { data: [] as Contact[], error: null },
    ids.length
      ? supabase.from("outreach_events").select("*").in("prospect_id", ids).order("occurred_at", { ascending: false }).returns<OutreachEvent[]>()
      : { data: [] as OutreachEvent[], error: null },
    ids.length
      ? supabase.from("tasks").select("*").in("prospect_id", ids).eq("done", false).order("due_date").returns<Task[]>()
      : { data: [] as Task[], error: null },
  ]);
  if (eventsRes.error?.code === "42703" || contactsRes.error?.code === "42703") return <MigrationNotice />;
  for (const r of [contactsRes, eventsRes, tasksRes]) if (r.error) throw new Error(r.error.message);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Outreach"
        title="Outreach"
        description="Send the emails you approved from your own mailbox, then record them here with replies, calls and meetings. Polaris sends nothing by itself."
      />

      {ready.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle icon={PenLine}>Nothing approved to send yet</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              A company appears here once its first email is approved in the pitch studio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/pitch" className={buttonVariants({ variant: "gradient-outline" })}>
              <ArrowRight /> Open the pitch studio
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {ready.map((p) => {
            const contacts = (contactsRes.data ?? []).filter((c) => c.company_id === p.company_id);
            // Confirmed addresses first; an email Polaris could not find on its page is listed last.
            const recipients = contacts
              .filter((c) => c.email)
              .map((c) => ({ id: c.id, name: c.name, email: c.email!, verified: c.email_status === "verified", unconfirmed: Boolean(c.email_unconfirmed) }))
              .sort((a, b) => Number(a.unconfirmed) - Number(b.unconfirmed));
            const events = (eventsRes.data ?? []).filter((e) => e.prospect_id === p.id);
            const tasks = (tasksRes.data ?? []).filter((t) => t.prospect_id === p.id);
            const first = pitches.find((x) => x.prospect_id === p.id && x.kind === "first_contact")!;
            const followUp = pitches.find((x) => x.prospect_id === p.id && x.kind === "follow_up") ?? null;
            const replied = events.some((e) => e.type === "reply" || e.type === "meeting");
            const nameOf = (id: string | null) => contacts.find((c) => c.id === id)?.name ?? "a removed contact";

            return (
              <Card key={p.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle icon={Send}>{p.companies?.name ?? "Company"}</CardTitle>
                    <div className="flex flex-wrap gap-3 text-sm font-medium">
                      <Link href={`/pitch/${p.id}`} className="text-brand hover:underline">
                        Pitch
                      </Link>
                      <Link href="/contacts" className="text-brand hover:underline">
                        Contacts
                      </Link>
                    </div>
                  </div>
                  <ProspectStageBar stage={p.stage} className="mt-2" />
                </CardHeader>
                <CardContent className="space-y-6">
                  {tasks.length > 0 && (
                    <ul className="space-y-2">
                      {tasks.map((t) => {
                        const overdue = t.due_date !== null && t.due_date < today;
                        return (
                          <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed px-4 py-2.5">
                            <CalendarClock className={cn("size-4", overdue ? "text-destructive" : "text-brand")} aria-hidden="true" />
                            <span className="flex-1 text-[0.9375rem]">
                              {t.title}
                              {t.due_date && (
                                <span className={cn("ml-2 text-sm", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                                  {overdue ? "Overdue since" : "Due"} {day(t.due_date)}
                                </span>
                              )}
                            </span>
                            <form action={completeTask.bind(null, t.id)}>
                              <SubmitButton variant="ghost" className="h-8" pendingLabel="Saving…">
                                <Check /> Done
                              </SubmitButton>
                            </form>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="grid gap-6 lg:grid-cols-2">
                    <EmailBlock
                      title="First email"
                      pitch={first}
                      prospectId={p.id}
                      recipients={recipients}
                      sentTo={first.status === "sent" ? nameOf(first.contact_id) : null}
                    />
                    {followUp ? (
                      first.status === "sent" ? (
                        <EmailBlock
                          title="Follow-up"
                          pitch={followUp}
                          prospectId={p.id}
                          recipients={recipients}
                          defaultRecipientId={first.contact_id}
                          sentTo={followUp.status === "sent" ? nameOf(followUp.contact_id) : null}
                          replied={replied}
                        />
                      ) : (
                        <div className="space-y-2">
                          <h3 className="font-semibold">Follow-up</h3>
                          <p className="text-[0.9375rem] text-muted-foreground">Available once the first email is marked as sent.</p>
                        </div>
                      )
                    ) : null}
                  </div>

                  <FollowUpChannels contacts={contacts} emailSent={first.status === "sent"} replied={replied} />

                  <details className="rounded-2xl border p-4">
                    <summary className="cursor-pointer font-semibold">Log a reply, call or meeting</summary>
                    <ActionForm action={logEvent.bind(null, p.id)} resetOnSuccess className="mt-4 grid gap-4 sm:grid-cols-3">
                      <Field id={`type-${p.id}`} label="What happened">
                        <NativeSelect id={`type-${p.id}`} name="type" defaultValue="reply">
                          {(["reply", "call", "message", "meeting", "bounce", "note"] as const).map((t) => (
                            <option key={t} value={t}>
                              {EVENT_LABEL[t]}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                      <Field id={`who-${p.id}`} label="With">
                        <NativeSelect id={`who-${p.id}`} name="contact_id" defaultValue={first.contact_id ?? ""}>
                          <option value="">Not a specific person</option>
                          {contacts.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                      <Field id={`date-${p.id}`} label="Date">
                        <Input id={`date-${p.id}`} name="date" type="date" defaultValue={today} max={today} />
                      </Field>
                      <div className="sm:col-span-3">
                        <Field id={`note-${p.id}`} label="Note (optional)">
                          <Textarea id={`note-${p.id}`} name="note" rows={2} placeholder="What they said, or what was agreed" />
                        </Field>
                      </div>
                      <div className="sm:col-span-3">
                        <SubmitButton variant="gradient-outline">Save to timeline</SubmitButton>
                      </div>
                    </ActionForm>
                  </details>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Timeline:</h3>
                    {events.length ? (
                      <ol className="space-y-2 border-l pl-4">
                        {events.map((e) => (
                          <li key={e.id} className="text-[0.9375rem]">
                            <span className="font-medium">{EVENT_LABEL[e.type] ?? e.type}</span>
                            {e.contact_id && <span className="text-muted-foreground"> · {nameOf(e.contact_id)}</span>}
                            {e.outcome && <span className="text-muted-foreground"> · {e.outcome}</span>}
                            <span className="ml-2 text-[13px] text-muted-foreground/75 italic">{dateTimeFmt.format(new Date(e.occurred_at))}</span>
                            {e.note && <p className="text-muted-foreground">{e.note}</p>}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-[0.9375rem] text-muted-foreground">Nothing logged yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <NextAction current="outreach" />
    </div>
  );
}

function EmailBlock({
  title,
  pitch,
  prospectId,
  recipients,
  defaultRecipientId = null,
  sentTo,
  replied = false,
}: {
  title: string;
  pitch: Pitch;
  prospectId: string;
  recipients: { id: string; name: string; email: string; verified: boolean; unconfirmed: boolean }[];
  defaultRecipientId?: string | null;
  sentTo: string | null;
  replied?: boolean;
}) {
  return (
    <div className="space-y-3 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <Badge variant="outline">{pitch.status === "sent" ? "Sent" : pitch.status === "approved" ? "Approved" : "Draft"}</Badge>
      </div>
      {pitch.subject && <p className="text-[0.9375rem] font-medium">{pitch.subject}</p>}
      <p className="line-clamp-4 text-[0.9375rem] whitespace-pre-line text-muted-foreground">{pitch.body}</p>
      {pitch.status === "sent" ? (
        <p className="text-[13px] text-muted-foreground/75 italic">
          Sent to {sentTo}
          {pitch.sent_at ? ` on ${dateTimeFmt.format(new Date(pitch.sent_at))}` : ""}.
        </p>
      ) : pitch.status === "draft" ? (
        <p className="text-[0.9375rem]">
          This email is a draft.{" "}
          <Link href={`/pitch/${prospectId}`} className="font-medium text-brand hover:underline">
            Approve it in the pitch studio
          </Link>{" "}
          before sending.
        </p>
      ) : replied && title === "Follow-up" ? (
        <p className="text-[0.9375rem] text-muted-foreground">They replied, so the follow-up is not needed.</p>
      ) : (
        <SendPanel
          subject={pitch.subject}
          body={pitch.body}
          recipients={recipients}
          defaultRecipientId={defaultRecipientId}
          markSent={markSent.bind(null, prospectId, pitch.id)}
        />
      )}
    </div>
  );
}

// Calls and WhatsApp follow the agreed rules (roadmap 3.1): a call only after an unanswered
// email (mobile first, else the office line), WhatsApp only after a reply (the published WhatsApp
// number first, else the mobile). The user places them by hand.
function FollowUpChannels({ contacts, emailSent, replied }: { contacts: Contact[]; emailSent: boolean; replied: boolean }) {
  const reachable = contacts.filter((c) => c.mobile || c.phone || c.whatsapp);
  if (!reachable.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Follow up by phone:</h3>
      <ul className="space-y-2">
        {reachable.map((c) => {
          const callNumber = c.mobile ?? c.phone;
          const waNumber = c.whatsapp ?? c.mobile;
          const allowed = allowedChannels({ emailSent, replied, hasMobile: true });
          const wa = waNumber ? whatsappHref(waNumber) : null;
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-2 text-[0.9375rem]">
              <span className="font-medium">{c.name}</span>
              {!callNumber ? null : allowed.call ? (
                <a href={telHref(callNumber)} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  <Phone /> Call {callNumber}
                </a>
              ) : (
                <span className="text-[13px] text-muted-foreground/75 italic">Call after the first email is sent.</span>
              )}
              {waNumber &&
                (allowed.message && wa ? (
                  <a href={wa} target="_blank" rel="noreferrer noopener" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    <MessageCircle /> WhatsApp
                  </a>
                ) : (
                  <span className="text-[13px] text-muted-foreground/75 italic">WhatsApp only after they reply.</span>
                ))}
            </li>
          );
        })}
      </ul>
      <p className="text-[13px] text-muted-foreground/75 italic">
        Log each call or message below. US rules on calling and texting mobiles apply; have an attorney confirm before you start.
      </p>
    </div>
  );
}

function MigrationNotice() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="Outreach" title="Outreach" />
      <Card>
        <CardContent className="py-6 text-base leading-relaxed text-muted-foreground">
          Outreach needs one database change. In the Supabase SQL Editor, paste and run the file{" "}
          <code className="font-mono text-sm">supabase/migrations/20261118000000_contacts_outreach.sql</code>, then reload this page.
        </CardContent>
      </Card>
    </div>
  );
}
