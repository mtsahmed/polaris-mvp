import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anyProviderConfigured } from "@/lib/ai/generate";
import { handleAiError, logAttempts } from "@/lib/ai/log-attempts";
import { urlKey } from "@/lib/url-key";
import type { Company, Icp, Profile, Prospect, Signal } from "@/lib/types";
import { assembleBrief, verifiedFindings } from "./assemble";
import { researchBrief } from "./brief";
import { effectiveStatus, type Brief } from "./types";

function validDate(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return Number.isNaN(Date.parse(v)) ? null : v;
}

export type StartResult = { ok: true } | { ok: false; message: string };

// Creates a new brief version in "researching" and runs the research after the response is
// sent (Next.js after()), so the page never waits. Called only on shortlisting and on a
// user-triggered research, refresh or retry; never on page load.
export async function startBrief(supabase: SupabaseClient, orgId: string, prospectId: string): Promise<StartResult> {
  if (!anyProviderConfigured()) {
    return { ok: false, message: "No AI provider is configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local." };
  }
  const { data: latest, error: latestError } = await supabase
    .from("briefs")
    .select("version, status, created_at")
    .eq("prospect_id", prospectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<Brief, "version" | "status" | "created_at">>();
  if (latestError) return { ok: false, message: latestError.message };
  if (latest && effectiveStatus(latest) === "researching") {
    return { ok: false, message: "Research for this company is already running." };
  }
  if (latest?.status === "researching") {
    // The earlier job never finished (server restart or timeout); record that before retrying.
    await supabase
      .from("briefs")
      .update({ status: "failed", error: "Research did not finish in time." })
      .eq("prospect_id", prospectId)
      .eq("version", latest.version);
  }

  const { data: brief, error } = await supabase
    .from("briefs")
    .insert({ org_id: orgId, prospect_id: prospectId, version: (latest?.version ?? 0) + 1, status: "researching" })
    .select("id")
    .single<{ id: string }>();
  if (error) return { ok: false, message: error.message };

  await supabase.from("prospects").update({ stage: "researching" }).eq("id", prospectId).eq("stage", "new_lead");

  after(() => runBrief(supabase, orgId, brief.id, prospectId));
  return { ok: true };
}

async function runBrief(supabase: SupabaseClient, orgId: string, briefId: string, prospectId: string) {
  try {
    const { data: prospect } = await supabase.from("prospects").select("*").eq("id", prospectId).single<Prospect>();
    if (!prospect) throw new Error("The company is no longer in the pipeline.");
    const [{ data: profile }, { data: icps }, { data: company }, { data: signals }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", prospect.profile_id).single<Profile>(),
      supabase.from("icps").select("*").eq("profile_id", prospect.profile_id).order("version", { ascending: false }).returns<Icp[]>(),
      supabase.from("companies").select("*").eq("id", prospect.company_id).single<Company>(),
      supabase.from("signals").select("*").eq("company_id", prospect.company_id).returns<Signal[]>(),
    ]);
    if (!profile || !company) throw new Error("The profile or company could not be loaded.");
    const icp = icps?.find((i) => i.approved) ?? icps?.[0] ?? null;
    const existing = signals ?? [];

    const result = await researchBrief({
      profile,
      icp,
      company: { name: company.name, website: company.website ?? (company.domain ? `https://${company.domain}` : null) },
      existing,
      notes: prospect.notes,
    });
    await logAttempts(supabase, orgId, "intelligence-brief", result.attempts);

    // E# → stored signals; N# → new findings whose link was really seen, stored once per page.
    const idOf = new Map<string, string>(existing.map((s, i) => [`E${i + 1}`, s.id]));
    const idByUrl = new Map(existing.map((s) => [urlKey(s.source_url), s.id]));
    const provider = result.provider === "anthropic" ? "claude web search" : "openai web search";
    for (const f of verifiedFindings(result.data.findings, result.seenUrls)) {
      const key = urlKey(f.source_url);
      let id = idByUrl.get(key);
      if (!id) {
        const { data: row, error } = await supabase
          .from("signals")
          .insert({
            org_id: orgId,
            company_id: company.id,
            type: f.type,
            summary: f.summary.trim(),
            source_url: f.source_url.trim(),
            source_date: validDate(f.source_date),
            quote: f.quote.trim() || null,
            search_provider: provider,
          })
          .select("id")
          .single<{ id: string }>();
        if (error) throw new Error(error.message);
        id = row.id;
        idByUrl.set(key, id);
      }
      idOf.set(f.label, id);
    }

    const urlOf = new Map<string, string>(existing.map((s, i) => [`E${i + 1}`, s.source_url]));
    for (const f of verifiedFindings(result.data.findings, result.seenUrls)) urlOf.set(f.label, f.source_url.trim());
    if (company.website) urlOf.set("W1", company.website);
    const brief = assembleBrief(result.data, idOf, profile.type, urlOf);
    const costs = result.attempts.map((a) => a.costUsd).filter((c): c is number => c !== null);
    const { error } = await supabase
      .from("briefs")
      .update({
        ...brief,
        model: result.model,
        search_count: result.attempts.reduce((n, a) => n + (a.searches ?? 0), 0),
        cost_estimate_usd: costs.length ? costs.reduce((a, b) => a + b, 0) : null,
        researched_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", briefId);
    if (error) throw new Error(error.message);
  } catch (err) {
    const message = await handleAiError(supabase, orgId, "intelligence-brief", err);
    await supabase.from("briefs").update({ status: "failed", error: message }).eq("id", briefId);
  }
}
