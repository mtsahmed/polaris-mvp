import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { effectiveStatus, type Brief } from "@/lib/intelligence/types";
import type { Icp, Profile, Prospect } from "@/lib/types";
import { computeJourney, type JourneyInput, type MilestoneStatus } from "./compute";

export type JourneyResult =
  | { ok: true; milestones: MilestoneStatus[] }
  // The database is missing a column the journey needs (a migration has not been run).
  | { ok: false; reason: "migration"; message: string };

// Reads every record the journey bar and Next action button need for one profile, then derives
// states and status lines. Read-only; cached per request so the bar and the button share it.
export const getJourneyStatus = cache(async (profileId: string): Promise<JourneyResult> => {
  const supabase = await createClient();
  const [profileRes, sourcesRes, icpsRes, prospectsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("positioning, services, audience, objectives, voice_samples")
      .eq("id", profileId)
      .maybeSingle<Pick<Profile, "positioning" | "services" | "audience" | "objectives" | "voice_samples">>(),
    supabase.from("profile_sources").select("id", { count: "exact", head: true }).eq("profile_id", profileId),
    supabase.from("icps").select("version, approved").eq("profile_id", profileId).returns<Pick<Icp, "version" | "approved">[]>(),
    supabase
      .from("prospects")
      .select("id, company_id, status, stage, discovered_at, shortlisted_at, decision")
      .eq("profile_id", profileId)
      .returns<JourneyInput["prospects"]>(),
  ]);
  if (prospectsRes.error?.code === "42703") {
    return {
      ok: false,
      reason: "migration",
      message: "Run supabase/migrations/20261117000000_intelligence.sql in the Supabase SQL Editor to turn on the journey bar.",
    };
  }
  for (const r of [profileRes, icpsRes, prospectsRes]) if (r.error) throw new Error(r.error.message);
  const profile = profileRes.data;
  if (!profile) throw new Error("Profile not found.");

  const prospects = prospectsRes.data ?? [];
  const prospectIds = prospects.map((p) => p.id);
  const companyIds = [...new Set(prospects.map((p) => p.company_id))];

  const none = { data: [] as never[], error: null };
  const [briefsRes, contactsRes, conceptsRes, pitchesRes, tasksRes] = await Promise.all([
    prospectIds.length
      ? supabase
          .from("briefs")
          .select("prospect_id, version, status, created_at, target_roles")
          .in("prospect_id", prospectIds)
          .order("version", { ascending: false })
          .returns<Pick<Brief, "prospect_id" | "version" | "status" | "created_at" | "target_roles">[]>()
      : none,
    companyIds.length
      ? supabase
          .from("contacts")
          .select("company_id, email, email_status")
          .in("company_id", companyIds)
          .returns<{ company_id: string; email: string | null; email_status: string }[]>()
      : none,
    prospectIds.length
      ? supabase.from("concepts").select("prospect_id, selected").in("prospect_id", prospectIds).returns<JourneyInput["concepts"]>()
      : none,
    prospectIds.length
      ? supabase
          .from("pitches")
          .select("id, prospect_id, kind, status")
          .in("prospect_id", prospectIds)
          .returns<(JourneyInput["pitches"][number] & { id: string })[]>()
      : none,
    prospectIds.length
      ? supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .in("prospect_id", prospectIds)
          .eq("done", false)
          .lte("due_date", new Date().toISOString().slice(0, 10))
      : { count: 0, error: null },
  ]);
  for (const r of [briefsRes, contactsRes, conceptsRes, pitchesRes]) if (r.error) throw new Error(r.error.message);

  const eventsRes = prospectIds.length
    ? await supabase.from("outreach_events").select("type").in("prospect_id", prospectIds).returns<{ type: string }[]>()
    : { data: [] as { type: string }[], error: null };
  if (eventsRes.error?.code === "42703") {
    return {
      ok: false,
      reason: "migration",
      message: "Run supabase/migrations/20261118000000_contacts_outreach.sql in the Supabase SQL Editor to turn on Contacts and Outreach.",
    };
  }
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  // Latest brief per prospect (rows arrive newest version first).
  const latest = new Map<string, JourneyInput["briefs"][number]>();
  for (const b of briefsRes.data ?? []) {
    if (!latest.has(b.prospect_id)) {
      latest.set(b.prospect_id, {
        prospect_id: b.prospect_id,
        status: effectiveStatus(b),
        target_role_count: b.target_roles?.length ?? 0,
      });
    }
  }

  const events = eventsRes.data ?? [];
  return {
    ok: true,
    milestones: computeJourney({
      profile: {
        positioning: profile.positioning,
        services: profile.services,
        audience: profile.audience,
        objectives: profile.objectives,
        voiceSampleCount: profile.voice_samples.length,
        sourceCount: sourcesRes.count ?? 0,
      },
      icps: icpsRes.data ?? [],
      prospects: prospects as Pick<Prospect, keyof JourneyInput["prospects"][number]>[],
      briefs: [...latest.values()],
      contacts: (contactsRes.data ?? []).map((c) => ({
        company_id: c.company_id,
        has_email: Boolean(c.email),
        email_verified: c.email_status === "verified",
      })),
      concepts: conceptsRes.data ?? [],
      pitches: pitchesRes.data ?? [],
      outreach: {
        sent: events.filter((e) => e.type === "sent").length,
        replied: events.filter((e) => e.type === "reply" || e.type === "meeting").length,
        followUpsDue: tasksRes.count ?? 0,
      },
    }),
  };
});
