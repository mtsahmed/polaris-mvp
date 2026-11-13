import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_TYPES, type Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Profiles" };

type Row = Pick<Profile, "id" | "name" | "type" | "positioning" | "updated_at"> & {
  icps: { approved: boolean }[];
  profile_sources: { count: number }[];
};

export default async function ProfilesPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, type, positioning, updated_at, icps ( approved ), profile_sources ( count )")
    .eq("org_id", session.org.id)
    .order("updated_at", { ascending: false })
    .returns<Row[]>();
  if (error) throw new Error(error.message);

  const profiles = data ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={session.org.name}
        title="Profiles"
        description="Each profile is a business or talent you represent. Polaris builds its ICP, research and pitches from what you put here."
        actions={
          <Link href="/profiles/new" className={buttonVariants()}>
            <Plus /> New profile
          </Link>
        }
      />

      {profiles.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <h2 className="font-heading text-2xl">No profiles yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Start with one media or creative business. Add its website, a few documents, and Polaris
            drafts the profile with sources for every claim.
          </p>
          <Link href="/profiles/new" className={buttonVariants({ className: "mt-6" })}>
            <Plus /> Create the first profile
          </Link>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {profiles.map((p) => {
            const typeLabel = PROFILE_TYPES.find((t) => t.value === p.type)?.label ?? p.type;
            const hasApprovedIcp = p.icps.some((i) => i.approved);
            const sourceCount = p.profile_sources[0]?.count ?? 0;
            return (
              <li key={p.id}>
                <Link
                  href={`/profiles/${p.id}`}
                  className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-6"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{p.name}</div>
                    <div className="truncate text-sm text-muted-foreground">
                      {p.positioning ?? "No positioning yet"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{typeLabel}</Badge>
                    <span>{sourceCount} {sourceCount === 1 ? "source" : "sources"}</span>
                    {hasApprovedIcp ? (
                      <Badge className="bg-success/15 text-success">ICP approved</Badge>
                    ) : (
                      <Badge variant="secondary">ICP pending</Badge>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
