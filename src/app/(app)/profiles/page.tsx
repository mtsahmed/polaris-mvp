import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { HowItWorksEmbed } from "@/components/how-it-works-embed";
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
          <Link href="/profiles/new" className={buttonVariants({ variant: "brand", size: "lg" })}>
            <Plus /> New profile
          </Link>
        }
      />

      {profiles.length === 0 ? (
        // Welcome for a workspace with no profile yet: the first step, then the whole route.
        <div className="space-y-12">
          <div className="rounded-3xl border border-dashed bg-card px-8 py-16 text-center">
            <div className="kicker">Welcome</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Start with your first profile</h2>
            <p className="mx-auto mt-3 max-w-md text-lg leading-relaxed text-muted-foreground">
              Describe one media or creative business. Add its website, a few documents, and Polaris
              drafts the profile with sources for every claim.
            </p>
            <Link href="/profiles/new" className={buttonVariants({ variant: "brand", size: "lg", className: "mt-8" })}>
              <Plus /> Create the first profile
            </Link>
          </div>
          <section aria-label="How Polaris works">
            <HowItWorksEmbed />
            <p className="mt-3 text-[13px] italic text-muted-foreground/75">
              This route map stays in the sidebar under How it works.
            </p>
          </section>
        </div>
      ) : (
        <ul className="grid gap-4">
          {profiles.map((p) => {
            const typeLabel = PROFILE_TYPES.find((t) => t.value === p.type)?.label ?? p.type;
            const hasApprovedIcp = p.icps.some((i) => i.approved);
            const sourceCount = p.profile_sources[0]?.count ?? 0;
            return (
              <li key={p.id} className="min-w-0">
                <Link
                  href={`/profiles/${p.id}`}
                  className="group flex flex-col gap-3 rounded-2xl border bg-card px-6 py-5 shadow-[0_1px_2px_rgb(10_15_28/0.04)] transition-all hover:-translate-y-px hover:border-brand/40 hover:shadow-[0_10px_30px_-14px_rgb(196_0_106/0.35)] sm:flex-row sm:items-center sm:gap-8"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-heading text-xl font-semibold tracking-tight">{p.name}</div>
                    <div className="mt-1 truncate text-base text-muted-foreground">
                      {p.positioning ?? "No positioning yet"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
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
