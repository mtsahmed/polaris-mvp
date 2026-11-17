"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, ok, text, type ActionState } from "@/lib/action-state";
import { discoverCompanies, MAX_DISCOVERY } from "@/lib/ai/discovery";
import { anyProviderConfigured } from "@/lib/ai/generate";
import { handleAiError, logAttempts } from "@/lib/ai/log-attempts";
import { urlKey } from "@/lib/ai/pitch";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { startBrief } from "@/lib/intelligence/run";
import { unshortlistBlocker } from "@/lib/discovery/unshortlist";
import type { Icp, Profile } from "@/lib/types";

const NO_PROVIDER = "No AI provider is configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local.";

function domainOf(url: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
    if (!u.hostname.includes(".")) return null;
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function validDate(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return Number.isNaN(Date.parse(v)) ? null : v;
}

function discoveryPath(profileId: string) {
  return `/discovery?profile=${profileId}`;
}

export async function runDiscovery(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const profileId = text(formData.get("profile_id"));
  if (!profileId) return fail("Choose the profile to find companies for.");
  const focus = text(formData.get("focus"));
  const count = Math.max(1, Math.min(MAX_DISCOVERY, Number(formData.get("count")) || 5));
  if (!anyProviderConfigured()) return fail(NO_PROVIDER);

  const supabase = await createClient();
  const [{ data: profile }, { data: icps }, { data: existing }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", profileId).maybeSingle<Profile>(),
    supabase.from("icps").select("*").eq("profile_id", profileId).order("version", { ascending: false }).returns<Icp[]>(),
    supabase
      .from("prospects")
      .select("companies ( domain )")
      .eq("profile_id", profileId)
      .returns<{ companies: { domain: string | null } | null }[]>(),
  ]);
  if (!profile) return fail("Profile not found.");
  const icp = icps?.find((i) => i.approved) ?? icps?.[0] ?? null;

  // Companies already in this profile's pipeline (any status) and the profile's own site.
  const exclude = new Set(
    (existing ?? []).map((r) => r.companies?.domain).filter((d): d is string => Boolean(d)),
  );
  const ownDomain = profile.website ? domainOf(profile.website) : null;
  if (ownDomain) exclude.add(ownDomain);

  let added = 0;
  let dropped = 0;
  try {
    const result = await discoverCompanies({ profile, icp, focus, count, exclude: [...exclude] });
    await logAttempts(supabase, session.org.id, "discovery", result.attempts);
    const seen = new Set(result.seenUrls.map(urlKey).filter(Boolean));
    const provider = result.provider === "anthropic" ? "claude web search" : "openai web search";

    for (const c of result.data.companies.slice(0, count)) {
      const domain = domainOf(c.website);
      // Only findings whose link the AI really read; a company with none is not suggested.
      const signals = c.signals.filter((s) => {
        const key = urlKey(s.source_url);
        return key !== null && seen.has(key) && s.summary.trim().length > 0;
      });
      if (!domain || exclude.has(domain) || !signals.length) {
        dropped++;
        continue;
      }
      exclude.add(domain);

      // Reuse the company if another profile already has it; never overwrite its research.
      const { data: found } = await supabase
        .from("companies")
        .select("id")
        .eq("org_id", session.org.id)
        .eq("domain", domain)
        .maybeSingle<{ id: string }>();
      let companyId = found?.id;
      if (!companyId) {
        const { data: company, error } = await supabase
          .from("companies")
          .insert({
            org_id: session.org.id,
            name: c.name.trim() || domain,
            domain,
            website: `https://${domain}`,
            industry: c.industry.trim() || null,
            location: c.location.trim() || null,
          })
          .select("id")
          .single<{ id: string }>();
        if (error) throw new Error(error.message);
        companyId = company.id;
      }

      // Add the findings, skipping any page already stored for this company.
      const { data: stored } = await supabase
        .from("signals")
        .select("id, source_url")
        .eq("company_id", companyId)
        .returns<{ id: string; source_url: string }[]>();
      const storedByKey = new Map((stored ?? []).map((s) => [urlKey(s.source_url), s.id]));
      for (const s of signals) {
        const key = urlKey(s.source_url);
        if (!storedByKey.has(key)) {
          const { data: row, error } = await supabase
            .from("signals")
            .insert({
              org_id: session.org.id,
              company_id: companyId,
              type: s.type,
              summary: s.summary.trim(),
              source_url: s.source_url.trim(),
              source_date: validDate(s.source_date),
              quote: s.quote.trim() || null,
              search_provider: provider,
            })
            .select("id")
            .single<{ id: string }>();
          if (error) throw new Error(error.message);
          storedByKey.set(key, row.id);
        }
      }

      const { error } = await supabase.from("prospects").insert({
        org_id: session.org.id,
        profile_id: profileId,
        company_id: companyId,
        stage: "new_lead",
        status: "suggested",
        fit_summary: c.fit_summary.trim() || null,
        discovered_at: new Date().toISOString(),
        discovery_model: result.model,
        discovery_focus: focus,
      });
      if (error) throw new Error(error.message);
      added++;
    }
  } catch (err) {
    return fail(await handleAiError(supabase, session.org.id, "discovery", err));
  }

  revalidatePath("/discovery");
  if (!added) {
    return fail(
      dropped
        ? `No company could be suggested: ${dropped} had no website or no finding whose link the AI actually read. Try again or narrow the focus.`
        : "The AI found no matching companies. Try a different focus.",
    );
  }
  redirect(`${discoveryPath(profileId)}&found=${added}&dropped=${dropped}`);
}

