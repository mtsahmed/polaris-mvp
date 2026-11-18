import "server-only";
import { z } from "zod";
import { anyProviderConfigured } from "@/lib/ai/generate";
import { handleAiError, logAttempts } from "@/lib/ai/log-attempts";
import { generateConcepts, researchCompany, writePitch, type LabelledSignal, type ResearchOutput } from "@/lib/ai/pitch";
import { orderSignals, signalLabel } from "@/lib/pitch-utils";
import { urlKey } from "@/lib/url-key";
import type { Company, Concept, Icp, Profile, Prospect, Signal } from "@/lib/types";
import { done, failed, NO_PROVIDER, revalidate, type AiJob, type Db } from "./types";

const MAX_SIGNALS = 8;

function pitchPath(prospectId: string) {
  return `/pitch/${prospectId}`;
}

function domainOf(url: string) {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

function validDate(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return Number.isNaN(Date.parse(v)) ? null : v;
}

// Keeps only signals whose link the model actually read or was shown by a search.
// Anything else could be a made-up URL, so it is dropped rather than stored.
function verifiedSignals(research: ResearchOutput, seenUrls: string[]) {
  const seen = new Set(seenUrls.map(urlKey).filter(Boolean));
  const kept = research.signals.filter((s) => {
    const key = urlKey(s.source_url);
    return key !== null && seen.has(key) && s.summary.trim().length > 0;
  });
  return { kept: kept.slice(0, MAX_SIGNALS), dropped: research.signals.length - kept.length };
}

async function loadProfileAndIcp(supabase: Db, profileId: string) {
  const [{ data: profile }, { data: icps }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", profileId).maybeSingle<Profile>(),
    supabase.from("icps").select("*").eq("profile_id", profileId).order("version", { ascending: false }).returns<Icp[]>(),
  ]);
  return { profile, icp: icps?.find((i) => i.approved) ?? icps?.[0] ?? null };
}

// Writes the research result: company details and a fresh set of signals.
async function storeResearch(
  supabase: Db,
  orgId: string,
  companyId: string,
  research: ResearchOutput,
  signals: ResearchOutput["signals"],
  provider: "anthropic" | "openai",
) {
  const c = research.company;
  const { error: companyError } = await supabase
    .from("companies")
    .update({
      name: c.name.trim() || undefined,
      industry: c.industry.trim() || null,
      location: c.location.trim() || null,
      summary: c.summary.trim() || null,
    })
    .eq("id", companyId);
  if (companyError) throw new Error(companyError.message);

  const { error: deleteError } = await supabase.from("signals").delete().eq("company_id", companyId);
  if (deleteError) throw new Error(deleteError.message);
  if (signals.length) {
    const { error } = await supabase.from("signals").insert(
      signals.map((s) => ({
        org_id: orgId,
        company_id: companyId,
        type: s.type,
        summary: s.summary.trim(),
        source_url: s.source_url.trim(),
        source_date: validDate(s.source_date),
        quote: s.quote.trim() || null,
        search_provider: provider === "anthropic" ? "claude web search" : "openai web search",
      })),
    );
    if (error) throw new Error(error.message);
  }
}

function researchMessage(kept: number, dropped: number) {
  const base = `Research done: ${kept} cited ${kept === 1 ? "finding" : "findings"}.`;
  return dropped ? `${base} ${dropped} dropped because their link could not be matched to a page the AI read.` : base;
}

async function loadWorkspace(supabase: Db, prospectId: string) {
  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", prospectId).maybeSingle<Prospect>();
  if (!prospect) return null;
  const [{ data: company }, { data: signals }, profileAndIcp] = await Promise.all([
    supabase.from("companies").select("*").eq("id", prospect.company_id).single<Company>(),
    supabase.from("signals").select("*").eq("company_id", prospect.company_id).returns<Signal[]>(),
    loadProfileAndIcp(supabase, prospect.profile_id),
  ]);
  if (!company || !profileAndIcp.profile) return null;
  const labelled: (LabelledSignal & { id: string })[] = orderSignals(signals ?? []).map((s, i) => ({
    id: s.id,
    label: signalLabel(i),
    type: s.type,
    summary: s.summary,
    source_url: s.source_url,
    source_date: s.source_date,
  }));
  return { prospect, company, signals: labelled, profile: profileAndIcp.profile, icp: profileAndIcp.icp };
}

// ---------------------------------------------------------------------------
// Start: paste a company URL → research → workspace
// ---------------------------------------------------------------------------

