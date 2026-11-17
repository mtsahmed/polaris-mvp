import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { DeleteWorkspaceForm } from "./delete-workspace-form";

export const metadata: Metadata = { title: "Workspace settings" };

const ROLE_LABEL = { owner: "Owner", admin: "Admin", member: "Member" } as const;

// Workspace settings: who you are here, and (for owners and admins) deleting the workspace.
export default async function WorkspacePage() {
  const session = await requireSession();
  const supabase = await createClient();
  const canDelete = session.role === "owner" || session.role === "admin";

  async function count(table: "memberships" | "profiles" | "prospects" | "contacts" | "pitches") {
    const { count: n } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("org_id", session.org.id);
    return n ?? 0;
  }
  const [members, profiles, companies, contacts, pitches] = await Promise.all([
    count("memberships"),
    count("profiles"),
    count("prospects"),
    count("contacts"),
    count("pitches"),
  ]);

  const contents: [string, number][] = [
    ["Profiles", profiles],
    ["Companies", companies],
    ["Contacts", contacts],
    ["Pitches", pitches],
    ["Members", members],
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <PageHeader eyebrow="Workspace" title={session.org.name} description="Settings for this workspace." />

      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <dl className="grid gap-6 sm:grid-cols-5">
          <div className="space-y-1 sm:col-span-5">
            <dt className="text-sm text-muted-foreground">Your role</dt>
            <dd className="text-lg font-semibold">{ROLE_LABEL[session.role]}</dd>
          </div>
          {contents.map(([label, n]) => (
            <div key={label} className="space-y-1">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="font-heading text-2xl font-semibold tabular-nums">{n}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-5 rounded-3xl border border-destructive/40 bg-destructive/5 p-6 sm:p-8">
        <div className="space-y-2">
          <div className="kicker text-destructive">Danger zone</div>
          <h2 className="text-2xl font-semibold tracking-tight">Delete this workspace</h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            This permanently deletes <span className="font-semibold text-foreground">{session.org.name}</span> and
            everything in it: all profiles and ICPs, companies and briefs, contacts, pitches, outreach history and
            usage records. Every member loses access. It cannot be undone.
          </p>
        </div>
        {canDelete ? (
          <DeleteWorkspaceForm workspaceName={session.org.name} />
        ) : (
          <p className="text-base text-muted-foreground">
            Only the workspace&apos;s owners and admins can delete it. Ask one of them if it should be removed.
          </p>
        )}
      </section>
    </div>
  );
}
