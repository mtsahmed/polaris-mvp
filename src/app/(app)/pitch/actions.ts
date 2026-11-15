"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, text, type ActionState } from "@/lib/action-state";
import { anyProviderConfigured } from "@/lib/ai/generate";
import { handleAiError, logAttempts } from "@/lib/ai/log-attempts";
import {
  generateConcepts,
  researchCompany,
  urlKey,
  writePitch,
  type LabelledSignal,
  type ResearchOutput,
} from "@/lib/ai/pitch";
import { orderSignals, signalLabel } from "@/lib/pitch-utils";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { DEAL_TYPES, type Company, type Concept, type DealType, type Icp, type Profile, type Prospect, type Signal } from "@/lib/types";

type Db = Awaited<ReturnType<typeof createClient>>;

const urlSchema = z
  .string()
  .trim()
  .min(1, "Paste the company's website address.")
  .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
  .pipe(z.url({ protocol: /^https?$/, message: "Enter a valid web address." }));

const MAX_SIGNALS = 8;
const NO_PROVIDER = "No AI provider is configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local.";

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
    supabase
      .from("icps")
      .select("*")
      .eq("profile_id", profileId)
      .order("version", { ascending: false })
      .returns<Icp[]>(),
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

// ---------------------------------------------------------------------------
// Start: paste a company URL → research → workspace
// ---------------------------------------------------------------------------

export async function startPitch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const profileId = text(formData.get("profile_id"));
  if (!profileId) return fail("Choose the profile you are pitching for.");
  const parsedUrl = urlSchema.safeParse(formData.get("url") ?? "");
  if (!parsedUrl.success) return fail(parsedUrl.error.issues[0]?.message ?? "Enter a valid web address.");
  const url = parsedUrl.data;
  const notes = text(formData.get("notes"));
  if (!anyProviderConfigured()) return fail(NO_PROVIDER);

  const supabase = await createClient();
  const { profile, icp } = await loadProfileAndIcp(supabase, profileId);
  if (!profile) return fail("Profile not found.");

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
      redirect(pitchPath(existingProspect.id));
    }
  }

  let prospectId: string;
  try {
    const result = await researchCompany({ url, profile, icp, notes });
    await logAttempts(supabase, session.org.id, "pitch-research", result.attempts);
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
    prospectId = prospect.id;
    if (dropped) console.warn(`[pitch-research] ${researchMessage(kept.length, dropped)}`);
  } catch (err) {
    return fail(await handleAiError(supabase, session.org.id, "pitch-research", err));
  }

  revalidatePath("/pitch");
  redirect(pitchPath(prospectId));
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
  const ordered = orderSignals(signals ?? []);
  const labelled: (LabelledSignal & { id: string })[] = ordered.map((s, i) => ({
    id: s.id,
    label: signalLabel(i),
    type: s.type,
    summary: s.summary,
    source_url: s.source_url,
    source_date: s.source_date,
  }));
  return { prospect, company, signals: labelled, profile: profileAndIcp.profile, icp: profileAndIcp.icp };
}

export async function refreshResearch(prospectId: string, _prev: ActionState): Promise<ActionState> {
  const session = await requireSession();
  if (!anyProviderConfigured()) return fail(NO_PROVIDER);
  const supabase = await createClient();
  const ws = await loadWorkspace(supabase, prospectId);
  if (!ws) return fail("Pitch not found.");
  const url = ws.company.website ?? (ws.company.domain ? `https://${ws.company.domain}` : null);
  if (!url) return fail("This company has no website address to research.");

  try {
    const result = await researchCompany({ url, profile: ws.profile, icp: ws.icp, notes: ws.prospect.notes });
    await logAttempts(supabase, session.org.id, "pitch-research", result.attempts);
    const { kept, dropped } = verifiedSignals(result.data, result.seenUrls);
    await storeResearch(supabase, session.org.id, ws.company.id, result.data, kept, result.provider);
    await supabase
      .from("prospects")
      .update({ research_gaps: result.data.gaps, researched_at: new Date().toISOString(), research_model: result.model })
      .eq("id", prospectId);
    revalidatePath(pitchPath(prospectId));
    return ok(researchMessage(kept.length, dropped));
  } catch (err) {
    return fail(await handleAiError(supabase, session.org.id, "pitch-research", err));
  }
}

export async function saveNotes(prospectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from("prospects").update({ notes: text(formData.get("notes")) }).eq("id", prospectId);
  if (error) return fail(error.message);
  revalidatePath(pitchPath(prospectId));
  return ok("Notes saved.");
}

export async function deletePitchWorkspace(prospectId: string) {
  await requireSession();
  const supabase = await createClient();
  // Concepts and pitches go with the prospect; the company and its research stay for other profiles.
  const { error } = await supabase.from("prospects").delete().eq("id", prospectId);
  if (error) throw new Error(error.message);
  revalidatePath("/pitch");
  redirect("/pitch");
}