// Shortlisting puts the company in the pipeline and starts its intelligence brief in the
// background (spec 7.3). Research runs only here and on a user-triggered refresh.
export async function shortlistSuggestion(prospectId: string, _prev: ActionState): Promise<ActionState> {
  const session = await requireSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from("prospects")
    .update({ status: "saved", shortlisted_at: new Date().toISOString() })
    .eq("id", prospectId)
    .eq("status", "suggested");
  if (error) return fail(error.message);
  // Shortlisted before and moved back: reuse the brief it already has instead of paying for new research.
  const { data: earlier } = await supabase
    .from("briefs")
    .select("id")
    .eq("prospect_id", prospectId)
    .in("status", ["ready", "insufficient_evidence"])
    .limit(1)
    .maybeSingle();
  if (earlier) {
    revalidatePath("/discovery");
    revalidatePath("/intelligence");
    revalidatePath("/pitch");
    return ok("Shortlisted again. Its earlier intelligence brief is back in Intelligence.");
  }
  const started = await startBrief(supabase, session.org.id, prospectId);
  revalidatePath("/discovery");
  revalidatePath("/intelligence");
  revalidatePath("/pitch");
  return started.ok
    ? ok("Shortlisted. Its intelligence brief is being researched; it takes a few minutes.")
    : fail(`Shortlisted, but research could not start: ${started.message}`);
}

export async function dismissSuggestion(prospectId: string) {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from("prospects").update({ status: "rejected" }).eq("id", prospectId);
  if (error) throw new Error(error.message);
  revalidatePath("/discovery");
}

// Moves a shortlisted company back to Suggestions. Its research is kept; shortlisting it again
// reuses that brief.
export async function unshortlistProspect(prospectId: string) {
  await requireSession();
  const supabase = await createClient();
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, company_id, decision")
    .eq("id", prospectId)
    .eq("status", "saved")
    .maybeSingle<{ id: string; company_id: string; decision: string }>();
  if (!prospect) throw new Error("That company is not on the shortlist.");
  const blocker = await unshortlistBlocker(supabase, prospect);
  if (blocker) throw new Error(blocker);
  const { error } = await supabase
    .from("prospects")
    .update({ status: "suggested", shortlisted_at: null, stage: "new_lead", decision: "none" })
    .eq("id", prospectId);
  if (error) throw new Error(error.message);
  revalidatePath("/discovery");
  revalidatePath("/intelligence");
  revalidatePath("/pitch");
  revalidatePath("/dashboard");
}