const StartInput = z.object({
  profile_id: z.string().uuid({ message: "Choose the profile you are pitching for." }),
  url: z
    .string()
    .trim()
    .min(1, "Paste the company's website address.")
    .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
    .pipe(z.url({ protocol: /^https?$/, message: "Enter a valid web address." })),
  notes: z.string().trim().optional().transform((v) => v || null),
});

export const pitchStartJob: AiJob<typeof StartInput> = {
  input: StartInput,
  writing: "Writing up the research…",
  async run({ session, supabase, report }, { profile_id: profileId, url, notes }) {
    if (!anyProviderConfigured()) return failed(NO_PROVIDER);
    const { profile, icp } = await loadProfileAndIcp(supabase, profileId);
    if (!profile) return failed("Profile not found.");

    const domain = domainOf(url);
    const { data: existingCompany } = await supabase
      .from("companies")
      .select("id")
      .eq("org_id", session.org.id)
      .eq("domain", domain)
      .maybeSingle<{ id: string }>();
    if (existingCompany) {
      const { data: existingProspect } = await supabase
        .from("prospects")
        .select("id, status")
        .eq("profile_id", profileId)
        .eq("company_id", existingCompany.id)
        .maybeSingle<{ id: string; status: string }>();
      if (existingProspect) {
        // A Discovery suggestion (or a dismissed one) joins the pipeline when the user pitches it.
        if (existingProspect.status !== "saved") {
          await supabase
            .from("prospects")
            .update({ status: "saved", shortlisted_at: new Date().toISOString() })
            .eq("id", existingProspect.id);
        }
        return done("This company already has a pitch for this profile. Opening it.", pitchPath(existingProspect.id));
      }
    }

    try {
      const result = await researchCompany({ url, profile, icp, notes });
      await logAttempts(supabase, session.org.id, "pitch-research", result.attempts);
      report("Checking each finding's source and saving the research…");
      const { kept, dropped } = verifiedSignals(result.data, result.seenUrls);

      let companyId = existingCompany?.id;
      if (!companyId) {
        const { data: company, error } = await supabase
          .from("companies")
          .insert({ org_id: session.org.id, name: result.data.company.name.trim() || domain, domain, website: url })
          .select("id")
          .single<{ id: string }>();
        if (error) throw new Error(error.message);
        companyId = company.id;
      }
      await storeResearch(supabase, session.org.id, companyId, result.data, kept, result.provider);

      const { data: prospect, error } = await supabase
        .from("prospects")
        .insert({
          org_id: session.org.id,
          profile_id: profileId,
          company_id: companyId,
          stage: "researching",
          shortlisted_at: new Date().toISOString(),
          notes,
          research_gaps: result.data.gaps,
          researched_at: new Date().toISOString(),
          research_model: result.model,
        })
        .select("id")
        .single<{ id: string }>();
      if (error) throw new Error(error.message);
      revalidate("/pitch");
      return done(researchMessage(kept.length, dropped), pitchPath(prospect.id));
    } catch (err) {
      return failed(await handleAiError(supabase, session.org.id, "pitch-research", err));
    }
  },
};

// ---------------------------------------------------------------------------
// Steps inside a pitch workspace
// ---------------------------------------------------------------------------

const ProspectInput = z.object({ prospectId: z.string().uuid() });

export const pitchResearchJob: AiJob<typeof ProspectInput> = {
  input: ProspectInput,
  writing: "Writing up the research…",
  async run({ session, supabase, report }, { prospectId }) {
    if (!anyProviderConfigured()) return failed(NO_PROVIDER);
    const ws = await loadWorkspace(supabase, prospectId);
    if (!ws) return failed("Pitch not found.");
    const url = ws.company.website ?? (ws.company.domain ? `https://${ws.company.domain}` : null);
    if (!url) return failed("This company has no website address to research.");

    try {
      const result = await researchCompany({ url, profile: ws.profile, icp: ws.icp, notes: ws.prospect.notes });
      await logAttempts(supabase, session.org.id, "pitch-research", result.attempts);
      report("Checking each finding's source and saving the research…");
      const { kept, dropped } = verifiedSignals(result.data, result.seenUrls);
      await storeResearch(supabase, session.org.id, ws.company.id, result.data, kept, result.provider);
      await supabase
        .from("prospects")
        .update({ research_gaps: result.data.gaps, researched_at: new Date().toISOString(), research_model: result.model })
        .eq("id", prospectId);
      revalidate(pitchPath(prospectId));
      return done(researchMessage(kept.length, dropped));
    } catch (err) {
      return failed(await handleAiError(supabase, session.org.id, "pitch-research", err));
    }
  },
};