// ---------------------------------------------------------------------------
// Concepts
// ---------------------------------------------------------------------------

export async function createConcepts(prospectId: string, _prev: ActionState): Promise<ActionState> {
  const session = await requireSession();
  if (!anyProviderConfigured()) return fail(NO_PROVIDER);
  const supabase = await createClient();
  const ws = await loadWorkspace(supabase, prospectId);
  if (!ws) return fail("Pitch not found.");
  if (!ws.signals.length) return fail("There is no cited research yet. Refresh the research first.");

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
    if (!concepts.length) return fail("The AI returned no concepts. Try again or pick another model.");

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
    revalidatePath(pitchPath(prospectId));
    return ok(`${concepts.length} concepts drafted. Pick one to write the pitch.`);
  } catch (err) {
    return fail(await handleAiError(supabase, session.org.id, "pitch-concepts", err));
  }
}

export async function saveConcept(
  prospectId: string,
  conceptId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  const title = text(formData.get("title"));
  const description = text(formData.get("description"));
  if (!title || !description) return fail("A concept needs a title and a description.");
  const rawType = text(formData.get("deal_type"));
  const deal_type = (DEAL_TYPES as readonly string[]).includes(rawType ?? "") ? (rawType as DealType) : null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("concepts")
    .update({
      title,
      description,
      commercial_rationale: text(formData.get("commercial_rationale")),
      deal_type,
      deal_angle: text(formData.get("deal_angle")),
    })
    .eq("id", conceptId)
    .eq("prospect_id", prospectId);
  if (error) return fail(error.message);
  revalidatePath(pitchPath(prospectId));
  return ok("Concept saved.");
}

export async function chooseConcept(prospectId: string, conceptId: string) {
  await requireSession();
  const supabase = await createClient();
  await supabase.from("concepts").update({ selected: false }).eq("prospect_id", prospectId);
  const { error } = await supabase.from("concepts").update({ selected: true }).eq("id", conceptId).eq("prospect_id", prospectId);
  if (error) throw new Error(error.message);
  revalidatePath(pitchPath(prospectId));
}

// ---------------------------------------------------------------------------
// Pitch: email, subject line and follow-up (drafts until a person approves them)
// ---------------------------------------------------------------------------

export async function createPitch(prospectId: string, _prev: ActionState): Promise<ActionState> {
  const session = await requireSession();
  if (!anyProviderConfigured()) return fail(NO_PROVIDER);
  const supabase = await createClient();
  const ws = await loadWorkspace(supabase, prospectId);
  if (!ws) return fail("Pitch not found.");
  const { data: concept } = await supabase
    .from("concepts")
    .select("*")
    .eq("prospect_id", prospectId)
    .eq("selected", true)
    .maybeSingle<Concept>();
  if (!concept) return fail("Choose a concept first.");
  const { count: sentCount } = await supabase
    .from("pitches")
    .select("id", { count: "exact", head: true })
    .eq("prospect_id", prospectId)
    .eq("kind", "first_contact")
    .eq("status", "sent");
  if (sentCount) return fail("The first email has already been sent, so it cannot be rewritten. Log replies on the Outreach page.");

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
    if (!email.body.trim() || !follow_up.body.trim()) return fail("The AI returned an empty email. Try again.");

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
    revalidatePath(pitchPath(prospectId));
    return ok("Email and follow-up drafted. Edit them, then approve.");
  } catch (err) {
    return fail(await handleAiError(supabase, session.org.id, "pitch-email", err));
  }
}

export async function savePitch(
  prospectId: string,
  pitchId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  const body = text(formData.get("body"));
  if (!body) return fail("The email body cannot be empty.");
  const supabase = await createClient();
  // Editing an approved pitch sends it back to draft (database trigger), so approval always
  // covers the exact text.
  const { error } = await supabase
    .from("pitches")
    .update({ subject: text(formData.get("subject")), body })
    .eq("id", pitchId)
    .eq("prospect_id", prospectId)
    .in("status", ["draft", "approved"]);
  if (error) return fail(error.message);
  revalidatePath(pitchPath(prospectId));
  return ok("Saved as draft.");
}

export async function approvePitch(prospectId: string, pitchId: string) {
  await requireSession();
  const supabase = await createClient();
  // The database stamps the approver as the signed-in user and the time.
  // Approving does not move the pipeline stage: "Ready to pitch" needs a pursue decision and a
  // contact (journey spec 7.6).
  const { error } = await supabase
    .from("pitches")
    .update({ status: "approved" })
    .eq("id", pitchId)
    .eq("prospect_id", prospectId)
    .eq("status", "draft");
  if (error) throw new Error(error.message);
  revalidatePath(pitchPath(prospectId));
  revalidatePath("/pitch");
}
