import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anyProviderConfigured } from "@/lib/ai/generate";
import { handleAiError, logAttempts } from "@/lib/ai/log-attempts";
import { urlKey } from "@/lib/url-key";
import type { Company, Icp, Profile, Prospect, Signal } from "@/lib/types";
import { assembleBrief, assembleScore, briefSignalIds, scoreForGoal, verifiedFindings } from "./assemble";
import { researchBrief, rescoreFromFindings } from "./brief";
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
  const created = await newVersion(supabase, orgId, prospectId);
  if (!created.ok) return created;
  await supabase.from("prospects").update({ stage: "researching" }).eq("id", prospectId).eq("stage", "new_lead");
  after(() => runBrief(supabase, orgId, created.id, prospectId));
  return { ok: true };
}

// Re-scores the last finished brief from the company's saved findings: no web search. The new
// version keeps the brief's research (summary, timing, risks, roles, concepts) and its research
// date, and replaces only the scoring.
export async function startRescore(supabase: SupabaseClient, orgId: string, prospectId: string): Promise<StartResult> {
  const { data: base } = await supabase
    .from("briefs")
    .select("id")
    .eq("prospect_id", prospectId)
    .in("status", ["ready", "insufficient_evidence"])
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!base) return { ok: false, message: "There is no finished brief to re-score. Research the company first." };
  const created = await newVersion(supabase, orgId, prospectId);
  if (!created.ok) return created;
  after(() => runRescore(supabase, orgId, created.id, base.id, prospectId));
  return { ok: true };
}

// Adds a "researching" version, after checking nothing is already running.
async function newVersion(
  supabase: SupabaseClient,
  orgId: string,
  prospectId: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
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
  return { ok: true, id: brief.id };
}

async function loadContext(supabase: SupabaseClient, prospectId: string) {
  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", prospectId).single<Prospect>();
  if (!prospect) throw new Error("The company is no longer in the pipeline.");
  const [{ data: profile }, { data: icps }, { data: company }, { data: signals }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", prospect.profile_id).single<Profile>(),
    supabase.from("icps").select("*").eq("profile_id", prospect.profile_id).order("version", { ascending: false }).returns<Icp[]>(),
    supabase.from("companies").select("*").eq("id", prospect.company_id).single<Company>(),
    supabase.from("signals").select("*").eq("company_id", prospect.company_id).returns<Signal[]>(),
  ]);
  if (!profile || !company) throw new Error("The profile or company could not be loaded.");
  return {
    prospect,
    profile,
    company,
    icp: icps?.find((i) => i.approved) ?? icps?.[0] ?? null,
    existing: signals ?? [],
    website: company.website ?? (company.domain ? `https://${company.domain}` : null),
  };
}

function totalCost(attempts: { costUsd: number | null }[]) {
  const costs = attempts.map((a) => a.costUsd).filter((c): c is number => c !== null);
  return costs.length ? costs.reduce((a, b) => a + b, 0) : null;
}

async function runBrief(supabase: SupabaseClient, orgId: string, briefId: string, prospectId: string) {
  try {
    const { prospect, profile, company, icp, existing, website } = await loadContext(supabase, prospectId);

    const result = await researchBrief({
      profile,
      icp,
      company: { name: company.name, website },
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
    const { error } = await supabase
      .from("briefs")
      .update({
        ...brief,
        model: result.model,
        search_count: result.attempts.reduce((n, a) => n + (a.searches ?? 0), 0),
        cost_estimate_usd: totalCost(result.attempts),
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

async function runRescore(supabase: SupabaseClient, orgId: string, briefId: string, baseId: string, prospectId: string) {
  try {
    const { prospect, profile, company, icp, existing, website } = await loadContext(supabase, prospectId);
    const { data: base } = await supabase.from("briefs").select("*").eq("id", baseId).single<Brief>();
    if (!base) throw new Error("The brief to re-score could not be loaded.");

    const result = await rescoreFromFindings({ profile, icp, company: { name: company.name, website }, existing, notes: prospect.notes });
    await logAttempts(supabase, orgId, "intelligence-rescore", result.attempts);

    const idOf = new Map<string, string>(existing.map((s, i) => [`E${i + 1}`, s.id]));
    const urlOf = new Map<string, string>(existing.map((s, i) => [`E${i + 1}`, s.source_url]));
    const parts = assembleScore(result.data, idOf, urlOf);
    // A goal the user chose by hand is kept; otherwise the new suggestion is used.
    const userGoal = base.deal_goal && base.deal_goal !== base.deal_goal_suggested ? base.deal_goal : null;
    const research = {
      summary: base.summary,
      why_now: base.why_now,
      risks: base.risks,
      target_roles: base.target_roles,
      concept_starters: base.concept_starters,
    };
    const signal_ids = briefSignalIds({ ...parts, ...research });
    const scored = scoreForGoal({
      goal: userGoal ?? parts.deal_goal_suggested,
      criteria_sets: parts.criteria_sets,
      knockouts: parts.knockouts,
      fit_case: parts.fit_case,
      hasTiming: base.why_now.length > 0,
      hasSources: signal_ids.length > 0,
      profileType: profile.type,
    });
    const { error } = await supabase
      .from("briefs")
      .update({
        ...research,
        ...parts,
        ...scored,
        signal_ids,
        model: result.model,
        search_count: 0,
        cost_estimate_usd: totalCost(result.attempts),
        researched_at: base.researched_at, // the evidence is as old as the original research
        error: null,
      })
      .eq("id", briefId);
    if (error) throw new Error(error.message);
  } catch (err) {
    const message = await handleAiError(supabase, orgId, "intelligence-rescore", err);
    await supabase.from("briefs").update({ status: "failed", error: message }).eq("id", briefId);
  }
}