export const pitchConceptsJob: AiJob<typeof ProspectInput> = {
  input: ProspectInput,
  writing: "Writing the concepts…",
  async run({ session, supabase, report }, { prospectId }) {
    if (!anyProviderConfigured()) return failed(NO_PROVIDER);
    const ws = await loadWorkspace(supabase, prospectId);
    if (!ws) return failed("Pitch not found.");
    if (!ws.signals.length) return failed("There is no cited research yet. Refresh the research first.");

    try {
      const result = await generateConcepts({
        profile: ws.profile,
        icp: ws.icp,
        companyName: ws.company.name,
        companySummary: ws.company.summary,
        signals: ws.signals,
        notes: ws.prospect.notes,
      });
      await logAttempts(supabase, session.org.id, "pitch-concepts", result.attempts);
      const byLabel = new Map(ws.signals.map((s) => [s.label, s.id]));
      const concepts = result.data.concepts.slice(0, 3);
      if (!concepts.length) return failed("The AI returned no concepts. Try again or pick another model.");

      report("Saving the concepts…");
      const { error: deleteError } = await supabase.from("concepts").delete().eq("prospect_id", prospectId);
      if (deleteError) throw new Error(deleteError.message);
      const { error } = await supabase.from("concepts").insert(
        concepts.map((c) => ({
          org_id: session.org.id,
          prospect_id: prospectId,
          title: c.title.trim(),
          description: c.description.trim(),
          commercial_rationale: c.commercial_rationale.trim() || null,
          deal_type: c.deal_type,
          deal_angle: c.deal_angle.trim() || null,
          signal_ids: c.signal_refs.map((r) => byLabel.get(r.trim())).filter((id): id is string => Boolean(id)),
          model: result.model,
        })),
      );
      if (error) throw new Error(error.message);
      revalidate(pitchPath(prospectId));
      return done(`${concepts.length} concepts drafted. Pick one to write the pitch.`);
    } catch (err) {
      return failed(await handleAiError(supabase, session.org.id, "pitch-concepts", err));
    }
  },
};

// The email, subject line and follow-up (drafts until a person approves them).
export const pitchEmailJob: AiJob<typeof ProspectInput> = {
  input: ProspectInput,
  writing: "Writing the first email and follow-up…",
  draftField: "body", // the first "body" in the answer is the first email's
  async run({ session, supabase, report }, { prospectId }) {
    if (!anyProviderConfigured()) return failed(NO_PROVIDER);
    const ws = await loadWorkspace(supabase, prospectId);
    if (!ws) return failed("Pitch not found.");
    const { data: concept } = await supabase
      .from("concepts")
      .select("*")
      .eq("prospect_id", prospectId)
      .eq("selected", true)
      .maybeSingle<Concept>();
    if (!concept) return failed("Choose a concept first.");
    const { count: sentCount } = await supabase
      .from("pitches")
      .select("id", { count: "exact", head: true })
      .eq("prospect_id", prospectId)
      .eq("kind", "first_contact")
      .eq("status", "sent");
    if (sentCount) return failed("The first email has already been sent, so it cannot be rewritten. Log replies on the Outreach page.");

    try {
      const result = await writePitch({
        profile: ws.profile,
        companyName: ws.company.name,
        companySummary: ws.company.summary,
        concept,
        signals: ws.signals,
        notes: ws.prospect.notes,
      });
      await logAttempts(supabase, session.org.id, "pitch-email", result.attempts);
      const { email, follow_up } = result.data;
      if (!email.body.trim() || !follow_up.body.trim()) return failed("The AI returned an empty email. Try again.");

      report("Saving the drafts…");
      // A rewrite replaces the current email and follow-up (draft or approved, never sent ones).
      const { error: deleteError } = await supabase
        .from("pitches")
        .delete()
        .eq("prospect_id", prospectId)
        .in("kind", ["first_contact", "follow_up"])
        .in("status", ["draft", "approved"]);
      if (deleteError) throw new Error(deleteError.message);
      const base = { org_id: session.org.id, prospect_id: prospectId, concept_id: concept.id, channel: "email", status: "draft", model: result.model };
      const { error } = await supabase.from("pitches").insert([
        { ...base, kind: "first_contact", subject: email.subject.trim(), body: email.body.trim() },
        { ...base, kind: "follow_up", subject: follow_up.subject.trim(), body: follow_up.body.trim() },
      ]);
      if (error) throw new Error(error.message);
      revalidate(pitchPath(prospectId));
      return done("Email and follow-up drafted. Edit them, then approve.");
    } catch (err) {
      return failed(await handleAiError(supabase, session.org.id, "pitch-email", err));
    }
  },
};
