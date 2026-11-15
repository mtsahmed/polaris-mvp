import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { NextAction } from "@/components/next-action";
import { FollowProfile } from "@/components/profile-switcher";
import { activeProfile } from "@/lib/profile-selection";
import { followProfile } from "../../profile-actions";
import { PageHeader } from "@/components/page-header";
import { PenLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { PROFILE_TYPES, type Icp, type Profile, type ProfileSource } from "@/lib/types";
import { deleteProfile } from "../actions";
import { IcpTab } from "./icp-tab";
import { InsightsTab } from "./insights-tab";
import { OverviewTab } from "./overview-tab";
import { SourcesTab } from "./sources-tab";

const TABS = [
  { key: "overview", label: "Profile" },
  { key: "sources", label: "Sources" },
  { key: "insights", label: "Insights" },
  { key: "icp", label: "ICP" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export async function generateMetadata(props: PageProps<"/profiles/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Profile" };
}

export default async function ProfilePage(props: PageProps<"/profiles/[id]">) {
  const { id } = await props.params;
  const { tab: rawTab } = await props.searchParams;
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "overview";

  await requireSession();
  const supabase = await createClient();
  const [{ data: profile }, { data: sources }, { data: icps }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle<Profile>(),
    supabase.from("profile_sources").select("*").eq("profile_id", id).order("created_at").returns<ProfileSource[]>(),
    supabase.from("icps").select("*").eq("profile_id", id).order("version", { ascending: false }).returns<Icp[]>(),
  ]);
  if (!profile) notFound();
  const { active } = await activeProfile();

  const typeLabel = PROFILE_TYPES.find((t) => t.value === profile.type)?.label ?? profile.type;
  const approvedIcp = icps?.find((i) => i.approved);
  const counts: Partial<Record<TabKey, number>> = { sources: sources?.length ?? 0 };

  return (
    <div className="mx-auto max-w-7xl">
      <FollowProfile profileId={profile.id} activeId={active?.id ?? null} follow={followProfile} />
      <div className="mb-4 text-sm">
        <Link href="/profiles" className="text-muted-foreground hover:text-foreground">
          ← Profiles
        </Link>
      </div>
      <PageHeader
        title={profile.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{typeLabel}</Badge>
            {approvedIcp ? (
              <Badge className="bg-success/15 text-success">ICP v{approvedIcp.version} approved</Badge>
            ) : (
              <Badge variant="secondary">ICP not approved</Badge>
            )}
            {profile.website && (
              <a href={profile.website} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                {profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </span>
        }
        actions={
          <>
            <Link href={`/pitch?profile=${profile.id}`} className={buttonVariants({ variant: "outline" })}>
              <PenLine /> New pitch
            </Link>
            <ConfirmSubmit action={deleteProfile.bind(null, profile.id)} label="Delete profile" />
          </>
        }
      />

      <nav className="mb-8 flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--border)]" aria-label="Profile sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/profiles/${profile.id}?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-4 py-3 text-base font-medium transition-colors",
              tab === t.key
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {counts[t.key] !== undefined && <span className="ml-2 text-sm text-muted-foreground">{counts[t.key]}</span>}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab profile={profile} />}
      {tab === "sources" && <SourcesTab profileId={profile.id} sources={sources ?? []} />}
      {tab === "insights" && <InsightsTab profile={profile} sourceCount={sources?.length ?? 0} />}
      {tab === "icp" && <IcpTab profile={profile} icps={icps ?? []} />}

      <NextAction current={tab === "icp" ? "icp" : "profile"} profileId={profile.id} />
    </div>
  );
}
