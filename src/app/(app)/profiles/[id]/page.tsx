import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { PROFILE_TYPES, type Icp, type Profile, type ProfileSource } from "@/lib/types";
import { deleteProfile } from "../actions";
import { IcpTab } from "./icp-tab";
import { IntelligenceTab } from "./intelligence-tab";
import { OverviewTab } from "./overview-tab";
import { SourcesTab } from "./sources-tab";

const TABS = [
  { key: "overview", label: "Profile" },
  { key: "sources", label: "Sources" },
  { key: "intelligence", label: "Intelligence" },
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

  const typeLabel = PROFILE_TYPES.find((t) => t.value === profile.type)?.label ?? profile.type;
  const approvedIcp = icps?.find((i) => i.approved);
  const counts: Partial<Record<TabKey, number>> = { sources: sources?.length ?? 0 };

  return (
    <div className="mx-auto max-w-5xl">
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
        actions={<ConfirmSubmit action={deleteProfile.bind(null, profile.id)} label="Delete profile" />}
      />

      <nav className="mb-8 flex gap-1 overflow-x-auto border-b" aria-label="Profile sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/profiles/${profile.id}?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors",
              tab === t.key
                ? "border-gold font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {counts[t.key] !== undefined && <span className="ml-1.5 text-xs text-muted-foreground">{counts[t.key]}</span>}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab profile={profile} />}
      {tab === "sources" && <SourcesTab profileId={profile.id} sources={sources ?? []} />}
      {tab === "intelligence" && <IntelligenceTab profile={profile} sourceCount={sources?.length ?? 0} />}
      {tab === "icp" && <IcpTab profile={profile} icps={icps ?? []} />}
    </div>
  );
}
